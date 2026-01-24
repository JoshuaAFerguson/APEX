/**
 * @fileoverview Vitest configuration for APEX end-to-end (E2E) tests
 *
 * This configuration is optimized for E2E tests that involve:
 * - Real git repository operations (clone, commit, merge, push)
 * - SQLite database lifecycle (creation, operations, cleanup)
 * - CLI command execution with real orchestrator instances
 * - Service management (daemon start/stop)
 * - Full workflow execution across multiple agents
 *
 * Key features:
 * - Node environment for backend/CLI testing
 * - Extended timeouts for real-world operations (60s test, 30s hooks)
 * - Global setup/teardown for resource management
 * - Forked process pool for test isolation
 * - Retry policy for CI environments (flaky real-world operations)
 * - Verbose reporter for debugging failures
 *
 * Usage:
 *   npm run test:e2e              # Run E2E tests once
 *   npm run test:e2e -- --watch   # Watch mode
 *
 * File naming conventions included:
 *   *.e2e.test.ts   - End-to-end tests
 *   tests/e2e/**    - Top-level E2E test directory
 */

import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,

    // Use Node environment for E2E tests (CLI, git, database operations)
    environment: 'node',

    // Include E2E tests from packages and top-level tests directory
    include: [
      'packages/*/src/**/*.e2e.test.ts',
      'tests/e2e/**/*.test.ts',
      'tests/e2e/**/*.e2e.test.ts',
    ],

    // Exclude non-test files
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/fixtures/**',
      '**/*.md',
    ],

    // Extended timeout for E2E tests involving:
    // - Git operations (clone, commit, push to real repos)
    // - Database operations (SQLite creation, migrations)
    // - CLI startup and orchestrator initialization
    // - Service management (daemon start/stop/restart)
    testTimeout: 60000,

    // Hook timeout for setup/teardown operations
    // - Creating temporary directories and git repos
    // - Database initialization and seeding
    // - Service startup and readiness checks
    hookTimeout: 30000,

    // Global setup file for E2E resource management
    setupFiles: ['./tests/e2e/setup.ts'],

    // Run tests sequentially to avoid resource conflicts
    // E2E tests often involve shared system resources (ports, git repos)
    sequence: {
      shuffle: false,
    },

    // Use forked process pool for E2E test isolation
    // Each E2E test may create system resources that could conflict
    pool: 'forks',
    poolOptions: {
      forks: {
        // Limit concurrency to prevent resource exhaustion
        // Each test creates temp directories, git repos, databases
        maxForks: 4,
        minForks: 1,
      },
    },

    // Verbose reporter for debugging E2E failures
    reporters: ['verbose'],

    // Retry configuration for flaky E2E tests in CI
    // Real-world operations (git, network, file I/O) can be non-deterministic
    retry: process.env.CI ? 2 : 0,

    // Fail fast on first error in CI environments
    bail: process.env.CI ? 1 : 0,
  },

  // Path resolution for workspace packages
  resolve: {
    alias: {
      '@apex/core': path.resolve(__dirname, 'packages/core/src'),
      '@apex/orchestrator': path.resolve(__dirname, 'packages/orchestrator/src'),
      '@apex/cli': path.resolve(__dirname, 'packages/cli/src'),
      '@apex/api': path.resolve(__dirname, 'packages/api/src'),
      '@test/e2e-fixtures': path.resolve(__dirname, 'tests/e2e/fixtures'),
    },
  },

  // Environment variables for E2E tests
  define: {
    'process.env.APEX_TEST_MODE': JSON.stringify('e2e'),
  },
});
