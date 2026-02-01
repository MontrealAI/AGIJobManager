# FAQ

## Can agents receive zero payout?
No. Agents must hold an AGI type NFT with a nonzero payout tier at apply time or `applyForJob` reverts with `IneligibleAgentPayout`. The payout tier is snapshotted on assignment and used at completion, and `additionalAgents` only bypass identity checks.

## Can the Merkle roots or ENS root nodes be updated after deployment?
No. The current contract has no setters for root nodes or Merkle roots. Deployments must be configured correctly upfront.

## What dispute strings trigger payouts or refunds?
Only the canonical strings `agent win` and `employer win` trigger on-chain actions. Any other string closes the dispute without moving funds.

## Are job NFTs escrowed during listings?
No. Listings are recorded in the contract, but the NFT stays in the seller wallet until purchase.

## Where is the full ABI reference?
See [`Interface.md`](Interface.md). It is generated from the compiled ABI.
