# v1.1.0 — Safer deployment and clearer operator guidance

v1.1.0 packages the deployment improvements previously merged on main, with matching guides, versions and generated artifacts.

## What changes

- Manager and optional ENS helper deployment commands default to **read-only when `DRY_RUN` is missing or empty**. Broadcasting requires an explicit false value, documented as `DRY_RUN=0`, together with the existing signer, verification and mainnet confirmation gates. Invalid boolean values are rejected before transactions.
- The offline configuration check reports the selected mode. The Hardhat guide provides a five-step overview, non-overwriting setup, profile validation, planning, deployment and ownership/readiness instructions.
- Operator guides consistently describe the disabled NFT default and owner opt-in, all five initial reserve counters, dedicated fresh-deployment ENS names, same-manager replacement rules and the distinction between initial activation and later recipient/collection changes.
- Package versions, download links, the deployment registry, generated references, standalone distributions and source-bound fork evidence are refreshed for v1.1.0.
- A stale console explanation referring to a v0.8.0 notice is corrected. The **v1.0.5 protocol and privacy notices remain included unchanged**; their notice version is deliberately distinct from the v1.1.0 software version.

## Compatibility and privacy

Every Solidity source file, ABI, creation/runtime bytecode, fixed library link, storage layout, owner power and payout rule is preserved from v1.0.5. The manager runtime remains 24,359 bytes. Dependency resolutions and MIT licensing are unchanged. **Fresh intake starts paused; NFT admission starts disabled.**

Verified compatible v0.9.6/v0.9.7, v1.0.x and v1.1.0 USDC managers use the same required interface. Existing jobs, settings, agreements and ENS namespaces remain on their original deployment. The console does not upgrade a contract or migrate escrow.

The public-content rules, explicit draft saving, credential-safe uploads, fresh acknowledgements, independent-operator boundaries and user responsibility clauses from v1.0.5 are retained. Users must keep private information and secrets out of public submissions. Actual operators still need accurate notices, valid adoption of any service terms and compliance with duties arising from their activities; notices and checkboxes do not transfer mandatory statutory duties.

## Start safely

Download the complete ZIP or standalone console and verify `SHA256SUMS.txt`. Follow `START_HERE.md` in the archive and the matching Hardhat guide. Review existing private configuration: setup preserves it, and a saved `DRY_RUN=0` still explicitly requests broadcasting. Use `DRY_RUN=1` for every plan, including on older releases.

`VALIDATION.md` and `SOURCE_CI.json` identify the five exact-source qualification workflows and every required job. Publication checks their successful completion and actual checkout logs, builds the assets twice, pins an annotated tag, and verifies uploaded sizes and SHA-256 digests before publishing. Earlier tags, downloads and historical deployment records are preserved.

This is a software publication with internal automated qualification, not an independent audit, legal clearance or approval of a live deployment. It performs no public-chain transaction.
