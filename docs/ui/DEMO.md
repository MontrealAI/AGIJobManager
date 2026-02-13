# Demo Mode

Demo mode provides deterministic, chain-free validation.

## Enable
```bash
NEXT_PUBLIC_DEMO_MODE=1 NEXT_PUBLIC_DEMO_ACTOR=visitor npm run dev
```

## Fixture catalog
| Scenario | Coverage |
|---|---|
| baseline | open, assigned, completion requested, disputed, settled, expired, malformed URIs |
| degraded-paused | paused + settlementPaused + degraded RPC banner |

## Actor switching
`NEXT_PUBLIC_DEMO_ACTOR=visitor|employer|agent|validator|moderator|owner` enables role-gating demos with no wallet.

## Add a fixture
1. Extend `ui/src/demo/fixtures/scenarios.ts` with deterministic values.
2. Include edge URIs and boundary timestamps.
3. Add assertions in `ui/e2e/demo.spec.ts`.
