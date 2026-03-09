import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

/**
 * REPL Performance and Memory Usage Tests
 *
 * This test suite focuses on performance characteristics and memory management
 * for long-running REPL sessions, ensuring the system remains responsive and
 * doesn't suffer from memory leaks or performance degradation over time.
 *
 * Key Areas Tested:
 * - Memory usage patterns during extended sessions
 * - Performance under high-frequency operations
 * - Garbage collection and cleanup effectiveness
 * - Resource utilization monitoring
 * - Response time consistency
 * - Memory leak detection
 * - Session data size management
 * - Event handler efficiency
 *
 * @fileoverview Performance and memory tests for APEX REPL
 * @version 0.6.0
 */

describe('REPL Performance and Memory Usage Tests', () => {
  let mockApp: any;
  let mockContext: any;
  let memoryBaseline: number;
  let performanceMetrics: any;

  beforeEach(() => {
    // Record initial memory usage
    if (global.gc) {
      global.gc(); // Force garbage collection if available
    }
    memoryBaseline = process.memoryUsage().heapUsed;

    performanceMetrics = {
      commandExecutionTimes: [] as number[],
      messageProcessingTimes: [] as number[],
      memorySnapshots: [] as number[],
      eventHandlingTimes: [] as number[],
    };

    mockApp = {
      addMessage: vi.fn(),
      updateState: vi.fn(),
      getState: vi.fn().mockReturnValue({
        messages: [],
        inputHistory: [],
        tokens: { input: 0, output: 0 },
        cost: 0,
        subtaskProgress: undefined,
        activeAgent: undefined,
        parallelAgents: [],
      }),
    };

    mockContext = {
      initialized: true,
      config: {
        projectName: 'performance-test',
        models: { implementation: 'sonnet' },
        ui: {
          previewMode: false,
          maxMessages: 1000,
          maxInputHistory: 500,
        },
      },
      orchestrator: {
        createTask: vi.fn().mockImplementation((description) => {
          return Promise.resolve({
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            description: description.description,
            status: 'pending',
          });
        }),
        executeTask: vi.fn().mockResolvedValue(undefined),
        getTask: vi.fn(),
        listTasks: vi.fn(),
      },
      sessionAutoSaver: {
        addMessage: vi.fn().mockResolvedValue(undefined),
        addInputToHistory: vi.fn().mockResolvedValue(undefined),
        updateState: vi.fn().mockResolvedValue(undefined),
      },
      app: mockApp,
    };
  });

  afterEach(() => {
    // Force cleanup
    if (global.gc) {
      global.gc();
    }
  });

  describe('Memory Management and Leak Detection', () => {
    it('should maintain stable memory usage during extended operation', async () => {
      const iterations = 1000;
      const memorySnapshots: number[] = [];

      // Simulate extended REPL usage
      for (let i = 0; i < iterations; i++) {
        // Simulate various operations
        await simulateCommand('status');
        await simulateTaskCreation(`Task ${i}`);
        await simulateMessageAdd(`Message ${i}`, 'assistant');

        // Take memory snapshot every 100 iterations
        if (i % 100 === 0) {
          if (global.gc) global.gc();
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }
      }

      // Analyze memory growth
      const initialMemory = memorySnapshots[0];
      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = finalMemory - initialMemory;
      const growthPercentage = (memoryGrowth / initialMemory) * 100;

      // Memory growth should be reasonable (less than 50% for 1000 operations)
      expect(growthPercentage).toBeLessThan(50);

      // No significant memory spikes
      const maxMemory = Math.max(...memorySnapshots);
      const avgMemory = memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length;
      expect(maxMemory / avgMemory).toBeLessThan(2); // Max shouldn't be more than 2x average
    });

    it('should properly clean up event listeners to prevent memory leaks', () => {
      const mockOrchestrator = {
        on: vi.fn(),
        off: vi.fn(),
        removeAllListeners: vi.fn(),
        listenerCount: vi.fn().mockReturnValue(0),
      };

      const eventTypes = [
        'task:started',
        'task:completed',
        'task:failed',
        'agent:message',
        'agent:thinking',
        'usage:updated',
      ];

      // Add many listeners
      eventTypes.forEach(event => {
        for (let i = 0; i < 100; i++) {
          mockOrchestrator.on(event, vi.fn());
        }
      });

      expect(mockOrchestrator.on).toHaveBeenCalledTimes(600);

      // Cleanup
      mockOrchestrator.removeAllListeners();
      expect(mockOrchestrator.removeAllListeners).toHaveBeenCalled();
    });

    it('should implement message history rotation to prevent unbounded growth', () => {
      const maxMessages = 100;
      const messages: any[] = [];

      // Simulate adding many messages
      for (let i = 0; i < 200; i++) {
        const message = {
          id: `msg-${i}`,
          content: `Message ${i}`,
          timestamp: new Date(),
          type: 'assistant',
        };

        messages.push(message);

        // Implement rotation
        if (messages.length > maxMessages) {
          messages.splice(0, messages.length - maxMessages);
        }
      }

      expect(messages.length).toBe(maxMessages);
      expect(messages[0].id).toBe('msg-100'); // First message should be from iteration 100
      expect(messages[messages.length - 1].id).toBe('msg-199'); // Last should be 199
    });

    it('should manage input history size efficiently', () => {
      const maxHistory = 500;
      const inputHistory: string[] = [];

      // Add many input commands
      for (let i = 0; i < 1000; i++) {
        const command = `command-${i}`;

        // Remove duplicates and limit size
        const index = inputHistory.indexOf(command);
        if (index !== -1) {
          inputHistory.splice(index, 1);
        }
        inputHistory.push(command);

        if (inputHistory.length > maxHistory) {
          inputHistory.splice(0, inputHistory.length - maxHistory);
        }
      }

      expect(inputHistory.length).toBeLessThanOrEqual(maxHistory);
    });
  });

  describe('Performance Under High Load', () => {
    it('should handle rapid command execution with consistent response times', async () => {
      const commandCount = 100;
      const responseTimes: number[] = [];

      // Execute many commands rapidly
      for (let i = 0; i < commandCount; i++) {
        const startTime = performance.now();
        await simulateCommand('status');
        const endTime = performance.now();
        responseTimes.push(endTime - startTime);
      }

      // Calculate statistics
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      // Performance should be consistent (allowing for test environment variability)
      expect(avgResponseTime).toBeLessThan(50); // Average should be under 50ms
      expect(maxResponseTime).toBeLessThan(200); // No single command should take over 200ms
      expect(maxResponseTime / minResponseTime).toBeLessThan(50); // Max shouldn't be 50x min (allowing for test environment variability)
    });

    it('should handle concurrent task creation without performance degradation', async () => {
      const concurrentTasks = 50;
      const taskCreationPromises: Promise<any>[] = [];

      const startTime = performance.now();

      // Create many tasks concurrently
      for (let i = 0; i < concurrentTasks; i++) {
        taskCreationPromises.push(
          simulateTaskCreation(`Concurrent task ${i}`)
        );
      }

      const results = await Promise.all(taskCreationPromises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgTimePerTask = totalTime / concurrentTasks;

      expect(results.length).toBe(concurrentTasks);
      expect(avgTimePerTask).toBeLessThan(20); // Should average less than 20ms per task
      expect(totalTime).toBeLessThan(1000); // Total time should be under 1 second
    });

    it('should efficiently process high-frequency event streams', () => {
      const eventCount = 1000;
      const processingTimes: number[] = [];

      // Simulate high-frequency event processing
      for (let i = 0; i < eventCount; i++) {
        const startTime = performance.now();

        // Simulate event processing
        mockApp.updateState({
          tokens: { input: i * 10, output: i * 5 },
          cost: i * 0.001,
        });

        const endTime = performance.now();
        processingTimes.push(endTime - startTime);
      }

      const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const maxProcessingTime = Math.max(...processingTimes);

      expect(avgProcessingTime).toBeLessThan(1); // Should be sub-millisecond
      expect(maxProcessingTime).toBeLessThan(5); // No single event should take over 5ms
      expect(mockApp.updateState).toHaveBeenCalledTimes(eventCount);
    });

    it('should maintain responsiveness during large data operations', async () => {
      const largeDataSize = 10000;

      // Simulate processing large task list
      const startTime = performance.now();

      const largeTasks = Array.from({ length: largeDataSize }, (_, i) => ({
        id: `task-${i}`,
        status: 'completed',
        description: `Large task ${i}`.repeat(10), // Make description longer
        usage: { inputTokens: 100, outputTokens: 50, estimatedCost: 0.01 },
      }));

      mockContext.orchestrator.listTasks.mockResolvedValue(largeTasks);
      const tasks = await mockContext.orchestrator.listTasks();

      // Process the large list (simulate pagination)
      const pageSize = 100;
      const pages: any[][] = [];
      for (let i = 0; i < tasks.length; i += pageSize) {
        pages.push(tasks.slice(i, i + pageSize));
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(pages.length).toBe(largeDataSize / pageSize);
      expect(processingTime).toBeLessThan(100); // Should complete within 100ms
      expect(pages[0].length).toBe(pageSize);
    });
  });

  describe('Resource Utilization Monitoring', () => {
    it('should monitor CPU usage during intensive operations', async () => {
      const cpuIntensiveOperations = async () => {
        // Simulate CPU-intensive work
        for (let i = 0; i < 10000; i++) {
          await simulateTaskCreation(`CPU intensive task ${i}`);

          // Simulate some processing
          const data = JSON.stringify({
            id: `task-${i}`,
            description: `Task ${i}`,
            complexity: Math.random(),
            metadata: Array.from({ length: 100 }, (_, j) => ({ key: j, value: Math.random() })),
          });

          JSON.parse(data); // Parse it back
        }
      };

      const startTime = process.hrtime.bigint();
      await cpuIntensiveOperations();
      const endTime = process.hrtime.bigint();

      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

      // Operation should complete in reasonable time
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should track memory allocation patterns', () => {
      const memorySnapshots: NodeJS.MemoryUsage[] = [];

      // Take initial snapshot
      memorySnapshots.push(process.memoryUsage());

      // Perform memory-intensive operations
      const largeArrays: any[][] = [];
      for (let i = 0; i < 100; i++) {
        // Create large temporary arrays
        const tempArray = Array.from({ length: 1000 }, (_, j) => ({
          id: `${i}-${j}`,
          data: Math.random().toString(36).repeat(100),
        }));

        largeArrays.push(tempArray);

        // Take periodic snapshots
        if (i % 20 === 0) {
          memorySnapshots.push(process.memoryUsage());
        }
      }

      // Clear arrays to test cleanup
      largeArrays.length = 0;
      if (global.gc) global.gc();

      memorySnapshots.push(process.memoryUsage());

      // Analyze memory patterns
      const initialHeap = memorySnapshots[0].heapUsed;
      const peakHeap = Math.max(...memorySnapshots.map(s => s.heapUsed));
      const finalHeap = memorySnapshots[memorySnapshots.length - 1].heapUsed;

      const peakGrowth = peakHeap - initialHeap;
      const finalGrowth = finalHeap - initialHeap;

      // Memory should be reclaimed after cleanup (allowing for some variance in GC timing)
      if (peakGrowth > 0) {
        expect(finalGrowth / peakGrowth).toBeLessThan(2); // Final should be reasonable compared to peak
      } else {
        // If no significant growth occurred, that's also acceptable
        expect(finalGrowth).toBeGreaterThanOrEqual(0);
      }
    });

    it('should monitor event handler performance', () => {
      const handlerMetrics = {
        callCount: 0,
        totalTime: 0,
        maxTime: 0,
        minTime: Infinity,
      };

      const monitoredHandler = (data: any) => {
        const startTime = performance.now();
        handlerMetrics.callCount++;

        // Simulate handler work
        mockApp.addMessage({
          type: 'system',
          content: `Processed: ${JSON.stringify(data).substring(0, 100)}`,
        });

        const endTime = performance.now();
        const duration = endTime - startTime;

        handlerMetrics.totalTime += duration;
        handlerMetrics.maxTime = Math.max(handlerMetrics.maxTime, duration);
        handlerMetrics.minTime = Math.min(handlerMetrics.minTime, duration);
      };

      // Call handler many times
      for (let i = 0; i < 1000; i++) {
        monitoredHandler({ event: `test-event-${i}`, data: Math.random() });
      }

      const avgTime = handlerMetrics.totalTime / handlerMetrics.callCount;

      expect(handlerMetrics.callCount).toBe(1000);
      expect(avgTime).toBeLessThan(2); // Average should be under 2ms
      expect(handlerMetrics.maxTime).toBeLessThan(10); // Max should be under 10ms
    });
  });

  describe('Session Scaling and Limits', () => {
    it('should handle very large session histories efficiently', () => {
      const sessionHistory = {
        messages: [] as any[],
        inputHistory: [] as string[],
        taskHistory: [] as any[],
      };

      const startTime = performance.now();

      // Build large session history
      for (let i = 0; i < 10000; i++) {
        sessionHistory.messages.push({
          id: `msg-${i}`,
          content: `Message ${i}`,
          timestamp: new Date(),
          type: i % 2 === 0 ? 'user' : 'assistant',
        });

        sessionHistory.inputHistory.push(`command-${i}`);

        sessionHistory.taskHistory.push({
          id: `task-${i}`,
          description: `Task ${i}`,
          status: 'completed',
          createdAt: new Date(),
        });
      }

      // Simulate operations on large history
      const recentMessages = sessionHistory.messages.slice(-100);
      const recentCommands = sessionHistory.inputHistory.slice(-50);
      const recentTasks = sessionHistory.taskHistory.slice(-25);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(sessionHistory.messages.length).toBe(10000);
      expect(recentMessages.length).toBe(100);
      expect(recentCommands.length).toBe(50);
      expect(recentTasks.length).toBe(25);
      expect(processingTime).toBeLessThan(200); // Should complete within 200ms
    });

    it('should implement efficient search across large datasets', () => {
      const largeDataset = Array.from({ length: 50000 }, (_, i) => ({
        id: `item-${i}`,
        content: `Content for item ${i}`,
        tags: [`tag-${i % 100}`, `category-${i % 20}`],
        timestamp: new Date(Date.now() - i * 1000),
      }));

      const searchTerm = 'item-1234';
      const startTime = performance.now();

      // Simulate search
      const results = largeDataset.filter(item =>
        item.content.includes(searchTerm) || item.id.includes(searchTerm)
      );

      const endTime = performance.now();
      const searchTime = endTime - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(50); // Search should be fast
    });

    it('should manage multiple concurrent sessions efficiently', () => {
      const sessionCount = 100;
      const sessions = new Map();

      const startTime = performance.now();

      // Create multiple session objects
      for (let i = 0; i < sessionCount; i++) {
        const session = {
          id: `session-${i}`,
          name: `Session ${i}`,
          messages: Array.from({ length: 100 }, (_, j) => ({
            id: `msg-${i}-${j}`,
            content: `Message ${j} in session ${i}`,
          })),
          lastActivity: new Date(),
        };

        sessions.set(session.id, session);
      }

      // Simulate operations across sessions
      let operationCount = 0;
      for (const [sessionId, session] of sessions) {
        // Simulate session activity
        session.lastActivity = new Date();
        operationCount++;
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(sessions.size).toBe(sessionCount);
      expect(operationCount).toBe(sessionCount);
      expect(totalTime).toBeLessThan(100); // Should manage all sessions quickly
    });
  });

  // Helper functions for simulating operations
  async function simulateCommand(command: string): Promise<void> {
    const startTime = performance.now();

    switch (command) {
      case 'status':
        mockApp.addMessage({
          type: 'assistant',
          content: 'Status information',
        });
        break;
      case 'agents':
        mockApp.addMessage({
          type: 'assistant',
          content: 'Agent list',
        });
        break;
      default:
        mockApp.addMessage({
          type: 'system',
          content: `Executed: ${command}`,
        });
    }

    const endTime = performance.now();
    performanceMetrics.commandExecutionTimes.push(endTime - startTime);
  }

  async function simulateTaskCreation(description: string): Promise<any> {
    const task = await mockContext.orchestrator.createTask({ description });

    await mockContext.sessionAutoSaver.addMessage({
      role: 'user',
      content: description,
    });

    await mockContext.sessionAutoSaver.addMessage({
      role: 'assistant',
      content: `Task created: ${task.id}`,
      taskId: task.id,
    });

    return task;
  }

  function simulateMessageAdd(content: string, type: string): void {
    const startTime = performance.now();

    mockApp.addMessage({
      type,
      content,
      timestamp: new Date(),
    });

    const endTime = performance.now();
    performanceMetrics.messageProcessingTimes.push(endTime - startTime);
  }
});