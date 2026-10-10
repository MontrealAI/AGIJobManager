# Contributing to AGIJobManager

Thanks for your interest in contributing. This repository is security-sensitive and contract changes must be reviewed with extra rigor.

## Ground rules
- Be respectful and professional.
- Keep changes minimal and well-scoped.
- Do not add or modify `contracts/AGIJobManager.sol` unless explicitly requested and reviewed.

## Development workflow
1. **Install dependencies**
   ```bash
   npm ci
   npm --prefix hardhat ci
   npm --prefix ui ci
   ```
2. **Compile**
   ```bash
   npm run build
   ```
3. **Test**
   ```bash
   npm test
   ```

## Review and qualification

Use the Node version pinned in CI and the committed lockfiles. Run the checks relevant to the change locally, then require the exact PR head to pass all six qualification workflows: CI, UI CI, Docs Integrity, Security Verification, Mainnet USDC Fork Qualification, and Release Preparation. Website changes also require GitHub Pages checks. Follow [Testing](docs/TESTING.md) for the full commands and scope.

For UI changes, run `npm --prefix ui run lint`, `npm --prefix ui run typecheck`, `npm --prefix ui test` and the affected browser checks. The Next.js dashboard (`ui/src`), standalone USDC transaction console (`ui/agijobmanager-usdc.html`), IPFS dashboard template (`ui/scripts/singlefile-template.html`) and bilingual website (`site`) are separate entry points. Test the surface being changed; a source inventory embedded in an HTML file is not a compiled React application. Regenerate and verify committed single-file artifacts with the UI build commands before submitting changes.

Keep production contracts, compiler settings and historical deployment receipts unchanged unless the task explicitly authorizes them. Public-chain transactions, ownership changes and intake activation require separate operator authority. Never replace missing original deployment-build evidence with a fresh build and claim it is original. Never upload private handoff packages, transcripts, keys or RPC credentials.

A PR should explain the failure or user problem, the resulting behavior, focused regression evidence and remaining limits. Request review independent of the implementation. CI proves the tested cases for its exact commit; it does not certify universal correctness or independent security audit. Do not merge temporary transport PRs or bypass release protections. Published tags and release assets are immutable evidence.

## Documentation changes
Documentation improvements are welcome. Please:
- Keep claims factual and verifiable.
- Avoid adding claims about deployments or audits without evidence.
- Update references in `docs/` when editing core docs.

## Security issues
Please do **not** report vulnerabilities in public issues. Follow the guidance in [`SECURITY.md`](SECURITY.md).
