/**
 * Vitest configuration for Browser Permission Integration Tests
 *
 * This configuration is optimized for testing browser automation permission scenarios
 * with proper test isolation and comprehensive coverage reporting.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'browser-permissions',

    // Test discovery
    include: [
      'tests/integration/browser-*permission*.test.ts',
      'tests/integration/browser-*mcp*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts',
    ],

    // Test environment
    environment: 'node',

    // Test execution settings
    testTimeout: 30000, // 30 seconds for browser operations
    hookTimeout: 10000, // 10 seconds for setup/teardown
    teardownTimeout: 10000,

    // Test isolation and parallel execution
    isolate: true,
    pool: 'threads',
    maxThreads: 4,
    minThreads: 1,

    // Retry configuration for flaky browser tests
    retry: 2,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/browser-permissions',
      include: [
        'packages/orchestrator/src/tools/browser-tool.ts',
        'packages/orchestrator/src/permission-manager.ts',
        'packages/orchestrator/src/permission-store.ts',
        'packages/orchestrator/src/tools/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/test-utils.ts',
        '**/mocks/**',
        '**/fixtures/**',
        '**/__tests__/**',
        '**/node_modules/**',
        '**/dist/**',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },

    // Globals and setup
    globals: true,
    setupFiles: [
      './tests/integration/setup/browser-permissions-setup.ts'
    ],

    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,

    // Reporter configuration
    reporters: ['verbose', 'json'],
    outputFile: './test-results/browser-permissions.json',

    // Performance settings
    maxConcurrency: 4,
    minWorkers: 1,
    maxWorkers: 4,

    // Debugging
    logHeapUsage: false,
    allowOnly: false,
  },

  // Module resolution
  resolve: {
    alias: {
      '@apexcli/core': path.resolve(__dirname, '../../packages/core/src'),
      '@apexcli/orchestrator': path.resolve(__dirname, '../../packages/orchestrator/src'),
      '@apexcli/cli': path.resolve(__dirname, '../../packages/cli/src'),
    },
  },

  // Build configuration for tests
  esbuild: {
    target: 'node18',
  },

  // Define global constants for tests
  define: {
    __TEST_ENV__: '"browser-permissions"',
    __TEST_TYPE__: '"integration"',
  },
});