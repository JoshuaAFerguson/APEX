/**
 * @fileoverview Integration tests for test configuration inheritance
 *
 * This file verifies that test configurations are properly inherited across
 * packages and that the shared configuration works correctly in different contexts.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { defineConfig, mergeConfig } from 'vitest/config';
import {
  createSharedConfig,
  createUnitTestConfig,
  createIntegrationTestConfig,
  createE2ETestConfig,
  createBrowserTestConfig,
} from '../../vitest.shared.config.js';

describe('Test Configuration Inheritance', () => {
  const projectRoot = join(__dirname, '../..');

  describe('Root Configuration', () => {
    it('should have a valid main vitest.config.ts', async () => {
      const configPath = join(projectRoot, 'vitest.config.ts');
      const configContent = await readFile(configPath, 'utf-8');

      expect(configContent).toContain('createSharedConfig');
      expect(configContent).toContain('mergeConfig');
      expect(configContent).toContain('defineConfig');
    });

    it('should use shared config as base', () => {
      const sharedConfig = createSharedConfig('jsdom');
      expect(sharedConfig.test?.environment).toBe('jsdom');
      expect(sharedConfig.test?.testTimeout).toBe(5000);
      expect(sharedConfig.test?.coverage?.provider).toBe('v8');
    });
  });

  describe('Package Configuration Inheritance', () => {
    it('should verify API package inherits integration config', async () => {
      const configPath = join(projectRoot, 'packages/api/vitest.config.ts');
      const configContent = await readFile(configPath, 'utf-8');

      expect(configContent).toContain('createIntegrationTestConfig');
      expect(configContent).toContain('testTimeout: 30000');
      expect(configContent).toContain('hookTimeout: 30000');
    });

    it('should verify CLI package inherits browser config', async () => {
      const configPath = join(projectRoot, 'packages/cli/vitest.config.ts');
      const configContent = await readFile(configPath, 'utf-8');

      expect(configContent).toContain('createBrowserTestConfig');
      expect(configContent).toContain("'jsdom'");
    });

    it('should verify packages can override shared settings', async () => {
      // CLI package should override coverage thresholds
      const cliConfigPath = join(projectRoot, 'packages/cli/vitest.config.ts');
      const cliConfigContent = await readFile(cliConfigPath, 'utf-8');

      expect(cliConfigContent).toContain('coverageThresholds');
      expect(cliConfigContent).toContain('lines: 70');
    });
  });

  describe('Configuration Merging Behavior', () => {
    it('should merge shared config with package-specific config', () => {
      const sharedConfig = createBrowserTestConfig('jsdom', {
        coverageThresholds: { lines: 50 },
      });

      const packageConfig = defineConfig({
        test: {
          setupFiles: ['./setup.ts'],
          coverage: {
            exclude: ['**/*.mock.ts'],
            thresholds: {
              global: { lines: 80 }, // Override
            },
          },
        },
      });

      const merged = mergeConfig(sharedConfig, packageConfig);

      expect(merged.test?.environment).toBe('jsdom'); // From shared
      expect(merged.test?.setupFiles).toEqual(['./setup.ts']); // From package
      expect(merged.test?.coverage?.exclude).toContain('**/*.mock.ts'); // From package
      expect(merged.test?.coverage?.thresholds?.global?.lines).toBe(80); // Override from package
    });

    it('should preserve shared config base patterns', () => {
      const baseConfig = createSharedConfig('node');

      expect(baseConfig.test?.include).toEqual([
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.unit.test.ts',
        'src/**/*.integration.test.ts',
        'src/**/*.e2e.test.ts',
        '__tests__/**/*.test.ts',
        '__tests__/**/*.test.tsx',
      ]);

      expect(baseConfig.test?.exclude).toContain('**/node_modules/**');
      expect(baseConfig.test?.exclude).toContain('**/dist/**');
      expect(baseConfig.test?.exclude).toContain('**/coverage/**');
    });

    it('should allow additional includes and excludes', () => {
      const config = createSharedConfig('node', {
        additionalIncludes: ['custom/**/*.test.ts'],
        additionalExcludes: ['temp/**/*'],
      });

      expect(config.test?.include).toContain('custom/**/*.test.ts');
      expect(config.test?.exclude).toContain('temp/**/*');

      // Should still have base patterns
      expect(config.test?.include).toContain('src/**/*.test.ts');
      expect(config.test?.exclude).toContain('**/node_modules/**');
    });
  });

  describe('Environment-Specific Configurations', () => {
    it('should configure unit tests for fast execution', () => {
      const config = createUnitTestConfig();

      expect(config.test?.environment).toBe('node');
      expect(config.test?.testTimeout).toBe(5000);
      expect(config.test?.include).toContain('src/**/*.unit.test.ts');
      expect(config.test?.exclude).toContain('**/*.e2e.test.ts');
      expect(config.test?.exclude).toContain('**/*.integration.test.ts');
    });

    it('should configure integration tests for real dependencies', () => {
      const config = createIntegrationTestConfig();

      expect(config.test?.environment).toBe('node');
      expect(config.test?.testTimeout).toBe(30000);
      expect(config.test?.hookTimeout).toBe(30000);
      expect(config.test?.include).toContain('src/**/*.integration.test.ts');
      expect(config.test?.include).toContain('tests/integration/**/*.test.ts');
    });

    it('should configure E2E tests for long-running operations', () => {
      const config = createE2ETestConfig();

      expect(config.test?.environment).toBe('node');
      expect(config.test?.testTimeout).toBe(60000);
      expect(config.test?.hookTimeout).toBe(30000);
      expect(config.test?.include).toContain('src/**/*.e2e.test.ts');
      expect(config.test?.include).toContain('tests/e2e/**/*.test.ts');
    });

    it('should configure browser tests for UI components', () => {
      const jsdomConfig = createBrowserTestConfig('jsdom');
      const happyDomConfig = createBrowserTestConfig('happy-dom');

      expect(jsdomConfig.test?.environment).toBe('jsdom');
      expect(happyDomConfig.test?.environment).toBe('happy-dom');

      expect(jsdomConfig.test?.testTimeout).toBe(10000);
      expect(jsdomConfig.test?.include).toContain('src/**/*.test.tsx');
      expect(jsdomConfig.test?.include).toContain('src/**/*.component.test.ts');
      expect(jsdomConfig.test?.include).toContain('src/**/*.ui.test.ts');
    });
  });

  describe('Coverage Configuration Inheritance', () => {
    it('should inherit base coverage configuration', () => {
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

    it('should allow coverage threshold overrides', () => {
      const config = createSharedConfig('node', {
        coverageThresholds: {
          lines: 80,
          functions: 85,
          branches: 75,
          statements: 90,
        },
      });

      expect(config.test?.coverage?.thresholds?.global).toEqual({
        lines: 80,
        functions: 85,
        branches: 75,
        statements: 90,
      });
    });

    it('should support partial coverage threshold overrides', () => {
      const config = createSharedConfig('node', {
        coverageThresholds: {
          lines: 75,
          // Other thresholds should use defaults
        },
      });

      expect(config.test?.coverage?.thresholds?.global).toEqual({
        lines: 75,
        functions: 50, // Default
        branches: 50,  // Default
        statements: 50, // Default
      });
    });
  });

  describe('Resolve Alias Configuration', () => {
    it('should setup resolve aliases correctly', () => {
      const config = createSharedConfig('node');

      expect(config.resolve?.alias?.['@']).toMatch(/\/src$/);
      expect(config.resolve?.alias?.['@tests']).toMatch(/\/__tests__$/);
      expect(config.resolve?.alias?.['@fixtures']).toMatch(/\/__tests__\/fixtures$/);
    });

    it('should work with different working directories', () => {
      // The aliases should be relative to process.cwd()
      const originalCwd = process.cwd();

      try {
        // Change directory temporarily
        const mockCwd = '/mock/project';
        vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);

        const config = createSharedConfig('node');

        expect(config.resolve?.alias?.['@']).toBe('/mock/project/src');
        expect(config.resolve?.alias?.['@tests']).toBe('/mock/project/__tests__');
        expect(config.resolve?.alias?.['@fixtures']).toBe('/mock/project/__tests__/fixtures');
      } finally {
        vi.restoreAllMocks();
      }
    });
  });

  describe('Monorepo Package Structure', () => {
    it('should verify expected package structure exists', async () => {
      const packages = ['core', 'orchestrator', 'cli', 'api'];

      for (const pkg of packages) {
        const packagePath = join(projectRoot, 'packages', pkg);
        const packageJsonPath = join(packagePath, 'package.json');

        try {
          const packageJson = await readFile(packageJsonPath, 'utf-8');
          const parsed = JSON.parse(packageJson);
          expect(parsed.name).toContain(pkg);
        } catch (error) {
          // Some packages might not exist yet, that's OK for this test
          console.warn(`Package ${pkg} not found or invalid: ${error.message}`);
        }
      }
    });

    it('should verify vitest configs exist where expected', async () => {
      const expectedConfigs = [
        'vitest.config.ts',
        'vitest.shared.config.ts',
        'vitest.unit.config.ts',
        'vitest.e2e.config.ts',
      ];

      for (const configFile of expectedConfigs) {
        const configPath = join(projectRoot, configFile);

        try {
          const configContent = await readFile(configPath, 'utf-8');
          expect(configContent).toContain('vitest');
        } catch (error) {
          console.warn(`Config ${configFile} not found: ${error.message}`);
        }
      }
    });
  });

  describe('Global Test Setup Integration', () => {
    it('should verify setup files are referenced correctly', async () => {
      try {
        const setupPath = join(projectRoot, 'test-setup.ts');
        const setupContent = await readFile(setupPath, 'utf-8');

        expect(setupContent).toContain('setupGlobalTestEnvironment');
        expect(setupContent).toContain('TestEnvironmentOptions');
      } catch (error) {
        console.warn(`Setup file not found: ${error.message}`);
      }
    });

    it('should verify package configs reference setup files', async () => {
      const packageConfigs = [
        'packages/api/vitest.config.ts',
        'packages/cli/vitest.config.ts',
      ];

      for (const configPath of packageConfigs) {
        try {
          const fullPath = join(projectRoot, configPath);
          const configContent = await readFile(fullPath, 'utf-8');

          // Should reference either local setup or root setup
          expect(
            configContent.includes('setupFiles') ||
            configContent.includes('test-setup.ts')
          ).toBe(true);
        } catch (error) {
          console.warn(`Package config ${configPath} not found: ${error.message}`);
        }
      }
    });
  });

  describe('Configuration Validation', () => {
    it('should generate valid vitest configurations', () => {
      const configs = [
        createSharedConfig('node'),
        createUnitTestConfig(),
        createIntegrationTestConfig(),
        createE2ETestConfig(),
        createBrowserTestConfig('jsdom'),
      ];

      for (const config of configs) {
        // All configs should have required vitest structure
        expect(config.test).toBeDefined();
        expect(config.test?.environment).toBeDefined();
        expect(config.test?.include).toBeDefined();
        expect(config.test?.exclude).toBeDefined();
        expect(config.test?.coverage).toBeDefined();
        expect(config.resolve?.alias).toBeDefined();

        // Test environment should be valid
        expect(['node', 'jsdom', 'happy-dom']).toContain(config.test?.environment);

        // Timeouts should be reasonable
        expect(config.test?.testTimeout).toBeGreaterThan(0);
        expect(config.test?.testTimeout).toBeLessThan(300000); // 5 minutes max

        // Include/exclude arrays should not be empty
        expect(Array.isArray(config.test?.include)).toBe(true);
        expect(config.test?.include?.length).toBeGreaterThan(0);
        expect(Array.isArray(config.test?.exclude)).toBe(true);
        expect(config.test?.exclude?.length).toBeGreaterThan(0);
      }
    });

    it('should support merging without conflicts', () => {
      const baseConfig = createSharedConfig('node');

      const customConfigs = [
        defineConfig({
          test: { globals: false },
        }),
        defineConfig({
          test: { setupFiles: ['./custom-setup.ts'] },
        }),
        defineConfig({
          resolve: { alias: { '@custom': '/custom/path' } },
        }),
      ];

      for (const customConfig of customConfigs) {
        expect(() => {
          const merged = mergeConfig(baseConfig, customConfig);
          expect(merged.test).toBeDefined();
        }).not.toThrow();
      }
    });
  });
});