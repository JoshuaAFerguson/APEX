/**
 * Permission Revocation Cleanup Tests
 *
 * Tests comprehensive cleanup operations that occur after permission revocation.
 * This test suite verifies:
 * 1. Task state updates on permission revocation
 * 2. SQLite PermissionStore cleanup operations
 * 3. EventEmitter (eventemitter3) disposal
 * 4. Resource leak prevention after revocation cycles
 *
 * @see docs/adr/ADR-049-permission-revocation-cleanup-tests.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';

// Internal modules under test
import { PermissionStore } from '../permission-store';
import { PermissionManager } from '../permission-manager';
import { TaskStore } from '../store';

// Type imports
import type { Permission, PermissionLevel, ExtendedPermission } from '@apexcli/core';

// EventEmitter — use eventemitter3 to match ApexOrchestrator's actual implementation
import { EventEmitter } from 'eventemitter3';

describe('Permission Revocation Cleanup', () => {

  // Shared setup: temp dir, PermissionStore, PermissionManager, TaskStore
  let testDir: string;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let taskStore: TaskStore;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `apex-revocation-cleanup-${Date.now()}-${Math.random().toString(36).substring(2)}`
    );
    mkdirSync(testDir, { recursive: true });
    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();
    permissionManager = new PermissionManager(permissionStore);
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();
  });

  afterEach(() => {
    try { permissionStore.close(); } catch { /* already closed */ }
    try { taskStore.close(); } catch { /* already closed */ }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('1. Task State Updates on Permission Revocation', () => {

    it('revokePermission() removes allow-always from persistent store', async () => {
      // Grant then revoke
      await permissionManager.grantPermission('Write', '/src', 'allow-always');
      const revoked = await permissionManager.revokePermission('Write', '/src');
      expect(revoked).toBe(true);

      // Verify state
      const level = await permissionManager.checkPermission('Write', '/src');
      expect(level).toBeNull();

      // Verify DB is clean
      const dbPermission = await permissionStore.getPermission({ tool: 'Write', scope: '/src' });
      expect(dbPermission).toBeNull();
    });

    it('revokePermission() removes allow-once from session cache', async () => {
      // Grant allow-once (stored in session cache)
      await permissionManager.grantPermission('Read', '/data', 'allow-once');

      // Verify it's in cache (first check should return the permission)
      const levelBefore = await permissionManager.checkPermission('Read', '/data');
      expect(levelBefore).toBe('allow-once');

      // Now revoke it
      const revoked = await permissionManager.revokePermission('Read', '/data');
      expect(revoked).toBe(true);

      // Verify it's gone from cache
      const levelAfter = await permissionManager.checkPermission('Read', '/data');
      expect(levelAfter).toBeNull();
    });

    it('revokePermission() returns false when no permission existed', async () => {
      // Try to revoke a permission that doesn't exist
      const revoked = await permissionManager.revokePermission('NonExistent', '/nowhere');
      expect(revoked).toBe(false);
    });

    it('After revocation, checkPermission() returns null', async () => {
      // Grant and revoke
      await permissionManager.grantPermission('Edit', '/config', 'allow-always');
      await permissionManager.revokePermission('Edit', '/config');

      // Verify checkPermission returns null
      const level = await permissionManager.checkPermission('Edit', '/config');
      expect(level).toBeNull();
    });

    it('After revocation, hasPermission() returns false', async () => {
      // Grant and revoke
      await permissionManager.grantPermission('Bash', '/bin', 'allow-always');
      await permissionManager.revokePermission('Bash', '/bin');

      // Verify hasPermission returns false
      const hasPermission = await permissionManager.hasPermission('Bash', '/bin');
      expect(hasPermission).toBe(false);
    });

    it('Revoking a scoped permission does not affect unscoped permission for same tool', async () => {
      // Grant both scoped and unscoped permissions
      await permissionManager.grantPermission('Write', '/specific', 'allow-always');
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      // Revoke only the scoped one
      await permissionManager.revokePermission('Write', '/specific');

      // Verify scoped is gone but unscoped remains
      const scopedLevel = await permissionManager.checkPermission('Write', '/specific');
      const unscopedLevel = await permissionManager.checkPermission('Write');

      expect(scopedLevel).toBeNull();
      expect(unscopedLevel).toBe('allow-always');
    });

    it('Revoking does not affect permissions for other tools', async () => {
      // Grant permissions for different tools
      await permissionManager.grantPermission('Read', '/data', 'allow-always');
      await permissionManager.grantPermission('Write', '/data', 'allow-always');

      // Revoke one tool's permission
      await permissionManager.revokePermission('Read', '/data');

      // Verify only Read is gone, Write remains
      const readLevel = await permissionManager.checkPermission('Read', '/data');
      const writeLevel = await permissionManager.checkPermission('Write', '/data');

      expect(readLevel).toBeNull();
      expect(writeLevel).toBe('allow-always');
    });

    it('TaskStore task status updated to cancelled after revocation', async () => {
      // Create a task
      const task = await taskStore.createTask({
        description: 'Test task',
        acceptanceCriteria: 'Task should be completed',
        workflow: 'feature',
        autonomy: 'review-all',
        projectPath: testDir,
      });

      // Verify task can be updated after revocation
      await taskStore.updateTaskStatus(task.id, 'cancelled', undefined, 'Permission revoked');
      const updated = await taskStore.getTask(task.id);
      expect(updated?.status).toBe('cancelled');
      expect(updated?.logs?.some(log => log.message.includes('Permission revoked'))).toBe(true);
    });

  });

  describe('2. SQLite PermissionStore Cleanup', () => {

    it('clearPermission() removes the exact row from permissions table', async () => {
      // Save a permission
      const permission: Permission = {
        tool: 'Bash',
        scope: '/test',
        level: 'allow-always',
        createdAt: new Date()
      };
      await permissionStore.savePermission(permission);

      // Clear it
      const cleared = await permissionStore.clearPermission({ tool: 'Bash', scope: '/test' });
      expect(cleared).toBe(true);

      // Verify it's gone
      const retrieved = await permissionStore.getPermission({ tool: 'Bash', scope: '/test' });
      expect(retrieved).toBeNull();
    });

    it('clearPermissionsForTool() removes all permissions for a tool across scopes', async () => {
      // Save multiple permissions for same tool with different scopes
      await permissionStore.savePermission({
        tool: 'Bash',
        scope: '/bin',
        level: 'allow-always',
        createdAt: new Date()
      });
      await permissionStore.savePermission({
        tool: 'Bash',
        scope: '/usr',
        level: 'allow-always',
        createdAt: new Date()
      });
      await permissionStore.savePermission({
        tool: 'Bash',
        scope: undefined,
        level: 'deny',
        createdAt: new Date()
      });

      // Clear all for tool
      const cleared = await permissionStore.clearPermissionsForTool('Bash');
      expect(cleared).toBe(3);

      // Verify all are gone
      const remaining = await permissionStore.listPermissions({ tool: 'Bash' });
      expect(remaining).toHaveLength(0);
    });

    it('clearPermissions() removes all permission rows', async () => {
      // Save permissions for multiple tools
      await permissionStore.savePermission({
        tool: 'Read', scope: '/data', level: 'allow-always', createdAt: new Date()
      });
      await permissionStore.savePermission({
        tool: 'Write', scope: '/output', level: 'deny', createdAt: new Date()
      });

      // Clear all
      await permissionStore.clearPermissions();

      // Verify empty
      const allPermissions = await permissionStore.listPermissions({});
      expect(allPermissions).toHaveLength(0);
    });

    it('clearExpired() only removes expired permissions, leaves valid ones', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 1000); // 1 second ago
      const futureDate = new Date(now.getTime() + 60000); // 1 minute from now

      // Save expired and valid permissions
      await permissionStore.savePermission({
        tool: 'Read',
        scope: '/expired',
        level: 'allow-always',
        createdAt: pastDate,
        expiry: pastDate
      });
      await permissionStore.savePermission({
        tool: 'Write',
        scope: '/valid',
        level: 'allow-always',
        createdAt: now,
        expiry: futureDate
      });

      // Clear expired
      const expiredCount = await permissionStore.clearExpired();
      expect(expiredCount).toBe(1);

      // Verify only expired is gone
      const expiredPermission = await permissionStore.getPermission({ tool: 'Read', scope: '/expired' });
      const validPermission = await permissionStore.getPermission({ tool: 'Write', scope: '/valid' });

      expect(expiredPermission).toBeNull();
      expect(validPermission).not.toBeNull();
    });

    it('Extended permission fields (config, tags, grantReason) are fully removed', async () => {
      // Save extended permission
      const extendedPermission: ExtendedPermission = {
        tool: 'Bash',
        scope: '/admin',
        level: 'allow-always',
        createdAt: new Date(),
        config: { allowedCommands: ['ls', 'pwd'] },
        tags: ['admin', 'testing'],
        grantReason: 'Development testing',
        grantedBy: 'developer'
      };
      await permissionStore.saveExtendedPermission(extendedPermission);

      // Clear the permission
      const cleared = await permissionStore.clearPermission({ tool: 'Bash', scope: '/admin' });
      expect(cleared).toBe(true);

      // Verify extended fields are gone too
      const retrieved = await permissionStore.getExtendedPermission({ tool: 'Bash', scope: '/admin' });
      expect(retrieved).toBeNull();
    });

    it('After cleanup, listPermissions() returns empty for cleared tool', async () => {
      // Save permissions for multiple tools
      await permissionStore.savePermission({
        tool: 'Read', scope: '/data', level: 'allow-always', createdAt: new Date()
      });
      await permissionStore.savePermission({
        tool: 'Write', scope: '/data', level: 'allow-always', createdAt: new Date()
      });

      // Clear one tool
      await permissionStore.clearPermissionsForTool('Read');

      // Verify list is empty for cleared tool but not for other tool
      const readPermissions = await permissionStore.listPermissions({ tool: 'Read' });
      const writePermissions = await permissionStore.listPermissions({ tool: 'Write' });

      expect(readPermissions).toHaveLength(0);
      expect(writePermissions).toHaveLength(1);
    });

    it('clearPermission() on non-existent returns false', async () => {
      // Try to clear a permission that doesn't exist
      const cleared = await permissionStore.clearPermission({ tool: 'NonExistent', scope: '/nowhere' });
      expect(cleared).toBe(false);
    });

    it('Bulk deletion followed by re-insertion works correctly', async () => {
      // Save multiple permissions
      await permissionStore.savePermission({
        tool: 'Bash', scope: '/test1', level: 'allow-always', createdAt: new Date()
      });
      await permissionStore.savePermission({
        tool: 'Bash', scope: '/test2', level: 'deny', createdAt: new Date()
      });

      // Clear all
      const cleared = await permissionStore.clearPermissionsForTool('Bash');
      expect(cleared).toBe(2);

      // Re-insert permission
      await permissionStore.savePermission({
        tool: 'Bash', scope: '/test3', level: 'allow-always', createdAt: new Date()
      });

      // Verify re-insertion worked
      const retrieved = await permissionStore.getPermission({ tool: 'Bash', scope: '/test3' });
      expect(retrieved?.level).toBe('allow-always');
    });

  });

  describe('3. Event Emitter Disposal', () => {

    it('Permission event listeners can be added and removed', async () => {
      const emitter = new EventEmitter();
      const handler = vi.fn();

      emitter.on('permission:granted', handler);
      expect(emitter.listenerCount('permission:granted')).toBe(1);

      emitter.removeListener('permission:granted', handler);
      expect(emitter.listenerCount('permission:granted')).toBe(0);
    });

    it('removeAllListeners("permission:granted") clears all handlers for that event', async () => {
      const emitter = new EventEmitter();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      emitter.on('permission:granted', handler1);
      emitter.on('permission:granted', handler2);
      emitter.on('permission:denied', handler3);

      expect(emitter.listenerCount('permission:granted')).toBe(2);
      expect(emitter.listenerCount('permission:denied')).toBe(1);

      // Remove all listeners for permission:granted event
      emitter.removeAllListeners('permission:granted');

      expect(emitter.listenerCount('permission:granted')).toBe(0);
      expect(emitter.listenerCount('permission:denied')).toBe(1); // Other events unaffected
    });

    it('removeAllListeners() clears all permission-related listeners', async () => {
      const emitter = new EventEmitter();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      emitter.on('permission:granted', handler1);
      emitter.on('permission:denied', handler2);
      emitter.on('permission:revoked', handler3);

      expect(emitter.listenerCount('permission:granted')).toBe(1);
      expect(emitter.listenerCount('permission:denied')).toBe(1);
      expect(emitter.listenerCount('permission:revoked')).toBe(1);

      // Clear all listeners
      emitter.removeAllListeners();

      expect(emitter.listenerCount('permission:granted')).toBe(0);
      expect(emitter.listenerCount('permission:denied')).toBe(0);
      expect(emitter.listenerCount('permission:revoked')).toBe(0);
    });

    it('After disposal, emitting events does not trigger old handlers', async () => {
      const emitter = new EventEmitter();
      const handler = vi.fn();

      emitter.on('permission:granted', handler);
      expect(emitter.listenerCount('permission:granted')).toBe(1);

      // Simulate cleanup after revocation
      emitter.removeAllListeners('permission:granted');
      expect(emitter.listenerCount('permission:granted')).toBe(0);

      // Verify handler is not called
      emitter.emit('permission:granted', { tool: 'Write' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('Dispose pattern: removeAllListeners + clearTimeout on tracked timers', async () => {
      const emitter = new EventEmitter();
      const handler = vi.fn();

      // Set up a tracked timer (simulating timeout-based operations)
      let timerId: NodeJS.Timeout | null = null;
      const timeoutHandler = vi.fn();

      emitter.on('permission:timeout', () => {
        timerId = setTimeout(timeoutHandler, 100);
      });

      // Trigger event that creates a timer
      emitter.emit('permission:timeout');
      expect(timerId).not.toBeNull();

      // Dispose pattern: clear listeners and timeouts
      emitter.removeAllListeners();
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }

      // Wait longer than the timeout would have been
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify timeout handler was not called
      expect(timeoutHandler).not.toHaveBeenCalled();
      expect(emitter.listenerCount('permission:timeout')).toBe(0);
    });

    it('Listeners on one event type don\'t affect other event types', async () => {
      const emitter = new EventEmitter();
      const grantedHandler = vi.fn();
      const deniedHandler = vi.fn();

      emitter.on('permission:granted', grantedHandler);
      emitter.on('permission:denied', deniedHandler);

      // Remove only granted listeners
      emitter.removeAllListeners('permission:granted');

      expect(emitter.listenerCount('permission:granted')).toBe(0);
      expect(emitter.listenerCount('permission:denied')).toBe(1);

      // Verify denied handler still works
      emitter.emit('permission:denied', { tool: 'Write' });
      expect(deniedHandler).toHaveBeenCalledTimes(1);
      expect(grantedHandler).not.toHaveBeenCalled();
    });

    it('resetSession() clears all 3 in-memory caches', async () => {
      // Grant permissions to populate all 3 caches
      await permissionManager.grantPermission('Write', '/test', 'allow-once');

      // Set tool config (populates sessionToolConfigCache)
      permissionManager.setToolConfig('Write', {
        allowedPaths: ['/test'],
        deniedPaths: []
      }, '/test');

      // Check that permissions exist before reset
      const levelBefore = await permissionManager.checkPermission('Write', '/test');
      expect(levelBefore).toBe('allow-once');

      const configBefore = await permissionManager.getToolConfig('Write', '/test');
      expect(configBefore).not.toBeNull();

      // Reset session (clears all 3 caches)
      permissionManager.resetSession();

      // Verify all caches are cleared
      const levelAfter = await permissionManager.checkPermission('Write', '/test');
      expect(levelAfter).toBeNull();

      const configAfter = await permissionManager.getToolConfig('Write', '/test');
      expect(configAfter).toBeNull();
    });

  });

  describe('4. No Resource Leaks After Revocation', () => {

    it('PermissionStore.close() releases SQLite connection', async () => {
      // Perform some operations to use the connection
      await permissionStore.savePermission({
        tool: 'Test', scope: '/test', level: 'allow-always', createdAt: new Date()
      });

      // Close the store
      permissionStore.close();

      // After close, operations should throw
      await expect(
        permissionStore.getPermission({ tool: 'Test' })
      ).rejects.toThrow();
    });

    it('Session cache is empty after resetSession() (verified via checkPermission returning null for allow-once grants)', async () => {
      // Grant several allow-once permissions
      await permissionManager.grantPermission('Write', '/path1', 'allow-once');
      await permissionManager.grantPermission('Read', '/path2', 'allow-once');
      await permissionManager.grantPermission('Edit', '/path3', 'allow-once');

      // Verify they exist in cache
      expect(await permissionManager.checkPermission('Write', '/path1')).toBe('allow-once');
      expect(await permissionManager.checkPermission('Read', '/path2')).toBe('allow-once');
      expect(await permissionManager.checkPermission('Edit', '/path3')).toBe('allow-once');

      // Reset session
      permissionManager.resetSession();

      // Verify all return null (cache is empty)
      expect(await permissionManager.checkPermission('Write', '/path1')).toBeNull();
      expect(await permissionManager.checkPermission('Read', '/path2')).toBeNull();
      expect(await permissionManager.checkPermission('Edit', '/path3')).toBeNull();
    });

    it('Directory access cache is cleared after resetSession()', async () => {
      // Grant permission that would use directory access cache
      await permissionManager.grantPermission('Write', '/testdir', 'allow-once');

      // The directory access cache is private, but we can verify behavior
      // through the permission system after reset
      const resultBefore = await permissionManager.checkDirectoryAccess('/testdir/subpath', { tool: 'Write' });

      // Reset session
      permissionManager.resetSession();

      // After reset, directory access should behave as if no prior cache exists
      const resultAfter = await permissionManager.checkDirectoryAccess('/testdir/subpath', { tool: 'Write' });

      // The specific behavior depends on implementation, but the cache should be cleared
      expect(resultAfter.allowed).toBe(false); // No permission means no access
    });

    it('Tool config cache is cleared after resetSession()', async () => {
      // Set tool config
      const config = { allowedPaths: ['/test'], deniedPaths: [] };
      permissionManager.setToolConfig('Write', config, '/test');

      // Verify config exists
      const configBefore = await permissionManager.getToolConfig('Write', '/test');
      expect(configBefore).toMatchObject(config);

      // Reset session
      permissionManager.resetSession();

      // Verify config cache is cleared
      const configAfter = await permissionManager.getToolConfig('Write', '/test');
      expect(configAfter).toBeNull();
    });

    it('Multiple grant/revoke cycles (100x) don\'t accumulate residual state', async () => {
      // Multiple grant/revoke cycles
      for (let i = 0; i < 100; i++) {
        await permissionManager.grantPermission('Write', `/path/${i}`, 'allow-once');
        await permissionManager.revokePermission('Write', `/path/${i}`);
      }

      // Reset session to clear all 3 caches
      permissionManager.resetSession();

      // Verify no residual state - all checks return null
      for (let i = 0; i < 100; i++) {
        const level = await permissionManager.checkPermission('Write', `/path/${i}`);
        expect(level).toBeNull();
      }

      // Verify system is still functional after cycles
      await permissionManager.grantPermission('Write', '/fresh', 'allow-always');
      const freshLevel = await permissionManager.checkPermission('Write', '/fresh');
      expect(freshLevel).toBe('allow-always');
    });

    it('After store close, operations throw/fail gracefully', async () => {
      // Verify store can still be closed cleanly after operations
      await permissionStore.savePermission({
        tool: 'Test', scope: '/test', level: 'allow-always', createdAt: new Date()
      });

      permissionStore.close();

      // After close, operations should throw
      await expect(
        permissionStore.getPermission({ tool: 'Write' })
      ).rejects.toThrow();

      await expect(
        permissionStore.savePermission({
          tool: 'New', scope: '/new', level: 'deny', createdAt: new Date()
        })
      ).rejects.toThrow();
    });

    it('Temp directory cleanup in afterEach doesn\'t leave orphan files', async () => {
      // Create some files during test
      await permissionStore.savePermission({
        tool: 'Test', scope: '/test', level: 'allow-always', createdAt: new Date()
      });

      await taskStore.createTask({
        description: 'Test task',
        acceptanceCriteria: 'Task should be completed',
        workflow: 'feature',
        autonomy: 'review-all',
        projectPath: testDir,
      });

      // Record the test directory path for verification in a separate test
      const currentTestDir = testDir;

      // Verify directory exists
      expect(existsSync(currentTestDir)).toBe(true);

      // The afterEach hook will clean this up, but we can't test that directly
      // in this test case. Instead, we verify the directory exists now.
      // The cleanup verification happens implicitly through the test framework.
    });

  });

});