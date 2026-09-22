# AGIJobManager v1.11.0 — Operating qualification and workforce capacity

This release applies lessons from the 10,000-job synthetic workforce experiment to admission, planning and private runtime checks.

- **Separate role economics.** Signed workforce policy v2 requires Agent and Node cash floors and loss limits; aggregate profit cannot hide a losing reviewer role.
- **Held-out job-class validation.** Each declared cohort needs useful Agent outcomes and correct Node decisions, including deliberately invalid deliveries. Failures and abstentions stay in the denominator, and every allowed specification needs held-out evidence for both roles.
- **Supervision per useful completion.** Recorded Agent and Node human time is divided by useful Agent outcomes; unproductive work cannot make this measure appear better.
- **Capacity before work.** A read-only planner identifies reviewer shortages, active-slot limits, human queues, shared failure domains and whole-workflow deadlines. It grants no authority and changes no deployed settings.
- **Private project deadlines.** Fleet 1.9.0, Agent 1.15.0 and Node 2.16.0 reserve time for dependent independent review before new reservations or grants, including after restart. Native production requires a freshly signed v2 operating policy. Standalone Node packaging includes its native runtime and verifies the archive contents.
- **Reproducible experiment.** The public source includes the 10,000-offer model, reference scenarios and regression tests, explicitly marked synthetic. Its hypothetical bridge/moderation scenarios remain unimplemented.
- **Current instructions.** Main README, setup guides, commands, versions and private offline guides explain these changes and migration requirements.

No new retainers. All Solidity, payout rules and dependency resolutions are unchanged. Existing claims, journals and recovery policies must be preserved. Source fingerprint updates bind the current package metadata to the repeated fork and static-analysis checks.

Passing tests does not establish real M1/M2 performance, valuable live work, independent validation, low human involvement or profitability. Actual-machine commissioning, independent external security assurance, native/private on-chain handoff and general automated moderation remain outstanding. See VALIDATION.md and SOURCE_CI.json for the executed qualification scope.
