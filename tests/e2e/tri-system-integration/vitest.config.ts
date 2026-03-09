/**
 * @fileoverview Vitest configuration for tri-system E2E tests
 *
 * This configuration is optimized for E2E tests involving:
 * - Tool System (Read, Write, Edit, Bash, Grep, Glob, WebFetch, WebSearch, Browser)
 * - Permission System (access control and authorization)
 * - Browser Automation (web operations)
 *
 * Key features:
 * - Node environment for backend testing with browser mocking
 * - Extended timeout for complex multi-system operations
 * - Event correlation and system state verification
 * - Cross-system integration testing
 */

import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,

    // Use Node environment for tri-system integration tests
    environment: 'node',

    // Include E2E test files in this directory
    include: ['**/*.e2e.test.ts', '**/*.test.ts'],

    // Exclude non-test files
    exclude: [
      'node_modules/**',
      '**/*.md',
      '**/*.js',
      '**/fixtures/**',
    ],

    // Extended timeout for E2E tests involving:
    // - Multi-system orchestration
    // - Event propagation verification
    // - Permission flow testing
    // - Browser automation mocking
    testTimeout: 45000,

    // Hook timeout for setup/teardown operations
    hookTimeout: 20000,

    // Run tests sequentially to avoid event interference
    sequence: {
      shuffle: false,
    },

    // Pool configuration for E2E tests
    pool: 'forks',
    // Limit concurrent tests to prevent event system conflicts
    maxForks: 2,
    minForks: 1,

    // Coverage configuration for tri-system integration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: [
        'packages/*/src/**/*.ts',
        'tests/e2e/tri-system-integration/test-utils.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.e2e.test.ts',
        '**/*.d.ts',
        '**/node_modules/**',
      ],
      // Lower thresholds for E2E tests as they focus on integration
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 30,
        statements: 40,
      },
    },

    // Reporter configuration
    reporters: ['default', 'verbose'],

    // Fail fast on first error in CI environments
    bail: process.env.CI ? 1 : 0,
  },

  // Path resolution for workspace packages
  resolve: {
    alias: {
      '@apexcli/core': path.resolve(__dirname, '../../../packages/core/src'),
      '@apexcli/orchestrator': path.resolve(__dirname, '../../../packages/orchestrator/src'),
      '@apexcli/cli': path.resolve(__dirname, '../../../packages/cli/src'),
      '@apexcli/api': path.resolve(__dirname, '../../../packages/api/src'),
      // Alias for test utilities
      '@test/utils': path.resolve(__dirname, './test-utils'),
    },
  },

  // Environment variables for E2E tests
  define: {
    'process.env.APEX_TEST_MODE': JSON.stringify('e2e'),
    'process.env.APEX_TRI_SYSTEM_TEST': JSON.stringify('true'),
  },
});