# Demo Mode

```bash
cd ui
NEXT_PUBLIC_DEMO_MODE=1 npm run dev
```

Scenarios include open, assigned, completion-requested, disputed, settled, expired, malformed URIs, and paused banners.

Update fixtures in `ui/src/demo/fixtures/jobs.ts`, then regenerate screenshots:

```bash
npm run docs:screenshots
```
