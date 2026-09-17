# Dependency security scope — v0.7.0

Validated on 2026-09-17 with Node 22.23.2 and the committed npm lockfiles. Audit results describe known registry advisories at that time; they are not an independent contract audit or a guarantee of safety.

| Workspace | Scope and result | Use |
| --- | --- | --- |
| `ui/` | `npm audit --omit=dev`: zero known findings | Browser application and its server build |
| `hardhat/` | Full audit: no moderate, high or critical findings; 14 low findings | Supported public-network deployment and verification |
| Repository root | Production dependencies: zero known findings | OpenZeppelin contracts 4.9.6 |
| Repository root | Legacy development tree retains advisories, including high and critical findings | Local Truffle/Ganache regression tests only |

The UI uses Next 15.5.24, updated wallet libraries, patched WebSocket/PostCSS/UUID dependencies and the upstream patched URI decoder. The decoder's small CommonJS adapter preserves upstream source and license; provenance and removal criteria are recorded in `ui/vendor/decode-uri-component/UPSTREAM.md`. Regression tests exercise malformed URI handling and module compatibility. The Base Account connector uses its published browser entry; server-only payment APIs are outside this wallet UI.

Hardhat uses ethers 6.17.0 and patched overrides for its supported dependency APIs. The operator HTML vendors ethers 6.17.0; the primary console pins Web3 4.16.0 with a subresource integrity digest. CI checks the UI production audit, root production audit and complete Hardhat audit at the high severity threshold, and compiles the deployment workspace.

## Legacy development tools

Truffle, Ganache and some test helpers are discontinued or carry unresolved upstream advisories. Blindly forcing their cryptographic dependencies to incompatible major versions is not a reliable fix. v0.7.0 removes `@truffle/hdwallet-provider` and disables mainnet/Sepolia signing in `truffle-config.js`. Use Hardhat for public-network deployment and the v0.7.0 owner console for live administration.

Use an isolated local environment with disposable test accounts for the root test suite. Do not provide production keys to Truffle, expose its development RPC publicly, or process untrusted archives with this legacy toolchain. Migration of the remaining tests away from Truffle is future maintenance work. These tools are not included in deployed Solidity bytecode or installed in the browser bundle.

Lockfiles and CI keep updates reviewable. Dependency audit databases change; repeat the workspace audits before each production deployment and qualify updates through the contract, UI and security suites.
