import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:3010' },
  webServer: {
    command: 'NEXT_PUBLIC_DEMO_MODE=1 next dev -p 3010',
    port: 3010,
    reuseExistingServer: !process.env.CI
  }
});
