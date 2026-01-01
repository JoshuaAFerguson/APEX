import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { TaskStore } from '../store';
import { PermissionStore } from '../permission-store';
import { Permission, PermissionLevel } from '@apexcli/core';

describe('PermissionStore Migration Integration', () => {
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = join(tmpdir(), `apex-permission-migration-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    // Initialize TaskStore first to create database and run migrations
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    // Then initialize PermissionStore using the same database
    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();
  });

  afterEach(() => {
    // Clean up
    if (taskStore) {
      taskStore.close();
    }
    if (permissionStore) {
      permissionStore.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create permissions table via TaskStore migration and work with PermissionStore', async () => {
    // Verify we can save a permission using PermissionStore
    const permission: Permission = {
      tool: 'Read',
      scope: '/test/path',
      level: 'allow-always',
      createdAt: new Date(),
    };

    await permissionStore.savePermission(permission);

    // Verify we can retrieve it
    const retrieved = await permissionStore.getPermission({
      tool: 'Read',
      scope: '/test/path',
    });

    expect(retrieved).toMatchObject({
      tool: 'Read',
      scope: '/test/path',
      level: 'allow-always',
    });
    expect(retrieved?.createdAt).toBeInstanceOf(Date);
  });

  it('should handle permissions table schema correctly with all required columns', async () => {
    // Test basic permission (legacy schema columns)
    const basicPermission: Permission = {
      tool: 'Write',
      level: 'allow-once',
      createdAt: new Date(),
    };

    await permissionStore.savePermission(basicPermission);

    // Test permission with expiry
    const expiringPermission: Permission = {
      tool: 'Bash',
      scope: 'git status',
      level: 'allow-always',
      expiry: new Date(Date.now() + 3600000), // 1 hour from now
      createdAt: new Date(),
    };

    await permissionStore.savePermission(expiringPermission);

    // List all permissions to verify both were saved
    const allPermissions = await permissionStore.listPermissions({ includeExpired: true });

    expect(allPermissions).toHaveLength(2);
    expect(allPermissions.find(p => p.tool === 'Write')).toBeDefined();
    expect(allPermissions.find(p => p.tool === 'Bash')).toBeDefined();
  });

  it('should handle clearExpired functionality correctly', async () => {
    // Create an already expired permission
    const expiredPermission: Permission = {
      tool: 'ExpiredTool',
      level: 'allow-once',
      expiry: new Date(Date.now() - 1000), // 1 second ago
      createdAt: new Date(Date.now() - 2000),
    };

    // Create a non-expired permission
    const validPermission: Permission = {
      tool: 'ValidTool',
      level: 'allow-always',
      createdAt: new Date(),
    };

    await permissionStore.savePermission(expiredPermission);
    await permissionStore.savePermission(validPermission);

    // Clear expired permissions
    const clearedCount = await permissionStore.clearExpired();
    expect(clearedCount).toBe(1);

    // Verify only valid permission remains
    const remainingPermissions = await permissionStore.listPermissions();
    expect(remainingPermissions).toHaveLength(1);
    expect(remainingPermissions[0].tool).toBe('ValidTool');
  });

  it('should handle clearPermissions functionality correctly', async () => {
    // Add multiple permissions
    const permissions: Permission[] = [
      {
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
      },
      {
        tool: 'Write',
        scope: '/tmp/test',
        level: 'allow-once',
        createdAt: new Date(),
      },
      {
        tool: 'Bash',
        level: 'deny',
        createdAt: new Date(),
      },
    ];

    for (const permission of permissions) {
      await permissionStore.savePermission(permission);
    }

    // Verify permissions were saved
    const beforeClear = await permissionStore.listPermissions();
    expect(beforeClear).toHaveLength(3);

    // Clear all permissions
    await permissionStore.clearPermissions();

    // Verify all permissions were cleared
    const afterClear = await permissionStore.listPermissions();
    expect(afterClear).toHaveLength(0);
  });
});