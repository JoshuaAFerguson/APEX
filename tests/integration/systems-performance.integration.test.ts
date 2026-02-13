/**
 * Systems Performance Integration Tests
 *
 * This test suite validates performance characteristics and behavior
 * under load for the integrated tool, permission, and browser systems.
 *
 * Performance aspects tested:
 * - High-throughput concurrent operations
 * - Memory usage and resource management
 * - Permission system overhead
 * - Browser resource lifecycle management
 * - Error recovery under stress
 * - Event system performance
 * - Database query optimization under load
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'os';

import type { PermissionLevel, AgentTool } from '@apexcli/core';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';

// Mock Playwright with performance characteristics
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve({
      newContext: vi.fn(() => Promise.resolve({
        newPage: vi.fn(() => Promise.resolve(createMockPage())),
        close: vi.fn(() => Promise.resolve())
      })),
      close: vi.fn(() => Promise.resolve())
    }))
  }
}));

function createMockPage() {
  return {
    url: vi.fn(() => 'about:blank'),
    title: vi.fn(() => Promise.resolve('Test Page')),
    goto: vi.fn(() =>
      new Promise(resolve =>
        setTimeout(() => resolve({ status: () => 200 }), Math.random() * 20) // 0-20ms delay
      )
    ),
    click: vi.fn(() =>
      new Promise(resolve =>
        setTimeout(() => resolve(), Math.random() * 10) // 0-10ms delay
      )
    ),
    screenshot: vi.fn(() =>
      new Promise(resolve => {
        const size = Math.floor(Math.random() * 1024 * 100); // 0-100KB
        setTimeout(() => resolve(Buffer.alloc(size)), Math.random() * 50); // 0-50ms delay
      })
    ),
    evaluate: vi.fn(() =>
      new Promise(resolve =>
        setTimeout(() => resolve('result'), Math.random() * 30) // 0-30ms delay
      )
    ),
    close: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    viewportSize: vi.fn(() => ({ width: 1920, height: 1080 }))
  };
}

// Performance monitoring utility
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private memoryBaseline?: NodeJS.MemoryUsage;

  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getStats(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 };
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length
    };
  }

  setMemoryBaseline() {
    this.memoryBaseline = process.memoryUsage();
  }

  getMemoryDelta() {
    if (!this.memoryBaseline) return null;
    const current = process.memoryUsage();
    return {
      heapUsed: current.heapUsed - this.memoryBaseline.heapUsed,
      heapTotal: current.heapTotal - this.memoryBaseline.heapTotal,
      external: current.external - this.memoryBaseline.external
    };
  }

  reset() {
    this.metrics.clear();
    this.memoryBaseline = undefined;
  }
}

// Mock tool with performance monitoring
function createPerformanceMockTool(
  name: string,
  permissionManager: PermissionManager,
  monitor: PerformanceMonitor,
  simulateComplexity: boolean = false
) {
  return {
    name,
    execute: async ({ operation, params }: any) => {
      const startTime = Date.now();

      try {
        // Permission check
        const permissionResult = await permissionManager.checkToolPermission(name as AgentTool, {
          scope: operation,
          context: params
        });

        if (!permissionResult.allowed) {
          const endTime = Date.now();
          monitor.recordMetric(`${name}_permission_denied_time`, endTime - startTime);
          return {
            success: false,
            error: `Permission denied: ${permissionResult.denialReason}`
          };
        }

        // Simulate operation complexity
        if (simulateComplexity) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50)); // 0-50ms
        }

        const endTime = Date.now();
        monitor.recordMetric(`${name}_execution_time`, endTime - startTime);
        monitor.recordMetric(`${name}_success_count`, 1);

        return {
          success: true,
          data: { result: `${name} ${operation} completed` }
        };
      } catch (error) {
        const endTime = Date.now();
        monitor.recordMetric(`${name}_error_time`, endTime - startTime);
        monitor.recordMetric(`${name}_error_count`, 1);
        throw error;
      }
    }
  };
}

describe('Systems Performance Integration', () => {
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let eventEmitter: EventEmitter;
  let browserTool: BrowserTool;
  let monitor: PerformanceMonitor;
  let toolSuite: Map<string, any>;

  beforeEach(async () => {
    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();
    monitor = new PerformanceMonitor();
    toolSuite = new Map();

    browserTool = new BrowserTool({
      permissionManager,
      eventEmitter,
      backend: 'playwright'
    });

    // Create performance-monitored tool suite
    const toolNames = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];
    toolNames.forEach(name => {
      toolSuite.set(name, createPerformanceMockTool(name, permissionManager, monitor, true));
    });

    vi.clearAllMocks();
    monitor.setMemoryBaseline();
  });

  afterEach(async () => {
    await browserTool.cleanup();
    monitor.reset();
  });

  describe('High-Throughput Concurrent Operations', () => {
    it('should handle 100+ concurrent tool operations efficiently', async () => {
      // Grant permissions for all tools
      const toolNames = Array.from(toolSuite.keys());
      await Promise.all(
        toolNames.map(name => permissionManager.grantPermission(name, 'allow-always'))
      );

      const operationCount = 100;
      const startTime = Date.now();

      // Create mixed concurrent operations
      const operations = [];
      for (let i = 0; i < operationCount; i++) {
        const toolName = toolNames[i % toolNames.length];
        const tool = toolSuite.get(toolName);
        operations.push(tool.execute({
          operation: `operation${i}`,
          params: { index: i }
        }));
      }

      const results = await Promise.allSettled(operations);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Performance assertions
      expect(totalDuration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(results.length).toBe(operationCount);

      // At least 95% success rate
      const successCount = results.filter(r =>
        r.status === 'fulfilled' && (r.value as any).success
      ).length;
      expect(successCount / operationCount).toBeGreaterThan(0.95);

      // Check average execution time per operation
      toolNames.forEach(toolName => {
        const stats = monitor.getStats(`${toolName}_execution_time`);
        if (stats.count > 0) {
          expect(stats.avg).toBeLessThan(100); // Average under 100ms per operation
        }
      });

      // Memory usage should be reasonable
      const memoryDelta = monitor.getMemoryDelta();
      if (memoryDelta) {
        expect(memoryDelta.heapUsed).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
      }
    });

    it('should handle mixed browser and tool operations under load', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('Read', 'allow-always');
      await permissionManager.grantPermission('Write', 'allow-always');

      const operationCount = 50;
      const operations = [];

      // Mix of browser and tool operations
      for (let i = 0; i < operationCount; i++) {
        if (i % 3 === 0) {
          // Browser operations
          operations.push(browserTool.execute({
            operation: 'navigate',
            params: { url: `https://test${i}.com` }
          }));
        } else if (i % 3 === 1) {
          // Read operations
          operations.push(toolSuite.get('Read').execute({
            operation: 'readFile',
            params: { path: `/test/file${i}.txt` }
          }));
        } else {
          // Write operations
          operations.push(toolSuite.get('Write').execute({
            operation: 'writeFile',
            params: { path: `/test/output${i}.txt`, content: `data${i}` }
          }));
        }
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(3000); // Under 3 seconds for mixed load

      // High success rate expected
      const successCount = results.filter(r =>
        r.status === 'fulfilled' && (r.value as any).success
      ).length;
      expect(successCount / operationCount).toBeGreaterThan(0.90);

      // Browser should remain stable after load
      expect(browserTool.getState()).toBeDefined();
    });

    it('should maintain performance with rapid permission changes', async () => {
      const operationCount = 100;
      const startTime = Date.now();

      // Rapidly alternate permissions while executing operations
      const operations = [];
      for (let i = 0; i < operationCount; i++) {
        // Change permissions every 10 operations
        if (i % 10 === 0) {
          if (i % 20 === 0) {
            await permissionManager.grantPermission('Read', 'allow-always');
          } else {
            await permissionManager.denyPermission('Read');
          }
        }

        operations.push(toolSuite.get('Read').execute({
          operation: 'rapidTest',
          params: { iteration: i }
        }));
      }

      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should be fast despite permission changes

      // Results should be consistent with permission states
      const successCount = results.filter(r =>
        r.status === 'fulfilled' && (r.value as any).success
      ).length;

      // Some operations should succeed and some should fail based on permission timing
      expect(successCount).toBeGreaterThan(0);
      expect(successCount).toBeLessThan(operationCount);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should manage memory efficiently during large operations', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      const iterationCount = 20;
      const memoryMeasurements = [];

      for (let i = 0; i < iterationCount; i++) {
        // Take memory measurement
        const beforeMemory = process.memoryUsage();

        // Perform memory-intensive operation (large screenshot)
        const result = await browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: true }
        });

        const afterMemory = process.memoryUsage();
        memoryMeasurements.push({
          iteration: i,
          heapUsedDelta: afterMemory.heapUsed - beforeMemory.heapUsed,
          success: result.success
        });

        expect(result.success).toBe(true);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      // Memory growth should be bounded
      const lastMeasurement = memoryMeasurements[memoryMeasurements.length - 1];
      const firstMeasurement = memoryMeasurements[0];
      const totalMemoryGrowth = lastMeasurement.heapUsedDelta - firstMeasurement.heapUsedDelta;

      // Total memory growth should be reasonable (less than 100MB)
      expect(Math.abs(totalMemoryGrowth)).toBeLessThan(100 * 1024 * 1024);

      // System should remain stable
      expect(browserTool.isActive()).toBe(true);
    });

    it('should cleanup resources properly after many browser sessions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      const sessionCount = 10;
      const resourceStates = [];

      for (let i = 0; i < sessionCount; i++) {
        // Create new browser session by executing operation
        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: `https://session${i}.com` }
        });

        expect(result.success).toBe(true);

        // Record resource state
        resourceStates.push({
          session: i,
          resourceState: browserTool.getResourceState(),
          isActive: browserTool.isActive()
        });

        // Periodically cleanup to simulate real usage
        if (i % 3 === 2) {
          await browserTool.cleanup();
        }
      }

      // Final cleanup
      await browserTool.cleanup();

      // Verify proper resource tracking
      resourceStates.forEach((state, index) => {
        expect(state.resourceState.sessionId).toBeDefined();
        expect(typeof state.isActive).toBe('boolean');
      });

      // Final state should be cleaned up
      const finalState = browserTool.getResourceState();
      expect(finalState.browserActive).toBe(false);
      expect(finalState.contextActive).toBe(false);
      expect(finalState.pageActive).toBe(false);
    });

    it('should handle resource contention gracefully', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      const concurrentSessionCount = 15;
      const operations = [];

      // Create many concurrent resource-intensive operations
      for (let i = 0; i < concurrentSessionCount; i++) {
        operations.push(browserTool.execute({
          operation: 'screenshot',
          params: {
            fullPage: true,
            format: 'png'
          }
        }));
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      // Should complete within reasonable time despite resource contention
      expect(endTime - startTime).toBeLessThan(5000);

      // Most operations should succeed despite contention
      const successCount = results.filter(r =>
        r.status === 'fulfilled' && (r.value as any).success
      ).length;
      expect(successCount).toBeGreaterThan(concurrentSessionCount * 0.8);

      // System should remain stable
      expect(browserTool).toBeDefined();
    });
  });

  describe('Permission System Performance', () => {
    it('should handle high-frequency permission checks efficiently', async () => {
      const checkCount = 1000;
      const startTime = Date.now();

      // Perform rapid permission checks
      const checks = [];
      for (let i = 0; i < checkCount; i++) {
        checks.push(permissionManager.checkPermission('TestTool', `scope${i % 10}`));
      }

      const results = await Promise.all(checks);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
      expect(results.length).toBe(checkCount);

      // All checks should complete (even if returning null)
      results.forEach(result => {
        expect(result === null || typeof result === 'string').toBe(true);
      });
    });

    it('should scale permission database operations', async () => {
      const permissionCount = 200;
      const startTime = Date.now();

      // Create many permissions
      const creationPromises = [];
      for (let i = 0; i < permissionCount; i++) {
        const tool = `Tool${i % 20}`;
        const scope = `scope${i}`;
        const level = i % 3 === 0 ? 'allow-always' : 'allow-once';
        creationPromises.push(permissionManager.grantPermission(tool, scope, level));
      }

      await Promise.all(creationPromises);

      // Query all permissions
      const queryPromises = [];
      for (let i = 0; i < permissionCount; i++) {
        const tool = `Tool${i % 20}`;
        const scope = `scope${i}`;
        queryPromises.push(permissionManager.checkPermission(tool, scope));
      }

      const queryResults = await Promise.all(queryPromises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Under 1 second for 200 permissions
      expect(queryResults.length).toBe(permissionCount);

      // Most queries should find permissions
      const foundPermissions = queryResults.filter(result => result !== null).length;
      expect(foundPermissions).toBeGreaterThan(permissionCount * 0.8);
    });

    it('should handle permission conflicts efficiently', async () => {
      const conflictCount = 50;

      // Create overlapping permissions that might conflict
      const operations = [];
      for (let i = 0; i < conflictCount; i++) {
        operations.push(
          permissionManager.grantPermission('ConflictTool', 'allow-always'),
          permissionManager.denyPermission('ConflictTool'),
          permissionManager.grantPermission('ConflictTool', 'allow-once')
        );
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200); // Fast conflict resolution

      // All operations should complete successfully
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBe(operations.length);

      // Final permission check should work
      const finalPermission = await permissionManager.checkPermission('ConflictTool');
      expect(finalPermission).toBeDefined();
    });
  });

  describe('Event System Performance', () => {
    it('should handle high-volume event emission efficiently', async () => {
      const eventCount = 5000;
      const eventTypes = ['test:event1', 'test:event2', 'test:event3'];
      const receivedEvents: any[] = [];

      // Set up event listeners
      eventTypes.forEach(eventType => {
        eventEmitter.on(eventType, (data) => {
          receivedEvents.push({ type: eventType, data, timestamp: Date.now() });
        });
      });

      const startTime = Date.now();

      // Emit many events rapidly
      for (let i = 0; i < eventCount; i++) {
        const eventType = eventTypes[i % eventTypes.length];
        eventEmitter.emit(eventType, { index: i, data: `event${i}` });
      }

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 10));
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Very fast event emission
      expect(receivedEvents.length).toBe(eventCount);

      // Events should be in order
      for (let i = 1; i < receivedEvents.length; i++) {
        expect(receivedEvents[i].timestamp).toBeGreaterThanOrEqual(receivedEvents[i - 1].timestamp);
      }
    });

    it('should maintain event system performance under load', async () => {
      await permissionManager.grantPermission('Read', 'allow-always');

      const operationCount = 100;
      const eventCounts = new Map<string, number>();

      // Track all event types
      const eventTypes = [
        'permission:granted', 'permission:denied',
        'tool:execution:start', 'tool:execution:complete'
      ];

      eventTypes.forEach(eventType => {
        eventCounts.set(eventType, 0);
        eventEmitter.on(eventType, () => {
          eventCounts.set(eventType, eventCounts.get(eventType)! + 1);
        });
      });

      const startTime = Date.now();

      // Execute operations that generate many events
      const operations = Array.from({ length: operationCount }, (_, i) =>
        toolSuite.get('Read').execute({
          operation: 'eventTest',
          params: { index: i }
        })
      );

      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1500); // Under 1.5 seconds with full event emission

      // Should have received appropriate number of events
      const totalEvents = Array.from(eventCounts.values()).reduce((a, b) => a + b, 0);
      expect(totalEvents).toBeGreaterThan(operationCount); // At least one event per operation

      // High success rate despite event overhead
      const successCount = results.filter(r =>
        r.status === 'fulfilled' && (r.value as any).success
      ).length;
      expect(successCount / operationCount).toBeGreaterThan(0.95);
    });
  });

  describe('Error Recovery Performance', () => {
    it('should recover quickly from cascading failures', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      let failureInjected = false;
      const originalGoto = browserTool.execute.bind(browserTool);

      // Inject failures for first few operations
      let operationCount = 0;
      vi.spyOn(browserTool, 'execute').mockImplementation(async (params) => {
        operationCount++;
        if (operationCount <= 5 && !failureInjected) {
          failureInjected = true;
          throw new Error('Simulated cascade failure');
        }
        return originalGoto(params);
      });

      const testOperations = [];
      for (let i = 0; i < 20; i++) {
        testOperations.push(browserTool.execute({
          operation: 'navigate',
          params: { url: `https://recovery${i}.com` }
        }));
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(testOperations);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Fast recovery

      // Should have some failures followed by successes (recovery)
      const failures = results.filter(r => r.status === 'rejected').length;
      const successes = results.filter(r => r.status === 'fulfilled').length;

      expect(failures).toBeGreaterThan(0); // Some failures expected
      expect(successes).toBeGreaterThan(failures); // More successes after recovery
    });

    it('should handle resource exhaustion gracefully', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Simulate resource exhaustion by creating many concurrent operations
      const exhaustionCount = 25;
      const operations = Array.from({ length: exhaustionCount }, (_, i) =>
        browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: true, path: `/tmp/stress${i}.png` }
        })
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      // Should complete without hanging
      expect(endTime - startTime).toBeLessThan(10000); // Under 10 seconds

      // Some operations should succeed despite resource pressure
      const successCount = results.filter(r =>
        r.status === 'fulfilled' && (r.value as any).success
      ).length;
      expect(successCount).toBeGreaterThan(0);

      // System should recover and remain stable
      const finalResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://recovery-test.com' }
      });
      expect(finalResult.success).toBe(true);
    });
  });
});