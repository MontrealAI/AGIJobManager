# FAQ (Etherscan-first)

## Why do I need token approval before create/apply/vote/dispute?

AGIJobManager pulls AGI using `transferFrom`, so your wallet must grant allowance first.

## Should I use exact-amount approvals?

Yes for least privilege. Approve exact payout/bond amount when possible.

## How do I paste `bytes32[]` proofs into Etherscan?

Use a one-line JSON array:

```text
[]
```

```text
["0xabc...", "0xdef..."]
```

You can generate proof arrays offline with:
```bash
node scripts/merkle/export_merkle_proofs.js --input addresses.json --output proofs.json
```

## Why can `finalizeJob` open a dispute instead of settling?

If finalization conditions indicate contested outcomes (for example under-quorum/tie paths), finalize can route to dispute resolution.

## What happens if nobody votes?

Outcome is deterministic from contract logic and timing. Use `getJobValidation(jobId)` plus timing windows to evaluate whether finalize/dispute path is next.

## What is `paused` vs `settlementPaused`?

- `paused`: intake lane controls.
- `settlementPaused`: settlement/dispute/finalization lane controls.

They are independent and can be toggled separately.

## Why do fee-on-transfer or deflationary ERC20s fail?

AGIJobManager accounting assumes strict transfer amounts. Tokens that burn/skim on transfer can violate accounting expectations and cause reverts (commonly `TransferFailed` or downstream state errors).

## How do I convert human amounts and durations safely?

Use offline helper (no RPC):
```bash
node scripts/etherscan/prepare_inputs.js --action convert --amount 1.25 --duration 7d
```

## I pasted a proof but Etherscan rejects it. What format is required?

Use JSON array syntax exactly (double quotes, comma-separated, wrapped with `[]`):

```text
["0xabc...", "0xdef..."]
```

## Can I keep intake open while stopping settlements?

Yes. `paused` (intake) and `settlementPaused` (settlement lane) are independent controls.

## Why does `disputeJob` sometimes revert even though I want to escalate?

Common causes:
- dispute already active or job already terminal (`InvalidState`)
- settlement lane is paused (`SettlementPaused`)
- dispute bond allowance/balance is insufficient (`TransferFailed`)
