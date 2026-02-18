# Deployment and Configuration

Institutional deployment guidance for deterministic local rehearsal, testnet rehearsal, and production execution.

## Deployment entrypoints

| Stage | Entrypoint | Purpose | Source of truth |
| --- | --- | --- | --- |
| Contract deployment | `migrations/1_deploy_contracts.js` | Deploys AGIJobManager with network-aware constructor args | [`migrations/1_deploy_contracts.js`](../migrations/1_deploy_contracts.js) |
| Deployment parameters | `migrations/deploy-config.js` | Defines network profiles and deploy-time constants | [`migrations/deploy-config.js`](../migrations/deploy-config.js) |
| Post-deploy owner setup | `scripts/postdeploy-config.js` | Applies moderator/allowlist/root/parameter configuration | [`scripts/postdeploy-config.js`](../scripts/postdeploy-config.js) |
| Parameter sanity checks | `scripts/ops/validate-params.js` | Validates operator parameter packages before owner txs | [`scripts/ops/validate-params.js`](../scripts/ops/validate-params.js) |

## Deterministic local deployment

```bash
npm ci
npm run build
npx ganache --wallet.totalAccounts 10 --wallet.defaultBalance 1000 --chain.chainId 1337
truffle migrate --network development --reset
```

Expected verification:
- Deployment tx confirms AGIJobManager address and owner address.
- Read `owner()`, `agiToken()`, `agentRootNode`, and pause flags immediately after deploy.

## Testnet and mainnet deployment discipline

```bash
# compile + tests before any live migration
npm run build
npm test

# dry-run parameter validation before owner transactions
node scripts/ops/validate-params.js --help

# deploy by network profile configured in truffle-config.js
truffle migrate --network <network_name> --reset

# run post-deploy owner configuration if the operational plan requires it
node scripts/postdeploy-config.js --network <network_name>
```

## Preflight checklist (no secrets in repo)

1. Confirm chain ID, RPC endpoint, and signer separation are documented in internal change ticket.
2. Confirm no `.env` secrets are in git status (`.env.example` placeholders only).
3. Rehearse the exact parameter package on testnet and archive tx hashes.
4. Confirm monitoring alerts are armed for `JobCreated`, `JobDisputed`, `DisputeResolvedWithCode`, `SettlementPauseSet`, and `AGIWithdrawn`.
5. Confirm rollback/containment plan (`pause`, `setSettlementPaused`, selective blacklist actions).

## Post-deploy acceptance checks

| Check | Command / Method | Accept criteria |
| --- | --- | --- |
| Constructor wiring | Truffle console + getters | AGI token and ENS references match approved config |
| Role setup | Event scan + role getters | Moderators and allowlists match approved roster |
| Solvency guard | `withdrawableAGI()` + locked totals | Withdrawable equals balance minus locked buckets |
| Lifecycle smoke | Execute low-value canonical job | Create → apply → complete → validate → finalize succeeds |
| Incident controls | Owner dry-run toggles in rehearsal env | `pause`/`setSettlementPaused`/blacklist controls callable by owner only |

## Related pages

- [QUICKSTART.md](./QUICKSTART.md)
- [QUINTESSENTIAL_USE_CASE.md](./QUINTESSENTIAL_USE_CASE.md)
- [OPERATIONS/RUNBOOK.md](./OPERATIONS/RUNBOOK.md)
- [OPERATIONS/INCIDENT_RESPONSE.md](./OPERATIONS/INCIDENT_RESPONSE.md)
