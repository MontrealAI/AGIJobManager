# Start here — v0.9.2

This package supplies tested software and a versioned USDC console. A live manager address and operator configuration are required to transact.

1. Download the COMPLETE ZIP and its checksum file. Compare SHA-256 before extracting: use `shasum -a 256 -c SHA256SUMS.txt` on macOS or `sha256sum -c SHA256SUMS.txt` on Linux after downloading all listed assets. On Windows, use PowerShell `Get-FileHash -Algorithm SHA256` and compare each result.
2. Read `RELEASE_NOTES.md` and `VALIDATION.md`. The role-based starting point is `source/docs/START_HERE.md`.
3. **Participants:** obtain the verified manager address from its operator. Check the network, native USDC, both payout wallets, cost and bonds before approving or submitting. Never enter seed phrases or private keys into the console. ETH pays gas.
4. **Operators:** follow `source/hardhat/README.md` and `source/docs/MAINNET_READINESS.md` and `source/docs/qualification/USDC_CUTOVER.md`. Use Node 22.23.2, committed lockfiles and the exact qualified compiler configuration. Install both root and Hardhat workspaces. Truffle deployment commands are retired.
5. **Existing deployments:** v0.9.2 corrects ENS delegation. The legacy original-asset manager remains separate from the new USDC system. Use the corrected helper and a dedicated namespace; preserve legacy wiring and exits. Existing jobs, balances and approvals stay on the original manager. Reconcile and settle there; do not assume publication migrates anything.
6. **Before activation:** rehearse the intended configuration, obtain independent review for significant exposure, verify deployed source/libraries, complete ownership acceptance and run the read-only readiness check. Managers start paused.
7. **Interrupted deployment:** retain the original journal. Use the documented read-only verification recovery, and check any pending transaction by hash before retrying.

At default settings, a successful 100 USDC job pays qualifying validators 8 USDC, wallet one 30 USDC, wallet two 10 USDC and the agent 52 USDC. Bonds are separate. Completion, voting and finalization require transactions; elapsed time alone does not send payments. Without votes, the eligible liveness path pays the agent the 60% remainder; that is not an independent quality verdict.

The console needs network access for dependencies, wallet/RPC reads and transactions. USDC issuer restrictions may prevent settlement; a failed transfer rolls back the entire operation.

The tag points to the frozen application source. The archive adds this release's evidence and packaging tools at its root. `RELEASE_MANIFEST.json` inventories the payload. Prior release records inside `source/` are historical.
