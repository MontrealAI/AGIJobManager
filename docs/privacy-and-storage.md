# Privacy‑first storage & UX options

This guide explains how to publish job documents while protecting sensitive data.

## Privacy modes (choose one)

### 1) Public‑by‑default (IPFS/Arweave)
- **Best for**: open research, public bounties.
- **Trade‑offs**: everything is public forever once pinned.

### 2) Public receipt + private artifacts (recommended)
- **Best for**: most real‑world employers.
- **How it works**: publish public **spec + completion** receipts, but keep sensitive artifacts behind gated links.
- **ENS** points to public receipts + **integrity hashes** for private files.

### 3) Fully managed storage (best UX)
- **Best for**: non‑technical users and enterprise workflows.
- **How it works**: a trusted platform stores files and issues receipts.
- **Trade‑offs**: centralized custody; requires a privacy agreement.

## DO / DON’T (privacy)

**Do**
- Store **public receipts** and **hashes** on ENS.
- Keep sensitive files behind private links or access control.
- Use the `agijobs.integrity` record to publish hashes/CIDs.

**Don’t**
- Put secrets or private URLs in ENS text records.
- Assume IPFS or Arweave is private (it isn’t).

## ENS records are public
ENS text records are public and indexed. **Never store secrets** in `text:` records. Instead, store **pointers** to public receipts and **hashes** for verification.

## How documents get published (realistic patterns)

**Does an employer need an IPFS account?**
- **Not necessarily.** IPFS can be handled by a platform, a relay, or a pinning provider on the user’s behalf.

**Can the platform be just a static site?**
- **Yes, for browsing and read‑only flows.**
- **No, for uploads that require authentication or payment** (someone must pin/pay).

### Serverless‑friendly patterns
1. **User‑provided pinning key** (most decentralized, worst UX)
   - The user provides their own Pinata/web3.storage key.
   - The UI uploads directly.

2. **Wallet‑signed upload to a relay** (balanced)
   - User signs an upload request.
   - A relay pins on their behalf (still off‑chain infrastructure).

3. **Managed pinning by the platform** (best UX)
   - The platform pays and pins.
   - Users get the easiest flow, at the cost of centralization.

> **No free pinning**: someone pays for storage. Choose who funds it and document that choice.
