# Runtime-bytecode preflight requalification — 2026-10-16

This record completes the current-source fork and preservation checks for the runtime-bytecode validation correction in PR #1585. It does not qualify the separately supplied explicit-governor/operator candidate, authorize deployment, or approve activation.

The reviewed three-file correction is based on released source `6484d09afbba64d7de24cd18ae4dbd246caffd17`, with reviewed code at `06add2a669f3ed1eb03019ab95cad1cb2095a2c8`. The source inventory records exact before/after hashes for `deploy.cjs`, `deployment-safety.cjs` and the two added preflight regressions in `deployment-preflight.test.cjs`. There are no Solidity, constructor, library-link, economic, compiler or dependency changes.

The existing Mainnet fork gate correctly rejected the stale expected source fingerprint after the correction. The actual 23-case cutover suite was then rerun locally against patched source, using the in-process Hardhat fork at Ethereum block **25,998,952**, hash `0xac9075441aff899351bf4ca9abf5be0edc4494b69a1c7543b389fd8cacaa159a`.

```sh
MAINNET_FORK_RPC_URL=https://eth-mainnet.g.alchemy.com/public \
CUTOVER_REPORT=/absolute/private-output/manager-cutover-patched.json \
npm --prefix hardhat run test:cutover
```

Result: **23 passing**, zero public transactions, activation unapproved. The generated JSON was copied byte for byte to the existing mutable current-expectation path, [mainnet-cutover-next-deployment.json](mainnet-cutover-next-deployment.json), SHA-256 `21ff73a2bcecd561e441c90a93d2c1e7befcfc5072ae3b363687ef5908f8e9a7`. Its only change from the previous expected report is the `hardhat/scripts/deployment-safety.cjs` source fingerprint:

- Previous: `fa739a2460544328553236a5e7223c74d1e3ac28af6d5f3620e8ae173f4cca27`
- Reviewed: `35957661a7f4e749368e64f77bbcfff2bfef3ac4eebdf80c37679fada2fb41ea`

All observed outcomes, pin, assertion names, accounting, eligibility evidence, fixture declarations and false activation/public-transaction flags are identical. This is an executed source-bound report, not a hash-only relabelling. The fork includes the pre-existing historical-compatibility expiry fixture solely on its disposable local chain. No old Mainnet deployment was changed or authorized for change.

Before updating the mutable current paths, the exact released expected report and source inventory were retained as new historical copies:

| Preserved bytes from v1.18.0 source | SHA-256 |
|---|---|
| [Expected fork report](history/expected-mainnet-cutover-v1.18.0.json) | `36bc8cfb2d3d8e15b04372ea1fbed3fe407a921c0d70b525d673be4447f63746` |
| [Next-deployment source inventory](history/next-deployment-contract-changes-v1.18.0.json) | `93f50d12f034ab8bdf6f951c48f71c3dd010fa82ab485d2d9f61c21f97d587d5` |

[The new qualification inventory](../../config/runtime-bytecode-qualification-20261016.json) binds the preserved files, exact three reviewed source changes and actual new report. The existing cumulative source inventory updates only the readiness/runtime evidence-input transition and rationale. Historical release files, earlier fork/Slither records, tags and assets retain their original bytes.

The existing workflow continues to compare the complete regenerated JSON with the complete current expected file. Preservation checks still verify every current source fingerprint, complete prior observations and historical protected files. An additional regression asserts the exact three-file review inventory, unchanged historical copies, zero activation/public transactions and exactly one changed fork input. No broad exclusion or relaxed source boundary was introduced.

Local validation: 23 cutover cases passed; 4 preservation tests passed; static Pages build/check and compiler/dependency/contract boundary checks passed. The same correction previously passed 587 Node tooling cases, 11 real local-EVM deployment cases and 11 native-USDC mainnet-fork cases. Exact final remote-head CI remains required before any merge or release.

This is internal functional engineering evidence. Real hardware signing, delegated creator qualification, new deployment/source verification and complete authority closeout remain separate.
