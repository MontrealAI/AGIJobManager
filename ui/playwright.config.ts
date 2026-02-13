import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:3010' },
  webServer: { command: 'NEXT_PUBLIC_DEMO_MODE=1 npm run dev -- -p 3010', port: 3010, reuseExistingServer: true },
  projects: [
    { name: 'e2e', testMatch: /smoke\.spec\.ts/ },
    { name: 'a11y', testMatch: /a11y\.spec\.ts/ },
    { name: 'headers', testMatch: /headers\.spec\.ts/ }
  ]
});
