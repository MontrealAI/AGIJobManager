# GitHub Pages — publishing and maintenance

The repository’s public entry point is [AGI Jobs](https://montrealai.github.io/AGIJobManager/), with a [French homepage](https://montrealai.github.io/AGIJobManager/fr/), dedicated employer onboarding in [English](https://montrealai.github.io/AGIJobManager/employers/) and [French](https://montrealai.github.io/AGIJobManager/fr/employers/), and the [current USDC console](https://montrealai.github.io/AGIJobManager/agijobmanager-usdc.html).

The homepage explains participant roles, the job lifecycle, illustrative work, exact base USDC allocation, historical mainnet evidence, and where to find the right guide. It does not connect a wallet, make RPC requests, collect analytics or send transactions. The linked console is the existing transaction interface and retains its own behavior and notices.

The employer page provides bilingual guided drafting, payment illustrations, explicit local draft controls, a JSON brief download and an explicit handoff to the console's saved builder draft. It makes no wallet or RPC connection and does not publish a job. The console still requires **Load saved draft**, metadata publication, deployment checks and separate transaction review. See the [employer onboarding guide](EMPLOYER_ONBOARDING.md), including the measured scaling work required beyond static page delivery.

## One-time GitHub setting

In this repository, open **Settings → Pages → Build and deployment → Source**, and select **GitHub Actions**. Keep the default project URL and HTTPS. No custom domain, personal access token or `gh-pages` branch is needed.

The [GitHub Pages workflow](../../.github/workflows/pages.yml) builds, validates and uploads an artifact, then deploys it using GitHub’s Pages environment and short-lived OIDC authorization. Build and pull-request jobs have read-only repository access; only the main-branch deployment job has Pages write and ID-token permissions.

## Publish an update

1. Edit the source files below on a branch.
2. Open a pull request and wait for its checks, including **GitHub Pages / Build and check website**.
3. Merge the reviewed change into `main`. Changes to website sources, published consoles, documentation, registry, package metadata or the workflow trigger publication.
4. Open **Actions → GitHub Pages**, select the matching commit, and confirm that **Publish GitHub Pages** succeeds.
5. Open the website and [build-info.json](https://montrealai.github.io/AGIJobManager/build-info.json). Its `sourceCommit` must match the deployed commit.

To republish without editing, use **Actions → GitHub Pages → Run workflow → main**. Pull requests validate but never deploy. Manual runs on other branches do not deploy. Publishing the website does not publish a GitHub release, configure a live manager or activate intake.

## Source map

| Source | Purpose |
| --- | --- |
| `site/content/en.json` and `site/content/fr.json` | English and French copy; update both for shared facts |
| `site/template.mjs` | Semantic page layout and links |
| `site/employers.mjs` | English/French employer page layout, copy, starter templates and guidance |
| `site/assets/style.css` | Responsive purple visual design, keyboard focus and reduced-motion support |
| `site/assets/app.mjs` | Role selection, guide filtering, copy control and calculator interaction |
| `site/assets/employer.css` | Responsive employer form, progress and preview styling |
| `site/assets/employer.mjs` | Guided form, explicit local persistence, export and console handoff |
| `site/assets/employer-model.mjs` | Pure draft validation, exact amounts, serialization and console draft conversion |
| `site/assets/payments.mjs` | BigInt USDC amounts, whole-percent rates and six-decimal formatting |
| `scripts/site/build.mjs` | Dependency-free static build into ignored `build/pages/` |
| `scripts/site/check.mjs` | Local paths, fragments, copy identity, invalid inputs and allocation checks |
| `scripts/site/browser-test.mjs` | English/French interaction checks at 390, 768 and 1440 pixels, plus no-JavaScript content |
| `config/usdc-deployment.json` | Registry status and payment assumptions; no default manager is injected into the console |
| `docs/releases/v1.14.0/MAINNET_EVIDENCE.json` | Explicitly dated historical mainnet observation, not current chain status |
| `site/standards/` | Optional standards pages included when present |

The source version comes from `package.json`. Documentation links and the footer are pinned to the build commit. Historical evidence remains tied to its original file and observation block. A future change in registry payment assumptions stops the build so the calculator and copy must be reviewed. No live-state claim is inferred from historical readiness.

## Local checks

From the repository root with its supported Node.js version:

```bash
node scripts/site/build.mjs
node scripts/site/check.mjs
node --check site/assets/app.mjs
node --check site/assets/employer.mjs
node --check site/assets/employer-model.mjs
```

For the browser checks, install the repository’s existing test dependencies and browser, then run:

```bash
npm ci
npx playwright install --with-deps chromium
node scripts/site/browser-test.mjs
```

The browser suite serves only the generated directory under the real `/AGIJobManager/` base path. It checks role selection, calculator errors and six-decimal values, search results, FAQs, language switching, console navigation, JavaScript exceptions and horizontal overflow. The no-JavaScript view retains guides and all role instructions; interactive controls start disabled or hidden.

## Published routes

| Route under `/AGIJobManager/` | Content |
| --- | --- |
| `/` | English homepage |
| `fr/` | French homepage; linked technical guides and console are in English |
| `employers/` | English guided employer onboarding and local job brief builder |
| `fr/employers/` | French guided employer onboarding; the linked console and technical guides are in English |
| `agijobmanager-usdc.html` | Byte-identical copy of `ui/agijobmanager-usdc.html` |
| `agijobmanagerv0.html` | Preserved compatibility alias for that same current USDC console |
| `agijobmanager.html` | Preserved committed single-file React interface from `ui/dist-ipfs/agijobmanager.html` |
| `build-info.json` | Source commit, version, source paths, published file sizes and SHA-256 digests |
| `404.html` | Return-to-home page |
| `sitemap.xml` | Homepage and employer onboarding language URLs |

These hosted consoles follow the publishing commit. For an immutable release, use [release assets](https://github.com/MontrealAI/AGIJobManager/releases) and verify their checksums. The existing UI CI remains responsible for reproducing and qualifying the committed React artifact. The Pages builder does not silently rebuild it with a different configuration.

Optional AEP-002 publication uses the same complete-site builder and deployment concurrency group, preserving the homepage instead of replacing the whole site with only a standards directory. Existing protocol flowcharts and console sources are preserved.

## If publication fails

- **404 before the first deployment:** confirm the Pages source is **GitHub Actions** and the deployment job has succeeded, then allow for propagation.
- **Configure Pages says the site does not exist:** select **GitHub Actions** in the repository’s Pages settings, then rerun the failed workflow.
- **Build or browser check fails:** inspect the named step and fix the content, path or interaction before publishing. The failed build does not replace the published site.
- **Deployment awaits an environment approval:** complete the repository’s existing `github-pages` approval policy; do not weaken it.
- **The page looks old:** compare `build-info.json` with the successful deployment commit and reload without cached assets.
- **Need to undo a website change:** revert its commit through a reviewed pull request and let the main workflow redeploy. Do not rewrite source history or force-push a deployment branch.

Root-domain aliases outside this repository’s project path are managed separately.
