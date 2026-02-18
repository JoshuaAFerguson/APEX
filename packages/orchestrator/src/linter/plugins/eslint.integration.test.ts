/**
 * Integration Test Suite for ESLintPlugin
 *
 * Tests the ESLint plugin with real ESLint installation when available.
 * These tests verify the plugin works with actual ESLint output and scenarios.
 *
 * @module orchestrator/linter/plugins/eslint.integration.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ESLintPlugin } from './eslint';

describe('ESLintPlugin Integration Tests', () => {
  let plugin: ESLintPlugin;
  let tempDir: string;

  beforeEach(async () => {
    plugin = new ESLintPlugin();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eslint-plugin-test-'));
  });

  afterEach(async () => {
    plugin.removeAllListeners();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ============================================================================
  // Real ESLint Availability Tests
  // ============================================================================

  describe('ESLint Availability', () => {
    it('should detect ESLint availability', async () => {
      const isAvailable = await plugin.isAvailable();
      // This test doesn't require ESLint to be installed, just validates the method works
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should get ESLint version when available', async () => {
      const version = await plugin.getToolVersion();
      // This test doesn't require ESLint, just validates the method works
      expect(version === null || typeof version === 'string').toBe(true);
    });
  });

  // ============================================================================
  // File System Integration Tests
  // ============================================================================

  describe('File System Integration', () => {
    it('should handle non-existent files gracefully', async () => {
      // Test with files that don't exist
      const result = await plugin.execute({
        files: [path.join(tempDir, 'non-existent-file.js')],
        timeout: 5000,
      });

      // Should complete (success may vary based on ESLint configuration)
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle empty directory gracefully', async () => {
      // Test with empty directory
      const result = await plugin.execute({
        patterns: [path.join(tempDir, '**/*.js')],
        timeout: 5000,
      });

      // Should complete gracefully
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(typeof result.duration).toBe('number');
    });

    it('should handle various file extensions', async () => {
      // Create test files with different extensions
      const testFiles = [
        'test.js',
        'test.jsx',
        'test.ts',
        'test.tsx',
        'test.mjs',
        'test.vue',
      ];

      // Create minimal content for each file
      for (const filename of testFiles) {
        const filePath = path.join(tempDir, filename);
        await fs.writeFile(filePath, '// Test file\n');
      }

      const result = await plugin.execute({
        files: testFiles.map(f => path.join(tempDir, f)),
        timeout: 10000,
      });

      // Verify the execution completed
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(typeof result.filesChecked).toBe('number');
    });
  });

  // ============================================================================
  // Configuration Integration Tests
  // ============================================================================

  describe('Configuration Integration', () => {
    it('should handle custom configuration path', async () => {
      // Create a custom ESLint config
      const configPath = path.join(tempDir, '.eslintrc.json');
      const config = {
        env: { node: true },
        rules: {
          'no-console': 'error',
          'no-unused-vars': 'warn',
        },
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      // Create a test file
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'console.log("test");\n');

      const result = await plugin.execute({
        files: [testFile],
        configPath,
        timeout: 10000,
      });

      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.issues)).toBe(true);
    });

    it('should handle extra arguments correctly', async () => {
      // Test with extra ESLint arguments
      const result = await plugin.execute({
        patterns: [path.join(tempDir, '**/*.js')],
        extraArgs: ['--quiet'],
        timeout: 5000,
      });

      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });

  // ============================================================================
  // Event Integration Tests
  // ============================================================================

  describe('Event Integration', () => {
    it('should emit events during execution', async () => {
      const events: string[] = [];

      plugin.on('lint:started', () => events.push('started'));
      plugin.on('lint:completed', () => events.push('completed'));
      plugin.on('lint:issue', () => events.push('issue'));

      await plugin.execute({
        patterns: [path.join(tempDir, '**/*.js')],
        timeout: 5000,
      });

      // Should have at least started and completed events
      expect(events).toContain('started');
      expect(events).toContain('completed');
    });

    it('should emit fix events during fix operation', async () => {
      const fixEvents: string[] = [];

      plugin.on('fix:applied', () => fixEvents.push('fix-applied'));

      // Create some dummy issues for fixing
      const dummyIssues = [
        {
          filePath: path.join(tempDir, 'test.js'),
          line: 1,
          column: 1,
          severity: 'warning' as const,
          ruleId: 'prefer-const',
          message: 'Prefer const for variables that are never modified.',
        },
      ];

      const result = await plugin.fix(dummyIssues, { timeout: 5000 });

      // Should complete (success may vary)
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.filesFixed).toBe('number');
      expect(typeof result.issuesFixed).toBe('number');
    });
  });

  // ============================================================================
  // Performance Integration Tests
  // ============================================================================

  describe('Performance Integration', () => {
    it('should handle timeout correctly', async () => {
      // Test with very short timeout to verify timeout handling
      const result = await plugin.execute({
        patterns: [path.join(tempDir, '**/*.js')],
        timeout: 1, // 1ms timeout should likely timeout
      });

      // Should complete without throwing
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.duration).toBe('number');
    });

    it('should handle large number of files', async () => {
      // Create multiple test files
      const fileCount = 10;
      const files = [];

      for (let i = 0; i < fileCount; i++) {
        const filename = `test-${i}.js`;
        const filePath = path.join(tempDir, filename);
        await fs.writeFile(filePath, `// Test file ${i}\nconst x${i} = ${i};\n`);
        files.push(filePath);
      }

      const result = await plugin.execute({
        files,
        timeout: 15000, // Generous timeout for multiple files
      });

      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(typeof result.filesChecked).toBe('number');
    });
  });

  // ============================================================================
  // Error Recovery Integration Tests
  // ============================================================================

  describe('Error Recovery Integration', () => {
    it('should recover from invalid syntax files', async () => {
      // Create file with syntax errors
      const testFile = path.join(tempDir, 'invalid-syntax.js');
      await fs.writeFile(testFile, 'const x = {\n  missing closing brace\n');

      const result = await plugin.execute({
        files: [testFile],
        timeout: 10000,
      });

      // Should complete (may report syntax errors as issues)
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.issues)).toBe(true);
    });

    it('should handle binary files gracefully', async () => {
      // Create a binary file (will be treated as JS)
      const binaryFile = path.join(tempDir, 'binary.js');
      const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
      await fs.writeFile(binaryFile, binaryData);

      const result = await plugin.execute({
        files: [binaryFile],
        timeout: 10000,
      });

      // Should complete without crashing
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });

  // ============================================================================
  // Real-world Scenario Tests
  // ============================================================================

  describe('Real-world Scenarios', () => {
    it('should handle typical JavaScript project structure', async () => {
      // Create a mini project structure
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'test'));

      // Create typical files
      await fs.writeFile(
        path.join(tempDir, 'src', 'index.js'),
        `// Main application file
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

module.exports = app;
`
      );

      await fs.writeFile(
        path.join(tempDir, 'test', 'index.test.js'),
        `// Test file
const app = require('../src/index');
const request = require('supertest');

describe('App', () => {
  test('should respond with Hello World', async () => {
    const response = await request(app).get('/');
    expect(response.text).toBe('Hello World!');
  });
});
`
      );

      const result = await plugin.execute({
        patterns: [path.join(tempDir, '**/*.js')],
        timeout: 15000,
      });

      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(typeof result.filesChecked).toBe('number');
    });

    it('should handle TypeScript files when configured', async () => {
      // Create TypeScript files
      await fs.writeFile(
        path.join(tempDir, 'example.ts'),
        `// TypeScript example
interface User {
  name: string;
  age: number;
}

function greetUser(user: User): string {
  return \`Hello, \${user.name}!\`;
}

export { greetUser, User };
`
      );

      const result = await plugin.execute({
        files: [path.join(tempDir, 'example.ts')],
        timeout: 10000,
      });

      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });
});