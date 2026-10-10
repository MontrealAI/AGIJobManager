# v1.14.0 — Ethereum Mainnet Verification & Readiness

**Software release scope. Publication and qualification are established by the GitHub release and its external `QUALIFICATION.json`; this source document alone does not establish publication or authorize intake.**

This release integrates the two off-chain corrections exercised during the October 10, 2026 mainnet recovery into the supported commands. Solidity contracts, compiler settings, ABI, payout rules and live contract addresses are unchanged. Maintainer-authorized security dependency repairs are recorded in `SECURITY_REPAIRS.md`.

## Verification that accepts the explorer's representation, not different code

`reverify:mainnet` and `reverify:sepolia` now compare exact source contents and code-affecting settings while tolerating output-selection differences and omitted unused links. Target-source-grouped library entries are accepted only when the exact target source is known, each dependency is unambiguous and the configured address matches. Creation and runtime references are both binding. Missing, additional, duplicate, ambiguous or substituted dependencies fail closed. ABI, constructor, compiler, creation-transaction and runtime checks remain in place.

## Readiness without guessing what a provider error means

`check:readiness` and `check:readiness:sepolia` now use the compiler-derived array-length reader directly; no alternate checker or operator patch is needed. The installed pinned compiler reconstructs the saved build in memory, matches creation/runtime bytecode, ABI and link references, and derives the registry storage layout. Reads use one pinned block and include disabled entries. An empty array causes no out-of-range getter call. Missing/malformed storage, unexpected layouts, changed length, excess entries or a failed in-range getter block readiness. The CLI uses `--no-compile` to preserve the existing build artifacts.

## Evidence and boundaries

The operator-patched predecessor passed 185 preflight tests and reported mainnet technical readiness at block **26,161,848**, with accepted ownership, paused intake, an empty optional NFT registry and no reserved USDC. `MAINNET_EVIDENCE.json` is a sanitized historical observation, not qualification of the final v1.14.0 commit and not a fresh chain query. Its public runtime hashes are exercised by the native compatibility test. Final-commit CI results must be reviewed separately.

Independent security review, other mutable operational settings, participant eligibility, signer security, incident response, legal/operator review, and production commissioning remain separate. This release does not redeploy, change ownership, open intake or certify paid production throughput.

## Existing deployments

Preserve the original journal, recovered receipt, saved compiler input, compiled artifacts and private configuration. Use `RECOVERY_GUIDE.md`. Do not run deployment again to repair verification. Fresh checkouts compile in a separate workspace; they must not overwrite an operator's saved deployment evidence. Existing successful jobs and claims remain at their original addresses.

## Release assets

Preparation builds produce a source-pinned `AGIJobManager-v1.14.0-COMPLETE.zip`, standalone console, manifest and checksums inside a clearly named candidate Actions artifact. COMPLETE describes package contents; only the approved GitHub release adds final-source qualification. Publication requires the final source CI records, reviewed release metadata and a separate explicit publication action. Neither a pull request nor merging source authorizes publication or blockchain transactions.
