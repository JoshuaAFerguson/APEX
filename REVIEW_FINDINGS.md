# Code Review: v060-features-validation.test.ts

## Summary
The test file has 14 failing tests due to incorrect test expectations and mock setup. The issues are primarily in the test file itself, not the implementation. The code requires fixes to schema compliance, mock setup, and test timeout configurations.

## Detailed Findings

### CRITICAL ISSUES (Must Fix)

#### 1. DoctorCheckResult Schema Validation - lines 283-290
**Severity**: HIGH
**Problem**: Test creates DoctorCheckResult with invalid data type
- `details` field passed as string `"Node.js v18.0.0 is compatible"`
- Schema expects `z.record(z.string(), z.unknown())` (object)
- Missing required `message` field (required by schema)

**Status**: Test expects `details` as string but schema requires object
**Fix Location**: tests/v060-features-validation.test.ts:288

---

#### 2. DoctorCheckResultSchema Missing Required Fields
**Severity**: HIGH  
**Problem**: Function `createDoctorCheckResult` doesn't always provide required schema fields

The DoctorCheckResultSchema requires:
- id: z.string() ✓ (function provides)
- name: z.string() ✓ (test provides)
- description: z.string() ✓ (test provides)
- category: z.enum([...]) ✓ (function provides 'environment')
- status: z.enum([...]) ✓ (test provides)
- severity: z.enum([...]) ✓ (test provides)
- message: z.string() ✗ (NOT PROVIDED - REQUIRED)
- timestamp: z.date() ✓ (function provides)
- durationMs: z.number() ✓ (test provides)
- details: z.record(z.string(), z.unknown()).optional() ✗ (type mismatch)

**Root Cause**: Test passes `details` as string when schema expects object/record

---

#### 3. NPM Registry Mock Ineffective - lines 415-480
**Severity**: HIGH
**Problem**: Mock fetch is stubbed but never called; real network requests are made
- Mock setup: `vi.stubGlobal('fetch', mockFetch)` at line 425
- Mock called 0 times (error message: "Number of calls: 0")
- Real data returned: '0.5.0' instead of mocked '0.6.0'
- Network error test gets real data instead of null

**Evidence**: 
- Line 429: `expect(mockFetch).toHaveBeenCalledWith(...)` fails with 0 calls
- Line 458: Expected '0.6.0', got '0.5.0' (real npm latest version)
- Line 487: Expected null, got real package data

**Root Cause**: `queryNpmRegistry` likely imports fetch differently than global reference
- May use `import fetch` at module level
- May use `fetch` from a different import path
- Global stub isn't effective

**Fix Strategy**: 
1. Check queryNpmRegistry implementation for fetch import
2. Mock at the correct import point (e.g., vi.mock('node:fetch'))
3. Or use proper module mocking instead of global stub

---

#### 4. Test Framework Detection - Missing Field - lines 231-236
**Severity**: MEDIUM
**Problem**: Expected field doesn't exist in result
- Test expects: `vitestFramework.runnerType === 'vitest'`
- Actual: `vitestFramework.runnerType === undefined`

**Fix Options**:
1. Add `runnerType` to TestFrameworkInfo detection logic
2. Check what field is actually populated and test that instead
3. Update test to match actual TestFrameworkInfo shape

---

#### 5. Coverage Detection Failure - line 245
**Severity**: MEDIUM
**Problem**: Coverage not detected as enabled
- Expected: `coverageEnabled === true`
- Actual: `coverageEnabled === false`

**Likely Causes**:
- Vitest configs don't have coverage enabled
- Detection logic doesn't properly check coverage config
- Detection only checks for coverage tool existence, not enabled status

---

### PERFORMANCE ISSUES

#### 6. Test Timeout - Default 5000ms too short
**Severity**: MEDIUM
**Lines Affected**: 202, 251, 495

Tests timeout after 5000ms (vitest default):
- Line 202: `getConfigurationInfoList()` - scans many files
- Line 251: `analyzer.analyze()` - comprehensive project scan  
- Line 495: `analyzer.analyze()` - comprehensive project scan

**Root Cause**: APEX has 4675 files; full project scans take >5 seconds

**Fix**: Increase test timeout for these specific tests

---

## Failing Tests Summary

1. ❌ should create valid doctor check results (283-303)
   - Missing `message` field
   - `details` type mismatch (string vs object)

2. ❌ should generate comprehensive health reports (322-367)
   - Same underlying issues as test #1

3. ❌ should query npm registry with proper headers (415-445)
   - Mock fetch not called (0 calls)

4. ❌ should get latest package version (447-461)
   - Mock not working, gets real data '0.5.0' instead of '0.6.0'

5. ❌ should check if package version is available (463-480)
   - Mock not working

6. ❌ should handle network failures gracefully (482-490)
   - Mock not working, gets real data instead of null

7. ❌ should detect test frameworks and their configurations (218-237)
   - Missing `runnerType` field (undefined vs 'vitest')

8. ❌ should count test files correctly (239-247)
   - `coverageEnabled` false instead of true

9. ❌ should safely extract configuration settings (202-214)
   - Timeout after 5000ms

10. ❌ should perform complete project context analysis (251-277)
    - Timeout after 5000ms

11. ❌ should validate all v0.6.0 features work together (495-547)
    - Timeout after 5000ms

12-14. (NPM mock tests also fail - cascading from #3)

---

## Specific Code Issues

### Issue: DoctorCheckResult Creation
**File**: tests/v060-features-validation.test.ts:283-290

```typescript
const checkResult = createDoctorCheckResult({
  name: 'Node.js Version',
  description: 'Check Node.js version compatibility',
  status: 'pass',
  severity: 'error',
  details: 'Node.js v18.0.0 is compatible',  // ❌ Should be object, not string
  durationMs: 150,
  // ❌ Missing required 'message' field
});
```

### Issue: NPM Registry Mock
**File**: tests/v060-features-validation.test.ts:415-427

```typescript
const mockFetch = vi.fn().mockResolvedValue({...});
vi.stubGlobal('fetch', mockFetch);
const packageInfo = await queryNpmRegistry('@apexcli/core');
// ❌ mockFetch never called - wrong mocking strategy
expect(mockFetch).toHaveBeenCalledWith(...);  // Fails: 0 calls
```

---

## Recommendations

### Critical Fixes Needed
1. **DoctorCheckResult tests**: Add `message` field, change `details` to object
2. **Mock setup**: Fix NPM registry fetch mocking (module-level not global)
3. **Framework detection**: Add missing `runnerType` field or update test
4. **Timeouts**: Increase timeout for slow operations (30s)
5. **Coverage**: Fix vitest coverage detection or enable in config

### Code Quality Improvements
1. Add per-test timeout overrides for slow tests
2. Mock file system operations to speed up tests
3. Use proper module mocking (vi.mock) instead of global stubs
4. Add setup/teardown for performance-critical tests

---

## Files Requiring Changes
- ✏️ `tests/v060-features-validation.test.ts` - Test fixes
- 🔍 `packages/core/src/doctor-utils.ts` - Verify field requirements
- 🔍 `vitest.config.ts` - May need coverage config
- 🔍 `packages/core/src/npm-registry-utils.ts` - Check fetch import strategy

