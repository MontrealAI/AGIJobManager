# Continue an Alpha project in Manager

The bilingual [browser receiver](https://montrealai.github.io/AGIJobManager/successor/#alpha-project) and optional CLI adapter carry the original Alpha project dossier into a separate Manager working history. It supports Alpha's `public-data` integer CSV task. Other mission families are rejected. The receiver runs the pinned Alpha project validator, then uses Manager's own mission validator, execution engine and separate artifact checker. A checksum alone is insufficient.

The original project ID, cycle ID, complete UTF-8 dossier, rejected work, reviews and source history remain unchanged. Each Manager checkpoint retains its complete native capsule. Imported reviews remain supplied historical statements; no Specialist status, protected evaluation, independent review, funding or operational permission is imported.

Use a **trusted, clean source checkout** of Alpha commit `7c410d3d61d5d6bba5354307e1784dba2b3aa177`, tree `e80b1dc06317d939e3dd22d2db063a7f1706ddcb`. The operator explicitly supplies its absolute path; the transfer cannot select executable code, an URL or a different validator. The command verifies commit/tree and tracked working files before loading the existing native validator. No model, wallet or provider is needed. Install reviewed software normally; do not run an arbitrary checkout supplied with a dossier.

```sh
node scripts/successor/cli.mjs import-alpha-project project.json /ABSOLUTE/ALPHA_CHECKOUT en --map-public-data imported.json
node scripts/successor/cli.mjs advance-alpha-project imported.json /ABSOLUTE/ALPHA_CHECKOUT run executed.json
node scripts/successor/cli.mjs advance-alpha-project executed.json /ABSOLUTE/ALPHA_CHECKOUT select-and-draft 100 planned.json
node scripts/successor/cli.mjs inspect-alpha-project planned.json /ABSOLUTE/ALPHA_CHECKOUT
```

Choose `fr` at import for a French Manager mission and report. Outputs refuse overwrites. Import does not run the task. `run` executes the local deterministic Manager implementation and stops with no active selection. `select-and-draft` explicitly selects the locally checked candidate and creates an **unfunded USDC** proposal at the separately supplied price. `100` means 100 USDC, never a conversion from an Alpha/$AGIALPHA allowance. Gas, provider, human and economic costs remain unmeasured.

Mapping is explicit: Alpha `group` becomes Manager `category`; `amount` retains its integer units; every source row receives a distinct positional ID. Equal Alpha rows remain separate even when Manager's improved method deduplicates identical IDs. Oversized categories, unsupported integer text, private inputs or Manager input limits fail without truncation or rounding. The new proposal retains supplied rights as an unauthenticated declaration requiring review.

The transfer is bounded to 4 MB and eight Manager checkpoints. At capacity, retain/export the unchanged file. Neither history is pruned automatically. Recovery revalidates the native Alpha dossier and every Manager capsule, mission, hash and history prefix. It grants no authority.

Each capsule must contain the complete expected Manager source manifest,
including commit and ordered file hashes. Recomputed nested/outer checksums do
not authorize different provenance. Before executing Alpha's validator, the
adapter reads the closed 17-file inventory from the pinned Git object and checks
actual bytes and symlink boundaries, even when Git index flags hide edits.
Unavailable checkout directories and Git failures return a fixed error code;
their local paths and Git diagnostics are excluded from API and CLI errors.
Once a transfer has a selected candidate or USDC plan, `run` refuses it with
`EXPLICIT_NEW_CYCLE_REQUIRED`. Preserve that history and explicitly choose a new
native Alpha cycle for different work; selection is never silently retained or
reset by another run.

## Browser receiver and recovery

Open **Continue your Alpha project** in the [English Builder](https://montrealai.github.io/AGIJobManager/successor/#alpha-project) or [French Builder](https://montrealai.github.io/AGIJobManager/fr/successor/#alpha-project). These are intended routes; verify the deployed build commit before treating a candidate as published.

1. In Alpha, download the complete native project dossier. Select that JSON here. Inspection runs Alpha's actual pinned native project validator in a terminable, ten-second browser worker; nothing uploads or executes automatically.
2. Inspect the project/cycle identity. Explicitly approve unchanged integer units, positional row identities and public-input rights. **Continue this project here** retains the original UTF-8 dossier and creates an unexecuted Manager checkpoint.
3. **Run the same data in Manager** recomputes and checks all rows. Download and inspect the actual HTML/JSON reports. Original duplicate rows remain separate.
4. Enter a new proposed USDC budget and explicitly select the checked result. **Prepare my USDC draft** creates a local unfunded proposal. It neither converts $AGIALPHA nor authorizes a payment, worker reservation or independent review.
5. **Download complete project history** preserves the original Alpha dossier and all Manager checkpoints. **Save Alpha history in this browser** is optional, origin-specific convenience storage; keep a download too. Select the saved file or **Inspect saved Alpha history**, review the mapping and confirm to recover. Failed inspection preserves the open project. Clearing the saved Alpha copy leaves open work and downloads intact.

This panel has its own save/download controls. The Builder's separate native mission controls save their own workspace. Unsaved Alpha changes trigger the browser's standard leave-page prompt when supported. Switching interface language preserves transfer bytes.

The browser runs ten unchanged browser-safe upstream validator modules from the same reviewed Alpha pin; both Apache-2.0 and embedded Jobs MIT licenses and file hashes are retained under `site/assets/successor/vendor/alpha-project`. The Node adapter additionally verifies its supplied checkout's full closed inventory, tracked bytes and symlink boundaries before executing the native validator. Browser imports cannot supply code, URLs or source context. Every Manager capsule still requires the exact complete built source manifest, and every transition is replayed. `build/successor/MANAGER_CONTEXT.json`, produced by `node scripts/successor/build.mjs`, provides a source context for a separately reviewed consumer to pin; consumers must never trust a context taken from an imported dossier.

The initial uncompressed Builder remains below its existing 750 KB gate. Only the embedded editable-source inventory is gzip compressed. Its exact decompressed byte length and SHA-256 are checked before creating the offline source ZIP; imported project data is never decompressed. **Download editable source** requires browser `DecompressionStream('gzip')`. If absent, the interface explains the requirement and points to repository sources; work, reports and history remain available. The rebuilt offline edition includes the same native receiver and exact vendor sources.

The hosted receiver supplies local project continuity and USDC planning. Jobs v0/Fleet execution envelopes, actual paid commissioning, protected evaluation and independently controlled review require their own accepted integrations and evidence. Existing A1–A5 HOLD, qualification gates, signing approval and deployment checks remain in force. No cross-repository production commissioning is claimed.

The separately qualified [Alpha return adapter in PR #4820](https://github.com/MontrealAI/AGI-Alpha-Agent-v0/pull/4820)
can retain this transfer inside a new native Alpha cycle through a separate CLI
continuity envelope. Use its exact selected Manager revision; a source pin from
before this review correction is not interchangeable. The native project schema
and hosted journey remain separate from that optional receiver.

## Français

Cet adaptateur local conserve le dossier Alpha original, l'identité du projet et du cycle, ainsi que chaque étape Manager. Seul le CSV entier `group,amount` est pris en charge. La validation native Alpha et les contrôles Manager sont réellement exécutés; les examens importés restent historiques et non authentifiés.

Choisissez `fr` lors de l'importation. `run` recalcule les données localement, sans sélectionner de version. `select-and-draft` sélectionne explicitement le résultat vérifié localement et prépare une proposition **USDC non financée**, au prix indiqué séparément. Aucune conversion $AGIALPHA/USDC, signature, permission, évaluation protégée ou revue indépendante n'est créée. Les fichiers existants ne sont jamais remplacés.

Le parcours navigateur bilingue permet maintenant l’examen natif, la correspondance explicite, le recalcul réel, une proposition USDC non financée et la reprise de tout l’historique. Utilisez les commandes d’enregistrement Alpha de ce panneau et gardez un téléchargement complet. La réception Jobs v0, la délégation/revue Fleet et la mise en service payante exigent leurs propres validations.

Le récepteur CLI distinct de la [PR Alpha #4820](https://github.com/MontrealAI/AGI-Alpha-Agent-v0/pull/4820)
conserve le transfert dans un nouveau cycle au moyen d’une enveloppe séparée.
Utilisez sa révision Manager épinglée exacte; ce chemin ne termine pas l’interface
hébergée ni l’intégration des quatre dépôts.

Le manifeste source Manager complet est vérifié dans chaque capsule. Les 17
fichiers du validateur Alpha sont comparés à l’inventaire Git épinglé, même si
des indicateurs Git masquent une modification. Après sélection ou préparation
d’une proposition USDC, `run` refuse de relancer ce transfert : conservez son
historique et choisissez explicitement un nouveau cycle Alpha.
Un dossier indisponible ou une erreur Git produit un code fixe, sans chemin
local ni diagnostic Git dans les erreurs API ou CLI.
