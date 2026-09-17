# Dependency security scope — v0.9.0

Validated on 2026-09-17 with Node 22.23.2, npm 10.9.8 and the committed npm lockfiles. Audit results describe known registry advisories at that time; they are not an independent contract audit or a guarantee of safety.

| Workspace | Scope and result | Use |
| --- | --- | --- |
| `ui/` | `npm audit --omit=dev`: zero known findings | Browser application and its server build |
| `ui/` | Full `npm audit`: zero known findings, including development tools | UI tests, lint and build tools |
| `hardhat/` | Full audit: no moderate, high or critical findings; 14 low findings | Supported public-network deployment and verification |
| Repository root | Production dependencies: zero known findings | OpenZeppelin contracts 4.9.6 |
| Repository root | Local full-audit snapshot: 100 findings (17 low, 51 moderate, 22 high, 10 critical) | Legacy local Truffle/Ganache regression tests only |
| Repository root | Clean-install CI snapshot: 120 findings (17 low, 55 moderate, 34 high, 14 critical) | The same legacy local test scope; see the installation-tree qualification below |

The UI uses Next 15.5.24, updated wallet libraries, patched WebSocket/PostCSS/UUID dependencies and the upstream patched URI decoder. The decoder's small CommonJS adapter preserves upstream source and license; provenance and removal criteria are recorded in `ui/vendor/decode-uri-component/UPSTREAM.md`. Regression tests exercise malformed URI handling and module compatibility. The Base Account connector uses its published browser entry; server-only payment APIs are outside this wallet UI.

v0.9.0 also closes the UI development-tool gap: the previous full UI audit contained 15 findings, including one critical and seven high findings, despite a clean production audit. Vitest is now pinned to 4.1.11 with Vite 7.3.6 and Node 22 type definitions 22.20.3. Compatible development-only transitive packages were refreshed within their supported dependency ranges. No production dependency version changed in this remediation. The maintained Vitest release fixes the [UI/API file-execution vulnerability](https://github.com/vitest-dev/vitest/security/advisories/GHSA-5xrq-8626-4rwp) and [redirect-mock path traversal](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9); the latter is not backported to Vitest 2 or 3.

Hardhat uses ethers 6.17.0 and patched overrides for its supported dependency APIs. The operator HTML vendors ethers 6.17.0; the primary console pins Web3 4.16.0 with a subresource integrity digest. CI now checks the **complete UI audit**, root production audit and complete Hardhat audit at the high severity threshold, compiles and tests the deployment workspace, and runs the actual-USDC local mainnet fork. Foundry 1.7.1, Slither 0.11.6 and CI actions are pinned for qualification. The [v0.9.0 static-analysis review](security/v0.9.0-static-analysis.md) documents expanded detector coverage and retained findings.

## Legacy development tools

Truffle, Ganache and some test helpers are discontinued or carry unresolved upstream advisories. Blindly forcing their cryptographic dependencies to incompatible major versions is not a reliable fix. The supported branch removes `@truffle/hdwallet-provider` and disables mainnet/Sepolia signing in `truffle-config.js`. Use Hardhat for public-network deployment and the v0.9.0 owner console for live administration.

Use an isolated local environment with disposable test accounts for the root test suite. Do not provide production keys to Truffle, expose its development RPC publicly, or process untrusted archives with this legacy toolchain. Migration of the remaining tests away from Truffle is future maintenance work. These tools are not included in deployed Solidity bytecode or installed in the browser bundle.

Lockfiles and CI keep updates reviewable. Audit counts can vary with npm's installed/bundled dependency tree and the advisory database. Repeat production and full audits separately before each production deployment; never interpret the clean production scopes as a clean legacy test-tool tree. Qualify updates through the contract, UI and security suites.
