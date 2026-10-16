# Owner-operated Mac Studio / Ledger USB acceptance · EN / FR

**Status: NOT PERFORMED.** No device is available to this implementation team. Browser tests use a test-build synthetic signer; they establish no physical Ledger result. Every transaction requires the owner's own review and manual approval. Governor: `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`. Select a distinct deployer before binding the campaign.

**État : NON EFFECTUÉ.** L'équipe ne dispose pas de l'appareil. Les essais navigateur utilisent un signataire synthétique réservé à la compilation de test. Chaque transaction exige l'examen et l'approbation manuelle du propriétaire. Choisir un déployeur distinct du gouverneur avant de lier la campagne.

## Rehearsal network / Réseau de répétition

Production currently accepts only Ethereum chain ID 1. A disposable chain using chain ID 1 produces signatures that can also execute on Mainnet when the other conditions match. It does not make a signed capability harmless. No such signature is authorized here. Prefer a separately reviewed rehearsal profile with a different chain ID; this package does not claim that profile is implemented or qualified. Any owner-approved chain-1 rehearsal must isolate the RPC from public networks, use disposable accounts without real assets, preserve the same private recovery controls, and explicitly approve the exact executable envelopes. Physical qualification remains pending until a supported rehearsal is actually performed.

La production accepte actuellement uniquement la chaîne Ethereum 1. Une chaîne jetable portant cet identifiant produit des signatures potentiellement exécutables sur Mainnet; aucune n'est autorisée ici. Préférer un profil de répétition examiné séparément avec un autre identifiant, non déclaré disponible ou qualifié dans ce paquet. Toute répétition sur la chaîne 1 exige une autorisation explicite des enveloppes exactes, un RPC isolé, des comptes jetables sans actifs réels et les mêmes contrôles de reprise privée.

## One owner session / Une séance propriétaire

1. On the trusted Mac, independently verify the exact source commit/tree, tracked-file bytes, compiler identity, build settings, artifacts, libraries, plan and every unsigned envelope. An Ubuntu checksum or verdict is an input to compare, never the trusted result. Use the source-bound runbook. Keep authoritative campaign, native actor locks, bridge journal and signed recovery files on the Mac.
2. Before signing, select the actual deployer and read its address on the Ledger. Changing deployer requires a new campaign with regenerated nonce lanes, predicted addresses, constructor bindings and plan hashes. Reconcile every existing signature/submission before a change. Never edit an active campaign to replace an actor.
3. Record the observed Mac, macOS, browser, Ledger model, firmware, Ethereum app and owner-selected derivation path. Confirm the full address on-device. No path or device version is inferred. Stop if a requested setting or transaction screen is unacceptable; preserve evidence of the blocker. A browser decode is not evidence that the device displayed the same semantics.
4. Review the campaign once, then manually approve each exact operation. Test representative CREATE size and the supported governor binding calls. After each returned signature, independently recover its sender and compare type, chain, nonce, destination/CREATE, initcode/calldata, value, gas, fee ceilings, access list and unsigned hash. Keep signed bytes private.
5. Exercise the recovery cases below. Confirm that the same capability and existing attempt remain in the private journal; no second device prompt, import or submission occurs automatically. A cancellation, disconnection, missing receipt or expired intent does not erase a signature. Keep expired capabilities as DO_NOT_RELAY.
6. Relay only after separately authorizing that exact transaction and its stored native acknowledgement. Default relay stays disabled. Any uncertain import or relay outcome requires read-only reconciliation of the known hash and nonce; no resend or fee replacement. Verify canonical receipt, runtime including immutables, explorer result and authority report before considering commissioning. Alpha's initial uncommissioned state is not a global pause.

En français : vérifier indépendamment la source, le compilateur, la compilation, le plan et chaque enveloppe sur le Mac; choisir et confirmer le déployeur avant signature; conserver les journaux et verrous côté Mac; relever les versions et les écrans réels; approuver manuellement chaque opération; reparser indépendamment le signataire et tous les champs; tester les reprises sans répétition automatique; autoriser séparément chaque envoi; réconcilier les résultats incertains en lecture seule. L'état initial non commissionné d'Alpha n'est pas une pause globale.

## Evidence sheet / Fiche de preuve

Record PASS, FAIL or BLOCKED and a private evidence reference. Never attach signed bytes, a seed phrase, private key or PIN to a public report.

| Observation / Observation | Result / Résultat |
|---|---|
| Exact companion and native commits/trees; campaign/plan/build digests / Identités exactes | PENDING |
| Independent trusted-Mac source/compiler/build/envelope checks / Contrôles Mac indépendants | PENDING |
| Mac Studio, macOS, browser and WebHID versions / Versions observées | PENDING |
| Ledger model, USB, firmware and Ethereum app / Appareil et application | PENDING |
| Owner-selected actor/path and full on-device address / Rôle, chemin et adresse | PENDING |
| Largest supported CREATE; actual device screens and blind-signing requirement / Création maximale et écrans | PENDING |
| Each supported governor binding; actual destination/selector/argument display / Liaisons gouvernées | PENDING |
| Rejection and cancellation before approval; one durable intent / Refus et annulation | PENDING |
| Disconnect while awaiting approval; no repeated prompt / Déconnexion avant approbation | PENDING |
| Approval followed by lost USB response; exact recovery retained / Approbation et réponse USB perdue | PENDING |
| Lost native import acknowledgement; same capability and original acknowledgement / Accusé d'import perdu | PENDING |
| Browser reload and bridge restart; same hash, operation and journal prefix / Redémarrage et identité conservée | PENDING |
| Changed actor/path/source; signing stopped or re-reviewed / Changement et arrêt contrôlé | PENDING |
| Expiry before request and after approval; no import/relay of late capability / Expiration et conservation | PENDING |
| Interrupted relay; existing attempt retained and no second send / Envoi interrompu sans répétition | PENDING |
| Exact independent canonical receipt/runtime reconciliation / Réconciliation indépendante | PENDING |
| Explorer verification of every component actually deployed / Vérification des composants déployés | PENDING |
| Ownership, pending ownership, roles, upgrades, configuration and dependency permissions / Autorités | PENDING |
| Independent reviewer and owner acceptance / Acceptation propriétaire et examinateur | PENDING |

External audit and Sepolia are owner-accepted omissions, not passed tests. No previous deployment, job, balance, permission, ENS fuse, delegation, withdrawal, settlement, approval or activation is changed by this sheet. / Audit externe et Sepolia : omissions acceptées, non des essais réussis. Aucun déploiement précédent, travail, solde, permission, fuse ENS, délégation, retrait, règlement, approbation ou activation n'est modifié.
