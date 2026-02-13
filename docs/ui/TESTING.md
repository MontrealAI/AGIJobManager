# UI Testing

## Commands
```bash
cd ui
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run test:a11y
npm run test:headers
npm run docs:versions
npm run docs:check
node scripts/check-no-binaries.mjs
npm run build
```

## Matrix
| Suite | Tooling | Purpose |
|---|---|---|
| Unit | vitest | status derivation, deadlines, URI safety, errors |
| Property | fast-check | fuzz invariants for states/deadlines/URIs |
| E2E | Playwright | deterministic fixture navigation and role gates |
| Accessibility | axe + Playwright | serious/critical violations are blocked |
| Headers | Playwright request | CSP and mandatory response headers |
| Docs freshness | docs:check | required files, mermaid presence, versions sync, SVG validation |
| Binary guard | check-no-binaries | fail on forbidden added extensions |
