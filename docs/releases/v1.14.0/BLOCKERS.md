# v1.14.0 release blockers — 2026-10-10

**Do not merge, tag or publish while required qualification is red.** The mainnet deployment and intake remain outside this software task.

The clean implementation is PR [#1561](https://github.com/MontrealAI/AGIJobManager/pull/1561). Source recovery, the two functional fixes, documentation, protected-source checks, independent AI review, native/fork tests and reproducible candidate packaging are complete. Exact final-source qualification is still required.

## Dependency freeze conflicts with current audit gates

The supplied `SENIOR_DEV_TEAM_PROMPT.md` requires preserved dependency identities/resolutions and explicitly says its pinned tool versions are compatibility constraints, not upgrade recommendations. The implementation honors that boundary. Current audit data now blocks the inherited pinned dependencies:

| Workspace | Audit result | Failed GitHub step |
| --- | --- | --- |
| Root | 2 findings: 1 high, 1 low | Security Verification → Check all root dependencies |
| Hardhat | 0 findings | Local audit passed; later security steps were skipped after root audit failure |
| UI | 12 findings: 9 high, 3 moderate, including transitive effects | UI CI → Run npm audit --audit-level=low |

Evidence: [security workflow run](https://github.com/MontrealAI/AGIJobManager/actions/runs/38056755711), [UI workflow run](https://github.com/MontrealAI/AGIJobManager/actions/runs/38056755707), and the three unchanged-output audit JSON reports in `security-audit/`. These are audit findings, not fourteen distinct independently exploitable vulnerabilities. The failed static-analysis upload is secondary: the audit gate stopped execution before those files were generated.

| Root cause | Recorded installed version / affected path | Concrete remediation scope to authorize |
| --- | --- | --- |
| http-cache-semantics | 4.2.0 via Solhint/update-check dependencies | Review and test the available 4.3.0 resolution; preserve Solhint/compiler identities if compatible |
| serialize-javascript | 7.1.1 via root Mocha | Review and test 7.1.2 resolution |
| Next.js cache poisoning advisories | 15.5.24 | Review the patched 15.5.27 line and matching UI integration; no contract change |
| braces recursive stack exhaustion | 3.0.3 through micromatch, chokidar, fast-glob, Tailwind and Next ESLint plugin | Remove/replace the affected dependency path or use a separately reviewed upstream repair; 3.0.3 remains the latest registry version observed. Do not merely suppress the advisory |
| postcss-selector-parser CPU exhaustion | Affected UI/Tailwind/PostCSS dependency path below 7.1.6 | Review compatible resolution/removal at 7.1.6 or later |
| sharp/librsvg vulnerability | Affected UI dependency below 0.35.5 | Review compatible resolution at 0.35.5 or later |
| source-map-js denial of service | 1.2.1 | Review 1.2.2 or later resolution |

The automatic `npm audit fix --force` suggestion includes a breaking Tailwind 4 upgrade. It has **not** been applied. The requested next decision is a narrowly scoped exception to the dependency freeze for these security remediations, including necessary UI/tooling compatibility work, followed by full requalification. Production Solidity, compiler settings, linked libraries, contract ABI/economics and the existing deployment must remain unchanged. The alternative is to keep this release blocked; audit thresholds and required workflows must not be weakened.

Primary advisory references: [http-cache-semantics](https://github.com/advisories/GHSA-ch52-4w7c-c8xp), [serialize-javascript](https://github.com/advisories/GHSA-gfhx-hw2g-v5hg), [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [Next.js](https://github.com/advisories/GHSA-4jqv-mc3x-m676), [Next.js second advisory](https://github.com/advisories/GHSA-mcj8-r9mp-w47p), [PostCSS](https://github.com/advisories/GHSA-rj75-hqrm-r3gf), [sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). Advisory metadata and registry releases can change; re-audit the actual candidate.

## Evidence that remains separate

Original operator deployment Standard JSON/full build-info/artifacts and original NFT policy bytes were not supplied. No fresh replay of those exact originals or fresh mainnet readiness query is claimed. Native runtime reconstruction and historical operator readiness are documented separately. No mnemonic, private key, approval or redeployment is needed to resolve this software release blocker.
