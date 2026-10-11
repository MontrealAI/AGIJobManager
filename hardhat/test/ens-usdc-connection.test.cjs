'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('../scripts/check-ens-usdc-connection.cjs');
const {P, ZERO, TX, CODE_HASHES, OLD_OPERATORS} = C;
const hex = n => '0x' + BigInt(n).toString(16);
const H = s => '0x' + crypto.createHash('sha256').update(String(s)).digest('hex');
const encode = v => '0x' + Buffer.from(JSON.stringify(v, (_, x) => typeof x === 'bigint' ? {__bigint: x.toString()} : x)).toString('hex');
const decode = s => JSON.parse(Buffer.from(s.slice(2), 'hex').toString(), (_, v) => v && v.__bigint !== undefined ? BigInt(v.__bigint) : v);
// Synthetic ABI and hash fixture, never shipped as a production dependency.
const E = {
  id: H,
  namehash: n => n === P.root ? P.rootNode : n === 'job-0.' + P.root ? P.firstNode : H(n),
  Interface: class { encodeFunctionData(fn, args) { return encode([fn, args]); } decodeFunctionResult(fn, raw) { return decode(raw); } },
};
function fixtures() {
  const snapshot = { number: hex(26164400), hash: H('snapshot'), timestamp: hex(1791664000) };
  const blocks = {[snapshot.number]: snapshot};
  const txs = {}, receipts = {};
  for (const spec of TX) {
    const tag = hex(spec.block), bh = H(tag);
    blocks[tag] = {number: tag, hash: bh, timestamp: hex(1791663000 + spec.block - TX[0].block)};
    txs[spec.hash] = {hash: spec.hash, from: spec.from, to: spec.to, chainId: '0x1', value: '0x0', nonce: hex(spec.nonce),
      input: spec.data, blockNumber: tag, blockHash: bh, transactionIndex: '0x1'};
    receipts[spec.hash] = {transactionHash: spec.hash, from: spec.from, to: spec.to, status: '0x1', contractAddress: null,
      blockNumber: tag, blockHash: bh, transactionIndex: '0x1', gasUsed: '0x100', effectiveGasPrice: '0x10',
      logs: [{address: spec.to, transactionHash: spec.hash, blockNumber: tag, blockHash: bh, transactionIndex: '0x1',
        topics: [E.id(spec.event), ...spec.eventAddresses.map(a => '0x' + a.slice(2).toLowerCase().padStart(64, '0'))], data: spec.eventData}]};
  }
  const code = {}, hashes = new Map();
  for (const [role, digest] of Object.entries(CODE_HASHES)) {
    const value = role === 'helper' ? '0x' + '11'.repeat(P.helperRuntimeBytes) : encode(['code', role]);
    code[P[role].toLowerCase()] = value; hashes.set(value, digest);
  }
  for (const [label, address, digest] of OLD_OPERATORS) { const value = encode(['old', label]); code[address.toLowerCase()] = value; hashes.set(value, digest); }
  const ethereum = {...E, keccak256: s => hashes.get(s) || H(s)};
  const values = new Map();
  const key = (address, fn, args=[]) => [address.toLowerCase(), fn, encode(args)].join(':');
  const set = (a, fn, value, args=[]) => values.set(key(a, fn, args), value);
  for (const [fn, v] of Object.entries({owner: P.administrator, pendingOwner: ZERO, paused: true, settlementPaused: false,
    lockIdentityConfig: false, ensJobPages: P.helper, nextJobId: 0n, usdcToken: P.usdc, ens: P.registry, nameWrapper: P.wrapper})) set(P.manager, fn, [v]);
  for (const [fn, v] of Object.entries({owner: P.administrator, ens: P.registry, nameWrapper: P.wrapper, publicResolver: P.resolver,
    jobsRootName: P.root, jobsRootNode: P.rootNode, jobManager: P.manager, jobLabelPrefix: 'job-', configLocked: false, useEnsJobTokenURI: false})) set(P.helper, fn, [v]);
  for (const name of [P.parent, P.root, P.legacyRoot]) {
    const node = ethereum.namehash(name);
    set(P.wrapper, 'getData', [name === P.parent ? P.parentOwner : P.rootOwner, 327681n, P.minimumExpiry], [BigInt(node)]);
    set(P.registry, 'owner', [P.wrapper], [node]); set(P.registry, 'resolver', [P.resolver], [node]); set(P.registry, 'ttl', [0n], [node]);
  }
  set(P.registrar, 'nameExpires', [1999955864n], [BigInt(ethereum.id('agi'))]);
  for (const address of [P.helper, ...OLD_OPERATORS.map(v => v[1])]) set(P.wrapper, 'isApprovedForAll', [true], [P.rootOwner, address]);
  set(P.helper, 'jobEnsName', ['job-0.' + P.root], [0n]); set(P.helper, 'jobEnsNode', [P.firstNode], [0n]);
  set(P.helper, 'jobLabelSnapshot', [false, ''], [0n]); set(P.registry, 'owner', [ZERO], [P.firstNode]); set(P.registry, 'resolver', [ZERO], [P.firstNode]);
  const calls = [];
  const rpc = async (method, args) => {
    calls.push([method, args]);
    if (method === 'eth_chainId') return '0x1';
    if (method === 'eth_getBlockByNumber') return args[0] === 'latest' ? snapshot : blocks[args[0]];
    if (method === 'eth_getTransactionByHash') return txs[args[0]];
    if (method === 'eth_getTransactionReceipt') return receipts[args[0]];
    if (method === 'eth_getCode') return code[args[0].toLowerCase()];
    if (method === 'eth_call') {
      const [fn, params] = decode(args[0].data), value = values.get(key(args[0].to, fn, params));
      if (value === undefined) throw new Error('Unknown synthetic call ' + fn);
      return encode(value);
    }
    throw new Error('Unexpected fixture RPC');
  };
  return {ethereum, snapshot, blocks, txs, receipts, code, values, set, calls, rpc};
}
test('complete synthetic receipt + readback run passes only the narrow connection gate', async () => {
  const f = fixtures(), r = await C.collect(f.ethereum, f.rpc);
  assert.equal(r.status, 'ENS_CONNECTION_CHECK_PASSED_INTAKE_PAUSED'); assert.equal(r.transactions.length, 2);
  assert.equal(r.publicTransactionsBroadcast, 0); assert.equal(r.productionReadinessCertified, false); assert.equal(r.intakeActivationAuthorized, false);
  assert.equal(r.observed.manager.paused, true); assert.equal(r.observed.newHelperOperatorApproval, true);
  assert(f.calls.every(([m]) => C.METHODS.has(m)));
  for (const [m, p] of f.calls) if (m === 'eth_call' || m === 'eth_getCode') assert.equal(p[1], f.snapshot.number);
});
for (const [label, change, error] of [
  ['wrong sender', f => f.txs[TX[0].hash].from = P.administrator, 'TRANSACTION_ROLE_MISMATCH'],
  ['wrong target', f => f.txs[TX[0].hash].to = P.helper, 'TRANSACTION_ROLE_MISMATCH'],
  ['wrong helper argument', f => f.txs[TX[1].hash].input = TX[0].data, 'TRANSACTION_CALLDATA_MISMATCH'],
  ['approval false', f => f.txs[TX[0].hash].input = TX[0].data.slice(0,-1)+'0', 'TRANSACTION_CALLDATA_MISMATCH'],
  ['nonzero ETH value', f => f.txs[TX[0].hash].value = '0x1', 'TRANSACTION_CHAIN_VALUE_OR_NONCE_MISMATCH'],
  ['wrong transaction chain', f => f.txs[TX[0].hash].chainId = '0xaa36a7', 'TRANSACTION_CHAIN_VALUE_OR_NONCE_MISMATCH'],
  ['mined revert', f => f.receipts[TX[0].hash].status = '0x0', 'TRANSACTION_REVERTED'],
  ['missing receipt', f => delete f.receipts[TX[0].hash], 'TRANSACTION_OR_RECEIPT_MISSING'],
  ['receipt hash substituted', f => f.receipts[TX[0].hash].transactionHash = TX[1].hash, 'RECEIPT_HASH_MISMATCH'],
  ['receipt block not canonical', f => f.receipts[TX[0].hash].blockHash = H('bad'), 'TRANSACTION_NOT_CANONICAL'],
  ['missing event', f => f.receipts[TX[0].hash].logs = [], 'EXPECTED_EVENT_MISSING_OR_DUPLICATED'],
  ['duplicate event', f => f.receipts[TX[0].hash].logs.push(f.receipts[TX[0].hash].logs[0]), 'EXPECTED_EVENT_MISSING_OR_DUPLICATED'],
  ['event wrong bool', f => f.receipts[TX[0].hash].logs[0].data = '0x'+'0'.repeat(64), 'EVENT_CONTENT_MISMATCH'],
  ['event removed', f => f.receipts[TX[0].hash].logs[0].removed = true, 'EVENT_CONTENT_MISMATCH'],
  ['event from another tx', f => f.receipts[TX[0].hash].logs[0].transactionHash = TX[1].hash, 'EVENT_IDENTITY_MISMATCH'],
  ['helper code absent', f => f.code[P.helper.toLowerCase()] = '0x', 'CODE_MISSING_helper'],
  ['helper code changed', f => f.code[P.helper.toLowerCase()] = '0x12', 'RUNTIME_HASH_MISMATCH_helper'],
  ['manager paused flag false', f => f.set(P.manager, 'paused', [false]), 'CONFIG_MISMATCH_manager_paused'],
  ['manager points elsewhere', f => f.set(P.manager, 'ensJobPages', [ZERO]), 'CONFIG_MISMATCH_manager_ensJobPages'],
  ['helper manager differs', f => f.set(P.helper, 'jobManager', [P.helper]), 'CONFIG_MISMATCH_helper_jobManager'],
  ['helper root changed', f => f.set(P.helper, 'jobsRootName', [P.legacyRoot]), 'CONFIG_MISMATCH_helper_jobsRootName'],
  ['helper prefix changed', f => f.set(P.helper, 'jobLabelPrefix', ['agijob']), 'CONFIG_MISMATCH_helper_jobLabelPrefix'],
  ['jobs already allocated', f => f.set(P.manager, 'nextJobId', [1n]), 'CONFIG_MISMATCH_manager_nextJobId'],
  ['approval now revoked', f => f.set(P.wrapper, 'isApprovedForAll', [false], [P.rootOwner,P.helper]), 'HELPER_OPERATOR_APPROVAL_NOT_ACTIVE'],
  ['root custody changed', f => f.set(P.wrapper, 'getData', [P.helper,327681n,P.minimumExpiry], [BigInt(P.rootNode)]), 'NAME_CUSTODY_MISMATCH'],
  ['root fuses changed', f => f.set(P.wrapper, 'getData', [P.rootOwner,327713n,P.minimumExpiry], [BigInt(P.rootNode)]), 'FUSES_CHANGED_REVIEW_REQUIRED'],
  ['root expiry shortened', f => f.set(P.wrapper, 'getData', [P.rootOwner,327681n,1791664001n], [BigInt(P.rootNode)]), 'EXPIRY_REQUIRES_REVIEW'],
  ['ENS registration expiry near', f => f.set(P.registrar, 'nameExpires', [1791664001n], [BigInt(f.ethereum.id('agi'))]), 'AGI_REGISTRATION_EXPIRY_REQUIRES_REVIEW'],
  ['old operator approval changed', f => f.set(P.wrapper, 'isApprovedForAll', [false], [P.rootOwner,OLD_OPERATORS[0][1]]), 'KNOWN_OPERATOR_CHANGED_REVIEW_REQUIRED'],
  ['job zero precreated', f => f.set(P.registry, 'owner', [P.helper], [P.firstNode]), 'JOB_ZERO_ALREADY_HAS_STATE_REVIEW_REQUIRED'],
  ['job zero snapshot precreated', f => f.set(P.helper, 'jobLabelSnapshot', [true,'job-0'], [0n]), 'JOB_ZERO_ALREADY_HAS_STATE_REVIEW_REQUIRED'],
]) test(label + ' cannot pass', async () => { const f=fixtures(); change(f); await assert.rejects(C.collect(f.ethereum,f.rpc), e => e.code===error); });
test('too few attachment confirmations stops before calling any getter', async () => {
  const f=fixtures(); f.snapshot.number=hex(TX[1].block+1);
  await assert.rejects(C.collect(f.ethereum,f.rpc), e=>e.code==='WAIT_FOR_ATTACHMENT_CONFIRMATIONS');
  assert.equal(f.calls.some(([m])=>m==='eth_call'),false);
});
test('wrong RPC chain stops immediately', async () => {
  const f=fixtures(); await assert.rejects(C.collect(f.ethereum, async()=> '0xaa36a7'), e=>e.code==='WRONG_CHAIN');
});
test('mid-run reorganization remains failure after valid receipts and getters', async () => {
  const f=fixtures(); let seen=0;
  await assert.rejects(C.collect(f.ethereum, async(m,p)=> {
    const v=await f.rpc(m,p); if(m==='eth_getBlockByNumber' && p[0]===hex(TX[0].block) && ++seen===2) return {...v,hash:H('reorg')}; return v;
  }),e=>e.code==='BLOCK_CHANGED_DURING_CHECK');
});
test('RPC has no wildcard sends and refuses them before fetch', async () => {
  const audit={requestsAttempted:0,methodsAttempted:{}}; let called=0;
  const rpc=C.makeRpc('https://example.invalid',async()=>{called++;},audit);
  for(const method of ['eth_sendTransaction','eth_sendRawTransaction','eth_sign','personal_sign','hardhat_impersonateAccount','eth_estimateGas','unknown'])
    await assert.rejects(rpc(method,[]),e=>e.code==='NON_READ_RPC_METHOD_REFUSED');
  assert.equal(called,0); assert.equal(audit.requestsAttempted,0);
});
test('transport uses an exact matching JSON-RPC id and refuses redirects',async()=>{
  const audit={requestsAttempted:0,methodsAttempted:{}};
  const rpc=C.makeRpc('https://example.invalid/key',async (url, options)=>{
    assert.equal(options.redirect,'error'); const b=JSON.parse(options.body);
    return {ok:true,json:async()=>({jsonrpc:'2.0',id:b.id,result:'0x1'})};
  },audit); assert.equal(await rpc('eth_chainId',[]),'0x1');
});
test('RPC errors do not leak server messages or credential-bearing endpoints',async()=>{
  for(const kind of ['throw','rpc','http','wrongid']) {
    const rpc=C.makeRpc('https://example.invalid/PRIVATE_SECRET',async()=>{
      if(kind==='throw') throw new Error('PRIVATE_SECRET');
      return {ok:kind!=='http',json:async()=>({jsonrpc:'2.0',id:kind==='wrongid'?55:1,...(kind==='rpc'?{error:{message:'PRIVATE_SECRET'}}:{result:'0x1'})})};
    },{requestsAttempted:0,methodsAttempted:{}});
    await assert.rejects(rpc('eth_chainId',[]),e=>e instanceof C.Stop && !e.message.includes('PRIVATE_SECRET'));
  }
});
test('non-HTTPS and invalid URLs stop before network access',()=>{
  for(const url of ['', 'bad', 'http://example.invalid', 'file:///tmp/a']) assert.throws(()=>C.makeRpc(url,()=>{},{}));
});
test('read budget cannot silently grow indefinitely', async()=>{
  const rpc=C.makeRpc('https://example.invalid',()=>{throw Error('must not run');},{requestsAttempted:250,methodsAttempted:{}});
  await assert.rejects(rpc('eth_chainId',[]),e=>e.code==='RPC_REQUEST_LIMIT_REACHED');
});
test('report writing is exclusive and mode 0600',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ens-read-test-'));
  try {const out=C.writeReport(dir,{test:1n}); assert.equal(fs.statSync(out).mode&0o777,0o600);
    assert.deepEqual(JSON.parse(fs.readFileSync(out)),{test:'1'}); assert.throws(()=>C.writeReport(dir,{}));}
  finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('manager private tokenURI flag is not queried; only helper public flag is queried',()=>{
  assert.equal(C.ABI.manager.some(x=>x.includes('useEnsJobTokenURI')),false);
  assert(C.ABI.helper.some(x=>x.includes('useEnsJobTokenURI')));
});
test('fixed transaction calldata exactly encodes screenshot arguments',()=>{
  assert.equal(TX[0].data.length,2+8+64+64); assert.equal(TX[1].data.length,2+8+64);
  assert.equal(TX[0].data.slice(10,74),'0'.repeat(24)+P.helper.slice(2).toLowerCase());
  assert.equal(TX[0].data.slice(-64),'1'.padStart(64,'0'));
});
test('actual CLI with missing dependencies writes a stopped private report and preserves the repository',()=>{
  const {spawnSync}=require('node:child_process');
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'ens-cli-home-'));
  try {
    const repo=path.join(home,'repository'); fs.mkdirSync(path.join(repo,'hardhat'),{recursive:true});
    const pkg=path.join(repo,'hardhat','package.json'); fs.writeFileSync(pkg,JSON.stringify({name:'missing-deps-fixture',private:true}));
    const before=fs.readFileSync(pkg);
    const child=spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/check-ens-usdc-connection.cjs'),'--repo',repo],
      {encoding:'utf8',env:{PATH:process.env.PATH,HOME:home,MAINNET_RPC_URL:'https://example.invalid/PRIVATE_SECRET'}});
    assert.equal(child.status,1); assert(!child.stdout.includes('PRIVATE_SECRET')); assert(!child.stderr.includes('PRIVATE_SECRET'));
    assert.deepEqual(fs.readFileSync(pkg),before); assert.deepEqual(fs.readdirSync(path.join(repo,'hardhat')),['package.json']);
    const dirs=fs.readdirSync(home).filter(n=>n.startsWith('ENSJobPages-USDC-Connection-')); assert.equal(dirs.length,1);
    const f=path.join(home,dirs[0],'CONNECTION_REVIEW.json'), text=fs.readFileSync(f,'utf8'), r=JSON.parse(text);
    assert.equal(r.status,'STOPPED_REVIEW_REQUIRED'); assert.equal(r.publicTransactionsBroadcast,0); assert(!text.includes('PRIVATE_SECRET'));
    assert.equal(fs.statSync(f).mode&0o777,0o600);
  } finally {fs.rmSync(home,{recursive:true,force:true});}
});
