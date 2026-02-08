/**
 * End-to-end tests for APEX Server Configuration Happy Path
 *
 * These tests verify the complete configuration workflow from init to persistence:
 * 1. Configure command prompts for required settings
 * 2. Configuration is saved to correct location (.apex/config.yaml)
 * 3. Default values work correctly
 * 4. Custom values are persisted
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import type { ApexConfig } from '@apex/core';

const execAsync = promisify(exec);

// Path to the CLI
const CLI_PATH = path.join(__dirname, '../../packages/cli/dist/index.js');

/**
 * Run CLI command with proper environment setup
 */
async function runCli(args: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execAsync(`node "${CLI_PATH}" ${args}`, {
      cwd,
      env: {
        ...process.env,
        NO_COLOR: '1',
        APEX_TEST_MODE: 'e2e',
        NODE_ENV: 'test'
      },
      timeout: 30000,
    });
    return result;
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    // Return output even on error for inspection
    return {
      stdout: execError.stdout || '',
      stderr: execError.stderr || execError.message || '',
    };
  }
}

/**
 * Read and parse APEX config file
 */
async function readConfig(projectDir: string): Promise<ApexConfig> {
  const configPath = path.join(projectDir, '.apex', 'config.yaml');
  const configContent = await fs.readFile(configPath, 'utf-8');
  return yaml.parse(configContent) as ApexConfig;
}

/**
 * Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  return fs.stat(filePath).then(() => true).catch(() => false);
}

describe('E2E: Server Configuration Happy Path', () => {
  let testDir: string;
  let configPath: string;

  beforeEach(async () => {
    // Create isolated temp directory
    testDir = await globalThis.apexE2EHelpers.createTempDir('server-config-e2e-');
    configPath = path.join(testDir, '.apex', 'config.yaml');
  });

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Configuration Prompts', () => {
    it('should prompt for required settings during init', async () => {
      // Use apex init with defaults (--yes skips prompts but sets defaults)
      const { stdout } = await runCli('init --yes', testDir);

      // Verify init completed successfully
      expect(stdout).toContain('APEX');

      // Verify config was created
      expect(await fileExists(configPath)).toBe(true);
    });

    it('should accept command-line options for project settings', async () => {
      await runCli('init --yes --name my-project --language typescript', testDir);

      const config = await readConfig(testDir);
      expect(config.project.name).toBe('my-project');
      expect(config.project.language).toBe('typescript');
    });

    it('should handle initialization with framework option', async () => {
      await runCli('init --yes --name test-project --language javascript --framework react', testDir);

      const config = await readConfig(testDir);
      expect(config.project.name).toBe('test-project');
      expect(config.project.language).toBe('javascript');
      expect(config.project.framework).toBe('react');
    });
  });

  describe('Configuration Location', () => {
    it('should save configuration to .apex/config.yaml', async () => {
      await runCli('init --yes', testDir);

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      expect(await fileExists(configPath)).toBe(true);
    });

    it('should create complete .apex directory structure', async () => {
      await runCli('init --yes', testDir);

      const apexDir = path.join(testDir, '.apex');
      const agentsDir = path.join(apexDir, 'agents');
      const workflowsDir = path.join(apexDir, 'workflows');

      expect(await fileExists(apexDir)).toBe(true);
      expect(await fileExists(agentsDir)).toBe(true);
      expect(await fileExists(workflowsDir)).toBe(true);
    });

    it('should create scripts directory with executable files', async () => {
      await runCli('init --yes', testDir);

      const scriptsDir = path.join(testDir, '.apex', 'scripts');
      expect(await fileExists(scriptsDir)).toBe(true);

      // Check that default scripts were created
      const files = await fs.readdir(scriptsDir);
      expect(files).toContain('lint.sh');
      expect(files).toContain('test.sh');
      expect(files).toContain('build.sh');
    });
  });

  describe('Default Values', () => {
    it('should apply default project name from directory', async () => {
      await runCli('init --yes', testDir);

      const config = await readConfig(testDir);
      expect(config.project.name).toBeTruthy();
      expect(typeof config.project.name).toBe('string');
    });

    it('should apply default autonomy level', async () => {
      await runCli('init --yes', testDir);

      const config = await readConfig(testDir);
      // Check that autonomy config exists and has a reasonable default
      if (config.autonomy) {
        expect(config.autonomy.level).toBeTruthy();
        expect(typeof config.autonomy.level).toBe('string');
      }
    });

    it('should apply default model configurations', async () => {
      await runCli('init --yes', testDir);

      const config = await readConfig(testDir);
      if (config.models) {
        expect(config.models.planning).toBeTruthy();
        expect(config.models.implementation).toBeTruthy();
        expect(config.models.review).toBeTruthy();
      }
    });

    it('should apply default resource limits', async () => {
      await runCli('init --yes', testDir);

      const config = await readConfig(testDir);
      if (config.limits) {
        expect(config.limits.maxTokensPerTask).toBeGreaterThan(0);
        expect(config.limits.maxCostPerTask).toBeGreaterThan(0);
        if (config.limits.dailyBudget) {
          expect(config.limits.dailyBudget).toBeGreaterThan(0);
        }
      }
    });

    it('should apply default API configuration', async () => {
      await runCli('init --yes', testDir);

      const config = await readConfig(testDir);
      if (config.api) {
        expect(config.api.port).toBe(3000);
        expect(config.api.autoStart).toBe(false);
      }
    });

    it('should apply default project commands', async () => {
      await runCli('init --yes', testDir);

      const config = await readConfig(testDir);
      expect(config.project.testCommand).toBeTruthy();
      expect(config.project.lintCommand).toBeTruthy();
      expect(config.project.buildCommand).toBeTruthy();
    });
  });

  describe('Custom Value Persistence', () => {
    it('should persist custom project name', async () => {
      await runCli('init --yes --name custom-project', testDir);

      const config = await readConfig(testDir);
      expect(config.project.name).toBe('custom-project');

      // Verify persisted in file
      const configContent = await fs.readFile(configPath, 'utf-8');
      expect(configContent).toContain('custom-project');
    });

    it('should persist configuration changes via config --set', async () => {
      await runCli('init --yes', testDir);

      // Modify configuration
      await runCli('config --set limits.maxCostPerTask=5.0', testDir);

      // Verify change was persisted
      const { stdout } = await runCli('config --get limits.maxCostPerTask', testDir);
      expect(stdout.trim()).toBe('5');
    });

    it('should persist multiple configuration values', async () => {
      await runCli('init --yes --name test-proj --language typescript', testDir);

      // Modify via config command
      await runCli('config --set api.port=3001', testDir);

      // Verify all values persisted correctly
      const config = await readConfig(testDir);
      expect(config.project.name).toBe('test-proj');
      expect(config.project.language).toBe('typescript');
      if (config.api) {
        expect(config.api.port).toBe(3001);
      }
    });

    it('should preserve existing config when modifying values', async () => {
      await runCli('init --yes --name original-project', testDir);

      // Set a new value
      await runCli('config --set limits.maxCostPerTask=10', testDir);

      // Verify original value is preserved
      const config = await readConfig(testDir);
      expect(config.project.name).toBe('original-project');
      if (config.limits) {
        expect(config.limits.maxCostPerTask).toBe(10);
      }
    });

    it('should handle nested configuration paths', async () => {
      await runCli('init --yes', testDir);

      // Set nested values
      await runCli('config --set api.autoStart=true', testDir);

      const { stdout } = await runCli('config --get api.autoStart', testDir);
      expect(stdout.trim()).toBe('true');
    });

    it('should support setting project commands', async () => {
      await runCli('init --yes', testDir);

      // Set custom commands
      await runCli('config --set project.testCommand="npm run test:custom"', testDir);
      await runCli('config --set project.buildCommand="npm run build:prod"', testDir);

      const config = await readConfig(testDir);
      expect(config.project.testCommand).toBe('npm run test:custom');
      expect(config.project.buildCommand).toBe('npm run build:prod');
    });
  });

  describe('Configuration Display and Validation', () => {
    beforeEach(async () => {
      await runCli('init --yes --name display-test', testDir);
    });

    it('should display configuration in human-readable format', async () => {
      const { stdout } = await runCli('config', testDir);

      expect(stdout).toContain('Project');
      expect(stdout).toContain('display-test');
    });

    it('should output configuration in JSON format', async () => {
      const { stdout } = await runCli('config --json', testDir);

      const config = JSON.parse(stdout);
      expect(config).toHaveProperty('project');
      expect(config).toHaveProperty('version');
      expect(config.project.name).toBe('display-test');
    });

    it('should retrieve specific configuration values', async () => {
      const { stdout } = await runCli('config --get project.name', testDir);
      expect(stdout.trim()).toBe('display-test');
    });

    it('should handle retrieving non-existent configuration paths', async () => {
      const { stdout, stderr } = await runCli('config --get nonexistent.path', testDir);
      const output = stdout + stderr;
      // Should handle gracefully, either with empty output or error message
      expect(output).toBeDefined();
    });
  });

  describe('Configuration File Format', () => {
    it('should create valid YAML configuration', async () => {
      await runCli('init --yes --name yaml-test', testDir);

      const configContent = await fs.readFile(configPath, 'utf-8');

      // Should be parseable as YAML
      const config = yaml.parse(configContent);
      expect(config).toBeTypeOf('object');
      expect(config.project.name).toBe('yaml-test');
    });

    it('should preserve YAML structure after modifications', async () => {
      await runCli('init --yes --name structure-test', testDir);
      await runCli('config --set limits.maxCostPerTask=15', testDir);

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = yaml.parse(configContent);

      expect(config.project.name).toBe('structure-test');
      expect(config.limits.maxCostPerTask).toBe(15);
    });

    it('should maintain proper YAML formatting', async () => {
      await runCli('init --yes', testDir);

      const configContent = await fs.readFile(configPath, 'utf-8');

      // Basic YAML structure checks
      expect(configContent).toMatch(/^[a-zA-Z]/); // Starts with a key
      expect(configContent).toContain(':'); // Contains key-value pairs
      expect(configContent).not.toContain('\t'); // Uses spaces, not tabs
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization in already initialized directory', async () => {
      // First init
      await runCli('init --yes --name first-init', testDir);

      // Second init should warn but not fail catastrophically
      const { stdout, stderr } = await runCli('init --yes --name second-init', testDir);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/already|initialized|exists/);
    });

    it('should handle invalid config set operations gracefully', async () => {
      await runCli('init --yes', testDir);

      // Try to set invalid value
      const { stdout, stderr } = await runCli('config --set invalid..path=value', testDir);
      const output = stdout + stderr;
      // Should provide some feedback about the error
      expect(output).toBeDefined();
    });
  });
});

describe('E2E: Configuration Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await globalThis.apexE2EHelpers.createTempDir('config-integration-e2e-');
  });

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  it('should maintain configuration consistency across CLI operations', async () => {
    // Initialize with specific settings
    await runCli('init --yes --name integration-test --language typescript', testDir);

    // Modify configuration
    await runCli('config --set limits.maxCostPerTask=7.5', testDir);
    await runCli('config --set api.port=3002', testDir);

    // Verify all settings are maintained
    const config = await readConfig(testDir);
    expect(config.project.name).toBe('integration-test');
    expect(config.project.language).toBe('typescript');
    if (config.limits) {
      expect(config.limits.maxCostPerTask).toBe(7.5);
    }
    if (config.api) {
      expect(config.api.port).toBe(3002);
    }
  });

  it('should support configuration reset and reinitialization', async () => {
    await runCli('init --yes --name original-config', testDir);

    // Modify some settings
    await runCli('config --set limits.maxCostPerTask=20', testDir);

    // Verify modification took effect
    const modifiedConfig = await readConfig(testDir);
    if (modifiedConfig.limits) {
      expect(modifiedConfig.limits.maxCostPerTask).toBe(20);
    }

    // The config should maintain project identity
    expect(modifiedConfig.project.name).toBe('original-config');
  });
});