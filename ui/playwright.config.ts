import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:3010' },
  webServer: { command: 'next dev -p 3010', port: 3010 }
});
