# ADR-052: Dual-Mode Test Configuration (Unit and E2E)

## Status

Accepted

## Context

The APEX project has a growing test suite with multiple test types:
- **Unit tests** (`*.test.ts`, `*.unit.test.ts`) - Fast, isolated, mock-heavy tests
- **E2E tests** (`*.e2e.test.ts`) - Slow, integration-heavy tests involving real git repos, databases, orchestrator instances
- **Integration tests** (`*.integration.test.ts`) - Already has a dedicated config at `tests/integration/vitest.config.ts`
- **Browser integration tests** - Already has a dedicated config at `tests/browser-integration/vitest.config.ts`
- **Stress/Edge tests** (`*.stress.test.ts`, `*.edge.test.ts`)

Currently, `npm run test` runs ALL tests via the root `vitest.config.ts`. There is no way to run only unit tests (fast feedback during development) or only E2E tests (thorough validation before merge) independently.

### Problems
1. **Slow feedback loop**: Developers must wait for E2E tests (30-60s+ timeouts) when they only want unit test feedback
2. **No separation of concerns**: Unit and E2E tests share the same timeout/pool/environment settings
3. **CI inefficiency**: Cannot parallelize unit and E2E test stages in CI pipelines
4. **E2E tests lack dedicated configuration**: No setup/teardown hooks, no resource management, no retry policies specific to E2E needs

## Decision

Introduce **dual-mode test configuration** with two new Vitest config files and corresponding npm scripts:

### Architecture

```
vitest.config.ts              # Root config (unchanged - runs ALL tests)
vitest.unit.config.ts         # Unit-only: fast, isolated tests
vitest.e2e.config.ts          # E2E-only: real resources, longer timeouts
tests/e2e/setup.ts            # E2E global setup/teardown hooks
```

### File Inclusion Strategy

**Unit config** (`vitest.unit.config.ts`):
- Includes: `packages/*/src/**/*.test.ts`, `packages/*/src/**/*.unit.test.ts`
- Excludes: `*.e2e.test.ts`, `*.integration.test.ts`, `*.stress.test.ts`, `*.edge.test.ts`
- Excludes: `tests/` top-level directory (integration/e2e/browser tests)

**E2E config** (`vitest.e2e.config.ts`):
- Includes: `packages/*/src/**/*.e2e.test.ts`, `tests/e2e/**/*.test.ts`, `tests/e2e/**/*.e2e.test.ts`
- Uses forked process pool to isolate tests with real resources
- Extended timeouts (60s test, 30s hooks)
- Global setup file for resource management

### NPM Scripts

```json
{
  "test": "vitest run",
  "test:unit": "vitest run --config vitest.unit.config.ts",
  "test:e2e": "vitest run --config vitest.e2e.config.ts"
}
```

### Configuration Differences

| Setting | Unit | E2E |
|---------|------|-----|
| `testTimeout` | 5000ms (default) | 60000ms |
| `hookTimeout` | 5000ms (default) | 30000ms |
| `pool` | `threads` (default) | `forks` |
| `maxForks/maxThreads` | unlimited | 4 |
| `setupFiles` | none | `tests/e2e/setup.ts` |
| `retry` | 0 | 2 (CI only) |
| `bail` | 0 | 1 (CI only) |
| `reporters` | default | verbose |
| `environment` | jsdom/node (matched) | node |

## Consequences

### Positive
- **Fast feedback**: `npm run test:unit` completes in seconds for pure unit tests
- **Dedicated E2E environment**: Proper timeouts, setup/teardown, retry policies
- **CI optimization**: Unit and E2E can run as separate CI jobs/stages
- **Backward compatible**: `npm run test` still runs everything (no breaking change)
- **Consistent with existing patterns**: Follows the same `--config` approach used for browser-integration and integration tests

### Negative
- **Three configs to maintain**: Root, unit, and E2E configs may drift; documented conventions mitigate this
- **File naming discipline required**: Tests must follow naming conventions for correct categorization

### Neutral
- E2E setup file follows the same pattern as `tests/integration/setup.ts`
- The root config remains the source of truth for "all tests pass" validation

## File Naming Conventions

| Suffix | Category | Run by |
|--------|----------|--------|
| `*.test.ts` | Unit (default) | `test`, `test:unit` |
| `*.unit.test.ts` | Unit (explicit) | `test`, `test:unit` |
| `*.e2e.test.ts` | End-to-end | `test`, `test:e2e` |
| `*.integration.test.ts` | Integration | `test`, `test:browser-integration` |
| `*.stress.test.ts` | Stress | `test` only |
| `*.edge.test.ts` | Edge cases | `test` only |

## Implementation Notes

- The unit config uses `environmentMatchGlobs` from root config to maintain jsdom/node environment matching
- E2E setup.ts provides temp directory management, git repo scaffolding, and resource cleanup utilities
- Coverage is only collected in unit mode (E2E tests exercise integration paths, not line-level coverage)
