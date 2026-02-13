# Testing & CI

## Command matrix
| Layer | Command | Purpose |
|---|---|---|
| Lint | `npm run lint` | Next + TS style discipline |
| Types | `npm run typecheck` | Strict type safety |
| Unit + property | `npm run test` | Status/deadline/URI/error invariants |
| E2E | `npm run test:e2e` | Deterministic fixture navigation + role gating |
| Accessibility | `npm run test:a11y` | Axe checks across key routes |
| Security headers | `npm run test:headers` | CSP/headers contract |
| Docs freshness | `npm run docs:check` | Required files, mermaid, assets, versions freshness |
| Build | `npm run build` | Production build health |
| No binaries | `node scripts/check-no-binaries.mjs` | Blocks forbidden extensions in added files |

CI workflow: `.github/workflows/ui.yml`.
