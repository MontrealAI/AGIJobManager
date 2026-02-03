# AGIJobManager Web UI (static)

This directory hosts the canonical static UI for AGIJobManager.

## Open locally (served over HTTP)

From the repo root:

```bash
cd docs
python3 -m http.server 8000
```

Then open:

```
http://localhost:8000/ui/agijobmanager.html
```

You can also run the server from `docs/ui/` and open `http://localhost:8000/agijobmanager.html`.
The UI config file (`agijobmanager.config.json`) lives alongside the HTML and will still be available.

Alternatively, you can serve the UI directly:

```bash
npx http-server docs/ui
```

## Set the contract address

The UI does **not** assume a default deployment. Provide a contract address explicitly:

- Query param: `?contract=0x...`
- Config file: `docs/ui/agijobmanager.config.json` (`preferredContract`)
- Manual entry in the “Contract address” field
- Save button: persists to `localStorage` under the key `agijobmanager_contract`

To reset:

- Click **Clear** in the UI, or
- Remove `localStorage` key `agijobmanager_contract` in your browser’s dev tools.

If none of the above are set, the UI falls back to the legacy v0 address, which is clearly labeled as legacy.

## ABI export + drift guardrails

- Exported ABI location: `docs/ui/abi/AGIJobManager.json`
- UI-required interface list: `docs/ui/abi/ui_required_interface.json`

When the contract interface changes, regenerate the UI ABI from Truffle artifacts:

```bash
truffle compile
npm run ui:abi
```

The UI attempts to load `./abi/AGIJobManager.json` at runtime. If it cannot fetch the file
(for example when opened via `file://`), it falls back to the embedded ABI and logs the
fallback in the Activity Log. You should see “External ABI loaded” when served over HTTP
and “Fallback ABI used” when opened via `file://`.

If `truffle test` fails with an ABI mismatch, run `npm run ui:abi` and commit the updated ABI file.

### Job status API support

The UI prefers the on-chain `jobStatus(jobId)` helper when available to display the canonical
job lifecycle status. When connected to older deployments that do not expose it, the UI falls
back to its existing client-side derivation.

## Supported networks

- **Ethereum mainnet** is the intended production network.
- **Sepolia** or local dev chains are supported only if you supply a compatible contract address.
- On unsupported chains, the UI will show a warning (chainId mismatch) and interactions may revert.
  The UI does not generate chain-specific explorer links.

## Marketplace filters + approval status

- **My NFTs only** filters the NFTs table to tokens where `ownerOf(tokenId)` matches the connected wallet.
- **Active listings only** filters to listings where `listing.isActive` is true.
- Filters require the event indexer (see “Mainnet scalability”). When the indexer is unavailable, the
  UI disables the filters and loads the current page without filtering.

**Allowance / approvals**
- The NFT table and purchase panel compare your AGI allowance against the listing price.
  If allowance < price, the UI shows **Approve required**.
- Allowance is fetched **once per refresh** and reused across the table. It refreshes after
  `approve`, `purchase`, and whenever you reconnect or switch accounts.

## Wallet event handling

The UI listens for EIP-1193 wallet events and rebinds in-place without a page reload:

- **accountsChanged**: switches to the active account, rebuilds the provider/signer, refreshes snapshots/role flags, and re-subscribes contract events.
- **chainChanged**: rebuilds the provider/signer, updates chain metadata, checks contract deployment, and disables writes if unsupported.
- **disconnect**: clears signer state and disables all write actions.
- Event handlers are bound once at startup; the UI clears prior bindings before attaching to avoid duplicate listeners.

Default supported chainIds:

- Mainnet: `1`
- Sepolia: `11155111`
- Local dev (Ganache/Truffle): `1337`

If the contract address has no code on the active chain, the UI shows a warning and disables all write actions.

### Manual test checklist (MetaMask)

1. Serve the UI locally (see "Open locally" above) and connect your wallet.
2. Switch accounts → UI should update the account address and rebind without a reload.
3. Switch networks (mainnet ↔ sepolia ↔ local) → UI should update chain info and disable writes when unsupported.
4. Disconnect the site in MetaMask → UI should show “Disconnected” and disable write buttons.

## Safety notes

- The UI only talks to your wallet provider (e.g., MetaMask). No keys or secrets are collected.
- Always verify the contract address and chainId before signing transactions.
- The UI runs a **staticCall preflight** for every state-changing action (including cancel and admin). If a call would revert, it surfaces the reason before you sign.
- If the UI shows the contract is paused, wait for an unpause or switch to a different deployment before attempting marketplace or job actions.

## Employer lifecycle completeness: cancel job

The UI includes an employer-only **Cancel job** flow that mirrors the contract’s `cancelJob` semantics:

- **Allowed only before assignment** (assigned agent must be `0x0`).
- **Not allowed after completion**.
- **Only the employer** who created the job can cancel it.
- **Cancellation refunds the job payout** back to the employer.
- **Disputed jobs can still be cancelled** as long as they remain unassigned and incomplete.

The UI verifies job state using `getJobCore(jobId)` / `getJobValidation(jobId)` (and `jobStatus(jobId)` for deleted jobs)
before sending a transaction and then runs a static-call preflight before showing a confirmation dialog. If the job was
already cancelled/deleted, `jobStatus(jobId)` returns `Deleted` and the UI will refuse to proceed.

## Admin / Owner panel (UI)

The UI ships with a **collapsed** “Admin / Owner” panel. It is visible to all users but only **unlocks** when the
connected wallet matches `owner()`. Every admin action:

- Shows the target **contract address**.
- Runs a **staticCall preflight**.
- Requires a confirmation dialog.
- Logs the tx hash with an explorer link (mainnet/sepolia).

### Owner-only actions available in the UI
- Pause / Unpause.
- Add / remove moderators.
- Blacklist / unblacklist agents or validators.
- Update parameters:
  - `requiredValidatorApprovals`
  - `requiredValidatorDisapprovals`
  - `validationRewardPercentage`
  - `maxJobPayout` (token units)
  - `jobDurationLimit` (seconds)
  - `premiumReputationThreshold`

### Liveness timeout actions (not in UI yet)
- `expireJob` (anyone) and `finalizeJob` (anyone, deterministic fallback) are **not** exposed in the UI; use Truffle console or scripts.
- `resolveStaleDispute` (owner-only, paused) is **not** exposed in the UI; use a controlled admin workflow.

> Moderators only have on-chain powers for `resolveDisputeWithCode`. The UI does **not** expose moderator-only actions in the admin panel.

## Admin operations (CLI / Truffle)

For scripted operations or cold-wallet flows, use the Truffle console. **Never** commit secrets; keep them in `.env`.

### Environment setup

1) Copy the template and add your own RPC + keys (do not commit):
```bash
cp .env.example .env
```

2) Configure `.env` per [`truffle-config.js`](../../truffle-config.js) and [`docs/Deployment.md`](../Deployment.md).

### Open a console

```bash
truffle console --network sepolia
```

```bash
truffle console --network mainnet
```

```bash
truffle console --network development
```

### Example admin actions

```javascript
const jm = await AGIJobManager.deployed();
const accounts = await web3.eth.getAccounts();
const owner = accounts[0];

// Pause / unpause
await jm.pause({ from: owner });
await jm.unpause({ from: owner });

// Moderator management
await jm.addModerator("0xModeratorAddress", { from: owner });
await jm.removeModerator("0xModeratorAddress", { from: owner });

// Blacklist management
await jm.blacklistAgent("0xAgent", true, { from: owner });
await jm.blacklistAgent("0xAgent", false, { from: owner });
await jm.blacklistValidator("0xValidator", true, { from: owner });
await jm.blacklistValidator("0xValidator", false, { from: owner });

// Parameter setters (read before write)
await jm.requiredValidatorApprovals();
await jm.setRequiredValidatorApprovals(3, { from: owner });

await jm.requiredValidatorDisapprovals();
await jm.setRequiredValidatorDisapprovals(2, { from: owner });

await jm.validationRewardPercentage();
await jm.setValidationRewardPercentage(15, { from: owner });

await jm.maxJobPayout();
await jm.setMaxJobPayout(web3.utils.toWei("100"), { from: owner });

await jm.jobDurationLimit();
await jm.setJobDurationLimit(86400, { from: owner }); // 1 day

await jm.premiumReputationThreshold();
await jm.setPremiumReputationThreshold(5000, { from: owner });
```

### Safety reminders
- Always verify the **contract address** and **chainId** before signing.
- Use a **hardware wallet** for mainnet admin operations.
- For production updates, **read the current value first**, then apply a minimal change.

## Eligibility evaluator mirrors on-chain OR-logic

The **Eligibility Evaluator** in the Identity checks card answers “Would I pass on-chain authorization for this role right now?” and mirrors the contract’s OR-logic order:

1. **Blacklist check** (fail fast)
2. **Additional allowlist**
3. **Merkle proof verification**
4. **NameWrapper.ownerOf**
5. **ENS resolver addr**

Notes:
- **Label input:** use the same *label only* (subdomain) you would submit on-chain. The evaluator reads the Agent/Validator action inputs first (apply/validate/disapprove), then falls back to the generic Identity label field.
- **Merkle proof format:** paste a JSON `bytes32[]` array (e.g., `["0xabc...", "0xdef..."]`). Blank means an empty proof (`[]`).

## Known limitations

- Merkle proofs are user-supplied (`bytes32[]` via JSON array). The UI only verifies membership
  off-chain; on-chain checks are authoritative.
- ENS checks mirror the contract’s fallback logic: Merkle → NameWrapper.ownerOf → Resolver.addr.

## Common Reverts & Fixes

- **NotModerator** — Only a moderator can resolve disputes.
  - Fix: Ask the contract owner to add your address via `addModerator()`.
- **NotAuthorized** — Role/identity proof is missing or invalid.
  - Fix: Ensure your wallet controls the ENS subdomain label entered (NameWrapper/Resolver), or provide a valid Merkle proof, or be explicitly allowlisted via `additionalAgents` / `additionalValidators`.
- **Blacklisted** — Address is blocked for this role.
  - Fix: Ask moderators/owner to remove the blacklist entry.
- **InvalidParameters** — Payout/duration violate bounds.
  - Fix: Keep payout/duration > 0 and within `maxJobPayout` / `jobDurationLimit`.
- **InvalidState** — Action is not valid for the current job lifecycle state.
  - Fix: Ensure the job is assigned/not completed, completion is within duration, validations are before completion, disputes are only when not completed, etc.
- **JobNotFound** — Job ID does not exist or was delisted/cancelled.
  - Fix: Verify the job ID is still active.
- **TransferFailed** — ERC‑20 transfer returned false.
  - Fix: Check token balance/allowance, approve AGIJobManager, and ensure the token is not paused/blocked.

## Mainnet scalability: pagination + event indexing

The UI no longer enumerates every job or token ID. Instead it:

- Defaults to **latest 50** jobs/NFTs, with configurable page size and navigation.
- Uses a chunked event indexer (`eth_getLogs`) to build a local cache of job/NFT state.
- Hydrates **only the current page** with bounded `eth_call` reads (jobs, ownerOf/tokenURI/listings).

### How event indexing works

1. **Sync events** scans a block range (default: `latest-20000` → `latest`).
2. Logs are fetched in chunks to avoid RPC limits. On errors the chunk size is reduced and retried.
3. The UI builds a compact index in `localStorage` (per contract address) and only hydrates the
   current page with small bounded calls.

### Choosing a block range

- Start with the default lookback (e.g., `latest-20000`) and increase if you need older history.
- Large ranges can fail on some wallet RPCs; use smaller windows or a more capable RPC endpoint.

### Fallback mode (no indexer)

If event indexing fails (wallet provider limits, RPC errors, etc.), the UI falls back to
**range-based pagination** by calling `getJobCore(jobId)` / `getJobURIs(jobId)` or `ownerOf/tokenURI/listings` only for the
current page range (`latest` descending). Filters require the indexer and are disabled otherwise.

### Known indexing limitations

- `JobCreated` does not include the employer address, so job rows hydrate via `getJobCore(jobId)`.
- `JobCompletionRequested` now includes the completion metadata URI; the UI still hydrates job rows for the rest of the struct.
- RPC providers often limit `eth_getLogs` ranges; smaller windows avoid failures.
