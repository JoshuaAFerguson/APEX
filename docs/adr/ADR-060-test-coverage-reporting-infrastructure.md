# ADR-060: Test Coverage Reporting Infrastructure

## Status
Accepted

## Date
2026-01-29

## Context

APEX is a Turbo monorepo with four core packages (`core`, `orchestrator`, `cli`, `api`) plus auxiliary packages (`web-ui`). The project needs a robust test coverage reporting infrastructure to:

1. Measure current test coverage across all packages
2. Provide visibility into coverage gaps
3. Support CI enforcement of minimum coverage thresholds
4. Generate reports in multiple formats for different consumers (developers, CI, dashboards)

### Current State

The project already has substantial coverage infrastructure in place:

- **`@vitest/coverage-v8`** v4.0.15 installed as a devDependency
- **`npm run test:coverage`** script exists (`vitest run --coverage`)
- **`npm run test:unit:coverage`** script exists (`vitest run --config vitest.unit.config.ts --coverage`)
- **Root `vitest.config.ts`** has a `coverage` block with `provider: 'v8'`, reporters `['text', 'html']`, and include/exclude patterns
- **`vitest.unit.config.ts`** mirrors the coverage configuration for unit-only test runs
- **CI pipeline** (`.github/workflows/ci.yml`) runs `npm test` but does NOT run coverage reporting

### What's Missing

1. **Coverage thresholds** - No enforcement of minimum coverage percentages
2. **JSON/LCOV reporters** - Only `text` and `html` reporters; missing machine-readable formats needed for CI tooling and coverage badges
3. **CI coverage step** - CI workflow does not run `test:coverage`
4. **Per-package visibility** - Coverage is aggregated; no per-package breakdown in reporting
5. **Coverage output directory** - Using default location; should be explicit and gitignored

## Decision

### 1. Coverage Provider: V8 (Keep Current)

**Decision**: Keep `@vitest/coverage-v8` as the coverage provider.

**Rationale**: V8's native coverage is faster than Istanbul/nyc, has zero instrumentation overhead, and is already installed and configured. It provides accurate coverage for Node.js code which is the entirety of the APEX backend.

### 2. Reporter Configuration

**Decision**: Expand reporters from `['text', 'html']` to `['text', 'text-summary', 'html', 'json', 'lcov']`.

| Reporter | Purpose | Consumer |
|----------|---------|----------|
| `text` | Detailed per-file coverage in terminal | Developer (local) |
| `text-summary` | One-line summary for CI logs | CI pipeline |
| `html` | Interactive browsable report | Developer (local) |
| `json` | Machine-readable for tooling/scripts | CI, custom tooling |
| `lcov` | Standard format for coverage services | Codecov/Coveralls integration |

### 3. Coverage Thresholds

**Decision**: Set initial thresholds conservatively based on what the codebase can currently achieve, then progressively increase them.

```typescript
thresholds: {
  lines: 50,
  functions: 50,
  branches: 50,
  statements: 50,
}
```

**Rationale**: The project has extensive test files but the coverage percentages are unknown until first baseline run. Starting at 50% provides a safety net against major regressions without being so aggressive that it blocks development. These thresholds should be raised once baseline coverage is measured.

### 4. Coverage Output Directory

**Decision**: Set `reportsDirectory` to `./coverage` at repository root.

This directory must be added to `.gitignore` to prevent committing generated reports.

### 5. Exclude Patterns

**Decision**: Keep existing exclusions and add clarity:

```typescript
exclude: [
  '**/*.test.ts',
  '**/*.stress.test.ts',
  '**/*.edge.test.ts',
  '**/*.d.ts',
  // CLI is mostly wiring code tested via integration/manual
  'packages/cli/src/**/*.ts',
  // Web UI components require browser environment
  'packages/web-ui/src/app/**/*.{ts,tsx}',
  'packages/web-ui/src/components/**/*.{ts,tsx}',
  'packages/web-ui/src/lib/websocket-client.ts',
]
```

**Rationale**: The existing exclusions are well-reasoned. CLI is excluded because it's primarily UI wiring (React/Ink components, Commander.js command definitions) that is tested via integration tests. Web UI requires browser APIs not available in the test environment.

### 6. CI Integration

**Decision**: Add a coverage step to the CI workflow that runs after tests pass.

The CI should:
- Run `npm run test:coverage` to generate reports
- Upload coverage artifacts for visibility
- Eventually integrate with a coverage service (Codecov/Coveralls) using the LCOV report

### 7. Configuration Architecture

**Decision**: The coverage configuration should be centralized in the root `vitest.config.ts` and mirrored where needed in `vitest.unit.config.ts`. No per-package vitest configs need coverage sections since all coverage is measured from the root.

```
vitest.config.ts          → Full coverage (all tests)
vitest.unit.config.ts     → Unit-only coverage
vitest.e2e.config.ts      → No coverage (E2E tests are not source-coverage targets)
```

## Implementation Plan

### Phase 1: Configuration Enhancement (This Task)
1. Update `vitest.config.ts` coverage block with expanded reporters, thresholds, and explicit output directory
2. Update `vitest.unit.config.ts` to match
3. Ensure `coverage/` is in `.gitignore`
4. Verify `npm run test:coverage` generates reports successfully

### Phase 2: CI Integration (Future)
1. Add coverage step to `.github/workflows/ci.yml`
2. Upload coverage artifacts
3. Add coverage badge to README

### Phase 3: Threshold Tuning (Future)
1. Run baseline coverage report
2. Adjust thresholds to actual coverage minus 5% buffer
3. Progressively increase thresholds as coverage improves

## Consequences

### Positive
- Clear visibility into test coverage across all packages
- Machine-readable reports enable CI automation and coverage services
- Thresholds prevent coverage regressions
- Multiple report formats serve different consumers (developers, CI, dashboards)

### Negative
- Coverage runs add ~30-60s to test execution time
- Initial thresholds may need adjustment after baseline measurement
- False sense of security: high line coverage doesn't guarantee quality tests

### Risks
- Threshold too high: blocks PRs unnecessarily → Mitigated by starting at 50%
- Threshold too low: no meaningful protection → Will raise after baseline
- Coverage excludes important code: CLI exclusion means CLI bugs may not be caught → Accepted trade-off; CLI has integration tests
