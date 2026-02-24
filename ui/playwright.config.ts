import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: 1,
  use: { baseURL: 'http://127.0.0.1:3010' },
  webServer: {
    command: 'NEXT_PUBLIC_DEMO_MODE=1 next dev -H 127.0.0.1 -p 3010',
    url: 'http://127.0.0.1:3010',
    timeout: 180_000,
    reuseExistingServer: false
  }
});
