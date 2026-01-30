# Identity & proofs explained (non‑technical)

This guide explains **why identity is required**, how the contract checks it, and how to supply the correct inputs in the UI.

---

## What “agent / validator identity” means here

AGIJobManager does **not** use usernames. It checks **wallet‑based identity** for agents and validators using one of several proofs. If **any** proof succeeds, the contract allows the action.

### On‑chain authorization logic (OR‑logic)
For agents and validators, the contract accepts **any one** of these:

1. **Additional allowlist** (owner‑managed):
   - `additionalAgents[address]` or `additionalValidators[address]`
2. **Merkle proof membership**
3. **ENS NameWrapper ownership** of the subdomain label
4. **ENS Resolver addr()** of the subdomain label

If you are **blacklisted**, you fail even if you pass the other checks.

---

## Why the UI asks for “label only”

The UI expects **only the subdomain label**, not the full ENS name.

- ✅ Correct: `alice`
- ❌ Incorrect: `alice.club.agi.eth`

The contract builds the ENS node by hashing the root (club/agent) with the **label hash**. That is why **label‑only input** is required.

---

## NameWrapper vs ENS Resolver fallback

The contract checks in this order:

1. **NameWrapper.ownerOf** (wrapped names)
2. **ENS resolver addr()** (unwrapped names)

**When this matters**
- If your subdomain is **wrapped**, the NameWrapper ownership check applies.
- If your subdomain is **not wrapped**, the resolver’s `addr()` record must point to your wallet.

If the resolver is missing or misconfigured, the contract cannot match your wallet.

---

## Merkle proofs (plain‑language)

A **Merkle proof** is a short cryptographic path that proves your address is in an approved list without revealing the entire list on‑chain.

- The **owner** publishes a Merkle root during deployment.
- You provide a **proof** (a list of `bytes32` values) in the UI or CLI.
- The contract verifies that proof against the Merkle root.

---

# How to get a Merkle proof

## Option A: Production proof (recommended)

If you are using a real deployment, ask the **contract owner** for the proof **and** confirm the Merkle root they used. The on‑chain root cannot be changed without redeploying.

## Option B: Local/dev proof (using the helper script)

This repo includes a minimal helper:

```bash
node scripts/merkle/generate-proof.js \
  --list scripts/merkle/sample-addresses.json \
  --address 0x1111111111111111111111111111111111111111 \
  --verify
```

The output includes:
- `root` — the Merkle root
- `proof` — the JSON `bytes32[]` array to paste into the UI

### Input format
Your address list must be a JSON array of lowercase or checksummed addresses:

```json
[
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222"
]
```

### Tip: save the output
```bash
node scripts/merkle/generate-proof.js \
  --list ./addresses.json \
  --address 0xYourWallet \
  --out ./my-proof.json
```

---

## Where to paste the proof in the UI

Use the **Merkle proof** field in:
- **Apply for job** (agent)
- **Validate job** / **Disapprove job** (validator)
- **Identity checks** (eligibility preview)

The proof must be a JSON `bytes32[]` array (e.g., `[]` or `["0xabc...", "0xdef..."]`).
