/**
 * @fileoverview Main Vitest configuration for APEX monorepo
 *
 * This configuration runs all tests across the monorepo.
 * It includes unit tests, integration tests, stress tests, and e2e tests.
 */
import { defineConfig, mergeConfig } from 'vitest/config';
import { createSharedConfig } from './vitest.shared.config';

export default mergeConfig(
  createSharedConfig('jsdom'),
  defineConfig({
    test: {
      // Environment-specific glob patterns for optimal test execution
      environmentMatchGlobs: [
        ['**/packages/orchestrator/src/**', 'node'],
        ['**/packages/core/src/**', 'node'],
        ['**/packages/api/src/**', 'node'],
        ['**/packages/cli/src/__tests__/**', 'node'],
        ['**/packages/cli/src/services/**', 'node'],
      ],

      // Include all test types across packages and top-level directories
      include: [
        'packages/*/src/**/*.test.ts',
        'packages/*/src/**/*.test.tsx',
        'packages/*/src/**/*.unit.test.ts',
        'packages/*/src/**/*.stress.test.ts',
        'packages/*/src/**/*.edge.test.ts',
        'packages/*/src/**/*.integration.test.ts',
        'packages/*/src/**/*.e2e.test.ts',
        'tests/**/*.test.ts',
        'tests/**/*.test.tsx',
        'docs/tests/**/*.test.ts',

        // Additional E2E test patterns to ensure comprehensive discovery
        '**/*e2e*.test.ts',                    // Files with e2e in the name
        '**/e2e-*.test.ts',                    // Files starting with e2e-
        'tests/integration/**/*e2e*.test.ts',  // Integration directory E2E tests
        'tests/test-utils/**/*e2e*.test.ts',   // Test utilities E2E tests
      ],

      // Monorepo-specific coverage configuration
      coverage: {
        include: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
        exclude: [
          '**/*.test.ts',
          '**/*.test.tsx',
          '**/*.unit.test.ts',
          '**/*.integration.test.ts',
          '**/*.e2e.test.ts',
          '**/*.stress.test.ts',
          '**/*.edge.test.ts',
          '**/*.d.ts',
          '**/node_modules/**',
          '**/dist/**',
          '**/coverage/**',
          // CLI is mostly wiring code that calls into core/orchestrator/api
          // It's tested via integration tests and manual testing
          'packages/cli/src/**/*.ts',
          // Web UI components require browser environment (Next.js, React)
          'packages/web-ui/src/app/**/*.{ts,tsx}',
          'packages/web-ui/src/components/**/*.{ts,tsx}',
          // WebSocket client requires browser WebSocket API
          'packages/web-ui/src/lib/websocket-client.ts',
        ],
        thresholds: {
          global: {
            lines: 50,
            functions: 50,
            branches: 50,
            statements: 50,
          },
        },
      },
    },
  })
);
