# Unit Test Coverage Architecture Report

**Date:** March 7, 2026
**Stage:** Architecture
**Agent:** Architect Agent

## Executive Summary

This document provides the technical design analysis for running unit tests with coverage and verifying the 80% threshold requirement. The analysis reveals significant blockers that prevent meeting the requirements.

## Technical Design Analysis

### 1. Test Infrastructure Configuration

**Vitest Configuration Files:**
- `vitest.config.ts` - Main configuration (all tests)
- `vitest.unit.config.ts` - Unit test specific configuration
- `vitest.shared.config.ts` - Shared base configuration

**Coverage Configuration Found:**
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'text-summary', 'html', 'json', 'lcov'],
  thresholds: {
    global: {
      lines: 50,
      functions: 50,
      branches: 50,
      statements: 50,
    },
  },
}
```

**Key Finding:** The current coverage threshold is configured at **50%**, not 80%. To meet the 80% requirement, the threshold would need to be updated.

### 2. Test Execution Commands

| Command | Purpose |
|---------|---------|
| `npm run test:unit` | Run unit tests |
| `npm run test:unit:coverage` | Run unit tests with coverage |
| `npm run test:unit:watch` | Watch mode for unit tests |

### 3. Blocking Issues Identified

#### 3.1 Build Failures
The `npm run build` command fails with multiple TypeScript compilation errors:

**Packages with Build Errors:**
- `@apexcli/browser` - 11 TypeScript errors in mocks and permission types
- `@apex/test-utils` - 60+ TypeScript errors including:
  - Missing type exports (`Agent`)
  - `rootDir` violations
  - Type incompatibilities

**Sample Error Categories:**
- `TS2344` - Type constraint violations
- `TS2353` - Unknown property errors
- `TS2305` - Missing module exports
- `TS6059` - rootDir violations
- `TS2322` - Type assignment errors

#### 3.2 Test Execution Issues
Unit tests partially execute but many fail due to:
1. Mock configuration issues
2. Async timing problems
3. Missing dependencies
4. Type mismatches at runtime

### 4. Coverage Architecture

**Include Patterns:**
```typescript
include: [
  'packages/*/src/**/*.ts',
  'packages/*/src/**/*.tsx'
]
```

**Exclude Patterns:**
```typescript
exclude: [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.d.ts',
  '**/node_modules/**',
  '**/dist/**',
  '**/coverage/**',
  'packages/cli/src/**/*.ts',
  'packages/web-ui/src/app/**/*.{ts,tsx}',
  'packages/web-ui/src/components/**/*.{ts,tsx}',
  'packages/web-ui/src/lib/websocket-client.ts',
]
```

### 5. Current State Assessment

| Metric | Status | Details |
|--------|--------|---------|
| Build | ❌ FAILING | Multiple TypeScript errors |
| Unit Tests | ⚠️ PARTIAL | Some pass, many fail |
| Coverage Report | ❌ INCOMPLETE | Cannot generate due to test failures |
| 80% Threshold | ❌ NOT MET | Cannot verify due to blockers |

### 6. Technical Recommendations

To achieve 80% coverage threshold:

1. **Fix Build Errors First** - Resolve all TypeScript compilation errors
2. **Update Coverage Threshold** - Modify threshold from 50% to 80% in config:
   ```typescript
   thresholds: {
     global: {
       lines: 80,
       functions: 80,
       branches: 80,
       statements: 80,
     },
   },
   ```
3. **Fix Failing Tests** - Address mock and async issues in test files
4. **Add Missing Tests** - Increase test coverage for uncovered code

### 7. Files Requiring Attention

**Configuration Files:**
- `vitest.config.ts` (threshold update needed)
- `vitest.unit.config.ts` (threshold update needed)
- `vitest.shared.config.ts` (base threshold setting)

**Packages with Build Errors:**
- `packages/browser/src/mocks/`
- `packages/browser/src/permission-mocking/`
- `tests/test-utils/`
- `tests/e2e/fixtures/`
- `tests/e2e/helpers/`
- `tests/e2e/mocks/`

## Conclusion

**Status: ❌ REQUIREMENTS NOT MET**

The architecture analysis confirms that:
1. The build process is broken with TypeScript errors
2. Unit tests cannot complete successfully
3. Coverage cannot be generated or verified
4. The 80% threshold requirement cannot be validated

The existing test infrastructure is comprehensive and well-designed, but significant technical debt must be resolved before coverage metrics can be generated and verified.

---

**Report Generated:** March 7, 2026
**Agent:** Architect (Architecture Stage)
