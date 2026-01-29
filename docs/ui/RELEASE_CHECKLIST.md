# UI release checklist (AGIJobManager)

Use this checklist after deploying a new AGIJobManager contract on mainnet.

1) Record deployment details (network, address, deploy tx hash, timestamp) in `docs/deployments/`.
2) Update the UI’s known deployment reference (`docs/deployments/mainnet.json`).
3) Verify the UI against mainnet:
   - Connect wallet
   - Set contract address
   - Read snapshot values (owner, token, limits)
   - Run safe read-only checks or `staticCall` for create/apply/validate on a fork
4) Update the root README Web UI section with the canonical mainnet address (once known).
5) Publish/verify the GitHub Pages link.
6) Announce in release notes (tag/release or docs note).
