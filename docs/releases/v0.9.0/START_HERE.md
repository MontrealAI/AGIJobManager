# Start here — v0.9.0

This package contains the complete pinned source, USDC console, tests, deployment/recovery tools and documentation. It supplies no live manager, recipient configuration or private keys.

1. Verify the downloaded assets against `SHA256SUMS.txt`, then extract the complete ZIP. The manifest identifies the exact source and hashes every archive payload.
2. Read `RELEASE_NOTES.md` and `VALIDATION.md` for the changes, evidence and remaining limits.
3. Open `source/docs/START_HERE.md` for the employer, agent and validator journey. Voting and elapsed time do not automatically execute settlement.
4. For a new deployment use `source/hardhat/README.md` and `source/docs/MAINNET_READINESS.md`. Supply both recipients and the intended owner; rehearse on Sepolia with the actual signing arrangement first.
5. New managers start with intake paused. Verify source, complete ownership acceptance, configure participants/policy and pass the read-only readiness checks before choosing to activate.
6. Open `agijobmanager-usdc.html` in a supported Ethereum wallet browser. Enter the independently verified manager and review the account, chain, USDC amount, recipients and action before signing. The console needs its integrity-pinned Web3 library and wallet/RPC connectivity; it is not offline.

A successful 100 USDC job at the default 8% validator budget pays **8 to correct-side validators, 30 to wallet one, 10 to wallet two and 52 to the agent**, subject to the documented rounding rules. Bonds/slashing are separate. The 30%/10% shares are fixed; owner validator-budget changes apply to future postings only. ETH pays gas.

For failed deployment verification, use the documented blockchain-read-only re-verification command. It preserves the original journal and creates a separate recovered receipt; do not edit evidence fields or blindly redeploy. For incidents and routine maintenance use `source/docs/OPERATIONS/INCIDENT_RESPONSE.md` and `source/docs/OWNER_RUNBOOK.md`.

Production Solidity is unchanged from v0.8.0. This release does not upgrade an existing immutable contract; previous deployments require their own identity, code and configuration review. Historical receipts are not a configured v0.9.0 instance.

Automated qualification is not an independent audit. High-stakes activation still requires independent source/operational review and instance-specific readiness. See the dependency report for the legacy local test-tool advisories.
