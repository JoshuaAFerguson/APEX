/**
 * @fileoverview Performance and Stress Tests for Mock Helpers
 *
 * This test suite validates the performance characteristics and stress handling
 * of all mock helper functions under high load and extreme conditions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createOrchestratorMock,
  createAgentSdkMock,
  createFileSystemMock,
  createNetworkMock,
  createTaskStoreMock,
  createEventEmitterMock,
  createPageMock,
  createConsoleMock,
  createMockEnvironment,
} from '../mock-helpers.js';

describe('Mock Helpers Performance and Stress Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('High-volume operation performance', () => {
    it('should handle thousands of orchestrator method calls efficiently', async () => {
      const orchestrator = createOrchestratorMock();
      const startTime = Date.now();

      // Execute 1000 parallel operations
      const operations = [];
      for (let i = 0; i < 1000; i++) {
        operations.push(orchestrator.executeTask(`workflow-${i}`, `Task ${i}`));
      }

      const results = await Promise.all(operations);
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(results).toHaveLength(1000);
      expect(results.every(r => r.success === true)).toBe(true);
      expect(executionTime).toBeLessThan(1000); // Should complete in under 1 second

      // Verify call tracking still works
      expect(orchestrator.executeTask).toHaveBeenCalledTimes(1000);

      console.log(`Executed 1000 orchestrator operations in ${executionTime}ms`);
    });

    it('should handle massive file system operations with large datasets', async () => {
      // Create file system mock with many large files
      const largeFileData: Record<string, string> = {};
      const largeContent = 'x'.repeat(10000); // 10KB per file

      for (let i = 0; i < 500; i++) {
        largeFileData[`/large/file-${i}.txt`] = largeContent;
      }

      const fs = createFileSystemMock(largeFileData);
      const startTime = Date.now();

      // Concurrent file operations
      const fileOperations = [];

      // 250 read operations
      for (let i = 0; i < 250; i++) {
        fileOperations.push(fs.readFile(`/large/file-${i}.txt`));
      }

      // 250 write operations
      for (let i = 250; i < 500; i++) {
        fileOperations.push(fs.writeFile(`/new/file-${i}.txt`, largeContent));
      }

      // 500 stat operations
      for (let i = 0; i < 500; i++) {
        fileOperations.push(fs.stat(`/large/file-${i}.txt`).catch(() => null));
      }

      const results = await Promise.all(fileOperations);
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(results).toHaveLength(1000);
      expect(executionTime).toBeLessThan(2000); // Should complete in under 2 seconds

      // Verify read results
      const readResults = results.slice(0, 250) as string[];
      expect(readResults.every(content => content === largeContent)).toBe(true);

      console.log(`Processed 1000 file operations with 10KB files in ${executionTime}ms`);
    });

    it('should handle high-frequency network requests with various response sizes', async () => {
      // Create network responses of different sizes
      const responses: Record<string, any> = {};

      // Small responses (1KB each)
      for (let i = 0; i < 200; i++) {
        responses[`https://api.test.com/small/${i}`] = {
          id: i,
          data: 'x'.repeat(1000),
          timestamp: Date.now()
        };
      }

      // Medium responses (10KB each)
      for (let i = 0; i < 100; i++) {
        responses[`https://api.test.com/medium/${i}`] = {
          id: i,
          data: 'x'.repeat(10000),
          metadata: { size: 'medium', index: i }
        };
      }

      // Large responses (50KB each)
      for (let i = 0; i < 50; i++) {
        responses[`https://api.test.com/large/${i}`] = {
          id: i,
          data: 'x'.repeat(50000),
          metadata: { size: 'large', index: i }
        };
      }

      const network = createNetworkMock(responses);
      const startTime = Date.now();

      // Concurrent network requests
      const requests = [];

      // Small requests
      for (let i = 0; i < 200; i++) {
        requests.push(network.fetch(`https://api.test.com/small/${i}`));
      }

      // Medium requests
      for (let i = 0; i < 100; i++) {
        requests.push(network.fetch(`https://api.test.com/medium/${i}`));
      }

      // Large requests
      for (let i = 0; i < 50; i++) {
        requests.push(network.fetch(`https://api.test.com/large/${i}`));
      }

      const fetchResults = await Promise.all(requests);
      const jsonResults = await Promise.all(fetchResults.map(r => r.json()));

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(fetchResults).toHaveLength(350);
      expect(jsonResults).toHaveLength(350);
      expect(executionTime).toBeLessThan(1500); // Should complete in under 1.5 seconds

      // Verify response content
      expect(jsonResults.slice(0, 200).every(r => r.data.length === 1000)).toBe(true);
      expect(jsonResults.slice(200, 300).every(r => r.data.length === 10000)).toBe(true);
      expect(jsonResults.slice(300, 350).every(r => r.data.length === 50000)).toBe(true);

      console.log(`Processed 350 network requests with varying sizes in ${executionTime}ms`);
    });

    it('should handle massive task store operations with complex data', async () => {
      const taskStore = createTaskStoreMock();
      const startTime = Date.now();

      // Create complex task data
      const createTasks = [];
      for (let i = 0; i < 1000; i++) {
        createTasks.push(taskStore.create({
          workflow: `workflow-${i % 20}`,
          description: `Complex task ${i} with detailed requirements`,
          metadata: {
            priority: Math.floor(Math.random() * 5) + 1,
            tags: [`tag-${i % 10}`, `category-${i % 5}`],
            requirements: Array.from({ length: 5 }, (_, j) => `requirement-${i}-${j}`),
            estimatedTime: Math.random() * 1000,
            complexity: Math.random(),
            dependencies: Array.from({ length: 3 }, (_, j) => `dep-${i}-${j}`)
          }
        }));
      }

      const createdTasks = await Promise.all(createTasks);

      // Perform batch updates
      const updateTasks = createdTasks.slice(0, 500).map((task, index) =>
        taskStore.update(task.id, {
          status: index % 3 === 0 ? 'completed' : index % 3 === 1 ? 'failed' : 'running',
          progress: Math.random(),
          processingTime: Math.random() * 1000,
          result: `Result for task ${index}`,
          logs: Array.from({ length: 10 }, (_, j) => `Log entry ${j} for task ${index}`)
        })
      );

      const updatedTasks = await Promise.all(updateTasks);

      // Perform batch reads
      const readTasks = createdTasks.map(task => taskStore.get(task.id));
      const readResults = await Promise.all(readTasks);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(createdTasks).toHaveLength(1000);
      expect(updatedTasks).toHaveLength(500);
      expect(readResults).toHaveLength(1000);
      expect(readResults.every(task => task !== null)).toBe(true);
      expect(executionTime).toBeLessThan(3000); // Should complete in under 3 seconds

      // Verify data integrity
      const finalTasks = await taskStore.list();
      expect(finalTasks).toHaveLength(1000);

      const completedCount = finalTasks.filter(t => t.status === 'completed').length;
      const failedCount = finalTasks.filter(t => t.status === 'failed').length;
      const runningCount = finalTasks.filter(t => t.status === 'running').length;
      const pendingCount = finalTasks.filter(t => t.status === 'pending').length;

      expect(completedCount + failedCount + runningCount + pendingCount).toBe(1000);

      console.log(`Processed 2500 task store operations in ${executionTime}ms`);
    });

    it('should handle massive event emission and listener management', async () => {
      const eventEmitter = createEventEmitterMock();
      const startTime = Date.now();

      // Create many listeners for different events
      const eventCounts: Record<string, number> = {};
      const listeners: Array<{ event: string, handler: any }> = [];

      for (let i = 0; i < 100; i++) {
        const eventName = `event-${i % 20}`; // 20 unique events, 5 listeners each

        const handler = vi.fn().mockImplementation((data: any) => {
          eventCounts[eventName] = (eventCounts[eventName] || 0) + 1;
        });

        listeners.push({ event: eventName, handler });
        eventEmitter.on(eventName, handler);
      }

      // Emit many events
      const emissionPromises = [];
      for (let i = 0; i < 2000; i++) {
        const eventName = `event-${i % 20}`;
        emissionPromises.push(
          Promise.resolve().then(() => {
            eventEmitter.emit(eventName, {
              id: i,
              data: `Event data ${i}`,
              timestamp: Date.now(),
              metadata: { source: 'stress-test', iteration: i }
            });
          })
        );
      }

      await Promise.all(emissionPromises);

      // Allow event processing to settle
      await new Promise(resolve => setTimeout(resolve, 100));

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Verify event counts
      const totalEventCalls = Object.values(eventCounts).reduce((sum, count) => sum + count, 0);
      expect(totalEventCalls).toBe(2000 * 5); // 2000 events × 5 listeners per event

      // Verify each event type received the correct number of calls
      Object.keys(eventCounts).forEach(eventName => {
        expect(eventCounts[eventName]).toBe(100 * 5); // 100 events per type × 5 listeners
      });

      expect(executionTime).toBeLessThan(2000); // Should complete in under 2 seconds

      // Test listener removal performance
      const removalStartTime = Date.now();
      listeners.forEach(({ event, handler }) => {
        eventEmitter.off(event, handler);
      });
      const removalTime = Date.now() - removalStartTime;

      expect(removalTime).toBeLessThan(100); // Removal should be fast

      // Verify listeners were removed
      const remainingListeners = eventEmitter._getListeners();
      expect(Object.values(remainingListeners).every(listeners => listeners.length === 0)).toBe(true);

      console.log(`Processed 10,000 event operations in ${executionTime}ms, cleanup in ${removalTime}ms`);
    });
  });

  describe('Memory usage and garbage collection stress', () => {
    it('should handle repeated mock creation and destruction', () => {
      const performanceData = {
        creationTimes: [] as number[],
        memorySnapshots: [] as number[]
      };

      // Create and destroy mocks repeatedly
      for (let cycle = 0; cycle < 100; cycle++) {
        const cycleStart = Date.now();

        // Create full environment
        const env = createMockEnvironment({
          fileData: Object.fromEntries(
            Array.from({ length: 50 }, (_, i) => [`/file-${i}.txt`, `content-${i}`.repeat(100)])
          ),
          networkResponses: Object.fromEntries(
            Array.from({ length: 30 }, (_, i) => [`https://api.com/endpoint${i}`, { data: i, content: 'x'.repeat(1000) }])
          ),
          initialTasks: Array.from({ length: 20 }, (_, i) => ({
            id: `task-${cycle}-${i}`,
            workflow: `workflow-${i}`,
            status: 'pending',
            data: { large: 'x'.repeat(500) }
          }))
        });

        // Use the environment briefly
        env.orchestrator?.executeTask('test', 'description');
        env.fs?.readFile('/file-0.txt').catch(() => {});
        env.network?.fetch('https://api.com/endpoint0').catch(() => {});
        env.taskStore?.list();

        const cycleEnd = Date.now();
        performanceData.creationTimes.push(cycleEnd - cycleStart);

        // Capture memory usage approximation
        if (typeof global.gc === 'function') {
          global.gc();
        }

        // Simulate memory measurement (in real scenarios, you'd use actual memory APIs)
        const approximateMemory = process.memoryUsage().heapUsed;
        performanceData.memorySnapshots.push(approximateMemory);

        // Clear references
        Object.keys(env).forEach(key => {
          (env as any)[key] = null;
        });
      }

      // Analyze performance data
      const avgCreationTime = performanceData.creationTimes.reduce((sum, time) => sum + time, 0) / performanceData.creationTimes.length;
      const maxCreationTime = Math.max(...performanceData.creationTimes);
      const minCreationTime = Math.min(...performanceData.creationTimes);

      expect(avgCreationTime).toBeLessThan(50); // Average should be under 50ms
      expect(maxCreationTime).toBeLessThan(200); // Max should be under 200ms

      // Check that creation time doesn't degrade significantly over cycles
      const firstHalf = performanceData.creationTimes.slice(0, 50);
      const secondHalf = performanceData.creationTimes.slice(50);
      const firstHalfAvg = firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;

      // Second half shouldn't be more than 50% slower than first half
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);

      console.log(`Mock creation/destruction cycle stats: avg=${avgCreationTime.toFixed(2)}ms, min=${minCreationTime}ms, max=${maxCreationTime}ms`);
    });

    it('should handle large data structures without performance degradation', async () => {
      // Create mock with very large data structures
      const hugeFileData: Record<string, string> = {};
      const hugeNetworkData: Record<string, any> = {};

      // 1MB files
      const megabyteContent = 'x'.repeat(1024 * 1024);
      for (let i = 0; i < 10; i++) {
        hugeFileData[`/huge/file-${i}.dat`] = megabyteContent;
      }

      // Large JSON responses
      for (let i = 0; i < 5; i++) {
        hugeNetworkData[`https://api.huge.com/data${i}`] = {
          id: i,
          largeData: Array.from({ length: 10000 }, (_, j) => ({
            id: j,
            value: `item-${i}-${j}`,
            metadata: { nested: { deep: { value: j * i } } }
          })),
          timestamp: Date.now()
        };
      }

      const fs = createFileSystemMock(hugeFileData);
      const network = createNetworkMock(hugeNetworkData);

      const operationTimes = [];

      // Test operations with large data
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();

        // File operations
        await fs.readFile(`/huge/file-${i % 10}.dat`);
        await fs.writeFile(`/huge/new-file-${i}.dat`, megabyteContent);

        // Network operations
        const response = await network.fetch(`https://api.huge.com/data${i % 5}`);
        await response.json();

        const endTime = Date.now();
        operationTimes.push(endTime - startTime);
      }

      // Verify performance consistency
      const avgOperationTime = operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length;
      const maxOperationTime = Math.max(...operationTimes);

      expect(avgOperationTime).toBeLessThan(100); // Should handle large data quickly
      expect(maxOperationTime).toBeLessThan(200); // No operation should take too long

      // Check that performance doesn't degrade over iterations
      const firstHalf = operationTimes.slice(0, 5);
      const secondHalf = operationTimes.slice(5);
      const firstHalfAvg = firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;

      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.3); // Performance shouldn't degrade significantly

      console.log(`Large data operation stats: avg=${avgOperationTime.toFixed(2)}ms, max=${maxOperationTime}ms`);
    });
  });

  describe('Concurrent access stress testing', () => {
    it('should handle massive concurrent access to shared mocks', async () => {
      const sharedFs = createFileSystemMock({
        '/shared/data.json': JSON.stringify({ counter: 0, data: [] })
      });

      const sharedTaskStore = createTaskStoreMock();
      const sharedEventEmitter = createEventEmitterMock();

      // Set up concurrent operation tracking
      const operationResults: Array<{ type: string, success: boolean, duration: number }> = [];
      const startTime = Date.now();

      // Launch concurrent operations
      const concurrentOperations = [];

      // 200 concurrent file operations
      for (let i = 0; i < 200; i++) {
        concurrentOperations.push(
          (async () => {
            const opStart = Date.now();
            try {
              if (i % 3 === 0) {
                await sharedFs.readFile('/shared/data.json');
              } else if (i % 3 === 1) {
                await sharedFs.writeFile(`/shared/temp-${i}.txt`, `Content ${i}`);
              } else {
                await sharedFs.stat('/shared/data.json');
              }
              const opEnd = Date.now();
              operationResults.push({ type: 'file', success: true, duration: opEnd - opStart });
            } catch (error) {
              const opEnd = Date.now();
              operationResults.push({ type: 'file', success: false, duration: opEnd - opStart });
            }
          })()
        );
      }

      // 100 concurrent task operations
      for (let i = 0; i < 100; i++) {
        concurrentOperations.push(
          (async () => {
            const opStart = Date.now();
            try {
              if (i % 4 === 0) {
                await sharedTaskStore.create({ workflow: `workflow-${i}`, description: `Task ${i}` });
              } else if (i % 4 === 1) {
                const tasks = await sharedTaskStore.list();
                if (tasks.length > 0) {
                  await sharedTaskStore.get(tasks[0].id);
                }
              } else if (i % 4 === 2) {
                const tasks = await sharedTaskStore.list();
                if (tasks.length > 0) {
                  await sharedTaskStore.update(tasks[0].id, { status: 'updated' });
                }
              } else {
                await sharedTaskStore.list();
              }
              const opEnd = Date.now();
              operationResults.push({ type: 'task', success: true, duration: opEnd - opStart });
            } catch (error) {
              const opEnd = Date.now();
              operationResults.push({ type: 'task', success: false, duration: opEnd - opStart });
            }
          })()
        );
      }

      // 150 concurrent event operations
      for (let i = 0; i < 150; i++) {
        concurrentOperations.push(
          (async () => {
            const opStart = Date.now();
            try {
              if (i % 2 === 0) {
                sharedEventEmitter.emit(`event-${i % 10}`, { data: i });
              } else {
                const listener = vi.fn();
                sharedEventEmitter.on(`event-${i % 10}`, listener);
                sharedEventEmitter.off(`event-${i % 10}`, listener);
              }
              const opEnd = Date.now();
              operationResults.push({ type: 'event', success: true, duration: opEnd - opStart });
            } catch (error) {
              const opEnd = Date.now();
              operationResults.push({ type: 'event', success: false, duration: opEnd - opStart });
            }
          })()
        );
      }

      // Wait for all operations to complete
      await Promise.all(concurrentOperations);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Analyze results
      expect(operationResults).toHaveLength(450);
      expect(operationResults.every(result => result.success)).toBe(true);

      const fileOps = operationResults.filter(r => r.type === 'file');
      const taskOps = operationResults.filter(r => r.type === 'task');
      const eventOps = operationResults.filter(r => r.type === 'event');

      expect(fileOps).toHaveLength(200);
      expect(taskOps).toHaveLength(100);
      expect(eventOps).toHaveLength(150);

      // Performance assertions
      expect(totalTime).toBeLessThan(5000); // All operations should complete within 5 seconds

      const avgFileOpTime = fileOps.reduce((sum, op) => sum + op.duration, 0) / fileOps.length;
      const avgTaskOpTime = taskOps.reduce((sum, op) => sum + op.duration, 0) / taskOps.length;
      const avgEventOpTime = eventOps.reduce((sum, op) => sum + op.duration, 0) / eventOps.length;

      expect(avgFileOpTime).toBeLessThan(50);
      expect(avgTaskOpTime).toBeLessThan(50);
      expect(avgEventOpTime).toBeLessThan(10);

      console.log(`Concurrent access test completed: ${totalTime}ms total, avgFile=${avgFileOpTime.toFixed(2)}ms, avgTask=${avgTaskOpTime.toFixed(2)}ms, avgEvent=${avgEventOpTime.toFixed(2)}ms`);
    });
  });

  describe('Resource cleanup and leak prevention', () => {
    it('should properly clean up resources after intensive operations', async () => {
      const console = createConsoleMock();

      // Perform intensive logging operations
      const intensiveOperations = async () => {
        for (let cycle = 0; cycle < 50; cycle++) {
          // Generate many log messages
          for (let i = 0; i < 1000; i++) {
            console.log(`Cycle ${cycle}, Message ${i}`, { data: 'x'.repeat(100) });
            console.error(`Error ${cycle}-${i}`, new Error(`Test error ${i}`));
            console.warn(`Warning ${cycle}-${i}`, { warning: true, id: i });
            console.info(`Info ${cycle}-${i}`, { info: { nested: { data: i } } });
          }

          // Check memory usage periodically
          if (cycle % 10 === 0) {
            const messages = console._getMessages();
            expect(messages.length).toBeGreaterThan(0);

            // Clear messages to prevent memory buildup
            console._clearMessages();

            // Verify cleanup worked
            const clearedMessages = console._getMessages();
            expect(clearedMessages).toHaveLength(0);
          }
        }
      };

      const startTime = Date.now();
      await intensiveOperations();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(3000); // Should complete efficiently

      // Verify final state is clean
      const finalMessages = console._getMessages();
      expect(finalMessages).toHaveLength(0);

      console.log(`Intensive logging operations completed in ${endTime - startTime}ms with proper cleanup`);
    });

    it('should handle event listener cleanup under stress', () => {
      const eventEmitter = createEventEmitterMock();

      // Create many listeners that will be added and removed
      const stressTest = () => {
        const listeners: Array<{ event: string, handler: any }> = [];

        // Add many listeners
        for (let i = 0; i < 1000; i++) {
          const eventName = `stress-event-${i % 50}`;
          const handler = vi.fn();

          listeners.push({ event: eventName, handler });
          eventEmitter.on(eventName, handler);
        }

        // Emit events to verify listeners work
        for (let i = 0; i < 50; i++) {
          eventEmitter.emit(`stress-event-${i}`, { data: i });
        }

        // Remove all listeners
        listeners.forEach(({ event, handler }) => {
          eventEmitter.off(event, handler);
        });

        return listeners.length;
      };

      // Run stress test multiple times
      let totalListenersProcessed = 0;
      for (let cycle = 0; cycle < 10; cycle++) {
        totalListenersProcessed += stressTest();

        // Verify cleanup between cycles
        const remainingListeners = eventEmitter._getListeners();
        expect(Object.values(remainingListeners).every(listeners => listeners.length === 0)).toBe(true);
      }

      expect(totalListenersProcessed).toBe(10000);

      // Final cleanup verification
      eventEmitter._clearListeners();
      const finalListeners = eventEmitter._getListeners();
      expect(Object.keys(finalListeners)).toHaveLength(0);

      console.log(`Event listener stress test completed: processed ${totalListenersProcessed} listeners across 10 cycles`);
    });
  });
});