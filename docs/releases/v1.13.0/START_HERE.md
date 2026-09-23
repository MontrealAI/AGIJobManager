# Start here — AGIJobManager v1.13.0

1. Read RELEASE_NOTES.md and VALIDATION.md, then `source/docs/OPERATIONS/ASTRA_REVIEW_PILOT.md` for what the synthetic study does and does not establish.
2. From `source/`, run `npm run workforce:reserve -- examples/review-reservation.json` to inspect independent reviewer windows. The sample admits the first job and rejects the second deadline conflict.
3. Run `npm run workforce:pilot -- examples/astra-pilot-reference.json`. All six gates fail on the canonical synthetic reference; the settlement audit and independent review ground truth are explicitly missing.
4. Use `source/docs/OPERATIONS/QUALIFIED_ADMISSION.md` and the existing project economics, human capacity, real Mac commissioning and independent review procedures before actual intake. These new commands never sign, post, spend or reserve live state.
5. Verify downloaded assets using SHA256SUMS.txt and RELEASE_MANIFEST.json. Private Fleet 1.10.0, Agent 1.16.0 and Node 2.17.0 are unchanged, separately provided packages. Preserve their data directories, journals, obligations and recovery paths when commissioning.

No manager deployment, Work plan entitlement, Astra performance, customer value, production throughput or external security assurance is implied by this software release.
