/**
 * @fileoverview Playwright Configuration for APEX Browser Automation
 *
 * This configuration provides global settings for Playwright browser automation
 * across all packages in the APEX monorepo. It supports:
 * - Multi-browser testing (Chromium, Firefox, WebKit)
 * - CI/CD integration
 * - Screenshot comparison
 * - Test artifact management
 * - Parallel execution with resource management
 */

import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Global Playwright configuration for APEX monorepo
 */
export default defineConfig({
  // Test directory patterns
  testDir: './tests',

  // Global test patterns
  testMatch: [
    '**/browser-integration/**/*.test.ts',
    '**/e2e/**/*.test.ts',
    '**/*.browser.test.ts',
    '**/*.e2e.test.ts'
  ],

  // Timeout configuration
  timeout: 60000, // 60 seconds for browser operations
  expect: {
    timeout: 30000, // 30 seconds for expect assertions
  },

  // Test execution configuration
  fullyParallel: false, // Sequential for better resource management
  forbidOnly: !!process.env.CI, // Fail on .only() in CI
  retries: process.env.CI ? 2 : 0, // Retry flaky tests in CI
  workers: process.env.CI ? 1 : 2, // Limit workers for resource management

  // Reporter configuration
  reporter: [
    ['list'], // Console output
    ['html', { outputFolder: 'test-artifacts/playwright-report' }], // HTML report
    ['junit', { outputFile: 'test-artifacts/junit.xml' }], // CI integration
    ['json', { outputFile: 'test-artifacts/test-results.json' }] // JSON results
  ],

  // Global test configuration
  use: {
    // Browser configuration
    headless: process.env.CI ? true : false, // Visible in local development
    viewport: { width: 1280, height: 720 }, // Standard viewport
    ignoreHTTPSErrors: true, // Handle self-signed certificates

    // Test artifacts
    screenshot: 'only-on-failure', // Screenshots on test failures
    video: 'retain-on-failure', // Videos on test failures
    trace: 'retain-on-failure', // Traces on test failures

    // Artifact output directory
    outputDir: 'test-artifacts/playwright-output',

    // Network configuration
    navigationTimeout: 30000, // Page navigation timeout
    actionTimeout: 10000, // Element action timeout
  },

  // Test output directories
  outputDir: './test-artifacts/playwright-test-results',

  // Browser projects configuration
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testDir: './tests/browser-integration',
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testDir: './tests/browser-integration',
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testDir: './tests/browser-integration',
    },

    // Mobile browsers for comprehensive testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testDir: './tests/browser-integration',
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      testDir: './tests/browser-integration',
    },

    // E2E testing project
    {
      name: 'e2e-chromium',
      use: { ...devices['Desktop Chrome'] },
      testDir: './tests/e2e',
    },
  ],

  // Web server configuration for testing
  webServer: {
    command: 'npm run serve:test', // Start test server
    url: 'http://127.0.0.1:3001',
    timeout: 120 * 1000, // 2 minutes to start
    reuseExistingServer: !process.env.CI, // Reuse in development
  },

  // Global setup and teardown
  globalSetup: require.resolve('./tests/browser-integration/setup.ts'),

  // Test environment metadata
  metadata: {
    version: process.env.npm_package_version || '0.4.0',
    environment: process.env.NODE_ENV || 'test',
    ci: !!process.env.CI,
  },
});