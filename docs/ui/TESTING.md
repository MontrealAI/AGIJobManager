# Testing

- `npm run test`: unit + property tests for status, deadlines, URI sanitizer, error decoding.
- `npm run test:e2e`: deterministic demo-mode route, banner, CSV checks.
- `npm run test:a11y`: axe scans across key pages.
- `npm run test:headers`: verifies CSP, nosniff, frame/referrer/permissions headers.
- `npm run docs:check`: docs completeness + Mermaid + SVG + stale checks.
- `node scripts/check-contract-drift.mjs`: UI ABI references remain aligned to Solidity source.
- `node scripts/check-no-binary.mjs`: enforces text-only assets.
