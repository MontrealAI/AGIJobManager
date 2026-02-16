# AGIJobManager FAQ (Etherscan-focused)

## Why do I need to approve first?

AGIJobManager uses ERC-20 `transferFrom` for escrow and bonds. The contract cannot pull your tokens unless you grant allowance first on the AGI token contract (`approve(spender, amount)`).

## How do I paste a `bytes32[]` proof into Etherscan?

Use JSON-array syntax in a single input box:

```text
["0xabc...","0xdef..."]
```

Notes:
- include quotes around each 32-byte hex value,
- include `0x` prefix,
- for empty proof use `[]`.

## Why did `finalizeJob` create a dispute instead of paying out?

At review-window end, `finalizeJob` opens a dispute when votes are tied or total votes are below quorum. This is expected behavior to avoid low-participation settlement.

## What happens if nobody votes?

If no validator votes are cast and review window ends, `finalizeJob` settles deterministically in the agent-win path (non-dispute).

## What does `paused` vs `settlementPaused` mean?

- `paused`: intake-side pause (new create/apply activity blocked). Voting remains possible unless settlement is also paused.
- `settlementPaused`: settlement/dispute/finalization paths blocked.

Operators can use them separately for incident control.

## Why does my ERC-20 transfer revert?

Common causes:
- insufficient wallet balance,
- insufficient allowance,
- token is fee-on-transfer/rebasing/non-standard and fails exact-transfer assumptions,
- token-level pause or restrictions.

AGIJobManager expects exact-transfer semantics; fee-on-transfer behavior can break accounting and revert.

## Which addresses are authorized as agent/validator?

Authorization succeeds if any of these pass:
1. direct additional allowlist mapping,
2. Merkle proof against current root,
3. ENS ownership path.

If all fail, calls revert `NotAuthorized`.

## What does `resolutionCode` mean in moderator dispute resolution?

For `resolveDisputeWithCode(jobId, resolutionCode, reason)`:
- `0`: no-op (event only; dispute remains active),
- `1`: agent-win resolution,
- `2`: employer-win resolution.

## Can owner withdraw escrowed user funds?

Owner withdrawal is constrained by solvency checks. `withdrawAGI` is limited to `withdrawableAGI()` and only callable while paused. Locked escrow and bond balances are excluded from withdrawable amount.

## Why are numbers so large in Etherscan input fields?

Amounts are raw token base units (`uint256`). Convert human amount by token decimals. With 18 decimals, `1` token equals `1000000000000000000`.
