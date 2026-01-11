import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '../index';
import {
  ToolStartHookContext,
  ToolCompleteHookContext,
  ToolErrorHookContext,
  generateTaskId,
} from '@apexcli/core';
import path from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

describe('Tool Execution Hooks - Performance Tests', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), '.test-tool-hooks-performance');
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
    mkdirSync(tempDir, { recursive: true });

    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
    });

    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('Scalability Tests', () => {
    it('should handle large number of simultaneous hooks efficiently', () => {
      const hookCount = 1000;
      const unsubscribeFunctions: (() => void)[] = [];
      const callCounts = new Map<number, number>();

      const startTime = Date.now();

      // Register many hooks
      for (let i = 0; i < hookCount; i++) {
        callCounts.set(i, 0);
        const unsub = orchestrator.onToolStart(() => {
          callCounts.set(i, callCounts.get(i)! + 1);
        });
        unsubscribeFunctions.push(unsub);
      }

      const registrationTime = Date.now() - startTime;

      // Registration should be fast
      expect(registrationTime).toBeLessThan(1000); // Less than 1 second

      // Emit a single event
      const emitStart = Date.now();
      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        callId: 'performance-test',
        timestamp: new Date(),
      });
      const emitTime = Date.now() - emitStart;

      // Event emission and hook execution should be fast
      expect(emitTime).toBeLessThan(500); // Less than 500ms

      // All hooks should have been called exactly once
      callCounts.forEach(count => {
        expect(count).toBe(1);
      });

      // Cleanup
      const cleanupStart = Date.now();
      unsubscribeFunctions.forEach(unsub => unsub());
      const cleanupTime = Date.now() - cleanupStart;

      // Cleanup should be fast
      expect(cleanupTime).toBeLessThan(1000); // Less than 1 second
    });

    it('should maintain performance with high event throughput', async () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      const eventCount = 10000;
      const batchSize = 100;
      const results: number[] = [];

      // Process events in batches to measure sustained throughput
      for (let batch = 0; batch < eventCount / batchSize; batch++) {
        const batchStart = Date.now();

        for (let i = 0; i < batchSize; i++) {
          orchestrator.emit('tool:start', {
            taskId: generateTaskId(),
            toolName: 'Read',
            input: { filePath: `test-${batch}-${i}.txt` },
            callId: `throughput-${batch}-${i}`,
            timestamp: new Date(),
          });
        }

        const batchTime = Date.now() - batchStart;
        results.push(batchTime);
      }

      // Average batch processing time should be consistent and fast
      const avgBatchTime = results.reduce((a, b) => a + b, 0) / results.length;
      expect(avgBatchTime).toBeLessThan(100); // Less than 100ms per batch of 100 events

      // Performance should not degrade significantly over time
      const firstQuarter = results.slice(0, results.length / 4);
      const lastQuarter = results.slice(-results.length / 4);

      const firstQuarterAvg = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
      const lastQuarterAvg = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;

      // Last quarter should not be more than 50% slower than first quarter
      expect(lastQuarterAvg).toBeLessThan(firstQuarterAvg * 1.5);

      expect(hook).toHaveBeenCalledTimes(eventCount);
      unsubscribe();
    });

    it('should efficiently handle mixed hook types under load', () => {
      const metrics = {
        startCalls: 0,
        completeCalls: 0,
        errorCalls: 0,
      };

      const unsubStart = orchestrator.onToolStart(() => {
        metrics.startCalls++;
      });

      const unsubComplete = orchestrator.onToolComplete(() => {
        metrics.completeCalls++;
      });

      const unsubError = orchestrator.onToolError(() => {
        metrics.errorCalls++;
      });

      // Mock tool execution for complete/error events
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId: 'mixed-load-test',
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        startTime: new Date(),
        taskId: generateTaskId(),
        status: 'in_progress' as const,
      });

      const eventCount = 5000;
      const startTime = Date.now();

      // Emit mixed events
      for (let i = 0; i < eventCount; i++) {
        const taskId = generateTaskId();
        const callId = `mixed-${i}`;

        // Start event
        orchestrator.emit('tool:start', {
          taskId,
          toolName: 'Read',
          input: { filePath: `test-${i}.txt` },
          callId,
          timestamp: new Date(),
        });

        // Complete or error event (alternating)
        orchestrator.emit('tool:complete', {
          taskId,
          toolName: 'Read',
          callId,
          result: i % 2 === 0
            ? { success: true, output: `result-${i}` }
            : { success: false, error: `error-${i}` },
          timing: { startTime: new Date(), endTime: new Date(), duration: 1 },
          timestamp: new Date(),
        });
      }

      const totalTime = Date.now() - startTime;

      // Should process all events quickly
      expect(totalTime).toBeLessThan(3000); // Less than 3 seconds for 10k events

      // Verify correct distribution
      expect(metrics.startCalls).toBe(eventCount);
      expect(metrics.completeCalls).toBe(eventCount / 2);
      expect(metrics.errorCalls).toBe(eventCount / 2);

      unsubStart();
      unsubComplete();
      unsubError();
    });
  });

  describe('Memory Efficiency Tests', () => {
    it('should not accumulate memory with repeated hook operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 100;

      // Perform many cycles of hook registration/unregistration
      for (let cycle = 0; cycle < iterations; cycle++) {
        const hooks: (() => void)[] = [];

        // Register multiple hooks
        for (let i = 0; i < 10; i++) {
          const unsub = orchestrator.onToolStart(() => {
            // Simple operation
          });
          hooks.push(unsub);
        }

        // Emit some events
        for (let i = 0; i < 5; i++) {
          orchestrator.emit('tool:start', {
            taskId: generateTaskId(),
            toolName: 'Read',
            input: { filePath: `cycle-${cycle}-${i}.txt` },
            callId: `memory-test-${cycle}-${i}`,
            timestamp: new Date(),
          });
        }

        // Unregister all hooks
        hooks.forEach(unsub => unsub());
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (less than 5MB)
      expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024);
    });

    it('should handle large context objects efficiently', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      // Create progressively larger input objects
      const sizes = [1000, 10000, 100000]; // Characters in input

      sizes.forEach(size => {
        const largeInput = {
          filePath: 'test.txt',
          data: 'x'.repeat(size),
          metadata: {
            size,
            created: new Date(),
          },
        };

        const startTime = Date.now();

        orchestrator.emit('tool:start', {
          taskId: generateTaskId(),
          toolName: 'Read',
          input: largeInput,
          callId: `large-context-${size}`,
          timestamp: new Date(),
        });

        const processingTime = Date.now() - startTime;

        // Processing time should not grow linearly with input size
        // (should be minimal since we're just passing references)
        expect(processingTime).toBeLessThan(50); // Less than 50ms
      });

      expect(hook).toHaveBeenCalledTimes(sizes.length);
      unsubscribe();
    });
  });

  describe('Concurrency Tests', () => {
    it('should handle concurrent hook registrations safely', async () => {
      const concurrentRegistrations = 100;
      const hookCalls = new Map<number, number>();

      // Register hooks concurrently
      const registrationPromises = Array.from({ length: concurrentRegistrations }, async (_, i) => {
        return new Promise<() => void>((resolve) => {
          setTimeout(() => {
            hookCalls.set(i, 0);
            const unsub = orchestrator.onToolStart(() => {
              hookCalls.set(i, hookCalls.get(i)! + 1);
            });
            resolve(unsub);
          }, Math.random() * 10); // Random delay up to 10ms
        });
      });

      const unsubscribeFunctions = await Promise.all(registrationPromises);

      // Emit event after all registrations
      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'concurrent-test.txt' },
        callId: 'concurrent-registration-test',
        timestamp: new Date(),
      });

      // Allow event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // All hooks should have been called
      expect(hookCalls.size).toBe(concurrentRegistrations);
      hookCalls.forEach(count => {
        expect(count).toBe(1);
      });

      // Cleanup
      unsubscribeFunctions.forEach(unsub => unsub());
    });

    it('should handle concurrent event emissions correctly', async () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      const concurrentEvents = 200;
      const emissionPromises = Array.from({ length: concurrentEvents }, async (_, i) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            orchestrator.emit('tool:start', {
              taskId: generateTaskId(),
              toolName: `Tool${i % 10}`, // Use different tools
              input: { data: i },
              callId: `concurrent-emit-${i}`,
              timestamp: new Date(),
            });
            resolve();
          }, Math.random() * 20); // Random delay up to 20ms
        });
      });

      const startTime = Date.now();
      await Promise.all(emissionPromises);

      // Allow all event processing to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const totalTime = Date.now() - startTime;

      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(2000); // Less than 2 seconds

      // All events should have triggered the hook
      expect(hook).toHaveBeenCalledTimes(concurrentEvents);

      // Verify all events were unique
      const callIds = new Set(
        hook.mock.calls.map(call => call[0].callId)
      );
      expect(callIds.size).toBe(concurrentEvents);

      unsubscribe();
    });
  });

  describe('Resource Usage Tests', () => {
    it('should maintain stable performance under sustained load', async () => {
      const measurements: number[] = [];
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      // Run sustained load test
      const duration = 2000; // 2 seconds
      const interval = 10; // Every 10ms
      const startTime = Date.now();

      while (Date.now() - startTime < duration) {
        const batchStart = Date.now();

        // Emit multiple events in this batch
        for (let i = 0; i < 5; i++) {
          orchestrator.emit('tool:start', {
            taskId: generateTaskId(),
            toolName: 'Read',
            input: { filePath: `sustained-${Date.now()}-${i}.txt` },
            callId: `sustained-${Date.now()}-${i}`,
            timestamp: new Date(),
          });
        }

        const batchTime = Date.now() - batchStart;
        measurements.push(batchTime);

        // Wait for next interval
        await new Promise(resolve => setTimeout(resolve, interval));
      }

      // Calculate performance metrics
      const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxTime = Math.max(...measurements);
      const minTime = Math.min(...measurements);

      // Performance should be stable
      expect(avgTime).toBeLessThan(10); // Average batch time less than 10ms
      expect(maxTime).toBeLessThan(50); // No single batch takes more than 50ms
      expect(maxTime / minTime).toBeLessThan(5); // Max is not more than 5x min

      unsubscribe();
    });
  });
});