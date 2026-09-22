# AGIJobManager v1.7.0

This release adds funded reviewer capacity and evidence-calibrated economic admission. Existing manager payouts are preserved; review protection requires a **separate companion deployment** and explicitly priced employer-funded retainers.

1. Verify the complete ZIP against `SHA256SUMS.txt`. `RELEASE_MANIFEST.json` binds every payload to the frozen source.
2. Read [what changed](RELEASE_NOTES.md) and [validation and limits](VALIDATION.md).
3. Start with [review protection and calibration](source/docs/OPERATIONS/REVIEW_PROTECTION.md), then [the generated deployment command guide](source/docs/RELEASE_GUIDE.md). Use the public Node.js 22.23.2 toolchain and lockfiles.
4. For an existing compatible manager, deploy and independently review the companion separately; do not replace the manager just for this feature. Begin with the dry run, inspect configuration/fees, retain the deployment journal and verify runtime, immutables, independent RPC and explorer evidence. A failed command may have broadcast; recover from its journal.
5. Integrate employer pre-funding qualification and fresh worker checks. Manual console use and permissionless contracts do not enforce the off-chain policy. Private applications are distributed separately.

A retainer buys named reviewer capacity and becomes irrevocable at activation. It is not proof of good work. The employer bears nonperformance risk, and the new expense must pass employer economics. Do not claim reviewer profitability from payment alone: gas, bounded attempts, operating costs, bonds and losses still matter.

No live deployment, public-chain spending, new million-offer simulation or production qualification was performed by creating this release. Independent review, real Macs/providers, actual employer value, issuer capacity and funded recovery remain commissioning requirements.
