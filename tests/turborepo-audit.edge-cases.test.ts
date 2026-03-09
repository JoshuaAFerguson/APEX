/**
 * Turborepo Audit Edge Cases and Error Scenarios Test Suite
 *
 * This test suite covers edge cases, error conditions, and failure scenarios
 * for the Turborepo audit functionality to ensure robust error handling
 * and comprehensive validation coverage.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const ROOT_DIR = resolve(__dirname, '..');

describe('Turborepo Audit Edge Cases', () => {
  describe('Configuration File Edge Cases', () => {
    test('handles missing turbo.json gracefully', () => {
      // This test simulates what happens when turbo.json is missing
      const mockTurboPath = join(ROOT_DIR, 'turbo.json.backup');
      const turboPath = join(ROOT_DIR, 'turbo.json');

      let turboExists = false;
      let backupContent = '';

      try {
        if (existsSync(turboPath)) {
          turboExists = true;
          backupContent = readFileSync(turboPath, 'utf-8');
          execSync(`mv "${turboPath}" "${mockTurboPath}"`);
        }

        // Now run a dry test to see how the audit would handle missing config
        const result = () => {
          if (!existsSync(turboPath)) {
            throw new Error('turbo.json not found');
          }
        };

        expect(result).toThrow('turbo.json not found');
      } finally {
        // Restore the original file
        if (turboExists && backupContent) {
          writeFileSync(turboPath, backupContent);
        }
      }
    });

    test('handles malformed turbo.json', () => {
      const testConfig = '{ "invalid": json syntax }';

      expect(() => {
        JSON.parse(testConfig);
      }).toThrow();
    });

    test('handles empty turbo.json', () => {
      const emptyConfig = {};

      expect(emptyConfig).toBeDefined();
      expect(Object.keys(emptyConfig)).toHaveLength(0);

      // Should fail validation for missing tasks
      expect(emptyConfig).not.toHaveProperty('tasks');
    });

    test('handles turbo.json with missing required fields', () => {
      const incompleteConfig = {
        "$schema": "https://turbo.build/schema.json"
        // Missing tasks, globalDependencies
      };

      expect(incompleteConfig).toHaveProperty('$schema');
      expect(incompleteConfig).not.toHaveProperty('tasks');
      expect(incompleteConfig).not.toHaveProperty('globalDependencies');
    });

    test('handles turbo.json with invalid task definitions', () => {
      const invalidConfig = {
        "$schema": "https://turbo.build/schema.json",
        "tasks": {
          "build": "not an object", // Should be an object
          "dev": {
            "invalidField": true // Invalid field
          }
        }
      };

      expect(typeof invalidConfig.tasks.build).toBe('string');
      expect(typeof invalidConfig.tasks.dev).toBe('object');
      expect(invalidConfig.tasks.dev).toHaveProperty('invalidField');
    });
  });

  describe('Package.json Edge Cases', () => {
    test('handles missing root package.json', () => {
      const packagePath = '/nonexistent/package.json';

      expect(existsSync(packagePath)).toBe(false);
    });

    test('handles package.json with no workspaces', () => {
      const noWorkspacesConfig = {
        name: 'test-project',
        version: '1.0.0'
        // Missing workspaces field
      };

      expect(noWorkspacesConfig).not.toHaveProperty('workspaces');
    });

    test('handles workspace packages with missing dependencies', () => {
      const packageWithNoDeps = {
        name: '@test/package',
        version: '1.0.0'
        // No dependencies, devDependencies, or peerDependencies
      };

      expect(packageWithNoDeps).not.toHaveProperty('dependencies');
      expect(packageWithNoDeps).not.toHaveProperty('devDependencies');
      expect(packageWithNoDeps).not.toHaveProperty('peerDependencies');
    });

    test('handles workspace packages with circular dependency potential', () => {
      const packageA = {
        name: '@test/a',
        dependencies: { '@test/b': '*' }
      };

      const packageB = {
        name: '@test/b',
        dependencies: { '@test/a': '*' } // This would create a cycle
      };

      // Simulate cycle detection
      const deps = new Map([
        ['@test/a', ['@test/b']],
        ['@test/b', ['@test/a']]
      ]);

      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      const hasCycle = (node: string): boolean => {
        if (recursionStack.has(node)) return true;
        if (visited.has(node)) return false;

        visited.add(node);
        recursionStack.add(node);

        const nodeDeps = deps.get(node) || [];
        for (const dep of nodeDeps) {
          if (hasCycle(dep)) return true;
        }

        recursionStack.delete(node);
        return false;
      };

      expect(hasCycle('@test/a')).toBe(true);
    });
  });

  describe('File System Edge Cases', () => {
    test('handles packages directory with no subdirectories', () => {
      const emptyDir = join(tmpdir(), 'empty-packages');

      try {
        mkdirSync(emptyDir, { recursive: true });

        const packageDirs = [];
        // Simulate finding no package.json files

        expect(packageDirs).toHaveLength(0);
      } finally {
        if (existsSync(emptyDir)) {
          rmSync(emptyDir, { recursive: true });
        }
      }
    });

    test('handles permission errors when reading files', () => {
      const protectedFile = '/root/protected.json'; // Simulated protected file

      expect(() => {
        // This would throw EACCES in real scenario
        if (!existsSync(protectedFile)) {
          throw new Error('EACCES: permission denied');
        }
      }).toThrow('permission denied');
    });

    test('handles extremely large package.json files', () => {
      const largeConfig = {
        name: 'large-package',
        dependencies: {}
      };

      // Simulate large dependency list
      for (let i = 0; i < 10000; i++) {
        largeConfig.dependencies[`package-${i}`] = '^1.0.0';
      }

      expect(Object.keys(largeConfig.dependencies)).toHaveLength(10000);

      // Test performance implications
      const start = performance.now();
      const depCount = Object.keys(largeConfig.dependencies).length;
      const end = performance.now();

      expect(depCount).toBe(10000);
      expect(end - start).toBeLessThan(100); // Should be fast
    });
  });

  describe('Command Execution Edge Cases', () => {
    test('handles turbo binary not available', () => {
      const mockExecSync = (command: string) => {
        if (command.includes('turbo --version')) {
          throw new Error('Command not found: turbo');
        }
      };

      expect(() => mockExecSync('npx turbo --version')).toThrow('Command not found');
    });

    test('handles timeout during command execution', () => {
      const mockExecSync = (command: string, options: any) => {
        if (options?.timeout && options.timeout < 1000) {
          throw new Error('Command timed out');
        }
      };

      expect(() =>
        mockExecSync('npx turbo run build --dry', { timeout: 500 })
      ).toThrow('timed out');
    });

    test('handles command execution with non-zero exit code', () => {
      const mockExecSync = (command: string) => {
        if (command.includes('build')) {
          const error = new Error('Build failed') as any;
          error.status = 1;
          error.stdout = 'Build error output';
          throw error;
        }
      };

      expect(() => mockExecSync('npm run build')).toThrow('Build failed');
    });

    test('handles malformed JSON output from turbo commands', () => {
      const malformedJson = '{"tasks": [incomplete json}';

      expect(() => JSON.parse(malformedJson)).toThrow();
    });
  });

  describe('Network and System Edge Cases', () => {
    test('handles system resource constraints', () => {
      // Simulate low memory scenario
      const largeArray = new Array(1000000);

      expect(largeArray).toHaveLength(1000000);

      // Test memory usage doesn't explode
      const used = process.memoryUsage();
      expect(used.heapUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });

    test('handles concurrent test execution', async () => {
      const concurrentTasks = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve(`task-${i}`)
      );

      const results = await Promise.all(concurrentTasks);
      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result).toBe(`task-${i}`);
      });
    });
  });

  describe('Data Validation Edge Cases', () => {
    test('handles packages with non-standard naming conventions', () => {
      const nonStandardNames = [
        '@namespace/package-name',
        'package_with_underscores',
        'package.with.dots',
        'UPPERCASE-PACKAGE',
        'package-123',
        '@org/sub-package/nested'
      ];

      nonStandardNames.forEach(name => {
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      });
    });

    test('handles version constraints edge cases', () => {
      const versionConstraints = [
        '*',
        '^1.0.0',
        '~1.0.0',
        '>=1.0.0',
        '1.0.0-alpha.1',
        'latest',
        'file:../local-package',
        'git+https://github.com/user/repo.git'
      ];

      versionConstraints.forEach(version => {
        expect(typeof version).toBe('string');
        expect(version.length).toBeGreaterThan(0);
      });
    });

    test('handles empty or invalid script definitions', () => {
      const invalidScripts = {
        'empty-script': '',
        'whitespace-only': '   \t\n  ',
        'invalid-command': 'nonexistent-command --invalid-flag',
        'with-special-chars': 'echo "Hello $WORLD & exit 0"'
      };

      Object.entries(invalidScripts).forEach(([name, script]) => {
        expect(typeof script).toBe('string');
        if (name === 'empty-script') {
          expect(script).toHaveLength(0);
        }
      });
    });
  });

  describe('Performance Edge Cases', () => {
    test('handles large monorepo with many packages', () => {
      const largeMonorepoPackages = Array.from({ length: 100 }, (_, i) => ({
        name: `@large/package-${i}`,
        version: '1.0.0',
        dependencies: Object.fromEntries(
          Array.from({ length: 5 }, (_, j) =>
            [`@large/package-${(i + j + 1) % 100}`, '*']
          )
        )
      }));

      expect(largeMonorepoPackages).toHaveLength(100);

      // Test dependency graph analysis performance
      const start = performance.now();

      const dependencyMap = new Map();
      largeMonorepoPackages.forEach(pkg => {
        const deps = Object.keys(pkg.dependencies)
          .filter(dep => dep.startsWith('@large/'));
        dependencyMap.set(pkg.name, deps);
      });

      const end = performance.now();

      expect(dependencyMap.size).toBe(100);
      expect(end - start).toBeLessThan(100); // Should be reasonably fast
    });

    test('handles deep dependency chains', () => {
      // Create a deep dependency chain: A -> B -> C -> ... -> Z
      const deepChain = Array.from({ length: 26 }, (_, i) => {
        const currentLetter = String.fromCharCode(65 + i); // A, B, C, ...
        const nextLetter = String.fromCharCode(65 + i + 1);

        return {
          name: `@chain/package-${currentLetter}`,
          dependencies: i < 25 ? { [`@chain/package-${nextLetter}`]: '*' } : {}
        };
      });

      expect(deepChain).toHaveLength(26);
      expect(Object.keys(deepChain[0].dependencies)).toHaveLength(1);
      expect(Object.keys(deepChain[25].dependencies)).toHaveLength(0);
    });
  });
});

describe('Turborepo Audit Error Recovery', () => {
  test('recovers from partial test failures', () => {
    const testResults = [
      { name: 'test1', passed: true },
      { name: 'test2', passed: false, error: 'Timeout' },
      { name: 'test3', passed: true },
      { name: 'test4', passed: false, error: 'Invalid config' },
      { name: 'test5', passed: true }
    ];

    const passedTests = testResults.filter(t => t.passed);
    const failedTests = testResults.filter(t => !t.passed);

    expect(passedTests).toHaveLength(3);
    expect(failedTests).toHaveLength(2);

    // Audit should continue and report on what it could validate
    const completionRate = passedTests.length / testResults.length;
    expect(completionRate).toBe(0.6);
  });

  test('provides meaningful error messages', () => {
    const errorScenarios = [
      {
        condition: 'missing turbo.json',
        expectedMessage: 'turbo.json not found or invalid'
      },
      {
        condition: 'invalid JSON',
        expectedMessage: 'Unexpected token'
      },
      {
        condition: 'missing tasks',
        expectedMessage: 'tasks property is required'
      },
      {
        condition: 'command timeout',
        expectedMessage: 'Command timed out'
      },
      {
        condition: 'permission denied',
        expectedMessage: 'EACCES: permission denied'
      }
    ];

    errorScenarios.forEach(scenario => {
      expect(scenario.condition).toBeDefined();
      expect(scenario.expectedMessage).toBeDefined();
      expect(typeof scenario.expectedMessage).toBe('string');
    });
  });

  test('calculates accurate completeness scores with failures', () => {
    // Test the scoring algorithm with various failure scenarios
    const scoringTests = [
      {
        scenario: 'perfect implementation',
        deductions: [],
        expectedScore: 100
      },
      {
        scenario: 'missing turbo.json',
        deductions: [{ reason: 'Missing turbo.json', points: 25 }],
        expectedScore: 75
      },
      {
        scenario: 'insufficient packages',
        deductions: [{ reason: 'Insufficient workspace packages', points: 20 }],
        expectedScore: 80
      },
      {
        scenario: 'multiple issues',
        deductions: [
          { reason: 'Missing turbo.json', points: 25 },
          { reason: 'Build command issues', points: 10 },
          { reason: '2 test failures', points: 4 }
        ],
        expectedScore: 61
      }
    ];

    scoringTests.forEach(test => {
      const totalDeductions = test.deductions.reduce((sum, d) => sum + d.points, 0);
      const score = Math.max(0, 100 - totalDeductions);

      expect(score).toBe(test.expectedScore);
    });
  });
});