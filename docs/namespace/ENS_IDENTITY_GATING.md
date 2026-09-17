# ENS participant identity — v0.9.4

AGI Agents normally require membership under `agent.agi.eth` or `alpha.agent.agi.eth`; AGI Validators under `club.agi.eth` or `alpha.club.agi.eth`. The wallet submitting the application or vote must satisfy the configured role's ownership, approval or resolver-address check. The legacy owner-managed additional lists and Merkle proofs remain explicit exceptions to ENS membership.

Participant membership is separate from optional `ENSJobPages`. A job-page name, resolver text-edit permission or completion NFT does not automatically grant agent or validator membership. Agents separately need an eligible enabled AGI-type NFT credential.

## Exact authorization order

`AGIJobManager._isAuthorized` evaluates:

1. The role-specific `additionalAgents` or `additionalValidators` entry. A true entry bypasses ENS and Merkle checks.
2. A proof against `agentMerkleRoot` or `validatorMerkleRoot`, using leaf `keccak256(abi.encodePacked(claimant))`. A valid proof bypasses ENS.
3. ENS membership under the role's primary root, then its alpha root. A zero root disables that branch.

For each ENS root, the library derives the child node, then checks NameWrapper ownership, token approval or owner-wide operator approval. If no supported wrapper route authorizes the claimant, it checks that the Registry's resolver exists and its `addr(node)` equals the claimant. Calls are bounded and malformed or failed replies do not authorize the claimant.

ENS labels must be 1–63 lowercase ASCII letters, digits or hyphens, with no dot or leading/trailing hyphen. This label validation occurs on the ENS route; an earlier additional-list or Merkle exception can bypass it. Blacklists, NFT eligibility for agents, lifecycle conditions and USDC bond funding are separate checks and still apply. An unsupported or wrong-role name fails unless an explicit owner-managed exception applies.

## Root mapping

| Role | Primary root getter | Alpha root getter |
| --- | --- | --- |
| AGI Agent | `agentRootNode = namehash("agent.agi.eth")` | `alphaAgentRootNode = namehash("alpha.agent.agi.eth")` |
| AGI Validator | `clubRootNode = namehash("club.agi.eth")` | `alphaClubRootNode = namehash("alpha.club.agi.eth")` |

The current manager accepts either configured root for the role. Alpha and primary names are not mutually exclusive deployment modes. Confirm actual getter values; a configured deployment can select other hashes or disable a branch with zero.

The owner can call `updateRootNodes` before `lockIdentityConfiguration()` and only when every escrow/bond reserve is zero. The identity lock also freezes ENS Registry, NameWrapper and optional helper-pointer changes. It does not freeze additional lists or `updateMerkleRoots`, so it is not an ENS-only enforcement switch. USDC is independently immutable.

## Derive the node and submit the label

From the repository root, the pinned ethers dependency can derive a node:

```js
const { namehash, id, solidityPackedKeccak256 } = require("ethers");
const root = namehash("alpha.agent.agi.eth");
const label = "helper";
const node = solidityPackedKeccak256(["bytes32", "bytes32"], [root, id(label)]);
```

For `helper.alpha.agent.agi.eth`, pass `"helper"` as `subdomain` and `[]` as `proof` when using ENS. For an explicitly configured Merkle exception, pass its actual proof for the current role root and connected wallet. Never present an exception as proof that an ENS name is owned.

## Verify authorization and its limits

Read the four root getters, ENS Registry and NameWrapper addresses, relevant additional-list entry and role Merkle root. Inspect the intended name's wrapper/resolver state and simulate the actual role action in the correct wallet context. Successful applications emit `JobApplied`; successful votes emit `JobValidated` or `JobDisapproved`. The current manager does not emit the historical `OwnershipVerified` event.

The [namespace test guide](TESTING.md) distinguishes deterministic mocks from the [mainnet-fork cutover qualification](../qualification/USDC_CUTOVER.md). Local impersonation proves the tested authorization behavior, not control of a production key or an independently operated participant. Recheck actual membership before launch.
