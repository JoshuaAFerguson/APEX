import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import {
  Permission,
  PermissionLevel,
  ToolPermissionConfig,
  FilesystemToolConfig,
  DirectoryAccessConfig
} from '@apexcli/core';

/**
 * Edge cases and error scenarios for permission check integration tests
 *
 * This test file focuses on boundary conditions, error handling, and
 * unusual scenarios that might not be covered in standard testing.
 *
 * Specifically tests:
 * - Permission state consistency under various error conditions
 * - Boundary conditions for permission expiry and timing
 * - Complex scope matching scenarios
 * - Resource cleanup and memory management
 * - Concurrent access patterns with session management
 * - Invalid configuration handling
 */
describe('Permission Check Edge Cases Integration Tests', () => {
  let manager: PermissionManager;
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-edge-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    store = new PermissionStore(testDir);
    await store.initialize();

    manager = new PermissionManager(store);
  });

  afterEach(() => {
    if (store) {
      store.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Permission expiry edge cases', () => {
    it('should handle permissions expiring during evaluation', async () => {
      // Set up a permission that expires very soon
      const shortExpiry = new Date(Date.now() + 50); // 50ms from now

      await store.savePermission({
        tool: 'QuickExpire',
        scope: 'test',
        level: 'allow-once',
        expiry: shortExpiry,
        createdAt: new Date()
      });

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await manager.checkToolPermission('QuickExpire', {
        scope: 'test'
      });

      expect(result.level).toBeNull();
      expect(result.allowed).toBe(true); // Default behavior
    });

    it('should handle permission expiry at exact boundary conditions', async () => {
      const now = new Date();
      const exactExpiry = new Date(now.getTime() + 1000); // 1 second from now

      await store.savePermission({
        tool: 'BoundaryTest',
        scope: 'exact',
        level: 'allow-once',
        expiry: exactExpiry,
        createdAt: now
      });

      // Check just before expiry
      await new Promise(resolve => setTimeout(resolve, 900));
      const beforeResult = await manager.checkToolPermission('BoundaryTest', {
        scope: 'exact',
        consumeAllowOnce: false
      });
      expect(beforeResult.level).toBe('allow-once');

      // Wait past expiry
      await new Promise(resolve => setTimeout(resolve, 200));
      const afterResult = await manager.checkToolPermission('BoundaryTest', {
        scope: 'exact'
      });
      expect(afterResult.level).toBeNull();
    });

    it('should handle multiple permissions with different expiry times', async () => {
      const now = new Date();
      const permissions: Permission[] = [
        {
          tool: 'MultiExpiry',
          scope: 'short',
          level: 'allow-once',
          expiry: new Date(now.getTime() + 100),
          createdAt: now
        },
        {
          tool: 'MultiExpiry',
          scope: 'medium',
          level: 'allow-once',
          expiry: new Date(now.getTime() + 500),
          createdAt: now
        },
        {
          tool: 'MultiExpiry',
          scope: 'long',
          level: 'allow-once',
          expiry: new Date(now.getTime() + 1000),
          createdAt: now
        }
      ];

      for (const permission of permissions) {
        await store.savePermission(permission);
      }

      // Check all are initially available
      for (const { scope } of permissions) {
        const result = await manager.checkToolPermission('MultiExpiry', {
          scope: scope!,
          consumeAllowOnce: false
        });
        expect(result.level).toBe('allow-once');
      }

      // Wait for short to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const shortResult = await manager.checkToolPermission('MultiExpiry', {
        scope: 'short'
      });
      expect(shortResult.level).toBeNull();

      const mediumResult = await manager.checkToolPermission('MultiExpiry', {
        scope: 'medium',
        consumeAllowOnce: false
      });
      expect(mediumResult.level).toBe('allow-once');

      const longResult = await manager.checkToolPermission('MultiExpiry', {
        scope: 'long',
        consumeAllowOnce: false
      });
      expect(longResult.level).toBe('allow-once');
    });
  });

  describe('Scope matching edge cases', () => {
    it('should handle special characters in scopes', async () => {
      const specialScopes = [
        '/path/with spaces/file.txt',
        '/path/with-dashes/file.txt',
        '/path/with_underscores/file.txt',
        '/path/with.dots/file.txt',
        '/path/with(parentheses)/file.txt',
        '/path/with[brackets]/file.txt',
        '/path/with{braces}/file.txt',
        'command --flag="value with spaces"',
        'grep "search with quotes" /path',
        'awk \'{print $1}\' file.txt'
      ];

      for (const scope of specialScopes) {
        await store.savePermission({
          tool: 'SpecialChars',
          scope,
          level: 'allow-always',
          createdAt: new Date()
        });

        const result = await manager.checkToolPermission('SpecialChars', {
          scope
        });

        expect(result.level).toBe('allow-always');
        expect(result.allowed).toBe(true);
      }
    });

    it('should handle very long scopes', async () => {
      const longPath = '/very/long/path/that/exceeds/normal/length/limits/' + 'x'.repeat(1000) + '/file.txt';
      const longCommand = 'very-long-command ' + '--arg='.repeat(100) + 'value';

      await store.savePermission({
        tool: 'LongScope',
        scope: longPath,
        level: 'allow-once',
        createdAt: new Date()
      });

      await store.savePermission({
        tool: 'LongScope',
        scope: longCommand,
        level: 'deny',
        createdAt: new Date()
      });

      const pathResult = await manager.checkToolPermission('LongScope', {
        scope: longPath
      });
      expect(pathResult.level).toBe('allow-once');
      expect(pathResult.allowed).toBe(true);

      const commandResult = await manager.checkToolPermission('LongScope', {
        scope: longCommand
      });
      expect(commandResult.level).toBe('deny');
      expect(commandResult.allowed).toBe(false);
    });

    it('should handle unicode and international characters in scopes', async () => {
      const unicodeScopes = [
        '/путь/к/файлу.txt',           // Cyrillic
        '/경로/파일.txt',              // Korean
        '/パス/ファイル.txt',            // Japanese
        '/مسار/ملف.txt',              // Arabic
        '/路径/文件.txt',              // Chinese
        '/café/naïve/résumé.txt',     // Accented Latin
        '/emoji/🚀/🎯/file.txt'       // Emoji
      ];

      for (const scope of unicodeScopes) {
        await store.savePermission({
          tool: 'Unicode',
          scope,
          level: 'allow-always',
          createdAt: new Date()
        });

        const result = await manager.checkToolPermission('Unicode', {
          scope
        });

        expect(result.level).toBe('allow-always');
        expect(result.allowed).toBe(true);
      }
    });

    it('should handle empty and whitespace-only scopes', async () => {
      const edgeCaseScopes = [
        '',               // Empty string
        ' ',              // Single space
        '   ',            // Multiple spaces
        '\t',             // Tab
        '\n',             // Newline
        '\r\n',           // CRLF
        '  \t\n  '        // Mixed whitespace
      ];

      for (let i = 0; i < edgeCaseScopes.length; i++) {
        const scope = edgeCaseScopes[i];
        const tool = `WhitespaceTest${i}`;

        await store.savePermission({
          tool,
          scope,
          level: 'allow-always',
          createdAt: new Date()
        });

        const result = await manager.checkToolPermission(tool, {
          scope
        });

        expect(result.level).toBe('allow-always');
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe('Session management edge cases', () => {
    it('should handle rapid session permission grants and checks', async () => {
      const iterations = 100;
      const tool = 'RapidTest';

      // Rapidly grant and check permissions
      for (let i = 0; i < iterations; i++) {
        const scope = `scope-${i}`;

        // Grant allow-once permission
        await manager.grantPermission(tool, scope, 'allow-once');

        // Immediately check it
        const result = await manager.checkToolPermission(tool, { scope });

        expect(result.level).toBe('allow-once');
        expect(result.allowed).toBe(true);

        // Verify it's consumed
        const secondResult = await manager.checkToolPermission(tool, { scope });
        expect(secondResult.level).toBeNull();
      }
    });

    it('should handle session cache with same tool, different scopes', async () => {
      const tool = 'MultiScope';
      const scopes = Array.from({ length: 50 }, (_, i) => `scope-${i}`);

      // Grant allow-once permissions for all scopes
      for (const scope of scopes) {
        await manager.grantPermission(tool, scope, 'allow-once');
      }

      // Check all permissions exist
      for (const scope of scopes) {
        const result = await manager.checkToolPermission(tool, {
          scope,
          consumeAllowOnce: false
        });
        expect(result.level).toBe('allow-once');
      }

      // Consume half of them
      const halfPoint = Math.floor(scopes.length / 2);
      for (let i = 0; i < halfPoint; i++) {
        const result = await manager.checkToolPermission(tool, {
          scope: scopes[i]
        });
        expect(result.level).toBe('allow-once');
      }

      // Verify consumed ones are gone
      for (let i = 0; i < halfPoint; i++) {
        const result = await manager.checkToolPermission(tool, {
          scope: scopes[i]
        });
        expect(result.level).toBeNull();
      }

      // Verify remaining ones still exist
      for (let i = halfPoint; i < scopes.length; i++) {
        const result = await manager.checkToolPermission(tool, {
          scope: scopes[i],
          consumeAllowOnce: false
        });
        expect(result.level).toBe('allow-once');
      }
    });

    it('should handle memory management with large session cache', async () => {
      const tool = 'MemoryTest';
      const largeCount = 1000;

      // Create a large number of session permissions
      for (let i = 0; i < largeCount; i++) {
        await manager.grantPermission(tool, `scope-${i}`, 'allow-once');
      }

      // Randomly access and consume some of them
      const randomIndices = new Set<number>();
      while (randomIndices.size < largeCount / 2) {
        randomIndices.add(Math.floor(Math.random() * largeCount));
      }

      for (const index of randomIndices) {
        const result = await manager.checkToolPermission(tool, {
          scope: `scope-${index}`
        });
        expect(result.level).toBe('allow-once');
      }

      // Verify the consumed permissions are gone
      for (const index of randomIndices) {
        const result = await manager.checkToolPermission(tool, {
          scope: `scope-${index}`
        });
        expect(result.level).toBeNull();
      }
    });
  });

  describe('Complex configuration edge cases', () => {
    it('should handle malformed or incomplete tool configurations', async () => {
      // Test with minimal config
      await store.saveExtendedPermission({
        tool: 'MinimalConfig',
        level: null,
        config: {} as ToolPermissionConfig, // Empty config
        createdAt: new Date()
      });

      const minimalResult = await manager.checkToolPermission('MinimalConfig');
      expect(minimalResult.allowed).toBe(true); // Should default to allow
      expect(minimalResult.requiresConfirmation).toBe(false);

      // Test with partial filesystem config
      await store.saveExtendedPermission({
        tool: 'PartialConfig',
        level: null,
        config: {
          enabled: true
          // Missing other required fields
        } as FilesystemToolConfig,
        createdAt: new Date()
      });

      const partialResult = await manager.checkToolPermission('PartialConfig');
      expect(partialResult.allowed).toBe(true);
      expect(partialResult.config?.enabled).toBe(true);
    });

    it('should handle directory access config with extreme values', async () => {
      const extremeConfig: FilesystemToolConfig = {
        enabled: true,
        requireConfirmation: false,
        directoryAccess: {
          allowlist: [], // Empty allowlist
          blocklist: Array.from({ length: 1000 }, (_, i) => `/blocked-${i}/**`), // Very large blocklist
          defaultAllow: true,
          resolveSymlinks: true,
          maxDepth: 1000 // Very deep nesting
        },
        maxFileSize: Number.MAX_SAFE_INTEGER, // Maximum file size
        allowedExtensions: Array.from({ length: 100 }, (_, i) => `.ext${i}`) // Many extensions
      };

      await store.saveExtendedPermission({
        tool: 'ExtremeConfig',
        level: 'allow-always',
        config: extremeConfig,
        createdAt: new Date()
      });

      // Test with allowed path (not in blocklist)
      const allowedResult = await manager.checkToolPermission('ExtremeConfig', {
        scope: '/allowed/path/file.txt',
        path: '/allowed/path/file.txt'
      });

      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.level).toBe('allow-always');
      expect(allowedResult.pathValidation?.allowed).toBe(true);

      // Test with blocked path
      const blockedResult = await manager.checkToolPermission('ExtremeConfig', {
        scope: '/blocked-500/file.txt',
        path: '/blocked-500/file.txt'
      });

      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.level).toBe('allow-always');
      expect(blockedResult.pathValidation?.allowed).toBe(false);
    });

    it('should handle circular and recursive directory patterns', async () => {
      const recursiveConfig: DirectoryAccessConfig = {
        allowlist: [
          '/recursive/**/allowed/**',
          '/deep/very/deeply/nested/path/**',
          '/**/**/wildcard/**/**/pattern/**'
        ],
        blocklist: [
          '/recursive/**/blocked/**',
          '/recursive/**/blocked/**/nested/**'
        ],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 10
      };

      await store.saveExtendedPermission({
        tool: 'RecursiveTest',
        level: 'allow-always',
        config: {
          enabled: true,
          requireConfirmation: false,
          directoryAccess: recursiveConfig
        } as FilesystemToolConfig,
        createdAt: new Date()
      });

      const testPaths = [
        { path: '/recursive/some/allowed/file.txt', shouldAllow: true },
        { path: '/recursive/some/blocked/file.txt', shouldAllow: false },
        { path: '/deep/very/deeply/nested/path/file.txt', shouldAllow: true },
        { path: '/some/wildcard/pattern/file.txt', shouldAllow: true },
        { path: '/recursive/path/blocked/nested/file.txt', shouldAllow: false }
      ];

      for (const { path, shouldAllow } of testPaths) {
        const result = await manager.checkToolPermission('RecursiveTest', {
          scope: path,
          path
        });

        expect(result.level).toBe('allow-always');
        expect(result.pathValidation?.allowed).toBe(shouldAllow);
        expect(result.allowed).toBe(shouldAllow);
      }
    });
  });

  describe('Error handling and recovery', () => {
    it('should handle permissions that cannot be parsed or are corrupted', async () => {
      // This test simulates what happens when the database contains invalid data
      // In a real scenario, this might happen due to database corruption or version mismatches

      // Store a valid permission first
      await store.savePermission({
        tool: 'ValidTool',
        level: 'allow-always',
        createdAt: new Date()
      });

      // The permission manager should handle missing or invalid permissions gracefully
      const validResult = await manager.checkToolPermission('ValidTool');
      expect(validResult.level).toBe('allow-always');
      expect(validResult.allowed).toBe(true);

      // Test with tool that has no permissions (should use defaults)
      const unknownResult = await manager.checkToolPermission('UnknownTool');
      expect(unknownResult.level).toBeNull();
      expect(unknownResult.allowed).toBe(true); // Default behavior
    });

    it('should handle concurrent access to the same permission', async () => {
      // Test concurrent access patterns that might cause race conditions

      const tool = 'ConcurrentTool';
      const scope = 'shared-scope';

      // Grant an allow-once permission
      await manager.grantPermission(tool, scope, 'allow-once');

      // Create multiple concurrent promises that try to access the same permission
      const concurrentPromises = Array.from({ length: 10 }, async (_, index) => {
        // Add small random delays to increase chance of race conditions
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

        return {
          index,
          result: await manager.checkToolPermission(tool, { scope })
        };
      });

      const results = await Promise.all(concurrentPromises);

      // Only one should successfully get the allow-once permission
      const successfulResults = results.filter(r => r.result.level === 'allow-once');
      const failedResults = results.filter(r => r.result.level === null);

      expect(successfulResults).toHaveLength(1);
      expect(failedResults).toHaveLength(9);

      // The successful result should be allowed
      expect(successfulResults[0].result.allowed).toBe(true);

      // The failed results should use default behavior (allowed)
      for (const failed of failedResults) {
        expect(failed.result.allowed).toBe(true);
      }
    });

    it('should handle store errors gracefully', async () => {
      // Close the store to simulate database errors
      store.close();

      // Attempting to check permissions should handle the error gracefully
      try {
        const result = await manager.checkToolPermission('TestTool');

        // Should not crash and should provide reasonable defaults
        expect(result.level).toBeNull();
        expect(typeof result.allowed).toBe('boolean');
        expect(typeof result.requiresConfirmation).toBe('boolean');
      } catch (error) {
        // If an error is thrown, it should be a well-defined error type
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Performance and scalability edge cases', () => {
    it('should handle checking permissions for many different tools rapidly', async () => {
      const tools = Array.from({ length: 100 }, (_, i) => `Tool${i}`);
      const startTime = Date.now();

      // Check permissions for all tools
      const results = await Promise.all(
        tools.map(tool =>
          manager.checkToolPermission(tool, { scope: 'test-scope' })
        )
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);

      // All results should be valid
      expect(results).toHaveLength(tools.length);
      for (const result of results) {
        expect(result).toHaveProperty('allowed');
        expect(result).toHaveProperty('level');
        expect(result).toHaveProperty('requiresConfirmation');
      }
    });

    it('should handle large numbers of permissions with different expiry times', async () => {
      const count = 500;
      const now = new Date();

      // Create many permissions with varying expiry times
      const permissions: Permission[] = Array.from({ length: count }, (_, i) => ({
        tool: 'BulkTest',
        scope: `scope-${i}`,
        level: 'allow-once' as PermissionLevel,
        expiry: new Date(now.getTime() + (i * 1000)), // Staggered expiry times
        createdAt: new Date(now.getTime() - 1000)
      }));

      // Store all permissions
      for (const permission of permissions) {
        await store.savePermission(permission);
      }

      // Check that early permissions are still valid
      const earlyResults = await Promise.all(
        permissions.slice(0, 10).map(p =>
          manager.checkToolPermission(p.tool, {
            scope: p.scope,
            consumeAllowOnce: false
          })
        )
      );

      for (const result of earlyResults) {
        expect(result.level).toBe('allow-once');
        expect(result.allowed).toBe(true);
      }

      // The permission system should handle the large dataset efficiently
      expect(earlyResults).toHaveLength(10);
    });
  });
});