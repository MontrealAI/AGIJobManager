import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:3110' },
  webServer: { command: 'NEXT_PUBLIC_DEMO_MODE=1 next dev -p 3110', port: 3110, reuseExistingServer: true },
  projects: [
    { name: 'e2e', testMatch: /smoke.spec.ts/ },
    { name: 'a11y', testMatch: /a11y.spec.ts/ },
    { name: 'headers', testMatch: /headers.spec.ts/ }
  ]
});
