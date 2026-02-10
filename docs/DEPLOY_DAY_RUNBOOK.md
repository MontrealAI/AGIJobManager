# Deploy Day Runbook

## 1. Preflight
- [ ] Run `npm ci`
- [ ] Run `npm run build`
- [ ] Run `npm run size`
- [ ] Run `npm test`
- [ ] Confirm deployer, owner multisig (`<SAFE_ADDRESS>`), and env vars are prepared locally.

## 2. Deploy
```bash
npx truffle migrate --network <network>
```

For mainnet/sepolia, deployment config is sourced from `migrations/deploy-config.js` + environment overrides.

## 3. Post-deploy configuration
- [ ] Set moderators (`addModerator`).
- [ ] Configure thresholds/periods/bond params.
- [ ] Configure AGIType list (`addAGIType`).
- [ ] Configure additional allowlists and blacklists as needed.
- [ ] If using ENS pages, deploy/configure `ENSJobPages`, then `setEnsJobPages` and optionally `setUseEnsJobTokenURI(true)`.

## 4. Verification and checks
- [ ] Verify constructor args and current config (optionally with `truffle exec scripts/verify-config.js`).
- [ ] Smoke-test lifecycle on target network with small values.
- [ ] Confirm emitted events and locked balances behave as expected.

## 5. Finalization steps
- [ ] Consider `lockIdentityConfiguration()` once addresses/root wiring are final.
- [ ] Unpause for production usage if currently paused.
- [ ] Record deployment metadata: commit hash, tx hashes, addresses, and config snapshot.

## Gotchas
- Identity lock is irreversible.
- ENS hooks are best-effort; failures are observable via `EnsHookAttempted`.
- Keep owner key in multisig; do not operate production ownership from a single EOA.
