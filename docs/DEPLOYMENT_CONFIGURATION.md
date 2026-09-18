# Deployment configuration — post-v1.0.5 maintenance

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

These operator files are ignored by git. Preserve deployment journals and reviewed configuration securely. The `.cjs` profile is executable JavaScript, so review it before any command loads it. Example files intentionally omit real recipients and owner. The NFT example has `agentNftRequired: false` and an empty registry, matching a fresh v1.0.5 manager. This is a valid optional NFT policy; readiness still checks it against the actual instance and requires all ownership, funding, identity and deployment checks to pass. No NFT-setting transaction is needed to retain the fresh default. To opt in, register reviewed collections, enable the requirement for future jobs and update the policy file. Existing reviewed files are preserved, so inspect them when updating an operator checkout.

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

Boolean inputs accept `1/0`, `true/false`, `yes/no` and `on/off`; unknown values fail. In this maintenance version, absent/empty `DRY_RUN` is read-only for both manager and helper. Published v1.0.5 and earlier scripts retain the historical broadcast default; use explicit `DRY_RUN=1` for plans on every version. Existing private `.env` files with `DRY_RUN=0` still explicitly request broadcast; setup preserves them. Clear an old broadcast setting or override it for each plan. `VERIFY` controls the ENS helper only: manager broadcasts always require verification.

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
| Deploy after review | `DRY_RUN=0 npm run deploy:mainnet` or `deploy:sepolia` | Deployments and ownership proposal; mainnet phrase also required |
| Plan optional helper | `DRY_RUN=1 npm run deploy:ens-job-pages:mainnet` or `deploy:ens-job-pages:sepolia` | Chain reads and constructor estimation; zero broadcasts |
| Deploy optional helper after review | `DRY_RUN=0 npm run deploy:ens-job-pages:mainnet` or `deploy:ens-job-pages:sepolia` | Helper deployment/configuration/one-step ownership transfer; mainnet phrase also required |
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
| Manager has a pending owner | Intended owner calls `acceptOwnership()`; verify owner and zero pending owner before helper/readiness steps |
| Fresh ENS root occupied or manager has existing jobs/helper | Reconcile the prior journal and inventory; use replacement only for the same manager with an active helper |
| Command failed after a broadcast | Preserve its journal and reconcile receipts before any retry; never blindly redeploy |
| All nine deployments exist but verification failed | Use manager verification recovery; preserve the original journal and use the new recovery receipt for readiness |
| ENS helper verification failed | Follow [helper recovery](DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md); manager recovery cannot process this journal |
| Readiness report already exists at the checked block | Preserve it, compare inputs and rerun after a new block; the checker never overwrites evidence |

Read [the deployment troubleshooting guide](TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md) for namespace authority and best-effort hook failures. Keep live intake paused until the actual instance's required checks pass.
