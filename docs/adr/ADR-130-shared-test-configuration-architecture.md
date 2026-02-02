# ADR-130: Shared Test Configuration and Base Utilities Architecture

## Status
Accepted

## Date
2025-01-31

## Context

The task requires establishing a shared test configuration and base test utilities for the APEX monorepo. After thorough analysis of the existing codebase, the infrastructure is **largely already in place** but has some gaps and inconsistencies that need addressing.

### Current State Assessment

#### What Already Exists (and is well-structured)

1. **Root-level Vitest configurations** — Three configs already cover all test tiers:
   - `vitest.config.ts` — All tests (unit + integration + E2E + stress + edge)
   - `vitest.unit.config.ts` — Unit tests only (fast feedback)
   - `vitest.e2e.config.ts` — E2E tests with extended timeouts, forked processes, retry policy

2. **Package-level Vitest configs** — `cli` and `api` have their own configs with package-specific settings (jsdom for CLI's React components, extended timeouts for API)

3. **Shared test fixtures module** — `packages/core/src/test-fixtures/` is a comprehensive module exported via `@apexcli/core/test-fixtures` containing:
   - `test-utils.ts` — `waitFor`, `sleep`, `flushPromises`, `retry`, `createDeferredPromise`, `dataGenerator`, `assertions`, `performance`, `console` capture
   - `setup-teardown.ts` — `createTestSuite()`, `addCleanupTask()`, `cleanupTestState()`, `createTempDir()`, `flushTimers()`, `advanceTimers()`
   - `mock-helpers.ts` — `createOrchestratorMock()`, `createAgentSdkMock()`, `createFileSystemMock()`, `createNetworkMock()`, `createTaskStoreMock()`, `createEventEmitterMock()`, `createPageMock()`
   - `package-helpers.ts` — `createCLITestSuite()`, `createOrchestratorTestSuite()`, `createCoreTestSuite()`, `createTimerTestSuite()`
   - `types.ts` — Full type definitions for test infrastructure
   - Factory functions, builder classes, error presets, browser fixtures

4. **Package.json exports** — `@apexcli/core` already exposes:
   - `@apexcli/core/test-fixtures` — Full fixtures module
   - `@apexcli/core/test-utils` — Direct test utilities
   - `@apexcli/core/test-setup` — Test setup helpers
   - `@apexcli/core/test-setup-utils` — Combined setup utilities

5. **npm scripts** — Comprehensive set already configured:
   - `test`, `test:unit`, `test:unit:watch`, `test:unit:coverage`
   - `test:e2e`, `test:e2e:watch`
   - `test:watch`, `test:coverage`
   - `test:browser-integration`, `test:browser-integration:watch`, `test:browser-integration:coverage`

6. **Existing ADRs** — ADR-007 (base test utilities), ADR-008 (setup/teardown patterns), ADR-085 (centralized test fixtures module)

#### What Needs Improvement

| Gap | Description | Priority |
|-----|-------------|----------|
| **G1: Config DRY violation** | Root `vitest.config.ts` and `vitest.unit.config.ts` duplicate `environmentMatchGlobs`, `coverage.exclude`, `coverage.thresholds` | Medium |
| **G2: Package configs miss shared settings** | `packages/api/vitest.config.ts` doesn't inherit environment match globs or coverage thresholds from root | Medium |
| **G3: Low adoption of shared utilities** | Only `test-fixtures` internal tests use `@apexcli/core/test-fixtures` — other packages define their own utilities | High |
| **G4: Missing `vitest.shared.ts`** | No single shared config object that package-level configs can extend via `mergeConfig()` | Medium |
| **G5: No global setup file for unit tests** | The E2E config has `setupFiles` but root/unit configs don't — common setup (e.g., global `vi.setTimeout`) isn't standardized | Low |

## Decision

### Architecture: Consolidate and Connect (Not Rebuild)

The existing infrastructure is mature and well-designed. The architecture work is about **connecting the dots** — making the shared utilities more discoverable, reducing duplication in configs, and ensuring consistent adoption.

### 1. Shared Vitest Base Configuration (`vitest.shared.ts`)

Create a shared configuration module at the monorepo root that all configs (root and package-level) can extend:

```typescript
// vitest.shared.ts
import { defineConfig, mergeConfig, type UserConfig } from 'vitest/config';

/** Shared environment mappings for all APEX packages */
export const environmentMatchGlobs: [string, string][] = [
  ['**/packages/orchestrator/src/**', 'node'],
  ['**/packages/core/src/**', 'node'],
  ['**/packages/api/src/**', 'node'],
  ['**/packages/cli/src/__tests__/**', 'node'],
  ['**/packages/cli/src/services/**', 'node'],
];

/** Shared coverage exclusion patterns */
export const coverageExclude = [
  '**/*.test.ts',
  '**/*.stress.test.ts',
  '**/*.edge.test.ts',
  '**/*.d.ts',
  'packages/cli/src/**/*.ts',
  'packages/web-ui/src/app/**/*.{ts,tsx}',
  'packages/web-ui/src/components/**/*.{ts,tsx}',
  'packages/web-ui/src/lib/websocket-client.ts',
];

/** Shared coverage thresholds */
export const coverageThresholds = {
  lines: 50,
  functions: 50,
  branches: 50,
  statements: 50,
};

/** Base configuration shared by all vitest configs */
export const sharedConfig: UserConfig = {
  test: {
    globals: true,
    environmentMatchGlobs,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json', 'lcov'],
      reportsDirectory: './coverage',
      include: ['packages/*/src/**/*.ts'],
      exclude: coverageExclude,
      thresholds: coverageThresholds,
    },
  },
};
```

**Rationale**: This eliminates the DRY violations (G1, G4) without breaking any existing configs. Each config file imports and extends `sharedConfig` via `mergeConfig()`.

### 2. Consolidate Import Paths for Test Utilities

The current export map from `@apexcli/core` provides four test-related entry points. This should be simplified to two canonical paths:

| Import Path | Purpose | Contains |
|-------------|---------|----------|
| `@apexcli/core/test-fixtures` | **Full test infrastructure** | Fixtures, factories, builders, error presets, mock helpers, setup/teardown, package helpers |
| `@apexcli/core/test-utils` | **Lightweight utilities only** | `waitFor`, `sleep`, `retry`, `flushPromises`, `createDeferredPromise`, `assertions`, `performance`, `dataGenerator` |

The `test-setup` and `test-setup-utils` exports should be preserved for backward compatibility but documented as deprecated in favor of `test-fixtures`.

### 3. Standardized Test Setup File

Create a minimal global setup file that all unit test configs reference:

```typescript
// tests/setup.ts
import { vi } from 'vitest';

// Standard test timeout for unit tests (5 seconds)
vi.setConfig({ testTimeout: 5000 });

// Suppress noisy console output in tests unless DEBUG is set
if (!process.env.DEBUG) {
  vi.spyOn(console, 'debug').mockImplementation(() => {});
}
```

The E2E config already has its own `tests/e2e/setup.ts` — this does not change.

### 4. Package Config Update Pattern

Package-level configs should extend the shared base:

```typescript
// packages/api/vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedConfig } from '../../vitest.shared.js';

export default mergeConfig(sharedConfig, defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
  },
}));
```

### 5. Test Utility Adoption Guide

The following mapping shows which existing per-package utilities map to shared alternatives:

| Package Pattern | Current (Local) | Shared Alternative |
|----------------|------------------|-------------------|
| `waitFor()` | `cli/src/__tests__/test-utils.tsx` | `import { waitFor } from '@apexcli/core/test-fixtures'` |
| Temp directory management | `orchestrator/src/test-utils.ts` | `import { createTempDir } from '@apexcli/core/test-fixtures'` |
| Mock orchestrator | Various inline `vi.fn()` | `import { createOrchestratorMock } from '@apexcli/core/test-fixtures'` |
| Mock file system | Various inline `vi.mock('fs')` | `import { createFileSystemMock } from '@apexcli/core/test-fixtures'` |
| Fake timers suite | Manual `vi.useFakeTimers()`/`vi.useRealTimers()` | `import { createTimerTestSuite } from '@apexcli/core/test-fixtures'` |
| Deferred promises | Inline implementations | `import { createDeferredPromise } from '@apexcli/core/test-fixtures'` |

### 6. Directory Structure (Final State)

```
/                                   # Monorepo root
├── vitest.config.ts                # All tests (extends vitest.shared.ts)
├── vitest.unit.config.ts           # Unit tests only (extends vitest.shared.ts)
├── vitest.e2e.config.ts            # E2E tests (extends vitest.shared.ts)
├── vitest.shared.ts                # NEW: Shared configuration constants
├── tests/
│   ├── setup.ts                    # NEW: Global unit test setup
│   ├── e2e/
│   │   ├── setup.ts               # Existing E2E setup
│   │   └── teardown.ts            # Existing E2E teardown
│   ├── integration/                # Existing
│   ├── browser-integration/        # Existing
│   └── documentation/              # Existing
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── test-utils.ts       # Existing: platform detection, permission mocks
│   │       └── test-fixtures/      # Existing: comprehensive shared test infrastructure
│   │           ├── index.ts        # Barrel export
│   │           ├── test-utils.ts   # Async utilities, assertions, performance
│   │           ├── setup-teardown.ts # createTestSuite(), cleanup, temp dirs
│   │           ├── mock-helpers.ts # Mock factories for all APEX components
│   │           ├── package-helpers.ts # Pre-configured suites per package
│   │           ├── types.ts        # Type definitions
│   │           ├── factories/      # Task, tool factories
│   │           ├── builders/       # Fluent builder pattern
│   │           ├── errors/         # Error preset collections
│   │           ├── responses/      # Response fixtures
│   │           └── requests/       # Request fixtures
│   ├── cli/
│   │   └── vitest.config.ts        # Extends vitest.shared.ts
│   ├── api/
│   │   └── vitest.config.ts        # Extends vitest.shared.ts
│   ├── orchestrator/               # Uses root config (no package-level config)
│   └── browser/                    # Uses root config (no package-level config)
```

## Implementation Plan

### Phase 1: Create Shared Config (This Task)
1. Create `vitest.shared.ts` with extracted shared constants
2. Create `tests/setup.ts` with minimal global setup
3. Update root configs to import from `vitest.shared.ts`
4. Update package configs to extend shared base
5. Verify build and tests pass

### Phase 2: Documentation (This Task)
1. Create this ADR
2. Update inline documentation in test-fixtures modules

### Phase 3: Migration (Future Task)
1. Gradually migrate per-package test utilities to use shared imports
2. Deprecate redundant local utilities
3. Add lint rule to prefer `@apexcli/core/test-fixtures` imports

## Consequences

### Positive
- **Single source of truth** for vitest configuration constants (environment mappings, coverage thresholds)
- **Existing infrastructure preserved** — no breaking changes to any existing test
- **Clear import paths** — developers know exactly where to find test utilities
- **Incremental adoption** — packages can migrate to shared utilities at their own pace
- **Consistent test behavior** — all configs share the same base settings

### Negative
- **Two-level config** — package configs now have an import dependency on root `vitest.shared.ts`
- **Migration effort** — existing tests using local utilities need gradual migration (Phase 3)

### Neutral
- The `@apexcli/core/test-fixtures` module remains the canonical location for shared test utilities — this ADR does not move any code, only connects what exists

## Technical Notes

### TypeScript Support
- All vitest configs already use TypeScript (`vitest.config.ts`)
- The `@apexcli/core` package compiles test-fixtures to `dist/test-fixtures/` with full type declarations
- Package exports map in `@apexcli/core/package.json` correctly maps `./test-fixtures` to `dist/test-fixtures/index.js`

### Vitest Version
- Current: `^4.0.15` with `@vitest/coverage-v8` `^4.0.15`
- The `mergeConfig` API is stable and well-supported

### Environment Strategy
- Default: `jsdom` (for CLI React components)
- Override to `node` via `environmentMatchGlobs` for backend packages (core, orchestrator, api)
- E2E config forces `node` globally

### Coverage Strategy
- Provider: V8
- Thresholds: 50% (lines, functions, branches, statements)
- CLI package excluded from coverage (wiring code, tested via integration)
- Web UI components excluded (require browser environment)
