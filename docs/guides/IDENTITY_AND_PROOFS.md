# Identity & proofs explained (non‑technical)

This system authorizes **agents** and **validators** through several identity paths. One authorization path is sufficient. Agents must also meet the job’s recorded NFT requirement, if enabled; authorization alone does not satisfy that separate requirement.

## What “identity” means here

- **Agent identity** = permission to apply for jobs.
- **Validator (club) identity** = permission to validate or disapprove jobs.

The contract checks **your wallet** against multiple sources of truth. If any source validates you, role authorization passes; the action must still satisfy the job, bond, conflict and pause rules.

## The on‑chain OR‑logic (how eligibility is checked)

For agents and validators, the contract uses this order:

1. **Blacklist check** (hard block)
2. **Additional allowlist** (`additionalAgents` / `additionalValidators`)
3. **Merkle proof** (membership in a published allowlist)
4. **NameWrapper ownership or qualifying approval** (wrapped ENS subdomain controller)
5. **ENS resolver `addr()`** (resolver points to your wallet)

If **any** of steps 2–5 pass (and you are not blacklisted), the role-authorization check passes. Agent applications additionally enforce the job’s recorded NFT policy, bond, capacity and current job state. Reviewer participation has its own bond and conflict checks.

## Free Alpha Agent name and identity NFT

On Ethereum mainnet, [FreeTrialSubdomainRegistrarIdentity](https://etherscan.io/address/0x7811993CbcCa3b8bb35a3d919F3BA59eeFbeAA9a#code) provides a combined free-registration path: `register(label)` creates a wrapped `label.alpha.agent.agi.eth` name and a soulbound ERC-721 **Alpha Agent Identity** NFT for the caller. The [OpenSea collection](https://opensea.io/collection/alpha-agent-identity) displays these identity tokens. Buyers do not need an agent identity to post jobs.

In the [current repository console](../../ui/agijobmanager-usdc.html), enter a label and choose **Get free name + identity NFT**. This combined action was added after the frozen v1.0.0 download; see [console versions](../V1_RELEASE_SCOPE.md#published-download-versus-current-source). Labels use 8–63 lowercase letters or digits. Registration takes no ETH payment, but the wallet pays network gas. The registrar must be available and authorized for an active parent. Trial validity is 30 days, capped by the parent’s effective expiry; use the live preview instead of assuming a full 30 days. The separate **ENS-only** action uses the older registrar and does not mint this identity NFT. Its optional recipient field does not change the recipient of the combined registration, which is the connected caller.

Already own an unexpired wrapped alpha name? `claimIdentity(label)` can add or refresh its identity NFT; it does not register a new name or extend the name’s expiry. The identity NFT is soulbound, so it cannot be bought or transferred as a shortcut to a valid identity.

**Expiry is not automatic token deletion.** Time passing can make the credential expired while the NFT still appears in a wallet or marketplace. The registrar’s `preview(label)`, dynamic `tokenURI` metadata and ENS wrapper state report live status. Anyone can synchronize the token; `syncIdentity` or `syncIdentityByLabel` burns it when the name is expired, missing or owned by a different wallet. Re-registration after expiry replaces the old identity. The deployed registrar does not expose a `statusOf` method.

Job eligibility is separate. The manager must recognize the relevant alpha ENS root or another authorization path. If the job requires an NFT, its manager must also enable an eligible NFT collection. AGIJobManager checks an enabled collection’s `balanceOf`; it does not directly query this registrar’s expiry status. Because an expired identity can remain unburned, NFT possession alone is not proof of an active trial credential. Operators who require active trial validity must verify that status separately; the current manager does not enforce an expiry-aware NFT policy.

The [example registration transaction](https://etherscan.io/tx/0x1ca932f2e8af1b5b5dc28decd5b8e499d9fa2db5321d7a009a096e9507aa0364) succeeded at block **24,652,754** on **March 14, 2026, 02:32:35 UTC**. It registered `11111111111.alpha.agent.agi.eth` and minted the matching locked identity NFT, with zero ETH registration value and a recorded expiry of **April 13, 2026, 02:32:35 UTC**. The receipt’s NameWrapped, ERC-721 mint and Locked events establish the combined historical flow; they do not establish present validity or a manager’s job eligibility.

## Can this free identity qualify me to work and earn USDC?

**Yes, if the owner enables the alpha-agent root and the identity NFT collection.** Your applying wallet must pass both checks when the job requires an NFT, plus the bond, capacity, blacklist, pause and job-state checks. No extra paid identity or individual allowlisting is inherently required for this ENS route. Use `[]` for the Merkle proof when using ENS.

Payment follows buyer acceptance, successful review/finalization or an authorized agent-win dispute decision. Merely obtaining credentials does not pay you. Once assigned, expiry does not itself remove your assignment or earned payment: submission and settlement do not recheck those credentials. See the [agent journey and outcome table](../roles/AGENT.md) and [owner setup](../NFT_POLICY.md#enable-the-free-alpha-agent-identity-route).

## Why the UI asks for “label only”

The UI fields say **label only** or **subdomain only**. That means:

- ✅ Use `helper001`
- ❌ Do **not** use `helper001.alpha.agent.agi.eth` or `helper001.club.agi.eth`

The contract combines your **label** with the configured role roots (`agentRootNode` / `alphaAgentRootNode` or `clubRootNode` / `alphaClubRootNode`) to compute the subnode on‑chain. If you paste a full name, the hash will be wrong and the check will fail.

## NameWrapper vs ENS resolver (plain language)

- **NameWrapper ownership** is used for wrapped ENS names (ERC‑1155). If you wrapped your ENS name, ownership is checked here first.
- **ENS resolver `addr()`** is tried if the NameWrapper check fails, for wrapped or unwrapped names. It checks whether the resolver points to your wallet address.

You only need one of these to succeed.

## Merkle proof basics

A **Merkle proof** is a short cryptographic proof that your wallet is in an allowlist without revealing the whole list on‑chain.

You need a proof **only if**:
- You are **not** in the additional allowlist, and
- You do **not** own a matching ENS subdomain.

If you are allowlisted by Merkle proof, the contract verifies the proof against the **Merkle root** stored on-chain for your role. The owner can update these roots when allowlists change, so always use the latest published root.

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
- `root`: the Merkle root to publish on-chain
- `proof`: a bytes32 array for the UI or contract call

### 3) Paste proof into the UI

Use the output proof in:
- **Merkle proof (JSON bytes32 array)** in **Identity checks**
- **Merkle proof** in **Apply for job** or **Validate job**

### Important notes

- The helper uses **sorted pairs & sorted leaves**. Your proof will only verify if the deployed contract uses the same root.
- Production deployments must publish the **same root** used to generate proofs.
- Roots can be updated by the owner via `updateMerkleRoots`; publish updated roots alongside refreshed proofs.
