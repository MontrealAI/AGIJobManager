# Deployment guide — v0.9.5

The supported Ethereum mainnet and Sepolia workflow uses **Hardhat 3 and ethers 6**. Truffle and Ganache are removed; their historical migration and signing commands are retired.

Start with the [Hardhat deployment guide](../hardhat/README.md). It covers executable configuration, keyless dry runs, exact compiler inputs, library linking, source verification, transaction journals, recovery, ownership acceptance and read-only instance checks.

## Install and qualify

From the repository root, using Node 22.23.2 and the committed lockfiles:

```bash
npm ci
npm --prefix hardhat ci
npm run build
npm run lint
npm test
npm --prefix hardhat run test:preflight
npm --prefix hardhat run test:deployment
```

The qualified compiler is Solidity 0.8.37, optimizer 40 runs, `viaIR=true`, Shanghai, no metadata bytecode hash and stripped revert strings. Preserve the profile and the hash-verified [dependency compatibility patches](../scripts/security/COMPILER_COMPATIBILITY.md). Any source or compiler change requires renewed qualification.

## Mainnet limits

| Check | Limit | What is measured |
| --- | ---: | --- |
| EIP-170 | 24,576 bytes | Deployed runtime code |
| EIP-3860 | 49,152 bytes | Creation bytecode plus actual constructor arguments |
| EIP-7825 | 16,777,216 gas | Transaction gas limit, not only eventual gas used |

The manager, eight linked libraries and optional metadata contracts must satisfy their applicable limits. Use `npm run size` and the deployment tests; actual deployment plans also validate constructor data and requested gas.

## Rehearse and deploy

The [local USDC walkthrough](QUINTESSENTIAL_USE_CASE.md) uses only disposable in-memory accounts. A [mainnet fork](MAINNET_READINESS.md) reads pinned historical USDC state and executes locally. Neither substitutes for a Sepolia rehearsal with the intended owner and signing arrangement.

For public networks, copy `hardhat/deploy.config.example.cjs` to `hardhat/deploy.config.cjs`, supply both real settlement recipients and the intended owner, and follow the Hardhat guide's explicit dry-run and broadcast gates. The manager starts paused. Preserve its deployment receipt, complete source verification and two-step ownership acceptance, and pass read-only readiness before opening intake.

Code is non-upgradeable. This release does not deploy, activate or modify an existing contract. Existing instances require a deliberate migration to receive the new code protections.
