# GitHub Pages Autopublish

The Sovereign Ops Console can be auto-published from CI as a text-only single-file application.

## Published URLs

- `https://montrealai.github.io/AGIJobManager/`
- `https://montrealai.github.io/AGIJobManager/agijobmanager.html`

Both files are identical content generated from `ui/dist-ipfs/index.html`.

## Workflow

Workflow file: `.github/workflows/pages.yml`.

On `push` to `main` (UI-related paths) or manual `workflow_dispatch`, the workflow:

1. Installs `ui/` dependencies.
2. Builds the single-file artifact via `npm run build:ipfs`.
3. Verifies the invariant via `npm run verify:singlefile`.
4. Copies output to:
   - `index.html`
   - `agijobmanager.html`
5. Force-pushes those two files to the `gh-pages` branch using `GITHUB_TOKEN` only.

## Operational Notes

- No release secrets are required beyond repository `GITHUB_TOKEN`.
- Output remains text-only HTML.
- Build outputs are **not** committed to `main`.
- Hash routing (`#/...`) remains compatible with GitHub Pages and IPFS gateways.
