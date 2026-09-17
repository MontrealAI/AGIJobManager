# Owner Mainnet Deployment & Operations Guide — v0.9.3

Use this guide to commission a manager and operate it through a verified explorer or owner wallet. The [Hardhat guide](../../hardhat/README.md) is the supported public-network deployment procedure. The [v0.8.0 edition of this document](https://github.com/MontrealAI/AGIJobManager/blob/v0.8.0/docs/DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md) is retained as historical reference; its retired public Truffle commands are not a current deployment path.

## 1) Start here

1. Review the release, canonical USDC, both settlement recipients and intended owner.
2. Rehearse with Hardhat on Sepolia using the intended signer arrangement.
3. For an authorized mainnet deployment, follow the reviewed Hardhat plan. The manager starts intake paused and the deploy script leaves it paused.
4. Verify the manager and linked libraries, accept ownership where required, and configure participant eligibility and policy.
5. Run the read-only readiness checker, review the operational gates, then have the accepted owner open intake.
6. Reconcile a deliberately limited first job before increasing exposure.

Publishing a software release does not perform these mainnet actions. This is a non-upgradeable contract: later code changes require a new deployment and a plan for existing jobs. Passing automated tests does not replace independent review of a high-stakes setup.

## 2) Participants, money and authority

| Role or term | Meaning |
| --- | --- |
| Owner | Address returned by `owner()`; controls configuration, pauses, eligibility and stale-dispute decisions |
| Pending owner | Address proposed by `transferOwnership`; it has no owner authority until it calls `acceptOwnership()` |
| Operator | Person or system following the owner's procedures; the title itself grants no contract authority |
| Employer | Posts a job and deposits its USDC cost |
| Agent | Authorized participant with an enabled qualifying NFT holding; applies, posts a bond and submits completion |
| Validator | Authorized participant that posts its required bond and votes during the review window |
| Moderator | Address enabled in `moderators(address)`; can decide an active dispute |
| Reserves | Job escrow plus agent, validator and dispute bonds; they are not owner-withdrawable revenue |

Jobs, bonds, rewards and refunds use **native Circle USDC with six decimals**. Ethereum mainnet USDC is `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`; confirm it using [Circle's registry](https://developers.circle.com/stablecoins/usdc-contract-addresses). ETH is required for gas.

A successful job pays validators first, then 30% and 10% of its original cost to the configured wallets, then the agent remainder. The default validator budget is 8%; the owner may set 1–60% for **newly posted jobs**. A baseline 100 USDC job therefore allocates 8 / 30 / 10 / 52, subject to rounding and unused rewards. Bonds and slashing are separate. NFT type scores determine eligibility, not these percentages. Read the [payout rules](../USDC_PAYOUT_SPLIT.md).

## 3) Prepare the deployment

Use Node 22.23.2 and the immutable v0.9.3 source and checksums. From the repository root:

```bash
npm ci
cd hardhat
npm ci
if [ ! -e .env ] && [ ! -L .env ]; then cp .env.example .env; fi
if [ ! -e deploy.config.cjs ] && [ ! -L deploy.config.cjs ]; then cp deploy.config.example.cjs deploy.config.cjs; fi
```

Review `deploy.config.cjs` as executable JavaScript from a trusted source. Review all six constructor inputs: USDC, base metadata URL, ENS address pair, four namespace roots, two Merkle roots and `[wallet30, wallet10]`. Supply two distinct, nonzero recipients different from USDC and the manager. Confirm the intended final owner separately. The example supplies no final owner or recipients; the intended final owner must be explicit in `FINAL_OWNER` or profile `finalOwner`, including in a dry run. The private `deploy.config.cjs` is loaded by default; the script does not silently use example configuration.

Configure the selected RPC, `DEPLOY_CONFIG`, intended `DEPLOYER_ADDRESS` for read-only planning, and explorer configuration. An actual deployment additionally requires a funded disposable deployer key through the supported Hardhat environment. Do not give production keys to local test tools, commit them or enter them into an explorer form. Prefer a tested multisignature owner when securing substantial funds.

From `hardhat/`:

```bash
npm run compile
npm run test:preflight
npm run test:deployment
npm run test:mainnet-fork
DRY_RUN=1 npm run deploy:mainnet
```

The dry run sends no transactions. Boolean flags are validated; use the documented explicit value `DRY_RUN=1`. Preserve the qualified Solidity 0.8.37 compiler profile and Ethereum size checks. The fork test reads historical mainnet USDC and executes only locally; it is not a live deployment rehearsal with your real signers.

Complete a separately authorized Sepolia rehearsal and the [mainnet qualification gates](../MAINNET_READINESS.md) before significant mainnet exposure. The actual mainnet broadcast requires the Hardhat guide's exact confirmation value, `I_UNDERSTAND_MAINNET_DEPLOYMENT`, in `DEPLOY_CONFIRM_MAINNET`, with dry-run mode disabled. Follow that guide for signing and confirmations rather than substituting a legacy migration command.

## 4) Deploy, verify and preserve evidence

The manager workflow deploys five linked libraries and the manager, verifies runtime bytes, confirms paused intake and completes explorer source verification before proposing the intended ownership handover when needed. Failed verification stops before a proposal. It does not configure every operational role or open intake.

Preserve the journal under `hardhat/deployments/<network>/`, the exact Solidity input, constructor values, linked-library addresses, successful transaction receipts and verification results. **A failed command may already have broadcast transactions.** Reconcile the saved journal before retrying; do not blindly deploy again.

Verify all six contracts against the exact release build. Do not turn a failed verification result into a claimed success. If all six deployments were broadcast but verification or a later step failed, the supported recovery command from `hardhat/` is:

```bash
DEPLOYMENT_RECEIPT=deployments/mainnet/<saved-receipt>.json npm run reverify:mainnet
```

Recovery verifies canonical receipts, recorded deployer, exact creation input and linked runtime before retrying explorer verification. It sends no blockchain transactions and preserves the original journal, writing a separate `.reverified.<block>.json` receipt on success. Use that receipt for readiness. It requires explorer API access but no private key; it does not complete missing deployments, perform ownership actions or recover ENSJobPages. Follow the report and the [Hardhat recovery instructions](../../hardhat/README.md) for any unresolved condition.

## 5) Accept ownership and configure while paused

The current owner proposes a manager transfer using `transferOwnership(newOwner)`. After a recovered deployment, check whether this proposal is still required; verification recovery performs no ownership writes. The proposed owner independently checks the manager and calls `acceptOwnership()` through its own signing interface. Until acceptance, the deployer/current owner retains authority. Verify `owner()`, zero `pendingOwner()` and `OwnershipTransferred` afterward. Renunciation is disabled; a current owner can cancel an unaccepted proposal with `transferOwnership(address(0))`.

Configure moderators, participant authorization, enabled NFT types, job limits, bonds and review policy while intake remains paused. The default vote thresholds/quorum are not a substitute for a reviewed validator operating model. A participant on an agent allowlist still needs an eligible ERC-721 holding; an enabled type's positive legacy score is not a payout percentage override.

If reviewed ENS/wrapper, namespace or Merkle settings intentionally change from the constructor values before launch, preserve the original receipt and use a separate `READINESS_CONFIG` expectations file in the [readiness workflow](../../hardhat/README.md). This file tells the checker what to compare; it cannot modify the contract.

## 6) Readiness and activation

From `hardhat/`, with the selected mainnet RPC configured and no private key needed:

```bash
DEPLOYMENT_RECEIPT=deployments/mainnet/<saved-receipt>.json npm run check:readiness
```

The checker verifies receipt/configuration integrity, exact linked runtime code, accepted ownership, both recipients, identity settings, USDC restrictions, pause posture and zero initial reserves at a recorded block, then rechecks its hash. Preserve the resulting report. It does not certify participant eligibility, off-chain judgment, signer security or the completeness of an independent review.

Before activation, independently verify:

| Read or evidence | Expected result |
| --- | --- |
| Chain, manager and linked-library code | Match the approved deployment and source build |
| `owner()` / `pendingOwner()` | Intended final owner / zero pending owner |
| `usdcToken()` | Canonical mainnet USDC |
| `wallet30()` / `wallet10()` | Reviewed recipient pair in the correct order |
| `paused()` / `settlementPaused()` | `true` / `false` before initial activation |
| Four reserve counters | All zero before the first job |
| `ens()`, `nameWrapper()`, namespace and Merkle getters | Reviewed current identity configuration |
| Role/allowlist maps and agent NFT holding | Intended moderators and eligible participants |
| Policy getters | Approved limits, validator budget, bonds, thresholds and windows |
| USDC pause/blocklist status | Intended transfers currently permitted by the issuer |
| Monitoring and incident rehearsal | Operator can detect and contain the relevant failures |

Only after reviewing the technical and operational gates should the accepted owner call `unpauseIntake()`. Recheck state changed since the report. Start with deliberately limited exposure and reconcile the first job's ordered USDC transfers and cleared reserves before scaling.

## 7) Use Etherscan or a multisignature owner safely

An externally owned owner account can inspect **Read Contract** and submit **Write Contract** calls on the verified explorer page. A multisignature owner must execute through its own transaction builder/signing workflow; connecting one of its individual signers directly does not make that signer the contract owner.

For every write, verify network, manager address, current owner, method, exact arguments and expected state change. Simulate where available, review the wallet transaction, then confirm receipt success and read the resulting state. Use the compiled release interface and linked-runtime check alongside explorer verification.

Inputs use full addresses, full `bytes32` values, integer base-unit amounts and seconds. **100 USDC is `100000000`**. Use actual generated Merkle proofs rather than shortened illustrative hashes. `[]` is appropriate only when the chosen authorization route or valid proof permits it.

## 8) Owner control reference

| Intent | Function or control | Boundary and verification |
| --- | --- | --- |
| Stop new work | `pauseIntake()` / `pause()` | Requires intake currently open; verify `paused=true`. Existing settlement remains available unless separately paused. |
| Contain fund risk | `pauseAll()` | Verify both flags true; guarded refunds and dispute resolution also stop. Owner administration remains possible. |
| Resume in stages | `setSettlementPaused(false)`, later `unpauseIntake()` | Clear containment only after incident recovery review. Avoid opening both paths prematurely. |
| Rotate recipient wallets | `setSettlementWallets(wallet30,wallet10)` | Intake paused and all four reserves zero; recipients valid/distinct; verify getters and `SettlementWalletsUpdated`. Existing funded jobs cannot be redirected. |
| Change validator budget | `setValidationRewardPercentage(pct)` | Integer 1–60%; fixes the rate for jobs posted afterward; default 8%. NFT scores do not constrain this rate. |
| Configure moderator | `addModerator` / `removeModerator` | Verify `moderators(address)` directly. Role setters do not all emit role-specific events. |
| Add/remove authorization | Additional agent/validator setters; `updateMerkleRoots` | Review remaining authorization routes and publish proofs before root changes. No automatic grace period. |
| Block future application/voting | Agent/validator blacklist functions | Verify maps/events. Blacklisting does not erase old votes or substitute for pausing unsafe settlement. |
| Enable/disable NFT eligibility | `addAGIType` / `disableAGIType` | ERC-721 interface and score bounds enforced; verify agent holdings and `getHighestPayoutPercentage(agent)>0`. |
| Change thresholds, quorum, review windows or validator slashing | Respective owner setters | Require zero escrow/bonds and valid bounds. Review periods are positive and at most 365 days. |
| Change bond parameters or other limits | Respective owner setters | Function-specific bounds apply; some changes affect later assignment/voting on posted jobs. Job duration limit is 1–31,536,000 seconds. |
| Change ENS registry/wrapper/namespace roots | `updateEnsRegistry`, `updateNameWrapper`, `updateRootNodes` | Identity unlocked and all reserves zero; verify each getter and authorization path. |
| Change optional job-page pointer | `setEnsJobPages` | Identity unlocked; zero or deployed-contract address. Verify hook behavior. |
| Disable ENS token-URI mode | `setUseEnsJobTokenURI(false)` | Changes optional metadata presentation, not ENS participant authorization. |
| Change base metadata URL | `setBaseIpfsUrl` | Length bound enforced; base URL is not exposed by a public getter. Preserve approved inputs and check newly minted metadata behavior. |
| Cancel unassigned job | `delistJob` | Owner-only, settlement enabled; refunds and deletes an eligible unassigned job. |
| Resolve stale dispute | `resolveStaleDispute(jobId,employerWins)` | Active dispute, its review deadline elapsed, settlement enabled. An owner is not automatically a moderator for ordinary resolution. |
| Withdraw surplus USDC | `withdrawUSDC` | Positive amount at most `withdrawableUSDC()`, intake paused, settlement enabled; USDC goes to owner. |
| Rescue assets | `rescueETH`, `rescueERC20`, `rescueToken` | USDC rescue retains surplus/pause guards; generic calls cannot target USDC or the manager itself. |
| Permanently lock identity | `lockIdentityConfiguration()` | Irreversible; blocks protected identity setters. It is not a pause, complete governance freeze or incident repair. |

Read [owner controls](../OWNER_CONTROLS.md), the [owner runbook](../OWNER_RUNBOOK.md) and the [generated interface](../REFERENCE/CONTRACT_INTERFACE.md) before changing a setting. The owner cannot replace USDC, alter the fixed 30%/10% shares, withdraw reserved liabilities or upgrade this implementation in place.

## 9) Optional ENSJobPages replacement

ENS job pages are an optional metadata integration, separate from escrow settlement and participant authorization. A fresh USDC launch needs a dedicated helper and namespace and must preserve the original mainnet manager, helper, root and jobs; follow the [cutover qualification](../qualification/USDC_CUTOVER.md). The [replacement guide](ENS_JOB_PAGES_MAINNET_REPLACEMENT.md) covers a separately reviewed helper replacement on the same USDC manager. Before any broadcast, review `JOB_MANAGER`, `JOBS_ROOT_NAME`, `JOBS_ROOT_NODE`, `ENS_REGISTRY`, `NAME_WRAPPER`, `PUBLIC_RESOLVER`, intended owner, `VERIFY` and `LOCK_CONFIG`.

| Step | Responsible party and expected behavior |
| --- | --- |
| Deploy replacement | Keep target manager intake paused and complete any pending ownership acceptance first. The script requires an explicit final helper owner, deploys ENSJobPages, sets its manager and journals receipts/compiler input. Broadcasts require source verification; reconcile any failure before use. |
| Optional script lock/transfer | Verification must succeed before optional lock/ownership writes. Keep `LOCK_CONFIG=0` until the intended integration has been validated. ENSJobPages ownership transfers in **one step**, unlike the manager's proposal/acceptance flow. |
| Establish root authority | For a fresh USDC launch, the ENS parent owner creates the dedicated wrapped-root token owned by the new helper. Broader NameWrapper authority is a separate same-manager replacement decision, with its scope explicitly reviewed. The deployment script performs neither action. |
| Connect manager | Manager owner calls `setEnsJobPages(newEnsJobPages)` while identity configuration remains unlocked. The deployment script does not switch this pointer. |
| Preserve existing jobs | Fresh USDC deployment leaves the original manager and its pages unchanged. Only a same-manager helper replacement can require the helper owner to call `migrateLegacyWrappedJobPage(jobId,exactLabel)` for that manager’s existing pages. |
| Verify cutover | Read both new manager/helper pointers, their separate owners and configured root/resolver/wrapper authority. Require creation, delegated writes and terminal revocation without skipped/failed ENS hooks. Reconcile the preserved legacy inventory. |
| Consider locks | Respective owner reviews `lockIdentityConfiguration()` or `lockConfiguration()` only after final validation and understanding the lost repair options. |

Names use `<prefix><jobId>.<jobsRootName>`, with `agijob` as the default prefix. Check the actual configured root rather than copying an example domain. Existing snapshotted labels remain historical unless explicitly migrated/imported. Optional hook failure must not be treated as a reversed or missing USDC settlement; reconcile the core transaction separately.

For an identity incident, contain the affected activity and follow [incident response](../OPERATIONS/INCIDENT_RESPONSE.md). **Never lock a suspected bad configuration as an emergency mitigation.**

## 10) Participant journey and onboarding

1. Confirm the intended manager and issuer-permitted native USDC before granting its allowance. Employer funds the job cost; agents/validators separately fund any required bonds and ETH gas.
2. Employer posts a job. Verify `JobCreated`, exact escrow and the posting-time payout percentage.
3. Authorized, NFT-eligible agent applies. Verify assignment, deadline and bond accounting.
4. Assigned agent submits a valid completion URI within the permitted window.
5. Authorized validators vote once each during review, posting required bonds. Check counters, dispute state and applicable timers.
6. An eligible caller invokes finalization after its conditions are met. Anyone may finalize; outcomes depend on votes/timers and may open a dispute rather than settle immediately.
7. On an agent win, verify validator rewards, 30% and 10% of original cost, agent remainder and separate bond settlement. The completion NFT is issued to the **employer**.

Dispute, cancellation and expiry are alternative lifecycle paths. A moderator's code 1 resolves for the agent, code 2 for the employer, and code 0 leaves the dispute open. A completed flag can also represent an employer refund. See the [full scenario walkthrough](../QUINTESSENTIAL_USE_CASE.md) for exact checkpoints.

For ordinary onboarding, AGI Agents need membership under `agent.agi.eth` or `alpha.agent.agi.eth`, and AGI Validators under `club.agi.eth` or `alpha.club.agi.eth`. Verify the connected wallet’s supported wrapper authority or resolver address. Additional lists and Merkle proofs remain explicit owner-reviewed membership exceptions, not default proof of an ENS name. Agents also need a qualifying enabled NFT. Canonical Merkle leaves use `keccak256(abi.encodePacked(claimantAddress))`; from the repository root:

```bash
node scripts/merkle/export_merkle_proofs.js --input allowlist.json --output proofs.json
```

Distribute reviewed proofs before changing roots. ENS authorization uses the configured namespace and the contract's bounded wrapper/resolver checks; confirm the exact label and authority route in [ENS integration](../INTEGRATIONS/ENS.md).

## 11) Troubleshooting and incident decisions

| Symptom | Check and response |
| --- | --- |
| Deployment command fails | Read the saved journal first; transactions may already have been mined. Reconcile before retrying. |
| Explorer source does not match | Compare exact compiler settings, build input, constructor arguments and linked libraries. Keep intake paused. |
| Readiness rejects identity settings | Compare the original receipt, current getters and reviewed change records. Use `READINESS_CONFIG` only for intentional approved expectation changes. |
| Owner transaction reverts | Confirm actual owner/signing context, current pause flags and function-specific reserve/lock guards. |
| Agent is allowlisted but cannot apply | Check enabled NFT eligibility, blacklist, active-job cap, balance/allowance and job assignment state. |
| Validator cannot vote | Check authorization, blacklist, prior vote, review deadline, dispute/terminal state and bond allowance. |
| Settlement fails after apparent earlier payments | Inspect the receipt; transfers and accounting updates in a reverted transaction roll back together. Check issuer pause/blocklist status and actual balances. |
| A funded job's recipient is blocked | Wallet rotation requires zero reserves; it cannot redirect that job. Address the issuer restriction through its legitimate process. |
| Active exploit or immediate fund risk | Authorized owner calls `pauseAll()`, verifies both flags and follows the incident playbook. `pause()` alone leaves settlement active. |

Successful job costs are fully distributed and do not accumulate as protocol treasury. Withdrawals and USDC rescue only use genuine surplus. Do not clear an emergency pause to perform a withdrawal or assume rescue can migrate escrow.

## 12) Terms and scope

The contract describes normal protocol participation as intended for AI agents; this guide also covers owner/operator administration. Its operational checks do not establish the truth of off-chain work or remove trust in owners, moderators, validators and external dependencies. Consult the [contract terms](../LEGAL/TERMS_AND_CONDITIONS.md) and [security model](../SECURITY_MODEL.md) for their scope.
