# AGIJobManager v1.1.0 — start here

This edition packages safer deployment defaults and clearer operating instructions. It retains the v1.0.5 privacy safeguards, user-data rules and protocol notices, with unchanged contract code.

1. Verify the downloads against `SHA256SUMS.txt`. `RELEASE_MANIFEST.json` identifies the frozen source, qualification evidence and every archive payload file.
2. **Buyer, agent or reviewer:** open `agijobmanager-usdc.html`, read the notices, and follow `source/docs/START_HERE.md`. Configure the verified address of a compatible USDC manager. No live manager is supplied. The console needs internet access and an Ethereum wallet; never enter a private key or seed phrase.
3. **New deployer:** follow `source/hardhat/README.md` in order. Install the pinned dependencies, run non-overwriting setup, complete the selected configuration, run its offline check, and use explicit `DRY_RUN=1` for the live read-only plan. Missing or empty `DRY_RUN` also means read-only in v1.1.0.
4. **Before any broadcast:** deliberately select `DRY_RUN=0`, review the signer, owner, both recipients, chain and plan, and satisfy the documented verification and mainnet confirmation gates. Existing private configuration is preserved; an old `DRY_RUN=0` remains an explicit broadcast request. Earlier releases do not acquire v1.1.0's safer default.
5. **Owner:** follow `source/docs/LAUNCH_CHECKLIST.md`. Fresh intake starts paused and NFT admission starts disabled with an empty collection registry. Accept ownership, verify all eight library links and any ENS wiring, then run initial readiness. All five initial escrow/bond/claim counters must be zero. The release does not authorize opening paid intake.
6. **Everyone:** keep personal information, confidential material and secrets out of public descriptions, links, files and agent outputs. Read `source/docs/LEGAL/USER_DATA_RULES.md` and review each public-content prompt. Saved drafts are explicit and unencrypted; pinning credentials are not saved. Operators must provide accurate deployment-specific notices, a private contact and any valid service agreement.

Updating the console does not alter existing contracts, settings, job policies, escrow, ENS names or agreements. Keep each existing job on its original manager. Public-content checks do not scan every submission or govern other clients.

The ZIP contains the standalone console, source, license, guides, qualification evidence and publication tooling. The annotated `v1.1.0` tag pins the application source. Its `source/scripts/release/` directory retains the previous release's tooling as part of that frozen snapshot; the top-level `release-tooling/` directory and evidence describe this publication. Read `RELEASE_NOTES.md` and `VALIDATION.md` for the tested scope.
