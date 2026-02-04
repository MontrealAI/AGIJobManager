# AGI.Eth Namespace (alpha) — FAQ

## Q1) Do I pass the full ENS name to the contract?
**No.** You pass **only the left‑most label**. Example:
- `helper.alpha.agent.agi.eth` → `subdomain = "helper"`

## Q2) Why does `NotAuthorized` happen even though I own the name?
Common causes:
- You are using the **wrong environment** (non‑alpha vs alpha).
- The deployment is configured with **alpha** root nodes, but you own a **non‑alpha** name.
- The ENS resolver is not set to your wallet address.
- You are not on the allowlist and were not added to `additionalAgents/Validators`.

## Q3) Can I use `helper.agent.agi.eth` with an alpha deployment?
**No.** If the contract was deployed with `alpha.agent.agi.eth` and `alpha.club.agi.eth` root nodes, only the **alpha** names (e.g., `helper.alpha.agent.agi.eth`) will pass the ownership checks.

## Q4) Can the root nodes or Merkle roots be changed after deployment?
**No.** They are immutable in this contract. If they are wrong, the contract must be redeployed.

## Q5) What if the ENS/NameWrapper contracts are down or revert?
The contract continues evaluation for ENS failure paths, so you should monitor validation failures during integration testing to spot ENS issues.

## Q6) Which identity method is safest?
Use the method that matches your operational policy. For institutions:
- **ENS/NameWrapper ownership** is preferred for public accountability.
- **Merkle allowlists** are useful for private or temporary access.
- **additionalAgents/Validators** are a strong operational override but should be tightly controlled.

## Q7) What if I don’t have a Merkle proof?
You can still pass if:
- You own the proper alpha ENS name, or
- The owner has allowlisted your address in `additionalAgents/Validators`.
