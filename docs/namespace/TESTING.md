# Namespace Identity Tests — Local Coverage

This document explains the **local Truffle tests** added to prove AGI.Eth namespace gating for the **alpha** environment using deterministic mocks.

## What the tests cover

The new test suite focuses on the alpha namespace and identity‑gating logic using mock ENS contracts:

1. **Agent authorization via NameWrapper** under `alpha.agent.agi.eth`.
2. **Validator authorization via ENS resolver** under `alpha.club.agi.eth`.
3. **Unauthorized access rejection** when no allowlist or ownership exists.
4. **Wrong root node rejection** (non‑alpha name with alpha deployment).
5. **Owner allowlist bypass** using `additionalAgents` / `additionalValidators`.

## How the tests simulate mainnet behavior

Local tests use deterministic mocks:

- `MockENS` stores a resolver per node.
- `MockResolver` returns an address for `addr(node)`.
- `MockNameWrapper` returns an owner for `ownerOf(node)`.

The tests compute **alpha root nodes** using namehash and derive subnodes exactly as the contract does:

```
subnode = keccak256(rootNode, keccak256(label))
```

This makes the local chain behave like mainnet **for identity verification logic only**. It does not assert real ENS ownership.

## How to run

```bash
npm install
npx truffle compile
npx truffle test
```

## Test file

- `test/namespaceAlpha.test.js`
