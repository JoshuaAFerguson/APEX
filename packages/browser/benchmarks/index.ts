/**
 * @fileoverview @apexcli/browser Benchmark Suite Entry Point
 *
 * Re-exports all browser benchmarks for centralized access.
 */

// Benchmark suites are imported by vitest automatically
// This file serves as documentation and potential programmatic access

export const BROWSER_BENCHMARK_SUITES = [
  'browser-launch.bench.ts',
  'screenshot.bench.ts',
] as const;

export type BrowserBenchmarkSuite = typeof BROWSER_BENCHMARK_SUITES[number];
