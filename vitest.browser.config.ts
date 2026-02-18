/**
 * @fileoverview Vitest Browser Configuration with Playwright Integration
 *
 * This configuration enables browser-based testing in Vitest using Playwright as the browser provider.
 * It provides:
 * - Cross-browser testing (Chromium, Firefox, WebKit)
 * - Real browser environment for accurate testing
 * - Integration with existing Vitest test infrastructure
 * - Screenshot and video capture capabilities
 */

import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    // Enable browser mode with Playwright provider
    browser: {
      enabled: true,
      name: 'chromium', // Default browser
      provider: 'playwright',
      headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',

      // Browser launch options
      providerOptions: {
        launch: {
          args: process.env.CI
            ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            : [],
        },
      },

      // Screenshot configuration
      screenshot: 'only-on-failure',

      // Test setup and teardown
      setupFiles: ['./tests/browser/setup.ts'],
    },

    // Test environment settings
    globals: true,
    environment: 'node', // Base environment for test runner

    // Test file patterns
    include: [
      'tests/browser/**/*.test.ts',
      'tests/browser/**/*.spec.ts',
      'tests/e2e/**/*.test.ts',
      'tests/e2e/**/*.spec.ts',
    ],

    // Exclude patterns
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
    ],

    // Timeout settings for browser tests
    testTimeout: 60000, // 1 minute per test
    hookTimeout: 30000, // 30 seconds for setup/teardown

    // Retry configuration for flaky browser tests
    retry: process.env.CI ? 2 : 0,

    // Coverage configuration for browser code
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'packages/*/src/**/*.ts',
        'packages/*/src/**/*.tsx',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
      ],
    },

    // Reporter configuration
    reporters: process.env.CI
      ? ['verbose', 'json']
      : ['verbose'],

    // Output directory for test results
    outputFile: {
      json: './test-results/browser-test-results.json',
    },
  },

  // Path resolution for workspace packages
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@apex/core': path.resolve(__dirname, './packages/core/src'),
      '@apex/orchestrator': path.resolve(__dirname, './packages/orchestrator/src'),
      '@apex/cli': path.resolve(__dirname, './packages/cli/src'),
      '@apex/api': path.resolve(__dirname, './packages/api/src'),
      '@test/utils': path.resolve(__dirname, './tests/test-utils/src'),
    },
  },

  // Environment variables for browser tests
  define: {
    'process.env.APEX_TEST_MODE': JSON.stringify('browser'),
    'process.env.BROWSER_TEST_HEADLESS': JSON.stringify(process.env.CI ? 'true' : 'false'),
  },
});