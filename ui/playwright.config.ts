import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:3010' },
  projects: [
    { name: 'e2e', testMatch: /smoke\.spec\.ts/ },
    { name: 'a11y', testMatch: /a11y\.spec\.ts/ },
    { name: 'headers', testMatch: /headers\.spec\.ts/ }
  ],
  webServer: {
    command: 'NEXT_PUBLIC_DEMO_MODE=1 next dev -p 3010',
    port: 3010,
    reuseExistingServer: !process.env.CI
  }
});
