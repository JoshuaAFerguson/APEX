/**
 * @fileoverview Vitest configuration for APEX unit tests only
 *
 * This configuration runs ONLY unit tests (fast, isolated, mock-heavy).
 * It excludes E2E, integration, stress, and edge-case tests for rapid feedback.
 *
 * Usage:
 *   npm run test:unit           # Run unit tests once
 *   npm run test:unit -- --watch  # Watch mode
 *
 * File naming conventions included:
 *   *.test.ts       - Default unit tests
 *   *.unit.test.ts  - Explicitly named unit tests
 *
 * File naming conventions excluded:
 *   *.e2e.test.ts           - End-to-end tests (use test:e2e)
 *   *.integration.test.ts   - Integration tests (use test:browser-integration)
 *   *.stress.test.ts        - Stress tests (use test)
 *   *.edge.test.ts          - Edge-case tests (use test)
 */

import { defineConfig, mergeConfig } from 'vitest/config';
import { createUnitTestConfig } from './vitest.shared.config.js';

export default mergeConfig(
  createUnitTestConfig(),
  defineConfig({
    test: {
      // Environment-specific configuration for monorepo packages
      environmentMatchGlobs: [
        ['**/packages/orchestrator/src/**', 'node'],
        ['**/packages/core/src/**', 'node'],
        ['**/packages/api/src/**', 'node'],
        ['**/packages/cli/src/__tests__/**', 'node'],
        ['**/packages/cli/src/services/**', 'node'],
      ],

      // Include only unit tests within packages
      include: [
        'packages/*/src/**/*.test.ts',
        'packages/*/src/**/*.test.tsx',
        'packages/*/src/**/*.unit.test.ts',
      ],

      // Exclude non-unit tests and top-level test directories
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.e2e.test.ts',
        '**/*.integration.test.ts',
        '**/*.stress.test.ts',
        '**/*.edge.test.ts',
        'tests/**',
        'docs/**',
      ],

      // Unit tests should be fast - use default timeouts (5s)
      // If a unit test needs more than 5s, it's likely an integration test

      // Coverage for unit tests
      coverage: {
        include: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
        exclude: [
          '**/*.test.ts',
          '**/*.test.tsx',
          '**/*.unit.test.ts',
          '**/*.e2e.test.ts',
          '**/*.integration.test.ts',
          '**/*.stress.test.ts',
          '**/*.edge.test.ts',
          '**/*.d.ts',
          '**/node_modules/**',
          '**/dist/**',
          '**/coverage/**',
          'packages/cli/src/**/*.ts',
          'packages/web-ui/src/app/**/*.{ts,tsx}',
          'packages/web-ui/src/components/**/*.{ts,tsx}',
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
