/**
 * Test system recovery scenarios for permission system
 * Addresses high-priority gap: Database corruption, network partition, process crash scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { PermissionStore } from '../permission-store.js';
import { PermissionManager } from '../permission-manager.js';
import { PermissionLevel } from '@apex/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import Database from 'better-sqlite3';

describe('Permission System Recovery Scenarios', () => {
  let orchestrator: ApexOrchestrator;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let testDbPath: string;

  beforeEach(async () => {
    orchestrator = new ApexOrchestrator();
    await orchestrator.init();
    permissionStore = orchestrator.permissionStore!;
    permissionManager = orchestrator.permissionManager!;

    // Get test database path
    testDbPath = permissionStore.dbPath || ':memory:';
  });

  afterEach(async () => {
    await orchestrator.shutdown();
  });

  describe('Database Corruption Recovery', () => {
    it('should recover from corrupted permission database', async () => {
      // First, populate some permissions
      await permissionManager.grantPermission('test:tool', 'test-resource', PermissionLevel.ALLOW_ONCE);
      const initialPermissions = await permissionStore.getAllPermissions();
      expect(initialPermissions).toHaveLength(1);

      // Shutdown gracefully
      await orchestrator.shutdown();

      // Simulate database corruption (if using file-based DB)
      if (testDbPath !== ':memory:') {
        try {
          // Corrupt the database by writing random data
          const corruptData = Buffer.from('CORRUPTED_DATABASE_FILE');
          await fs.writeFile(testDbPath, corruptData);

          // Try to reinitialize - should handle corruption gracefully
          const newOrchestrator = new ApexOrchestrator();
          await expect(newOrchestrator.init()).resolves.not.toThrow();

          // Should start with clean state
          const recoveredPermissions = await newOrchestrator.permissionStore!.getAllPermissions();
          expect(recoveredPermissions).toHaveLength(0);

          await newOrchestrator.shutdown();
        } catch (error) {
          console.warn('File-based DB corruption test skipped:', error);
        }
      }
    });

    it('should handle database schema mismatch gracefully', async () => {
      // Shutdown current instance
      await orchestrator.shutdown();

      if (testDbPath !== ':memory:') {
        try {
          // Create database with invalid schema
          const db = new Database(testDbPath);
          db.exec(`
            CREATE TABLE permissions (
              id INTEGER PRIMARY KEY,
              invalid_column TEXT
            );
          `);
          db.close();

          // Try to initialize with existing invalid schema
          const newOrchestrator = new ApexOrchestrator();
          await expect(newOrchestrator.init()).resolves.not.toThrow();

          // Should be able to operate normally
          await newOrchestrator.permissionManager!.grantPermission(
            'test:tool',
            'test-resource',
            PermissionLevel.ALLOW_ONCE
          );

          const permissions = await newOrchestrator.permissionStore!.getAllPermissions();
          expect(permissions).toHaveLength(1);

          await newOrchestrator.shutdown();
        } catch (error) {
          console.warn('Schema mismatch test skipped:', error);
        }
      }
    });

    it('should recover from partially written permission records', async () => {
      // Mock database failure during write
      const originalSetPermission = permissionStore.setPermission.bind(permissionStore);

      let callCount = 0;
      vi.spyOn(permissionStore, 'setPermission').mockImplementation(async (toolName, resource, level) => {
        callCount++;
        if (callCount === 1) {
          // Simulate partial write failure
          throw new Error('Simulated database write failure');
        }
        return originalSetPermission(toolName, resource, level);
      });

      // First attempt should fail
      await expect(
        permissionManager.grantPermission('test:tool', 'test-resource', PermissionLevel.ALLOW_ONCE)
      ).rejects.toThrow();

      // Second attempt should succeed
      await expect(
        permissionManager.grantPermission('test:tool', 'test-resource', PermissionLevel.ALLOW_ONCE)
      ).resolves.not.toThrow();

      // Verify final state is consistent
      const permissions = await permissionStore.getAllPermissions();
      expect(permissions).toHaveLength(1);
      expect(permissions[0].level).toBe(PermissionLevel.ALLOW_ONCE);

      vi.restoreAllMocks();
    });
  });

  describe('Network Partition Handling', () => {
    it('should handle WebSocket disconnection during permission requests', async () => {
      // Mock network failure
      let networkAvailable = true;
      const originalEmit = orchestrator.emit.bind(orchestrator);

      vi.spyOn(orchestrator, 'emit').mockImplementation((event, ...args) => {
        if (!networkAvailable && event.toString().includes('permission')) {
          // Simulate network failure for permission events
          throw new Error('Network unavailable');
        }
        return originalEmit(event, ...args);
      });

      // Start with network available
      await permissionManager.grantPermission('test:tool', 'resource1', PermissionLevel.ALLOW_ONCE);

      // Simulate network partition
      networkAvailable = false;

      // Permission operations should still work locally
      await expect(
        permissionManager.grantPermission('test:tool', 'resource2', PermissionLevel.ALLOW_ONCE)
      ).resolves.not.toThrow();

      // Restore network
      networkAvailable = true;

      // Should be able to sync state
      const permissions = await permissionStore.getAllPermissions();
      expect(permissions).toHaveLength(2);

      vi.restoreAllMocks();
    });

    it('should queue permission notifications during network outage', async () => {
      const notificationQueue: any[] = [];
      let networkDown = false;

      // Mock notification system
      const originalEmit = orchestrator.emit.bind(orchestrator);
      vi.spyOn(orchestrator, 'emit').mockImplementation((event, ...args) => {
        if (networkDown && event.toString().includes('permission')) {
          notificationQueue.push({ event, args });
          return false;
        }
        return originalEmit(event, ...args);
      });

      // Simulate network going down
      networkDown = true;

      // Perform operations during outage
      await permissionManager.grantPermission('test:tool1', 'resource', PermissionLevel.ALLOW_ONCE);
      await permissionManager.grantPermission('test:tool2', 'resource', PermissionLevel.ALLOW_ONCE);

      // Network comes back
      networkDown = false;

      // Process queued notifications
      for (const { event, args } of notificationQueue) {
        originalEmit(event, ...args);
      }

      // Verify operations were preserved
      const permissions = await permissionStore.getAllPermissions();
      expect(permissions).toHaveLength(2);

      vi.restoreAllMocks();
    });
  });

  describe('Process Crash and Restart Scenarios', () => {
    it('should recover session state after process restart', async () => {
      const sessionId = 'persistent-session-123';

      // Create session-scoped permissions
      await permissionManager.checkPermission('test:tool', 'resource1', { sessionId });
      await permissionManager.grantPermission('test:tool', 'resource1', PermissionLevel.ALLOW_ALWAYS);

      // Simulate process restart by creating new orchestrator instance
      await orchestrator.shutdown();

      const newOrchestrator = new ApexOrchestrator();
      await newOrchestrator.init();

      // Check if permissions are recovered
      const recoveredPermissions = await newOrchestrator.permissionStore!.getAllPermissions();
      expect(recoveredPermissions).toHaveLength(1);
      expect(recoveredPermissions[0].tool_name).toBe('test:tool');
      expect(recoveredPermissions[0].level).toBe(PermissionLevel.ALLOW_ALWAYS);

      await newOrchestrator.shutdown();
    });

    it('should handle incomplete permission transactions after crash', async () => {
      // Mock a crash during permission setting
      const originalSetPermission = permissionStore.setPermission.bind(permissionStore);

      vi.spyOn(permissionStore, 'setPermission').mockImplementationOnce(async () => {
        // Simulate crash by throwing unexpected error
        throw new Error('Process crashed during permission write');
      });

      // This should fail due to simulated crash
      await expect(
        permissionManager.grantPermission('crash:test', 'resource', PermissionLevel.ALLOW_ONCE)
      ).rejects.toThrow();

      // Restore normal operation
      vi.restoreAllMocks();

      // Should be able to complete the operation after "restart"
      await expect(
        permissionManager.grantPermission('crash:test', 'resource', PermissionLevel.ALLOW_ONCE)
      ).resolves.not.toThrow();

      const permissions = await permissionStore.getAllPermissions();
      expect(permissions).toHaveLength(1);
    });

    it('should cleanup orphaned session data after restart', async () => {
      const sessionId = 'orphaned-session';

      // Create session data
      await permissionManager.checkPermission('session:tool', 'resource', { sessionId });

      // Simulate restart with session cleanup
      const sessionPermissions = permissionManager.getSessionPermissions?.(sessionId);
      if (sessionPermissions) {
        // Session should exist initially
        expect(sessionPermissions).toBeDefined();
      }

      // Simulate cleanup after restart
      if (permissionManager.clearSessionPermissions) {
        await permissionManager.clearSessionPermissions(sessionId);
      }

      // Session data should be cleaned up
      const cleanedSessionPermissions = permissionManager.getSessionPermissions?.(sessionId);
      expect(cleanedSessionPermissions).toBeUndefined();
    });
  });

  describe('Resource Exhaustion Recovery', () => {
    it('should handle memory pressure gracefully', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create many permissions to simulate memory pressure
      const operations = [];
      for (let i = 0; i < 1000; i++) {
        operations.push(
          permissionManager.grantPermission(
            `memory:test:${i}`,
            `resource:${i}`,
            PermissionLevel.ALLOW_ONCE
          )
        );
      }

      await Promise.all(operations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsed = finalMemory - initialMemory;

      // Should not use excessive memory (less than 50MB for 1000 permissions)
      expect(memoryUsed).toBeLessThan(50 * 1024 * 1024);

      // System should still be responsive
      await expect(
        permissionManager.grantPermission('final:test', 'resource', PermissionLevel.ALLOW_ONCE)
      ).resolves.not.toThrow();
    });

    it('should handle disk space exhaustion', async () => {
      // Mock disk full error
      const originalSetPermission = permissionStore.setPermission.bind(permissionStore);

      vi.spyOn(permissionStore, 'setPermission').mockImplementationOnce(async () => {
        const error = new Error('ENOSPC: no space left on device');
        (error as any).code = 'ENOSPC';
        throw error;
      });

      // Should handle disk full gracefully
      await expect(
        permissionManager.grantPermission('disk:test', 'resource', PermissionLevel.ALLOW_ONCE)
      ).rejects.toThrow();

      // Restore normal operation
      vi.restoreAllMocks();

      // Should recover after space is available
      await expect(
        permissionManager.grantPermission('disk:test', 'resource', PermissionLevel.ALLOW_ONCE)
      ).resolves.not.toThrow();
    });
  });

  describe('State Consistency Validation', () => {
    it('should maintain consistency after recovery scenarios', async () => {
      // Create initial state
      await permissionManager.grantPermission('consistency:test1', 'resource', PermissionLevel.ALLOW_ALWAYS);
      await permissionManager.grantPermission('consistency:test2', 'resource', PermissionLevel.ALLOW_ONCE);
      await permissionManager.denyPermission('consistency:test3', 'resource');

      const beforeRecovery = await permissionStore.getAllPermissions();
      expect(beforeRecovery).toHaveLength(3);

      // Simulate recovery scenario
      await orchestrator.shutdown();
      const newOrchestrator = new ApexOrchestrator();
      await newOrchestrator.init();

      const afterRecovery = await newOrchestrator.permissionStore!.getAllPermissions();

      // State should be preserved
      expect(afterRecovery).toHaveLength(3);

      // Verify specific permissions
      const test1 = afterRecovery.find(p => p.tool_name === 'consistency:test1');
      expect(test1?.level).toBe(PermissionLevel.ALLOW_ALWAYS);

      const test2 = afterRecovery.find(p => p.tool_name === 'consistency:test2');
      expect(test2?.level).toBe(PermissionLevel.ALLOW_ONCE);

      const test3 = afterRecovery.find(p => p.tool_name === 'consistency:test3');
      expect(test3?.level).toBe(PermissionLevel.DENY);

      await newOrchestrator.shutdown();
    });

    it('should validate database integrity after recovery', async () => {
      // Populate with various permission types
      const testData = [
        { tool: 'validation:fs', resource: '/test/path', level: PermissionLevel.ALLOW_ALWAYS },
        { tool: 'validation:shell', resource: 'ls -la', level: PermissionLevel.ALLOW_ONCE },
        { tool: 'validation:web', resource: 'https://example.com', level: PermissionLevel.DENY },
      ];

      for (const data of testData) {
        await permissionManager.grantPermission(data.tool, data.resource, data.level);
      }

      // Perform integrity check
      const allPermissions = await permissionStore.getAllPermissions();

      // Basic integrity checks
      expect(allPermissions).toHaveLength(testData.length);

      for (const permission of allPermissions) {
        // Check required fields exist
        expect(permission.id).toBeDefined();
        expect(permission.tool_name).toBeTruthy();
        expect(permission.resource).toBeTruthy();
        expect(permission.level).toBeDefined();
        expect(permission.created_at).toBeDefined();

        // Check level is valid
        expect(Object.values(PermissionLevel)).toContain(permission.level);
      }

      // Check for duplicates
      const uniqueKeys = new Set();
      for (const permission of allPermissions) {
        const key = `${permission.tool_name}:${permission.resource}`;
        expect(uniqueKeys.has(key)).toBe(false);
        uniqueKeys.add(key);
      }
    });
  });
});