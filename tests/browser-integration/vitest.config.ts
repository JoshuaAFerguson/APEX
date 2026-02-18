/**
 * @fileoverview Vitest configuration for APEX browser automation integration tests
 *
 * This configuration is optimized for browser automation integration tests that involve:
 * - Browser instance management (Playwright/Puppeteer)
 * - Page navigation and interaction testing
 * - Screenshot comparison testing
 * - Browser console message validation
 * - Cross-browser compatibility testing
 *
 * Key features:
 * - Node environment for browser automation testing
 * - Extended timeout for browser operations
 * - Browser-specific setup/teardown hooks
 * - Test fixtures for common browser scenarios
 * - Support for both Playwright and Puppeteer backends
 */

import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,

    // Use Node environment for browser automation tests
    environment: 'node',

    // Include only browser integration tests
    include: ['**/*.test.ts', '**/*.browser.test.ts', '**/*.integration.test.ts'],

    // Exclude non-test files and documentation
    exclude: [
      'node_modules/**',
      '**/*.md',
      '**/*.js',
      '**/fixtures/**/*.ts',
    ],

    // Extended timeout for browser automation tests involving:
    // - Browser startup/shutdown
    // - Page navigation and loading
    // - Element interaction and waiting
    // - Screenshot capture and comparison
    testTimeout: 60000,

    // Hook timeout for browser setup/teardown operations
    hookTimeout: 30000,

    // Setup file for browser automation utilities and cleanup hooks
    setupFiles: ['./setup.ts'],

    // Run tests sequentially to avoid browser resource conflicts
    // Browser automation tests can be resource-intensive
    sequence: {
      shuffle: false,
    },

    // Pool configuration for browser tests
    pool: 'forks',
    poolOptions: {
      forks: {
        // Limit concurrent tests to prevent browser instance conflicts
        // Each test may create multiple browser contexts/pages
        maxForks: 2,
        minForks: 1,
      },
    },

    // Coverage configuration for browser automation tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: [
        'packages/orchestrator/src/tools/browser-tool.ts',
        'packages/orchestrator/src/browser-manager.ts',
        'packages/browser/src/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/fixtures/**',
      ],
    },

    // Reporter configuration with verbose output for debugging
    reporters: ['verbose'],

    // Fail fast on first error in CI environments
    bail: process.env.CI ? 1 : 0,

    // Retry configuration for flaky browser tests
    retry: process.env.CI ? 2 : 0,
  },

  // Path resolution for workspace packages and browser utilities
  resolve: {
    alias: {
      '@apexcli/core': path.resolve(__dirname, '../../packages/core/src'),
      '@apexcli/orchestrator': path.resolve(__dirname, '../../packages/orchestrator/src'),
      '@apexcli/browser': path.resolve(__dirname, '../../packages/browser/src'),
      // Alias for browser test fixtures and utilities
      '@test/browser-fixtures': path.resolve(__dirname, './fixtures'),
      '@test/browser-utils': path.resolve(__dirname, './utils'),
    },
  },

  // Environment variables for browser automation tests
  define: {
    'process.env.APEX_TEST_MODE': JSON.stringify('browser-integration'),
    'process.env.BROWSER_TEST_HEADLESS': JSON.stringify(process.env.CI ? 'true' : 'false'),
  },
});