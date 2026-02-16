# AGIJobManager FAQ (Etherscan-first)

## Why does `approve` matter so much?
`createJob`, `applyForJob` (bond), `validate/disapprove` (bond), and `disputeJob` (bond) use token `transferFrom`. If allowance is too low, calls revert.

## Should I approve exact amounts?
Yes, exact-amount approvals reduce exposure to unintended token pulls.

## How do I paste `bytes32[]` proofs in Etherscan?
Use JSON-like array format:
```text
["0xabc...","0xdef..."]
```
Generate proofs with:
`node scripts/merkle/export_merkle_proofs.js --input allowlist.json`

## Why can `finalizeJob` open a dispute instead of settling?
After review window, under-quorum or tie outcomes are pushed into dispute for moderator resolution.

## What happens if nobody votes?
After review window, `finalizeJob` follows deterministic no-vote liveness path (agent-win settlement path).

## What is the difference between `paused` and `settlementPaused`?
- `paused`: intake pause gate (Pausable).
- `settlementPaused`: settlement gate used by settlement and key lifecycle actions.
Check both before transacting.

## Why do fee-on-transfer/deflationary tokens fail?
The contract expects strict exact transfer semantics for accounting and escrow locks. Non-standard transfer behavior can trigger `TransferFailed`/solvency guard failures.

## Why did I get `NotAuthorized` as agent or validator?
You must pass at least one authorization route:
1) owner direct allowlist,
2) valid Merkle proof,
3) valid ENS subdomain ownership under configured roots.

## Can owner withdraw escrowed user funds?
`withdrawAGI` is constrained by `withdrawableAGI`, which excludes locked escrow + locked bonds. Withdrawal also requires pause guards.
