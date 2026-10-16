# Real browser acceptance

The original 122 deterministic tests remain `npm test`. Those tests and a DOM fixture do not establish browser acceptance. `test/browser-acceptance.mjs` runs Chromium with its sandbox enabled and builds a separate, temporary synthetic-device alias. Production code contains no browser hook for device injection; `scripts/browser-check-production.mjs` rejects fixture markers in production output. The test alias is never copied into `dist/` and no USB API is called.

Use the exact isolated test toolchain, without changing production Ledger SDK pins:

```sh
npm ci --ignore-scripts --no-fund --no-audit
npm ci --prefix scripts/browser-toolchain --ignore-scripts --no-fund --no-audit
node scripts/browser-toolchain/node_modules/playwright/cli.js install --with-deps chromium
npm test
npm run build
node scripts/browser-check-production.mjs
node test/browser-acceptance.mjs
```

`test/browser-smoke.mjs` additionally loads the real production bundle without requesting device access. Start `node scripts/serve.mjs` in another terminal before running that smoke. The workflow captures deterministic test output privately and emits only sanitized totals, so assertion failures cannot leak synthetic capability bytes into hosted logs. The workflow template performs both tests on an macOS 15 GitHub-hosted runner and uploads only `manual-ledger-evidence/browser-acceptance.json`. The runner must support Chromium sandboxing; do not add `--no-sandbox`, change identity, disable sandbox controls, or weaken CSP to make a blocked test pass.

The campaign cases use the actual local HTTP bridge and durable campaign engine with a frozen **synthetic test adapter**. They check UI integration and local recovery. They do not constitute genuine coordinator, provider, explorer, or physical Ledger qualification. The separate genuine-coordinator suite must provide that evidence. Large CREATE transport chunks in this fixture are a byte-integrity model, not real Ledger APDU/device acceptance.

The browser suite checks production-style CSP blocking, two numeric loopback origins, no signer network access to the bridge, source/account/path and recovered-signer failures, fixed error text, expiry before and after signature, private recovery and minimal import, blocked downloads, duplicate requests, loss of the import response, refresh/recovery, stale auth sessions, canonical-result changes, and manually approved progression. Every synthetic capability remains in process memory or an owner-only temporary directory which is removed after the case. Test output and retained evidence include only fixed case names, counters and pass/fail metadata. Do not enable traces, HAR files, console dumps, screenshots of signed bytes, or arbitrary crash artifacts for these tests.

Local environment on 2026-10-16: matched Playwright 1.62.1 browser installation returned an invalid/truncated download from the official CDN. A pre-existing cached Chromium was also tested with sandboxing enabled and refused the root environment before page load. No browser assertions ran locally. See `manual-ledger-evidence/browser-environment.json`; the reproducible supported CI workflow is the fallback, and is not evidence of a pass until its actual run is recorded.

# Acceptation dans un navigateur réel

Les 122 tests déterministes sont conservés; ils ne prouvent pas l'acceptation du navigateur. La suite Chromium active le bac à sable et utilise un appareil synthétique uniquement dans une compilation de test temporaire. Aucun appel USB, aucune signature réelle ni aucun envoi réseau Ethereum n'est effectué. La compilation de production exclut ce dispositif.

Le tableau de bord et le signataire utilisent deux origines numériques de bouclage distinctes. Les cas de campagne passent par le vrai serveur et le moteur durable locaux avec un adaptateur synthétique. La validation du coordinateur réel, du fournisseur, de l'explorateur et de l'appareil physique reste distincte. Les capacités signées synthétiques ne figurent jamais dans les résultats publics.

L'environnement local a bloqué Chromium avant le chargement de la page. La tâche CI fournie installe la version exacte du navigateur sur un exécuteur GitHub macOS compatible. Aucun résultat CI ne doit être annoncé avant son exécution réelle. Ne désactivez jamais le bac à sable ni la politique CSP pour transformer un blocage en réussite.

Hosted Ubuntu 24.04 attempt on head `a8f9f161abb8086ea8b6859b0a0b210b2fa41e7f`, run `38927525745`: dependencies, matched browser installation, 279 deterministic tests and production build passed. Chromium then stopped before page load with **No usable sandbox**, citing Ubuntu AppArmor/user-namespace restrictions. No security controls were changed. The revised job uses a standard supported macOS 15 hosted runner with `chromiumSandbox:true` and unchanged CSP; acceptance remains pending its actual run.

The initializer resolves the runner temporary directory to its own canonical path before strict no-symlink tests. macOS commonly exposes that same directory through a `/var` alias. This changes only test environment path spelling; path guards, permissions, private-store checks and Chromium sandboxing stay enabled. Production source is unchanged.
