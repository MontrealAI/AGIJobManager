# Privacy and public-data notice

**v1.0.5 · 18 September 2026.** This is a software disclosure and operator adaptation guide. It does not identify an unconfigured deployment's controller or certify compliance. Read the [user-data rules](USER_DATA_RULES.md) before submitting content.

## The public-content rule

**Do not add personal information about yourself or anyone else, confidential material or secrets to job text, links, files, images, ENS records, completion metadata or public support posts.** Use a neutral description and a sanitized public receipt. Wallet addresses, ENS identities and transaction activity required by the protocol are already public and may themselves be personal data; do not enrich them with names, contact details or profiles.

This includes identity documents, contact lists, health/biometric data, precise location, children's information, employment/customer records, private messages, passwords, seed phrases, private keys and access tokens. An agent can disclose these too: its operator must check inputs and outputs. Consent, prior online availability, encryption, a hash or a CID does not make prohibited content suitable for publication here.

If work requires protected information, agree a separate lawful, access-controlled workflow between the actual parties before sharing it. Keep credentials and sensitive paths out of public references. Prefer synthetic or genuinely anonymized material where suitable. If an adequately minimized public receipt cannot be made, do not publish that job through this public workflow.

## Actual data flows

| Surface | Exposure and control |
| --- | --- |
| Ethereum and ENS | Addresses, names, job URIs/details, fees, votes and events can be linked, indexed and replicated indefinitely. Local clearing or record updates cannot erase transaction history or others' copies. |
| IPFS and external content | Uploading sends the reviewed JSON to the selected provider. Content can be copied or pinned elsewhere. A signed link, hash or encrypted file is not a general anonymity or erasure solution. |
| Builder drafts | Typing does not autosave. **Save draft on this device** explicitly saves unencrypted data; **Load saved draft** restores it. Previously saved drafts remain until cleared but are not automatically restored. |
| Completion drafts | Kept in page memory for the current account, manager and job. Reopening the page does not restore old persistent completion drafts. **Clear saved job content** removes those old copies. |
| Local notes | Explicitly saved, unencrypted on this browser origin. Not a secure vault. Clear individually or with **Clear saved job content**. |
| Pinning credentials | Password field; used for the requested HTTPS upload. The console does not save or restore the JWT and removes legacy saved JWT fields on load. Revoke an old credential with its provider if exposure is suspected. |
| Other browser state | Configuration, wallet/network hints, preferences, recent identities and transaction activity can persist. Clear all site data through the browser if needed. Clearing cannot delete downloads, clipboard data, backups or extensions' copies. |
| External services | Wallets, RPCs, hosts, CDNs, gateways and metadata providers can receive addresses, IP addresses, requests and logs. Explicit image/metadata previews contact providers. Single-file does not mean offline or anonymous. |
| Other clients and integrations | The Next.js UI, API/proof services, support and operator additions have their own flows. Console safeguards do not restrict another client, a bot or direct contract calls. |

A fresh public-content check precedes job creation, completion submission, relevant administrative text writes and IPFS upload. It is a local safeguard, not content scanning, proof of anonymization, a GDPR consent receipt or adoption of an operator's agreement. This update adds no identity collection, central consent database or analytics.

## Responsibility follows the actual activity

Users bear responsibility for their own collection, instructions, disclosures, content rights, agent outputs and chosen providers. The [user-data clauses](USER_DATA_RULES.md) allocate those duties to the maximum lawful extent. Mere software publication does not appoint MONTREAL.AI to handle an independent user's private dataset; holding a contract role does not automatically make the owner controller of every referenced dataset. Conversely, nobody can disclaim responsibility arising from their actual decisions or conduct. Contract labels cannot override the facts. [EDPB Guidelines 07/2020, paragraphs 12–13 and 28–29](https://www.edpb.europa.eu/system/files/documents/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf).

Where GDPR applies, assess territorial scope, purposes/bases, minimization, notices, safeguards and applicable rights. Processor and joint-controller arrangements must reflect reality. Allocation between parties does not remove a person's rights against responsible parties; contribution is distinct from compensation rights. Assess impact assessments, breaches and international transfers where applicable. [GDPR Articles 3–6, 12–22, 24–28, 32–35, 44–49 and 82](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng).

Canadian and Québec requirements need their own applicability assessment. Where PIPEDA applies, an organization remains accountable for information under its control, including information transferred for processing. [Office of the Privacy Commissioner of Canada — Accountability](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_accountability/). Québec operators should review the [private-sector privacy statute](https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-39.1?langCont=en) with their adviser.

## Practical operator protections

Publish the actual responsible party and business privacy contact, purposes/bases where required, recipients/providers and countries, retention, rights and complaint routes. Minimize logging and access. Do not collect identification merely to evidence acknowledgement. Review any required provider arrangements; record the assessment privately and revisit material changes. Use the [operator template](OPERATOR_NOTICE_TEMPLATE.md) and [privacy response procedure](../OPERATIONS/PRIVACY_RESPONSE.md).

Report an exposure privately to the actual operator with only a reference and minimal description. Stop further disclosure, restrict or remove controlled off-chain copies when lawful, and assess notification and rights obligations. Public-chain permanence must be addressed before publication; it is not an exemption. No notice guarantees regulatory immunity or erasure of every copy.
