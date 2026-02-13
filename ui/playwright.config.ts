import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:3010' },
  webServer: {
    command: 'NEXT_PUBLIC_DEMO_MODE=1 next build && NEXT_PUBLIC_DEMO_MODE=1 next start -p 3010',
    port: 3010,
    reuseExistingServer: false,
    timeout: 180_000
  }
});
