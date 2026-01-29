# ERC-8004 adapter (AGIJobManager)

This adapter consumes AGIJobManager events and produces **ERC-8004 reputation-v1 files** without changing any on-chain AGIJobManager logic.

## Quick start
```bash
# from repo root
npm install
npm run build

# optional: copy the sample env file
cp .env.example .env

# export feedback artifacts from a deployed AGIJobManager
AGIJOBMANAGER_ADDRESS=0xYourContract \
ERC8004_IDENTITY_REGISTRY=0xRegistryFrom8004Build \
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
- `ERC8004_IDENTITY_REGISTRY` (required; get the registry address from https://8004.org/build)
- `FROM_BLOCK` (default: deployment block if known, otherwise `0`)
- `TO_BLOCK` (default: `latest`)
- `OUT_DIR` (default: `integrations/erc8004/out`)
- `INCLUDE_VALIDATORS` (default: `false`)
- `EVENT_BATCH_SIZE` (default: `2000`)
- `NAMESPACE` (default: `eip155`)
- `CHAIN_ID` (optional override)
- `ERC8004_AGENT_ID` + `AGENT_ADDRESS` (optional, single-subject mapping)
- `ERC8004_AGENT_ID_MAP` (optional path to JSON mapping wallet → agentId)

## Output
The export script writes:
- **One ERC-8004 `reputation-v1` file per subject** (`agent_<address>.json`, `validator_<address>.json`) when an `agentId` mapping is available.
- **One intermediate `*.wallet.json` file** per subject when no `agentId` mapping is provided (see mapping guidance below).
- `export_summary.json` with computed aggregates, rates, and filenames for each subject.

Artifacts are deterministic: subjects are sorted by address and feedback entries are sorted by timestamp then tag. See `schemas/export_summary.schema.json` for a JSON Schema snapshot of the summary file.

## AgentId mapping guidance (identity lookup)
AGIJobManager does not know ERC-8004 agent IDs on-chain. Use one of:
1) **Single-subject override**: `ERC8004_AGENT_ID` + `AGENT_ADDRESS`.
2) **Batch mapping**: `ERC8004_AGENT_ID_MAP=/path/to/map.json` with:
   ```json
   { "0xagent": 1, "0xvalidator": 2 }
   ```
3) **External lookup**: use official ERC-8004 tooling/ABIs from https://8004.org/build to resolve `agentId` and generate the mapping file.

If no mapping is provided, the adapter emits `*.wallet.json` placeholders keyed by wallet address so you can fill in `agentId` later.

## Next step: feedback action plan (dry-run only)
```bash
FEEDBACK_DIR=integrations/erc8004/out \
OUT_DIR=integrations/erc8004/out \
node scripts/erc8004/generate_feedback_actions.js
```

This generates a dry-run list of intended feedback submissions. **No transactions are sent.** For on-chain submission, use the official ERC-8004 tooling referenced on https://8004.org/build and pass the exported JSON payloads.

## Example registration file
See `integrations/erc8004/examples/registration.json` for a sample ERC-8004 registration JSON with `services`, `registrations`, and `x402Support`.

## Endpoint-domain verification
Host `integrations/erc8004/examples/.well-known/agent-registration.json` at:
`https://{endpoint-domain}/.well-known/agent-registration.json`
so clients can verify `agentRegistry` + `agentId` bindings.
