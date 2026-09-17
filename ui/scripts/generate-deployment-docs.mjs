import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('../config/usdc-deployment.json', 'utf8'));
fs.writeFileSync('../docs/ui/DEPLOYMENT_MAINNET.md', `# USDC deployment registry

## Official release

AGIJobManager v${c.version}. Status: **${c.status}**.

${c.note}

- Chain ID: ${c.chainId}
- Manager: ${c.managerAddress || 'Not deployed'}
- USDC: ${c.usdc.address}
- Decimals: ${c.usdc.decimals}
- Address reference: ${c.addressSource}

## Constructor arguments

Use the maintained Hardhat 3 deployment workflow in hardhat/ and the immutable canonical USDC address. Follow docs/MAINNET_READINESS.md and docs/DEPLOY_RUNBOOK.md, including the explicit settlement wallets and ownership acceptance. All monetary arguments use six decimal base units. A fresh deployment and explicit owner/identity configuration are required; legacy snapshots are incompatible.

## Verification

Compile with pinned solc 0.8.37 and the repository settings in hardhat/hardhat.config.js (via IR, optimizer 40 runs, Shanghai target). Verify the exact source and linked libraries, constructor arguments, chain ID, owner, USDC address and decimals before configuring any UI. Record the actual deployment receipt and update config/usdc-deployment.json only after verification. This software release does not assert a live USDC deployment.
`);
