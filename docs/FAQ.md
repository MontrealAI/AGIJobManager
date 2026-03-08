# FAQ (Etherscan-first)

## In one minute
- Settlement and ENS metadata are intentionally decoupled: settlement can succeed even if ENS writes fail.
- ENS name format is `<prefix><jobId>.<jobsRootName>` with default prefix `agijob`.
- Prefix changes do not rename already snapshotted legacy labels.
- ENSJobPages replacement requires manual NameWrapper approval and manual `setEnsJobPages(...)` wiring.

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
After the review window elapses, `finalizeJob` has a no-vote (`totalVotes == 0`) path that settles directly to completion without requiring a dispute.

## What is the difference between `paused` and `settlementPaused`?
- `paused`: intake/write-path pause lane (job creation/application lifecycle controls).
- `settlementPaused`: settlement/dispute/finalization lane pause.
Owner can pause one lane without pausing the other.

## Why did Etherscan show "execution reverted" but the transaction still succeeded?
A nested/best-effort ENS sub-operation can revert while AGIJobManager settlement still succeeds. Check final transaction status, AGIJobManager settlement events, and ENS hook events before concluding failure.

## Why can settlement succeed while ENS fails?
ENS writes are best-effort side effects. Core escrow settlement is intentionally non-dependent on ENS metadata writes to avoid blocking protocol outcomes.

## Why do some jobs use `agijob...` and others `job-...`?
Old jobs may have snapshotted historical labels from previous ENSJobPages configuration. New prefix settings apply to unsnapshotted/future jobs only.

## Why do old jobs need migration after ENSJobPages replacement?
A replacement ENSJobPages contract may not have legacy label snapshots. Without snapshots, some post-create writes can fail until owner imports exact labels via `migrateLegacyWrappedJobPage(jobId, exactLabel)`.

## Why can’t I just change the prefix and expect old jobs to follow it?
Prefix is used for unsnapshotted label derivation only. Once a job label is snapshotted, that exact label is stable and does not auto-rename.

## Why is NameWrapper approval still manual?
It is a privileged wrapped-root-owner action and intentionally remains a separate explicit approval transaction for operational safety.

## What should I check before calling `lockConfiguration()` / `lockIdentityConfiguration()`?
Confirm final addresses, AGIJobManager->ENSJobPages wiring, NameWrapper approval, expected hook behavior for future jobs, and any required legacy migration completion.

## What should I do if post-create ENS writes fail after cutover?
1. Verify AGIJobManager points to the new ENSJobPages.
2. Verify NameWrapper approval for the new ENSJobPages.
3. For affected legacy jobs, run `migrateLegacyWrappedJobPage(jobId, exactLabel)`.

## Why do fee-on-transfer/deflationary ERC20 tokens fail?
AGIJobManager expects strict transfer semantics and accounting consistency. Tokens that reduce transferred amount or apply transfer-side mechanics can trigger `TransferFailed` or solvency checks.
