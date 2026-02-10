# Deploy Day Runbook

## Purpose
Institutional deployment procedure for AGIJobManager and post-deploy hardening.

## Audience
Owner operators, release managers, and auditors observing launch controls.

## Preconditions / assumptions
- Deployment keys are in secure custody (prefer multisig owner destination).
- Environment variables are set locally; no secrets in repo.
- Commit SHA and release tag are decided before deployment.

## Phase 0 — stop/go gates
- [ ] `npm ci`
- [ ] `npm run build`
- [ ] `npm test`
- [ ] `npm run size`
- [ ] Confirm runtime bytecode under EIP-170 threshold.

## Phase 1 — deploy
```bash
truffle migrate --network <mainnet|sepolia> --reset
```

Capture artifacts immediately:
- `chainId`
- contract addresses (AGIJobManager + linked libs)
- deployment tx hashes
- compiler version/settings from `truffle-config.js`
- git commit SHA

## Phase 2 — postdeploy configuration
Apply policy/config using script:
```bash
node scripts/postdeploy-config.js --network <mainnet|sepolia> --address <AGIJOBMANAGER_ADDRESS>
```

Dry-run mode supported:
```bash
node scripts/postdeploy-config.js --dry-run --network <mainnet|sepolia> --address <AGIJOBMANAGER_ADDRESS>
```

## Phase 3 — verify applied config
```bash
node scripts/verify-config.js --network <mainnet|sepolia> --address <AGIJOBMANAGER_ADDRESS>
truffle exec scripts/ops/validate-params.js --network <mainnet|sepolia> --address <AGIJOBMANAGER_ADDRESS>
```

Stop if any invariant is `FAIL`.

## Phase 4 — explorer verification (if enabled)
Use Truffle verify workflow configured via `truffle-plugin-verify` and `ETHERSCAN_API_KEY`.
```bash
truffle run verify AGIJobManager --network <mainnet|sepolia>
```

## Phase 5 — smoke tests (mainnet-safe small values)
- [ ] Create low-value job and verify `JobCreated`.
- [ ] Apply from eligible agent and verify `JobApplied`.
- [ ] Request completion and verify `JobCompletionRequested`.
- [ ] Complete one validator path and settle via `finalizeJob`.
- [ ] Confirm locked accounting decreases as expected.

## Phase 6 — lock and go-live
- [ ] Ensure identity wiring final (token/ENS/root/merkle/ensJobPages).
- [ ] Execute `lockIdentityConfiguration()`.
- [ ] Confirm `IdentityConfigurationLocked` event.
- [ ] `unpause()` (if paused for launch).

## Role separation guidance
- Keep deployer and owner separate where possible.
- Transfer ownership to multisig after smoke test if not owner at deploy.
- Restrict moderator assignment to governed process.

## Rollback/redeploy strategy
Because contract is non-upgradeable:
1. Pause affected deployment.
2. Redeploy clean instance.
3. Reapply configuration and role lists.
4. Communicate migration plan for users/jobs.

## Gotchas / failure modes
- Setting wrong identity roots before lock is a hard operational fault.
- ENS hook failures do not imply escrow failure; check `EnsHookAttempted`.
- Do not run treasury withdrawal during launch validation; it requires paused state.

## References
- [`../migrations/2_deploy_contracts.js`](../migrations/2_deploy_contracts.js)
- [`../scripts/postdeploy-config.js`](../scripts/postdeploy-config.js)
- [`../scripts/verify-config.js`](../scripts/verify-config.js)
- [`../scripts/ops/validate-params.js`](../scripts/ops/validate-params.js)
- [`../truffle-config.js`](../truffle-config.js)
