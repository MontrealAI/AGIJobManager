# Deploy Day Runbook (Ethereum Mainnet)

This runbook is an operator procedure for **production mainnet deployment day** of:
- `contracts/AGIJobManager.sol`
- `contracts/ens/ENSJobPages.sol` (when ENS integration is enabled)

It is written for a **business-operated** control model where `owner` is a multisig (for example, Safe), and deployment execution can be handled by a separate deployer key.

> Scope sequence (mandatory): **deploy → postdeploy config → verify → smoke test → lockIdentityConfiguration → unpause/enable**.

---

## 1) Overview, scope, assumptions

### 1.1 Target and roles
- Target network: **Ethereum Mainnet (`chainId=1`)**.
- Roles in this system:
  - `owner` (strong operational authority; should be multisig)
  - deployer (broadcast account for deployment txs)
  - employer
  - agent
  - validators
  - moderators

### 1.2 Control model assumptions
- [ ] Owner account is a production multisig with explicit signer policy.
- [ ] Deployer key is separate from owner and has minimal lifetime.
- [ ] Hardware wallets are used for all privileged signatures.
- [ ] Signers and operators agree on incident channels and escalation.

### 1.3 Out of scope
This runbook does **not** provide:
- Legal or regulatory advice.
- Token economics redesign.
- Exchange/listing operations.
- Off-chain business terms beyond operational execution.

---

## 2) Pre-deploy checklist (Go/No-Go gate)

## 2.1 Key management and signer separation
- [ ] `owner` is a multisig address (`<OWNER_MULTISIG_ADDRESS>`).
- [ ] Deployment EOA is funded and restricted to deployment tasks.
- [ ] Backup/recovery path for signer loss is documented.
- [ ] Emergency pause authority in multisig is confirmed.

## 2.2 Environment and reproducibility
Run from repo root:

```bash
npm ci
npm run build
npm test
npm run size
```

- [ ] Build and tests pass.
- [ ] Bytecode-size checks pass (EIP-170 guard stays valid).
- [ ] `truffle-config.js` compiler assumptions unchanged (`solc 0.8.23`, optimizer enabled, `runs=50`, `viaIR=false`).

## 2.3 Configuration inputs prepared and reviewed
Use placeholders in runbooks and logs; never commit secrets.

- [ ] RPC endpoint: `<MAINNET_RPC_URL>`
- [ ] Deployer key source: `<PRIVATE_KEYS>` (out-of-band secret handling)
- [ ] Etherscan API key: `<ETHERSCAN_API_KEY>`

`AGIJobManager` deployment inputs:
- [ ] AGI token address (`IERC20`): `<AGI_TOKEN_ADDRESS>`
- [ ] `baseIpfsUrl`: `<BASE_IPFS_URL>`
- [ ] ENS registry: `<ENS_REGISTRY_ADDRESS>`
- [ ] NameWrapper: `<NAMEWRAPPER_ADDRESS>`
- [ ] Root nodes: `<CLUB_ROOT_NODE>`, `<AGENT_ROOT_NODE>`, `<ALPHA_CLUB_ROOT_NODE>`, `<ALPHA_AGENT_ROOT_NODE>`
- [ ] Merkle roots: `<VALIDATOR_MERKLE_ROOT>`, `<AGENT_MERKLE_ROOT>`

`ENSJobPages` deployment inputs (if used):
- [ ] ENS registry: `<ENS_REGISTRY_ADDRESS>`
- [ ] NameWrapper: `<NAMEWRAPPER_ADDRESS>`
- [ ] PublicResolver: `<PUBLIC_RESOLVER_ADDRESS>`
- [ ] `jobsRootNode`: `<JOBS_ROOT_NODE>`
- [ ] `jobsRootName`: `<JOBS_ROOT_NAME>` (example: `alpha.jobs.agi.eth`)

Postdeploy operational inputs (owner txs):
- [ ] validator thresholds / quorum
- [ ] completion/dispute review periods
- [ ] bond parameters
- [ ] moderators list
- [ ] additional allowlisted agents and validators
- [ ] AGI type list (`nftAddress`, `payoutPercentage`)

> **AGIType risk warning:** a wrong NFT address or payout percentage can break eligibility/economics. Add AGI types gradually and verify on-chain reads after every entry.

## 2.4 Rehearsal requirement
- [ ] Execute this exact tx plan on Sepolia or a mainnet fork first.
- [ ] Rehearsal success criteria:
  - deployment + postdeploy config succeeds,
  - verification succeeds,
  - smoke-test job lifecycle succeeds,
  - lock transaction succeeds,
  - unpause path succeeds.

## 2.5 Explicit Go/No-Go signoff
- [ ] Engineering signoff
- [ ] Security signoff
- [ ] Operations signoff
- [ ] Multisig signers on-call and available
- [ ] Rollback/incident owner assigned

---

## 3) Deploy sequence (mainnet)

## 3.1 Deploy `AGIJobManager` (repo migration path)
Use the repository migration path for mainnet:

```bash
npx truffle migrate --network mainnet
```

`migrations/2_deploy_contracts.js` deploys libraries and `AGIJobManager` with `migrations/deploy-config.js` inputs.

## 3.2 Deploy `ENSJobPages` (if ENS integration is enabled)
`ENSJobPages` is not deployed by default migration. Deploy separately (for example via Truffle console):

```bash
npx truffle console --network mainnet
```

Then:

```javascript
const ENSJobPages = artifacts.require("ENSJobPages");
const ensJobPages = await ENSJobPages.new(
  "<ENS_REGISTRY_ADDRESS>",
  "<NAMEWRAPPER_ADDRESS>",
  "<PUBLIC_RESOLVER_ADDRESS>",
  "<JOBS_ROOT_NODE>",
  "<JOBS_ROOT_NAME>"
);
ensJobPages.address;
```

## 3.3 Deployment log (non-secret)
Record in a deployment log file (do not store secrets):
- [ ] chain id, block number, tx hashes
- [ ] deployer and owner addresses
- [ ] deployed addresses (`AGIJobManager`, libs, `ENSJobPages`)
- [ ] exact constructor args
- [ ] git commit hash

## 3.4 Immediate safety posture
Right after deployment, owner should set a safe state before public activity:
- [ ] `pause()` to block new intake while wiring/configuration is finalized.
- [ ] Keep `settlementPaused=false` unless incident handling requires fund-out freeze.

**Pause semantics reminder**
- `pause()`: blocks intake flows (`createJob`, `applyForJob`, validator votes, disputes, etc.) while preserving settlement exits.
- `setSettlementPaused(true)`: additionally blocks settlement/exit paths (`finalize`, `resolveDispute*`, `withdrawAGI`, etc.).

---

## 4) Post-deploy configuration (ordered owner transactions)

> Why order matters: identity and ENS wiring should be finalized and validated before operator lists/parameters are expanded; irreversible lock happens only after proof-by-smoke-test.

## 4.1 ENS wiring first (if used)
1. [ ] `ENSJobPages.setJobManager(<AGIJOBMANAGER_ADDRESS>)`
2. [ ] Confirm ENS root config on `ENSJobPages`:
   - `jobsRootNode`
   - `jobsRootName`
   - `publicResolver`
3. [ ] `AGIJobManager.setEnsJobPages(<ENSJOBPAGES_ADDRESS>)`
4. [ ] `AGIJobManager.setUseEnsJobTokenURI(true|false)` per launch policy

State confirmations:
- [ ] `ENSJobPages.jobManager()` returns AGIJobManager address.
- [ ] `AGIJobManager.ensJobPages()` returns ENSJobPages address.
- [ ] `AGIJobManager.useEnsJobTokenURI()` matches policy.

## 4.2 Access-control and eligibility configuration
5. [ ] `updateMerkleRoots(<VALIDATOR_MERKLE_ROOT>, <AGENT_MERKLE_ROOT>)` (if updating from deploy defaults)
6. [ ] `addModerator(<MODERATOR_ADDRESS>)` for each moderator
7. [ ] `addAdditionalValidator(<ADDRESS>)` / `addAdditionalAgent(<ADDRESS>)` as required

State confirmations:
- [ ] `validatorMerkleRoot`, `agentMerkleRoot` match release plan.
- [ ] `moderators(address)` true for intended moderators.
- [ ] `additionalValidators(address)` / `additionalAgents(address)` true for intended addresses.

## 4.3 AGI types and parameter tuning
8. [ ] Add AGI types **one by one** via `addAGIType(<ERC721_ADDRESS>, <PAYOUT_PERCENT>)`
   - Per-entry checklist:
     - [ ] ERC721 contract address re-validated
     - [ ] payout percent reviewed for economics
     - [ ] on-chain read (`agiTypes(index)`) confirms expected entry
9. [ ] Set operational parameters after internal review:
   - `setVoteQuorum`
   - `setRequiredValidatorApprovals`
   - `setRequiredValidatorDisapprovals`
   - `setCompletionReviewPeriod`
   - `setDisputeReviewPeriod`
   - bond parameter setters

## 4.4 Global sanity checks (must pass before verification/smoke)
- [ ] `owner()` is multisig.
- [ ] `paused()` is `true`.
- [ ] `settlementPaused()` is expected (normally `false`).
- [ ] `ensJobPages`, roots, merkle roots, thresholds, and `validationRewardPercentage` match approved values.
- [ ] No unexpected treasury movements.

---

## 5) Verification

Use repo-supported verifier tooling (`truffle-plugin-verify`) for both contracts.

```bash
npx truffle run verify AGIJobManager --network mainnet
npx truffle run verify ENSJobPages@<ENSJOBPAGES_ADDRESS> --network mainnet
```

If verifier plugin fails, use manual Etherscan verification with exact:
- compiler version (`0.8.23`),
- optimizer settings (`enabled`, `runs=50`),
- `viaIR=false`,
- metadata/revert settings from `truffle-config.js`,
- constructor arguments in exact order.

Deployment log must include:
- [ ] verification links for both contracts
- [ ] exact commit hash
- [ ] verification timestamp and operator

---

## 6) Smoke test (mainnet, minimal risk)

Run with low-value payout and dedicated accounts (employer, agent, validators).

## 6.1 Test flow
1. [ ] Employer creates a tiny payout job (`JobCreated`).
2. [ ] Eligible agent applies (`JobApplied`).
3. [ ] Agent requests completion (`JobCompletionRequested`).
4. [ ] Validators approve/disapprove per policy (`JobValidated` / `JobDisapproved`).
5. [ ] Finalize settlement (`JobCompleted` when agent wins; terminal state reached either way).

## 6.2 What must be true at each stage
- [ ] `lockedEscrow` increases on create; releases correctly on terminalization.
- [ ] Agent/validator bond accounting behaves as expected (`lockedAgentBonds`, `lockedValidatorBonds`).
- [ ] `withdrawableAGI()` remains sane/non-negative and consistent with locked totals.
- [ ] ENS hook attempts emit `EnsHookAttempted`; failures are non-fatal but logged.
- [ ] `NFTIssued` emitted on completion path.

If ENS hook fails:
- [ ] Keep going only if core settlement logic is correct.
- [ ] Open follow-up incident/work item for ENS config or resolver auth.

## 6.3 Abort conditions
**Abort go-live immediately and keep contract paused** if any of the following occur:
- unexpected revert in lifecycle path,
- event/state mismatch,
- incorrect lock accounting,
- wrong address wiring,
- verification mismatch.

Actions:
- [ ] Do **not** call `lockIdentityConfiguration()`.
- [ ] Keep `paused=true`.
- [ ] Open incident and triage root cause.

## 6.4 Cleanup before lock
- [ ] Ensure smoke-test obligations are fully settled.
- [ ] Ensure no unresolved state that would block identity updates if rollback is needed.

---

## 7) `lockIdentityConfiguration` (irreversible)

After lock, identity wiring changes are frozen in `AGIJobManager` (for example token/ENS/root-node-related identity configuration and `setEnsJobPages` path).

## 7.1 Final pre-lock checklist
- [ ] Both contracts verified.
- [ ] ENS wiring correct and tested.
- [ ] Root nodes and merkle roots reviewed.
- [ ] Smoke test passed.
- [ ] Internal approvals captured.

## 7.2 Execute lock
```text
AGIJobManager.lockIdentityConfiguration()
```

Confirm:
- [ ] `lockIdentityConfig == true`
- [ ] `IdentityConfigurationLocked` event emitted

> **Warning (irreversible):** if identity wiring is wrong at lock time, recovery is likely redeployment plus migration planning.

---

## 8) Unpause / enable (go-live)

## 8.1 Controlled enablement
1. [ ] Confirm `settlementPaused == false` (unless incident mode intentionally active).
2. [ ] Call `unpause()`.
3. [ ] Optionally stage rollout (small cohort, then full traffic).

## 8.2 First 24-72h monitoring
- [ ] Lifecycle event rates and failure/revert anomalies
- [ ] ENS hook success ratio (`EnsHookAttempted` success flag)
- [ ] dispute volume and moderator queue health
- [ ] gas anomalies for hot paths (create/apply/validate/finalize)
- [ ] escrow solvency and `withdrawableAGI()` consistency

## 8.3 Communication and on-call
- [ ] Publish deployed addresses and verification links.
- [ ] Publish known limitations and escalation contact.
- [ ] Keep signer quorum and incident commander on-call.

---

## 9) Incident playbooks (short form)

## 9.1 Critical bug
1. [ ] `setSettlementPaused(true)` to stop fund-out.
2. [ ] `pause()` to stop intake.
3. [ ] Snapshot balances, locked totals, and impacted jobs.
4. [ ] Communicate status and mitigation ETA.
5. [ ] Decide repair path (operational workaround vs redeploy).

## 9.2 ENS integration degraded
- Pre-lock options:
  - [ ] fix ENSJobPages config (`setJobManager`, resolver/root updates)
  - [ ] update AGIJobManager ENS helper address (`setEnsJobPages`) if needed
- Post-lock options:
  - [ ] cannot change locked identity wiring in AGIJobManager
  - [ ] can disable ENS tokenURI usage operationally with `setUseEnsJobTokenURI(false)`
  - [ ] keep core settlement live if unaffected

## 9.3 Allowlists / roots misconfiguration
- [ ] Keep or return to paused state.
- [ ] Correct with `updateMerkleRoots` and/or additional allowlist mappings.
- [ ] Re-run minimal smoke checks before resuming.

## 9.4 Emergency ownership procedures
- [ ] Multisig signer compromise protocol executed.
- [ ] Rotate signers/threshold per governance policy.
- [ ] Reconfirm pause authority and incident comms channels.

---

## 10) Deployment-day command checklist (copy/paste)

```bash
# Build/test gate
npm ci
npm run build
npm test
npm run size

# Deploy AGIJobManager via migrations
npx truffle migrate --network mainnet

# (Optional) Deploy ENSJobPages in truffle console
npx truffle console --network mainnet

# Postdeploy config helper (optional, if using script-driven config)
node scripts/postdeploy-config.js --network mainnet --address <AGIJOBMANAGER_ADDRESS> --config-path <CONFIG_JSON>

# Config verification helper
node scripts/verify-config.js --network mainnet --address <AGIJOBMANAGER_ADDRESS> --config-path <CONFIG_JSON>

# Etherscan verification
npx truffle run verify AGIJobManager --network mainnet
npx truffle run verify ENSJobPages@<ENSJOBPAGES_ADDRESS> --network mainnet
```

