# FAQ — v0.9.1 (USDC console and Etherscan)

## How is a successful job paid?

Every job cost, reward, and bond uses native USDC. Successful settlement pays validators first, then 30% and 10% of the original job cost to `wallet30` and `wallet10`, then the remainder to the assigned agent. With the default 8% validator budget, 100 USDC becomes 8 / 30 / 10 / 52 USDC before separate bond returns/slashing. The owner can change the validator percentage from 1–60% for new jobs; already posted jobs retain their percentage. Rounding and undistributed validator rewards go to the agent on success.

USDC uses six decimals. Ethereum transactions still require ETH for gas. The mainnet token is native Circle USDC, not a bridged substitute; verify `usdcToken()` and the deployment before approving spending.

## Who chooses the agent?

The first eligible applicant whose `applyForJob` transaction succeeds is assigned immediately. There is no separate employer-selection step. Agents need an identity authorization route **and** an eligible AGI-type NFT credential, plus the required USDC bond. NFT credentials do not boost payment percentages.

## Do approval votes automatically pay a job?

No. A reached approval threshold records an approval time. After the challenge window strictly passes, anyone may call `finalizeJob` if approvals exceed disapprovals and no dispute is active. Otherwise the full completion review rules apply. Monitor the job: early finalization can occur before the full review period ends. When an approval threshold has already been reached, its challenge window must also strictly elapse before finalization, even if the completion review window ends first.

## What can the owner update?

The owner can maintain bounded configuration, roles, and operational pauses. The deployed code has no implementation upgrade switch, and its USDC token and fixed 30%/10% shares cannot change. Recipient rotation requires intake paused and all escrow/bond reserves zero. Some voting/timing rules also require empty reserves; existing bond snapshots stay unchanged. Ownership transfer requires acceptance. See [owner controls](OWNER_CONTROLS.md).

## Are employer-win refunds always the whole job cost?

No. Validator rewards and bond outcomes can adjust the refund. Cancelled, expired, and employer-win jobs do not pay the 30%/10% shares. Only successful work mints a completion NFT.

## ENS metadata in one minute
- Settlement and ENS metadata are intentionally decoupled: settlement can succeed even if ENS writes fail.
- ENS name format is `<prefix><jobId>.<jobsRootName>` with default prefix `agijob`.
- Prefix changes do not rename already snapshotted legacy labels.
- ENSJobPages replacement requires manual NameWrapper approval and manual `setEnsJobPages(...)` wiring.

## Why does `approve` matter, and should I use exact amounts?
AGIJobManager pulls USDC with `transferFrom`. Approve the exact escrow or quoted bond on the USDC contract, then submit the separate job action from the same wallet. Agents, validators, and manual disputants need allowances for their own bonds. Keep ETH for gas; revoke unused allowances when no longer needed.

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
After the completion review window strictly elapses, nonzero votes below quorum or tied votes open a dispute. A qualifying majority settles according to its outcome. The eligible early-approval path is checked first. A reached disapproval threshold can already have placed the job in dispute, blocking ordinary finalization.

## What happens if nobody votes?
After the review window strictly elapses, anyone may submit `finalizeJob`. With zero votes and no active dispute, it completes the job: no validator reward is charged, the 30%/10% shares are paid, and the remaining USDC goes to the agent. No-vote completion earns no reputation. Time passing alone does not execute the transaction.

## What is the difference between `paused` and `settlementPaused`?
- `paused`: blocks job creation and application; existing settlement actions can continue.
- `settlementPaused`: blocks completion requests, voting, disputes, and settlement; creation/application are also blocked.

The owner can operate the lanes separately or use `pauseAll`. Fresh deployments start with intake paused until commissioning.

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
The public-chain contract is restricted to native USDC. Local adversarial tests reject fee-on-transfer deposits because escrow must receive exactly the funded amount. USDC issuer pause/blocklist restrictions can still prevent a transfer; if one settlement transfer fails, the entire settlement reverts and can be retried once the restriction is resolved.
