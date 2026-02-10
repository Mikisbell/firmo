import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true, // Enable parallel execution
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1, // 1 worker for stability (multi-tenant tests need sequential execution)
  timeout: 600000, // 10 minutes per test (increased for multi-tenant tests)
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry', // Captura traces solo en fallos
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000, // 15 seconds for individual actions
    navigationTimeout: 30000, // 30 seconds for page navigation
  },
  projects: [
    // Chromium tests with authentication
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Note: Storage state is NOT used here because tests need to switch between tenants
        // Each test handles its own authentication using the helpers
      },
    },
    
    // Mobile tests commented out temporarily to reduce execution time
    // Re-enable for full test coverage or CI runs
    // {
    //   name: 'mobile',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
