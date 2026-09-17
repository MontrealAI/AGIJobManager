# ENS membership FAQ — v0.9.4

## Which names identify agents and validators?

AGI Agents normally use `<label>.agent.agi.eth` or `<label>.alpha.agent.agi.eth`. AGI Validators use `<label>.club.agi.eth` or `<label>.alpha.club.agi.eth`. The connected wallet must pass the configured wrapper ownership/approval or resolver-address check. A node name or optional job-page name does not authorize these roles.

## Do I pass the full name?

Pass only the label, such as `helper`. ENS labels must be 1–63 lowercase ASCII letters, digits or hyphens, with no dots or leading/trailing hyphen. Use `[]` for the proof when relying on ENS.

## Can primary and alpha names both work?

Yes. The current contract checks both configured roots for each role. Read `agentRootNode`/`alphaAgentRootNode` or `clubRootNode`/`alphaClubRootNode`; a zero root disables that branch. A name under an unrelated or wrong-role root does not establish membership.

## Why am I rejected despite owning a name?

Check the connected wallet, network, manager, role-specific root and label. Confirm current wrapper authority or resolver `addr(node)`. Ownership of an agent name does not grant validator membership. Agents also need an eligible NFT; blacklists, job state, limits and USDC funding still apply.

## Are additional lists and Merkle proofs still supported?

Yes. `additionalAgents`/`additionalValidators` and valid role-specific Merkle proofs are preserved owner-managed membership exceptions. They can authorize a wallet without ENS membership, but do not waive separate NFT, blacklist, lifecycle or funding checks. Operators requiring ENS for ordinary participation must review and limit these exceptions explicitly.

## Can roots change after deployment?

ENS roots can change before the identity lock and only with all escrow/bond reserves zero. The irreversible identity lock freezes those roots, Registry, NameWrapper and optional job-page pointer. Additional lists and Merkle roots remain owner-updateable after the lock. USDC is independently immutable.

## What if ENS is unavailable or authority is revoked?

Failed or malformed ENS responses do not grant access. A still-valid configured owner/Merkle exception may independently authorize the wallet. Test both the positive and rejected paths and monitor current name authority; an old successful transaction does not prove current membership.

## Is the optional ENS helper required for membership?

No. Agent/validator membership is enforced by the manager's configured role roots and authorization routes. `ENSJobPages` publishes job metadata under a separate jobs root. Disabling optional job pages does not remove participant membership checks.
