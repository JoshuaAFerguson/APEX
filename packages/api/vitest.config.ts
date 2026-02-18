import { defineConfig, mergeConfig } from 'vitest/config';
import { createIntegrationTestConfig } from '../../vitest.shared.config.js';

export default mergeConfig(
  createIntegrationTestConfig({
    testTimeout: 30000,
    hookTimeout: 30000,
  }),
  defineConfig({
    test: {
      // API-specific setup if needed
      setupFiles: ['../../test-setup.ts'],

      // Package-specific coverage configuration
      coverage: {
        exclude: [
          'dist/**',
          'node_modules/**',
          'src/__tests__/**',
          '**/*.d.ts',
          '**/*.test.ts',
          '**/*.integration.test.ts',
          '**/*.e2e.test.ts',
        ],
      },
    },
  })
);