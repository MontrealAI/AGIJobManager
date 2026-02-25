# IPFS Deployment (Single-File Artifact)

The Sovereign Ops Console ships as exactly one HTML file for deterministic pinning.

## Build

From repository root:

```bash
cd ui
npm ci
npm run build:ipfs
npm run verify:singlefile
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

## Security controls in artifact

The generated HTML includes:

- CSP meta policy with `frame-ancestors 'none'`
- Referrer policy meta tag
- Inlined JavaScript and CSS only
