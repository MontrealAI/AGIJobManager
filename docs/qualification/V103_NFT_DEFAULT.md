# v1.0.3 NFT admission default review

Fresh managers initialize `agentNftRequired` to `false`. They have an empty NFT collection registry and keep intake paused until the accepted owner activates it. The production Solidity diff from v1.0.2 is limited to this initializer and its NatSpec comment in `contracts/AGIJobManager.sol`.

## Behavior and compatibility

| Boundary | Result |
| --- | --- |
| First posted job | Records `false`; an authorized agent can apply without an eligibility NFT, subject to bonds and the other admission checks |
| Owner opt-in | `setAgentNftRequired(true)` affects jobs posted afterward; readiness rejects required mode without an enabled collection |
| Existing job | Keeps its posting-time choice through either direction of default change |
| Existing deployed manager | Retains its state; software publication does not call the setter or upgrade the instance |
| ENS, authorization and bonds | Existing membership routes, blacklist checks, capacity limits, pauses and collateral remain enforced |
| Settlement and completion NFT | Same USDC distribution, reserve accounting and employer completion receipt in both admission modes |

The accepted owner of a compatible older manager can call `setAgentNftRequired(false)` to change future postings. Older required jobs remain required. Do not treat the console version or matching runtime code as evidence that a particular instance has the disabled default: read `agentNftRequired()` and each existing job's `jobAgentNftRequired(jobId)`.

## Reviewed change

The initializer changes construction-time storage only. `createJob` still snapshots the default before assignment; `applyForJob` still uses the job snapshot; the setter remains owner-only; no collection mutation or payout function changes. The UI continues reading live manager and job state and blocks unknown policy reads. It does not assume that an older instance shares the new default.

Local compilation with the qualified Solidity 0.8.37 profile produced an ABI and deployed runtime identical to the v1.0.2 artifact. Runtime remains 24,359 bytes. Creation bytecode changes; the deployment fixture's full manager initcode is 27,551 bytes and uses 5,973,040 gas. These are local fixture measurements, not a mainnet gas quote. Library sources, storage ordering/types and compiler settings are unchanged.

The deployment script checks the disabled policy at the manager's deployment block and records it in the receipt. A mismatching initial policy fails completion. Both NFT-policy examples use `false` and an empty registry. Setup preserves existing reviewed files; readiness still requires an explicit file and exact agreement with the complete on-chain registry.

## Regression and security evidence

- `test/nftPolicy.test.js` exercises a full job with no registered collection or eligibility NFT, completion-NFT minting, owner opt-in, repeated toggles, immutable job policies, authorization, collateral, collection guards and identical payouts.
- Required-mode fixtures explicitly enable the gate in the comprehensive, Merkle, payout-snapshot and mainnet-fork suites. The historical Genesis simulation verifies disabled construction before opting in. Existing negative admission assertions remain in place.
- Hardhat deployment and preflight tests assert the disabled construction state, receipt contents and rejection of an unexpected required state. The operator setup regression checks the generated policy while preserving existing configuration.
- The cutover fixture verifies disabled construction before opting in, then checks required and optional jobs against actual mainnet USDC and ENS in an isolated fork. Its report is regenerated from this source.
- The Slither review retains every finding disposition and detector configuration. Its manager hash changes for the reviewed initializer/comment; the root lockfile hash changes only for release version metadata. Security CI must reproduce the complete finding set, and fail on any new or missing finding, before publication.

This is a scoped internal review. The [earlier v1.0 review](V1_CONTRACT_REVIEW.md) retains its original baseline and fingerprints. The v1.0.3 release's exact-source CI and validation record establish executed results; neither review certifies a live deployment.

Reviewed manager SHA-256: `ffcea8584a6f0056c9014734cb07aa2de4449005aefd6ceff92f39486519abd3`.
