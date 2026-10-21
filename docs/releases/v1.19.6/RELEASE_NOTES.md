# AGIJobManager v1.19.6 maintenance candidate

This candidate patches the audited follow-redirects resolution to 1.16.1 in root and UI, UI Hono to 4.13.11 within its existing parent range, the exact UI Vite pin to 7.3.7, and UI Vitest with its required internal packages to 4.1.12. It adds a separate finite maintenance source policy, synchronized software labels and regenerated dashboard source inventories. No Solidity, compiler settings, transaction defaults, deployed contract, owner, ENS, settlement or intake changes are included.

The Vitest patch addresses upstream advisories [GHSA-qxg6-89mg-rqv8](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8) and [GHSA-xp26-3454-mjgp](https://github.com/vitest-dev/vitest/security/advisories/GHSA-xp26-3454-mjgp), reported by a later audit database snapshot after the first maintenance source candidate. Earlier audit observations remain dated evidence. The patch retains the previously locked Chai and tinyrainbow versions within their unchanged supported ranges.

The previous v1.19.5 release policies, manifests, tests and historical evidence remain immutable. The native transformation inspector and Builder retain their original code/source bindings. This is not the Discovery Lab feature release.

The [validation boundary](VALIDATION.md) requires fresh final-source hosted checks, source-bound native TI verification, clean reproducible archives, retained failure evidence and independent review. Zero npm audit findings establish only the supplied audit database result. A checksum or source profile does not establish security review, release qualification or publication. Existing PR #1607 and earlier release holds remain separate.

No release publication, wallet action, public-chain transaction, paid work, hardware commissioning, production activation or independent security audit is claimed. Published release metadata and external QUALIFICATION.json must be checked separately. Start with the [maintenance guide](START_HERE.md) and [recovery guide](RECOVERY_GUIDE.md).
