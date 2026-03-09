/**
 * Fixed test suite for the apex config command functionality
 * Addresses CLI output format issues and verifies functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// Helper function to extract clean output from CLI
function extractCleanOutput(output: string): string {
  const lines = output.split('\n');
  // Filter out initialization messages and warnings
  const cleanLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed &&
      !trimmed.includes('No .apexrules file found') &&
      !trimmed.includes('ESLint plugin registered') &&
      !trimmed.includes('Prettier plugin registered') &&
      !trimmed.includes('SecretScanner initialized') &&
      !trimmed.includes('Proceeding without project rules');
  });
  return cleanLines.join('\n').trim();
}

// Helper function to extract JSON from output
function extractJsonFromOutput(output: string): any {
  const lines = output.split('\n');

  // Find the first line that starts with '{'
  let jsonStart = -1;
  let jsonEnd = -1;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (jsonStart === -1 && line.startsWith('{')) {
      jsonStart = i;
    }

    if (jsonStart !== -1) {
      // Count braces to find end of JSON object
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }

      if (braceCount === 0) {
        jsonEnd = i;
        break;
      }
    }
  }

  if (jsonStart >= 0 && jsonEnd >= 0) {
    const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
    const jsonContent = jsonLines.join('\n');
    return JSON.parse(jsonContent);
  }

  throw new Error(`No valid JSON found in output: ${output}`);
}

describe('APEX Config Command - Fixed', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-config-fixed-'));
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

      const config = extractJsonFromOutput(stdout);
      expect(config).toHaveProperty('project');
      expect(config).toHaveProperty('version');
      expect(config.project.name).toBe('config-test-project');
    });
  });

  describe('Get Nested Values (Dot Notation)', () => {
    it('should get project name using dot notation', async () => {
      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get project.name`);
      const cleanOutput = extractCleanOutput(stdout);
      expect(cleanOutput).toBe('config-test-project');
    });

    it('should get nested autonomy level using dot notation', async () => {
      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get autonomy.level`);
      const cleanOutput = extractCleanOutput(stdout);
      expect(['full-auto', 'review-before-commit', 'review-all'].some(level =>
        cleanOutput.includes(level)
      )).toBe(true);
    });

    it('should get nested model configuration using dot notation', async () => {
      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get models.planning`);
      const cleanOutput = extractCleanOutput(stdout);
      expect(cleanOutput.length).toBeGreaterThan(0);
    });

    it('should handle non-existent keys gracefully', async () => {
      const { stdout, stderr } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get nonexistent.key`, {
        encoding: 'utf-8'
      }).catch(err => err);

      const output = extractCleanOutput(stderr || stdout);
      expect(output).toContain('Key not found: nonexistent.key');
    });

    it('should work with alternative get syntax', async () => {
      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config get project.name`);
      const cleanOutput = extractCleanOutput(stdout);
      expect(cleanOutput).toBe('config-test-project');
    });
  });

  describe('Set Values with JSON Parsing', () => {
    it('should set string values', async () => {
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --set project.description=test-description`);

      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get project.description`);
      const cleanOutput = extractCleanOutput(stdout);
      expect(cleanOutput).toBe('test-description');
    });

    it('should set boolean values with JSON parsing', async () => {
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --set testFlag=true`);

      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get testFlag`);
      const cleanOutput = extractCleanOutput(stdout);
      expect(cleanOutput).toBe('true');
    });

    it('should set numeric values with JSON parsing', async () => {
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --set limits.maxCostPerTask=5.5`);

      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get limits.maxCostPerTask`);
      const cleanOutput = extractCleanOutput(stdout);
      expect(parseFloat(cleanOutput)).toBe(5.5);
    });

    it('should create nested objects when setting deep paths', async () => {
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --set new.nested.value=test`);

      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get new.nested.value`);
      const cleanOutput = extractCleanOutput(stdout);
      expect(cleanOutput).toBe('test');
    });

    it('should work with alternative set syntax', async () => {
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config set testValue=alternative`);

      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config get testValue`);
      const cleanOutput = extractCleanOutput(stdout);
      expect(cleanOutput).toBe('alternative');
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

      const output = extractCleanOutput(stderr || stdout);
      expect(output).toContain('Invalid format');
    });
  });

  describe('Enhanced JSON Parsing Tests', () => {
    it('should handle JSON objects', async () => {
      const jsonObj = '{"key":"value","number":42}';
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --set 'complexObject=${jsonObj}'`);

      // Get back as JSON to verify structure
      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --json`);
      const config = extractJsonFromOutput(stdout);
      expect(config.complexObject).toEqual({ key: 'value', number: 42 });
    });

    it('should handle JSON arrays', async () => {
      const jsonArray = '[1,2,"three",true]';
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --set 'arrayValue=${jsonArray}'`);

      // Get back as JSON to verify structure
      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --json`);
      const config = extractJsonFromOutput(stdout);
      expect(config.arrayValue).toEqual([1, 2, 'three', true]);
    });

    it('should handle null values', async () => {
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --set nullValue=null`);

      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --json`);
      const config = extractJsonFromOutput(stdout);
      expect(config.nullValue).toBeNull();
    });

    it('should handle quoted strings', async () => {
      await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --set 'quotedString="hello world"'`);

      const { stdout } = await execAsync(`node ${path.join(originalCwd, 'packages/cli/dist/index.js')} config --get quotedString`);
      const cleanOutput = extractCleanOutput(stdout);
      expect(cleanOutput).toBe('hello world');
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

        const output = extractCleanOutput(stderr || stdout);
        expect(output).toContain('APEX not initialized');
      } finally {
        await fs.rm(uninitializedDir, { recursive: true, force: true });
      }
    });
  });
});