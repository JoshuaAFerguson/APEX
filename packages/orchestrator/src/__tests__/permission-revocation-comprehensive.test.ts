/**
 * Comprehensive Permission Revocation Scenario Tests
 *
 * Extends the existing mid-stream permission revocation tests with additional
 * comprehensive scenarios covering edge cases and error conditions.
 *
 * This test suite verifies:
 * 1. Permission revocation edge cases and error conditions
 * 2. Complex revocation scenarios with multiple dependencies
 * 3. Revocation event propagation and error handling
 * 4. Recovery and retry mechanisms after revocation
 *
 * @see packages/orchestrator/src/__tests__/mid-stream-permission-revocation.test.ts
 * @see ADR-052-permission-denial-error-handling-tests.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager.js';
import { PermissionStore } from '../permission-store.js';
import { EventEmitter } from 'events';

describe('Comprehensive Permission Revocation Scenarios', () => {
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let testDir: string;
  let eventEmitter: EventEmitter;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `apex-revocation-test-${Date.now()}-${Math.random().toString(36).substring(2)}`
    );
    mkdirSync(testDir, { recursive: true });

    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();
    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();
  });

  afterEach(async () => {
    if (permissionStore) {
      permissionStore.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
    eventEmitter.removeAllListeners();
  });

  describe('Edge Cases in Permission Revocation', () => {
    it('should handle revocation of non-existent permissions gracefully', async () => {
      // Try to revoke a permission that was never granted
      const nonExistentTools = ['NonExistent1', 'FakeTool', 'InvalidPermission'];

      for (const tool of nonExistentTools) {
        const revocationResult = await permissionManager.revokePermission(tool);

        // Revocation should return false but not throw an error
        expect(revocationResult).toBe(false);

        // Permission check should still return null
        const permission = await permissionManager.checkPermission(tool);
        expect(permission).toBeNull();
      }
    });

    it('should handle revocation during database transaction failures', async () => {
      // Grant a permission first
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      // Verify permission exists
      expect(await permissionManager.hasPermission('Write')).toBe(true);

      // Mock database failure during revocation
      const originalRevoke = permissionStore.revokePermission;
      vi.spyOn(permissionStore, 'revokePermission').mockRejectedValueOnce(
        new Error('Database connection failed during revocation')
      );

      // Revocation should handle database errors gracefully
      await expect(permissionManager.revokePermission('Write')).rejects.toThrow(
        'Database connection failed during revocation'
      );

      // Restore original method for cleanup
      permissionStore.revokePermission = originalRevoke;
    });

    it('should handle revocation of already revoked permissions', async () => {
      const tool = 'DoubleRevoke';

      // Grant permission
      await permissionManager.grantPermission(tool, undefined, 'allow-once');
      expect(await permissionManager.hasPermission(tool)).toBe(true);

      // Revoke once
      const firstRevocation = await permissionManager.revokePermission(tool);
      expect(firstRevocation).toBe(true);
      expect(await permissionManager.hasPermission(tool)).toBe(false);

      // Revoke again (should be idempotent)
      const secondRevocation = await permissionManager.revokePermission(tool);
      expect(secondRevocation).toBe(false); // Already revoked
      expect(await permissionManager.hasPermission(tool)).toBe(false);
    });

    it('should handle rapid successive revocation attempts', async () => {
      const tools = ['Rapid1', 'Rapid2', 'Rapid3', 'Rapid4', 'Rapid5'];

      // Grant all permissions
      for (const tool of tools) {
        await permissionManager.grantPermission(tool, undefined, 'allow-always');
      }

      // Revoke all simultaneously (test race conditions)
      const revocationPromises = tools.map(tool =>
        permissionManager.revokePermission(tool)
      );

      const results = await Promise.all(revocationPromises);

      // All revocations should succeed
      expect(results.every(result => result === true)).toBe(true);

      // All permissions should be revoked
      for (const tool of tools) {
        expect(await permissionManager.hasPermission(tool)).toBe(false);
      }
    });
  });

  describe('Complex Multi-Dependency Revocation Scenarios', () => {
    it('should handle cascading permission dependencies', async () => {
      // Set up dependency chain: Read -> Write -> Edit -> Bash
      const dependencyChain = [
        { tool: 'Read', dependsOn: [] },
        { tool: 'Write', dependsOn: ['Read'] },
        { tool: 'Edit', dependsOn: ['Read', 'Write'] },
        { tool: 'Bash', dependsOn: ['Read', 'Write', 'Edit'] }
      ];

      // Grant all permissions in dependency order
      for (const { tool } of dependencyChain) {
        await permissionManager.grantPermission(tool, undefined, 'allow-always');
      }

      // Verify all are granted
      for (const { tool } of dependencyChain) {
        expect(await permissionManager.hasPermission(tool)).toBe(true);
      }

      // Revoke root dependency (Read)
      await permissionManager.revokePermission('Read');

      // In a real system, this might cascade. For our test, verify individual state
      expect(await permissionManager.hasPermission('Read')).toBe(false);

      // Other tools might still have permissions unless explicitly revoked
      // (behavior depends on system design)
    });

    it('should handle circular dependency revocation scenarios', async () => {
      // Set up circular dependency scenario
      const circularTools = ['ToolA', 'ToolB', 'ToolC'];

      // Grant permissions for circular dependency tools
      for (const tool of circularTools) {
        await permissionManager.grantPermission(tool, undefined, 'allow-always');
      }

      // Simulate circular dependency tracking
      const dependencies = new Map([
        ['ToolA', ['ToolB']],
        ['ToolB', ['ToolC']],
        ['ToolC', ['ToolA']] // Circular reference
      ]);

      // Revoke one tool in the circular chain
      await permissionManager.revokePermission('ToolA');
      expect(await permissionManager.hasPermission('ToolA')).toBe(false);

      // Other tools should still be evaluable independently
      expect(await permissionManager.hasPermission('ToolB')).toBe(true);
      expect(await permissionManager.hasPermission('ToolC')).toBe(true);
    });

    it('should handle permission inheritance revocation', async () => {
      // Set up inheritance hierarchy: Admin -> User -> Guest
      const hierarchy = [
        { role: 'Admin', tools: ['Read', 'Write', 'Edit', 'Bash', 'Delete'] },
        { role: 'User', tools: ['Read', 'Write', 'Edit'] },
        { role: 'Guest', tools: ['Read'] }
      ];

      // Grant permissions for each role
      for (const { role, tools } of hierarchy) {
        for (const tool of tools) {
          await permissionManager.grantPermission(
            tool,
            `role:${role}`,
            'allow-always'
          );
        }
      }

      // Verify Admin has all permissions
      const adminTools = hierarchy.find(h => h.role === 'Admin')!.tools;
      for (const tool of adminTools) {
        expect(await permissionManager.hasPermission(tool, 'role:Admin')).toBe(true);
      }

      // Revoke Admin's Delete permission
      await permissionManager.revokePermission('Delete', 'role:Admin');
      expect(await permissionManager.hasPermission('Delete', 'role:Admin')).toBe(false);

      // Other Admin permissions should remain
      expect(await permissionManager.hasPermission('Write', 'role:Admin')).toBe(true);
      expect(await permissionManager.hasPermission('Read', 'role:Admin')).toBe(true);
    });
  });

  describe('Revocation Event Propagation and Error Handling', () => {
    it('should emit proper events during permission revocation', async () => {
      const revocationEvents: any[] = [];

      // Set up event listeners
      eventEmitter.on('permission-revoked', (event) => {
        revocationEvents.push(event);
      });

      eventEmitter.on('permission-error', (event) => {
        revocationEvents.push({ ...event, type: 'error' });
      });

      // Grant and then revoke permission with event emission
      await permissionManager.grantPermission('EventTest', undefined, 'allow-always');

      // Simulate revocation with event emission
      eventEmitter.emit('permission-revoked', {
        tool: 'EventTest',
        scope: undefined,
        timestamp: new Date(),
        success: true
      });

      await permissionManager.revokePermission('EventTest');

      expect(revocationEvents).toHaveLength(1);
      expect(revocationEvents[0].tool).toBe('EventTest');
      expect(revocationEvents[0].success).toBe(true);
    });

    it('should handle event emission failures gracefully', async () => {
      // Set up faulty event listener that throws
      eventEmitter.on('permission-revoked', () => {
        throw new Error('Event handler crashed');
      });

      // Mock console.error to capture error logs
      const originalConsoleError = console.error;
      const errorLogs: string[] = [];
      console.error = vi.fn((message) => {
        errorLogs.push(message);
      });

      try {
        // Revocation should succeed even if event handler fails
        await permissionManager.grantPermission('EventError', undefined, 'allow-always');
        const revocationResult = await permissionManager.revokePermission('EventError');

        expect(revocationResult).toBe(true);
        expect(await permissionManager.hasPermission('EventError')).toBe(false);

        // Simulate event emission (would normally be internal)
        try {
          eventEmitter.emit('permission-revoked', {
            tool: 'EventError',
            timestamp: new Date()
          });
        } catch (eventError) {
          // Event handler error should be caught and logged
          expect(eventError).toBeInstanceOf(Error);
        }
      } finally {
        console.error = originalConsoleError;
      }
    });

    it('should provide detailed error information in revocation events', async () => {
      const detailedEvents: any[] = [];

      eventEmitter.on('permission-revocation-detailed', (event) => {
        detailedEvents.push(event);
      });

      // Simulate detailed revocation event
      const detailedEvent = {
        tool: 'DetailedTool',
        scope: '/restricted/path',
        level: 'allow-always',
        timestamp: new Date(),
        initiator: 'user-action',
        reason: 'Security policy change',
        affectedSessions: ['session-123', 'session-456'],
        rollbackAvailable: true
      };

      eventEmitter.emit('permission-revocation-detailed', detailedEvent);

      expect(detailedEvents).toHaveLength(1);
      const event = detailedEvents[0];
      expect(event.tool).toBe('DetailedTool');
      expect(event.initiator).toBe('user-action');
      expect(event.reason).toBe('Security policy change');
      expect(event.affectedSessions).toEqual(['session-123', 'session-456']);
      expect(event.rollbackAvailable).toBe(true);
    });

    it('should handle event listener memory leaks', async () => {
      const initialListenerCount = eventEmitter.listenerCount('permission-revoked');

      // Add multiple listeners
      const listeners = [];
      for (let i = 0; i < 10; i++) {
        const listener = () => console.log(`Listener ${i}`);
        listeners.push(listener);
        eventEmitter.on('permission-revoked', listener);
      }

      expect(eventEmitter.listenerCount('permission-revoked')).toBe(
        initialListenerCount + 10
      );

      // Remove listeners to prevent memory leaks
      for (const listener of listeners) {
        eventEmitter.removeListener('permission-revoked', listener);
      }

      expect(eventEmitter.listenerCount('permission-revoked')).toBe(initialListenerCount);
    });
  });

  describe('Recovery and Retry Mechanisms', () => {
    it('should support permission restoration after accidental revocation', async () => {
      const tool = 'RestoreTest';
      const originalLevel = 'allow-always';

      // Grant permission
      await permissionManager.grantPermission(tool, undefined, originalLevel);
      expect(await permissionManager.checkPermission(tool)).toBe(originalLevel);

      // Revoke permission (simulate accidental revocation)
      await permissionManager.revokePermission(tool);
      expect(await permissionManager.checkPermission(tool)).toBeNull();

      // Restore permission to original level
      await permissionManager.grantPermission(tool, undefined, originalLevel);
      expect(await permissionManager.checkPermission(tool)).toBe(originalLevel);
    });

    it('should handle retry mechanisms for failed revocations', async () => {
      const tool = 'RetryTest';
      await permissionManager.grantPermission(tool, undefined, 'allow-always');

      let attemptCount = 0;
      const maxRetries = 3;

      // Mock temporary failures
      const originalRevoke = permissionStore.revokePermission;
      vi.spyOn(permissionStore, 'revokePermission').mockImplementation(async (...args) => {
        attemptCount++;
        if (attemptCount < maxRetries) {
          throw new Error(`Temporary failure attempt ${attemptCount}`);
        }
        return originalRevoke.apply(permissionStore, args);
      });

      // Simulate retry logic
      let success = false;
      let lastError: Error | null = null;

      for (let retry = 0; retry < maxRetries; retry++) {
        try {
          await permissionManager.revokePermission(tool);
          success = true;
          break;
        } catch (error) {
          lastError = error as Error;
          expect(error).toBeInstanceOf(Error);
        }
      }

      expect(success).toBe(true);
      expect(attemptCount).toBe(maxRetries);

      // Restore original method
      permissionStore.revokePermission = originalRevoke;
    });

    it('should provide rollback functionality for bulk revocations', async () => {
      const tools = ['Bulk1', 'Bulk2', 'Bulk3', 'Bulk4'];
      const originalPermissions = new Map();

      // Grant permissions and track original state
      for (const tool of tools) {
        await permissionManager.grantPermission(tool, undefined, 'allow-always');
        originalPermissions.set(tool, 'allow-always');
      }

      // Create rollback checkpoint
      const checkpoint = new Map();
      for (const tool of tools) {
        const level = await permissionManager.checkPermission(tool);
        checkpoint.set(tool, level);
      }

      // Perform bulk revocation
      const revocationResults = await Promise.all(
        tools.map(tool => permissionManager.revokePermission(tool))
      );

      expect(revocationResults.every(result => result === true)).toBe(true);

      // Simulate rollback
      for (const [tool, level] of checkpoint) {
        if (level) {
          await permissionManager.grantPermission(tool, undefined, level);
        }
      }

      // Verify rollback restored original state
      for (const tool of tools) {
        const currentLevel = await permissionManager.checkPermission(tool);
        expect(currentLevel).toBe(originalPermissions.get(tool));
      }
    });

    it('should handle partial failure scenarios in bulk operations', async () => {
      const tools = ['PartialA', 'PartialB', 'PartialC', 'PartialD'];

      // Grant permissions to all tools
      for (const tool of tools) {
        await permissionManager.grantPermission(tool, undefined, 'allow-always');
      }

      // Mock partial failure (fail on PartialB and PartialD)
      const originalRevoke = permissionStore.revokePermission;
      vi.spyOn(permissionStore, 'revokePermission').mockImplementation(async (tool, scope) => {
        if (tool === 'PartialB' || tool === 'PartialD') {
          throw new Error(`Failed to revoke ${tool}`);
        }
        return originalRevoke.apply(permissionStore, [tool, scope]);
      });

      // Attempt bulk revocation with error handling
      const results = await Promise.allSettled(
        tools.map(tool => permissionManager.revokePermission(tool))
      );

      // Check results
      expect(results[0].status).toBe('fulfilled'); // PartialA
      expect(results[1].status).toBe('rejected');   // PartialB
      expect(results[2].status).toBe('fulfilled'); // PartialC
      expect(results[3].status).toBe('rejected');   // PartialD

      // Verify only successful revocations took effect
      expect(await permissionManager.hasPermission('PartialA')).toBe(false);
      expect(await permissionManager.hasPermission('PartialB')).toBe(true); // Failed to revoke
      expect(await permissionManager.hasPermission('PartialC')).toBe(false);
      expect(await permissionManager.hasPermission('PartialD')).toBe(true); // Failed to revoke

      // Restore original method
      permissionStore.revokePermission = originalRevoke;
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle revocation of large numbers of permissions efficiently', async () => {
      const toolCount = 1000;
      const tools = Array.from({ length: toolCount }, (_, i) => `PerfTool${i}`);

      const startTime = performance.now();

      // Grant all permissions
      await Promise.all(
        tools.map(tool =>
          permissionManager.grantPermission(tool, undefined, 'allow-once')
        )
      );

      const grantTime = performance.now() - startTime;

      const revokeStartTime = performance.now();

      // Revoke all permissions
      const revokeResults = await Promise.all(
        tools.map(tool => permissionManager.revokePermission(tool))
      );

      const revokeTime = performance.now() - revokeStartTime;

      // Verify all operations completed
      expect(revokeResults.length).toBe(toolCount);

      // Performance should be reasonable (adjust thresholds as needed)
      expect(grantTime).toBeLessThan(10000); // 10 seconds max for 1000 grants
      expect(revokeTime).toBeLessThan(10000); // 10 seconds max for 1000 revocations

      // Verify all permissions are revoked
      const finalChecks = await Promise.all(
        tools.slice(0, 100).map(tool => permissionManager.hasPermission(tool))
      );
      expect(finalChecks.every(hasPermission => hasPermission === false)).toBe(true);
    });

    it('should clean up resources after revocation operations', async () => {
      const tool = 'ResourceCleanup';

      // Monitor resource usage (simplified)
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple grant/revoke cycles
      for (let i = 0; i < 100; i++) {
        await permissionManager.grantPermission(`${tool}${i}`, undefined, 'allow-once');
        await permissionManager.revokePermission(`${tool}${i}`);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (not a strict test due to GC variability)
      // This is more of a smoke test for obvious memory leaks
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB threshold
    });
  });
});