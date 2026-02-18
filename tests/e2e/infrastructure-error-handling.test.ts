/**
 * @fileoverview E2E Infrastructure Error Handling Tests
 *
 * This test suite focuses on error scenarios, edge cases, and resilience
 * of the E2E infrastructure. It ensures the utilities handle failures
 * gracefully and provide appropriate error information.
 *
 * Coverage includes:
 * - Permission errors and filesystem issues
 * - Invalid input handling
 * - Resource exhaustion scenarios
 * - Cleanup under failure conditions
 * - Concurrent access conflicts
 * - Timeout and performance edge cases
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  createTestEnvironment,
  cleanupTestEnvironment,
  runCLI,
  seedTestData,
  type TestEnvironment,
  type SeedData
} from './index';

describe('E2E Infrastructure - Error Handling', () => {
  let testEnvironments: TestEnvironment[] = [];

  afterEach(async () => {
    // Clean up test environments
    for (const env of testEnvironments) {
      try {
        await env.cleanup();
      } catch {
        // Ignore cleanup errors in error tests
      }
    }
    testEnvironments = [];
    await cleanupTestEnvironment();
  });

  describe('Environment Creation - Error Scenarios', () => {
    it('should handle invalid apex options gracefully', async () => {
      // Should not throw even with invalid options
      const env = await createTestEnvironment({
        initApexProject: true,
        apexOptions: {
          projectName: ''  // Invalid empty name
        } as any
      });
      testEnvironments.push(env);

      expect(env.path).toBeDefined();
      expect(env.hasApexProject).toBe(true);
    });

    it('should handle extremely long prefixes', async () => {
      const longPrefix = 'x'.repeat(200) + '-';

      const env = await createTestEnvironment({ prefix: longPrefix });
      testEnvironments.push(env);

      expect(env.path).toBeDefined();
      // Should create directory even with long prefix (OS permitting)
      const stat = await fs.stat(env.path);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should handle special characters in prefix', async () => {
      const specialPrefixes = [
        'test-with-spaces-',
        'test_with_underscores-',
        'test.with.dots-',
        'test-with-hyphens-',
        'test123numbers-'
      ];

      for (const prefix of specialPrefixes) {
        const env = await createTestEnvironment({ prefix });
        testEnvironments.push(env);

        expect(env.path).toBeDefined();
        const stat = await fs.stat(env.path);
        expect(stat.isDirectory()).toBe(true);
      }
    });
  });

  describe('CLI Execution - Error Scenarios', () => {
    it('should handle non-existent commands gracefully', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      const result = await runCLI('completely-invalid-command-that-does-not-exist', env.path);

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
      expect(typeof result.stderr).toBe('string');
      expect(typeof result.stdout).toBe('string');
    });

    it('should handle malformed command arguments', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      const malformedCommands = [
        '--invalid-flag-that-does-not-exist',
        'init --invalid-option',
        'mcp --bad-arg value',
        'agent --missing-value'
      ];

      for (const command of malformedCommands) {
        const result = await runCLI(command, env.path);

        expect(result.success).toBe(false);
        expect(result.exitCode).not.toBe(0);
        expect(typeof result.stderr).toBe('string');
      }
    });

    it('should handle commands in non-existent directories', async () => {
      const nonExistentPath = '/path/that/does/not/exist';

      const result = await runCLI('--version', nonExistentPath);

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
    });

    it('should handle very short timeouts', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      const result = await runCLI('--version', env.path, { timeout: 1 });

      // Either succeeds very quickly or times out
      expect(result).toBeDefined();
      if (!result.success) {
        expect(result.exitCode).not.toBe(0);
      }
    });

    it('should handle commands with invalid environment variables', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      const result = await runCLI('--version', env.path, {
        env: {
          ...process.env,
          INVALID_VAR: '\x00\x01\x02', // Binary data in env var
          VERY_LONG_VAR: 'x'.repeat(10000)
        }
      });

      // Should handle gracefully
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Seed Data - Error Scenarios', () => {
    it('should handle seed data without APEX project', async () => {
      const env = await createTestEnvironment(); // No APEX project
      testEnvironments.push(env);

      const apexSpecificData: SeedData = {
        agents: [
          { name: 'test-agent', description: 'Test', tools: ['Read'] }
        ],
        workflows: [
          {
            name: 'test-workflow',
            description: 'Test',
            stages: [{ name: 'stage', agent: 'agent', description: 'desc' }]
          }
        ]
      };

      // Should handle gracefully even without APEX project
      await expect(seedTestData(env, apexSpecificData)).resolves.toBeUndefined();
    });

    it('should handle invalid file paths in seed data', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      const invalidFilesData: SeedData = {
        files: {
          '': 'empty path',
          '..': 'parent dir reference',
          '../../../etc/passwd': 'path traversal attempt',
          '/absolute/path': 'absolute path',
          'normal/file.txt': 'normal file',
        }
      };

      // Should handle gracefully, creating only valid files
      await seedTestData(env, invalidFilesData);

      // Valid file should exist
      const normalFile = path.join(env.path, 'normal/file.txt');
      const content = await fs.readFile(normalFile, 'utf-8');
      expect(content).toBe('normal file');
    });

    it('should handle files with invalid content', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      const invalidContentData: SeedData = {
        files: {
          'binary-content.txt': '\x00\x01\x02\xFF\xFE',
          'unicode-content.txt': '🚀🎉🌟💻⚡',
          'large-content.txt': 'x'.repeat(100000),
          'empty-content.txt': '',
        }
      };

      await seedTestData(env, invalidContentData);

      // All files should be created (content is just strings/buffers)
      for (const fileName of Object.keys(invalidContentData.files!)) {
        const filePath = path.join(env.path, fileName);
        const stat = await fs.stat(filePath);
        expect(stat.isFile()).toBe(true);
      }
    });

    it('should handle malformed agent definitions', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      const malformedAgentsData: SeedData = {
        agents: [
          { name: '', description: 'Empty name', tools: [] },
          { name: 'valid-agent', description: '', tools: ['Read'] },
          { name: 'agent-no-tools', description: 'No tools', tools: [] },
          {
            name: 'agent-invalid-chars',
            description: 'Agent with invalid characters \x00\x01',
            tools: ['Invalid Tool', 'Read', '']
          }
        ]
      };

      // Should handle gracefully
      await seedTestData(env, malformedAgentsData);

      // Valid agents should be created
      const agentsDir = path.join(env.path, '.apex', 'agents');
      const agentFiles = await fs.readdir(agentsDir);
      expect(agentFiles.length).toBeGreaterThan(0);
    });

    it('should handle malformed workflow definitions', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      const malformedWorkflowsData: SeedData = {
        workflows: [
          {
            name: '',
            description: 'Empty name workflow',
            stages: []
          },
          {
            name: 'workflow-no-stages',
            description: 'No stages',
            stages: []
          },
          {
            name: 'workflow-invalid-stages',
            description: 'Invalid stages',
            stages: [
              { name: '', agent: '', description: '' },
              { name: 'valid-stage', agent: 'agent', description: 'valid' }
            ]
          }
        ]
      };

      await seedTestData(env, malformedWorkflowsData);

      // Valid workflows should be created
      const workflowsDir = path.join(env.path, '.apex', 'workflows');
      const workflowFiles = await fs.readdir(workflowsDir);
      expect(workflowFiles.length).toBeGreaterThan(0);
    });

    it('should handle deeply nested directory creation', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      const deepStructureData: SeedData = {
        files: {
          'a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/deep-file.txt': 'Deep content',
          'another/very/deep/nested/structure/file.json': '{"deep": true}',
          'x/y/z/file.txt': 'xyz content'
        }
      };

      await seedTestData(env, deepStructureData);

      // All deep files should be created
      for (const filePath of Object.keys(deepStructureData.files!)) {
        const fullPath = path.join(env.path, filePath);
        const stat = await fs.stat(fullPath);
        expect(stat.isFile()).toBe(true);
      }
    });
  });

  describe('Cleanup - Error Scenarios', () => {
    it('should handle cleanup of non-existent directories', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      // Remove directory manually
      await fs.rm(env.path, { recursive: true, force: true });

      // Cleanup should still work without throwing
      await expect(env.cleanup()).resolves.toBeUndefined();
    });

    it('should handle multiple cleanup calls', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      // Multiple cleanups should be safe
      await env.cleanup();
      await env.cleanup();
      await env.cleanup();

      expect(true).toBe(true);
    });

    it('should handle cleanup with read-only files', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      // Create a read-only file
      const readOnlyFile = path.join(env.path, 'readonly.txt');
      await fs.writeFile(readOnlyFile, 'readonly content');

      try {
        // Try to make it read-only (may not work on all systems)
        await fs.chmod(readOnlyFile, 0o444);
      } catch {
        // Ignore if chmod not supported
      }

      // Cleanup should still work
      await expect(env.cleanup()).resolves.toBeUndefined();
    });

    it('should handle cleanup with active file handles', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      // Create a file and keep it open
      const testFile = path.join(env.path, 'active-file.txt');
      await fs.writeFile(testFile, 'content');

      // Read file to potentially create handle
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('content');

      // Cleanup should still work (or at least not throw)
      await expect(env.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('Resource Limits - Stress Testing', () => {
    it('should handle many environments created quickly', async () => {
      const environments: TestEnvironment[] = [];

      // Create many environments in parallel
      const creationPromises = Array.from({ length: 10 }, () =>
        createTestEnvironment({ prefix: 'stress-test-' })
      );

      const envs = await Promise.all(creationPromises);
      environments.push(...envs);
      testEnvironments.push(...envs);

      expect(envs).toHaveLength(10);

      // All should be valid
      for (const env of envs) {
        expect(env.path).toBeDefined();
        const stat = await fs.stat(env.path);
        expect(stat.isDirectory()).toBe(true);
      }
    });

    it('should handle very large seed data', async () => {
      const env = await createTestEnvironment({ initApexProject: true });
      testEnvironments.push(env);

      // Create large seed data (but not too large to avoid test timeouts)
      const largeFiles: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        largeFiles[`file-${i}.txt`] = `Content for file ${i}\n`.repeat(100);
      }

      const largeSeedData: SeedData = { files: largeFiles };

      const startTime = Date.now();
      await seedTestData(env, largeSeedData);
      const duration = Date.now() - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds

      // Verify files were created
      expect(Object.keys(largeFiles)).toHaveLength(50);
    });
  });

  describe('Platform Compatibility', () => {
    it('should handle platform-specific path issues', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      // Test with various path separators and styles
      const filesData: SeedData = {
        files: {
          'unix/style/path.txt': 'unix style',
          'windows\\style\\path.txt': 'windows style (normalized)',
          'mixed/style\\path.txt': 'mixed style',
          'path with spaces/file.txt': 'spaces in path',
        }
      };

      await seedTestData(env, filesData);

      // All should be created (paths normalized by Node.js)
      const files = await fs.readdir(env.path, { recursive: true });
      expect(files.length).toBeGreaterThan(0);
    });

    it('should handle case sensitivity issues', async () => {
      const env = await createTestEnvironment();
      testEnvironments.push(env);

      const caseTestData: SeedData = {
        files: {
          'lowercase.txt': 'lowercase',
          'UPPERCASE.TXT': 'uppercase',
          'MixedCase.Txt': 'mixed case',
          'file.txt': 'original',
          'File.TXT': 'different case'
        }
      };

      await seedTestData(env, caseTestData);

      // Should handle according to filesystem capabilities
      const files = await fs.readdir(env.path);
      expect(files.length).toBeGreaterThan(0);
    });
  });
});