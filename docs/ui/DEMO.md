# Demo Mode

Run deterministic UI demonstrations:

```bash
cd ui
cp .env.example .env.local
NEXT_PUBLIC_DEMO_MODE=1 npm run dev
```

Fixtures cover open/assigned/completion-requested/disputed/settled/expired and malformed URI edge cases.

Generate screenshots:

```bash
cd ui
NEXT_PUBLIC_DEMO_MODE=1 npm run docs:screenshots
```
