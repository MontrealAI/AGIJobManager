# AGIJobManager UI smoke test (local)

This checklist validates the static GitHub Pages UI against a local Ganache chain. It is intentionally short so regressions are obvious and repeatable.

## Prerequisites

```bash
npm install
npm run build
```

## Start Ganache (local)

```bash
npx ganache --server.host 127.0.0.1 --server.port 8545 \
  --wallet.mnemonic "test test test test test test test test test test test junk" \
  --chain.chainId 1337 --chain.networkId 1337 --logging.quiet
```

## Deploy contracts locally

```bash
npx truffle migrate --network development --reset
```

> The development migration deploys MockERC20/ENS/NameWrapper/Resolver and mints tokens to the first Ganache account.

## Serve the UI locally

From the repo root:

```bash
python3 -m http.server 8000 --directory docs
```

Open:

```
http://localhost:8000/ui/agijobmanager.html?contract=0xYourDeployedAddress
```

To get the deployed address:

```bash
node -e "const a=require('./build/contracts/AGIJobManager.json'); console.log(a.networks['1337'].address)"
```

## Manual checklist

### Connection + refresh
1. Click **Connect Wallet** → status pill should read `Connected (...)` and account should populate.
2. Click **Refresh snapshot** → contract metadata (owner, token, limits) should populate.
3. Confirm Activity Log includes `External ABI loaded.`

### Employer actions
1. In **Approve AGI token**, enter `10` and click **Approve token** → Activity Log should show `Employer approve confirmed`.
2. In **Create job**, set **Metadata source** to **Use existing job spec URI** and enter:
   - Job spec URI: `ipfs://QmTestJobHash`
   - Payout: `1`
   - Duration: `3600`
   - Details: `UI smoke test`
   Click **Create job** → Activity Log should show `Create job confirmed`.
3. Click **Load jobs** → table should show at least 1 row.

## Common failures
- **Wrong contract address**: Snapshot fields stay `—` and writes fail. Recheck the `?contract=` param.
- **Wrong chainId**: The status pill shows unsupported chain; switch to Ganache (`1337`).
- **No token balance**: Approve/create fails; ensure migrations ran and MockERC20 minted to account 0.
- **ABI mismatch**: Activity Log shows `Fallback ABI used` or calls revert; run `npm run ui:abi` after contract changes.
