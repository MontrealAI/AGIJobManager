# Owner-operated USB/macOS acceptance / Acceptation USB/macOS par le propriétaire

**Pending. No real device operation is authorized by this implementation assignment.** Arrange an explicit owner-operated session before connecting a real account for signing. A Mainnet signature is an executable capability even without broadcast. Synthetic local/browser/coordinator evidence does not qualify hardware.

**En attente. Aucune opération réelle n'est autorisée par cette mission.** Une séance exige la participation explicite du propriétaire. Une signature Mainnet est exécutable même sans envoi. Les essais synthétiques ne qualifient pas le matériel.

Record locally; public evidence must exclude private signatures, raw APDU, keys and recovery files. / Conserver localement; exclure des éléments publics les signatures privées, APDU bruts, clés et reprises.

| Field / Champ | Owner-observed result / Résultat observé |
|---|---|
| Date and explicit session scope / Date et périmètre explicite | PENDING |
| Exact companion source/build/manifest / Source, build et manifeste | PENDING |
| Exact coordinator commit/tree/plan/campaign digest / Coordinateur et campagne | PENDING |
| Mac model and macOS version / Mac et version macOS | PENDING |
| Browser name/version and WebHID support / Navigateur et WebHID | PENDING |
| Ledger model and USB connection / Modèle Ledger et USB | PENDING |
| Firmware and Ethereum app versions / Micrologiciel et application Ethereum | PENDING |
| Owner-selected account/path; expected creator or governor / Compte, chemin et rôle | PENDING |
| Full address actually displayed and manually confirmed / Adresse affichée et confirmée | PENDING |
| Exact on-device transaction screens and limitations / Écrans exacts et limites | PENDING |
| Whether blind signing was requested or refused / Signature aveugle demandée ou refusée | PENDING |
| Largest representative CREATE bytes and device behavior / Plus grande création représentative | PENDING |
| Governor binding call destination/selector/arguments display / Affichage d'une liaison gouvernée | PENDING |
| Cancellation before approval / Annulation avant approbation | PENDING |
| Disconnection and approved-but-lost-response recovery / Déconnexion et réponse perdue | PENDING |
| Actor/path/account change stops or reconfirms / Changement de rôle, chemin ou compte | PENDING |
| Independently recovered exact sender and all serialized fields / Signataire et champs revérifiés | PENDING |
| Full private recovery durability and download behavior / Reprise privée durable et téléchargement | PENDING |
| Late-expiry DO_NOT_RELAY preservation / Conservation après expiration | PENDING |
| One-shot relay policy and exact acknowledgement, if separately authorized / Envoi unique si autorisé | PENDING |
| Owner/operator and independent reviewer result / Résultat propriétaire et examinateur | PENDING |

1. First verify package/source/build/plan/campaign identities and the exact device/browser versions; do not infer a derivation path or device model from prior ownership. Use the separately approved rehearsal network and exact envelope. No old deployment may be a transaction target.
2. Confirm the actual account address on the Ledger. Read and record what the device displays for CREATE and governor bindings; a browser decode never establishes device-confirmed semantics. Stop if the device requires an unapproved setting or cannot safely present the operation. Do not relax CSP or replace the official context to force success.
3. Manually approve only the specifically authorized device operation. Independently reparse the returned envelope and recover its signer; compare chain, nonce, destination/CREATE, calldata/initcode, value, gas, fee limits, access list and unsigned hash to the stored intent. Do not publish the returned signed bytes.
4. Exercise rejection, cancellation, disconnection and response loss without assuming a cancelled request erased a signature. Check private durable recovery and absence of a repeated prompt. Expired capabilities stay private and DO_NOT_RELAY; time cannot cancel them.
5. Record pass/fail/blocker by device/app/browser and exact source. A pass for one path/model/operation size does not qualify another. Any broadcast, funding, governance activation or admission needs its own explicit approved scope.

En français : vérifier d'abord toutes les identités et versions; confirmer l'adresse réelle sur le Ledger; relever les écrans exacts pour CREATE et liaisons gouvernées; approuver manuellement seulement l'opération autorisée; reparser indépendamment l'enveloppe et son signataire; tester refus, annulation, déconnexion et perte de réponse sans redemande de signature; conserver les reprises privées. Chaque résultat reste lié aux versions et au chemin observés. Aucun envoi, financement ou activation n'est implicite.

External audit and Sepolia remain owner-accepted omissions. They are not tests performed here and are not silently added as new requirements. / Audit externe et Sepolia restent des omissions acceptées, non des essais effectués ni de nouvelles obligations implicites.
