# FAQ (Etherscan-first)

## Why do I need token approval before create/apply/vote/dispute?

AGIJobManager pulls AGI using `transferFrom`, so your wallet must grant allowance first.

## Should I use exact-amount approvals?

Yes for least privilege. Approve exact payout/bond amount when possible.

## How do I convert human token values and durations safely?

Use the offline helper:
```bash
node scripts/etherscan/prepare_inputs.js --action convert --amount 1.5 --duration 7d --decimals 18
```

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

Low participation can produce contested/under-quorum outcomes. In that case, finalization may route into dispute and require moderator resolution.

## What is `paused` vs `settlementPaused`?

- `paused`: intake lane controls.
- `settlementPaused`: settlement/dispute/finalization lane controls.

They are independent and can be toggled separately.

## Why do fee-on-transfer or deflationary ERC20s fail?

AGIJobManager accounting assumes strict transfer amounts. Tokens that burn/skim on transfer can violate accounting expectations and cause reverts (commonly `TransferFailed` or downstream state errors).

## Why does Etherscan show big integers instead of token decimals?

Contract arguments are `uint256` base units. Etherscan does not apply token decimal formatting to write fields automatically.

## Can I use these helper scripts without RPC access?

Yes. `scripts/merkle/*`, `scripts/etherscan/prepare_inputs.js`, and `scripts/advisor/state_advisor.js` are designed to run offline.
