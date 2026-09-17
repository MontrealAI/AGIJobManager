const ethers = require('ethers');

const LEGACY_ABI = [
  'function owner() view returns(address)', 'function agiToken() view returns(address)',
  'function ensJobPages() view returns(address)', 'function nextJobId() view returns(uint256)',
  'function nextTokenId() view returns(uint256)', 'function paused() view returns(bool)',
  'function settlementPaused() view returns(bool)',
  ...['lockedEscrow', 'lockedAgentBonds', 'lockedValidatorBonds', 'lockedDisputeBonds'].map(name => `function ${name}() view returns(uint256)`),
  'function getJobCore(uint256) view returns(address employer,address assignedAgent,uint256 payout,uint256 duration,uint256 assignedAt,bool completed,bool disputed,bool expired,uint8 agentPayoutPct)',
  'function getJobSpecURI(uint256) view returns(string)', 'function getJobCompletionURI(uint256) view returns(string)',
  'function ownerOf(uint256) view returns(address)', 'function tokenURI(uint256) view returns(string)',
  'function expireJob(uint256)',
];
const PAGES_ABI = [
  ...['owner', 'jobManager', 'publicResolver', 'nameWrapper', 'ens'].map(name => `function ${name}() view returns(address)`),
  'function jobsRootName() view returns(string)', 'function jobsRootNode() view returns(bytes32)',
  'function jobLabelPrefix() view returns(string)', 'function configLocked() view returns(bool)',
  'function jobEnsNode(uint256) view returns(bytes32)', 'function jobEnsName(uint256) view returns(string)',
];
const TOKEN_ABI = ['function decimals() view returns(uint8)', 'function balanceOf(address) view returns(uint256)',
  'function allowance(address,address) view returns(uint256)'];
const WRAPPER_ABI = ['function getData(uint256) view returns(address,uint32,uint64)',
  'function isApprovedForAll(address,address) view returns(bool)',
  'function setSubnodeOwner(bytes32,string,address,uint32,uint64) returns(bytes32)'];
const REGISTRY_ABI = ['function owner(bytes32) view returns(address)', 'function resolver(bytes32) view returns(address)'];
const RESOLVER_ABI = ['function text(bytes32,string) view returns(string)',
  'function setText(bytes32,string,string)',
  'function isApprovedFor(address,bytes32,address) view returns(bool)',
  'function isAuthorised(bytes32,address) view returns(bool)'];
const json = value => JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item));

async function snapshotLegacy(provider, address, blockTag = 'latest') {
  const at = { blockTag }, manager = new ethers.Contract(address, LEGACY_ABI, provider);
  const snapshot = { address, runtimeCodeHash: ethers.keccak256(await provider.getCode(address, blockTag)) };
  const fields = ['owner', 'agiToken', 'ensJobPages', 'nextJobId', 'nextTokenId', 'paused', 'settlementPaused',
    'lockedEscrow', 'lockedAgentBonds', 'lockedValidatorBonds', 'lockedDisputeBonds'];
  for (const field of fields) snapshot[field] = await manager[field](at);
  if (snapshot.nextJobId > 1000n) throw new Error('Legacy inventory exceeds the reviewed 1000-job bound; expand the inventory deliberately.');
  const pages = new ethers.Contract(snapshot.ensJobPages, PAGES_ABI, provider);
  snapshot.pages = { address: snapshot.ensJobPages, runtimeCodeHash: ethers.keccak256(await provider.getCode(snapshot.ensJobPages, blockTag)) };
  for (const field of ['owner', 'jobManager', 'jobsRootName', 'jobsRootNode', 'jobLabelPrefix', 'publicResolver', 'nameWrapper', 'ens', 'configLocked']) {
    snapshot.pages[field] = await pages[field](at);
  }
  const wrapper = new ethers.Contract(snapshot.pages.nameWrapper, WRAPPER_ABI, provider);
  const registry = new ethers.Contract(snapshot.pages.ens, REGISTRY_ABI, provider);
  const resolver = new ethers.Contract(snapshot.pages.publicResolver, RESOLVER_ABI, provider);
  snapshot.rootData = Array.from(await wrapper.getData(BigInt(snapshot.pages.jobsRootNode), at));
  snapshot.legacyWrapperApproval = await wrapper.isApprovedForAll(snapshot.rootData[0], snapshot.ensJobPages, at);
  const token = new ethers.Contract(snapshot.agiToken, TOKEN_ABI, provider);
  snapshot.tokenDecimals = await token.decimals(at);
  const participants = new Set([address, snapshot.owner]);
  snapshot.jobs = [];
  for (let id = 0; id < Number(snapshot.nextJobId); id += 1) {
    let core;
    try { core = await manager.getJobCore(id, at); }
    catch (error) {
      if (!/revert/i.test(error.message)) throw error;
      snapshot.jobs.push({ id, absent: true });
      continue;
    }
    const job = { id, core: Array.from(core), spec: await manager.getJobSpecURI(id, at), completion: await manager.getJobCompletionURI(id, at) };
    for (const participant of [core.employer, core.assignedAgent]) if (participant !== ethers.ZeroAddress) participants.add(participant);
    job.ensName = await pages.jobEnsName(id, at);
    job.ensNode = await pages.jobEnsNode(id, at);
    job.ensOwner = await registry.owner(job.ensNode, at);
    job.resolver = await registry.resolver(job.ensNode, at);
    job.wrappedData = Array.from(await wrapper.getData(BigInt(job.ensNode), at));
    job.records = {};
    for (const key of ['schema', 'agijobs.spec.public', 'agijobs.completion.public']) job.records[key] = await resolver.text(job.ensNode, key, at);
    snapshot.jobs.push(job);
  }
  snapshot.tokenAccounts = {};
  for (const participant of [...participants].sort()) {
    snapshot.tokenAccounts[participant] = { balance: await token.balanceOf(participant, at), allowance: await token.allowance(participant, address, at) };
  }
  if (snapshot.nextTokenId > 1000n) throw new Error('Legacy completion-NFT inventory exceeds the reviewed 1000-token bound.');
  snapshot.completionNFTs = [];
  for (let id = 0; id < Number(snapshot.nextTokenId); id += 1) {
    snapshot.completionNFTs.push({ id, owner: await manager.ownerOf(id, at), uri: await manager.tokenURI(id, at) });
  }
  return json(snapshot);
}

module.exports = { LEGACY_ABI, PAGES_ABI, TOKEN_ABI, WRAPPER_ABI, REGISTRY_ABI, RESOLVER_ABI, snapshotLegacy, json };
