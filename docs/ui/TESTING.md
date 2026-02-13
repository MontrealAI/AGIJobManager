# Testing

- `npm run test`: unit + property tests (status invariants, deadline fuzzing, URI sanitizer fuzzing, error decoding)
- `npm run test:e2e`: deterministic demo route coverage and CSV export check
- `npm run test:a11y`: axe audits
- `npm run test:headers`: response security headers
- `npm run docs:check`: docs completeness and Mermaid/SVG inline-image-scheme guards
- `node scripts/check-contract-drift.mjs`: ABI/contract interface drift
- `node scripts/check-no-binary.mjs`: binary extension guard
