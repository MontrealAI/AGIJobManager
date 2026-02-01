# NFT Marketplace Guide

AGIJobManager mints an NFT receipt to the employer when a job completes. This NFT can be listed and sold using the built‑in marketplace.

## Step‑by‑step (non‑technical)
> **Screenshot placeholder:** Etherscan “Write Contract” tab showing `listNFT` inputs filled in.
### 1) List an NFT
Call `listNFT(tokenId, price)` from the wallet that owns the NFT.
- `price` is in AGI token wei.
- The listing becomes active immediately.

### 2) Purchase an NFT
The buyer must approve the AGIJobManager contract to spend the purchase amount.
Call `purchaseNFT(tokenId)` from the buyer wallet.
Marketplace purchases use ERC-721 safe transfer semantics.
If the buyer is a smart contract, it must implement `IERC721Receiver` /
`onERC721Received` or the purchase will revert.

### 3) Delist an NFT
If you change your mind before it sells, call `delistNFT(tokenId)` from the seller wallet.

## Common mistakes
- Listing price of 0 → `InvalidParameters`
- Listing from a non‑owner wallet → `NotAuthorized`
- Purchasing an inactive listing → `InvalidState`

## For developers
### Key functions
- `listNFT`
- `purchaseNFT`
- `delistNFT`

### Events to index
`NFTListed`, `NFTPurchased`, `NFTDelisted`
