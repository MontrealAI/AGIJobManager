# SUCCESSOR Ω Builder for everyone

Create useful local work, inspect it, improve it and keep it. Open the [English Builder](https://montrealai.github.io/AGIJobManager/successor/) or [Créateur français](https://montrealai.github.io/AGIJobManager/fr/successor/). These are the intended published routes; check the website build commit before treating a candidate as deployed.

The local path needs a modern desktop browser with JavaScript, Web Workers and Web Crypto. No installation, account, wallet, network provider or API key is required after downloading the HTML. This release supplies two reviewed deterministic engines, not an arbitrary task agent or a hosted model.

## Your first working system

1. Choose **Public-data analyst** and **Try an example**. You can leave the name blank. Review the public-data notice, then **Create & run my Ω**.
2. Inspect the report and download its HTML and JSON. The baseline accurately counts every row, including repeated IDs. **Keep this version** selects it locally.
3. Read the detected repeated-ID gap. **Try the local improvement** counts identical repeated IDs once and rejects conflicting duplicates. Inspect the changed totals and separate checker results. Choose whether to keep the improved version or retain the original. A tie cannot replace the incumbent.
4. Optionally prepare an improvement request with an explicit proposed USDC budget. The request is local and unfunded. Its exact inputs, checks and costs are included in your capsule; no public metadata or transaction is created.
5. Choose **Download my Ω** and **Download capsule**. Open the downloaded HTML in a fresh desktop browser context. Review its restore preview and explicitly confirm. Review the inputs, confirm their public/nonpersonal nature and rerun. The same selected variant produces the same artifact bytes.
6. Use **Go back to previous version** to restore the earlier selection. Download again after later changes: the already saved HTML does not update itself.

Repeat with **Accessible website**. Edit the title, introduction and sections. The first version has headings and readable content; the improvement adds direct section navigation. Download `index.html` to edit or host yourself. The sandboxed preview has no script, network or form-submission permission. Automated structural checks do not certify universal accessibility.

For your own analyst data, use CSV with exactly `id,category,value`, or a JSON array of objects with those exact fields. Values are decimal **strings** in JSON, with up to six fractional digits. The engine computes counts, sum, minimum and maximum per category using integer arithmetic. Limits: 120 KB input, 1,000 rows, 12 candidates, 100 Chronicle events, 300 KB per output, 4 MB capsule and 10 seconds per browser operation. Use only public, licensed, synthetic, nonpersonal material. Examples are in [examples/successor](../../examples/successor).

A **custom mission** records your goal, public sources/rights, outputs, tools/restrictions and success criteria. You can keep, export and plan it. Its execution remains unavailable until the required runtime and checks exist. Provider-assisted mode and operational admission are unavailable in this local edition.

## Keep, restore and recover

- **Download my Ω:** self-contained HTML with both interface languages, reviewed engine, current capsule, editable source and licenses. No hidden calls home. Changing interface language preserves your text; it does not translate it.
- **Download capsule:** strict versioned JSON containing inputs, candidate manifests, actual outputs/checks, proposed costs, selected version and Chronicle. Imported code never executes.
- **Download editable source:** a ZIP with the browser engine, source manifest, MIT license, dependency-free tests and build instructions. With Node 22.23.2 or later, run `node --test scripts/successor/portable.test.mjs`, then `node scripts/successor/build.mjs --out rebuilt`. Import the separate capsule into the rebuilt HTML.
- **Save in this browser:** optional, namespaced local storage. It is neither a backup nor a private vault. **Inspect saved work** uses the same validate → preview → confirm flow. **Clear saved work** does not erase downloads or public/on-chain records.
- **Stop:** terminates the current browser worker. A previous selection remains available. Rejected improvements retain a stable failure code in the Chronicle. Malformed inputs are reported without erasing form text.

Keep original downloads before editing. Checksums detect changes against a checkpoint you retained; local editable files do not prove authorship, independent control or tamper resistance. Restore selects local history only; it cannot restore signing authority or undo external effects. There is no migration from unknown capsule versions: keep the old reader and export, and review a future explicit migrator before use.

## Optional AGIJobManager handoff

The advanced request reuses the repository's employer model and exact six-decimal USDC arithmetic. At the illustrative shared 8% review allocation, 100 USDC splits into 8 for all reviewers together, 30 and 10 for the recipients, and 52 for the Agent. The zero-validator buyer-acceptance branch gives the Agent 60. Actual job policy, rounding, bonds and claims must be read separately. Gas, provider, hosting, independent review, maintenance and unwind remain unknown until priced. A repair allowance is additional; avoid double counting costs already included by an operator.

Preview the full draft, then explicitly choose console handoff. If a console draft exists, download that exact draft and confirm replacement first. Open the existing console and use **Load saved draft**. File-mode users can download the request and review the operator path separately; local storage does not cross origins. A downloaded file is not a public specification URL. This Builder cannot fund, assign, vote, settle, reserve workers, grant authority or close the recorded A1–A5 HOLD.

## Troubleshooting and support limits

If storage is denied, continue using downloads. If downloads are blocked, allow the specific download or print the summary; printing does not create an executable backup. Without JavaScript, help and navigation remain readable but computation is disabled. If a worker or Web Crypto is unavailable, use a supported desktop browser or the CLI; never interpret a blank result as success. If data is rejected, check the displayed error code, exact headers, decimal strings, duplicate IDs and input limits. Do not remove private-data checks to import sensitive content.

Chromium desktop is exercised automatically. Responsive layouts are tested at 320, 390, 768 and 1440 CSS pixels; these are viewport tests, not real phone tests. Mobile file preview applications may not execute downloaded HTML. Firefox, Safari, actual low-end devices, screen-reader user sessions and representative older/nontechnical users require the separate validation in [acceptance evidence](ACCEPTANCE.md).

Users keep their files and configuration subject to MIT and third-party licenses and commissioned-work terms. This does not transfer exclusive rights to hosted models, brands, company equity or tokens. See [architecture and adapters](ARCHITECTURE.md), [security](SECURITY.md), [compatibility](COMPATIBILITY.md), [French guide](GUIDE_FR.md) and [acceptance/external gates](ACCEPTANCE.md).
