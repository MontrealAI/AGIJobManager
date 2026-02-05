# NFT Trading Guide

AGIJobManager mints an NFT receipt to the employer when a job completes. The contract does **not** include an internal marketplace.

## How to trade
Use standard ERC‑721 marketplaces (e.g., OpenSea) or direct transfers with:
- `approve` / `setApprovalForAll` to grant a marketplace transfer permission.
- `transferFrom` / `safeTransferFrom` for direct transfers.

## Common mistakes
- Attempting to use removed in‑contract listing/purchase functions (they no longer exist).
- Approving the wrong contract address or spending more than intended.
