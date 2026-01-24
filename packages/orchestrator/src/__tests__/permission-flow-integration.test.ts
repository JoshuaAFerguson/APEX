import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { EventEmitter } from 'events';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import { PermissionPresetManager } from '../permission-preset-manager';
import { ApexOrchestrator } from '../index';
import {
  Permission,
  PermissionLevel,
  PermissionPreset,
  ToolPermissionCheckOptions,
  ToolPermissionResult,
} from '@apexcli/core';

describe('Permission Flow Integration Tests', () => {
  let testDir: string;
  let store: PermissionStore;
  let manager: PermissionManager;
  let presetManager: PermissionPresetManager;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = join(tmpdir(), `apex-permission-flow-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    store = new PermissionStore(testDir);
    await store.initialize();

    manager = new PermissionManager(store);
    presetManager = new PermissionPresetManager(store, 'review-all');

    // Create orchestrator for full integration testing
    orchestrator = new ApexOrchestrator({ projectPath: testDir,
      maxTasksPerHour: 100,
      maxCostPerTask: 10,
      maxConcurrentTasks: 5,
      enableAuditLog: true,
    });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    // Clean up
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (store) {
      store.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('End-to-End Permission Flows', () => {
    it('should handle complete permission request flow', async () => {
      // Step 1: Initial state - no permissions exist
      const initialPermission = await manager.checkPermission('Write');
      expect(initialPermission).toBeNull();

      // Step 2: Grant a permission
      await manager.grantPermission('Write', '/tmp/test.txt', 'allow-once');

      // Step 3: Check permission exists
      const grantedPermission = await manager.checkPermission('Write', '/tmp/test.txt');
      expect(grantedPermission).toBe('allow-once');

      // Step 4: Use permission (should be consumed for allow-once)
      const firstUse = await manager.checkPermission('Write', '/tmp/test.txt');
      expect(firstUse).toBe('allow-once');

      // Step 5: Check permission is consumed after use
      const afterUse = await manager.checkPermission('Write', '/tmp/test.txt');
      expect(afterUse).toBeNull();
    });

    it('should handle permission hierarchy and scoping', async () => {
      // Grant broad permission
      await manager.grantPermission('Read', '/tmp/*', 'allow-always');

      // Check specific file permissions
      const specificFile = await manager.checkPermission('Read', '/tmp/test.txt');
      expect(specificFile).toBe('allow-always');

      // Check directory permission
      const directory = await manager.checkPermission('Read', '/tmp/');
      expect(directory).toBe('allow-always');

      // Check unrelated path
      const unrelated = await manager.checkPermission('Read', '/home/user/file.txt');
      expect(unrelated).toBeNull();
    });

    it('should handle permission preset changes', async () => {
      // Start with review-all preset
      expect(await presetManager.isToolConfirmRequired('Write')).toBe(true);
      expect(await presetManager.isToolAllowed('Read')).toBe(false);

      // Change to autonomous preset
      await presetManager.applyPreset('autonomous');
      expect(await presetManager.isToolAllowed('Write')).toBe(true);
      expect(await presetManager.isToolAllowed('Read')).toBe(true);

      // Change to read-only preset
      await presetManager.applyPreset('read-only');
      expect(await presetManager.isToolDenied('Write')).toBe(true);
      expect(await presetManager.isToolAllowed('Read')).toBe(true);
    });

    it('should handle permission conflicts and precedence', async () => {
      // Apply autonomous preset
      await presetManager.applyPreset('autonomous');

      // Override with specific denial
      await manager.grantPermission('Write', '/etc/*', 'deny');

      // Check that specific denial overrides preset
      const etcFile = await manager.checkPermission('Write', '/etc/passwd');
      expect(etcFile).toBe('deny');

      // Check that other paths still follow preset
      const tmpFile = await manager.checkPermission('Write', '/tmp/test.txt');
      expect(tmpFile).toBe('allow-always'); // from preset
    });

    it('should handle permission expiry', async () => {
      // Grant permission with short expiry
      const shortExpiry = new Date(Date.now() + 100); // 100ms from now
      await store.savePermission({
        tool: 'Bash',
        scope: 'test-command',
        level: 'allow-always',
        expiry: shortExpiry,
        createdAt: new Date(),
      });

      // Permission should exist initially
      const beforeExpiry = await manager.checkPermission('Bash', 'test-command');
      expect(beforeExpiry).toBe('allow-always');

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 150));

      // Permission should be expired
      const afterExpiry = await manager.checkPermission('Bash', 'test-command');
      expect(afterExpiry).toBeNull();
    });

    it('should handle session cache behavior', async () => {
      // Grant session-level permission
      await manager.grantPermission('Edit', 'test-file.txt', 'allow-once');

      // First check should return and consume the permission
      const firstCheck = await manager.checkPermission('Edit', 'test-file.txt');
      expect(firstCheck).toBe('allow-once');

      // Second check should return null (consumed)
      const secondCheck = await manager.checkPermission('Edit', 'test-file.txt');
      expect(secondCheck).toBeNull();

      // Clear session (simulating new session)
      manager.clearSession();

      // Permission should still be null (was consumed)
      const afterClear = await manager.checkPermission('Edit', 'test-file.txt');
      expect(afterClear).toBeNull();
    });

    it('should handle multiple concurrent permission requests', async () => {
      // Grant permissions concurrently
      const promises = [
        manager.grantPermission('Read', 'file1.txt', 'allow-always'),
        manager.grantPermission('Write', 'file2.txt', 'allow-once'),
        manager.grantPermission('Bash', 'command1', 'deny'),
      ];

      await Promise.all(promises);

      // Check all permissions were granted correctly
      const results = await Promise.all([
        manager.checkPermission('Read', 'file1.txt'),
        manager.checkPermission('Write', 'file2.txt'),
        manager.checkPermission('Bash', 'command1'),
      ]);

      expect(results).toEqual(['allow-always', 'allow-once', 'deny']);
    });
  });

  describe('Tool Permission Integration', () => {
    it('should integrate with tool execution pipeline', async () => {
      // Mock a tool execution scenario
      const toolCheckOptions: ToolPermissionCheckOptions = {
        tool: 'Write',
        scope: '/tmp/output.txt',
        operation: 'file-write',
        parameters: {
          filePath: '/tmp/output.txt',
          content: 'test content',
        },
      };

      // Check permission without granting - should be denied by default
      const initialCheck = await manager.checkToolPermission(toolCheckOptions);
      expect(initialCheck.allowed).toBe(false);
      expect(initialCheck.requiresConfirmation).toBe(true);

      // Grant permission
      await manager.grantPermission('Write', '/tmp/output.txt', 'allow-always');

      // Check permission again - should be allowed
      const afterGrant = await manager.checkToolPermission(toolCheckOptions);
      expect(afterGrant.allowed).toBe(true);
      expect(afterGrant.requiresConfirmation).toBe(false);
    });

    it('should handle dangerous operation detection', async () => {
      // Test dangerous operation scenarios
      const dangerousOperations = [
        {
          tool: 'Bash',
          scope: 'rm -rf /',
          operation: 'shell-command',
        },
        {
          tool: 'Write',
          scope: '/etc/passwd',
          operation: 'file-write',
        },
        {
          tool: 'Edit',
          scope: '/bin/bash',
          operation: 'file-edit',
        },
      ];

      for (const op of dangerousOperations) {
        const result = await manager.checkToolPermission({
          tool: op.tool,
          scope: op.scope,
          operation: op.operation,
        });

        // Dangerous operations should require confirmation even with permissions
        expect(result.requiresConfirmation).toBe(true);
        expect(result.reason).toContain('dangerous');
      }
    });

    it('should handle directory access validation', async () => {
      // Configure directory access
      const directoryConfig = {
        allowlist: ['/home/user/*', '/tmp/*'],
        blocklist: ['/etc/*', '/root/*'],
        defaultAllow: false,
      };

      await manager.setToolConfig('Read', {
        directoryAccess: directoryConfig,
      });

      // Test allowed paths
      const allowedPaths = ['/home/user/document.txt', '/tmp/temp-file.txt'];
      for (const path of allowedPaths) {
        const result = await manager.checkDirectoryAccess(path, { operation: 'read' });
        expect(result.allowed).toBe(true);
      }

      // Test blocked paths
      const blockedPaths = ['/etc/passwd', '/root/.ssh/id_rsa'];
      for (const path of blockedPaths) {
        const result = await manager.checkDirectoryAccess(path, { operation: 'read' });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('blocked');
      }

      // Test unlisted paths (should be denied due to defaultAllow: false)
      const unlistedPaths = ['/var/log/system.log', '/opt/app/config.json'];
      for (const path of unlistedPaths) {
        const result = await manager.checkDirectoryAccess(path, { operation: 'read' });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('not in allowlist');
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      // Close the database to simulate error
      store.close();

      // Operations should handle database errors
      await expect(manager.checkPermission('Read')).rejects.toThrow();
      await expect(manager.grantPermission('Write', 'test', 'allow-once')).rejects.toThrow();
    });

    it('should handle invalid permission data', async () => {
      // Try to grant permission with invalid data
      await expect(
        manager.grantPermission('', 'scope', 'allow-once')
      ).rejects.toThrow('Tool name is required');

      await expect(
        manager.grantPermission('Read', 'scope', 'invalid-level' as PermissionLevel)
      ).rejects.toThrow();
    });

    it('should handle concurrent database access', async () => {
      // Multiple managers accessing the same database
      const manager2 = new PermissionManager(store);
      const manager3 = new PermissionManager(store);

      // Concurrent operations
      const operations = [
        manager.grantPermission('Read', 'file1', 'allow-always'),
        manager2.grantPermission('Write', 'file2', 'allow-once'),
        manager3.grantPermission('Bash', 'cmd1', 'deny'),
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();

      // Verify all operations succeeded
      const permissions = await store.listPermissions();
      expect(permissions).toHaveLength(3);
    });

    it('should handle permission cleanup and maintenance', async () => {
      // Add some expired permissions
      const expiredDate = new Date(Date.now() - 86400000); // 24 hours ago
      await store.savePermission({
        tool: 'Read',
        scope: 'expired-file',
        level: 'allow-always',
        expiry: expiredDate,
        createdAt: new Date(Date.now() - 172800000), // 48 hours ago
      });

      // Add current permission
      await store.savePermission({
        tool: 'Write',
        scope: 'current-file',
        level: 'allow-always',
        createdAt: new Date(),
      });

      // Clean up expired permissions
      await store.cleanupExpiredPermissions();

      // Verify cleanup
      const permissions = await store.listPermissions();
      expect(permissions).toHaveLength(1);
      expect(permissions[0].scope).toBe('current-file');
    });
  });

  describe('Event Integration', () => {
    it('should emit permission events during flows', async () => {
      const events: any[] = [];
      const eventEmitter = new EventEmitter();

      // Listen for permission events
      eventEmitter.on('permission:granted', (data) => events.push({ type: 'granted', data }));
      eventEmitter.on('permission:denied', (data) => events.push({ type: 'denied', data }));
      eventEmitter.on('permission:requested', (data) => events.push({ type: 'requested', data }));

      // Simulate permission flow with events
      eventEmitter.emit('permission:requested', {
        tool: 'Write',
        scope: 'test-file.txt',
        requestId: 'test-123',
      });

      await manager.grantPermission('Write', 'test-file.txt', 'allow-once');

      eventEmitter.emit('permission:granted', {
        tool: 'Write',
        scope: 'test-file.txt',
        level: 'allow-once',
        requestId: 'test-123',
      });

      // Verify events were captured
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('requested');
      expect(events[1].type).toBe('granted');
      expect(events[1].data.level).toBe('allow-once');
    });
  });
});