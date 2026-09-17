# Quickstart — v0.9.1

Choose the workflow below before running commands. A software release and passing tests do not deploy a manager or open it to deposits.

## 0) Route to the right surface first

- **Deploy or operate on Ethereum/Sepolia:** [Hardhat deployment guide](../hardhat/README.md), [deployment operations](DEPLOYMENT_OPERATIONS.md) and [owner controls](OWNER_CONTROLS.md).
- **Use the USDC console:** [standalone console](../ui/agijobmanager-usdc.html). Select the intended network and independently verified manager address before connecting a wallet. See the [UI guide](ui/README.md) for the available surfaces.
- **Rehearse locally:** [complete job walkthrough](QUINTESSENTIAL_USE_CASE.md). It uses disposable mock tokens and explains agent NFT eligibility, bonds and settlement.
- **Develop the Next.js interface:** [UI workspace guide](../ui/README.md).
- **Replace optional ENSJobPages:** [ENS replacement guide](DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md).

## 1) Install

Check out the reviewed v0.9.1 release, use Node 22.23.2 and install the committed lockfiles. From the repository root:

```bash
npm ci
npm --prefix hardhat ci
```

Local regression tests use Hardhat 3's disposable EDR chain and ethers-backed compatibility helpers. Truffle/Ganache dependencies have been removed. Use the supported Hardhat deployment workflow for public-network signing and review the [dependency security scope](DEPENDENCY_SECURITY.md).

Audit both installed dependency trees, including development packages:

```bash
npm audit --audit-level=low
npm --prefix hardhat audit --audit-level=low
```

## 2) Compile

For the public deployment build:

```bash
npm --prefix hardhat run compile
```

To compile and export the artifacts used by the local JavaScript regression suites:

```bash
npm run build
```

Preserve the compiler, optimizer and EVM profile in [Hardhat configuration](../hardhat/hardhat.config.js) and [Foundry configuration](../foundry.toml). A size-limit failure requires investigation, not disabling Ethereum limits. Final runtime size and compiler identity are recorded in the release validation evidence.

## 3) Test

Run the contract regressions and deployment checks:

```bash
npm test
npm run size
FOUNDRY_PROFILE=ci forge build --deny warnings
FOUNDRY_PROFILE=ci forge test
npm --prefix hardhat run test:preflight
npm --prefix hardhat run test:deployment
npm --prefix hardhat run test:mainnet-fork
```

Install the Foundry version pinned in the [security workflow](../.github/workflows/security-verification.yml) before the Forge commands. `--deny warnings` rejects new compiler and Forge lint diagnostics; reviewed fixture/test annotations remain explicitly scoped.

The fork test reads a pinned historical Ethereum block and executes transactions only on a local Hardhat chain. It uses actual Circle USDC state, fails if archive RPC access is unavailable, and never uses a production private key. An archive-capable endpoint can be selected with `MAINNET_FORK_RPC_URL`.

See the [test matrix](TESTING.md) and [mainnet qualification](MAINNET_READINESS.md) for fuzzing, invariants, static analysis, browser checks and the source-specific release evidence. Do not treat this quickstart subset as a substitute for the complete release gates.

## 4) Docs integrity

From the repository root:

```bash
npm run docs:gen
npm run docs:check
```

Review generated changes before committing them. Generated interface references must match the final source and release metadata.

## 5) UI checks

```bash
node scripts/release/verify-usdc-ui.mjs
npm run test:ui
```

For UI development, install its own lockfile and follow its workspace guide:

```bash
npm --prefix ui ci
npm --prefix ui audit --audit-level=low
npm --prefix ui run lint
npm --prefix ui run typecheck
npm --prefix ui test
```

Release qualification audits all three complete dependency trees at the low threshold and requires the full UI browser/accessibility/header/build gates. Do not omit development dependencies or interpret this quickstart subset as complete release qualification.

## 6) Prepare a public deployment

Use the [Hardhat guide](../hardhat/README.md) to prepare the selected RPC and trusted `deploy.config.cjs`. Supply **both** recipient wallets in 30%/10% order, canonical six-decimal USDC, the intended final owner and reviewed identity settings. Release examples are not a populated production configuration.

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
| `npm run build` | Hardhat artifacts exported for the JavaScript regression runner | Local fixtures and tests | Solidity compile error | Correct the source or fixture and rebuild |
| `npm test` | Contract and regression tests | Release/PR validation | Local toolchain drift or failing assertion | Use the pinned toolchain and inspect the failing case |
| `npm --prefix hardhat run test:mainnet-fork` | Pinned real-USDC compatibility scenarios on a local fork | Release qualification | Archive RPC unavailable or pinned-state mismatch | Supply a legitimate archive-capable RPC and investigate; do not skip the gate |
| `FOUNDRY_PROFILE=ci forge build --deny warnings` | Strict compiler and Forge lint gate | Release/PR validation | New diagnostic or mismatched compiler profile | Resolve the finding or document a justified line-specific exception; retain the strict gate |
| `npm audit --audit-level=low` in root, `hardhat/` and `ui/` | Full dependency security checks | After locked installs and before qualification | Advisory or audit service failure | Resolve the dependency or retry a failed evidence read; keep the low threshold |
| `DRY_RUN=1 npm run deploy:mainnet` from `hardhat/` | Read-only deployment plan | Before a separately authorized broadcast | Incomplete profile, chain mismatch or issuer restriction | Correct the plan and repeat the dry run |
| `npm run check:readiness` from `hardhat/` with `DEPLOYMENT_RECEIPT` set | Read-only pre-activation report | After verification/configuration/ownership acceptance | Receipt, code, owner, identity, pause or balance mismatch | Resolve the discrepancy against the reviewed deployment evidence |
| `npm run docs:check` | Documentation freshness and structure checks | Release/PR validation | Stale generated references or bad links | Regenerate references and review the resulting diff |
