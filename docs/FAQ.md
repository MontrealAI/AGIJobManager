# FAQ

## Can agents receive zero payout?
Yes. The agent payout percentage is derived from AGI type NFTs owned by the agent. If none apply, the payout percentage is zero and the escrowed funds remain in the contract balance.

## Can the Merkle roots or ENS root nodes be updated after deployment?
No. The current contract has no setters for root nodes or Merkle roots. Deployments must be configured correctly upfront.

## What dispute strings trigger payouts or refunds?
Only the canonical strings `agent win` and `employer win` trigger on-chain actions. Any other string closes the dispute without moving funds.

## Are job NFTs escrowed during listings?
No. Listings are recorded in the contract, but the NFT stays in the seller wallet until purchase.

## Where is the full ABI reference?
See [`Interface.md`](Interface.md). It is generated from the compiled ABI.
