# Code Review - Stage Findings v0.6.0 Feature Audit
**Date**: 2026-03-11
**Reviewer**: Code Review Agent
**Status**: Review Completed with Findings

---

## Summary
Reviewed v0.6.0 Project Context and Brownfield Codebase Analysis implementation. Build passes, but 28+ test failures identified requiring fixes before completion.

---

## Critical Issues Found

### 1. Test Scope/Variable Binding Issue - CRITICAL
**File**: `tests/v060-stack-documentation-verification.test.ts`
**Issue**: Helper functions reference outer-scope `testProjectDir` variable but test failures indicate variable is undefined at runtime
**Severity**: HIGH
**Pattern**: 25+ test failures with "testProjectDir is not defined"
```
× tests/v060-stack-documentation-verification.test.ts > v0.6.0 Stack Documentation Verification Features > Stack Technology Documentation > should document Node.js/TypeScript stack correctly
   → testProjectDir is not defined
```
**Root Cause**: Helper functions like `createNodeTypeScriptStack()`, `createReactStack()`, etc. (lines 1090+) reference `testProjectDir` from outer describe block, but the variable binding fails at test execution time
**Fix Required**: Pass `testProjectDir` as parameter to helper functions instead of relying on closure scope

### 2. Mock Configuration Mismatch - MEDIUM
**File**: `packages/orchestrator/src/codebase-intelligence/__tests__/indexer.test.ts`
**Lines**: 15-21
**Issue**: Mock pattern changed from `vi.mock('fs', {...promises...})` to `vi.mock('fs/promises')` but some tests still expect old structure
**Severity**: MEDIUM
**Details**:
```typescript
// Line 35-39 (OLD - before change)
vi.mock('fs', () => ({
  promises: {
    stat: vi.fn(),
    readFile: vi.fn(),
  },
}));

// After change to:
vi.mock('fs/promises', () => ({
  stat: vi.fn(),
  readFile: vi.fn(),
}));
```
**Impact**: Tests may fail due to import path mismatch

### 3. Property Name Changes Without Full Update - MEDIUM
**File**: `packages/orchestrator/src/codebase-intelligence/__tests__/indexer.test.ts`
**Lines**: 503, 563, 620
**Issue**: Schema property renamed from `hasParseErrors` to `hasErrors`, tests partially updated
**Severity**: MEDIUM
```typescript
// Line 503 - FIXED
expect(result.files[0].hasErrors).toBe(true);

// BUT mock at line 620 still uses incomplete object
```
**Impact**: Type mismatches between test expectations and implementation

### 4. Test Assertion Logic Errors - MEDIUM
**File**: `packages/cli/src/ui/components/__tests__/ToolCall.test.tsx`
**Multiple Lines**: 240, 248, 278, 294, 297, 425, 463, 509, 535, 540, 547, 555, 562, 677, 691, 703
**Issue**: Test comments added but underlying issues not fixed - assertions expect values different from actual implementation
**Severity**: MEDIUM
**Examples**:
```typescript
// Line 240 - OLD expected '1500ms' BUT formatDuration returns '1.5s'
expect(lastFrame()).toContain('1500ms');
// FIXED with comment
expect(lastFrame()).toContain('1.5s');

// Line 509 - Input format changed but assertion still outdated
// OLD: expected '7 params' BUT formatInput shows first param value
expect(lastFrame()).toContain('7 params');
// FIXED:
expect(lastFrame()).toContain('string');
```
**Impact**: Tests reflect comments but some expectations still don't match actual behavior

### 5. Runner.ts - Process Resource Limits Implementation - LOW (Design)
**File**: `packages/orchestrator/src/runner.ts`
**Lines**: 1365-1380, 1431-1440, 2236-2300
**Issue**: Process priority control implementation has design patterns worth noting
**Severity**: LOW (Informational)
**Patterns**:
- Using `execFileSync('ps')` to enumerate process tree (lines 2244)
- Using `os.setPriority()` for per-process nice level adjustment (line 2286)
- No validation that `ps` command exists (Unix-only check is `process.platform !== 'win32'`)
- Silent failure on permission errors is acceptable for optional feature

**Recommendation**: Document that renice feature requires process ownership or sudo

### 6. Test Framework Changes - LOW (Mixed Results)
**File**: `tests/v040-time-based-usage-session-recovery-comprehensive.test.ts`
**Changes**: ~296 lines modified, 80+ assertions refactored
**Severity**: LOW
**Impact**: Mostly comment additions and assertion adjustments for test clarity

---

## Code Quality Issues

### Type Safety
✓ TypeScript compilation passes (build succeeds)
✓ New type definitions added properly (CapacityInfo, HealthInfo interfaces)
⚠ Some implicit `any` type patterns remain in test files

### Error Handling
✓ Try-catch blocks present in renice operations (lines 2285-2291)
✓ Silent failure acceptable for background resource management
⚠ Some test error messages don't provide debugging context

### Security Review
✓ No hardcoded credentials introduced
✓ No arbitrary command execution with user input
⚠ `execFileSync('ps')` safe - parameters are static, not user-controlled
✓ Process priority changes are non-destructive

### Performance
✓ Process tree traversal uses efficient algorithm (O(n*m) with early termination)
⚠ Running every 30 seconds may impact high-load scenarios (mitigated by debug-only logging)

---

## Test Failures Summary

### Failing Test Categories

#### 1. Stack Documentation Tests (25 tests)
- File: `tests/v060-stack-documentation-verification.test.ts`
- Root Cause: Variable binding issue with `testProjectDir`
- Status: ALL FAILING - Requires scope fix

#### 2. Performance Benchmark Test (1 test)
- File: `packages/orchestrator/src/codebase-intelligence/indexer.performance.test.ts`
- Issue: Line ~169 - performance threshold exceeded (expected 400ms, got 300ms... wait, that's backwards)
```
✗ should handle large numbers of small files efficiently
   → expected 400 to be 300
```
- This might be a test environment slowness (CI slowness)
- Could indicate test is timing out more frequently than expected

#### 3. MCP CLI Tests (4 tests)
- File: `packages/cli/src/commands/mcp.test.ts`
- Issues:
  - Output format changed, test expectations outdated
  - Mock coloring functions not properly imported (`__vite_ssr_import_0__.default.magenta`)
  - Expected substring mismatches in assertion values

---

## Recommendations for Developer

### IMMEDIATE (Blocking Merge)
1. **Fix testProjectDir binding** - Pass as parameter to helper functions:
   ```typescript
   async function createNodeTypeScriptStack(projectDir: string) {
     await fs.writeFile(path.join(projectDir, 'package.json'), ...);
   }
   // In test:
   await createNodeTypeScriptStack(testProjectDir);
   ```

2. **Complete test assertion updates** - All comments in ToolCall.test.tsx that say "FIXED" should be verified against actual component behavior

3. **Verify MCP test mocks** - Ensure chalk/coloring library mocks are properly set up for ESM import patterns

### MEDIUM (Next Review)
1. Document process priority feature limitations in README
2. Consider parameterizing the 30s renice interval as configurable
3. Add integration test for renice feature on Unix systems

### LOW (Nice to Have)
1. Add performance regression testing to CI/CD
2. Consider extracting process management utilities into separate module for reuse

---

## Files Modified/Created
### Modified (7 files with staged changes):
- `packages/core/src/types.ts` - Added processLimits schema
- `packages/orchestrator/src/runner.ts` - Added renice functionality (+140 lines)
- `packages/cli/src/ui/components/__tests__/ToolCall.test.tsx` - Updated assertions
- `packages/orchestrator/src/codebase-intelligence/__tests__/indexer.test.ts` - Mock pattern changes
- `tests/v060-features-validation.test.ts` - Schema validation test updates
- `tests/v040-time-based-usage-session-recovery-comprehensive.test.ts` - Comprehensive refactor
- `docs/audits/output-components-audit.md` - Documentation updates

### Created (Untracked - cleanup needed):
- `packages/cli/src/services/__tests__/SessionStore.comprehensive-audit.test.ts` (39 KB)
- `packages/orchestrator/src/__tests__/autonomy-implementation-verification.test.ts`
- Various ADR and audit documentation files
- Multiple code review report files

---

## Build Status
✅ **TypeScript Compilation**: PASS
✅ **Build Output**: PASS (31.5s)
❌ **Test Suite**: FAIL (28+ test failures)

### Build Details
- All packages compiled successfully
- 2 Web UI linting warnings (aria-invalid on button - non-critical)
- Next.js build completed with 8 routes optimized

### Test Details
Cannot proceed to completion until test failures resolved.

---

## Acceptance Criteria Status

| Criterion | Status | Notes |
|-----------|--------|-------|
| Git status awareness | ✓ | Properly tracked, 49 commits ahead |
| Project structure analysis | ✓ | Core types and schema additions verified |
| Apex map-codebase | ⚠️ | Implementation present but test failures block verification |
| Stack documentation | ✗ | Tests failing due to variable binding |
| Real implementation verification | ✗ | Requires test fixes |

---

## Reviewer Signature
- **Stage**: Review
- **Result**: FINDINGS IDENTIFIED - REQUIRES FIXES
- **Recommendation**: Return to implementation stage to fix test failures before proceeding

---

## Next Steps for Developer
1. Address Critical Issue #1 (testProjectDir binding)
2. Fix all test assertions that don't match actual behavior
3. Re-run test suite until all tests pass
4. Commit fixes and re-submit for review
