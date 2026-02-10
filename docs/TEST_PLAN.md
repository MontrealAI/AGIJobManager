# Test Plan (Mainnet-Grade Deterministic Expansion)

## Deterministic execution model

- Local-only execution on Truffle `test` network (in-memory Ganache).
- No live RPC/ENS dependencies; ENS behaviors are validated with mocks.
- Time-sensitive branches use deterministic `time.increase(...)` calls from OpenZeppelin test helpers.

## New suites in this update

| Suite | Primary risks covered | Deterministic mechanism |
| --- | --- | --- |
| `test/jobLifecycle.core.test.js` | create/apply/completion/finalize/expire branch correctness, under-quorum and no-vote behavior | Fixed actors + fixed windows + explicit time jumps |
| `test/validatorVoting.bonds.test.js` | double-vote prevention, dispute escalation, validator bond settlement behavior | Single known scenario with fixed voter set |
| `test/disputes.moderator.test.js` | dispute bond sizing path, `NO_ACTION`, moderator-only resolution, stale dispute owner recovery | Controlled dispute timeline and explicit window advancement |
| `test/escrowAccounting.invariants.test.js` | bounded multi-job invariants for `locked*` totals and `withdrawableAGI` solvency equation | 6-iteration fixed pseudo-fuzz loop with deterministic pattern |
| `test/pausing.accessControl.test.js` | `whenNotPaused` and settlement pause gating | Pause toggles in fixed order |
| `test/agiTypes.safety.test.js` | AGIType ERC721/165 validation, broken-token isolation, disabled type behavior | Mock contracts with fixed responses |
| `test/ensHooks.integration.test.js` | ENS hooks are best-effort and lock flow remains non-bricking | Local mock ENS registry/wrapper/resolver |
| `test/identityConfig.locking.test.js` | identity updates blocked with active locks and permanently frozen after lock | single escrow lifecycle to terminal zero-lock state |

## Mapping to production risks

1. **Escrow solvency / treasury safety**: bounded invariant loop asserts `balance >= lockedEscrow + lockedAgentBonds + lockedValidatorBonds + lockedDisputeBonds`, and `withdrawableAGI == balance - lockedTotal` after each terminal state.
2. **Settlement liveness and fairness**: explicit checks for no-vote slow path, tie → dispute, and challenge-window gating.
3. **Role concentration / operator trust model**: moderator-only and owner stale-dispute powers are verified and documented as intentional privileged controls.
4. **Identity and namespace resiliency**: AGIType misbehavior and ENS failures are isolated from core settlement outcomes.

## Regression policy

When changing settlement, bonds, pauses, AGIType checks, or ENS hooks:

- Update the corresponding new suite(s) above.
- Re-run `npm run build`, `npm run size`, `npm run lint`, `npm test`.
- Confirm bytecode size guard remains below EIP-170 threshold.


## Validation snapshot (local)

Commands executed for deterministic CI-parity validation:

```bash
npm install
npm run lint
npm run build
npm run size
npm test
```

Observed results:
- Compile succeeded with pinned `solc 0.8.23`.
- Bytecode guard reported `AGIJobManager runtime bytecode size: 24574 bytes` (below EIP-170 cap).
- Full deterministic test suite passed (`260 passing`).
