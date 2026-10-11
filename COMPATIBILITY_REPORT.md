# Deployed-instance compatibility

Baseline: `5f296a14727f3497128f3a49bd628c1f09a96221`.
The update changes off-chain tooling, tests, documentation and interfaces.
Solidity sources, ABI, fixed library links, Hardhat compiler configuration and
Foundry configuration remain unchanged. Package versions change together; dependency
resolutions and reviewed OpenZeppelin compiler patches remain unchanged.

The public historical record and frozen connection checker retain their original
bytes and validator guarantees. Their source/blob and transaction identities are
not updated to manufacture new historical evidence. New observations are separate.
Canonical manager/helper/owner/recipient transaction defaults remain blank.

The maintained inspection reuses the frozen checker's collection logic with a
canonical-hash adapter; it does not relax pre-activation “no jobs” expectations.
After actual paid jobs, use a separately reviewed lifecycle-aware monitor rather
than weakening this commissioning gate. ENS helper ownership remains one-step;
manager ownership remains two-step. No migration or public-chain write is required.

Qualification commands: `python3 scripts/release/check-v114-boundaries.py`, historical
167 regressions, native compiler/registry compatibility, contract tests, ABI/size
checks and full exact-source CI. The legacy boundary-script filename is retained
for compatibility; its version checks now follow synchronized package metadata.

Runtime selection and exact resolved-URL safeguards were adapted from the supplied
v1.5 rehearsal reference. The maintained launcher uses strict shared request/response
validation, bounded streaming and caught fixed-code failures. No private reference
archive, original journal, workstation path or signing tool is published.
