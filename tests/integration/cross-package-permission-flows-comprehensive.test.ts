/**
 * @fileoverview Cross-Package Permission Flows Integration Tests
 *
 * High Priority Gap: Cross-Package Integration Testing
 * Risk Level: Medium-High - Permission system fragmentation
 *
 * Tests cover:
 * - Complete user permission journey (CLI → API → Orchestrator → Store)
 * - Permission event propagation across all packages
 * - Configuration loading and application across packages
 * - Error handling consistency across package boundaries
 * - Performance under full-stack load
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { EventEmitter } from 'events';

// Import from all packages to test integration
import { Permission, PermissionLevel, PermissionQuery } from '@apexcli/core';
import { ApexOrchestrator } from '@apex/orchestrator';
import { PermissionStore } from '@apex/orchestrator/src/permission-store';
import { PermissionManager } from '@apex/orchestrator/src/permission-manager';

describe('Cross-Package Permission Flows Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let eventBus: EventEmitter;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-integration-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    // Initialize components in integration order
    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();

    permissionManager = new PermissionManager(permissionStore);

    eventBus = new EventEmitter();

    orchestrator = new ApexOrchestrator({
      apexDir: testDir,
      permissionManager,
      eventBus,
    });

    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
    if (permissionStore) {
      permissionStore.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Complete User Permission Journey', () => {
    it('should handle full permission flow from CLI to database', async () => {
      const userId = 'integration-user-' + Math.random().toString(36).substring(2);
      const sessionId = 'session-' + Math.random().toString(36).substring(2);

      // Step 1: Simulate CLI permission request
      const permissionRequest = {
        tool: 'Write',
        scope: '/test/file.txt',
        userId,
        sessionId,
        requestedLevel: 'allow-once' as PermissionLevel,
      };

      // Step 2: Orchestrator processes the request
      const orchestratorResult = await orchestrator.requestPermission(permissionRequest);

      expect(orchestratorResult).toBeDefined();
      expect(orchestratorResult.requiresApproval).toBe(true);

      // Step 3: Simulate user approval (would come from CLI)
      const approvalResponse = {
        requestId: orchestratorResult.requestId,
        approved: true,
        level: 'allow-once' as PermissionLevel,
        userId,
        sessionId,
      };

      await orchestrator.processApproval(approvalResponse);

      // Step 4: Verify permission was saved in store
      const savedPermissions = await permissionStore.listPermissions({
        tool: 'Write',
        scope: '/test/file.txt',
      });

      expect(savedPermissions).toHaveLength(1);
      expect(savedPermissions[0].tool).toBe('Write');
      expect(savedPermissions[0].level).toBe('allow-once');
      expect(savedPermissions[0].scope).toBe('/test/file.txt');

      // Step 5: Verify permission manager can retrieve it
      const managerResult = await permissionManager.checkToolPermission('Write', {
        scope: '/test/file.txt',
        userId,
        sessionId,
      });

      expect(managerResult.allowed).toBe(true);
      expect(managerResult.level).toBe('allow-once');
    });

    it('should maintain data consistency across all package layers', async () => {
      const userId = 'consistency-user';
      const permissions = [
        { tool: 'Read', level: 'allow-always' as PermissionLevel, scope: '/public' },
        { tool: 'Write', level: 'allow-once' as PermissionLevel, scope: '/tmp' },
        { tool: 'Execute', level: 'deny' as PermissionLevel, scope: '/bin' },
      ];

      // Save permissions through orchestrator
      for (const permissionData of permissions) {
        const permission: Permission = {
          ...permissionData,
          createdAt: new Date(),
        };

        await orchestrator.grantPermission(permission, { userId });
      }

      // Verify through all layers
      for (const permissionData of permissions) {
        // Check through permission manager
        const managerResult = await permissionManager.checkToolPermission(permissionData.tool, {
          scope: permissionData.scope,
          userId,
        });

        if (permissionData.level === 'deny') {
          expect(managerResult.allowed).toBe(false);
        } else {
          expect(managerResult.allowed).toBe(true);
        }

        // Check through permission store
        const storeResults = await permissionStore.listPermissions({
          tool: permissionData.tool,
          scope: permissionData.scope,
        });

        expect(storeResults).toHaveLength(1);
        expect(storeResults[0].level).toBe(permissionData.level);
      }
    });

    it('should handle permission consumption across package boundaries', async () => {
      const userId = 'consumption-user';

      // Grant allow-once permission through orchestrator
      const allowOncePermission: Permission = {
        tool: 'OneTimeAction',
        level: 'allow-once' as PermissionLevel,
        createdAt: new Date(),
      };

      await orchestrator.grantPermission(allowOncePermission, { userId });

      // First use through permission manager (should succeed and consume)
      const firstUse = await permissionManager.checkToolPermission('OneTimeAction', {
        userId,
        consume: true,
      });

      expect(firstUse.allowed).toBe(true);
      expect(firstUse.consumed).toBe(true);

      // Verify consumption is reflected in store
      const remainingPermissions = await permissionStore.listPermissions({
        tool: 'OneTimeAction',
        consumed: false,
      });

      expect(remainingPermissions).toHaveLength(0);

      // Second use should fail
      const secondUse = await permissionManager.checkToolPermission('OneTimeAction', {
        userId,
        consume: true,
      });

      expect(secondUse.allowed).toBe(false);
      expect(secondUse.reason).toContain('consumed');
    });
  });

  describe('Permission Event Propagation Across Packages', () => {
    it('should propagate permission events from store to all listeners', async () => {
      const events: Array<{ type: string; data: any }> = [];

      // Set up event listeners across components
      permissionStore.on('permission:granted', (data) => {
        events.push({ type: 'store:permission:granted', data });
      });

      permissionManager.on('permission:checked', (data) => {
        events.push({ type: 'manager:permission:checked', data });
      });

      orchestrator.on('permission:requested', (data) => {
        events.push({ type: 'orchestrator:permission:requested', data });
      });

      const userId = 'event-test-user';
      const permission: Permission = {
        tool: 'EventTest',
        level: 'allow-always' as PermissionLevel,
        createdAt: new Date(),
      };

      // Trigger permission operations
      await orchestrator.grantPermission(permission, { userId });
      await permissionManager.checkToolPermission('EventTest', { userId });

      // Verify events were propagated
      expect(events.length).toBeGreaterThan(0);

      const grantEvents = events.filter(e => e.type.includes('granted'));
      const checkEvents = events.filter(e => e.type.includes('checked'));

      expect(grantEvents.length).toBeGreaterThan(0);
      expect(checkEvents.length).toBeGreaterThan(0);
    });

    it('should handle event propagation failures gracefully', async () => {
      const userId = 'error-event-user';

      // Set up a listener that throws an error
      permissionStore.on('permission:granted', () => {
        throw new Error('Simulated event handler error');
      });

      const permission: Permission = {
        tool: 'ErrorEventTest',
        level: 'allow-once' as PermissionLevel,
        createdAt: new Date(),
      };

      // Permission operations should still succeed despite event handler errors
      await expect(
        orchestrator.grantPermission(permission, { userId })
      ).resolves.not.toThrow();

      // Verify permission was still saved
      const results = await permissionStore.listPermissions({
        tool: 'ErrorEventTest',
      });

      expect(results).toHaveLength(1);
    });

    it('should maintain event ordering across concurrent operations', async () => {
      const eventLog: Array<{ timestamp: number; event: string; tool: string }> = [];
      const userId = 'concurrent-events-user';

      // Set up event logging
      ['permission:granted', 'permission:checked', 'permission:denied'].forEach(eventType => {
        permissionStore.on(eventType, (data) => {
          eventLog.push({
            timestamp: Date.now(),
            event: eventType,
            tool: data.tool || 'unknown',
          });
        });
      });

      // Create concurrent permission operations
      const concurrentOperations = Array.from({ length: 10 }, (_, i) =>
        orchestrator.grantPermission({
          tool: `ConcurrentTool${i}`,
          level: 'allow-once' as PermissionLevel,
          createdAt: new Date(),
        }, { userId })
      );

      await Promise.all(concurrentOperations);

      // Verify events were logged in reasonable order
      expect(eventLog.length).toBe(10);

      // Events should be roughly chronological (allowing for small timing variations)
      for (let i = 1; i < eventLog.length; i++) {
        const timeDiff = eventLog[i].timestamp - eventLog[i - 1].timestamp;
        expect(timeDiff).toBeGreaterThanOrEqual(-10); // Allow 10ms tolerance
      }
    });
  });

  describe('Configuration Loading and Application', () => {
    it('should apply configuration consistently across all packages', async () => {
      const config = {
        permissions: {
          defaultLevel: 'deny' as PermissionLevel,
          requireConfirmation: true,
          sessionTimeout: 3600,
        },
        tools: {
          Write: { level: 'allow-once' as PermissionLevel, timeout: 1800 },
          Read: { level: 'allow-always' as PermissionLevel },
          Execute: { level: 'deny' as PermissionLevel },
        },
      };

      // Apply configuration through orchestrator
      await orchestrator.updateConfiguration(config);

      const userId = 'config-test-user';

      // Test tool-specific configuration application
      const writeResult = await permissionManager.checkToolPermission('Write', { userId });
      expect(writeResult.requiresConfirmation).toBe(true);

      const readResult = await permissionManager.checkToolPermission('Read', { userId });
      expect(readResult.level).toBe('allow-always');

      const executeResult = await permissionManager.checkToolPermission('Execute', { userId });
      expect(executeResult.allowed).toBe(false);
      expect(executeResult.level).toBe('deny');
    });

    it('should handle configuration updates across packages', async () => {
      const userId = 'config-update-user';

      // Initial configuration
      const initialConfig = {
        tools: {
          TestTool: { level: 'allow-once' as PermissionLevel },
        },
      };

      await orchestrator.updateConfiguration(initialConfig);

      // Verify initial configuration
      let result = await permissionManager.checkToolPermission('TestTool', { userId });
      expect(result.level).toBe('allow-once');

      // Update configuration
      const updatedConfig = {
        tools: {
          TestTool: { level: 'allow-always' as PermissionLevel },
        },
      };

      await orchestrator.updateConfiguration(updatedConfig);

      // Verify updated configuration is applied
      result = await permissionManager.checkToolPermission('TestTool', { userId });
      expect(result.level).toBe('allow-always');
    });

    it('should validate configuration consistency across packages', async () => {
      const invalidConfigs = [
        {
          tools: {
            InvalidTool: { level: 'invalid-level' as any },
          },
        },
        {
          permissions: {
            defaultLevel: null as any,
          },
        },
        {
          tools: {
            NullTool: null as any,
          },
        },
      ];

      for (const invalidConfig of invalidConfigs) {
        await expect(
          orchestrator.updateConfiguration(invalidConfig)
        ).rejects.toThrow();
      }
    });
  });

  describe('Error Handling Consistency Across Package Boundaries', () => {
    it('should handle database connection failures consistently', async () => {
      // Simulate database connection failure
      permissionStore.close();

      const userId = 'db-error-user';
      const permission: Permission = {
        tool: 'DBErrorTest',
        level: 'allow-once' as PermissionLevel,
        createdAt: new Date(),
      };

      // All layers should handle the database error gracefully
      await expect(
        orchestrator.grantPermission(permission, { userId })
      ).rejects.toThrow(/database/i);

      await expect(
        permissionManager.checkToolPermission('DBErrorTest', { userId })
      ).rejects.toThrow(/database/i);
    });

    it('should maintain error context across package boundaries', async () => {
      const userId = 'error-context-user';

      try {
        await orchestrator.requestPermission({
          tool: 'NonexistentTool',
          scope: '/invalid/path',
          userId,
          requestedLevel: 'invalid-level' as any,
        });

        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Error should contain context from multiple layers
        expect(error.message).toContain('NonexistentTool');
        expect(error.context).toBeDefined();
        expect(error.context.userId).toBe(userId);
        expect(error.context.tool).toBe('NonexistentTool');
      }
    });

    it('should provide consistent error formats across packages', async () => {
      const userId = 'error-format-user';
      const errorScenarios = [
        {
          operation: () => permissionManager.checkToolPermission('', { userId }),
          expectedErrorType: 'ValidationError',
        },
        {
          operation: () => orchestrator.grantPermission({
            tool: 'Test',
            level: 'invalid' as any,
            createdAt: new Date(),
          }, { userId }),
          expectedErrorType: 'ValidationError',
        },
      ];

      for (const scenario of errorScenarios) {
        try {
          await scenario.operation();
          expect.fail(`Should have thrown ${scenario.expectedErrorType}`);
        } catch (error: any) {
          expect(error.name || error.constructor.name).toContain('Error');
          expect(error.message).toBeTypeOf('string');
          expect(error.message.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Performance Under Full-Stack Load', () => {
    it('should maintain performance under concurrent cross-package operations', async () => {
      const userCount = 50;
      const operationsPerUser = 10;
      const users = Array.from({ length: userCount }, (_, i) => `load-user-${i}`);

      const startTime = Date.now();

      const allOperations = users.flatMap(userId =>
        Array.from({ length: operationsPerUser }, (_, i) => {
          const permission: Permission = {
            tool: `LoadTool${i}`,
            level: 'allow-once' as PermissionLevel,
            createdAt: new Date(),
          };

          return orchestrator.grantPermission(permission, { userId });
        })
      );

      await Promise.all(allOperations);

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const totalOperations = userCount * operationsPerUser;

      // Should complete within reasonable time (less than 10 seconds for 500 operations)
      expect(totalTime).toBeLessThan(10000);

      // Average operation time should be reasonable (less than 100ms)
      const avgTimePerOperation = totalTime / totalOperations;
      expect(avgTimePerOperation).toBeLessThan(100);

      // Verify all permissions were saved correctly
      const allPermissions = await permissionStore.listPermissions();
      expect(allPermissions.length).toBe(totalOperations);
    });

    it('should handle memory efficiently during extended cross-package operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const userId = 'memory-test-user';

      // Perform many operations to test memory efficiency
      for (let batch = 0; batch < 10; batch++) {
        const batchOperations = Array.from({ length: 100 }, (_, i) => {
          const permission: Permission = {
            tool: `MemoryTool${batch}-${i}`,
            level: 'allow-once' as PermissionLevel,
            createdAt: new Date(),
          };

          return orchestrator.grantPermission(permission, { userId });
        });

        await Promise.all(batchOperations);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB for 1000 operations)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should maintain response times under sustained load', async () => {
      const userId = 'response-time-user';
      const responseTimes: number[] = [];

      // Test response times over sustained operations
      for (let i = 0; i < 100; i++) {
        const startTime = Date.now();

        await permissionManager.checkToolPermission(`TimingTool${i}`, {
          userId,
        });

        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      // Calculate statistics
      const avgResponseTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      // Response times should be consistently fast
      expect(avgResponseTime).toBeLessThan(50); // 50ms average
      expect(maxResponseTime).toBeLessThan(200); // 200ms max
      expect(minResponseTime).toBeGreaterThan(0); // Should take some time

      // Response times should be relatively consistent (low variance)
      const variance = responseTimes.reduce((acc, time) =>
        acc + Math.pow(time - avgResponseTime, 2), 0) / responseTimes.length;
      const stdDev = Math.sqrt(variance);

      expect(stdDev).toBeLessThan(25); // Low standard deviation
    });
  });
});