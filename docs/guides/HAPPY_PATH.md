# Happy Path Walkthrough (non‑technical)

This guide assumes you use the **web UI** (`docs/ui/agijobmanager.html`). It walks each role through the main flow with the exact UI field labels, plus a minimal Truffle console alternative.

> Tip: The UI runs a **staticCall preflight**. If it says the transaction will revert, fix the issue **before** signing.

---

## 0) Connect your wallet and confirm basics

1) **Connect wallet** in the UI.
2) Confirm the **network** in your wallet.
   - Mainnet is intended for production.
   - Sepolia or local dev only work if the contract is deployed there.
3) Set the **Contract address (Mainnet)** field.
   - You can also use `?contract=0x...` in the URL.
4) Verify the **token address** and **balance** (shown in the UI).
5) Check your **allowance**; if it’s too low, you must approve first.

**What you should see in the UI**
- “Connected (chain …)” pill changes to your network.
- “Contract address (Mainnet)” shows your chosen contract.
- Token balance and allowance reflect your wallet.

---

## Employer happy path

### Step 1: Approve token allowance
- Field: **Amount (token units)** under the approve section.
- Action: Click **Approve** to allow the contract to pull the job payout.

**What you should see**
- Allowance updates to at least the job payout.

### Step 2: Create a job
Use the **Create job** panel:
- **IPFS hash**
- **Payout (token units)**
- **Duration (seconds)**
- **Details**

Click **Create Job**.

**What you should see**
- A new job appears with a new **Job ID**.

### Step 3: Wait for an agent to apply
- Monitor the job list for **Assigned agent**.

### Step 4: Optional dispute
If something goes wrong **before completion**, open **Employer dispute**:
- **Job ID**
- Click **Dispute job**.

### Step 5: Completion outcomes
- If validators approve, the job completes and your job NFT is minted to you.
- If disapproved past the threshold, the job is disputed and requires moderator resolution.

---

## Agent happy path

### Step 1: Confirm eligibility
In the **Identity checks** card:
- **Identity type** → Agent
- **Label only (e.g., “helper”)**
- **Merkle proof (JSON bytes32 array)** if needed

**What you should see**
- “Eligible: Yes” with a method (Allowlist / Merkle / NameWrapper / Resolver).

### Step 2: Apply for a job
Use the **Apply for job** panel:
- **Job ID**
- **Agent label (subdomain only)**
- **Merkle proof** (JSON bytes32 array) if needed

Click **Apply for job**.

### Step 3: Request completion
Use **Request completion**:
- **Job ID**
- **Completion IPFS hash**

Click **Request completion**.

**What you should see**
- “Completion requested” status for the job.

---

## Validator happy path

### Step 1: Confirm eligibility
In the **Identity checks** card:
- **Identity type** → Validator
- **Label only (e.g., “helper”)**
- **Merkle proof (JSON bytes32 array)** if needed

### Step 2: Validate or disapprove
Use the **Validate job** or **Disapprove job** panels:
- **Job ID**
- **Validator label (subdomain only)**
- **Merkle proof**

> You can **only do one** of these for a given job.

**What you should see**
- Validator approvals/disapprovals increment in the job view.

---

## Moderator happy path

### Step 1: Resolve a dispute
Use **Resolve dispute**:
- **Job ID**
- **Resolution string**

Use one of the canonical strings:
- `agent win`
- `employer win`
- `other` (any non‑canonical string)

**What you should see**
- If `agent win`, the job completes and pays the agent/validators.
- If `employer win`, the employer is refunded and the job closes.
- If `other`, the job is removed from dispute and returns to its prior in‑progress state.

---

## Marketplace happy path

### List your job NFT
Use **List NFT**:
- **Token ID**
- **Price (token units)**

Click **List NFT**.

### Delist your NFT
Use **Delist NFT**:
- **Token ID**

Click **Delist NFT**.

### Purchase an NFT
Use **Purchase NFT**:
- **Token ID**

If **Approve required** appears, run **Approve** for the listing price first.

---

# Minimal CLI alternative (Truffle console)

> These examples assume you have the correct `--network` selected and your account has funds + gas.

Open a console:
```bash
truffle console --network sepolia
```

### Shared setup (all roles)
```javascript
const jm = await AGIJobManager.deployed();
const accounts = await web3.eth.getAccounts();
const employer = accounts[0];
const agent = accounts[1];
const validator = accounts[2];
const moderator = accounts[3];
const tokenAddress = await jm.agiToken();
const token = new web3.eth.Contract([
  {"constant":true,"inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"type":"function"},
  {"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"type":"function"}
], tokenAddress);
```

### Employer: approve + create job
```javascript
const payout = web3.utils.toWei("100");
await token.methods.approve(jm.address, payout).send({ from: employer });
await jm.createJob("QmIPFSHash", payout, 86400, "Short description", { from: employer });
```

### Agent: apply + request completion
```javascript
await jm.applyForJob(0, "alice", [], { from: agent });
await jm.requestJobCompletion(0, "QmCompletionHash", { from: agent });
```

### Validator: validate or disapprove
```javascript
await jm.validateJob(0, "validatorlabel", [], { from: validator });
// OR
await jm.disapproveJob(0, "validatorlabel", [], { from: validator });
```

### Moderator: resolve dispute
```javascript
await jm.resolveDispute(0, "agent win", { from: moderator });
```

### Marketplace: list / purchase / delist
```javascript
await jm.listNFT(0, web3.utils.toWei("10"), { from: employer });
await token.methods.approve(jm.address, web3.utils.toWei("10")).send({ from: agent });
await jm.purchaseNFT(0, { from: agent });
await jm.delistNFT(0, { from: agent });
```
