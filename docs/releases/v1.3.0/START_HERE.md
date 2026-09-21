# AGIJobManager v1.3.0 — start here

This package adds conditional economic screening and retains the existing contracts, participant console and settlement recovery tools.

1. **Verify the download.** Use the accompanying `SHA256SUMS.txt`; `RELEASE_MANIFEST.json` records the frozen source and each archive payload hash.
2. **Try the economic example.** Open a terminal in `source` and run `npm run economics:screen -- --example` with the supported Node.js version. This command needs no dependency installation, RPC or wallet. All example values are hypothetical.
3. **Use your assumptions.** Copy `source/scripts/economics/screen-example.json`, replace its terms, outcome weights, costs, employer value and risk limits, and follow `source/docs/OPERATIONS/ECONOMIC_SCREENING.md`. Use `--json` for a structured report. A result within supplied limits does not authorize a transaction or establish complete admission readiness.
4. **Use the participant console.** Open `agijobmanager-usdc.html` and read `source/docs/START_HERE.md`. It needs internet access and an Ethereum wallet. Enter a verified compatible manager; never enter a seed phrase or private key. New operators should follow `source/hardhat/README.md` and the launch checklist.
5. **Keep settlement visible.** In `source`, install pinned dependencies with `npm ci`, then run `npm run settlement:status -- --help` and follow `source/docs/OPERATIONS/SETTLEMENT_RECOVERY.md`. Closed jobs can retain unpaid claims; all five reserves and pause-adjusted deadlines matter. Economics do not change existing payment obligations.

Keep private cost/customer information, confidential material, personal information and secrets out of public submissions, GitHub and shared reports. Read `source/docs/LEGAL/README.md`. Existing jobs, names, balances, agreements and settings stay on their original contracts; software publication provides no live deployment.

The archive contains public source, console, license, guides and release evidence/tooling. Private AGI Agent, AGI Node and fleet applications are excluded. The annotated tag points to the qualified application source, which retains the preceding edition's publication tooling. This archive's top-level evidence and `release-tooling` describe v1.3.0. Read `RELEASE_NOTES.md` and `VALIDATION.md` for qualification scope.
