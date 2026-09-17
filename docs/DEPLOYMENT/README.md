# Deployment Documentation Index

> v0.9.0 uses immutable six-decimal USDC and requires a fresh deployment. Read the [USDC migration guide](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.0/docs/USDC_MIGRATION.md) before following operational examples. Historical receipts are not USDC deployments.

## Start here by deployment task
- Fresh deployment (official path): [../../hardhat/README.md](../../hardhat/README.md)
- ENSJobPages replacement/cutover: [./ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](./ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)
- Owner web-only deployment/operations: [./OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md](./OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md)

## Canonical answers for operators
- Recommended deployment path: **Hardhat**.
- Truffle status: **local tests and historical reproduction only**. Public-network signing is disabled in v0.9.0; use Hardhat and the [owner console](../OWNER_CONTROLS.md).
- ENS replacement is additive and requires manual post-deploy wiring.
- Do not lock ENS/identity configuration until cutover + migration checks pass.

## 1) Hardhat (recommended / official)

- [Hardhat Operator Guide](../../hardhat/README.md)
- [ENSJobPages Mainnet Replacement Runbook](./ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)
- [Ethereum Mainnet Beta Deployment Record](./MAINNET_BETA_DEPLOYMENT_RECORD.md)
- [Official Mainnet Deployment Record](./MAINNET_OFFICIAL_DEPLOYMENT_RECORD.md)

## 2) Truffle (historical reference only)

- [Ethereum Mainnet Deployment, Verification & Ownership Transfer Guide (Truffle)](./MAINNET_TRUFFLE_DEPLOYMENT.md)
- [Truffle Mainnet Deploy](./TRUFFLE_MAINNET_DEPLOY.md)
- [Truffle Production Deploy](./TRUFFLE_PRODUCTION_DEPLOY.md)

> Public-network commands in these historical guides are retired. Use the Hardhat guide above for v0.9.0 and later.

## UI boundary during deployment operations

- Standalone HTML UI artifacts are additive client surfaces, not deployment authority.
- If you are using the versioned standalone USDC console for operational review, pair it with:
  - `../ui/GENESIS_JOB_MAINNET_HTML_UI.md`
  - `../../ui/README.md`
- For deployment/cutover decisions, this index and `../../hardhat/README.md` remain canonical.
