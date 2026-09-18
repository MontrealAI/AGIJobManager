# v1.0.5 — Privacy safeguards and user data responsibilities

This release reduces accidental public disclosure and strengthens lawful responsibility allocation for MONTREAL.AI, independent owners and users.

## What changes

- Public-content rules prohibit added personal information, confidential material and secrets. Users must review their content, links, agent outputs and chosen providers, establish authority for private work, and cooperate with lawful incident handling.
- Proposed operator clauses allocate responsibility to submitting users to the fullest lawful extent and provide proportionate business-user recovery where enforceable. They preserve mandatory accountability, factual controller/processor roles, compensation rights and MIT permissions. They do not automatically bind users, indemnify prohibited amounts or authorize escrow deductions.
- The standalone USDC console requires fresh public-content checks for job creation, completion submission and administrative text writes. Changed completion URIs require a new review before inspection. Existing wallet, network, manager and economics checks remain enforced.
- IPFS upload requires separate approval of the exact payload and endpoint. Cancellation sends nothing; edits cannot replace the reviewed payload. HTTPS-only uploads refuse redirects and omit ambient cookies/referrers. Pinata JWTs go only to the Pinata origin, are masked, and are never saved or restored. Legacy saved credential fields are removed.
- Builder drafts require explicit saving and loading. Completion drafts stay in memory, scoped to account, manager and job. A clear control removes old persisted job drafts and notes. Cover previews require an explicit request, and metadata chips are escaped.
- Updated privacy guidance describes actual browser and third-party data flows, private incident reporting, applicable rights and operator setup. Public addresses/ENS activity may still be personal data; hashes, encryption and unpinning do not guarantee anonymity or erasure.

## Compatibility

Only the manager's opening comment changes in Solidity. Executable code, ABI, creation/runtime bytecode, libraries, storage, owner powers, USDC payouts, buyer recovery, ENS namespaces and dependency resolutions are unchanged from v1.0.4. Runtime remains 24,359 bytes. **NFT eligibility remains disabled by default; fresh intake starts paused.**

The console supports verified compatible v0.9.6/v0.9.7 and v1.0.x USDC managers. Updating it does not rewrite deployed contracts, change existing jobs, migrate escrow or adopt new agreements. Prior release tags, assets and historical deployments are preserved.

## Qualification and use

`VALIDATION.md` and `SOURCE_CI.json` identify the exact-source checks. Publication requires all five workflows and every required job, reproducible packaging, a source-pinned annotated tag and verified asset sizes/digests. Verify `SHA256SUMS.txt` and read `START_HERE.md` in the complete archive.

The safeguards apply to the documented console flows, not all clients, bots, direct calls or external services. A checkbox is not content scanning or a GDPR consent receipt. Actual operators must adopt accurate notices and any valid agreements and meet duties arising from their activities. This is not legal advice, regulatory immunity, an independent audit or approval of a live production launch. No public-chain transaction is performed by this release.
