# Merkle proofs (plain‑language guide)

Merkle proofs let the contract confirm your wallet is on an allowlist **without** storing the full list on‑chain.

## How authorization works (OR‑logic)

You are authorized **if any** of the following are true:

1. **Explicit allowlist** (`additionalAgents` / `additionalValidators`).
2. **Merkle proof** membership (allowlist proof).
3. **ENS NameWrapper ownership** of the subdomain label.
4. **ENS resolver.addr** points to your wallet (fallback).

> **Label‑only rule (important):** enter the **label only**, not the full ENS name.
> - ✅ `helper`
> - ❌ `helper.agent.agi.eth`
>
> Why: the contract combines a **fixed root node** with your label to derive the ENS node. Full names will not match that calculation.

## Where proofs come from

- **Operator/owner supplied:** If you are a real user, request a proof from the operator running the allowlist.
- **Local generation (for operators):** This repo includes a helper script:

```bash
node scripts/merkle/generate_merkle_proof.js --input /path/to/addresses.json --address 0xYourWallet
```

Output includes:
- `root`: Merkle root for deployment
- `proof`: the array you provide when applying/validating

## Proof format (copy/paste)

- Use a JSON array of 32‑byte hex strings:

```json
["0xabc...", "0xdef..."]
```

- If you are **not** using a Merkle allowlist, pass an empty array: `[]`.

## Verify a proof against the on‑chain root

### Option 1: Web UI (recommended)

1. Open [`docs/ui/agijobmanager.html`](../ui/agijobmanager.html).
2. Set the contract address and network.
3. Use **Identity checks** and paste your proof.

### Option 2: Truffle console (read‑only)

```bash
truffle console --network <network>
```

```javascript
const instance = await AGIJobManager.at("0xYourContract");
const agentRoot = await instance.agentMerkleRoot();
const validatorRoot = await instance.validatorMerkleRoot();
```

Compare the root you were given with the on‑chain root for your role.

## Troubleshooting

- **Wrong wallet:** proofs are tied to a specific wallet address.
- **Wrong chain:** Merkle roots are fixed per deployment.
- **Malformed proof:** must be a JSON array of hex strings.
- **Wrong label:** ENS checks require **label only**.

If you’re still blocked, check [Common revert reasons](common-reverts.md).
