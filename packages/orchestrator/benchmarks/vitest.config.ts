/**
 * @fileoverview Vitest configuration for @apexcli/orchestrator benchmarks
 */

import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    name: 'orchestrator-benchmarks',

    include: ['benchmarks/**/*.bench.ts'],

    exclude: [
      '**/node_modules/**',
      '**/dist/**',
    ],

    // Run sequentially for consistent database results
    pool: 'forks',
    maxForks: 1,
    minForks: 1,

    // Extended timeouts for database operations
    testTimeout: 180000,  // 3 minutes
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
