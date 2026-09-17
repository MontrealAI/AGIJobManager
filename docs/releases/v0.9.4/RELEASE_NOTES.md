# v0.9.4 — Optional agent NFTs with preserved job terms

The accepted contract owner can now require or waive an approved NFT for future jobs. **NFTs remain required by default. Each job keeps the requirement recorded when it is posted.**

## What changes

- `setAgentNftRequired(bool)` changes the default for future `createJob` transactions and emits `AgentNftRequirementUpdated`. `agentNftRequired()` reads the default; `jobAgentNftRequired(jobId)` reads the job's fixed requirement.
- Accepted NFT collections and scores cannot change while any job escrow or agent, validator or dispute bonds remain reserved. This protects the collection list for funded jobs.
- The USDC console shows the default and each job's policy, checks changes during posting/applying, and provides the owner control. Missing or malformed policy reads block the affected submission.
- Hardhat deploys and verifies six linked libraries, including `NftEligibility`, and records the required initial default. Readiness requires `READINESS_NFT_CONFIG` and compares the complete collection registry, default and enabled collection code at the checked block.
- Deployment, participant and operator guides, ABI, examples and qualification evidence are updated.

## What owners and participants need to know

Agent authorization still uses `agent.agi.eth` or `alpha.agent.agi.eth`; validators use `club.agi.eth` or `alpha.club.agi.eth`. Existing explicit owner allowlists and Merkle exceptions retain their behavior. Both NFT modes enforce the other eligibility, blacklist, pause, capacity and bond checks.

NFTs establish eligibility when an agent applies. They do not set payment amounts or need to be held again at settlement. With the default validator reward, a 100-USDC successful job still pays 8 USDC to validators, 30 and 10 USDC to the two wallets, and 52 USDC to the agent; bonds are accounted for separately. The employer completion NFT remains separate.

A new manager starts paused, with NFTs required and an empty collection registry. After ownership acceptance, register reviewed collections or explicitly choose optional mode before activation. To change collections later, pause intake, finish or cancel existing jobs through their normal paths, and verify all four reserve counters are zero. External collection availability and upgrade authority still require review.

**This version requires a fresh manager deployment.** Earlier deployments keep their original code, jobs, settlement asset, helper and namespace. Preserve those deployments and their matching interfaces. New job IDs begin at zero, so the new manager needs a distinct jobs namespace. Publication performs no mainnet deployment, activation or migration.

## Download and use

- **`agijobmanager-usdc.html`**: the versioned USDC console, also included at the top of the complete ZIP.
- **`AGIJobManager-v0.9.4-COMPLETE.zip`**: frozen source, console, documentation, tests, deployment tooling and release evidence. Begin with `START_HERE.md`.
- **`RELEASE_MANIFEST.json`** and **`SHA256SUMS.txt`**: source identity, complete payload inventory and checksums.

Read the [NFT policy walkthrough](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.4/docs/NFT_POLICY.md) and [deployment operations guide](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.4/docs/DEPLOYMENT_OPERATIONS.md).

## Qualification

The frozen source is `fbe6eb73f8d02c15190fb4c3ca5892eb18004024`, tree `82b63b386f1f6aae6bddf420e9eb66e1742f2569`. Publication requires all five source workflows and all eight required jobs to pass, including proof of the exact checkout in each job log.

Coverage includes 434 contract/console regressions, 93 deployment preflight/readiness checks, 10 actual deployment/size cases, 8 native-USDC fork cases, 20 real-ENS cutover scenarios, 37 Foundry tests, 178 UI unit cases, browser/accessibility/header checks and deterministic artifacts. Both NFT modes settle against actual mainnet USDC and ENS on an isolated local fork while the recorded legacy inventory remains unchanged. The eligibility NFT is a mock fixture; actual production collections and signing access remain instance-specific qualification work.

The manager runtime is 24,130 bytes, leaving 446 bytes below EIP-170. Static analysis retains 114 individually reviewed observations: 0 high, 7 medium, 36 low and 71 informational. Two optimization observations disappear after moving the existing NFT loops into a linked library; this is not a claimed security repair. The source review is internal and does not replace independent review appropriate to the production exposure. See `VALIDATION.md` in the ZIP for evidence, reproduction steps and limits.
