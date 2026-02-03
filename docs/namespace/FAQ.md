# AGI.Eth Namespace (alpha) — FAQ

## Q1) Do I pass the full ENS name to the contract?
**No.** You pass **only the left‑most label**. Example:
- `helper.alpha.agent.agi.eth` → `subdomain = "helper"`

## Q2) Why does `NotAuthorized` happen even though I own the name?
Common causes:
- You are using the **wrong environment** (non‑alpha vs alpha).
- The subdomain label is correct, but ENS ownership is not set under either the base or alpha root.
- The ENS resolver is not set to your wallet address.
- You are not on the allowlist and were not added to `additionalAgents/Validators`.

## Q3) Can I use `helper.agent.agi.eth` with an alpha deployment?
**Yes.** The contract checks **both** base and alpha roots, so `helper.agent.agi.eth` and `helper.alpha.agent.agi.eth` are both valid when ownership is correctly set.

## Q4) Can the root nodes or Merkle roots be changed after deployment?
**No.** Root nodes are compile-time constants and Merkle roots are constructor-time immutables. If they are wrong, the contract must be redeployed.

## Q5) What if the ENS/NameWrapper contracts are down or revert?
The contract emits `RecoveryInitiated` events for these failure paths and continues evaluation. In practice, this means you should **monitor those events** to spot ENS issues.

## Q6) Which identity method is safest?
Use the method that matches your operational policy. For institutions:
- **ENS/NameWrapper ownership** is preferred for public accountability.
- **Merkle allowlists** are useful for private or temporary access.
- **additionalAgents/Validators** are a strong operational override but should be tightly controlled.

## Q7) What if I don’t have a Merkle proof?
You can still pass if:
- You own the proper alpha ENS name, or
- The owner has allowlisted your address in `additionalAgents/Validators`.
