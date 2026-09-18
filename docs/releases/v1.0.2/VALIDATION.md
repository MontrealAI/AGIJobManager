# v1.0.2 validation

Frozen application source: `dc1f5dc85cd83adf1cb2a28caef257f6aeca9864`. Its tree is recorded in `release.json`. Publication preparation changes only release evidence, tooling and the release workflow. All five source workflows, all required jobs and the exact source marker in every job log must pass before publication.

## Local execution

| Check | Result |
| --- | --- |
| Contract build, artifact export and bytecode guard | Passed; qualified compiler profile retained; manager runtime 24,359 bytes |
| Contract and console regressions | 532 passed |
| Deployment/preflight/readiness/verifier/setup tests | 106 passed |
| Actual local deployment and EVM limit tests | 10 passed |
| UI unit tests | 178 passed across 20 files |
| Standalone console checks | 35 passed |
| Mainnet legacy/ENS cutover | 23 passed on a local fork; committed report regenerated from execution |
| Documentation | Generated references, relative links, ENS documentation and deployment environment coverage passed |
| Static UI distribution | Build completed and committed artifacts regenerated |
| Release gates and packaging | Offline publication tests required; two independent packages must match byte-for-byte |

Local runs use disposable EVMs or mocks and send no public-chain transactions. Browser, Foundry, Slither, dependency-audit and native-USDC fork qualification is required from the exact-source CI workflows. Local tests do not substitute for real signer or production-instance checks.

## Focused operator coverage

- Setup creates files with private POSIX permissions and preserves reviewed contents on repeat runs.
- Existing and dangling destination symlinks are never followed or replaced.
- Environment loading preserves shell precedence, tolerates a missing file and rejects an unreadable file.
- The shared profile validator rejects wrong-chain USDC, missing owners, dependency owners and duplicate recipients.
- The offline CLI succeeds from both documented working directories with an unusable RPC and deliberately unusable signing value, without exposing either; invalid mainnet confirmations fail.
- Existing deployment, failed-receipt, explorer verification, recovery, readiness and ENS namespace checks remain required.
- Documentation CI rejects missing example entries for deployment-script settings or missing reference documentation for example settings.

## Source-bound CI

| Workflow | Pinned run |
| --- | --- |
| CI, all four contract shards | [35370437887](https://github.com/MontrealAI/AGIJobManager/actions/runs/35370437887) |
| Security Verification | [35370437834](https://github.com/MontrealAI/AGIJobManager/actions/runs/35370437834) |
| UI CI | [35370437819](https://github.com/MontrealAI/AGIJobManager/actions/runs/35370437819) |
| Mainnet USDC Fork Qualification | [35370437864](https://github.com/MontrealAI/AGIJobManager/actions/runs/35370437864) |
| Docs Integrity | [35370437935](https://github.com/MontrealAI/AGIJobManager/actions/runs/35370437935) |

The publisher retrieves these runs and checks successful conclusions, required job names and exact checkout markers. A later green run on another commit cannot qualify this source.

## Preservation

Production Solidity, the ABI and economics are unchanged. Parsed lockfile comparison confirmed version-metadata-only changes with identical dependency resolutions. The static-analysis review changes only the root lockfile fingerprint; its production/configuration hashes and every reviewed finding/disposition remain unchanged. CI reruns analysis against the complete reviewed set.

The cutover report was regenerated after execution. Source bindings now include the environment-loader dependency and the updated configuration, fixture and package files. Its pinned chain observations, legacy inventory, identity checks and all 23 outcomes remain unchanged. The historical test root is not presented as a new deployment namespace.

Packaging verifies source ancestry/tree, the complete change inventory, all evidence digests and protected production/historical paths. Earlier published assets and records are preserved. The release is created as a draft, all four uploaded assets are checked by size and SHA-256, and only then is the release published as latest.

Independent audit, real-user acceptance, actual owner/recipient control, reviewed collections, ENS parent authority and paid-intake readiness remain separate instance-specific evidence. No public-chain transaction or deployment approval is claimed by publication.
