/**
 * Vitest Configuration for Systems Integration Tests
 *
 * This configuration is specifically for the comprehensive integration tests
 * that validate the interaction between tools, permissions, and browser automation.
 */

import { defineConfig, mergeConfig } from 'vitest/config';
import { createSharedConfig } from './vitest.shared.config';

export default mergeConfig(
  createSharedConfig('node'),
  defineConfig({
    test: {
      // Specific to integration tests
      name: 'systems-integration',

      // Include only the new integration test files
      include: [
        'tests/integration/tools-permissions-browser.integration.test.ts',
        'tests/integration/comprehensive-tool-permission-browser.integration.test.ts',
        'tests/integration/browser-mcp-integration.test.ts',
        'tests/integration/permission-flow-edge-cases.integration.test.ts',
        'tests/integration/systems-performance.integration.test.ts',
        'tests/integration/integration-suite-validation.test.ts'
      ],

      // Environment configuration for integration tests
      environment: 'node',

      // Longer timeout for integration tests
      testTimeout: 30000,
      hookTimeout: 10000,

      // Serial execution for resource-intensive tests to avoid conflicts
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: true
        }
      },

      // Setup files
      setupFiles: ['tests/integration/setup.ts'],

      // Global configuration
      globals: true,

      // Coverage configuration specifically for integration testing
      coverage: {
        include: [
          'packages/orchestrator/src/tools/**/*.ts',
          'packages/orchestrator/src/permission-*.ts',
          'packages/orchestrator/src/browser-*.ts'
        ],
        exclude: [
          '**/*.test.ts',
          '**/*.d.ts',
          '**/node_modules/**'
        ],
        reporter: ['text', 'html', 'lcov'],
        reportsDirectory: './coverage/integration',
        thresholds: {
          global: {
            lines: 60,
            functions: 60,
            branches: 50,
            statements: 60
          }
        }
      },

      // Reporter configuration
      reporter: ['default', 'html'],
      outputFile: {
        html: './test-results/integration-systems.html'
      }
    }
  })
);