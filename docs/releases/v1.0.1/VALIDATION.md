# v1.0.1 validation

The frozen application source is `becf9a30a59b9a6f26df06c7517047353bc91465`. `release.json` records its tree. The later publication commit changes only release evidence and tooling. All five source workflows, all their required jobs and actual checkout markers are verified before publication; see `SOURCE_CI.json`.

## Local execution

| Check | Result |
| --- | --- |
| Solidity build and artifact export | 60 files compiled; 88 artifacts; zero compiler warnings/errors |
| Contract and console regressions | 532 passed; includes the new deployment namespace preservation case |
| Deployment/preflight/readiness/verifier tests | 100 passed |
| UI unit tests | 178 passed across 20 files |
| Standalone console verification | 35 checks passed |
| Mainnet legacy/ENS cutover | 23 passed on an isolated local fork; complete generated report matches the committed fixture |
| Solidity lint and manager size | Passed; manager runtime 24,359 bytes |
| Root and UI documentation | Generated documentation, relative links and ENS checks passed |
| Distribution | Static build regenerated; publication compares two independently packaged archives byte-for-byte |

Local regression suites use disposable EVMs or mocked deployment/RPC boundaries. They do not broadcast public transactions. Browser, Foundry, Slither and fork evidence is required from the exact-source CI runs; no unexecuted local browser or external audit is claimed here.

## Focused ENS coverage

- Full manager-address uniqueness, including two addresses with identical beginnings/endings; chain separation; checksum-case normalization; invalid chain/address rejection.
- Fresh setup rejects occupied roots, retained resolvers, existing helper pointers, posted jobs and incorrect root/node/prefix/mode inputs before deployment.
- Same-manager replacement preserves the active helper's root/prefix and rejects foreign manager references, changed registries, malformed root hashes, invalid prefixes and missing root ownership.
- Failed prefix transactions or unexpected readback leave the journal failed and stop before verification, locks and ownership handoff.
- A local EVM test creates job zero for two deployment roots and verifies the original owners, resolvers and metadata of `0`, `job-0`, `agijob0`, `agijob-0` and `aijob0` under the historical root.

## Preservation and evidence bindings

All production Solidity files are byte-for-byte unchanged from v1.0.0. Package lockfile changes are limited to package version metadata; dependency resolutions are unchanged. Historical deployment records and all previous release evidence are protected by the packaging preservation check.

The cutover fixture's four package manifest/lockfile fingerprints were refreshed for v1.0.1. Its recorded chain observations, identity evidence, namespace fixture and assertions were left unchanged. Exact-source CI must execute the full fork scenario again and compare the complete generated report with this fixture. The historical fork root remains `usdc-v095.alpha.jobs.agi.eth`; it is not presented as the new fresh-deployment naming rule.

The Slither review's root package-lock fingerprint was refreshed only after comparing parsed lockfiles and confirming that dependency versions/resolutions were identical. Production/configuration hashes and every finding/disposition were preserved. CI reruns the analyzer and requires the full reports to match the reviewed set. Existing findings are not eliminated or suppressed by the ENS tooling change.

## Publication gates

The release tests cover missing/failed/wrong-source jobs and log markers, unexpected source changes, existing published releases, immutable tag targets, mismatched assets and upload recovery. Packaging checks source ancestry and tree identity, the complete change inventory, protected historical paths and content digests. Publication creates a draft, uploads and verifies all four assets, then publishes it as the latest release.

The software edition is not a live deployment qualification. ENS parent authority, actual signers, real settlement recipients, working review/arbitration and production monitoring remain instance-specific. The unchanged contracts allow owner administration until locked; the new namespace policy is a deployment-tooling safeguard and must also be followed during manual operations.
