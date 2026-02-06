/**
 * @fileoverview Performance Validation Tests for Mock Helpers
 *
 * This test file validates that mock helpers maintain good performance
 * characteristics under various load conditions and stress scenarios.
 * These tests ensure the mocks are production-ready for testing environments.
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

describe('Mock Helpers Performance Validation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any potential memory leaks
    vi.clearAllMocks();
  });

  describe('High-volume operations performance', () => {
    it('should handle large numbers of file system operations efficiently', async () => {
      const startTime = performance.now();

      // Create a large file system with many files
      const largeFileData: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        largeFileData[`/files/file-${i}.txt`] = `Content of file ${i}`;
        largeFileData[`/data/data-${i}.json`] = JSON.stringify({ id: i, data: `data-${i}` });
      }

      const fs = createFileSystemMock(largeFileData);

      // Perform many concurrent read operations
      const readPromises: Promise<string>[] = [];
      for (let i = 0; i < 500; i++) {
        readPromises.push(fs.readFile(`/files/file-${i}.txt`));
        readPromises.push(fs.readFile(`/data/data-${i}.json`));
      }

      const results = await Promise.all(readPromises);
      expect(results).toHaveLength(1000);

      // Perform many write operations
      const writePromises: Promise<void>[] = [];
      for (let i = 0; i < 200; i++) {
        writePromises.push(fs.writeFile(`/output/output-${i}.txt`, `Generated content ${i}`));
      }

      await Promise.all(writePromises);

      // Perform stat operations
      const statPromises: Promise<any>[] = [];
      for (let i = 0; i < 100; i++) {
        statPromises.push(fs.stat(`/files/file-${i}.txt`));
      }

      const statResults = await Promise.all(statPromises);
      expect(statResults).toHaveLength(100);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(executionTime).toBeLessThan(5000); // 5 seconds

      console.log(`File system performance test completed in ${executionTime.toFixed(2)}ms`);
    });

    it('should handle large numbers of network requests efficiently', async () => {
      const startTime = performance.now();

      // Create network mock with many responses
      const responses: Record<string, any> = {};
      for (let i = 0; i < 1000; i++) {
        responses[`https://api.example.com/data-${i}`] = {
          id: i,
          data: `response-data-${i}`,
          metadata: {
            timestamp: Date.now(),
            index: i
          }
        };
      }

      const network = createNetworkMock(responses);

      // Perform many concurrent requests
      const requestPromises: Promise<Response>[] = [];
      for (let i = 0; i < 500; i++) {
        requestPromises.push(network.fetch(`https://api.example.com/data-${i}`));
      }

      const responses1 = await Promise.all(requestPromises);
      expect(responses1).toHaveLength(500);

      // Process the responses
      const dataPromises = responses1.map(response => response.json());
      const data = await Promise.all(dataPromises);

      expect(data).toHaveLength(500);
      expect(data[0]).toHaveProperty('id', 0);
      expect(data[499]).toHaveProperty('id', 499);

      // Add more responses dynamically
      for (let i = 500; i < 700; i++) {
        network.addResponse(`https://api.example.com/dynamic-${i}`, {
          id: i,
          type: 'dynamic',
          value: `dynamic-${i}`
        });
      }

      // Fetch dynamic responses
      const dynamicPromises: Promise<Response>[] = [];
      for (let i = 500; i < 600; i++) {
        dynamicPromises.push(network.fetch(`https://api.example.com/dynamic-${i}`));
      }

      const dynamicResponses = await Promise.all(dynamicPromises);
      expect(dynamicResponses).toHaveLength(100);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(3000); // 3 seconds

      console.log(`Network performance test completed in ${executionTime.toFixed(2)}ms`);
    });

    it('should handle large numbers of task operations efficiently', async () => {
      const startTime = performance.now();

      // Initialize with some existing tasks
      const initialTasks: any[] = [];
      for (let i = 0; i < 100; i++) {
        initialTasks.push({
          id: `initial-task-${i}`,
          status: 'completed',
          workflow: `workflow-${i % 10}`,
          createdAt: new Date(Date.now() - i * 1000),
          description: `Initial task ${i}`
        });
      }

      const taskStore = createTaskStoreMock(initialTasks);

      // Create many new tasks concurrently
      const createPromises: Promise<any>[] = [];
      for (let i = 0; i < 500; i++) {
        createPromises.push(taskStore.create({
          workflow: `new-workflow-${i % 20}`,
          description: `New task ${i}`,
          priority: i % 3,
          metadata: {
            batch: 'performance-test',
            index: i
          }
        }));
      }

      const createdTasks = await Promise.all(createPromises);
      expect(createdTasks).toHaveLength(500);

      // Perform many concurrent reads
      const readPromises: Promise<any>[] = [];
      for (let i = 0; i < 200; i++) {
        const randomTask = createdTasks[Math.floor(Math.random() * createdTasks.length)];
        readPromises.push(taskStore.get(randomTask.id));
      }

      const readResults = await Promise.all(readPromises);
      expect(readResults.every(task => task !== null)).toBe(true);

      // Perform many concurrent updates
      const updatePromises: Promise<any>[] = [];
      for (let i = 0; i < 100; i++) {
        const taskToUpdate = createdTasks[i];
        updatePromises.push(taskStore.update(taskToUpdate.id, {
          status: i % 2 === 0 ? 'completed' : 'failed',
          completedAt: new Date(),
          result: `Updated result ${i}`
        }));
      }

      const updateResults = await Promise.all(updatePromises);
      expect(updateResults).toHaveLength(100);

      // List all tasks
      const allTasks = await taskStore.list();
      expect(allTasks.length).toBe(600); // 100 initial + 500 created

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(4000); // 4 seconds

      console.log(`Task store performance test completed in ${executionTime.toFixed(2)}ms`);
    });

    it('should handle high-frequency event emissions efficiently', async () => {
      const startTime = performance.now();

      const eventEmitter = createEventEmitterMock();
      const console = createConsoleMock();

      // Set up many listeners
      const listenerResults: Array<{ event: string, data: any }> = [];

      for (let i = 0; i < 50; i++) {
        eventEmitter.on(`event-type-${i}`, (data: any) => {
          listenerResults.push({ event: `event-type-${i}`, data });
        });
      }

      // Set up a global listener
      eventEmitter.on('global-event', (data: any) => {
        console.log(`Global event: ${JSON.stringify(data)}`);
      });

      // Emit many events rapidly
      const emissionPromises: Promise<void>[] = [];

      for (let i = 0; i < 1000; i++) {
        emissionPromises.push(
          Promise.resolve().then(() => {
            const eventType = `event-type-${i % 50}`;
            eventEmitter.emit(eventType, {
              id: i,
              timestamp: Date.now(),
              data: `event-data-${i}`
            });

            // Also emit to global event occasionally
            if (i % 10 === 0) {
              eventEmitter.emit('global-event', { globalId: i });
            }
          })
        );
      }

      await Promise.all(emissionPromises);

      // Verify results
      expect(listenerResults.length).toBe(1000);
      expect(listenerResults[0].event).toMatch(/^event-type-\d+$/);
      expect(listenerResults[0].data).toHaveProperty('id');

      // Check console messages
      const messages = console._getMessages();
      expect(messages.length).toBe(100); // Every 10th emission

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(2000); // 2 seconds

      console.log(`Event emission performance test completed in ${executionTime.toFixed(2)}ms`);
    });

    it('should handle large page interaction sequences efficiently', async () => {
      const startTime = performance.now();

      const page = createPageMock();

      // Simulate a complex interaction sequence
      const interactions: Promise<any>[] = [];

      for (let i = 0; i < 200; i++) {
        interactions.push(page.goto(`https://app.example.com/page-${i}`));
        interactions.push(page.click(`#button-${i}`));
        interactions.push(page.type(`#input-${i}`, `test data ${i}`));
        interactions.push(page.fill(`#textarea-${i}`, `textarea content ${i}`));
        interactions.push(page.waitForSelector(`#element-${i}`));

        // Occasionally take screenshots and evaluate
        if (i % 10 === 0) {
          interactions.push(page.screenshot());
          interactions.push(page.evaluate(() => `result-${i}`));
        }
      }

      await Promise.all(interactions);

      // Perform locator operations
      const locatorPromises: Promise<any>[] = [];
      for (let i = 0; i < 100; i++) {
        const locator = page.locator(`#locator-${i}`);
        locatorPromises.push(locator.click());
        locatorPromises.push(locator.textContent());
        locatorPromises.push(locator.isVisible());
      }

      await Promise.all(locatorPromises);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(3000); // 3 seconds

      console.log(`Page interaction performance test completed in ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Memory usage and cleanup performance', () => {
    it('should handle repeated mock creation and destruction efficiently', () => {
      const startTime = performance.now();

      // Create and destroy many mocks repeatedly
      for (let cycle = 0; cycle < 100; cycle++) {
        // Create multiple mock types
        const orchestrator = createOrchestratorMock({
          executeTask: vi.fn(),
          customMethod: () => `cycle-${cycle}`
        });

        const fs = createFileSystemMock({
          [`/temp/file-${cycle}.txt`]: `content for cycle ${cycle}`
        });

        const network = createNetworkMock({
          [`https://api.cycle${cycle}.com`]: { data: `cycle-${cycle}` }
        });

        const taskStore = createTaskStoreMock([
          { id: `cycle-task-${cycle}`, status: 'pending', workflow: `cycle-${cycle}` }
        ]);

        const eventEmitter = createEventEmitterMock();
        const page = createPageMock({ title: vi.fn().mockResolvedValue(`Cycle ${cycle}`) });
        const consoleMock = createConsoleMock();

        // Use the mocks briefly
        expect(orchestrator).toBeDefined();
        expect(fs).toBeDefined();
        expect(network).toBeDefined();
        expect(taskStore).toBeDefined();
        expect(eventEmitter).toBeDefined();
        expect(page).toBeDefined();
        expect(consoleMock).toBeDefined();

        // Clear mocks to simulate cleanup
        vi.clearAllMocks();
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(2000); // 2 seconds

      console.log(`Mock creation/destruction cycle completed in ${executionTime.toFixed(2)}ms`);
    });

    it('should handle large mock environments efficiently', () => {
      const startTime = performance.now();

      // Create a very large mock environment
      const largeFileData: Record<string, string> = {};
      const largeNetworkResponses: Record<string, any> = {};
      const largeTasks: any[] = [];

      for (let i = 0; i < 500; i++) {
        largeFileData[`/project/src/components/Component${i}.tsx`] = `
          export function Component${i}() {
            return <div>Component ${i}</div>;
          }
        `;
        largeFileData[`/project/tests/Component${i}.test.ts`] = `
          import { Component${i} } from '../src/components/Component${i}';
          describe('Component${i}', () => {
            it('should render', () => {
              // Test implementation
            });
          });
        `;

        largeNetworkResponses[`https://api.service.com/component-${i}`] = {
          id: i,
          name: `Component${i}`,
          metadata: {
            version: '1.0.0',
            dependencies: [`dep-${i}`, `dep-${i + 1}`]
          }
        };

        largeTasks.push({
          id: `task-${i}`,
          status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'pending' : 'running',
          workflow: `component-workflow-${i % 10}`,
          description: `Task for Component${i}`,
          createdAt: new Date(Date.now() - i * 1000),
          metadata: {
            component: `Component${i}`,
            priority: i % 5,
            tags: [`tag-${i % 3}`, `category-${i % 7}`]
          }
        });
      }

      const environment = createMockEnvironment({
        fileData: largeFileData,
        networkResponses: largeNetworkResponses,
        initialTasks: largeTasks
      });

      expect(environment.orchestrator).toBeDefined();
      expect(environment.fs).toBeDefined();
      expect(environment.network).toBeDefined();
      expect(environment.taskStore).toBeDefined();

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(1000); // 1 second

      console.log(`Large mock environment creation completed in ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Stress testing edge cases', () => {
    it('should handle extremely large data structures', async () => {
      // Test with very large file content
      const largeContent = 'x'.repeat(1000000); // 1MB of content
      const fs = createFileSystemMock({
        '/large-file.txt': largeContent
      });

      const startTime = performance.now();
      const content = await fs.readFile('/large-file.txt');
      const endTime = performance.now();

      expect(content).toBe(largeContent);
      expect(content.length).toBe(1000000);

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(100); // Should be very fast for in-memory operation

      console.log(`Large file read completed in ${executionTime.toFixed(2)}ms`);
    });

    it('should handle deeply nested data structures', async () => {
      // Create deeply nested response object
      let deepObject: any = { value: 'deep' };
      for (let i = 0; i < 100; i++) {
        deepObject = { level: i, nested: deepObject };
      }

      const network = createNetworkMock({
        'https://api.deep.com/nested': deepObject
      });

      const startTime = performance.now();
      const response = await network.fetch('https://api.deep.com/nested');
      const data = await response.json();
      const endTime = performance.now();

      expect(data).toEqual(deepObject);

      // Navigate to the deep value
      let current = data;
      for (let i = 99; i >= 0; i--) {
        expect(current.level).toBe(i);
        current = current.nested;
      }
      expect(current.value).toBe('deep');

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(50);

      console.log(`Deep object handling completed in ${executionTime.toFixed(2)}ms`);
    });

    it('should handle concurrent operations without interference', async () => {
      const taskStore = createTaskStoreMock();
      const console = createConsoleMock();

      const startTime = performance.now();

      // Run many concurrent operations that might interfere with each other
      const concurrentOperations = [];

      // Concurrent task creation
      for (let i = 0; i < 100; i++) {
        concurrentOperations.push(
          taskStore.create({
            workflow: `concurrent-workflow-${i}`,
            description: `Concurrent task ${i}`,
            batch: 'stress-test'
          }).then(task => {
            console.log(`Created task ${task.id}`);
            return task;
          })
        );
      }

      // Concurrent console logging
      for (let i = 0; i < 200; i++) {
        concurrentOperations.push(
          Promise.resolve().then(() => {
            console.log(`Concurrent log ${i}`);
            console.error(`Concurrent error ${i}`);
            console.warn(`Concurrent warning ${i}`);
          })
        );
      }

      // Execute all operations concurrently
      const results = await Promise.all(concurrentOperations);

      // Verify results
      const tasks = results.filter(r => r && typeof r === 'object' && r.id) as any[];
      expect(tasks).toHaveLength(100);

      const messages = console._getMessages();
      // Should have 100 task creation logs + 600 concurrent logs (200 * 3 levels)
      expect(messages.length).toBe(700);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(2000); // 2 seconds

      console.log(`Concurrent operations stress test completed in ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Performance regression detection', () => {
    it('should maintain consistent performance across multiple runs', async () => {
      const executionTimes: number[] = [];
      const iterations = 10;

      for (let run = 0; run < iterations; run++) {
        const startTime = performance.now();

        // Standard test workload
        const env = createMockEnvironment({
          fileData: {
            '/test1.txt': 'content1',
            '/test2.json': '{"data": "test"}',
            '/test3.md': '# Test Document'
          },
          networkResponses: {
            'https://api1.com/data': { data: 'response1' },
            'https://api2.com/info': { info: 'response2' }
          },
          initialTasks: [
            { id: 'task1', status: 'pending', workflow: 'test' },
            { id: 'task2', status: 'completed', workflow: 'test' }
          ]
        });

        // Perform standard operations
        await env.fs!.readFile('/test1.txt');
        await env.fs!.writeFile('/output.txt', 'output');
        await env.network!.fetch('https://api1.com/data');
        await env.taskStore!.create({ workflow: 'test', description: 'New task' });

        const endTime = performance.now();
        executionTimes.push(endTime - startTime);
      }

      // Calculate performance statistics
      const avgTime = executionTimes.reduce((a, b) => a + b) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      const minTime = Math.min(...executionTimes);
      const variance = executionTimes.reduce((acc, time) => acc + Math.pow(time - avgTime, 2), 0) / executionTimes.length;
      const stdDev = Math.sqrt(variance);

      console.log(`Performance stats over ${iterations} runs:`);
      console.log(`  Average: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min: ${minTime.toFixed(2)}ms`);
      console.log(`  Max: ${maxTime.toFixed(2)}ms`);
      console.log(`  Std Dev: ${stdDev.toFixed(2)}ms`);

      // Performance should be consistent
      expect(avgTime).toBeLessThan(100); // Average should be under 100ms
      expect(maxTime).toBeLessThan(200); // Max should be under 200ms
      expect(stdDev).toBeLessThan(50); // Standard deviation should be low (consistent performance)

      // Variation should be reasonable (coefficient of variation < 50%)
      const coefficientOfVariation = (stdDev / avgTime) * 100;
      expect(coefficientOfVariation).toBeLessThan(50);
    });
  });
});