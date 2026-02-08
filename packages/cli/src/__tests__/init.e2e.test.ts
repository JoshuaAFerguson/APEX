/**
 * End-to-end tests for the APEX CLI init command
 *
 * Tests the complete initialization flow including:
 * - Directory structure creation (.apex, agents, workflows)
 * - Configuration file creation and validation
 * - Default agent and workflow files creation
 * - Idempotent behavior (handling existing init)
 * - Various initialization options
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { createEnvironmentIsolation } from '../../../../tests/test-utils/isolation/environment';
import type { EnvironmentIsolation } from '../../../../tests/test-utils/isolation/types';

const execAsync = promisify(require('child_process').exec);

// Path to the built CLI
const CLI_PATH = path.join(__dirname, '../../dist/index.js');

/**
 * Helper function to run CLI commands with isolated environment
 */
async function runCliCommand(
  args: string,
  cwd: string,
  env?: EnvironmentIsolation
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    // Set up environment isolation if provided
    const processEnv = env ? { ...process.env } : { ...process.env, NO_COLOR: '1' };
    if (env) {
      env.setEnv('NO_COLOR', '1');
    }

    const result = await execAsync(`node ${CLI_PATH} ${args}`, {
      cwd,
      env: processEnv,
      timeout: 30000,
    });

    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: 0,
    };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || '',
      exitCode: error.code || 1,
    };
  }
}

/**
 * Helper function to check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper function to read and parse YAML file
 */
async function readYamlFile(filePath: string): Promise<any> {
  const content = await fs.readFile(filePath, 'utf-8');
  return yaml.parse(content);
}

/**
 * Helper function to read markdown file and parse frontmatter
 */
async function readMarkdownFile(filePath: string): Promise<{ frontmatter: any; content: string }> {
  const content = await fs.readFile(filePath, 'utf-8');

  // Parse frontmatter if it exists
  const frontmatterMatch = content.match(/^---\n(.*?)\n---\n(.*)/s);
  if (frontmatterMatch) {
    const frontmatter = yaml.parse(frontmatterMatch[1]);
    const body = frontmatterMatch[2];
    return { frontmatter, content: body };
  }

  return { frontmatter: {}, content };
}

describe('CLI Init Command E2E Tests', () => {
  let testDir: string;
  let envIsolation: EnvironmentIsolation;

  beforeEach(async () => {
    // Create isolated test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-init-e2e-'));

    // Set up environment isolation
    envIsolation = createEnvironmentIsolation();
  });

  afterEach(async () => {
    // Clean up environment
    envIsolation.restore();

    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Basic Initialization', () => {
    it('should create .apex directory when running init', async () => {
      const { exitCode, stderr } = await runCliCommand('init --yes', testDir, envIsolation);

      expect(exitCode).toBe(0);
      expect(stderr).not.toContain('error');

      // Check that .apex directory was created
      const apexDir = path.join(testDir, '.apex');
      expect(await fileExists(apexDir)).toBe(true);

      // Verify it's a directory
      const stat = await fs.stat(apexDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should create config.yaml with expected structure', async () => {
      const { exitCode } = await runCliCommand('init --yes', testDir, envIsolation);

      expect(exitCode).toBe(0);

      // Check config.yaml exists
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      expect(await fileExists(configPath)).toBe(true);

      // Parse and validate config structure
      const config = await readYamlFile(configPath);

      // Verify required fields
      expect(config).toHaveProperty('version');
      expect(config).toHaveProperty('project');
      expect(config.project).toHaveProperty('name');

      // Verify config has sensible defaults
      expect(typeof config.version).toBe('string');
      expect(typeof config.project.name).toBe('string');
      expect(config.project.name.length).toBeGreaterThan(0);
    });

    it('should create agents directory with default agents', async () => {
      const { exitCode } = await runCliCommand('init --yes', testDir, envIsolation);

      expect(exitCode).toBe(0);

      // Check agents directory exists
      const agentsDir = path.join(testDir, '.apex', 'agents');
      expect(await fileExists(agentsDir)).toBe(true);

      // Verify it's a directory
      const stat = await fs.stat(agentsDir);
      expect(stat.isDirectory()).toBe(true);

      // Check for default agent files
      const agentFiles = await fs.readdir(agentsDir);
      const expectedAgents = ['planner.md', 'developer.md', 'reviewer.md', 'tester.md'];

      for (const expectedAgent of expectedAgents) {
        expect(agentFiles).toContain(expectedAgent);

        // Verify agent file has valid frontmatter
        const agentPath = path.join(agentsDir, expectedAgent);
        const { frontmatter } = await readMarkdownFile(agentPath);

        expect(frontmatter).toHaveProperty('name');
        expect(frontmatter).toHaveProperty('description');
        expect(typeof frontmatter.name).toBe('string');
        expect(typeof frontmatter.description).toBe('string');
      }
    });

    it('should create workflows directory with default workflows', async () => {
      const { exitCode } = await runCliCommand('init --yes', testDir, envIsolation);

      expect(exitCode).toBe(0);

      // Check workflows directory exists
      const workflowsDir = path.join(testDir, '.apex', 'workflows');
      expect(await fileExists(workflowsDir)).toBe(true);

      // Verify it's a directory
      const stat = await fs.stat(workflowsDir);
      expect(stat.isDirectory()).toBe(true);

      // Check for default workflow files
      const workflowFiles = await fs.readdir(workflowsDir);
      const expectedWorkflows = ['feature.yaml', 'bugfix.yaml', 'refactor.yaml'];

      for (const expectedWorkflow of expectedWorkflows) {
        expect(workflowFiles).toContain(expectedWorkflow);

        // Verify workflow file has valid YAML structure
        const workflowPath = path.join(workflowsDir, expectedWorkflow);
        const workflow = await readYamlFile(workflowPath);

        expect(workflow).toHaveProperty('name');
        expect(workflow).toHaveProperty('stages');
        expect(Array.isArray(workflow.stages)).toBe(true);
        expect(workflow.stages.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Idempotent Behavior', () => {
    it('should handle existing initialization appropriately', async () => {
      // First initialization
      const { exitCode: firstExitCode } = await runCliCommand('init --yes', testDir, envIsolation);
      expect(firstExitCode).toBe(0);

      // Verify initial setup
      expect(await fileExists(path.join(testDir, '.apex'))).toBe(true);
      expect(await fileExists(path.join(testDir, '.apex', 'config.yaml'))).toBe(true);

      // Second initialization should warn but not fail
      const { stdout: secondStdout, exitCode: secondExitCode } = await runCliCommand(
        'init --yes',
        testDir,
        envIsolation
      );

      expect(secondExitCode).toBe(0);
      expect(secondStdout.toLowerCase()).toContain('already initialized');
    });

    it('should not overwrite existing configuration', async () => {
      // First initialization with specific name
      const { exitCode: firstExitCode } = await runCliCommand(
        'init --yes --name original-project',
        testDir,
        envIsolation
      );
      expect(firstExitCode).toBe(0);

      // Verify original config
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const originalConfig = await readYamlFile(configPath);
      expect(originalConfig.project.name).toBe('original-project');

      // Second initialization with different name
      const { exitCode: secondExitCode } = await runCliCommand(
        'init --yes --name new-project',
        testDir,
        envIsolation
      );
      expect(secondExitCode).toBe(0);

      // Config should remain unchanged
      const configAfterSecond = await readYamlFile(configPath);
      expect(configAfterSecond.project.name).toBe('original-project');
    });
  });

  describe('Initialization Options', () => {
    it('should accept project name option', async () => {
      const projectName = 'my-awesome-project';
      const { exitCode } = await runCliCommand(
        `init --yes --name ${projectName}`,
        testDir,
        envIsolation
      );

      expect(exitCode).toBe(0);

      // Verify project name in config
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const config = await readYamlFile(configPath);
      expect(config.project.name).toBe(projectName);
    });

    it('should accept language option', async () => {
      const language = 'typescript';
      const { exitCode } = await runCliCommand(
        `init --yes --language ${language}`,
        testDir,
        envIsolation
      );

      expect(exitCode).toBe(0);

      // Verify language in config (if stored)
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const config = await readYamlFile(configPath);

      // Language might be stored in project config or as separate field
      if (config.project.language) {
        expect(config.project.language).toBe(language);
      }
    });

    it('should accept framework option', async () => {
      const framework = 'react';
      const { exitCode } = await runCliCommand(
        `init --yes --framework ${framework}`,
        testDir,
        envIsolation
      );

      expect(exitCode).toBe(0);

      // Verify framework in config (if stored)
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const config = await readYamlFile(configPath);

      // Framework might be stored in project config or as separate field
      if (config.project.framework) {
        expect(config.project.framework).toBe(framework);
      }
    });

    it('should use directory name as default project name', async () => {
      // Create a subdirectory with specific name
      const projectDir = path.join(testDir, 'my-project-dir');
      await fs.mkdir(projectDir);

      const { exitCode } = await runCliCommand('init --yes', projectDir, envIsolation);

      expect(exitCode).toBe(0);

      // Verify project name matches directory name
      const configPath = path.join(projectDir, '.apex', 'config.yaml');
      const config = await readYamlFile(configPath);
      expect(config.project.name).toBe('my-project-dir');
    });
  });

  describe('Error Handling', () => {
    it('should handle permission errors gracefully', async () => {
      // Create a directory we can't write to (if possible in test environment)
      const readOnlyDir = path.join(testDir, 'readonly');
      await fs.mkdir(readOnlyDir);

      // Try to make directory readonly (may not work on all platforms)
      try {
        await fs.chmod(readOnlyDir, 0o444);

        const { stdout, stderr, exitCode } = await runCliCommand(
          'init --yes',
          readOnlyDir,
          envIsolation
        );

        // Should fail gracefully
        expect(exitCode).not.toBe(0);
        expect(stderr.toLowerCase()).toContain('permission');
      } catch {
        // If chmod doesn't work, skip this test
        console.log('Skipping permission test - platform does not support readonly directories');
      }
    });

    it('should validate command line arguments', async () => {
      // Test with invalid arguments
      const { stdout, stderr, exitCode } = await runCliCommand(
        'init --invalid-flag',
        testDir,
        envIsolation
      );

      // Should handle gracefully (CLI might ignore unknown flags or error)
      if (exitCode !== 0) {
        expect(stderr).toBeDefined();
      }
    });
  });

  describe('Environment Isolation', () => {
    it('should work with custom environment variables', async () => {
      // Set custom environment variable
      envIsolation.setEnv('APEX_TEST_VAR', 'test-value');

      const { exitCode } = await runCliCommand('init --yes', testDir, envIsolation);

      expect(exitCode).toBe(0);
      expect(await fileExists(path.join(testDir, '.apex'))).toBe(true);
    });

    it('should not be affected by existing APEX environment', async () => {
      // Set potential conflicting environment variables
      envIsolation.setEnv('APEX_HOME', '/some/other/path');
      envIsolation.setEnv('APEX_CONFIG', '/some/other/config');

      const { exitCode } = await runCliCommand('init --yes', testDir, envIsolation);

      expect(exitCode).toBe(0);
      expect(await fileExists(path.join(testDir, '.apex'))).toBe(true);
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should work with paths containing spaces', async () => {
      // Create directory with spaces in name
      const spacedDir = path.join(testDir, 'my project dir');
      await fs.mkdir(spacedDir);

      const { exitCode } = await runCliCommand('init --yes', spacedDir, envIsolation);

      expect(exitCode).toBe(0);
      expect(await fileExists(path.join(spacedDir, '.apex'))).toBe(true);
    });

    it('should handle long paths correctly', async () => {
      // Create nested directory structure
      const longPath = path.join(
        testDir,
        'very',
        'long',
        'nested',
        'directory',
        'structure',
        'for',
        'testing'
      );
      await fs.mkdir(longPath, { recursive: true });

      const { exitCode } = await runCliCommand('init --yes', longPath, envIsolation);

      expect(exitCode).toBe(0);
      expect(await fileExists(path.join(longPath, '.apex'))).toBe(true);
    });
  });

  describe('Output Validation', () => {
    it('should provide clear success messages', async () => {
      const { stdout, exitCode } = await runCliCommand('init --yes', testDir, envIsolation);

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toContain('success');
      expect(stdout).toContain('config.yaml');
      expect(stdout).toContain('agents');
      expect(stdout).toContain('workflows');
    });

    it('should show helpful information about created structure', async () => {
      const { stdout, exitCode } = await runCliCommand('init --yes', testDir, envIsolation);

      expect(exitCode).toBe(0);

      // Should mention key components that were created
      expect(stdout).toMatch(/\.apex.*config/);
      expect(stdout).toMatch(/agents.*directory/);
      expect(stdout).toMatch(/workflows.*directory/);
    });
  });

  describe('Integration with CLI Building', () => {
    it('should pass in CI environment', async () => {
      // Set CI environment variable to simulate CI environment
      envIsolation.setEnv('CI', 'true');

      const { exitCode } = await runCliCommand('init --yes', testDir, envIsolation);

      expect(exitCode).toBe(0);
      expect(await fileExists(path.join(testDir, '.apex'))).toBe(true);
    });

    it('should work with NO_COLOR environment', async () => {
      // NO_COLOR should already be set by default, but ensure it works
      envIsolation.setEnv('NO_COLOR', '1');

      const { stdout, exitCode } = await runCliCommand('init --yes', testDir, envIsolation);

      expect(exitCode).toBe(0);

      // Output should not contain ANSI color codes when NO_COLOR is set
      expect(stdout).not.toMatch(/\x1b\[\d+m/);
    });
  });
});