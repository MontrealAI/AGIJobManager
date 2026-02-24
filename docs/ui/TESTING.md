# Testing & CI

## Command matrix
| Layer | Command | Purpose |
|---|---|---|
| Lint | `npm run lint` | Next + TS style discipline |
| Types | `npm run typecheck` | Strict type safety |
| Unit + property | `npm run test` | Status/deadline/URI/error invariants |
| E2E | `npm run test:e2e` | Deterministic fixture navigation + role gating |
| Accessibility | `npm run test:a11y` | Axe checks across key routes |
| Security policy | `npm run test:security` | IPFS CSP/meta/no-inline-handler assertions |
| Docs versions | `npm run docs:versions` | Regenerates pinned dependency report |
| Docs contract | `npm run docs:contract` | Regenerates ABI interface report |
| Docs deployment | `npm run docs:deployment` | Regenerates official mainnet deployment registry report |
| Docs freshness | `npm run docs:check` | Required files, mermaid, assets, generated docs freshness |
| Build (IPFS) | `npm run build:ipfs` | Generates single-file `ui/dist-ipfs/index.html` |
| Build verification | `npm run verify:ipfs` | Asserts single-file + no external/relative assets |
| No binaries | `npm run check:no-binaries` | Blocks forbidden extensions and binary content in added files |

CI workflow: `.github/workflows/ui.yml`.
