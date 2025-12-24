import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom', // Required for React components testing
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['tests/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@apexcli/core': path.resolve(__dirname, '../packages/core/src'),
      '@apexcli/orchestrator': path.resolve(__dirname, '../packages/orchestrator/src'),
      '@apexcli/cli': path.resolve(__dirname, '../packages/cli/src'),
    },
  },
});