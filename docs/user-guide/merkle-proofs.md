# Merkle proofs & identity checks

This page explains **how identity gating works** and how to obtain and use a Merkle proof.

> ⚠️ **Subdomain label only**: When an action asks for a subdomain, enter **only the label** (e.g., `helper`, **not** `helper.agent.agi.eth`). The contract combines the label with a fixed root node.

## How identity checks work (OR‑logic)
For **Agents** and **Validators**, the contract accepts **any one** of these paths:
1. **Additional allowlist** (set by the owner): `additionalAgents` / `additionalValidators`.
2. **Merkle proof** (address is in an allowlist committed on‑chain).
3. **ENS NameWrapper ownership** (`NameWrapper.ownerOf`).
4. **ENS resolver address** (`Resolver.addr`) as a fallback.

If any of these succeeds, you are authorized.

## What is a Merkle proof (plain language)?
A Merkle proof is a **short cryptographic receipt** that proves your wallet is in a list **without exposing the whole list on‑chain**. The contract stores only a single hash called the **Merkle root**.

## Where do proofs come from?
- **From the operator/maintainer**: The allowlist and Merkle root are configured at deployment and **cannot be changed**. Ask the operator for your proof if you’re allowlisted.
- **From this repo (generator script)**: If you are the operator, you can generate proofs locally using:
  ```bash
  node scripts/merkle/generate_merkle_proof.js --input /path/to/addresses.json --address 0xYourWallet
  ```
  The script outputs:
  - `root`: Merkle root (must match the on‑chain root),
  - `proof`: array of `0x…` 32‑byte hashes.

## Proof format (important)
Most UIs and tools expect a **JSON array of bytes32 strings**:
```json
["0xabc...", "0xdef..."]
```
- An **empty proof** is `[]` (use this only if you are allowlisted or using ENS ownership).
- Do **not** include commas in a single string; it must be a JSON array.

## How to verify your proof
### Option A: Web UI (recommended)
Use the **Identity Checks** section in [`docs/ui/agijobmanager.html`](../ui/agijobmanager.html). It verifies the Merkle proof and ENS ownership **before** you submit a transaction.

### Option B: Truffle console (read‑only)
1. Open a console on the correct network:
   ```bash
   npx truffle console --network sepolia
   ```
2. Read the on‑chain Merkle root:
   ```js
   const c = await AGIJobManager.deployed();
   await c.agentMerkleRoot(); // or validatorMerkleRoot()
   ```
3. Compare that root to the `root` returned by the proof generator.

## Troubleshooting checklist
- **Wrong wallet**: the proof is tied to a specific address.
- **Wrong root**: the Merkle root on‑chain must match the root used to generate the proof.
- **Wrong network**: proof won’t work if you’re on a different chain/deployment.
- **Malformed proof**: must be a JSON array of `0x` 32‑byte hashes.
- **Full ENS name used**: only the **label** is accepted.
