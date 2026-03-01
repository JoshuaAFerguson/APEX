/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'turborepo-audit',
    root: resolve(__dirname),
    include: ['tests/turborepo-audit.test.ts'],
    testTimeout: 60000, // Longer timeout for build/exec commands
    hookTimeout: 30000,
    globals: true,
    environment: 'node',
    reporters: ['verbose'],
    outputFile: {
      json: './coverage/turborepo-audit-results.json'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname),
      '@tests': resolve(__dirname, 'tests'),
      '@packages': resolve(__dirname, 'packages')
    }
  }
});