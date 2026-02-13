# Demo Mode

Enable deterministic mode with fixtures:

```bash
NEXT_PUBLIC_DEMO_MODE=1 NEXT_PUBLIC_DEMO_ACTOR=visitor npm run dev
```

## Fixture catalog
| Scenario | State coverage | Expected behavior |
|---|---|---|
| `baseline` | open, assigned, completion requested, disputed, settled, expired, malformed URI | Full role/action timeline demos |
| `degraded-paused` | degraded RPC + pause banners + missing job slot | Banner and resilience validation |

## Demo actor switching
Use `?actor=visitor|employer|agent|validator|moderator|owner` to deterministically show role-gated UI.

## Adding fixtures
1. Extend `ui/src/demo/fixtures/scenarios.ts`.
2. Add matching e2e assertion in `ui/e2e/demo.spec.ts`.
3. Run `npm run test:e2e`.
