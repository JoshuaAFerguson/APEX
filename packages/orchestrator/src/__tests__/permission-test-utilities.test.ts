/**
 * Tests for the permission database test utilities in orchestrator package
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestPermissionStore,
  createPermissionScenarioStore,
  populateTestPermissions,
  createMockPermissionManager,
  cleanupTestPermissionStore,
  type TestPermissionStoreContext,
} from '../test-utils';
import { createMockPermission } from '@apexcli/core/test-utils';

describe('Permission Database Test Utilities', () => {
  let testContext: TestPermissionStoreContext;

  afterEach(async () => {
    if (testContext) {
      await cleanupTestPermissionStore(testContext);
    }
  });

  describe('createTestPermissionStore', () => {
    it('should create store and manager with empty permissions', async () => {
      testContext = await createTestPermissionStore();

      expect(testContext.store).toBeDefined();
      expect(testContext.manager).toBeDefined();
      expect(testContext.tempPath).toBeDefined();
      expect(testContext.cleanup).toBeDefined();

      const permissions = await testContext.store.listPermissions();
      expect(permissions).toEqual([]);
    });

    it('should create store with initial permissions', async () => {
      const initialPerms = [
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', level: 'allow-once' }),
      ];

      testContext = await createTestPermissionStore(initialPerms);

      const permissions = await testContext.store.listPermissions();
      expect(permissions).toHaveLength(2);

      const readPerm = permissions.find(p => p.tool === 'Read');
      expect(readPerm?.level).toBe('allow-always');

      const writePerm = permissions.find(p => p.tool === 'Write');
      expect(writePerm?.level).toBe('allow-once');
    });
  });

  describe('createPermissionScenarioStore', () => {
    it('should create read-only scenario store', async () => {
      testContext = await createPermissionScenarioStore('read-only');

      const permissions = await testContext.store.listPermissions();
      expect(permissions.length).toBeGreaterThan(0);

      const readPerm = permissions.find(p => p.tool === 'Read');
      expect(readPerm?.level).toBe('allow-always');

      const writePerm = permissions.find(p => p.tool === 'Write');
      expect(writePerm?.level).toBe('deny');
    });

    it('should create full-access scenario store', async () => {
      testContext = await createPermissionScenarioStore('full-access');

      const permissions = await testContext.store.listPermissions();
      expect(permissions.length).toBeGreaterThan(0);

      const bashPerm = permissions.find(p => p.tool === 'Bash');
      expect(bashPerm?.level).toBe('allow-always');
    });

    it('should create review-all scenario store', async () => {
      testContext = await createPermissionScenarioStore('review-all');

      const permissions = await testContext.store.listPermissions();
      expect(permissions.length).toBeGreaterThan(0);

      const allPermissions = permissions.every(p => p.level === 'allow-once');
      expect(allPermissions).toBe(true);
    });
  });

  describe('populateTestPermissions', () => {
    beforeEach(async () => {
      testContext = await createTestPermissionStore();
    });

    it('should populate store with tool permissions', async () => {
      await populateTestPermissions(testContext.store, {
        'Read': 'allow-always',
        'Write': 'allow-once',
        'Bash': 'deny',
      });

      const permissions = await testContext.store.listPermissions();
      expect(permissions).toHaveLength(3);

      const readPerm = await testContext.store.getPermission({ tool: 'Read' });
      expect(readPerm?.level).toBe('allow-always');

      const writePerm = await testContext.store.getPermission({ tool: 'Write' });
      expect(writePerm?.level).toBe('allow-once');

      const bashPerm = await testContext.store.getPermission({ tool: 'Bash' });
      expect(bashPerm?.level).toBe('deny');
    });
  });

  describe('createMockPermissionManager', () => {
    it('should create manager with no permissions', async () => {
      const mockManager = createMockPermissionManager();

      const result = await mockManager.checkPermission('Read');
      expect(result).toBeNull();

      const hasPermission = await mockManager.hasPermission('Read');
      expect(hasPermission).toBe(false);
    });

    it('should create manager with predefined permissions', async () => {
      const mockManager = createMockPermissionManager({
        'Read': 'allow-always',
        'Write': 'allow-once',
        'Bash': 'deny',
      });

      const readLevel = await mockManager.checkPermission('Read');
      expect(readLevel).toBe('allow-always');

      const writeLevel = await mockManager.checkPermission('Write');
      expect(writeLevel).toBe('allow-once');

      const bashLevel = await mockManager.checkPermission('Bash');
      expect(bashLevel).toBe('deny');
    });

    it('should handle scoped permissions', async () => {
      const mockManager = createMockPermissionManager({
        'Write:/project/**': 'allow-always',
        'Write': 'deny',
      });

      const projectWriteLevel = await mockManager.checkPermission('Write', '/project/**');
      expect(projectWriteLevel).toBe('allow-always');

      const generalWriteLevel = await mockManager.checkPermission('Write');
      expect(generalWriteLevel).toBe('deny');
    });

    it('should support permission management methods', async () => {
      const mockManager = createMockPermissionManager();

      await mockManager.grantPermission('Read', 'allow-always');
      const readLevel = await mockManager.checkPermission('Read');
      expect(readLevel).toBe('allow-always');

      const isAllowed = await mockManager.isAllowed('Read');
      expect(isAllowed).toBe(true);

      const requiresConfirm = await mockManager.requiresConfirmation('Read');
      expect(requiresConfirm).toBe(false);
    });

    it('should check confirmation requirements correctly', async () => {
      const mockManager = createMockPermissionManager({
        'Write': 'allow-once',
      });

      const requiresConfirm = await mockManager.requiresConfirmation('Write');
      expect(requiresConfirm).toBe(true);

      const isAllowed = await mockManager.isAllowed('Write');
      expect(isAllowed).toBe(true);
    });

    it('should provide access to internal permissions for testing', async () => {
      const mockManager = createMockPermissionManager({
        'Read': 'allow-always',
        'Write': 'deny',
      });

      const internalPerms = mockManager._getPermissions();
      expect(internalPerms).toEqual({
        'Read': 'allow-always',
        'Write': 'deny',
      });
    });
  });
});