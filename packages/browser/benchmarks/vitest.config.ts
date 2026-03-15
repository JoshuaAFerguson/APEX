/**
 * @fileoverview Vitest configuration for @apexcli/browser benchmarks
 */

import { defineConfig, mergeConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    name: 'browser-benchmarks',

    include: ['benchmarks/**/*.bench.ts'],

    exclude: [
      '**/node_modules/**',
      '**/dist/**',
    ],

    // Run sequentially for consistent results
    pool: 'forks',
    maxForks: 1,
    minForks: 1,

    // Extended timeouts for browser operations
    testTimeout: 300000,  // 5 minutes
    hookTimeout: 120000,  // 2 minutes

    environment: 'node',
    globals: true,

    // Benchmark settings
    benchmark: {
      include: ['**/*.bench.ts'],
      reporters: ['default'],
    },
  },

  resolve: {
    alias: {
      '@benchmarks': path.resolve(__dirname, '../../../benchmarks/shared'),
    },
  },
});
