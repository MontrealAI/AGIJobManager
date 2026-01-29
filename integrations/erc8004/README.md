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

### Inputs (env vars / args)
- `AGIJOBMANAGER_ADDRESS` (required if not using `truffle exec` with a deployed artifact)
- `FROM_BLOCK` (default: deployment block if known, otherwise `0`)
- `TO_BLOCK` (default: `latest`)
- `OUT_DIR` (default: `integrations/erc8004/out`)
- `INCLUDE_VALIDATORS` (default: `false`)
- `EVENT_BATCH_SIZE` (default: `2000`)

## Output
The export script writes a JSON file containing per-agent metrics, computed rates, evidence anchors, and metadata. See `adapter_spec.md` for field definitions and `schemas/metrics.schema.json` for a JSON Schema snapshot.

Rates follow ERC-8004 fixed-point encoding (`value` + `valueDecimals`), with `valueDecimals` constrained to 0–18 per the spec.

## Next step: feedback action plan (dry-run)
```bash
METRICS_JSON=integrations/erc8004/out/erc8004_metrics.json \
OUT_DIR=integrations/erc8004/out \
node scripts/erc8004/generate_feedback_actions.js
```

This generates a dry-run list of intended ERC-8004 feedback signals (no transactions are sent). For on-chain submission, use the official ERC-8004 tooling (for example, the SDKs linked from the best-practices repo) and the JSON output as input.

Each action includes `tag1`, optional `tag2`, `value`, `valueDecimals`, and optional `endpoint`/`feedbackURI`/`feedbackHash` fields aligned to the ERC-8004 feedback interface.

## Example registration file
See `integrations/erc8004/examples/registration.json` for a sample ERC-8004 registration JSON with a `services` array.
