import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@apexcli/core': path.resolve(__dirname, '../packages/core/src'),
      '@apexcli/orchestrator': path.resolve(__dirname, '../packages/orchestrator/src'),
      '@apexcli/cli': path.resolve(__dirname, '../packages/cli/src'),
    },
  },
});