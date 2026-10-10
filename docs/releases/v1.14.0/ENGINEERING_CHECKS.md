# Engineering qualification record

These are development-workspace observations from 2026-10-10, prior to final-source GitHub qualification. They do not authorize publication by themselves. Final commit/tree, immutable workflow IDs and artifact digests belong in the published external `QUALIFICATION.json`.

| Check | Observed result |
| --- | --- |
| Handoff SHA-256 inventory and guarded recovery | Matched; all 16 pinned draft files recovered without executing bootstrap |
| Recovery utility unit tests | 20 passed; validates handoff recovery, not application release |
| Native Solidity build | 62 Solidity files compiled; 91 artifacts exported; zero compiler warnings/errors |
| Root contract/regression suite | 777 passed |
| Hardhat preflight | 206 passed, zero failed/skipped |
| Native deployment checks | 11 passed on disposable local EVM |
| Native registry and historical runtime compatibility | 3 passed; all nine recorded runtime hashes reconstructed; bounded getters and RPC read allowlist exercised |
| Actual Circle USDC fork | 11 passed on pinned isolated mainnet fork |
| USDC/ENS cutover fork | 23 passed; source-bound report regenerated from actual execution |
| UI unit suite | 178 passed (20 files); 6-case fuzz subset also passed, not counted twice |
| UI lint, typecheck, production build | Passed |
| Generated documentation and ENS integrity | Passed |
| Solidity lint, bytecode-size, UI ABI | Passed |
| Offline release gate/upload/publication regressions | 45 passed, including optimized-Python and mutable tag checks |
| Browser qualification in this workspace | Blocked: locked Chromium download was truncated; attempted USDC browser tests did not pass. Required CI browser gates remain mandatory |
| Foundry and Slither in this workspace | Not run; tools unavailable locally. Required security workflow remains mandatory |

Local JavaScript checks used Node 24.19.0, within the manifest engine range. Final GitHub workflows use pinned Node 22.23.2. Lockfiles and dependency identities are unchanged apart from package version fields; Solidity 0.8.37, Hardhat 3.17.0, ethers 6.17.0 and reviewed OpenZeppelin compatibility patches are preserved.

Independent AI code review was separate from implementation. It identified and drove fixes for incomplete link evidence, malformed output selection, native read-bound coverage, saved-build recovery wording, publication asset provenance, optimized-Python safety checks and the final publication recheck. This is not human approval or an independent security audit.

Production contracts/compiler configuration are unchanged against reviewed base `191cf3590e5cdc08df1bb0af500ee28a91c8b010`. Fork changes occur only on isolated local EVMs. This work performed no Ethereum mainnet writes, redeployment, token approval, ownership operation or intake activation. Historical paused intake is not presented as a fresh state query.
