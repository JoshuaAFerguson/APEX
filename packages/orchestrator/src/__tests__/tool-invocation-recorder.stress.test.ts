import {
  ToolInvocationRecorder,
  ToolInvocationQueryOptions,
} from '../tool-invocation-recorder.js';
import { ToolInvocation, ToolExecution } from '@apexcli/core';

/**
 * Stress tests for ToolInvocationRecorder
 *
 * These tests push the recorder to its limits to ensure it can handle
 * extreme scenarios without breaking or causing performance issues.
 */
describe('ToolInvocationRecorder - Stress Tests', () => {
  let recorder: ToolInvocationRecorder;

  beforeEach(() => {
    recorder = new ToolInvocationRecorder();
  });

  afterEach(() => {
    recorder.clear();
  });

  describe('extreme data volumes', () => {
    it('should handle 100,000 invocations without performance degradation', () => {
      const invocationCount = 100000;
      const batchSize = 1000;
      const startTime = performance.now();

      console.log(`Starting stress test with ${invocationCount} invocations...`);

      // Record invocations in batches for better progress tracking
      for (let batch = 0; batch < invocationCount / batchSize; batch++) {
        const batchStartTime = performance.now();

        for (let i = 0; i < batchSize; i++) {
          const index = batch * batchSize + i;
          recorder.recordInvocation({
            toolName: `Tool${index % 50}`, // 50 different tools
            parameters: {
              id: index,
              batch,
              data: `batch-${batch}-item-${i}`,
              metadata: {
                timestamp: new Date().toISOString(),
                category: index % 10,
                priority: index % 5,
              },
            },
            context: {
              taskId: `task-${Math.floor(index / 1000)}`, // 100 different tasks
              agentName: ['developer', 'tester', 'reviewer', 'architect'][index % 4],
              stageName: ['planning', 'implementation', 'testing', 'review'][index % 4],
            },
            requestId: `stress-req-${index}`,
          });
        }

        const batchTime = performance.now() - batchStartTime;
        if (batch % 10 === 0) { // Progress report every 10 batches
          console.log(`Batch ${batch + 1}/${invocationCount / batchSize} completed in ${batchTime.toFixed(2)}ms`);
        }
      }

      const totalTime = performance.now() - startTime;

      expect(recorder.getInvocationCount()).toBe(invocationCount);
      expect(totalTime).toBeLessThan(30000); // Should complete in under 30 seconds

      console.log(`Stress test completed: ${invocationCount} invocations in ${totalTime.toFixed(2)}ms`);

      // Test querying performance on large dataset
      const queryStart = performance.now();
      const results = recorder.queryInvocations({ toolName: 'Tool1', limit: 1000 });
      const queryTime = performance.now() - queryStart;

      expect(results.length).toBeLessThanOrEqual(1000);
      expect(queryTime).toBeLessThan(1000); // Query should be fast even on large dataset

      console.log(`Query on large dataset took ${queryTime.toFixed(2)}ms`);
    });

    it('should maintain performance across multiple clear/reload cycles', () => {
      const cycleCount = 50;
      const recordsPerCycle = 1000;
      const times: number[] = [];

      for (let cycle = 0; cycle < cycleCount; cycle++) {
        const cycleStart = performance.now();

        // Record data
        for (let i = 0; i < recordsPerCycle; i++) {
          recorder.recordInvocation({
            toolName: `CycleTool${i % 10}`,
            parameters: { cycle, index: i },
            context: { taskId: `cycle-${cycle}`, agentName: 'test-agent' },
          });
        }

        // Perform operations
        recorder.getStats();
        recorder.queryInvocations({ agentName: 'test-agent' });
        recorder.hasInvocations();

        // Clear for next cycle
        recorder.clear();

        const cycleTime = performance.now() - cycleStart;
        times.push(cycleTime);

        if (cycle % 10 === 0) {
          console.log(`Cycle ${cycle + 1}/${cycleCount} completed in ${cycleTime.toFixed(2)}ms`);
        }
      }

      // Verify performance doesn't degrade over cycles
      const firstQuarter = times.slice(0, Math.floor(cycleCount / 4));
      const lastQuarter = times.slice(-Math.floor(cycleCount / 4));

      const firstQuarterAvg = firstQuarter.reduce((sum, time) => sum + time, 0) / firstQuarter.length;
      const lastQuarterAvg = lastQuarter.reduce((sum, time) => sum + time, 0) / lastQuarter.length;

      // Last quarter should not be significantly slower than first quarter
      expect(lastQuarterAvg).toBeLessThan(firstQuarterAvg * 2);

      console.log(`Average time - First quarter: ${firstQuarterAvg.toFixed(2)}ms, Last quarter: ${lastQuarterAvg.toFixed(2)}ms`);
    });
  });

  describe('concurrent operation stress', () => {
    it('should handle intense concurrent recording and querying', async () => {
      const concurrentWriters = 20;
      const concurrentReaders = 10;
      const operationDuration = 2000; // 2 seconds
      const recordsPerWriter = 100;

      const startTime = Date.now();
      const operations: Promise<any>[] = [];

      // Start concurrent writers
      for (let i = 0; i < concurrentWriters; i++) {
        operations.push(
          new Promise<number>((resolve) => {
            let recordCount = 0;
            const writerInterval = setInterval(() => {
              if (Date.now() - startTime > operationDuration || recordCount >= recordsPerWriter) {
                clearInterval(writerInterval);
                resolve(recordCount);
                return;
              }

              recorder.recordInvocation({
                toolName: `Writer${i}Tool`,
                parameters: {
                  writerId: i,
                  recordIndex: recordCount,
                  timestamp: Date.now(),
                },
                context: {
                  taskId: `concurrent-task-${i}`,
                  agentName: `writer-${i}`,
                  stageName: 'concurrent-test',
                },
                requestId: `writer-${i}-record-${recordCount}`,
              });
              recordCount++;
            }, 10 + Math.random() * 20); // Variable intervals
          })
        );
      }

      // Start concurrent readers
      for (let i = 0; i < concurrentReaders; i++) {
        operations.push(
          new Promise<number>((resolve) => {
            let queryCount = 0;
            const readerInterval = setInterval(() => {
              if (Date.now() - startTime > operationDuration) {
                clearInterval(readerInterval);
                resolve(queryCount);
                return;
              }

              // Perform various query operations
              const queries: (() => any)[] = [
                () => recorder.getInvocationCount(),
                () => recorder.hasInvocations(),
                () => recorder.getLatestInvocation(),
                () => recorder.getStats(),
                () => recorder.queryInvocations({ stageName: 'concurrent-test' }),
                () => recorder.queryInvocations({ toolName: `Writer${i % concurrentWriters}Tool` }),
                () => recorder.getAllInvocations(),
              ];

              const randomQuery = queries[Math.floor(Math.random() * queries.length)];
              try {
                randomQuery();
                queryCount++;
              } catch (error) {
                console.error('Query failed:', error);
              }
            }, 15 + Math.random() * 25);
          })
        );
      }

      // Wait for all operations to complete
      const results = await Promise.all(operations);
      const totalRecordsWritten = results.slice(0, concurrentWriters).reduce((sum, count) => sum + count, 0);
      const totalQueriesPerformed = results.slice(concurrentWriters).reduce((sum, count) => sum + count, 0);

      console.log(`Concurrent stress test completed:`);
      console.log(`- Total records written: ${totalRecordsWritten}`);
      console.log(`- Total queries performed: ${totalQueriesPerformed}`);
      console.log(`- Final record count: ${recorder.getInvocationCount()}`);

      // Verify data integrity
      expect(recorder.getInvocationCount()).toBe(totalRecordsWritten);
      expect(totalQueriesPerformed).toBeGreaterThan(0);

      // Verify no data corruption
      const finalStats = recorder.getStats();
      expect(finalStats.totalInvocations).toBe(totalRecordsWritten);

      // Test that we can still perform complex queries correctly
      const concurrentTestRecords = recorder.queryInvocations({ stageName: 'concurrent-test' });
      expect(concurrentTestRecords).toHaveLength(totalRecordsWritten);
    }, 10000); // 10 second timeout

    it('should handle concurrent execution updates without data loss', async () => {
      const invocationCount = 1000;
      const concurrentUpdaters = 5;

      // Pre-populate with invocations
      const invocations: string[] = [];
      for (let i = 0; i < invocationCount; i++) {
        const requestId = `concurrent-exec-${i}`;
        invocations.push(requestId);

        recorder.recordInvocation({
          toolName: 'ConcurrentExecTool',
          parameters: { index: i },
          context: {
            taskId: 'concurrent-exec-task',
            agentName: `agent-${i % 10}`,
          },
          requestId,
        });
      }

      expect(recorder.getInvocationCount()).toBe(invocationCount);

      // Concurrently update executions
      const updatePromises = Array.from({ length: concurrentUpdaters }, (_, updaterIndex) =>
        Promise.resolve().then(() => {
          const updaterInvocations = invocations.filter((_, index) => index % concurrentUpdaters === updaterIndex);

          updaterInvocations.forEach((requestId, localIndex) => {
            const execution: ToolExecution = {
              callId: `${requestId}-call`,
              toolName: 'ConcurrentExecTool',
              input: { index: localIndex },
              startTime: new Date(),
              status: Math.random() > 0.1 ? 'completed' : 'failed',
              duration: Math.random() * 500 + 50,
            };

            if (execution.status === 'failed') {
              execution.error = `Simulated error for ${requestId}`;
            } else {
              execution.result = { success: true, updater: updaterIndex };
            }

            const updated = recorder.recordExecution(requestId, execution);
            if (!updated) {
              console.warn(`Failed to update execution for ${requestId}`);
            }
          });
        })
      );

      await Promise.all(updatePromises);

      // Verify all executions were recorded
      const recordsWithExecutions = recorder.getAllInvocations().filter(r => r.execution);
      expect(recordsWithExecutions).toHaveLength(invocationCount);

      // Verify data integrity
      const stats = recorder.getStats();
      expect(stats.totalInvocations).toBe(invocationCount);
      expect(stats.successfulExecutions + stats.failedExecutions).toBe(invocationCount);

      console.log(`Concurrent execution updates completed:`);
      console.log(`- Successful executions: ${stats.successfulExecutions}`);
      console.log(`- Failed executions: ${stats.failedExecutions}`);
    });
  });

  describe('edge case stress', () => {
    it('should handle extremely large parameter objects', () => {
      const createMassiveObject = (depth: number, breadth: number): any => {
        if (depth === 0) {
          return {
            data: new Array(100).fill(0).map(i => `leaf-data-${i}`).join(''),
            timestamp: Date.now(),
            random: Math.random(),
          };
        }

        const obj: any = {
          level: depth,
          metadata: {
            size: breadth,
            created: new Date().toISOString(),
          },
        };

        for (let i = 0; i < breadth; i++) {
          obj[`child_${i}`] = createMassiveObject(depth - 1, Math.max(1, Math.floor(breadth / 2)));
        }

        return obj;
      };

      const massiveObjectCount = 50;
      const startTime = performance.now();

      for (let i = 0; i < massiveObjectCount; i++) {
        recorder.recordInvocation({
          toolName: 'MassiveObjectTool',
          parameters: {
            index: i,
            massiveObject: createMassiveObject(5, 4), // Very deep and wide object
            additionalData: new Array(1000).fill(0).map(j => ({
              id: j,
              value: `value-${i}-${j}`,
              nested: {
                deep: {
                  data: `deep-data-${i}-${j}`,
                },
              },
            })),
          },
          context: {
            taskId: 'massive-object-task',
            agentName: 'stress-test-agent',
          },
        });
      }

      const recordingTime = performance.now() - startTime;

      expect(recorder.getInvocationCount()).toBe(massiveObjectCount);
      expect(recordingTime).toBeLessThan(10000); // Should complete in reasonable time

      // Test querying with massive objects
      const queryStart = performance.now();
      const results = recorder.queryInvocations({ toolName: 'MassiveObjectTool' });
      const queryTime = performance.now() - queryStart;

      expect(results).toHaveLength(massiveObjectCount);
      expect(queryTime).toBeLessThan(2000);

      console.log(`Massive objects test: recording=${recordingTime.toFixed(2)}ms, querying=${queryTime.toFixed(2)}ms`);
    });

    it('should handle rapid clear/record cycles without memory issues', () => {
      const rapidCycles = 1000;
      const recordsPerCycle = 10;

      console.log(`Starting rapid clear/record cycles: ${rapidCycles} cycles`);

      for (let cycle = 0; cycle < rapidCycles; cycle++) {
        // Record some data
        for (let i = 0; i < recordsPerCycle; i++) {
          recorder.recordInvocation({
            toolName: 'RapidCycleTool',
            parameters: {
              cycle,
              record: i,
              data: new Array(100).fill(`cycle-${cycle}-record-${i}`),
            },
          });
        }

        // Verify recording
        expect(recorder.getInvocationCount()).toBe(recordsPerCycle);

        // Perform some operations
        if (cycle % 100 === 0) {
          const stats = recorder.getStats();
          expect(stats.totalInvocations).toBe(recordsPerCycle);
        }

        // Clear immediately
        recorder.clear();
        expect(recorder.getInvocationCount()).toBe(0);
        expect(recorder.hasInvocations()).toBe(false);
      }

      console.log(`Rapid cycles completed successfully`);

      // Final verification of clean state
      expect(recorder.getAllInvocations()).toEqual([]);
      expect(recorder.getStats().totalInvocations).toBe(0);
    });

    it('should handle complex query combinations under stress', () => {
      const complexDataCount = 5000;

      // Generate complex test data
      for (let i = 0; i < complexDataCount; i++) {
        recorder.recordInvocation({
          toolName: `ComplexTool${i % 20}`,
          parameters: {
            index: i,
            category: `cat-${i % 15}`,
            priority: i % 5,
            tags: new Array(i % 10).fill(0).map(j => `tag-${j}`),
            config: {
              settings: {
                level: i % 3,
                enabled: i % 2 === 0,
              },
            },
          },
          context: {
            taskId: `complex-task-${Math.floor(i / 100)}`,
            agentName: ['dev', 'test', 'review', 'ops'][i % 4],
            stageName: ['plan', 'impl', 'test', 'deploy'][i % 4],
          },
          requestId: `complex-req-${i}`,
        });

        // Add execution for some records
        if (i % 3 === 0) {
          recorder.recordExecution(`complex-req-${i}`, {
            callId: `complex-call-${i}`,
            toolName: `ComplexTool${i % 20}`,
            input: {},
            startTime: new Date(),
            status: i % 7 === 0 ? 'failed' : 'completed',
            duration: Math.random() * 1000,
          });
        }
      }

      // Perform complex stress queries
      const queryStart = performance.now();

      const complexQueries: (() => any)[] = [
        () => recorder.queryInvocations({
          toolName: 'ComplexTool5',
          agentName: 'dev',
          stageName: 'impl',
          status: 'completed',
        }),
        () => recorder.queryInvocations({
          parameters: { category: 'cat-5', priority: 0 },
          limit: 100,
        }),
        () => recorder.queryInvocations({
          taskId: 'complex-task-10',
          status: 'failed',
        }),
        () => recorder.queryInvocations({
          toolName: 'ComplexTool1',
          parameters: { config: { settings: { enabled: true } } },
        }),
        () => recorder.queryInvocations({
          agentName: 'test',
          stageName: 'test',
          startTime: new Date(Date.now() - 3600000), // 1 hour ago
        }),
      ];

      const queryResults = complexQueries.map(query => {
        const start = performance.now();
        const result = query();
        const time = performance.now() - start;
        return { result, time };
      });

      const totalQueryTime = performance.now() - queryStart;

      // Verify all queries completed successfully
      queryResults.forEach(({ result, time }) => {
        expect(Array.isArray(result)).toBe(true);
        expect(time).toBeLessThan(500); // Each query should be fast
      });

      expect(totalQueryTime).toBeLessThan(2000); // All queries together

      console.log(`Complex query stress test completed in ${totalQueryTime.toFixed(2)}ms`);
      console.log(`Query results: ${queryResults.map(r => r.result.length).join(', ')} records`);
    });
  });

  describe('memory and resource management', () => {
    it('should handle memory pressure gracefully', () => {
      const memoryPressureCount = 20000;
      let peakMemoryUsage = 0;

      const measureMemory = () => {
        if (typeof process !== 'undefined' && process.memoryUsage) {
          return process.memoryUsage().heapUsed;
        }
        return 0; // Fallback for environments without process.memoryUsage
      };

      const initialMemory = measureMemory();

      // Create memory pressure with large objects
      for (let i = 0; i < memoryPressureCount; i++) {
        recorder.recordInvocation({
          toolName: 'MemoryPressureTool',
          parameters: {
            index: i,
            largeArray: new Array(500).fill(0).map(j => ({
              id: `${i}-${j}`,
              data: `data-${i}-${j}`.repeat(10),
            })),
          },
        });

        // Monitor memory usage periodically
        if (i % 1000 === 0) {
          const currentMemory = measureMemory();
          peakMemoryUsage = Math.max(peakMemoryUsage, currentMemory);

          if (currentMemory > 0) {
            const memoryIncrease = currentMemory - initialMemory;
            console.log(`Records: ${i}, Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
          }
        }
      }

      expect(recorder.getInvocationCount()).toBe(memoryPressureCount);

      // Test operations still work under memory pressure
      const stats = recorder.getStats();
      expect(stats.totalInvocations).toBe(memoryPressureCount);

      const queryResults = recorder.queryInvocations({ limit: 1000 });
      expect(queryResults).toHaveLength(1000);

      // Clean up and verify memory is released
      recorder.clear();
      expect(recorder.getInvocationCount()).toBe(0);

      console.log(`Memory pressure test completed with ${memoryPressureCount} large objects`);
    });
  });
});