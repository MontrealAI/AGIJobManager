# Glossary (short)

- **AGI token**: The ERC‑20 token used for job payouts and NFT purchases. Read its address from the contract.
- **Allowlist**: A list of approved wallet addresses. The owner can add wallets directly or via Merkle proofs.
- **Merkle root / proof / leaf**: The cryptographic root stored on‑chain, the proof you provide, and the hashed wallet address (leaf).
- **Subdomain label**: The short label only (e.g., `alice`). **Do not** enter the full ENS name.
- **Root node**: The fixed ENS root used by the contract to build full names from labels.
- **NameWrapper**: ENS contract that holds wrapped name ownership.
- **Resolver**: ENS resolver contract that maps a name to an address.
- **Job states**: Created → Assigned → CompletionRequested → Completed / Disputed / Cancelled.
- **Approval / Disapproval threshold**: Number of validator approvals/disapprovals needed to complete or dispute a job.
- **IPFS hash**: A content identifier (CID) pointing to job details or deliverables.
