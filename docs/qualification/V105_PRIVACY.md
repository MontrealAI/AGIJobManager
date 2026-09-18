# v1.0.5 privacy safeguards review

This internal review covers software and documentation. It is not independent legal advice, a GDPR certification or an audit opinion.

## Scope and legal limits

The public-content rule prohibits added personal information, confidential material and secrets. Necessary protocol addresses/identities remain public and may be personal data. User obligations cover selected data, private workflows, authority, agents/providers and incident cooperation. Proposed business-user recovery is limited to enforceable, attributable losses; it cannot transfer statutory duties, waive third-party rights, indemnify prohibited amounts or authorize escrow deductions. Operator adoption is prospective and requires a valid agreement. MIT permissions are unchanged.

The [privacy notice](../LEGAL/PRIVACY.md) cites the GDPR, EDPB role guidance and Canadian accountability guidance. It distinguishes actual roles from contractual labels and corrects assumptions that hashes, encryption, private-looking links, a static page or open-source publication remove privacy duties. The operator response procedure preserves applicable rights and incident obligations.

## Implemented boundaries

- Job creation and completion publication require a fresh, unchecked content acknowledgement. Administrative string/bytes arguments require review before being sent to the RPC for simulation. No admission or authorization check is removed.
- IPFS uploads require a separate accessible review of the exact payload and endpoint. Cancel/unchecked confirmation sends nothing. Changed form fields do not change the captured reviewed payload. Provider credentials are excluded from the displayed JSON. Confirmation is not legal consent or content scanning.
- Pinata credentials go only to the HTTPS Pinata origin. Custom endpoints receive JSON without JWTs. Endpoints reject credentials, query strings and fragments. Uploads refuse redirects, omit ambient cookies and referrers; error response bodies are not displayed. Changed completion URIs require a new review before inspection.
- Builder typing, job creation, default-cover selection and page exit no longer autosave. Explicit saved drafts remain available through Load; existing user drafts are not silently deleted. Completion drafts are memory-only and scoped to account, manager and job. Explicit clearing removes persisted job content on this origin.
- JWT inputs are masked, not saved or restored, and cleared after upload/review. Legacy saved credential fields are removed during settings migration. Cover previews are requested explicitly rather than fetching each typed URI; opening the completion assistant no longer automatically fetches a saved URI.
- Direct calls, bots, other interfaces, already published data and external services remain outside these console safeguards. No central identity collection or telemetry is added. This is not a zero-personal-data claim.

## Preservation and qualification

Only the manager's opening comment changes in Solidity. Its total line count and all executable Solidity are preserved. The review baseline updates only the manager and root lockfile fingerprints; finding IDs, rationale, evidence and analyzer settings are retained and must reproduce in CI. ABI and creation/runtime bytecode are compared with v1.0.4. NFT admission stays disabled and intake paused for fresh managers; settlement, owner powers, fees and ENS names are unchanged.

Qualification includes upload cancellation and payload binding, safe credential destinations and persistence, completion draft isolation, stale completion-context rejection, administrative text review, real-browser storage/checkbox/upload regressions and the five exact-source workflows. Final run IDs and executed results belong in the release evidence. No mainnet transaction or operator legal approval is performed by qualification.
