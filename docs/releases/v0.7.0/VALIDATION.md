# v0.7.0 validation

Application commit: `c77647a513966eb47bae55bba53303a59b0a9d84`. Application tree: `e6577d65448ea14100196af07103096b722ee38c`.

## Required source CI

Every run below must report completed/success for this exact commit. The publisher rechecks GitHub immediately before creating the tag or release. `SOURCE_CI.json` records immutable run identifiers and this required gate; the linked logs contain actual results.

| Gate | Evidence |
| --- | --- |
| ui.yml | [Run 35221756381](https://github.com/MontrealAI/AGIJobManager/actions/runs/35221756381) |
| ci.yml | [Run 35221756149](https://github.com/MontrealAI/AGIJobManager/actions/runs/35221756149) |
| security-verification.yml | [Run 35221756309](https://github.com/MontrealAI/AGIJobManager/actions/runs/35221756309) |
| docs.yml | [Run 35221756117](https://github.com/MontrealAI/AGIJobManager/actions/runs/35221756117) |

Contract CI covers lint, compilation, EIP-170 runtime size, full lifecycle/regression tests, 35 console checks and browser transaction smoke. UI CI covers lint/types/build, 126 unit/runtime/property tests, browser end-to-end/accessibility/header tests, production dependency auditing, documentation and reproducible standalone artifacts. Security CI checks production/deployment dependencies, Hardhat compilation, Foundry unit/fuzz/invariant tests and configured Slither analysis. Existing detector/path exclusions remain visible in `slither.config.json`.

## Local results and new regression coverage

- Full contract suite: 397 passed; clean-install Node 22 owner/payout suite: 17 passed.
- UI unit suite: 126 passed; production build, lint, typecheck, documentation, standalone and 35 console checks passed.
- Runtime bytecode: 24,503 bytes; compiler profile remains Solidity 0.8.23, optimizer 40, Shanghai.
- Wallet updates require owner authority, paused intake and zero reserves, validate both recipients atomically, and reject reentrant completion callbacks.
- Outstanding jobs retain their original recipients; jobs posted after a permitted rotation use the new recipients.
- Ownership proposal, acceptance, authority revocation, proposal replacement/cancellation and disabled renunciation are covered.
- Existing ordered settlement, original-cost percentage arithmetic, posting-time validator-rate snapshots, micro-USDC conservation, refunds, blocked-recipient rollback and double-settlement checks remain covered.
- Console checks cover pending-owner acceptance, missing optional ENS, review-time wallet changes and reserve preflight errors. A malformed URI regression exercises the patched decoder and its CommonJS adapter.

## Dependency scope

At preparation, UI/root production audits have zero known findings. The complete Hardhat audit has 14 low findings and no moderate/high/critical findings. Legacy Truffle/Ganache development dependencies retain advisories, including high and critical findings; public-network Truffle signing is disabled and production keys must not enter that toolchain. See `source/docs/DEPENDENCY_SECURITY.md`. Audit databases change over time.

## Release integrity

The complete archive is pinned to the source commit/tree. The packager checks the change inventory and protected historical paths, hashes every payload file, and uses deterministic ordering and timestamps. Two archive builds must match byte-for-byte. The publisher checks all four uploaded asset digests, refuses tag repointing or mismatched existing assets, and only then publishes a stable latest release.

## Boundaries

No live contract is deployed or upgraded. Real recipient addresses remain required deployment inputs. Test fixtures do not certify an arbitrary live instance. Owner authority, USDC issuer restrictions, ETH gas and ENS dependencies remain operational assumptions. This is automated verification, not an independent security audit.
