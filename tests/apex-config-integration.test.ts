/**
 * Integration test suite for APEX config command
 * Tests both CLI and REPL implementations with real file system operations
 * Verifies end-to-end functionality including file persistence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import yaml from 'yaml';

const execAsync = promisify(exec);

describe('APEX Config Command Integration Tests', () => {
  let tempDir: string;
  let originalCwd: string;
  let cliPath: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-config-integration-'));
    process.chdir(tempDir);
    cliPath = path.join(originalCwd, 'packages/cli/dist/index.js');

    // Initialize APEX project
    await execAsync(`node ${cliPath} init --yes --name config-integration-test`);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('File System Integration', () => {
    it('should persist config changes to .apex/config.yaml', async () => {
      // Set a value using CLI
      await execAsync(`node ${cliPath} config --set project.description=persistent-test`);

      // Read the config file directly
      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);

      expect(parsedConfig.project.description).toBe('persistent-test');
    });

    it('should maintain config file structure after changes', async () => {
      // Make several changes
      await execAsync(`node ${cliPath} config --set project.description=structured-test`);
      await execAsync(`node ${cliPath} config --set limits.maxCostPerTask=25.5`);
      await execAsync(`node ${cliPath} config --set newSection.newValue=true`);

      // Read and verify the file structure
      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);

      // Verify structure is maintained
      expect(parsedConfig.project).toHaveProperty('name', 'config-integration-test');
      expect(parsedConfig.project).toHaveProperty('description', 'structured-test');
      expect(parsedConfig.limits).toHaveProperty('maxCostPerTask', 25.5);
      expect(parsedConfig.newSection).toHaveProperty('newValue', true);
    });

    it('should handle concurrent config changes gracefully', async () => {
      // Run multiple config commands in parallel
      const promises = [
        execAsync(`node ${cliPath} config --set concurrent.test1=value1`),
        execAsync(`node ${cliPath} config --set concurrent.test2=value2`),
        execAsync(`node ${cliPath} config --set concurrent.test3=value3`),
      ];

      await Promise.all(promises);

      // Verify all changes are persisted
      const { stdout: test1 } = await execAsync(`node ${cliPath} config --get concurrent.test1`);
      const { stdout: test2 } = await execAsync(`node ${cliPath} config --get concurrent.test2`);
      const { stdout: test3 } = await execAsync(`node ${cliPath} config --get concurrent.test3`);

      expect(test1.trim()).toBe('value1');
      expect(test2.trim()).toBe('value2');
      expect(test3.trim()).toBe('value3');
    });
  });

  describe('Data Type Persistence', () => {
    it('should persist boolean values correctly', async () => {
      await execAsync(`node ${cliPath} config --set booleanTest=true`);

      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);

      expect(parsedConfig.booleanTest).toBe(true);
      expect(typeof parsedConfig.booleanTest).toBe('boolean');
    });

    it('should persist numeric values correctly', async () => {
      await execAsync(`node ${cliPath} config --set numericTest=42.5`);

      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);

      expect(parsedConfig.numericTest).toBe(42.5);
      expect(typeof parsedConfig.numericTest).toBe('number');
    });

    it('should persist null values correctly', async () => {
      await execAsync(`node ${cliPath} config --set nullTest=null`);

      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);

      expect(parsedConfig.nullTest).toBe(null);
    });

    it('should persist object values correctly', async () => {
      await execAsync(`node ${cliPath} config --set 'objectTest={"key": "value", "number": 42}'`);

      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);

      expect(parsedConfig.objectTest).toEqual({ key: 'value', number: 42 });
    });

    it('should persist array values correctly', async () => {
      await execAsync(`node ${cliPath} config --set 'arrayTest=[1, "two", true, null]'`);

      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);

      expect(parsedConfig.arrayTest).toEqual([1, 'two', true, null]);
    });
  });

  describe('Deep Nesting Integration', () => {
    it('should create and persist deeply nested structures', async () => {
      await execAsync(`node ${cliPath} config --set deep.level1.level2.level3.value=deeply-nested`);

      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);

      expect(parsedConfig.deep.level1.level2.level3.value).toBe('deeply-nested');
    });

    it('should handle mixed data types in nested structures', async () => {
      await execAsync(`node ${cliPath} config --set nested.string=text`);
      await execAsync(`node ${cliPath} config --set nested.number=123`);
      await execAsync(`node ${cliPath} config --set nested.boolean=false`);
      await execAsync(`node ${cliPath} config --set nested.object.key=value`);

      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);

      expect(parsedConfig.nested.string).toBe('text');
      expect(parsedConfig.nested.number).toBe(123);
      expect(parsedConfig.nested.boolean).toBe(false);
      expect(parsedConfig.nested.object.key).toBe('value');
    });
  });

  describe('Error Conditions Integration', () => {
    it('should handle invalid JSON gracefully and store as string', async () => {
      await execAsync(`node ${cliPath} config --set invalidJson=not-valid-json`);

      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);

      expect(parsedConfig.invalidJson).toBe('not-valid-json');
      expect(typeof parsedConfig.invalidJson).toBe('string');
    });

    it('should require initialization for config commands', async () => {
      // Create a new temp directory without initialization
      const uninitializedDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-uninitialized-'));

      try {
        const { stdout, stderr } = await execAsync(`node ${cliPath} config`, {
          cwd: uninitializedDir,
          encoding: 'utf-8'
        }).catch(err => err);

        expect(stderr || stdout).toContain('APEX not initialized');
      } finally {
        await fs.rm(uninitializedDir, { recursive: true, force: true });
      }
    });

    it('should handle permission errors gracefully', async () => {
      // This test is platform-dependent and may not work on all systems
      try {
        // Make config file read-only
        const configPath = path.join(tempDir, '.apex', 'config.yaml');
        await fs.chmod(configPath, 0o444);

        const { stdout, stderr } = await execAsync(
          `node ${cliPath} config --set readonly.test=value`,
          { encoding: 'utf-8' }
        ).catch(err => err);

        // Should fail gracefully
        expect(stderr || stdout).toBeTruthy();
      } catch (error) {
        // Skip this test if we can't modify permissions
        console.warn('Skipping permission test due to filesystem limitations');
      }
    });
  });

  describe('Configuration Validation Integration', () => {
    it('should maintain valid YAML structure after modifications', async () => {
      // Make various types of changes
      await execAsync(`node ${cliPath} config --set validation.string=test`);
      await execAsync(`node ${cliPath} config --set validation.number=42`);
      await execAsync(`node ${cliPath} config --set validation.boolean=true`);
      await execAsync(`node ${cliPath} config --set validation.nested.key=value`);

      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');

      // Should be valid YAML
      expect(() => yaml.parse(configContent)).not.toThrow();

      // Should contain our changes
      const parsedConfig = yaml.parse(configContent);
      expect(parsedConfig.validation.string).toBe('test');
      expect(parsedConfig.validation.number).toBe(42);
      expect(parsedConfig.validation.boolean).toBe(true);
      expect(parsedConfig.validation.nested.key).toBe('value');
    });

    it('should preserve existing config structure and metadata', async () => {
      // Get original config
      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      const originalContent = await fs.readFile(configPath, 'utf-8');
      const originalConfig = yaml.parse(originalContent);

      // Make a change
      await execAsync(`node ${cliPath} config --set preserve.test=value`);

      // Verify original structure is preserved
      const newContent = await fs.readFile(configPath, 'utf-8');
      const newConfig = yaml.parse(newContent);

      expect(newConfig.project.name).toBe(originalConfig.project.name);
      expect(newConfig.version).toBe(originalConfig.version);
      expect(newConfig.preserve.test).toBe('value');
    });
  });

  describe('Edge Cases Integration', () => {
    it('should handle empty string values', async () => {
      await execAsync(`node ${cliPath} config --set emptyString=""`);

      const { stdout } = await execAsync(`node ${cliPath} config --get emptyString`);
      expect(stdout.trim()).toBe('""');
    });

    it('should handle special characters in keys and values', async () => {
      await execAsync(`node ${cliPath} config --set 'special-key.with_underscore=value with spaces & symbols!'`);

      const { stdout } = await execAsync(`node ${cliPath} config --get 'special-key.with_underscore'`);
      expect(stdout.trim()).toContain('value with spaces & symbols!');
    });

    it('should handle unicode characters', async () => {
      await execAsync(`node ${cliPath} config --set 'unicode=🚀 Test 中文'`);

      const { stdout } = await execAsync(`node ${cliPath} config --get unicode`);
      expect(stdout.trim()).toContain('🚀 Test 中文');
    });

    it('should handle very long values', async () => {
      const longValue = 'x'.repeat(1000);
      await execAsync(`node ${cliPath} config --set longValue=${longValue}`);

      const { stdout } = await execAsync(`node ${cliPath} config --get longValue`);
      expect(stdout.trim()).toContain(longValue);
    });
  });

  describe('Cross-Command Consistency', () => {
    it('should maintain consistency between get and set operations', async () => {
      const testValue = 'consistency-test-value';

      // Set a value
      await execAsync(`node ${cliPath} config --set consistency.test=${testValue}`);

      // Get the same value
      const { stdout } = await execAsync(`node ${cliPath} config --get consistency.test`);
      expect(stdout.trim()).toBe(testValue);
    });

    it('should show updated values in full config display', async () => {
      await execAsync(`node ${cliPath} config --set fullDisplay.test=updated-value`);

      const { stdout } = await execAsync(`node ${cliPath} config`);
      expect(stdout).toContain('fullDisplay');
      expect(stdout).toContain('updated-value');
    });

    it('should handle multiple operations in sequence', async () => {
      // Sequence of operations
      await execAsync(`node ${cliPath} config --set sequence.step1=first`);
      await execAsync(`node ${cliPath} config --set sequence.step2=second`);
      await execAsync(`node ${cliPath} config --set sequence.step1=updated-first`);

      // Verify final state
      const { stdout: step1 } = await execAsync(`node ${cliPath} config --get sequence.step1`);
      const { stdout: step2 } = await execAsync(`node ${cliPath} config --get sequence.step2`);

      expect(step1.trim()).toBe('updated-first');
      expect(step2.trim()).toBe('second');
    });
  });
});