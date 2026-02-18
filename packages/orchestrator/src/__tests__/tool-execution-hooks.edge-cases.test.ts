import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '../index';
import { TaskStore } from '../store';
import {
  ToolStartHookContext,
  ToolCompleteHookContext,
  ToolErrorHookContext,
  generateTaskId,
} from '@apexcli/core';
import path from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

describe('Tool Execution Hooks - Edge Cases', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = path.join(process.cwd(), '.test-tool-hooks-edge-cases');
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
    mkdirSync(tempDir, { recursive: true });

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
    });

    await orchestrator.initialize();
    store = orchestrator.getStore();
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('Hook Registration Edge Cases', () => {
    it('should handle rapid hook registration/unregistration', async () => {
      const hookCalls: string[] = [];

      // Register and unregister hooks rapidly
      for (let i = 0; i < 100; i++) {
        const unsub = orchestrator.onToolStart(() => {
          hookCalls.push(`hook-${i}`);
        });
        // Immediately unsubscribe half of them
        if (i % 2 === 0) {
          unsub();
        }
      }

      // Emit an event
      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        callId: 'rapid-test',
        timestamp: new Date(),
      });

      // Should only call the odd-numbered hooks (50 hooks)
      expect(hookCalls).toHaveLength(50);
    });

    it('should handle hook registration with null/undefined callbacks gracefully', () => {
      // TypeScript should prevent this, but test runtime behavior
      expect(() => {
        (orchestrator as any).onToolStart(null);
      }).not.toThrow();

      expect(() => {
        (orchestrator as any).onToolComplete(undefined);
      }).not.toThrow();

      expect(() => {
        (orchestrator as any).onToolError(null);
      }).not.toThrow();
    });

    it('should handle multiple unsubscriptions of same hook', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      // Multiple unsubscriptions should not throw
      expect(() => {
        unsubscribe();
        unsubscribe();
        unsubscribe();
      }).not.toThrow();

      // Event should not trigger hook after any unsubscription
      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        callId: 'multi-unsub-test',
        timestamp: new Date(),
      });

      expect(hook).not.toHaveBeenCalled();
    });
  });

  describe('Event Processing Edge Cases', () => {
    it('should handle malformed event objects gracefully', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      // Emit malformed events
      expect(() => {
        orchestrator.emit('tool:start', null as any);
      }).not.toThrow();

      expect(() => {
        orchestrator.emit('tool:start', {
          // Missing required fields
          toolName: 'Read',
        } as any);
      }).not.toThrow();

      expect(() => {
        orchestrator.emit('tool:start', {
          taskId: generateTaskId(),
          toolName: 'Read',
          input: { filePath: 'test.txt' },
          callId: 'malformed-test',
          // Missing timestamp
        } as any);
      }).not.toThrow();

      // Hook should not have been called for malformed events
      expect(hook).not.toHaveBeenCalled();

      unsubscribe();
    });

    it('should handle very large input objects', async () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      // Create a very large input object
      const largeInput = {
        filePath: 'test.txt',
        largeData: 'x'.repeat(1000000), // 1MB string
        complexObject: {
          nested: Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            data: `item-${i}`,
            metadata: {
              created: new Date(),
              tags: [`tag-${i}`, `category-${i % 10}`],
            },
          })),
        },
      };

      const start = Date.now();
      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: largeInput,
        callId: 'large-input-test',
        timestamp: new Date(),
      });
      const duration = Date.now() - start;

      // Should handle large objects without significant delay
      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(hook).toHaveBeenCalledTimes(1);

      const context: ToolStartHookContext = hook.mock.calls[0][0];
      expect(context.input).toEqual(largeInput);

      unsubscribe();
    });

    it('should handle rapid event emission', async () => {
      const hooks = {
        start: vi.fn(),
        complete: vi.fn(),
        error: vi.fn(),
      };

      const unsubStart = orchestrator.onToolStart(hooks.start);
      const unsubComplete = orchestrator.onToolComplete(hooks.complete);
      const unsubError = orchestrator.onToolError(hooks.error);

      // Mock tool executions for complete/error events
      const mockExecution = {
        callId: 'rapid-events-test',
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        startTime: new Date(),
        taskId: generateTaskId(),
        status: 'in_progress' as const,
      };
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue(mockExecution);

      // Emit many events rapidly
      const eventCount = 1000;
      const start = Date.now();

      for (let i = 0; i < eventCount; i++) {
        const taskId = generateTaskId();
        const callId = `rapid-${i}`;

        orchestrator.emit('tool:start', {
          taskId,
          toolName: 'Read',
          input: { filePath: `test-${i}.txt` },
          callId,
          timestamp: new Date(),
        });

        // Alternate between success and error completions
        orchestrator.emit('tool:complete', {
          taskId,
          toolName: 'Read',
          callId,
          result: i % 2 === 0
            ? { success: true, output: `content-${i}` }
            : { success: false, error: `error-${i}` },
          timing: { startTime: new Date(), endTime: new Date(), duration: 1 },
          timestamp: new Date(),
        });
      }

      const duration = Date.now() - start;

      // Should process all events efficiently
      expect(duration).toBeLessThan(5000); // Less than 5 seconds for 1000 events
      expect(hooks.start).toHaveBeenCalledTimes(eventCount);
      expect(hooks.complete).toHaveBeenCalledTimes(eventCount / 2);
      expect(hooks.error).toHaveBeenCalledTimes(eventCount / 2);

      unsubStart();
      unsubComplete();
      unsubError();
    });
  });

  describe('Context Data Edge Cases', () => {
    it('should handle missing agent/stage information gracefully', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      // Mock getToolExecution to return execution without agent/stage
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId: 'no-context-test',
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        startTime: new Date(),
        taskId: generateTaskId(),
        status: 'in_progress' as const,
        // No agentName or stageName
      });

      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        callId: 'no-context-test',
        timestamp: new Date(),
      });

      expect(hook).toHaveBeenCalledTimes(1);
      const context: ToolStartHookContext = hook.mock.calls[0][0];
      expect(context.agentName).toBeUndefined();
      expect(context.stageName).toBeUndefined();

      unsubscribe();
    });

    it('should handle missing tool execution gracefully', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      // Mock getToolExecution to return null
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue(null);

      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        callId: 'missing-execution-test',
        timestamp: new Date(),
      });

      expect(hook).toHaveBeenCalledTimes(1);
      const context: ToolStartHookContext = hook.mock.calls[0][0];
      expect(context.agentName).toBeUndefined();
      expect(context.stageName).toBeUndefined();

      unsubscribe();
    });

    it('should handle circular references in input objects', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      // Create object with circular reference
      const circularInput: any = {
        filePath: 'test.txt',
        metadata: {},
      };
      circularInput.metadata.parent = circularInput;

      expect(() => {
        orchestrator.emit('tool:start', {
          taskId: generateTaskId(),
          toolName: 'Read',
          input: circularInput,
          callId: 'circular-test',
          timestamp: new Date(),
        });
      }).not.toThrow();

      // Hook should still be called
      expect(hook).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it('should handle special timestamp values', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      // Test with edge case timestamps
      const edgeCases = [
        new Date(0), // Unix epoch
        new Date('1970-01-01'), // Start of Unix time
        new Date('2038-01-19'), // Unix timestamp limit (32-bit)
        new Date('9999-12-31'), // Far future
      ];

      edgeCases.forEach((timestamp, index) => {
        orchestrator.emit('tool:start', {
          taskId: generateTaskId(),
          toolName: 'Read',
          input: { filePath: `test-${index}.txt` },
          callId: `timestamp-test-${index}`,
          timestamp,
        });
      });

      expect(hook).toHaveBeenCalledTimes(edgeCases.length);

      edgeCases.forEach((timestamp, index) => {
        const context: ToolStartHookContext = hook.mock.calls[index][0];
        expect(context.timestamp).toBe(timestamp);
      });

      unsubscribe();
    });
  });

  describe('Memory and Performance', () => {
    it('should not leak memory with many hook registrations', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const unsubscribeFunctions: (() => void)[] = [];

      // Register many hooks
      for (let i = 0; i < 1000; i++) {
        const unsub = orchestrator.onToolStart(() => {
          // Empty hook
        });
        unsubscribeFunctions.push(unsub);
      }

      const afterRegistration = process.memoryUsage().heapUsed;

      // Unsubscribe all hooks
      unsubscribeFunctions.forEach(unsub => unsub());

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterCleanup = process.memoryUsage().heapUsed;

      // Memory should not grow significantly
      const memoryGrowth = afterCleanup - initialMemory;
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth
    });

    it('should handle concurrent hook executions', async () => {
      const results: string[] = [];
      const hook = vi.fn((context: ToolStartHookContext) => {
        results.push(`${context.toolName}-${context.callId}`);
      });

      const unsubscribe = orchestrator.onToolStart(hook);

      // Emit events concurrently
      const promises = Array.from({ length: 100 }, async (_, i) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            orchestrator.emit('tool:start', {
              taskId: generateTaskId(),
              toolName: `Tool${i}`,
              input: { data: i },
              callId: `concurrent-${i}`,
              timestamp: new Date(),
            });
            resolve();
          }, Math.random() * 10); // Random delay up to 10ms
        });
      });

      await Promise.all(promises);

      // Allow event processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // All hooks should have been called
      expect(hook).toHaveBeenCalledTimes(100);
      expect(results).toHaveLength(100);

      // Verify all unique calls were made
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(100);

      unsubscribe();
    });
  });

  describe('Error Resilience', () => {
    it('should continue working when hook callbacks throw errors', () => {
      const workingHook = vi.fn();
      const throwingHook = vi.fn(() => {
        throw new Error('Hook error');
      });

      const unsubWorking = orchestrator.onToolStart(workingHook);
      const unsubThrowing = orchestrator.onToolStart(throwingHook);

      // Emit event - should not crash despite throwing hook
      expect(() => {
        orchestrator.emit('tool:start', {
          taskId: generateTaskId(),
          toolName: 'Read',
          input: { filePath: 'test.txt' },
          callId: 'error-resilience-test',
          timestamp: new Date(),
        });
      }).not.toThrow();

      // Both hooks should have been called
      expect(workingHook).toHaveBeenCalledTimes(1);
      expect(throwingHook).toHaveBeenCalledTimes(1);

      unsubWorking();
      unsubThrowing();
    });

    it('should handle hooks that modify the context object', () => {
      const modifyingHook = vi.fn((context: ToolStartHookContext) => {
        // Try to modify the context (should not affect other hooks)
        (context as any).modified = true;
        (context as any).toolName = 'ModifiedTool';
      });

      const readingHook = vi.fn();

      const unsubModifying = orchestrator.onToolStart(modifyingHook);
      const unsubReading = orchestrator.onToolStart(readingHook);

      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        callId: 'modification-test',
        timestamp: new Date(),
      });

      // Both hooks should receive the original context
      expect(modifyingHook).toHaveBeenCalledTimes(1);
      expect(readingHook).toHaveBeenCalledTimes(1);

      const modifyingContext = modifyingHook.mock.calls[0][0];
      const readingContext = readingHook.mock.calls[0][0];

      // Original toolName should be preserved in the reading hook
      expect(readingContext.toolName).toBe('Read');
      expect(modifyingContext.toolName).toBe('Read'); // Original value

      unsubModifying();
      unsubReading();
    });
  });
});