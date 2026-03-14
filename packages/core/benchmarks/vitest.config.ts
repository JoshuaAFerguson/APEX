/**
 * @fileoverview Vitest configuration for @apexcli/core benchmarks
 */

import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    name: 'core-benchmarks',

    include: ['benchmarks/**/*.bench.ts'],

    exclude: [
      '**/node_modules/**',
      '**/dist/**',
    ],

    // Run sequentially for consistent results
    pool: 'forks',
    maxForks: 1,
    minForks: 1,

    // Timeouts
    testTimeout: 120000,  // 2 minutes
    hookTimeout: 60000,   // 1 minute

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
