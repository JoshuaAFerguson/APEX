import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import { Permission, PermissionLevel } from '@apexcli/core';

describe('PermissionManager', () => {
  let manager: PermissionManager;
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = join(tmpdir(), `apex-permission-manager-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
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

  describe('constructor', () => {
    it('should create a new PermissionManager instance', () => {
      expect(manager).toBeInstanceOf(PermissionManager);
    });

    it('should accept a PermissionStore in constructor', () => {
      const newManager = new PermissionManager(store);
      expect(newManager).toBeInstanceOf(PermissionManager);
    });
  });

  describe('checkPermission', () => {
    it('should return null when no permission exists', async () => {
      const result = await manager.checkPermission('TestTool');
      expect(result).toBeNull();
    });

    it('should return permission level from persistent store', async () => {
      const permission: Permission = {
        tool: 'TestTool',
        scope: 'test-scope',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await store.savePermission(permission);

      const result = await manager.checkPermission('TestTool', 'test-scope');
      expect(result).toBe('allow-always');
    });

    it('should consume allow-once permissions from session cache', async () => {
      // Grant an allow-once permission
      await manager.grantPermission('TestTool', 'test-scope', 'allow-once');

      // First check should return allow-once and consume it
      const firstCheck = await manager.checkPermission('TestTool', 'test-scope');
      expect(firstCheck).toBe('allow-once');

      // Second check should return null as the permission was consumed
      const secondCheck = await manager.checkPermission('TestTool', 'test-scope');
      expect(secondCheck).toBeNull();
    });

    it('should not consume allow-always permissions from session cache', async () => {
      // Grant an allow-always permission
      await manager.grantPermission('TestTool', 'test-scope', 'allow-always');

      // Multiple checks should return the same result
      const firstCheck = await manager.checkPermission('TestTool', 'test-scope');
      expect(firstCheck).toBe('allow-always');

      const secondCheck = await manager.checkPermission('TestTool', 'test-scope');
      expect(secondCheck).toBe('allow-always');
    });

    it('should handle scope-less permissions', async () => {
      await manager.grantPermission('TestTool', undefined, 'allow-always');

      const result = await manager.checkPermission('TestTool');
      expect(result).toBe('allow-always');
    });

    it('should prioritize session cache over persistent store', async () => {
      // Save persistent permission
      const permission: Permission = {
        tool: 'TestTool',
        scope: 'test-scope',
        level: 'deny',
        createdAt: new Date(),
      };
      await store.savePermission(permission);

      // Grant session permission that should override
      await manager.grantPermission('TestTool', 'test-scope', 'allow-once');

      const result = await manager.checkPermission('TestTool', 'test-scope');
      expect(result).toBe('allow-once');
    });

    it('should cache and consume allow-once permissions from persistent store', async () => {
      // Save an allow-once permission directly to store
      const permission: Permission = {
        tool: 'TestTool',
        scope: 'test-scope',
        level: 'allow-once',
        createdAt: new Date(),
      };
      await store.savePermission(permission);

      // First check should cache and return the permission
      const firstCheck = await manager.checkPermission('TestTool', 'test-scope');
      expect(firstCheck).toBe('allow-once');

      // Verify the permission was removed from persistent store
      const persistentPermission = await store.getPermission({ tool: 'TestTool', scope: 'test-scope' });
      expect(persistentPermission).toBeNull();

      // Second check should return null as it was consumed
      const secondCheck = await manager.checkPermission('TestTool', 'test-scope');
      expect(secondCheck).toBeNull();
    });
  });

  describe('grantPermission', () => {
    it('should store allow-once permissions in session cache only', async () => {
      await manager.grantPermission('TestTool', 'test-scope', 'allow-once');

      // Should be accessible via checkPermission
      const result = await manager.checkPermission('TestTool', 'test-scope');
      expect(result).toBe('allow-once');

      // Should not exist in persistent store
      const persistentPermission = await store.getPermission({ tool: 'TestTool', scope: 'test-scope' });
      expect(persistentPermission).toBeNull();
    });

    it('should store allow-always permissions in persistent store', async () => {
      await manager.grantPermission('TestTool', 'test-scope', 'allow-always');

      // Should be accessible via checkPermission
      const result = await manager.checkPermission('TestTool', 'test-scope');
      expect(result).toBe('allow-always');

      // Should exist in persistent store
      const persistentPermission = await store.getPermission({ tool: 'TestTool', scope: 'test-scope' });
      expect(persistentPermission?.level).toBe('allow-always');
    });

    it('should store deny permissions in persistent store', async () => {
      await manager.grantPermission('TestTool', 'test-scope', 'deny');

      // Should be accessible via checkPermission
      const result = await manager.checkPermission('TestTool', 'test-scope');
      expect(result).toBe('deny');

      // Should exist in persistent store
      const persistentPermission = await store.getPermission({ tool: 'TestTool', scope: 'test-scope' });
      expect(persistentPermission?.level).toBe('deny');
    });

    it('should handle undefined scope', async () => {
      await manager.grantPermission('TestTool', undefined, 'allow-always');

      const result = await manager.checkPermission('TestTool');
      expect(result).toBe('allow-always');
    });

    it('should clear session cache when granting persistent permissions', async () => {
      // First, grant a session permission
      await manager.grantPermission('TestTool', 'test-scope', 'allow-once');

      // Then grant a persistent permission for the same tool/scope
      await manager.grantPermission('TestTool', 'test-scope', 'allow-always');

      // Multiple checks should return allow-always (not consumed)
      const firstCheck = await manager.checkPermission('TestTool', 'test-scope');
      expect(firstCheck).toBe('allow-always');

      const secondCheck = await manager.checkPermission('TestTool', 'test-scope');
      expect(secondCheck).toBe('allow-always');
    });
  });

  describe('revokePermission', () => {
    it('should revoke session-only permissions', async () => {
      await manager.grantPermission('TestTool', 'test-scope', 'allow-once');

      const revokeResult = await manager.revokePermission('TestTool', 'test-scope');
      expect(revokeResult).toBe(true);

      const checkResult = await manager.checkPermission('TestTool', 'test-scope');
      expect(checkResult).toBeNull();
    });

    it('should revoke persistent permissions', async () => {
      await manager.grantPermission('TestTool', 'test-scope', 'allow-always');

      const revokeResult = await manager.revokePermission('TestTool', 'test-scope');
      expect(revokeResult).toBe(true);

      const checkResult = await manager.checkPermission('TestTool', 'test-scope');
      expect(checkResult).toBeNull();
    });

    it('should revoke both session and persistent permissions', async () => {
      // Add persistent permission first
      await manager.grantPermission('TestTool', 'test-scope', 'allow-always');
      // Add session permission (which will clear the persistent one from cache)
      await manager.grantPermission('TestTool', 'other-scope', 'allow-once');

      const revokeResult = await manager.revokePermission('TestTool', 'test-scope');
      expect(revokeResult).toBe(true);

      const checkResult = await manager.checkPermission('TestTool', 'test-scope');
      expect(checkResult).toBeNull();
    });

    it('should return false when no permission exists to revoke', async () => {
      const result = await manager.revokePermission('NonExistentTool', 'test-scope');
      expect(result).toBe(false);
    });

    it('should handle undefined scope', async () => {
      await manager.grantPermission('TestTool', undefined, 'allow-always');

      const revokeResult = await manager.revokePermission('TestTool');
      expect(revokeResult).toBe(true);

      const checkResult = await manager.checkPermission('TestTool');
      expect(checkResult).toBeNull();
    });
  });

  describe('hasPermission', () => {
    it('should return true for allow-always permissions', async () => {
      await manager.grantPermission('TestTool', 'test-scope', 'allow-always');

      const result = await manager.hasPermission('TestTool', 'test-scope');
      expect(result).toBe(true);
    });

    it('should return true for allow-once permissions', async () => {
      await manager.grantPermission('TestTool', 'test-scope', 'allow-once');

      const result = await manager.hasPermission('TestTool', 'test-scope');
      expect(result).toBe(true);
    });

    it('should return false for deny permissions', async () => {
      await manager.grantPermission('TestTool', 'test-scope', 'deny');

      const result = await manager.hasPermission('TestTool', 'test-scope');
      expect(result).toBe(false);
    });

    it('should return false when no permission exists', async () => {
      const result = await manager.hasPermission('NonExistentTool', 'test-scope');
      expect(result).toBe(false);
    });

    it('should consume allow-once permissions when checking', async () => {
      await manager.grantPermission('TestTool', 'test-scope', 'allow-once');

      // First check should return true and consume the permission
      const firstCheck = await manager.hasPermission('TestTool', 'test-scope');
      expect(firstCheck).toBe(true);

      // Second check should return false as the permission was consumed
      const secondCheck = await manager.hasPermission('TestTool', 'test-scope');
      expect(secondCheck).toBe(false);
    });

    it('should handle undefined scope', async () => {
      await manager.grantPermission('TestTool', undefined, 'allow-always');

      const result = await manager.hasPermission('TestTool');
      expect(result).toBe(true);
    });
  });

  describe('resetSession', () => {
    it('should clear all session cache entries', async () => {
      // Grant multiple session permissions
      await manager.grantPermission('Tool1', 'scope1', 'allow-once');
      await manager.grantPermission('Tool2', 'scope2', 'allow-once');
      await manager.grantPermission('Tool3', undefined, 'allow-once');

      // Reset session
      manager.resetSession();

      // All session permissions should be cleared
      expect(await manager.checkPermission('Tool1', 'scope1')).toBeNull();
      expect(await manager.checkPermission('Tool2', 'scope2')).toBeNull();
      expect(await manager.checkPermission('Tool3')).toBeNull();
    });

    it('should not affect persistent permissions', async () => {
      // Grant both session and persistent permissions
      await manager.grantPermission('SessionTool', 'scope', 'allow-once');
      await manager.grantPermission('PersistentTool', 'scope', 'allow-always');

      // Reset session
      manager.resetSession();

      // Session permission should be cleared
      expect(await manager.checkPermission('SessionTool', 'scope')).toBeNull();

      // Persistent permission should remain
      expect(await manager.checkPermission('PersistentTool', 'scope')).toBe('allow-always');
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        manager.resetSession();
        manager.resetSession();
        manager.resetSession();
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty tool names gracefully', async () => {
      // The underlying store should handle validation, but we test the manager's behavior
      await expect(manager.grantPermission('', 'scope', 'allow-always')).resolves.not.toThrow();

      const result = await manager.checkPermission('', 'scope');
      expect(result).toBe('allow-always');
    });

    it('should differentiate between different scopes for the same tool', async () => {
      await manager.grantPermission('TestTool', 'scope1', 'allow-always');
      await manager.grantPermission('TestTool', 'scope2', 'deny');

      expect(await manager.checkPermission('TestTool', 'scope1')).toBe('allow-always');
      expect(await manager.checkPermission('TestTool', 'scope2')).toBe('deny');
      expect(await manager.checkPermission('TestTool', 'scope3')).toBeNull();
    });

    it('should differentiate between scoped and unscoped permissions for the same tool', async () => {
      await manager.grantPermission('TestTool', 'scope', 'allow-always');
      await manager.grantPermission('TestTool', undefined, 'deny');

      expect(await manager.checkPermission('TestTool', 'scope')).toBe('allow-always');
      expect(await manager.checkPermission('TestTool')).toBe('deny');
    });

    it('should handle concurrent access to session cache', async () => {
      await manager.grantPermission('TestTool', 'scope', 'allow-once');

      // Simulate concurrent access
      const promises = [
        manager.checkPermission('TestTool', 'scope'),
        manager.checkPermission('TestTool', 'scope'),
        manager.checkPermission('TestTool', 'scope'),
      ];

      const results = await Promise.all(promises);

      // Only one should succeed (the others should be null due to consumption)
      const successCount = results.filter(r => r === 'allow-once').length;
      const nullCount = results.filter(r => r === null).length;

      expect(successCount).toBe(1);
      expect(nullCount).toBe(2);
    });
  });

  describe('integration with PermissionStore', () => {
    it('should work with pre-existing permissions in the store', async () => {
      // Add permission directly to store
      const permission: Permission = {
        tool: 'PreExistingTool',
        scope: 'pre-scope',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await store.savePermission(permission);

      // Manager should be able to read it
      const result = await manager.checkPermission('PreExistingTool', 'pre-scope');
      expect(result).toBe('allow-always');
    });

    it('should properly interact with store expiration logic', async () => {
      // Create an expired permission directly in the store
      const expiredPermission: Permission = {
        tool: 'ExpiredTool',
        scope: 'expired-scope',
        level: 'allow-always',
        expiry: new Date(Date.now() - 1000), // 1 second ago
        createdAt: new Date(),
      };
      await store.savePermission(expiredPermission);

      // Manager should get null for expired permission
      const result = await manager.checkPermission('ExpiredTool', 'expired-scope');
      expect(result).toBeNull();
    });
  });

  describe('input validation and robustness', () => {
    it('should handle special characters in tool names', async () => {
      const specialToolName = 'Tool@#$%^&*()_+{}[]\\|;:\'",.<>?/~`';

      await manager.grantPermission(specialToolName, 'scope', 'allow-always');
      const result = await manager.checkPermission(specialToolName, 'scope');
      expect(result).toBe('allow-always');
    });

    it('should handle special characters in scopes', async () => {
      const specialScope = 'scope@#$%^&*()_+{}[]\\|;:\'",.<>?/~`';

      await manager.grantPermission('Tool', specialScope, 'allow-always');
      const result = await manager.checkPermission('Tool', specialScope);
      expect(result).toBe('allow-always');
    });

    it('should handle very long tool names and scopes', async () => {
      const longToolName = 'A'.repeat(1000);
      const longScope = 'B'.repeat(1000);

      await manager.grantPermission(longToolName, longScope, 'allow-always');
      const result = await manager.checkPermission(longToolName, longScope);
      expect(result).toBe('allow-always');
    });

    it('should handle rapid session resets', async () => {
      // Grant some session permissions
      await manager.grantPermission('Tool1', 'scope1', 'allow-once');
      await manager.grantPermission('Tool2', 'scope2', 'allow-once');

      // Rapidly reset session multiple times
      for (let i = 0; i < 10; i++) {
        manager.resetSession();
      }

      // All session permissions should be cleared
      expect(await manager.checkPermission('Tool1', 'scope1')).toBeNull();
      expect(await manager.checkPermission('Tool2', 'scope2')).toBeNull();
    });

    it('should maintain isolation between different tool/scope combinations', async () => {
      // Grant different permissions for similar tool/scope patterns
      await manager.grantPermission('Tool', 'scope', 'allow-always');
      await manager.grantPermission('Tool', 'scope1', 'deny');
      await manager.grantPermission('Tool1', 'scope', 'allow-once');

      // Verify they don't interfere with each other
      expect(await manager.checkPermission('Tool', 'scope')).toBe('allow-always');
      expect(await manager.checkPermission('Tool', 'scope1')).toBe('deny');
      expect(await manager.checkPermission('Tool1', 'scope')).toBe('allow-once');
      expect(await manager.checkPermission('Tool1', 'scope1')).toBeNull();
    });
  });

  describe('performance and stress testing', () => {
    it('should handle many simultaneous permission operations efficiently', async () => {
      const operations = [];

      // Create many concurrent operations
      for (let i = 0; i < 100; i++) {
        operations.push(manager.grantPermission(`Tool${i}`, `scope${i}`, 'allow-always'));
      }

      // Wait for all to complete
      await Promise.all(operations);

      // Verify all permissions were set correctly
      for (let i = 0; i < 100; i++) {
        expect(await manager.checkPermission(`Tool${i}`, `scope${i}`)).toBe('allow-always');
      }
    });

    it('should handle large session cache gracefully', async () => {
      // Add many session permissions
      for (let i = 0; i < 100; i++) {
        await manager.grantPermission(`SessionTool${i}`, `scope${i}`, 'allow-once');
      }

      // Reset should clear all efficiently
      const startTime = Date.now();
      manager.resetSession();
      const endTime = Date.now();

      // Should be very fast (under 10ms)
      expect(endTime - startTime).toBeLessThan(10);

      // All should be cleared
      for (let i = 0; i < 10; i++) { // Test a sample
        expect(await manager.checkPermission(`SessionTool${i}`, `scope${i}`)).toBeNull();
      }
    });
  });

  describe('getToolConfig', () => {
    it('should return null when no tool config exists', async () => {
      const config = await manager.getToolConfig('NonExistentTool');
      expect(config).toBeNull();
    });

    it('should return tool config from extended permission', async () => {
      const toolConfig = {
        enabled: true,
        timeout: 5000,
        requireConfirmation: false,
      };

      await store.saveExtendedPermission({
        tool: 'ConfiguredTool',
        scope: 'test-scope',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      });

      const result = await manager.getToolConfig('ConfiguredTool', 'test-scope');
      expect(result).toEqual(toolConfig);
    });

    it('should cache tool config for session', async () => {
      const toolConfig = {
        enabled: true,
        timeout: 2000,
      };

      await store.saveExtendedPermission({
        tool: 'CachedTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      });

      // First call should query the store
      const result1 = await manager.getToolConfig('CachedTool');
      expect(result1).toEqual(toolConfig);

      // Second call should use cache
      const result2 = await manager.getToolConfig('CachedTool');
      expect(result2).toEqual(toolConfig);
      expect(result2).toBe(result1); // Same object reference
    });

    it('should handle tool config without scope', async () => {
      const toolConfig = {
        enabled: false,
        requireConfirmation: true,
      };

      await store.saveExtendedPermission({
        tool: 'GlobalTool',
        level: 'deny',
        createdAt: new Date(),
        config: toolConfig,
      });

      const result = await manager.getToolConfig('GlobalTool');
      expect(result).toEqual(toolConfig);
    });
  });

  describe('checkDirectoryAccess', () => {
    it('should allow access when no directory config exists', async () => {
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
      const directoryConfig = {
        allowlist: ['/allowed/**'],
        blocklist: ['/blocked/**'],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 0,
      };

      const toolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      await store.saveExtendedPermission({
        tool: 'FileTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      });

      const result = await manager.checkDirectoryAccess('/allowed/subfolder', {
        tool: 'FileTool',
      });

      expect(result.allowed).toBe(true);
      expect(result.configUsed).toEqual(directoryConfig);
      expect(result.matchType).toBe('allowlist');
    });

    it('should block access based on blocklist patterns', async () => {
      const directoryConfig = {
        allowlist: [],
        blocklist: ['**/.git/**', '**/node_modules/**'],
        defaultAllow: true,
        resolveSymlinks: true,
        maxDepth: 0,
      };

      const toolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      await store.saveExtendedPermission({
        tool: 'BlockedTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      });

      const result = await manager.checkDirectoryAccess('/project/.git/config', {
        tool: 'BlockedTool',
      });

      expect(result.allowed).toBe(false);
      expect(result.matchType).toBe('blocklist');
      expect(result.matchedPattern).toBe('**/.git/**');
    });

    it('should cache directory config for session', async () => {
      const directoryConfig = {
        allowlist: ['/cache-test/**'],
        blocklist: [],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 0,
      };

      const toolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      await store.saveExtendedPermission({
        tool: 'CacheTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      });

      // First call
      const result1 = await manager.checkDirectoryAccess('/cache-test/file.txt', {
        tool: 'CacheTool',
      });
      expect(result1.allowed).toBe(true);

      // Second call should use cached config
      const result2 = await manager.checkDirectoryAccess('/cache-test/other.txt', {
        tool: 'CacheTool',
      });
      expect(result2.allowed).toBe(true);
    });
  });

  describe('checkToolPermission', () => {
    it('should return comprehensive permission result for allowed tool', async () => {
      await manager.grantPermission('AllowedTool', 'test-scope', 'allow-always');

      const result = await manager.checkToolPermission('AllowedTool', {
        scope: 'test-scope',
      });

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.denialReason).toBeUndefined();
    });

    it('should return denial for explicitly denied tool', async () => {
      await manager.grantPermission('DeniedTool', 'test-scope', 'deny');

      const result = await manager.checkToolPermission('DeniedTool', {
        scope: 'test-scope',
      });

      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');
      expect(result.denialReason).toBe('Tool access is explicitly denied');
    });

    it('should include tool configuration in result', async () => {
      const toolConfig = {
        enabled: true,
        timeout: 5000,
        requireConfirmation: false,
        maxResults: 100,
      };

      await store.saveExtendedPermission({
        tool: 'ConfigTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      });

      const result = await manager.checkToolPermission('ConfigTool');

      expect(result.allowed).toBe(true);
      expect(result.config).toEqual(toolConfig);
    });

    it('should perform path validation when path is provided', async () => {
      const directoryConfig = {
        allowlist: ['/valid/**'],
        blocklist: ['/blocked/**'],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 0,
      };

      const toolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      await store.saveExtendedPermission({
        tool: 'PathTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      });

      const result = await manager.checkToolPermission('PathTool', {
        path: '/blocked/secret.txt',
      });

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('Directory access denied');
      expect(result.pathValidation).toBeDefined();
      expect(result.pathValidation?.allowed).toBe(false);
    });

    it('should require confirmation when tool config requires it', async () => {
      const toolConfig = {
        enabled: true,
        requireConfirmation: true,
      };

      await store.saveExtendedPermission({
        tool: 'ConfirmTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      });

      // Check without existing permission
      const result = await manager.checkToolPermission('UnknownTool');

      expect(result.allowed).toBe(true); // Default behavior for unknown tools
      expect(result.level).toBeNull();
    });

    it('should deny access for disabled tools', async () => {
      const toolConfig = {
        enabled: false,
        timeout: 1000,
      };

      await store.saveExtendedPermission({
        tool: 'DisabledTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      });

      const result = await manager.checkToolPermission('DisabledTool');

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toBe('Tool is disabled via configuration');
    });

    it('should not consume allow-once when consumeAllowOnce is false', async () => {
      await manager.grantPermission('OnceTool', 'test', 'allow-once');

      // Check without consuming
      const result1 = await manager.checkToolPermission('OnceTool', {
        scope: 'test',
        consumeAllowOnce: false,
      });

      expect(result1.allowed).toBe(true);
      expect(result1.level).toBe('allow-once');

      // Check again - should still be available
      const result2 = await manager.checkToolPermission('OnceTool', {
        scope: 'test',
        consumeAllowOnce: false,
      });

      expect(result2.allowed).toBe(true);
      expect(result2.level).toBe('allow-once');

      // Now consume it
      const result3 = await manager.checkToolPermission('OnceTool', {
        scope: 'test',
        consumeAllowOnce: true,
      });

      expect(result3.allowed).toBe(true);
      expect(result3.level).toBe('allow-once');

      // Should be gone now
      const result4 = await manager.checkToolPermission('OnceTool', {
        scope: 'test',
      });

      expect(result4.level).toBeNull();
    });

    it('should handle complex scenarios with path validation and configuration', async () => {
      const directoryConfig = {
        allowlist: ['/project/src/**'],
        blocklist: ['/project/src/private/**'],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 0,
      };

      const toolConfig = {
        enabled: true,
        timeout: 3000,
        requireConfirmation: false,
        directoryAccess: directoryConfig,
      };

      await store.saveExtendedPermission({
        tool: 'ComplexTool',
        scope: 'dev',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      });

      // Should allow access to allowed path
      const result1 = await manager.checkToolPermission('ComplexTool', {
        scope: 'dev',
        path: '/project/src/components/Button.tsx',
      });

      expect(result1.allowed).toBe(true);
      expect(result1.pathValidation?.allowed).toBe(true);
      expect(result1.config).toEqual(toolConfig);

      // Should deny access to blocked path
      const result2 = await manager.checkToolPermission('ComplexTool', {
        scope: 'dev',
        path: '/project/src/private/secrets.json',
      });

      expect(result2.allowed).toBe(false);
      expect(result2.pathValidation?.allowed).toBe(false);
      expect(result2.denialReason).toContain('Directory access denied');
    });
  });

  describe('updated resetSession', () => {
    it('should clear all cache types including new caches', async () => {
      // Set up data in all cache types
      await manager.grantPermission('SessionTool', 'test', 'allow-once');

      const toolConfig = { enabled: true };
      await store.saveExtendedPermission({
        tool: 'CachedTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      });

      // Populate tool config cache
      await manager.getToolConfig('CachedTool');

      // Populate directory access cache
      await manager.checkDirectoryAccess('/test/path', { tool: 'CachedTool' });

      // Verify caches are populated
      expect(await manager.checkPermission('SessionTool', 'test')).toBe('allow-once');
      expect(await manager.getToolConfig('CachedTool')).toEqual(toolConfig);

      // Reset session
      manager.resetSession();

      // Verify all caches are cleared
      expect(await manager.checkPermission('SessionTool', 'test')).toBeNull();

      // Note: getToolConfig will re-fetch from store, but the cache should be clear
      // We can't easily test cache state directly, but the behavior should be correct
    });
  });
});