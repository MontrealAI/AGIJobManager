# ERC-8004 adapter (AGIJobManager)

This adapter consumes AGIJobManager events and produces ERC-8004-friendly reputation artifacts **without changing any on-chain AGIJobManager logic**.

## Quick start
```bash
# from repo root
npm install
npm run build

# optional: copy the sample env file
cp .env.example .env

# export ERC-8004 reputation files from a deployed AGIJobManager
AGIJOBMANAGER_ADDRESS=0xYourContract \
ERC8004_IDENTITY_REGISTRY=0xIdentityRegistry \
FROM_BLOCK=0 \
TO_BLOCK=latest \
OUT_DIR=integrations/erc8004/out \
truffle exec scripts/erc8004/export_feedback.js --network sepolia
```

Optional validator aggregation:
```bash
INCLUDE_VALIDATORS=true \
truffle exec scripts/erc8004/export_feedback.js --network sepolia
```

### Inputs (env vars / args)
- `AGIJOBMANAGER_ADDRESS` (required if not using `truffle exec` with a deployed artifact)
- `FROM_BLOCK` (default: deployment block if known, otherwise `0`)
- `TO_BLOCK` (default: `latest`)
- `OUT_DIR` (default: `integrations/erc8004/out`)
- `INCLUDE_VALIDATORS` (default: `false`)
- `EVENT_BATCH_SIZE` (default: `2000`)
- `ERC8004_IDENTITY_REGISTRY` (required; see 8004.org/build for latest addresses)
- `ERC8004_AGENT_ID` (optional; only safe when exporting a single subject)
- `ERC8004_AGENT_ID_MAP` (optional path to JSON: `{ "0xwallet": 123 }`)
- `NAMESPACE` (default: `eip155`)
- `CHAIN_ID` (optional override)
- `ERC8004_CLIENT_ADDRESS` (optional; defaults to AGIJobManager address)

## Output
The export script writes:
- `out/reputation/*.json`: one **ERC‑8004 reputation‑v1** file per subject (agent/validator).
- `out/export_summary.json`: summary + metadata.
- `out/erc8004_unresolved_wallets.json` if wallet → agentId mapping is missing.

If you have many agents, provide `ERC8004_AGENT_ID_MAP` so the adapter can map wallet addresses to registry token IDs. Otherwise, you will get an unresolved wallet file and can map manually.

## Next step: feedback action plan (dry-run)
```bash
FEEDBACK_DIR=integrations/erc8004/out/reputation \
OUT_DIR=integrations/erc8004/out \
node scripts/erc8004/generate_feedback_actions.js
```

This generates a dry-run list of intended ERC-8004 feedback signals (no transactions are sent). For on-chain submission, use the official ERC-8004 tooling linked from 8004.org/build and the JSON output as input.

Each action includes `tag1`, optional `tag2`, `value`, `valueDecimals`, and optional `endpoint`/`feedbackURI`/`feedbackHash` fields aligned to the ERC-8004 feedback interface.

## Example registration file
See `integrations/erc8004/examples/registration.json` for a sample ERC-8004 registration JSON with a `services` array.
