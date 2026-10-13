# SUCCESSOR Ω compatibility and preservation

Implementation began from main `3958cbc3b01aa459de16cf39e1ab0985b5fa56c3`, which matched the supplied handoff and published v1.15.0. No later work was reset. Existing unrelated pull requests were inspected and left untouched. Companion repositories were read only: AGI-Alpha-Agent-v0 `b1be06f1e9d85a1517af46bb5757fb93003ef8cf` and AGIJobsv0 `9ea22d49414751a49f7f8cd9d9e65c26e8317570`. The copied Jobs verifier/compiler and its pinned Alpha engine retain exact upstream bytes, hashes and licenses in the vendor provenance manifest.

The added local engines are new code, not renamed Alpha workshop output. Alpha imports remain explicitly distinct from native USDC. No Solidity, ABI, storage layout, contract timers, role eligibility, bonds, payout branches, ENS roots, custody or defaults change. Public/private companion boundaries and old obligations remain. The recorded mainnet A1–A5 HOLD and original release evidence are byte-bound in the preservation baseline.

`PRESERVATION_BASELINE.json` records original hashes for contracts, economics tools, historical release records, mainnet evidence and consoles, plus every original Mermaid block found in README/docs and existing website routes. The test requires every original diagram block to survive. Necessary console differences are limited to software edition labels and deterministic embedding of the expanded README/current software-version registry. `preservation-normalize.mjs` masks those specifically identified metadata fields; all remaining executable bytes, ABI data and embedded sources remain checked. Original raw hashes remain in the baseline for review.

| Surface | Result |
| --- | --- |
| Existing homepage/employer actions | Retained; new Builder invitation/navigation is additive. |
| Current USDC console and legacy aliases | Retained; only software edition copy changes. No auto connection, address injection, approval or transaction. |
| React single-file artifact | Regenerated from its original builder for embedded README/registry metadata; executable behavior unchanged. |
| Employer/payment modules | Reused without modification. |
| Contract/economic policy | Unchanged and covered by existing CI/regression workflows. |
| Dependencies/toolchains | Lockfile resolutions unchanged; package software versions advance to v1.16.0. Existing Node 22.23.2/solc 0.8.37/Hardhat 3.17.0 qualification remains mandatory. |
| Release qualification | All six existing workflows retained; website/local/worker/browser/accessibility evidence becomes an additional seventh requirement. A skipped deploy job is required during qualification; publication stays separately dispatched. |
| Old published release | v1.15.0 remains available and unmodified. Its observed `immutable` metadata was false; no immutability claim or settings change is made. |

Current source is a candidate until independent review, exact-source CI, release and Pages publication are verified. See [acceptance evidence](ACCEPTANCE.md) for observed versus external validation.
