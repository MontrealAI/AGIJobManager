# IPFS Deployment (Single-File Artifact)

The Sovereign Ops Console ships as exactly one HTML file for deterministic pinning.

## Build

From repository root:

```bash
cd ui
npm ci
npm run build:ipfs
npm run verify:singlefile
npm run check:deterministic-build
```

Expected output:

- `ui/dist-ipfs/agijobmanager.html`

## Publish

```bash
ipfs add ui/dist-ipfs/agijobmanager.html
```

Use the returned CID with a gateway URL:

```text
https://ipfs.io/ipfs/<CID>
```

Hash-based navigation is used, so routes like `#/jobs/1` are gateway-safe.

## Determinism note

`npm run check:deterministic-build` performs two consecutive builds. Because Next.js injects a per-build `buildId` into bootstrap payloads, the script computes both raw hashes and a normalized stable hash with only `buildId` redacted. The normalized hash must match.

## Security controls in artifact

The generated HTML includes:

- CSP meta policy with `frame-ancestors 'none'`
- Referrer policy meta tag
- Inlined JavaScript and CSS only
