import {
  ToolInvocationRecorder,
  ToolInvocationRecord,
} from '../tool-invocation-recorder.js';
import { ToolInvocation, ToolExecution } from '@apexcli/core';

/**
 * Performance tests for ToolInvocationRecorder
 *
 * These tests verify the recorder can handle large volumes of data
 * and concurrent operations without significant performance degradation
 * or memory leaks.
 */
describe('ToolInvocationRecorder - Performance Tests', () => {
  let recorder: ToolInvocationRecorder;

  beforeEach(() => {
    recorder = new ToolInvocationRecorder();
  });

  afterEach(() => {
    recorder.clear();
  });

  describe('large dataset handling', () => {
    it('should handle recording 10,000 invocations efficiently', () => {
      const startTime = performance.now();
      const invocationsCount = 10000;

      // Record many invocations
      for (let i = 0; i < invocationsCount; i++) {
        recorder.recordInvocation({
          toolName: `Tool${i % 10}`, // Use 10 different tools
          parameters: {
            id: i,
            file_path: `/test/file${i}.txt`,
            data: `test data for invocation ${i}`,
          },
          context: {
            taskId: `task-${Math.floor(i / 100)}`, // 100 different tasks
            agentName: i % 2 === 0 ? 'developer' : 'reviewer',
            stageName: ['planning', 'implementation', 'testing', 'review'][i % 4],
          },
          requestId: `req-${i}`,
        });
      }

      const recordingTime = performance.now() - startTime;

      expect(recorder.getInvocationCount()).toBe(invocationsCount);
      expect(recordingTime).toBeLessThan(5000); // Should complete in less than 5 seconds

      console.log(`Recording ${invocationsCount} invocations took ${recordingTime.toFixed(2)}ms`);
    });

    it('should handle querying large datasets efficiently', () => {
      // Setup large dataset
      const invocationsCount = 5000;
      for (let i = 0; i < invocationsCount; i++) {
        recorder.recordInvocation({
          toolName: `Tool${i % 5}`,
          parameters: { id: i, category: i % 10 },
          context: {
            taskId: `task-${Math.floor(i / 50)}`,
            agentName: i % 3 === 0 ? 'developer' : i % 3 === 1 ? 'reviewer' : 'tester',
          },
        });
      }

      // Test query performance
      const queryStartTime = performance.now();

      const results1 = recorder.queryInvocations({ toolName: 'Tool1' });
      const results2 = recorder.queryInvocations({ agentName: 'developer' });
      const results3 = recorder.queryInvocations({
        toolName: 'Tool2',
        agentName: 'reviewer',
        limit: 100
      });

      const queryTime = performance.now() - queryStartTime;

      expect(results1.length).toBe(1000); // Every 5th item
      expect(results2.length).toBe(Math.ceil(invocationsCount / 3));
      expect(results3.length).toBeLessThanOrEqual(100);
      expect(queryTime).toBeLessThan(1000); // Queries should be fast

      console.log(`Complex queries on ${invocationsCount} records took ${queryTime.toFixed(2)}ms`);
    });

    it('should handle statistics calculation on large datasets', () => {
      const invocationsCount = 8000;

      // Setup dataset with executions
      for (let i = 0; i < invocationsCount; i++) {
        const invocation = recorder.recordInvocation({
          toolName: `Tool${i % 8}`,
          parameters: { id: i },
          requestId: `req-${i}`,
        });

        // Add execution for some records
        if (i % 3 === 0) {
          recorder.recordExecution(`req-${i}`, {
            callId: `call-${i}`,
            toolName: invocation.invocation.toolName,
            input: invocation.invocation.parameters,
            startTime: new Date(),
            status: i % 6 === 0 ? 'failed' : 'completed',
            duration: Math.random() * 1000,
          });
        }
      }

      const statsStartTime = performance.now();
      const stats = recorder.getStats();
      const statsTime = performance.now() - statsStartTime;

      expect(stats.totalInvocations).toBe(invocationsCount);
      expect(stats.topTools).toHaveLength(8);
      expect(stats.topTools[0].count).toBeGreaterThan(0);
      expect(statsTime).toBeLessThan(500); // Stats calculation should be fast

      console.log(`Stats calculation on ${invocationsCount} records took ${statsTime.toFixed(2)}ms`);
    });
  });

  describe('memory usage optimization', () => {
    it('should not cause memory leaks with frequent clear operations', () => {
      const iterations = 100;
      const recordsPerIteration = 100;

      for (let iteration = 0; iteration < iterations; iteration++) {
        // Record some data
        for (let i = 0; i < recordsPerIteration; i++) {
          recorder.recordInvocation({
            toolName: 'TestTool',
            parameters: { data: new Array(1000).fill(`iteration-${iteration}-record-${i}`) },
          });
        }

        // Verify recording
        expect(recorder.getInvocationCount()).toBe(recordsPerIteration);

        // Clear and verify cleanup
        recorder.clear();
        expect(recorder.getInvocationCount()).toBe(0);
        expect(recorder.hasInvocations()).toBe(false);
      }

      // Final verification that we're not leaking memory
      expect(recorder.getAllInvocations()).toEqual([]);
    });

    it('should handle large parameter objects without memory issues', () => {
      const largeParameterCount = 1000;

      for (let i = 0; i < largeParameterCount; i++) {
        const largeObject = {
          id: i,
          data: new Array(100).fill(0).map((_, j) => ({
            key: `key-${j}`,
            value: `value-${j}`,
            metadata: {
              timestamp: new Date().toISOString(),
              index: j,
            },
          })),
          config: {
            settings: new Array(50).fill(0).reduce((acc, _, k) => {
              acc[`setting${k}`] = `value${k}`;
              return acc;
            }, {} as Record<string, string>),
          },
        };

        recorder.recordInvocation({
          toolName: 'LargeDataTool',
          parameters: largeObject,
        });
      }

      expect(recorder.getInvocationCount()).toBe(largeParameterCount);

      // Test querying still works with large objects
      const results = recorder.queryInvocations({ toolName: 'LargeDataTool' });
      expect(results).toHaveLength(largeParameterCount);

      // Cleanup
      recorder.clear();
      expect(recorder.getInvocationCount()).toBe(0);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent recording operations safely', async () => {
      const concurrentOperations = 20;
      const recordsPerOperation = 50;

      // Create concurrent recording operations
      const promises = Array.from({ length: concurrentOperations }, (_, operationIndex) =>
        Promise.resolve().then(() => {
          for (let i = 0; i < recordsPerOperation; i++) {
            recorder.recordInvocation({
              toolName: `ConcurrentTool${operationIndex}`,
              parameters: {
                operationIndex,
                recordIndex: i,
                timestamp: Date.now(),
              },
              context: {
                taskId: `concurrent-task-${operationIndex}`,
                agentName: 'concurrentAgent',
              },
            });
          }
        })
      );

      // Wait for all concurrent operations to complete
      await Promise.all(promises);

      // Verify all records were captured
      expect(recorder.getInvocationCount()).toBe(concurrentOperations * recordsPerOperation);

      // Verify data integrity - each operation should have exactly recordsPerOperation records
      for (let i = 0; i < concurrentOperations; i++) {
        const operationResults = recorder.queryInvocations({
          toolName: `ConcurrentTool${i}`,
        });
        expect(operationResults).toHaveLength(recordsPerOperation);
      }
    });

    it('should handle concurrent queries during recording', async () => {
      const recordingDuration = 500; // ms
      const startTime = Date.now();
      let recordingCount = 0;

      // Start continuous recording
      const recordingPromise = new Promise<void>((resolve) => {
        const recordingInterval = setInterval(() => {
          if (Date.now() - startTime > recordingDuration) {
            clearInterval(recordingInterval);
            resolve();
            return;
          }

          recorder.recordInvocation({
            toolName: 'ContinuousRecord',
            parameters: { count: recordingCount++ },
          });
        }, 10);
      });

      // Start concurrent queries
      const queryPromises = Array.from({ length: 10 }, (_, i) =>
        new Promise<number>((resolve) => {
          const queryInterval = setInterval(() => {
            if (Date.now() - startTime > recordingDuration) {
              clearInterval(queryInterval);
              resolve(recorder.getInvocationCount());
              return;
            }

            // Perform various queries
            recorder.queryInvocations({ toolName: 'ContinuousRecord' });
            recorder.getStats();
            recorder.hasInvocations();
          }, 20 + i * 5); // Stagger query intervals
        })
      );

      // Wait for all operations to complete
      await Promise.all([recordingPromise, ...queryPromises]);

      // Verify final state
      expect(recorder.getInvocationCount()).toBeGreaterThan(0);
      const finalStats = recorder.getStats();
      expect(finalStats.totalInvocations).toBe(recorder.getInvocationCount());
    });
  });

  describe('edge case performance', () => {
    it('should handle many small rapid operations efficiently', () => {
      const operationCount = 10000;
      const startTime = performance.now();

      for (let i = 0; i < operationCount; i++) {
        // Alternate between different operations
        switch (i % 4) {
          case 0:
            recorder.recordInvocation({
              toolName: 'RapidTool',
              parameters: { index: i },
            });
            break;
          case 1:
            recorder.hasInvocations();
            break;
          case 2:
            recorder.getInvocationCount();
            break;
          case 3:
            recorder.getLatestInvocation();
            break;
        }
      }

      const totalTime = performance.now() - startTime;
      const expectedRecords = Math.floor(operationCount / 4);

      expect(recorder.getInvocationCount()).toBe(expectedRecords);
      expect(totalTime).toBeLessThan(2000); // Should complete quickly

      console.log(`${operationCount} mixed operations took ${totalTime.toFixed(2)}ms`);
    });

    it('should maintain performance with deeply nested parameter objects', () => {
      const createNestedObject = (depth: number): any => {
        if (depth === 0) {
          return { value: 'leaf', timestamp: Date.now() };
        }
        return {
          level: depth,
          nested: createNestedObject(depth - 1),
          siblings: Array.from({ length: 3 }, (_, i) => ({
            index: i,
            data: `data-${depth}-${i}`,
          })),
        };
      };

      const recordCount = 100;
      const startTime = performance.now();

      for (let i = 0; i < recordCount; i++) {
        recorder.recordInvocation({
          toolName: 'DeepNestTool',
          parameters: {
            id: i,
            deepData: createNestedObject(10), // 10 levels deep
          },
        });
      }

      const recordingTime = performance.now() - startTime;

      // Test querying with nested parameter matching
      const queryStartTime = performance.now();
      const results = recorder.queryInvocations({
        parameters: {
          deepData: { level: 10 }, // Should match the top level
        },
      });
      const queryTime = performance.now() - queryStartTime;

      expect(recorder.getInvocationCount()).toBe(recordCount);
      expect(results).toHaveLength(recordCount);
      expect(recordingTime).toBeLessThan(2000);
      expect(queryTime).toBeLessThan(500);

      console.log(`Deep nested objects: recording=${recordingTime.toFixed(2)}ms, querying=${queryTime.toFixed(2)}ms`);
    });
  });
});