# User guide (non-technical)

Welcome! This guide set is written for non-technical users in **any** role. You do **not** need to read Solidity to succeed.

## Start here

1. **Roles & permissions** → [`roles.md`](roles.md)
2. **Happy path walkthrough** → [`happy-path.md`](happy-path.md)
3. **Common revert reasons (fixes)** → [`common-reverts.md`](common-reverts.md)
4. **Merkle proof guidance** → [`merkle-proofs.md`](merkle-proofs.md)
5. **Glossary** → [`glossary.md`](glossary.md)

## Preferred ways to use the system

- **Web UI (recommended for non-technical users):**
  - UI page: [`docs/ui/agijobmanager.html`](../ui/agijobmanager.html)
  - UI usage guide: [`docs/ui/README.md`](../ui/README.md)
- **Wallet + Etherscan “Read/Write Contract”** for simple tasks.
- **Truffle console** for read-only checks when you need more detail.

## ⚠️ Important safety notes

- **Use the label only, not the full ENS name.**
  - ✅ `helper`
  - ❌ `helper.agent.agi.eth`
  - ✅ `alice`
  - ❌ `alice.club.agi.eth`
  The contract derives the namehash from a fixed root node + label only.
- **Approvals are real on-chain actions.** Approving ERC‑20 spending allows the contract to move your tokens. Verify the contract address and network first.
- **Network matters.** Always confirm you’re on the same chain as the contract deployment.

## How this guide is organized

- **Roles** describes exactly what each role can do and what you need before starting.
- **Happy path** provides a full end‑to‑end walkthrough of a typical job lifecycle.
- **Common reverts** helps you fix “execution reverted” issues quickly.
- **Merkle proofs** explains how allowlists work and how to obtain/format proofs.

If you’re unsure about any term, check the glossary.
