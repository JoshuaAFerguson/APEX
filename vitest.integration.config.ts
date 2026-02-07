/**
 * @fileoverview Vitest configuration specifically for integration tests
 *
 * This configuration is optimized for integration tests that verify:
 * - Cross-package integration (core, orchestrator, cli, api)
 * - Database operations and lifecycle management
 * - API server startup/shutdown workflows
 * - File system operations with temp directories
 * - Agent workflow orchestration
 * - Permission system integration
 *
 * Key features:
 * - Node environment for backend testing
 * - Extended timeouts for async operations
 * - Isolated test runs with proper cleanup
 * - Coverage reporting for integration scenarios
 */

import { defineConfig, mergeConfig } from 'vitest/config';
import { createIntegrationTestConfig } from './vitest.shared.config.js';
import * as path from 'path';

export default mergeConfig(
  createIntegrationTestConfig({
    // Extended timeouts for complex integration scenarios
    testTimeout: 30000,
    hookTimeout: 20000,
    // Higher coverage thresholds for integration tests
    coverageThresholds: {
      lines: 60,
      functions: 60,
      branches: 50,
      statements: 60,
    },
  }),
  defineConfig({
    test: {
      // Enable global test APIs for integration tests
      globals: true,

      // Use Node environment for backend integration testing
      environment: 'node',

      // Include integration test patterns across the codebase
      include: [
        // Core integration tests
        'tests/integration/**/*.test.ts',
        'tests/integration/**/*.integration.test.ts',

        // Package-level integration tests
        'packages/*/src/**/*.integration.test.ts',

        // Cross-package integration scenarios
        'tests/cross-package/**/*.test.ts',
      ],

      // Exclude non-integration test files
      exclude: [
        'node_modules/**',
        '**/dist/**',
        '**/*.unit.test.ts',
        '**/*.e2e.test.ts',
        '**/*.spec.ts',
        '**/fixtures/**',
        '**/*.md',
        '**/*.js',
      ],

      // Extended timeouts for integration tests that involve:
      // - Database initialization and operations
      // - API server startup/shutdown
      // - Orchestrator workflows
      // - File system operations
      // - Permission approval workflows
      testTimeout: 30000,
      hookTimeout: 20000,

      // Sequential execution to prevent resource conflicts
      // Integration tests often share databases and temp directories
      pool: 'forks',
      poolOptions: {
        forks: {
          // Limit concurrent tests to prevent resource exhaustion
          maxForks: 4,
          minForks: 1,
        },
      },

      // Run tests sequentially within each file to avoid state conflicts
      sequence: {
        shuffle: false,
        concurrent: false,
      },

      // Setup files for integration test utilities
      setupFiles: [
        './tests/integration/setup.ts',
      ],

      // Coverage configuration for integration tests
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'json-summary'],

        // Include all source files across packages
        include: [
          'packages/*/src/**/*.ts',
          '!packages/*/src/**/*.test.ts',
          '!packages/*/src/**/*.unit.test.ts',
          '!packages/*/src/**/*.integration.test.ts',
          '!packages/*/src/**/*.e2e.test.ts',
        ],

        // Exclude test files and generated content
        exclude: [
          '**/*.test.ts',
          '**/*.spec.ts',
          '**/*.d.ts',
          '**/node_modules/**',
          '**/dist/**',
          '**/coverage/**',
          '**/fixtures/**',
          // CLI is primarily tested through integration scenarios
          'packages/cli/src/index.ts',
        ],

        // Integration test coverage thresholds
        thresholds: {
          global: {
            lines: 60,
            functions: 60,
            branches: 50,
            statements: 60,
          },
          // Specific package thresholds
          'packages/core/': {
            lines: 80,
            functions: 75,
            branches: 70,
            statements: 80,
          },
          'packages/orchestrator/': {
            lines: 70,
            functions: 65,
            branches: 60,
            statements: 70,
          },
          'packages/api/': {
            lines: 65,
            functions: 60,
            branches: 55,
            statements: 65,
          },
        },
      },

      // Reporter configuration for integration tests
      reporters: ['default', 'html'],

      // Fail fast in CI environments
      bail: process.env.CI ? 1 : 0,

      // Silent mode for cleaner output during integration testing
      silent: false,

      // Log level for integration tests
      logLevel: process.env.VITEST_LOG_LEVEL ? process.env.VITEST_LOG_LEVEL as any : 'info',
    },

    // Path resolution for workspace packages
    resolve: {
      alias: {
        '@apexcli/core': path.resolve(__dirname, 'packages/core/src'),
        '@apexcli/orchestrator': path.resolve(__dirname, 'packages/orchestrator/src'),
        '@apexcli/cli': path.resolve(__dirname, 'packages/cli/src'),
        '@apexcli/api': path.resolve(__dirname, 'packages/api/src'),
        '@apexcli/browser': path.resolve(__dirname, 'packages/browser/src'),
        '@apexcli/web-ui': path.resolve(__dirname, 'packages/web-ui/src'),

        // Test utilities and fixtures
        '@test/fixtures': path.resolve(__dirname, 'tests/fixtures'),
        '@test/utils': path.resolve(__dirname, 'tests/test-utils/src'),
      },
    },

    // Environment variables for integration tests
    define: {
      'process.env.APEX_TEST_MODE': JSON.stringify('integration'),
      'process.env.NODE_ENV': JSON.stringify('test'),
    },

    // ESBuild configuration for TypeScript compilation
    esbuild: {
      target: 'es2022',
    },
  })
);