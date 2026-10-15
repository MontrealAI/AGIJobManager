# Second-mainnet qualification decision — 15 October 2026

For the planned second mainnet deployment, the owner explicitly selected proceeding without an external independent security review and without a Sepolia rehearsal, and asked that preparation learn from the contracts deployed the previous week. This is a scoped decision for this deployment, not a claim that those checks were completed or a standing waiver for future releases.

| Evidence category | Status for this deployment | Boundary |
| --- | --- | --- |
| External independent review | NOT PERFORMED — OWNER-ACCEPTED OMISSION | Frontier-model/internal review is not an external independent audit. No independent assurance is claimed. |
| Sepolia rehearsal | NOT PERFORMED — OWNER-ACCEPTED OMISSION | Local forks and previous mainnet actions do not establish a complete new-candidate journey using present production signers. |
| Exact-source automated qualification | Required; bind results to the selected source | Published v1.17.0 qualifies source b721819639668f0074c244d516bbbe0cf57329a7. New tooling or source changes require their own checks. |
| Previous deployment evidence | Historical evidence to inspect and learn from | Preserve original reports. Add current canonical observations separately; do not convert dated commissioning into new-instance readiness. |
| Local mainnet-fork rehearsal | Required for applicable new-candidate paths | Record source, fork block/hash, executed cases and failures. No public-chain writes or production keys. |
| Deployment and intake authorization | Separate decisions still pending their specific review | This policy choice does not authorize signing, broadcast, spending, owner changes, configuration changes or unpausing. |

Before a broadcast decision, resolve reviewed deployment inputs, source/compiler/library identities, canonical USDC/ENS state, spending approval and durable recovery evidence. After deployment, verify exact linked runtime, accepted ownership, complete reserves, intended mutable policy and actual participants/response arrangements while intake remains paused. Record unresolved findings and their consequence rather than calling the system flawless.

Use the [second-deployment checklist](SECOND_MAINNET_RELEASE.md). General recommendations for external review and testnet rehearsal elsewhere remain useful guidance; for this specific deployment this scoped decision records their omission. It does not alter script assertions, historical receipts, existing instance state or the earlier production HOLD decision.

## Learning from the deployed instance

The recorded USDC manager is `0xCFA78f9980eA9B55c705B3E44467baE383cE1fA7`, with helper `0x6EE7A600C56C1Bfd12c482190d5dAbDD7194CDBC`. Its [dated actual transaction and connection record](../deployments/MAINNET_USDC_2026-10-10.md) must remain distinct from the original-asset legacy manager and from a new deployment. The candidate manager and helper source blobs match that recorded source; the next-deployment production-source correction is the linked `ENSOwnership` library. See [the correction and its limitations](../qualification/ENS_MEMBERSHIP_REVOCATION.md). Reusing the old linked library would not apply the correction.

The preserved [historical runtime/library evidence](../releases/v1.14.0/MAINNET_EVIDENCE.json) and native reconstruction tests establish historical build correspondence, not current on-chain observations. Preserve the old compiler input and journal; never compile over their only copy. A new manager imports no jobs, escrow, bonds, claims or approvals. Use a separate reviewed ENS namespace and do not silently reuse wallet-wide operator permissions.

At preparation time, no fresh read-only RPC observation was supplied for this decision, and direct explorer access for the new implementation check was unavailable. Fresh code/link, financial, role/permission and issuer state remains to be collected at a canonical block. The [USDC implementation companion](../DEPLOYMENT_USDC_IMPLEMENTATION_CHECK.md) is an additional read-only check; it does not replace the other A2 evidence or transform an observed candidate hash into an approved binding.
