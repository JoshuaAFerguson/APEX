# Turborepo Monorepo Configuration Review - APEX Project

## Review Summary
- **Status**: ISSUES FOUND - Build/Tests Not Passing
- **Project**: APEX v0.6.0
- **Date**: 2026-03-01
- **Completeness Rating**: 65/100 (Real implementation with significant bugs preventing build success)

---

## 1. Turbo.json Pipeline Configuration Analysis

### Location: `/root/turbo.json`

**Findings:**

### Pipeline Tasks Defined:
```json
{
  "build": {
    "dependsOn": ["^build"],
    "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
  },
  "dev": {
    "cache": false,
    "persistent": true
  },
  "lint": {
    "dependsOn": ["^build"]
  },
  "test": {
    "dependsOn": ["build"],
    "outputs": ["coverage/**"]
  },
  "typecheck": {
    "dependsOn": ["^build"]
  },
  "clean": {
    "cache": false
  }
}
```

**Configuration Quality Issues:**

#### ISSUE 1: test task dependency is incomplete
- **Severity**: MEDIUM
- **Location**: turbo.json:16-18
- **Problem**: `test` task depends on `build` (local) but should depend on `^build` (workspace dependencies first) to ensure all dependencies are built before testing
- **Impact**: Can cause race conditions where tests run before transitive dependencies are built
- **Recommendation**: Change `"dependsOn": ["build"]` to `"dependsOn": ["^build", "build"]`

#### ISSUE 2: No lint task dependency on linting itself
- **Severity**: LOW
- **Location**: turbo.json:13-14
- **Problem**: `lint` task depends on build but doesn't cascade to dependent packages' lint tasks
- **Impact**: Minimal - linting is usually independent, but inconsistent with other tasks
- **Recommendation**: Consider if this is intentional (lint doesn't require build in TypeScript projects)

---

## 2. Workspace Configuration Analysis

### Location: `/root/package.json`

**Workspace Definition:**
```json
{
  "workspaces": [
    "packages/*",
    "tests/test-utils"
  ]
}
```

**Packages Identified:**
1. `@apexcli/api` (packages/api)
2. `@apexcli/browser` (packages/browser)
3. `@apexcli/cli` (packages/cli)
4. `@apexcli/core` (packages/core)
5. `@apexcli/orchestrator` (packages/orchestrator)
6. `@apexcli/web-ui` (packages/web-ui) - private
7. `@apex/test-utils` (tests/test-utils)

**Configuration Quality:**
- ✅ Proper workspace setup with wildcard pattern
- ✅ All packages have consistent versioning (0.6.0)
- ✅ Test utilities workspace properly configured
- ✅ npm v10.0.0 specified as package manager

---

## 3. Cross-Package Dependencies Analysis

### Dependency Graph:

```
@apexcli/cli
├── @apexcli/api
├── @apexcli/core
└── @apexcli/orchestrator

@apexcli/api
├── @apexcli/core
├── @apexcli/orchestrator
└── @apexcli/browser

@apexcli/orchestrator
└── @apexcli/core

@apexcli/browser
└── (no internal dependencies)

@apexcli/core
└── (no internal dependencies)

@apexcli/web-ui (private)
└── @apexcli/core
```

**Cross-Package Dependency Quality:**
- ✅ Proper use of wildcard versions (`"*"`) for internal dependencies
- ✅ Clear dependency hierarchy established
- ✅ No circular dependencies detected
- ✅ All exports properly typed with TypeScript declaration files

---

## 4. Critical Build Issues Found

### Build Status: ❌ FAILING

The `npm run build` command fails with multiple TypeScript compilation errors across several packages.

### PACKAGE: `@apexcli/browser`

#### ISSUE 3: Type constraint violation
- **File**: `packages/browser/src/mocks/index.ts`
- **Line**: 75
- **Severity**: HIGH
- **Error**: `error TS2344: Type 'Function' does not satisfy the constraint '(...args: any) => any'`
- **Code**: `config?: Parameters<typeof MockBrowserManager.prototype.constructor>[0]`
- **Problem**: Using `Function` type directly violates TypeScript's stricter function signature constraints
- **Recommendation**: Replace with proper function type or use `(...args: any[]) => any`

#### ISSUE 4: Invalid property in type definition
- **File**: `packages/browser/src/mocks/mock-browser-manager.ts`
- **Line**: 156
- **Severity**: HIGH
- **Error**: `error TS2353: 'mockConfig' does not exist in type 'BrowserSessionConfig'`
- **Problem**: Attempting to assign `mockConfig` property that doesn't exist on the config type
- **Recommendation**: Either add `mockConfig` to `BrowserSessionConfig` type or use a different config object

#### ISSUE 5: Type mismatch in parameters
- **File**: `packages/browser/src/mocks/mock-browser-manager.ts`
- **Line**: 182
- **Severity**: HIGH
- **Error**: `error TS2345: BrowserSessionConfig not assignable to MockBrowserSessionConfig`
- **Problem**: Type missing required properties (`mockConfig`, `trackOperations`)
- **Recommendation**: Extend `BrowserSessionConfig` with required mock properties or restructure the types

#### ISSUE 6: Missing method on type
- **File**: `packages/browser/src/mocks/scenario-builder.ts`
- **Lines**: 216, 228, 243, 271
- **Severity**: MEDIUM
- **Error**: `error TS2339: Property 'build' does not exist on type 'MockOperationBehavior'`
- **Problem**: Calling `.build()` method on types that don't define it
- **Recommendation**: Add `build()` method to behavior types or use a different method name

#### ISSUE 7: Navigator interface extension incompatibility
- **File**: `packages/browser/src/permission-mocking/types.ts`
- **Line**: 152
- **Severity**: HIGH
- **Error**: `error TS2430: Interface 'NavigatorWithMockedPermissions' incorrectly extends 'Navigator'`
- **Problem**: Custom `PermissionDescriptor | MockPermissionDescriptor` union is incompatible with standard `PermissionDescriptor` in Navigator.permissions.query()
- **Details**: The mock version accepts additional permission types that the standard DOM API doesn't recognize (e.g., `"storage-access"`)
- **Recommendation**: Use type assertion in consumer code instead of extending Navigator directly, or restructure to avoid extending the standard interface

#### ISSUE 8: Type predicate incorrectness
- **File**: `packages/browser/src/permission-mocking/types.ts`
- **Line**: 181
- **Severity**: MEDIUM
- **Error**: `error TS2677: Type predicate's type must be assignable to its parameter's type`
- **Problem**: `isPermissionsMocked` function's return type predicate is incompatible with function parameter type
- **Recommendation**: Fix the type predicate to align with the actual Navigator type checking

#### ISSUE 9: Duplicate identifier
- **File**: `packages/browser/src/test-utils/index.ts`
- **Lines**: 67, 120
- **Severity**: HIGH
- **Error**: `error TS2300: Duplicate identifier 'assertPageContent'`
- **Problem**: Exporting `assertPageContent` from two different sources in the same index file
```typescript
// Line 67: from './assertions.js'
export { assertPageContent, ... } from './assertions.js';

// Line 120: from '../navigation-helpers.js'
export { assertPageContent } from '../navigation-helpers.js';
```
- **Recommendation**: Remove duplicate export; choose one source or rename one function

---

### PACKAGE: `@apex/test-utils`

#### ISSUE 10: File outside rootDir
- **File**: `tests/test-utils/tsconfig.json`
- **Severity**: HIGH
- **Error**: `error TS6059: File is not under 'rootDir'`
- **Files Affected**: Multiple files from `packages/core`, `packages/orchestrator`
- **Problem**: Test-utils package has `rootDir` set to `tests/test-utils` but imports from other packages
- **Recommendation**: Either adjust `rootDir` or configure `typeRoots` properly

#### ISSUE 11: Undefined variables used before declaration
- **File**: `tests/e2e/fixtures/marketplace-data.ts`
- **Lines**: 284-296
- **Severity**: HIGH
- **Error**: `error TS2448/TS2454: Variable used before being assigned`
- **Variables Affected**:
  - `INVALID_CONFIG_SERVER` (declared line 577)
  - `MISSING_DEPS_SERVER` (declared line 589)
  - `MALFORMED_CONFIG_SERVER` (declared line 608)
  - `CONFLICTING_SERVER` (declared line 560)
- **Problem**: These constants are used in `ALL_MARKETPLACE_ENTRIES` array and `ERROR_TEST_ENTRIES` array at lines 284-296 but aren't declared until lines 560+
- **Code Location**:
```typescript
// Line 284 - WRONG: Using undefined constants
export const ALL_MARKETPLACE_ENTRIES: MarketplaceEntry[] = [
  // ... other entries ...
  INVALID_CONFIG_SERVER,      // ❌ Not defined yet!
  MISSING_DEPS_SERVER,        // ❌ Not defined yet!
  MALFORMED_CONFIG_SERVER,    // ❌ Not defined yet!
];

// Line 560+ - Declaration comes later
export const CONFLICTING_SERVER: MarketplaceEntry = { ... };
export const INVALID_CONFIG_SERVER: MarketplaceEntry = { ... };
// etc.
```
- **Recommendation**: Move constant declarations before their usage in arrays

#### ISSUE 12: Type annotation issues
- **File**: `packages/core/src/types.ts`
- **Lines**: 10422, 10434
- **Severity**: MEDIUM
- **Error**: `error TS7022/TS7024: Implicitly has type 'any'`
- **Problem**: Missing type annotations in recursive type definitions
- **Recommendation**: Add explicit return type annotations to functions

#### ISSUE 13: Type union compatibility
- **File**: `packages/orchestrator/src/permission-manager.ts`
- **Line**: 80
- **Severity**: MEDIUM
- **Error**: `error TS2322: 'undefined' is not assignable to 'null'`
- **Problem**: Type definition allows `undefined` but function expects `null`
- **Recommendation**: Use consistent null/undefined handling

---

## 5. Build Command Analysis

### Root package.json Build Scripts:
```json
{
  "build": "turbo run build",
  "dev": "turbo run dev",
  "lint": "turbo run lint",
  "test": "vitest run",
  "typecheck": "turbo run typecheck",
  "clean": "turbo run clean"
}
```

**Issues with Build Pipeline:**

#### ISSUE 14: Test command bypasses Turbo
- **Severity**: MEDIUM
- **Location**: package.json:14
- **Problem**: `test` script runs `vitest run` directly instead of `turbo run test`
- **Impact**: Tests don't respect Turborepo pipeline, dependencies aren't guaranteed to be built
- **Recommendation**: Change to `"test": "turbo run test"`

#### ISSUE 15: Inconsistent Turbo usage
- **Severity**: LOW
- **Location**: Various test scripts (lines 15-75)
- **Problem**: Many test scripts don't use Turbo pipeline (e.g., `test:unified`, `test:unit`, `test:integration`)
- **Impact**: Bypasses caching and dependency management
- **Recommendation**: Consider standardizing on Turbo for testable scripts

---

## 6. Implementation Status

### Real Implementation Assessment: ✅ YES - Substantial Real Code

**Evidence of Real Implementation:**
- Multiple working packages with actual functionality (CLI, API, Orchestrator, Browser automation)
- Comprehensive TypeScript type definitions and exports
- Complex type hierarchies with proper encapsulation
- Real business logic in multiple files
- Extensive test utilities and fixtures
- Proper configuration for multiple test runners (Vitest, Playwright, Puppeteer)

### What's Not Stubbed:
- ✅ Package dependencies and exports properly structured
- ✅ Workspace configuration complete
- ✅ Build system integrated with Turbo
- ✅ Cross-package type references working (where not broken)
- ✅ Test infrastructure in place

### What's Broken:
- ❌ Build doesn't complete due to TypeScript errors
- ❌ Type definitions have conflicts and inconsistencies
- ❌ Some files use undefined variables
- ❌ Duplicate exports cause conflicts

---

## 7. Summary of Findings

### Critical Issues Blocking Build (9 total):
1. TS2344: Function type constraint violation (browser/mocks)
2. TS2353: Invalid property in config type (browser/mocks)
3. TS2345: Type mismatch in parameters (browser/mocks)
4. TS2339: Missing 'build' method (browser/scenario-builder)
5. TS2430: Navigator interface extension incompatibility (browser/types)
6. TS2677: Type predicate incorrectness (browser/types)
7. TS2300: Duplicate identifier 'assertPageContent' (browser/test-utils)
8. TS6059: Files outside rootDir (test-utils)
9. TS2448/TS2454: Variables used before declaration (marketplace-data.ts)

### Medium Severity Issues (4 total):
10. Type annotation missing (types.ts)
11. Null/undefined type mismatch (permission-manager.ts)
12. Test command bypasses Turbo (package.json)
13. Inconsistent test script organization

### Configuration Issues (2 total):
14. Test task should depend on ^build
15. Some lint configuration questions

---

## 8. Recommendations

### Must Fix Before Completion:
1. **Fix all TS2300 errors** - Remove duplicate 'assertPageContent' export
2. **Fix variable declaration order** - Move constants before their usage
3. **Fix Navigator interface extension** - Use type assertions instead of extending
4. **Fix rootDir configuration** - Either adjust or use proper type roots
5. **Update test command** - Change to `turbo run test`

### Should Fix:
6. Fix Function type constraints
7. Fix type predicate implementations
8. Add missing method definitions
9. Fix null/undefined inconsistencies

### Consider Improving:
10. Standardize test command usage with Turbo
11. Review permission system type safety
12. Add stricter null checking in orchestrator code

---

## Assessment: Completeness 65/100

**Real Implementation**: ✅ YES - Substantial, multi-package monorepo
**Configured for Turbo**: ✅ YES - Proper workspace and turbo.json setup
**Build Status**: ❌ FAILING - Multiple TypeScript errors
**Dependency Structure**: ✅ GOOD - Clear dependency graph, no cycles
**Test Infrastructure**: ⚠️ PARTIAL - Configured but not running via Turbo pipeline

The implementation is **REAL and SUBSTANTIAL** but has **CRITICAL BUILD ISSUES** preventing successful compilation. The Turborepo configuration itself is sound, but the TypeScript code has conflicts that must be resolved.
