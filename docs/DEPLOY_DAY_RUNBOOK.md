# Deploy Day Runbook

> Current guide for this source checkout. See [release identity and deployment commands](RELEASE_GUIDE.md).

For owner-entered Ubuntu mainnet creation, use the [hidden-prompt creator route](deployment/ubuntu-ephemeral-creator.md) in a separate reviewed checkout without deployment dotenv files. The [Hardhat deployment guide](../hardhat/README.md) also documents the maintained environment-backed route. Truffle/Ganache dependencies and migration commands are retired; local regression tests use Hardhat 3.

Use the [launch checklist](LAUNCH_CHECKLIST.md) to record decisions, signers, rehearsal evidence and the actual readiness report. Publishing a release does not complete those gates.

## Before deployment

1. Pin the reviewed source commit or immutable release and use its matching [guide and CI evidence](V1_RELEASE_SCOPE.md#published-download-versus-current-source). Verify checksums for published downloads.
2. Use Node 22.23.2 and the reviewed source with its pinned dependencies; review the [dependency security scope](DEPENDENCY_SECURITY.md). Follow the selected route’s preparation instructions. Run `setup` only for the environment-backed route; the hidden-prompt creator rejects deployment dotenv files.
3. Select Ethereum mainnet or Sepolia and verify the native six-decimal USDC address against Circle's registry.
4. Provide two distinct, reviewed recipient addresses for the fixed 30% and 10% shares. No production recipient is supplied by the release.
5. Review the intended owner, linked libraries, ENS settings, validator budget, bonds and review periods. Prefer a secured multisig for ownership.
6. Confirm the release CI gates, source commit and compiler profile. Read [owner controls](OWNER_CONTROLS.md) before setting irreversible identity locks.

## Deploy and configure

For the environment-backed route, complete the selected offline `check:config:mainnet` or `check:config:sepolia`, compile and run its `DRY_RUN=1` live plan. Follow the environment setup in the Hardhat guide. Actual broadcasts require explicit `DRY_RUN=0 npm run deploy:sepolia` or `DRY_RUN=0 npm run deploy:mainnet`, plus all network/signing/verification gates. Missing/empty `DRY_RUN` is read-only in the current tooling; retain explicit `DRY_RUN=1` for plans on every version. The script deploys a fresh non-upgradeable manager whose constructor starts intake paused, verifies contracts, and records addresses, transactions, constructor inputs and ownership status.

Current-schema creation assigns the explicit governor atomically. Verify `owner()` equals the reviewed governor and `pendingOwner()` is zero. Creation confers no owner authority merely for being the creator. Owner authority belongs to the explicit governor, which the environment-backed route may deliberately select as the same address; the hidden-prompt route requires different accounts. No ownership proposal or acceptance is required. Historical six-argument deployments retain their original two-step handover, and later voluntary Manager transfers remain two-step. Do not perform either action merely to follow a historical checklist.

The recommended hidden-prompt creator has its own public-plan confirmation, journals and source-verification export. It does not use the environment-backed signing command above. Preserve the original session and reconcile interrupted submissions before retrying.

While intake remains paused, use the matching current USDC owner console or the verified explorer contract to configure roles, limits, ENS and policy. Verify USDC, both recipient addresses, all reserves, validator rate and ownership directly on chain. Confirm that ordinary settlement is available before opening intake. The console simulates privileged writes and requires review.

## Open intake

1. Reconcile the deployment receipt with on-chain state and publish the reviewed deployment registry.
2. Retain the applicable rehearsal evidence and any explicitly scoped owner-accepted omission, verify constructor governance, and complete instance readiness, monitoring and operational review while intake remains paused.
3. Consider the optional irreversible identity lock only after the accepted owner reviews the lost repair options. It is not required for activation.
4. The accepted owner calls `unpauseIntake()` only after the reviewed launch gates pass.
5. Run a deliberately limited first production job and reconcile validator rewards, gross-cost 30% and 10% transfers, agent remainder and outstanding reserves before increasing exposure.

For automated employer intake, separately qualify [pre-funding admission](OPERATIONS/PREFUNDING.md), actual participant economics, dedicated capacity and private recovery paths. Contract readiness does not certify the private fleet, models, issuer or employer-value assumptions.

## Maintenance and recovery

Pause intake to stop new jobs; normal settlement remains available. Settlement pause is a separate emergency control. Wallet rotation requires paused intake and all job escrow, agent bonds, validator bonds and dispute bonds to be zero. Existing commitments therefore cannot be redirected.

Code changes require a fresh deployment and a managed migration; this release does not upgrade or deploy any live instance. Failed outgoing USDC transfers become reserved claims for their original recipients; other eligible recipients can still be paid. Issuer restrictions can delay receipt, and incoming escrow or bond transfers can still fail. See [payout rules](USDC_PAYOUT_SPLIT.md) and [owner controls](OWNER_CONTROLS.md).

Before opening a new deployment, run the read-only [deployment readiness check](../hardhat/README.md). See [mainnet qualification and remaining deployment gates](MAINNET_READINESS.md).
