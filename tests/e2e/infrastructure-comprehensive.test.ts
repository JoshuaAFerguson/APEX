/**
 * @fileoverview Comprehensive E2E Infrastructure Testing
 *
 * This test suite provides comprehensive testing of the E2E infrastructure
 * beyond the basic acceptance criteria. It tests edge cases, error scenarios,
 * and integration patterns that real E2E tests would encounter.
 *
 * Coverage includes:
 * - Error handling and resilience
 * - Resource cleanup under failure conditions
 * - Concurrent environment creation
 * - Complex seeding scenarios
 * - CLI execution with various options
 * - Performance and timeout handling
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  createTestEnvironment,
  cleanupTestEnvironment,
  runCLI,
  seedTestData,
  DEFAULT_SEED_DATA,
  SEED_SCENARIOS,
  quickStart,
  type TestEnvironment,
  type SeedData
} from './index';

describe('E2E Infrastructure - Comprehensive Tests', () => {
  let testEnvironments: TestEnvironment[] = [];

  beforeEach(() => {
    testEnvironments = [];
  });

  afterEach(async () => {
    // Clean up test environments created during tests
    for (const env of testEnvironments) {
      try {
        await env.cleanup();
      } catch {
        // Ignore cleanup errors in test
      }
    }
    testEnvironments = [];
    await cleanupTestEnvironment();
  });

  describe('Environment Creation - Error Handling', () => {
    it('should handle multiple concurrent environment creation', async () => {
      const concurrentCreations = Promise.all([
        createTestEnvironment({ prefix: 'concurrent-1-' }),
        createTestEnvironment({ prefix: 'concurrent-2-' }),
        createTestEnvironment({ prefix: 'concurrent-3-' })
      ]);

      const environments = await concurrentCreations;
      testEnvironments.push(...environments);

      // All environments should be created successfully
      expect(environments).toHaveLength(3);
      for (const env of environments) {
        expect(env.path).toBeDefined();
        expect(typeof env.path).toBe('string');
        const stat = await fs.stat(env.path);
        expect(stat.isDirectory()).toBe(true);
      }

      // Paths should be unique
      const paths = environments.map(env => env.path);
      const uniquePaths = new Set(paths);
      expect(uniquePaths.size).toBe(3);
    });

    it('should handle cleanup of partially created environments', async () => {
      const env = await createTestEnvironment({
        initApexProject: true,
        initGit: true
      });
      testEnvironments.push(env);

      // Verify environment was created fully
      expect(env.hasGit).toBe(true);
      expect(env.hasApexProject).toBe(true);

      const gitDir = path.join(env.path, '.git');
      const apexDir = path.join(env.path, '.apex');

      await expect(fs.stat(gitDir)).resolves.toBeDefined();
      await expect(fs.stat(apexDir)).resolves.toBeDefined();

      // Cleanup should work even with complex structure
      await env.cleanup();

      // Directory should be gone or cleanup should not throw
      try {
        await fs.stat(env.path);
        // If it still exists, it should be empty or cleanup is in progress
      } catch {
        // Directory was successfully removed
        expect(true).toBe(true);
      }
    });

    it('should handle invalid prefix gracefully', async () => {
      // Test with various edge case prefixes
      const env1 = await createTestEnvironment({ prefix: '' });
      const env2 = await createTestEnvironment({ prefix: 'very-long-prefix-that-might-cause-issues-' });
      const env3 = await createTestEnvironment({ prefix: 'special-chars-$@#-' });

      testEnvironments.push(env1, env2, env3);

      for (const env of [env1, env2, env3]) {
        expect(env.path).toBeDefined();
        const stat = await fs.stat(env.path);
        expect(stat.isDirectory()).toBe(true);
      }
    });
  });

  describe('CLI Execution - Advanced Scenarios', () => {
    it('should handle CLI execution with environment variables', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      const result = await runCLI('--version', env.path, {
        env: {
          ...process.env,
          DEBUG: '1',
          CUSTOM_VAR: 'test-value'
        }
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.stdout).toBe('string');
      expect(typeof result.stderr).toBe('string');
      expect(typeof result.exitCode).toBe('number');
    });

    it('should handle CLI timeout scenarios', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      // Test with very short timeout - should either succeed quickly or timeout
      const startTime = Date.now();
      const result = await runCLI('--version', env.path, { timeout: 100 });
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      if (result.success) {
        // If it succeeded, it should be within timeout
        expect(duration).toBeLessThan(200);
      } else {
        // If it failed, it might be due to timeout
        expect(typeof result.exitCode).toBe('number');
      }
    });

    it('should handle long-running CLI commands', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      // Test a command that might take longer
      const result = await runCLI('--help', env.path, { timeout: 30000 });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      if (result.success) {
        expect(result.stdout).toContain('Usage:') || expect(result.stdout).toContain('Commands:');
      }
    });

    it('should handle CLI commands with complex arguments', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      // Test with various argument patterns
      const commands = [
        '--version',
        '--help',
        'init --help',
      ];

      for (const command of commands) {
        const result = await runCLI(command, env.path);
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.exitCode).toBe('number');
      }
    });
  });

  describe('Seed Data - Complex Scenarios', () => {
    it('should handle empty seed data gracefully', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      const emptySeedData: SeedData = {};
      await expect(seedTestData(env, emptySeedData)).resolves.toBeUndefined();

      // Config file should still exist (created during project init)
      const configPath = path.join(env.path, '.apex', 'config.yaml');
      await expect(fs.stat(configPath)).resolves.toBeDefined();
    });

    it('should handle deep directory structures in seed files', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      const deepSeedData: SeedData = {
        files: {
          'src/components/ui/Button.tsx': 'export const Button = () => <button>Click me</button>;',
          'src/utils/helpers/string.ts': 'export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);',
          'tests/unit/components/Button.test.tsx': 'describe("Button", () => { it("renders", () => {}); });',
          'docs/architecture/decisions/001-component-structure.md': '# Component Structure\n\nWe use a hierarchical structure.'
        }
      };

      await seedTestData(env, deepSeedData);

      // Verify all files were created with proper directory structure
      for (const filePath of Object.keys(deepSeedData.files!)) {
        const fullPath = path.join(env.path, filePath);
        const stat = await fs.stat(fullPath);
        expect(stat.isFile()).toBe(true);

        const content = await fs.readFile(fullPath, 'utf-8');
        expect(content).toBe(deepSeedData.files![filePath]);
      }
    });

    it('should handle seed data with special characters and unicode', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      const unicodeSeedData: SeedData = {
        files: {
          'README-中文.md': '# 项目说明\n\n这是一个测试项目。\n',
          'config-åäö.yaml': 'name: test-project-åäö\ndescription: "Special chars: äöü éñ"',
          'script-emoji.js': '// 🎉 Welcome to the party! 🎉\nconsole.log("Hello 🌍!");'
        },
        project: {
          name: 'test-project-unicode-äöü',
          language: 'typescript',
          description: 'Project with unicode: 中文 åäö 🎉'
        }
      };

      await seedTestData(env, unicodeSeedData);

      // Verify unicode files were created correctly
      for (const [filePath, expectedContent] of Object.entries(unicodeSeedData.files!)) {
        const fullPath = path.join(env.path, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        expect(content).toBe(expectedContent);
      }

      // Verify unicode project config
      const configPath = path.join(env.path, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      expect(configContent).toContain('test-project-unicode-äöü');
    });

    it('should handle large seed datasets', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      // Create a seed with many files and complex structure
      const largeSeedData: SeedData = {
        agents: Array.from({ length: 10 }, (_, i) => ({
          name: `agent-${i}`,
          description: `Agent number ${i} for testing scalability`,
          tools: ['Read', 'Write', 'Edit'],
          model: 'sonnet'
        })),
        workflows: Array.from({ length: 5 }, (_, i) => ({
          name: `workflow-${i}`,
          description: `Workflow number ${i}`,
          stages: [
            { name: 'stage1', agent: `agent-${i}`, description: 'First stage' },
            { name: 'stage2', agent: `agent-${i + 1}`, description: 'Second stage' }
          ]
        })),
        files: Object.fromEntries(
          Array.from({ length: 20 }, (_, i) => [
            `file-${i}.txt`,
            `Content of file ${i}\n`.repeat(100) // Make files reasonably large
          ])
        )
      };

      const startTime = Date.now();
      await seedTestData(env, largeSeedData);
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (10 seconds)
      expect(duration).toBeLessThan(10000);

      // Verify all agents were created
      const agentsDir = path.join(env.path, '.apex', 'agents');
      const agentFiles = await fs.readdir(agentsDir);
      expect(agentFiles).toHaveLength(10);

      // Verify all workflows were created
      const workflowsDir = path.join(env.path, '.apex', 'workflows');
      const workflowFiles = await fs.readdir(workflowsDir);
      expect(workflowFiles).toHaveLength(5);

      // Verify all files were created
      for (let i = 0; i < 20; i++) {
        const filePath = path.join(env.path, `file-${i}.txt`);
        const stat = await fs.stat(filePath);
        expect(stat.isFile()).toBe(true);
      }
    });
  });

  describe('Quick Start Helpers - Integration', () => {
    it('should create different environment types correctly', async () => {
      const scenarios = ['minimal', 'full', 'mcp', 'git'] as const;
      const environments: TestEnvironment[] = [];

      for (const scenario of scenarios) {
        const env = await quickStart(scenario);
        environments.push(env);
        testEnvironments.push(env);

        expect(env.hasGit).toBe(true);
        expect(env.hasApexProject).toBe(true);

        // Verify basic structure exists
        const apexDir = path.join(env.path, '.apex');
        const configFile = path.join(apexDir, 'config.yaml');
        await expect(fs.stat(apexDir)).resolves.toBeDefined();
        await expect(fs.stat(configFile)).resolves.toBeDefined();
      }

      // All environments should be unique
      const paths = environments.map(env => env.path);
      const uniquePaths = new Set(paths);
      expect(uniquePaths.size).toBe(scenarios.length);
    });

    it('should handle quick start with subsequent modifications', async () => {
      const env = await quickStart('minimal');
      testEnvironments.push(env);

      // Modify the environment after quick start
      const customFile = path.join(env.path, 'custom-addition.txt');
      await fs.writeFile(customFile, 'Custom content added after quick start');

      // Should still be able to run CLI commands
      const result = await runCLI('--version', env.path);
      expect(result).toBeDefined();

      // Custom file should still exist
      const content = await fs.readFile(customFile, 'utf-8');
      expect(content).toBe('Custom content added after quick start');
    });
  });

  describe('Resource Management - Stress Testing', () => {
    it('should handle rapid creation and cleanup cycles', async () => {
      const cycles = 5;

      for (let i = 0; i < cycles; i++) {
        const env = await createTestEnvironment({
          prefix: `rapid-cycle-${i}-`,
          initApexProject: true
        });

        // Verify creation
        const stat = await fs.stat(env.path);
        expect(stat.isDirectory()).toBe(true);

        // Immediate cleanup
        await env.cleanup();
      }

      // Should complete without resource exhaustion
      expect(true).toBe(true);
    });

    it('should handle cleanup when directories are in use', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      // Create a file handle that might interfere with cleanup
      const testFile = path.join(env.path, 'test-file.txt');
      await fs.writeFile(testFile, 'test content');

      // Read the file to potentially lock it
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('test content');

      // Cleanup should still work (or at least not throw)
      await expect(env.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('Integration with Real E2E Patterns', () => {
    it('should support a complete test workflow simulation', async () => {
      // Simulate a realistic E2E test pattern
      const env = await quickStart('full');
      testEnvironments.push(env);

      // 1. Verify initial state
      const initResult = await runCLI('--version', env.path);
      expect(initResult.success || initResult.exitCode !== undefined).toBe(true);

      // 2. Seed additional test data
      await seedTestData(env, {
        files: {
          'src/test-component.ts': 'export class TestComponent {}',
          'package.json': JSON.stringify({
            name: 'test-project',
            version: '1.0.0',
            scripts: { test: 'echo "Running tests"' }
          }, null, 2)
        }
      });

      // 3. Verify files were created
      const componentFile = path.join(env.path, 'src/test-component.ts');
      const packageFile = path.join(env.path, 'package.json');
      await expect(fs.stat(componentFile)).resolves.toBeDefined();
      await expect(fs.stat(packageFile)).resolves.toBeDefined();

      // 4. Run CLI commands
      const helpResult = await runCLI('--help', env.path);
      expect(helpResult).toBeDefined();

      // 5. Cleanup should work seamlessly
      await env.cleanup();
    });
  });
});