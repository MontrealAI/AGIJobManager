# Recovered draft disposition

The pinned transport commit was `9060a5058859444b2b6f6eb4387e5278d9c542f5`, a direct child of reviewed base `191cf3590e5cdc08df1bb0af500ee28a91c8b010`. The guarded recovery verified four Git blob identities, the six-file transport delta, source baseline blobs, 16 decoded entries, and compressed SHA-256 `2d0c4e7f0ff0af5c0228a98607528bbff7d79996027d3ca026bf725aa7e373f5`. The transport bootstrap was inspected as text, never executed or merged.

| Recovered file (repository-relative) | Disposition |
| --- | --- |
| `.github/workflows/current-state-release.yml` | Revised: complete qualification on PR/push, deterministic packaging and extraction; separate publisher |
| `docs/releases/v1.14.0/MAINNET_EVIDENCE.json` | Retained as explicitly historical sanitized public facts |
| `docs/releases/v1.14.0/RECOVERY_GUIDE.md` | Retained; ordinary preserved-build commands |
| `docs/releases/v1.14.0/RELEASE_NOTES.md` | Revised: source package versus externally qualified publication |
| `hardhat/scripts/check-readiness.cjs` | Integrated production reader and complete expected policy comparison |
| `hardhat/scripts/explorer-input-comparison.cjs` | Revised after independent AI review: complete link-map fallback, 20-byte positions and valid output-selection shapes |
| `hardhat/scripts/nft-registry-snapshot.cjs` | Retained compiler/layout/bytecode identity and bounded reads |
| `hardhat/test/fixtures/etherscan-grouped-links.json` | Retained labeled synthetic caller fixtures and historical link data |
| `hardhat/test/nft-registry-native.test.js` | Revised: instrument real getter indices and prohibit write RPC methods during snapshot reads |
| `hardhat/test/nft-registry-snapshot.test.cjs` | Retained synthetic/adversarial unit cases |
| `hardhat/test/registry-checker-integration.test.cjs` | Retained mocked checker-gate integration; not native coverage |
| `hardhat/test/verify-etherscan.grouped-entrypoint.test.cjs` | Retained real verifier entrypoint with mocked explorer responses |
| `hardhat/test/verify-etherscan.grouped-libraries.test.cjs` | Retained positive and adversarial comparisons |
| `hardhat/test/verify-etherscan.normalization.test.cjs` | Expanded with independent-review regressions |
| `scripts/release/build-v114-candidate.py` | Replaced by supported `package-release.py`; no duplicate packager |
| `scripts/release/check-v114-boundaries.py` | Revised: explicit checks remain active under optimized Python |

Existing-source integration adds the verifier helper with resolved input-source identity, isolates policy test doubles, preserves saved artifacts through `--no-compile`, aligns package/lock versions without dependency drift, and updates generated guides from their templates. The publication tooling now consumes external qualification rather than requiring a circular metadata commit.

Production `contracts/`, compiler configuration, Foundry settings, remappings, dependency resolutions and economic behavior are unchanged. `qualifiedBuild` error wording now tells operators to restore matching saved evidence or compile in an isolated checkout. Existing `fetchAgiTypes` consumers in `scripts/postdeploy-config.js` and `scripts/verify-config.js` retain their behavior and tests; they are outside the canonical readiness path and are not silently broadened to swallow provider errors.

Packaging includes reviewed tracked public source and documentation. The sole retained symlink is `hardhat/contracts -> ../contracts`, validated to stay inside the source tree. The tracked runtime residue `ui/test-results/.last-run.json` is deliberately excluded. Untracked private handoff files, operator transcripts, deployment-build originals, caches, transport code and credentials are never included.
