# AGIJobManager UI Smoke Test Checklist (Local Chain)

This checklist is for the static UI at `docs/ui/agijobmanager.html`. It assumes a local Ganache chain and the repo’s Truffle migrations.

## 1) Start Ganache locally

```bash
npx ganache -p 8545 --wallet.mnemonic "test test test test test test test test test test test junk"
```

> Tip: the mnemonic matches the repo’s default `GANACHE_MNEMONIC` fallback in `truffle-config.js`.

## 2) Deploy contracts locally

```bash
npx truffle migrate --network development --reset
```

Notes:
- The local migration deploys mock ENS/NameWrapper plus a mock ERC‑20 token and mints it to account[0].
- The deployed AGIJobManager address is written to `build/contracts/AGIJobManager.json`.

## 3) Serve the UI locally

From the repo root:

```bash
python3 -m http.server 8000 --directory docs
```

## 4) Open the UI with the local contract

Extract the deployed address:

```bash
node -e "const a=require('./build/contracts/AGIJobManager.json');const id=Object.keys(a.networks)[0];console.log(a.networks[id].address)"
```

Open:

```
http://localhost:8000/ui/agijobmanager.html?contract=0xYourContract
```

## 5) Manual smoke checklist

**Connect + refresh**
1. Click **Connect Wallet**.
2. Confirm the network pill shows “Connected”.
3. Click **Refresh snapshot**.
4. Verify the snapshot fields populate (Owner, Token address, Next Job ID, etc.).

**Approve payout + create job**
1. In **Approve AGI token**, set a small amount (e.g., `10`) and click **Approve token**.
2. In **Create job**, fill:
   - IPFS hash: `QmUiSmokeTest`
   - Payout: `1`
   - Duration: `60`
   - Details: `UI smoke test job`
3. Click **Create job**.
4. Confirm the activity log shows “Create job confirmed”.
5. Confirm **Next Job ID** increments to `1`.

**Load jobs**
1. Click **Sync events** (if available) to build the local index.
2. Use **Refresh** to verify the jobs table renders at least one job row.

## Common failures + fixes

- **Wrong contract address**: snapshot fields stay “—”.
  - Fix: re-open with the correct `?contract=0x...`.
- **Wrong chainId**: network pill shows unsupported.
  - Fix: ensure Ganache is running on `1337` and the wallet is connected to it.
- **No token balance / approval**: create job reverts with TransferFailed.
  - Fix: ensure the local migration minted tokens to the connected account and approve the payout again.
- **ABI mismatch / external ABI not loading**:
  - Fix: run `npm run ui:abi` after `truffle compile`, then reload.
