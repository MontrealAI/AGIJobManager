# Continue an Alpha project in Manager

This optional local adapter carries the original Alpha project dossier into a separate Manager working history. It supports Alpha's `public-data` integer CSV task. Other mission families are rejected. The receiver runs the pinned Alpha project validator, then uses Manager's own mission validator, execution engine and separate artifact checker. A checksum alone is insufficient.

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
Once a transfer has a selected candidate or USDC plan, `run` refuses it with
`EXPLICIT_NEW_CYCLE_REQUIRED`. Preserve that history and explicitly choose a new
native Alpha cycle for different work; selection is never silently retained or
reset by another run.

This adapter does **not** finish the four-repository flagship. The native Alpha project reader does not yet ingest the Manager transfer as a new Alpha cycle. The project handoff has not yet been integrated into the hosted bilingual journey, Jobs v0 receiver, Fleet execution/review envelope or protected evaluation. Existing lower-level commissioning paths remain separate. No cross-repository production commissioning is claimed.

The separately qualified [Alpha return adapter in PR #4820](https://github.com/MontrealAI/AGI-Alpha-Agent-v0/pull/4820)
can retain this transfer inside a new native Alpha cycle through a separate CLI
continuity envelope. Use its exact selected Manager revision; a source pin from
before this review correction is not interchangeable. The native project schema
and hosted journey remain separate from that optional receiver.

## Français

Cet adaptateur local conserve le dossier Alpha original, l'identité du projet et du cycle, ainsi que chaque étape Manager. Seul le CSV entier `group,amount` est pris en charge. La validation native Alpha et les contrôles Manager sont réellement exécutés; les examens importés restent historiques et non authentifiés.

Choisissez `fr` lors de l'importation. `run` recalcule les données localement, sans sélectionner de version. `select-and-draft` sélectionne explicitement le résultat vérifié localement et prépare une proposition **USDC non financée**, au prix indiqué séparément. Aucune conversion $AGIALPHA/USDC, signature, permission, évaluation protégée ou revue indépendante n'est créée. Les fichiers existants ne sont jamais remplacés.

L’interface hébergée, la réception Jobs v0 et la délégation/revue Fleet restent à intégrer et à qualifier.

Le récepteur CLI distinct de la [PR Alpha #4820](https://github.com/MontrealAI/AGI-Alpha-Agent-v0/pull/4820)
conserve le transfert dans un nouveau cycle au moyen d’une enveloppe séparée.
Utilisez sa révision Manager épinglée exacte; ce chemin ne termine pas l’interface
hébergée ni l’intégration des quatre dépôts.

Le manifeste source Manager complet est vérifié dans chaque capsule. Les 17
fichiers du validateur Alpha sont comparés à l’inventaire Git épinglé, même si
des indicateurs Git masquent une modification. Après sélection ou préparation
d’une proposition USDC, `run` refuse de relancer ce transfert : conservez son
historique et choisissez explicitement un nouveau cycle Alpha.
