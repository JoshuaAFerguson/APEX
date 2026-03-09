/**
 * Test suite for the apex config command functionality
 * Verifies the handleConfig function supports:
 * - Viewing full configuration
 * - Getting nested values with dot notation
 * - Setting values with JSON parsing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

describe('APEX Config Command', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-config-test-'));
    process.chdir(tempDir);

    // Initialize APEX project
    await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} init --yes --name config-test-project`);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('View Configuration', () => {
    it('should display full configuration without flags', async () => {
      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config`);

      expect(stdout).toContain('Project:');
      expect(stdout).toContain('Autonomy:');
      expect(stdout).toContain('Models:');
      expect(stdout).toContain('Limits:');
      expect(stdout).toContain('config-test-project');
    });

    it('should output JSON with --json flag', async () => {
      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --json`);

      const config = JSON.parse(stdout);
      expect(config).toHaveProperty('project');
      expect(config).toHaveProperty('version');
      expect(config.project.name).toBe('config-test-project');
    });
  });

  describe('Get Nested Values (Dot Notation)', () => {
    it('should get project name using dot notation', async () => {
      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get project.name`);
      expect(stdout.trim()).toBe('config-test-project');
    });

    it('should get nested autonomy level using dot notation', async () => {
      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get autonomy.level`);
      expect(stdout.trim()).toBeTruthy();
      expect(['full-auto', 'review-before-commit', 'review-all'].some(level =>
        stdout.trim().includes(level)
      )).toBe(true);
    });

    it('should get nested model configuration using dot notation', async () => {
      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get models.planning`);
      expect(stdout.trim()).toBeTruthy();
    });

    it('should handle non-existent keys gracefully', async () => {
      const { stdout, stderr } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get nonexistent.key`, {
        encoding: 'utf-8'
      }).catch(err => err);

      expect(stderr || stdout).toContain('Key not found: nonexistent.key');
    });

    it('should work with alternative get syntax', async () => {
      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config get project.name`);
      expect(stdout.trim()).toBe('config-test-project');
    });
  });

  describe('Set Values with JSON Parsing', () => {
    it('should set string values', async () => {
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --set project.description=test-description`);

      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get project.description`);
      expect(stdout.trim()).toBe('test-description');
    });

    it('should set boolean values with JSON parsing', async () => {
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --set testFlag=true`);

      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get testFlag`);
      expect(stdout.trim()).toBe('true');
    });

    it('should set numeric values with JSON parsing', async () => {
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --set limits.maxCostPerTask=5.5`);

      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get limits.maxCostPerTask`);
      expect(parseFloat(stdout.trim())).toBe(5.5);
    });

    it('should create nested objects when setting deep paths', async () => {
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --set new.nested.value=test`);

      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get new.nested.value`);
      expect(stdout.trim()).toBe('test');
    });

    it('should work with alternative set syntax', async () => {
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config set testValue=alternative`);

      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config get testValue`);
      expect(stdout.trim()).toBe('alternative');
    });

    it('should persist changes to config file', async () => {
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --set project.customField=persistent`);

      // Read config file directly
      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      expect(configContent).toContain('customField');
      expect(configContent).toContain('persistent');
    });

    it('should handle invalid set format gracefully', async () => {
      const { stdout, stderr } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --set invalidformat`, {
        encoding: 'utf-8'
      }).catch(err => err);

      expect(stderr || stdout).toContain('Invalid format');
    });
  });

  describe('Error Handling', () => {
    it('should require APEX initialization', async () => {
      // Create a new temp directory without initialization
      const uninitializedDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-uninitialized-'));

      try {
        const { stdout, stderr } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config`, {
          cwd: uninitializedDir,
          encoding: 'utf-8'
        }).catch(err => err);

        expect(stderr || stdout).toContain('APEX not initialized');
      } finally {
        await fs.rm(uninitializedDir, { recursive: true, force: true });
      }
    });
  });
});