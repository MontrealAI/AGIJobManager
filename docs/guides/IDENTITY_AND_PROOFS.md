# Identity & proofs explained (non‑technical)

This system gates **agents** and **validators** using multiple identity checks. You only need **one** of them to pass.

For step‑by‑step instructions on getting and validating Merkle proofs, see **Merkle Proofs**: [`MERKLE_PROOFS.md`](MERKLE_PROOFS.md).

## What “identity” means here

- **Agent identity** = permission to apply for jobs.
- **Validator (club) identity** = permission to validate or disapprove jobs.

The contract checks **your wallet** against multiple sources of truth. If any source validates you, the action is allowed.

## The on‑chain OR‑logic (how eligibility is checked)

For agents and validators, the contract uses this order:

1. **Blacklist check** (hard block)
2. **Additional allowlist** (`additionalAgents` / `additionalValidators`)
3. **Merkle proof** (membership in a published allowlist)
4. **NameWrapper ownership** (wrapped ENS subdomain owner)
5. **ENS resolver `addr()`** (resolver points to your wallet)

If **any** of steps 2–5 pass (and you are not blacklisted), you are eligible.

## Why the UI asks for “label only”

The UI fields say **label only** or **subdomain only**. That means:

- ✅ Use `helper`
- ❌ Do **not** use `helper.agi.eth` or `helper.club.agi.eth`

The contract combines your **label** with a root node (`agentRootNode` or `clubRootNode`) to compute the subnode on‑chain. If you paste a full name, the hash will be wrong and the check will fail.

## NameWrapper vs ENS resolver (plain language)

- **NameWrapper ownership** is used for wrapped ENS names (ERC‑1155). If you wrapped your ENS name, ownership is checked here first.
- **ENS resolver `addr()`** is the fallback for unwrapped names. It checks whether the resolver points to your wallet address.

You only need one of these to succeed.

## Merkle proof basics

A **Merkle proof** is a short cryptographic proof that your wallet is in an allowlist without revealing the whole list on‑chain.

You need a proof **only if**:
- You are **not** in the additional allowlist, and
- You do **not** own a matching ENS subdomain.

If you are allowlisted by Merkle proof, the contract verifies the proof against a fixed **Merkle root** set at deployment.

---

# How to get a Merkle proof

## Production proofs (real system)

The **system owner** is responsible for publishing the official allowlist and Merkle root. If you are a real user, request your proof from the owner/operator.

## Local/dev proofs (this repo)

This repo includes a small helper script to generate a Merkle root and proof from a JSON list of addresses.

### 1) Create an address list
Create a JSON file with addresses:

```json
[
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222"
]
```

### 2) Generate root + proof

```bash
node scripts/merkle/generate_merkle_proof.js --input /path/to/addresses.json --address 0x1111111111111111111111111111111111111111
```

**Output**
- `root`: the Merkle root to use at deployment
- `proof`: a bytes32 array for the UI or contract call

### 3) Paste proof into the UI

Use the output proof in:
- **Merkle proof (JSON bytes32 array)** in **Identity checks**
- **Merkle proof** in **Apply for job** or **Validate job**

### Important notes

- The helper uses **sorted pairs & sorted leaves**. Your proof will only verify if the deployed contract uses the same root.
- Production deployments must publish the **same root** used to generate proofs.
- Roots are set at deployment and **cannot be changed** later.
