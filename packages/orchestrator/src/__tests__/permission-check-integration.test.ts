import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import { Permission, PermissionLevel, ToolPermissionCheckOptions, ToolPermissionConfig, FilesystemToolConfig } from '@apexcli/core';

/**
 * Integration tests for permission checks
 *
 * Tests verify that permission checks correctly evaluate whether an action is allowed
 * based on current permission state. Tests cover:
 * - Checking permissions that exist
 * - Checking permissions that don't exist
 * - Checking permissions with various autonomy levels
 */
describe('Permission Check Integration Tests', () => {
  let manager: PermissionManager;
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-permission-check-integration-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
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

  describe('Checking permissions that exist', () => {
    it('should correctly identify allow-always permissions', async () => {
      // Set up an allow-always permission
      const permission: Permission = {
        tool: 'Read',
        scope: '/src/**/*.ts',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await store.savePermission(permission);

      // Check the permission using basic checkPermission method
      const level = await manager.checkPermission('Read', '/src/**/*.ts');
      expect(level).toBe('allow-always');

      // Check using comprehensive checkToolPermission method
      const result = await manager.checkToolPermission('Read', {
        scope: '/src/**/*.ts'
      });

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.denialReason).toBeUndefined();

      // Should be persistent - check again
      const secondCheck = await manager.checkPermission('Read', '/src/**/*.ts');
      expect(secondCheck).toBe('allow-always');
    });

    it('should correctly handle allow-once permissions and consume them', async () => {
      // Set up an allow-once permission
      const permission: Permission = {
        tool: 'Write',
        scope: '/config/settings.json',
        level: 'allow-once',
        expiry: new Date(Date.now() + 3600000), // 1 hour from now
        createdAt: new Date(),
      };
      await store.savePermission(permission);

      // First check should return allow-once and consume it
      const firstLevel = await manager.checkPermission('Write', '/config/settings.json');
      expect(firstLevel).toBe('allow-once');

      // Comprehensive check should also work
      const result = await manager.checkToolPermission('Write', {
        scope: '/config/settings.json'
      });

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-once');
      expect(result.requiresConfirmation).toBe(false);

      // Second check should return null (permission consumed)
      const secondLevel = await manager.checkPermission('Write', '/config/settings.json');
      expect(secondLevel).toBeNull();

      const secondResult = await manager.checkToolPermission('Write', {
        scope: '/config/settings.json'
      });
      expect(secondResult.level).toBeNull();
    });

    it('should correctly identify deny permissions', async () => {
      // Set up a deny permission
      const permission: Permission = {
        tool: 'Bash',
        scope: 'rm -rf',
        level: 'deny',
        createdAt: new Date(),
      };
      await store.savePermission(permission);

      // Check the permission
      const level = await manager.checkPermission('Bash', 'rm -rf');
      expect(level).toBe('deny');

      // Check using comprehensive method
      const result = await manager.checkToolPermission('Bash', {
        scope: 'rm -rf'
      });

      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.denialReason).toBe('Tool access is explicitly denied');
    });

    it('should handle allow-once permissions from session cache', async () => {
      // Grant an allow-once permission directly to session cache
      await manager.grantPermission('Edit', '/temp/file.txt', 'allow-once');

      // First check should find it in session cache
      const firstCheck = await manager.checkPermission('Edit', '/temp/file.txt');
      expect(firstCheck).toBe('allow-once');

      // Second check should not find it (consumed)
      const secondCheck = await manager.checkPermission('Edit', '/temp/file.txt');
      expect(secondCheck).toBeNull();
    });

    it('should handle permissions without scopes', async () => {
      // Set up a global tool permission
      const permission: Permission = {
        tool: 'WebSearch',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await store.savePermission(permission);

      // Check without scope
      const level = await manager.checkPermission('WebSearch');
      expect(level).toBe('allow-always');

      const result = await manager.checkToolPermission('WebSearch');
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
    });
  });

  describe('Checking permissions that do not exist', () => {
    it('should return null for non-existent tool permissions', async () => {
      // Check a tool that has no permissions set
      const level = await manager.checkPermission('NonExistentTool');
      expect(level).toBeNull();

      const result = await manager.checkToolPermission('NonExistentTool');
      expect(result.level).toBeNull();
      expect(result.allowed).toBe(true); // Default behavior when no explicit deny
      expect(result.requiresConfirmation).toBe(false);
    });

    it('should return null for non-existent scope permissions', async () => {
      // Set up permission for one scope
      const permission: Permission = {
        tool: 'Read',
        scope: '/allowed/path/**',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await store.savePermission(permission);

      // Check different scope
      const level = await manager.checkPermission('Read', '/different/path/**');
      expect(level).toBeNull();

      const result = await manager.checkToolPermission('Read', {
        scope: '/different/path/**'
      });
      expect(result.level).toBeNull();
      expect(result.allowed).toBe(true); // Default behavior
    });

    it('should return null after consuming allow-once permissions', async () => {
      // Grant and immediately consume an allow-once permission
      await manager.grantPermission('TestTool', 'test-scope', 'allow-once');
      await manager.checkPermission('TestTool', 'test-scope'); // Consume it

      // Should now return null
      const level = await manager.checkPermission('TestTool', 'test-scope');
      expect(level).toBeNull();

      const result = await manager.checkToolPermission('TestTool', {
        scope: 'test-scope'
      });
      expect(result.level).toBeNull();
    });

    it('should handle mixed scenarios - some permissions exist, others do not', async () => {
      // Set up some permissions
      await store.savePermission({
        tool: 'Read',
        scope: '/src/**',
        level: 'allow-always',
        createdAt: new Date(),
      });

      await store.savePermission({
        tool: 'Write',
        scope: '/dist/**',
        level: 'deny',
        createdAt: new Date(),
      });

      // Check existing permissions
      const readLevel = await manager.checkPermission('Read', '/src/**');
      expect(readLevel).toBe('allow-always');

      const writeLevel = await manager.checkPermission('Write', '/dist/**');
      expect(writeLevel).toBe('deny');

      // Check non-existent permissions
      const editLevel = await manager.checkPermission('Edit', '/src/**');
      expect(editLevel).toBeNull();

      const bashLevel = await manager.checkPermission('Bash', 'npm install');
      expect(bashLevel).toBeNull();
    });
  });

  describe('Various autonomy levels and configurations', () => {
    it('should handle tool configurations requiring confirmation', async () => {
      // Set up tool config that requires confirmation
      const config: ToolPermissionConfig = {
        requireConfirmation: true,
        enabled: true,
      };

      // Store extended permission with config
      await store.saveExtendedPermission({
        tool: 'Bash',
        scope: 'git push',
        level: null, // No explicit permission level
        config,
        createdAt: new Date(),
      });

      // Check without explicit permission should require confirmation
      const result = await manager.checkToolPermission('Bash', {
        scope: 'git push'
      });

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.requiresConfirmation).toBe(true);
      expect(result.denialReason).toBe('Tool requires user confirmation before execution');
      expect(result.config).toEqual(config);
    });

    it('should override config-based confirmation with explicit permissions', async () => {
      // Set up tool config requiring confirmation
      const config: ToolPermissionConfig = {
        requireConfirmation: true,
        enabled: true,
      };

      await store.saveExtendedPermission({
        tool: 'Bash',
        scope: 'git commit',
        level: null,
        config,
        createdAt: new Date(),
      });

      // But also set explicit allow permission
      await store.savePermission({
        tool: 'Bash',
        scope: 'git commit',
        level: 'allow-always',
        createdAt: new Date(),
      });

      const result = await manager.checkToolPermission('Bash', {
        scope: 'git commit'
      });

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.config).toEqual(config);
    });

    it('should handle disabled tools via configuration', async () => {
      // Set up disabled tool config
      const config: ToolPermissionConfig = {
        enabled: false,
        requireConfirmation: false,
      };

      await store.saveExtendedPermission({
        tool: 'WebFetch',
        scope: 'http://*',
        level: null,
        config,
        createdAt: new Date(),
      });

      const result = await manager.checkToolPermission('WebFetch', {
        scope: 'http://*'
      });

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.requiresConfirmation).toBe(false);
      expect(result.denialReason).toBe('Tool is disabled via configuration');
      expect(result.config).toEqual(config);
    });

    it('should handle directory access validation integration', async () => {
      // Set up tool config with directory access restrictions
      const config: FilesystemToolConfig = {
        enabled: true,
        requireConfirmation: false,
        directoryAccess: {
          allowlist: ['/public/**'],
          blocklist: ['/secure/**'],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 0,
        }
      };

      // Store extended permission with restrictive directory access
      await store.saveExtendedPermission({
        tool: 'Write',
        scope: '/secure/file.txt',
        level: 'allow-always',
        config,
        createdAt: new Date(),
      });

      const result = await manager.checkToolPermission('Write', {
        scope: '/secure/file.txt',
        path: '/secure/secret.txt'
      });

      expect(result.allowed).toBe(false);
      expect(result.level).toBe('allow-always');
      expect(result.denialReason).toMatch(/Directory access denied/);
      expect(result.pathValidation).toBeDefined();
      expect(result.pathValidation?.allowed).toBe(false);
    });

    it('should handle complex scenarios with multiple autonomy levels', async () => {
      // Set up various permission levels for different tools
      const permissions: Permission[] = [
        {
          tool: 'Read',
          scope: '/public/**',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'Write',
          scope: '/temp/**',
          level: 'allow-once',
          expiry: new Date(Date.now() + 3600000),
          createdAt: new Date(),
        },
        {
          tool: 'Bash',
          scope: 'sudo *',
          level: 'deny',
          createdAt: new Date(),
        }
      ];

      for (const permission of permissions) {
        await store.savePermission(permission);
      }

      // Test different autonomy behaviors
      const readResult = await manager.checkToolPermission('Read', { scope: '/public/**' });
      expect(readResult.allowed).toBe(true);
      expect(readResult.level).toBe('allow-always');

      const writeResult = await manager.checkToolPermission('Write', { scope: '/temp/**' });
      expect(writeResult.allowed).toBe(true);
      expect(writeResult.level).toBe('allow-once');

      // Should be consumed now
      const writeResult2 = await manager.checkToolPermission('Write', { scope: '/temp/**' });
      expect(writeResult2.level).toBeNull();

      const bashResult = await manager.checkToolPermission('Bash', { scope: 'sudo *' });
      expect(bashResult.allowed).toBe(false);
      expect(bashResult.level).toBe('deny');
    });

    it('should handle consumeAllowOnce option correctly', async () => {
      // Set up allow-once permission
      await manager.grantPermission('TestTool', 'test-scope', 'allow-once');

      // Check without consuming
      const result1 = await manager.checkToolPermission('TestTool', {
        scope: 'test-scope',
        consumeAllowOnce: false
      });

      expect(result1.allowed).toBe(true);
      expect(result1.level).toBe('allow-once');

      // Should still be available
      const result2 = await manager.checkToolPermission('TestTool', {
        scope: 'test-scope',
        consumeAllowOnce: false
      });

      expect(result2.allowed).toBe(true);
      expect(result2.level).toBe('allow-once');

      // Now consume it
      const result3 = await manager.checkToolPermission('TestTool', {
        scope: 'test-scope',
        consumeAllowOnce: true
      });

      expect(result3.allowed).toBe(true);
      expect(result3.level).toBe('allow-once');

      // Should be gone now
      const result4 = await manager.checkToolPermission('TestTool', {
        scope: 'test-scope'
      });

      expect(result4.level).toBeNull();
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle null and undefined scope values consistently', async () => {
      // Set up permissions with and without scopes
      await store.savePermission({
        tool: 'TestTool',
        level: 'allow-always',
        createdAt: new Date(),
      });

      await store.savePermission({
        tool: 'TestTool',
        scope: 'specific-scope',
        level: 'deny',
        createdAt: new Date(),
      });

      // Check with no scope (should match global permission)
      const globalCheck = await manager.checkPermission('TestTool');
      expect(globalCheck).toBe('allow-always');

      // Check with undefined scope (should be same as no scope)
      const undefinedCheck = await manager.checkPermission('TestTool', undefined);
      expect(undefinedCheck).toBe('allow-always');

      // Check with specific scope (should match specific permission)
      const scopedCheck = await manager.checkPermission('TestTool', 'specific-scope');
      expect(scopedCheck).toBe('deny');
    });

    it('should handle concurrent permission checks', async () => {
      // Set up allow-once permission
      await manager.grantPermission('ConcurrentTool', 'test', 'allow-once');

      // Multiple concurrent checks - only one should consume the permission
      const promises = Array(10).fill(0).map(() =>
        manager.checkPermission('ConcurrentTool', 'test')
      );

      const results = await Promise.all(promises);

      // Exactly one should be 'allow-once', others should be null
      const allowOnceCount = results.filter(r => r === 'allow-once').length;
      const nullCount = results.filter(r => r === null).length;

      expect(allowOnceCount).toBe(1);
      expect(nullCount).toBe(9);
    });

    it('should handle expired permissions correctly', async () => {
      // Set up an already-expired permission
      const expiredPermission: Permission = {
        tool: 'ExpiredTool',
        scope: 'expired-scope',
        level: 'allow-once',
        expiry: new Date(Date.now() - 3600000), // 1 hour ago
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
      };

      await store.savePermission(expiredPermission);

      // Should not find the expired permission
      const level = await manager.checkPermission('ExpiredTool', 'expired-scope');
      expect(level).toBeNull();

      const result = await manager.checkToolPermission('ExpiredTool', {
        scope: 'expired-scope'
      });
      expect(result.level).toBeNull();
    });
  });

  describe('Integration with real-world scenarios', () => {
    it('should handle file system operation permissions', async () => {
      // Simulate typical file operation permissions
      const filePermissions: Permission[] = [
        {
          tool: 'Read',
          scope: '/src/**/*.{ts,js}',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'Write',
          scope: '/src/**/*.ts',
          level: 'allow-once',
          expiry: new Date(Date.now() + 1800000), // 30 minutes
          createdAt: new Date(),
        },
        {
          tool: 'Edit',
          scope: '/src/config/*',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'Write',
          scope: '/node_modules/**',
          level: 'deny',
          createdAt: new Date(),
        }
      ];

      for (const permission of filePermissions) {
        await store.savePermission(permission);
      }

      // Test reading source files - should be allowed
      const readCheck = await manager.checkToolPermission('Read', {
        scope: '/src/**/*.{ts,js}'
      });
      expect(readCheck.allowed).toBe(true);
      expect(readCheck.level).toBe('allow-always');

      // Test writing to source files - should be allowed once
      const writeCheck = await manager.checkToolPermission('Write', {
        scope: '/src/**/*.ts'
      });
      expect(writeCheck.allowed).toBe(true);
      expect(writeCheck.level).toBe('allow-once');

      // Second write should not be allowed (consumed)
      const secondWriteCheck = await manager.checkToolPermission('Write', {
        scope: '/src/**/*.ts'
      });
      expect(secondWriteCheck.level).toBeNull();

      // Writing to node_modules should be denied
      const nodeModulesCheck = await manager.checkToolPermission('Write', {
        scope: '/node_modules/**'
      });
      expect(nodeModulesCheck.allowed).toBe(false);
      expect(nodeModulesCheck.level).toBe('deny');
    });

    it('should handle development workflow permissions', async () => {
      // Simulate a typical development workflow
      const devPermissions: Permission[] = [
        {
          tool: 'Bash',
          scope: 'npm install',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'Bash',
          scope: 'npm run build',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'Bash',
          scope: 'git add .',
          level: 'allow-once',
          expiry: new Date(Date.now() + 600000), // 10 minutes
          createdAt: new Date(),
        },
        {
          tool: 'Bash',
          scope: 'git push --force',
          level: 'deny',
          createdAt: new Date(),
        }
      ];

      for (const permission of devPermissions) {
        await store.savePermission(permission);
      }

      // Test safe development commands
      const npmInstallResult = await manager.checkToolPermission('Bash', {
        scope: 'npm install'
      });
      expect(npmInstallResult.allowed).toBe(true);
      expect(npmInstallResult.level).toBe('allow-always');

      const buildResult = await manager.checkToolPermission('Bash', {
        scope: 'npm run build'
      });
      expect(buildResult.allowed).toBe(true);
      expect(buildResult.level).toBe('allow-always');

      // Test git operations
      const gitAddResult = await manager.checkToolPermission('Bash', {
        scope: 'git add .'
      });
      expect(gitAddResult.allowed).toBe(true);
      expect(gitAddResult.level).toBe('allow-once');

      // Dangerous git operation should be denied
      const forcePushResult = await manager.checkToolPermission('Bash', {
        scope: 'git push --force'
      });
      expect(forcePushResult.allowed).toBe(false);
      expect(forcePushResult.level).toBe('deny');
    });
  });
});