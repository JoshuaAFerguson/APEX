/**
 * @fileoverview Unit tests for v0.2.0 Performance Benchmarks - BenchmarkRunner class
 *
 * Tests core functionality of the BenchmarkRunner including:
 * - Timing and measurement recording
 * - Warmup phase management
 * - Statistical calculations
 * - Result formatting and reporting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BenchmarkRunner, type BenchmarkConfig, type BenchmarkThreshold } from '../benchmarks/shared/benchmark-runner';

describe('v0.2.0 BenchmarkRunner Unit Tests', () => {
  let runner: BenchmarkRunner;

  beforeEach(() => {
    runner = new BenchmarkRunner();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Core Timing Functionality', () => {
    it('should start and stop timing correctly', () => {
      const startTime = performance.now();
      runner.start();

      // Simulate some work
      for (let i = 0; i < 1000; i++) {
        Math.random();
      }

      const duration = runner.stop();
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should record measurements during measured phase only', () => {
      // First measurement during warmup
      runner.start();
      runner.stop();

      expect(runner.getMeasurements()).toHaveLength(0);

      // Mark warmup complete
      runner.completeWarmup();

      // Now measurements should be recorded
      runner.start();
      runner.stop();

      expect(runner.getMeasurements()).toHaveLength(1);
    });

    it('should handle multiple measurements correctly', () => {
      runner.completeWarmup();

      const measurements = [];
      for (let i = 0; i < 5; i++) {
        runner.start();
        const duration = runner.stop();
        measurements.push(duration);
      }

      const recorded = runner.getMeasurements();
      expect(recorded).toHaveLength(5);
      expect(recorded).toEqual(measurements);
    });

    it('should reset state correctly', () => {
      runner.completeWarmup();
      runner.start();
      runner.stop();

      expect(runner.getMeasurements()).toHaveLength(1);

      runner.reset();
      expect(runner.getMeasurements()).toHaveLength(0);

      // Should be back to warmup phase
      runner.start();
      runner.stop();
      expect(runner.getMeasurements()).toHaveLength(0);
    });
  });

  describe('Statistical Calculations', () => {
    beforeEach(() => {
      runner.completeWarmup();
    });

    it('should calculate correct statistics for simple dataset', () => {
      // Mock specific measurements for predictable results
      const mockMeasurements = [10, 20, 30, 40, 50];
      let callIndex = 0;

      // Mock performance.now to return predictable values for each start/stop pair
      vi.spyOn(performance, 'now').mockImplementation(() => {
        const isStart = callIndex % 2 === 0;
        if (isStart) {
          const measurement = mockMeasurements[Math.floor(callIndex / 2)];
          callIndex++;
          return 0; // Start time
        } else {
          const measurement = mockMeasurements[Math.floor(callIndex / 2)];
          callIndex++;
          return measurement; // End time = start + duration
        }
      });

      // Inject measurements directly
      for (const measurement of mockMeasurements) {
        runner.start();
        runner.stop();
      }

      const stats = runner.calculateStats();

      expect(stats.count).toBe(5);
      expect(stats.mean).toBe(30);
      expect(stats.median).toBe(30);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.totalTime).toBe(150);
    });

    it('should calculate percentiles correctly', () => {
      // Create dataset: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const measurements = Array.from({ length: 10 }, (_, i) => i + 1);
      let callIndex = 0;

      vi.spyOn(performance, 'now').mockImplementation(() => {
        const isStart = callIndex % 2 === 0;
        if (isStart) {
          const measurement = measurements[Math.floor(callIndex / 2)];
          callIndex++;
          return 0; // Start time
        } else {
          const measurement = measurements[Math.floor(callIndex / 2)];
          callIndex++;
          return measurement; // End time
        }
      });

      for (const measurement of measurements) {
        runner.start();
        runner.stop();
      }

      const stats = runner.calculateStats();

      expect(stats.p95).toBe(10); // 95th percentile of [1-10]
      expect(stats.p99).toBe(10); // 99th percentile of [1-10]
    });

    it('should calculate standard deviation correctly', () => {
      // Dataset: [10, 10, 10] - should have stdDev = 0
      const measurements = [10, 10, 10];
      let callIndex = 0;

      vi.spyOn(performance, 'now').mockImplementation(() => {
        const isStart = callIndex % 2 === 0;
        if (isStart) {
          callIndex++;
          return 0; // Start time
        } else {
          const measurement = measurements[Math.floor(callIndex / 2)];
          callIndex++;
          return measurement; // End time
        }
      });

      for (const measurement of measurements) {
        runner.start();
        runner.stop();
      }

      const stats = runner.calculateStats();

      expect(stats.stdDev).toBe(0);
      expect(stats.mean).toBe(10);
    });

    it('should handle empty measurements gracefully', () => {
      const stats = runner.calculateStats();

      expect(stats.count).toBe(0);
      expect(stats.mean).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.p95).toBe(0);
      expect(stats.p99).toBe(0);
      expect(stats.stdDev).toBe(0);
      expect(stats.totalTime).toBe(0);
    });

    it('should handle single measurement correctly', () => {
      let callIndex = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        return callIndex++ === 0 ? 0 : 42; // First call returns 0, second returns 42
      });

      runner.start();
      runner.stop();

      const stats = runner.calculateStats();

      expect(stats.count).toBe(1);
      expect(stats.mean).toBe(42);
      expect(stats.median).toBe(42);
      expect(stats.min).toBe(42);
      expect(stats.max).toBe(42);
      expect(stats.p95).toBe(42);
      expect(stats.p99).toBe(42);
      expect(stats.stdDev).toBe(0);
    });
  });

  describe('Threshold Checking', () => {
    const defaultThreshold: BenchmarkThreshold = {
      maxMean: 50,
      maxP95: 100,
      maxP99: 150,
      minThroughput: 20, // ops/second
    };

    it('should pass when all metrics are within thresholds', () => {
      const stats = {
        count: 10,
        mean: 30,
        median: 25,
        min: 10,
        max: 60,
        p95: 80,
        p99: 120,
        stdDev: 15,
        totalTime: 300,
      };

      const result = runner.checkThreshold(stats, defaultThreshold);

      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should fail when mean exceeds threshold', () => {
      const stats = {
        count: 10,
        mean: 70, // Exceeds maxMean: 50
        median: 25,
        min: 10,
        max: 60,
        p95: 80,
        p99: 120,
        stdDev: 15,
        totalTime: 700,
      };

      const result = runner.checkThreshold(stats, defaultThreshold);

      expect(result.passed).toBe(false);
      expect(result.failures).toContain('Mean (70.00ms) exceeds threshold (50ms)');
    });

    it('should fail when P95 exceeds threshold', () => {
      const stats = {
        count: 10,
        mean: 30,
        median: 25,
        min: 10,
        max: 60,
        p95: 120, // Exceeds maxP95: 100
        p99: 120,
        stdDev: 15,
        totalTime: 300,
      };

      const result = runner.checkThreshold(stats, defaultThreshold);

      expect(result.passed).toBe(false);
      expect(result.failures).toContain('P95 (120.00ms) exceeds threshold (100ms)');
    });

    it('should fail when P99 exceeds threshold', () => {
      const stats = {
        count: 10,
        mean: 30,
        median: 25,
        min: 10,
        max: 60,
        p95: 80,
        p99: 180, // Exceeds maxP99: 150
        stdDev: 15,
        totalTime: 300,
      };

      const result = runner.checkThreshold(stats, defaultThreshold);

      expect(result.passed).toBe(false);
      expect(result.failures).toContain('P99 (180.00ms) exceeds threshold (150ms)');
    });

    it('should fail when throughput is below threshold', () => {
      const stats = {
        count: 10,
        mean: 100, // 1000/100 = 10 ops/s, below minThroughput: 20
        median: 25,
        min: 10,
        max: 60,
        p95: 80,
        p99: 120,
        stdDev: 15,
        totalTime: 1000,
      };

      const result = runner.checkThreshold(stats, defaultThreshold);

      expect(result.passed).toBe(false);
      expect(result.failures).toContain('Throughput (10.00 ops/s) below threshold (20 ops/s)');
    });

    it('should handle optional thresholds correctly', () => {
      const minimalThreshold: BenchmarkThreshold = {
        maxMean: 50,
        maxP95: 100,
        // No maxP99 or minThroughput
      };

      const stats = {
        count: 10,
        mean: 30,
        median: 25,
        min: 10,
        max: 60,
        p95: 80,
        p99: 500, // Would fail if maxP99 was defined
        stdDev: 15,
        totalTime: 300,
      };

      const result = runner.checkThreshold(stats, minimalThreshold);

      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should report multiple failures', () => {
      const stats = {
        count: 10,
        mean: 70, // Exceeds maxMean: 50
        median: 25,
        min: 10,
        max: 60,
        p95: 120, // Exceeds maxP95: 100
        p99: 180, // Exceeds maxP99: 150
        stdDev: 15,
        totalTime: 700,
      };

      const result = runner.checkThreshold(stats, defaultThreshold);

      expect(result.passed).toBe(false);
      expect(result.failures.length).toBeGreaterThanOrEqual(3);
      expect(result.failures).toContain('Mean (70.00ms) exceeds threshold (50ms)');
      expect(result.failures).toContain('P95 (120.00ms) exceeds threshold (100ms)');
      expect(result.failures).toContain('P99 (180.00ms) exceeds threshold (150ms)');
      // Also fails throughput: 1000/70 = 14.29 < 20
      expect(result.failures.some(f => f.includes('Throughput'))).toBe(true);
    });
  });

  describe('Benchmark Execution', () => {
    const simpleThreshold: BenchmarkThreshold = {
      maxMean: 100,
      maxP95: 200,
    };

    it('should run benchmark with correct phases', async () => {
      const mockFn = vi.fn().mockImplementation(() => {
        // Simulate work with deterministic timing
        const start = Date.now();
        while (Date.now() - start < 1) {
          // Busy wait for 1ms
        }
      });

      const config: BenchmarkConfig = {
        name: 'test-benchmark',
        warmupIterations: 2,
        iterations: 3,
        threshold: simpleThreshold,
      };

      const result = await runner.run(config, mockFn);

      expect(mockFn).toHaveBeenCalledTimes(5); // 2 warmup + 3 measured
      expect(result.name).toBe('test-benchmark');
      expect(result.warmupIterations).toBe(2);
      expect(result.iterations).toBe(3);
      expect(result.stats.count).toBe(3);
      expect(result.stats.mean).toBeGreaterThan(0);
      expect(result.throughput).toBeGreaterThan(0);
      expect(result.threshold).toEqual(simpleThreshold);
    });

    it('should use default iteration counts when not specified', async () => {
      const mockFn = vi.fn();

      const config: BenchmarkConfig = {
        name: 'test-benchmark',
        threshold: simpleThreshold,
      };

      const result = await runner.run(config, mockFn);

      expect(mockFn).toHaveBeenCalledTimes(13); // 3 warmup + 10 measured (defaults)
      expect(result.warmupIterations).toBe(3);
      expect(result.iterations).toBe(10);
    });

    it('should handle async functions correctly', async () => {
      const mockAsyncFn = vi.fn().mockImplementation(async () => {
        // Use a small but measurable delay
        await new Promise(resolve => setTimeout(resolve, 2));
      });

      const config: BenchmarkConfig = {
        name: 'async-benchmark',
        iterations: 2,
        warmupIterations: 1,
        threshold: simpleThreshold,
      };

      const result = await runner.run(config, mockAsyncFn);

      expect(mockAsyncFn).toHaveBeenCalledTimes(3); // 1 warmup + 2 measured
      expect(result.stats.count).toBe(2);
      expect(result.stats.mean).toBeGreaterThan(1); // Should be at least 2ms
    });

    it('should handle sync functions correctly', async () => {
      const mockSyncFn = vi.fn().mockImplementation(() => {
        return 'sync result';
      });

      const config: BenchmarkConfig = {
        name: 'sync-benchmark',
        iterations: 2,
        warmupIterations: 1,
        threshold: simpleThreshold,
      };

      const result = await runner.run(config, mockSyncFn);

      expect(mockSyncFn).toHaveBeenCalledTimes(3);
      expect(result.stats.count).toBe(2);
    });

    it('should calculate throughput correctly', async () => {
      const mockFn = vi.fn();

      // Mock performance.now to return predictable timing
      let callCount = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        return callCount++ * 10; // Each call takes exactly 10ms
      });

      const config: BenchmarkConfig = {
        name: 'throughput-test',
        iterations: 1,
        warmupIterations: 0,
        threshold: simpleThreshold,
      };

      const result = await runner.run(config, mockFn);

      expect(result.stats.mean).toBe(10);
      expect(result.throughput).toBe(100); // 1000ms / 10ms = 100 ops/s
    });
  });

  describe('Result Formatting', () => {
    it('should format passing result correctly', () => {
      const result = {
        name: 'test-benchmark',
        iterations: 10,
        warmupIterations: 3,
        stats: {
          count: 10,
          mean: 25.5,
          median: 24.0,
          min: 20.1,
          max: 35.7,
          p95: 33.2,
          p99: 35.1,
          stdDev: 4.8,
          totalTime: 255.0,
        },
        throughput: 39.22,
        passed: true,
        threshold: { maxMean: 50, maxP95: 100 },
        failures: [],
      };

      const formatted = BenchmarkRunner.formatResult(result);

      expect(formatted).toContain('✅ PASS test-benchmark');
      expect(formatted).toContain('Iterations: 10 (warmup: 3)');
      expect(formatted).toContain('Mean: 25.50ms');
      expect(formatted).toContain('P95: 33.20ms');
      expect(formatted).toContain('Throughput: 39.22 ops/s');
      expect(formatted).not.toContain('Failures:');
    });

    it('should format failing result with failures', () => {
      const result = {
        name: 'slow-benchmark',
        iterations: 5,
        warmupIterations: 2,
        stats: {
          count: 5,
          mean: 75.0,
          median: 70.0,
          min: 60.0,
          max: 90.0,
          p95: 88.0,
          p99: 90.0,
          stdDev: 10.0,
          totalTime: 375.0,
        },
        throughput: 13.33,
        passed: false,
        threshold: { maxMean: 50, maxP95: 80 },
        failures: [
          'Mean (75.00ms) exceeds threshold (50ms)',
          'P95 (88.00ms) exceeds threshold (80ms)',
        ],
      };

      const formatted = BenchmarkRunner.formatResult(result);

      expect(formatted).toContain('❌ FAIL slow-benchmark');
      expect(formatted).toContain('Failures:');
      expect(formatted).toContain('- Mean (75.00ms) exceeds threshold (50ms)');
      expect(formatted).toContain('- P95 (88.00ms) exceeds threshold (80ms)');
    });

    it('should include memory delta when available', () => {
      const result = {
        name: 'memory-benchmark',
        iterations: 3,
        warmupIterations: 1,
        stats: {
          count: 3,
          mean: 30.0,
          median: 30.0,
          min: 25.0,
          max: 35.0,
          p95: 35.0,
          p99: 35.0,
          stdDev: 5.0,
          totalTime: 90.0,
        },
        throughput: 33.33,
        memoryDelta: 1048576, // 1MB in bytes
        passed: true,
        threshold: { maxMean: 50, maxP95: 100 },
        failures: [],
      };

      const formatted = BenchmarkRunner.formatResult(result);

      expect(formatted).toContain('Memory Delta: 1.00 MB');
    });
  });

  describe('Memory Measurement', () => {
    it('should skip memory measurement when not requested', async () => {
      const config: BenchmarkConfig = {
        name: 'no-memory-test',
        iterations: 1,
        warmupIterations: 0,
        threshold: { maxMean: 100, maxP95: 200 },
        measureMemory: false,
      };

      const result = await runner.run(config, () => {});

      expect(result.memoryDelta).toBeUndefined();
    });

    it('should measure memory delta when requested', async () => {
      const config: BenchmarkConfig = {
        name: 'memory-test',
        iterations: 1,
        warmupIterations: 0,
        threshold: { maxMean: 100, maxP95: 200 },
        measureMemory: true,
      };

      // Mock process.memoryUsage to return predictable values
      const originalMemoryUsage = process.memoryUsage;
      let callCount = 0;
      const mockMemoryUsage = vi.fn().mockImplementation(() => ({
        rss: 0,
        heapTotal: 0,
        heapUsed: callCount++ === 0 ? 1000000 : 1500000, // 500KB increase
        external: 0,
        arrayBuffers: 0,
      }));

      // Replace the process.memoryUsage function
      process.memoryUsage = mockMemoryUsage as any;

      try {
        const result = await runner.run(config, () => {
          // Simulate memory allocation
        });

        expect(result.memoryDelta).toBe(500000); // 500KB increase
        expect(mockMemoryUsage).toHaveBeenCalledTimes(2);
      } finally {
        // Restore original function
        process.memoryUsage = originalMemoryUsage;
      }
    });
  });
});