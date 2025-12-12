/**
 * End-to-end tests for APEX CLI
 *
 * These tests verify the CLI commands work correctly by:
 * 1. Creating a test project directory
 * 2. Running actual CLI commands via child_process
 * 3. Verifying expected outcomes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// Path to the CLI
const CLI_PATH = path.join(__dirname, '../../packages/cli/dist/index.js');

// Helper to run CLI commands
async function runCli(args: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execAsync(`node ${CLI_PATH} ${args}`, {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
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

describe('E2E: CLI Commands', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-e2e-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('apex --version', () => {
    it('should display version', async () => {
      const { stdout } = await runCli('--version', testDir);
      expect(stdout).toContain('0.1.0');
    });
  });

  describe('apex --help', () => {
    it('should display help', async () => {
      const { stdout } = await runCli('--help', testDir);
      expect(stdout).toContain('APEX');
      expect(stdout).toContain('init');
      expect(stdout).toContain('status');
    });
  });

  describe('apex init', () => {
    it('should initialize project with --yes flag', async () => {
      const { stdout } = await runCli('init --yes', testDir);

      // Check output
      expect(stdout).toContain('APEX');

      // Verify files created
      const apexDir = path.join(testDir, '.apex');
      const configFile = path.join(apexDir, 'config.yaml');
      const agentsDir = path.join(apexDir, 'agents');
      const workflowsDir = path.join(apexDir, 'workflows');

      expect(await fs.stat(apexDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.stat(configFile).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.stat(agentsDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.stat(workflowsDir).then(() => true).catch(() => false)).toBe(true);
    });

    it('should create default agents', async () => {
      await runCli('init --yes', testDir);

      const agentsDir = path.join(testDir, '.apex', 'agents');
      const files = await fs.readdir(agentsDir);

      expect(files).toContain('planner.md');
      expect(files).toContain('developer.md');
      expect(files).toContain('reviewer.md');
      expect(files).toContain('tester.md');
    });

    it('should create default workflows', async () => {
      await runCli('init --yes', testDir);

      const workflowsDir = path.join(testDir, '.apex', 'workflows');
      const files = await fs.readdir(workflowsDir);

      expect(files).toContain('feature.yaml');
      expect(files).toContain('bugfix.yaml');
      expect(files).toContain('refactor.yaml');
    });

    it('should warn if already initialized', async () => {
      // First init
      await runCli('init --yes', testDir);

      // Second init should warn
      const { stdout } = await runCli('init --yes', testDir);
      expect(stdout).toContain('already initialized');
    });

    it('should accept project name option', async () => {
      await runCli('init --yes --name my-test-project', testDir);

      const configFile = path.join(testDir, '.apex', 'config.yaml');
      const config = await fs.readFile(configFile, 'utf-8');
      expect(config).toContain('my-test-project');
    });
  });

  describe('apex agents', () => {
    beforeEach(async () => {
      await runCli('init --yes', testDir);
    });

    it('should list available agents', async () => {
      const { stdout } = await runCli('agents', testDir);

      expect(stdout).toContain('planner');
      expect(stdout).toContain('developer');
      expect(stdout).toContain('reviewer');
      expect(stdout).toContain('tester');
    });
  });

  describe('apex workflows', () => {
    beforeEach(async () => {
      await runCli('init --yes', testDir);
    });

    it('should list available workflows', async () => {
      const { stdout } = await runCli('workflows', testDir);

      expect(stdout).toContain('feature');
      expect(stdout).toContain('bugfix');
      expect(stdout).toContain('refactor');
    });
  });

  describe('apex config', () => {
    beforeEach(async () => {
      await runCli('init --yes', testDir);
    });

    it('should display configuration', async () => {
      const { stdout } = await runCli('config', testDir);

      expect(stdout).toContain('Project');
      expect(stdout).toContain('Autonomy');
      expect(stdout).toContain('Models');
      expect(stdout).toContain('Limits');
    });

    it('should output JSON with --json flag', async () => {
      const { stdout } = await runCli('config --json', testDir);

      const config = JSON.parse(stdout);
      expect(config).toHaveProperty('project');
      expect(config).toHaveProperty('version');
    });

    it('should get specific config value', async () => {
      const { stdout } = await runCli('config --get project.name', testDir);
      expect(stdout.trim()).toBeTruthy();
    });

    it('should set config value', async () => {
      await runCli('config --set limits.maxCostPerTask=5.0', testDir);

      const { stdout } = await runCli('config --get limits.maxCostPerTask', testDir);
      expect(stdout.trim()).toBe('5');
    });
  });

  describe('apex status', () => {
    beforeEach(async () => {
      await runCli('init --yes', testDir);
    });

    it('should show no tasks message when empty', async () => {
      const { stdout } = await runCli('status', testDir);
      expect(stdout).toContain('No tasks');
    });
  });

  describe('Error handling', () => {
    it('should error when not initialized', async () => {
      const { stdout, stderr } = await runCli('status', testDir);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toContain('not initialized');
    });

    it('should show help for unknown commands', async () => {
      const { stdout, stderr } = await runCli('unknown-command', testDir);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/unknown|error/);
    });
  });
});

describe('E2E: Project Structure', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-e2e-struct-'));
    await runCli('init --yes --name test-project --language typescript', testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should create valid config.yaml', async () => {
    const configPath = path.join(testDir, '.apex', 'config.yaml');
    const content = await fs.readFile(configPath, 'utf-8');

    // Should be valid YAML with expected structure
    expect(content).toContain('version:');
    expect(content).toContain('project:');
    expect(content).toContain('name:');
  });

  it('should create agent files with valid frontmatter', async () => {
    const agentPath = path.join(testDir, '.apex', 'agents', 'developer.md');
    const content = await fs.readFile(agentPath, 'utf-8');

    // Should have YAML frontmatter
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('name:');
    expect(content).toContain('description:');
  });

  it('should create workflow files with valid YAML', async () => {
    const workflowPath = path.join(testDir, '.apex', 'workflows', 'feature.yaml');
    const content = await fs.readFile(workflowPath, 'utf-8');

    expect(content).toContain('name:');
    expect(content).toContain('stages:');
    expect(content).toContain('agent:');
  });

  it('should create executable scripts', async () => {
    const scriptsDir = path.join(testDir, '.apex', 'scripts');
    const files = await fs.readdir(scriptsDir);

    expect(files).toContain('lint.sh');
    expect(files).toContain('test.sh');
    expect(files).toContain('build.sh');

    // Check scripts are executable
    for (const file of files) {
      const stats = await fs.stat(path.join(scriptsDir, file));
      // Check execute bit is set (mode & 0o111)
      expect(stats.mode & 0o111).toBeGreaterThan(0);
    }
  });

  it('should create database file on first status check', async () => {
    // Run status to trigger database creation
    await runCli('status', testDir);

    const dbPath = path.join(testDir, '.apex', 'apex.db');
    expect(await fs.stat(dbPath).then(() => true).catch(() => false)).toBe(true);
  });
});
