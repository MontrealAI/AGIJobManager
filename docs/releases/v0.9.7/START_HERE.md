# Start here — v0.9.7

v0.9.7 corrects console permissions and makes the launch and recovery instructions consistent with the contract.

1. Open `agijobmanager-usdc.html` and enter an independently verified compatible manager. A verified v0.9.6 manager remains compatible; no live manager is supplied. v0.9.6 console settings are preserved, while writes still require validation of chain, account and manager.
2. Before paying, use `source/docs/BUYER_JOB_TEMPLATE.md` to agree on deliverables, acceptance criteria, evidence and deadlines. Read `source/docs/BUYER_PROTECTION.md` and `source/docs/game-theory.md` for outcomes, costs and limits.
3. Inspect submitted work before acceptance. Missing submission can expire after its deadline; poor or inaccessible submitted work needs an on-chain dispute before the displayed cutoff. **Accept work and pay** authorizes final settlement.
4. Operators should use `source/docs/LAUNCH_CHECKLIST.md` and `source/hardhat/README.md` to record actual signers, recipients, eligibility, NFT policy, rehearsal and readiness evidence. Fresh managers start with NFTs required and no registered collections.
5. Verify `SHA256SUMS.txt` against the downloaded assets. `RELEASE_MANIFEST.json` lists the archive contents, and `VALIDATION.md` identifies the tested source and CI evidence.

The default successful-job split remains 8% shared reviewer budget, 30% and 10% wallet fees, and the agent remainder. Bonds and gas are separate. Buyer-win refunds return full escrow without wallet fees; reviewer rewards come from forfeited collateral.

Existing jobs stay on their original contracts. v0.9.5 and older managers lack `getJobBonds` and must retain their compatible interfaces for existing jobs. See `source/docs/qualification/BUYER_ECONOMICS_FOLLOWUP.md` for the older bond-quotation limitation.

Publishing software does not deploy or activate it on Ethereum. Reviewers and moderators must still assess quality and respond to disputes.
