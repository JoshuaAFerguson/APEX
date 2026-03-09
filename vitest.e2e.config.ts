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

import { defineConfig, mergeConfig } from 'vitest/config';
import { createE2ETestConfig } from './vitest.shared.config';
import * as path from 'path';

export default mergeConfig(
  createE2ETestConfig(),
  defineConfig({
    test: {
      // Include ALL E2E tests across the entire monorepo
      // Comprehensive patterns to capture all E2E test variations
      include: [
        // Standard E2E test patterns
        'packages/*/src/**/*.e2e.test.ts',
        'tests/e2e/**/*.test.ts',
        'tests/e2e/**/*.e2e.test.ts',

        // Additional E2E test patterns found in the codebase
        '**/*e2e*.test.ts',                    // Files like thoughts-e2e.test.ts, container-resource-limits-e2e.test.ts
        '**/e2e-*.test.ts',                    // Files like e2e-infrastructure-validation.test.ts
        'tests/integration/**/*e2e*.test.ts',  // Integration directory E2E tests
        'tests/test-utils/**/*e2e*.test.ts',   // Test utilities E2E tests

        // Marketplace-specific E2E tests
        'tests/e2e/**/mcp-*.test.ts',
        'tests/e2e/**/marketplace*.test.ts',

        // Browser automation E2E tests
        'packages/browser/src/**/*e2e*.test.ts',
        'packages/orchestrator/src/**/*e2e*.test.ts',

        // Workflow and integration E2E tests
        'packages/orchestrator/src/__tests__/**/*e2e*.test.ts',
        'packages/core/src/__tests__/**/*e2e*.test.ts',
        'packages/cli/src/__tests__/**/*e2e*.test.ts',
      ],

      // Exclude non-test files and common build artifacts
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/*.d.ts',
        '**/*.md',

        // Exclude specific non-E2E test types to keep focus on E2E
        '**/*.unit.test.ts',
        '**/*.spec.ts',

        // Exclude test utilities and fixtures that aren't actual tests
        'tests/*/helpers/**',
        'tests/*/mocks/**',
        'tests/*/fixtures/**/*.ts',
        'tests/*/utils/**/*.ts',
      ],

      // Global setup file for E2E resource management
      setupFiles: ['./tests/e2e/setup.ts'],

      // Global teardown file for final resource cleanup
      globalTeardown: './tests/e2e/teardown.ts',

      // Run tests sequentially to avoid resource conflicts
      // E2E tests often involve shared system resources (ports, git repos)
      sequence: {
        shuffle: false,
      },

      // Use forked process pool for E2E test isolation
      // Each E2E test may create system resources that could conflict
      pool: 'forks',
      // Limit concurrency to prevent resource exhaustion
      // Each test creates temp directories, git repos, databases
      maxForks: 4,
      minForks: 1,

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
        '@apexcli/core': path.resolve(__dirname, 'packages/core/src'),
        '@apexcli/orchestrator': path.resolve(__dirname, 'packages/orchestrator/src'),
        '@apexcli/cli': path.resolve(__dirname, 'packages/cli/src'),
        '@apexcli/api': path.resolve(__dirname, 'packages/api/src'),
        '@test/e2e-fixtures': path.resolve(__dirname, 'tests/e2e/fixtures'),
      },
    },

    // Environment variables for E2E tests
    define: {
      'process.env.APEX_TEST_MODE': JSON.stringify('e2e'),
    },
  })
);
