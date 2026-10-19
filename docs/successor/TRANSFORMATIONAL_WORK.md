# Transformation campaigns and separate USDC proposals

`scripts/integrations/transformational-work-request.mjs` receives an Alpha
`transformational-intelligence/v1` campaign as inert data and prepares an
unfunded Manager work proposal. Alpha owns discovery, purpose, formulation,
evaluation, transformation witnesses and campaign history. Fleet owns isolated
execution and review. Manager retains its USDC lifecycle; Jobs retains its
separate AGIALPHA lifecycle. This adapter neither executes a campaign nor
implements independent evaluation.

The specification is the owner's attached October 2026 manuscript:

| Input | SHA-256 |
| --- | --- |
| `Transformational_Intelligence(2).pdf` | `d7170e8217e3bf6aa1b84868c1c76c5994c6995c5297ed092d7e72a6430c664f` |
| `Transformational_Intelligence(2).tex` | `9d4a664d951d6b97f5136bf0b44f1ca458e90d585434a6a27a542694bb2ece5f` |

The paper's broader research claims are not established by this boundary.

## Installed API

```js
const campaign = await inspectTransformationWorkRequest(campaignRaw, {
  expectedBindingsDigest,
  inspectWorkRequest,
});
const draftRaw = await createTransformationWorkDraft(campaignRaw, {
  budgetUSDC: '25.00',
  createdAt: '2026-10-19T15:00:00.000Z',
  expectedBindingsDigest,
  inspectWorkRequest,
});
const draft = await inspectTransformationWorkDraft(draftRaw, {
  expectedBindingsDigest,
  inspectWorkRequest,
});
```

`inspectWorkRequest` must be the installed, reviewed Alpha native campaign
inspector from the exact compatible source set. It returns the validated parsed
campaign itself. The adapter checks that this is exactly the supplied campaign;
an `accepted: true` verdict is insufficient. Imported files never select or
install code. `expectedBindingsDigest` comes from the consuming runtime's frozen
code/model/configuration/evidence context, independently of the imported draft.
Reusing the digest copied from an untrusted draft would defeat the stale-context
check.

The current native Alpha pilot permits only zero currency allowances. Its real
supported Manager path is full campaign inspection with no paid proposal. A
positive draft requires a future independently reviewed native charter version
that explicitly supports that allowance. Positive-budget policy-double tests
exercise Manager's cap boundary; they do not establish native paid-campaign
support or authorize spending.

The campaign's charter and settlement routes must both say `USDC`; its explicit
`charter.budgets.USDCBaseUnits` cap must cover the separately proposed payout.
This field counts six-decimal USDC units, bounded to `uint128`. `25.00` means
exactly `25000000` units. There is no conversion from the AGIALPHA allowance,
observed expenses, generic money units or another route. The free pilot's zero
USDC cap cannot produce a positive paid proposal. A change to its material
purpose, permission, payment route or budget requires a newly authorized charter
and comparison basis in Alpha.

The original UTF-8 campaign is retained without normalization. Its complete byte
digest, charter, formulation, transformation, evaluation instrument and epoch,
runtime binding and local authorization binding appear in the draft. Manager
additionally binds its adapter and strict data-policy source bytes. Reinspection
replays native validation and reconstructs the entire draft. Changing retained
authority, deployment, currency, amount, reservation, source or measurement
fields and recomputing the outer checksum does not make the draft valid.

The campaign's local authorization is never a permission to sign, execute paid
work, commission a job, spend USDC, approve a token, accept a review or settle.
Manager's output always grants no authority and leaves deployment, specification
URI, duration, details and transaction unset. Imported execution and review
statements are not authenticated proof. Hashes bind bytes and do not establish
semantic truth, independent review or trustworthy freeze timing.

The input screen examines decoded credential-shaped fields before native
inspection. Conventional credential-family aliases, including header/provider prefixes and
normalized names ending in token or auth, including auth/authentication aliases,
and bare Bearer credentials are refused, except the
exact inert native authorization object, the draft's public authorization-binding
digest, and Manager's fixed public token-address field. URL provenance uses a deliberately bounded profile: credential-free HTTPS
on the default port, DNS hostnames, no fragment and no credential-bearing query
parameters. IP literals (including normalized IPv4 and IPv6), local names and
private-network forms are refused even when the WHATWG URL parser normalizes
backslashes, omitted slashes or embedded ASCII tab/newline characters. This performs no DNS resolution or fetching;
source-rights review and execution-time network admission remain separate.

Native requests remain bounded to 4,000,000 UTF-8 bytes. Generated drafts retain
the exact original request and may expand through JSON escaping; reinspection
uses the declared 8,388,608-byte draft bound for parsing and screens every
decoded string and field name. Each string remains within the unchanged shared
4,000,000-character public-data screen; JSON escaping in the outer draft does
not reduce the supported original-request limit. The shared screen and Builder
source bytes remain unchanged.

## Paper-to-implementation boundary

| Paper section | Implementation | Regression evidence | Supported scope / limitation |
| --- | --- | --- | --- |
| 4.1 and 4.3: charter and executable transformation package | Native campaign inspection, object-digest validation, exact retained campaign | Native-result substitution and object-substitution tests | Alpha owns full witness semantics and authorization; Manager preserves them without granting authority |
| Algorithm 1: permission before execution | Inert proposal with no deployment, signer or transaction | Rehashed authority/currency/transaction mutations reject | This adapter does not execute Algorithm 1 |
| 5.3: count costs | Independently supplied USDC6 proposal and explicit charter cap | Exact minimum/maximum, cap exhaustion, overflow and rounding tests | Proposed escrow payout only; model, verification, gas, maintenance and human costs are not measured here |
| 5.4 and 6: frozen comparisons and measurement epochs | Runtime digest, instrument identity and measurement epoch bound into each draft | Code/model/config/evidence staleness and epoch-tamper tests | Native Alpha process evidence remains necessary; a digest does not prove independence |
| 8: supported reuse | Exact original campaign and deterministic reinspection | Repeated-inspection recovery test | No automatic promotion, archive routing, authority expansion or settlement |

Run the policy regressions with Node 22.23.2 or later:

```sh
node --test scripts/integrations/transformational-work-request.test.mjs
node --test scripts/integrations/four-repo-computer-receipt.test.mjs hardhat/test/four-repo-computer-lifecycle.test.cjs
```

The transformation tests label their native-inspector policy double. Passing
these tests is not native mixed-version integration, browser execution,
independent review or a paid lifecycle result. Those require separate pinned
cross-repository evidence. Existing #1606 qualification and release policy are
unchanged; an added source file requires a separately reviewed finite source
profile before packaging or publication.

## Recovery and deployment boundary

Retain the complete original campaign and draft. Reinspect with the installed
native validator and current expected bindings. A rejected or stale file remains
an unchanged historical record. Continue under a new explicitly authorized Alpha
campaign revision; do not silently rewrite historical approvals or evidence.
The adapter performs no persistence, networking or external action; interrupted
validation creates no partial job, reservation, payment or transaction.

Use public, non-personal inputs only. Preserve Ubuntu Hardhat initial creation
with local hidden ephemeral deployer-key entry and Ledger governance on Mac
Studio. Never store or print a key, put it in arguments, `.env`, history or logs.
Previous deployments and historical records remain read-only. No Mainnet or ENS
operation is included.

## Français

Cet adaptateur conserve la campagne Alpha complète et prépare uniquement une
proposition **USDC non financée**, avec six décimales et un plafond USDC explicite
dans la charte. Le parcours gratuit à plafond zéro ne devient pas payant. Aucun
montant AGIALPHA n'est converti. Le validateur natif installé et le contexte
logiciel figé sont revérifiés à chaque importation. Le résultat ne donne aucune
permission d'exécution, de dépense, de signature ou de règlement; aucune revue
indépendante n'est créée. Conservez les anciens fichiers inchangés et autorisez
explicitement toute nouvelle charte ou révision matérielle dans Alpha.
