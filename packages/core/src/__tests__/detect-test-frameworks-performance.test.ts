/**
 * Performance and Memory Efficiency Test Suite for detectTestFrameworks() method
 *
 * This test suite focuses on ensuring the detectTestFrameworks() method performs
 * efficiently under various load conditions and doesn't have memory leaks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { ProjectContextAnalyzer } from '../project-context-analyzer';

describe('detectTestFrameworks() - Performance and Memory Tests', () => {
  let tempDir: string;
  let analyzer: ProjectContextAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(tmpdir(), 'apex-perf-test-'));
    analyzer = new ProjectContextAnalyzer(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp dir:', error);
    }
  });

  describe('Performance Benchmarks', () => {
    it('should complete detection within reasonable time for empty project', async () => {
      const startTime = process.hrtime.bigint();
      const result = await analyzer.detectTestFrameworks();
      const endTime = process.hrtime.bigint();

      const executionTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result).toEqual([]);
      expect(executionTimeMs).toBeLessThan(100); // Should complete in under 100ms for empty project
    });

    it('should complete detection within reasonable time for single framework', async () => {
      const packageJson = {
        name: 'single-framework',
        devDependencies: {
          jest: '^29.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const startTime = process.hrtime.bigint();
      const result = await analyzer.detectTestFrameworks();
      const endTime = process.hrtime.bigint();

      const executionTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Jest');
      expect(executionTimeMs).toBeLessThan(200); // Should complete in under 200ms
    });

    it('should scale linearly with number of frameworks', async () => {
      // Test with progressively more frameworks
      const frameworkSets = [
        { jest: '^29.0.0' },
        { jest: '^29.0.0', vitest: '^0.34.0' },
        { jest: '^29.0.0', vitest: '^0.34.0', mocha: '^10.0.0' },
        { jest: '^29.0.0', vitest: '^0.34.0', mocha: '^10.0.0', karma: '^6.0.0' },
        { jest: '^29.0.0', vitest: '^0.34.0', mocha: '^10.0.0', karma: '^6.0.0', jasmine: '^5.0.0' },
      ];

      const executionTimes = [];

      for (const frameworks of frameworkSets) {
        // Clean up previous test
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        tempDir = await fs.promises.mkdtemp(path.join(tmpdir(), 'apex-perf-scale-'));
        analyzer = new ProjectContextAnalyzer(tempDir);

        const packageJson = {
          name: 'scaling-test',
          devDependencies: frameworks,
        };
        await fs.promises.writeFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );

        const startTime = process.hrtime.bigint();
        const result = await analyzer.detectTestFrameworks();
        const endTime = process.hrtime.bigint();

        const executionTimeMs = Number(endTime - startTime) / 1_000_000;
        executionTimes.push(executionTimeMs);

        expect(result.length).toBe(Object.keys(frameworks).length);
      }

      // Execution time should not increase exponentially
      // Allow some variance but ensure reasonable scaling
      const maxTime = Math.max(...executionTimes);
      expect(maxTime).toBeLessThan(500); // Even with 5 frameworks, should complete in under 500ms
    });

    it('should handle large projects with many irrelevant files efficiently', async () => {
      // Create a large number of non-test-related files
      const numFiles = 1000;
      const directories = ['src', 'lib', 'assets', 'docs', 'scripts'];

      for (const dir of directories) {
        await fs.promises.mkdir(path.join(tempDir, dir), { recursive: true });

        for (let i = 0; i < numFiles / directories.length; i++) {
          await fs.promises.writeFile(
            path.join(tempDir, dir, `file${i}.js`),
            `// File ${i} in ${dir}\nconsole.log('${dir}/file${i}');`
          );
        }
      }

      // Add a single test framework
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

      const startTime = process.hrtime.bigint();
      const result = await analyzer.detectTestFrameworks();
      const endTime = process.hrtime.bigint();

      const executionTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result).toContainEqual(
        expect.objectContaining({ name: 'Jest' })
      );
      expect(executionTimeMs).toBeLessThan(2000); // Should complete in under 2 seconds even with 1000 files
    });

    it('should handle deep directory structures efficiently', async () => {
      // Create deeply nested directory structure
      let currentPath = tempDir;
      const depthLevels = 20;

      for (let i = 0; i < depthLevels; i++) {
        currentPath = path.join(currentPath, `level${i}`);
        await fs.promises.mkdir(currentPath, { recursive: true });

        // Add some files at each level
        await fs.promises.writeFile(
          path.join(currentPath, `file${i}.js`),
          `// Level ${i} file`
        );
      }

      // Add test framework at root
      const cargoToml = `[package]
name = "deep-project"
version = "0.1.0"
edition = "2021"`;

      await fs.promises.writeFile(path.join(tempDir, 'Cargo.toml'), cargoToml);

      const startTime = process.hrtime.bigint();
      const result = await analyzer.detectTestFrameworks();
      const endTime = process.hrtime.bigint();

      const executionTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result).toContainEqual(
        expect.objectContaining({ name: 'Cargo Test' })
      );
      expect(executionTimeMs).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('Memory Efficiency', () => {
    it('should not accumulate memory across multiple calls', async () => {
      const packageJson = {
        name: 'memory-test',
        devDependencies: {
          jest: '^29.0.0',
          vitest: '^0.34.0',
          mocha: '^10.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Get initial memory usage
      const initialMemory = process.memoryUsage();

      // Run detection multiple times
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        const result = await analyzer.detectTestFrameworks();
        expect(result.length).toBe(3);
      }

      // Check memory usage hasn't grown significantly
      const finalMemory = process.memoryUsage();
      const memoryGrowthMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      // Memory growth should be minimal (less than 10MB for 100 iterations)
      expect(memoryGrowthMB).toBeLessThan(10);
    });

    it('should handle large file contents without excessive memory usage', async () => {
      // Create a very large package.json with many dependencies
      const largeDependencies: Record<string, string> = {};

      // Add 1000 fake dependencies
      for (let i = 0; i < 1000; i++) {
        largeDependencies[`fake-package-${i}`] = `^1.0.${i}`;
      }

      // Add real test frameworks among the large number of dependencies
      largeDependencies.jest = '^29.0.0';
      largeDependencies.vitest = '^0.34.0';
      largeDependencies.mocha = '^10.0.0';

      const largePackageJson = {
        name: 'large-dependencies-project',
        devDependencies: largeDependencies,
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(largePackageJson, null, 2)
      );

      const initialMemory = process.memoryUsage();

      const result = await analyzer.detectTestFrameworks();

      const finalMemory = process.memoryUsage();
      const memoryUsedMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      expect(result).toContainEqual(expect.objectContaining({ name: 'Jest' }));
      expect(result).toContainEqual(expect.objectContaining({ name: 'Vitest' }));
      expect(result).toContainEqual(expect.objectContaining({ name: 'Mocha' }));

      // Should not use excessive memory (less than 50MB) even with large JSON
      expect(memoryUsedMB).toBeLessThan(50);
    });

    it('should properly release resources for file operations', async () => {
      // Create multiple config files
      await fs.promises.writeFile(path.join(tempDir, 'jest.config.js'), 'module.exports = {};');
      await fs.promises.writeFile(path.join(tempDir, 'vitest.config.ts'), 'export default {};');
      await fs.promises.writeFile(path.join(tempDir, '.mocharc.json'), '{}');
      await fs.promises.writeFile(path.join(tempDir, 'pytest.ini'), '[tool:pytest]');
      await fs.promises.writeFile(path.join(tempDir, 'Cargo.toml'), '[package]\nname = "test"');
      await fs.promises.writeFile(path.join(tempDir, '.rspec'), '--color');
      await fs.promises.writeFile(path.join(tempDir, 'pom.xml'), '<project></project>');

      const initialMemory = process.memoryUsage();

      // Run multiple times to ensure no resource leaks
      for (let i = 0; i < 50; i++) {
        const result = await analyzer.detectTestFrameworks();
        expect(result.length).toBeGreaterThan(0);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowthMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      // Memory growth should be minimal
      expect(memoryGrowthMB).toBeLessThan(5);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent calls safely', async () => {
      const packageJson = {
        name: 'concurrent-test',
        devDependencies: {
          jest: '^29.0.0',
          vitest: '^0.34.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Run multiple concurrent detections
      const concurrentCalls = 10;
      const promises = Array.from({ length: concurrentCalls }, () =>
        analyzer.detectTestFrameworks()
      );

      const startTime = process.hrtime.bigint();
      const results = await Promise.all(promises);
      const endTime = process.hrtime.bigint();

      const totalTimeMs = Number(endTime - startTime) / 1_000_000;

      // All results should be identical
      const expectedLength = results[0].length;
      results.forEach(result => {
        expect(result.length).toBe(expectedLength);
        expect(result).toContainEqual(expect.objectContaining({ name: 'Jest' }));
        expect(result).toContainEqual(expect.objectContaining({ name: 'Vitest' }));
      });

      // Total time shouldn't be much more than sequential (efficient concurrent handling)
      expect(totalTimeMs).toBeLessThan(2000);
    });

    it('should handle rapid successive calls efficiently', async () => {
      const packageJson = {
        name: 'rapid-calls-test',
        devDependencies: {
          jest: '^29.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const startTime = process.hrtime.bigint();

      // Make rapid successive calls
      const results = [];
      for (let i = 0; i < 20; i++) {
        const result = await analyzer.detectTestFrameworks();
        results.push(result);
      }

      const endTime = process.hrtime.bigint();
      const totalTimeMs = Number(endTime - startTime) / 1_000_000;

      // All results should be consistent
      results.forEach(result => {
        expect(result).toContainEqual(expect.objectContaining({ name: 'Jest' }));
      });

      // Should complete rapidly
      expect(totalTimeMs).toBeLessThan(1000);
    });
  });

  describe('Stress Testing', () => {
    it('should handle projects with all supported frameworks simultaneously', async () => {
      // Create the most comprehensive test setup possible
      const packageJson = {
        name: 'all-frameworks-stress-test',
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

      // Add all possible config files
      await fs.promises.writeFile(path.join(tempDir, 'jest.config.js'), 'module.exports = {};');
      await fs.promises.writeFile(path.join(tempDir, 'vitest.config.ts'), 'export default {};');
      await fs.promises.writeFile(path.join(tempDir, '.mocharc.json'), '{}');
      await fs.promises.writeFile(path.join(tempDir, 'karma.conf.js'), 'module.exports = {};');
      await fs.promises.writeFile(path.join(tempDir, 'jasmine.json'), '{}');
      await fs.promises.writeFile(path.join(tempDir, 'playwright.config.js'), 'module.exports = {};');
      await fs.promises.writeFile(path.join(tempDir, 'cypress.config.ts'), 'export default {};');
      await fs.promises.writeFile(path.join(tempDir, 'ava.config.js'), 'export default {};');
      await fs.promises.writeFile(path.join(tempDir, 'pytest.ini'), '[tool:pytest]');
      await fs.promises.writeFile(path.join(tempDir, 'Cargo.toml'), '[package]\nname = "all"');
      await fs.promises.writeFile(path.join(tempDir, '.rspec'), '--color');
      await fs.promises.writeFile(path.join(tempDir, 'pom.xml'), '<project></project>');
      await fs.promises.writeFile(path.join(tempDir, 'build.gradle'), 'plugins { id "java" }');

      // Add test directories and files
      await fs.promises.mkdir(path.join(tempDir, 'tests'), { recursive: true });
      await fs.promises.mkdir(path.join(tempDir, 'spec'), { recursive: true });
      await fs.promises.mkdir(path.join(tempDir, 'src', 'test', 'java'), { recursive: true });

      await fs.promises.writeFile(
        path.join(tempDir, 'tests', 'test_example.py'),
        'import unittest\nclass Test(unittest.TestCase):\n    def test_it(self): pass'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'spec', 'example_spec.rb'),
        'RSpec.describe "Example" do\nend'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'src', 'test', 'java', 'Test.java'),
        'import org.junit.Test;\nclass Test {}'
      );

      const startTime = process.hrtime.bigint();
      const result = await analyzer.detectTestFrameworks();
      const endTime = process.hrtime.bigint();

      const executionTimeMs = Number(endTime - startTime) / 1_000_000;

      // Should detect all frameworks
      expect(result.length).toBeGreaterThanOrEqual(10);

      // Should complete within reasonable time even with all frameworks
      expect(executionTimeMs).toBeLessThan(3000);

      // Verify specific frameworks are detected
      const frameworkNames = result.map(f => f.name);
      expect(frameworkNames).toContain('Jest');
      expect(frameworkNames).toContain('Vitest');
      expect(frameworkNames).toContain('Mocha');
      expect(frameworkNames).toContain('Cargo Test');
      expect(frameworkNames).toContain('RSpec');
      expect(frameworkNames).toContain('JUnit');
    });

    it('should maintain performance under repeated load', async () => {
      const packageJson = {
        name: 'load-test',
        devDependencies: {
          jest: '^29.0.0',
          vitest: '^0.34.0',
          mocha: '^10.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Run the same detection many times and track performance
      const iterations = 200;
      const executionTimes = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = process.hrtime.bigint();
        const result = await analyzer.detectTestFrameworks();
        const endTime = process.hrtime.bigint();

        const executionTimeMs = Number(endTime - startTime) / 1_000_000;
        executionTimes.push(executionTimeMs);

        expect(result.length).toBe(3);
      }

      // Performance should remain consistent (no performance degradation)
      const firstHalfAvg = executionTimes.slice(0, iterations / 2).reduce((a, b) => a + b, 0) / (iterations / 2);
      const secondHalfAvg = executionTimes.slice(iterations / 2).reduce((a, b) => a + b, 0) / (iterations / 2);

      // Second half shouldn't be significantly slower than first half
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 2);
      expect(Math.max(...executionTimes)).toBeLessThan(500); // No individual call should exceed 500ms
    });
  });
});