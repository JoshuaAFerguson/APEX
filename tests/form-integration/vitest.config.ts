/**
 * @fileoverview Vitest configuration for Form Controls Integration Tests
 *
 * This configuration provides optimized settings for testing form control interactions
 * across different environments and UI frameworks. It supports:
 * - React/Vue/Angular component testing
 * - Browser automation testing with Playwright/Puppeteer
 * - Form validation testing
 * - Accessibility testing for form controls
 * - Cross-browser form behavior validation
 *
 * Key Features:
 * - JSDom environment for component testing
 * - Node environment for browser automation
 * - Enhanced timeout settings for form interactions
 * - Mock setup for external form services
 * - Coverage reporting for form control code paths
 */

import { defineConfig, mergeConfig } from 'vitest/config';
import { createSharedConfig } from '../../vitest.shared.config.js';
import * as path from 'path';

export default mergeConfig(
  createSharedConfig('jsdom'),
  defineConfig({
    test: {
      // Environment configuration
      environment: 'jsdom',

      // Test file patterns for form controls
      include: [
        'src/**/*.form.test.ts',
        'src/**/*.form.test.tsx',
        'src/**/*.form-integration.test.ts',
        'src/**/*.form-validation.test.ts',
        '__tests__/**/*.form.test.ts',
        '__tests__/**/*.form.test.tsx',
        '../integration/form-*.test.ts',
        './**/*.test.ts',
      ],

      // Exclude patterns to avoid testing unrelated files
      exclude: [
        'node_modules/**',
        '**/*.md',
        '**/fixtures/**/*.ts',
        '**/dist/**',
        '**/build/**',
      ],

      // Extended timeout for form interactions that may involve:
      // - Form validation with async validation rules
      // - File upload simulations
      // - Complex form state changes
      // - Browser automation for real form testing
      testTimeout: 30000,
      hookTimeout: 15000,

      // Setup files for form testing infrastructure
      setupFiles: [
        './setup.ts',
      ],

      // Global test configuration
      globals: true,

      // Pool configuration optimized for form testing
      pool: 'threads',
      poolOptions: {
        threads: {
          maxThreads: 4,
          minThreads: 1,
        },
      },

      // Reporter configuration with detailed form test output
      reporters: [
        'verbose',
        ['html', { outputFile: './coverage/form-tests-report.html' }],
      ],

      // Retry configuration for potentially flaky form interactions
      retry: process.env.CI ? 2 : 0,

      // Watch configuration for development
      watchExclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
      ],
    },

    // Environment-specific configuration
    define: {
      'process.env.FORM_TEST_MODE': JSON.stringify('integration'),
      'process.env.DOM_TESTING': JSON.stringify('true'),
    },

    // Path resolution for form components and utilities
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '../../src'),
        '@components': path.resolve(__dirname, '../../src/components'),
        '@forms': path.resolve(__dirname, '../../src/components/forms'),
        '@utils': path.resolve(__dirname, '../../src/utils'),
        '@test-utils': path.resolve(__dirname, '../test-utils'),
        '@fixtures': path.resolve(__dirname, './fixtures'),
      },
    },

    // Build configuration for test environment
    esbuild: {
      target: 'node18',
      jsx: 'preserve',
    },

    // Coverage configuration focused on form-related code
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage/form-integration',

      // Include form-related source files
      include: [
        '**/src/components/forms/**/*.{ts,tsx}',
        '**/src/components/ui/**/*.{ts,tsx}',
        '**/src/utils/form-*.{ts,tsx}',
        '**/src/utils/validation*.{ts,tsx}',
        '**/src/hooks/use*form*.{ts,tsx}',
        '**/packages/web-ui/src/components/forms/**/*.{ts,tsx}',
        '**/packages/core/src/validation/**/*.{ts,tsx}',
      ],

      // Exclude test files and generated content
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/test-fixtures/**',
        '**/fixtures/**',
        // Exclude non-form components unless they contain form logic
        '**/src/components/charts/**',
        '**/src/components/layout/**',
        '**/src/components/navigation/**',
      ],

      // Coverage thresholds for form control testing
      thresholds: {
        global: {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
        // Stricter thresholds for critical form utilities
        '**/src/utils/form-*.{ts,tsx}': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        // Validation logic should be thoroughly tested
        '**/src/utils/validation*.{ts,tsx}': {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
      },
    },

    // Optimization for faster test execution
    optimizeDeps: {
      include: [
        'vitest/utils',
      ],
    },
  })
);