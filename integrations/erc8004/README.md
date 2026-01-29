# ERC-8004 adapter (AGIJobManager)

This adapter consumes AGIJobManager events and produces ERC-8004-compatible **off-chain feedback artifacts** without changing any on-chain AGIJobManager logic. Outputs are intended for indexing, ranking, or optional later submission to the ERC-8004 Reputation Registry.

## Quick start
```bash
# from repo root
npm install
npm run build

# optional: copy the sample env file
cp .env.example .env

# export ERC-8004 feedback files from a deployed AGIJobManager
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

## Inputs (env vars / args)
- `AGIJOBMANAGER_ADDRESS` (required if not using `truffle exec` with a deployed artifact)
- `FROM_BLOCK` (default: deployment block if known, otherwise `0`)
- `TO_BLOCK` (default: `latest`)
- `OUT_DIR` (default: `integrations/erc8004/out`)
- `INCLUDE_VALIDATORS` (default: `false`)
- `EVENT_BATCH_SIZE` (default: `2000`)
- `ERC8004_IDENTITY_REGISTRY` (default: mainnet if chainId==1; otherwise required)
- `ERC8004_REPUTATION_REGISTRY` (default: mainnet if chainId==1; otherwise required)
- `ERC8004_AGENT_ID` (optional; only safe when exporting a single subject)
- `ERC8004_AGENT_ID_MAP` (optional path to JSON: `{ "0xwallet": 123 }`)
- `NAMESPACE` (default: `eip155`)
- `CHAIN_ID` (optional override)
- `ERC8004_CLIENT_ADDRESS` (optional; defaults to AGIJobManager address for artifacts)

## Output
The export script writes:
- `out/feedback/*.json`: **one ERC-8004 off-chain feedback file per signal** (each file matches the EIP-8004 feedback JSON structure).
- `out/summary.json`: export metadata (chainId, block range, registry addresses, assumptions).
- `out/erc8004_unresolved_wallets.json` if wallet → agentId mapping is missing.

If you have many agents, provide `ERC8004_AGENT_ID_MAP` so the adapter can map wallet addresses to registry token IDs. Otherwise, you will get an unresolved wallet file and can map manually.

## Optional: generate submit actions (dry-run)
```bash
FEEDBACK_DIR=integrations/erc8004/out/feedback \
OUT_DIR=integrations/erc8004/out \
ERC8004_REPUTATION_REGISTRY=0xYourReputationRegistry \
node scripts/erc8004/generate_submit_actions.js
```

This generates a **dry-run** list of intended ERC-8004 `giveFeedback(...)` calls. To send transactions, set `SEND_TX=true` and `I_UNDERSTAND=true` with a funded signer in your Truffle provider (when `SEND_TX=true`, the script defaults `DRY_RUN=false` unless you explicitly set `DRY_RUN=true`). The script enforces the ERC-8004 rule that the submitter **must not** be the agent owner or approved operator.

ABIs used by the scripts are vendored from the official ERC-8004 contracts repo in `integrations/erc8004/abis/`.

## Example registration files
See:
- `integrations/erc8004/examples/registration.json`
- `integrations/erc8004/examples/.well-known/agent-registration.json`

Both files follow the ERC-8004 registration-v1 schema described in `docs/ERC8004.md`.
