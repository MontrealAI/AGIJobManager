# Owner Runbook — v0.9.0

Use this runbook for configuration, ownership and incident decisions. Use the [Hardhat deployment guide](../hardhat/README.md) for public-network commands and the [owner controls guide](OWNER_CONTROLS.md) for the exact boundaries of each setting. Root Truffle tooling is for disposable local rehearsals only.

## In one minute (owner/operator)

- Deploy the reviewed release with Hardhat. The constructor starts intake paused; the deployment script never opens it.
- Verify native Circle USDC, both settlement wallets, linked code, policy settings and the intended owner. A proposed ownership transfer still requires `acceptOwnership()`.
- Complete the read-only readiness check and operational review before the accepted owner calls `unpauseIntake()`.
- Use `pauseIntake()` to stop new jobs while existing work settles. For an active exploit affecting funds, use `pauseAll()` and verify both pause flags.
- Identity locks are irreversible governance choices. They do not repair an incident or pause activity.

## Start here by owner intent

- **Deploy a manager:** [Hardhat guide](../hardhat/README.md), [deployment operations](DEPLOYMENT_OPERATIONS.md) and [deploy-day runbook](DEPLOY_DAY_RUNBOOK.md).
- **Change recipient wallets or ownership:** [owner controls](OWNER_CONTROLS.md).
- **Replace ENSJobPages:** [ENS replacement guide](DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md).
- **Use a verified explorer:** [Etherscan guide](ETHERSCAN_GUIDE.md); check every method against the current [contract interface](REFERENCE/CONTRACT_INTERFACE.md).
- **Contain an incident:** [incident response](OPERATIONS/INCIDENT_RESPONSE.md).

## ENS replacement responsibilities (owner split)

| Action | Responsible signer |
| --- | --- |
| NameWrapper `setApprovalForAll(newEnsJobPages, true)` | Wrapped-root owner |
| Manager `setEnsJobPages(newEnsJobPages)` | AGIJobManager owner, while identity configuration remains unlocked |
| `migrateLegacyWrappedJobPage(jobId, exactLabel)` where required | ENSJobPages owner |
| Reviewed irreversible lock | Owner of the contract being locked |

Future jobs use the configured `<prefix><jobId>.<jobsRootName>` label, with `agijob` as the default prefix. Existing snapshotted labels stay stable unless explicitly migrated or imported. Verify the actual root, prefix, approvals and legacy-label inventory before cutover.

## Manual vs automated (owner-safe expectations)

The manager's Hardhat workflow builds, deploys, checks runtime code and completes explorer verification before proposing ownership transfer when needed. A verification failure stops before that proposal. It does not accept ownership, open intake, grant NameWrapper approvals or choose a migration policy for you.

Before an ENS lock, confirm `ensJobPages()` points to the intended contract, wrapper approval is active, a future job hook succeeds, and legacy migration work is complete or explicitly tracked.

## 1) Deployment checklist

1. Check out the immutable v0.9.0 release and verify its checksums. Use Node 22.23.2 and the committed root and Hardhat lockfiles.
2. Compile and qualify using the [Hardhat guide](../hardhat/README.md). Preserve the qualified Solidity compiler settings and Ethereum size limits; do not substitute local Truffle artifacts for the public deployment build.
3. Review all six constructor inputs: canonical USDC, base IPFS URL, two ENS addresses, four namespace roots, two Merkle roots, and **two distinct settlement wallets ordered 30% then 10%**. Confirm the intended final owner separately. Example addresses and roots are not a reviewed production configuration.
4. Run a read-only deployment plan, rehearse on Sepolia and review the saved plan before any authorized mainnet broadcast. Review the five library addresses and exact linked runtime code.
5. Verify the manager and every linked library on Etherscan. A failed deployment command may already have broadcast transactions: inspect the deployment journal and reconcile receipts before retrying. Where all six deployments completed, use the Hardhat guide's read-only recovery procedure; preserve its separate reverified receipt and the original journal. Recovery does not propose or accept ownership.
6. Have the proposed final owner call `acceptOwnership()` where needed. Verify `owner()`, zero `pendingOwner()` and the completed transfer event.
7. While intake stays paused, configure moderators, authorization routes, eligible agent NFT collections, limits, bonds and review periods. An agent needs both authorization and a qualifying enabled ERC-721 holding; allowlisting alone is insufficient.
8. Run the read-only readiness checker with the reviewed deployment receipt and complete the operational gates in [mainnet readiness](MAINNET_READINESS.md). Confirm `paused()==true`, `settlementPaused()==false`, both recipient addresses, USDC issuer status and all four reserve counters.

ENSJobPages is optional. When enabled, verify selector compatibility and hook behavior:

- `handleHook(uint8,uint256)` → `0x1f76f7a2`, calldata length `0x44`.
- `jobEnsURI(uint256)` → `0x751809b4`, calldata length `0x24`.

The offline state advisor can help review a recorded job state; it does not authorize a transaction or replace current on-chain reads:

```bash
node scripts/advisor/state_advisor.js --input scripts/advisor/sample_job_state.json
```

## 2) Safe defaults + staged rollout

1. **Configure:** keep the constructor's intake pause in place. Settlement is initially enabled; no job can enter until intake is opened.
2. **Verify:** finish source verification, accepted ownership, participant eligibility, read-only readiness and monitoring. Readiness is a point-in-time check; recheck any state changed afterward.
3. **Activate:** the accepted owner calls `unpauseIntake()` only after reviewing those results. This opens new work; there is no separate automatic launch transaction in the deployment scripts.
4. **Limit exposure:** execute and reconcile a deliberately small production job before increasing limits. With the default 8% validator budget, a 100 USDC job allocates 8 / 30 / 10 / 52 before considering rounding, unused rewards and separate bonds. See [payout rules](USDC_PAYOUT_SPLIT.md).

Keep operational parameter changes reviewable. The validator percentage is fixed for each job at posting; changes to it affect new jobs. Review periods, voting thresholds, quorum and validator slashing require empty escrow and bonds. Other settings can affect later actions on already-posted jobs; do not assume every parameter is snapshotted.

## 3) Incident playbooks

### A) Stop intake only, allowing safe settlements to finish

Call `pauseIntake()` (or `pause()`) if intake is currently open. Verify `paused()==true` and the existing `settlementPaused()` value. Leave settlement enabled only when it is safe to continue; do not clear an existing emergency settlement pause merely to stop intake.

### B) Stop settlement and intake writes

Call `setSettlementPaused(true)`. This blocks completion, voting, dispute resolution, finalization, cancellation/refunds and `createJob`/`applyForJob`. It does not change `paused()`. Read-only queries remain available.

### C) Active exploit or immediate fund risk

Call `pauseAll()` through the authorized owner and verify both `paused()==true` and `settlementPaused()==true`. Preserve evidence and follow [incident response](OPERATIONS/INCIDENT_RESPONSE.md). These controls stop the guarded job paths; they do not revoke owner authority or stop blockchain time.

## 4) Withdraw unreserved USDC without touching escrow

Successful job costs are distributed directly to validators, the two recipient wallets and the agent. They do not accumulate as a manager treasury. `withdrawableUSDC()` exposes only balance above job escrow and all outstanding bonds, such as an unsolicited donation.

Before `withdrawUSDC(amount)`:

1. Reconcile the token balance against `lockedEscrow`, `lockedAgentBonds`, `lockedValidatorBonds` and `lockedDisputeBonds`.
2. Read `withdrawableUSDC()` and choose a positive amount no greater than that value.
3. Confirm intake is paused and settlement is enabled, as required by the function. Do not weaken incident containment just to withdraw surplus.
4. Simulate, review and execute with the owner. Save the transaction hash and reconcile balances and reserves afterward.

`rescueERC20` applies the same surplus and pause guards to USDC. Generic `rescueToken` cannot target USDC or the manager itself. Rescue functions are not an escrow migration mechanism and cannot bypass Circle's transfer restrictions.

## 5) Allowlist governance (Merkle roots)

1. Build address lists and proofs offline from the reviewed participant set.
2. Review the generated roots, proofs, authority routes and impact on posted jobs.
3. Distribute the new proofs and announce the planned change before submitting it. There is no built-in dual-root grace period.
4. The owner calls `updateMerkleRoots(validatorRoot, agentRoot)` and verifies `MerkleRootsUpdated` plus both getters.
5. Record the actual transaction/block and retain the prior roots and proofs for a reviewed rollback if appropriate.

```bash
node scripts/merkle/export_merkle_proofs.js --input allowlist.json --output proofs.json
```

Merkle roots and additional allowlists remain separate controls from the irreversible ENS identity lock. Eligibility changes do not reverse completed votes or settled payments.

## 6) ENS operations

- `updateEnsRegistry`, `updateNameWrapper` and `updateRootNodes` require unlocked identity configuration and zero outstanding escrow and bonds.
- `setEnsJobPages` changes the optional job-page pointer only while identity configuration is unlocked; a zero address disables this integration.
- `setUseEnsJobTokenURI(false)` disables the optional ENS token-URI presentation path. It does not change agent/validator authorization through ENS.
- `lockIdentityConfiguration()` permanently disables the protected identity setters. It does not lock Merkle roots, freeze the entire contract or mitigate compromised identity configuration.

Use the separate wrapped-root owner for NameWrapper approvals. Confirm the impact of revoking an old approval on existing pages before doing so.

## 6.1) Lock preflight (do not skip)

Before manager `lockIdentityConfiguration()` or ENSJobPages `lockConfiguration()`:

- [ ] All addresses, namespace roots and manager/job-page relationships match the reviewed configuration.
- [ ] NameWrapper approval is active for intended wrapped-root operations.
- [ ] A future job hook path and intended authorization paths have succeeded in rehearsal.
- [ ] Legacy labels requiring preservation are migrated or explicitly tracked.
- [ ] The owner understands which future repairs and replacements the particular lock prevents.
- [ ] There is no unresolved identity incident. Locking a bad configuration would preserve the problem.

## 7) High-risk actions (operator warnings)

USDC is immutable and the 30% / 10% shares are fixed in v0.9.0. Recipient addresses can change only with paused intake and zero reserves; existing escrow cannot be redirected to a new wallet.

Ownership uses proposal then acceptance. Administrative authority stays with the current owner until acceptance; `renounceOwnership()` is disabled. Verify the recipient independently before proposing a change.

Owner and moderator powers remain trusted. Document and simulate changes to bonds, thresholds, eligibility and dispute policy. This contract has no proxy upgrade route: code defects requiring a new implementation need a fresh deployment and a reviewed plan for existing jobs, rather than an assumed in-place upgrade.
