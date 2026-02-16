# FAQ (Etherscan-first)

## Why do I need token approval first?
AGIJobManager uses ERC20 `transferFrom` for escrow and bonds. You must call `approve(spender, amount)` on the AGI token first.

## Should I approve exact amount or unlimited?
Exact-amount approvals are safer operationally. Approve only the amount needed for the action.

## How do I paste `bytes32[]` Merkle proofs on Etherscan?
Use JSON-array syntax in one field:

```text
[]
```

or

```text
["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]
```

## Why did `finalizeJob` open a dispute?
After review window, finalize opens dispute when votes are tied or under quorum. This is expected safety behavior.

## What happens if nobody votes?
After review window, `finalizeJob` takes deterministic no-vote liveness path (agent-win path).

## What is `paused` vs `settlementPaused`?
- `paused`: intake pause.
- `settlementPaused`: settlement/dispute/finalization pause for functions guarded by `whenSettlementNotPaused`.

## Why can fee-on-transfer/deflationary tokens fail?
Contract accounting expects strict exact-transfer semantics. Fee-on-transfer/rebasing behavior can break accounting and cause reverts.

## Why is my action reverting `NotAuthorized`?
You must pass at least one authorization route:
1. owner-set additional allowlist,
2. valid Merkle proof,
3. valid ENS ownership route.

## Why are amount numbers so large?
Etherscan takes raw base units (`uint256`). With 18 decimals, 1 token = `1000000000000000000`.
