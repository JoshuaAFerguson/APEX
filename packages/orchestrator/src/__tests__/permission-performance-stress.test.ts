/**
 * @fileoverview Permission System Performance and Stress Tests
 *
 * Medium Priority Gap: Performance and Stress Testing
 * Risk Level: Medium - System degradation under load
 *
 * Tests cover:
 * - 10,000+ simultaneous permission checks
 * - Database performance under heavy concurrent writes
 * - Memory usage under sustained permission operations
 * - Permission cache performance optimization
 * - Event broadcast performance with many listeners
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionStore } from '../permission-store';
import { PermissionManager } from '../permission-manager';
import { Permission, PermissionLevel } from '@apexcli/core';
import { EventEmitter } from 'events';

describe('Permission System Performance and Stress Tests', () => {
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-perf-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();

    permissionManager = new PermissionManager(permissionStore);
  });

  afterEach(() => {
    if (permissionStore) {
      permissionStore.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('High-Volume Permission Checks', () => {
    it('should handle 10,000+ simultaneous permission checks efficiently', async () => {
      const checkCount = 10000;
      const userId = 'performance-user';

      // Pre-populate with permissions for testing
      const batchSize = 100;
      for (let batch = 0; batch < checkCount / batchSize; batch++) {
        const permissions = Array.from({ length: batchSize }, (_, i) => ({
          tool: `PerfTool${batch * batchSize + i}`,
          level: 'allow-once' as PermissionLevel,
          createdAt: new Date(),
        }));

        const savePromises = permissions.map(perm =>
          permissionStore.savePermission(perm, { userId })
        );

        await Promise.all(savePromises);
      }

      // Measure performance of simultaneous checks
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();

      const checkPromises = Array.from({ length: checkCount }, (_, i) =>
        permissionManager.checkToolPermission(`PerfTool${i}`, { userId })
      );

      const results = await Promise.all(checkPromises);

      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();

      const totalTimeMs = Number(endTime - startTime) / 1000000;
      const avgTimePerCheck = totalTimeMs / checkCount;
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;

      // Performance expectations
      expect(totalTimeMs).toBeLessThan(30000); // Complete within 30 seconds
      expect(avgTimePerCheck).toBeLessThan(3); // Less than 3ms per check on average
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB memory increase

      // Verify all checks completed successfully
      expect(results).toHaveLength(checkCount);
      results.forEach(result => {
        expect(result).toHaveProperty('allowed');
        expect(result).toHaveProperty('level');
      });

      console.log(`Performance Stats:
        - Total time: ${totalTimeMs.toFixed(2)}ms
        - Average time per check: ${avgTimePerCheck.toFixed(3)}ms
        - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB
        - Checks per second: ${(checkCount / (totalTimeMs / 1000)).toFixed(0)}
      `);
    });

    it('should maintain consistent performance under sustained load', async () => {
      const userId = 'sustained-load-user';
      const batchCount = 20;
      const batchSize = 500;
      const batchTimes: number[] = [];

      // Pre-populate permissions
      for (let i = 0; i < batchCount * batchSize; i++) {
        await permissionStore.savePermission({
          tool: `SustainedTool${i}`,
          level: 'allow-always' as PermissionLevel,
          createdAt: new Date(),
        }, { userId });
      }

      // Run multiple batches and measure consistency
      for (let batch = 0; batch < batchCount; batch++) {
        const batchStartTime = process.hrtime.bigint();

        const batchPromises = Array.from({ length: batchSize }, (_, i) => {
          const toolIndex = batch * batchSize + i;
          return permissionManager.checkToolPermission(`SustainedTool${toolIndex}`, { userId });
        });

        await Promise.all(batchPromises);

        const batchEndTime = process.hrtime.bigint();
        const batchTimeMs = Number(batchEndTime - batchStartTime) / 1000000;
        batchTimes.push(batchTimeMs);
      }

      // Analyze consistency
      const avgBatchTime = batchTimes.reduce((a, b) => a + b) / batchTimes.length;
      const maxBatchTime = Math.max(...batchTimes);
      const minBatchTime = Math.min(...batchTimes);
      const variance = batchTimes.reduce((acc, time) =>
        acc + Math.pow(time - avgBatchTime, 2), 0) / batchTimes.length;
      const stdDev = Math.sqrt(variance);

      // Consistency expectations
      expect(maxBatchTime - minBatchTime).toBeLessThan(avgBatchTime); // Variation should be less than average
      expect(stdDev).toBeLessThan(avgBatchTime * 0.3); // Standard deviation should be less than 30% of average

      console.log(`Consistency Stats:
        - Average batch time: ${avgBatchTime.toFixed(2)}ms
        - Min/Max batch time: ${minBatchTime.toFixed(2)}ms / ${maxBatchTime.toFixed(2)}ms
        - Standard deviation: ${stdDev.toFixed(2)}ms
        - Coefficient of variation: ${((stdDev / avgBatchTime) * 100).toFixed(1)}%
      `);
    });

    it('should scale efficiently with increasing permission count', async () => {
      const userId = 'scaling-user';
      const scalingSteps = [100, 500, 1000, 5000, 10000];
      const scalingResults: Array<{ count: number; timeMs: number; avgTime: number }> = [];

      for (const permissionCount of scalingSteps) {
        // Clear previous data
        permissionStore.close();
        rmSync(testDir, { recursive: true, force: true });
        mkdirSync(testDir, { recursive: true });

        permissionStore = new PermissionStore(testDir);
        await permissionStore.initialize();
        permissionManager = new PermissionManager(permissionStore);

        // Create permissions for this scale
        const savePromises = Array.from({ length: permissionCount }, (_, i) =>
          permissionStore.savePermission({
            tool: `ScaleTool${i}`,
            level: 'allow-always' as PermissionLevel,
            createdAt: new Date(),
          }, { userId })
        );

        await Promise.all(savePromises);

        // Measure check performance at this scale
        const checkCount = Math.min(1000, permissionCount); // Check up to 1000 permissions
        const startTime = process.hrtime.bigint();

        const checkPromises = Array.from({ length: checkCount }, (_, i) =>
          permissionManager.checkToolPermission(`ScaleTool${i}`, { userId })
        );

        await Promise.all(checkPromises);

        const endTime = process.hrtime.bigint();
        const timeMs = Number(endTime - startTime) / 1000000;
        const avgTime = timeMs / checkCount;

        scalingResults.push({
          count: permissionCount,
          timeMs,
          avgTime,
        });
      }

      // Analyze scaling characteristics
      console.log('Scaling Results:');
      scalingResults.forEach(result => {
        console.log(`  ${result.count} permissions: ${result.avgTime.toFixed(3)}ms avg, ${result.timeMs.toFixed(2)}ms total`);
      });

      // Performance should not degrade significantly with scale
      const firstAvgTime = scalingResults[0].avgTime;
      const lastAvgTime = scalingResults[scalingResults.length - 1].avgTime;
      const degradationFactor = lastAvgTime / firstAvgTime;

      expect(degradationFactor).toBeLessThan(5); // Less than 5x degradation from 100 to 10,000 permissions
    });
  });

  describe('Database Performance Under Heavy Concurrent Writes', () => {
    it('should handle concurrent permission saves without corruption', async () => {
      const concurrentWrites = 1000;
      const userCount = 50;
      const users = Array.from({ length: userCount }, (_, i) => `concurrent-user-${i}`);

      const writePromises = Array.from({ length: concurrentWrites }, (_, i) => {
        const userId = users[i % userCount];
        const permission: Permission = {
          tool: `ConcurrentTool${i}`,
          level: 'allow-once' as PermissionLevel,
          scope: `/path/${i}`,
          createdAt: new Date(),
        };

        return permissionStore.savePermission(permission, { userId });
      });

      const startTime = process.hrtime.bigint();
      await Promise.all(writePromises);
      const endTime = process.hrtime.bigint();

      const totalTimeMs = Number(endTime - startTime) / 1000000;
      const avgWriteTime = totalTimeMs / concurrentWrites;

      // Verify all writes completed
      const allPermissions = await permissionStore.listPermissions();
      expect(allPermissions).toHaveLength(concurrentWrites);

      // Performance expectations
      expect(totalTimeMs).toBeLessThan(60000); // Complete within 60 seconds
      expect(avgWriteTime).toBeLessThan(60); // Less than 60ms per write on average

      // Verify data integrity
      const toolNames = new Set(allPermissions.map(p => p.tool));
      expect(toolNames.size).toBe(concurrentWrites); // All unique tools saved

      console.log(`Concurrent Write Stats:
        - Total time: ${totalTimeMs.toFixed(2)}ms
        - Average write time: ${avgWriteTime.toFixed(3)}ms
        - Writes per second: ${(concurrentWrites / (totalTimeMs / 1000)).toFixed(0)}
      `);
    });

    it('should handle read-write contention efficiently', async () => {
      const userId = 'contention-user';
      const operationCount = 1000;

      // Pre-populate with some data
      for (let i = 0; i < 100; i++) {
        await permissionStore.savePermission({
          tool: `ContentionTool${i}`,
          level: 'allow-always' as PermissionLevel,
          createdAt: new Date(),
        }, { userId });
      }

      // Create mixed read/write operations
      const operations = Array.from({ length: operationCount }, (_, i) => {
        if (i % 3 === 0) {
          // Write operation
          return permissionStore.savePermission({
            tool: `NewTool${i}`,
            level: 'allow-once' as PermissionLevel,
            createdAt: new Date(),
          }, { userId });
        } else {
          // Read operation
          return permissionStore.listPermissions({
            tool: `ContentionTool${i % 100}`,
          });
        }
      });

      const startTime = process.hrtime.bigint();
      await Promise.all(operations);
      const endTime = process.hrtime.bigint();

      const totalTimeMs = Number(endTime - startTime) / 1000000;
      const avgOperationTime = totalTimeMs / operationCount;

      expect(avgOperationTime).toBeLessThan(50); // Less than 50ms per operation on average

      console.log(`Read-Write Contention Stats:
        - Total time: ${totalTimeMs.toFixed(2)}ms
        - Average operation time: ${avgOperationTime.toFixed(3)}ms
        - Operations per second: ${(operationCount / (totalTimeMs / 1000)).toFixed(0)}
      `);
    });

    it('should maintain database integrity under extreme concurrent load', async () => {
      const extremeLoadCount = 5000;
      const userCount = 100;
      const users = Array.from({ length: userCount }, (_, i) => `extreme-user-${i}`);

      // Create operations that could potentially conflict
      const conflictingOperations = Array.from({ length: extremeLoadCount }, (_, i) => {
        const userId = users[i % userCount];
        const toolName = `SharedTool${i % 10}`; // Many operations on same tool names

        return permissionStore.savePermission({
          tool: toolName,
          level: 'allow-once' as PermissionLevel,
          scope: `/different/scope/${i}`,
          createdAt: new Date(),
        }, { userId });
      });

      await Promise.all(conflictingOperations);

      // Verify database integrity
      const allPermissions = await permissionStore.listPermissions();
      expect(allPermissions).toHaveLength(extremeLoadCount);

      // Check for data corruption indicators
      for (const permission of allPermissions) {
        expect(permission.tool).toMatch(/^SharedTool\d$/);
        expect(permission.level).toBe('allow-once');
        expect(permission.scope).toMatch(/^\/different\/scope\/\d+$/);
        expect(permission.createdAt).toBeInstanceOf(Date);
      }

      // Verify no duplicate entries (tool + scope + userId combinations should be unique)
      const uniqueEntries = new Set(
        allPermissions.map(p => `${p.tool}-${p.scope}`)
      );
      expect(uniqueEntries.size).toBe(extremeLoadCount);
    });
  });

  describe('Memory Usage Under Sustained Operations', () => {
    it('should maintain stable memory usage during extended operations', async () => {
      const userId = 'memory-test-user';
      const operationCycles = 50;
      const operationsPerCycle = 200;
      const memoryMeasurements: number[] = [];

      // Initial memory measurement
      if (global.gc) global.gc(); // Force garbage collection if available
      const initialMemory = process.memoryUsage().heapUsed;
      memoryMeasurements.push(initialMemory);

      for (let cycle = 0; cycle < operationCycles; cycle++) {
        // Perform a cycle of operations
        const cycleOperations = Array.from({ length: operationsPerCycle }, (_, i) =>
          permissionStore.savePermission({
            tool: `MemoryTool${cycle}-${i}`,
            level: 'allow-once' as PermissionLevel,
            createdAt: new Date(),
          }, { userId })
        );

        await Promise.all(cycleOperations);

        // Check permissions to ensure they're accessible
        const checkOperations = Array.from({ length: operationsPerCycle }, (_, i) =>
          permissionManager.checkToolPermission(`MemoryTool${cycle}-${i}`, { userId })
        );

        await Promise.all(checkOperations);

        // Measure memory usage
        if (global.gc) global.gc(); // Force garbage collection
        const currentMemory = process.memoryUsage().heapUsed;
        memoryMeasurements.push(currentMemory);
      }

      // Analyze memory growth
      const finalMemory = memoryMeasurements[memoryMeasurements.length - 1];
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      // Memory growth should be reasonable
      expect(memoryGrowthMB).toBeLessThan(200); // Less than 200MB growth for extended operations

      // Check for memory leaks (excessive linear growth)
      const firstHalf = memoryMeasurements.slice(0, Math.floor(memoryMeasurements.length / 2));
      const secondHalf = memoryMeasurements.slice(Math.floor(memoryMeasurements.length / 2));

      const firstHalfAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
      const growthRate = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;

      expect(growthRate).toBeLessThan(0.5); // Less than 50% growth rate in second half

      console.log(`Memory Usage Stats:
        - Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
        - Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB
        - Total growth: ${memoryGrowthMB.toFixed(2)}MB
        - Growth rate: ${(growthRate * 100).toFixed(1)}%
      `);
    });

    it('should efficiently clean up expired permissions', async () => {
      const userId = 'cleanup-test-user';
      const expiredPermissionCount = 1000;

      // Create permissions that expire quickly
      const expiredPermissions = Array.from({ length: expiredPermissionCount }, (_, i) => ({
        tool: `ExpiredTool${i}`,
        level: 'allow-once' as PermissionLevel,
        expiry: new Date(Date.now() + 100), // Expire in 100ms
        createdAt: new Date(),
      }));

      const savePromises = expiredPermissions.map(perm =>
        permissionStore.savePermission(perm, { userId })
      );

      await Promise.all(savePromises);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 200));

      // Measure memory before cleanup
      if (global.gc) global.gc();
      const memoryBeforeCleanup = process.memoryUsage().heapUsed;

      // Trigger cleanup
      await permissionStore.cleanupExpiredPermissions();

      // Measure memory after cleanup
      if (global.gc) global.gc();
      const memoryAfterCleanup = process.memoryUsage().heapUsed;

      // Verify permissions were cleaned up
      const remainingPermissions = await permissionStore.listPermissions();
      const expiredCount = remainingPermissions.filter(p => p.expiry && p.expiry < new Date()).length;
      expect(expiredCount).toBe(0);

      // Memory should be freed (or at least not significantly increased)
      const memoryChange = memoryAfterCleanup - memoryBeforeCleanup;
      expect(memoryChange).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase

      console.log(`Cleanup Stats:
        - Expired permissions created: ${expiredPermissionCount}
        - Remaining expired permissions: ${expiredCount}
        - Memory change: ${(memoryChange / 1024 / 1024).toFixed(2)}MB
      `);
    });
  });

  describe('Permission Cache Performance Optimization', () => {
    it('should demonstrate cache effectiveness under repeated checks', async () => {
      const userId = 'cache-test-user';
      const cacheTestTool = 'CacheTestTool';
      const checkCount = 10000;

      // Save a permission
      await permissionStore.savePermission({
        tool: cacheTestTool,
        level: 'allow-always' as PermissionLevel,
        createdAt: new Date(),
      }, { userId });

      // First batch - cache miss expected
      const firstBatchStartTime = process.hrtime.bigint();
      const firstBatchPromises = Array.from({ length: checkCount }, () =>
        permissionManager.checkToolPermission(cacheTestTool, { userId })
      );
      await Promise.all(firstBatchPromises);
      const firstBatchEndTime = process.hrtime.bigint();
      const firstBatchTime = Number(firstBatchEndTime - firstBatchStartTime) / 1000000;

      // Second batch - cache hit expected
      const secondBatchStartTime = process.hrtime.bigint();
      const secondBatchPromises = Array.from({ length: checkCount }, () =>
        permissionManager.checkToolPermission(cacheTestTool, { userId })
      );
      await Promise.all(secondBatchPromises);
      const secondBatchEndTime = process.hrtime.bigint();
      const secondBatchTime = Number(secondBatchEndTime - secondBatchStartTime) / 1000000;

      // Cache should improve performance
      const performanceImprovement = (firstBatchTime - secondBatchTime) / firstBatchTime;
      expect(performanceImprovement).toBeGreaterThan(0.1); // At least 10% improvement

      console.log(`Cache Performance Stats:
        - First batch (cache miss): ${firstBatchTime.toFixed(2)}ms
        - Second batch (cache hit): ${secondBatchTime.toFixed(2)}ms
        - Performance improvement: ${(performanceImprovement * 100).toFixed(1)}%
      `);
    });

    it('should handle cache invalidation efficiently', async () => {
      const userId = 'cache-invalidation-user';
      const toolName = 'InvalidationTool';

      // Save initial permission
      await permissionStore.savePermission({
        tool: toolName,
        level: 'allow-once' as PermissionLevel,
        createdAt: new Date(),
      }, { userId });

      // Check permission (populate cache)
      let result = await permissionManager.checkToolPermission(toolName, { userId, consume: true });
      expect(result.allowed).toBe(true);

      // Update permission (should invalidate cache)
      await permissionStore.savePermission({
        tool: toolName,
        level: 'deny' as PermissionLevel,
        createdAt: new Date(),
      }, { userId });

      // Check again (should get updated permission, not cached version)
      result = await permissionManager.checkToolPermission(toolName, { userId });
      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');
    });
  });

  describe('Event Broadcast Performance', () => {
    it('should handle many event listeners efficiently', async () => {
      const listenerCount = 1000;
      const eventCount = 1000;
      const eventEmitter = new EventEmitter();
      const userId = 'event-perf-user';

      // Set max listeners to avoid warnings
      eventEmitter.setMaxListeners(listenerCount + 100);

      // Add many listeners
      const receivedEvents: number[] = new Array(listenerCount).fill(0);
      for (let i = 0; i < listenerCount; i++) {
        eventEmitter.on('permission:granted', () => {
          receivedEvents[i]++;
        });
      }

      // Measure event broadcasting performance
      const startTime = process.hrtime.bigint();

      for (let i = 0; i < eventCount; i++) {
        eventEmitter.emit('permission:granted', {
          tool: `EventTool${i}`,
          userId,
        });
      }

      const endTime = process.hrtime.bigint();
      const totalTimeMs = Number(endTime - startTime) / 1000000;
      const avgTimePerEvent = totalTimeMs / eventCount;

      // Performance expectations
      expect(avgTimePerEvent).toBeLessThan(10); // Less than 10ms per event with 1000 listeners

      // Verify all listeners received all events
      receivedEvents.forEach(count => {
        expect(count).toBe(eventCount);
      });

      console.log(`Event Broadcasting Stats:
        - Listeners: ${listenerCount}
        - Events: ${eventCount}
        - Total time: ${totalTimeMs.toFixed(2)}ms
        - Average time per event: ${avgTimePerEvent.toFixed(3)}ms
      `);
    });

    it('should handle event listener errors without performance degradation', async () => {
      const eventEmitter = new EventEmitter();
      const goodListenerCount = 100;
      const badListenerCount = 10;
      const eventCount = 1000;

      // Add good listeners
      let goodEventCount = 0;
      for (let i = 0; i < goodListenerCount; i++) {
        eventEmitter.on('permission:test', () => {
          goodEventCount++;
        });
      }

      // Add bad listeners that throw errors
      for (let i = 0; i < badListenerCount; i++) {
        eventEmitter.on('permission:test', () => {
          throw new Error(`Bad listener ${i}`);
        });
      }

      // Measure performance with error handling
      const startTime = process.hrtime.bigint();

      for (let i = 0; i < eventCount; i++) {
        try {
          eventEmitter.emit('permission:test', { eventId: i });
        } catch (error) {
          // Errors should be caught and not stop event processing
        }
      }

      const endTime = process.hrtime.bigint();
      const totalTimeMs = Number(endTime - startTime) / 1000000;

      // Performance should still be reasonable despite errors
      const avgTimePerEvent = totalTimeMs / eventCount;
      expect(avgTimePerEvent).toBeLessThan(20); // Less than 20ms per event even with errors

      // Good listeners should still receive events
      expect(goodEventCount).toBe(eventCount * goodListenerCount);

      console.log(`Error Handling Performance Stats:
        - Good listeners: ${goodListenerCount}
        - Bad listeners: ${badListenerCount}
        - Events processed: ${eventCount}
        - Total time: ${totalTimeMs.toFixed(2)}ms
        - Good events received: ${goodEventCount}
      `);
    });
  });
});