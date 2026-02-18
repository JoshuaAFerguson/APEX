/**
 * @fileoverview Detailed Testing of Individual E2E Utilities
 *
 * This test suite focuses on testing each utility function in detail,
 * covering edge cases, error scenarios, and specific functionality
 * that may not be covered in the broader acceptance tests.
 *
 * Tests are organized by utility type:
 * - createTestEnvironment() variations
 * - runCLI() functionality
 * - seedTestData() edge cases
 * - cleanupTestEnvironment() scenarios
 * - Helper and convenience functions
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  createTestEnvironment,
  cleanupTestEnvironment,
  runCLI,
  seedTestData,
  DEFAULT_SEED_DATA,
  SEED_SCENARIOS,
  createMCPTestEnvironment,
  createGitTestEnvironment,
  createMinimalTestEnvironment,
  quickStart,
  type TestEnvironment,
  type SeedData,
  type CreateTestEnvironmentOptions,
  type CLIResult
} from './index';

describe('E2E Utilities - Detailed Testing', () => {
  let testEnvironments: TestEnvironment[] = [];

  beforeEach(() => {
    testEnvironments = [];
  });

  afterEach(async () => {
    // Clean up all test environments
    for (const env of testEnvironments) {
      try {
        await env.cleanup();
      } catch {
        // Ignore cleanup errors
      }
    }
    testEnvironments = [];
    await cleanupTestEnvironment();
  });

  describe('createTestEnvironment() - Parameter Validation', () => {
    it('should work with minimal options', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      expect(env.path).toBeDefined();
      expect(env.cleanup).toBeTypeOf('function');
      expect(env.hasGit).toBe(false);
      expect(env.hasApexProject).toBe(false);

      // Should create an actual directory
      const stat = await fs.stat(env.path);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should accept empty options object', async () => {
      const env = await createTestEnvironment({});
      testEnvironments.push(env);

      expect(env.path).toBeDefined();
      expect(env.hasGit).toBe(false);
      expect(env.hasApexProject).toBe(false);
    });

    it('should handle all options combinations', async () => {
      const optionsCombinations: CreateTestEnvironmentOptions[] = [
        { initGit: true },
        { initApexProject: true },
        { prefix: 'custom-' },
        { initGit: true, initApexProject: true },
        { prefix: 'combo-', initGit: true },
        { prefix: 'full-', initApexProject: true },
        {
          prefix: 'everything-',
          initGit: true,
          initApexProject: true,
          apexOptions: { projectName: 'test-combo' }
        }
      ];

      for (const options of optionsCombinations) {
        const env = await createTestEnvironment(options);
        testEnvironments.push(env);

        expect(env.path).toBeDefined();
        expect(env.hasGit).toBe(!!options.initGit);
        expect(env.hasApexProject).toBe(!!options.initApexProject);

        if (options.prefix) {
          const basename = path.basename(env.path);
          expect(basename).toContain(options.prefix);
        }
      }
    });

    it('should create directories in system temp location', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      const systemTempDir = os.tmpdir();
      expect(env.path).toContain(systemTempDir);
    });

    it('should create unique paths for concurrent calls', async () => {
      const envPromises = Array.from({ length: 5 }, () => createTestEnvironment());
      const environments = await Promise.all(envPromises);
      testEnvironments.push(...environments);

      const paths = environments.map(env => env.path);
      const uniquePaths = new Set(paths);
      expect(uniquePaths.size).toBe(5);
    });
  });

  describe('createTestEnvironment() - Git Integration', () => {
    it('should create git repository when requested', async () => {
      const env = await createTestEnvironment({ initGit: true });
      testEnvironments.push(env);

      expect(env.hasGit).toBe(true);

      // Should have .git directory
      const gitDir = path.join(env.path, '.git');
      const gitStat = await fs.stat(gitDir);
      expect(gitStat.isDirectory()).toBe(true);

      // Should be a valid git repository (has basic git structure)
      const gitObjects = path.join(gitDir, 'objects');
      const gitRefs = path.join(gitDir, 'refs');
      const gitHead = path.join(gitDir, 'HEAD');

      await expect(fs.stat(gitObjects)).resolves.toBeDefined();
      await expect(fs.stat(gitRefs)).resolves.toBeDefined();
      await expect(fs.stat(gitHead)).resolves.toBeDefined();
    });

    it('should create git repo with APEX project', async () => {
      const env = await createTestEnvironment({
        initGit: true,
        initApexProject: true
      });
      testEnvironments.push(env);

      expect(env.hasGit).toBe(true);
      expect(env.hasApexProject).toBe(true);

      // Both git and APEX structures should exist
      await expect(fs.stat(path.join(env.path, '.git'))).resolves.toBeDefined();
      await expect(fs.stat(path.join(env.path, '.apex'))).resolves.toBeDefined();
    });
  });

  describe('createTestEnvironment() - APEX Project Integration', () => {
    it('should create APEX project structure when requested', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      expect(env.hasApexProject).toBe(true);

      // Should have .apex directory and basic files
      const apexDir = path.join(env.path, '.apex');
      const configFile = path.join(apexDir, 'config.yaml');
      const agentsDir = path.join(apexDir, 'agents');
      const workflowsDir = path.join(apexDir, 'workflows');

      await expect(fs.stat(apexDir)).resolves.toBeDefined();
      await expect(fs.stat(configFile)).resolves.toBeDefined();
      await expect(fs.stat(agentsDir)).resolves.toBeDefined();
      await expect(fs.stat(workflowsDir)).resolves.toBeDefined();
    });

    it('should accept APEX project options', async () => {
      const env = await createTestEnvironment({
        initApexProject: true,
        apexOptions: {
          projectName: 'custom-test-project'
        }
      });
      testEnvironments.push(env);

      // Config should contain custom project name
      const configFile = path.join(env.path, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configFile, 'utf-8');
      expect(configContent).toContain('custom-test-project');
    });
  });

  describe('runCLI() - Command Execution', () => {
    it('should execute basic CLI commands', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      const result = await runCLI('--version', env.path);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('exitCode');

      expect(typeof result.success).toBe('boolean');
      expect(typeof result.stdout).toBe('string');
      expect(typeof result.stderr).toBe('string');
      expect(typeof result.exitCode).toBe('number');
    });

    it('should handle command failures gracefully', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      const result = await runCLI('this-command-does-not-exist', env.path);

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
      expect(typeof result.stderr).toBe('string');
    });

    it('should support CLI options', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      const result = await runCLI('--version', env.path, {
        timeout: 5000,
        env: {
          ...process.env,
          TEST_ENV_VAR: 'test-value'
        }
      });

      expect(result).toBeDefined();
      // Should complete within timeout or fail gracefully
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle different working directories', async () => {
      const env1 = await createTestEnvironment();
      const env2 = await createTestEnvironment();
      testEnvironments.push(env1, env2);

      const result1 = await runCLI('--version', env1.path);
      const result2 = await runCLI('--version', env2.path);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      // Both should execute in their respective directories
    });

    it('should handle commands with arguments', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      const commands = [
        '--help',
        '--version',
        'init --help',
        'mcp --help',
        'agent --help'
      ];

      for (const command of commands) {
        const result = await runCLI(command, env.path);
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.exitCode).toBe('number');
      }
    });
  });

  describe('seedTestData() - Data Population', () => {
    it('should handle minimal seed data', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      const minimalData: SeedData = {
        project: {
          name: 'minimal-project',
          language: 'javascript'
        }
      };

      await seedTestData(env, minimalData);

      const configFile = path.join(env.path, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configFile, 'utf-8');
      expect(configContent).toContain('minimal-project');
    });

    it('should handle files-only seed data', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      const filesData: SeedData = {
        files: {
          'test.txt': 'Test content',
          'src/index.js': 'console.log("hello");',
          'nested/deep/file.json': '{"test": true}'
        }
      };

      await seedTestData(env, filesData);

      // Verify all files were created
      for (const [filePath, content] of Object.entries(filesData.files!)) {
        const fullPath = path.join(env.path, filePath);
        const actualContent = await fs.readFile(fullPath, 'utf-8');
        expect(actualContent).toBe(content);
      }
    });

    it('should handle agents-only seed data', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      const agentsData: SeedData = {
        agents: [
          {
            name: 'test-agent-1',
            description: 'First test agent',
            tools: ['Read', 'Write']
          },
          {
            name: 'test-agent-2',
            description: 'Second test agent',
            tools: ['Edit', 'Bash'],
            model: 'opus'
          }
        ]
      };

      await seedTestData(env, agentsData);

      // Verify agents were created
      const agentsDir = path.join(env.path, '.apex', 'agents');
      const agentFiles = await fs.readdir(agentsDir);
      expect(agentFiles).toContain('test-agent-1.md');
      expect(agentFiles).toContain('test-agent-2.md');

      // Verify agent content
      const agent1Content = await fs.readFile(
        path.join(agentsDir, 'test-agent-1.md'), 'utf-8'
      );
      expect(agent1Content).toContain('test-agent-1');
      expect(agent1Content).toContain('First test agent');
      expect(agent1Content).toContain('Read, Write');
    });

    it('should handle workflows-only seed data', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      const workflowsData: SeedData = {
        workflows: [
          {
            name: 'test-workflow',
            description: 'Test workflow',
            stages: [
              { name: 'stage1', agent: 'agent1', description: 'First stage' },
              { name: 'stage2', agent: 'agent2', description: 'Second stage' }
            ]
          }
        ]
      };

      await seedTestData(env, workflowsData);

      // Verify workflow was created
      const workflowsDir = path.join(env.path, '.apex', 'workflows');
      const workflowFiles = await fs.readdir(workflowsDir);
      expect(workflowFiles).toContain('test-workflow.yaml');

      // Verify workflow content
      const workflowContent = await fs.readFile(
        path.join(workflowsDir, 'test-workflow.yaml'), 'utf-8'
      );
      expect(workflowContent).toContain('test-workflow');
      expect(workflowContent).toContain('stage1');
      expect(workflowContent).toContain('agent1');
    });

    it('should handle MCP servers seed data', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      const mcpData: SeedData = {
        mcpServers: {
          'test-server': {
            name: 'test-server',
            type: 'local',
            command: 'echo',
            args: ['test'],
            autoStart: false
          }
        }
      };

      await seedTestData(env, mcpData);

      // Verify MCP config was added
      const configFile = path.join(env.path, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configFile, 'utf-8');
      expect(configContent).toContain('mcp:');
      expect(configContent).toContain('servers:');
      expect(configContent).toContain('test-server');
    });

    it('should not require APEX project for files-only seeding', async () => {
      const env = await createTestEnvironment(); // No APEX project
      testEnvironments.push(env);

      const filesData: SeedData = {
        files: {
          'standalone.txt': 'This works without APEX project'
        }
      };

      await seedTestData(env, filesData);

      const filePath = path.join(env.path, 'standalone.txt');
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('This works without APEX project');
    });
  });

  describe('cleanupTestEnvironment() - Resource Management', () => {
    it('should clean up without active environments', async () => {
      // Should not throw when called with no active environments
      await expect(cleanupTestEnvironment()).resolves.toBeUndefined();
    });

    it('should clean up multiple times safely', async () => {
      await cleanupTestEnvironment();
      await cleanupTestEnvironment();
      await cleanupTestEnvironment();

      // Should not throw on repeated calls
      expect(true).toBe(true);
    });

    it('should clean up after environment creation and manual cleanup', async () => {
      const env = await createTestEnvironment();

      // Manual cleanup first
      await env.cleanup();

      // Global cleanup should still work
      await expect(cleanupTestEnvironment()).resolves.toBeUndefined();
    });
  });

  describe('Convenience Helper Functions', () => {
    it('should create MCP test environment', async () => {
      const env = await createMCPTestEnvironment();
      testEnvironments.push(env);

      expect(env.hasGit).toBe(true);
      expect(env.hasApexProject).toBe(true);

      // Should have MCP configuration
      const configFile = path.join(env.path, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configFile, 'utf-8');
      expect(configContent).toContain('mcp:');
    });

    it('should create Git test environment', async () => {
      const env = await createGitTestEnvironment();
      testEnvironments.push(env);

      expect(env.hasGit).toBe(true);
      expect(env.hasApexProject).toBe(true);

      // Should have git-specific files
      const gitIgnore = path.join(env.path, '.gitignore');
      await expect(fs.stat(gitIgnore)).resolves.toBeDefined();
    });

    it('should create minimal test environment', async () => {
      const env = await createMinimalTestEnvironment();
      testEnvironments.push(env);

      expect(env.hasGit).toBe(true);
      expect(env.hasApexProject).toBe(true);

      // Should be minimal setup
      const configFile = path.join(env.path, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configFile, 'utf-8');
      expect(configContent).toContain('minimal-test');
    });
  });

  describe('Default Seed Data Validation', () => {
    it('should have valid default seed data structure', () => {
      expect(DEFAULT_SEED_DATA).toBeDefined();
      expect(DEFAULT_SEED_DATA.project).toBeDefined();
      expect(DEFAULT_SEED_DATA.agents).toBeDefined();
      expect(DEFAULT_SEED_DATA.workflows).toBeDefined();
      expect(DEFAULT_SEED_DATA.mcpServers).toBeDefined();
      expect(DEFAULT_SEED_DATA.files).toBeDefined();

      // Project validation
      expect(DEFAULT_SEED_DATA.project!.name).toBeDefined();
      expect(DEFAULT_SEED_DATA.project!.language).toBeDefined();

      // Agents validation
      expect(Array.isArray(DEFAULT_SEED_DATA.agents)).toBe(true);
      expect(DEFAULT_SEED_DATA.agents!.length).toBeGreaterThan(0);

      for (const agent of DEFAULT_SEED_DATA.agents!) {
        expect(agent.name).toBeDefined();
        expect(agent.description).toBeDefined();
        expect(Array.isArray(agent.tools)).toBe(true);
      }

      // Workflows validation
      expect(Array.isArray(DEFAULT_SEED_DATA.workflows)).toBe(true);
      expect(DEFAULT_SEED_DATA.workflows!.length).toBeGreaterThan(0);
    });

    it('should have valid seed scenarios', () => {
      expect(SEED_SCENARIOS).toBeDefined();
      expect(SEED_SCENARIOS.minimal).toBeDefined();
      expect(SEED_SCENARIOS.full).toBeDefined();
      expect(SEED_SCENARIOS.mcp).toBeDefined();
      expect(SEED_SCENARIOS.git).toBeDefined();

      // Each scenario should have valid structure
      for (const [scenarioName, scenario] of Object.entries(SEED_SCENARIOS)) {
        expect(scenario).toBeDefined();
        if (scenario.project) {
          expect(scenario.project.name).toBeDefined();
          expect(scenario.project.language).toBeDefined();
        }
      }
    });
  });
});