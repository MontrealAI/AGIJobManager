# AGIJobManager v1.2.0 — start here

This package adds settlement visibility and recovery guidance while preserving the contract and existing privacy/deployment safeguards.

1. **Verify the download.** Check `SHA256SUMS.txt`. `RELEASE_MANIFEST.json` records the frozen source and every archive payload file.
2. **Check outstanding obligations.** In `source`, install the pinned dependencies with `npm ci` on the supported Node version, then run `npm run settlement:status -- --help`. Follow `source/docs/OPERATIONS/SETTLEMENT_RECOVERY.md` to set an RPC endpoint and the verified manager/chain. This command needs no wallet or key and sends no transaction.
3. **Use the console.** Buyers, agents and reviewers can open `agijobmanager-usdc.html` and follow `source/docs/START_HERE.md`. Configure a verified compatible USDC manager. The console needs internet access and an Ethereum wallet; never enter a private key or seed phrase. Public submissions must contain no added personal information, confidential material or secrets.
4. **Deploy only through the documented checks.** New operators should follow `source/hardhat/README.md` and `source/docs/LAUNCH_CHECKLIST.md`. Deployment scripts default to read-only; broadcasting requires deliberate `DRY_RUN=0` and existing verification/mainnet gates. Fresh intake is paused and NFT admission is disabled. Verify ownership, recipients, linked libraries, ENS wiring and actual readiness before admitting paid work.
5. **Track recovery through payment.** Closing a job does not prove its beneficiaries were paid. Inspect all five reserve counters, blocked claims and paused deadlines. Read the recovery guide before scheduling retries; zero counters do not certify work quality or profit.

Existing jobs, balances, settings, ENS names and agreements stay on their original contracts. Software publication makes no on-chain changes. Operators must supply accurate deployment-specific notices, a private contact and any applicable service agreement; read `source/docs/LEGAL/README.md`.

The ZIP contains the public source, console, license, guides, qualification evidence and publication tooling. Private AGI Agent, AGI Node and fleet applications are excluded. The annotated `v1.2.0` tag pins the qualified application source. That snapshot's `source/scripts/release` retains the previous edition's publication tooling; the top-level `release-tooling` and evidence describe this publication. Read `RELEASE_NOTES.md` and `VALIDATION.md` for tested scope and limitations.
