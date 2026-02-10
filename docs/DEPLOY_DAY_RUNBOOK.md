# Deploy Day Runbook (Ethereum Mainnet)

This runbook is the production deployment procedure for `AGIJobManager` on Ethereum Mainnet, with optional ENS integration via `ENSJobPages`.

It is written to match this repository’s Truffle configuration, migrations, and on-chain admin functions.

## 1) Overview, scope, and assumptions

### Scope
- Contracts:
  - `contracts/AGIJobManager.sol`
  - `contracts/ens/ENSJobPages.sol` (if ENS hooks/token URI integration are enabled)
- Network: **Ethereum Mainnet**.
- Deployment stack: **Truffle + OpenZeppelin + truffle-plugin-verify**.

### Roles and operating model
- **Owner**: business operator account with privileged controls; should be a **multisig (e.g., Safe)** in production.
- **Deployer**: EOA/hardware-backed signer used for deployment transactions.
- **Employer / Agent / Validator / Moderator**: protocol roles used in live operations.

### Trust model assumptions
- This is an owner-operated system with meaningful owner powers (pause/unpause, parameter updates, allowlist/root updates, and identity locking).
- Owner key management and signer separation are therefore part of protocol security, not optional process overhead.

### Out of scope
- Legal/regulatory advice.
- Token economics strategy.
- Centralized exchange/listing operations.
- Treasury strategy beyond contract-level controls.

---

## 2) Pre-deploy Go/No-Go checklist

### A. Key management and signer hygiene
- [ ] Owner address is a multisig (`<OWNER_MULTISIG_ADDRESS>`).
- [ ] Deployer signer is separate from owner signer.
- [ ] Deployer and owner signers are hardware-backed.
- [ ] `PRIVATE_KEYS`, RPC endpoints, and API keys are loaded from secure runtime only (never committed).
- [ ] Final signer ceremony confirms addresses and nonce expectations.

### B. Environment readiness
Run from repo root:

```bash
npm ci
npx truffle compile
npm run size
npm test
```

- [ ] Compile succeeds with pinned settings (notably `solc 0.8.23`, optimizer runs 50, `viaIR=false`).
- [ ] Bytecode size checks pass (EIP-170 guard).
- [ ] Test suite passes in your release environment.

### C. Configuration inputs prepared and reviewed
Use placeholders in docs and config files; keep real values in secured operator systems.

- [ ] `AGI token address` (`<AGI_TOKEN_ADDRESS>`).
- [ ] `baseIpfsUrl` (`<BASE_IPFS_URL>`).
- [ ] ENS settings for AGIJobManager constructor:
  - [ ] `<ENS_REGISTRY_ADDRESS>`
  - [ ] `<NAMEWRAPPER_ADDRESS>`
- [ ] ENSJobPages settings (if used):
  - [ ] `<PUBLIC_RESOLVER_ADDRESS>`
  - [ ] `<JOBS_ROOT_NODE_BYTES32>`
  - [ ] `<JOBS_ROOT_NAME>` (example placeholder: `jobs.example.eth`)
- [ ] Root nodes + Merkle roots for AGIJobManager constructor:
  - [ ] `<CLUB_ROOT_NODE_BYTES32>`
  - [ ] `<AGENT_ROOT_NODE_BYTES32>`
  - [ ] `<ALPHA_CLUB_ROOT_NODE_BYTES32>`
  - [ ] `<ALPHA_AGENT_ROOT_NODE_BYTES32>`
  - [ ] `<VALIDATOR_MERKLE_ROOT_BYTES32>`
  - [ ] `<AGENT_MERKLE_ROOT_BYTES32>`
- [ ] Initial operational parameters reviewed and approved:
  - [ ] validator approvals/disapprovals thresholds and quorum
  - [ ] completion/dispute/challenge review windows
  - [ ] validator reward %, slash bps, and bond params
  - [ ] agent bond params and job caps
- [ ] Initial moderator set approved.
- [ ] Initial additionalAgents/additionalValidators set approved (if used).
- [ ] Initial `AGIType` entries approved (each ERC721 address and payout percent checked).
  - **Warning**: a wrong `AGIType` payout setup can create incorrect payout behavior for affected jobs.

### D. Rehearsal requirement (mandatory)
- [ ] Run full rehearsal on Sepolia or a mainnet fork with the exact tx sequence in this runbook.
- [ ] Rehearsal success criteria:
  - [ ] same constructor args and post-deploy config pattern
  - [ ] source verification succeeds
  - [ ] smoke test completes end-to-end with expected events/state transitions
  - [ ] pause/abort path tested

### E. Final Go/No-Go signoff
- [ ] Engineering signoff.
- [ ] Security signoff.
- [ ] Operations/on-call signoff.
- [ ] Business owner signoff.
- [ ] Incident bridge and comms channel active before first mainnet tx.

---

## 3) Mainnet deploy sequence

## 3.1 Deploy `AGIJobManager` via migrations
Use the repo-native path:

```bash
npx truffle migrate --network mainnet
```

This executes `migrations/2_deploy_contracts.js`, deploys/link libraries, resolves constructor config from `migrations/deploy-config.js` + env overrides, and deploys `AGIJobManager`.

- [ ] Capture deployment tx hash.
- [ ] Capture deployed contract address.
- [ ] Capture exact constructor args and env/config source.
- [ ] Capture git commit hash used for deployment.

### 3.2 Deploy `ENSJobPages` (if ENS integration is enabled)
`ENSJobPages` is **not** deployed by default migration file; deploy it in a controlled, scripted manner (Truffle console/exec/script) using:

- `ensAddress = <ENS_REGISTRY_ADDRESS>`
- `nameWrapperAddress = <NAMEWRAPPER_ADDRESS>`
- `publicResolverAddress = <PUBLIC_RESOLVER_ADDRESS>`
- `rootNode = <JOBS_ROOT_NODE_BYTES32>`
- `rootName = <JOBS_ROOT_NAME>`

- [ ] Capture deployment tx hash/address/constructor args in the same deployment log.

### 3.3 Immediate safety posture
Immediately place protocol in safe startup state before public usage:

1. [ ] `pause()` on `AGIJobManager`.
2. [ ] Optionally set `setSettlementPaused(true)` only for severe incident containment.

Operational meaning:
- `pause()` blocks new risk actions (for example job creation/apply/validator voting paths gated by `whenNotPaused`), while allowing needed settlement/exit paths that are intentionally not pause-gated.
- `settlementPaused` is an additional hard stop on settlement paths guarded by `whenSettlementNotPaused` (use sparingly; it can block operations like treasury withdrawal and other guarded flows).

---

## 4) Post-deploy configuration (ordered owner transactions)

> Perform owner/admin calls through multisig execution where practical.

## 4.1 Why this order matters
- ENS wiring must be correct **before** enabling ENS hooks and token URI behavior.
- All identity-wiring fields that may be locked must be finalized before `lockIdentityConfiguration()`.
- Keep paused state through configuration + smoke test to minimize public risk.

## 4.2 Ordered transaction list

1. [ ] **ENSJobPages wiring** (if used)
   1. [ ] Confirm ENSJobPages constructor state:
      - `ens`, `nameWrapper`, `publicResolver`, `jobsRootNode`, `jobsRootName`.
   2. [ ] `ENSJobPages.setJobManager(<AGIJOBMANAGER_ADDRESS>)`.
   3. [ ] Confirm ENS root ownership/approval model is valid for subname writes.

2. [ ] **AGIJobManager ↔ ENSJobPages linkage**
   1. [ ] `AGIJobManager.setEnsJobPages(<ENSJOBPAGES_ADDRESS>)` (or zero address if not using ENS hooks).
   2. [ ] `AGIJobManager.setUseEnsJobTokenURI(true|false)` per launch decision.

3. [ ] **Identity + eligibility controls**
   1. [ ] If needed post-deploy, call `updateMerkleRoots(<validatorRoot>, <agentRoot>)`.
   2. [ ] Add moderators with `addModerator(...)`.
   3. [ ] Add additional allowlisted validators/agents (`addAdditionalValidator`, `addAdditionalAgent`) if operating with explicit allowlists.

4. [ ] **Operational params and policy knobs**
   1. [ ] Set validator thresholds/quorum/reward and related review periods.
   2. [ ] Set bond and risk limits only after internal review and recorded approvals.

5. [ ] **Add AGIType entries gradually**
   For each entry, execute and verify before the next:
   - [ ] Confirm target NFT contract is the intended ERC721 (`supportsInterface`).
   - [ ] Confirm payout percent is approved and bounded.
   - [ ] Call `addAGIType(<ERC721_ADDRESS>, <PAYOUT_PERCENT>)`.
   - [ ] Read back through `agiTypes(index)` and record results.

> If using config automation, run `truffle exec scripts/postdeploy-config.js --network mainnet --address <AGIJOBMANAGER_ADDRESS> --config-path <CONFIG_JSON_PATH>` and retain output log artifacts.

### 4.3 Sanity checks (must pass before smoke test)
- [ ] `owner()` equals expected multisig.
- [ ] `paused() == true`.
- [ ] `settlementPaused` is at intended value for test plan.
- [ ] `ensJobPages` address is correct (or zero if intentionally disabled).
- [ ] `validatorMerkleRoot` / `agentMerkleRoot` as expected.
- [ ] validator threshold/quorum values as expected.
- [ ] `validationRewardPercentage` and bond params as expected.
- [ ] ENSJobPages `jobManager`, `jobsRootNode`, `jobsRootName`, `publicResolver` as expected.

---

## 5) Verification (Etherscan)

## 5.1 Preferred workflow in this repo
This repository is configured with `truffle-plugin-verify`.

```bash
npx truffle run verify AGIJobManager --network mainnet
npx truffle run verify ENSJobPages --network mainnet
```

Use the exact deployed constructor arguments and compiler settings from this repo (`solc 0.8.23`, optimizer enabled runs 50, `viaIR=false`, metadata bytecodeHash none, EVM london unless intentionally overridden).

## 5.2 If plugin verification fails
Do manual verification on Etherscan with:
- exact source matching deployed commit
- exact optimizer/version/settings
- exact constructor args encoding/order

### 5.3 Verification records (required)
- [ ] Save Etherscan links for both contracts.
- [ ] Save deploy commit hash.
- [ ] Save migration output + constructor argument manifest.
- [ ] Attach verification evidence in the deployment log ticket.

---

## 6) Mainnet smoke test (minimal-risk)

> Keep the system paused for public users. Use dedicated internal test accounts and the smallest practical payout.

Test actors:
- employer test account
- agent test account (eligible)
- validator test accounts (eligible)
- moderator/owner account available for emergency intervention

### 6.1 Flow
1. [ ] Employer creates tiny job (`createJob`) with minimal payout/duration.
   - Expect `JobCreated`.
   - Confirm escrow accounting increased (`lockedEscrow`).

2. [ ] Agent applies (`applyForJob`) with valid eligibility path.
   - Expect `JobApplied`.
   - Confirm agent bond movement (`lockedAgentBonds`) and assignment state.

3. [ ] Agent requests completion (`requestJobCompletion`).
   - Expect `JobCompletionRequested`.

4. [ ] Validators submit approvals/disapprovals as planned.
   - Expect `JobValidated` and/or `JobDisapproved` events.

5. [ ] Finalize settlement path to completion.
   - Expect `JobCompleted` (and related finalization events as applicable).
   - Confirm locked balances decrease appropriately.
   - Confirm `withdrawableAGI()` behavior remains solvent and sensible.
   - Confirm `NFTIssued` emitted on successful completion path.

6. [ ] ENS hook observability
   - Monitor `EnsHookAttempted` events for hook IDs relevant to create/assign/completion/revoke/lock.
   - If hook call fails (`success=false`), treat as integration incident; keep paused until triaged.

### 6.2 Abort conditions (hard stop)
If any of the following occurs:
- unexpected revert in core path,
- incorrect accounting deltas,
- wrong event/state transition,
- ENS integration mismatch,

then:
1. [ ] Keep `pause()` active.
2. [ ] Do **not** call `lockIdentityConfiguration()`.
3. [ ] Open incident, preserve logs/tx hashes, and execute remediation plan.

### 6.3 Smoke-test cleanup before lock
- [ ] Ensure no unresolved obligations from smoke test remain.
- [ ] Ensure no stuck escrow/bond state from test data.
- [ ] Ensure runbook signoff confirms lock preconditions.

---

## 7) `lockIdentityConfiguration()` (irreversible gate)

`lockIdentityConfiguration()` sets `lockIdentityConfig=true` and permanently disables identity-configurable setters guarded by `whenIdentityConfigurable`.

### 7.1 What is effectively frozen by lock
After lock, the following AGIJobManager identity wiring updates are blocked:
- `updateAGITokenAddress(...)`
- `updateEnsRegistry(...)`
- `updateNameWrapper(...)`
- `setEnsJobPages(...)`
- `updateRootNodes(...)`

(Operational toggles such as `setUseEnsJobTokenURI(...)` and `updateMerkleRoots(...)` remain callable, but changing them after lock should still follow strict governance.)

### 7.2 Final pre-lock checklist
- [ ] AGIJobManager and ENSJobPages verification complete.
- [ ] ENS wiring confirmed end-to-end.
- [ ] Root nodes and Merkle roots confirmed.
- [ ] Smoke test passed and obligations settled.
- [ ] Internal approvals recorded (engineering/security/operations/business owner).

### 7.3 Lock transaction
- [ ] Execute `AGIJobManager.lockIdentityConfiguration()`.
- [ ] Confirm `lockIdentityConfig == true`.
- [ ] Confirm `IdentityConfigurationLocked` event emitted.

**WARNING:** If identity wiring is wrong when locked, redeployment is likely required.

---

## 8) Unpause / go-live enablement

### 8.1 Controlled enablement
1. [ ] Confirm final desired `settlementPaused` value (normally `false`).
2. [ ] Confirm pause state and final config snapshots are archived.
3. [ ] Execute `unpause()`.
4. [ ] Optionally use staged rollout (limited initial cohort of employers/agents/validators).

### 8.2 First 24–72h monitoring
Track at minimum:
- job lifecycle events (`JobCreated`, `JobApplied`, `JobCompletionRequested`, `JobValidated`, `JobDisapproved`, `JobCompleted`)
- ENS hook success rate via `EnsHookAttempted`
- dispute rate and moderator interventions
- locked balance and solvency drift (`lockedEscrow`, bonds, `withdrawableAGI()`)
- gas anomalies / failed transaction patterns

### 8.3 Communications and escalation checklist
- [ ] Publish deployment announcement with verified addresses.
- [ ] Share runbook version + commit hash internally.
- [ ] Confirm on-call roster and escalation tree.
- [ ] Confirm incident channel staffed for first 72h.

---

## 9) Incident playbooks (short form)

### A. Critical bug or exploit signal
1. [ ] `pause()` immediately.
2. [ ] Decide on `setSettlementPaused(true)` based on incident type and required exits.
3. [ ] Freeze non-essential admin changes.
4. [ ] Open incident bridge, preserve evidence, communicate status.
5. [ ] Prepare patch/redeploy plan and user comms.

### B. ENS integration degraded
1. [ ] Keep protocol paused until impact understood.
2. [ ] If pre-lock and needed: adjust ENS wiring (`setEnsJobPages`, ENSJobPages resolver/root config) and retest.
3. [ ] If post-lock: AGIJobManager identity wiring cannot be changed; use available runtime toggles (for example ENS token URI toggle) and operational mitigations.
4. [ ] Communicate degraded mode and ETA.

### C. Allowlist/Merkle/root misconfiguration
1. [ ] Pause.
2. [ ] Correct allowlists/roots/merkle values using owner transactions (where permitted).
3. [ ] Re-run targeted smoke checks.
4. [ ] Resume only after dual signoff.

### D. Ownership/key compromise protocol
1. [ ] Initiate emergency multisig governance process.
2. [ ] Rotate compromised signer(s); enforce higher threshold if necessary.
3. [ ] Verify owner and executor addresses on-chain after any transfer.
4. [ ] Document timeline and actions in incident record.

---

## 10) Deployment log template (non-secret)

Record and retain:
- Date/time (UTC)
- Network (`mainnet`)
- Git commit hash
- Deployer address (non-secret)
- Owner/multisig address
- AGIJobManager address + deploy tx hash
- ENSJobPages address + deploy tx hash (if used)
- Constructor args manifest (no secrets)
- Post-deploy tx list (function, nonce, tx hash, signer)
- Verification links
- Smoke test tx hashes and outcomes
- Lock tx hash
- Unpause tx hash
- Final signoffs

