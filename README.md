# AGIJobManager

[![CI](https://github.com/MontrealAI/AGIJobManager/actions/workflows/ci.yml/badge.svg)](https://github.com/MontrealAI/AGIJobManager/actions/workflows/ci.yml)

AGIJobManager is a single-contract system for managing employer/agent jobs, validation, reputation, and NFT issuance on Ethereum-compatible networks.

## Table of contents
- [Overview](#overview)
- [Features](#features)
- [Project layout](#project-layout)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Scripts](#scripts)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Security](#security)
- [License](#license)

## Overview
AGIJobManager coordinates job postings, agent assignments, validation, and dispute resolution with on-chain reputation tracking and ERC-721 issuance for completed work. The contract integrates with ERC-20 payments, ENS ownership verification, and Merkle roots for validator/agent allowlists.

## Features
- Job lifecycle management: creation, assignment, completion requests, validation, disputes, and resolution.
- Reputation tracking with configurable thresholds and limits.
- ERC-20 payouts for jobs and validation rewards.
- ERC-721 NFT issuance and secondary listing for job artifacts.
- ENS-based identity checks and Merkle-root allowlists for validators/agents.

## Project layout
- `contracts/` — Solidity contracts (primary logic in `AGIJobManager.sol`).
- `migrations/` — Truffle deployment scripts.
- `test/` — JavaScript tests.
- `truffle-config.js` — Network and compiler configuration.

## Requirements
- Node.js 18+ (recommended for current dependency versions).
- npm 9+.
- Truffle and Ganache are installed via `devDependencies`.

## Quick start
```bash
npm install
npm run build
npm test
```

## Scripts
- `npm run build` — Compile the contracts with Truffle.
- `npm run lint` — Lint Solidity sources with Solhint.
- `npm test` — Run the test suite.
- `docs/REGRESSION_TESTS.md` — Better-only regression coverage comparing current vs original contract behavior.

## Configuration
Truffle networks and compiler settings are configured in `truffle-config.js`. The following environment variables are used for deployments and verification:

- `PRIVATE_KEYS` — Comma-separated private keys for deployments.
- `INFURA_KEY` — Infura project key for mainnet/sepolia.
- `ALCHEMY_KEY` — Alchemy key for Sepolia.
- `ALCHEMY_KEY_MAIN` — Alchemy key for mainnet.
- `MAINNET_RPC_URL` / `SEPOLIA_RPC_URL` — Override RPC URLs directly.
- `MAINNET_GAS`, `SEPOLIA_GAS` — Gas limits.
- `MAINNET_GAS_PRICE_GWEI`, `SEPOLIA_GAS_PRICE_GWEI` — Gas price in gwei.
- `MAINNET_CONFIRMATIONS`, `SEPOLIA_CONFIRMATIONS` — Required confirmations.
- `MAINNET_TIMEOUT_BLOCKS`, `SEPOLIA_TIMEOUT_BLOCKS` — Deployment timeouts.
- `RPC_POLLING_INTERVAL_MS` — Provider polling interval.
- `SOLC_VERSION` — Solidity compiler version.
- `SOLC_RUNS` — Optimizer runs.
- `SOLC_VIA_IR` — Set to `true` to enable viaIR.
- `SOLC_EVM_VERSION` — EVM version string.
- `ETHERSCAN_API_KEY` — Verification API key.

Use a `.env` file to store sensitive values locally.

## Deployment
Run migrations via Truffle for the intended network:

```bash
npx truffle migrate --network sepolia
```

Replace `sepolia` with `mainnet` or `development` as needed. Ensure the environment variables above are set for the selected network.

## Security
This repository is experimental. Review the contract code and run your own audits before deploying to production networks. Never commit private keys or secrets to version control.

## License
[MIT](LICENSE)
