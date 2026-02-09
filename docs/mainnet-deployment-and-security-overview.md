# AGIJobManager – Mainnet Deployment & Security Overview

## 1) Executive summary
AGIJobManager is an **owner‑operated** on‑chain escrow + settlement engine for employer‑funded jobs, with validator approvals/disapprovals, moderator dispute resolution, reputation tracking, and ERC‑721 job NFT issuance. It is a **business‑operated** system with strong escrow invariants; it is **not** a DAO, not trustless arbitration, and not an upgradeable proxy.

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
- Withdraw treasury funds **only while paused** (never escrow or bonded funds).
- Manage allowlists/blacklists and additional agents/validators.
- Update economic parameters (validator thresholds, reward percentages, payout caps, duration limits, review periods, bonds).
- Manage moderators and AGI payout tiers (AGI types).
- Configure identity wiring before lock (token/ENS/NameWrapper/root nodes).
- Delist unassigned jobs via `delistJob` (owner‑only).

**Moderator (dispute authority)**
- Resolve disputes via `resolveDisputeWithCode` (typed outcomes) or legacy `resolveDispute` (string‑based, deprecated). Outcomes are binary: **agent win** or **employer win**. `NO_ACTION` is allowed and leaves the dispute active.

**User roles**
- **Employer**: creates jobs, funds escrow, cancels unassigned jobs, disputes, receives NFTs.
- **Agent**: applies for jobs, requests completion, posts an agent bond, earns payouts + reputation.
- **Validator**: approves/disapproves completion, posts a validator bond per vote, earns payouts + reputation on the winning side.

## 3) Job lifecycle / state machine
The job struct encodes the state machine via fields like `assignedAgent`, `completionRequested`, `disputed`, `expired`, `completed`, timestamps, and the `agentPayoutPct` snapshot. Validator voting is also captured by `validatorApprovals`, `validatorDisapprovals`, `validatorApproved`, and `validatorApprovedAt`.

**Happy path (example)**
1. `createJob` escrows `payout` (increasing `lockedEscrow`).
2. `applyForJob` assigns an agent, snapshots `agentPayoutPct`, and locks the agent bond.
3. `requestJobCompletion` stores completion metadata.
4. Validators call `validateJob` until `requiredValidatorApprovals` is reached; each vote posts a bond.
5. After the challenge window (`challengePeriodAfterApproval`), `finalizeJob` releases escrow, pays the agent, settles validator rewards/slashing, and mints the completion NFT.

**Dispute path (example)**
1. After completion request, validators disapprove or employer/agent calls `disputeJob`.
2. Dispute becomes active (`disputed = true`, `disputedAt` set) and validator voting is frozen.
3. Moderator resolves via `resolveDisputeWithCode` (agent win or employer win) or leaves it active with `NO_ACTION`.
4. If the dispute times out, the owner may use `resolveStaleDispute` (pause optional).

**Timeouts & liveness**
- **Expiration**: `expireJob` refunds the employer when the job duration elapses and completion was never requested.
- **Finalize after review window**: `finalizeJob` settles after `completionReviewPeriod` when validators are silent or split. If no validators voted, anyone can finalize; the outcome defaults to an agent win.
- **Validator approval + challenge window**: once `validatorApprovals` reaches `requiredValidatorApprovals`, the job becomes `validatorApproved` and can be finalized after `challengePeriodAfterApproval` if approvals still exceed disapprovals.
- **Stale dispute recovery**: `resolveStaleDispute` is owner‑only after `disputeReviewPeriod` (pause optional; often used during incident response).

## 4) Treasury vs escrow separation (hard invariant)
**Escrow** is tracked by `lockedEscrow` (sum of unsettled job payouts). **Bonds** are tracked by `lockedAgentBonds`, `lockedValidatorBonds`, and `lockedDisputeBonds`. **Treasury** is the AGI balance minus escrow and locked bonds.

**Why this matters**: it defines the hard boundary auditors and users rely on to ensure escrowed job funds cannot be withdrawn by the operator.

- `withdrawableAGI()` = `agiToken.balanceOf(this) - lockedEscrow - lockedAgentBonds - lockedValidatorBonds - lockedDisputeBonds` and **reverts** if obligations exceed balance.
- `withdrawAGI()` is **owner‑only** and **paused‑only**, and cannot exceed `withdrawableAGI()`.

**What becomes treasury**
- Payout remainder when `agentPayoutPct + validationRewardPercentage < 100`.
- Rounding dust from integer division.
- Direct contributions via `contributeToRewardPool` (no segregation or automated distribution; funds remain in the general contract balance).

**Simple example**
- Contract balance = 10,000 AGI
- `lockedEscrow` = 9,000 AGI
- `lockedAgentBonds + lockedValidatorBonds + lockedDisputeBonds` = 250 AGI
- `withdrawableAGI()` = 750 AGI (and `withdrawAGI` cannot exceed this)

Escrowed funds can only be released through settlement paths (completion, refund, cancel, expire). The owner cannot sweep escrowed funds.

## 5) Identity wiring lock (`lockIdentityConfig`)
The identity lock is a one‑way switch intended to freeze identity wiring after initial setup.

> Naming note: earlier docs called this `configLocked`; the current boolean is `lockIdentityConfig` and the one‑time action is `lockIdentityConfiguration()`.

**Why this matters**: it freezes the core ENS/token wiring to prevent identity spoofing while still allowing day‑to‑day operational controls.

**Locked after `lockIdentityConfiguration()`**
- `updateAGITokenAddress`
- `updateEnsRegistry`
- `updateNameWrapper`
- `setEnsJobPages`
- `updateRootNodes`

**Not locked**
- `updateMerkleRoots` (allowlist roots remain adjustable).
- Operational controls (pause/unpause, allowlists/blacklists, parameter tuning).
- `setUseEnsJobTokenURI` (operational toggle for ENS-based token URIs).
- Treasury withdrawals (still paused‑only).

**Pre‑lock constraints**
Even before locking, identity wiring updates require `nextJobId == 0` and `lockedEscrow == 0`.

**Recommended procedure**
1. Deploy.
2. Configure token/ENS/NameWrapper/root nodes and initial Merkle roots.
3. Validate wiring and allowlists on a testnet.
4. Call `lockIdentityConfiguration()`.

## 6) Pause semantics (code‑accurate)
Pause is an incident‑response control to halt new activity while preserving exits. Settlement
is independently controlled by `setSettlementPaused(bool)` and blocks fund‑out/exit paths guarded
by `whenSettlementNotPaused`.

**Incident sequencing:** call `setSettlementPaused(true)` first (freeze fund‑out), then `pause()`
to stop intake. **Recovery:** clear `settlementPaused` only after settlement safety is confirmed;
unpause intake last.

**Pause policy table**

| Function group | Who can call | Paused? | Notes |
| --- | --- | --- | --- |
| `createJob` | Employer | Blocked | Creates new escrowed obligations. |
| `applyForJob` | Agent | Blocked | Assigns an agent and locks the agent bond. |
| `validateJob` / `disapproveJob` | Validator | Blocked | Posts validator bonds and records votes. |
| `disputeJob` | Employer/Agent | Blocked | Manual dispute initiation (validator-driven disputes are internal). |
| `contributeToRewardPool` | Any | Blocked | Transfers funds into the contract balance. |
| `requestJobCompletion` | Assigned agent | Allowed | Keeps agents from being trapped during pauses. |
| `cancelJob` / `expireJob` | Employer / Any | Allowed | Settlement exits remain live unless `settlementPaused` is true. |
| `finalizeJob` | Any | Allowed | Finalizes after review windows/challenge periods; blocked by `settlementPaused`. |
| `resolveDispute` / `resolveDisputeWithCode` | Moderator | Allowed | Dispute resolution remains available during pauses; blocked by `settlementPaused`. |
| `delistJob` | Owner | Allowed | Owner can delist unassigned jobs; blocked by `settlementPaused`. |
| `withdrawAGI` | Owner | **Allowed only while paused** | Treasury withdrawals are pause‑gated and blocked by `settlementPaused`. |
| `resolveStaleDispute` | Owner | Allowed | Only after `disputeReviewPeriod`; blocked by `settlementPaused`. |

## 7) Security posture (operational highlights)
- **ReentrancyGuard** protects external state‑changing entrypoints that cross ERC‑20 boundaries (e.g., `createJob`, `withdrawAGI`, dispute resolution, settlement).
- **Exact ERC‑20 transfer checks** are used where escrow integrity matters (`createJob`, `contributeToRewardPool`), preventing fee‑on‑transfer / rebasing tokens from under‑funding escrow. Payout transfers use standard ERC‑20 transfer checks.
- **Bounded loops**: validator lists are capped at `MAX_VALIDATORS_PER_JOB` (50).
- **ENS/NameWrapper lookups** use `try/catch` and are view‑only; failures just return false.
- **Dispute outcomes are binary** (agent win vs employer win); `NO_ACTION` logs without settlement.
- **Validator slashing** is enforced via `validatorSlashBps`; incorrect‑side validators lose a portion of their bond.
- **Known limitations**: centralized operator risk; parameter changes can affect in‑flight jobs; no on‑chain enforcement of off‑chain legal terms; “reward pool” is not segregated from treasury.

### Reputation system (as implemented)
- Agent and validator reputation points are computed via `ReputationMath.computeReputationPoints`:
  - `payoutUnits = payout / 1e15`
  - `base = log2(1 + payoutUnits)`
  - `timeBonus = (duration - completionTime) / 10000` when `duration > completionTime`, then capped at `base`
  - `reputationPoints = base + timeBonus` (or `0` if `repEligible` is false)
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
- **evmVersion**: `london` (configurable via `SOLC_EVM_VERSION`)

**How to measure size locally**
```bash
node -e "const a=require('./build/contracts/AGIJobManager.json'); const b=(a.deployedBytecode||'').replace(/^0x/,''); console.log('AGIJobManager deployedBytecode bytes:', b.length/2)"
```

## 9) Verification & deployment guide (Truffle‑first)
**Build & test (repo scripts)**
```bash
npm install
npm run build
npm test
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
Index and alert on the following events (as emitted in the current contract):
- **Job lifecycle**: `JobCreated`, `JobApplied`, `JobCompletionRequested`, `JobValidated`, `JobDisapproved`, `JobCompleted`, `JobExpired`, `JobCancelled`.
- **Disputes**: `JobDisputed`, `DisputeResolved`, `DisputeResolvedWithCode`.
- **NFT issuance**: `NFTIssued`.
- **Treasury/ops**: `AGIWithdrawn`, `RewardPoolContribution`, `PlatformRevenueAccrued`, `Paused`, `Unpaused`.
- **Identity wiring**: `EnsRegistryUpdated`.
- **Reputation**: `ReputationUpdated`.
- **Blacklists**: `AgentBlacklisted`, `ValidatorBlacklisted`.

**Solvency invariant**
Always ensure: `agiToken.balanceOf(contract) >= lockedEscrow + lockedAgentBonds + lockedValidatorBonds + lockedDisputeBonds`.

**Operational monitoring suggestions**
- Alert on owner actions (pause, withdrawals, identity lock, parameter changes).
- Track validator participation rates and dispute volumes.
- Monitor escrow solvency and delayed finalizations.

## 11) Additional notes (code‑accurate)
- **`additionalAgentPayoutPercentage` is currently unused** in settlement math; it is a reserved parameter with no effect on payouts today.
- **No internal NFT marketplace**: job NFTs are standard ERC‑721 tokens; trading happens via external marketplaces using standard approvals/transfers.
- **Not a decentralized court/DAO**: disputes are resolved by moderators (and stale disputes by the owner) with on‑chain event transparency, not by a DAO or on‑chain jury.

## 11) Known gaps / future work
- `additionalAgentPayoutPercentage` is **unused** in settlement logic (reserved for future use).
- “Reward pool” contributions are **not segregated** from treasury.
- Optional future work: add more granular blacklist change events (already present today).

## 12) Test status
Local test results are tracked in [`docs/test-status.md`](test-status.md).

## 13) Additional notes (required clarifications)
- **additionalAgentPayoutPercentage**: present but currently unused in payout math; changing it does not affect settlement.
- **NFT trading**: AGI Jobs are standard ERC‑721 NFTs and can be traded externally via normal approvals and transfers; this contract does not implement an internal marketplace.
- **Dispute model**: dispute outcomes are centralized (moderators/owner), with all resolutions emitted as on-chain events; this is not a decentralized court/DAO.
