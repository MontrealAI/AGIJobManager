# Uploading job metadata (manual, provider-agnostic)

AGIJobManager’s UI is a **static** site. You must upload metadata JSON yourself and paste the resulting URI. The
manual flow works with any IPFS pinning provider and avoids storing secrets in the repo.

## Manual upload steps

1. Generate metadata JSON in the UI:
   - **Job Spec** → download `jobSpec.v1.json`
   - **Job Completion** → download `jobCompletion.v1.json`
2. Upload the JSON file to your preferred IPFS pinning service.
3. Copy the resulting URI (e.g., `ipfs://<cid>` or `https://...`).
4. Paste the URI into the UI and submit the on-chain transaction.

## URI format

- Full URIs are recommended: `ipfs://<cid>` or `https://<gateway>/ipfs/<cid>`
- The contract accepts CIDs, which are resolved with `baseIpfsUrl`.
- Avoid whitespace in URIs — the contract will revert.

## Optional provider shortcuts

The UI supports optional direct uploads via:

- **Pinata (JWT)**
- **NFT.Storage API key**

Credentials are stored **locally** in `localStorage` and never committed. If you prefer manual uploads, you can ignore
these options.
