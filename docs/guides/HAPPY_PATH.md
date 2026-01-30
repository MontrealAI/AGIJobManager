# Happy path walkthrough (non‑technical)

This walkthrough mirrors the **AGIJobManager Web UI** and uses the exact field names you will see on screen.

## 1) Connect wallet → choose network → set contract address

1. Open the UI: `docs/ui/agijobmanager.html` (GitHub Pages or local server).
2. Click **Connect Wallet**.
3. Check **Chain** and **Network pill**. If you are not on Ethereum Mainnet, use **Switch to Mainnet**.
4. In **Contract address (Mainnet)**, paste the deployment address and click **Save address**.
5. Click **Refresh snapshot** and confirm:
   - **AGI Token** address
   - **Token Symbol** / **Token Decimals**
   - **Owner** / **Paused**

**What you should see in the UI**
- A green or yellow network pill (not “Not connected”).
- **Contract snapshot** fields populated (not “—”).

## 2) Verify token balance and allowance

1. In **Your role flags**, click **Refresh role flags**.
2. Check **AGI Token balance** and **AGI allowance**.
3. If allowance is too low, use **Approve AGI token** under **Employer actions**.

**What you should see in the UI**
- **AGI Token balance** shows your token amount.
- **AGI allowance** shows approved amount for the contract.

## 3) Employer flow (create → validate → dispute if needed)

**Create job**
1. In **Employer actions**, fill:
   - **IPFS hash** (job description)
   - **Payout (token units)**
   - **Duration (seconds)**
   - **Details** (optional)
2. Click **Create job**.

**Wait for application and validation**
- An agent applies via **Apply for job**.
- Validators approve via **Validate job**. When approvals reach the threshold, the job completes and the NFT is minted.

**Dispute (if needed)**
- Use **Dispute job (employer)** with the **Job ID**.
- Wait for a moderator to resolve using **Resolve dispute**.

**What you should see in the UI**
- The job appears in **Jobs table** with status `Assigned` after an agent applies.
- After enough approvals, status becomes `Completed` and the **NFTs table** updates.

## 4) Agent flow (eligibility → apply → deliver → request completion)

**Check eligibility**
1. In **Identity checks (preflight only)**:
   - **Identity type**: `Agent (agentRootNode)`
   - **Label only (e.g., “helper”)**
   - **Merkle proof (JSON bytes32 array)** if required
2. Click **Run identity check** or **Evaluate Agent Eligibility**.

**Apply**
1. In **Agent actions**, fill:
   - **Job ID**
   - **Agent label (subdomain only)**
   - **Merkle proof** (comma‑separated hex values)
2. Click **Apply**.

**Request completion**
1. Upload your completion output to IPFS.
2. In **Request completion**, fill:
   - **Job ID**
   - **Completion IPFS hash**
3. Click **Request completion**.

**What you should see in the UI**
- **Agent eligibility** shows a green “Eligible” pill after preflight.
- The job status changes to `Completion requested` after you submit the completion hash.

## 5) Validator flow (eligibility → validate or disapprove)

**Check eligibility**
1. In **Identity checks (preflight only)**:
   - **Identity type**: `Validator / Club (clubRootNode)`
   - **Label only (e.g., “validator”)**
   - **Merkle proof (JSON bytes32 array)** if required
2. Click **Run identity check** or **Evaluate Validator Eligibility**.

**Validate or disapprove**
1. In **Validator actions**, fill:
   - **Job ID**
   - **Validator label (subdomain only)**
   - **Merkle proof**
2. Click **Validate** *or* **Disapprove** (not both for the same job).

**What you should see in the UI**
- The job’s **Approvals/Disapprovals** count increases in the **Jobs table**.

## 6) Moderator flow (resolve disputes)

1. In **Moderator actions**, fill:
   - **Job ID**
   - **Resolution string**
2. Use **Use “agent win”** or **Use “employer win”** for settlement.
3. Click **Resolve dispute**.

**Important**: Any other string only clears the dispute flag and does **not** settle funds.

## 7) Marketplace flow (list → delist → purchase)

**List an NFT**
1. In **List NFT**, enter **Token ID** and **Price (token units)**.
2. Click **List NFT**.

**Delist an NFT**
1. In **Delist NFT**, enter **Token ID**.
2. Click **Delist NFT**.

**Purchase an NFT**
1. In **Purchase NFT**, enter **Token ID**.
2. If **Approval status** shows “Approve required,” click **Approve token (listing price)**.
3. Click **Purchase NFT**.

---

# CLI alternative (Truffle console)

> These snippets are optional. They are useful if you prefer a console instead of the UI.

Open a console:
```bash
truffle console --network mainnet
```

Load the contract:
```javascript
const AGIJobManager = artifacts.require("AGIJobManager");
const IERC20 = artifacts.require("IERC20");
const jm = await AGIJobManager.deployed();
```

## Employer
```javascript
const token = await IERC20.at(await jm.agiToken());
const payout = web3.utils.toWei("100");
const duration = 86400; // 1 day
await token.approve(jm.address, payout);
await jm.createJob("Qm...", payout, duration, "Short description");
```

## Agent
```javascript
const jobId = 1;
const label = "helper"; // label only
const proof = []; // bytes32[] if required
await jm.applyForJob(jobId, label, proof);
await jm.requestJobCompletion(jobId, "QmCompletion...");
```

## Validator
```javascript
const jobId = 1;
const label = "validator"; // label only
const proof = []; // bytes32[] if required
await jm.validateJob(jobId, label, proof); // or jm.disapproveJob(jobId, label, proof)
```

## Moderator
```javascript
const jobId = 1;
await jm.resolveDispute(jobId, "agent win");
```

## Marketplace
```javascript
const tokenId = 1;
const price = web3.utils.toWei("10");
await jm.listNFT(tokenId, price);
await jm.delistNFT(tokenId);
await token.approve(jm.address, price);
await jm.purchaseNFT(tokenId);
```
