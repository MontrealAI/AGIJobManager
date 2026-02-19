# FAQ (Etherscan-first)

## Why does `approve` matter, and should I use exact amounts?
AGIJobManager pulls tokens with `transferFrom`, so you must approve enough allowance first. Exact-amount approvals reduce risk versus unlimited approvals.

## How do I paste `bytes32[]` proofs in Etherscan?
Use JSON-like syntax in one line:
- empty: `[]`
- non-empty: `["0xabc...","0xdef..."]`
Each item must be `0x` + 64 hex chars.

Generate proofs offline:
```bash
node scripts/merkle/export_merkle_proofs.js --input allowlist.json --output proofs.json
```

## Why can `finalizeJob` open a dispute instead of settling?
If validator signals/quorum do not satisfy a clean settlement path at finalize time, the protocol can move into dispute resolution for moderator handling.

## What happens if nobody votes?
After the review window, `finalizeJob` has a dedicated no-vote path (`totalVotes == 0`) that settles directly to completion without requiring dispute moderation.

## What is the difference between `paused` and `settlementPaused`?
- `paused`: intake/write-path pause lane (job creation/application lifecycle controls).
- `settlementPaused`: settlement/dispute/finalization lane pause.
Owner can pause one lane without pausing the other.

## Why do fee-on-transfer/deflationary ERC20 tokens fail?
AGIJobManager expects strict transfer semantics and accounting consistency. Tokens that reduce transferred amount or apply transfer-side mechanics can trigger `TransferFailed` or solvency checks.
