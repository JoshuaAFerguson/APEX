/**
 * @fileoverview Performance Benchmark Runner Infrastructure
 *
 * Provides a consistent framework for running performance benchmarks
 * with statistical analysis, threshold checking, and result reporting.
 */

import type { BenchmarkThreshold } from './thresholds.js';

/**
 * Statistical results from a benchmark run
 */
export interface BenchmarkStats {
  /** Number of iterations performed */
  count: number;
  /** Mean execution time in ms */
  mean: number;
  /** Median execution time in ms */
  median: number;
  /** Minimum execution time in ms */
  min: number;
  /** Maximum execution time in ms */
  max: number;
  /** 95th percentile execution time in ms */
  p95: number;
  /** 99th percentile execution time in ms */
  p99: number;
  /** Standard deviation in ms */
  stdDev: number;
  /** Total execution time in ms */
  totalTime: number;
}

/**
 * Result from a single benchmark
 */
export interface BenchmarkResult {
  /** Benchmark name/identifier */
  name: string;
  /** Number of measured iterations (excluding warmup) */
  iterations: number;
  /** Number of warmup iterations */
  warmupIterations: number;
  /** Statistical results */
  stats: BenchmarkStats;
  /** Operations per second (throughput) */
  throughput: number;
  /** Memory usage delta in bytes (if measured) */
  memoryDelta?: number;
  /** Whether the benchmark passed threshold checks */
  passed: boolean;
  /** Threshold configuration used */
  threshold: BenchmarkThreshold;
  /** Specific threshold failures */
  failures: string[];
}

/**
 * Configuration for running a benchmark
 */
export interface BenchmarkConfig {
  /** Benchmark name/identifier */
  name: string;
  /** Number of warmup iterations (default: 3) */
  warmupIterations?: number;
  /** Number of measured iterations (default: 10) */
  iterations?: number;
  /** Threshold configuration */
  threshold: BenchmarkThreshold;
  /** Whether to measure memory usage (default: false) */
  measureMemory?: boolean;
}

/**
 * Enhanced PerformanceMonitor with statistical analysis capabilities
 */
export class BenchmarkRunner {
  private measurements: number[] = [];
  private startTime: number = 0;
  private warmupComplete: boolean = false;
  private warmupMeasurements: number[] = [];

  /**
   * Start timing a benchmark iteration
   */
  start(): void {
    this.startTime = performance.now();
  }

  /**
   * Stop timing and record the measurement
   * @returns Duration in milliseconds
   */
  stop(): number {
    const duration = performance.now() - this.startTime;
    if (this.warmupComplete) {
      this.measurements.push(duration);
    } else {
      this.warmupMeasurements.push(duration);
    }
    return duration;
  }

  /**
   * Mark warmup phase as complete
   */
  completeWarmup(): void {
    this.warmupComplete = true;
  }

  /**
   * Reset the runner for a new benchmark
   */
  reset(): void {
    this.measurements = [];
    this.warmupMeasurements = [];
    this.warmupComplete = false;
    this.startTime = 0;
  }

  /**
   * Get raw measurements
   */
  getMeasurements(): number[] {
    return [...this.measurements];
  }

  /**
   * Calculate statistical results from measurements
   */
  calculateStats(): BenchmarkStats {
    if (this.measurements.length === 0) {
      return {
        count: 0,
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        p95: 0,
        p99: 0,
        stdDev: 0,
        totalTime: 0,
      };
    }

    const sorted = [...this.measurements].sort((a, b) => a - b);
    const count = sorted.length;
    const totalTime = sorted.reduce((sum, val) => sum + val, 0);
    const mean = totalTime / count;

    // Median
    const mid = Math.floor(count / 2);
    const median = count % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

    // Standard deviation
    const squaredDiffs = sorted.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / count;
    const stdDev = Math.sqrt(avgSquaredDiff);

    // Percentiles
    const p95Index = Math.ceil(count * 0.95) - 1;
    const p99Index = Math.ceil(count * 0.99) - 1;

    return {
      count,
      mean,
      median,
      min: sorted[0],
      max: sorted[count - 1],
      p95: sorted[Math.min(p95Index, count - 1)],
      p99: sorted[Math.min(p99Index, count - 1)],
      stdDev,
      totalTime,
    };
  }

  /**
   * Check if results pass threshold requirements
   */
  checkThreshold(stats: BenchmarkStats, threshold: BenchmarkThreshold): { passed: boolean; failures: string[] } {
    const failures: string[] = [];

    if (stats.mean > threshold.maxMean) {
      failures.push(`Mean (${stats.mean.toFixed(2)}ms) exceeds threshold (${threshold.maxMean}ms)`);
    }

    if (stats.p95 > threshold.maxP95) {
      failures.push(`P95 (${stats.p95.toFixed(2)}ms) exceeds threshold (${threshold.maxP95}ms)`);
    }

    if (threshold.maxP99 !== undefined && stats.p99 > threshold.maxP99) {
      failures.push(`P99 (${stats.p99.toFixed(2)}ms) exceeds threshold (${threshold.maxP99}ms)`);
    }

    const throughput = stats.count > 0 ? 1000 / stats.mean : 0;
    if (threshold.minThroughput !== undefined && throughput < threshold.minThroughput) {
      failures.push(`Throughput (${throughput.toFixed(2)} ops/s) below threshold (${threshold.minThroughput} ops/s)`);
    }

    return {
      passed: failures.length === 0,
      failures,
    };
  }

  /**
   * Run a benchmark with the given configuration
   */
  async run<T>(
    config: BenchmarkConfig,
    fn: () => T | Promise<T>
  ): Promise<BenchmarkResult> {
    this.reset();

    const warmupIterations = config.warmupIterations ?? 3;
    const iterations = config.iterations ?? 10;

    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
      this.start();
      await fn();
      this.stop();
    }
    this.completeWarmup();

    // Measure memory before (if requested)
    const memoryBefore = config.measureMemory && typeof process !== 'undefined'
      ? process.memoryUsage().heapUsed
      : undefined;

    // Measured phase
    for (let i = 0; i < iterations; i++) {
      this.start();
      await fn();
      this.stop();
    }

    // Measure memory after
    const memoryAfter = config.measureMemory && typeof process !== 'undefined'
      ? process.memoryUsage().heapUsed
      : undefined;

    const memoryDelta = memoryBefore !== undefined && memoryAfter !== undefined
      ? memoryAfter - memoryBefore
      : undefined;

    const stats = this.calculateStats();
    const { passed, failures } = this.checkThreshold(stats, config.threshold);
    const throughput = stats.mean > 0 ? 1000 / stats.mean : 0;

    return {
      name: config.name,
      iterations,
      warmupIterations,
      stats,
      throughput,
      memoryDelta,
      passed,
      threshold: config.threshold,
      failures,
    };
  }

  /**
   * Format benchmark result for console output
   */
  static formatResult(result: BenchmarkResult): string {
    const { name, stats, throughput, passed, failures } = result;
    const status = passed ? '✅ PASS' : '❌ FAIL';

    const lines = [
      `\n${status} ${name}`,
      `  Iterations: ${result.iterations} (warmup: ${result.warmupIterations})`,
      `  Mean: ${stats.mean.toFixed(2)}ms`,
      `  Median: ${stats.median.toFixed(2)}ms`,
      `  Min: ${stats.min.toFixed(2)}ms`,
      `  Max: ${stats.max.toFixed(2)}ms`,
      `  P95: ${stats.p95.toFixed(2)}ms`,
      `  P99: ${stats.p99.toFixed(2)}ms`,
      `  StdDev: ${stats.stdDev.toFixed(2)}ms`,
      `  Throughput: ${throughput.toFixed(2)} ops/s`,
    ];

    if (result.memoryDelta !== undefined) {
      const memoryMB = result.memoryDelta / (1024 * 1024);
      lines.push(`  Memory Delta: ${memoryMB.toFixed(2)} MB`);
    }

    if (!passed) {
      lines.push(`  Failures:`);
      failures.forEach(f => lines.push(`    - ${f}`));
    }

    return lines.join('\n');
  }
}

/**
 * Create a simple benchmark function wrapper
 */
export function createBenchmark<T>(
  name: string,
  fn: () => T | Promise<T>,
  threshold: BenchmarkThreshold,
  options?: Partial<Omit<BenchmarkConfig, 'name' | 'threshold'>>
): () => Promise<BenchmarkResult> {
  const runner = new BenchmarkRunner();
  return () => runner.run(
    {
      name,
      threshold,
      ...options,
    },
    fn
  );
}

export default BenchmarkRunner;
