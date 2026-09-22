# AGIJobManager v1.6.0

This release adds public primitives for qualifying an employer offer **before token approval or job funding**. Start with `source/docs/OPERATIONS/PREFUNDING.md` and the complete examples there.

1. Verify this ZIP against `SHA256SUMS.txt` from the release. The manifest records each payload hash and its exact public source commit.
2. Read `RELEASE_NOTES.md` and `VALIDATION.md` before integrating the qualification modules.
3. Use the public source in `source/`. Schema 3 is for pre-funding employer offers; schema 2 binds Agent and reviewer actions after creation. A qualification result grants no signing authority.
4. The offline `agijobmanager-usdc.html` console remains a manual contract console. **It does not enforce the off-chain economic gate.** A coordinator must integrate the checks before approval/funding and keep the subsequent worker checks.
5. Existing deployments and payment rules are unchanged. This archive does not deploy a contract, fund a job, enroll an issuer or include private applications or wallet credentials.

This is commissioning software, not production qualification or a profitability guarantee. Independent issuer/operator relationships, credible observed employer value, actual costs, capacity and recovery must be qualified separately. Public native-USDC reads support Ethereum and Sepolia; passing a local model does not establish live capacity.

The release notes, manifest, prior-release snapshot and exact-source CI record are included alongside the source. See the repository's operations guides for deployment verification, recovery and manual-console setup.
