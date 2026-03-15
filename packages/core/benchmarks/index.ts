/**
 * @fileoverview @apexcli/core Benchmark Suite Entry Point
 *
 * Re-exports all core benchmarks for centralized access.
 */

// Benchmark suites are imported by vitest automatically
// This file serves as documentation and potential programmatic access

export const CORE_BENCHMARK_SUITES = [
  'config-parsing.bench.ts',
  'schema-validation.bench.ts',
] as const;

export type CoreBenchmarkSuite = typeof CORE_BENCHMARK_SUITES[number];
