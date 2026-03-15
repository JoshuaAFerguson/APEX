/**
 * @fileoverview Benchmark Results Reporter
 *
 * Provides utilities for generating benchmark reports in multiple formats
 * including console output, JSON, and summary statistics.
 */

import type { BenchmarkResult, BenchmarkStats } from './benchmark-runner.js';
import * as os from 'os';

/**
 * Environment information for benchmark context
 */
export interface BenchmarkEnvironment {
  /** Operating system */
  os: string;
  /** OS platform */
  platform: string;
  /** OS architecture */
  arch: string;
  /** Node.js version */
  nodeVersion: string;
  /** Number of CPU cores */
  cpuCount: number;
  /** CPU model */
  cpuModel: string;
  /** Total system memory in GB */
  memoryGB: number;
  /** Process ID */
  pid: number;
}

/**
 * Summary statistics for a benchmark suite
 */
export interface BenchmarkSummary {
  /** Total number of benchmarks run */
  totalBenchmarks: number;
  /** Number of passed benchmarks */
  passed: number;
  /** Number of failed benchmarks */
  failed: number;
  /** List of regression identifiers */
  regressions: string[];
  /** Total execution time in ms */
  totalDuration: number;
}

/**
 * Full benchmark report structure
 */
export interface BenchmarkReport {
  /** ISO timestamp of report generation */
  timestamp: string;
  /** Git commit hash (if available) */
  commit?: string;
  /** Git branch (if available) */
  branch?: string;
  /** CI environment flag */
  isCI: boolean;
  /** Environment information */
  environment: BenchmarkEnvironment;
  /** Individual benchmark results */
  results: BenchmarkResult[];
  /** Summary statistics */
  summary: BenchmarkSummary;
}

/**
 * Collect environment information
 */
export function collectEnvironment(): BenchmarkEnvironment {
  const cpus = os.cpus();

  return {
    os: os.type(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    cpuCount: cpus.length,
    cpuModel: cpus.length > 0 ? cpus[0].model : 'unknown',
    memoryGB: Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100,
    pid: process.pid,
  };
}

/**
 * Calculate summary statistics from benchmark results
 */
export function calculateSummary(results: BenchmarkResult[]): BenchmarkSummary {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const regressions = results
    .filter(r => !r.passed)
    .map(r => r.name);

  const totalDuration = results.reduce(
    (sum, r) => sum + r.stats.totalTime,
    0
  );

  return {
    totalBenchmarks: results.length,
    passed,
    failed,
    regressions,
    totalDuration,
  };
}

/**
 * Generate a complete benchmark report
 */
export function generateReport(
  results: BenchmarkResult[],
  options?: {
    commit?: string;
    branch?: string;
  }
): BenchmarkReport {
  return {
    timestamp: new Date().toISOString(),
    commit: options?.commit,
    branch: options?.branch,
    isCI: Boolean(process.env.CI),
    environment: collectEnvironment(),
    results,
    summary: calculateSummary(results),
  };
}

/**
 * Format report for console output
 */
export function formatConsoleReport(report: BenchmarkReport): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                    BENCHMARK REPORT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  // Environment
  lines.push('📊 Environment:');
  lines.push(`   OS: ${report.environment.os} (${report.environment.platform} ${report.environment.arch})`);
  lines.push(`   Node: ${report.environment.nodeVersion}`);
  lines.push(`   CPU: ${report.environment.cpuModel} (${report.environment.cpuCount} cores)`);
  lines.push(`   Memory: ${report.environment.memoryGB} GB`);
  if (report.commit) {
    lines.push(`   Commit: ${report.commit}`);
  }
  if (report.branch) {
    lines.push(`   Branch: ${report.branch}`);
  }
  lines.push('');

  // Results
  lines.push('📈 Results:');
  lines.push('───────────────────────────────────────────────────────────────');

  for (const result of report.results) {
    const status = result.passed ? '✅' : '❌';
    const throughput = result.throughput.toFixed(1);

    lines.push(`${status} ${result.name}`);
    lines.push(`   Mean: ${result.stats.mean.toFixed(2)}ms | P95: ${result.stats.p95.toFixed(2)}ms | Throughput: ${throughput} ops/s`);

    if (!result.passed) {
      result.failures.forEach(f => {
        lines.push(`   ⚠️  ${f}`);
      });
    }
  }

  lines.push('');

  // Summary
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('📋 Summary:');

  const passRate = report.summary.totalBenchmarks > 0
    ? ((report.summary.passed / report.summary.totalBenchmarks) * 100).toFixed(1)
    : 0;

  lines.push(`   Total: ${report.summary.totalBenchmarks} benchmarks`);
  lines.push(`   Passed: ${report.summary.passed} (${passRate}%)`);
  lines.push(`   Failed: ${report.summary.failed}`);
  lines.push(`   Duration: ${(report.summary.totalDuration / 1000).toFixed(2)}s`);

  if (report.summary.regressions.length > 0) {
    lines.push('');
    lines.push('   ⚠️  Regressions:');
    report.summary.regressions.forEach(r => {
      lines.push(`      - ${r}`);
    });
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`Generated: ${report.timestamp}`);
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format report as JSON string
 */
export function formatJSONReport(report: BenchmarkReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Format a comparison table between two reports
 */
export function formatComparisonTable(
  baseline: BenchmarkReport,
  current: BenchmarkReport
): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('                         BENCHMARK COMPARISON');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('Benchmark                          | Baseline    | Current     | Change');
  lines.push('───────────────────────────────────|─────────────|─────────────|──────────────');

  // Match results by name
  for (const currentResult of current.results) {
    const baselineResult = baseline.results.find(r => r.name === currentResult.name);

    if (baselineResult) {
      const baselineMean = baselineResult.stats.mean;
      const currentMean = currentResult.stats.mean;
      const change = ((currentMean - baselineMean) / baselineMean) * 100;
      const changeStr = change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
      const indicator = change > 10 ? '⚠️ ' : change < -10 ? '🚀' : '  ';

      lines.push(
        `${currentResult.name.padEnd(35)}| ${baselineMean.toFixed(2).padStart(9)}ms | ${currentMean.toFixed(2).padStart(9)}ms | ${indicator}${changeStr.padStart(10)}`
      );
    } else {
      lines.push(
        `${currentResult.name.padEnd(35)}| ${'N/A'.padStart(11)} | ${currentResult.stats.mean.toFixed(2).padStart(9)}ms | ${'NEW'.padStart(12)}`
      );
    }
  }

  lines.push('───────────────────────────────────────────────────────────────────────────────');
  lines.push('Legend: ⚠️  = >10% regression | 🚀 = >10% improvement');
  lines.push('');

  return lines.join('\n');
}

/**
 * BenchmarkReporter class for collecting and reporting multiple benchmarks
 */
export class BenchmarkReporter {
  private results: BenchmarkResult[] = [];
  private startTime: number = 0;

  /**
   * Start the benchmark suite
   */
  start(): void {
    this.results = [];
    this.startTime = Date.now();
  }

  /**
   * Add a benchmark result
   */
  addResult(result: BenchmarkResult): void {
    this.results.push(result);
  }

  /**
   * Get all results
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * Generate the final report
   */
  generateReport(options?: { commit?: string; branch?: string }): BenchmarkReport {
    return generateReport(this.results, options);
  }

  /**
   * Print the report to console
   */
  printReport(options?: { commit?: string; branch?: string }): void {
    const report = this.generateReport(options);
    console.log(formatConsoleReport(report));
  }

  /**
   * Check if all benchmarks passed
   */
  allPassed(): boolean {
    return this.results.every(r => r.passed);
  }

  /**
   * Get failed benchmark names
   */
  getFailures(): string[] {
    return this.results
      .filter(r => !r.passed)
      .map(r => r.name);
  }
}

export default BenchmarkReporter;
