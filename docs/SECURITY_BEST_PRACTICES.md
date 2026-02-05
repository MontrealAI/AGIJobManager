# Security Best Practices

Use this checklist to minimize risk when operating or interacting with AGIJobManager.

## For all users
- ✅ **Verify contract addresses** from an official source.
- ✅ **Use small test transactions first**.
- ✅ **Double‑check token decimals** (AGI uses 18 decimals).
- ✅ **Monitor events** (JobCreated, JobCompleted, DisputeResolvedWithCode, DisputeResolved).

## ERC‑20 approvals
- **Never grant unlimited approvals** unless absolutely required.
- Approve **exact amounts** for each job.
- Revoke approvals after use by calling `approve(spender, 0)`.

## Owner/operator key management
- Use a **hardware wallet** or **multisig** for the owner address.
- Separate operational keys from treasury keys.
- Keep an incident‑response plan for pausing the contract.

## Validator & agent safety
- Ensure you own the correct ENS/NameWrapper subdomain.
- Keep proof data (Merkle proofs) private until needed.

## Pausing and incident response
- Pause the contract during suspicious activity.
- Communicate publicly about pauses and expected unpause windows.

## Dispute handling
- Use consistent, transparent moderation policies.
- Record dispute evidence off‑chain in a tamper‑evident system.
