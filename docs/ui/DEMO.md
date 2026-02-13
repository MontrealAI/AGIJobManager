# Demo Mode

Enable deterministic demo mode:

```bash
NEXT_PUBLIC_DEMO_MODE=1 npm run dev
```

Scenarios:

| key | purpose |
| --- | --- |
| baseline | all lifecycle states + malformed URI + huge value + deleted slot |
| paused-degraded | paused + settlementPaused + degraded RPC banners |
