/**
 * @fileoverview Coverage test for PermissionManager extended functionality
 *
 * This test suite ensures that the new methods added to PermissionManager in v0.5.0
 * work correctly according to the ADR-009 specification. It focuses on testing all
 * code paths and edge cases for comprehensive coverage.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import type {
  DirectoryAccessConfig,
  FilesystemToolConfig,
  ExtendedPermission,
  BaseToolPermissionConfig,
} from '@apexcli/core';

describe('PermissionManager Coverage Tests', () => {
  let manager: PermissionManager;
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = join(tmpdir(), `apex-pm-coverage-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    store = new PermissionStore(testDir);
    await store.initialize();

    manager = new PermissionManager(store);
  });

  afterEach(() => {
    // Clean up
    if (store) {
      store.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getToolConfig', () => {
    it('should return null for non-existent tool config', async () => {
      const config = await manager.getToolConfig('NonExistent');
      expect(config).toBeNull();
    });

    it('should return cached config on second call', async () => {
      const toolConfig: BaseToolPermissionConfig = {
        enabled: true,
        timeout: 1000,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'CachedTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      // First call
      const config1 = await manager.getToolConfig('CachedTool');
      expect(config1).toEqual(toolConfig);

      // Second call should use cache
      const config2 = await manager.getToolConfig('CachedTool');
      expect(config2).toBe(config1); // Same object reference
    });

    it('should handle scoped tool configs', async () => {
      const toolConfig: BaseToolPermissionConfig = {
        enabled: false,
        requireConfirmation: true,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'ScopedTool',
        scope: 'test-scope',
        level: 'deny',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.getToolConfig('ScopedTool', 'test-scope');
      expect(result).toEqual(toolConfig);

      // Different scope should return null
      const noResult = await manager.getToolConfig('ScopedTool', 'other-scope');
      expect(noResult).toBeNull();
    });
  });

  describe('checkDirectoryAccess', () => {
    it('should provide default config when no tool config exists', async () => {
      const result = await manager.checkDirectoryAccess('/test/path');

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('allowed');
      expect(result.configUsed).toEqual({
        allowlist: [],
        blocklist: [],
        defaultAllow: true,
        resolveSymlinks: true,
        maxDepth: 0,
      });
    });

    it('should use tool-specific directory config', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/allowed/**'],
        blocklist: ['/blocked/**'],
        defaultAllow: false,
        resolveSymlinks: false,
        maxDepth: 5,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'TestTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkDirectoryAccess('/allowed/file.txt', {
        tool: 'TestTool',
      });

      expect(result.allowed).toBe(true);
      expect(result.configUsed).toEqual(directoryConfig);
    });

    it('should cache directory access config', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/cache/**'],
        blocklist: [],
        defaultAllow: false,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'CacheTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      // First call
      await manager.checkDirectoryAccess('/cache/file1.txt', {
        tool: 'CacheTool',
      });

      // Second call should use cached config
      const result = await manager.checkDirectoryAccess('/cache/file2.txt', {
        tool: 'CacheTool',
      });

      expect(result.allowed).toBe(true);
    });

    it('should handle options with scope', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/scoped/**'],
        blocklist: [],
        defaultAllow: false,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'ScopedTool',
        scope: 'test',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkDirectoryAccess('/scoped/file.txt', {
        tool: 'ScopedTool',
        scope: 'test',
      });

      expect(result.allowed).toBe(true);
    });

    it('should handle blocked paths', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: [],
        blocklist: ['**/.git/**'],
        defaultAllow: true,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'BlockTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkDirectoryAccess('/project/.git/config', {
        tool: 'BlockTool',
      });

      expect(result.allowed).toBe(false);
      expect(result.matchType).toBe('blocklist');
    });
  });

  describe('checkToolPermission', () => {
    it('should return default result for unknown tool', async () => {
      const result = await manager.checkToolPermission('UnknownTool');

      expect(result.allowed).toBe(true);
      expect(result.level).toBeNull();
      expect(result.requiresConfirmation).toBe(false);
      expect(result.config).toBeNull();
    });

    it('should return denial for explicitly denied tool', async () => {
      await manager.grantPermission('DeniedTool', 'test', 'deny');

      const result = await manager.checkToolPermission('DeniedTool', {
        scope: 'test',
      });

      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');
      expect(result.denialReason).toBe('Tool access is explicitly denied');
    });

    it('should include tool configuration in result', async () => {
      const toolConfig: BaseToolPermissionConfig = {
        enabled: true,
        timeout: 5000,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'ConfigTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('ConfigTool');

      expect(result.allowed).toBe(true);
      expect(result.config).toEqual(toolConfig);
    });

    it('should deny access for disabled tools', async () => {
      const toolConfig: BaseToolPermissionConfig = {
        enabled: false,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'DisabledTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('DisabledTool');

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toBe('Tool is disabled via configuration');
    });

    it('should handle path validation', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/valid/**'],
        blocklist: [],
        defaultAllow: false,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'PathTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      // Valid path
      const validResult = await manager.checkToolPermission('PathTool', {
        path: '/valid/file.txt',
      });

      expect(validResult.allowed).toBe(true);
      expect(validResult.pathValidation?.allowed).toBe(true);

      // Invalid path
      const invalidResult = await manager.checkToolPermission('PathTool', {
        path: '/invalid/file.txt',
      });

      expect(invalidResult.allowed).toBe(false);
      expect(invalidResult.denialReason).toContain('Directory access denied');
    });

    it('should handle consumeAllowOnce option', async () => {
      await manager.grantPermission('OnceTool', 'test', 'allow-once');

      // Check without consuming
      const result1 = await manager.checkToolPermission('OnceTool', {
        scope: 'test',
        consumeAllowOnce: false,
      });

      expect(result1.allowed).toBe(true);
      expect(result1.level).toBe('allow-once');

      // Should still be available
      const result2 = await manager.checkToolPermission('OnceTool', {
        scope: 'test',
        consumeAllowOnce: false,
      });

      expect(result2.level).toBe('allow-once');

      // Now consume it
      const result3 = await manager.checkToolPermission('OnceTool', {
        scope: 'test',
        consumeAllowOnce: true,
      });

      expect(result3.level).toBe('allow-once');

      // Should be gone now
      const result4 = await manager.checkToolPermission('OnceTool', {
        scope: 'test',
      });

      expect(result4.level).toBeNull();
    });

    it('should handle baseDir option', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['src/**'],
        blocklist: [],
        defaultAllow: false,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'BaseDirTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('BaseDirTool', {
        path: 'src/main.ts',
        baseDir: '/project',
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('resetSession', () => {
    it('should clear all cache types', async () => {
      // Set up session permission
      await manager.grantPermission('SessionTool', 'test', 'allow-once');

      // Set up tool config cache
      const toolConfig: BaseToolPermissionConfig = {
        enabled: true,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'CachedTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      // Populate caches
      await manager.getToolConfig('CachedTool');
      await manager.checkDirectoryAccess('/test', { tool: 'CachedTool' });

      // Verify caches are populated
      expect(await manager.checkPermission('SessionTool', 'test')).toBe('allow-once');

      // Reset session
      manager.resetSession();

      // Session permission should be gone
      expect(await manager.checkPermission('SessionTool', 'test')).toBeNull();

      // Tool config should still be available (from store)
      const config = await manager.getToolConfig('CachedTool');
      expect(config).toEqual(toolConfig);
    });
  });

  describe('error handling', () => {
    it('should handle invalid paths gracefully', async () => {
      const result = await manager.checkDirectoryAccess('');
      expect(result.allowed).toBe(false);
    });

    it('should handle missing tool config gracefully', async () => {
      const result = await manager.checkDirectoryAccess('/test', {
        tool: 'NonExistentTool',
      });
      expect(result.allowed).toBe(true); // Default allow
    });

    it('should handle tool permission check with invalid path', async () => {
      const result = await manager.checkToolPermission('TestTool', {
        path: '',
      });
      expect(result.pathValidation?.allowed).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should work end-to-end with all features', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/workspace/src/**'],
        blocklist: ['/workspace/src/private/**'],
        defaultAllow: false,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        timeout: 3000,
        requireConfirmation: false,
        directoryAccess: directoryConfig,
        maxFileSize: 1048576,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'IntegratedTool',
        scope: 'dev',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      // Test tool config
      const config = await manager.getToolConfig('IntegratedTool', 'dev');
      expect(config).toEqual(toolConfig);

      // Test directory access
      const dirResult = await manager.checkDirectoryAccess('/workspace/src/main.ts', {
        tool: 'IntegratedTool',
        scope: 'dev',
      });
      expect(dirResult.allowed).toBe(true);

      // Test comprehensive permission check
      const permResult = await manager.checkToolPermission('IntegratedTool', {
        scope: 'dev',
        path: '/workspace/src/main.ts',
      });
      expect(permResult.allowed).toBe(true);
      expect(permResult.config).toEqual(toolConfig);
      expect(permResult.pathValidation?.allowed).toBe(true);

      // Test blocked path
      const blockedResult = await manager.checkToolPermission('IntegratedTool', {
        scope: 'dev',
        path: '/workspace/src/private/secret.ts',
      });
      expect(blockedResult.allowed).toBe(false);
    });
  });
});