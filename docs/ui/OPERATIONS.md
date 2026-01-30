# AGIJobManager UI Operations (Employer + Admin)

This page complements the static UI at `docs/ui/agijobmanager.html` with the employer
cancel-job flow and owner/admin operations.

## Employer lifecycle completeness: Cancel job

**When you can cancel**
- Employer-only.
- The job must be **unassigned** and **not completed**.
- If the job is in a dispute state, resolve the dispute before canceling.

**How to cancel in the UI**
1. Connect your wallet and set the correct contract address.
2. Open **Employer actions → Cancel job**.
3. Enter the Job ID and click **Cancel job**.
4. The UI will:
   - Fetch the job struct and verify eligibility (employer, assignment, completion, dispute state).
   - Run `cancelJob(jobId)` as a `staticCall` preflight.
   - Present a confirmation dialog with the contract address and Job ID.
   - Send the transaction, wait for confirmation, then refresh the dashboard and jobs table.

**On-chain consequences**
- The escrowed payout is returned to the employer.
- The job struct is deleted, and the `JobCancelled` event is emitted.

## Admin / Owner operations (UI)

The UI includes a collapsed **Admin / Owner** panel. It is **owner-only** for this contract:

**Owner-only controls**
- Pause / Unpause.
- Add / remove moderators.
- Blacklist agent/validator addresses.
- Parameter setters:
  - `requiredValidatorApprovals`
  - `requiredValidatorDisapprovals`
  - `validationRewardPercentage`
  - `maxJobPayout`
  - `jobDurationLimit`
  - `premiumReputationThreshold`

**Safety checks in the UI**
- The panel is disabled unless the connected wallet matches `owner()`.
- Every action uses a `staticCall` preflight and a confirmation dialog.
- Transactions log their hash and explorer link (when available).

## Admin operations via Truffle (CLI)

Even if you use the UI, the CLI is the most explicit way to manage production settings.

### Environment setup (no secrets committed)
Set RPC URLs and private keys in your shell or a local `.env` (ignored by git):

```bash
export SEPOLIA_RPC_URL="https://..."
export MAINNET_RPC_URL="https://..."
export PRIVATE_KEYS="0xabc...,0xdef..." # never commit
```

### Open Truffle console
```bash
npx truffle console --network development
```

Other common networks:
```bash
npx truffle console --network sepolia
npx truffle console --network mainnet
```

### Load the deployed contract
```javascript
const jm = await AGIJobManager.deployed();
await jm.owner();
await jm.paused();
```

### Pause / Unpause
```javascript
await jm.pause();
await jm.unpause();
```

### Moderator management (owner-only)
```javascript
await jm.addModerator("0xModerator");
await jm.removeModerator("0xModerator");
```

### Blacklist management (owner-only)
```javascript
await jm.blacklistAgent("0xTarget", true);
await jm.blacklistAgent("0xTarget", false);
await jm.blacklistValidator("0xTarget", true);
await jm.blacklistValidator("0xTarget", false);
```

### Parameter setters (owner-only)
Read current values before updating:
```javascript
await jm.requiredValidatorApprovals();
await jm.requiredValidatorDisapprovals();
await jm.validationRewardPercentage();
await jm.maxJobPayout();
await jm.jobDurationLimit();
await jm.premiumReputationThreshold();
```

Set new values:
```javascript
await jm.setRequiredValidatorApprovals(3);
await jm.setRequiredValidatorDisapprovals(2);
await jm.setValidationRewardPercentage(10);
await jm.setMaxJobPayout(web3.utils.toWei("1000"));
await jm.setJobDurationLimit(604800); // seconds
await jm.setPremiumReputationThreshold(5000);
```

## Security & safety notes

- **Mainnet is irreversible.** Always verify contract address and chain ID.
- Prefer a hardware wallet for owner actions.
- The UI performs `staticCall` preflight checks, but on-chain state can still change between
  preflight and execution.
