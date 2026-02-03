# ENS Identity Gating — Technical Appendix (AGI.Eth alpha)

This appendix explains the **exact identity checks** used by `AGIJobManager` and how to derive the on‑chain node hashes for the **alpha** namespace.

---

## 1) Contract checks (exact order)

For agent and validator calls (`applyForJob`, `validateJob`, `disapproveJob`), `_verifyOwnership` runs these checks **in order**:

1. **Merkle allowlist**
   - Leaf = `keccak256(abi.encodePacked(claimant))` (the wallet address).
   - Proof is verified against `agentMerkleRoot` (agents) or `validatorMerkleRoot` (validators).
2. **NameWrapper ownership**
   - Node = `subnode(rootNode, labelHash(subdomain))`.
   - `ownerOf(uint256(node))` must equal the claimant.
3. **ENS resolver address**
   - `resolver(node)` must return a non‑zero resolver address.
   - `resolver.addr(node)` must equal the claimant.

If all checks fail, the call reverts `NotAuthorized`.

---

## 2) How root nodes are set (base + alpha)

Root nodes are compile-time constants for both namespaces:

- `clubRootNode = namehash("club.agi.eth")`
- `clubRootNodeAlpha = namehash("alpha.club.agi.eth")`
- `agentRootNode = namehash("agent.agi.eth")`
- `agentRootNodeAlpha = namehash("alpha.agent.agi.eth")`

The contract checks **both** root nodes per role; mismatches require redeployment.

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

### Example (alpha agent)

- Full ENS name: `helper.alpha.agent.agi.eth`
- `rootNode`: `namehash("alpha.agent.agi.eth")`
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
