# Troubleshooting “execution reverted” (non‑technical)

This guide helps you identify common failure causes and quick fixes.

## Before you try again (quick checklist)

- [ ] **Network**: You are on the correct chain (usually Ethereum Mainnet).
- [ ] **Contract address**: The UI points to the correct deployment.
- [ ] **Token allowance**: AGI allowance is high enough for your action.
- [ ] **Token balance**: Your wallet has enough AGI for payouts or purchases.
- [ ] **Role eligibility**: Your agent/validator identity passes the preflight check.
- [ ] **Job state**: The job is in the correct status for your action.

## Contract custom errors → fix

| Error | Plain‑language meaning | How to fix it |
| --- | --- | --- |
| `NotModerator` | You are not registered as a moderator. | Use a moderator wallet or ask the owner to add your address. |
| `NotAuthorized` | You are not the allowed caller for this action. | Check you are the employer/assigned agent, or pass identity gating (allowlist/Merkle/ENS). |
| `Blacklisted` | Your wallet is explicitly blocked for this role. | Ask the owner to remove you from the blacklist or switch to an approved wallet. |
| `InvalidParameters` | One or more inputs are invalid (zero/over max). | Check payout, duration, reward %, or withdrawal amount. |
| `InvalidState` | The job is in a state that forbids this action. | See “Common state mismatches” below. |
| `JobNotFound` | The job ID does not exist or was deleted/cancelled. | Confirm the Job ID in the **Jobs table**. |
| `TransferFailed` | Token transfer/transferFrom failed. | Ensure balance and allowance are sufficient; confirm the token is ERC‑20 compliant. |

## Common state mismatches → fixes

| What you tried | Why it failed | What to do instead |
| --- | --- | --- |
| Cancel after assignment | `cancelJob` only works before an agent is assigned. | Ask the agent/validators to complete, or dispute if needed. |
| Validate after completion | Completed jobs reject new validations. | Check the job status in **Jobs table** first. |
| Dispute a resolved job | Disputed jobs can only be resolved once. | Do not re‑dispute; review resolution outcome. |
| Request completion as a non‑agent | Only the assigned agent can request completion. | Switch to the assigned agent wallet. |
| Validate + disapprove the same job | Each validator can only do one action per job. | Use a different validator wallet or skip. |
| Apply to a job that is already assigned | Job already has an agent. | Pick an open job (`Open` filter). |
| Resolve dispute with wrong string | Only “agent win” or “employer win” settles funds. | Use the canonical strings in the UI buttons. |

## Still stuck?

- Re‑run the **Identity checks (preflight only)** panel.
- Refresh **Contract snapshot** and **Your role flags**.
- If you see “Not connected,” reconnect the wallet.
- For recurring `TransferFailed`, ask the owner to confirm the token address.
