/**
 * Comprehensive test suite for the detectTestFrameworks() method
 *
 * This test suite ensures the detectTestFrameworks() method meets all acceptance criteria:
 * - Detects test frameworks (Jest, Vitest, Mocha, Pytest, etc.)
 * - Returns framework name, config file path, and test run command
 * - Unit tests verify detection of at least 6 test frameworks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { ProjectContextAnalyzer } from '../project-context-analyzer';

describe('detectTestFrameworks() - Comprehensive Test Suite', () => {
  let tempDir: string;
  let analyzer: ProjectContextAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(tmpdir(), 'apex-test-frameworks-'));
    analyzer = new ProjectContextAnalyzer(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp dir:', error);
    }
  });

  describe('Basic Framework Detection', () => {
    it('should detect Jest framework from package.json', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          jest: '^29.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Jest',
          runCommand: 'npm test',
        })
      );
    });

    it('should detect Vitest framework from package.json', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          vitest: '^0.34.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Vitest',
          runCommand: 'vitest',
        })
      );
    });

    it('should detect Mocha framework from package.json', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          mocha: '^10.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Mocha',
          runCommand: 'mocha',
        })
      );
    });

    it('should detect Pytest framework from package.json', async () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          pytest: '^7.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Pytest',
          runCommand: 'pytest',
        })
      );
    });

    it('should detect Playwright framework from package.json', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          '@playwright/test': '^1.36.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Playwright',
          runCommand: 'playwright test',
        })
      );
    });

    it('should detect Cypress framework from package.json', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          cypress: '^12.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Cypress',
          runCommand: 'cypress run',
        })
      );
    });

    it('should detect Karma framework from package.json', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          karma: '^6.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Karma',
          runCommand: 'karma start',
        })
      );
    });

    it('should detect Jasmine framework from package.json', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          jasmine: '^5.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Jasmine',
          runCommand: 'jasmine',
        })
      );
    });
  });

  describe('Configuration File Detection', () => {
    it('should detect Jest from jest.config.js', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'jest.config.js'),
        'module.exports = { testEnvironment: "node" };'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Jest',
          configFile: 'jest.config.js',
          runCommand: 'npm test',
        })
      );
    });

    it('should detect Vitest from vitest.config.ts', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'vitest.config.ts'),
        'export default { test: {} };'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Vitest',
          configFile: 'vitest.config.ts',
          runCommand: 'vitest',
        })
      );
    });

    it('should detect Mocha from .mocharc.json', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, '.mocharc.json'),
        JSON.stringify({ reporter: 'spec', recursive: true })
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Mocha',
          configFile: '.mocharc.json',
          runCommand: 'mocha',
        })
      );
    });

    it('should detect Pytest from pytest.ini', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'pytest.ini'),
        '[tool:pytest]\naddopts = -v'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Pytest',
          configFile: 'pytest.ini',
          runCommand: 'pytest',
        })
      );
    });

    it('should detect Playwright from playwright.config.js', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'playwright.config.js'),
        'module.exports = { testDir: "./tests" };'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Playwright',
          configFile: 'playwright.config.js',
          runCommand: 'playwright test',
        })
      );
    });

    it('should detect Cypress from cypress.config.ts', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'cypress.config.ts'),
        'export default { e2e: {} };'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Cypress',
          configFile: 'cypress.config.ts',
          runCommand: 'cypress run',
        })
      );
    });
  });

  describe('Test File Pattern Detection', () => {
    it('should detect Python unittest from test file patterns', async () => {
      // Create test directory and files
      await fs.promises.mkdir(path.join(tempDir, 'tests'));
      await fs.promises.writeFile(
        path.join(tempDir, 'tests', 'test_example.py'),
        'import unittest\nclass TestExample(unittest.TestCase):\n    def test_something(self):\n        pass'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Unittest',
          runCommand: 'python -m unittest',
        })
      );
    });

    it('should detect Pytest from test file patterns when no config exists', async () => {
      // Create test files without pytest.ini
      await fs.promises.writeFile(
        path.join(tempDir, 'test_sample.py'),
        'def test_example():\n    assert True'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Pytest',
          runCommand: 'pytest',
        })
      );
    });
  });

  describe('Multiple Frameworks Detection', () => {
    it('should detect multiple test frameworks in the same project', async () => {
      const packageJson = {
        name: 'multi-framework-project',
        devDependencies: {
          jest: '^29.0.0',
          cypress: '^12.0.0',
          '@playwright/test': '^1.36.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Add config files
      await fs.promises.writeFile(
        path.join(tempDir, 'jest.config.js'),
        'module.exports = {};'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'playwright.config.js'),
        'module.exports = {};'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result).toContainEqual(
        expect.objectContaining({ name: 'Jest' })
      );
      expect(result).toContainEqual(
        expect.objectContaining({ name: 'Cypress' })
      );
      expect(result).toContainEqual(
        expect.objectContaining({ name: 'Playwright' })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should return empty array when no test frameworks are detected', async () => {
      const packageJson = {
        name: 'no-test-project',
        dependencies: {
          express: '^4.18.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toEqual([]);
    });

    it('should handle missing package.json gracefully', async () => {
      const result = await analyzer.detectTestFrameworks();

      expect(Array.isArray(result)).toBe(true);
      // Should still detect frameworks based on config files or test patterns
    });

    it('should handle malformed package.json', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        'invalid json content'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Acceptance Criteria Validation', () => {
    it('should detect at least 6 different test frameworks', async () => {
      // Create a comprehensive test setup
      const packageJson = {
        name: 'comprehensive-test-project',
        devDependencies: {
          jest: '^29.0.0',
          vitest: '^0.34.0',
          mocha: '^10.0.0',
          karma: '^6.0.0',
          jasmine: '^5.0.0',
          '@playwright/test': '^1.36.0',
          cypress: '^12.0.0',
          ava: '^5.0.0',
          tape: '^5.0.0',
          qunit: '^2.19.0',
        },
        dependencies: {
          pytest: '^7.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Add some config files
      await fs.promises.writeFile(
        path.join(tempDir, 'jest.config.js'),
        'module.exports = {};'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'pytest.ini'),
        '[tool:pytest]'
      );

      const result = await analyzer.detectTestFrameworks();

      // Verify we detect at least 6 frameworks
      expect(result.length).toBeGreaterThanOrEqual(6);

      // Verify required fields are present
      result.forEach(framework => {
        expect(framework).toHaveProperty('name');
        expect(framework).toHaveProperty('runCommand');
        expect(typeof framework.name).toBe('string');
        expect(typeof framework.runCommand).toBe('string');
        expect(framework.name.length).toBeGreaterThan(0);
        expect(framework.runCommand.length).toBeGreaterThan(0);

        if (framework.configFile) {
          expect(typeof framework.configFile).toBe('string');
          expect(framework.configFile.length).toBeGreaterThan(0);
        }
      });

      // Verify specific frameworks are detected
      const frameworkNames = result.map(f => f.name);
      expect(frameworkNames).toContain('Jest');
      expect(frameworkNames).toContain('Vitest');
      expect(frameworkNames).toContain('Mocha');
      expect(frameworkNames).toContain('Pytest');
      expect(frameworkNames).toContain('Playwright');
      expect(frameworkNames).toContain('Cypress');
    });

    it('should return framework info with correct structure', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          jest: '^29.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      await fs.promises.writeFile(
        path.join(tempDir, 'jest.config.js'),
        'module.exports = {};'
      );

      const result = await analyzer.detectTestFrameworks();

      const jestFramework = result.find(f => f.name === 'Jest');
      expect(jestFramework).toBeDefined();
      expect(jestFramework?.name).toBe('Jest');
      expect(jestFramework?.configFile).toBe('jest.config.js');
      expect(jestFramework?.runCommand).toBe('npm test');
    });
  });
});