# Preserve and recover existing work

Keep original deployment journals and compiler artifacts private and unchanged.
Use `npm run ens:recover -- --help` for read-only reconciliation of the recorded
helper; this command never signs, broadcasts, deploys or changes a nonce.
A missing receipt, changed code or failed verification requires specific recovery,
not a replacement deployment. See `docs/OPERATIONS/COMMISSIONING.md` in the source.
Rollback is an off-chain checkout to a previously qualified source; there is no
contract migration. Retain new reports as dated evidence rather than overwriting them.
