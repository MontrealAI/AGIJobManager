# Start here — v0.8.0

This package contains the versioned USDC console and complete source. It does not contain a live deployment or wallet keys.

1. Verify the downloaded assets with `SHA256SUMS.txt`, then extract the complete ZIP.
2. Read `RELEASE_NOTES.md` and `VALIDATION.md` for changes, tests and limits.
3. For deployment, open `source/hardhat/README.md` and `source/docs/MAINNET_READINESS.md`. Supply the actual 30%/10% recipients and intended owner; rehearse on Sepolia first.
4. New managers start paused. Complete source verification and two-step ownership acceptance, then run the read-only readiness checker before choosing to open intake.
5. Open `agijobmanager-usdc.html` with a supported Ethereum wallet browser. Enter the verified v0.8.0 manager. Review the chain, native USDC, exact cost, recipient addresses and payout split before every transaction. ETH pays gas.

At the default validator rate, a successful 100 USDC job pays 8 USDC to validators, 30 USDC to wallet one, 10 USDC to wallet two and the remaining 52 USDC to the agent. Bond movements are separate. Owner validator-rate updates apply to newly posted jobs; existing jobs retain their posted rate.

The standalone console is a single HTML file but still needs its pinned libraries, a wallet/RPC and relevant network access for live operation. It is not an offline blockchain. Historical deployment receipts in the source do not establish a live v0.8.0 instance.

For maintenance, use `source/docs/OWNER_CONTROLS.md`. Recipient rotation requires paused intake and zero reserved funds. The implementation has no proxy upgrade path; future code releases require a new deployment.

The archive manifest hashes every payload file and identifies the exact source commit/tree. Independent high-stakes review and instance-specific operational checks are separate from automated release qualification.
