# ENS identity verification

`AGIJobManager` accepts **both** envless and `alpha.*` namespaces for validator and agent identities.

## Namespaces accepted

**Validators**
- `club.agi.eth` (root node `0x39eb…`)
- `alpha.club.agi.eth` (derived from `club.agi.eth` + labelhash("alpha"))

**Agents**
- `agent.agi.eth` (root node `0x2c9c…`)
- `alpha.agent.agi.eth` (derived from `agent.agi.eth` + labelhash("alpha"))

In practice, any identity of the form:

```
<entity>.(alpha.)club.agi.eth
<entity>.(alpha.)agent.agi.eth
```

is accepted, where `alpha.` is optional.

## Verification flow (Merkle + ENS)

When an agent or validator proves eligibility, the contract checks in order:

1. **Merkle proof** (allowlist)
   - If the Merkle proof succeeds, ownership is accepted immediately.
2. **ENS NameWrapper ownership**
   - The contract derives a subnode from the role root and the submitted subdomain.
   - It queries `NameWrapper.ownerOf(uint256(subnode))`.
3. **ENS resolver address**
   - It resolves the subnode via ENS `resolver()`.
   - It checks `resolver.addr(subnode)` for the claimant address.

The ENS checks are performed **twice**: once for the envless root (`club.agi.eth` / `agent.agi.eth`) and once for the derived `alpha.*` root.

## Operational expectations

- **Prefer a single root at deployment:** the base envless roots are fixed in the constructor and the `alpha.*` roots are derived internally.
- **Avoid extra storage:** no additional root storage is used for `alpha.*`.
- **Recovery:** if ENS lookups fail (resolver missing or NameWrapper query fails), the contract emits `RecoveryInitiated` to aid off‑chain diagnosis.

## Example identifiers

- Validator (club): `alice.club.agi.eth` or `alice.alpha.club.agi.eth`
- Agent: `helper.agent.agi.eth` or `helper.alpha.agent.agi.eth`
