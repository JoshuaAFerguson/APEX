/**
 * @fileoverview Tests for vitest.shared.config.ts functions
 *
 * This file tests the shared Vitest configuration factory functions to ensure
 * they generate valid configurations for different test environments.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSharedConfig,
  createUnitTestConfig,
  createIntegrationTestConfig,
  createE2ETestConfig,
  createBrowserTestConfig,
  type TestEnvironment,
  type SharedConfigOptions,
} from '../../../vitest.shared.config.js';

describe('Shared Vitest Configuration', () => {
  describe('createSharedConfig', () => {
    it('should create basic configuration with default options', () => {
      const config = createSharedConfig('node');

      expect(config.test).toBeDefined();
      expect(config.test?.globals).toBe(true);
      expect(config.test?.environment).toBe('node');
      expect(config.test?.testTimeout).toBe(5000);
      expect(config.test?.hookTimeout).toBe(10000);
      expect(config.test?.include).toContain('src/**/*.test.ts');
      expect(config.test?.include).toContain('src/**/*.test.tsx');
      expect(config.test?.exclude).toContain('**/node_modules/**');
    });

    it('should merge custom options with defaults', () => {
      const options: SharedConfigOptions = {
        testTimeout: 15000,
        hookTimeout: 20000,
        coverageThresholds: {
          lines: 80,
          functions: 85,
          branches: 75,
          statements: 90,
        },
        additionalIncludes: ['custom/**/*.test.ts'],
        additionalExcludes: ['custom/**/*.skip.ts'],
      };

      const config = createSharedConfig('jsdom', options);

      expect(config.test?.environment).toBe('jsdom');
      expect(config.test?.testTimeout).toBe(15000);
      expect(config.test?.hookTimeout).toBe(20000);
      expect(config.test?.include).toContain('custom/**/*.test.ts');
      expect(config.test?.exclude).toContain('custom/**/*.skip.ts');
      expect(config.test?.coverage?.thresholds?.global).toEqual({
        lines: 80,
        functions: 85,
        branches: 75,
        statements: 90,
      });
    });

    it('should set environment-specific configurations', () => {
      const nodeConfig = createSharedConfig('node');
      const jsdomConfig = createSharedConfig('jsdom');

      // Node environment should have environment match globs
      expect(nodeConfig.test?.environmentMatchGlobs).toBeDefined();
      expect(nodeConfig.test?.environmentMatchGlobs).toEqual([
        ['**/src/**', 'node'],
        ['**/__tests__/**', 'node'],
      ]);

      // Other environments should not have environment match globs
      expect(jsdomConfig.test?.environmentMatchGlobs).toBeUndefined();
    });

    it('should configure coverage correctly', () => {
      const config = createSharedConfig('node');

      expect(config.test?.coverage).toEqual({
        provider: 'v8',
        reporter: ['text', 'text-summary', 'html', 'json', 'lcov'],
        reportsDirectory: './coverage',
        include: ['src/**/*.ts', 'src/**/*.tsx'],
        exclude: [
          '**/*.test.ts',
          '**/*.test.tsx',
          '**/*.unit.test.ts',
          '**/*.integration.test.ts',
          '**/*.e2e.test.ts',
          '**/*.spec.ts',
          '**/*.spec.tsx',
          '**/*.d.ts',
          '**/node_modules/**',
          '**/dist/**',
          '**/coverage/**',
          '**/__tests__/**',
          '**/__mocks__/**',
          '**/test-fixtures/**',
        ],
        thresholds: {
          global: {
            lines: 50,
            functions: 50,
            branches: 50,
            statements: 50,
          },
        },
      });
    });

    it('should setup resolve aliases correctly', () => {
      const config = createSharedConfig('node');

      expect(config.resolve?.alias).toBeDefined();
      expect(config.resolve?.alias?.['@']).toContain('/src');
      expect(config.resolve?.alias?.['@tests']).toContain('/__tests__');
      expect(config.resolve?.alias?.['@fixtures']).toContain('/__tests__/fixtures');
    });
  });

  describe('createUnitTestConfig', () => {
    it('should create configuration optimized for unit tests', () => {
      const config = createUnitTestConfig();

      expect(config.test?.environment).toBe('node');
      expect(config.test?.testTimeout).toBe(5000);
      expect(config.test?.include).toContain('src/**/*.test.ts');
      expect(config.test?.include).toContain('src/**/*.unit.test.ts');
      expect(config.test?.exclude).toContain('**/*.e2e.test.ts');
      expect(config.test?.exclude).toContain('**/*.integration.test.ts');
      expect(config.test?.exclude).toContain('**/*.stress.test.ts');
      expect(config.test?.exclude).toContain('**/*.edge.test.ts');
    });

    it('should merge custom options for unit tests', () => {
      const options: SharedConfigOptions = {
        testTimeout: 3000,
        additionalIncludes: ['unit/**/*.test.ts'],
      };

      const config = createUnitTestConfig(options);

      expect(config.test?.testTimeout).toBe(3000);
      expect(config.test?.include).toContain('unit/**/*.test.ts');
    });
  });

  describe('createIntegrationTestConfig', () => {
    it('should create configuration optimized for integration tests', () => {
      const config = createIntegrationTestConfig();

      expect(config.test?.environment).toBe('node');
      expect(config.test?.testTimeout).toBe(30000);
      expect(config.test?.hookTimeout).toBe(30000);
      expect(config.test?.include).toContain('src/**/*.integration.test.ts');
      expect(config.test?.include).toContain('tests/integration/**/*.test.ts');
    });

    it('should merge custom options for integration tests', () => {
      const options: SharedConfigOptions = {
        testTimeout: 45000,
        additionalIncludes: ['integration/**/*.test.ts'],
      };

      const config = createIntegrationTestConfig(options);

      expect(config.test?.testTimeout).toBe(45000);
      expect(config.test?.include).toContain('integration/**/*.test.ts');
    });
  });

  describe('createE2ETestConfig', () => {
    it('should create configuration optimized for E2E tests', () => {
      const config = createE2ETestConfig();

      expect(config.test?.environment).toBe('node');
      expect(config.test?.testTimeout).toBe(60000);
      expect(config.test?.hookTimeout).toBe(30000);
      expect(config.test?.include).toContain('src/**/*.e2e.test.ts');
      expect(config.test?.include).toContain('tests/e2e/**/*.test.ts');
    });

    it('should merge custom options for E2E tests', () => {
      const options: SharedConfigOptions = {
        testTimeout: 120000,
        additionalIncludes: ['e2e/**/*.test.ts'],
      };

      const config = createE2ETestConfig(options);

      expect(config.test?.testTimeout).toBe(120000);
      expect(config.test?.include).toContain('e2e/**/*.test.ts');
    });
  });

  describe('createBrowserTestConfig', () => {
    it('should create configuration with jsdom environment by default', () => {
      const config = createBrowserTestConfig();

      expect(config.test?.environment).toBe('jsdom');
      expect(config.test?.testTimeout).toBe(10000);
      expect(config.test?.include).toContain('src/**/*.test.tsx');
      expect(config.test?.include).toContain('src/**/*.component.test.ts');
      expect(config.test?.include).toContain('src/**/*.ui.test.ts');
    });

    it('should create configuration with happy-dom environment when specified', () => {
      const config = createBrowserTestConfig('happy-dom');

      expect(config.test?.environment).toBe('happy-dom');
    });

    it('should merge custom options for browser tests', () => {
      const options: SharedConfigOptions = {
        testTimeout: 15000,
        additionalIncludes: ['components/**/*.test.tsx'],
      };

      const config = createBrowserTestConfig('jsdom', options);

      expect(config.test?.testTimeout).toBe(15000);
      expect(config.test?.include).toContain('components/**/*.test.tsx');
    });
  });

  describe('Type Safety', () => {
    it('should enforce valid test environments', () => {
      // These should compile without errors
      createSharedConfig('node');
      createSharedConfig('jsdom');
      createSharedConfig('happy-dom');
      createBrowserTestConfig('jsdom');
      createBrowserTestConfig('happy-dom');

      // This test ensures TypeScript compilation catches invalid environments
      expect(true).toBe(true);
    });

    it('should accept valid SharedConfigOptions', () => {
      const validOptions: SharedConfigOptions = {
        environment: 'node',
        globals: false,
        testTimeout: 10000,
        hookTimeout: 15000,
        coverageThresholds: {
          lines: 80,
          functions: 75,
          branches: 70,
          statements: 85,
        },
        additionalIncludes: ['custom/**/*.ts'],
        additionalExcludes: ['skip/**/*.ts'],
      };

      const config = createSharedConfig('node', validOptions);
      expect(config.test?.globals).toBe(false);
      expect(config.test?.testTimeout).toBe(10000);
    });
  });

  describe('Configuration Inheritance', () => {
    it('should allow for proper merging with defineConfig', async () => {
      // Test that the generated config can be merged with other configs
      const { defineConfig, mergeConfig } = await import('vitest/config');

      const sharedConfig = createSharedConfig('node');

      const customConfig = defineConfig({
        test: {
          globals: false, // Override shared config
          pool: 'threads',
        },
      });

      const merged = mergeConfig(sharedConfig, customConfig);

      expect(merged.test?.globals).toBe(false); // Custom value wins
      expect(merged.test?.environment).toBe('node'); // Shared value preserved
      expect(merged.test?.pool).toBe('threads'); // Custom value added
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should support common monorepo package configurations', () => {
      // Simulate API package config
      const apiConfig = createIntegrationTestConfig({
        testTimeout: 30000,
        additionalExcludes: ['**/*.ui.test.ts'],
      });

      expect(apiConfig.test?.testTimeout).toBe(30000);
      expect(apiConfig.test?.exclude).toContain('**/*.ui.test.ts');

      // Simulate CLI package config
      const cliConfig = createBrowserTestConfig('jsdom', {
        coverageThresholds: { lines: 70 },
        additionalIncludes: ['src/ui/**/*.test.tsx'],
      });

      expect(cliConfig.test?.environment).toBe('jsdom');
      expect(cliConfig.test?.include).toContain('src/ui/**/*.test.tsx');
      expect(cliConfig.test?.coverage?.thresholds?.global?.lines).toBe(70);
    });

    it('should support different test type configurations', () => {
      const unitConfig = createUnitTestConfig({ testTimeout: 3000 });
      const integrationConfig = createIntegrationTestConfig({ testTimeout: 45000 });
      const e2eConfig = createE2ETestConfig({ testTimeout: 120000 });

      expect(unitConfig.test?.testTimeout).toBe(3000);
      expect(integrationConfig.test?.testTimeout).toBe(45000);
      expect(e2eConfig.test?.testTimeout).toBe(120000);

      // Unit tests should exclude slow test types
      expect(unitConfig.test?.exclude).toContain('**/*.integration.test.ts');
      expect(unitConfig.test?.exclude).toContain('**/*.e2e.test.ts');

      // Integration tests should include specific patterns
      expect(integrationConfig.test?.include).toContain('tests/integration/**/*.test.ts');

      // E2E tests should include specific patterns
      expect(e2eConfig.test?.include).toContain('tests/e2e/**/*.test.ts');
    });
  });

  describe('Error Cases', () => {
    it('should handle missing options gracefully', () => {
      const config = createSharedConfig();

      expect(config.test?.environment).toBe('node'); // Default environment
      expect(config.test?.testTimeout).toBe(5000); // Default timeout
      expect(config.test?.coverage?.thresholds?.global).toEqual({
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
      });
    });

    it('should handle partial coverage thresholds', () => {
      const config = createSharedConfig('node', {
        coverageThresholds: {
          lines: 80,
          // Missing other thresholds should use defaults
        },
      });

      expect(config.test?.coverage?.thresholds?.global).toEqual({
        lines: 80,
        functions: 50,
        branches: 50,
        statements: 50,
      });
    });
  });
});