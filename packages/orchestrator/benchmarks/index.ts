/**
 * @fileoverview @apexcli/orchestrator Benchmark Suite Entry Point
 *
 * Re-exports all orchestrator benchmarks for centralized access.
 */

// Benchmark suites are imported by vitest automatically
// This file serves as documentation and potential programmatic access

export const ORCHESTRATOR_BENCHMARK_SUITES = [
  'task-store-crud.bench.ts',
] as const;

export type OrchestratorBenchmarkSuite = typeof ORCHESTRATOR_BENCHMARK_SUITES[number];
