# Start here — v1.19.6 maintenance candidate

Review the [exact repair scope](RELEASE_NOTES.md) and [validation boundary](VALIDATION.md). Install the committed root, Hardhat and UI lockfiles sequentially with Node 22.23.2, the qualification/deployment baseline. The creator entry point requires that exact version. General package engine ranges do not override it.

Run root build/lint/tests; Hardhat preflight/native compiler tests; root, Hardhat and UI low-threshold audits; and UI lint, typecheck, tests, browser/accessibility, deterministic build and artifact checks. Fresh final-source hosted workflows and independent review are mandatory before admission.

The retained [free transformation API](../../successor/TRANSFORMATIONAL_WORK.md), [operator guidance](../../RELEASE_GUIDE.md) and USDC recovery paths keep their authority boundaries. Installing this source does not alter a deployed manager or authorize a transaction.
