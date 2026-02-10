# Deploy Day Runbook

## Purpose
Single source of truth for institutional deployment of AGIJobManager.

## Audience
Deployment operators and security signers.

## Preconditions
- Controlled deployer and owner (recommended multisig) are prepared.
- Required environment variables are set (use placeholders, never commit secrets).

## Phase 0 — Stop/Go Preflight
- [ ] `npm ci`
- [ ] `npm run build`
- [ ] `npm run size`
- [ ] `npm test`
- [ ] Confirm target network config in `truffle-config.js`.
- [ ] Confirm deploy config in `migrations/deploy-config.js` and overrides.

**Go criteria**: all checks pass, bytecode under cap, sign-off recorded.

## Phase 1 — Deploy
```bash
npx truffle migrate --network <mainnet|sepolia>
```

Capture artifacts immediately:
- chainId
- deploy tx hash(es)
- deployed address
- compiler version and settings from `truffle-config.js`
- repository commit SHA

## Phase 2 — Post-Deploy Configuration
Use either env/config driven script or direct transactions.

```bash
truffle exec scripts/postdeploy-config.js --network <network> --address <AGIJOBMANAGER_ADDRESS>
```

Checklist:
- [ ] Moderators added
- [ ] Validator and agent lists configured
- [ ] Economic parameters set (thresholds, bonds, windows)
- [ ] AGIType entries configured
- [ ] Optional ENSJobPages configured (`setEnsJobPages`, tokenURI mode)

## Phase 3 — Verify Config
```bash
truffle exec scripts/verify-config.js --network <network> --address <AGIJOBMANAGER_ADDRESS>
truffle exec scripts/ops/validate-params.js --network <network> --address <AGIJOBMANAGER_ADDRESS>
```

**Go criteria**: verification script passes; no FAILs in parameter validator.

## Phase 4 — Smoke Test
On target network (small values):
1. create job
2. apply
3. request completion
4. validator vote(s)
5. finalize or dispute-resolve

Record key event tx hashes for each step.

## Phase 5 — Lock + Enable
- [ ] If identity wiring is final, call `lockIdentityConfiguration()`.
- [ ] Set pause states to intended production mode (`unpause`, `setSettlementPaused(false)`).
- [ ] Transfer ownership to final safe (if needed) and verify owner.

## Verification (Explorer)
If plugin/env available:
```bash
npx truffle run verify AGIJobManager --network <network>
```

## Rollback / Redeploy Strategy
Contracts are not upgradeable. Rollback is operational:
- Pause affected deployment.
- Redeploy new instance.
- Re-apply configuration and ownership controls.
- Migrate off-chain integrations to new address.

## Gotchas
- Identity lock is irreversible.
- ENS hook failures are expected to be non-fatal; monitor and remediate separately.
- Do not withdraw treasury during active incident investigation.

## References
- [`../migrations/2_deploy_contracts.js`](../migrations/2_deploy_contracts.js)
- [`../migrations/deploy-config.js`](../migrations/deploy-config.js)
- [`../scripts/postdeploy-config.js`](../scripts/postdeploy-config.js)
- [`../scripts/verify-config.js`](../scripts/verify-config.js)
