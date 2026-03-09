/**
 * @fileoverview Vitest configuration for APEX keyboard integration tests
 *
 * This configuration is optimized for keyboard event simulation testing with:
 * - jsdom environment for DOM event compatibility
 * - Extended timeouts for async key sequences
 * - Ink component testing support
 * - Fake timer integration for deterministic tests
 *
 * Key features:
 * - Supports keyboard event simulation utilities
 * - Integrates with ink-testing-library
 * - Handles modifier key combinations
 * - Supports rapid keypress sequence testing
 */

import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,

    // Use jsdom for DOM event compatibility with keyboard events
    environment: 'jsdom',

    // Include keyboard integration tests
    include: [
      '**/*.test.ts',
      '**/*.integration.test.ts',
      '**/*.keyboard.test.ts',
    ],

    // Exclude non-test files
    exclude: [
      'node_modules/**',
      '**/*.md',
      '**/fixtures/**/*.ts',
      '**/utils/**/*.ts',
    ],

    // Extended timeout for keyboard integration tests
    // Async key sequences may take time to complete
    testTimeout: 10000,

    // Hook timeout for setup/teardown operations
    hookTimeout: 5000,

    // Setup file for keyboard test utilities and global mocks
    setupFiles: ['./setup.ts'],

    // Run tests sequentially to avoid keyboard state conflicts
    sequence: {
      shuffle: false,
    },

    // Pool configuration for keyboard tests
    pool: 'threads',
    // Allow parallel execution for independent tests
    maxThreads: 4,
    minThreads: 1,

    // Coverage configuration for keyboard-related code
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: [
        'packages/cli/src/services/ShortcutManager.ts',
        'packages/cli/src/ui/**/*.ts',
        'packages/cli/src/ui/**/*.tsx',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/fixtures/**',
      ],
    },

    // Reporter configuration
    reporters: ['default'],

    // Fail fast on first error in CI environments
    bail: process.env.CI ? 1 : 0,
  },

  // Path resolution for workspace packages and keyboard utilities
  resolve: {
    alias: {
      '@apexcli/core': path.resolve(__dirname, '../../packages/core/src'),
      '@apexcli/orchestrator': path.resolve(__dirname, '../../packages/orchestrator/src'),
      '@apexcli/cli': path.resolve(__dirname, '../../packages/cli/src'),
      // Alias for keyboard test utilities
      '@keyboard-test/utils': path.resolve(__dirname, './utils'),
      '@keyboard-test/fixtures': path.resolve(__dirname, './fixtures'),
    },
  },

  // Environment variables for keyboard integration tests
  define: {
    'process.env.APEX_TEST_MODE': JSON.stringify('keyboard-integration'),
  },
});
