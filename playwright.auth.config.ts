import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e-auth',
  timeout: 30000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4293', channel: 'chrome', trace: 'off' },
  webServer: {
    command: 'node node_modules/@angular/cli/bin/ng.js serve --host 127.0.0.1 --port 4293',
    url: 'http://127.0.0.1:4293',
    reuseExistingServer: true,
    timeout: 180000,
  },
});
