import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionStore } from '../permission-store';
import { Permission, PermissionLevel, PermissionQuery } from '@apexcli/core';

describe('PermissionStore', () => {
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = join(tmpdir(), `apex-permission-store-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    store = new PermissionStore(testDir);
    await store.initialize();
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

  describe('initialization', () => {
    it('should create .apex directory if it does not exist', () => {
      const apexDir = join(testDir, '.apex');
      expect(existsSync(apexDir)).toBe(true);
    });

    it('should create database file', () => {
      const dbPath = join(testDir, '.apex', 'apex.db');
      expect(existsSync(dbPath)).toBe(true);
    });

    it('should create permissions table with proper schema', async () => {
      // Verify we can interact with the database without errors
      const permissions = await store.listPermissions();
      expect(Array.isArray(permissions)).toBe(true);
    });
  });

  describe('savePermission', () => {
    it('should save a basic permission', async () => {
      const permission: Permission = {
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
      };

      await store.savePermission(permission);

      const query: PermissionQuery = { tool: 'Read' };
      const retrieved = await store.getPermission(query);

      expect(retrieved).toMatchObject({
        tool: 'Read',
        level: 'allow-always',
        scope: undefined,
        expiry: undefined,
      });
      expect(retrieved?.createdAt).toBeInstanceOf(Date);
    });

    it('should save a permission with scope', async () => {
      const permission: Permission = {
        tool: 'Write',
        scope: '/tmp/test.txt',
        level: 'allow-once',
        createdAt: new Date(),
      };

      await store.savePermission(permission);

      const query: PermissionQuery = { tool: 'Write', scope: '/tmp/test.txt' };
      const retrieved = await store.getPermission(query);

      expect(retrieved).toMatchObject({
        tool: 'Write',
        scope: '/tmp/test.txt',
        level: 'allow-once',
      });
    });

    it('should save a permission with expiry', async () => {
      const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
      const permission: Permission = {
        tool: 'Bash',
        level: 'allow-once',
        expiry,
        createdAt: new Date(),
      };

      await store.savePermission(permission);

      const query: PermissionQuery = { tool: 'Bash' };
      const retrieved = await store.getPermission(query);

      expect(retrieved).toMatchObject({
        tool: 'Bash',
        level: 'allow-once',
      });
      expect(retrieved?.expiry?.getTime()).toBe(expiry.getTime());
    });

    it('should update existing permission for same tool/scope combination', async () => {
      const permission1: Permission = {
        tool: 'Edit',
        level: 'deny',
        createdAt: new Date(),
      };

      await store.savePermission(permission1);

      // Update the permission
      const permission2: Permission = {
        tool: 'Edit',
        level: 'allow-always',
        createdAt: new Date(),
      };

      await store.savePermission(permission2);

      const query: PermissionQuery = { tool: 'Edit' };
      const retrieved = await store.getPermission(query);

      expect(retrieved?.level).toBe('allow-always');
    });

    it('should handle all permission levels', async () => {
      const levels: PermissionLevel[] = ['allow-always', 'allow-once', 'deny'];

      for (const level of levels) {
        const permission: Permission = {
          tool: `Tool${level}`,
          level,
          createdAt: new Date(),
        };

        await store.savePermission(permission);

        const query: PermissionQuery = { tool: `Tool${level}` };
        const retrieved = await store.getPermission(query);

        expect(retrieved?.level).toBe(level);
      }
    });
  });

  describe('getPermission', () => {
    beforeEach(async () => {
      // Set up test data
      const permissions: Permission[] = [
        {
          tool: 'Read',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'Write',
          scope: '/tmp/test.txt',
          level: 'allow-once',
          createdAt: new Date(),
        },
        {
          tool: 'Bash',
          level: 'deny',
          expiry: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
          createdAt: new Date(),
        },
      ];

      for (const permission of permissions) {
        await store.savePermission(permission);
      }
    });

    it('should get permission by tool only', async () => {
      const query: PermissionQuery = { tool: 'Read' };
      const permission = await store.getPermission(query);

      expect(permission).toMatchObject({
        tool: 'Read',
        level: 'allow-always',
      });
    });

    it('should get permission by tool and scope', async () => {
      const query: PermissionQuery = { tool: 'Write', scope: '/tmp/test.txt' };
      const permission = await store.getPermission(query);

      expect(permission).toMatchObject({
        tool: 'Write',
        scope: '/tmp/test.txt',
        level: 'allow-once',
      });
    });

    it('should return null for non-existent permission', async () => {
      const query: PermissionQuery = { tool: 'NonExistent' };
      const permission = await store.getPermission(query);

      expect(permission).toBe(null);
    });

    it('should return null for wrong scope', async () => {
      const query: PermissionQuery = { tool: 'Write', scope: '/wrong/path' };
      const permission = await store.getPermission(query);

      expect(permission).toBe(null);
    });

    it('should return null for expired permission', async () => {
      // Save an expired permission
      const expiredPermission: Permission = {
        tool: 'ExpiredTool',
        level: 'allow-once',
        expiry: new Date(Date.now() - 1000), // 1 second ago
        createdAt: new Date(),
      };

      await store.savePermission(expiredPermission);

      const query: PermissionQuery = { tool: 'ExpiredTool' };
      const permission = await store.getPermission(query);

      expect(permission).toBe(null);
    });

    it('should handle null scope correctly', async () => {
      const permission: Permission = {
        tool: 'NullScopeTool',
        level: 'allow-always',
        createdAt: new Date(),
      };

      await store.savePermission(permission);

      // Query without scope
      const query1: PermissionQuery = { tool: 'NullScopeTool' };
      const result1 = await store.getPermission(query1);
      expect(result1).not.toBe(null);

      // Query with undefined scope (should be equivalent)
      const query2: PermissionQuery = { tool: 'NullScopeTool', scope: undefined };
      const result2 = await store.getPermission(query2);
      expect(result2).not.toBe(null);
    });
  });

  describe('listPermissions', () => {
    beforeEach(async () => {
      // Set up test data
      const permissions: Permission[] = [
        {
          tool: 'Read',
          level: 'allow-always',
          createdAt: new Date('2023-01-01'),
        },
        {
          tool: 'Write',
          scope: '/tmp/test.txt',
          level: 'allow-once',
          createdAt: new Date('2023-01-02'),
        },
        {
          tool: 'Bash',
          level: 'deny',
          createdAt: new Date('2023-01-03'),
        },
        {
          tool: 'ExpiredTool',
          level: 'allow-once',
          expiry: new Date(Date.now() - 1000), // Expired
          createdAt: new Date('2023-01-04'),
        },
      ];

      for (const permission of permissions) {
        await store.savePermission(permission);
      }
    });

    it('should list all non-expired permissions by default', async () => {
      const permissions = await store.listPermissions();

      expect(permissions).toHaveLength(3); // Excluding expired permission
      expect(permissions.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Read', 'Write', 'Bash'])
      );
      expect(permissions.map(p => p.tool)).not.toContain('ExpiredTool');
    });

    it('should include expired permissions when requested', async () => {
      const permissions = await store.listPermissions({ includeExpired: true });

      expect(permissions).toHaveLength(4);
      expect(permissions.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Read', 'Write', 'Bash', 'ExpiredTool'])
      );
    });

    it('should filter by tool', async () => {
      const permissions = await store.listPermissions({ tool: 'Read' });

      expect(permissions).toHaveLength(1);
      expect(permissions[0].tool).toBe('Read');
    });

    it('should filter by level', async () => {
      const permissions = await store.listPermissions({ level: 'allow-once' });

      expect(permissions).toHaveLength(1); // Only Write permission (ExpiredTool is excluded by default)
      expect(permissions[0].tool).toBe('Write');
    });

    it('should filter by multiple criteria', async () => {
      const permissions = await store.listPermissions({
        level: 'allow-once',
        includeExpired: true
      });

      expect(permissions).toHaveLength(2); // Write and ExpiredTool
      expect(permissions.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Write', 'ExpiredTool'])
      );
    });

    it('should return permissions in descending order by created date', async () => {
      const permissions = await store.listPermissions();

      // Should be ordered from most recent to oldest
      const dates = permissions.map(p => p.createdAt.getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i-1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });
  });

  describe('clearPermissions', () => {
    beforeEach(async () => {
      // Set up test data
      const permissions: Permission[] = [
        {
          tool: 'Read',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'Write',
          level: 'allow-once',
          createdAt: new Date(),
        },
      ];

      for (const permission of permissions) {
        await store.savePermission(permission);
      }
    });

    it('should clear all permissions', async () => {
      const beforeCount = await store.listPermissions();
      expect(beforeCount).toHaveLength(2);

      await store.clearPermissions();

      const afterCount = await store.listPermissions();
      expect(afterCount).toHaveLength(0);
    });
  });

  describe('clearExpired', () => {
    beforeEach(async () => {
      // Set up test data with some expired permissions
      const permissions: Permission[] = [
        {
          tool: 'Valid1',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'Valid2',
          level: 'allow-once',
          expiry: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
          createdAt: new Date(),
        },
        {
          tool: 'Expired1',
          level: 'allow-once',
          expiry: new Date(Date.now() - 1000), // 1 second ago
          createdAt: new Date(),
        },
        {
          tool: 'Expired2',
          level: 'deny',
          expiry: new Date(Date.now() - 1000 * 60), // 1 minute ago
          createdAt: new Date(),
        },
      ];

      for (const permission of permissions) {
        await store.savePermission(permission);
      }
    });

    it('should clear only expired permissions', async () => {
      const clearedCount = await store.clearExpired();

      expect(clearedCount).toBe(2); // Two expired permissions

      const remainingPermissions = await store.listPermissions({ includeExpired: true });
      expect(remainingPermissions).toHaveLength(2);
      expect(remainingPermissions.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Valid1', 'Valid2'])
      );
    });

    it('should return 0 when no expired permissions exist', async () => {
      // Clear expired permissions first
      await store.clearExpired();

      // Try to clear expired permissions again
      const clearedCount = await store.clearExpired();

      expect(clearedCount).toBe(0);
    });
  });

  describe('clearPermissionsForTool', () => {
    beforeEach(async () => {
      // Set up test data
      const permissions: Permission[] = [
        {
          tool: 'Read',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'Read',
          scope: '/tmp/test.txt',
          level: 'allow-once',
          createdAt: new Date(),
        },
        {
          tool: 'Write',
          level: 'deny',
          createdAt: new Date(),
        },
      ];

      for (const permission of permissions) {
        await store.savePermission(permission);
      }
    });

    it('should clear all permissions for a specific tool', async () => {
      const clearedCount = await store.clearPermissionsForTool('Read');

      expect(clearedCount).toBe(2); // Two Read permissions

      const remainingPermissions = await store.listPermissions();
      expect(remainingPermissions).toHaveLength(1);
      expect(remainingPermissions[0].tool).toBe('Write');
    });

    it('should return 0 when tool has no permissions', async () => {
      const clearedCount = await store.clearPermissionsForTool('NonExistent');

      expect(clearedCount).toBe(0);

      const allPermissions = await store.listPermissions();
      expect(allPermissions).toHaveLength(3); // No permissions removed
    });
  });

  describe('clearPermission', () => {
    beforeEach(async () => {
      // Set up test data
      const permissions: Permission[] = [
        {
          tool: 'Read',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'Read',
          scope: '/tmp/test.txt',
          level: 'allow-once',
          createdAt: new Date(),
        },
        {
          tool: 'Write',
          level: 'deny',
          createdAt: new Date(),
        },
      ];

      for (const permission of permissions) {
        await store.savePermission(permission);
      }
    });

    it('should clear specific permission by tool only', async () => {
      const query: PermissionQuery = { tool: 'Read' };
      const cleared = await store.clearPermission(query);

      expect(cleared).toBe(true);

      const remainingPermissions = await store.listPermissions();
      expect(remainingPermissions).toHaveLength(2);

      // Should still have the scoped Read permission
      const scopedRead = await store.getPermission({ tool: 'Read', scope: '/tmp/test.txt' });
      expect(scopedRead).not.toBe(null);
    });

    it('should clear specific permission by tool and scope', async () => {
      const query: PermissionQuery = { tool: 'Read', scope: '/tmp/test.txt' };
      const cleared = await store.clearPermission(query);

      expect(cleared).toBe(true);

      const remainingPermissions = await store.listPermissions();
      expect(remainingPermissions).toHaveLength(2);

      // Should still have the non-scoped Read permission
      const nonScopedRead = await store.getPermission({ tool: 'Read' });
      expect(nonScopedRead).not.toBe(null);
    });

    it('should return false when permission does not exist', async () => {
      const query: PermissionQuery = { tool: 'NonExistent' };
      const cleared = await store.clearPermission(query);

      expect(cleared).toBe(false);

      const allPermissions = await store.listPermissions();
      expect(allPermissions).toHaveLength(3); // No permissions removed
    });
  });

  describe('edge cases', () => {
    it('should handle empty database operations gracefully', async () => {
      const permissions = await store.listPermissions();
      expect(permissions).toHaveLength(0);

      const permission = await store.getPermission({ tool: 'NonExistent' });
      expect(permission).toBe(null);

      const clearedCount = await store.clearExpired();
      expect(clearedCount).toBe(0);
    });

    it('should handle special characters in tool names and scopes', async () => {
      const permission: Permission = {
        tool: 'Special-Tool_123!@#',
        scope: '/path/with spaces/and-special_chars.txt',
        level: 'allow-once',
        createdAt: new Date(),
      };

      await store.savePermission(permission);

      const query: PermissionQuery = {
        tool: 'Special-Tool_123!@#',
        scope: '/path/with spaces/and-special_chars.txt'
      };
      const retrieved = await store.getPermission(query);

      expect(retrieved).toMatchObject({
        tool: 'Special-Tool_123!@#',
        scope: '/path/with spaces/and-special_chars.txt',
        level: 'allow-once',
      });
    });

    it('should handle very long tool names and scopes', async () => {
      const longTool = 'A'.repeat(1000);
      const longScope = '/very/'.repeat(200) + 'long/path.txt';

      const permission: Permission = {
        tool: longTool,
        scope: longScope,
        level: 'allow-always',
        createdAt: new Date(),
      };

      await store.savePermission(permission);

      const query: PermissionQuery = { tool: longTool, scope: longScope };
      const retrieved = await store.getPermission(query);

      expect(retrieved).toMatchObject({
        tool: longTool,
        scope: longScope,
        level: 'allow-always',
      });
    });

    it('should handle boundary expiry times', async () => {
      const now = new Date();

      // Permission expiring in 1 millisecond
      const almostExpired: Permission = {
        tool: 'AlmostExpired',
        level: 'allow-once',
        expiry: new Date(now.getTime() + 1),
        createdAt: now,
      };

      await store.savePermission(almostExpired);

      // Wait for it to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const query: PermissionQuery = { tool: 'AlmostExpired' };
      const retrieved = await store.getPermission(query);

      expect(retrieved).toBe(null);
    });
  });

  describe('close', () => {
    it('should close database connection without errors', () => {
      expect(() => store.close()).not.toThrow();
    });

    it('should handle multiple close calls gracefully', () => {
      store.close();
      expect(() => store.close()).not.toThrow();
    });
  });

  describe('database robustness', () => {
    it('should handle migration edge cases', async () => {
      // Test initialization with existing database structure
      const anotherStore = new PermissionStore(testDir);
      await anotherStore.initialize();

      // Should work with existing database
      const permission: Permission = {
        tool: 'TestMigration',
        level: 'allow-always',
        createdAt: new Date(),
      };

      await anotherStore.savePermission(permission);
      const retrieved = await anotherStore.getPermission({ tool: 'TestMigration' });

      expect(retrieved?.tool).toBe('TestMigration');
      anotherStore.close();
    });

    it('should handle concurrent store instances safely', async () => {
      // Create multiple store instances on same database
      const store1 = new PermissionStore(testDir);
      const store2 = new PermissionStore(testDir);

      await store1.initialize();
      await store2.initialize();

      // Save permissions from both stores concurrently
      const permission1: Permission = {
        tool: 'ConcurrentTool1',
        level: 'allow-always',
        createdAt: new Date(),
      };

      const permission2: Permission = {
        tool: 'ConcurrentTool2',
        level: 'allow-once',
        createdAt: new Date(),
      };

      await Promise.all([
        store1.savePermission(permission1),
        store2.savePermission(permission2),
      ]);

      // Both permissions should be retrievable
      const retrieved1 = await store1.getPermission({ tool: 'ConcurrentTool1' });
      const retrieved2 = await store2.getPermission({ tool: 'ConcurrentTool2' });

      expect(retrieved1?.tool).toBe('ConcurrentTool1');
      expect(retrieved2?.tool).toBe('ConcurrentTool2');

      store1.close();
      store2.close();
    });

    it('should handle high volume permission operations', async () => {
      const largePermissionCount = 5000;
      const permissions: Permission[] = [];

      // Create many permissions rapidly
      for (let i = 0; i < largePermissionCount; i++) {
        permissions.push({
          tool: `BulkTool_${i}`,
          scope: `/bulk/path/${i}/**/*`,
          level: i % 3 === 0 ? 'allow-always' : i % 3 === 1 ? 'allow-once' : 'deny',
          createdAt: new Date(Date.now() + i),
          expiry: i % 4 === 0 ? new Date(Date.now() + i + 86400000) : undefined,
        });
      }

      // Save all permissions
      const savePromises = permissions.map(p => store.savePermission(p));
      await Promise.all(savePromises);

      // Verify count
      const allPermissions = await store.listPermissions({ includeExpired: true });
      expect(allPermissions.length).toBeGreaterThanOrEqual(largePermissionCount);

      // Test bulk clearing
      const clearedCount = await store.clearPermissions();
      expect(typeof clearedCount).toBe('undefined'); // clearPermissions doesn't return count

      const remainingPermissions = await store.listPermissions({ includeExpired: true });
      expect(remainingPermissions).toHaveLength(0);
    });

    it('should handle permission ID generation edge cases', async () => {
      // Test permissions with identical tools but different scopes
      const basePermission = {
        tool: 'IDTestTool',
        level: 'allow-always' as const,
        createdAt: new Date(),
      };

      const testScenarios = [
        { scope: undefined },
        { scope: '' },
        { scope: '/' },
        { scope: '/same/path' },
        { scope: '/same/path/' },
        { scope: '/same/path/file.txt' },
        { scope: '/different/path' },
      ];

      // Save all scenarios
      for (const scenario of testScenarios) {
        await store.savePermission({
          ...basePermission,
          scope: scenario.scope,
        });
      }

      // Verify each can be retrieved independently
      for (const scenario of testScenarios) {
        const retrieved = await store.getPermission({
          tool: 'IDTestTool',
          scope: scenario.scope,
        });
        expect(retrieved).not.toBe(null);
        expect(retrieved?.scope).toBe(scenario.scope || undefined);
      }
    });

    it('should handle permission queries with null vs undefined scope correctly', async () => {
      // Save permission with undefined scope
      const permissionUndefined: Permission = {
        tool: 'NullUndefinedTest',
        level: 'allow-always',
        createdAt: new Date(),
        scope: undefined,
      };

      await store.savePermission(permissionUndefined);

      // Test various query approaches
      const queryUndefined = await store.getPermission({ tool: 'NullUndefinedTest', scope: undefined });
      const queryOmitted = await store.getPermission({ tool: 'NullUndefinedTest' });

      expect(queryUndefined).not.toBe(null);
      expect(queryOmitted).not.toBe(null);
      expect(queryUndefined?.tool).toBe('NullUndefinedTest');
      expect(queryOmitted?.tool).toBe('NullUndefinedTest');

      // Query with empty string should not match
      const queryEmpty = await store.getPermission({ tool: 'NullUndefinedTest', scope: '' });
      expect(queryEmpty).toBe(null);
    });
  });

  describe('permission expiry edge cases', () => {
    it('should handle permissions expiring during getPermission call', async () => {
      // Create permission expiring very soon
      const soonToExpire: Permission = {
        tool: 'SoonExpired',
        level: 'allow-once',
        expiry: new Date(Date.now() + 50), // 50ms from now
        createdAt: new Date(),
      };

      await store.savePermission(soonToExpire);

      // Get it immediately (should exist)
      const before = await store.getPermission({ tool: 'SoonExpired' });
      expect(before).not.toBe(null);

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be null now and automatically cleaned up
      const after = await store.getPermission({ tool: 'SoonExpired' });
      expect(after).toBe(null);

      // Verify it was removed from database
      const allPermissions = await store.listPermissions({ includeExpired: true });
      const expiredPermission = allPermissions.find(p => p.tool === 'SoonExpired');
      expect(expiredPermission).toBeUndefined();
    });

    it('should handle clearExpired with various expiry patterns', async () => {
      const now = new Date();
      const permissionsToTest: Permission[] = [
        {
          tool: 'NotExpired1',
          level: 'allow-always',
          createdAt: now,
          // No expiry - should not be cleared
        },
        {
          tool: 'NotExpired2',
          level: 'allow-once',
          expiry: new Date(now.getTime() + 60000), // 1 minute future
          createdAt: now,
        },
        {
          tool: 'Expired1',
          level: 'allow-once',
          expiry: new Date(now.getTime() - 1000), // 1 second ago
          createdAt: now,
        },
        {
          tool: 'Expired2',
          level: 'deny',
          expiry: new Date(now.getTime() - 60000), // 1 minute ago
          createdAt: now,
        },
        {
          tool: 'JustExpired',
          level: 'allow-once',
          expiry: new Date(now.getTime() - 1), // 1ms ago
          createdAt: now,
        },
      ];

      // Save all test permissions
      for (const permission of permissionsToTest) {
        await store.savePermission(permission);
      }

      // Clear expired permissions
      const clearedCount = await store.clearExpired();

      expect(clearedCount).toBe(3); // Three expired permissions

      // Verify only non-expired permissions remain
      const remaining = await store.listPermissions({ includeExpired: true });
      expect(remaining).toHaveLength(2);
      expect(remaining.map(p => p.tool)).toEqual(
        expect.arrayContaining(['NotExpired1', 'NotExpired2'])
      );
    });
  });
});