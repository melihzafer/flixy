import fs from 'node:fs';

import { defineConfig } from '@playwright/test';

const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: '.',
  testMatch: 'design-ux.spec.ts',
  timeout: 300_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['line'], ['json', { outputFile: 'test-results/design-ux.json' }]],
  webServer: {
    command: 'pnpm --filter @flixy/web exec sirv ../mobile/dist --single --dotfiles --port 8090',
    url: 'http://localhost:8090',
    timeout: 300_000,
    reuseExistingServer: false,
  },
  use: {
    baseURL: 'http://localhost:8090',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions:
      chromiumPath && fs.existsSync(chromiumPath) ? { executablePath: chromiumPath } : undefined,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
