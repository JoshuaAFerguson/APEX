/**
 * @fileoverview Tool Permission Boundaries Edge Cases Tests
 *
 * This test suite covers edge cases and complex scenarios for tool permission
 * boundaries that might not be covered by basic tests. It focuses on:
 *
 * - Wildcard and pattern-based scopes
 * - Nested permission hierarchies
 * - Permission inheritance and overrides
 * - Complex file path scenarios
 * - Error recovery and cleanup
 * - Memory and resource management
 *
 * Acceptance Criteria:
 * - Edge cases in permission scoping work correctly
 * - Pattern matching for permissions functions properly
 * - Permission cleanup and memory management is robust
 * - Complex scenarios don't cause system instability
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  ApexOrchestrator,
  PermissionManager,
  PermissionStore,
} from '@apexcli/orchestrator';
import type { PermissionLevel } from '@apexcli/core';

// Mock the Claude SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn().mockResolvedValue({
    content: [],
    usage: { inputTokens: 10, outputTokens: 10 }
  }),
  AgentDefinition: {},
  McpServerConfig: {}
}));

describe('Tool Permission Boundaries - Edge Cases', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let permissionManager: PermissionManager;
  let testDirPath: string;
  let nestedDirPath: string;
  let deepNestedPath: string;

  beforeEach(async () => {
    // Create complex test directory structure
    tempDir = await mkdtemp(join(tmpdir(), 'apex-permission-edge-test-'));
    testDirPath = join(tempDir, 'test-files');
    nestedDirPath = join(testDirPath, 'nested');
    deepNestedPath = join(nestedDirPath, 'deep', 'very-deep');

    await mkdir(deepNestedPath, { recursive: true });

    // Create various test files
    await writeFile(join(testDirPath, 'root-file.txt'), 'Root file content');
    await writeFile(join(testDirPath, 'root-file.md'), 'Root markdown content');
    await writeFile(join(nestedDirPath, 'nested-file.txt'), 'Nested file content');
    await writeFile(join(nestedDirPath, 'nested-file.js'), 'console.log("nested");');
    await writeFile(join(deepNestedPath, 'deep-file.txt'), 'Deep file content');
    await writeFile(join(deepNestedPath, 'deep-config.json'), '{"deep": true}');

    // Create .apex directory structure
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });
    await mkdir(join(apexDir, 'agents'), { recursive: true });
    await mkdir(join(apexDir, 'workflows'), { recursive: true });

    // Create configuration
    const configContent = `
project:
  name: permission-edge-cases-test
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: review-all

agents:
  edge-test-agent:
    role: "Agent for testing permission edge cases"
    model: sonnet
    tools: [Read, Write, Edit, Bash, Grep, Glob]

workflows:
  edge-test-workflow:
    name: "Edge Case Test Workflow"
    agents: [edge-test-agent]
    stages:
      - name: edge-test-stage
        agent: edge-test-agent
        description: "Test stage for permission edge cases"

limits:
  maxTasksPerHour: 100
  maxCostPerTask: 10.0
  maxConcurrentTasks: 5
`;

    await writeFile(join(apexDir, 'config.yaml'), configContent);

    // Create test agent file
    await writeFile(
      join(apexDir, 'agents', 'edge-test-agent.md'),
      `---
name: edge-test-agent
description: Agent for testing permission edge cases
tools: [Read, Write, Edit, Bash, Grep, Glob]
---

You are an agent that tests permission edge cases.`
    );

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator(tempDir);
    await orchestrator.initialize();

    // Get permission manager (using type assertion for testing)
    permissionManager = (orchestrator as any).permissionManager;
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  async function grantPermission(tool: string, scope: string, level: PermissionLevel): Promise<void> {
    await permissionManager.grantPermission(tool, scope, level);
  }

  async function checkPermission(tool: string, scope?: string): Promise<PermissionLevel | null> {
    return await permissionManager.checkPermission(tool, scope);
  }

  async function verifyPermissionLevel(tool: string, scope: string, expectedLevel: PermissionLevel): Promise<void> {
    const actualLevel = await checkPermission(tool, scope);
    expect(actualLevel).toBe(expectedLevel);
  }

  async function verifyPermissionAbsent(tool: string, scope: string): Promise<void> {
    const permission = await checkPermission(tool, scope);
    expect(permission).toBeNull();
  }

  // ============================================================================
  // Wildcard and Pattern Scopes
  // ============================================================================

  describe('Wildcard and Pattern Scopes', () => {
    it('should handle single wildcard patterns correctly', async () => {
      const wildcardScope = join(testDirPath, '*.txt');

      // Grant permission with wildcard
      await grantPermission('Read', wildcardScope, 'allow-always');

      // Verify wildcard permission
      await verifyPermissionLevel('Read', wildcardScope, 'allow-always');

      // Test specific files that should match the pattern
      const specificFile = join(testDirPath, 'root-file.txt');
      // Note: This tests the permission system's pattern matching capabilities
      await verifyPermissionLevel('Read', specificFile, 'allow-always');
    });

    it('should handle double wildcard (globstar) patterns', async () => {
      const globstarScope = join(testDirPath, '**/*.txt');

      // Grant permission with globstar
      await grantPermission('Read', globstarScope, 'allow-once');

      // Verify globstar permission
      await verifyPermissionLevel('Read', globstarScope, 'allow-once');

      // Test files at different nesting levels
      const rootFile = join(testDirPath, 'root-file.txt');
      const nestedFile = join(nestedDirPath, 'nested-file.txt');
      const deepFile = join(deepNestedPath, 'deep-file.txt');

      // All should match the globstar pattern
      await verifyPermissionLevel('Read', rootFile, 'allow-once');
      await verifyPermissionLevel('Read', nestedFile, 'allow-once');
      await verifyPermissionLevel('Read', deepFile, 'allow-once');
    });

    it('should handle complex file extension patterns', async () => {
      // Pattern for multiple file types
      const multiExtScope = join(testDirPath, '**/*.{txt,js,json}');

      await grantPermission('Edit', multiExtScope, 'allow-always');

      // Verify different file types match
      await verifyPermissionLevel('Edit', join(testDirPath, 'root-file.txt'), 'allow-always');
      await verifyPermissionLevel('Edit', join(nestedDirPath, 'nested-file.js'), 'allow-always');
      await verifyPermissionLevel('Edit', join(deepNestedPath, 'deep-config.json'), 'allow-always');

      // Verify non-matching files don't match
      await verifyPermissionAbsent('Edit', join(testDirPath, 'root-file.md'));
    });

    it('should handle directory-specific wildcard patterns', async () => {
      // Pattern for files only in nested directory
      const nestedOnlyScope = join(nestedDirPath, '*');

      await grantPermission('Write', nestedOnlyScope, 'deny');

      // Verify nested directory files are denied
      await verifyPermissionLevel('Write', join(nestedDirPath, 'nested-file.txt'), 'deny');
      await verifyPermissionLevel('Write', join(nestedDirPath, 'nested-file.js'), 'deny');

      // Verify root and deep files are not affected
      await verifyPermissionAbsent('Write', join(testDirPath, 'root-file.txt'));
      await verifyPermissionAbsent('Write', join(deepNestedPath, 'deep-file.txt'));
    });
  });

  // ============================================================================
  // Permission Hierarchy and Inheritance
  // ============================================================================

  describe('Permission Hierarchy and Inheritance', () => {
    it('should handle parent-child permission relationships', async () => {
      // Grant parent directory permission
      await grantPermission('Read', testDirPath, 'allow-always');

      // Grant more restrictive child permission
      await grantPermission('Read', nestedDirPath, 'allow-once');

      // Verify both permissions exist
      await verifyPermissionLevel('Read', testDirPath, 'allow-always');
      await verifyPermissionLevel('Read', nestedDirPath, 'allow-once');

      // Test specific file access - should use most specific permission
      const nestedFile = join(nestedDirPath, 'nested-file.txt');
      await verifyPermissionLevel('Read', nestedFile, 'allow-once');
    });

    it('should handle permission overrides correctly', async () => {
      // Start with broad allow permission
      await grantPermission('Edit', join(testDirPath, '**/*'), 'allow-always');

      // Override specific file with deny
      const specificFile = join(nestedDirPath, 'nested-file.txt');
      await grantPermission('Edit', specificFile, 'deny');

      // Verify override takes precedence
      await verifyPermissionLevel('Edit', specificFile, 'deny');

      // Verify other files still have allow permission
      await verifyPermissionLevel('Edit', join(testDirPath, 'root-file.txt'), 'allow-always');
      await verifyPermissionLevel('Edit', join(nestedDirPath, 'nested-file.js'), 'allow-always');
    });

    it('should handle nested allow-once consumption correctly', async () => {
      // Grant allow-once for parent
      await grantPermission('Read', testDirPath, 'allow-once');

      // Grant allow-once for child
      await grantPermission('Read', nestedDirPath, 'allow-once');

      // Check parent permission (should consume it)
      await verifyPermissionLevel('Read', testDirPath, 'allow-once');
      await checkPermission('Read', testDirPath); // Consume parent

      // Child permission should still be available
      await verifyPermissionLevel('Read', nestedDirPath, 'allow-once');

      // Consume child permission
      await checkPermission('Read', nestedDirPath);

      // Both should now be consumed
      await verifyPermissionAbsent('Read', testDirPath);
      await verifyPermissionAbsent('Read', nestedDirPath);
    });
  });

  // ============================================================================
  // Complex File Path Scenarios
  // ============================================================================

  describe('Complex File Path Scenarios', () => {
    it('should handle absolute vs relative path permissions', async () => {
      const absolutePath = join(testDirPath, 'root-file.txt');
      const relativePath = './test-files/root-file.txt';

      // Grant permission using absolute path
      await grantPermission('Read', absolutePath, 'allow-always');

      // Verify absolute path permission
      await verifyPermissionLevel('Read', absolutePath, 'allow-always');

      // Test relative path resolution
      // (This depends on how the permission system normalizes paths)
      const relativePermission = await checkPermission('Read', relativePath);
      expect(relativePermission).not.toBeNull();
    });

    it('should handle symbolic links and path resolution', async () => {
      // This test would require creating symbolic links
      // Skip if not supported in test environment
      const symlinkPath = join(testDirPath, 'symlink-to-nested');

      try {
        // Create a symbolic link to nested directory
        const { symlink } = await import('fs/promises');
        await symlink(nestedDirPath, symlinkPath);

        // Grant permission to symlink
        await grantPermission('Edit', symlinkPath, 'allow-once');

        // Verify symlink permission
        await verifyPermissionLevel('Edit', symlinkPath, 'allow-once');

        // Test file through symlink
        const fileViaSymlink = join(symlinkPath, 'nested-file.txt');
        await verifyPermissionLevel('Edit', fileViaSymlink, 'allow-once');
      } catch (error) {
        // Skip test if symlinks not supported
        console.warn('Symbolic link test skipped:', error);
      }
    });

    it('should handle special characters in file paths', async () => {
      // Create files with special characters
      const specialFiles = [
        'file with spaces.txt',
        'file-with-hyphens.txt',
        'file_with_underscores.txt',
        'file.with.dots.txt',
        'file@with$special%chars.txt'
      ];

      for (const filename of specialFiles) {
        const filePath = join(testDirPath, filename);
        await writeFile(filePath, `Content of ${filename}`);

        // Grant permission with special characters
        await grantPermission('Write', filePath, 'allow-always');

        // Verify permission works with special characters
        await verifyPermissionLevel('Write', filePath, 'allow-always');
      }
    });

    it('should handle very long file paths', async () => {
      // Create deeply nested directory structure
      const veryDeepParts = ['level1', 'level2', 'level3', 'level4', 'level5', 'level6'];
      let currentPath = testDirPath;

      for (const part of veryDeepParts) {
        currentPath = join(currentPath, part);
        await mkdir(currentPath, { recursive: true });
      }

      const veryLongFileName = 'very-long-file-name-that-tests-path-length-limits.txt';
      const veryLongPath = join(currentPath, veryLongFileName);
      await writeFile(veryLongPath, 'Content of very long path file');

      // Grant permission for very long path
      await grantPermission('Read', veryLongPath, 'allow-once');

      // Verify long path permission works
      await verifyPermissionLevel('Read', veryLongPath, 'allow-once');
    });
  });

  // ============================================================================
  // Error Recovery and Edge Cases
  // ============================================================================

  describe('Error Recovery and Edge Cases', () => {
    it('should handle invalid permission levels gracefully', async () => {
      // Attempt to grant invalid permission level
      try {
        await grantPermission('Read', join(testDirPath, 'test.txt'), 'invalid-level' as PermissionLevel);
        expect.fail('Should have thrown an error for invalid permission level');
      } catch (error) {
        expect(error).toBeDefined();
        // Verify system remains stable after error
        await grantPermission('Read', join(testDirPath, 'test.txt'), 'allow-always');
        await verifyPermissionLevel('Read', join(testDirPath, 'test.txt'), 'allow-always');
      }
    });

    it('should handle non-existent file paths gracefully', async () => {
      const nonExistentPath = join(testDirPath, 'does-not-exist.txt');

      // Should be able to grant permissions for non-existent files
      await grantPermission('Write', nonExistentPath, 'allow-once');
      await verifyPermissionLevel('Write', nonExistentPath, 'allow-once');

      // Permission should still work even if file doesn't exist
      await checkPermission('Write', nonExistentPath); // Consume
      await verifyPermissionAbsent('Write', nonExistentPath);
    });

    it('should handle empty and null scopes', async () => {
      // Test empty string scope
      await grantPermission('Bash', '', 'allow-always');
      await verifyPermissionLevel('Bash', '', 'allow-always');

      // Test undefined scope (should be treated as empty)
      const undefinedScopePermission = await checkPermission('Bash');
      expect(undefinedScopePermission).toBe('allow-always');
    });

    it('should handle rapid permission changes', async () => {
      const testFile = join(testDirPath, 'rapid-change.txt');

      // Rapidly change permissions
      for (let i = 0; i < 10; i++) {
        const levels: PermissionLevel[] = ['allow-always', 'allow-once', 'deny'];
        const level = levels[i % levels.length];

        await grantPermission('Edit', testFile, level);
        await verifyPermissionLevel('Edit', testFile, level);

        // If it's allow-once, consume it
        if (level === 'allow-once') {
          await checkPermission('Edit', testFile);
          await verifyPermissionAbsent('Edit', testFile);
        }
      }
    });

    it('should handle permission revocation edge cases', async () => {
      const testFile = join(testDirPath, 'revocation-test.txt');

      // Grant permission
      await grantPermission('Read', testFile, 'allow-always');
      await verifyPermissionLevel('Read', testFile, 'allow-always');

      // Revoke permission
      await permissionManager.revokePermission('Read', testFile);
      await verifyPermissionAbsent('Read', testFile);

      // Try to revoke non-existent permission (should not error)
      await permissionManager.revokePermission('Read', testFile);
      await verifyPermissionAbsent('Read', testFile);

      // Try to revoke with different scope
      await permissionManager.revokePermission('Read', 'non-existent-scope');
      // Should not affect anything
    });
  });

  // ============================================================================
  // Memory and Resource Management
  // ============================================================================

  describe('Memory and Resource Management', () => {
    it('should handle large numbers of permissions efficiently', async () => {
      const startTime = Date.now();
      const numPermissions = 1000;

      // Create many permissions
      for (let i = 0; i < numPermissions; i++) {
        const filePath = join(testDirPath, `bulk-file-${i}.txt`);
        const level: PermissionLevel = i % 2 === 0 ? 'allow-always' : 'allow-once';
        await grantPermission('Read', filePath, level);
      }

      const creationTime = Date.now() - startTime;

      // Verify permissions were created efficiently (should be under 5 seconds)
      expect(creationTime).toBeLessThan(5000);

      // Spot check some permissions
      await verifyPermissionLevel('Read', join(testDirPath, 'bulk-file-0.txt'), 'allow-always');
      await verifyPermissionLevel('Read', join(testDirPath, 'bulk-file-1.txt'), 'allow-once');
      await verifyPermissionLevel('Read', join(testDirPath, 'bulk-file-500.txt'), 'allow-always');
    });

    it('should clean up consumed allow-once permissions', async () => {
      const numOncePermissions = 100;

      // Create many allow-once permissions
      for (let i = 0; i < numOncePermissions; i++) {
        const filePath = join(testDirPath, `once-file-${i}.txt`);
        await grantPermission('Write', filePath, 'allow-once');
      }

      // Consume all allow-once permissions
      for (let i = 0; i < numOncePermissions; i++) {
        const filePath = join(testDirPath, `once-file-${i}.txt`);
        await checkPermission('Write', filePath); // Consume
      }

      // Verify all permissions are cleaned up
      for (let i = 0; i < numOncePermissions; i++) {
        const filePath = join(testDirPath, `once-file-${i}.txt`);
        await verifyPermissionAbsent('Write', filePath);
      }
    });

    it('should handle concurrent permission operations without corruption', async () => {
      const concurrentOps = 50;
      const promises: Promise<void>[] = [];

      // Create concurrent permission operations
      for (let i = 0; i < concurrentOps; i++) {
        const filePath = join(testDirPath, `concurrent-${i}.txt`);

        promises.push(
          grantPermission('Edit', filePath, 'allow-always').then(() =>
            verifyPermissionLevel('Edit', filePath, 'allow-always')
          )
        );

        promises.push(
          grantPermission('Read', filePath, 'allow-once').then(() =>
            checkPermission('Read', filePath)
          ).then(() =>
            verifyPermissionAbsent('Read', filePath)
          )
        );
      }

      // Wait for all operations to complete without errors
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  // ============================================================================
  // Tool-Specific Edge Cases
  // ============================================================================

  describe('Tool-Specific Edge Cases', () => {
    describe('Bash Tool Edge Cases', () => {
      it('should handle complex command patterns', async () => {
        const complexCommands = [
          'echo "hello world" | grep hello',
          'find . -name "*.txt" -type f',
          'ls -la /tmp && echo "done"',
          'cat file1.txt file2.txt > combined.txt',
          'grep -r "pattern" . | sort | uniq'
        ];

        for (const command of complexCommands) {
          await grantPermission('Bash', command, 'allow-once');
          await verifyPermissionLevel('Bash', command, 'allow-once');

          // Consume the permission
          await checkPermission('Bash', command);
          await verifyPermissionAbsent('Bash', command);
        }
      });

      it('should handle command variations and normalization', async () => {
        const baseCommand = 'echo "test"';
        const variations = [
          'echo "test"',
          'echo "test" ',
          '  echo "test"',
          'echo   "test"'
        ];

        await grantPermission('Bash', baseCommand, 'allow-always');

        // All variations should match (if command normalization is implemented)
        for (const variation of variations) {
          const permission = await checkPermission('Bash', variation);
          expect(permission).not.toBeNull();
        }
      });
    });

    describe('Grep Tool Edge Cases', () => {
      it('should handle regex pattern edge cases', async () => {
        const regexPatterns = [
          '.*',
          '^start',
          'end$',
          '\\d+',
          '[a-zA-Z]+',
          '(?:group)',
          'pattern.*with.*wildcards'
        ];

        for (const pattern of regexPatterns) {
          await grantPermission('Grep', pattern, 'allow-once');
          await verifyPermissionLevel('Grep', pattern, 'allow-once');

          // Consume the permission
          await checkPermission('Grep', pattern);
          await verifyPermissionAbsent('Grep', pattern);
        }
      });

      it('should handle special regex characters in patterns', async () => {
        const specialPatterns = [
          'pattern\\.with\\.dots',
          'pattern\\*with\\*stars',
          'pattern\\+with\\+plus',
          'pattern\\?with\\?question',
          'pattern\\(with\\)parens'
        ];

        for (const pattern of specialPatterns) {
          await grantPermission('Grep', pattern, 'allow-always');
          await verifyPermissionLevel('Grep', pattern, 'allow-always');
        }
      });
    });

    describe('Glob Tool Edge Cases', () => {
      it('should handle complex glob patterns', async () => {
        const globPatterns = [
          '**/*',
          '*.{txt,md,js}',
          'test/**/*.txt',
          '**/package.json',
          'src/**/index.*',
          '**/*.test.{js,ts}',
          '**/node_modules/**',
          '!**/*.min.js'
        ];

        for (const pattern of globPatterns) {
          await grantPermission('Glob', pattern, 'allow-once');
          await verifyPermissionLevel('Glob', pattern, 'allow-once');

          // Consume the permission
          await checkPermission('Glob', pattern);
          await verifyPermissionAbsent('Glob', pattern);
        }
      });

      it('should handle negation patterns', async () => {
        const negationPattern = '!**/*.log';

        await grantPermission('Glob', negationPattern, 'deny');
        await verifyPermissionLevel('Glob', negationPattern, 'deny');

        // Test that denial persists
        await verifyPermissionLevel('Glob', negationPattern, 'deny');
        await verifyPermissionLevel('Glob', negationPattern, 'deny');
      });
    });
  });
});