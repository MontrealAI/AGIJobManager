# AGIJobManager Web UI (static)

This directory hosts the canonical static UI for AGIJobManager.

## Open locally (served over HTTP)

From the repo root:

```bash
cd docs
python3 -m http.server 8000
```

Then open:

```
http://localhost:8000/ui/agijobmanager.html
```

Serve from `docs/` so the UI can read `docs/deployments/mainnet.json`. Running a server from
`docs/ui/` will not expose the deployments file.

## Set the contract address

The UI does **not** assume a default deployment. Provide a contract address explicitly:

- Query param: `?contract=0x...`
- Manual entry in the “Contract address” field
- Save button: persists to `localStorage` under the key `agijobmanager_contract`

To reset:

- Click **Clear** in the UI, or
- Remove `localStorage` key `agijobmanager_contract` in your browser’s dev tools.

The legacy v0 address is displayed as a reference and only used if you explicitly opt in.

## Supported networks

- **Ethereum mainnet** is the intended production network.
- **Sepolia** or local dev chains are supported only if you supply a compatible contract address.
- On unsupported chains, the UI will show a warning (chainId mismatch) and interactions may revert.
  The UI does not generate chain-specific explorer links.

## Safety notes

- The UI only talks to your wallet provider (e.g., MetaMask). No keys or secrets are collected.
- Always verify the contract address and chainId before signing transactions.

## Known limitations

- Merkle proofs are user-supplied (`bytes32[]` via comma-separated 0x… hashes). The UI only
  verifies membership off-chain; on-chain checks are authoritative.
- ENS checks mirror the contract’s fallback logic: Merkle → NameWrapper.ownerOf → Resolver.addr.
