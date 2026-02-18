/**
 * @fileoverview Performance Tests for Large Cleanup Chains
 *
 * This test suite validates the performance characteristics of the test
 * fixtures infrastructure when dealing with large numbers of cleanup tasks,
 * complex browser states, and high-volume test scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestSuite,
  setupTestMocks,
  getTestEnvironment,
  setTestData,
  getTestData,
  addCleanupTask,
  createMockFunction,
  cleanupTestState,
  createTempDir,
  browserFixtures,
  browserHelpers,
  createBrowserState,
  BrowserStateBuilder
} from '../index.js';
import type { SetupTeardownHooks, BrowserState } from '../types.js';

describe('Performance Tests for Large Cleanup Chains', () => {
  describe('Cleanup Chain Performance', () => {
    it('should handle large cleanup chains efficiently', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const cleanupCount = 10000;
      const cleanupResults: number[] = [];
      const startTime = performance.now();

      // Add many cleanup tasks
      for (let i = 0; i < cleanupCount; i++) {
        addCleanupTask(() => {
          cleanupResults.push(i);
        });
      }

      const addCleanupTime = performance.now() - startTime;

      // Cleanup execution should be efficient
      const cleanupStartTime = performance.now();
      await suite.afterEach();
      const cleanupDuration = performance.now() - cleanupStartTime;

      expect(cleanupResults).toHaveLength(cleanupCount);
      expect(cleanupResults[0]).toBe(0);
      expect(cleanupResults[cleanupCount - 1]).toBe(cleanupCount - 1);

      // Performance expectations
      expect(addCleanupTime).toBeLessThan(500); // Adding tasks should be fast
      expect(cleanupDuration).toBeLessThan(2000); // Cleanup should complete within 2 seconds
    });

    it('should handle mixed sync and async cleanup tasks efficiently', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const taskCount = 5000;
      const completedTasks: Array<{ type: string; id: number; duration: number }> = [];

      for (let i = 0; i < taskCount; i++) {
        if (i % 3 === 0) {
          // Async cleanup task
          addCleanupTask(async () => {
            const start = performance.now();
            await new Promise(resolve => setTimeout(resolve, 1)); // Small delay
            const duration = performance.now() - start;
            completedTasks.push({ type: 'async', id: i, duration });
          });
        } else if (i % 3 === 1) {
          // Sync cleanup task with computation
          addCleanupTask(() => {
            const start = performance.now();
            // Simulate some work
            let sum = 0;
            for (let j = 0; j < 1000; j++) {
              sum += j;
            }
            const duration = performance.now() - start;
            completedTasks.push({ type: 'sync-compute', id: i, duration });
          });
        } else {
          // Simple sync cleanup task
          addCleanupTask(() => {
            const start = performance.now();
            const duration = performance.now() - start;
            completedTasks.push({ type: 'sync-simple', id: i, duration });
          });
        }
      }

      const cleanupStartTime = performance.now();
      await suite.afterEach();
      const totalCleanupDuration = performance.now() - cleanupStartTime;

      expect(completedTasks).toHaveLength(taskCount);
      expect(totalCleanupDuration).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify all task types were executed
      const asyncTasks = completedTasks.filter(t => t.type === 'async');
      const syncComputeTasks = completedTasks.filter(t => t.type === 'sync-compute');
      const syncSimpleTasks = completedTasks.filter(t => t.type === 'sync-simple');

      expect(asyncTasks.length + syncComputeTasks.length + syncSimpleTasks.length).toBe(taskCount);
    });

    it('should handle cleanup chains with complex dependencies efficiently', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const resourceCount = 1000;
      const resources: Array<{ id: number; dependencies: number[]; cleaned: boolean; data: any[] }> = [];

      // Create resources with dependencies
      for (let i = 0; i < resourceCount; i++) {
        const dependencies = i > 0 ? [Math.floor(i / 2)] : [];
        resources.push({
          id: i,
          dependencies,
          cleaned: false,
          data: new Array(100).fill(i) // Some data to clean up
        });
      }

      // Add cleanup tasks for each resource
      for (const resource of resources) {
        addCleanupTask(async () => {
          // Simulate checking dependencies
          if (resource.dependencies.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }

          // Clean up resource
          resource.data.length = 0;
          resource.cleaned = true;
        });
      }

      const cleanupStartTime = performance.now();
      await suite.afterEach();
      const cleanupDuration = performance.now() - cleanupStartTime;

      // All resources should be cleaned
      expect(resources.every(r => r.cleaned)).toBe(true);
      expect(resources.every(r => r.data.length === 0)).toBe(true);

      // Should handle complex dependencies efficiently
      expect(cleanupDuration).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('Browser State Performance', () => {
    it('should handle large-scale browser state creation efficiently', async () => {
      const stateCount = 1000;
      const startTime = performance.now();

      const states = Array.from({ length: stateCount }, (_, i) => {
        return createBrowserState()
          .withUrl(`https://performance-test-${i}.example.com`)
          .withTitle(`Performance Test ${i}`)
          .withAuth(i % 2 === 0)
          .withLocalStorage(
            Object.fromEntries(
              Array.from({ length: 50 }, (_, j) => [`key-${i}-${j}`, `value-${i}-${j}`])
            )
          )
          .withSessionStorage(
            Object.fromEntries(
              Array.from({ length: 20 }, (_, j) => [`session-${i}-${j}`, `session-value-${i}-${j}`])
            )
          )
          .withConsoleMessages(
            Array.from({ length: 10 }, (_, j) => ({
              type: 'info' as const,
              message: `Performance message ${i}-${j}`,
              timestamp: new Date(Date.now() + j)
            }))
          )
          .withNetworkRequests(
            Array.from({ length: 5 }, (_, j) => ({
              url: `https://api.performance-${i}.com/endpoint-${j}`,
              method: 'GET',
              status: 200
            }))
          )
          .build();
      });

      const creationDuration = performance.now() - startTime;

      expect(states).toHaveLength(stateCount);
      expect(creationDuration).toBeLessThan(2000); // Should create 1000 states in under 2 seconds

      // Verify states are correct
      expect(states[0].url).toBe('https://performance-test-0.example.com');
      expect(states[999].url).toBe('https://performance-test-999.example.com');
      expect(Object.keys(states[0].localStorage)).toHaveLength(50);
      expect(states[0].consoleMessages).toHaveLength(10);
    });

    it('should handle rapid browser state transformations efficiently', async () => {
      const transformationCount = 10000;
      let state = browserFixtures.cleanState();

      const startTime = performance.now();

      // Perform many rapid transformations
      for (let i = 0; i < transformationCount; i++) {
        switch (i % 6) {
          case 0:
            state = browserHelpers.setLocalStorage(state, `key-${i}`, `value-${i}`);
            break;
          case 1:
            state = browserHelpers.addConsoleMessage(state, 'info', `Message ${i}`);
            break;
          case 2:
            state = browserHelpers.addNetworkRequest(state, `https://api.example.com/req-${i}`);
            break;
          case 3:
            state = browserHelpers.setSessionStorage(state, `session-${i}`, `session-value-${i}`);
            break;
          case 4:
            state = browserHelpers.navigateTo(state, `https://page${i}.example.com`);
            break;
          case 5:
            state = browserHelpers.addCookie(state, `cookie-${i}`, `cookie-value-${i}`);
            break;
        }
      }

      const transformationDuration = performance.now() - startTime;

      expect(transformationDuration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(state.url).toBe('https://page9999.example.com'); // Last navigation
      expect(Object.keys(state.localStorage).length).toBeGreaterThan(0);
      expect(state.consoleMessages.length).toBeGreaterThan(0);
    });

    it('should handle browser state builder performance with complex scenarios', async () => {
      const scenarioCount = 500;
      const startTime = performance.now();

      const scenarios = await Promise.all(
        Array.from({ length: scenarioCount }, async (_, i) => {
          // Simulate async scenario building
          await new Promise(resolve => setTimeout(resolve, 0));

          return createBrowserState()
            .withUrl(`https://scenario-${i}.example.com/path/${i}`)
            .withTitle(`Complex Scenario ${i}`)
            .withLoading(i % 4 === 0)
            .withError(i % 5 === 0)
            .withAuth(i % 3 === 0)
            .withLocalStorage(
              Object.fromEntries(
                Array.from({ length: 100 }, (_, j) => [
                  `scenario-${i}-key-${j}`,
                  JSON.stringify({ index: j, scenario: i, timestamp: Date.now() })
                ])
              )
            )
            .withSessionStorage(
              Object.fromEntries(
                Array.from({ length: 50 }, (_, j) => [
                  `session-scenario-${i}-${j}`,
                  `session-data-${i}-${j}`
                ])
              )
            )
            .withConsoleMessages(
              Array.from({ length: 20 }, (_, j) => ({
                type: ['info', 'warn', 'error', 'log'][j % 4] as any,
                message: `Scenario ${i} complex message ${j} with details`,
                timestamp: new Date(Date.now() + j * 1000)
              }))
            )
            .withNetworkRequests(
              Array.from({ length: 15 }, (_, j) => ({
                url: `https://api.scenario-${i}.com/complex/endpoint/${j}`,
                method: ['GET', 'POST', 'PUT', 'DELETE'][j % 4],
                status: [200, 201, 400, 404, 500][j % 5],
                headers: {
                  'Request-ID': `req-${i}-${j}`,
                  'Content-Type': 'application/json',
                  'X-Scenario': `scenario-${i}`
                }
              }))
            )
            .build();
        })
      );

      const buildDuration = performance.now() - startTime;

      expect(scenarios).toHaveLength(scenarioCount);
      expect(buildDuration).toBeLessThan(3000); // Should build 500 complex scenarios within 3 seconds

      // Verify complex scenarios are built correctly
      const firstScenario = scenarios[0];
      const lastScenario = scenarios[scenarioCount - 1];

      expect(Object.keys(firstScenario.localStorage)).toHaveLength(100);
      expect(firstScenario.consoleMessages).toHaveLength(20);
      expect(firstScenario.networkRequests).toHaveLength(15);

      expect(lastScenario.url).toContain(`scenario-${scenarioCount - 1}`);
      expect(Object.keys(lastScenario.sessionStorage)).toHaveLength(50);
    });
  });

  describe('Mock Function Performance', () => {
    it('should handle large numbers of mock functions efficiently', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const mockCount = 5000;
      const startTime = performance.now();

      const mocks = Array.from({ length: mockCount }, (_, i) => {
        return createMockFunction(`performance-mock-${i}`, (value: number) => {
          // Simulate some computation
          return value * i + Math.random();
        });
      });

      const creationDuration = performance.now() - startTime;

      // Use all mocks
      const usageStartTime = performance.now();
      const results = mocks.map((mock, i) => mock(i));
      const usageDuration = performance.now() - usageStartTime;

      expect(mocks).toHaveLength(mockCount);
      expect(results).toHaveLength(mockCount);
      expect(creationDuration).toBeLessThan(1000); // Creation should be fast
      expect(usageDuration).toBeLessThan(500); // Usage should be fast

      const env = getTestEnvironment();
      expect(env!.activeMocks.size).toBe(mockCount);

      // Cleanup performance
      const cleanupStartTime = performance.now();
      await cleanupTestState();
      const cleanupDuration = performance.now() - cleanupStartTime;

      expect(cleanupDuration).toBeLessThan(1000); // Cleanup should be fast
      expect(env!.activeMocks.size).toBe(0);

      await suite.afterEach();
    });

    it('should handle high-frequency mock calls efficiently', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const callCount = 100000;
      const mock = createMockFunction('high-frequency-mock', (value: number) => value * 2);

      const startTime = performance.now();

      // Make many rapid calls
      for (let i = 0; i < callCount; i++) {
        mock(i);
      }

      const callDuration = performance.now() - startTime;

      expect(mock).toHaveBeenCalledTimes(callCount);
      expect(callDuration).toBeLessThan(2000); // Should handle 100k calls within 2 seconds

      await suite.afterEach();
    });

    it('should handle complex mock implementations efficiently', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const complexMockCount = 1000;
      const mocks = Array.from({ length: complexMockCount }, (_, i) => {
        return createMockFunction(`complex-mock-${i}`, (data: any) => {
          // Complex mock implementation
          const result = {
            id: i,
            processedData: JSON.stringify(data),
            timestamp: Date.now(),
            computedValue: Object.keys(data || {}).reduce((sum, key) => {
              return sum + (typeof data[key] === 'string' ? data[key].length : 0);
            }, 0),
            metadata: {
              mockId: i,
              callCount: 0,
              lastCall: Date.now()
            }
          };

          // Simulate state tracking
          if (!result.metadata.callCount) {
            result.metadata.callCount = 1;
          } else {
            result.metadata.callCount++;
          }

          return result;
        });
      });

      const usageStartTime = performance.now();

      // Call each mock with complex data
      const results = mocks.map((mock, i) => {
        return mock({
          id: i,
          name: `Test item ${i}`,
          data: Array.from({ length: 100 }, (_, j) => `item-${i}-${j}`),
          config: {
            enabled: i % 2 === 0,
            priority: i % 10,
            tags: [`tag-${i % 5}`, `category-${i % 3}`]
          }
        });
      });

      const usageDuration = performance.now() - usageStartTime;

      expect(results).toHaveLength(complexMockCount);
      expect(usageDuration).toBeLessThan(3000); // Complex operations should complete within 3 seconds

      // Verify results are properly structured
      expect(results[0]).toHaveProperty('id', 0);
      expect(results[0]).toHaveProperty('processedData');
      expect(results[0]).toHaveProperty('computedValue');

      await suite.afterEach();
    });
  });

  describe('Integrated Performance Tests', () => {
    it('should handle full-scale performance scenario efficiently', async () => {
      const scenario = {
        testSuites: 10,
        mocksPerSuite: 500,
        cleanupTasksPerSuite: 1000,
        browserStatesPerSuite: 100,
        testDataItemsPerSuite: 200
      };

      const totalStartTime = performance.now();
      const suiteResults: Array<{
        suiteId: number;
        setupDuration: number;
        executionDuration: number;
        cleanupDuration: number;
      }> = [];

      for (let suiteId = 0; suiteId < scenario.testSuites; suiteId++) {
        const setupStartTime = performance.now();

        const suite = createTestSuite({
          setupMocks: true,
          cleanupAfterEach: true
        });

        await suite.beforeEach();
        const setupDuration = performance.now() - setupStartTime;

        const executionStartTime = performance.now();

        // Create mocks
        const mocks = Array.from({ length: scenario.mocksPerSuite }, (_, i) =>
          createMockFunction(`suite-${suiteId}-mock-${i}`, (value: number) => value + i)
        );

        // Use mocks
        mocks.forEach((mock, i) => mock(i));

        // Create test data
        for (let i = 0; i < scenario.testDataItemsPerSuite; i++) {
          setTestData(`suite-${suiteId}-data-${i}`, {
            id: i,
            suiteId,
            data: new Array(50).fill(i)
          });
        }

        // Create cleanup tasks
        for (let i = 0; i < scenario.cleanupTasksPerSuite; i++) {
          addCleanupTask(() => {
            // Simulate cleanup work
            const temp = new Array(10).fill(i);
            temp.length = 0;
          });
        }

        // Create browser states
        const browserStates = Array.from({ length: scenario.browserStatesPerSuite }, (_, i) =>
          createBrowserState()
            .withUrl(`https://suite-${suiteId}-state-${i}.example.com`)
            .withLocalStorage({ [`suite-${suiteId}-key-${i}`]: `value-${i}` })
            .build()
        );

        const executionDuration = performance.now() - executionStartTime;

        // Cleanup
        const cleanupStartTime = performance.now();
        await suite.afterEach();
        const cleanupDuration = performance.now() - cleanupStartTime;

        suiteResults.push({
          suiteId,
          setupDuration,
          executionDuration,
          cleanupDuration
        });

        expect(browserStates).toHaveLength(scenario.browserStatesPerSuite);
      }

      const totalDuration = performance.now() - totalStartTime;

      // Performance assertions
      expect(suiteResults).toHaveLength(scenario.testSuites);
      expect(totalDuration).toBeLessThan(30000); // Total should complete within 30 seconds

      // Average performance per suite
      const avgSetupDuration = suiteResults.reduce((sum, r) => sum + r.setupDuration, 0) / scenario.testSuites;
      const avgExecutionDuration = suiteResults.reduce((sum, r) => sum + r.executionDuration, 0) / scenario.testSuites;
      const avgCleanupDuration = suiteResults.reduce((sum, r) => sum + r.cleanupDuration, 0) / scenario.testSuites;

      expect(avgSetupDuration).toBeLessThan(1000);
      expect(avgExecutionDuration).toBeLessThan(2000);
      expect(avgCleanupDuration).toBeLessThan(3000);

      // Log performance metrics for analysis
      console.log('Performance Metrics:', {
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        avgSetupDuration: `${avgSetupDuration.toFixed(2)}ms`,
        avgExecutionDuration: `${avgExecutionDuration.toFixed(2)}ms`,
        avgCleanupDuration: `${avgCleanupDuration.toFixed(2)}ms`,
        scenario
      });
    });

    it('should maintain performance under memory pressure', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Create memory pressure
      const largeObjects: any[] = [];
      for (let i = 0; i < 100; i++) {
        largeObjects.push({
          id: i,
          data: new Array(10000).fill(i),
          nested: {
            moreData: new Array(5000).fill(`item-${i}`),
            timestamp: Date.now()
          }
        });
      }

      setTestData('large-objects', largeObjects);

      // Add many cleanup tasks under memory pressure
      const cleanupTaskCount = 5000;
      const cleanupResults: number[] = [];

      const addTasksStartTime = performance.now();
      for (let i = 0; i < cleanupTaskCount; i++) {
        addCleanupTask(() => {
          cleanupResults.push(i);
        });
      }
      const addTasksDuration = performance.now() - addTasksStartTime;

      // Create mocks under memory pressure
      const mockCount = 1000;
      const mocks = Array.from({ length: mockCount }, (_, i) =>
        createMockFunction(`pressure-mock-${i}`, () => new Array(100).fill(i))
      );

      // Cleanup under memory pressure
      const cleanupStartTime = performance.now();
      await suite.afterEach();
      const cleanupDuration = performance.now() - cleanupStartTime;

      expect(cleanupResults).toHaveLength(cleanupTaskCount);
      expect(addTasksDuration).toBeLessThan(2000);
      expect(cleanupDuration).toBeLessThan(5000);

      // Clear large objects
      largeObjects.length = 0;
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions in cleanup chains', async () => {
      const benchmarkRuns = 5;
      const taskCounts = [100, 500, 1000, 2000, 5000];
      const results: Record<number, number[]> = {};

      for (const taskCount of taskCounts) {
        results[taskCount] = [];

        for (let run = 0; run < benchmarkRuns; run++) {
          const suite = createTestSuite();
          await suite.beforeEach();

          // Add cleanup tasks
          for (let i = 0; i < taskCount; i++) {
            addCleanupTask(() => {
              // Simulate work
              const temp = new Array(10).fill(i);
              temp.reduce((sum, val) => sum + val, 0);
            });
          }

          const startTime = performance.now();
          await suite.afterEach();
          const duration = performance.now() - startTime;

          results[taskCount].push(duration);
        }
      }

      // Analyze performance scaling
      for (const taskCount of taskCounts) {
        const durations = results[taskCount];
        const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const maxDuration = Math.max(...durations);
        const minDuration = Math.min(...durations);

        // Performance should scale reasonably
        const expectedMaxDuration = taskCount * 0.5; // 0.5ms per task maximum
        expect(avgDuration).toBeLessThan(expectedMaxDuration);

        // Consistency check - max shouldn't be more than 3x avg
        expect(maxDuration).toBeLessThan(avgDuration * 3);

        console.log(`Task count: ${taskCount}, Avg: ${avgDuration.toFixed(2)}ms, Min: ${minDuration.toFixed(2)}ms, Max: ${maxDuration.toFixed(2)}ms`);
      }
    });

    it('should maintain consistent performance across multiple iterations', async () => {
      const iterations = 20;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const suite = createTestSuite({
          setupMocks: true,
          cleanupAfterEach: true
        });

        const startTime = performance.now();

        await suite.beforeEach();

        // Standard test operations
        setTestData('iteration-data', { iteration: i, data: new Array(1000).fill(i) });
        createMockFunction(`iteration-mock-${i}`, (value: number) => value * i);

        for (let j = 0; j < 100; j++) {
          addCleanupTask(() => {
            // Simulate cleanup work
          });
        }

        const browserState = createBrowserState()
          .withUrl(`https://iteration-${i}.example.com`)
          .withLocalStorage({ [`iteration-${i}`]: `value-${i}` })
          .build();

        await suite.afterEach();

        const duration = performance.now() - startTime;
        durations.push(duration);

        expect(browserState.url).toBe(`https://iteration-${i}.example.com`);
      }

      // Statistical analysis
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = stdDev / avgDuration;

      // Performance should be consistent (coefficient of variation < 0.5)
      expect(coefficientOfVariation).toBeLessThan(0.5);

      console.log(`Performance consistency: Avg: ${avgDuration.toFixed(2)}ms, StdDev: ${stdDev.toFixed(2)}ms, CV: ${coefficientOfVariation.toFixed(3)}`);
    });
  });
});