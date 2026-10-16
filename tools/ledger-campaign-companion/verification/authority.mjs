import { createHash } from 'node:crypto';
import { getAddress, ZeroAddress } from 'ethers';
import { canonicalJson } from './explorer.mjs';

export const GOVERNOR = '0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99';
const pins = {
  manager: { repository: 'MontrealAI/AGIJobManager', commit: 'c2f72180d2f0d6ecd5b92d8e5197c5344be2c699', tree: '8b0d8816ce3cdaa1103d37eaa34f4d40bf72972f' },
  alpha: { repository: 'MontrealAI/AGI-Alpha-Agent-v0', commit: '38064bec3423218f87c6b81760ac6768b3e7d4e5', tree: '4fe59cb9b8c7e65ea087fd27b0e2abed6bf34c68' },
};
const managerLibraries = ['UriUtils', 'TransferUtils', 'BondMath', 'ReputationMath', 'ENSOwnership', 'NftEligibility', 'JobSettlement', 'JobValidation'];
const managerOwner = ['setSettlementWallets', 'lockIdentityConfiguration', 'pause', 'unpause', 'pauseIntake', 'unpauseIntake', 'pauseAll', 'unpauseAll', 'setSettlementPaused', 'resolveStaleDispute', 'blacklistAgent', 'blacklistValidator', 'delistJob', 'addModerator', 'removeModerator', 'updateEnsRegistry', 'updateNameWrapper', 'setEnsJobPages', 'setUseEnsJobTokenURI', 'updateRootNodes', 'updateMerkleRoots', 'setBaseIpfsUrl', 'setRequiredValidatorApprovals', 'setRequiredValidatorDisapprovals', 'setPremiumReputationThreshold', 'setVoteQuorum', 'setMaxJobPayout', 'setJobDurationLimit', 'setMaxActiveJobsPerAgent', 'setCompletionReviewPeriod', 'setDisputeReviewPeriod', 'setValidatorBondParams', 'setAgentBondParams', 'setAgentBond', 'setValidatorSlashBps', 'setChallengePeriodAfterApproval', 'setValidationRewardPercentage', 'addAdditionalValidator', 'removeAdditionalValidator', 'addAdditionalAgent', 'removeAdditionalAgent', 'withdrawUSDC', 'rescueETH', 'rescueERC20', 'rescueToken', 'setAgentNftRequired', 'addAGIType', 'disableAGIType'];
const stop = code => { throw Object.assign(new Error(code), { code }); };
const need = (condition, code = 'AUTHORITY_SCOPE_INVALID') => { if (!condition) stop(code); };
const copy = value => JSON.parse(canonicalJson(value));
const sha256 = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
const address = value => { try { const found = getAddress(value); need(found !== ZeroAddress); return found; } catch { stop('AUTHORITY_SCOPE_INVALID'); } };
const row = (component, authority, powers, limitations) => ({ component, authority, powers, limitations });

export function authorityScope(adapter, source) {
  need(pins[adapter] && canonicalJson(source) === canonicalJson(pins[adapter]), 'AUTHORITY_SOURCE_UNREVIEWED');
  const common = {
    schema: 'manual-ledger-authority-scope-v1', adapter, source: copy(source),
    newProxies: [], newImplementations: [], proxyScope: 'No proxy or upgrade entry point exists in the selected new direct-CREATE architecture; external dependencies require their own inventory.',
    mutationAuthorized: false, externalAudit: 'OWNER_ACCEPTED_OMISSION_NOT_PASSED', sepolia: 'OWNER_ACCEPTED_OMISSION_NOT_PASSED',
    requiredExternalEvidence: ['Exact token runtime, implementation/admin or absence proof, ownership/pending ownership, roles and configuration controllers', 'ENS registry and NameWrapper code plus selected root owner/controller, wrapped owner/fuses/expiry and operator permissions', 'Governor wallet custody, current code/delegation and relevant off-chain signer/session permissions', 'Deployer current code/delegation, nonce reconciliation and no unintended authority in the selected graph', 'Read-only complete commissioning interval: no unexpected authority, admission, approval, funding or activity changes'],
  };
  if (adapter === 'manager') return Object.freeze({ ...common, components: [...managerLibraries, 'AGIJobManager'], route: { symbol: 'USDC', decimals: 6, token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }, initialState: 'Intake paused; settlement not paused; new graph uncommissioned. No activation is authorized.', matrix: [
    ...managerLibraries.map(name => row(name, 'No ownable/role administrator in the reviewed library source', ['Fixed linked library code used by the new graph'], 'Exact deployed runtime and self-address guard must match; no proxy/upgrade or owner slot is inferred.')),
    row('AGIJobManager', 'Governor via constructor-set Ownable2Step storage', managerOwner, 'Ownership is transferable; pending owner must be zero. Renunciation always reverts. Configuration lock freezes identity dependencies/roots only.'),
    row('AGIJobManager', 'Governor and pending-owner acceptance', ['transferOwnership', 'acceptOwnership'], 'New owner must accept; existing owner retains authority until acceptance.'),
    row('AGIJobManager', 'Moderator mapping', ['resolveDisputeWithCode'], 'Selected moderator must be independent of the disputed job; settlement pause and lifecycle conditions apply. Creator must not be moderator.'),
    row('AGIJobManager', 'Governor conditional fuse authority', ['lockJobENS(jobId,true)'], 'Irreversible ENS fuses need an explicit later approval; no fuse action is included here.'),
    row('AGIJobManager', 'Participants / completion-NFT holder', ['Job, escrow, bond, review, claim and ERC721 approval/transfer operations under source checks'], 'Completion NFT custody/approvals confer NFT authority, not manager ownership. All fresh balances/claims/jobs remain zero.'),
    row('ENS and optional helpers', 'External ENS/root/controller/helper authorities', ['Eligibility, resolver, subname and optional hook control'], 'Core graph contains no ENSJobPages, AGIJobPages or AGIReviewEscrow. Optional deployment changes selected architecture and requires separate source/receipt/runtime/authority verification.'),
  ] });
  return Object.freeze({ ...common, components: ['AscensionAccess', 'NovaSeed', 'AscensionRiskOracle', 'AscensionJobMarket', 'AscensionMark'], route: { symbol: '$AGIALPHA', decimals: 18, token: '0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA' }, initialState: 'No global pause switch. Fresh deployment is uncommissioned: no admissions, registrations, seed NFTs, stake, jobs, campaigns or funding; exact one-time graph bindings are separate governor transactions.', matrix: [
    row('AscensionAccess', 'Governor via constructor-set Ownable2Step storage', ['setAdmission', 'transferOwnership', 'acceptOwnership', 'renounceOwnership'], 'Admission is attributable and expires; renunciation exists in inherited Ownable. ENS and wrapper dependencies are immutable; roots have no public setter.'),
    row('NovaSeed', 'No protocol owner; admitted live-ENS business and ERC721 holder/approved operator', ['seal', 'ERC721 transfer/approval operations'], 'Access dependency and per-seed plan commitments are immutable. No deployment creator administrator. NFT approval and transfer remain relevant participant permissions.'),
    row('AscensionRiskOracle', 'Governor via constructor-set Ownable2Step storage', ['bindMarketplace', 'transferOwnership', 'acceptOwnership', 'renounceOwnership'], 'Marketplace binding is one-time with graph checks; access/seed/token and risk/stake/quorum parameters are immutable/constant.'),
    row('AscensionRiskOracle', 'Bound marketplace; validators and seed owner', ['lockForJob', 'releaseFromJob', 'deposit', 'withdraw', 'setJobAvailability', 'openReview', 'attest'], 'Marketplace controls bounded validator locks. Live identity, stake, capacity and independent review checks apply; eligibility can change with ENS/admission/token dependencies.'),
    row('AscensionJobMarket', 'Governor via constructor-set Ownable2Step storage', ['bindMark', 'transferOwnership', 'acceptOwnership', 'renounceOwnership'], 'MARK binding is one-time with graph checks; access/oracle/token/minimum stake are immutable/constant. No governor withdrawal, generic execution or global pause in this source.'),
    row('AscensionJobMarket', 'Bound MARK; business, agent, committee and client permissions', ['postFromSeed', 'post', 'deposit', 'withdraw', 'bid', 'award', 'submit', 'validate', 'timeout', 'claimRefund'], 'Exact source lifecycle, capacity, committee independence, live eligibility and client refund checks apply.'),
    row('AscensionMark', 'No protocol owner; seed/campaign business and lot holders', ['open', 'buy', 'sell', 'transferLots', 'bloom', 'route', 'collect', 'close', 'reclaim'], 'Immutable graph; plan-restricted treasury. route gives an exact transient token allowance to the new marketplace, then resets it to zero. No deployment creator withdrawal or administrator.'),
    row('External token and ENS', 'Token controllers, ENS parents, wrapped owner and operators', ['Token supply/transfer/burn policy and live ENS eligibility'], 'Read-only dependency permissions must be inventoried. No modification of historical balances, approvals, delegates, fuses or ownership is authorized.'),
  ] });
}

function probes(scope, graph, creator, governor) {
  const result = [], add = (component, signature, args, expected, id = `${component}.${signature.split('(')[0]}`) => result.push({ id, component, target: graph[component], signature, args, expected });
  const owned = scope.adapter === 'manager' ? ['AGIJobManager'] : ['AscensionAccess', 'AscensionRiskOracle', 'AscensionJobMarket'];
  for (const component of owned) { add(component, 'owner() view returns(address)', [], governor); add(component, 'pendingOwner() view returns(address)', [], ZeroAddress); }
  if (scope.adapter === 'manager') {
    add('AGIJobManager', 'usdcToken() view returns(address)', [], scope.route.token); add('AGIJobManager', 'paused() view returns(bool)', [], true); add('AGIJobManager', 'settlementPaused() view returns(bool)', [], false);
    add('AGIJobManager', 'ensJobPages() view returns(address)', [], ZeroAddress); add('AGIJobManager', 'agentNftRequired() view returns(bool)', [], false); add('AGIJobManager', 'nextJobId() view returns(uint256)', [], '0');
    for (const method of ['moderators', 'additionalValidators', 'additionalAgents', 'blacklistedAgents', 'blacklistedValidators']) add('AGIJobManager', `${method}(address) view returns(bool)`, [creator], false, `AGIJobManager.${method}.creator`);
    for (const method of ['lockedEscrow', 'lockedAgentBonds', 'lockedValidatorBonds', 'lockedDisputeBonds', 'lockedClaims']) add('AGIJobManager', `${method}() view returns(uint256)`, [], '0');
  } else {
    for (const [component, getter, value] of [['NovaSeed', 'access', graph.AscensionAccess], ['AscensionRiskOracle', 'access', graph.AscensionAccess], ['AscensionRiskOracle', 'seed', graph.NovaSeed], ['AscensionRiskOracle', 'marketplace', graph.AscensionJobMarket], ['AscensionJobMarket', 'access', graph.AscensionAccess], ['AscensionJobMarket', 'oracle', graph.AscensionRiskOracle], ['AscensionJobMarket', 'mark', graph.AscensionMark], ['AscensionMark', 'seed', graph.NovaSeed], ['AscensionMark', 'access', graph.AscensionAccess], ['AscensionMark', 'oracle', graph.AscensionRiskOracle], ['AscensionMark', 'jobs', graph.AscensionJobMarket]]) add(component, `${getter}() view returns(address)`, [], value);
    for (const component of ['AscensionRiskOracle', 'AscensionJobMarket', 'AscensionMark']) add(component, 'token() view returns(address)', [], scope.route.token);
    for (const component of ['NovaSeed', 'AscensionJobMarket']) add(component, 'nextId() view returns(uint256)', [], '0');
    for (const actor of [creator, governor]) { add('AscensionAccess', 'admitted(address) view returns(bool)', [actor], false, `AscensionAccess.admitted.${actor}`); }
  }
  return result;
}

// The caller supplies the trusted Mac's source-bound, allowlisted read transport.
// A JSON observation imported from Ubuntu is not an implementation of this API.
export async function collectAuthorityReport({ adapter, source, graph, creator, governor, snapshot, read, checkCanonical } = {}) {
  const scope = authorityScope(adapter, source); creator = address(creator); governor = address(governor);
  need(governor === GOVERNOR && creator !== governor, 'AUTHORITY_ACTOR_POLICY_MISMATCH');
  need(graph && Object.keys(graph).length === scope.components.length && scope.components.every(name => graph[name]), 'AUTHORITY_ARCHITECTURE_MISMATCH');
  graph = Object.fromEntries(scope.components.map(name => [name, address(graph[name])])); need(new Set(Object.values(graph)).size === scope.components.length, 'AUTHORITY_ARCHITECTURE_MISMATCH');
  need(snapshot && Number.isSafeInteger(snapshot.number) && snapshot.number >= 0 && /^0x[0-9a-f]{64}$/i.test(snapshot.hash) && typeof read === 'function' && typeof checkCanonical === 'function', 'AUTHORITY_CANONICAL_READS_REQUIRED');
  need(await checkCanonical(copy(snapshot)) === true, 'AUTHORITY_CANONICAL_READS_REQUIRED');
  const rows = [];
  for (const probe of probes(scope, graph, creator, governor)) {
    try {
      const observed = await read(Object.freeze({ ...probe, block: copy(snapshot), chainId: 1 }));
      const normalize = value => typeof value === 'bigint' ? value.toString() : typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value) ? getAddress(value) : value;
      const value = normalize(observed), expected = normalize(probe.expected);
      rows.push({ ...probe, observed: value, state: canonicalJson(value) === canonicalJson(expected) ? 'match' : 'mismatch' });
    } catch { rows.push({ ...probe, state: 'missing', blocker: 'AUTHORITY_READ_UNAVAILABLE' }); }
  }
  need(await checkCanonical(copy(snapshot)) === true, 'AUTHORITY_CANONICAL_READS_REQUIRED');
  const report = { schema: 'manual-ledger-authority-report-v1', chainId: 1, source: copy(source), snapshot: copy(snapshot), creator, governor, graph, scope, observations: rows, boundedCoreStateMatches: rows.every(item => item.state === 'match'), comprehensiveAuthorityComplete: false, authorityComplete: false, activationReady: false, productionApproved: false,
    blockers: [...rows.filter(item => item.state !== 'match').map(item => `${item.state.toUpperCase()}:${item.id}`), ...scope.requiredExternalEvidence.map((description, i) => `EXTERNAL_EVIDENCE_${i + 1}:${description}`), 'Exact constructor/library/runtime proofs and complete native interval acceptance are separate required evidence', 'Physical Ledger, provider and commissioning acceptance remain separate gates'] };
  return Object.freeze({ ...report, reportSha256: sha256(report) });
}
