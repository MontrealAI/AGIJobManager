# Start here — v0.9.0

This package supplies the complete source and a versioned USDC console. It does not supply a live marketplace, configured recipient wallets or private keys.

1. Download the COMPLETE ZIP, standalone HTML and manifest alongside `SHA256SUMS.txt`. In that directory, run `shasum -a 256 -c SHA256SUMS.txt` on macOS or `sha256sum -c SHA256SUMS.txt` on Linux. On Windows PowerShell, use `Get-FileHash -Algorithm SHA256` for each file and compare it with the checksum file. Extract the ZIP after checking it.
2. Read `RELEASE_NOTES.md` and `VALIDATION.md` for changes, evidence and limits. Open `source/docs/START_HERE.md` for the role-based guide.
3. **Participants:** obtain the verified manager address from the operator. Open `agijobmanager-usdc.html` in a supported Ethereum wallet browser. Check the chain, native USDC, both recipient addresses, cost, bond and payout split before approval or submission. Never enter a seed phrase or private key into the console. ETH pays gas.
4. **New deployment operators:** follow `source/hardhat/README.md` and `source/docs/MAINNET_READINESS.md`. Rehearse on Sepolia, supply the intended owner and two reviewed recipients, and retain every deployment journal. Managers start paused; verify source, complete ownership acceptance and pass the read-only checker before opening intake.
5. **Existing operators:** read `source/docs/OWNER_RUNBOOK.md`. For interrupted verification or confirmation, follow `source/docs/VERIFY_ON_ETHERSCAN.md`; recovery preserves the original journal and does not broadcast blockchain transactions. A pending transaction or RPC timeout is not proof of failure. Check its hash before retrying.

## Follow the money

A successful 100 USDC job at the default validator rate pays 8 USDC to qualifying validators, 30 USDC to wallet one, 10 USDC to wallet two and the remaining 52 USDC to the agent. Bonds are separate. Posted jobs retain their validator rate; the owner can change the rate for future jobs. Without votes, the eligible finalization path pays the agent the 60% remainder and no validator reward. That is a liveness fallback, not an independent quality verdict.

For a complete job walkthrough, use `source/docs/USERS.md`. The first eligible successful application assigns the job. Completion, voting, finalization and dispute resolution require transactions; elapsed time alone does not send payments.

## Know what this version changes

v0.9.0 improves interfaces, deployment/recovery tools, tests and guidance. Production contract bytecode and compiler settings are unchanged from v0.8.0. An existing, correctly verified v0.8.0 USDC instance is not automatically required to redeploy for this tooling release. Legacy token-manager migrations still require a new USDC instance; never reuse legacy raw amounts or assume an old receipt establishes current readiness.

The console needs internet access for pinned libraries, display resources, wallet/RPC reads and live transactions. Recipient rotation is guarded by paused intake and zero reserves. Future Solidity changes require a new deployment because there is no proxy upgrade path. Read the instance-readiness guide and independent review requirements before significant exposure.

The complete archive contains a frozen `source/` snapshot plus this release's documents and tools. The tag points to the tested application commit; subsequent release-packaging metadata is included at the archive root. Every payload is listed in `RELEASE_MANIFEST.json`. Previous release records inside `source/` remain historical records.
