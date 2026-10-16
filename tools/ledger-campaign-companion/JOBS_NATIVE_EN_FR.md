# Jobs native external-manual handoff — EN / FR

16 October 2026. **The exact native adapter and fresh-CLI qualification are received. Real signing and the production plan are not approved.**

## Exact accepted source and evidence

| Item | Pinned value |
| --- | --- |
| Repository / PR | MontrealAI/AGIJobsv0, [PR #3986](https://github.com/MontrealAI/AGIJobsv0/pull/3986) |
| Source | `9a79f38ad9edc448dc0b8d8cfa6157ee0c6f2bc5` |
| Tree | `720312acac83eddeeb76644e1e22f53578e91784` |
| Hosted qualification | [Run 38954500102](https://github.com/MontrealAI/AGIJobsv0/actions/runs/38954500102), attempt 1, success |
| Artifact | `12072489816` |
| ZIP SHA-256 | `1da8f5a17978b92bf355537076125063b064c287d71b5c3e40858a9fcc33d025` |
| Original public member | `qualification.json`, SHA-256 `26f188a32c1bf62464c2239d3fad7ea729d1179265d24d5391ac66f23826787d` |
| Runtime / compiler | Node `22.23.3`; Solidity `0.8.37+commit.f401782d` |
| Scope | All nine hosted stages passed; 39 fresh-process CLI operations, 39 disposable signatures/explicit relay invocations, 25 creations |
| Recorded checks | 84 focused, 43 child-completion, 33 public-export and 22 direct/v1 cases passed, without skips in those stages |
| Account profile | **Empty-code creator only. The selected marker-bearing account is not qualified.** |

The source/compiler preservation gate passed with 67 transitions. Canonical compilation and size checks passed; cleanup records all owned fixture children stopped and source identity clean. This replaces the earlier missing Jobs interface/evidence handoff. The original artifact's production, device, bootstrap and complete-authority flags remain false.

The curated readback is [jobs-9a79-hosted-38954500102.json](../../docs/qualification/jobs-9a79-hosted-38954500102.json). It records all 39 operation keys/hashes in their native order, stage outcomes and the compiler/source pins. It is an evidence projection, not a production plan. The fixture's governor and deployment addresses are not production choices.

To verify the separately downloaded original public member locally:

```bash
node coordinators/jobs.mjs verify-qualification --evidence /absolute/download/qualification.json
```

The verifier requires the exact original member bytes, source and complete stages/counts; a modified report cannot pass by retaining `passed:true`.

## Integration boundary

`coordinators/jobs-native.mjs` registers the exact source, schemas, runtime, command surface and acceptance pins. Its optional trusted local `createJobsNativeDriver` loads the **original pinned** `loadExternalProfile` and `runCommand` implementations from the reviewed Jobs checkout. It does not reimplement packet decoding, session transitions, signature import, source guards or receipt acceptance.

The caller independently selects the read provider and the complete trusted bootstrap. The driver requires the exact source/runtime and an independently reviewed profile-file digest before loading native modules. It uses the same native profile/config/manifest/plan checks, writes results through the native private-output API, serializes commands, and neither signs nor sends transactions. Its Mainnet profile refuses a nonempty creator code hash. Native handoff/observation checks still reread actual creator code; a plan's empty-code hash alone does not qualify a wallet.

The native CLI remains the primary route. The extra JavaScript driver is optional. Its local dispatch tests do not substitute for the accepted native 39-operation hosted run or actual Mac/device/provider acceptance.

The optional browser companion still reports `JOBS_COMPANION_TRANSPORT_NOT_QUALIFIED`. Its generic Manager/Alpha signing controls are not silently applied to Jobs' different packet/plan/journal formats or 25-component build. **That companion limitation does not block the qualified native Jobs route.** It also does not make the selected marker-bearing creator supported.

## Exact native protocol

| Boundary | Contract |
| --- | --- |
| Profile | `jobs-external-manual-v1`; private session, original plan, reviewed plan hash, source manifest and independently reviewed manifest SHA-256 |
| Plan | `jobs-external-plan-v1`; explicit source/tree, compiler input, config/creation-scope hashes, creator/governor, first nonce, empty-code hash, canonical initial block, confirmation policy, expiry, fee/gas values and shared lock directory |
| Packet | `jobs-external-envelope-v1`; exact `jobs-external-operation-v1` context, full transaction, `unsignedHex`, `unsignedHash`, `policyHash` |
| Transaction | Type 2, selected chain, exact nonce, direct CREATE or the particular source-bound call, zero value, exact calldata, gas/fee bounds, empty access list |
| Commands | `inspect`, `handoff`, `retrieve`, `import-signed`, `authorize-relay`, `observe`, `repair-head`, `recover-command` only |
| Handoff review | Exactly `{planHash,unsignedHash,policyHash}`, independently reviewed for the current operation |
| Optional raw import | Private file exactly `{"raw":"0x..."}`; sender, canonical serialization and every field are checked |
| Relay authorization | Exact native acknowledgement; records an immutable attempt and releases one private capability. **It performs no network submission** |
| Observation | Native read-provider acceptance of exact transaction/receipt; bounded sender/nonce scan for an unknown-hash handed-off operation; no resend |
| Journal | Version 2; `jobs-external-event-sha256-v1` / `jobs-external-head-sha256-v1`. Historical direct/v1 evidence keeps its own format |
| Shared actor lock | `creator-nonce-lock-v1`, keyed by actual chain/sender; retained for manual waits and uncertain outcomes |

Plan/policy/unsigned Ethereum hashes use their native keccak256 rules. Source-manifest and compiler-input hashes are lowercase SHA-256 without a prefix. Config SHA-256 is prefixed `0x`. Private event/head hashing follows the native SHA-256 journal format; these hashes are not interchangeable.

The tax-enabled scope is 39 creator operations and 25 actual creations: coordinator, ten implementation contracts and fourteen components. The native order interleaves implementation creation and ownership handover; use the recorded operation list and staged writer. Do not treat this as 39 independent CREATEs or predict every component address from the creator's nonce. Original source/config determine each call and coordinator-originated component deployment.

## Production preparation

1. Select an owner-approved Ledger-controlled **empty-code** creator. Keep governor, fee wallets and treasuries explicit and distinct as required by the actual config. Retaining the currently selected marker-bearing account requires a separately reviewed and qualified native Jobs profile. No delegation installation/removal, account upgrade or old-deployment change is authorized.
2. On the trusted Mac, independently validate the exact source/compiler, installed dependency closure, Node executable and complete bootstrap before loading Jobs/Hardhat. Lockfile/source hashes are integrity evidence, not self-approval. Preserve the accepted compiler baseline; do not repin historical evidence.
3. Regenerate the reviewed config, source manifest, plan, starting nonce, all affected predicted addresses and creation-scope bindings for that creator. Record the actual production token, ENS/tax/economic policies, fee recipients and treasuries. The Jobs token route is **$AGIALPHA, 18 decimals**; Manager's **USDC, 6 decimals** is a different route.
4. Fix the canonical initial block, actual read provider, confirmation policy, expiry and explicit gas/fee ceiling. The current native schema uses one reviewed fee/gas envelope across all 39 operations. Compute and approve its aggregate maximum fee exposure. Fixture chain 31337, addresses, balances, governor and fee values are not production defaults.
5. Preserve the original session and cooperate with the same shared creator nonce lock across repositories. Any existing handoff, signature, submission or ambiguous outcome must be reconciled before a creator/plan change.
6. Review each exact operation before the owner manually approves it. Real wallet transport, current empty account code, Mac/bootstrap and production-plan acceptance remain separate from hosted source qualification.
7. After each owner-approved operation, accept its actual canonical transaction/receipt through the original native observation/continuation. Exact runtime/explorer and configuration/ownership readbacks occur at the relevant per-step/post-deployment boundary; future receipts are not prerequisites that can exist before creation.
8. End paused and complete the live authority/provenance review. Governor acceptance/configuration, ENS actions, funding, participant admission and activation require separate explicit owner approval.

The native `observe` implementation can reconcile a `signing-requested` operation without an imported raw file using a bounded exact sender/nonce scan. That recovery interface does not establish physical MetaMask/Ledger acceptance. A supported wallet route may use that path only when it checks every exact transaction field before the owner's approval. **Raw-signature export and the custom companion are not made mandatory if an existing supported wallet route safely verifies the exact transaction.** Use MetaMask + Ledger/Etherscan for supported configuration after exact target verification; initial creation/39-operation handover must follow its own approved native plan.

## Existing CLI entrypoints

Supply reviewed private absolute paths through `DEPLOY_DEFAULTS_CONFIG`, `DEPLOYMENT_EXTERNAL_PROFILE` and a fresh `DEPLOY_DEFAULTS_OUTPUT`. Use the pinned Node and archived artifacts. The original entrypoint is:

```text
hardhat run --no-compile scripts/v2/deployDefaults.ts --network <reviewed-network>
```

It prepares the next source-bound operation and stops at `awaiting-external-manual-signature`. Resume through the recorded coordinator address and original `DEPLOY_DEFAULTS_RESUME_EVIDENCE`, with fresh output files; do not create a parallel session.

Native command requests use `DEPLOYMENT_EXTERNAL_COMMAND_FILE` and:

```text
hardhat run --no-compile scripts/v2/externalManual.ts --network <same-reviewed-network>
```

Keep requests, profiles, outputs, signatures, acknowledgements, locks and original journals owner-only and outside source. `retrieve` grants no new signing permission. An uncertain output or disconnect means preserve and observe/recover; it never permits a repeat signature, nonce replacement or automatic relay. Hashless observation is bounded to 2,048 blocks from the plan's initial block. A long 39-operation campaign must account for that bound; expired/ambiguous state needs a separate exact reconciliation, not a silently refreshed plan.

**No Mainnet transaction has been approved or executed by this handoff. Every Mainnet operation remains subject to the owner's explicit review and manual approval.**

## Français

Le dossier exact de Jobs est intégré : révision `9a79f38…`, arbre `720312a…`, exécution hébergée `38954500102`, archive `12072489816`. Le SHA-256 de l'archive et celui du membre public ont été contrôlés. Les neuf étapes sont réussies, avec 39 opérations CLI fraîches et 25 créations sur chaîne jetable. Les indicateurs de production, Ledger, bootstrap et autorité complète restent faux.

Le profil accepte uniquement un créateur **sans code**. Le compte sélectionné portant un marqueur n'est pas qualifié; aucun contournement ni changement de délégation n'est effectué. Un autre créateur nécessite de régénérer et examiner configuration, nonces, adresses, plan et portée, après réconciliation de toute capacité existante.

Le CLI natif figé demeure le parcours principal. Le module d'intégration appelle ses véritables fonctions de profil et de commande, sans signature ni envoi réseau. Le compagnon navigateur facultatif conserve son statut de transport non qualifié; cette limite ne bloque pas le CLI natif qualifié. Le plan de production, le bootstrap sur Mac, le fournisseur et la signature physique demeurent des acceptations distinctes.

Chaque opération est examinée puis approuvée manuellement par le propriétaire; ses octets et son reçu sont contrôlés indépendamment. Un export de signature brute n'est pas exigé lorsqu'un parcours de portefeuille compatible vérifie exactement la transaction avant approbation. Le parcours habituel MetaMask + Ledger/Etherscan reste pertinent pour les appels de configuration pris en charge et examinés séparément. Jobs utilise $AGIALPHA à 18 décimales; Manager utilise USDC à 6 décimales. L'état final demeure en pause. Aucun envoi Mainnet, financement, activation ou changement historique n'est autorisé par ce dossier.
