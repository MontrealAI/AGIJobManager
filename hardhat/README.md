# Hardhat deployment guide

Current automated work uses [schema 6/7 operator-budget admission without retainers](../docs/OPERATIONS/NO_RETAINERS.md). Existing escrow credits and refunds remain recoverable. Fresh review-escrow deployment is disabled; use [existing-escrow recovery](../docs/OPERATIONS/REVIEW_PROTECTION.md) for verification and legacy obligations.

**Optional reviewer companion:** [deployment, recovery and commissioning](../docs/OPERATIONS/REVIEW_PROTECTION.md).

**Deployment entrypoint:** [release identity and checked commands](../docs/RELEASE_GUIDE.md).

**v1.9.1 deployment tooling:** these instructions match this checkout. Manager and helper commands default to read-only when `DRY_RUN` is missing or empty. Published v1.0.5 downloads are unchanged; always use explicit `DRY_RUN=1` for plans on older tags. Record the reviewed commit with `git rev-parse HEAD` and use its matching scripts, documentation and CI results. See [release scope](../docs/V1_RELEASE_SCOPE.md#published-download-versus-current-source).

## Deployment at a glance

| Step | What you do | Result |
| --- | --- | --- |
| 1. Prepare | Install both lockfiles, run `setup`, fill the owner and both recipient wallets | Private configuration; no transactions |
| 2. Check | Run the offline profile check, compile, then an explicit dry run | Configuration and live-state plan; no transactions |
| 3. Rehearse | Complete the Sepolia journey with the intended signing setup | Testnet evidence |
| 4. Deploy | Explicitly select broadcast mode after reviewing the mainnet plan | Eight libraries and manager deployed, verified, intake paused |
| 5. Take control | Accept ownership, configure while paused, run readiness | Recorded technical checks; owner reviews launch gates before opening intake |

v1.9.1 preserves v1.0.3 construction, ABI, bytecode, eight library links and payout rules. Fresh managers start with NFT admission disabled and an empty collection registry. Existing settings and job policies stay unchanged. Start with the [launch checklist](../docs/LAUNCH_CHECKLIST.md), then use this guide in order. The [configuration reference](../docs/DEPLOYMENT_CONFIGURATION.md) lists every supported deployment setting and recovery command.

Before paid intake, prepare the [operator notice](../docs/LEGAL/OPERATOR_NOTICE_TEMPLATE.md), identify the actual operator and both fee beneficiaries, and review requirements for the planned activities and territories. The [legal center](../docs/LEGAL/README.md) distinguishes MIT software publication from operating a deployment. Setup, deployment and readiness checks do not verify legal compliance, consent, licensing or regulatory exemption; no central identity collection or new transaction is required by these notices.

Before paid intake, adopt the [user-data rules](../docs/LEGAL/USER_DATA_RULES.md) through a valid process and configure the actual [privacy notice](../docs/LEGAL/PRIVACY.md), private contact, retention and provider arrangements. Keep personal information and secrets out of public job content and deployment records. This does not transfer statutory responsibilities.

This is the supported public-network deployment path. The root contract regression suites also use Hardhat 3; Truffle/Ganache dependencies are removed. Moving from the original-asset legacy manager requires a fresh USDC deployment with two real recipient wallets; this release does not deploy a contract or populate those addresses. v1.9.1 preserves the eight-library architecture, including `JobSettlement` and `JobValidation`. A verified v0.9.6 manager remains compatible; older incompatible managers require a fresh deployment to gain the current features. All eight fixed links, including transitive library links, are verified. Existing jobs stay on their original managers and use those versions’ interfaces. A new console cannot upgrade old bytecode.

The manager starts with intake paused in its constructor. Successful jobs pay validators in USDC first, then 30% and 10% of the original job cost to the two wallets, then the agent remainder. The default validator budget is 8%. See [payout rules](../docs/USDC_PAYOUT_SPLIT.md), [owner controls](../docs/OWNER_CONTROLS.md) and [mainnet qualification](../docs/MAINNET_READINESS.md).

## Prepare

Use Node 22.23.2 and a reviewed, pinned source commit or release tag with its matching guide. Install from committed lockfiles:

```bash
npm ci
npm --prefix hardhat ci
npm --prefix hardhat run setup
cd hardhat
```

Run the first three commands from the repository root. `setup` creates private `.env`, `deploy.config.cjs` and `reviewed-nft-policy.json` files inside `hardhat/`. It never overwrites existing files or follows destination symlinks; on POSIX, new files have mode `0600`. Re-running setup preserves existing settings, so compare older files with the current examples. It makes no network requests or transactions.

Hardhat always loads **`hardhat/.env`**, including when commands are launched from the repository root. Exported shell variables take precedence. The root `.env` is only for separate Node operator tools; retired Truffle keys are not deployment configuration. Relative paths inside environment settings use the command's working directory; the commands below run from `hardhat/`. `npm --prefix hardhat run <command>` from the root is equivalent.

The deployment script loads private `deploy.config.cjs` by default and fails if it is absent; it never silently deploys the example. Set `DEPLOY_CONFIG` only to another reviewed configuration.

Review `deploy.config.cjs` as executable JavaScript from a trusted source. Set each network's `settlementWallets: [wallet30, wallet10]` and intended `finalOwner`; independently confirm control of these addresses. Review ENS registry, wrapper, four root nodes, two Merkle roots and metadata gateway. `FINAL_OWNER` or the selected profile’s `finalOwner` must explicitly identify the intended final owner, including for a dry run; omission does not select the deployer. The mainnet example contains the four established ENS member roots and zero Merkle roots, with no recipient or owner supplied. Sepolia ENS addresses must be filled from the selected deployment; examples do not prove current signing access or namespace control. Prefer a tested multisignature owner for substantial funds.

In the local environment, configure the selected RPC, `DEPLOY_CONFIG=./deploy.config.cjs`, and `ETHERSCAN_API_KEY`. Actual deployment additionally requires a funded, disposable deployer `PRIVATE_KEY`. Never commit keys, paste them into issue reports, or provide them to untrusted tools. Mainnet and Sepolia profiles are bound to chain IDs 1 and 11155111.

## Check the configuration before connecting

After entering the intended owner, both recipients and network settings, run the corresponding offline check from `hardhat/`:

```bash
npm run check:config:sepolia
npm run check:config:mainnet
```

Run only the profile you have completed. This shares the deployment script's constructor/owner/native-USDC validation, checks confirmation settings and prints public configuration. It requires no RPC, key, compilation or explorer credentials. A pass validates local input only; it does not verify control of addresses, on-chain code or readiness. A custom `.cjs` configuration is executable code: review it before loading it with either command.

The generated NFT policy matches fresh v1.9.1 construction: `agentNftRequired: false` and an empty registry. Review it alongside the actual instance before readiness. For owner opt-in, register reviewed collections and enable the requirement as described in the [NFT walkthrough](../docs/NFT_POLICY.md); update the policy file to match. Setup preserves an existing reviewed file, including a previously required policy.

## Participant membership and optional job pages

AGI Agents normally qualify through a name under `agent.agi.eth` or `alpha.agent.agi.eth`; AGI Validators through `club.agi.eth` or `alpha.club.agi.eth`. The connected wallet must satisfy the configured name's NameWrapper ownership/approval or resolver-address check. Enter only the label, such as `alice`. The contract preserves owner-managed `additionalAgents`/`additionalValidators` and role-specific Merkle proofs as explicit membership exceptions; those routes are not proof of ENS membership. Agents also need a qualifying enabled NFT when the job’s posting-time NFT requirement is on. Fresh v1.9.1 managers start with that requirement disabled; owners can enable it for future jobs. These participant identity checks are separate from optional ENS job-page metadata.

Verify all four identity getters against the intended names:

| Role | Primary getter/name | Alpha getter/name |
| --- | --- | --- |
| AGI Agent | `agentRootNode` / `agent.agi.eth` | `alphaAgentRootNode` / `alpha.agent.agi.eth` |
| AGI Validator | `clubRootNode` / `club.agi.eth` | `alphaClubRootNode` / `alpha.club.agi.eth` |

Root values are ENS namehashes. Primary and alpha roots are accepted alternatives for the same role, not mutually exclusive deployment modes. A zero root disables that ENS branch. Review every owner-managed additional address and any nonzero Merkle root; keep them empty when ENS membership is required for ordinary onboarding. `lockIdentityConfiguration()` does not disable these owner-managed exceptions. The owner may change ENS roots only before that lock and with all escrow/bond reserves zero.

Native USDC is fixed to Circle's Ethereum or Sepolia address. All amounts use six decimals. USDC pause/blocklist checks run at one recorded preflight block. Both recipients must be distinct, nonzero and different from USDC; the contract also rejects itself as a recipient. [Circle's registry](https://developers.circle.com/stablecoins/usdc-contract-addresses) is the address authority.

## Compile and rehearse

From `hardhat/`:

```bash
npm run compile
npm run test:preflight
npm run test:deployment
npm run test:mainnet-fork
CUTOVER_REPORT=../build/qualification/mainnet-cutover.json npm run test:cutover
DRY_RUN=1 npm run deploy:sepolia
```

The two fork commands expose only a local Hardhat chain, read pinned mainnet blocks, and send no Ethereum transactions. They use actual Circle USDC code and state. The cutover fixture also exercises all four ENS participant roots against actual mainnet contracts with locally created membership names, including rejection and preserved owner-managed exceptions. RPC failure is a failed qualification, not a skipped test. Rehearse the complete owner, employer, validator, agent and refund journeys on Sepolia using the intended operational setup before significant mainnet exposure.

The qualified compiler is Solidity 0.8.37, optimizer 40 runs, Shanghai, `viaIR=true`, metadata bytecode hash disabled and revert strings stripped. The deployment script checks the compiler profile, artifact/build consistency, EIP-170 runtime size (24,576 bytes), EIP-3860 constructor data (49,152 bytes), and EIP-7825 transaction gas limit (16,777,216). Local deployment tests cover the manager, all eight libraries and both optional metadata contracts. Use the release profile unchanged; a new compiler profile requires complete requalification. The [compiler compatibility note](../scripts/security/COMPILER_COMPATIBILITY.md) describes the exact hash-verified identifier and assembly-annotation compatibility patches, applied without disabling compiler warnings.

## Review and deploy

A dry run validates configuration, chain, token state and compiled artifacts without broadcasting. The manager plan is not a total gas quote: each linked deployment is estimated immediately before its own broadcast, once prerequisite libraries exist. The helper dry run also estimates its single constructor transaction. With no private key configured, set `DEPLOYER_ADDRESS` to the intended deployer address for this read-only plan:

```bash
DRY_RUN=1 npm run deploy:mainnet
```

Boolean settings (`DRY_RUN`, and the optional ENS script's `VERIFY`/`LOCK_CONFIG`) accept explicit `1`/`0`, `true`/`false`, `yes`/`no` or `on`/`off`. Unknown text is rejected before any transaction. Missing or empty `DRY_RUN` is read-only in v1.9.1; the published v1.0.5 scripts retain their earlier behavior. `DRY_RUN=true` is also read-only. Keep the mainnet broadcast confirmation phrase unset during rehearsals.

Review its plan, explicit owner source, membership-root mapping and exception policy before an authorized deployment. For an authorized Sepolia broadcast, use `DRY_RUN=0 npm run deploy:sepolia` with the Sepolia profile, funded testnet deployer and explorer key. Mainnet requires at least three confirmations (`CONFIRMATIONS=3` by default). For actual mainnet deployment, set `DRY_RUN=0` explicitly and set `DEPLOY_CONFIRM_MAINNET` to `I_UNDERSTAND_MAINNET_DEPLOYMENT` in the operator's local environment, then run:

```bash
DRY_RUN=0 npm run deploy:mainnet
```

The script deploys eight linked libraries and the manager, validates successful transaction receipts, compares deployed runtime bytes with the exact release artifacts, confirms paused intake, and completes explorer verification for every contract before proposing ownership transfer when needed. Disabled verification or unrecognized verification errors fail closed. It never opens intake. A proposal leaves the deployer in control until the proposed owner calls `acceptOwnership()`.

A unique deployment journal is saved under `hardhat/deployments/<network>/` before broadcasting and updated after each transaction. It records transaction hashes even if confirmation later fails. An adjacent `.solc-input.json` records the exact build input; `verify-targets.json` lists explorer targets. Preserve these files and their checksums outside the temporary deployment environment.

**A failed command may have broadcast transactions.** Read the saved journal and reconcile transaction receipts before retrying. Do not blindly redeploy. Failed or incomplete explorer verification produces a nonzero exit status; intake remains paused and the script stops before proposing ownership transfer.

If all nine contracts were broadcast but verification or a later step failed, recover verification from the saved journal without a private key:

```bash
DEPLOYMENT_RECEIPT=deployments/mainnet/<saved-receipt>.json npm run reverify:mainnet
```

This command checks successful canonical transaction receipts and confirmations, the recorded deployer and exact creation bytecode/constructor arguments, linked runtime and paused manager state, then retries explorer verification. It sends **zero blockchain transactions**; explorer source-verification requests still use the configured API key. A successful recovery writes a separate `.reverified.<block>.json` receipt and preserves the original journal. Use that new receipt for readiness. It reports whether ownership still needs a proposal and acceptance; it never performs either operation. Incomplete library-only deployments, inconsistent receipts, changed code and further verification failures remain blocked and require explicit operator reconciliation. Never edit verification fields merely to bypass a failed check.

## Accept ownership and verify the live instance

If `pendingOwner()` has not yet been set—for example, after recovering an explorer outage—the current owner first calls `transferOwnership(finalOwner)` with the reviewed address. The intended owner then calls `acceptOwnership()` through its own wallet or verified explorer contract. Confirm `owner()` is the intended owner, `pendingOwner()` is zero, and the former owner no longer has authority.

Configure and verify canonical/alpha participant membership, any explicitly approved additional/Merkle exceptions, eligible NFT credentials, moderators, job limits, review windows and bonds while intake stays paused. Job duration limits are 1–31,536,000 seconds. Validator budget changes affect newly posted jobs only; several other policy changes require live job escrow and bonds to be zero; existing payment claims keep their beneficiaries. Confirm the exact scope in the [owner guide](../docs/OWNER_CONTROLS.md).

New managers start with NFT admission disabled and an empty collection registry. No NFT configuration transaction is needed to retain that default. To opt in after accepting ownership, register reviewed collections with `addAGIType`, then call `setAgentNftRequired(true)` for future jobs. Prepare `reviewed-nft-policy.json` as shown in the [NFT policy walkthrough](../docs/NFT_POLICY.md); the checker requires a boolean choice and the complete expected registry, including disabled entries. A required policy with no enabled collection fails readiness.

Run the read-only checker without a private key. From `hardhat/`, with the mainnet RPC configured:

```bash
READINESS_NFT_CONFIG=./reviewed-nft-policy.json \
DEPLOYMENT_RECEIPT=deployments/mainnet/<saved-receipt>.json npm run check:readiness
```

For Sepolia:

```bash
READINESS_NFT_CONFIG=./reviewed-nft-policy.json \
DEPLOYMENT_RECEIPT=deployments/sepolia/<saved-receipt>.json npm run check:readiness:sepolia
```

This validates the saved receipt's status and configuration hash, then checks one recorded block: exact linked runtime code, native USDC, accepted owner, no pending owner, paused intake, enabled settlement, both expected recipients, ENS/name-wrapper addresses, four identity root nodes, two Merkle roots, the explicit NFT default and complete registry, enabled NFT code hashes, zero initial reserves, funded accounting and USDC transfer restrictions. The block hash is checked again before writing the report; a detected reorganization fails the check. Explorer verification in the report is evidence recorded in the receipt, not a fresh explorer query. The checker sends zero transactions.

By default, identity settings must match the deployment receipt. If the owner intentionally changed them during setup, provide a separately reviewed JSON file using `READINESS_CONFIG=./reviewed-identity.json` alongside `DEPLOYMENT_RECEIPT`. The only permitted keys are `ensConfig` (registry, wrapper), `rootNodes` (club, agent, alpha-club, alpha-agent) and `merkleRoots` (validator, agent). Include only fields whose expected values changed, using complete arrays of actual reviewed addresses or bytes32 roots. This file describes expected state; it performs no updates. The report records its path and SHA-256, and the original receipt remains unchanged. Unexpected keys or a mismatch with actual state fail.

The report also names the configured membership roots and shows Merkle exceptions; it does not enumerate every additional-list entry or prove individual ENS membership.

The report is a technical pre-activation snapshot. It does not validate the private metadata gateway, other mutable operational policies, individual participant eligibility, signer security or monitoring. Review those settings and independent security findings separately before activation.

Only after the reviewed checks pass should the accepted owner call `unpauseIntake()`. Start with deliberately limited exposure and reconcile the first successful job's validator/30%/10%/agent transfers and cleared reserves before scaling. ETH is still required for transaction gas.

## Optional ENS job pages

ENS job pages are optional metadata, separate from agent/validator membership. A fresh USDC launch uses a new helper and dedicated jobs root; it must preserve the original manager, original-asset jobs, helper, namespace and approvals. Follow the [cutover plan](../docs/qualification/USDC_CUTOVER.md). The [replacement guide](../docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md) also explains the separate same-manager replacement case. From `hardhat/`, after filling the intended Sepolia configuration, rehearse:

```bash
DRY_RUN=1 npm run deploy:ens-job-pages:sepolia
```

Review `JOB_MANAGER`, `ENS_DEPLOYMENT_MODE`, `ENS_REGISTRY`, `NAME_WRAPPER`, `PUBLIC_RESOLVER`, `NEW_OWNER`, `VERIFY` and `LOCK_CONFIG`. Fresh mode automatically selects `job-<id>.usdc-<chainId>-<manager40>.alpha.jobs.agi.eth`; it refuses existing jobs/helpers and occupied roots. `JOBS_ROOT_NAME`, `JOBS_ROOT_NODE` and `JOB_LABEL_PREFIX` are optional assertions. Replacement mode preserves the active helper’s root and prefix for the same manager. Read the [naming policy](../docs/ENS_DEPLOYMENT_NAMESPACES.md), verify parent authority and keep configuration unlocked through lifecycle validation.

For the corresponding mainnet read-only plan, use `DRY_RUN=1 npm run deploy:ens-job-pages:mainnet` with the reviewed mainnet values and `DEPLOYER_ADDRESS`. An actual broadcast requires the explicit mainnet confirmation phrase, a funded deployer and `DRY_RUN=0` explicitly. Keep `VERIFY=1` and `LOCK_CONFIG=0`, then run `DRY_RUN=0 npm run deploy:ens-job-pages:mainnet`. The final helper owner must be the separately reviewed `NEW_OWNER`.

Helper broadcasts require explorer verification; `VERIFY` defaults enabled and disabling it blocks a public-network broadcast. A keyless read-only plan needs no explorer API key. The target manager must have intake paused and zero `pendingOwner()` on both supported public networks; complete manager ownership acceptance first and independently compare `owner()` to the reviewed manager receipt. Zero pending owner alone does not prove the intended owner is in control. This gate does not require empty reserves because a separately reviewed same-manager helper replacement may preserve existing jobs. Set the explicit final helper owner through `NEW_OWNER` or `FINAL_OWNER`; omission does not retain the deployer. On Sepolia, configure the actual `ENS_REGISTRY`, `NAME_WRAPPER` (zero is permitted for an unwrapped-only route) and `PUBLIC_RESOLVER` explicitly.

Verification must succeed before configuration locking or ownership transfer. The ENS script writes an incremental `ens-job-pages.<chain>.<id>.json` journal, preserves its exact standard-JSON compiler input at the journal’s `solcInputPath`, validates mined receipts, compares deployed runtime to the qualified artifact and confirms final manager/owner/lock settings. ENSJobPages ownership transfers in **one step**, unlike the manager's two-step handoff; independently verify the recipient. Known protocol dependencies cannot be the ENSJobPages owner. A failed ENS command may have deployed the contract or configured its manager: preserve its journal and reconcile those addresses before retrying. The manager-only recovery command above does not resume or reverify ENS deployments. For an ENS verification failure, preserve the deployed address, journal, exact compiler input and constructor arguments; follow the [helper-specific recovery instructions](../docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md) and do not rerun deployment merely to obtain verification. Keyless ENS dry runs also require `DEPLOYER_ADDRESS`.

| Action | Signer |
| --- | --- |
| Deploy manager/libraries or ENSJobPages | Deployer |
| Accept manager ownership | Proposed final owner |
| Create dedicated wrapped jobs root with the new helper as its token owner | ENS parent owner |
| Broader wrapper authority for a separately reviewed same-manager replacement only | Wrapped-root owner |
| Manager `setEnsJobPages(newEnsJobPages)` | Manager owner |
| Migrate an existing page of the same manager, only if reviewed and needed | ENSJobPages owner |
| Irreversible identity/configuration lock | Respective owner, after full validation |

The scripts neither create the dedicated root nor automatically switch the new manager’s optional ENS pointer. Have the ENS parent owner create the dedicated wrapped root with the new helper as the wrapped-token owner. Verify **both** `ENS.owner(jobsRootNode) == NameWrapper` and `NameWrapper.ownerOf(uint256(jobsRootNode)) == newEnsJobPages`, then wire only the new manager/helper in both directions. The qualified fixture also verifies zero token approval and no operator approval from the parent owner to the helper. This route requires no blanket approval over the legacy owner’s wrapped names. `setApprovalForAll` affects every wrapped name of the approving account and is only an explicitly reviewed same-manager replacement choice.

Before locks, require a full ENS lifecycle: successful creation, actual employer/agent resolver writes, outsider rejection and terminal revocation with post-settlement writes rejected. Check both manager and helper events; successful core receipts alone do not establish ENS success. The fixture uses short metadata; valid maximum-size URIs can exceed the bounded hook budget. Investigate missing records or failed hooks separately, and preserve the old manager’s inventory and original-asset exits.

## Maintenance

Pause intake to stop new work while allowing existing work to settle. Use settlement pause separately for emergency containment. Recipient rotation requires paused intake and zero job escrow and bonds, preventing redirection of existing commitments. USDC issuer restrictions cannot be bypassed by the manager.

Code is non-upgradeable. Future code changes require a fresh deployment and an explicit migration plan. See the [deploy-day runbook](../docs/DEPLOY_DAY_RUNBOOK.md) and [incident response](../docs/OPERATIONS/INCIDENT_RESPONSE.md).
