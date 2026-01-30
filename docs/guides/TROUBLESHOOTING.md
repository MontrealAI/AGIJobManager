# Troubleshooting “execution reverted” (non‑technical)

This guide turns common revert reasons into plain‑language fixes. It is based on the on‑chain custom errors and state checks.

---

## Before you try again (quick checklist)

- ✅ **Correct network**: your wallet network must match the contract deployment.
- ✅ **Correct contract address**: double‑check the UI’s “Contract address (Mainnet)” field.
- ✅ **Token approval**: if the contract needs to transfer tokens, your allowance must be high enough.
- ✅ **Token balance**: ensure your wallet has enough tokens and ETH for gas.
- ✅ **Label only**: use *only* the subdomain label (e.g., `alice`, not `alice.club.agi.eth`).
- ✅ **Merkle proof format**: a JSON `bytes32[]` array (e.g., `["0xabc...", "0xdef..."]`).

---

## Contract custom errors → fixes

| Error | What it means | How to fix |
| --- | --- | --- |
| **NotAuthorized** | Your wallet is not allowed to perform the action (wrong role, wrong label, or invalid proof). | Use the correct role, provide the correct label, or obtain a valid Merkle proof. Ask the owner to add you to `additionalAgents` / `additionalValidators` if needed. |
| **NotModerator** | Only moderators can resolve disputes. | Ask the owner to add your address as a moderator. |
| **Blacklisted** | Your wallet is explicitly blocked for that role. | Ask the owner to remove you from the blacklist. |
| **InvalidParameters** | One or more inputs are out of bounds (e.g., payout/duration/percentage/price/withdraw amount). | Use values within the contract’s limits (non‑zero, within max payout, valid percentage, etc.). |
| **InvalidState** | The job is in the wrong lifecycle state for that action. | Check the job status and only do actions valid for that state. See the table below. |
| **JobNotFound** | The job ID doesn’t exist, or it was cancelled/delisted. | Verify the job ID in the UI and ensure it still exists. |
| **TransferFailed** | Token transfer or transferFrom failed (token returned false). | Ensure allowance + balance are sufficient and the token contract is not paused or blocked. |

> You may also see **“Pausable: paused”** if the owner has paused the contract. In that case, only the owner can unpause.

---

## Common state mismatches → fixes

| You tried to… | Why it fails | Fix |
| --- | --- | --- |
| Cancel a job after an agent applied | Jobs can only be cancelled **before assignment**. | Use **Dispute job** (if needed) or wait for validators. |
| Validate or disapprove after completion | Completed jobs cannot be re‑validated. | Only validate **before** the job is completed. |
| Dispute a job that is already resolved | Disputed flag is cleared after resolution. | Only dispute when the job is **not completed** and **not already disputed**. |
| Request completion without being the assigned agent | Only the assigned agent can request completion. | Apply to the job and become the assigned agent first. |
| Employer resolves a dispute | Only moderators can resolve disputes. | Ask a moderator to resolve with a valid resolution string. |
| Validate and disapprove the same job | The contract forbids both from the same validator. | Choose **only one** action per job. |
| Apply to a job that already has an agent | Jobs can only have **one assigned agent**. | Apply to another job or wait for reassignment. |
| Create a job with payout/duration outside limits | Parameters must be within `maxJobPayout` and `jobDurationLimit`. | Reduce payout/duration to valid values. |

---

## If you are stuck

1) Copy the exact error and the action you were trying to perform.
2) Compare it to the tables above.
3) If it’s still unclear, ask the contract owner or moderator for help and include:
   - The **network** and **contract address**
   - The **job ID**
   - Your **wallet address**
   - The **label** + **Merkle proof** you used
