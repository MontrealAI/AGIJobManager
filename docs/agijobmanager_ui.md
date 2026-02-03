# AGIJobManager Web UI (static)

This static page provides a **non-custodial** interface to the AGIJobManager contract. It runs entirely in your browser, uses your wallet for signing, and does **not** require any backend or API keys. It is intended for careful, expert use and is **experimental research software**.

## What this page is
- A single-file dApp (`docs/ui/agijobmanager.html`) that lets you interact with the on-chain AGIJobManager contract.
- Suitable for GitHub Pages or any static host.

## What this page is not
- **Not** a backend service.
- **Not** a wallet.
- **Not** a deployment tracker; you must supply the contract address yourself.

## Setting the contract address
You can set the contract address in four ways (the UI uses the first one it finds):

1) **Query parameter**
```
?contract=0xYourContractAddress
```

2) **LocalStorage** (the UI stores the last saved address automatically)

3) **Config file** (`docs/ui/agijobmanager.config.json`)
   - `preferredContract` is intentionally blank until the new deployment is finalized.

4) **Manual input**
Use the “Contract address” input and click **Save address**.

If none of the above are set, the UI will fall back to the **legacy v0** address (explicitly labeled “Legacy fallback”).

> The new AGIJobManager mainnet address is not yet known. This UI is designed to work with **any** valid deployment.
> A helper button is available to prefill the **legacy v0** mainnet address, which is clearly labeled as legacy.

## Role flows

### Employer
1) **Approve** the AGI token for the contract (`approve`).
2) **Create job** (`createJob`) with payout + duration + a **job spec metadata URI** (ERC‑721 JSON).
   - Use the form-driven metadata generator to build `jobSpec.v1.json`.
   - Upload it manually (or via optional Pinata/NFT.Storage) and paste the resulting URI.
3) **Cancel job** (`cancelJob`) if it is unassigned and not completed.
   - Employer-only; only before assignment; no cancel after completion.
   - Cancelling refunds the payout to the employer.
   - Disputed jobs are still cancellable if they remain unassigned and incomplete.
4) Watch job status and events in the Jobs table and Activity log.

### Agent
1) Run **Identity Checks** (Merkle → NameWrapper → Resolver) using your **label only** (e.g., `helper`).
2) **Apply for job** (`applyForJob`).
3) **Request completion** (`requestJobCompletion`) with the **completion metadata URI** (ERC‑721 JSON).
   - Generate `jobCompletion.v1.json`, upload, and paste the resulting URI.
4) Optionally **Dispute job** (`disputeJob`).

### Validator
1) Run **Identity Checks** (Merkle → NameWrapper → Resolver).
2) **Validate job** (`validateJob`) or **Disapprove job** (`disapproveJob`).

### Moderator
1) **Resolve dispute** (`resolveDisputeWithCode`) with the typed action code:
   - `0 (NO_ACTION)` → log only; dispute remains active.
   - `1 (AGENT_WIN)` → settle in favor of the agent.
   - `2 (EMPLOYER_WIN)` → settle in favor of the employer.
2) Add an optional freeform reason (logs/UI only).

### Dispute resolution strings (legacy API)
The deprecated `resolveDispute(jobId, resolution)` method only recognizes two canonical strings:

- `"agent win"`
- `"employer win"`

Any other string maps to `NO_ACTION`, and the dispute **remains active** on-chain. Prefer `resolveDisputeWithCode`.

### NFT marketplace user
1) Buyer **approves** AGI token for the contract (to cover the purchase).
2) Owner **lists** (`listNFT`) or **delists** (`delistNFT`) the NFT.
3) Buyer **purchases** (`purchaseNFT`) the NFT.

## Admin / Owner panel

The UI includes a collapsed **Admin / Owner** panel. It unlocks only when the connected wallet matches `owner()`.
Every admin action runs a **staticCall preflight**, requires a confirmation dialog, and logs the tx hash with an explorer link.

Owner-only actions exposed in the UI:
- Pause / unpause.
- Add / remove moderators.
- Blacklist / unblacklist agents or validators.
- Update key parameters: validator approvals/disapprovals, validation reward %, max job payout, duration limit, and premium threshold.

## Admin operations (CLI / Truffle)

You can also administer the contract via Truffle console. Never commit secrets; use `.env`.

```bash
truffle console --network sepolia
```

```javascript
const jm = await AGIJobManager.deployed();
const accounts = await web3.eth.getAccounts();
const owner = accounts[0];

await jm.pause({ from: owner });
await jm.unpause({ from: owner });
await jm.addModerator("0xModerator", { from: owner });
await jm.removeModerator("0xModerator", { from: owner });
await jm.blacklistAgent("0xAgent", true, { from: owner });
await jm.blacklistValidator("0xValidator", false, { from: owner });

await jm.requiredValidatorApprovals();
await jm.setRequiredValidatorApprovals(3, { from: owner });
```

### Security notes
- Verify **contract address** and **chainId** before signing.
- Prefer a hardware wallet for mainnet admin actions.
- Use `call`/`staticCall` where possible to preflight reverts (the UI does this automatically).

## Troubleshooting

### Wrong network
- The UI is for **Ethereum Mainnet**. Use the “Switch to Mainnet” button.
- The network pill updates based on your wallet’s current chain; you still need to connect before sending transactions.

### “Would revert” messages
- Every state-changing action runs a **static call preflight**. If it would revert, the UI shows the revert reason.

### Missing ENS ownership
- Use **label only** (not full domain), e.g. `helper`.
- Ensure the contract’s root nodes match your namespace.

### Merkle proof formatting
- Proof items must be **comma-separated** 32-byte hashes, e.g.:
```
0xabc...,0xdef...
```

## Security notes
- Verify the **contract address**, **token address**, and **chainId** before sending transactions.
- The UI uses `staticCall` preflight checks, but these are **not guarantees**; state can change between preflight and execution.
- Be cautious of phishing URLs; always check the hostname.
- This UI has **no backend** and uses only your wallet for signing.
- Never paste private keys or seed phrases; your wallet handles signing.

## GitHub Pages (docs folder)
1) In GitHub, open **Settings → Pages**.
2) Set **Source** to **Deploy from a branch**.
3) Select your default branch and **/docs** folder.
4) The page will be served at:
```
https://<org>.github.io/<repo>/ui/agijobmanager.html
```

## Local usage
```bash
python -m http.server docs
```
Then open:
```
http://localhost:8000/ui/agijobmanager.html?contract=0xYourContract
```

## ENS / Merkle gating summary
AGIJobManager enforces role eligibility with a layered OR-logic check:

1. **Merkle proof membership** (if provided and valid).
2. **NameWrapper.ownerOf(subnode)** for the label under the contract’s root node.
3. **ENS resolver.addr(subnode)** for the label under the contract’s root node.

The UI expects **label only** (e.g., `helper`), and reads the root nodes directly from the contract (`agentRootNode`, `agentRootNodeAlpha`, `clubRootNode`, `clubRootNodeAlpha`).
