# ERC-8004 adapter (AGIJobManager)

This adapter consumes AGIJobManager events and produces ERC-8004-friendly reputation artifacts **without changing any on-chain AGIJobManager logic**.

## Quick start
```bash
# from repo root
npm install
npm run build

# optional: copy the sample env file
cp .env.example .env

# export metrics from a deployed AGIJobManager
AGIJOBMANAGER_ADDRESS=0xYourContract \
FROM_BLOCK=0 \
TO_BLOCK=latest \
OUT_DIR=integrations/erc8004/out \
truffle exec scripts/erc8004/export_metrics.js --network sepolia
```

Optional validator aggregation:
```bash
INCLUDE_VALIDATORS=true \
truffle exec scripts/erc8004/export_metrics.js --network sepolia
```

## Output
The export script writes a JSON file containing per-agent metrics, computed rates, and metadata. See `adapter_spec.md` for field definitions.

## Next step: feedback intent generation
```bash
METRICS_JSON=integrations/erc8004/out/erc8004_metrics.json \
OUT_DIR=integrations/erc8004/out \
node scripts/erc8004/generate_feedback_calldata.js
```

This generates a dry-run list of intended ERC-8004 feedback signals (no transactions are sent). For on-chain submission, use the official ERC-8004 tooling (e.g., Agent0 SDK) and the JSON output as input.

## Example registration file
See `integrations/erc8004/examples/registration.json` for a sample ERC-8004 registration JSON with a `services` array.
