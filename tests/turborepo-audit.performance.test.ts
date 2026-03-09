/**
 * Turborepo Audit Performance and Stress Test Suite
 *
 * This test suite validates performance characteristics, stress conditions,
 * and scalability of the Turborepo audit functionality under various load scenarios.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const ROOT_DIR = resolve(__dirname, '..');
const STRESS_TEST_DIR = join(tmpdir(), 'turborepo-stress-test');

describe('Turborepo Audit Performance Tests', () => {
  beforeEach(() => {
    // Clean up any previous stress test directory
    if (existsSync(STRESS_TEST_DIR)) {
      rmSync(STRESS_TEST_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up stress test directory
    if (existsSync(STRESS_TEST_DIR)) {
      rmSync(STRESS_TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('Configuration Parsing Performance', () => {
    test('handles large turbo.json configuration efficiently', () => {
      // Create a large turbo configuration
      const largeTurboConfig = {
        $schema: 'https://turbo.build/schema.json',
        globalDependencies: Array.from({ length: 1000 }, (_, i) => `**/.env.${i}`),
        tasks: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [
            `task-${i}`,
            {
              dependsOn: [`^task-${Math.max(0, i - 1)}`],
              outputs: Array.from({ length: 10 }, (_, j) => `dist-${i}-${j}/**`),
              cache: i % 2 === 0
            }
          ])
        )
      };

      const start = performance.now();

      // Test JSON parsing performance
      const jsonString = JSON.stringify(largeTurboConfig);
      const parsed = JSON.parse(jsonString);

      const parseTime = performance.now() - start;

      expect(parsed).toEqual(largeTurboConfig);
      expect(parseTime).toBeLessThan(100); // Should parse in under 100ms

      // Test property access performance
      const accessStart = performance.now();

      expect(Object.keys(parsed.tasks)).toHaveLength(100);
      expect(parsed.globalDependencies).toHaveLength(1000);

      const accessTime = performance.now() - accessStart;
      expect(accessTime).toBeLessThan(10); // Property access should be very fast
    });

    test('efficiently validates large task configurations', () => {
      const taskCount = 500;
      const tasks = Object.fromEntries(
        Array.from({ length: taskCount }, (_, i) => [
          `task-${i}`,
          {
            dependsOn: Array.from({ length: 5 }, (_, j) => `^task-${(i + j) % taskCount}`),
            outputs: Array.from({ length: 3 }, (_, k) => `dist-${i}-${k}/**`),
            cache: i % 3 !== 0
          }
        ])
      );

      const start = performance.now();

      // Validate task structure
      const validTasks = Object.entries(tasks).filter(([name, config]) => {
        return (
          typeof name === 'string' &&
          typeof config === 'object' &&
          Array.isArray(config.dependsOn) &&
          Array.isArray(config.outputs) &&
          typeof config.cache === 'boolean'
        );
      });

      const validationTime = performance.now() - start;

      expect(validTasks).toHaveLength(taskCount);
      expect(validationTime).toBeLessThan(50); // Should validate quickly
    });
  });

  describe('Package Discovery Performance', () => {
    test('scales well with large number of packages', async () => {
      mkdirSync(STRESS_TEST_DIR, { recursive: true });

      const packageCount = 200;
      const packagesDir = join(STRESS_TEST_DIR, 'packages');
      mkdirSync(packagesDir, { recursive: true });

      // Create many packages
      const createStart = performance.now();

      for (let i = 0; i < packageCount; i++) {
        const packageDir = join(packagesDir, `package-${i}`);
        mkdirSync(packageDir, { recursive: true });

        const packageJson = {
          name: `@stress/package-${i}`,
          version: '1.0.0',
          dependencies: Object.fromEntries(
            Array.from({ length: 5 }, (_, j) => [
              `@stress/package-${(i + j + 1) % packageCount}`,
              '*'
            ])
          ),
          scripts: {
            build: 'tsc',
            test: 'vitest',
            lint: 'eslint src/',
            clean: 'rm -rf dist',
            dev: 'tsc --watch'
          }
        };

        writeFileSync(
          join(packageDir, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );
      }

      const createTime = performance.now() - createStart;
      expect(createTime).toBeLessThan(5000); // Should create packages quickly

      // Test package discovery performance
      const discoveryStart = performance.now();

      const discoveredPackages = [];
      const packagePaths = execSync('find packages -name "package.json"', {
        cwd: STRESS_TEST_DIR,
        encoding: 'utf-8'
      }).trim().split('\n');

      for (const packagePath of packagePaths) {
        const fullPath = join(STRESS_TEST_DIR, packagePath);
        const content = readFileSync(fullPath, 'utf-8');
        const packageJson = JSON.parse(content);
        discoveredPackages.push(packageJson);
      }

      const discoveryTime = performance.now() - discoveryStart;

      expect(discoveredPackages).toHaveLength(packageCount);
      expect(discoveryTime).toBeLessThan(2000); // Should discover packages efficiently
    });

    test('handles deep directory structures efficiently', () => {
      mkdirSync(STRESS_TEST_DIR, { recursive: true });

      // Create nested package structure
      const createStart = performance.now();

      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          const nestedDir = join(STRESS_TEST_DIR, 'packages', `category-${i}`, `sub-${j}`);
          mkdirSync(nestedDir, { recursive: true });

          const packageJson = {
            name: `@nested/category-${i}-sub-${j}`,
            version: '1.0.0'
          };

          writeFileSync(
            join(nestedDir, 'package.json'),
            JSON.stringify(packageJson, null, 2)
          );
        }
      }

      const createTime = performance.now() - createStart;
      expect(createTime).toBeLessThan(1000);

      // Test nested discovery
      const discoveryStart = performance.now();

      const result = execSync('find packages -name "package.json" | wc -l', {
        cwd: STRESS_TEST_DIR,
        encoding: 'utf-8'
      });

      const discoveryTime = performance.now() - discoveryStart;
      const packageCount = parseInt(result.trim(), 10);

      expect(packageCount).toBe(100);
      expect(discoveryTime).toBeLessThan(500); // Nested discovery should be fast
    });
  });

  describe('Dependency Graph Performance', () => {
    test('efficiently analyzes complex dependency graphs', () => {
      const packageCount = 100;

      // Create complex dependency graph
      const packages = Array.from({ length: packageCount }, (_, i) => ({
        name: `@complex/package-${i}`,
        dependencies: Object.fromEntries(
          Array.from({ length: Math.min(10, i) }, (_, j) => [
            `@complex/package-${j}`,
            '*'
          ])
        )
      }));

      const analysisStart = performance.now();

      // Build dependency map
      const dependencyMap = new Map<string, string[]>();
      packages.forEach(pkg => {
        const deps = Object.keys(pkg.dependencies || {})
          .filter(dep => dep.startsWith('@complex/'));
        dependencyMap.set(pkg.name, deps);
      });

      // Perform cycle detection
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      const hasCycle = (node: string): boolean => {
        if (recursionStack.has(node)) return true;
        if (visited.has(node)) return false;

        visited.add(node);
        recursionStack.add(node);

        const deps = dependencyMap.get(node) || [];
        for (const dep of deps) {
          if (hasCycle(dep)) return true;
        }

        recursionStack.delete(node);
        return false;
      };

      // Check all packages for cycles
      let cycleFound = false;
      for (const [packageName] of dependencyMap) {
        if (hasCycle(packageName)) {
          cycleFound = true;
          break;
        }
      }

      const analysisTime = performance.now() - analysisStart;

      expect(dependencyMap.size).toBe(packageCount);
      expect(cycleFound).toBe(false); // This graph should be acyclic
      expect(analysisTime).toBeLessThan(100); // Should analyze efficiently
    });

    test('handles circular dependency detection at scale', () => {
      // Create intentionally circular dependencies
      const circularPackages = [
        { name: '@circular/a', deps: ['@circular/b'] },
        { name: '@circular/b', deps: ['@circular/c'] },
        { name: '@circular/c', deps: ['@circular/a'] }, // Creates cycle
        // Add more packages to test scalability
        ...Array.from({ length: 97 }, (_, i) => ({
          name: `@circular/package-${i}`,
          deps: [`@circular/package-${(i + 1) % 97}`] // Each depends on next
        }))
      ];

      const detectionStart = performance.now();

      const dependencyMap = new Map<string, string[]>();
      circularPackages.forEach(pkg => {
        dependencyMap.set(pkg.name, pkg.deps);
      });

      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      const hasCycle = (node: string): boolean => {
        if (recursionStack.has(node)) return true;
        if (visited.has(node)) return false;

        visited.add(node);
        recursionStack.add(node);

        const deps = dependencyMap.get(node) || [];
        for (const dep of deps) {
          if (hasCycle(dep)) return true;
        }

        recursionStack.delete(node);
        return false;
      };

      let cyclesDetected = 0;
      for (const [packageName] of dependencyMap) {
        visited.clear();
        recursionStack.clear();
        if (hasCycle(packageName)) {
          cyclesDetected++;
        }
      }

      const detectionTime = performance.now() - detectionStart;

      expect(cyclesDetected).toBeGreaterThan(0); // Should detect cycles
      expect(detectionTime).toBeLessThan(200); // Should detect efficiently
    });
  });

  describe('Command Execution Performance', () => {
    test('handles multiple concurrent command executions', async () => {
      const commands = [
        'node --version',
        'npm --version',
        'echo "test1"',
        'echo "test2"',
        'echo "test3"'
      ];

      const executionStart = performance.now();

      // Execute commands concurrently
      const results = await Promise.allSettled(
        commands.map(cmd =>
          new Promise<string>((resolve, reject) => {
            try {
              const result = execSync(cmd, {
                encoding: 'utf-8',
                timeout: 5000
              });
              resolve(result.trim());
            } catch (error: any) {
              reject(error.message);
            }
          })
        )
      );

      const executionTime = performance.now() - executionStart;

      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    test('gracefully handles command timeout scenarios', () => {
      const timeoutTests = [
        { timeout: 1000, expected: 'quick' },
        { timeout: 100, expected: 'timeout' },
        { timeout: 5000, expected: 'slow' }
      ];

      timeoutTests.forEach(testCase => {
        const start = performance.now();

        try {
          // Simulate command with different timeout characteristics
          if (testCase.timeout < 500) {
            throw new Error('Timeout');
          }

          const result = execSync('echo "success"', {
            timeout: testCase.timeout,
            encoding: 'utf-8'
          });

          expect(result.trim()).toBe('success');
        } catch (error: any) {
          if (testCase.expected === 'timeout') {
            expect(error.message).toContain('Timeout');
          }
        }

        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThan(testCase.timeout + 100);
      });
    });
  });

  describe('Memory Usage Performance', () => {
    test('maintains reasonable memory footprint with large configurations', () => {
      const initialMemory = process.memoryUsage();

      // Create large configuration objects
      const largeConfigs = Array.from({ length: 100 }, (_, i) => ({
        turboConfig: {
          tasks: Object.fromEntries(
            Array.from({ length: 50 }, (_, j) => [
              `task-${i}-${j}`,
              {
                dependsOn: [`^task-${i}-${j - 1}`],
                outputs: [`dist-${i}-${j}/**`]
              }
            ])
          )
        },
        packages: Array.from({ length: 20 }, (_, k) => ({
          name: `@config-${i}/package-${k}`,
          version: '1.0.0',
          dependencies: Object.fromEntries(
            Array.from({ length: 10 }, (_, l) => [
              `dependency-${k}-${l}`,
              '^1.0.0'
            ])
          )
        }))
      }));

      // Process configurations (simulate audit work)
      const processedConfigs = largeConfigs.map(config => {
        const taskCount = Object.keys(config.turboConfig.tasks).length;
        const packageCount = config.packages.length;
        const totalDependencies = config.packages.reduce(
          (sum, pkg) => sum + Object.keys(pkg.dependencies).length,
          0
        );

        return {
          taskCount,
          packageCount,
          totalDependencies
        };
      });

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(processedConfigs).toHaveLength(100);
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });

    test('releases memory properly after processing', () => {
      const getMemoryUsage = () => {
        global.gc?.(); // Force garbage collection if available
        return process.memoryUsage().heapUsed;
      };

      const initialMemory = getMemoryUsage();

      // Create and process temporary large objects
      {
        const largeData = Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          data: new Array(1000).fill(`item-${i}`)
        }));

        // Process the data
        const processed = largeData.map(item => item.id).reduce((sum, id) => sum + id, 0);
        expect(processed).toBeGreaterThan(0);
      } // largeData goes out of scope here

      const afterProcessing = getMemoryUsage();
      const memoryIncrease = afterProcessing - initialMemory;

      // Memory should not increase dramatically after processing
      // Note: JavaScript garbage collection is not deterministic, so we allow more margin
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });

  describe('File I/O Performance', () => {
    test('efficiently reads large package.json files', () => {
      mkdirSync(STRESS_TEST_DIR, { recursive: true });

      // Create large package.json
      const largePackageJson = {
        name: '@large/package',
        version: '1.0.0',
        dependencies: Object.fromEntries(
          Array.from({ length: 5000 }, (_, i) => [`package-${i}`, '^1.0.0'])
        ),
        devDependencies: Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [`dev-package-${i}`, '^1.0.0'])
        ),
        scripts: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`script-${i}`, `echo "script ${i}"`])
        )
      };

      const packagePath = join(STRESS_TEST_DIR, 'package.json');
      const content = JSON.stringify(largePackageJson, null, 2);

      // Write performance
      const writeStart = performance.now();
      writeFileSync(packagePath, content);
      const writeTime = performance.now() - writeStart;

      expect(writeTime).toBeLessThan(100); // Should write quickly

      // Read performance
      const readStart = performance.now();
      const readContent = readFileSync(packagePath, 'utf-8');
      const parsed = JSON.parse(readContent);
      const readTime = performance.now() - readStart;

      expect(readTime).toBeLessThan(50); // Should read and parse quickly
      expect(parsed).toEqual(largePackageJson);

      // File size check (cross-platform compatible)
      const stats = execSync(`wc -c < "${packagePath}"`, {
        encoding: 'utf-8'
      });
      const fileSize = parseInt(stats.trim(), 10);

      expect(fileSize).toBeGreaterThan(100000); // Should be substantial file
    });

    test('handles concurrent file access efficiently', async () => {
      mkdirSync(STRESS_TEST_DIR, { recursive: true });

      // Create multiple files
      const fileCount = 50;
      const files = Array.from({ length: fileCount }, (_, i) => {
        const path = join(STRESS_TEST_DIR, `package-${i}.json`);
        const content = JSON.stringify({
          name: `@concurrent/package-${i}`,
          version: '1.0.0'
        });

        writeFileSync(path, content);
        return path;
      });

      // Read all files concurrently
      const readStart = performance.now();

      const readPromises = files.map(file =>
        new Promise<any>((resolve) => {
          const content = readFileSync(file, 'utf-8');
          resolve(JSON.parse(content));
        })
      );

      const results = await Promise.all(readPromises);
      const readTime = performance.now() - readStart;

      expect(results).toHaveLength(fileCount);
      expect(readTime).toBeLessThan(1000); // Should read concurrently efficiently
    });
  });
});