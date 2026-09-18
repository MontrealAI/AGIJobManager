# v1.0.4 — Publisher and independent operator protections

This release makes the legal boundaries clearer for MONTREAL.AI and independent owners without changing MIT permissions or contract behavior.

## What changes

- An English legal center covers publisher/brand boundaries, independent operator terms, privacy, owner powers, fee beneficiaries and activity/jurisdiction review.
- The source and console notices remove blanket immunity, automatic-acceptance and exclusive-user-responsibility claims. They preserve mandatory rights and code-supported refunds, distinguish MIT from a service agreement, and apply no retroactive amendments to existing users.
- A practical operator template identifies who runs the instance, what it provides, who receives the 30%/10% fees, its actual support scope and the locally reviewed terms it needs. No deployment or legal review is marked complete by the template.
- The console requires fresh acknowledgement when reopened or restored. Old stored checkbox values are removed, and withdrawing acknowledgement cancels a pending transaction review. Account, network and manager safeguards remain in place.
- Documentation CI checks the complete embedded notice against the canonical source comment. Current interfaces link the legal center. Setup, deployment and readiness output explicitly distinguish technical checks from legal review.

## What stays compatible

Only the manager's opening comment changes. Executable Solidity, ABI, creation/runtime bytecode, eight linked libraries, storage, owner powers, USDC payouts, buyer recovery and dependency resolutions are unchanged from v1.0.3. The manager runtime remains 24,359 bytes. **NFT eligibility remains disabled by default; fresh intake starts paused.** Deployment-specific ENS namespaces are preserved.

Verified v0.9.6-compatible managers can use this console. A console update does not rewrite deployed source, adopt new operator agreements, alter existing jobs or migrate escrow. Earlier source tags, deployment records and published assets remain intact.

## Qualification and use

See `VALIDATION.md` and `SOURCE_CI.json` for the exact-source checks. Publication requires all five workflows and their required jobs, reproducible packaging, a source-pinned annotated tag and verified uploaded asset sizes/digests. The complete archive includes the source, console, guides and evidence; verify `SHA256SUMS.txt` and read `START_HERE.md`.

The notices provide drafting and operational guidance, not legal advice, an independent audit, insurance or a guarantee of full protection. Actual control, services, fees and applicable law determine duties. Independent owners must complete their own adoption, local review and any required language/acceptance process. The release performs no public-chain transaction and does not approve a live production launch.
