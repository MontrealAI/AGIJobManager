# AGI.Eth Namespace — FAQ

## Q1) Do I pass the full ENS name to the contract?
**No.** You pass **only the left‑most label**. Example:
- `helper.agent.agi.eth` **or** `helper.alpha.agent.agi.eth` → `subdomain = "helper"`

## Q2) Why does `NotAuthorized` happen even though I own the name?
Common causes:
- You are using the **wrong namespace** (unrelated to `club.agi.eth`/`agent.agi.eth`).
- The ENS resolver is not set to your wallet address.
- The ENS resolver is not set to your wallet address.
- You are not on the allowlist and were not added to `additionalAgents/Validators`.

## Q3) Can I use `helper.agent.agi.eth` and `helper.alpha.agent.agi.eth`?
**Yes.** The contract accepts **both** envless and alpha namespaces as long as the root is `agent.agi.eth`/`club.agi.eth`.

## Q4) Can the root nodes or Merkle roots be changed after deployment?
**No.** They are immutable in this contract. If they are wrong, the contract must be redeployed.

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
