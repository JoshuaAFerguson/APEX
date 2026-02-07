import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Set timeout to handle async operations
    testTimeout: 30000,
    hookTimeout: 30000,
    // Include test files
    include: ['src/**/*.test.ts'],
    // Exclude node_modules and other non-test files
    exclude: ['node_modules', 'dist', '**/*.d.ts'],
    // Mock setup
    setupFiles: [],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/**/__mocks__/**'
      ]
    },
    // Pool configuration
    pool: 'threads',
    // Concurrent test execution
    maxConcurrency: 5
  },
  resolve: {
    alias: {
      '@apexcli/core': '../core/src'
    }
  }
});