import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90000,
  expect: { timeout: 15000 },
  use: { baseURL: 'http://127.0.0.1:3010' },
  webServer: {
    command: 'NEXT_PUBLIC_DEMO_MODE=1 next dev -p 3010',
    port: 3010,
    timeout: 180000,
    reuseExistingServer: !process.env.CI
  }
});
