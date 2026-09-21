# AGIJobManager v1.4.0 — start here

1. **Verify the download.** Compare `SHA256SUMS.txt`; the manifest binds the frozen source and every payload.
2. **Try the lifecycle example.** In `source`, run `npm run economics:lifecycle -- --example` using the supported Node.js version. The offline example needs no wallet or RPC; its assumptions are hypothetical.
3. **Prepare measured inputs.** Read `source/docs/OPERATIONS/QUALIFIED_ADMISSION.md`. It defines the lifecycle model, signed qualification envelope, operator policy, canonical observations and durable-reservation responsibilities. Use `npm run economics:admission -- --help`. A passing calculation or signature is not transaction authority.
4. **Use the console.** Open `agijobmanager-usdc.html`, read `source/docs/START_HERE.md`, and select a verified compatible manager. Never enter a seed phrase or private key. New operators should follow the launch checklist and Hardhat guide.
5. **Preserve settlement.** Closed jobs may retain unpaid claims. Install pinned dependencies with `npm ci` to use the canonical settlement/RPC adapters; follow `source/docs/OPERATIONS/SETTLEMENT_RECOVERY.md`. Intake rejection must not disable existing delivery or recovery.

Private cost/customer data, credentials and confidential material do not belong in public submissions or GitHub. Read the legal notices. This software publication supplies no live deployment or production signing authority.

Private Agent, Node and Fleet applications are excluded. The annotated tag points to qualified application source; this archive's top-level evidence and `release-tooling` describe the v1.4.0 publication. Read `RELEASE_NOTES.md` and `VALIDATION.md`.
