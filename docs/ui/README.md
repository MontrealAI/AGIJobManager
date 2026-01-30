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

You can also run the server from `docs/ui/` and open `http://localhost:8000/agijobmanager.html`,
but the deployments hints will be unavailable because `docs/deployments/` is outside that server root.

Alternatively, you can serve the UI directly:

```bash
npx http-server docs/ui
```

## Set the contract address

The UI does **not** assume a default deployment. Provide a contract address explicitly:

- Query param: `?contract=0x...`
- Manual entry in the “Contract address” field
- Save button: persists to `localStorage` under the key `agijobmanager_contract`

To reset:

- Click **Clear** in the UI, or
- Remove `localStorage` key `agijobmanager_contract` in your browser’s dev tools.

The legacy v0 address is displayed as a reference and only used if you explicitly opt in.

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

## Supported networks

- **Ethereum mainnet** is the intended production network.
- **Sepolia** or local dev chains are supported only if you supply a compatible contract address.
- On unsupported chains, the UI will show a warning (chainId mismatch) and interactions may revert.
  The UI does not generate chain-specific explorer links.

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
**range-based pagination** by calling `jobs(jobId)` or `ownerOf/tokenURI/listings` only for the
current page range (`latest` descending). Filters require the indexer and are disabled otherwise.

### Known indexing limitations

- `JobCreated` does not include the employer address, so job rows hydrate via `jobs(jobId)`.
- `JobCompletionRequested` does not include the new IPFS hash; the UI hydrates to show it.
- RPC providers often limit `eth_getLogs` ranges; smaller windows avoid failures.
