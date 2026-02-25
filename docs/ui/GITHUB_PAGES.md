# GitHub Pages Autopublish

The UI can be deployed automatically to `gh-pages` using only `GITHUB_TOKEN` via `.github/workflows/pages.yml`.

## Trigger conditions

- Manual dispatch (`workflow_dispatch`)
- Pushes to `main` that touch UI/deployment workflow paths

## Deployment outputs

The workflow builds the single-file IPFS artifact and publishes two equivalent files:

- `index.html`
- `agijobmanager.html`

Hosted URLs:

- `https://montrealai.github.io/AGIJobManager/`
- `https://montrealai.github.io/AGIJobManager/agijobmanager.html`

## Operational notes

- Deployment is force-pushed to the `gh-pages` branch.
- Only text-based HTML files are published.
- The workflow runs `npm run build:ipfs` and `npm run verify:singlefile` before publish.
