# GitHub Pages Autopublish

The UI can be deployed automatically to `gh-pages` using `GITHUB_TOKEN` via `.github/workflows/pages.yml`. This publishes browser files, not Ethereum contracts. For reproducible current USDC operations, start with the [immutable v0.9.6 release](https://github.com/MontrealAI/AGIJobManager/releases/tag/v0.9.6) and verify checksums; no live manager is configured by default.

## Trigger conditions

- Manual dispatch (`workflow_dispatch`)
- Pushes to `main` that touch UI/deployment workflow paths

## Deployment outputs

The workflow publishes two Pages surfaces from two source artifacts:

- `index.html` and `agijobmanager.html` from `ui/dist-ipfs/agijobmanager.html`
- `agijobmanagerv0.html` from `ui/agijobmanager-usdc.html`

Hosted URLs published by this workflow:

- `https://montrealai.github.io/AGIJobManager/agijobmanagerv0.html`
- `https://montrealai.github.io/AGIJobManager/`
- `https://montrealai.github.io/AGIJobManager/agijobmanager.html`

## Operational notes

- Deployment is force-pushed to the `gh-pages` branch.
- Only text-based HTML files are published. `agijobmanagerv0.html` is a historical filename retained as a compatibility alias for current `ui/agijobmanager-usdc.html`. Its content follows the publishing commit and can change with `main`; the filename is not release provenance.
- Any root-domain alias outside `https://montrealai.github.io/AGIJobManager/` is external to this repository workflow and is not treated as the canonical repo-managed entrypoint.
- The workflow runs `npm run build:ipfs` and `npm run verify:singlefile` before publish.
