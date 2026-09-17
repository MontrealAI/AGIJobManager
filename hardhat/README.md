# Hardhat deployment guide — v0.9.1

This is the supported public-network deployment path. The root contract regression suites also use Hardhat 3; Truffle/Ganache dependencies are removed. v0.9.1 requires a fresh deployment and two real recipient wallets; this release does not deploy a contract or populate those addresses.

The manager starts with intake paused in its constructor. Successful jobs pay validators in USDC first, then 30% and 10% of the original job cost to the two wallets, then the agent remainder. The default validator budget is 8%. See [payout rules](../docs/USDC_PAYOUT_SPLIT.md), [owner controls](../docs/OWNER_CONTROLS.md) and [mainnet qualification](../docs/MAINNET_READINESS.md).

## Prepare

Use Node 22.23.2 and the immutable release tag. Install from committed lockfiles:

```bash
npm ci
cd hardhat
npm ci
cp .env.example .env
cp deploy.config.example.cjs deploy.config.cjs
```

Review `deploy.config.cjs` as executable JavaScript from a trusted source. Set each network's `settlementWallets: [wallet30, wallet10]` and intended `finalOwner`; independently confirm control of these addresses. Review ENS registry, wrapper, four root nodes, two Merkle roots and metadata gateway. The example's historical identity roots and owner are not confirmation of your intended configuration. Prefer a tested multisignature owner for substantial funds.

In the local environment, configure the selected RPC, `DEPLOY_CONFIG=./deploy.config.cjs`, and `ETHERSCAN_API_KEY`. Actual deployment additionally requires a funded, disposable deployer `PRIVATE_KEY`. Never commit keys, paste them into issue reports, or provide them to untrusted tools. Mainnet and Sepolia profiles are bound to chain IDs 1 and 11155111.

Native USDC is fixed to Circle's Ethereum or Sepolia address. All amounts use six decimals. USDC pause/blocklist checks run at one recorded preflight block. Both recipients must be distinct, nonzero and different from USDC; the contract also rejects itself as a recipient. [Circle's registry](https://developers.circle.com/stablecoins/usdc-contract-addresses) is the address authority.

## Compile and rehearse

From `hardhat/`:

```bash
npm run compile
npm run test:preflight
npm run test:deployment
npm run test:mainnet-fork
DRY_RUN=1 npm run deploy:sepolia
```

The fork command exposes only a local Hardhat chain, reads a pinned mainnet block, and sends no Ethereum transactions. It uses actual Circle USDC code and state. RPC failure is a failed qualification, not a skipped test. Rehearse the complete owner, employer, validator, agent and refund journeys on Sepolia using the intended operational setup before significant mainnet exposure.

The qualified compiler is Solidity 0.8.37, optimizer 40 runs, Shanghai, `viaIR=true`, metadata bytecode hash disabled and revert strings stripped. The deployment script checks the compiler profile, artifact/build consistency, EIP-170 runtime size (24,576 bytes), EIP-3860 constructor data (49,152 bytes), and EIP-7825 transaction gas limit (16,777,216). Local deployment tests cover the manager, all five libraries and both optional metadata contracts. Use the release profile unchanged; a new compiler profile requires complete requalification. The [compiler compatibility note](../scripts/security/COMPILER_COMPATIBILITY.md) describes two identifier-only dependency patches applied without disabling compiler warnings.

## Review and deploy

A dry run validates configuration, chain, token state and compiled artifacts without broadcasting. With no private key configured, set `DEPLOYER_ADDRESS` to the intended deployer address for this read-only plan:

```bash
DRY_RUN=1 npm run deploy:mainnet
```

Boolean settings (`DRY_RUN`, and the optional ENS script's `VERIFY`/`LOCK_CONFIG`) accept explicit `1`/`0`, `true`/`false`, `yes`/`no` or `on`/`off`. Unknown text is rejected before any transaction. `DRY_RUN=true` is also read-only. Keep the mainnet broadcast confirmation phrase unset during rehearsals.

Review its plan before an independently authorized deployment. Mainnet requires at least three confirmations (`CONFIRMATIONS=3` by default). For actual mainnet deployment, remove `DRY_RUN=1` and set `DEPLOY_CONFIRM_MAINNET` to `I_UNDERSTAND_MAINNET_DEPLOYMENT` in the operator's local environment, then run:

```bash
npm run deploy:mainnet
```

The script deploys five linked libraries and the manager, validates successful transaction receipts, compares deployed runtime bytes with the exact release artifacts, confirms paused intake, and completes explorer verification for every contract before proposing ownership transfer when needed. Disabled verification or unrecognized verification errors fail closed. It never opens intake. A proposal leaves the deployer in control until the proposed owner calls `acceptOwnership()`.

A unique deployment journal is saved under `hardhat/deployments/<network>/` before broadcasting and updated after each transaction. It records transaction hashes even if confirmation later fails. An adjacent `.solc-input.json` records the exact build input; `verify-targets.json` lists explorer targets. Preserve these files and their checksums outside the temporary deployment environment.

**A failed command may have broadcast transactions.** Read the saved journal and reconcile transaction receipts before retrying. Do not blindly redeploy. Failed or incomplete explorer verification produces a nonzero exit status; intake remains paused and the script stops before proposing ownership transfer.

If all six contracts were broadcast but verification or a later step failed, recover verification from the saved journal without a private key:

```bash
DEPLOYMENT_RECEIPT=deployments/mainnet/<saved-receipt>.json npm run reverify:mainnet
```

This command checks successful canonical transaction receipts and confirmations, the recorded deployer and exact creation bytecode/constructor arguments, linked runtime and paused manager state, then retries explorer verification. It sends **zero blockchain transactions**; explorer source-verification requests still use the configured API key. A successful recovery writes a separate `.reverified.<block>.json` receipt and preserves the original journal. Use that new receipt for readiness. It reports whether ownership still needs a proposal and acceptance; it never performs either operation. Incomplete library-only deployments, inconsistent receipts, changed code and further verification failures remain blocked and require explicit operator reconciliation. Never edit verification fields merely to bypass a failed check.

## Accept ownership and verify the live instance

If `pendingOwner()` has not yet been set—for example, after recovering an explorer outage—the current owner first calls `transferOwnership(finalOwner)` with the reviewed address. The intended owner then calls `acceptOwnership()` through its own wallet or verified explorer contract. Confirm `owner()` is the intended owner, `pendingOwner()` is zero, and the former owner no longer has authority.

Configure eligibility, moderators, job limits, review windows and bonds while intake stays paused. Job duration limits are 1–31,536,000 seconds. Validator budget changes affect newly posted jobs only; several other policy changes require all reserves to be zero. Confirm the exact scope in the [owner guide](../docs/OWNER_CONTROLS.md).

Run the read-only checker without a private key. From `hardhat/`, with the mainnet RPC configured:

```bash
DEPLOYMENT_RECEIPT=deployments/mainnet/<saved-receipt>.json npm run check:readiness
```

For Sepolia:

```bash
DEPLOYMENT_RECEIPT=deployments/sepolia/<saved-receipt>.json npm run check:readiness:sepolia
```

This validates the saved receipt's status and configuration hash, then checks one recorded block: exact linked runtime code, native USDC, accepted owner, no pending owner, paused intake, enabled settlement, both expected recipients, ENS/name-wrapper addresses, four identity root nodes, two Merkle roots, zero initial reserves, funded accounting and USDC transfer restrictions. The block hash is checked again before writing the report; a detected reorganization fails the check. Explorer verification in the report is evidence recorded in the receipt, not a fresh explorer query. The checker sends zero transactions.

By default, identity settings must match the deployment receipt. If the owner intentionally changed them during setup, provide a separately reviewed JSON file using `READINESS_CONFIG=./reviewed-identity.json` alongside `DEPLOYMENT_RECEIPT`. The only permitted keys are `ensConfig` (registry, wrapper), `rootNodes` (club, agent, alpha-club, alpha-agent) and `merkleRoots` (validator, agent). Include only fields whose expected values changed, using complete arrays of actual reviewed addresses or bytes32 roots. This file describes expected state; it performs no updates. The report records its path and SHA-256, and the original receipt remains unchanged. Unexpected keys or a mismatch with actual state fail.

The report is a technical pre-activation snapshot. It does not validate the private metadata gateway, mutable operational policies, individual participant eligibility, signer security or monitoring. Review those settings and independent security findings separately before activation.

Only after the reviewed checks pass should the accepted owner call `unpauseIntake()`. Start with deliberately limited exposure and reconcile the first successful job's validator/30%/10%/agent transfers and cleared reserves before scaling. ETH is still required for transaction gas.

## Optional ENS job pages

ENS job pages are an optional metadata integration. They are not needed to hold or settle USDC. If used, follow the [ENS replacement guide](../docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md) and use:

```bash
DRY_RUN=1 npm run deploy:ens-job-pages:sepolia
```

Review `JOB_MANAGER`, `JOBS_ROOT_NAME`, `JOBS_ROOT_NODE`, `ENS_REGISTRY`, `NAME_WRAPPER`, `PUBLIC_RESOLVER`, `NEW_OWNER`, `VERIFY` and `LOCK_CONFIG` before actual deployment. A mainnet broadcast requires the same explicit mainnet confirmation phrase.

Set `VERIFY=1` for explorer verification. When requested, verification must succeed before configuration locking or ownership transfer. The ENS script writes an incremental `ens-job-pages.<chain>.<id>.json` journal, validates mined receipts and confirms final manager/owner/lock settings. ENSJobPages ownership transfers in **one step**, unlike the manager's two-step handoff; independently verify the recipient. Known protocol dependencies cannot be the ENSJobPages owner. A failed ENS command may have deployed the contract or configured its manager: preserve its journal and reconcile those addresses before retrying. The manager-only recovery command above does not resume ENS deployments. Keyless ENS dry runs also require `DEPLOYER_ADDRESS`.

| Action | Signer |
| --- | --- |
| Deploy manager/libraries or ENSJobPages | Deployer |
| Accept manager ownership | Proposed final owner |
| NameWrapper `setApprovalForAll(newEnsJobPages, true)` | Wrapped-root owner |
| Manager `setEnsJobPages(newEnsJobPages)` | Manager owner |
| Migrate an existing wrapped job label, if needed | ENSJobPages owner |
| Irreversible identity/configuration lock | Respective owner, after full validation |

The scripts do not grant NameWrapper approvals or automatically switch the manager's optional ENS pointer. Verify these manually and test a future job hook before locking configuration. Hook failures are bounded and must not override escrow outcomes.

## Maintenance

Pause intake to stop new work while allowing existing work to settle. Use settlement pause separately for emergency containment. Recipient rotation requires paused intake and zero job escrow and bonds, preventing redirection of existing commitments. USDC issuer restrictions cannot be bypassed by the manager.

Code is non-upgradeable. Future code changes require a fresh deployment and an explicit migration plan. See the [deploy-day runbook](../docs/DEPLOY_DAY_RUNBOOK.md) and [incident response](../docs/OPERATIONS/INCIDENT_RESPONSE.md).
