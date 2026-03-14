#!/usr/bin/env node

/**
 * @fileoverview Benchmark Threshold Checker
 *
 * Validates benchmark results against defined thresholds.
 * Used in CI to detect performance regressions.
 *
 * Exit codes:
 * - 0: All benchmarks passed
 * - 1: Some benchmarks failed thresholds
 * - 2: Error reading results file
 */

const fs = require('fs');
const path = require('path');

// Results file paths to check
const RESULTS_FILES = [
  path.resolve(__dirname, '../../benchmark-results.json'),
  path.resolve(__dirname, '../../packages/browser/benchmark-results.json'),
  path.resolve(__dirname, '../../packages/core/benchmark-results.json'),
  path.resolve(__dirname, '../../packages/orchestrator/benchmark-results.json'),
];

/**
 * Parse benchmark results from a file
 * @param {string} filePath
 * @returns {object|null}
 */
function parseResultsFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Extract benchmark results from vitest bench output
 * @param {object} results
 * @returns {Array}
 */
function extractBenchmarks(results) {
  const benchmarks = [];

  // Handle different result formats
  if (Array.isArray(results)) {
    for (const result of results) {
      if (result.name && result.stats) {
        benchmarks.push(result);
      }
    }
  } else if (results && results.results) {
    for (const result of results.results) {
      if (result.name && result.stats) {
        benchmarks.push(result);
      }
    }
  } else if (results && results.testResults) {
    // Vitest format
    for (const testFile of results.testResults) {
      if (testFile.benchmarks) {
        benchmarks.push(...testFile.benchmarks);
      }
    }
  }

  return benchmarks;
}

/**
 * Check all benchmark results
 * @returns {{ passed: boolean, summary: object }}
 */
function checkAllResults() {
  const allBenchmarks = [];
  let filesChecked = 0;

  for (const filePath of RESULTS_FILES) {
    const results = parseResultsFile(filePath);
    if (results) {
      const benchmarks = extractBenchmarks(results);
      allBenchmarks.push(...benchmarks);
      filesChecked++;
      console.log(`✓ Loaded ${benchmarks.length} benchmarks from ${path.basename(filePath)}`);
    }
  }

  if (filesChecked === 0) {
    console.log('\n⚠️  No benchmark results files found. This is normal if benchmarks have not been run.');
    return { passed: true, summary: { total: 0, passed: 0, failed: 0, skipped: 0 } };
  }

  const passed = [];
  const failed = [];
  const skipped = [];

  for (const benchmark of allBenchmarks) {
    if (!benchmark.threshold) {
      skipped.push(benchmark);
      continue;
    }

    if (benchmark.passed === true) {
      passed.push(benchmark);
    } else if (benchmark.passed === false) {
      failed.push(benchmark);
    } else {
      // Check manually if passed flag not set
      const { stats, threshold } = benchmark;
      let benchPassed = true;

      if (stats.mean > threshold.maxMean) {
        benchPassed = false;
      }
      if (stats.p95 > threshold.maxP95) {
        benchPassed = false;
      }
      if (threshold.maxP99 && stats.p99 > threshold.maxP99) {
        benchPassed = false;
      }

      if (benchPassed) {
        passed.push(benchmark);
      } else {
        failed.push(benchmark);
      }
    }
  }

  return {
    passed: failed.length === 0,
    summary: {
      total: allBenchmarks.length,
      passed: passed.length,
      failed: failed.length,
      skipped: skipped.length,
      failedBenchmarks: failed,
    },
  };
}

/**
 * Print results summary
 * @param {object} summary
 */
function printSummary(summary) {
  console.log('\n════════════════════════════════════════════');
  console.log('           BENCHMARK THRESHOLD CHECK');
  console.log('════════════════════════════════════════════\n');

  console.log(`Total benchmarks: ${summary.total}`);
  console.log(`  ✅ Passed: ${summary.passed}`);
  console.log(`  ❌ Failed: ${summary.failed}`);
  console.log(`  ⏭️  Skipped (no threshold): ${summary.skipped}`);

  if (summary.failedBenchmarks && summary.failedBenchmarks.length > 0) {
    console.log('\n❌ Failed Benchmarks:\n');

    for (const benchmark of summary.failedBenchmarks) {
      console.log(`  • ${benchmark.name}`);
      if (benchmark.stats && benchmark.threshold) {
        console.log(`    Mean: ${benchmark.stats.mean.toFixed(2)}ms (threshold: ${benchmark.threshold.maxMean}ms)`);
        console.log(`    P95: ${benchmark.stats.p95.toFixed(2)}ms (threshold: ${benchmark.threshold.maxP95}ms)`);
      }
      if (benchmark.failures) {
        for (const failure of benchmark.failures) {
          console.log(`    → ${failure}`);
        }
      }
    }
  }

  console.log('\n════════════════════════════════════════════\n');
}

// Main execution
function main() {
  console.log('🔍 Checking benchmark thresholds...\n');

  const { passed, summary } = checkAllResults();

  printSummary(summary);

  if (summary.total === 0) {
    console.log('ℹ️  No benchmarks to check. Run benchmarks first with `npm run benchmark`.');
    process.exit(0);
  }

  if (passed) {
    console.log('✅ All benchmark thresholds passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Some benchmarks exceeded thresholds. See details above.\n');
    process.exit(1);
  }
}

main();
