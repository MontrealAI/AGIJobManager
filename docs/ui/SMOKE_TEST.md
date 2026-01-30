# UI smoke test checklist (local dev)

This checklist validates the static UI against a local Ganache chain (no external RPCs, no wallet extensions).

## Prereqs

- Install dependencies:
  ```bash
  npm install
  ```
- Ensure Truffle artifacts are built:
  ```bash
  npm run build
  ```

## 1) Start Ganache locally

Use the deterministic mnemonic so accounts are stable:

```bash
npx ganache --wallet.mnemonic "test test test test test test test test test test test junk" --chain.chainId 1337 --chain.networkId 1337 --port 8545
```

## 2) Deploy contracts locally

The development migration deploys mock ERC-20 + ENS contracts for local UI testing.

```bash
npx truffle migrate --network development --reset
```

## 3) Serve the UI

From the repo root:

```bash
python3 -m http.server 8000 -d docs
```

Open in the browser:

```
http://localhost:8000/ui/agijobmanager.html?contract=<AGIJobManager_ADDRESS>
```

You can find the deployed address in `build/contracts/AGIJobManager.json` under the `networks` entry for `1337`.

## 4) Manual UI smoke checklist

### Connect + refresh
- Click **Connect Wallet** → status should show **Connected** and a wallet address.
- Click **Refresh snapshot** → owner/token fields should populate.
- Confirm the Activity Log includes **External ABI loaded.**

### Employer flow (happy path)
- **Approve AGI token**: enter a small amount (e.g., `1`) → click **Approve token**.
- **Create job**: fill `IPFS hash`, `Payout`, `Duration`, optional `Details` → click **Create job**.
- Click **Load jobs** → the new job should appear in the table.

### Optional role checks
- Switch accounts to verify the UI updates (connect → disconnect → reconnect).
- Use **Clear** to reset the contract address.

## Common failures & fixes

- **Wrong contract address** → Confirm the `?contract=` query and `build/contracts/AGIJobManager.json` networks entry.
- **Wrong chainId** → Ganache should report `1337`. The UI will warn if the chain differs.
- **No token balance / approve fails** → The development migration mints mock AGI to account[0].
- **ABI mismatch / UI says “Fallback ABI used.”** → Run `npm run ui:abi` and serve the UI over HTTP (not `file://`).
- **Write actions disabled** → Ensure the contract address is deployed on the active chain and the UI shows “Connected”.
