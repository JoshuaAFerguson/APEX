/**
 * @fileoverview Vitest configuration for APEX page navigation integration tests
 *
 * This configuration is optimized for page navigation integration tests that involve:
 * - Browser navigation flow testing (forward, back, refresh)
 * - URL routing and parameter validation
 * - Page load state management
 * - Navigation history management
 * - Cross-origin navigation testing
 * - Page performance measurement during navigation
 *
 * Key features:
 * - Node environment for browser automation testing
 * - Extended timeout for navigation operations
 * - Navigation-specific setup/teardown hooks
 * - Test fixtures for common navigation scenarios
 * - Mock server integration for controlled navigation
 */

import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,

    // Use Node environment for browser automation tests
    environment: 'node',

    // Include only page navigation integration tests
    include: ['**/*.test.ts', '**/*.navigation.test.ts', '**/*.integration.test.ts'],

    // Exclude non-test files and documentation
    exclude: [
      'node_modules/**',
      '**/*.md',
      '**/*.js',
      '**/fixtures/**/*.ts',
      '**/mock-server/**/*.ts',
    ],

    // Extended timeout for navigation tests involving:
    // - Page loading and navigation
    // - Network requests and redirects
    // - History state changes
    // - Performance measurement
    testTimeout: 60000,

    // Hook timeout for browser and server setup/teardown operations
    hookTimeout: 30000,

    // Setup file for navigation testing utilities and cleanup hooks
    setupFiles: ['./setup.ts'],

    // Run tests sequentially to avoid navigation conflicts
    // Navigation tests can interfere with each other
    sequence: {
      shuffle: false,
    },

    // Pool configuration for navigation tests
    pool: 'forks',
    poolOptions: {
      forks: {
        // Limit concurrent tests to prevent navigation conflicts
        // Each test may create browser instances and mock servers
        maxForks: 2,
        minForks: 1,
      },
    },

    // Coverage configuration for navigation testing
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: [
        'packages/orchestrator/src/tools/browser-tool.ts',
        'packages/orchestrator/src/browser-manager.ts',
        'packages/api/src/**/*.ts',
        '**/navigation-helpers.ts',
        '**/navigation-manager.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/fixtures/**',
        '**/mock-server/**',
      ],
    },

    // Reporter configuration with verbose output for debugging
    reporters: ['verbose'],

    // Fail fast on first error in CI environments
    bail: process.env.CI ? 1 : 0,

    // Retry configuration for flaky navigation tests
    retry: process.env.CI ? 2 : 0,
  },

  // Path resolution for workspace packages and navigation utilities
  resolve: {
    alias: {
      '@apexcli/core': path.resolve(__dirname, '../../packages/core/src'),
      '@apexcli/orchestrator': path.resolve(__dirname, '../../packages/orchestrator/src'),
      '@apexcli/api': path.resolve(__dirname, '../../packages/api/src'),
      // Alias for navigation test fixtures and utilities
      '@test/navigation-fixtures': path.resolve(__dirname, './fixtures'),
      '@test/navigation-utils': path.resolve(__dirname, './utils'),
      '@test/navigation-server': path.resolve(__dirname, './mock-server'),
    },
  },

  // Environment variables for navigation testing
  define: {
    'process.env.APEX_TEST_MODE': JSON.stringify('page-navigation-integration'),
    'process.env.BROWSER_TEST_HEADLESS': JSON.stringify(process.env.CI ? 'true' : 'false'),
    'process.env.NAVIGATION_TEST_PORT': JSON.stringify('0'), // Use random available port
  },
});