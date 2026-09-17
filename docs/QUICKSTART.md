# Quickstart — v0.9.0

Choose the workflow below before running commands. A software release and passing tests do not deploy a manager or open it to deposits.

## 0) Route to the right surface first

- **Deploy or operate on Ethereum/Sepolia:** [Hardhat deployment guide](../hardhat/README.md), [deployment operations](DEPLOYMENT_OPERATIONS.md) and [owner controls](OWNER_CONTROLS.md).
- **Use the USDC console:** [standalone console](../ui/agijobmanager-usdc.html). Select the intended network and independently verified manager address before connecting a wallet. See the [UI guide](ui/README.md) for the available surfaces.
- **Rehearse locally:** [complete job walkthrough](QUINTESSENTIAL_USE_CASE.md). It uses disposable mock tokens and explains agent NFT eligibility, bonds and settlement.
- **Develop the Next.js interface:** [UI workspace guide](../ui/README.md).
- **Replace optional ENSJobPages:** [ENS replacement guide](DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md).

## 1) Install

Check out the reviewed v0.9.0 release, use Node 22.23.2 and install the committed lockfiles. From the repository root:

```bash
npm ci
npm --prefix hardhat ci
```

Root Truffle/Ganache dependencies support local tests only. Keep production keys out of this environment; use the supported Hardhat deployment workflow for public-network signing. Review the [dependency security scope](DEPENDENCY_SECURITY.md).

## 2) Compile

For the public deployment build:

```bash
npm --prefix hardhat run compile
```

For disposable local Truffle fixtures and their tests:

```bash
npm run build
```

Preserve the repository's qualified compiler profile. A size-limit failure requires investigation, not disabling Ethereum limits.

## 3) Test

Run the contract regressions and deployment checks:

```bash
npm test
npm --prefix hardhat run test:preflight
npm --prefix hardhat run test:deployment
npm --prefix hardhat run test:mainnet-fork
```

The fork test reads a pinned historical Ethereum block and executes transactions only on a local Hardhat chain. It uses actual Circle USDC state, fails if archive RPC access is unavailable, and never uses a production private key. An archive-capable endpoint can be selected with `MAINNET_FORK_RPC_URL`.

See the [test matrix](TESTING.md) and [mainnet qualification](MAINNET_READINESS.md) for fuzzing, invariants, static analysis, browser checks and the source-specific release evidence. Do not treat this quickstart subset as a substitute for the complete release gates.

## 4) Docs integrity

From the repository root:

```bash
npm run docs:gen
npm run docs:check
```

Review generated changes before committing them. Generated interface references must match the final source and release metadata.

## 5) Optional UI smoke test

```bash
node scripts/release/verify-usdc-ui.mjs
npm run test:ui
```

For UI development, install its own lockfile and follow its workspace guide:

```bash
npm --prefix ui ci
npm --prefix ui run lint
npm --prefix ui run typecheck
npm --prefix ui test
```

## 6) Prepare a public deployment

Use the [Hardhat guide](../hardhat/README.md) to prepare the selected RPC and trusted `deploy.config.js`. Supply **both** recipient wallets in 30%/10% order, canonical six-decimal USDC, the intended final owner and reviewed identity settings. Release examples are not a populated production configuration.

From `hardhat/`, this explicit dry run validates a mainnet plan without broadcasting:

```bash
DRY_RUN=1 npm run deploy:mainnet
```

Read-only planning can use `DEPLOYER_ADDRESS` without a private key. Boolean flags are validated; use the documented value `DRY_RUN=1`. Follow the guide's separate mainnet confirmation and signing steps only for an authorized deployment.

A public manager starts intake paused. Keep it paused while verifying linked code, accepting ownership, configuring participants and running the read-only readiness check against the deployment receipt. The accepted owner opens intake only after reviewing those results and the operational gates. A qualifying agent needs an enabled NFT holding as well as authorization. ETH is required for gas; jobs, bonds, rewards and refunds use USDC.

## Command catalog

| Command | Outcome | When to use | Common failures | Fix |
| --- | --- | --- | --- | --- |
| `npm ci` | Locked root dependency installation | Fresh local test checkout | Lockfile/toolchain mismatch | Use Node 22.23.2 and the committed lockfile; investigate drift |
| `npm --prefix hardhat run compile` | Qualified Hardhat deployment artifacts | Public deployment preparation | Compiler/profile/size failure | Preserve release settings and resolve the failure before deployment |
| `npm run build` | Local Truffle artifacts | Local fixtures and tests | Solidity compile error | Correct the source or fixture and rebuild |
| `npm test` | Contract and regression tests | Release/PR validation | Local toolchain drift or failing assertion | Use the pinned toolchain and inspect the failing case |
| `npm --prefix hardhat run test:mainnet-fork` | Pinned real-USDC compatibility scenarios on a local fork | Release qualification | Archive RPC unavailable or pinned-state mismatch | Supply a legitimate archive-capable RPC and investigate; do not skip the gate |
| `npx truffle migrate --network development --reset` | Disposable local deployment | Local lifecycle rehearsal only | Ganache unavailable or insufficient local accounts | Follow the ten-account walkthrough; never substitute a public network |
| `node scripts/postdeploy-config.js --network development --address <LOCAL_MANAGER>` | Local fixture configuration | Local rehearsal only | Wrong address or missing fixture config | Supply the local manager and reviewed fixture values; use the owner console for live controls |
| `DRY_RUN=1 npm run deploy:mainnet` from `hardhat/` | Read-only deployment plan | Before a separately authorized broadcast | Incomplete profile, chain mismatch or issuer restriction | Correct the plan and repeat the dry run |
| `npm run check:readiness` from `hardhat/` with `DEPLOYMENT_RECEIPT` set | Read-only pre-activation report | After verification/configuration/ownership acceptance | Receipt, code, owner, identity, pause or balance mismatch | Resolve the discrepancy against the reviewed deployment evidence |
| `npm run docs:check` | Documentation freshness and structure checks | Release/PR validation | Stale generated references or bad links | Regenerate references and review the resulting diff |
