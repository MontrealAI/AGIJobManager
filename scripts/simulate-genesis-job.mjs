// Rehearse the historical Genesis artwork job against current contracts locally.
// No keys, public RPC requests, fork, or public-network option are used here.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHardhatRuntimeEnvironment } from 'hardhat/hre';
import * as ethers from 'ethers';
import base from '../hardhat.config.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const EVIDENCE = path.join(ROOT, 'docs/examples/genesis/evidence');
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === '--output'),
  'Usage: npm run simulate:genesis -- [--output /path/to/report.json]');
const output = path.resolve(args[1] || path.join(ROOT, 'build/qualification/genesis-job.json'));
const read = name => JSON.parse(fs.readFileSync(path.join(EVIDENCE, name), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const clean = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v));

// Recheck archived bytes and ABI decodes before using any historical inputs.
const manifest = read('manifest.json');
for (const [name, digest] of Object.entries(manifest.sha256)) {
  assert.equal(sha256(fs.readFileSync(path.join(EVIDENCE, name))), digest, name);
}
const history = read('historical-transaction.json');
const state = read('historical-state-decoded.json');
const logs = read('decoded-receipt.json');
const legacy = new ethers.Interface(read('legacy-abi.json'));
const tokenABI = new ethers.Interface([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]);
for (const [key, response] of Object.entries(read('historical-state-raw.json'))) {
  assert(!response.error, `Historical RPC error: ${key}`);
  const name = (key.split(':')[1] || key).replace(/^balance$/, 'balanceOf');
  const iface = ['balanceOf', 'decimals', 'symbol'].includes(name) ? tokenABI : legacy;
  const fragment = iface.getFunction(name);
  const values = iface.decodeFunctionResult(fragment, response.result);
  const decoded = fragment.outputs.length === 1 ? clean(values[0])
    : Object.fromEntries(fragment.outputs.map((field, i) => [field.name || String(i), clean(values[i])]));
  assert.deepEqual(decoded, state[key], key);
}
assert.equal(history.transaction.hash, manifest.transaction);
assert.equal(history.receipt.transactionHash, manifest.transaction);
assert.equal(BigInt(history.receipt.status), 1n);
assert.equal(BigInt(history.receipt.blockNumber), 24609815n);
assert.equal(history.receipt.logs.length, 26);
const action = legacy.parseTransaction({ data: history.transaction.input });
assert.equal(action.name, 'finalizeJob');
assert.equal(action.args[0], 0n);
for (const log of logs) {
  assert.deepEqual(log.raw, history.receipt.logs.find(item => Number(item.logIndex) === log.index));
  if (log.address.toLowerCase() !== history.transaction.to.toLowerCase()) continue;
  const parsed = legacy.parseLog(log.raw);
  assert.equal(parsed.name, log.name);
  assert.deepEqual(Object.fromEntries(parsed.fragment.inputs.map((field, i) =>
    [field.name || String(i), clean(parsed.args[i])])), log.fields);
}
const beforeBlock = ethers.toQuantity(BigInt(history.receipt.blockNumber) - 1n);
const core = state[`${beforeBlock}:getJobCore`];
const validation = state[`${beforeBlock}:getJobValidation`];
const specURI = state[`${beforeBlock}:getJobSpecURI`];
const completionURI = state[`${beforeBlock}:getJobCompletionURI`];
const assigned = Number(core.assignedAt);
const submitted = Number(validation.completionRequestedAt);
const settled = Number(BigInt(history.block.timestamp));
const duration = Number(core.duration);

// These two metadata CIDs use raw sha2-256 blocks. This is not a DAG-PB image proof.
function verifyRawCID(uri, filename) {
  const cid = uri.replace(/^ipfs:\/\//, '');
  assert.match(cid, /^b[a-z2-7]+$/);
  let bits = '';
  for (const char of cid.slice(1)) bits += 'abcdefghijklmnopqrstuvwxyz234567'.indexOf(char).toString(2).padStart(5, '0');
  const decoded = Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
  assert.equal(decoded.subarray(0, 4).toString('hex'), '01551220');
  assert.equal(decoded.length, 36);
  assert.equal(decoded.subarray(4).toString('hex'), sha256(fs.readFileSync(path.join(EVIDENCE, filename))));
}
verifyRawCID(specURI, 'job-spec.json');
verifyRawCID(completionURI, 'job-completion.json');
assert.equal(read('job-completion.json').properties.jobSpecURI, specURI);

// Discard every HTTP network from the imported compiler configuration.
const config = {
  ...base,
  networks: { hardhat: { ...base.networks.hardhat, initialDate: new Date((assigned - 10000) * 1000) } },
};
assert.equal(config.networks.hardhat.type, 'edr-simulated');
assert.equal(config.networks.hardhat.chainId, 31337);
assert.equal(config.networks.hardhat.forking, undefined);
const hre = await createHardhatRuntimeEnvironment(config, { config: path.join(ROOT, 'hardhat.config.mjs') }, ROOT);
const chain = await hre.network.connect('hardhat');

try {
  const E = chain.ethers;
  const rpc = (method, params = []) => chain.provider.request({ method, params });
  const send = async transaction => (await transaction).wait();
  const raw = value => E.parseUnits(value, 6);
  const fmt = value => E.formatUnits(value, 6);
  const [, wallet30, wallet10, moderator, other] = await E.getSigners();
  async function signer(address) {
    await rpc('hardhat_impersonateAccount', [address]);
    await rpc('hardhat_setBalance', [address, E.toQuantity(E.parseEther('100'))]);
    return E.getSigner(address);
  }
  const reviewerAddresses = logs.filter(log => log.name === 'ReputationUpdated'
    && log.fields.user.toLowerCase() !== core.assignedAgent.toLowerCase()).map(log => log.fields.user);
  assert.equal(reviewerAddresses.length, 7);
  const buyer = await signer(core.employer);
  const agent = await signer(core.assignedAgent);
  const reviewers = await Promise.all(reviewerAddresses.map(signer));
  const libraries = {};
  async function deploy(name, constructorArgs = []) {
    const artifact = await hre.artifacts.readArtifact(name);
    const links = {};
    for (const [source, names] of Object.entries(artifact.linkReferences || {})) {
      for (const library of Object.keys(names)) links[`${source}:${library}`] = libraries[library];
    }
    const factory = await E.getContractFactory(name, { libraries: links });
    const contract = await factory.deploy(...constructorArgs);
    await contract.waitForDeployment();
    return contract;
  }
  for (const name of ['UriUtils', 'TransferUtils', 'BondMath', 'ReputationMath', 'ENSOwnership',
    'NftEligibility', 'JobSettlement', 'JobValidation']) libraries[name] = (await deploy(name)).target;
  const token = await deploy('MockUSDCControls');
  const ens = await deploy('MockENSRegistry');
  const wrapper = await deploy('MockNameWrapper');
  const nft = await deploy('MockERC721');
  const pages = await deploy('MockENSJobPages');
  const roots = ['club.agi.eth', 'agent.agi.eth', 'alpha.club.agi.eth', 'alpha.agent.agi.eth'].map(E.namehash);
  const manager = await deploy('AGIJobManager', [token.target, 'ipfs://', [ens.target, wrapper.target],
    roots, [E.ZeroHash, E.ZeroHash], [wallet30.address, wallet10.address]]);
  const runtimeBytes = (await E.provider.getCode(manager.target)).length / 2 - 1;
  assert(runtimeBytes <= 24576, 'EIP-170 deployment size');
  assert.equal(await token.decimals(), 6n);
  for (const [getter, expected] of Object.entries({ completionReviewPeriod: 604800n,
    challengePeriodAfterApproval: 86400n, disputeReviewPeriod: 1209600n,
    requiredValidatorApprovals: 3n, requiredValidatorDisapprovals: 3n, voteQuorum: 3n,
    validationRewardPercentage: 8n })) assert.equal(await manager[getter](), expected, getter);
  assert.equal(await manager.agentNftRequired(), false, 'Fresh deployments start with NFT admission disabled');
  await send(manager.addAGIType(nft.target, 1));
  await send(manager.setAgentNftRequired(true)); // This historical rehearsal explicitly opts into the NFT gate.
  await send(nft.mint(agent.address));
  const agentLabel = 'genesis00';
  const agentNode = E.namehash(`${agentLabel}.alpha.agent.agi.eth`);
  await send(wrapper.setOwner(BigInt(agentNode), agent.address));
  for (let i = 0; i < reviewers.length; i++) {
    await send(wrapper.setOwner(BigInt(E.namehash(`reviewer${i}.club.agi.eth`)), reviewers[i].address));
  }
  await send(manager.addModerator(moderator.address));
  await send(manager.setEnsJobPages(pages.target));
  await send(manager.transferOwnership(buyer.address));
  await send(manager.connect(buyer).acceptOwnership());
  await send(manager.connect(buyer).unpauseIntake());
  const accounts = [buyer, agent, ...reviewers, wallet30, wallet10];
  // Minting, impersonation and unlimited allowances are disposable fixture setup.
  // Live users instead fund their own wallets and approve the quoted exact amount.
  for (const account of accounts) {
    await send(token.mint(account.address, raw('1000000')));
    await send(token.connect(account).approve(manager.target, E.MaxUint256));
  }
  const reserves = ['lockedEscrow', 'lockedAgentBonds', 'lockedValidatorBonds', 'lockedDisputeBonds', 'lockedClaims'];
  const balances = async () => Object.fromEntries(await Promise.all(accounts.map(async account =>
    [account.address, await token.balanceOf(account.address)])));
  const baseline = await balances();
  let snapshot = await rpc('evm_snapshot');
  let checks = [];
  const at = timestamp => rpc('evm_setNextBlockTimestamp', [timestamp]);
  async function advance(timestamp) { await at(timestamp); await rpc('evm_mine'); }
  async function rejected(label, call) {
    await assert.rejects(call, /revert|CALL_EXCEPTION/);
    checks.push(label);
  }
  const sourceFiles = ['contracts/AGIJobManager.sol', 'contracts/utils/JobState.sol',
    ...Object.keys(libraries).map(name => `contracts/utils/${name}.sol`),
    ...['MockUSDCControls', 'MockENSRegistry', 'MockNameWrapper', 'MockERC721', 'MockENSJobPages']
      .map(name => `contracts/test/${name}.sol`),
    'hardhat/hardhat.config.js', 'package-lock.json', 'hardhat/package-lock.json',
    'scripts/simulate-genesis-job.mjs', 'docs/examples/genesis/evidence/manifest.json'];
  const report = {
    source: {
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
      workingTreeDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim()),
      sha256: Object.fromEntries(sourceFiles.map(name => [name, sha256(fs.readFileSync(path.join(ROOT, name)))])),
    },
    network: { type: 'edr-simulated', chainId: 31337, fork: false, publicTransactions: 0 },
    toolchain: { node: process.version, solc: base.solidity.profiles.default.version,
      settings: base.solidity.profiles.default.settings },
    historicalTransaction: manifest.transaction,
    assumptions: {
      budgetsUSDC: ['100', '88888'],
      price: 'Illustrations only; neither price converts AGIALPHA or values the historical art.',
      identities: 'Fresh NFT admission is disabled; the fixture explicitly enables it with a mock ERC-721 and wrapped names. No agent/validator allowlist bypass or live registrar expiry test.',
      participants: 'Historical public wallets impersonated locally. Wallet control and off-chain independence are not established.',
      recipients: 'Moderator and fee recipients are disposable test accounts, not nominated production wallets.',
      work: 'Historical metadata URIs used as references only. Quality, availability and arbitration judgments are scenario inputs.',
      time: 'Historical timestamps, current defaults, no pauses. Dates are not a forecast for a new job.',
      costs: 'USDC balance changes exclude ETH gas, labor, compute, hosting and capital costs. Bond returns are not earnings.',
    },
    addresses: { manager: manager.target, token: token.target, buyer: buyer.address, agent: agent.address,
      reviewers: reviewerAddresses, moderator: moderator.address, wallet30: wallet30.address, wallet10: wallet10.address, libraries },
    historical: { assignedAt: assigned, submittedAt: submitted, settledAt: settled, duration },
    runtimeBytes,
    scenarios: [],
  };
  async function start(price, { assign = true, submit = true, votes = 0 } = {}) {
    await send(manager.connect(buyer).createJob(specURI, raw(price), duration,
      'Local historical-art simulation; publish new metadata for a real USDC job'));
    assert.equal(await manager.jobAgentNftRequired(0), true);
    if (!assign) return;
    await send(nft.connect(agent).transferFrom(agent.address, other.address, 1));
    await rejected('Application without required NFT rejected', () => manager.connect(agent).applyForJob.staticCall(0, agentLabel, []));
    await send(nft.connect(other).transferFrom(other.address, agent.address, 1));
    await at(assigned);
    await send(manager.connect(agent).applyForJob(0, agentLabel, []));
    if (submit) {
      await at(submitted);
      await send(manager.connect(agent).requestJobCompletion(0, completionURI));
    }
    for (let i = 0; i < votes; i++) await send(manager.connect(reviewers[i]).validateJob(0, `reviewer${i}`, []));
  }
  function events(receipt) {
    return receipt.logs.filter(log => log.address.toLowerCase() === manager.target.toLowerCase()).map(log => {
      const parsed = manager.interface.parseLog(log);
      return parsed ? { name: parsed.name, args: clean(parsed.args) } : null;
    }).filter(Boolean);
  }
  async function finish(price, name, receipt, expected, extra = {}) {
    const after = await balances();
    const delta = account => after[account.address] - baseline[account.address];
    assert.equal(delta(agent), raw(expected.agent), 'Agent USDC balance change');
    assert.equal(delta(buyer), raw(expected.buyer), 'Buyer USDC balance change');
    assert.equal(delta(wallet30), expected.success ? raw(price) * 30n / 100n : 0n, '30% share');
    assert.equal(delta(wallet10), expected.success ? raw(price) * 10n / 100n : 0n, '10% share');
    assert.deepEqual(reviewers.map(delta), expected.reviewers.map(raw), 'Reviewer rewards exclude returned bonds');
    assert.equal(await manager.nextTokenId(), expected.success ? 1n : 0n, 'Only success mints NFT');
    if (expected.success) assert.equal(await manager.ownerOf(0), buyer.address, 'Buyer owns completion NFT');
    for (const getter of reserves) assert.equal(await manager[getter](), 0n, `${getter} cleared`);
    assert.equal(await token.balanceOf(manager.target), 0n, 'Manager balance cleared');
    assert.equal(Object.values(after).reduce((a, b) => a + b, 0n),
      Object.values(baseline).reduce((a, b) => a + b, 0n), 'USDC conservation');
    report.scenarios.push({ priceUSDC: price, name, passed: true,
      checks: [...checks, 'Exact participant balance changes', 'Success-only NFT', 'All five reserves cleared', 'USDC conservation'],
      agentDeltaUSDC: fmt(delta(agent)), buyerDeltaUSDC: fmt(delta(buyer)),
      reviewerDeltasUSDC: reviewers.map(account => fmt(delta(account))),
      wallet30DeltaUSDC: fmt(delta(wallet30)), wallet10DeltaUSDC: fmt(delta(wallet10)),
      completionNFTs: expected.success ? 1 : 0,
      localSettlementGasUsed: receipt.gasUsed.toString(), events: events(receipt), ...extra });
    console.log(`PASS ${price} USDC: ${name}`);
  }
  // Fixed expected economic outcomes from the documented examples, in six-decimal USDC.
  const expected = {
    '100': { bond: '5.129600', reviewed7: '52.000001', each7: '1.142857',
      reviewed3: '52.000002', each3: '2.666666', accepted: '60',
      rejectedReward: '1.709866', disputeBond: '1' },
    '88888': { bond: '4559.598848', reviewed7: '46221.760001', each7: '1015.862857',
      reviewed3: '46221.760002', each3: '2370.346666', accepted: '53332.8',
      rejectedReward: '1519.866282', disputeBond: '200' },
  };
  for (const price of report.assumptions.budgetsUSDC) {
    const values = expected[price];
    const zeros = Array(7).fill('0');
    const success = (agentPayment, reviewerRewards = zeros) =>
      ({ success: true, agent: agentPayment, buyer: `-${price}`, reviewers: reviewerRewards });
    const failure = (agentDelta, buyerDelta, reviewerRewards = zeros) =>
      ({ success: false, agent: agentDelta, buyer: buyerDelta, reviewers: reviewerRewards });
    async function reviewed(votes) {
      await start(price, { votes });
      assert.equal((await manager.getJobBonds(0)).agentAmount, raw(values.bond));
      const deadline = await manager.getJobDeadlines(0);
      await advance(settled);
      await rejected('Historical settlement time too early', () => manager.finalizeJob.staticCall(0));
      await advance(Number(deadline.settlementAfter));
      await rejected('Exact review boundary too early', () => manager.finalizeJob.staticCall(0));
      await at(Number(deadline.settlementAfter) + 1);
      const receipt = await send(manager.finalizeJob(0));
      const rewards = Array.from({ length: 7 }, (_, i) => i < votes ? values[`each${votes}`] : '0');
      await finish(price, `${votes} approvals after full review`, receipt, success(values[`reviewed${votes}`], rewards), {
        agentBondUSDC: values.bond,
        earliestFinalizationUTC: new Date((Number(deadline.settlementAfter) + 1) * 1000).toISOString(),
      });
    }
    const scenarios = [
      () => reviewed(7),
      () => reviewed(3),
      async () => {
        await start(price);
        await finish(price, 'Buyer accepts before votes', await send(manager.connect(buyer).acceptJob(0)), success(values.accepted));
      },
      async () => {
        await start(price, { submit: false });
        const deadline = await manager.getJobDeadlines(0);
        await at(Number(deadline.assignmentDeadline) + 1);
        await finish(price, 'Agent never submits; buyer expires job', await send(manager.expireJob(0)),
          failure(`-${values.bond}`, values.bond));
      },
      async () => {
        await start(price);
        for (let i = 0; i < 3; i++) await send(manager.connect(reviewers[i]).disapproveJob(0, `reviewer${i}`, []));
        assert.equal((await manager.getJobCore(0)).disputed, true);
        await rejected('Fourth vote after automatic dispute rejected', () => manager.connect(reviewers[3]).disapproveJob.staticCall(0, 'reviewer3', []));
        const receipt = await send(manager.connect(moderator).resolveDisputeWithCode(0, 2, 'Scenario: documented work defects upheld'));
        await finish(price, 'Three disapprovals; moderator upholds buyer', receipt,
          failure(`-${values.bond}`, '0.000002', [values.rejectedReward, values.rejectedReward, values.rejectedReward, '0', '0', '0', '0']));
      },
      async () => {
        await start(price);
        await send(manager.connect(buyer).disputeJob(0));
        assert.equal((await manager.getJobBonds(0)).disputeAmount, raw(values.disputeBond));
        await rejected('Buyer cannot accept active dispute', () => manager.connect(buyer).acceptJob.staticCall(0));
        const receipt = await send(manager.connect(moderator).resolveDisputeWithCode(0, 2, 'Scenario: buyer evidence upheld'));
        await finish(price, 'Buyer disputes before votes and wins', receipt, failure(`-${values.bond}`, values.bond),
          { disputeBondUSDC: values.disputeBond });
      },
      async () => {
        await start(price);
        await send(manager.connect(buyer).disputeJob(0));
        const receipt = await send(manager.connect(moderator).resolveDisputeWithCode(0, 1, 'Scenario: work satisfies brief; buyer complaint rejected'));
        await finish(price, 'Buyer disputes good work; moderator upholds agent', receipt,
          { ...success(fmt(raw(values.accepted) + raw(values.disputeBond))), buyer: fmt(-raw(price) - raw(values.disputeBond)) },
          { disputeBondAwardUSDC: values.disputeBond });
      },
      async () => {
        await start(price);
        let deadline = await manager.getJobDeadlines(0);
        await at(Number(deadline.settlementAfter) + 1);
        await send(manager.finalizeJob(0));
        assert.equal((await manager.getJobCore(0)).disputed, true);
        assert.equal(await manager.lockedEscrow(), raw(price));
        checks.push('No votes opens dispute without paying agent');
        deadline = await manager.getJobDeadlines(0);
        await advance(Number(deadline.ownerResolutionAfter) + 1);
        await rejected('Buyer-owner cannot decide own dispute', () => manager.connect(buyer).resolveStaleDispute.staticCall(0, true));
        await rejected('Early neutral refund rejected', () => manager.refundUnresolvedDispute.staticCall(0));
        await at(Number(deadline.neutralRefundAfter) + 1);
        await finish(price, 'No votes or arbitration; neutral refund', await send(manager.refundUnresolvedDispute(0)), failure('0', '0'),
          { neutralRefundUTC: new Date((Number(deadline.neutralRefundAfter) + 1) * 1000).toISOString() });
      },
      async () => {
        await start(price, { votes: 7 });
        await send(token.setBlocked(agent.address, true));
        const deadline = await manager.getJobDeadlines(0);
        await at(Number(deadline.settlementAfter) + 1);
        const receipt = await send(manager.finalizeJob(0));
        const pending = await manager.pendingUSDC(agent.address);
        assert.equal(pending, raw(values.reviewed7) + raw(values.bond));
        assert.equal(await manager.lockedClaims(), pending);
        assert.equal(await token.balanceOf(wallet30.address) - baseline[wallet30.address], raw(price) * 30n / 100n);
        await rejected('Blocked claim retry rejected', () => manager.claimUSDC.staticCall(agent.address));
        await send(token.setBlocked(agent.address, false));
        await send(manager.claimUSDC(agent.address));
        await finish(price, 'Agent USDC blocked; same beneficiary later claims', receipt,
          success(values.reviewed7, Array(7).fill(values.each7)), { pendingBeforeRetryUSDC: fmt(pending) });
      },
      async () => {
        await start(price, { votes: 7 });
        await send(pages.setRevertHook(4, true));
        const deadline = await manager.getJobDeadlines(0);
        await at(Number(deadline.settlementAfter) + 1);
        const receipt = await send(manager.finalizeJob(0));
        assert(events(receipt).some(event => event.name === 'EnsHookAttempted' && event.args[3] === false));
        await finish(price, 'Optional ENS hook fails; payout and NFT succeed', receipt, success(values.reviewed7, Array(7).fill(values.each7)));
      },
      async () => {
        await start(price, { submit: false });
        await send(nft.connect(agent).transferFrom(agent.address, other.address, 1));
        await send(wrapper.setOwner(BigInt(agentNode), E.ZeroAddress));
        await at(submitted);
        await send(manager.connect(agent).requestJobCompletion(0, completionURI));
        await finish(price, 'Mock credentials lost after assignment; earned payment survives',
          await send(manager.connect(buyer).acceptJob(0)), success(values.accepted));
      },
      async () => {
        await start(price, { assign: false });
        await finish(price, 'Buyer cancels before assignment', await send(manager.connect(buyer).cancelJob(0)), failure('0', '0'));
      },
    ];
    for (const scenario of scenarios) {
      assert.equal(await rpc('evm_revert', [snapshot]), true);
      snapshot = await rpc('evm_snapshot');
      checks = [];
      await scenario();
    }
  }
  report.executedScenarios = report.scenarios.length;
  assert.equal(report.executedScenarios, 24);
  report.passed = true;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`ALL_SCENARIOS_PASSED=${report.executedScenarios}; local chain only; report: ${output}`);
} finally {
  await chain.close();
}
