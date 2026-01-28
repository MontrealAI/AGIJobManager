# ERC-8004 adapter (AGIJobManager)

This folder contains a lightweight, **off-chain** adapter for exporting ERC-8004-friendly reputation artifacts from AGIJobManager events. No on-chain AGIJobManager logic is modified.

## Quickstart
```bash
npm install
npm run build

# Export metrics (dry-run, writes JSON only)
AGIJOBMANAGER_ADDRESS=0x... \
FROM_BLOCK=0 \
TO_BLOCK=latest \
OUT_DIR=integrations/erc8004/out \
truffle exec scripts/erc8004/export_metrics.js --network sepolia
```

Optional:
```bash
# Generate intended feedback actions (no transactions by default)
METRICS_FILE=integrations/erc8004/out/erc8004_metrics_*.json \
OUT_DIR=integrations/erc8004/out \
node scripts/erc8004/generate_feedback_calldata.js
```

## Configuration
Environment variables (see `.env.example`):
- `AGIJOBMANAGER_ADDRESS` — contract address to scan.
- `FROM_BLOCK` / `TO_BLOCK` — block range (use `latest` for current tip).
- `OUT_DIR` — output directory for JSON artifacts.
- `INCLUDE_VALIDATORS` — set to `true` to include validator stats.

## Outputs
- `erc8004_metrics_*.json` — aggregated metrics per agent (and optionally validator stats).
- `erc8004_feedback_actions_*.json` — intended feedback actions for ERC-8004 (dry-run).

## Notes
- Revenue is a **proxy** derived from `JobCreated` payout values that later complete successfully.
- Employer addresses are inferred from `JobCreated` transactions, since the event does not carry the employer address.
- See `adapter_spec.md` for the full mapping.
- For on-chain submission of feedback, use the official ERC-8004 tooling/SDK referenced in `docs/ERC8004.md` and map the generated actions accordingly.
