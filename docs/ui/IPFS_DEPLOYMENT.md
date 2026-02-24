# IPFS Deployment (Single-File Artifact)

The Sovereign Ops Console ships as **one self-contained HTML file** suitable for direct pinning on IPFS.

## Build

```bash
cd ui
npm ci
npm run build:ipfs
npm run verify:ipfs
```

Expected artifact:
- `ui/dist-ipfs/index.html`

## Publish

From repository root:

```bash
ipfs add ui/dist-ipfs/index.html
```

Use hash routing (`#/...`) in gateway URLs so route refreshes remain stable.

## Security checks

Before publishing:

```bash
cd ui
npm run test:security
```

This asserts:
- CSP meta tag exists and includes `frame-ancestors 'none'`.
- strict referrer policy meta tag exists.
- no inline event handlers.
- no external local asset references.
