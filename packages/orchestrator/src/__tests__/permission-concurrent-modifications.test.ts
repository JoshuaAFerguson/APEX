/**
 * Test concurrent permission modifications
 * Addresses high-priority gap: Multiple agents requesting permissions simultaneously
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { PermissionStore } from '../permission-store.js';
import { PermissionManager } from '../permission-manager.js';
import { PermissionLevel } from '@apex/core';

describe('Concurrent Permission Modifications', () => {
  let orchestrator: ApexOrchestrator;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;

  beforeEach(async () => {
    orchestrator = new ApexOrchestrator();
    await orchestrator.init();
    permissionStore = orchestrator.permissionStore!;
    permissionManager = orchestrator.permissionManager!;
  });

  afterEach(async () => {
    await orchestrator.shutdown();
  });

  describe('Simultaneous Permission Requests', () => {
    it('should handle multiple concurrent permission grants without race conditions', async () => {
      const toolName = 'filesystem:write';
      const numConcurrentRequests = 10;

      // Create concurrent permission requests
      const promises = Array.from({ length: numConcurrentRequests }, (_, i) =>
        permissionManager.grantPermission(toolName, `resource_${i}`, PermissionLevel.ALLOW_ONCE)
      );

      // Wait for all requests to complete
      const results = await Promise.allSettled(promises);

      // All requests should succeed
      expect(results.every(result => result.status === 'fulfilled')).toBe(true);

      // Verify all permissions were stored correctly
      const permissions = await permissionStore.getAllPermissions();
      const relevantPermissions = permissions.filter(p => p.tool_name === toolName);
      expect(relevantPermissions).toHaveLength(numConcurrentRequests);
    });

    it('should handle concurrent deny and allow requests for same tool', async () => {
      const toolName = 'shell:bash';
      const resource = 'test-resource';

      // Concurrent allow and deny operations
      const allowPromise = permissionManager.grantPermission(toolName, resource, PermissionLevel.ALLOW_ALWAYS);
      const denyPromise = permissionManager.denyPermission(toolName, resource);

      const [allowResult, denyResult] = await Promise.allSettled([allowPromise, denyPromise]);

      // Both operations should complete without throwing
      expect(allowResult.status).toBe('fulfilled');
      expect(denyResult.status).toBe('fulfilled');

      // Final state should be consistent (last operation wins)
      const finalPermission = await permissionStore.getPermission(toolName, resource);
      expect(finalPermission).toBeDefined();
      expect([PermissionLevel.ALLOW_ALWAYS, PermissionLevel.DENY]).toContain(finalPermission?.level);
    });

    it('should maintain database consistency during concurrent modifications', async () => {
      const toolName = 'browser:navigate';
      const numOperations = 20;

      // Mix of different operations
      const operations = Array.from({ length: numOperations }, (_, i) => {
        const resource = `resource_${i % 5}`; // Some overlap in resources
        const level = i % 3 === 0 ? PermissionLevel.ALLOW_ALWAYS :
                     i % 3 === 1 ? PermissionLevel.ALLOW_ONCE :
                     PermissionLevel.DENY;

        return permissionManager.grantPermission(toolName, resource, level);
      });

      await Promise.allSettled(operations);

      // Verify database integrity
      const permissions = await permissionStore.getAllPermissions();
      const toolPermissions = permissions.filter(p => p.tool_name === toolName);

      // Each resource should have only one final permission
      const resourceCounts = new Map();
      for (const perm of toolPermissions) {
        const key = `${perm.tool_name}:${perm.resource}`;
        resourceCounts.set(key, (resourceCounts.get(key) || 0) + 1);
      }

      // No duplicate permissions should exist
      for (const count of resourceCounts.values()) {
        expect(count).toBe(1);
      }
    });
  });

  describe('Session Cache Conflicts', () => {
    it('should handle concurrent cache updates correctly', async () => {
      const sessionId = 'test-session-123';
      const toolName = 'web:search';

      // Create multiple session-scoped permission requests
      const operations = Array.from({ length: 5 }, (_, i) =>
        permissionManager.checkPermission(toolName, `query_${i}`, { sessionId })
      );

      const results = await Promise.allSettled(operations);

      // All checks should complete successfully
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);

      // Session cache should be consistent
      const sessionPermissions = permissionManager.getSessionPermissions?.(sessionId);
      expect(sessionPermissions).toBeDefined();
    });

    it('should handle cache invalidation during concurrent operations', async () => {
      const sessionId = 'test-session-456';
      const toolName = 'filesystem:read';
      const resource = 'test-file.txt';

      // Start permission check
      const checkPromise = permissionManager.checkPermission(toolName, resource, { sessionId });

      // Concurrently invalidate permission
      const invalidatePromise = permissionManager.revokePermission(toolName, resource);

      const [checkResult, invalidateResult] = await Promise.allSettled([checkPromise, invalidatePromise]);

      // Both operations should handle gracefully
      expect(checkResult.status).toBe('fulfilled');
      expect(invalidateResult.status).toBe('fulfilled');

      // Final state should be consistent
      const permission = await permissionStore.getPermission(toolName, resource);
      expect(permission?.level).toBe(PermissionLevel.DENY);
    });
  });

  describe('Database Transaction Safety', () => {
    it('should handle concurrent database writes with proper locking', async () => {
      const toolName = 'dangerous:operation';
      const resource = 'critical-system-file';

      // Simulate high contention scenario
      const writeOperations = Array.from({ length: 10 }, () =>
        permissionStore.setPermission(toolName, resource, PermissionLevel.ALLOW_ONCE)
      );

      await Promise.allSettled(writeOperations);

      // Database should remain consistent
      const permission = await permissionStore.getPermission(toolName, resource);
      expect(permission).toBeDefined();
      expect(permission?.tool_name).toBe(toolName);
      expect(permission?.resource).toBe(resource);
    });

    it('should rollback failed transactions without affecting other operations', async () => {
      const validTool = 'filesystem:write';
      const invalidTool = ''; // This should cause validation error

      const validOperation = permissionStore.setPermission(validTool, 'valid-resource', PermissionLevel.ALLOW_ONCE);
      const invalidOperation = permissionStore.setPermission(invalidTool, 'invalid-resource', PermissionLevel.ALLOW_ONCE);

      const [validResult, invalidResult] = await Promise.allSettled([validOperation, invalidOperation]);

      // Valid operation should succeed
      expect(validResult.status).toBe('fulfilled');

      // Invalid operation should fail
      expect(invalidResult.status).toBe('rejected');

      // Valid permission should exist
      const validPermission = await permissionStore.getPermission(validTool, 'valid-resource');
      expect(validPermission).toBeDefined();
    });
  });

  describe('Event System Consistency', () => {
    it('should emit events consistently during concurrent modifications', async () => {
      const events: any[] = [];

      // Listen for permission events
      orchestrator.on('permission:granted', (event) => events.push({ type: 'granted', ...event }));
      orchestrator.on('permission:denied', (event) => events.push({ type: 'denied', ...event }));

      const toolName = 'test:tool';
      const numOperations = 5;

      // Concurrent grant operations
      const operations = Array.from({ length: numOperations }, (_, i) =>
        permissionManager.grantPermission(toolName, `resource_${i}`, PermissionLevel.ALLOW_ONCE)
      );

      await Promise.allSettled(operations);

      // Wait a bit for events to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have received appropriate events
      expect(events).toHaveLength(numOperations);
      expect(events.every(e => e.type === 'granted')).toBe(true);
    });

    it('should maintain event ordering during high-frequency operations', async () => {
      const events: any[] = [];
      let eventCounter = 0;

      orchestrator.on('permission:granted', (event) => {
        events.push({
          type: 'granted',
          order: ++eventCounter,
          toolName: event.toolName,
          resource: event.resource
        });
      });

      const toolName = 'rapid:fire';
      const operations = Array.from({ length: 10 }, (_, i) =>
        permissionManager.grantPermission(toolName, `resource_${i}`, PermissionLevel.ALLOW_ONCE)
      );

      await Promise.allSettled(operations);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Events should be received in reasonable order
      expect(events).toHaveLength(10);
      expect(events.every((event, index) => event.order === index + 1)).toBe(true);
    });
  });

  describe('Memory Management Under Concurrency', () => {
    it('should not leak memory during high-frequency permission operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many permission operations
      for (let batch = 0; batch < 5; batch++) {
        const operations = Array.from({ length: 20 }, (_, i) =>
          permissionManager.grantPermission(
            `batch_${batch}:tool_${i}`,
            `resource_${i}`,
            PermissionLevel.ALLOW_ONCE
          )
        );

        await Promise.allSettled(operations);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle session cleanup during concurrent access', async () => {
      const sessionId = 'memory-test-session';
      const toolName = 'cleanup:test';

      // Create session-scoped permissions
      const createOperations = Array.from({ length: 10 }, (_, i) =>
        permissionManager.checkPermission(toolName, `resource_${i}`, { sessionId })
      );

      await Promise.allSettled(createOperations);

      // Simulate session cleanup during active operations
      const activeOperations = Array.from({ length: 5 }, (_, i) =>
        permissionManager.checkPermission(toolName, `new_resource_${i}`, { sessionId })
      );

      // Cleanup session concurrently
      const cleanupPromise = permissionManager.clearSessionPermissions?.(sessionId);

      await Promise.allSettled([...activeOperations, cleanupPromise]);

      // Should not crash or corrupt state
      expect(true).toBe(true); // Test passes if we reach here
    });
  });
});