# Deployment Documentation Index

## Start here by deployment task
- Fresh deployment (official path): [../../hardhat/README.md](../../hardhat/README.md)
- ENSJobPages replacement/cutover: [./ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](./ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)
- Owner web-only deployment/operations: [./OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md](./OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md)

## Canonical answers for operators
- Recommended deployment path: **Hardhat**.
- Truffle status: **legacy/supported** for backward compatibility.
- ENS replacement is additive and requires manual post-deploy wiring.
- Do not lock ENS/identity configuration until cutover + migration checks pass.

## 1) Hardhat (recommended / official)

- [Hardhat Operator Guide](../../hardhat/README.md)
- [ENSJobPages Mainnet Replacement Runbook](./ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)
- [Ethereum Mainnet Beta Deployment Record](./MAINNET_BETA_DEPLOYMENT_RECORD.md)
- [Official Mainnet Deployment Record](./MAINNET_OFFICIAL_DEPLOYMENT_RECORD.md)

## 2) Truffle (legacy / supported)

- [Ethereum Mainnet Deployment, Verification & Ownership Transfer Guide (Truffle)](./MAINNET_TRUFFLE_DEPLOYMENT.md)
- [Truffle Mainnet Deploy](./TRUFFLE_MAINNET_DEPLOY.md)
- [Truffle Production Deploy](./TRUFFLE_PRODUCTION_DEPLOY.md)

> Truffle migrations remain supported for backward compatibility and historical reproducibility.

## UI boundary during deployment operations

- Standalone HTML UI artifacts are additive client surfaces, not deployment authority.
- If you are using the standalone `v21` page for operational review, pair it with:
  - `../ui/GENESIS_JOB_MAINNET_HTML_UI.md`
  - `../../ui/README.md`
- For deployment/cutover decisions, this index and `../../hardhat/README.md` remain canonical.

