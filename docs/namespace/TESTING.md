# Namespace Identity Tests — Local Coverage

This document describes the local JavaScript regression tests for AGI.eth namespace gating in the alpha environment. The preserved suites run on Hardhat 3's local EDR chain with ethers-backed compatibility helpers and deterministic mocks; Truffle and Ganache are not required.

## What the tests cover

The suite focuses on the alpha namespace and identity-gating logic using mock ENS contracts:

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

These mocks exercise the contract's identity-verification paths. They do not establish live ENS ownership or reproduce every mainnet ENS behavior.

## How to run

```bash
npm ci
npm --prefix hardhat ci
npm audit --audit-level=low
npm --prefix hardhat audit --audit-level=low
npm test
```

Run these commands from the repository root with Node 22.23.2. `npm test` builds the pinned Hardhat artifacts and runs the complete JavaScript regression inventory, including this namespace suite. CI partitions the same inventory across four required shards. See [the test matrix](../TESTING.md) for strict Forge lint, UI dependency audits and the remaining release gates.

## Test file

- [`test/namespaceAlpha.test.js`](../../test/namespaceAlpha.test.js)

Refer to the final release validation evidence for measured results and its exact source identity; this page does not claim a passing count for an unqualified tree.
