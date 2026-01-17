/**
 * @fileoverview Vitest configuration for APEX integration tests
 *
 * This configuration is optimized for integration tests that involve:
 * - Temporary directory management for isolated test environments
 * - SQLite database lifecycle (creation, operations, cleanup)
 * - Confirmation flow testing (permissions, approvals, dangerous operations)
 * - Cross-package integration with @apexcli/core, @apexcli/orchestrator, @apexcli/api, @apexcli/cli
 *
 * Key features:
 * - Node environment for backend testing
 * - Extended timeout for async operations involving database and orchestrator
 * - Global setup/teardown for temporary directory and database cleanup
 * - Test globals for confirmation flow fixtures
 */

import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,

    // Use Node environment for backend integration tests
    environment: 'node',

    // Include only integration tests in this directory
    include: ['**/*.test.ts', '**/*.integration.test.ts'],

    // Exclude non-test files and documentation
    exclude: [
      'node_modules/**',
      '**/*.md',
      '**/*.js',
      '**/fixtures/**',
    ],

    // Extended timeout for integration tests involving:
    // - Database operations
    // - Orchestrator initialization
    // - API server startup/shutdown
    // - Approval workflow simulations
    testTimeout: 30000,

    // Hook timeout for setup/teardown operations
    hookTimeout: 15000,

    // Setup file for global test utilities and cleanup hooks
    setupFiles: ['./setup.ts'],

    // Run tests sequentially to avoid database conflicts
    // Integration tests often share state through temp directories
    sequence: {
      shuffle: false,
    },

    // Pool configuration for integration tests
    pool: 'forks',
    poolOptions: {
      forks: {
        // Limit concurrent tests to prevent resource exhaustion
        // Each integration test creates its own temp directory and database
        maxForks: 4,
        minForks: 1,
      },
    },

    // Coverage configuration for integration tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: [
        'packages/*/src/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/node_modules/**',
      ],
    },

    // Reporter configuration
    reporters: ['default'],

    // Fail fast on first error in CI environments
    bail: process.env.CI ? 1 : 0,
  },

  // Path resolution for workspace packages
  resolve: {
    alias: {
      '@apexcli/core': path.resolve(__dirname, '../../packages/core/src'),
      '@apexcli/orchestrator': path.resolve(__dirname, '../../packages/orchestrator/src'),
      '@apexcli/cli': path.resolve(__dirname, '../../packages/cli/src'),
      '@apexcli/api': path.resolve(__dirname, '../../packages/api/src'),
      // Alias for test fixtures
      '@test/fixtures': path.resolve(__dirname, '../fixtures'),
    },
  },

  // Environment variables for integration tests
  define: {
    'process.env.APEX_TEST_MODE': JSON.stringify('integration'),
  },
});
