# Deployment and Release Operations

Institutional deployment guidance for deterministic releases across development, testnet, and mainnet.

## Deployment surface

| Stage | Source of truth | Primary command | Verification artifact |
| --- | --- | --- | --- |
| Build | [`package.json`](../package.json), [`truffle-config.js`](../truffle-config.js) | `npm run build` | Compiler output in terminal + `build/contracts/*.json` |
| Migration | [`migrations/1_deploy_contracts.js`](../migrations/1_deploy_contracts.js), [`migrations/deploy-config.js`](../migrations/deploy-config.js) | `truffle migrate --network <network> --reset` | Migration tx hash + deployed contract address |
| Post-deploy config | [`scripts/postdeploy-config.js`](../scripts/postdeploy-config.js), [`.env.example`](../.env.example) | `node scripts/postdeploy-config.js --network <network> --address <AGIJobManager>` | Config tx receipts + emitted events |
| Verification | [`docs/VERIFY_ON_ETHERSCAN.md`](./VERIFY_ON_ETHERSCAN.md) | Follow Etherscan verification flow | Verified source match on explorer |
| Operations handoff | [`docs/OPERATIONS/RUNBOOK.md`](./OPERATIONS/RUNBOOK.md) | Run checklist + monitoring enablement | Signed runbook + alert subscriptions |

## Deterministic deployment flow

1. Install deterministic dependencies.

```bash
npm ci
```

2. Compile and validate tests before any deployment.

```bash
npm run build
npm test
```

3. Dry-run on development network.

```bash
npx ganache --wallet.totalAccounts 10 --wallet.defaultBalance 1000 --chain.chainId 1337
truffle migrate --network development --reset
```

4. Apply owner configuration from reviewed config.

```bash
node scripts/postdeploy-config.js --network development --address <DEPLOYED_AGIJOBMANAGER>
```

5. Record and archive deployment evidence.
   - Contract address, tx hashes, block numbers.
   - Constructor arguments and post-deploy parameter values.
   - Event receipts for role setup, allowlists, and roots.

## Mainnet gate criteria

| Gate | Requirement | Failure response |
| --- | --- | --- |
| Parameter sanity | `truffle exec scripts/ops/validate-params.js --network <network> --address <AGIJobManager>` passes reviewed config values | Stop rollout; correct config and restart approvals |
| Role assignment | Owner/moderator addresses match signed change request | Halt deployment; investigate signer mix-up |
| Monitoring readiness | Alerts configured for pause, dispute, withdrawals, and stale jobs | Delay launch until alerts and on-call chain are active |
| Recovery rehearsal | Team can execute `pause`, `setSettlementPaused`, and blacklist controls safely | Conduct rehearsal on testnet first |
| Documentation parity | `npm run docs:check` passes on release branch | Regenerate docs and re-review before deployment |

## Post-deploy validation checklist

- Confirm `owner()` and immutable addresses (`agiToken`) are expected.
- Confirm operational parameters match approved values.
- Confirm pause flags are in expected default state.
- Confirm moderator, allowlist, and Merkle-root configuration by getter + events.
- Confirm solvency guardrail: `withdrawableAGI()` remains coherent after canary job lifecycle.

## Release rollback philosophy

- **Configuration-only defects:** pause intake, adjust parameters, communicate incident status.
- **Active exploit suspicion:** execute `pauseAll` first, preserve forensic evidence, then triage with incident playbook.
- **Identity integration instability:** use identity config lock only after proven stable configuration; treat lock as irreversible governance action.
