import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:3010', screenshot: 'off', video: 'off', trace: 'off' },
  webServer: { command: 'NEXT_PUBLIC_DEMO_MODE=1 next start -p 3010', port: 3010, timeout: 120000, reuseExistingServer: false }
});
