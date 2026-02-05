# FAQ

## Can agents receive zero payout?
No. Agents must hold an AGI type NFT with a nonzero payout tier at apply time or `applyForJob` reverts with `IneligibleAgentPayout`. The payout tier is snapshotted on assignment and used at completion, and `additionalAgents` only bypass identity checks.

## Can the Merkle roots or ENS root nodes be updated after deployment?
Merkle roots can be updated by the owner using `updateMerkleRoots`. ENS root nodes are fixed at deployment and cannot be changed on-chain, so those must be configured correctly upfront.

## What dispute strings trigger payouts or refunds?
Only the canonical strings `agent win` and `employer win` trigger on-chain actions. Any other string maps to `NO_ACTION`, logs the resolution, and leaves the dispute active.

## Does the contract include a built-in NFT marketplace?
No. Job NFTs are standard ERC‑721 tokens and can be traded externally using standard approvals and transfers.

## Where is the full ABI reference?
See [`Interface.md`](Interface.md). It is generated from the compiled ABI.
