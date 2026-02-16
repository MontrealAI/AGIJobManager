# FAQ (Etherscan-first)

## Why do I need approval before create/apply/vote/dispute?

AGIJobManager pulls AGI with `transferFrom`, so allowance on the AGI token is required.

## Should I use exact-amount approvals?

For least privilege, yes: approve only the exact amount needed for escrow or bond, then raise if necessary.

## How do I paste `bytes32[]` proofs in Etherscan?

Use one-line JSON array:

```text
[]
```

```text
["0xabc...", "0xdef..."]
```

## Why can `finalizeJob` open a dispute instead of settling?

At review end, tie or under-quorum outcomes move to dispute flow by design.

## What if nobody votes?

At review-end timeout with no validator votes, contract follows deterministic finalize behavior (check `getJobValidation` + `finalizeJob` outcome path).

## What is `paused` vs `settlementPaused`?

- `paused`: intake pause controls (create/apply and related intake lanes)
- `settlementPaused`: settlement/dispute/finalization lane pause

Operators can toggle independently for incident response.

## Why do fee-on-transfer/deflationary ERC20 tokens fail?

AGIJobManager accounting expects strict exact-transfer semantics. Fee-on-transfer or deflationary behavior can break invariants and revert with transfer/accounting errors.
