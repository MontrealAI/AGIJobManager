# Browser, recovery and trusted-Mac acceptance

The hosted job uses **macOS 15**, Node **22.23.2**, isolated Playwright **1.62.1** and its matched Chromium with `chromiumSandbox:true`. Production Ledger SDK pins remain unchanged. The workflow checks out the exact PR head and binds retained metadata to that commit and run ID. No test asks for a real USB device, signs with a physical Ledger or contacts an Ethereum RPC.

Reproduce on a supported host:

```sh
npm ci --ignore-scripts --no-fund --no-audit
npm ci --prefix scripts/browser-toolchain --ignore-scripts --no-fund --no-audit
node scripts/browser-toolchain/node_modules/playwright/cli.js install --with-deps chromium
node scripts/browser-regression-check.mjs
npm run build
node scripts/browser-check-production.mjs
node test/browser-acceptance.mjs
```

For the production page/CSP smoke, start `node scripts/serve.mjs` in another terminal, then run `node test/browser-smoke.mjs`. The exact hosted steps are in `scripts/browser-acceptance.workflow.yml`. Do not disable sandboxing, weaken CSP, replace SDK context or add a runtime device stub to force a pass.

`test/browser-acceptance.mjs` builds a temporary synthetic-device alias. Production output excludes that alias and `scripts/browser-check-production.mjs` checks for fixture markers. The isolated signer uses a separate numeric-loopback origin and `connect-src 'none'`; the browser suite verifies that it cannot fetch the dashboard API or an external endpoint. Test-only capabilities stay in process memory or owner-only temporary directories removed after the case. Do not publish traces, HARs, capability screenshots, console dumps or arbitrary crash artifacts.

Campaign browser cases exercise the real HTTP server and durable campaign engine with a frozen **synthetic coordinator adapter**. Known packet-schema strings test Manager JSON versus Alpha raw-text export formatting; they do not reproduce a native revision. Acceptance covers cancellation, disconnection, changed account/path/source, expiry before and after signature, blocked downloads, repeated clicks, unsigned observation, browser reload, bridge restart, lost import acknowledgement, interrupted relay and lost relay response. Restart checks preserve the exact capability file and every earlier journal record; recovery neither reimports nor resubmits. A lost import response can require a browser reload after read-only acknowledgement recovery before a separately authorized first relay is offered. No missing receipt authorizes another submission.

The native coordinator suite and physical-device sheet are separate. A synthetic transport-chunk test establishes byte integrity in that model; it does not qualify Ledger APDUs, display semantics or the largest real CREATE. Physical Ledger acceptance is **NOT PERFORMED**; see `PHYSICAL_ACCEPTANCE_EN_FR.md`.

## Independent compiler check

The hosted Mac job also downloads the fixed official soljson distribution from `argotorg/solc-bin` commit `8d513ea2ab6b4f6c29ee3373125080bed89224be`, checks SHA-256 `d73fead3cbc860438f56f4d1723677499cdef212d0f8890241748d2d5afc1c5f`, then runs:

```sh
COMPANION_TEST_SOLJSON=/absolute/path/to/official-soljson.cjs COMPANION_REQUIRE_COMPILER=1 node --test --test-concurrency=1 test/trusted-mac.test.mjs
```

This uses a genuine compiler and synthetic Solidity source to test independent reproduction, linked libraries, immutable references, exact CREATE binding and tamper/restart guards. It is not native Manager or Alpha contract qualification. Without the explicit compiler path, optional compiler cases are skipped; the sanitized regression report exposes skipped, cancelled and todo counts. Required compiler acceptance fails when the compiler is absent. A native-compiler equality case runs only when `COMPANION_TEST_NATIVE_SOLC` is supplied and otherwise appears as skipped.

Only sanitized browser, regression and compiler metadata are uploaded. Assertion output stays redacted. The compiler distribution is pinned to official release bytes; another distribution reporting the same Solidity version has a different identity and needs its own independently reviewed pin.

## Evidence history

The earlier exact head `6eeac125ae69d68c6a67291604541fd887f76a85` passed 38 synthetic-device browser cases on macOS 15, run `38929422465`. That historical result does not certify this changed source. An earlier Ubuntu 24.04 run `38927525745` stopped before page load with no usable Chromium sandbox; no security controls were disabled. Local execution in this workspace still blocks before page load and executes zero browser assertions. Only an actual completed run on the new source can qualify its browser cases.

## Français

La tâche macOS 15 utilise les versions exactes de Node, Playwright et Chromium, avec le bac à sable activé. Les tests du navigateur emploient un appareil et un adaptateur de coordinateur synthétiques dans une compilation temporaire. Ils testent le vrai serveur local et le journal durable, sans USB réel ni RPC Ethereum. Les deux formats d'import, les annulations, déconnexions, changements de compte/source, expirations, accusés perdus et redémarrages sont vérifiés séparément des coordinateurs natifs et de l'appareil physique.

Le compilateur officiel est téléchargé depuis un commit fixe et son empreinte est vérifiée avant les essais de reproduction sur source Solidity synthétique. Les essais ignorés restent visibles dans les compteurs. Ces résultats ne qualifient pas les contrats natifs. Aucune qualification physique n'est déclarée; aucun échec de sandbox ou de CSP n'est contourné. Une reprise en lecture seule conserve la capacité et la tentative exactes; elle n'importe ni n'envoie de nouveau automatiquement.
