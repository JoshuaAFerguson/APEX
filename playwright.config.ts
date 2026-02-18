/**
 * @fileoverview Playwright Configuration for APEX Browser Automation
 *
 * This configuration provides comprehensive browser automation setup for APEX:
 * - Multi-browser support (Chromium, Firefox, WebKit)
 * - Optimized for CI/CD environments
 * - Integration with Vitest testing framework
 * - Screenshot and video capture configuration
 * - Timeout and retry configurations for reliable testing
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  // Test directory structure
  testDir: './tests/playwright',

  // Look for test files in these patterns
  testMatch: [
    '**/e2e/**/*.spec.ts',
    '**/e2e/**/*.test.ts',
    '**/playwright/**/*.spec.ts',
    '**/playwright/**/*.test.ts',
  ],

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI for stability
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    process.env.CI ? ['github'] : ['list'],
  ],

  // Shared settings for all projects
  use: {
    // Browser action settings
    actionTimeout: 30000,
    navigationTimeout: 30000,

    // Trace configuration for debugging
    trace: 'on-first-retry',

    // Screenshot configuration
    screenshot: 'only-on-failure',

    // Video configuration
    video: 'retain-on-failure',

    // Base URL for relative navigation
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },

  // Test output directories
  outputDir: 'test-results/',

  // Global setup and teardown
  globalSetup: require.resolve('./tests/playwright/global-setup.ts'),
  globalTeardown: require.resolve('./tests/playwright/global-teardown.ts'),

  // Projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Chromium-specific settings
        launchOptions: {
          args: process.env.CI
            ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            : [],
        },
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Firefox-specific settings
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true,
          },
        },
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        // WebKit-specific settings
      },
    },

    // Mobile browser testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Branded browsers
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  // Local development server configuration
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start dev server
  },

  // Expect configuration
  expect: {
    // Global expect timeout
    timeout: 10000,

    // Screenshot comparison settings
    toHaveScreenshot: {
      threshold: 0.3,
      mode: 'pixel',
    },

    // Visual comparison settings
    toMatchSnapshot: {
      threshold: 0.3,
    },
  },

  // Global timeout settings
  timeout: 60 * 1000, // 1 minute per test

  // Test metadata
  metadata: {
    project: 'APEX',
    environment: process.env.NODE_ENV || 'test',
    version: require('./package.json').version,
  },
});