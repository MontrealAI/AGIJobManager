# Recovery and rollback — v1.19.1

## Preserve the original evidence

Keep every deployment's original source checkout, compiler input, artifacts, creator profile, plan, journal and canonical receipts. Do not substitute this release's source or optimizer settings into an earlier deployment campaign. Existing jobs, bonds, review credits and deferred claims stay on their original manager; a software release does not migrate them.

If a deployment command failed, it may already have broadcast. Reconcile the original non-overwriting journal, creation receipts and runtime before any retry. Do not rerun deployment to repair explorer verification, edit success fields or bypass readiness failures. Use the [Hardhat recovery procedure](../../../hardhat/README.md) and [incident-response guide](../../OPERATIONS/INCIDENT_RESPONSE.md).

## Keep configuration and activation separate

The reported Manager `0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8` remains a separate deployment with its own evidence. The reported paused intake, unlocked identity configuration and NFT collection count `0` with the agent NFT requirement off do not authorize changing those settings. Refresh the actual state and review the intended instance before any separately authorized owner action. Intake pause and settlement pause have different consequences; reconcile reserved obligations before intervention.

## Recover software or local work

For a release regression, retain the failing assets and logs. The immutable [v1.19.0 release](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.19.0) remains available with its original source and evidence. If selecting that software version, use its complete matching archive and qualification; do not mix it with v1.19.1 guides or policy hashes. A correction requires its own exact-source qualification and new release. Never move an existing tag, replace published assets or rewrite historical guides to make them describe a newer build. A local rollback cannot reverse payments or external effects.

For Builder work, preserve the original dossier, complete-history capsule, standalone HTML and verified exported files. A download request or browser storage entry is not a backup. Restore only a verified complete inventory and confirm mappings again. The Builder's `SOURCE.json`, selected package checksum and source manifest must retain its own commit/tree; do not replace them with a release-wrapper SHA.

For a failed package or attestation check, stop using that download and retain the original bytes. Repeat the [verification procedure](VALIDATION.md#verify-a-published-package) against the exact reviewed release identity. Never remove `QUALIFICATION.json`, alter checksums or weaken source verification to obtain a pass.
