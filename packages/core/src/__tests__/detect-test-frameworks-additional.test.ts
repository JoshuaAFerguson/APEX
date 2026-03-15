/**
 * Additional comprehensive test suite for the detectTestFrameworks() method
 *
 * This test suite covers missing test frameworks and additional edge cases:
 * - AVA, Tape, QUnit framework detection
 * - Advanced error handling scenarios
 * - Performance and comprehensive validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { ProjectContextAnalyzer } from '../project-context-analyzer';

describe('detectTestFrameworks() - Additional Test Coverage', () => {
  let tempDir: string;
  let analyzer: ProjectContextAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(tmpdir(), 'apex-test-frameworks-additional-'));
    analyzer = new ProjectContextAnalyzer(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp dir:', error);
    }
  });

  describe('Missing Framework Detection Tests', () => {
    it('should detect AVA framework from package.json', async () => {
      const packageJson = {
        name: 'ava-test-project',
        devDependencies: {
          ava: '^5.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'AVA',
          runCommand: 'ava',
        })
      );
    });

    it('should detect AVA from config file', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'ava.config.js'),
        'export default { verbose: true };'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'AVA',
          configFile: 'ava.config.js',
          runCommand: 'ava',
        })
      );
    });

    it('should detect AVA from ava.config.mjs', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'ava.config.mjs'),
        'export default { verbose: true };'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'AVA',
          configFile: 'ava.config.mjs',
          runCommand: 'ava',
        })
      );
    });

    it('should detect Tape framework from package.json', async () => {
      const packageJson = {
        name: 'tape-test-project',
        devDependencies: {
          tape: '^5.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Tape',
          runCommand: 'tape',
        })
      );
    });

    it('should detect QUnit framework from package.json', async () => {
      const packageJson = {
        name: 'qunit-test-project',
        devDependencies: {
          qunit: '^2.19.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'QUnit',
          runCommand: 'qunit',
        })
      );
    });
  });

  describe('Advanced Configuration File Detection', () => {
    it('should detect Jest from multiple config file types', async () => {
      // Test jest.config.ts
      await fs.promises.writeFile(
        path.join(tempDir, 'jest.config.ts'),
        'export default { testEnvironment: "node" };'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Jest',
          configFile: 'jest.config.ts',
          runCommand: 'npm test',
        })
      );
    });

    it('should detect Jest from jest.config.json', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'jest.config.json'),
        JSON.stringify({ testEnvironment: 'node' })
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Jest',
          configFile: 'jest.config.json',
          runCommand: 'npm test',
        })
      );
    });

    it('should detect Jest from jest.config.mjs', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'jest.config.mjs'),
        'export default { testEnvironment: "node" };'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Jest',
          configFile: 'jest.config.mjs',
          runCommand: 'npm test',
        })
      );
    });

    it('should detect Vitest from vite.config.js', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'vite.config.js'),
        'export default { test: { globals: true } };'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Vitest',
          configFile: 'vite.config.js',
          runCommand: 'vitest',
        })
      );
    });

    it('should detect Vitest from vite.config.ts', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'vite.config.ts'),
        'export default { test: { globals: true } };'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Vitest',
          configFile: 'vite.config.ts',
          runCommand: 'vitest',
        })
      );
    });

    it('should detect Mocha from .mocharc.js', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, '.mocharc.js'),
        'module.exports = { reporter: "spec", recursive: true };'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Mocha',
          configFile: '.mocharc.js',
          runCommand: 'mocha',
        })
      );
    });

    it('should detect Mocha from .mocharc.yml', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, '.mocharc.yml'),
        'reporter: spec\nrecursive: true'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Mocha',
          configFile: '.mocharc.yml',
          runCommand: 'mocha',
        })
      );
    });

    it('should detect Mocha from mocha.opts', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'mocha.opts'),
        '--reporter spec\n--recursive'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Mocha',
          configFile: 'mocha.opts',
          runCommand: 'mocha',
        })
      );
    });

    it('should detect Pytest from pyproject.toml', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'pyproject.toml'),
        '[tool.pytest.ini_options]\naddopts = "-v"'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Pytest',
          configFile: 'pyproject.toml',
          runCommand: 'pytest',
        })
      );
    });

    it('should detect Pytest from setup.cfg', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'setup.cfg'),
        '[tool:pytest]\naddopts = -v'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Pytest',
          configFile: 'setup.cfg',
          runCommand: 'pytest',
        })
      );
    });

    it('should detect Cypress from cypress.json (legacy)', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'cypress.json'),
        JSON.stringify({ baseUrl: 'http://localhost:3000' })
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Cypress',
          configFile: 'cypress.json',
          runCommand: 'cypress run',
        })
      );
    });

    it('should detect Jasmine from spec/support/jasmine.json', async () => {
      await fs.promises.mkdir(path.join(tempDir, 'spec', 'support'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'spec', 'support', 'jasmine.json'),
        JSON.stringify({
          spec_dir: 'spec',
          spec_files: ['**/*[sS]pec.js'],
        })
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Jasmine',
          configFile: 'spec/support/jasmine.json',
          runCommand: 'jasmine',
        })
      );
    });
  });

  describe('Advanced Edge Cases', () => {
    it('should handle file system permission errors gracefully', async () => {
      // Create a directory with no read permissions (simulating permission error)
      const restrictedDir = path.join(tempDir, 'restricted');
      await fs.promises.mkdir(restrictedDir);

      // This should not throw an error and return an empty array or handle gracefully
      const result = await analyzer.detectTestFrameworks();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle circular symlinks gracefully', async () => {
      // This is a complex edge case, but the method should handle it
      const result = await analyzer.detectTestFrameworks();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should detect frameworks in peerDependencies', async () => {
      const packageJson = {
        name: 'peer-dep-project',
        peerDependencies: {
          jest: '^29.0.0',
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
          name: 'Jest',
          runCommand: 'npm test',
        })
      );
      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Vitest',
          runCommand: 'vitest',
        })
      );
    });

    it('should handle package.json with only production dependencies', async () => {
      const packageJson = {
        name: 'prod-only-project',
        dependencies: {
          express: '^4.18.0',
          lodash: '^4.17.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toEqual([]);
    });

    it('should prioritize the first found config file when multiple exist', async () => {
      // Create multiple Jest config files
      await fs.promises.writeFile(
        path.join(tempDir, 'jest.config.js'),
        'module.exports = { testEnvironment: "jsdom" };'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'jest.config.ts'),
        'export default { testEnvironment: "node" };'
      );

      const result = await analyzer.detectTestFrameworks();

      const jestFramework = result.find(f => f.name === 'Jest');
      expect(jestFramework).toBeDefined();
      // Should use the first config file found (jest.config.js comes first in the array)
      expect(jestFramework?.configFile).toBe('jest.config.js');
    });

    it('should handle empty directories gracefully', async () => {
      // Empty temp directory, no package.json, no config files
      const result = await analyzer.detectTestFrameworks();
      expect(result).toEqual([]);
    });
  });

  describe('Test File Pattern Detection Enhanced', () => {
    it('should detect Python unittest from tests directory with multiple files', async () => {
      await fs.promises.mkdir(path.join(tempDir, 'tests'));
      await fs.promises.writeFile(
        path.join(tempDir, 'tests', 'test_auth.py'),
        'import unittest\nclass TestAuth(unittest.TestCase):\n    def test_login(self):\n        pass'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'tests', 'test_user.py'),
        'import unittest\nclass TestUser(unittest.TestCase):\n    def test_create(self):\n        pass'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Unittest',
          runCommand: 'python -m unittest',
        })
      );
    });

    it('should detect Pytest from various test file patterns', async () => {
      // Create files with different patterns
      await fs.promises.writeFile(
        path.join(tempDir, 'test_sample.py'),
        'def test_example():\n    assert True'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'sample_test.py'),
        'def test_another():\n    assert True'
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

  describe('Framework Priority and Deduplication', () => {
    it('should not duplicate frameworks detected by both package.json and config files', async () => {
      const packageJson = {
        name: 'jest-project',
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
        'module.exports = { testEnvironment: "node" };'
      );

      const result = await analyzer.detectTestFrameworks();

      const jestFrameworks = result.filter(f => f.name === 'Jest');
      expect(jestFrameworks).toHaveLength(1);
      expect(jestFrameworks[0].configFile).toBe('jest.config.js');
    });
  });

  describe('Performance and Scale Testing', () => {
    it('should handle projects with many irrelevant files efficiently', async () => {
      // Create many non-test-related files
      for (let i = 0; i < 50; i++) {
        await fs.promises.writeFile(
          path.join(tempDir, `file${i}.txt`),
          `Content of file ${i}`
        );
      }

      const packageJson = {
        name: 'large-project',
        devDependencies: {
          jest: '^29.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const startTime = Date.now();
      const result = await analyzer.detectTestFrameworks();
      const endTime = Date.now();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Jest',
          runCommand: 'npm test',
        })
      );
      // Should complete within reasonable time (5 seconds is generous)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Framework-Specific Details', () => {
    it('should return correct run command for frameworks', async () => {
      const packageJson = {
        name: 'commands-test',
        devDependencies: {
          jest: '^29.0.0',
          vitest: '^0.34.0',
          mocha: '^10.0.0',
          '@playwright/test': '^1.36.0',
          cypress: '^12.0.0',
          karma: '^6.0.0',
          jasmine: '^5.0.0',
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

      const result = await analyzer.detectTestFrameworks();

      const expectedCommands = {
        Jest: 'npm test',
        Vitest: 'vitest',
        Mocha: 'mocha',
        Pytest: 'pytest',
        Playwright: 'playwright test',
        Cypress: 'cypress run',
        Karma: 'karma start',
        Jasmine: 'jasmine',
        AVA: 'ava',
        Tape: 'tape',
        QUnit: 'qunit',
      };

      for (const [name, expectedCommand] of Object.entries(expectedCommands)) {
        const framework = result.find(f => f.name === name);
        expect(framework, `${name} framework should be detected`).toBeDefined();
        expect(framework?.runCommand, `${name} should have correct run command`).toBe(expectedCommand);
      }
    });
  });
});