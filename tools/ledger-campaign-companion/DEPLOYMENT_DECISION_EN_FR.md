# Deployment decision / Décision de déploiement

Review candidate `0.2.0-candidate.2`, 16 October 2026. **No Mainnet deployment, configuration, funding or activation is authorized by this report.** The owner reviews and manually signs each exact transaction. Initial creation is separate; the primary configuration path is the existing Ledger-backed wallet with Etherscan. The custom companion is optional for its separately qualified creation/recovery path. The standalone wallet-review utility is also optional and does not mediate or replace the existing wallet; equivalent independent exact Mac evidence may be supplied.

## Separate decisions

| Contract set | Mainnet decision | Reason | Smallest next action |
|---|---|---|---|
| Manager | **NO-GO** | Production launcher blocks every supported Manager revision, including legacy source: native ENS-root verification misorders two roots. Historical zero-root fixtures do not qualify real policy. | Owner corrects native verifier, freezes a new commit, and requalifies all four distinct nonzero roots plus actual nine-component native/companion acceptance. No equal/zero-root workaround. |
| Alpha | **NO-GO pending real acceptance** | Selected architecture is five fresh direct contracts governed by `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`, initially uncommissioned. Wallet configuration and exact five-component verification are separate from native seven-step signing-session completion. Physical/provider/explorer/dependency permission evidence remains incomplete. | Finish the exact five-creation verification package, review the two bounded wallet calls with independent exact Mac evidence, and complete the real acceptance rows below before the owner signs Mainnet transactions. |
| Jobs | **NO-GO / signing unsupported** | Its separately implemented external-manual adapter and exact acceptance evidence have not been handed off. Repository CI or historical source does not prove that interface. | Owner supplies exact source commit/tree, packet/import/observation/recovery contract and reproducible acceptance; qualify that revision before adding support. |

Alpha has **no global pause switch**. Initial uncommissioned means no participant admissions/registrations, seeds, stake, jobs, campaigns or funding; it does not mean globally paused. Graph bindings do not authorize participant commissioning, funding or activation.

## Frozen dependencies and provenance

| Source | Exact commit | Exact tree |
|---|---|---|
| Manager candidate PR #1586 | `c2f72180d2f0d6ecd5b92d8e5197c5344be2c699` | `8b0d8816ce3cdaa1103d37eaa34f4d40bf72972f` |
| Alpha candidate PR #4827 | `38064bec3423218f87c6b81760ac6768b3e7d4e5` | `4fe59cb9b8c7e65ea087fd27b0e2abed6bf34c68` |
| Companion PR #1588 base | `6eeac125ae69d68c6a67291604541fd887f76a85` | `c368bcba7dbd2bbb262143715250009f7e28256a` |
| Jobs historical inventory only | `fed83bc183753e871621fc1cb3aa8510bd38f642` | `a49fa5d32272555e62431363f1ffd36b84ea87be` |

Implementation draft: [Manager PR #1590](https://github.com/MontrealAI/AGIJobManager/pull/1590). Its initial `221eb22247e6273c303d2d5875de7fcf2b11786b` is a historical checkpoint. **The final immutable implementation head/tree and exact acceptance counts are recorded in the delivered external `decision.json` and HTML report**; do not certify later changes with that checkpoint. Its initial real-browser attempt passed 46 cases and failed two; retain that failure separately from the subsequent exact-head rerun. Physical Ledger acceptance was not performed by that run.

All **77 non-root dependency package entries** are unchanged from the base lock. Exact pins remain context module 2.7.0, DMK 1.11.0, Ethereum signer 1.18.2, WebHID 1.2.4, ethers 6.17.0, rxjs 7.8.2 and esbuild 0.25.4; existing ethers-6.14.1/ws-8.21.0 and uuid-11.1.1 overrides remain. Browser toolchain: Playwright 1.62.1; hosted Node 22.23.2. Native sources use Solc 0.8.37+commit.f401782d; Manager Hardhat 3.17.0 and Alpha Hardhat 2.29.1 remain separate native pins. Every local Node/compiler executable still requires its independently reviewed identity.

Companion lock SHA-256: `1be64c56df594cb6545b3b4b2fbd24e210b820885351687b057fc26243fd1d34`. The independently checked official portable Solc file is `0.8.37+commit.f401782d.Emscripten.clang`, SHA-256 `d73fead3cbc860438f56f4d1723677499cdef212d0f8890241748d2d5afc1c5f`; a matching version string from another distribution is not identical compiler bytes.

Owner handoff SHA-256: interface patch `cc48a0a89d9b2acdc4841c29329149fc0b32bd31839e674184fe4d0956565063`; packaging patch `ec1ce64762e66e86622a9c29ffc0dcef269667ab40c9ca25cb4f57f294eeae17`. `SOURCE_ORIGIN.json`, `SOURCE_MANIFEST.json`, `DEPENDENCIES.json`, notices and the final archive manifest retain identity. Checksums are integrity evidence, not approval.

## Frozen implementation evidence

Required official-soljson/native-compiler Linux deterministic checks passed **428/428 with zero failures/skips**; production bundles and test-device exclusion passed. Actual disposable coordinator mechanics passed Manager **9/9** with nine runtime proofs, and Alpha **7/7** with five runtime proofs. Manager uses zero ENS roots/mock dependencies and remains production-blocked. Alpha's seven signed fixture operations used a synthetic governor; separate designated-governor unsigned checks and five initial designated-governor contracts do not constitute physical signatures. Its two bindings were initially unset. Exact code pins/scopes remain in the append-only compatibility inventory and external evidence.

The e09 checkpoint exposed an HTTP shutdown hang from a raw TCP preconnect without a request. Socket tracking now closes idle/preconnect connections while draining accepted API requests. HTTP 9/9 and independent focused 61/61 checks passed; two new tests raise the required Linux suite to 428 cases. The 48 browser cases remain separate, with atomic progress and a 60-second watchdog. Earlier timed-out/incomplete browser runs are preserved and cannot establish a full pass. Native 9/7/5 code closures and source pins are unchanged.

The standalone direct wallet-policy acceptance reproduced all five Alpha outputs/55 source units offline with the official compiler and zero network/signatures/broadcasts. The final actual five-creation wallet collector, Mac browser and clean archive results are reported in the external decision package. These categories never imply real provider/explorer/physical acceptance.

## Architecture and authority

Manager creates **nine components**: eight linked libraries and AGIJobManager. Alpha creates **five components**: AscensionAccess, NovaSeed, AscensionRiskOracle, AscensionJobMarket and AscensionMark. The selected architectures add no proxy or implementation contract. Every component actually added later requires its own verification; dependency proxies/implementations remain part of dependency inspection.

Alpha configuration is **two separate governor transactions**, not two more deployments: `AscensionRiskOracle.bindMarketplace(new AscensionJobMarket)` and `AscensionJobMarket.bindMark(new AscensionMark)`. Review exact new addresses/arguments/calldata/value, existing graph dependencies and expected getters; record each owner-supplied hash and reconcile canonical receipt/state independently. Existing-wallet calls do not automatically import into or complete a native seven-step journal.

The [wallet configuration runbook](verification/WALLET_CONFIGURATION_EN_FR.md) gives exact phase commands and review schema. Append only the known owner-submitted hash, approve the new full review digest and preserve the persistent private explorer journal.

The [source-only complete power matrix](verification/AUTHORITY_SCOPE_EN_FR.md) covers all selected components, ownership/pending ownership, all 48 Manager `onlyOwner` functions, inherited ownership, roles, upgrade/configuration powers and dependency permissions. It is complete as a **source inventory**, not a complete live authority certificate. Manager governor `rescueToken` permits broad arbitrary calldata to a non-USDC, nonself contract target, subject to code and empty/boolean-true return guards; this can exercise external permissions held by the manager. It is distinct from bounded excess-USDC withdrawal. No exercise of that power is authorized.

ENS eligibility and economic policy remain exactly those reviewed. USDC has **6 decimals**; $AGIALPHA has **18**. The deployer must retain no unintended administration. Read-only dependency and fresh-interval evidence must establish that, rather than infer it from one ownership getter.

## Remaining blockers and concrete actions

| Boundary | Smallest concrete action | Applies to |
|---|---|---|
| Manager verifier | Fix expected ordering: club, agent, alphaClub, alphaAgent; freeze new source and test four distinct nonzero values before requalification. | Every supported Manager production launch |
| Exact final source | Freeze implementation head/tree; rerun affected deterministic/native/browser checks and retain their exact code pins, including failures/skips. | New companion and wallet tools |
| Selected deployer/plan | Owner selects deployer; regenerate affected nonce/address/bindings before signing, review complete Mac-built plan. Reconcile any existing signature/attempt first. | Creation |
| Physical Mac/Ledger | Complete the supplied owner-run disposable physical acceptance and retain device/app/path/browser and outcome evidence; no Mainnet rehearsal is inferred. | Real signing |
| Provider/finality | Qualify reviewed read-only and explicitly authorized relay providers; prove exact known-hash canonical receipt/state and unknown-outcome recovery. | Mainnet reconciliation |
| Explorer | Supply API credentials securely on the Mac if needed, export every exact source package, obtain exact source/runtime acceptance for every actual component, and recover uncertain submissions through bounded reads. | Verification; submission is not success |
| Wallet bindings | Review the two exact Alpha calls against five receipt-proven targets; owner manually approves through the existing wallet, then independently validate each recorded hash and resulting getter. | Alpha configuration; companion optional |
| Live authority/dependencies | Observe owner/pending owner, roles, initial activity interval and relevant USDC/$AGIALPHA/ENS/wrapper/proxy/operator permissions at a canonical snapshot. Report missing enumeration evidence. | Both contract sets |
| Native block expiry | Obtain an exact native block-expiry implementation/acceptance if required for the optional Alpha companion path; preserve its current limitation. Local expiry never cancels signed bytes. | Optional companion, not a wallet-call prerequisite |
| Direct wallet-policy helper | Complete real Mac CLI acceptance; five units and actual Alpha five-contract/55-source offline official-compiler reproduction passed on Linux with zero network/signing/broadcast. Its proposal remains independently reviewable, not automatically approved. | Optional wallet utility |
| Creator-selection helper | Complete real Mac CLI acceptance; seven unit cases and actual Linux disposable native preparation passed (Manager nine replanned creations; Alpha seven reviewed operations), without device/provider qualification. Every proposal still needs review. | Optional creation helper |
| Jobs adapter | Obtain exact owner handoff and reproduce external-manual acceptance before compatibility promotion. | Jobs |

External audit and Sepolia are **owner-accepted omissions, not passed checks**. Historical deployments/jobs/balances/permissions stay untouched: no migration, withdrawal, settlement, approval, fuse change, delegation removal or activation is implied. Unknown outcomes never cause automatic resubmission.

## Français — décision et actions

**Manager : NON.** Toutes les révisions prises en charge sont bloquées au lancement de production. Le propriétaire corrige l'ordre des racines ENS du vérificateur, fige une nouvelle révision et reprend la qualification avec quatre racines distinctes non nulles. Les anciens essais à racines nulles ne constituent pas une solution de repli.

**Alpha : NON tant que les preuves réelles manquent.** Cinq nouveaux contrats, gouverneur désigné `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`, état initial non commissionné. Aucune pause globale. Après création et vérification exactes, les deux liaisons sont approuvées une par une avec le portefeuille Ledger existant sur Etherscan, puis contrôlées indépendamment par hachage, reçu canonique et état. Le compagnon n'est pas un prérequis et ces appels ne terminent pas automatiquement son journal natif.

**Jobs : NON / signature indisponible.** Attendre la source exacte et les preuves d'acceptation de l'adaptateur externe développé par le propriétaire.

Actions restantes : figer/réexécuter la source finale; sélectionner et examiner le plan du déployeur sur Mac; terminer l'acceptation Ledger physique et fournisseurs; vérifier exactement chaque composant sur l'explorateur; obtenir les observations complètes d'autorité et des dépendances. L'expiration native et la sélection du créateur restent des limites propres au parcours compagnon facultatif. L'audit et Sepolia sont des omissions acceptées, non des essais réussis. Aucun ancien déploiement, solde, emploi, droit ou critère ENS n'est modifié; aucune activation automatique.
