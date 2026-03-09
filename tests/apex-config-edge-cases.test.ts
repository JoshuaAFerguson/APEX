/**
 * Edge cases and error scenarios test suite for APEX config command
 * Tests boundary conditions, error handling, and unusual input scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

describe('APEX Config Command Edge Cases', () => {
  let tempDir: string;
  let originalCwd: string;
  let cliPath: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-config-edge-'));
    process.chdir(tempDir);
    cliPath = path.join(originalCwd, 'packages/cli/dist/index.js');

    // Initialize APEX project
    await execAsync(`node ${cliPath} init --yes --name edge-case-test`);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle keys with dots in the key name itself', async () => {
      // This tests the edge case where the key contains dots but is not nested
      const result = await execAsync(`node ${cliPath} config --set 'key.with.dots=value'`).catch(err => err);

      // Should create nested structure: key -> with -> dots = value
      const { stdout } = await execAsync(`node ${cliPath} config --get key.with.dots`);
      expect(stdout.trim()).toBe('value');
    });

    it('should handle empty keys', async () => {
      const result = await execAsync(`node ${cliPath} config --set '=value'`).catch(err => err);
      expect(result.stderr || result.stdout).toContain('Invalid format');
    });

    it('should handle keys with only dots', async () => {
      const result = await execAsync(`node ${cliPath} config --set '...=value'`).catch(err => err);
      // Should create nested empty keys
      expect(result.code).toBeTruthy();
    });

    it('should handle very long keys', async () => {
      const longKey = 'a'.repeat(1000);
      await execAsync(`node ${cliPath} config --set ${longKey}=value`);

      const { stdout } = await execAsync(`node ${cliPath} config --get ${longKey}`);
      expect(stdout.trim()).toBe('value');
    });

    it('should handle keys starting with numbers', async () => {
      await execAsync(`node ${cliPath} config --set '123key=value'`);

      const { stdout } = await execAsync(`node ${cliPath} config --get 123key`);
      expect(stdout.trim()).toBe('value');
    });

    it('should handle keys with special characters', async () => {
      // Test various special characters that might cause issues
      const specialKeys = [
        'key-with-hyphens',
        'key_with_underscores',
        'key@with@symbols',
        'key$with$dollars',
        'key%with%percent',
        'key[with]brackets',
      ];

      for (const key of specialKeys) {
        await execAsync(`node ${cliPath} config --set '${key}=test-value'`);
        const { stdout } = await execAsync(`node ${cliPath} config --get '${key}'`);
        expect(stdout.trim()).toBe('test-value');
      }
    });
  });

  describe('Value Parsing Edge Cases', () => {
    it('should handle values that look like booleans but are strings', async () => {
      await execAsync(`node ${cliPath} config --set 'boolString="true"'`);

      const { stdout } = await execAsync(`node ${cliPath} config --get boolString`);
      expect(stdout.trim()).toBe('"true"');
    });

    it('should handle values that look like numbers but are strings', async () => {
      await execAsync(`node ${cliPath} config --set 'numString="123"'`);

      const { stdout } = await execAsync(`node ${cliPath} config --get numString`);
      expect(stdout.trim()).toBe('"123"');
    });

    it('should handle scientific notation', async () => {
      await execAsync(`node ${cliPath} config --set scientific=1.23e10`);

      const { stdout } = await execAsync(`node ${cliPath} config --get scientific`);
      expect(stdout.trim()).toBe('12300000000');
    });

    it('should handle negative numbers', async () => {
      await execAsync(`node ${cliPath} config --set negative=-42.5`);

      const { stdout } = await execAsync(`node ${cliPath} config --get negative`);
      expect(stdout.trim()).toBe('-42.5');
    });

    it('should handle infinity values', async () => {
      await execAsync(`node ${cliPath} config --set infinity=Infinity`).catch(err => err);

      // Infinity is not valid JSON, should be stored as string
      const { stdout } = await execAsync(`node ${cliPath} config --get infinity`);
      expect(stdout.trim()).toBe('"Infinity"');
    });

    it('should handle NaN values', async () => {
      await execAsync(`node ${cliPath} config --set nan=NaN`);

      // NaN is not valid JSON, should be stored as string
      const { stdout } = await execAsync(`node ${cliPath} config --get nan`);
      expect(stdout.trim()).toBe('"NaN"');
    });

    it('should handle malformed JSON objects', async () => {
      const malformedJson = '{key: value}'; // Missing quotes
      await execAsync(`node ${cliPath} config --set 'malformed=${malformedJson}'`);

      // Should fall back to string
      const { stdout } = await execAsync(`node ${cliPath} config --get malformed`);
      expect(stdout.trim()).toContain(malformedJson);
    });

    it('should handle malformed JSON arrays', async () => {
      const malformedArray = '[1, 2, 3,]'; // Trailing comma
      await execAsync(`node ${cliPath} config --set 'malformedArray=${malformedArray}'`);

      // Should fall back to string
      const { stdout } = await execAsync(`node ${cliPath} config --get malformedArray`);
      expect(stdout.trim()).toContain(malformedArray);
    });

    it('should handle nested quotes', async () => {
      const nestedQuotes = '"value with \\"nested\\" quotes"';
      await execAsync(`node ${cliPath} config --set 'nestedQuotes=${nestedQuotes}'`);

      const { stdout } = await execAsync(`node ${cliPath} config --get nestedQuotes`);
      expect(stdout.trim()).toContain('nested');
    });

    it('should handle values with equals signs', async () => {
      await execAsync(`node ${cliPath} config --set 'equation=a=b+c'`);

      const { stdout } = await execAsync(`node ${cliPath} config --get equation`);
      expect(stdout.trim()).toBe('a=b+c');
    });

    it('should handle values with newlines', async () => {
      const multilineValue = '"Line 1\\nLine 2\\nLine 3"';
      await execAsync(`node ${cliPath} config --set 'multiline=${multilineValue}'`);

      const { stdout } = await execAsync(`node ${cliPath} config --get multiline`);
      expect(stdout.trim()).toContain('Line 1');
    });
  });

  describe('Command Syntax Edge Cases', () => {
    it('should handle multiple equals signs in set command', async () => {
      await execAsync(`node ${cliPath} config --set 'equation=x=y=z'`);

      const { stdout } = await execAsync(`node ${cliPath} config --get equation`);
      expect(stdout.trim()).toBe('x=y=z');
    });

    it('should handle set command without equals sign', async () => {
      const result = await execAsync(`node ${cliPath} config --set keyvalue`).catch(err => err);
      expect(result.stderr || result.stdout).toContain('Invalid format');
    });

    it('should handle get command with empty key', async () => {
      const result = await execAsync(`node ${cliPath} config --get ''`).catch(err => err);
      expect(result.stderr || result.stdout).toContain('not found');
    });

    it('should handle conflicting flags', async () => {
      const result = await execAsync(`node ${cliPath} config --get project.name --set test=value`).catch(err => err);
      // Should prioritize get over set based on argument parsing order
      expect(result.stdout || result.stderr).toBeTruthy();
    });

    it('should handle alternative syntax variations', async () => {
      // Test all supported syntax variations
      await execAsync(`node ${cliPath} config set altSyntax1=value1`);
      await execAsync(`node ${cliPath} config --set altSyntax2=value2`);

      const { stdout: result1 } = await execAsync(`node ${cliPath} config get altSyntax1`);
      const { stdout: result2 } = await execAsync(`node ${cliPath} config --get altSyntax2`);

      expect(result1.trim()).toBe('value1');
      expect(result2.trim()).toBe('value2');
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle config file corruption gracefully', async () => {
      // Corrupt the config file
      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, 'invalid: yaml: content: [unclosed');

      const result = await execAsync(`node ${cliPath} config`).catch(err => err);
      expect(result.stderr || result.stdout).toBeTruthy();
    });

    it('should handle missing config directory', async () => {
      // Remove the .apex directory
      await fs.rm(path.join(tempDir, '.apex'), { recursive: true, force: true });

      const result = await execAsync(`node ${cliPath} config`).catch(err => err);
      expect(result.stderr || result.stdout).toContain('not initialized');
    });

    it('should handle missing config file', async () => {
      // Remove just the config file
      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      await fs.rm(configPath, { force: true });

      const result = await execAsync(`node ${cliPath} config`).catch(err => err);
      expect(result.stderr || result.stdout).toBeTruthy();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle extremely large values', async () => {
      // Test with a very large string (but not too large to cause issues)
      const largeValue = 'x'.repeat(10000);
      await execAsync(`node ${cliPath} config --set largeValue=${largeValue}`);

      const { stdout } = await execAsync(`node ${cliPath} config --get largeValue`);
      expect(stdout.trim()).toContain(largeValue);
    });

    it('should handle many nested levels', async () => {
      // Create a deeply nested key (but reasonable depth)
      const deepKey = Array(20).fill('level').join('.');
      await execAsync(`node ${cliPath} config --set '${deepKey}=deep-value'`);

      const { stdout } = await execAsync(`node ${cliPath} config --get '${deepKey}'`);
      expect(stdout.trim()).toBe('deep-value');
    });

    it('should handle complex JSON structures', async () => {
      const complexJson = JSON.stringify({
        array: [1, 2, { nested: true }],
        object: { key: 'value', num: 42, bool: false },
        empty: {},
        emptyArray: [],
        null: null
      });

      await execAsync(`node ${cliPath} config --set 'complex=${complexJson}'`);

      const { stdout } = await execAsync(`node ${cliPath} config --get complex`);
      expect(stdout.trim()).toContain('array');
      expect(stdout.trim()).toContain('object');
    });
  });

  describe('Concurrency Edge Cases', () => {
    it('should handle rapid sequential operations', async () => {
      // Rapid sequence of operations
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          execAsync(`node ${cliPath} config --set rapid${i}=value${i}`)
        );
      }

      await Promise.all(operations);

      // Verify all operations succeeded
      for (let i = 0; i < 10; i++) {
        const { stdout } = await execAsync(`node ${cliPath} config --get rapid${i}`);
        expect(stdout.trim()).toBe(`value${i}`);
      }
    });
  });

  describe('Platform-Specific Edge Cases', () => {
    it('should handle path separators correctly', async () => {
      // Test key that looks like a file path
      await execAsync(`node ${cliPath} config --set 'path=/some/unix/path'`);

      const { stdout } = await execAsync(`node ${cliPath} config --get path`);
      expect(stdout.trim()).toBe('/some/unix/path');
    });

    it('should handle environment-like variables', async () => {
      await execAsync(`node ${cliPath} config --set 'HOME=/home/user'`);
      await execAsync(`node ${cliPath} config --set 'PATH=/usr/bin:/bin'`);

      const { stdout: home } = await execAsync(`node ${cliPath} config --get HOME`);
      const { stdout: pathVar } = await execAsync(`node ${cliPath} config --get PATH`);

      expect(home.trim()).toBe('/home/user');
      expect(pathVar.trim()).toBe('/usr/bin:/bin');
    });
  });

  describe('Type Coercion Edge Cases', () => {
    it('should handle string representations of special values', async () => {
      const specialValues = [
        ['stringTrue', '"true"'],
        ['stringFalse', '"false"'],
        ['stringNull', '"null"'],
        ['stringUndefined', '"undefined"'],
        ['stringZero', '"0"'],
        ['stringEmpty', '""'],
      ];

      for (const [key, value] of specialValues) {
        await execAsync(`node ${cliPath} config --set ${key}=${value}`);
        const { stdout } = await execAsync(`node ${cliPath} config --get ${key}`);
        expect(stdout.trim()).toBe(value);
      }
    });

    it('should handle boundary numeric values', async () => {
      const numericValues = [
        ['maxSafeInt', String(Number.MAX_SAFE_INTEGER)],
        ['minSafeInt', String(Number.MIN_SAFE_INTEGER)],
        ['maxValue', String(Number.MAX_VALUE)],
        ['minValue', String(Number.MIN_VALUE)],
        ['epsilon', String(Number.EPSILON)],
      ];

      for (const [key, value] of numericValues) {
        await execAsync(`node ${cliPath} config --set ${key}=${value}`);
        const { stdout } = await execAsync(`node ${cliPath} config --get ${key}`);
        expect(stdout.trim()).toBe(value);
      }
    });
  });
});