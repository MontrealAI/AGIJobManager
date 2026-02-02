# ENS Identity Gating — Technical Appendix

This appendix explains the **exact identity checks** used by `AGIJobManager` and how to derive the on‑chain node hashes for the **alpha** namespace.

---

## 1) Contract checks (exact order)

For agent and validator calls (`applyForJob`, `validateJob`, `disapproveJob`), `_verifyOwnership` runs these checks **in order**:

1. **Merkle allowlist**
   - Leaf = `keccak256(abi.encodePacked(claimant))` (the wallet address).
   - Proof is verified against `agentMerkleRoot` or `validatorMerkleRoot`.
2. **NameWrapper ownership**
   - Node = `subnode(rootNode, labelHash(subdomain))`.
   - `ownerOf(uint256(node))` must equal the claimant.
3. **ENS resolver address**
   - `resolver(node)` must return a non‑zero resolver address.
   - `resolver.addr(node)` must equal the claimant.

If all checks fail, the call reverts `NotAuthorized`.

---

## 2) How root nodes are set (envless + alpha)

The deployment uses the **envless** roots; alpha.* nodes are derived in‑contract:

- `clubRootNode = namehash("club.agi.eth")`
- `agentRootNode = namehash("agent.agi.eth")`

The contract also checks `alpha.club.agi.eth` and `alpha.agent.agi.eth` by hashing the `alpha` label under the envless roots. These root nodes are **immutable after deployment**, so a mismatch requires redeployment.

---

## 3) Subnode derivation (same as contract)

The contract derives subnodes using:

```
subnode = keccak256(abi.encodePacked(rootNode, keccak256(label)))
```

Where `label` is the **left‑most** label only (e.g., `"helper"`).

### JS helper (web3.js compatible)

```js
const { soliditySha3, keccak256 } = web3.utils;

function namehash(name) {
  let node = "0x" + "00".repeat(32);
  if (!name) return node;
  const labels = name.toLowerCase().split(".").filter(Boolean);
  for (let i = labels.length - 1; i >= 0; i -= 1) {
    node = soliditySha3(
      { type: "bytes32", value: node },
      { type: "bytes32", value: keccak256(labels[i]) }
    );
  }
  return node;
}

function subnode(rootNode, subdomain) {
  return soliditySha3(
    { type: "bytes32", value: rootNode },
    { type: "bytes32", value: keccak256(subdomain) }
  );
}
```

### Example (alpha + envless agent)

- Full ENS name: `helper.agent.agi.eth` **or** `helper.alpha.agent.agi.eth`
- `rootNode`: `namehash("agent.agi.eth")` (contract also derives `alpha.agent.agi.eth`)
- `subdomain`: `"helper"`
- `subnode`: `keccak256(rootNode, keccak256("helper"))`

---

## 4) What to pass to the contract

- `subdomain`: **left‑most label only** (e.g., `"helper"`, `"alice"`).
- `proof`: Merkle proof array for allowlisted addresses, otherwise `[]`.

Passing the full ENS name (e.g., `"helper.alpha.agent.agi.eth"`) will **not** work.

---

## 5) Operational signals

The contract emits two useful events for monitoring identity verification:

- `OwnershipVerified(claimant, subdomain)` → identity check succeeded.
- `RecoveryInitiated(reason)` → ENS / NameWrapper failure path (useful for diagnostics).

---

## 6) Known limits of local tests

Local tests use deterministic mocks of ENS, Resolver, and NameWrapper to simulate mainnet behavior. This proves the **verification logic** in isolation, but it does **not** assert real mainnet ownership or resolver data.

See: [`TESTING.md`](TESTING.md)
