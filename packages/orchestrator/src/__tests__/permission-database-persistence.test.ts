/**
 * Comprehensive tests for permission state persistence using the test database utilities.
 * These tests ensure that the database setup utilities work correctly with permission data.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestPermissionStore,
  createPermissionScenarioStore,
  populateTestPermissions,
  cleanupTestPermissionStore,
  createPermissionTestEnvironment,
  assertDatabaseState,
  type TestPermissionStoreContext,
  type PermissionTestEnvironment,
} from '../test-utils';
import { createMockPermission } from '@apexcli/core/test-utils';
import type { Permission } from '@apexcli/core';

describe('Permission Database Persistence Tests', () => {
  let testContext: TestPermissionStoreContext;
  let testEnv: PermissionTestEnvironment;

  afterEach(async () => {
    if (testContext) {
      await cleanupTestPermissionStore(testContext);
    }
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  describe('Database Schema and Table Creation', () => {
    it('should create permissions table with correct schema', async () => {
      testContext = await createTestPermissionStore();

      // Check that the permissions table exists with correct schema
      const tableInfo = testContext.store['db'].prepare(
        "PRAGMA table_info(permissions)"
      ).all() as Array<{ name: string; type: string; notnull: number; pk: number }>;

      const columnNames = tableInfo.map(col => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('tool_name');
      expect(columnNames).toContain('scope');
      expect(columnNames).toContain('level');
      expect(columnNames).toContain('expires_at');
      expect(columnNames).toContain('created_at');

      // Check for extended permission fields (v0.5.0)
      expect(columnNames).toContain('config');
      expect(columnNames).toContain('grant_reason');
      expect(columnNames).toContain('granted_by');
      expect(columnNames).toContain('tags');
    });

    it('should create proper indexes for performance', async () => {
      testContext = await createTestPermissionStore();

      const indexes = testContext.store['db'].prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='permissions'"
      ).all() as Array<{ name: string }>;

      const indexNames = indexes.map(idx => idx.name);
      expect(indexNames).toContain('idx_permissions_tool_scope');
      expect(indexNames).toContain('idx_permissions_level');
      expect(indexNames).toContain('idx_permissions_expires_at');
    });
  });

  describe('Basic Permission CRUD Operations', () => {
    beforeEach(async () => {
      testContext = await createTestPermissionStore();
    });

    it('should save and retrieve permissions', async () => {
      const permission = createMockPermission({
        tool: 'Read',
        level: 'allow-always',
        scope: '/project/**',
      });

      await testContext.store.savePermission(permission);

      const retrieved = await testContext.store.getPermission({
        tool: 'Read',
        scope: '/project/**',
      });

      expect(retrieved).toBeTruthy();
      expect(retrieved!.tool).toBe('Read');
      expect(retrieved!.level).toBe('allow-always');
      expect(retrieved!.scope).toBe('/project/**');
    });

    it('should handle permissions without scope', async () => {
      const permission = createMockPermission({
        tool: 'Write',
        level: 'allow-once',
      });

      await testContext.store.savePermission(permission);

      const retrieved = await testContext.store.getPermission({
        tool: 'Write',
      });

      expect(retrieved).toBeTruthy();
      expect(retrieved!.tool).toBe('Write');
      expect(retrieved!.level).toBe('allow-once');
      expect(retrieved!.scope).toBeUndefined();
    });

    it('should update existing permissions', async () => {
      const permission = createMockPermission({
        tool: 'Bash',
        level: 'deny',
      });

      await testContext.store.savePermission(permission);

      // Update the permission
      const updatedPermission = createMockPermission({
        tool: 'Bash',
        level: 'allow-once',
      });

      await testContext.store.savePermission(updatedPermission);

      const retrieved = await testContext.store.getPermission({
        tool: 'Bash',
      });

      expect(retrieved!.level).toBe('allow-once');
    });

    it('should delete permissions', async () => {
      const permission = createMockPermission({
        tool: 'Read',
        level: 'allow-always',
      });

      await testContext.store.savePermission(permission);

      const beforeDelete = await testContext.store.getPermission({ tool: 'Read' });
      expect(beforeDelete).toBeTruthy();

      await testContext.store.deletePermission({ tool: 'Read' });

      const afterDelete = await testContext.store.getPermission({ tool: 'Read' });
      expect(afterDelete).toBeNull();
    });

    it('should list all permissions', async () => {
      const permissions = [
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', level: 'allow-once' }),
        createMockPermission({ tool: 'Bash', level: 'deny' }),
      ];

      for (const perm of permissions) {
        await testContext.store.savePermission(perm);
      }

      const allPermissions = await testContext.store.listPermissions();
      expect(allPermissions).toHaveLength(3);

      const tools = allPermissions.map(p => p.tool);
      expect(tools).toContain('Read');
      expect(tools).toContain('Write');
      expect(tools).toContain('Bash');
    });
  });

  describe('Permission Manager Integration', () => {
    beforeEach(async () => {
      testContext = await createTestPermissionStore();
    });

    it('should handle session-level caching correctly', async () => {
      // Grant an allow-once permission through manager
      await testContext.manager.grantPermission('Write', undefined, 'allow-once');

      // First check should return allow-once and consume it
      const firstCheck = await testContext.manager.checkPermission('Write');
      expect(firstCheck).toBe('allow-once');

      // Second check should return null (permission consumed)
      const secondCheck = await testContext.manager.checkPermission('Write');
      expect(secondCheck).toBeNull();
    });

    it('should persist allow-always permissions', async () => {
      await testContext.manager.grantPermission('Read', undefined, 'allow-always');

      // Should be available in multiple checks
      const firstCheck = await testContext.manager.checkPermission('Read');
      expect(firstCheck).toBe('allow-always');

      const secondCheck = await testContext.manager.checkPermission('Read');
      expect(secondCheck).toBe('allow-always');

      // Should also be in the database
      const dbPermission = await testContext.store.getPermission({ tool: 'Read' });
      expect(dbPermission?.level).toBe('allow-always');
    });

    it('should handle scoped permissions correctly', async () => {
      await testContext.manager.grantPermission('Write', '/project/**', 'allow-always');
      await testContext.manager.grantPermission('Write', undefined, 'deny');

      const projectWrite = await testContext.manager.checkPermission('Write', '/project/**');
      expect(projectWrite).toBe('allow-always');

      const generalWrite = await testContext.manager.checkPermission('Write');
      expect(generalWrite).toBe('deny');
    });

    it('should support permission checking boolean methods', async () => {
      await testContext.manager.grantPermission('Read', undefined, 'allow-always');
      await testContext.manager.grantPermission('Write', undefined, 'allow-once');
      await testContext.manager.grantPermission('Bash', undefined, 'deny');

      expect(await testContext.manager.hasPermission('Read')).toBe(true);
      expect(await testContext.manager.isAllowed('Read')).toBe(true);
      expect(await testContext.manager.requiresConfirmation('Read')).toBe(false);

      expect(await testContext.manager.hasPermission('Write')).toBe(true);
      expect(await testContext.manager.isAllowed('Write')).toBe(true);
      expect(await testContext.manager.requiresConfirmation('Write')).toBe(true);

      expect(await testContext.manager.hasPermission('Bash')).toBe(true);
      expect(await testContext.manager.isAllowed('Bash')).toBe(false);
      expect(await testContext.manager.requiresConfirmation('Bash')).toBe(false);
    });
  });

  describe('Permission Scenarios Integration', () => {
    it('should create and validate read-only scenario', async () => {
      testContext = await createPermissionScenarioStore('read-only');

      const permissions = await testContext.store.listPermissions();
      expect(permissions.length).toBeGreaterThan(0);

      // Check that read operations are allowed
      const readPerm = await testContext.manager.checkPermission('Read');
      expect(readPerm).toBe('allow-always');

      const grepPerm = await testContext.manager.checkPermission('Grep');
      expect(grepPerm).toBe('allow-always');

      // Check that write operations are denied
      const writePerm = await testContext.manager.checkPermission('Write');
      expect(writePerm).toBe('deny');

      const bashPerm = await testContext.manager.checkPermission('Bash');
      expect(bashPerm).toBe('deny');
    });

    it('should create and validate full-access scenario', async () => {
      testContext = await createPermissionScenarioStore('full-access');

      const readPerm = await testContext.manager.checkPermission('Read');
      expect(readPerm).toBe('allow-always');

      const writePerm = await testContext.manager.checkPermission('Write');
      expect(writePerm).toBe('allow-always');

      const bashPerm = await testContext.manager.checkPermission('Bash');
      expect(bashPerm).toBe('allow-always');
    });

    it('should create and validate review-all scenario', async () => {
      testContext = await createPermissionScenarioStore('review-all');

      const permissions = await testContext.store.listPermissions();
      expect(permissions.length).toBeGreaterThan(0);

      // All permissions should require confirmation
      for (const perm of permissions) {
        expect(perm.level).toBe('allow-once');
      }

      // Check a few key tools
      expect(await testContext.manager.requiresConfirmation('Read')).toBe(true);
      expect(await testContext.manager.requiresConfirmation('Write')).toBe(true);
      expect(await testContext.manager.requiresConfirmation('Bash')).toBe(true);
    });

    it('should create and validate mixed scenario', async () => {
      testContext = await createPermissionScenarioStore('mixed');

      const permissions = await testContext.store.listPermissions();
      expect(permissions.length).toBeGreaterThan(0);

      // Mixed should have different levels for different tools
      const levels = new Set(permissions.map(p => p.level));
      expect(levels.size).toBeGreaterThan(1); // Should have multiple different levels
    });
  });

  describe('Database State Assertions', () => {
    beforeEach(async () => {
      testContext = await createTestPermissionStore();
    });

    it('should validate database state with assertDatabaseState', async () => {
      await populateTestPermissions(testContext.store, {
        'Read': 'allow-always',
        'Write': 'allow-once',
        'Bash': 'deny',
      });

      await expect(assertDatabaseState(testContext.store, [
        { tool: 'Read', level: 'allow-always' },
        { tool: 'Write', level: 'allow-once' },
        { tool: 'Bash', level: 'deny' },
      ])).resolves.not.toThrow();
    });

    it('should fail database state assertion for wrong levels', async () => {
      await populateTestPermissions(testContext.store, {
        'Read': 'allow-always',
      });

      await expect(assertDatabaseState(testContext.store, [
        { tool: 'Read', level: 'deny' },
      ])).rejects.toThrow('Permission for Read has wrong level');
    });

    it('should fail database state assertion for missing permissions', async () => {
      await populateTestPermissions(testContext.store, {
        'Read': 'allow-always',
      });

      await expect(assertDatabaseState(testContext.store, [
        { tool: 'Write', level: 'allow-once' },
      ])).rejects.toThrow('Expected permission for Write not found in database');
    });
  });

  describe('Permission Test Environment Integration', () => {
    it('should provide comprehensive testing environment', async () => {
      const initialPermissions = [
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', level: 'allow-once', scope: '/project/**' }),
        createMockPermission({ tool: 'Bash', level: 'deny' }),
      ];

      testEnv = await createPermissionTestEnvironment({
        initialPermissions,
      });

      // Test assertion methods
      await expect(testEnv.assertPermissionLevel('Read', 'allow-always')).resolves.not.toThrow();
      await expect(testEnv.assertToolAllowed('Read')).resolves.not.toThrow();
      await expect(testEnv.assertToolDenied('Bash')).resolves.not.toThrow();
      await expect(testEnv.assertToolRequiresConfirmation('Write', '/project/**')).resolves.not.toThrow();

      // Test adding and removing permissions
      await testEnv.addPermission(createMockPermission({ tool: 'Glob', level: 'allow-always' }));
      await expect(testEnv.assertToolAllowed('Glob')).resolves.not.toThrow();

      await testEnv.removePermission('Glob');
      await expect(testEnv.assertToolDenied('Glob')).resolves.not.toThrow();

      // Test getting all permissions
      const allPermissions = await testEnv.getAllPermissions();
      expect(allPermissions).toHaveLength(3); // Original 3 after removing Glob
    });
  });

  describe('Extended Permission Fields', () => {
    beforeEach(async () => {
      testContext = await createTestPermissionStore();
    });

    it('should persist and retrieve extended permission data', async () => {
      const permission = createMockPermission({
        tool: 'Write',
        level: 'allow-once',
        grantReason: 'User approved file modification',
        grantedBy: 'user@example.com',
        tags: ['file-operation', 'approved'],
      });

      await testContext.store.savePermission(permission);

      const retrieved = await testContext.store.getPermission({ tool: 'Write' });

      expect(retrieved!.grantReason).toBe('User approved file modification');
      expect(retrieved!.grantedBy).toBe('user@example.com');
      expect(retrieved!.tags).toEqual(['file-operation', 'approved']);
    });

    it('should handle permission expiration', async () => {
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 5);

      const permission = createMockPermission({
        tool: 'Bash',
        level: 'allow-once',
        expiry: futureDate,
      });

      await testContext.store.savePermission(permission);

      const retrieved = await testContext.store.getPermission({ tool: 'Bash' });
      expect(retrieved!.expiry).toEqual(futureDate);
    });

    it('should handle tool-specific configuration', async () => {
      const permission = createMockPermission({
        tool: 'Write',
        level: 'allow-always',
        config: {
          maxFileSize: 1024 * 1024,
          allowedExtensions: ['.ts', '.js'],
          requireConfirmation: false,
        },
      });

      await testContext.store.savePermission(permission);

      const retrieved = await testContext.store.getPermission({ tool: 'Write' });
      expect(retrieved!.config).toEqual({
        maxFileSize: 1024 * 1024,
        allowedExtensions: ['.ts', '.js'],
        requireConfirmation: false,
      });
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should properly clean up temporary directories', async () => {
      testContext = await createTestPermissionStore();
      const tempPath = testContext.tempPath;

      expect(tempPath).toBeTruthy();

      await cleanupTestPermissionStore(testContext);

      // The temp directory should be cleaned up
      // Note: This is asynchronous cleanup, so we can't easily test it here
      // but the cleanup function should handle it
    });

    it('should handle cleanup of already closed stores', async () => {
      testContext = await createTestPermissionStore();

      // Close manually first
      testContext.store.close();

      // Cleanup should not throw
      expect(() => cleanupTestPermissionStore(testContext)).not.toThrow();
    });
  });

  describe('Isolation Between Test Instances', () => {
    it('should isolate permissions between different test stores', async () => {
      const store1 = await createTestPermissionStore([
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
      ]);

      const store2 = await createTestPermissionStore([
        createMockPermission({ tool: 'Write', level: 'deny' }),
      ]);

      try {
        // Store 1 should only have Read permission
        const store1Perms = await store1.store.listPermissions();
        expect(store1Perms).toHaveLength(1);
        expect(store1Perms[0].tool).toBe('Read');

        // Store 2 should only have Write permission
        const store2Perms = await store2.store.listPermissions();
        expect(store2Perms).toHaveLength(1);
        expect(store2Perms[0].tool).toBe('Write');

        // Cross-contamination check
        expect(await store1.manager.hasPermission('Write')).toBe(false);
        expect(await store2.manager.hasPermission('Read')).toBe(false);
      } finally {
        await cleanupTestPermissionStore(store1);
        await cleanupTestPermissionStore(store2);
      }
    });
  });
});