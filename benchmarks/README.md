# APEX Performance Benchmarks

This directory contains the performance benchmark infrastructure for the APEX monorepo.

## Overview

The benchmark suite measures performance of key operations across multiple packages:

| Package | Operations Benchmarked |
|---------|----------------------|
| `@apexcli/browser` | Browser launch time, screenshot capture |
| `@apexcli/core` | Config parsing, schema validation |
| `@apexcli/orchestrator` | TaskStore CRUD operations |

## Quick Start

```bash
# Run all benchmarks
npm run benchmark

# Run package-specific benchmarks
npm run benchmark:browser
npm run benchmark:core
npm run benchmark:orchestrator

# Check if results pass thresholds
npm run benchmark:check
```

## Directory Structure

```
benchmarks/
├── shared/                    # Shared benchmark infrastructure
│   ├── benchmark-runner.ts    # BenchmarkRunner class
│   ├── reporter.ts            # Results reporting utilities
│   ├── thresholds.ts          # Performance threshold definitions
│   ├── check-thresholds.js    # CI threshold validation script
│   └── index.ts               # Barrel exports
├── vitest.benchmark.config.ts # Root benchmark vitest config
└── README.md                  # This file

packages/
├── browser/benchmarks/        # @apexcli/browser benchmarks
│   ├── browser-launch.bench.ts
│   ├── screenshot.bench.ts
│   └── vitest.config.ts
│
├── core/benchmarks/           # @apexcli/core benchmarks
│   ├── config-parsing.bench.ts
│   ├── schema-validation.bench.ts
│   └── vitest.config.ts
│
└── orchestrator/benchmarks/   # @apexcli/orchestrator benchmarks
    ├── task-store-crud.bench.ts
    └── vitest.config.ts
```

## Threshold Configuration

Performance thresholds are defined in `benchmarks/shared/thresholds.ts`:

```typescript
// Example threshold definition
export const BROWSER_THRESHOLDS = {
  launch: {
    chromium: {
      maxMean: 5000,  // Maximum average launch time (ms)
      maxP95: 8000,   // Maximum 95th percentile (ms)
      maxP99: 10000,  // Maximum 99th percentile (ms)
    },
  },
};
```

### Threshold Guidelines

| Metric | Description | Purpose |
|--------|-------------|---------|
| `maxMean` | Maximum acceptable average | Typical performance expectation |
| `maxP95` | Maximum 95th percentile | Handles variance/outliers |
| `maxP99` | Maximum 99th percentile | Catches extreme cases |
| `minThroughput` | Minimum ops/second | For high-frequency operations |

## Writing Benchmarks

### Basic Pattern

```typescript
import { describe, it, expect } from 'vitest';
import { BenchmarkRunner, THRESHOLDS } from '@benchmarks';

describe('My Feature Benchmarks', () => {
  it('should benchmark operation X', async () => {
    const runner = new BenchmarkRunner();

    const result = await runner.run(
      {
        name: 'operation-x',
        iterations: 100,
        warmupIterations: 10,
        threshold: THRESHOLDS.myFeature.operationX,
      },
      async () => {
        // Code to benchmark
        await doSomething();
      }
    );

    console.log(BenchmarkRunner.formatResult(result));
    expect(result.passed).toBe(true);
  });
});
```

### Using BenchmarkReporter

For collecting multiple benchmark results:

```typescript
import { BenchmarkReporter, BenchmarkRunner } from '@benchmarks';

describe('Benchmark Suite', () => {
  const reporter = new BenchmarkReporter();

  beforeAll(() => reporter.start());
  afterAll(() => reporter.printReport());

  it('benchmark 1', async () => {
    const runner = new BenchmarkRunner();
    const result = await runner.run(config, fn);
    reporter.addResult(result);
  });

  it('benchmark 2', async () => {
    // ... similar pattern
  });
});
```

## CI Integration

Benchmarks run automatically on:
- Push to `main` branch
- Pull requests to `main`
- Manual workflow dispatch

See `.github/workflows/benchmarks.yml` for configuration.

### GitHub Actions Outputs

- **Artifacts**: `benchmark-results.json` files uploaded for each run
- **PR Comments**: Automatic comments with benchmark summary
- **Job Summary**: Performance results in workflow summary

## Results Format

Benchmark results are stored in JSON format:

```json
{
  "timestamp": "2024-03-14T12:00:00.000Z",
  "environment": {
    "os": "Linux",
    "nodeVersion": "v20.x",
    "cpuCount": 4,
    "memoryGB": 8
  },
  "results": [
    {
      "name": "browser-launch-chromium",
      "iterations": 5,
      "stats": {
        "mean": 2345.67,
        "median": 2300.00,
        "min": 2100.00,
        "max": 2600.00,
        "p95": 2550.00,
        "p99": 2600.00,
        "stdDev": 123.45
      },
      "passed": true,
      "throughput": 0.43
    }
  ],
  "summary": {
    "totalBenchmarks": 20,
    "passed": 18,
    "failed": 2,
    "regressions": ["operation-x", "operation-y"]
  }
}
```

## Best Practices

1. **Warmup Iterations**: Always include warmup to stabilize JIT compilation
2. **Iteration Count**: Use more iterations for fast operations, fewer for slow ones
3. **Isolation**: Run benchmarks sequentially to avoid resource contention
4. **Environment**: Use consistent environments (same CI runner type)
5. **Thresholds**: Set realistic thresholds based on baseline measurements

## Troubleshooting

### Flaky Benchmarks

- Increase iteration count
- Add more warmup iterations
- Widen threshold margins (but not too much)

### CI Timeouts

- Check if browser installation is needed
- Review individual benchmark timeouts
- Consider running subsets in parallel jobs

### Threshold Failures

- Run benchmarks locally to reproduce
- Check for environment differences
- Review recent code changes affecting performance

## Related Documentation

- [ADR-0001: Performance Benchmarks](../docs/architecture/ADR-0001-performance-benchmarks.md)
- [Vitest Benchmarking](https://vitest.dev/guide/features.html#benchmarking)
