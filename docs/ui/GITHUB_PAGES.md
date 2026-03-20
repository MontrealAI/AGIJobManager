# GitHub Pages Autopublish

The UI can be deployed automatically to `gh-pages` using only `GITHUB_TOKEN` via `.github/workflows/pages.yml`.

## Trigger conditions

- Manual dispatch (`workflow_dispatch`)
- Pushes to `main` that touch UI/deployment workflow paths

## Deployment outputs

The workflow publishes two Pages surfaces from two source artifacts:

- `index.html` and `agijobmanager.html` from `ui/dist-ipfs/agijobmanager.html`
- `agijobmanagerv0.html` from `ui/agijobmanager_genesis_job_mainnet_2026-03-05-v33.html`

Hosted URLs published by this workflow:

- `https://montrealai.github.io/AGIJobManager/agijobmanagerv0.html`
- `https://montrealai.github.io/AGIJobManager/`
- `https://montrealai.github.io/AGIJobManager/agijobmanager.html`

## Operational notes

- Deployment is force-pushed to the `gh-pages` branch.
- Only text-based HTML files are published, and `agijobmanagerv0.html` is published from the repo-pinned `v33` standalone artifact so the hosted Genesis Console matches the documented runbook path.
- Any root-domain alias outside `https://montrealai.github.io/AGIJobManager/` is external to this repository workflow and is not treated as the canonical repo-managed entrypoint.
- The workflow runs `npm run build:ipfs` and `npm run verify:singlefile` before publish.
