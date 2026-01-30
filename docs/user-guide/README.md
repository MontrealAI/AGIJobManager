# User guide (non-technical)

Welcome! This guide is written for **non‑technical users** across all roles. You do **not** need to read Solidity to use AGIJobManager.

## Start here
- **Roles (Employer / Agent / Validator / Moderator / Owner)**: [`roles.md`](roles.md)
- **Happy‑path walkthrough** (step‑by‑step): [`happy-path.md`](happy-path.md)
- **Common revert reasons** (what went wrong + fixes): [`common-reverts.md`](common-reverts.md)
- **Merkle proofs & identity checks**: [`merkle-proofs.md`](merkle-proofs.md)
- **Glossary**: [`glossary.md`](glossary.md)

## How to use the system
You can interact using:
- **Web UI** (recommended): [`docs/ui/agijobmanager.html`](../ui/agijobmanager.html)
- **Etherscan** (read‑only + write with connected wallet)
- **Truffle console** (read‑only calls and troubleshooting)

> ⚠️ **Subdomain label only**: When the app asks for an identity **subdomain**, always enter the **label only** (e.g., `helper`, **not** `helper.agent.agi.eth`). The contract derives the full name from a fixed root node + label.

## Quick checklist
- ✅ Use the **correct network** and **official contract address**.
- ✅ Read the **token address** from the contract (don’t guess it).
- ✅ **Approve** token spend *before* creating a job or buying an NFT.
- ✅ If you’re an **Agent** or **Validator**, confirm eligibility via **allowlist**, **Merkle proof**, or **ENS** (see `merkle-proofs.md`).
