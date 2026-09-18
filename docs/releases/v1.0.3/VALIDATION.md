# v1.0.3 validation

Frozen application source: `78401f82dda2f26cc17c631d91dd1b53e2477ee3`. Its tree is recorded in `release.json`. Publication preparation changes only release evidence, tooling and the release workflow. All five source workflows, every required job and the exact source marker in each job log must pass before publication.

## Local execution

| Check | Result |
| --- | --- |
| Contract build, artifact export, lint and bytecode guard | Passed; qualified compiler profile retained; manager runtime 24,359 bytes |
| Contract and console regressions | 533 passed |
| Deployment/preflight/readiness/verifier/setup tests | 106 passed |
| Actual local deployment and EVM limits | 10 passed; standard manager initcode 27,551 bytes, deployment gas 5,973,040 in the local fixture |
| UI unit tests | 178 passed across 20 files |
| Standalone console checks | 35 passed |
| Mainnet legacy/ENS cutover | 23 passed on a local fork; source-bound committed report regenerated |
| Native Circle USDC fork | 8 passed |
| Historical Genesis rehearsal | 24 local scenarios passed; verifies the disabled default before explicitly enabling the NFT gate |
| Slither review gate regressions | 11 passed; analyzer execution remains a separate required CI gate |
| Documentation and UI distribution | Generated references, links, ENS/environment coverage, UI docs and static build passed |
| Release qualification tests | 35 passed |
| Reproducible packaging | Two independent packages matched byte-for-byte, including all asset digests; publication repeats this check |

Local runs use disposable EVMs, local forks or mocks and send no public-chain transactions. Browser, Foundry, Slither and dependency-audit qualification additionally runs in the exact-source workflows. Local fixture gas is not a live mainnet gas quote.

## Focused change review

The production Solidity diff changes only `agentNftRequired` from `true` to `false` and its NatSpec comment. The ABI and deployed runtime match the v1.0.2 artifact; creation bytecode changes. Storage ordering/types, library sources, ENS naming and settlement code are unchanged. Parsed lockfile comparison confirms version-metadata-only changes with identical dependency resolutions.

The regression suite verifies a full job without an eligibility NFT or registered collection, completion receipt minting, continued authorization and bond checks, owner-only opt-in, repeated policy toggles, immutable job snapshots, collection guards and identical payments in both modes. Required-mode fixtures, including the historical Genesis rehearsal, explicitly enable admission and retain existing negative tests. Deployment tests check the disabled initial state and receipt and reject an unexpected enabled state. Setup tests verify the generated policy while preserving reviewed files. Readiness continues accepting reviewed optional/empty policies and rejecting required/empty policies.

The cutover fixture verifies disabled construction before explicitly enabling NFT admission for its existing required-mode scenarios. It also qualifies both job policies, ownership/pause transitions, native-USDC settlement and legacy preservation. See `source/docs/qualification/V103_NFT_DEFAULT.md` for the scoped internal review.

The static-analysis baseline updates the manager fingerprint for this scoped change and the root lockfile fingerprint for version metadata. All finding identities, dispositions, compiler/dependency-patch hashes and detector settings are retained. CI must reproduce the entire reviewed finding set; unexpected or missing findings fail the gate.

## Exact-source CI

| Workflow | Pinned run |
| --- | --- |
| CI, all four contract shards | [35375295562](https://github.com/MontrealAI/AGIJobManager/actions/runs/35375295562) |
| Security Verification | [35375295614](https://github.com/MontrealAI/AGIJobManager/actions/runs/35375295614) |
| UI CI | [35375295510](https://github.com/MontrealAI/AGIJobManager/actions/runs/35375295510) |
| Mainnet USDC Fork Qualification | [35375295504](https://github.com/MontrealAI/AGIJobManager/actions/runs/35375295504) |
| Docs Integrity | [35375295515](https://github.com/MontrealAI/AGIJobManager/actions/runs/35375295515) |

The publisher checks successful conclusions, exact required job names and the checkout source marker in every actual job log. Runs on another source commit cannot qualify this release.

## Publication and preservation

Packaging verifies source ancestry/tree, the complete change inventory, evidence digests and protected paths. The authorized manager initializer change is explicitly outside the unchanged-path guard; every other contract directory, deployment record and prior release folder remains protected. Earlier published assets are preserved.

The publisher creates an annotated tag at the frozen source and a draft release, uploads four assets, verifies every uploaded size and SHA-256 digest, then publishes as latest. It does not replace an already published release or move an existing tag.

Software publication does not change an existing manager's state, submit an owner-policy transaction or deploy to mainnet. Independent audit, actual signer/recipient control, ENS authority and live-instance readiness remain separate evidence.
