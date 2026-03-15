/**
 * @fileoverview Vitest configuration for performance benchmarks
 *
 * This configuration is optimized for benchmark testing with:
 * - Extended timeouts for long-running benchmarks
 * - JSON output for CI/CD integration
 * - Sequential execution to avoid resource contention
 */

import { defineConfig, mergeConfig } from 'vitest/config';
import { createSharedConfig } from '../vitest.shared.config';
import * as path from 'path';

export default mergeConfig(
  createSharedConfig('node', {
    testTimeout: 120000,  // 2 minutes per test
    hookTimeout: 60000,   // 1 minute for setup/teardown
  }),
  defineConfig({
    test: {
      name: 'benchmarks',

      // Include only benchmark files
      include: [
        'benchmarks/**/*.bench.ts',
        'packages/*/benchmarks/**/*.bench.ts',
      ],

      // Exclude regular tests
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],

      // Run benchmarks sequentially for consistent results
      pool: 'forks',
      maxForks: 1,
      minForks: 1,

      // Benchmark-specific settings
      benchmark: {
        include: ['**/*.bench.ts'],
        reporters: ['default'],
      },

      // Extended timeouts for benchmark suites
      testTimeout: 300000,  // 5 minutes total
      hookTimeout: 120000,  // 2 minutes for setup

      // Disable parallel execution for benchmarks
      sequence: {
        shuffle: false,
      },

      // Environment
      environment: 'node',

      // Globals
      globals: true,
    },

    // Resolve benchmark imports
    resolve: {
      alias: {
        '@benchmarks': path.resolve(__dirname, './shared'),
      },
    },

    // Optimize for benchmark execution
    esbuild: {
      target: 'node18',
    },
  })
);
