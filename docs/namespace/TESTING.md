# Namespace Identity Tests — Local Coverage

This document explains the **local Truffle tests** added to prove AGI.Eth namespace gating for both **base and alpha** environments using deterministic mocks.

## What the tests cover

The new test suite focuses on identity‑gating logic across base + alpha roots using mock ENS contracts:

1. **Agent authorization via NameWrapper** under `alpha.agent.agi.eth`.
2. **Validator authorization via ENS resolver** under `alpha.club.agi.eth`.
3. **Unauthorized access rejection** when no allowlist or ownership exists.
4. **Base namespace acceptance** alongside alpha roots.
5. **Owner allowlist bypass** using `additionalAgents` / `additionalValidators`.

## How the tests simulate mainnet behavior

Local tests use deterministic mocks:

- `MockENS` stores a resolver per node.
- `MockResolver` returns an address for `addr(node)`.
- `MockNameWrapper` returns an owner for `ownerOf(node)`.

The tests use the fixed base + alpha root nodes and derive subnodes exactly as the contract does:

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
