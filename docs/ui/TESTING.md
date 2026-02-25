# Testing & CI

## Command matrix
| Layer | Command | Purpose |
|---|---|---|
| Lint | `npm run lint` | Next + TS style discipline |
| Types | `npm run typecheck` | Strict type safety |
| Unit + property | `npm run test` | Status/deadline/URI/error invariants |
| Fuzz | `npm run test:fuzz` | fast-check role/state/URI sanitizer invariants |
| E2E | `npm run test:e2e` | Deterministic fixture navigation + role gating |
| Accessibility | `npm run test:a11y` | Axe checks across key routes |
| Security headers | `npm run test:headers` | CSP/headers contract |
| Docs versions | `npm run docs:versions` | Regenerates pinned dependency report |
| Docs contract | `npm run docs:contract` | Regenerates ABI interface report |
| Docs deployment | `npm run docs:deployment` | Regenerates official mainnet deployment registry report |
| Docs freshness | `npm run docs:check` | Required files, mermaid, assets, generated docs freshness |
| Build | `npm run build` | Production build health |
| IPFS build | `npm run build:ipfs` | Emits single-file `dist-ipfs/agijobmanager.html` |
| IPFS verification | `npm run verify:ipfs` | Enforces no external assets and strict static-hosting meta policy |
| Determinism | `npm run check:deterministic-build` | Builds twice; compares byte output and applies a narrow normalization for Next.js `buildId` injection before final hash check |
| No binaries | `npm run check:no-binaries` | Blocks forbidden extensions and binary content in added files |

CI workflow: `.github/workflows/ui.yml`.
