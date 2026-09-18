# Dependency security — v0.9.7

v0.9.1 removed the discontinued Truffle/Ganache/OpenZeppelin test-helper dependency tree and migrated deployment and local EVM testing to Hardhat 3 with ethers 6. The complete root and Hardhat dependency audits report **zero known advisories at every severity** on 2026-09-17. UI qualification separately audits its complete dependency tree. Consult the immutable release validation record for final clean-install results, runtime versions and the source commit.

## Required checks

CI runs full audits, including development dependencies, with `--audit-level=low` in every workspace. Any low, moderate, high or critical advisory fails qualification. Production-only audits may supplement this check; they cannot replace it.

```bash
npm ci
npm --prefix hardhat ci
npm --prefix ui ci
npm audit --audit-level=low
npm --prefix hardhat audit --audit-level=low
npm --prefix ui audit --audit-level=low
```

Use the committed lockfiles and Node version pinned in CI. Audit results depend on the current advisory database and dependency tree. Repeat them before deployment and requalify dependency changes. Zero known advisories does not establish the absence of undiscovered vulnerabilities.

## Removed vulnerable toolchains

- Truffle, Ganache, Web3 1 and old OpenZeppelin test helpers are removed. Existing Solidity regression scenarios execute on a real local Hardhat EVM through a small ethers compatibility layer. The runner rejects exclusive, skipped and empty suites and checks that all collected cases execute. Negative tests verify revert reasons, custom errors and event emitter identity.
- Hardhat 2 and its ethers 5 dependency chain are removed. The otherwise-current explorer verification plugin also retained an unpatched elliptic dependency, so deployment now uses a source-bound Etherscan API v2 verifier with fail-closed response handling. The verifier receives source and an explorer API key; it never receives the deployer's private key.
- Scoped overrides replace vulnerable utility versions used by the maintained toolchain. Compilation, deployment, recovery and regression qualification must pass with the resolved versions. No cryptographic package is forced to an incompatible major to disguise an advisory.
- Historical Truffle migrations fail with a retirement message. Supported public-network commands are in the [Hardhat guide](../hardhat/README.md). Local tests and demonstrations use disposable accounts only.

## Compiler and upstream compatibility

The release profile uses Solidity 0.8.37, optimizer 40 runs, `viaIR=true`, Shanghai, no metadata bytecode hash and stripped revert strings. This replaces 0.8.23 and its known version-range advisories. Deployment and regression tests qualify this exact profile.

OpenZeppelin Contracts remains pinned to 4.9.6. A checked-in install script applies exact, hash-verified identifier and assembly-annotation compatibility updates for Solidity 0.8.37. Vendored forge-std assertion parameter names receive the corresponding identifier update. Types, selectors, algorithms and control flow remain unchanged. Unknown input bytes fail the patch; compiler diagnostics stay enabled. The [compatibility note](../scripts/security/COMPILER_COMPATIBILITY.md) records upstream provenance, hashes, tests and removal criteria. Source verification uses the actual patched compiler input.

## UI dependencies and notices

The UI retains patched browser and test dependencies, including ethers 6.17.0 in the standalone operator artifact and Vitest 4.1.11. Its URI decoder adapter retains upstream source and license; see `ui/vendor/decode-uri-component/UPSTREAM.md`. Wallet compatibility and complete browser qualification govern upgrades.

An npm deprecation notice is distinct from a vulnerability advisory. Some upstream wallet SDKs and lint plugins impose compatibility constraints on major upgrades. Retained notices and their actual reachability are recorded with release evidence; they must not be described as a warning-free install. Unsupported peer overrides or log suppression are not accepted fixes.

The [static-analysis review](security/v0.9.1-static-analysis.md) separately records Solidity findings and their dispositions. Dependency scans and internal engineering reviews are not an independent security audit of the deployed system.
