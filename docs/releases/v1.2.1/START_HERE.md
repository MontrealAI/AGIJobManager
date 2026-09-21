# AGIJobManager v1.2.1 — start here

This package strengthens settlement reports while preserving contract and payment behavior.

1. **Verify the files.** Check `SHA256SUMS.txt`. The manifest identifies the frozen source and each archive payload file.
2. **Read outstanding obligations.** From `source`, install the pinned dependencies with `npm ci` on the supported Node version. Run `npm run settlement:status -- --help`, then follow `source/docs/OPERATIONS/SETTLEMENT_RECOVERY.md`. Configure your RPC, verified manager and chain; no wallet/key is needed and no transaction is sent.
3. **Check the new requirements.** Ethereum requires native Circle USDC. Other chains need `--expected-token`. RPCs must support canonical block-hash reads. Default freshness limits require a synchronized clock; a simulated/historical local chain may need the explicitly reported `--max-head-age 0` override. Do not mistake a failed read for zero obligations.
4. **Use the console or deployment guide.** Open `agijobmanager-usdc.html` for the participant interface and read `source/docs/START_HERE.md`. New operators should follow `source/hardhat/README.md` and `source/docs/LAUNCH_CHECKLIST.md`; publication supplies no live manager and does not authorize paid intake. Never enter a seed phrase or private key into the console.
5. **Follow claims through payment.** Completed jobs can retain unpaid claims. Keep all five reserve categories visible, account for paused deadlines and review blocked/exhausted retries. Zero counters do not prove work quality or profit.

The console needs internet access and an Ethereum wallet. Keep added personal information, confidential material and secrets out of public submissions. Read `source/docs/LEGAL/README.md`; operators remain responsible for their deployment-specific notices and agreements. Existing jobs, ENS names, balances and settings stay on their original contracts.

The archive contains public source, console, license, guides and release verification evidence/tooling. Private AGI Agent, AGI Node and fleet applications are excluded. The annotated v1.2.1 tag points to the qualified application source. That source snapshot retains the preceding edition's publication tooling; this package's top-level `release-tooling` and evidence describe v1.2.1. Read `RELEASE_NOTES.md` and `VALIDATION.md` for scope and limitations.
