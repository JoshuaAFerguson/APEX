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

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
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

    // Exclude E2E, integration, stress, edge, and top-level test directories
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
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.unit.test.ts',
        '**/*.e2e.test.ts',
        '**/*.integration.test.ts',
        '**/*.stress.test.ts',
        '**/*.edge.test.ts',
        '**/*.d.ts',
        'packages/cli/src/**/*.ts',
        'packages/web-ui/src/app/**/*.{ts,tsx}',
        'packages/web-ui/src/components/**/*.{ts,tsx}',
        'packages/web-ui/src/lib/websocket-client.ts',
      ],
    },
  },
});
