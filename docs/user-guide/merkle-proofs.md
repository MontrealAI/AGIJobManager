# Merkle proofs — v0.9.3

Merkle proofs let the contract confirm your wallet is on an owner-managed allowlist without storing the full list on-chain. They are a preserved membership exception, not proof of an ENS name. Ordinary AGI Agent membership uses `agent.agi.eth` / `alpha.agent.agi.eth`; AGI Validator membership uses `club.agi.eth` / `alpha.club.agi.eth`.

## How authorization works (OR‑logic)

The identity check succeeds if **any** of these role-specific routes succeeds:

1. **Explicit allowlist** (`additionalAgents` / `additionalValidators`).
2. **Merkle proof** membership (allowlist proof).
3. **ENS NameWrapper ownership or qualifying approval** for the subdomain label.
4. **ENS resolver.addr** points to your wallet (fallback).

Agents must **also** hold an eligible AGI-type NFT credential. Identity authorization does not bypass that separate requirement, blacklists, active-job limits, or USDC bond funding. Validators require their own validator authorization; agent and validator roots are separate.

> **Label‑only rule (important):** enter the **label only**, not the full ENS name.
> - ✅ `helper`
> - ❌ `helper.agent.agi.eth`
>
> Why: the contract combines a **configured role root node** with your label to derive the ENS node. Full names will not match that calculation.

## Where proofs come from

- **Operator/owner supplied:** If you are a real user, request a proof from the operator running the allowlist.
- **Local generation (for operators):** This repo includes a helper script:

```bash
node scripts/merkle/generate_merkle_proof.js --input /path/to/addresses.json --address 0xYourWallet
```

Output includes:
- `root`: Merkle root to publish on-chain
- `proof`: the array you provide when applying/validating

## Proof format (copy/paste)

- Use a JSON array of 32‑byte hex strings:

```json
["0xabc...", "0xdef..."]
```

- If you are **not** using a Merkle allowlist, pass an empty array: `[]`.

## Verify a proof against the on‑chain root

### Option 1: Web UI (recommended)

1. Open the [USDC console](../../ui/agijobmanager-usdc.html) or [operator console](../ui/agijobmanager.html).
2. Set the contract address and network.
3. Use **Identity checks** and paste your proof.

### Option 2: Etherscan Read Contract

Open the verified manager address on the correct network. Read `agentMerkleRoot()` or `validatorMerkleRoot()` for the role you will use. These reads do not require a transaction or token approval.

Compare the root you were given with the on‑chain root for your role.

## Troubleshooting

- **Wrong wallet:** proofs are tied to a specific wallet address.
- **Wrong chain / outdated root:** Merkle roots live on-chain and can be updated by the owner. Always compare your proof’s root to the current on-chain root for your role.
- **Malformed proof:** must be a JSON array of hex strings.
- **Wrong label:** ENS checks require **label only**.

If you’re still blocked, check [Common revert reasons](common-reverts.md).
