#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Web3 = require('web3');

const web3 = new Web3();
const LEGACY_ADDRESS = '0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477';
const SNAPSHOT_PATH = path.join(__dirname, '..', 'migrations', 'snapshots', 'legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json');
const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api';
const EIP1967_IMPLEMENTATION_SLOT = '0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { block: 'latest' };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--block') parsed.block = args[i + 1];
  }
  return parsed;
}

function runCurl(url, extra = []) {
  return execFileSync('curl', ['-sS', '--max-time', '30', '-L', '-A', 'Mozilla/5.0', ...extra, url], { encoding: 'utf8' });
}

function runJsonRpc(rpcUrl, method, params = []) {
  const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const out = execFileSync('curl', ['-sS', '--max-time', '30', '-H', 'content-type: application/json', '--data', payload, rpcUrl], { encoding: 'utf8' });
  const parsed = JSON.parse(out);
  if (parsed.error) throw new Error(`RPC ${method} failed: ${parsed.error.message}`);
  return parsed.result;
}

function toHexBlock(blockNumberOrLatest) {
  if (blockNumberOrLatest === 'latest') return 'latest';
  return `0x${Number(blockNumberOrLatest).toString(16)}`;
}

function checksum(address) {
  if (!address) return null;
  if (/^0x0{40}$/i.test(address)) return '0x0000000000000000000000000000000000000000';
  return web3.utils.toChecksumAddress(address);
}

function getEtherscanSource(address, apiKey) {
  if (apiKey) {
    const url = `${ETHERSCAN_V2}?chainid=1&module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
    const parsed = JSON.parse(runCurl(url));
    if (parsed.status === '1' && parsed.result && parsed.result[0]) return parsed.result[0];
  }
  const html = runCurl(`https://etherscan.io/address/${address}#code`);
  const abiMatch = html.match(/id='js-copytextarea2'[^>]*>(\[.*?\])<\/pre>/s);
  const ctorMatch = html.match(/Constructor Arguments[\s\S]*?<pre[^>]*>([0-9a-fA-F]+)<br>/s);
  if (!abiMatch) throw new Error('Failed to fetch ABI from Etherscan (API+HTML failed).');
  return {
    ContractName: 'AGIJobManager', CompilerVersion: 'unknown', OptimizationUsed: 'unknown', Runs: 'unknown',
    Proxy: '0', Implementation: '', ABI: abiMatch[1], ConstructorArguments: ctorMatch ? ctorMatch[1] : ''
  };
}

function getTxHashes(address, apiKey) {
  if (apiKey) {
    const hashes = [];
    const seen = new Set();
    for (let page = 1; page <= 1000; page += 1) {
      const url = `${ETHERSCAN_V2}?chainid=1&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=10000&sort=asc&apikey=${apiKey}`;
      const parsed = JSON.parse(runCurl(url));
      if (parsed.status !== '1') break;
      const rows = parsed.result || [];
      for (const row of rows) {
        const hash = String(row.hash || '').toLowerCase();
        if (hash && !seen.has(hash)) {
          seen.add(hash);
          hashes.push(hash);
        }
      }
      if (rows.length < 10000) return hashes;
    }
    throw new Error('Etherscan txlist appears truncated after pagination. Refusing partial mutation replay.');
  }
  const html = runCurl(`https://etherscan.io/txs?a=${address}`);
  return [...new Set((html.match(/\/tx\/(0x[0-9a-fA-F]{64})/g) || []).map((x) => x.slice(4).toLowerCase()))];
}

function encodeCall(abiEntry, args = []) {
  return web3.eth.abi.encodeFunctionCall(abiEntry, args);
}

function decodeOutput(abiEntry, raw) {
  const outputs = abiEntry.outputs || [];
  if (outputs.length === 0) return null;
  const decoded = web3.eth.abi.decodeParameters(outputs, raw);
  if (outputs.length === 1) return decoded[0];
  return decoded;
}

function callAt(rpcUrl, address, abiEntry, args, blockTag) {
  const data = encodeCall(abiEntry, args);
  const raw = runJsonRpc(rpcUrl, 'eth_call', [{ to: address, data }, blockTag]);
  return decodeOutput(abiEntry, raw);
}

function namehash(name) {
  let node = '0x' + '00'.repeat(32);
  for (const label of name.split('.').reverse()) {
    node = web3.utils.keccak256(node + web3.utils.keccak256(label).slice(2));
  }
  return node;
}

function str(v) { return String(v); }

async function main() {
  const { block } = parseArgs();
  const rpcUrl = process.env.MAINNET_RPC_URL || 'https://eth.llamarpc.com';
  const apiKey = process.env.ETHERSCAN_API_KEY || '';

  const chainIdHex = runJsonRpc(rpcUrl, 'eth_chainId', []);
  const chainId = Number(chainIdHex);
  if (chainId !== 1) throw new Error(`Expected chainId=1 got ${chainId}`);

  const blockTag = block === 'latest' ? 'latest' : toHexBlock(block);
  const blockInfo = runJsonRpc(rpcUrl, 'eth_getBlockByNumber', [blockTag, false]);
  if (!blockInfo) throw new Error(`Cannot fetch block ${blockTag}`);
  const blockNumber = Number(blockInfo.number);

  const source = getEtherscanSource(LEGACY_ADDRESS, apiKey);
  const abi = JSON.parse(source.ABI);
  const fnByName = new Map(abi.filter((x) => x.type === 'function').map((x) => [x.name, x]));
  const fnBySig = new Map(abi.filter((x) => x.type === 'function').map((x) => [web3.eth.abi.encodeFunctionSignature(x), x]));

  const implStorage = runJsonRpc(rpcUrl, 'eth_getStorageAt', [LEGACY_ADDRESS, EIP1967_IMPLEMENTATION_SLOT, toHexBlock(blockNumber)]);
  const implAddress = checksum(`0x${implStorage.slice(-40)}`);

  const calls = {};
  const getters = ['owner','agiToken','ens','nameWrapper','clubRootNode','agentRootNode','validatorMerkleRoot','agentMerkleRoot','paused','settlementPaused','lockIdentityConfig','ensJobPages','useEnsJobTokenURI','requiredValidatorApprovals','requiredValidatorDisapprovals','voteQuorum','premiumReputationThreshold','validationRewardPercentage','maxJobPayout','jobDurationLimit','completionReviewPeriod','disputeReviewPeriod','validatorBondBps','validatorBondMin','validatorBondMax','validatorSlashBps','challengePeriodAfterApproval','agentBond','agentBondBps','agentBondMin','agentBondMax'];
  for (const g of getters) {
    const fn = fnByName.get(g);
    if (!fn) continue;
    calls[g] = callAt(rpcUrl, LEGACY_ADDRESS, fn, [], toHexBlock(blockNumber));
  }

  const agiTypesOnchain = [];
  const agiTypesFn = fnByName.get('agiTypes');
  if (agiTypesFn) {
    for (let i = 0; i < 64; i += 1) {
      try {
        const decoded = callAt(rpcUrl, LEGACY_ADDRESS, agiTypesFn, [String(i)], toHexBlock(blockNumber));
        const nft = checksum(decoded.nftAddress || decoded[0]);
        const pct = str(decoded.payoutPercentage || decoded[1]);
        if (!nft || /^0x0{40}$/i.test(nft)) break;
        agiTypesOnchain.push({ nftAddress: nft, payoutPercentage: pct, enabled: Number(pct) > 0, source: { method: 'eth_call', index: i } });
      } catch (_e) { break; }
    }
  }

  const txHashes = getTxHashes(LEGACY_ADDRESS, apiKey);
  const mutations = [];
  const tracked = new Set(['addModerator','removeModerator','addAdditionalAgent','removeAdditionalAgent','addAdditionalValidator','removeAdditionalValidator','blacklistAgent','blacklistValidator','addAGIType','disableAGIType','setBaseIpfsUrl']);

  for (const hash of txHashes) {
    const tx = runJsonRpc(rpcUrl, 'eth_getTransactionByHash', [hash]);
    if (!tx || !tx.to || tx.to.toLowerCase() !== LEGACY_ADDRESS.toLowerCase() || !tx.input || tx.input.length < 10) continue;
    const receipt = runJsonRpc(rpcUrl, 'eth_getTransactionReceipt', [hash]);
    if (!receipt || receipt.status !== '0x1' || Number(receipt.blockNumber) > blockNumber) continue;
    const fn = fnBySig.get(tx.input.slice(0, 10));
    if (!fn || !tracked.has(fn.name)) continue;
    const decoded = web3.eth.abi.decodeParameters(fn.inputs, tx.input.slice(10));
    mutations.push({ hash, blockNumber: Number(receipt.blockNumber), transactionIndex: Number(receipt.transactionIndex), functionName: fn.name, args: fn.inputs.map((i, idx) => decoded[idx]) });
  }
  mutations.sort((a,b)=>(a.blockNumber-b.blockNumber)||(a.transactionIndex-b.transactionIndex));

  const maps = { moderators:new Map(), additionalAgents:new Map(), additionalValidators:new Map(), blacklistedAgents:new Map(), blacklistedValidators:new Map() };
  const agiMap = new Map(); const agiOrder = []; let baseIpfsUrl = null;
  const put = (map, addr, enabled, src)=>map.set(checksum(addr),{enabled,source:src});

  for (const m of mutations) {
    const src = { method:'tx_input_replay', txHash:m.hash, blockNumber:m.blockNumber, transactionIndex:m.transactionIndex };
    const [a0,a1] = m.args;
    if (m.functionName==='addModerator') put(maps.moderators,a0,true,src);
    if (m.functionName==='removeModerator') put(maps.moderators,a0,false,src);
    if (m.functionName==='addAdditionalAgent') put(maps.additionalAgents,a0,true,src);
    if (m.functionName==='removeAdditionalAgent') put(maps.additionalAgents,a0,false,src);
    if (m.functionName==='addAdditionalValidator') put(maps.additionalValidators,a0,true,src);
    if (m.functionName==='removeAdditionalValidator') put(maps.additionalValidators,a0,false,src);
    if (m.functionName==='blacklistAgent') put(maps.blacklistedAgents,a0,Boolean(a1),src);
    if (m.functionName==='blacklistValidator') put(maps.blacklistedValidators,a0,Boolean(a1),src);
    if (m.functionName==='setBaseIpfsUrl') baseIpfsUrl = a0;
    if (m.functionName==='addAGIType') {
      const nft = checksum(a0); const pct = str(a1);
      if (!agiMap.has(nft)) agiOrder.push(nft);
      agiMap.set(nft,{nftAddress:nft,payoutPercentage:pct,enabled:Number(pct)>0,source:src});
    }
    if (m.functionName==='disableAGIType') {
      const nft = checksum(a0);
      if (!agiMap.has(nft)) agiOrder.push(nft);
      agiMap.set(nft,{nftAddress:nft,payoutPercentage:'0',enabled:false,source:src});
    }
  }

  if (!baseIpfsUrl && source.ConstructorArguments) {
    const ctor = abi.find((x)=>x.type==='constructor');
    if (ctor) {
      const decoded = web3.eth.abi.decodeParameters(ctor.inputs, `0x${source.ConstructorArguments}`);
      const strIdx = ctor.inputs.findIndex((x)=>x.type==='string');
      if (strIdx >= 0) baseIpfsUrl = decoded[strIdx];
    }
  }

  const agiTypes = agiTypesOnchain;

  const snapshot = {
    schemaVersion:'1.0.0',generatedAt:new Date().toISOString(),legacyAddress:checksum(LEGACY_ADDRESS),chainId,
    blockNumber,blockTimestamp:str(Number(blockInfo.timestamp)),
    source:{etherscan:{contractName:source.ContractName,compilerVersion:source.CompilerVersion,optimizationUsed:source.OptimizationUsed,runs:source.Runs,proxy:source.Proxy,implementationFromMetadata:source.Implementation?checksum(source.Implementation):null},proxyDetection:{isProxy:source.Proxy==='1'||!/^0x0{40}$/i.test(implAddress),implementationFromEip1967Slot:implAddress}},
    addresses:{owner:checksum(calls.owner),agiToken:checksum(calls.agiToken),ensRegistry:checksum(calls.ens),nameWrapper:checksum(calls.nameWrapper),ensJobPages:checksum(calls.ensJobPages||'0x0000000000000000000000000000000000000000')},
    baseIpfsUrl,
    roots:{clubRootNode:calls.clubRootNode,agentRootNode:calls.agentRootNode,alphaClubRootNode:namehash('alpha.club.agi.eth'),alphaAgentRootNode:namehash('alpha.agent.agi.eth'),derived:[{name:'alpha.club.agi.eth',value:namehash('alpha.club.agi.eth'),derived:true},{name:'alpha.agent.agi.eth',value:namehash('alpha.agent.agi.eth'),derived:true}]},
    merkleRoots:{validatorMerkleRoot:calls.validatorMerkleRoot,agentMerkleRoot:calls.agentMerkleRoot},
    booleans:{paused:Boolean(calls.paused),settlementPaused:Boolean(calls.settlementPaused),lockIdentityConfig:Boolean(calls.lockIdentityConfig),useEnsJobTokenURI:Boolean(calls.useEnsJobTokenURI)},
    numericParams:Object.fromEntries(Object.entries(calls).filter(([k])=>!['owner','agiToken','ens','nameWrapper','clubRootNode','agentRootNode','validatorMerkleRoot','agentMerkleRoot','paused','settlementPaused','lockIdentityConfig','ensJobPages','useEnsJobTokenURI'].includes(k)).map(([k,v])=>[k,str(v)])),
    dynamicSets:{
      moderators:[...maps.moderators.entries()].filter(([,v])=>v.enabled).map(([address,v])=>({address,source:v.source})),
      additionalAgents:[...maps.additionalAgents.entries()].filter(([,v])=>v.enabled).map(([address,v])=>({address,source:v.source})),
      additionalValidators:[...maps.additionalValidators.entries()].filter(([,v])=>v.enabled).map(([address,v])=>({address,source:v.source})),
      blacklistedAgents:[...maps.blacklistedAgents.entries()].filter(([,v])=>v.enabled).map(([address,v])=>({address,source:v.source})),
      blacklistedValidators:[...maps.blacklistedValidators.entries()].filter(([,v])=>v.enabled).map(([address,v])=>({address,source:v.source}))
    },
    agiTypes,
    provenance:{derivedBy:'transaction input replay',txCountConsidered:txHashes.length,mutationCount:mutations.length,note:'Non-enumerable mappings reconstructed from ordered owner mutator calls.'}
  };

  fs.mkdirSync(path.dirname(SNAPSHOT_PATH),{recursive:true});
  fs.writeFileSync(SNAPSHOT_PATH,`${JSON.stringify(snapshot,null,2)}\n`);

  console.log('Legacy snapshot summary');
  console.log(`- chainId: ${chainId}`);
  console.log(`- blockNumber: ${blockNumber}`);
  console.log(`- owner: ${snapshot.addresses.owner}`);
  console.log(`- agiToken: ${snapshot.addresses.agiToken}`);
  console.log(`- counts: moderators=${snapshot.dynamicSets.moderators.length} additionalAgents=${snapshot.dynamicSets.additionalAgents.length} additionalValidators=${snapshot.dynamicSets.additionalValidators.length} blacklistedAgents=${snapshot.dynamicSets.blacklistedAgents.length} blacklistedValidators=${snapshot.dynamicSets.blacklistedValidators.length} agiTypes=${snapshot.agiTypes.length}`);
  console.log(`- wrote snapshot: ${SNAPSHOT_PATH}`);
}

main().catch((err)=>{ console.error(`Snapshot failed: ${err.message}`); process.exit(1); });
