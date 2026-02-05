# AGIJobManager – Mainnet Deployment & Security Overview

## 1) Executive summary
AGIJobManager is an **owner‑operated** on‑chain escrow + settlement engine for employer/agent jobs, with validator approvals/disapprovals, moderator dispute resolution, reputation tracking, and ERC‑721 job NFT issuance. It is a **business‑operated** system with strong escrow invariants; it is **not** a DAO, not trustless arbitration, and not an upgradeable proxy.

**What it is**
- Job escrow and settlement for employer‑funded tasks.
- Validator‑gated completion with dispute resolution by moderators.
- ERC‑721 receipts for completed jobs.

**What it is not**
- Not a DAO, not permissionless arbitration, and not an upgradeable proxy.
- Not a generalized NFT marketplace or on‑chain ERC‑8004 registry.

## 2) Trust model & roles
AGIJobManager is centralized by design. Users must trust the owner and moderators to operate the system honestly, while the contract enforces escrow accounting and settlement invariants.

**Owner (operational authority)**
- Pause/unpause operations.
- Withdraw treasury funds **only while paused** (never escrow).
- Manage allowlists/blacklists and additional agents/validators.
- Update economic parameters (validator thresholds, reward percentages, payout caps, duration limits, review periods).
- Manage moderators and AGI payout tiers (AGI types).
- Configure identity wiring before lock (token/ENS/NameWrapper/root nodes).
- Delist unassigned jobs via `delistJob` (owner‑only).

**Transparency note**: all privileged actions emit events and are on‑chain auditable.
**Operational best practice**: use a multisig owner with strict key management and on‑chain change logging.

**Moderator (dispute authority)**
- Resolve disputes via `resolveDisputeWithCode` (typed outcomes) or legacy `resolveDispute` (string‑based, deprecated). Outcomes are binary: **agent win** or **employer win**. `NO_ACTION` is allowed and leaves the dispute active.

**User roles**
- **Employer**: creates jobs, funds escrow, cancels unassigned jobs, disputes, receives NFTs.
- **Agent**: applies for jobs, requests completion, earns payouts + reputation.
- **Validator**: approves/disapproves completion, earns payouts + reputation on approvals.

## 3) Job lifecycle / state machine
The job struct encodes the state machine via fields like `assignedAgent`, `completionRequested`, `disputed`, `expired`, `completed`, timestamps, and the `agentPayoutPct` snapshot.

**Happy path (example)**
1. `createJob` escrows `payout` (increasing `lockedEscrow`).
2. `applyForJob` assigns an agent and snapshots `agentPayoutPct`.
3. `requestJobCompletion` stores completion metadata.
4. Validators call `validateJob` until `requiredValidatorApprovals` is reached (bonded voting).
5. After the challenge window, `finalizeJob` releases escrow, pays the agent, settles validators by outcome, and mints the completion NFT.

**Dispute path (example)**
1. After completion request, validators disapprove or employer/agent calls `disputeJob`.
2. Dispute becomes active (`disputed = true`, `disputedAt` set).
3. Moderator resolves via `resolveDisputeWithCode` (agent win or employer win) or leaves it active with `NO_ACTION`.
4. If the dispute times out and the contract is paused, the owner may use `resolveStaleDispute`.

**Timeouts & liveness**
- **Expiration**: `expireJob` refunds the employer when the job duration elapses and completion was never requested.
- **Finalize after review window**: `finalizeJob` settles after `completionReviewPeriod` if validators are silent or split.
- **Stale dispute recovery**: `resolveStaleDispute` is owner‑only and **paused‑only**, after `disputeReviewPeriod`.

## 4) Treasury vs escrow separation (hard invariant)
**Escrow** is tracked by `lockedEscrow` (sum of unsettled job payouts). **Treasury** is the AGI balance minus escrow.

**Why this matters**: it defines the hard boundary auditors and users rely on to ensure escrowed job funds cannot be withdrawn by the operator.

- `withdrawableAGI()` = `agiToken.balanceOf(this) - lockedEscrow` and **reverts** if `balance < lockedEscrow`.
- `withdrawAGI()` is **owner‑only** and **paused‑only**, and cannot exceed `withdrawableAGI()`.

**What becomes treasury**
- Payout remainder when `agentPayoutPct + validatorRewardPercentage < 100`.
- Rounding dust from integer division.
- Direct contributions via `contributeToRewardPool` (no segregation).

**Simple example**
- Contract balance = 10,000 AGI
- `lockedEscrow` = 9,000 AGI
- `withdrawableAGI()` = 1,000 AGI (and `withdrawAGI` cannot exceed this)

Escrowed funds can only be released through settlement paths (completion, refund, cancel, expire). The owner cannot sweep escrowed funds.

## 5) Identity wiring lock (`lockIdentityConfig`)
The identity lock is a one‑way switch intended to freeze identity wiring after initial setup.

> Naming note: earlier docs called this `configLocked`; the current boolean is `lockIdentityConfig` and the one‑time action is `lockIdentityConfiguration()`.

**Why this matters**: it freezes the core ENS/token wiring to prevent identity spoofing while still allowing day‑to‑day operational controls.

**Locked after `lockIdentityConfiguration()`**
- `updateAGITokenAddress`
- `updateEnsRegistry`
- `updateNameWrapper`
- `updateRootNodes`

**Not locked**
- `updateMerkleRoots` (allowlist roots remain adjustable).
- Operational controls (pause/unpause, allowlists/blacklists, parameter tuning).
- Treasury withdrawals (still paused‑only).

**Pre‑lock constraints**
Even before locking, identity wiring updates require `nextJobId == 0` and `lockedEscrow == 0`.

**Recommended procedure**
1. Deploy.
2. Configure token/ENS/NameWrapper/root nodes.
3. Validate wiring and allowlists on a testnet.
4. Call `lockIdentityConfiguration()`.

## 6) Pause semantics (must match code)
Pause is an incident‑response control to halt new activity while preserving exits.

**Why this matters**: pausing must stop new obligations without trapping in‑flight jobs or blocking refunds/settlement paths.

**Pause policy table (code‑accurate)**
| Function group | Who can call | Paused? | Notes |
| --- | --- | --- | --- |
| Job creation & onboarding (`createJob`, `applyForJob`) | Employers / eligible agents | **Blocked** | Prevents new escrow obligations during incident response. |
| Validation & dispute entry (`validateJob`, `disapproveJob`, `disputeJob`) | Validators / employer / agent | **Blocked** | Freezes new approvals/disputes while paused. |
| Reward pool funding (`contributeToRewardPool`) | Any user | **Blocked** | Additional treasury inflow paused. |
| Completion request (`requestJobCompletion`) | Assigned agent | **Allowed** | Prevents trapping agents mid‑job during a pause. |
| Settlement & exits (`cancelJob`, `expireJob`, `finalizeJob`, `resolveDispute`, `resolveDisputeWithCode`) | Employer / anyone / moderator | **Allowed** | Exit paths remain available for liveness. |
| Owner recovery (`resolveStaleDispute`) | Owner | **Allowed (paused‑only)** | Requires pause and dispute timeout. |
| Owner delist (`delistJob`) | Owner | **Allowed** | Unassigned only; refunds employer. |
| Treasury withdrawal (`withdrawAGI`) | Owner | **Allowed (paused‑only)** | Withdraws only non‑escrow funds. |

## 7) Security posture (operational highlights)
- **ReentrancyGuard** protects external state‑changing entrypoints that cross ERC‑20 boundaries (e.g., `createJob`, `withdrawAGI`, dispute resolution, settlement).
- **Exact ERC‑20 transfer checks** are used where escrow integrity matters (`createJob`, `contributeToRewardPool`), preventing fee‑on‑transfer / rebasing tokens from under‑funding escrow.
- **Bounded loops**: validator lists are capped at `MAX_VALIDATORS_PER_JOB` (50).
- **ENS/NameWrapper lookups** use `try/catch` and are view‑only; failures just return false.
- **Dispute outcomes are binary** (agent win vs employer win); `NO_ACTION` logs without settlement.
- **Known limitations**: centralized operator risk; parameter changes can affect in‑flight jobs; no slashing; reward pool is not segregated from treasury.

### Reputation system (as implemented)
- Agent reputation uses `reputationPoints = log2(1 + payoutPoints * 1e6) + completionTime / 10000`, with `payoutPoints = (scaledPayout^3) / 1e5`.
- Reputation is then **diminished** by `1 + (newReputation^2 / 88888^2)` and capped at **88888**.
- Validator payouts/reputation are outcome‑aligned: correct‑side voters earn rewards, incorrect‑side voters are slashed.
- `premiumReputationThreshold` gates `canAccessPremiumFeature(address)` (pure threshold check; no time decay).

## 8) EIP‑170 bytecode size & build reproducibility
- **EIP‑170 limit**: 24,576 bytes of runtime bytecode.
- **Repo guard**: `test/bytecodeSize.test.js` enforces **≤ 24,575 bytes** for `AGIJobManager`.

**Compiler settings (Truffle)**
- **solc**: `0.8.23`
- **optimizer**: enabled, `runs = 50`
- **viaIR**: `false`
- **metadata.bytecodeHash**: `none`
- **debug.revertStrings**: `strip`
- **evmVersion**: `london` (default unless overridden)

**How to measure size locally**
```bash
node -e "const a=require('./build/contracts/AGIJobManager.json'); const b=(a.deployedBytecode||'').replace(/^0x/,''); console.log('AGIJobManager deployedBytecode bytes:', b.length/2)"
```

## 9) Verification & deployment guide (Truffle‑first)
**Build & test**
```bash
npm ci
npx truffle compile
npx truffle test --network test
```

**Deployment entrypoint**
- `migrations/2_deploy_contracts.js` (reads values from `migrations/deploy-config.js` + env vars).

**Mainnet checklist**
1. Confirm compiler/settings match `truffle-config.js`.
2. Run compile + tests.
3. Record constructor args (token, baseIpfs, ENS, NameWrapper, root nodes, Merkle roots).
4. Deploy from a multisig if possible.
5. Verify with `truffle-plugin-verify` using the exact compiler settings + constructor args.

**Verification (Etherscan)**
```bash
npx truffle run verify AGIJobManager --network mainnet
```

## 10) Monitoring / alerting checklist
Index and alert on the following events:
- **Job lifecycle**: `JobCreated`, `JobApplied`, `JobCompletionRequested`, `JobValidated`, `JobDisapproved`, `JobCompleted`, `JobFinalized`, `JobExpired`, `JobCancelled`.
- **Disputes**: `JobDisputed`, `DisputeResolved`, `DisputeResolvedWithCode`, `DisputeTimeoutResolved`.
- **NFT issuance**: `NFTIssued`.
- **Treasury/ops**: `AGIWithdrawn`, `Paused`, `Unpaused`, `RewardPoolContribution`.
- **Identity**: `IdentityConfigurationLocked`, `MerkleRootsUpdated`, `RootNodesUpdated`, `EnsRegistryUpdated`, `NameWrapperUpdated`.
- **Blacklists**: `AgentBlacklisted`, `ValidatorBlacklisted`.

**Solvency invariant**
Always ensure: `agiToken.balanceOf(contract) >= lockedEscrow`.

## 11) Known gaps / future work
- `additionalAgentPayoutPercentage` is **unused** in settlement logic (reserved for future use).
- “Reward pool” contributions are **not segregated** from treasury.
- Optional future work: add more explicit blacklist change events (already present today).

## 12) Test status
See [`docs/test-status.md`](test-status.md) for the latest local test results and known environment limitations.

## 13) Additional notes (required clarifications)
- **additionalAgentPayoutPercentage**: present but currently unused in payout math; changing it does not affect settlement.
- **NFT trading**: AGI Jobs are standard ERC‑721 NFTs and can be traded externally via normal approvals and transfers; this contract does not implement an internal marketplace.
- **Dispute model**: dispute outcomes are centralized (moderators/owner), with all resolutions emitted as on-chain events; this is not a decentralized court/DAO.
