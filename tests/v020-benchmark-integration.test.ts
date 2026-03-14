/**
 * @fileoverview Integration tests for v0.2.0 Performance Benchmarks
 *
 * Tests end-to-end benchmark execution workflows including:
 * - Full benchmark suite execution
 * - Browser launch benchmarks
 * - Configuration parsing benchmarks
 * - Schema validation benchmarks
 * - Task store CRUD benchmarks
 * - CI integration scenarios
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { BenchmarkRunner, BenchmarkReporter, THRESHOLDS, type BenchmarkConfig } from '../benchmarks/shared/index';

describe('v0.2.0 Benchmark Integration Tests', () => {
  let reporter: BenchmarkReporter;

  beforeAll(() => {
    reporter = new BenchmarkReporter();
    // Mock console to reduce noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Core Operations Benchmarking', () => {
    it('should benchmark simple config parsing operations', async () => {
      const runner = new BenchmarkRunner();

      // Simulate config parsing operation
      const mockConfigParsing = () => {
        // Simulate YAML parsing time
        const data = {
          name: 'test-agent',
          version: '1.0.0',
          description: 'Test agent',
          tools: ['tool1', 'tool2'],
        };
        return JSON.parse(JSON.stringify(data));
      };

      const config: BenchmarkConfig = {
        name: 'config-parsing-simple-test',
        iterations: 20,
        warmupIterations: 5,
        threshold: THRESHOLDS.core.configParsing.simple,
      };

      const result = await runner.run(config, mockConfigParsing);

      expect(result.name).toBe('config-parsing-simple-test');
      expect(result.iterations).toBe(20);
      expect(result.warmupIterations).toBe(5);
      expect(result.stats.count).toBe(20);
      expect(result.stats.mean).toBeGreaterThan(0);
      expect(result.stats.mean).toBeLessThan(50); // Should be very fast
      expect(result.passed).toBe(true);
      expect(result.throughput).toBeGreaterThan(20);

      reporter.addResult(result);
    });

    it('should benchmark complex config parsing with validation', async () => {
      const runner = new BenchmarkRunner();

      const mockComplexConfigParsing = () => {
        // Simulate complex config with validation
        const complexData = {
          name: 'complex-agent',
          version: '2.0.0',
          description: 'Complex test agent with many features',
          tools: Array.from({ length: 20 }, (_, i) => `tool-${i}`),
          workflows: Array.from({ length: 5 }, (_, i) => ({
            name: `workflow-${i}`,
            stages: ['planning', 'execution', 'validation'],
          })),
          permissions: {
            read: ['*'],
            write: ['logs/*'],
            execute: ['scripts/*'],
          },
          hooks: {
            beforeCommit: 'lint',
            beforePush: 'test',
          },
        };

        // Simulate validation overhead
        Object.keys(complexData).forEach(key => {
          if (typeof (complexData as any)[key] === 'object') {
            JSON.stringify((complexData as any)[key]);
          }
        });

        return complexData;
      };

      const config: BenchmarkConfig = {
        name: 'config-parsing-complex-test',
        iterations: 15,
        warmupIterations: 3,
        threshold: THRESHOLDS.core.configParsing.withValidation,
      };

      const result = await runner.run(config, mockComplexConfigParsing);

      expect(result.passed).toBe(true);
      expect(result.stats.mean).toBeLessThan(THRESHOLDS.core.configParsing.withValidation.maxMean);
      expect(result.stats.p95).toBeLessThan(THRESHOLDS.core.configParsing.withValidation.maxP95);

      reporter.addResult(result);
    });

    it('should benchmark schema validation operations', async () => {
      const runner = new BenchmarkRunner();

      const mockAgentSchema = {
        name: 'test-agent',
        version: '1.0.0',
        description: 'Test agent for benchmarking',
        tools: ['browser', 'file-system'],
        permissions: {
          read: ['*'],
          write: ['output/*'],
        },
      };

      const mockSchemaValidation = () => {
        // Simulate Zod schema validation
        const requiredFields = ['name', 'version', 'description'];
        const optionalFields = ['tools', 'permissions', 'workflows'];

        // Validate required fields
        for (const field of requiredFields) {
          if (!(field in mockAgentSchema)) {
            throw new Error(`Missing required field: ${field}`);
          }
        }

        // Validate optional fields if present
        for (const field of optionalFields) {
          if (field in mockAgentSchema) {
            const value = (mockAgentSchema as any)[field];
            if (field === 'tools' && !Array.isArray(value)) {
              throw new Error(`Field ${field} must be an array`);
            }
            if (field === 'permissions' && typeof value !== 'object') {
              throw new Error(`Field ${field} must be an object`);
            }
          }
        }

        return mockAgentSchema;
      };

      const config: BenchmarkConfig = {
        name: 'schema-validation-agent-test',
        iterations: 100,
        warmupIterations: 10,
        threshold: THRESHOLDS.core.schemaValidation.agentDefinition,
      };

      const result = await runner.run(config, mockSchemaValidation);

      expect(result.passed).toBe(true);
      expect(result.stats.mean).toBeLessThan(THRESHOLDS.core.schemaValidation.agentDefinition.maxMean);
      expect(result.throughput).toBeGreaterThan(THRESHOLDS.core.schemaValidation.agentDefinition.minThroughput!);

      reporter.addResult(result);
    });
  });

  describe('Database Operations Benchmarking', () => {
    let mockTaskStore: { tasks: Map<string, any>; nextId: number };

    beforeAll(() => {
      // Mock task store
      mockTaskStore = {
        tasks: new Map(),
        nextId: 1,
      };
    });

    it('should benchmark task creation operations', async () => {
      const runner = new BenchmarkRunner();

      const mockTaskCreate = () => {
        const id = mockTaskStore.nextId++;
        const task = {
          id: id.toString(),
          name: `task-${id}`,
          status: 'pending',
          created: new Date(),
          data: { step: 1, details: 'Test task data' },
        };
        mockTaskStore.tasks.set(task.id, task);
        return task;
      };

      const config: BenchmarkConfig = {
        name: 'task-store-create-test',
        iterations: 50,
        warmupIterations: 5,
        threshold: THRESHOLDS.orchestrator.taskStore.create,
      };

      const result = await runner.run(config, mockTaskCreate);

      expect(result.passed).toBe(true);
      expect(result.stats.mean).toBeLessThan(THRESHOLDS.orchestrator.taskStore.create.maxMean);
      expect(result.throughput).toBeGreaterThan(THRESHOLDS.orchestrator.taskStore.create.minThroughput!);
      expect(mockTaskStore.tasks.size).toBe(50 + 5); // iterations + warmup

      reporter.addResult(result);
    });

    it('should benchmark task read operations', async () => {
      const runner = new BenchmarkRunner();

      // Ensure we have some tasks to read
      const taskIds = Array.from(mockTaskStore.tasks.keys()).slice(0, 10);
      let readIndex = 0;

      const mockTaskRead = () => {
        const id = taskIds[readIndex % taskIds.length];
        readIndex++;
        const task = mockTaskStore.tasks.get(id);
        if (!task) {
          throw new Error(`Task ${id} not found`);
        }
        return task;
      };

      const config: BenchmarkConfig = {
        name: 'task-store-read-test',
        iterations: 100,
        warmupIterations: 10,
        threshold: THRESHOLDS.orchestrator.taskStore.read,
      };

      const result = await runner.run(config, mockTaskRead);

      expect(result.passed).toBe(true);
      expect(result.stats.mean).toBeLessThan(THRESHOLDS.orchestrator.taskStore.read.maxMean);
      expect(result.throughput).toBeGreaterThan(THRESHOLDS.orchestrator.taskStore.read.minThroughput!);

      reporter.addResult(result);
    });

    it('should benchmark task update operations', async () => {
      const runner = new BenchmarkRunner();

      const taskIds = Array.from(mockTaskStore.tasks.keys()).slice(0, 10);
      let updateIndex = 0;
      const statuses = ['pending', 'running', 'completed', 'failed'];

      const mockTaskUpdate = () => {
        const id = taskIds[updateIndex % taskIds.length];
        const newStatus = statuses[updateIndex % statuses.length];
        updateIndex++;

        const task = mockTaskStore.tasks.get(id);
        if (!task) {
          throw new Error(`Task ${id} not found`);
        }

        task.status = newStatus;
        task.updated = new Date();
        mockTaskStore.tasks.set(id, task);
        return task;
      };

      const config: BenchmarkConfig = {
        name: 'task-store-update-test',
        iterations: 75,
        warmupIterations: 8,
        threshold: THRESHOLDS.orchestrator.taskStore.update,
      };

      const result = await runner.run(config, mockTaskUpdate);

      expect(result.passed).toBe(true);
      expect(result.stats.mean).toBeLessThan(THRESHOLDS.orchestrator.taskStore.update.maxMean);
      expect(result.throughput).toBeGreaterThan(THRESHOLDS.orchestrator.taskStore.update.minThroughput!);

      reporter.addResult(result);
    });

    it('should benchmark task deletion operations', async () => {
      const runner = new BenchmarkRunner();

      // Create some tasks specifically for deletion
      const tasksToDelete = [];
      for (let i = 0; i < 100; i++) {
        const id = `delete-task-${i}`;
        const task = {
          id,
          name: `Temporary task ${i}`,
          status: 'pending',
          created: new Date(),
        };
        mockTaskStore.tasks.set(id, task);
        tasksToDelete.push(id);
      }

      let deleteIndex = 0;

      const mockTaskDelete = () => {
        const id = tasksToDelete[deleteIndex++];
        if (!mockTaskStore.tasks.has(id)) {
          throw new Error(`Task ${id} not found`);
        }
        const deleted = mockTaskStore.tasks.delete(id);
        return deleted;
      };

      const config: BenchmarkConfig = {
        name: 'task-store-delete-test',
        iterations: 50,
        warmupIterations: 5,
        threshold: THRESHOLDS.orchestrator.taskStore.delete,
      };

      const result = await runner.run(config, mockTaskDelete);

      expect(result.passed).toBe(true);
      expect(result.stats.mean).toBeLessThan(THRESHOLDS.orchestrator.taskStore.delete.maxMean);
      expect(result.throughput).toBeGreaterThan(THRESHOLDS.orchestrator.taskStore.delete.minThroughput!);

      reporter.addResult(result);
    });

    it('should benchmark bulk task creation', async () => {
      const runner = new BenchmarkRunner();

      const mockBulkCreate = () => {
        const tasks = [];
        for (let i = 0; i < 100; i++) {
          const id = mockTaskStore.nextId++;
          const task = {
            id: id.toString(),
            name: `bulk-task-${id}`,
            status: 'pending',
            created: new Date(),
            data: { batch: true, index: i },
          };
          mockTaskStore.tasks.set(task.id, task);
          tasks.push(task);
        }
        return tasks;
      };

      const config: BenchmarkConfig = {
        name: 'task-store-bulk-create-test',
        iterations: 10,
        warmupIterations: 2,
        threshold: THRESHOLDS.orchestrator.taskStore.bulkCreate100,
      };

      const result = await runner.run(config, mockBulkCreate);

      expect(result.passed).toBe(true);
      expect(result.stats.mean).toBeLessThan(THRESHOLDS.orchestrator.taskStore.bulkCreate100.maxMean);

      reporter.addResult(result);
    });

    it('should benchmark task query operations', async () => {
      const runner = new BenchmarkRunner();

      const mockQueryByStatus = () => {
        const status = 'completed';
        const results = [];
        for (const [id, task] of mockTaskStore.tasks.entries()) {
          if (task.status === status) {
            results.push(task);
          }
        }
        return results;
      };

      const config: BenchmarkConfig = {
        name: 'task-store-query-by-status-test',
        iterations: 30,
        warmupIterations: 3,
        threshold: THRESHOLDS.orchestrator.taskStore.queryByStatus,
      };

      const result = await runner.run(config, mockQueryByStatus);

      expect(result.passed).toBe(true);
      expect(result.stats.mean).toBeLessThan(THRESHOLDS.orchestrator.taskStore.queryByStatus.maxMean);

      reporter.addResult(result);
    });
  });

  describe('Browser Operations Simulation', () => {
    it('should benchmark browser launch simulation', async () => {
      const runner = new BenchmarkRunner();

      const mockBrowserLaunch = async () => {
        // Simulate browser launch overhead
        return new Promise(resolve => {
          // Simulate the time it takes to launch a browser process
          setTimeout(() => {
            resolve({
              success: true,
              browser: {
                type: 'chromium',
                pid: Math.floor(Math.random() * 10000),
                version: '119.0.0.0',
              },
            });
          }, Math.random() * 100 + 50); // 50-150ms simulation
        });
      };

      const config: BenchmarkConfig = {
        name: 'browser-launch-simulation-test',
        iterations: 5,
        warmupIterations: 1,
        threshold: {
          maxMean: 200, // More lenient for simulation
          maxP95: 400,
        },
      };

      const result = await runner.run(config, mockBrowserLaunch);

      expect(result.passed).toBe(true);
      expect(result.stats.mean).toBeGreaterThan(50); // Should take some time
      expect(result.stats.mean).toBeLessThan(200);

      reporter.addResult(result);
    });

    it('should benchmark screenshot capture simulation', async () => {
      const runner = new BenchmarkRunner();

      const mockScreenshotCapture = async () => {
        // Simulate screenshot capture process
        return new Promise(resolve => {
          // Simulate PNG encoding time
          setTimeout(() => {
            resolve({
              success: true,
              format: 'png',
              size: { width: 1280, height: 720 },
              data: new Uint8Array(1280 * 720 * 4), // RGBA
            });
          }, Math.random() * 50 + 25); // 25-75ms simulation
        });
      };

      const config: BenchmarkConfig = {
        name: 'screenshot-capture-simulation-test',
        iterations: 10,
        warmupIterations: 2,
        threshold: {
          maxMean: 100, // More lenient for simulation
          maxP95: 150,
        },
      };

      const result = await runner.run(config, mockScreenshotCapture);

      expect(result.passed).toBe(true);
      expect(result.stats.mean).toBeGreaterThan(20); // Should take some time
      expect(result.stats.mean).toBeLessThan(100);

      reporter.addResult(result);
    });
  });

  describe('Memory Measurement Integration', () => {
    it('should measure memory usage during operations', async () => {
      const runner = new BenchmarkRunner();

      const mockMemoryIntensiveOperation = () => {
        // Create some objects to use memory
        const data = [];
        for (let i = 0; i < 1000; i++) {
          data.push({
            id: i,
            name: `item-${i}`,
            data: new Array(100).fill(i),
          });
        }
        return data.length;
      };

      const config: BenchmarkConfig = {
        name: 'memory-measurement-test',
        iterations: 5,
        warmupIterations: 2,
        threshold: {
          maxMean: 50,
          maxP95: 100,
        },
        measureMemory: true,
      };

      const result = await runner.run(config, mockMemoryIntensiveOperation);

      expect(result.passed).toBe(true);
      expect(result.memoryDelta).toBeDefined();
      // Memory delta might be positive or negative due to GC
      expect(typeof result.memoryDelta).toBe('number');

      reporter.addResult(result);
    });
  });

  describe('End-to-End Benchmark Suite', () => {
    it('should execute a complete benchmark suite and generate report', async () => {
      // Add a few more quick benchmarks to have a comprehensive suite
      const runner = new BenchmarkRunner();

      // Quick math operation benchmark
      const mathResult = await runner.run(
        {
          name: 'math-operations-test',
          iterations: 100,
          warmupIterations: 10,
          threshold: { maxMean: 1, maxP95: 2 },
        },
        () => {
          return Math.sqrt(Math.random() * 1000) + Math.sin(Math.random());
        }
      );

      // JSON serialization benchmark
      const jsonResult = await runner.run(
        {
          name: 'json-serialization-test',
          iterations: 50,
          warmupIterations: 5,
          threshold: { maxMean: 5, maxP95: 10 },
        },
        () => {
          const data = {
            items: Array.from({ length: 50 }, (_, i) => ({ id: i, name: `item-${i}` })),
            timestamp: new Date().toISOString(),
            metadata: { version: '1.0.0', type: 'test' },
          };
          return JSON.parse(JSON.stringify(data));
        }
      );

      reporter.addResult(mathResult);
      reporter.addResult(jsonResult);

      // Generate final report
      const report = reporter.generateReport({
        commit: 'test-commit-abc123',
        branch: 'test-branch',
      });

      expect(report.results.length).toBeGreaterThan(10); // Should have many benchmarks
      expect(report.summary.totalBenchmarks).toBe(report.results.length);
      expect(report.summary.passed).toBeGreaterThan(0);
      expect(report.commit).toBe('test-commit-abc123');
      expect(report.branch).toBe('test-branch');

      // Verify environment information
      expect(report.environment.os).toBeDefined();
      expect(report.environment.nodeVersion).toBeDefined();
      expect(report.environment.cpuCount).toBeGreaterThan(0);
      expect(report.environment.memoryGB).toBeGreaterThan(0);

      // Verify summary calculations
      const actualPassed = report.results.filter(r => r.passed).length;
      const actualFailed = report.results.filter(r => !r.passed).length;
      expect(report.summary.passed).toBe(actualPassed);
      expect(report.summary.failed).toBe(actualFailed);

      // Verify total duration
      const expectedDuration = report.results.reduce((sum, r) => sum + r.stats.totalTime, 0);
      expect(report.summary.totalDuration).toBe(expectedDuration);

      // Print final report (should not throw)
      expect(() => {
        reporter.printReport();
      }).not.toThrow();
    });

    it('should handle benchmark failures gracefully in suite', async () => {
      const failingReporter = new BenchmarkReporter();
      failingReporter.start();

      const runner = new BenchmarkRunner();

      // Add a passing benchmark
      const passingResult = await runner.run(
        {
          name: 'passing-benchmark',
          iterations: 5,
          warmupIterations: 1,
          threshold: { maxMean: 10, maxP95: 20 },
        },
        () => {
          return 'success';
        }
      );

      // Add a failing benchmark (exceeds threshold)
      const failingResult = await runner.run(
        {
          name: 'failing-benchmark',
          iterations: 3,
          warmupIterations: 1,
          threshold: { maxMean: 1, maxP95: 2 }, // Very strict threshold
        },
        () => {
          // Simulate slow operation
          for (let i = 0; i < 100000; i++) {
            Math.random();
          }
          return 'slow';
        }
      );

      failingReporter.addResult(passingResult);
      failingReporter.addResult(failingResult);

      expect(passingResult.passed).toBe(true);
      expect(failingResult.passed).toBe(false);
      expect(failingResult.failures.length).toBeGreaterThan(0);

      expect(failingReporter.allPassed()).toBe(false);
      expect(failingReporter.getFailures()).toContain('failing-benchmark');

      const report = failingReporter.generateReport();
      expect(report.summary.passed).toBe(1);
      expect(report.summary.failed).toBe(1);
      expect(report.summary.regressions).toContain('failing-benchmark');
    });
  });

  describe('CI Integration Simulation', () => {
    it('should simulate CI environment benchmarking', async () => {
      // Temporarily set CI environment
      const originalCI = process.env.CI;
      process.env.CI = 'true';

      try {
        const ciReporter = new BenchmarkReporter();
        ciReporter.start();

        const runner = new BenchmarkRunner();

        // Simulate CI-appropriate benchmarks (fewer iterations, relaxed thresholds)
        const ciResult = await runner.run(
          {
            name: 'ci-optimized-benchmark',
            iterations: 10, // Fewer iterations for CI speed
            warmupIterations: 2,
            threshold: {
              maxMean: 50, // More relaxed for variable CI environment
              maxP95: 100,
            },
          },
          () => {
            // Simple operation that should pass in CI
            return Array.from({ length: 100 }, (_, i) => i).reduce((a, b) => a + b, 0);
          }
        );

        ciReporter.addResult(ciResult);

        const ciReport = ciReporter.generateReport({
          commit: 'ci-commit-def456',
          branch: 'main',
        });

        expect(ciReport.isCI).toBe(true);
        expect(ciResult.passed).toBe(true);
        expect(ciReport.commit).toBe('ci-commit-def456');
        expect(ciReport.branch).toBe('main');

      } finally {
        // Restore original CI setting
        if (originalCI !== undefined) {
          process.env.CI = originalCI;
        } else {
          delete process.env.CI;
        }
      }
    });
  });
});