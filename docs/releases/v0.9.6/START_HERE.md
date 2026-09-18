# Start here — v0.9.6

**Know what you pay, what the agent earns, and how to recover your escrow.** v0.9.6 adds exact job bond reads and clearer buyer and reviewer guidance.

1. Open `agijobmanager-usdc.html` for the versioned console. Configure a fresh, independently verified v0.9.6 manager; no live address is supplied. Saved settings from older consoles are not imported.
2. Before funding a job, use `source/docs/BUYER_JOB_TEMPLATE.md` to agree on deliverables, acceptance criteria, evidence and deadlines. Read `source/docs/BUYER_PROTECTION.md` and `source/docs/game-theory.md` for outcomes, costs and limitations.
3. Inspect the actual work. Missing submission can expire after its deadline; a bad or inaccessible submitted link needs an on-chain dispute before the displayed cutoff. **Accept work and pay** authorizes immediate, final settlement.
4. Deployment operators should follow `source/hardhat/README.md`, verifying all eight library links, accepted owner, recipient wallets, ENS authority and NFT policy before opening intake. Existing jobs stay on their original managers.
5. Download `SHA256SUMS.txt` alongside the assets and verify it. `RELEASE_MANIFEST.json` lists the archive contents, and `VALIDATION.md` identifies the exact tested source and evidence.

The default successful-job split remains 8% shared by correct-side reviewers, 30% and 10% to the configured wallets, and the remainder to the agent. Bonds and gas are separate. Refund outcomes have no 30%/10% fees; reviewer funding on a buyer win comes from forfeited collateral.

v0.9.5 and older managers lack `getJobBonds`. Use their original versioned interfaces for existing jobs, with the older bond-quotation limitation explained in `source/docs/qualification/BUYER_ECONOMICS_FOLLOWUP.md`. A new console cannot upgrade old bytecode.

Publishing this software does not deploy or activate it on Ethereum. Reviewers and moderators must still assess off-chain quality and respond to disputes.
