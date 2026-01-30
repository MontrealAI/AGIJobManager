# Merkle proofs (non‑technical guide)

This guide explains **what a Merkle proof is**, when you need one, how to get it, and how to verify it against the on‑chain Merkle root.

## Plain‑language explanation

A **Merkle proof** is a short cryptographic proof that your wallet address is in a private allowlist, without revealing the entire list on‑chain. The contract checks your proof against a fixed **Merkle root** set at deployment.

## You only need ONE of these (OR‑logic)

To apply as an **agent** or validate as a **validator**, your wallet must pass **any one** of the following:

1. **Additional allowlist** (`additionalAgents` / `additionalValidators`) — set by the owner.
2. **Merkle proof** — your address is included in the allowlist root.
3. **NameWrapper ownership** — you own the ENS subdomain (wrapped).
4. **ENS resolver `addr()`** — the ENS name resolves to your wallet.

If any one of these passes and you are not blacklisted, you are eligible.

> **Identity note (subdomain label only)**: When asked for a label/subdomain, enter **only the label**, not the full ENS name. Example: use `helper` **NOT** `helper.agent.agi.eth`. The contract combines the label with a fixed root node on‑chain.

## Where do proofs come from?

### Production (real users)
- **The owner/operator provides proofs**. Request your proof from the project operator.
- The operator should give you:
  - the **Merkle root**, and
  - your **Merkle proof** (JSON array of bytes32 hex strings).

### Local/dev (this repo)
This repo includes a helper script:
- `scripts/merkle/generate_merkle_proof.js`
- Sample list: `scripts/merkle/sample_addresses.json`

#### Step 1: Prepare an address list
Create a JSON file with wallet addresses:
```json
[
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222"
]
```

#### Step 2: Generate root + proof
```bash
node scripts/merkle/generate_merkle_proof.js \
  --input /path/to/addresses.json \
  --address 0x1111111111111111111111111111111111111111
```

The script outputs:
- `root`: the Merkle root (must match the on‑chain root),
- `proof`: a bytes32 array for the UI or contract call.

## Proof format (what to paste)

Use a **JSON array** of 32‑byte hex strings:
```json
[
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
]
```

- Each element must be **32 bytes** and start with `0x`.
- Do **not** wrap the array in quotes when pasting into the UI.

## Verification (safe, read‑only)

### Option A: Use the web UI
1. Open **Identity checks (preflight only)**.
2. Choose **Agent** or **Validator**.
3. Enter **label only** and paste your proof.
4. Click **Run identity check**.

If it returns **Eligible**, your proof and label are correct.

### Option B: Compare against on‑chain root (Truffle console)

```bash
truffle console --network mainnet
```

```javascript
const AGIJobManager = artifacts.require("AGIJobManager");
const jm = await AGIJobManager.deployed();
await jm.agentMerkleRoot();
await jm.validatorMerkleRoot();
```

Compare the root from the contract with the `root` output from the proof generator. If they differ, the proof will never validate.

## Troubleshooting checklist

- **Wrong wallet**: proofs are specific to a wallet address.
- **Wrong chain/contract**: the Merkle root differs between deployments.
- **Malformed proof**: not a JSON array or not 32‑byte hex strings.
- **Full ENS name used**: always use **label only**, not the full name.
- **Blacklisted**: blacklisted wallets fail even with a valid proof.
