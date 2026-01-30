# AGIJobManager UI smoke checklist (local dev)

This checklist validates the static UI against a local Ganache chain without MetaMask.
It focuses on the core flows that should never silently break.

## Prereqs

```bash
npm install
```

## 1) Start a local chain (Ganache)

```bash
npx ganache --server.host 127.0.0.1 --server.port 8545 \
  --chain.chainId 1337 --chain.networkId 1337 \
  --wallet.mnemonic "test test test test test test test test test test test junk"
```

## 2) Deploy contracts locally (Truffle)

```bash
npx truffle migrate --network development --reset
```

> Note: The local migration deploys `MockERC20` and mints tokens to the first two accounts so the UI can approve and create a job.

## 3) Serve the UI locally

From the repo root:

```bash
python3 -m http.server 8000 --directory docs
```

Open:

```
http://localhost:8000/ui/agijobmanager.html?contract=<DEPLOYED_ADDRESS>
```

You can get `<DEPLOYED_ADDRESS>` from `build/contracts/AGIJobManager.json` under the `networks.1337.address` key.

## 4) Smoke steps

### Connect + refresh
1. Click **Connect Wallet**.
2. Confirm the pill shows **Connected** and the wallet address is populated.
3. Click **Refresh snapshot** and confirm `Owner` and `AGI Token` populate.
4. Confirm the Activity Log shows **External ABI loaded**.

### Approve payout + create job
1. In **Approve AGI token**, enter `1` (token units) and click **Approve token**.
2. In **Create job**, fill:
   - IPFS hash: `QmTestHash`
   - Payout: `1`
   - Duration: `3600`
   - Details: `UI smoke test`
3. Click **Create job** and confirm success in the Activity Log.
4. Click **Load jobs** and verify at least one row appears.

## Common failures
- **Wrong contract address** → Snapshot and jobs fail to load; update the query param.
- **Wrong chainId** → UI warns about unsupported network; switch to Ganache (1337).
- **No token balance** → Approve/Create fails; ensure the local migration minted tokens.
- **ABI mismatch** → External ABI fetch fails or preflight errors; run `npm run ui:abi` after compiling.
- **Indexer warnings** → Filters are disabled if event indexing is unavailable; still load jobs via the fallback path.
