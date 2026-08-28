import { defineConfig, devices } from '@playwright/test';

// Tests run against the BUILT site (`vite preview` over dist/), not the dev server:
// that is what gets deployed, and what the docs link to.
export default defineConfig({
  testDir: './e2e',
  timeout: 20_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
