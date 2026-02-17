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


## How do I convert human values to Etherscan-safe integers?

Use the offline helper:

```bash
node scripts/etherscan/prepare_inputs.js --action convert --amount 1.25 --duration 7d --decimals 18
```

This prints base units for token amounts and seconds for durations.

## I am an operator: what is the safe withdraw sequence?

Always run:
1. read `withdrawableAGI()`
2. choose `amount <= withdrawableAGI()`
3. execute `withdrawAGI(amount)`

Do not infer withdrawable capacity from raw ERC20 balance alone because active escrow and bonds must stay solvent.
