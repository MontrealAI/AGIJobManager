# Deploy Day Runbook — v1.1.0

Use the [Hardhat deployment guide](../hardhat/README.md) for the supported public-network workflow. Truffle/Ganache dependencies and migration commands are retired; local regression tests use Hardhat 3.

Use the [launch checklist](LAUNCH_CHECKLIST.md) to record decisions, signers, rehearsal evidence and the actual readiness report. Publishing a release does not complete those gates.

## Before deployment

1. Pin the reviewed source commit or immutable release and use its matching [guide and CI evidence](V1_RELEASE_SCOPE.md#published-download-versus-current-source). Verify checksums for published downloads.
2. Use Node 22.23.2, run `npm ci` and `npm --prefix hardhat ci`, then `npm --prefix hardhat run setup`; review the [dependency security scope](DEPENDENCY_SECURITY.md).
3. Select Ethereum mainnet or Sepolia and verify the native six-decimal USDC address against Circle's registry.
4. Provide two distinct, reviewed recipient addresses for the fixed 30% and 10% shares. No production recipient is supplied by the release.
5. Review the intended owner, linked libraries, ENS settings, validator budget, bonds and review periods. Prefer a secured multisig for ownership.
6. Confirm the release CI gates, source commit and compiler profile. Read [owner controls](OWNER_CONTROLS.md) before setting irreversible identity locks.

## Deploy and configure

Complete the selected offline `check:config:mainnet` or `check:config:sepolia`, compile and run its `DRY_RUN=1` live plan. Follow the environment setup in the Hardhat guide. Actual broadcasts require explicit `DRY_RUN=0 npm run deploy:sepolia` or `DRY_RUN=0 npm run deploy:mainnet`, plus all network/signing/verification gates. Missing/empty `DRY_RUN` is read-only in v1.1.0 tooling; retain explicit `DRY_RUN=1` for plans on every version. The script deploys a fresh non-upgradeable manager whose constructor starts intake paused, verifies contracts, and records addresses, transactions, constructor inputs and ownership status.

If the intended owner differs from the deployer, the script only proposes the transfer. That address must call `acceptOwnership()`. Verify `owner()` and zero `pendingOwner()`; the deployer retains authority until acceptance.

While intake remains paused, use the v1.1.0 USDC owner console or the verified explorer contract to configure roles, limits, ENS and policy. Verify USDC, both recipient addresses, all reserves, validator rate and ownership directly on chain. Confirm that ordinary settlement is available before opening intake. The console simulates privileged writes and requires review.

## Open intake

1. Reconcile the deployment receipt with on-chain state and publish the reviewed deployment registry.
2. Complete the testnet rehearsal and deployment readiness checks before opening intake. After the authorized launch, use a deliberately limited first production job to verify validator rewards, gross-cost 30% and 10% transfers, agent remainder and cleared reserves before increasing exposure.
3. Consider the optional irreversible identity lock only after all manager/helper wiring and lifecycle checks pass and the owner accepts the lost repair options. Locking is not required to open intake.
4. Unpause intake after configuration and ownership acceptance are verified.

## Maintenance and recovery

Pause intake to stop new jobs; normal settlement remains available. Settlement pause is a separate emergency control. Wallet rotation requires paused intake and all job escrow, agent bonds, validator bonds and dispute bonds to be zero. Existing commitments therefore cannot be redirected.

Code changes require a fresh deployment and a managed migration; this release does not upgrade or deploy any live instance. In v1.1.0, failed outgoing USDC transfers become reserved claims for their original recipients; other eligible recipients can still be paid. Issuer restrictions can delay receipt, and incoming escrow or bond transfers can still fail. See [payout rules](USDC_PAYOUT_SPLIT.md) and [owner controls](OWNER_CONTROLS.md).

Before opening a new deployment, run the read-only [deployment readiness check](../hardhat/README.md). See [mainnet qualification and remaining deployment gates](MAINNET_READINESS.md).
