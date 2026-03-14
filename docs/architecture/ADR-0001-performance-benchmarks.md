# ADR-0001: Performance Benchmarks for @apexcli/browser and @apexcli/core

## Status
Proposed

## Date
2024-03-14

## Context

We need to implement v0.2.0 performance benchmarks for two packages:
- **@apexcli/browser**: Browser automation operations (launch time, screenshot capture)
- **@apexcli/core**: Configuration and validation operations (config parsing, schema validation, task store CRUD)

The existing codebase already has:
- Ad-hoc performance tests in `packages/browser/src/__tests__/performance-benchmark.test.ts`
- A `PerformanceMonitor` utility in `packages/browser/src/test-utils/performance.ts`
- Vitest as the test framework with various configurations
- CI workflow in `.github/workflows/ci.yml`

The goal is to establish a formal benchmarking framework with:
1. Consistent measurement methodology
2. Baseline thresholds for regression detection
3. CI integration for automated performance tracking

## Decision

### 1. Architecture Overview

```
packages/
├── browser/
│   └── benchmarks/
│       ├── index.ts                    # Benchmark suite entry
│       ├── browser-launch.bench.ts     # Browser launch benchmarks
│       ├── screenshot.bench.ts         # Screenshot capture benchmarks
│       └── vitest.config.ts            # Benchmark-specific config
│
├── core/
│   └── benchmarks/
│       ├── index.ts                    # Benchmark suite entry
│       ├── config-parsing.bench.ts     # Config parsing benchmarks
│       ├── schema-validation.bench.ts  # Schema validation benchmarks
│       └── vitest.config.ts            # Benchmark-specific config
│
└── orchestrator/
    └── benchmarks/
        ├── index.ts                    # Benchmark suite entry
        ├── task-store-crud.bench.ts    # Task store CRUD benchmarks
        └── vitest.config.ts            # Benchmark-specific config

benchmarks/
├── shared/
│   ├── benchmark-runner.ts             # Shared benchmark infrastructure
│   ├── metrics-collector.ts            # Performance metrics collection
│   ├── reporter.ts                     # Benchmark results reporter
│   └── thresholds.ts                   # Baseline threshold definitions
├── vitest.benchmark.config.ts          # Root benchmark vitest config
└── README.md                           # Benchmark documentation
```

### 2. Benchmark Infrastructure

#### 2.1 Enhanced PerformanceMonitor

Extend the existing `PerformanceMonitor` class with additional capabilities:

```typescript
// benchmarks/shared/benchmark-runner.ts
export interface BenchmarkResult {
  name: string;
  iterations: number;
  warmupIterations: number;
  stats: {
    mean: number;
    median: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
    stdDev: number;
  };
  throughput?: number;
  memoryDelta?: number;
  passed: boolean;
  threshold: BenchmarkThreshold;
}

export interface BenchmarkThreshold {
  maxMean: number;
  maxP95: number;
  maxP99?: number;
  minThroughput?: number;
}

export interface BenchmarkConfig {
  name: string;
  warmupIterations?: number;   // Default: 3
  iterations?: number;         // Default: 10
  threshold: BenchmarkThreshold;
}
```

#### 2.2 Benchmark Suite Pattern

Each benchmark file follows a consistent pattern:

```typescript
// Example: packages/browser/benchmarks/browser-launch.bench.ts
import { describe, bench, expect } from 'vitest';
import { BenchmarkRunner, THRESHOLDS } from '../../../benchmarks/shared';
import { launchBrowser } from '../src/index.js';

describe('Browser Launch Benchmarks', () => {
  const runner = new BenchmarkRunner();

  bench('chromium cold start', async () => {
    const result = await launchBrowser({ browserType: 'chromium', headless: true });
    expect(result.success).toBe(true);
    await result.data?.close();
  }, {
    iterations: 5,
    warmupIterations: 1,
    time: 30000,
  });

  bench('chromium warm start (with reuse)', async () => {
    // Test with instance reuse
  });
});
```

### 3. Baseline Thresholds

Define performance baselines for each operation:

```typescript
// benchmarks/shared/thresholds.ts
export const THRESHOLDS = {
  // @apexcli/browser thresholds
  browser: {
    launch: {
      chromium: { maxMean: 5000, maxP95: 8000, maxP99: 10000 },
      firefox: { maxMean: 6000, maxP95: 9000, maxP99: 12000 },
      webkit: { maxMean: 6000, maxP95: 9000, maxP99: 12000 },
    },
    screenshot: {
      png: {
        viewport: { maxMean: 200, maxP95: 500 },
        fullPage: { maxMean: 1000, maxP95: 2000 },
      },
      jpeg: {
        viewport: { maxMean: 150, maxP95: 400 },
        fullPage: { maxMean: 800, maxP95: 1500 },
      },
    },
  },

  // @apexcli/core thresholds
  core: {
    configParsing: {
      simple: { maxMean: 5, maxP95: 10 },
      complex: { maxMean: 20, maxP95: 50 },
      withValidation: { maxMean: 30, maxP95: 75 },
    },
    schemaValidation: {
      agentDefinition: { maxMean: 1, maxP95: 3 },
      workflowDefinition: { maxMean: 2, maxP95: 5 },
      fullConfig: { maxMean: 10, maxP95: 25 },
    },
  },

  // @apexcli/orchestrator thresholds
  orchestrator: {
    taskStore: {
      create: { maxMean: 5, maxP95: 15 },
      read: { maxMean: 2, maxP95: 5 },
      update: { maxMean: 3, maxP95: 10 },
      delete: { maxMean: 2, maxP95: 5 },
      bulkCreate: { maxMean: 50, maxP95: 100 }, // 100 tasks
    },
  },
} as const;
```

### 4. Vitest Benchmark Configuration

```typescript
// benchmarks/vitest.benchmark.config.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import { createSharedConfig } from '../vitest.shared.config';

export default mergeConfig(
  createSharedConfig('node'),
  defineConfig({
    test: {
      benchmark: {
        include: ['**/benchmarks/**/*.bench.ts'],
        reporters: ['default', 'json'],
        outputFile: {
          json: './benchmark-results.json',
        },
      },
      testTimeout: 120000,  // 2 minutes for benchmark suites
      hookTimeout: 60000,
    },
  })
);
```

### 5. CI Integration

Add a new benchmark workflow:

```yaml
# .github/workflows/benchmarks.yml
name: Performance Benchmarks

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  benchmark:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Install Playwright browsers
        run: npx playwright install chromium

      - name: Run benchmarks
        run: npm run benchmark
        timeout-minutes: 30

      - name: Upload benchmark results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: benchmark-results.json

      - name: Check thresholds
        run: npm run benchmark:check
```

### 6. Package Scripts

Add to root `package.json`:

```json
{
  "scripts": {
    "benchmark": "vitest bench --config benchmarks/vitest.benchmark.config.ts",
    "benchmark:browser": "vitest bench --config packages/browser/benchmarks/vitest.config.ts",
    "benchmark:core": "vitest bench --config packages/core/benchmarks/vitest.config.ts",
    "benchmark:orchestrator": "vitest bench --config packages/orchestrator/benchmarks/vitest.config.ts",
    "benchmark:check": "node benchmarks/shared/check-thresholds.js"
  }
}
```

### 7. Benchmark Test Structure

#### 7.1 Browser Benchmarks

| Benchmark | Operation | Iterations | Warmup | Threshold (ms) |
|-----------|-----------|------------|--------|----------------|
| `browser-launch-chromium` | Launch Chromium browser | 5 | 1 | mean < 5000 |
| `browser-launch-firefox` | Launch Firefox browser | 5 | 1 | mean < 6000 |
| `browser-launch-webkit` | Launch WebKit browser | 5 | 1 | mean < 6000 |
| `screenshot-png-viewport` | PNG viewport screenshot | 10 | 3 | mean < 200 |
| `screenshot-png-fullpage` | PNG full page (5000px) | 5 | 2 | mean < 1000 |
| `screenshot-jpeg-viewport` | JPEG viewport screenshot | 10 | 3 | mean < 150 |
| `screenshot-jpeg-fullpage` | JPEG full page (5000px) | 5 | 2 | mean < 800 |

#### 7.2 Core Benchmarks

| Benchmark | Operation | Iterations | Warmup | Threshold (ms) |
|-----------|-----------|------------|--------|----------------|
| `config-parse-simple` | Parse minimal config | 100 | 10 | mean < 5 |
| `config-parse-complex` | Parse full config | 50 | 5 | mean < 20 |
| `config-parse-validate` | Parse with validation | 50 | 5 | mean < 30 |
| `schema-validate-agent` | Validate AgentDefinition | 100 | 10 | mean < 1 |
| `schema-validate-workflow` | Validate WorkflowDefinition | 100 | 10 | mean < 2 |
| `schema-validate-config` | Validate ApexConfig | 50 | 5 | mean < 10 |

#### 7.3 Task Store Benchmarks (Orchestrator)

| Benchmark | Operation | Iterations | Warmup | Threshold (ms) |
|-----------|-----------|------------|--------|----------------|
| `task-create` | Create single task | 100 | 10 | mean < 5 |
| `task-read` | Read single task | 100 | 10 | mean < 2 |
| `task-update` | Update task status | 100 | 10 | mean < 3 |
| `task-delete` | Delete single task | 100 | 10 | mean < 2 |
| `task-bulk-create-100` | Create 100 tasks | 10 | 2 | mean < 50 |
| `task-query-all` | List all tasks | 50 | 5 | mean < 10 |

### 8. Reporting

Benchmark results are reported in multiple formats:

1. **Console Output**: Human-readable summary during test runs
2. **JSON Output**: Machine-readable for CI/CD integration
3. **HTML Report**: Visual report for detailed analysis (optional)

```typescript
// benchmarks/shared/reporter.ts
export interface BenchmarkReport {
  timestamp: string;
  commit: string;
  branch: string;
  environment: {
    os: string;
    nodeVersion: string;
    cpuCount: number;
    memoryGB: number;
  };
  results: BenchmarkResult[];
  summary: {
    totalBenchmarks: number;
    passed: number;
    failed: number;
    regressions: string[];
  };
}
```

## Consequences

### Positive

1. **Consistent Performance Tracking**: Automated benchmarks provide reliable performance baselines
2. **Regression Detection**: CI integration catches performance regressions early
3. **Documentation**: Benchmark results serve as documentation for expected performance
4. **Optimization Guidance**: Metrics guide future optimization efforts

### Negative

1. **CI Time**: Benchmarks add ~10-15 minutes to CI pipeline
2. **Flakiness Risk**: Performance tests can be flaky due to environment variability
3. **Maintenance Overhead**: Thresholds need periodic adjustment

### Mitigations

1. **Parallel Execution**: Run benchmarks in parallel where possible
2. **Environment Normalization**: Use consistent CI runners with resource limits
3. **Statistical Analysis**: Use percentiles (P95, P99) for more robust thresholds
4. **Threshold Versioning**: Document threshold changes with justification

## Implementation Plan

### Phase 1: Infrastructure (This Stage)
1. Create benchmark directory structure
2. Implement `BenchmarkRunner` class
3. Define threshold configurations
4. Create vitest benchmark configuration

### Phase 2: Browser Benchmarks
1. Implement browser launch benchmarks
2. Implement screenshot benchmarks
3. Create browser benchmark vitest config

### Phase 3: Core Benchmarks
1. Implement config parsing benchmarks
2. Implement schema validation benchmarks
3. Create core benchmark vitest config

### Phase 4: Orchestrator Benchmarks
1. Implement task store CRUD benchmarks
2. Create orchestrator benchmark vitest config

### Phase 5: CI Integration
1. Create benchmarks.yml workflow
2. Implement threshold checking script
3. Add benchmark scripts to package.json

## References

- [Vitest Benchmarking](https://vitest.dev/guide/features.html#benchmarking)
- Existing performance tests: `packages/browser/src/__tests__/performance-benchmark.test.ts`
- Existing PerformanceMonitor: `packages/browser/src/test-utils/performance.ts`
