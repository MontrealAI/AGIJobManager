# Deploy Day Runbook

## Scope
Deploy and activate AGIJobManager safely with optional ENSJobPages wiring.

## 0) Preconditions
- Use a multisig owner (`<SAFE_ADDRESS>`).
- Prepare `.env` from `.env.example`.
- Confirm deployment config values (token, ENS, roots, Merkle roots).
- Confirm compiler settings remain repository defaults (do **not** alter).

## 1) Build and test gate
```bash
npm ci
npm run build
npm test
npm run size
```

## 2) Deploy
```bash
npx truffle migrate --network mainnet
```

If redeploying from scratch:
```bash
npx truffle migrate --network mainnet --reset
```

## 3) Post-deploy configuration
Use `scripts/postdeploy-config.js` with a reviewed JSON config.

Example:
```bash
npx truffle exec scripts/postdeploy-config.js --network mainnet --address <AGIJOBMANAGER_ADDRESS> --config-path <CONFIG_JSON_PATH>
```

## 4) Verify contracts
```bash
npx truffle run verify AGIJobManager --network mainnet
npx truffle run verify ENSJobPages --network mainnet
```

## 5) Smoke test checklist (paused-first)
- [ ] Contract owner is `<SAFE_ADDRESS>`.
- [ ] `paused()` is true for initial setup.
- [ ] `settlementPaused` is set to intended value.
- [ ] Identity wiring points to expected AGI token, ENS registry, wrapper, and roots.
- [ ] Merkle roots match release artifacts.
- [ ] Validator thresholds and reward params match signed config.
- [ ] If used, ENSJobPages `jobManager` and root values are correct.
- [ ] Run one controlled create/apply/completion/validate/finalize cycle on staging/testnet before mainnet unpause.

## 6) Lock irreversible wiring
After all identity endpoints are validated:
- [ ] Call `lockIdentityConfiguration()`.
- [ ] Record tx hash and timestamp.

## 7) Activate
- [ ] `setSettlementPaused(false)` if previously true.
- [ ] `unpause()`.
- [ ] Start monitoring/alerting from Operations Runbook.

## 8) Required records
- [ ] Deployment commit hash.
- [ ] Truffle migration logs.
- [ ] Verified contract links.
- [ ] Final runtime parameter snapshot.
- [ ] Identity lock tx hash.
