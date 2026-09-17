# Start here — v0.9.3

This package contains tested software and a USDC console. Your operator must supply a verified live manager address before you can transact.

1. Download all four release assets. Verify `SHA256SUMS.txt` using `sha256sum -c SHA256SUMS.txt` on Linux or `shasum -a 256 -c SHA256SUMS.txt` on macOS. On Windows, compare each asset using PowerShell `Get-FileHash -Algorithm SHA256`.
2. Read `RELEASE_NOTES.md` and `VALIDATION.md`. Open `source/docs/START_HERE.md` for role-specific instructions.
3. **Participants:** use `agijobmanager-usdc.html` with the operator's verified USDC manager address. Agents use Agent ENS subnames and a configured NFT credential; validators use AGI Club subnames. Review USDC approvals, bonds, recipient addresses and job terms. ETH pays gas; never enter a private key or recovery phrase into the console.
4. **Deployers:** start with `source/hardhat/README.md`. Install both root and Hardhat dependencies with the committed lockfiles, safely create a local configuration, fill in the actual owner and both recipients, and run the read-only plan. No production owner or recipient is selected for you.
5. **Owners:** complete manager ownership acceptance, verify the separate ENS helper owner and dedicated job root, qualify participant eligibility, and run the documented read-only readiness check. Keep intake paused until the actual operating configuration and signing paths have been rehearsed and reviewed.
6. **Existing jobs:** use the original manager and original token. A new USDC manager is separate; publishing or opening this console does not migrate jobs, funds, approvals or ENS records.
7. **Interrupted deployment:** preserve the original journal and inspect each pending transaction by hash. Follow the manager or ENS recovery instructions appropriate to that journal; do not blindly deploy again.

At default settings, a successful 100 USDC job pays validators 8 USDC, wallet one 30 USDC, wallet two 10 USDC and the agent 52 USDC. Bonds are separate. Elapsed time alone does not finalize or pay a job. Without votes, the eligible liveness path pays the agent the 60% remainder; this is not a quality verdict.

The console needs internet access for dependencies and wallet/RPC interaction. USDC issuer restrictions can block settlement; a failed token transfer rolls back the operation.

The tag pins the frozen application source. The COMPLETE archive adds release evidence and packaging tools at its root. Earlier release records inside `source/` are historical.
