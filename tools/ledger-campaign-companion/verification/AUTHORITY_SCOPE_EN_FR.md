# Contract authority and verification scope / Autorité et portée de vérification

This inventory describes the selected new direct-CREATE architectures at the exact revisions below. It does not establish a Mainnet deployment or live permission state. All historical contracts, jobs, balances, approvals, names, fuses and permissions remain untouched. Every observation is read-only. Economic policy is taken from the separately reviewed native plan; this companion does not change it.

| Candidate | Exact source commit | Exact source tree | New components |
|---|---|---|---|
| Manager PR #1586 | `c2f72180d2f0d6ecd5b92d8e5197c5344be2c699` | `8b0d8816ce3cdaa1103d37eaa34f4d40bf72972f` | Eight linked libraries and AGIJobManager |
| Alpha PR #4827 | `38064bec3423218f87c6b81760ac6768b3e7d4e5` | `4fe59cb9b8c7e65ea087fd27b0e2abed6bf34c68` | Five direct contracts and two governor binding transactions |
| Jobs | No supported external-manual adapter accepted in this inventory | Pending owner handoff and exact acceptance | No signing or verification support inferred |

Source review: Manager `contracts/AGIJobManager.sol`, `contracts/utils/*.sol`, `hardhat/scripts/{qualified-build-catalog,core-creation-plan,deployment-safety}.cjs`; Alpha `contracts/ascension/*.sol`, `tests/contracts/scripts/mainnet-authority.js`. The exact compiled native closure, source identity and plan must also be checked on the trusted Mac before signing. Ubuntu statements or packet checksums alone do not meet that requirement.

## Manager

| Component / permission | Intended controller | Power and limit | Evidence required |
|---|---|---|---|
| UriUtils | No owner or role administrator | Fixed linked library | New creation receipt; exact deployed code including self-address protection |
| TransferUtils | No owner or role administrator | Fixed token-transfer library | Same; exact library-deploy immutable where emitted by Solc |
| BondMath | No owner or role administrator | Fixed linked mathematics | New creation receipt and exact code |
| ReputationMath | No owner or role administrator | Fixed linked mathematics | New creation receipt and exact code |
| ENSOwnership | No owner or role administrator | Fixed eligibility helper | New creation receipt; exact links/code and selected ENS dependencies |
| NftEligibility | No owner or role administrator | Fixed eligibility helper | New creation receipt; exact code/links/self-address immutable |
| JobSettlement | No owner or role administrator | Fixed settlement code used in manager context | New creation receipt; exact code/links/self-address immutable |
| JobValidation | No owner or role administrator | Fixed validation code used in manager context | New creation receipt; exact code/links/self-address immutable |
| AGIJobManager ownership | Designated governor `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99` | Constructor-set transferable Ownable2Step storage; later transfer requires acceptance. Renunciation reverts. | `owner()`, `pendingOwner()==0`; exact constructor, receipt and full commissioning interval |
| Intake / settlement | Governor | Separate intake and settlement pauses; intake starts paused and settlement starts unpaused. | Fresh canonical getters; no unpause is authorized |
| Identity / eligibility | Governor and external ENS authorities | ENS registry, wrapper, roots, Merkle roots, additional agents/validators, blacklists, optional NFT eligibility and NFT types. Identity lock freezes only the specified identity fields. | Exact approved plan/config values; all affected mappings; ENS root/controller/wrapper evidence |
| Moderator | Governor-appointed moderator mapping | Independent dispute resolution under lifecycle and settlement checks | Creator mapping false; full state history or fresh closed commissioning interval proving no unplanned writes |
| Economics / limits | Governor | Bond, slash, review/challenge, reward, quorum, payout, duration, concurrency and settlement-wallet settings under source constraints | Canonical values against the approved policy; wiring must not change policy |
| Funds / rescue | Governor | Bounded excess-USDC withdrawal, ETH/token rescue and wallet rotation subject to contract guards; not permission to drain reserved escrow | All five reserve categories, token balances and approved recipients; no withdrawal is authorized |
| External calls via `rescueToken` | Governor | Arbitrary calldata to a contract target other than USDC or the manager itself, with empty or boolean-true return data required; this can exercise permissions held by the manager at other contracts | Inventory every relevant external permission/approval held by the new manager; this broad call power must be disclosed separately from excess-USDC withdrawal |
| Completion NFT | Holder / approved operator | ERC721 custody/approval/transfer powers; does not confer manager ownership | Fresh NFT count/approvals; any later approvals separately reviewed |
| ENS hook / fuse control | Governor, terminal-state caller and external ENS controllers | Optional hook; fuse burning is restricted and irreversible | Helper, parent, wrapper, resolver, operator and fuse inventory; no fuse action authorized |

The machine-readable `authorityScope()` lists every source `onlyOwner` function plus inherited ownership, moderator, participant and fuse permissions. Manager setters include no generic implementation upgrade function. The nine-CREATE scope has no proxy, implementation contract, ENSJobPages, AGIJobPages or AGIReviewEscrow. Adding an optional helper changes the selected architecture and requires its own exact source, constructor, receipt, runtime and authority verification.

Some role mappings are not enumerable, and `addModerator`/`removeModerator` do not emit a dedicated membership event. Reading only the deployer's mapping value cannot certify that no other administrator was appointed. The native fresh-graph interval must exclude all unplanned transactions; an expanded or later interval needs an independently complete state/history inventory. Missing enumeration evidence remains a blocker.

## Alpha

| Component / permission | Intended controller | Power and limit | Evidence required |
|---|---|---|---|
| AscensionAccess | Governor | Ownable2Step; expiring admission decisions; inherited transfer, acceptance and renunciation | Owner/pending owner; admissions and registration interval; immutable ENS/wrapper and roots |
| NovaSeed | No protocol owner; admitted live-ENS business and NFT holder/operator | Seal seed and immutable plan; ERC721 transfer and approvals | Exact immutable access; zero initial seed count; transfer/approval and participant permissions |
| AscensionRiskOracle | Governor; then bound marketplace for job locks | One-time marketplace binding; validators stake, offer capacity and attest; seed owner opens review | Owner/pending; exact binding; immutable access/seed/token/minimum stake/quorum/risk; fresh stake/round/activity interval |
| AscensionJobMarket | Governor; bound MARK; participants | One-time MARK binding; job, collateral, committee, payout/refund lifecycle | Owner/pending; exact binding/graph/parameters; zero initial jobs/stake/locks/activity |
| AscensionMark | No protocol owner; seed/campaign business and lot holders | Immutable graph; plan-restricted treasury; exact transient marketplace token allowance reset after `route` | Exact graph; zero initial campaigns/funding and marketplace allowance; later holder/business permissions |
| External token / ENS | External controllers | Token transfer/burn/supply policy; live ENS ownership, wrapped expiry and operators | Complete dependency authority report at the same canonical snapshot |

**Alpha has no global pause switch.** Its fresh state is **uncommissioned**, with no participant admissions/registrations, seeds, stake, jobs, campaigns or funding. Governor graph bindings do not commission participants or authorize funding or activation. Revoking an admission is not a global pause and does not remove every participant exit path. Ownership is transferable storage; inherited renunciation remains possible on its three ownable contracts.

Alpha admission still requires live ENS ownership: business under `alpha.agi.eth`, agent under `alpha.agent.agi.eth`, validator under `alpha.club.agi.eth`, with exact source role roots. Manager uses the separately reviewed selected root nodes and its source-defined exceptions. Neither route substitutes resolver text for ownership.

## External dependencies and outstanding observations

| Dependency | Required read-only evidence | Current qualification limit |
|---|---|---|
| USDC route | Canonical `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, **6 decimals**; runtime; proxy implementation/admin and upgrade owner; token owner/pending ownership, master-minter, pauser, blacklister and relevant controllers/roles | No fresh Mainnet acceptance performed here |
| $AGIALPHA route | Canonical `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`, **18 decimals**; runtime; any proxy/implementation/admin or absence proof; actual ownership, role and transfer/burn controls | Unknown controls cannot be recorded as absent; source/provider inventory required |
| ENS / NameWrapper | Exact code, selected root/controller, wrapped owner/fuses/expiry and operator permissions; any resolver/helper permissions actually used | No name transfer, fuse change or operator removal authorized |
| Governor / deployer | Current code/delegation; physical-device account; nonce, exact bytes and provenance; relevant wallet/provider/session permissions | Device, provider and complete authority acceptance are separate; no delegate removal authorized |

The read-only `collectAuthorityReport()` obtains bounded core ownership, pending ownership, graph, creator flags and initial-state probes through a trusted source-bound Mac transport. It pins the canonical snapshot before and after reading and reports missing/mismatched values explicitly. Its `authorityComplete`, `comprehensiveAuthorityComplete`, `productionApproved` and `activationReady` remain false: core observations do not prove the external inventory or full interval.

## Exact verification

All nine Manager components and all five Alpha components need exact verification. There are no new proxies or implementation contracts in these two selected architectures. Existing dependency proxies/implementations remain dependency observations; optional new components cannot be omitted from verification.

The trusted native coordinator validates source/compiler/build, complete approved plan and canonical receipts. The additive runtime evidence then binds each task to that exact locally checked compiler output, constructor and library map. `verifyRuntimeEvidence()` instantiates declared link locations, exact immutable values and known library self-address protection. It compares every remaining byte; it never masks immutable ranges or accepts a `runtimeVerified` boolean alone for the new compatibility profiles. A generic substitution checker is not an independent compiler certificate; the local native source/build checks and fresh canonical reads remain mandatory.

Source publication requires the exact campaign authorization plus secure server-only service setup. A submission GUID, service banner or `Pass - Verified` response is not success. Success also requires exact full Standard JSON, source/compiler settings, qualified file/name, constructor bytes, library map, fresh canonical receipt/runtime and an empty `SimilarMatch` field. Reads and polling have finite bounds. The durable attempted marker is written and read back before the single source POST. An uncertain submission is recovered by reads; it is never automatically posted again.

External audit and Sepolia are **owner-accepted omissions, not passed checks**. No actual explorer submission, Mainnet signing, deployment, funding, admission or activation is authorized by this source implementation or its synthetic tests.

## Français — exploitation et décision

Les contrats sont prioritaires. Le Mac Studio doit contrôler lui-même les sources exactes, le compilateur, la construction, le plan, chaque nonce et les octets de chaque transaction. Le Ledger USB exige une approbation manuelle distincte pour chaque transaction. Le déployeur est distinct du gouverneur désigné et ne conserve aucune autorité administrative non prévue. Après toute signature ou soumission, il faut réconcilier l'état existant avant de modifier la campagne.

Manager déploie huit bibliothèques et le gestionnaire. L'admission démarre en pause; le règlement n'est pas en pause. Alpha déploie cinq contrats avec deux liaisons de graphe signées par le gouverneur. **Alpha n'a pas de pause globale** : son état initial est non commissionné, sans admissions, participations, financement ni activité. Les droits du propriétaire, du propriétaire proposé, des modérateurs, des détenteurs de NFT, des participants et des dépendances sont distincts.

USDC a six décimales; $AGIALPHA en a dix-huit. Les critères ENS et les politiques économiques restent ceux du plan approuvé. Aucun ancien contrat, emploi, solde, droit, retrait, règlement, agrément, fusible ou délégation n'est modifié. Le rapport d'autorité doit signaler toute observation absente ou incohérente; une vérification limitée du graphe ne certifie pas les pouvoirs externes.

Les substitutions immuables et les bibliothèques sont calculées exactement à partir de la construction native vérifiée sur le Mac. Le code déployé doit correspondre octet par octet. Une soumission à l'explorateur n'est pas une vérification réussie. Une réponse perdue ne provoque ni nouvelle diffusion de transaction ni seconde soumission automatique. L'audit externe et Sepolia restent des omissions acceptées par le propriétaire, et non des essais réussis. La décision Mainnet exige les preuves réelles encore manquantes.
