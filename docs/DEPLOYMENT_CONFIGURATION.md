# Deployment configuration

> Unreleased candidate: new Manager/helper/router creation assigns an explicit nonzero governor atomically and leaves configuration/activation separate. See the [candidate authority matrix](DEPLOYMENT/EXPLICIT_GOVERNOR_CANDIDATE.md). Deployer-handover instructions below describe historical ownership semantics, not the new creation flow. Previous deployments, funds and permissions must remain untouched; historical liabilities are not a prerequisite for an independent new deployment.
For the already commissioned instance, start with the [supported inspection and recovery workflow](OPERATIONS/COMMISSIONING.md). It reports current observations separately from the completed historical milestone; no deployment is needed when connection checks pass.

> Current guide for this source checkout. See [release identity and deployment commands](RELEASE_GUIDE.md).

Start with the [Hardhat guide](../hardhat/README.md). This reference answers which file to edit, which command to run, and whether it sends a transaction. Ethereum mainnet is chain **1**; Sepolia is **11155111**. No production owner, payment recipients or manager address is supplied.

## Set up once

From the repository root, using Node 22.23.2 and the selected reviewed source with its matching [Hardhat guide](../hardhat/README.md):

```bash
npm ci
npm --prefix hardhat ci
npm --prefix hardhat run setup
```

Setup creates only missing files. Existing files, directories and symlinks at the destination are preserved. New files have private `0600` permissions on POSIX; use the appropriate account permissions on Windows. Setup writes local examples; it does not choose an owner, change an existing manager's policy, access an RPC, sign or deploy anything.

| File | What to review |
| --- | --- |
| `hardhat/.env` | Selected RPC, public deployer address for planning, flags and later signing/explorer credentials |
| `hardhat/deploy.config.cjs` | The selected network's owner, native USDC, both recipients, metadata gateway, ENS dependencies, four role roots and two Merkle roots |
| `hardhat/reviewed-nft-policy.json` | Explicit required/optional choice and complete expected collection registry, including disabled entries; [examples](NFT_POLICY.md#hardhat-deployment-and-readiness) |
| `hardhat/reviewed-identity.json` | Optional expected identity changes made after deployment; create only if needed, following the Hardhat guide |

These operator files are ignored by git. Preserve deployment journals and reviewed configuration securely. The `.cjs` profile is executable JavaScript, so review it before any command loads it. Example files intentionally omit real recipients and owner. The NFT example has `agentNftRequired: false` and an empty registry, matching a fresh manager. This is a valid optional NFT policy; readiness still checks it against the actual instance and requires all ownership, funding, identity and deployment checks to pass. No NFT-setting transaction is needed to retain the fresh default. To opt in, register reviewed collections, enable the requirement for future jobs and update the policy file. Existing reviewed files are preserved, so inspect them when updating an operator checkout.

## Environment and path rules

All supported Hardhat commands load **`hardhat/.env`** regardless of the caller's directory. Exported shell values take precedence, including an explicitly empty value. A missing `.env` is allowed when the shell supplies settings; an unreadable file fails. The root `.env` is used by separate Node operator tools and is not a fallback for Hardhat.

From the root, `npm --prefix hardhat run <command>` runs with `hardhat/` as its working directory. Relative `DEPLOY_CONFIG`, receipt, policy and report paths are interpreted from that working directory; absolute paths also work. The default deployment profile path is always `hardhat/deploy.config.cjs`. Prefer the documented npm commands over a direct `npx hardhat` invocation with a different config root.

When upgrading an existing operator checkout, compare the example with your private files: setup preserves them and does not inject new defaults. Move any Hardhat settings previously kept only in the root `.env` into `hardhat/.env` or the shell. Retired `PRIVATE_KEYS`, `ALCHEMY_KEY`, Truffle gas settings and Ganache configuration are not supported deployment inputs. The key name is singular: `PRIVATE_KEY`.

### Manager deployment settings

| Setting | Requirement and meaning |
| --- | --- |
| `MAINNET_RPC_URL` | Required for mainnet chain reads or deployment; use a trusted endpoint for chain 1 |
| `SEPOLIA_RPC_URL` | Required for Sepolia chain reads or deployment; use chain 11155111 |
| `PRIVATE_KEY` | Needed only for broadcasts; funded disposable deployer; leave empty for read-only work |
| `DEPLOYER_ADDRESS` | Public nonzero deployer address for a keyless `DRY_RUN=1`; a configured signer takes precedence |
| `ETHERSCAN_API_KEY` | Required for broadcasts and verification recovery; dry-run plans and readiness need no explorer key |
| `DEPLOY_CONFIG` | Optional reviewed `.cjs` override; default is the private Hardhat profile, never the example |
| `FINAL_OWNER` | Optional override of the selected manager profile's `finalOwner`; one must explicitly identify the intended owner |
| `DRY_RUN` | Defaults to read-only (`1`), including when absent/empty; explicit `0` requests broadcast subject to all other gates |
| `DEPLOY_CONFIRM_MAINNET` | Required for mainnet broadcasts: `I_UNDERSTAND_MAINNET_DEPLOYMENT`; unnecessary for read-only commands |
| `CONFIRMATIONS` | Default 3; mainnet minimum 3, Sepolia minimum 1 |
| `VERIFY_DELAY_MS` | Default 3500; nonnegative integer delay for explorer verification attempts |

Boolean inputs accept `1/0`, `true/false`, `yes/no` and `on/off`; unknown values fail. In v1.1.0, absent/empty `DRY_RUN` is read-only for both manager and helper. Published v1.0.5 and earlier scripts retain the historical broadcast default; use explicit `DRY_RUN=1` for plans on every version. Existing private `.env` files with `DRY_RUN=0` still explicitly request broadcast; setup preserves them. Clear an old broadcast setting or override it for each plan. `VERIFY` controls the ENS helper only: manager broadcasts always require verification.

### Optional ENS helper settings

| Setting | Requirement and meaning |
| --- | --- |
| `JOB_MANAGER` | Explicit verified USDC manager; ownership accepted, no pending owner, intake paused |
| `NEW_OWNER` | Explicit helper owner; falls back only to the `FINAL_OWNER` environment variable, not the manager profile; helper ownership is one-step |
| `ENS_DEPLOYMENT_MODE` | Default `fresh`: derives a new root from chain and full manager address; `replacement`: preserves the active helper's namespace for the same manager |
| `JOBS_ROOT_NAME` | Optional assertion against the derived/preserved root; not an arbitrary rename |
| `JOBS_ROOT_NODE` | Optional ENS namehash assertion for that root |
| `JOB_LABEL_PREFIX` | Optional assertion; fresh mode requires `job-`, replacement preserves the active prefix |
| `ENS_REGISTRY` | Mainnet default is built in; Sepolia requires an explicit reviewed registry with code |
| `NAME_WRAPPER` | Mainnet default is built in; Sepolia requires an explicit value; only this dependency permits zero for an unwrapped route |
| `PUBLIC_RESOLVER` | Mainnet default is built in; Sepolia requires an explicit reviewed resolver with code |
| `VERIFY` | Defaults enabled; disabling it blocks helper broadcasts; read-only plans still work |
| `LOCK_CONFIG` | Defaults disabled; keep `0` through wiring and lifecycle checks; locking is irreversible |

Fresh naming is `job-<jobId>.usdc-<chainId>-<manager40>.alpha.jobs.agi.eth`. Read [namespace requirements and replacement limits](ENS_DEPLOYMENT_NAMESPACES.md) before deployment. The helper script does not create the dedicated root or call the manager's `setEnsJobPages`. Those actions need the respective authorized owners. A release does not register an ENS name.

### Readiness, recovery and fork settings

| Setting | Requirement and meaning |
| --- | --- |
| `DEPLOYMENT_RECEIPT` | Required saved manager/library journal for recovery or readiness; ENS helper journals are a different format |
| `READINESS_NFT_CONFIG` | Required for readiness; setup uses `./reviewed-nft-policy.json`; must match the complete on-chain policy |
| `READINESS_CONFIG` | Optional reviewed expected changes to `ensConfig`, `rootNodes` or `merkleRoots`; never edits the original receipt |
| `MAINNET_FORK_RPC_URL` | Optional archive-capable endpoint for pinned local fork tests; the committed fixture has a public default |
| `CUTOVER_REPORT` | Optional output path for the local fork report; use `../build/qualification/mainnet-cutover.json` with Hardhat npm commands |

## Choose the command

Run these from `hardhat/`; from the repository root, insert `--prefix hardhat` after `npm`.

| Stage | Command | Network effect |
| --- | --- | --- |
| Validate local profile | `npm run check:config:mainnet` or `check:config:sepolia` | Offline; no provider or signer |
| Compile | `npm run compile` | Uses the pinned installed compiler; no blockchain transactions |
| Review live deployment plan | `DRY_RUN=1 npm run deploy:mainnet` or `deploy:sepolia` | Chain reads; zero broadcasts |
| Deploy after review | `DRY_RUN=0 npm run deploy:mainnet` or `deploy:sepolia` | CREATE transactions with atomic explicit-governor assignment; mainnet phrase also required |
| Plan optional helper | `DRY_RUN=1 npm run deploy:ens-job-pages:mainnet` or `deploy:ens-job-pages:sepolia` | Chain reads and constructor estimation; zero broadcasts |
| Deploy optional helper after review | `DRY_RUN=0 npm run deploy:ens-job-pages:mainnet` or `deploy:ens-job-pages:sepolia` | Helper CREATE only; governor configuration remains separate; mainnet phrase also required |
| Recover manager verification | `npm run reverify:mainnet` or `reverify:sepolia` | Chain reads and explorer verification requests; zero blockchain transactions |
| Verify pre-activation state | `npm run check:readiness` or `check:readiness:sepolia` | Chain reads and a local report; zero broadcasts |

The offline check and live deployment share profile validation. Offline success does not prove signer control, deployed code, RPC availability, gas affordability, explorer access or readiness. The manager dry run is not a total gas estimate; linked creation transactions are estimated as their prerequisites become available. The accepted owner activates intake separately after the [launch checklist](LAUNCH_CHECKLIST.md).

## Resolve a blocked step

| Message or situation | Next action |
| --- | --- |
| Deployment command prints a plan and exits | Read-only is the default. Broadcast only after review with explicit `DRY_RUN=0`, a funded signer and required explorer/mainnet settings |
| Network does not exist | Fill the selected RPC in `hardhat/.env`; root `.env` and retired provider-key aliases are not used |
| Missing profile, owner or recipients | Run setup, review the selected profile, then rerun its offline check |
| Deployer account required for dry run | Leave the key empty and supply the intended public `DEPLOYER_ADDRESS` |
| Required NFT policy has no enabled collections | Register reviewed collections or explicitly choose optional policy, then match the complete policy file |
| New-schema manager has a pending owner | Stop and reconcile: constructor governance requires the explicit governor and zero pending owner; no automatic handover or acceptance |
| Fresh ENS root occupied or manager has existing jobs/helper | Stop and reconcile the prior journal/inventory. The independent-new-deployment scope does not authorize changing old helpers, roots or permissions |
| Command failed after a broadcast | Preserve its journal and reconcile receipts before any retry; never blindly redeploy |
| All nine deployments exist but verification failed | Use manager verification recovery; preserve the original journal and use the new recovery receipt for readiness |
| ENS helper verification failed | Follow [helper recovery](DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md); manager recovery cannot process this journal |
| Readiness report already exists at the checked block | Preserve it, compare inputs and rerun after a new block; the checker never overwrites evidence |

Read [the deployment troubleshooting guide](TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md) for namespace authority and best-effort hook failures. Keep live intake paused until the actual instance's required checks pass.

## Existing review escrow

Use [existing review-escrow recovery](OPERATIONS/REVIEW_PROTECTION.md). New companion deployments are disabled. `REVIEW_ESCROW_ADDRESS` is mandatory and must match the original journal. `JOB_MANAGER_CODE_HASH` pins the manager runtime. `VERIFY_RPC_URL` supplies an independent witness for actual verification recovery; `DRY_RUN=1` produces a read-only recovery plan. `DRY_RUN=0` verifies the original receipt, runtime, immutable manager/token and explorer source without sending a blockchain transaction. Network RPC, `JOB_MANAGER`, `CONFIRMATIONS` and explorer settings apply. A deployer signer, `MAX_REVIEW_DEPLOY_ETH` and deployment-confirmation phrase are not used by this recovery command. Keep endpoint credentials private.

## Read-only ENS connection checker and Node startup controls

For the [already-connected USDC instance](deployments/MAINNET_USDC_2026-10-10.md#read-only-commands), use the instance-specific connection checker, not another deployment. It starts directly with Node, resolves installed dependencies from the explicit `--repo` checkout, and reads only `MAINNET_RPC_URL` from that checkout's `hardhat/.env` when the shell does not supply it. It does not load the environment file into `process.env`, start Hardhat, compile, install dependencies or sign transactions.

| Reserved control | Requirement and meaning |
| --- | --- |
| `NODE_OPTIONS` | Must be absent or empty in the launch environment; the checker refuses nonempty inherited values before loading dependencies. This is not a supported deployment or RPC setting. |
| `NODE_PATH` | Must be absent or empty in the launch environment; the checker refuses inherited module-search overrides. This is not a supported deployment or RPC setting. |

Both entries are deliberately empty in `hardhat/.env.example`. They document prohibited startup overrides, not permission to add them. Empty `.env` entries do not clear inherited shell values. Node may process preload options before the checker starts, so the check cannot undo a preload that already ran: review the shell, service launcher and command-line options **before starting Node**. Do not erase unfamiliar values merely to force a pass, and do not edit the preserved operator checkout for this documentation update.

## Standalone USDC implementation evidence

The read-only [implementation companion](DEPLOYMENT_USDC_IMPLEMENTATION_CHECK.md) uses `MAINNET_RPC_URL`, an explicitly owner/operator-reviewed JSON binding in `READINESS_USDC_CONFIG`, and a new exclusive output path in `USDC_IMPLEMENTATION_REPORT`. It does not load `.env`, create a signer, edit receipts or grant deployment/activation approval. Export only the needed values privately.

To match a separate financial/readiness report's canonical snapshot, export both `USDC_SNAPSHOT_BLOCK_NUMBER` (decimal) and `USDC_SNAPSHOT_BLOCK_HASH`. Omit or unset both to select latest; empty exported snapshot settings are invalid. The companion rejects a different canonical hash and unsupported proxy/chain/type. Observed candidate values are not approved bindings. Its result covers only the implementation-identity portion of A2.

## Unreleased explicit-governor creation and closeout settings

The creator is explicitly selected in the core reviewed profile as `creator.address` and `creator.transactionMode`. It need not equal `finalOwner`. Initial governance is assigned atomically; no creator transfer or governor acceptance is part of new creation. Subsequent ownership changes retain their existing semantics. No old deployment action is authorized by this candidate.

| Setting | Candidate behavior |
| --- | --- |
| `CREATOR_TRANSACTION_MODE` | Optional-helper transaction mode; only qualified `eoa-create` with empty creator code is supported by this increment. Other transports fail closed. |
| `DEPLOYMENT_LOCK_DIRECTORY` | Existing operator-selected shared directory for exclusive chain/creator nonce locks. Unresolved failures retain the lock; never auto-break it. |
| `ENS_BUILD_DIGEST` | Reviewed digest of exact helper compiler input and compiler long version, required before live creation. |
| `ENS_MANAGER_CODE_HASH` | Explicit reviewed runtime hash of the new paused, governor-owned manager. |
| `ENS_JOURNAL` | Unique new helper journal for creation, or original journal for keyless source re-verification. |
| `ENS_REVERIFY` | Explicit source-verification recovery mode; never redeploys or sends governor configuration. |
| `ENS_REPORT` | New exclusive recovery report path, preserving the original journal. |
| `ENS_LEGACY_ARTIFACT` | Explicit original five-argument helper artifact for historical read-only recovery. |
| `ENS_LEGACY_BUILD_INFO` | Exact original helper compiler build for historical recovery; never current source substituted for old evidence. |
| `ENS_LEGACY_BUILD_DIGEST` | Reviewed original helper compiler-input identity, checked against the original saved input. |
| `AUTHORITY_REVIEW` | Source-bound reviewed direct-role/metadata expectations; complete creator and governor subjects required. |
| `AUTHORITY_REPORT` | New read-only direct authority report. Passing direct checks remains `finalized:false`, `activationAuthorized:false`, exit 3 while comprehensive setup, ENS/controller/operator, signing and approval gates remain. |

Optional router configuration uses `ROUTER_CONFIG`, `ROUTER_JOURNAL`, `ROUTER_REVERIFY` and `ROUTER_REPORT`; archived two-argument router recovery additionally names `ROUTER_LEGACY_ARTIFACT` and `ROUTER_LEGACY_BUILD_INFO`. New router schemas bind creator separately from owner and append the explicit governor to constructor arguments. No metadata pointer, root custody, approval, fee wallet or intake state is changed by optional CREATE/verification.

## Core external-signing endpoint inputs

The unreleased [core external-signing CLI](deployment/core-external-signing.md) starts directly with Node and does not load `.env`. Export the needed endpoint explicitly in the command's launch environment. The empty example entries document these names; copying the example to `.env` does not configure this CLI. Keep endpoint credentials private and out of plans, reports and source control.

| Setting | Exact scope |
| --- | --- |
| `MANAGER_READ_RPC_URL` | Explicit HTTPS endpoint for the bounded read-only transport used by preflight, start, handoff, recover, reconcile, complete and relay's pre-send checks. Production requires canonical EIP-1898 block tags; no numbered-block fallback is allowed. |
| `MANAGER_RELAY_RPC_URL` | Separate explicit HTTPS endpoint used only by the user-run `relay` command, after its exact acknowledgement and durable attempt record. It submits the already checked raw transaction once; it does not sign, retry or bump fees. |

The offline `plan`, `import`, `retrieve-handoff`, `inspect-journal`, `repair-journal` and verification-export commands do not need either endpoint. Retrieval and journal repair operate only on the saved local evidence. Both transports reject embedded username/password credentials, URL fragments and non-HTTPS URLs. Supplying an endpoint grants no signing, configuration or activation approval; all source, actor, envelope and receipt checks remain required.

## Ubuntu hidden-TTY creator run input

The [Ubuntu creator entry point](deployment/ubuntu-ephemeral-creator.md) uses
`MANAGER_CREATOR_RUN` for the absolute path to its reviewed public
`manager-tty-creator-run-v1` JSON file. Set this path in the launch environment.
The blank entry in `hardhat/.env.example` documents the setting; this route rejects
deployment `.env` files and never loads them. No private key belongs in the run
JSON, environment, command arguments, example file or logs.

The same `MANAGER_READ_RPC_URL` and `MANAGER_RELAY_RPC_URL` names configure this
wrapper's bounded read and once-only submission stages. Keep endpoint credentials
local. In `inspect` mode no endpoint is required; the command validates the exact
source, catalog and public plan without creating operator state. In `new` or
`resume` mode, current preflight and deliberate public-plan confirmation precede
the hidden local key prompt. Governor configuration remains a separate workflow.
