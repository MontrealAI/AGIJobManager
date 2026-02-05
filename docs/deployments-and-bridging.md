# Deployments, addresses, and bridging safety

This document records legacy reference artifacts and onboarding safety notes.
All addresses below are **historical/reference** unless explicitly stated
otherwise.

## Legacy / reference artifacts
- **Legacy AGIJobManager (Ethereum)**: `0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477`
- **Deployer ENS**: `deployer.agi.eth`
- **“AGI Jobs” collection on OpenSea**: reference surface for historical
  assets (verify current URLs and ownership off-chain before use).

## Bridging / onboarding safety (SOL ↔ ETH)
**Always verify domains and addresses before signing.** Prefer:
- small test amounts,
- limited allowances,
- explicit destination checks.

**Decimals mismatch warning**
- **Transitory token (6 decimals)**: `0x2e8fb54c3ec41f55f06c1f082c081a609eaa4ebe`
- **Final token (18 decimals, v2)**: `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`
- **Mint/vault**: `AGIALPHAEqualMinterVault` at `0x27d6fE8668c6f652Ac26fFaE020D949f03aF80D8`

## ENS schema recap (namespace grammar alignment)
- **Validators**: `*.alpha.club.agi.eth` or `*.club.agi.eth`
- **Agents**: `*.alpha.agent.agi.eth` or `*.agent.agi.eth`
- **Nodes**: `*.alpha.node.agi.eth` or `*.node.agi.eth`
- **Sovereigns**: `*.alpha.agi.eth` or `*.agi.eth`

**Scope reminder**: `entity.env.role.agi.eth` is recognized only within
`env.agi.eth` unless explicitly whitelisted.
