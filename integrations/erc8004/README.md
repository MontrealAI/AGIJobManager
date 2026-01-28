# ERC-8004 adapter (off-chain)

This folder contains a lightweight, **off-chain** adapter that consumes AGIJobManager events and produces ERC-8004-friendly reputation artifacts. It does **not** modify or depend on the on-chain escrow path.

## Quickstart
1) Install dependencies (repo root):
```bash
npm install
```

2) Export metrics (dry run, no transactions):
```bash
AGIJOBMANAGER_ADDRESS=0xYourContract \
FROM_BLOCK=0 TO_BLOCK=latest \
OUT_DIR=integrations/erc8004/output \
truffle exec scripts/erc8004/export_metrics.js --network sepolia
```

3) Generate feedback actions from the exported metrics (still dry run):
```bash
METRICS_JSON=integrations/erc8004/output/erc8004-metrics-*.json \
OUT_DIR=integrations/erc8004/output \
node scripts/erc8004/generate_feedback_calldata.js
```

## Configuration
Environment variables (also supported as CLI args):
- `AGIJOBMANAGER_ADDRESS` (required)
- `FROM_BLOCK` (default: `0`)
- `TO_BLOCK` (default: `latest`)
- `OUT_DIR` (default: `integrations/erc8004/output`)
- `INCLUDE_VALIDATORS` (default: `false`)

CLI overrides:
- `--contract 0x...`
- `--from 0` / `--to latest`
- `--out-dir path`
- `--include-validators true|false`

## Output
The export script writes a JSON artifact including:
- Per-agent totals (jobs assigned/applied, completed, disputed, dispute outcomes)
- Computed rates (successRate, disputeRate as `value` + `valueDecimals`)
- Revenue proxy (sum of job payouts for completed jobs)
- Metadata (chainId, networkId, block range, timestamp, contract address)

See `adapter_spec.md` for the full mapping and tag recommendations.

## Registration file example
An example ERC-8004 registration file is provided at:
```
integrations/erc8004/examples/registration.json
```
Host the JSON on HTTPS or IPFS and set the ERC-8004 identity tokenURI to that URL.

## On-chain feedback submission
This adapter only generates **off-chain** feedback actions by default. If you want to submit signals on-chain, use the official ERC-8004 tooling (see `docs/ERC8004.md` for links) and the JSON output from this adapter as input.
