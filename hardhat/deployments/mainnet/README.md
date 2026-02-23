# Mainnet Deployment Artifacts (Official Record)

This folder stores portable, repository-relative deployment records for the official Ethereum Mainnet deployment.

Files:
- `deployment.1.24522684.json`: Canonical deployment receipt (network, deployer, owner, addresses, tx hashes, constructor args).
- `solc-input.json`: Canonical compiler configuration record used for bytecode reproduction and Etherscan verification alignment.
- `verify-targets.json`: Verification targets and linked library map for Etherscan/operator audits.

Operational rules:
- Keep all entries repository-relative and portable.
- Do not include local absolute paths.
- Do not include secrets (private keys, RPC URLs, API keys).
