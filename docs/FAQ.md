# FAQ (Etherscan-first)

## Why do I need ERC20 approval before create/apply/vote/dispute?

AGIJobManager uses token pulls (`transferFrom`) for escrow and bond flows. Without sufficient allowance and balance, writes revert.

## Should I use exact-amount approvals?

For least privilege, yes. Approve only the amount needed for that action, then increase only when needed.

## How do I paste `bytes32[]` proofs into Etherscan?

Use one-line JSON-like array syntax:

```text
[]
```

```text
["0xabc...", "0xdef..."]
```

Tip: use `scripts/merkle/export_merkle_proofs.js` output `etherscanProofArrays` directly.

## Why can `finalizeJob` end up in dispute flow?

`finalizeJob` enforces review/challenge logic. If outcomes are contested, tied, or under threshold conditions, the job can move into dispute handling rather than immediate settlement.

## What happens if nobody votes?

The contract still follows deterministic finalize/dispute logic based on configured thresholds and timing windows. Always inspect `getJobValidation(jobId)` and then call `finalizeJob(jobId)` when windows allow.

## What is the difference between `paused` and `settlementPaused`?

- `paused`: intake lane controls (create/apply and related entry actions).
- `settlementPaused`: settlement lane controls (finalize/dispute/resolve-like actions).

They are separate to allow targeted incident response.

## Why do fee-on-transfer/deflationary ERC20 tokens revert?

The accounting model expects strict exact-transfer semantics. Tokens that burn/tax/skim on transfer can break balance invariants and trigger reverts.
