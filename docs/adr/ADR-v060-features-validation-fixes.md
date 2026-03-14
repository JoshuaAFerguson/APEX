# ADR: v060-features-validation Test Failures Technical Design

## Status
**Proposed** - Architecture Stage

## Context

The `tests/v060-features-validation.test.ts` file has 14 failing tests that need to be fixed. These tests validate v0.6.0 "Context & Memory" features including:
- Project Context Analysis
- Workspace Health Checks
- Test Framework Detection
- NPM Registry Utilities

## Analysis Summary

### Category 1: Missing Schema Import (1 test)
**Affected Test**: "should perform complete project context analysis"

**Root Cause**:
- Line 263 uses `ProjectContextSchema.parse(context)` but `ProjectContextSchema` is not in the imports

**Solution**: Add `ProjectContextSchema` to the imports from `@apexcli/core`

---

### Category 2: createDoctorCheckResult Parameter Mismatch (4+ tests)
**Affected Tests**:
- "should create valid doctor check results"
- "should generate comprehensive health reports"
- "should calculate correct overall status"
- "should validate all v0.6.0 features work together"

**Root Cause**:
The `createDoctorCheckResult` function signature requires:
```typescript
createDoctorCheckResult(
  partial: Partial<DoctorCheckResult> & Pick<DoctorCheckResult, 'id' | 'name' | 'category'>
)
```

But tests pass objects like:
```typescript
createDoctorCheckResult({
  name: 'Node.js Version',
  description: 'Check Node.js version compatibility',
  status: 'pass',
  severity: 'error',
  details: 'Node.js v18.0.0 is compatible', // String, should be Record<string, unknown>
  durationMs: 150,
})
```

Missing required fields: `id`, `category`
Incorrect type: `details` should be `Record<string, unknown>` not `string`

**Solution**: Update all `createDoctorCheckResult` calls to include:
1. `id` field (string identifier like `'node-version-check'`)
2. `category` field (`'toolchain' | 'config' | 'network' | 'permissions' | 'environment'`)
3. Change `details` from string to object: `{ description: 'Node.js v18.0.0 is compatible' }`

---

### Category 3: GitStatusSchema Mismatch (1 test)
**Affected Test**: "should demonstrate v0.6.0 features are properly typed and validated"

**Root Cause**:
The test creates a GitStatus object with incorrect enum values:
```typescript
const testGitStatus: GitStatus = {
  // ...
  changedFiles: [
    {
      path: 'test.ts',
      status: 'modified',  // ERROR: Should be 'M'
      staged: true,
    }
  ],
  // Missing: tracking field (required, should be object or null)
};
```

The `GitChangedFileStatusSchema` expects:
```typescript
z.enum(['M', 'A', 'D', 'R', 'C', 'U', '?', '!'])
```

**Solution**:
1. Change `status: 'modified'` to `status: 'M'`
2. Add `tracking: null` or a valid tracking object

---

### Category 4: HealthReport Summary Mismatch (1 test)
**Affected Test**: "should generate comprehensive health reports"

**Root Cause**:
Test expects `errors` field in summary:
```typescript
expect(report).toMatchObject({
  summary: {
    total: 3,
    passed: 2,
    failed: 1,
    skipped: 0,
    warnings: 1,
    errors: 2,  // NOT IN SCHEMA
  },
});
```

But `HealthReportSchema.summary` has: `total`, `passed`, `failed`, `warnings`, `skipped` - no `errors`.

**Solution**: Remove `errors` from the test expectation or update the schema to include it.

---

### Category 5: NPM Registry Mock Issues (4 tests)
**Affected Tests**:
- "should query npm registry with proper headers"
- "should get latest package version"
- "should check if package version is available"
- "should handle network failures gracefully"

**Root Cause**:
The tests use `vi.stubGlobal('fetch', mockFetch)` but `queryNpmRegistry` uses a cached `fetchImpl` that is resolved at module load time:

```typescript
const fetchImpl = (() => {
  try {
    return globalThis.fetch;
  } catch {
    // fallback
  }
})();
```

The stub happens AFTER the module loads, so the cached reference is not updated.

**Solution Options**:
1. **Option A (Recommended)**: Mock at module level before import using `vi.mock()`
2. **Option B**: Modify `queryNpmRegistry` to use `globalThis.fetch` directly instead of caching
3. **Option C**: Skip these tests in favor of integration tests that hit real registry

---

### Category 6: Project Structure Schema Mismatch (1 test)
**Affected Test**: "should analyze project structure comprehensively"

**Root Cause**:
Test expects `maxDepth` and `totalSize` fields but actual implementation returns different structure:
```typescript
expect(structure).toMatchObject({
  totalFiles: expect.any(Number),
  totalDirectories: expect.any(Number),
  totalSize: expect.any(Number),    // NOT RETURNED
  maxDepth: expect.any(Number),      // NOT RETURNED
  entries: expect.any(Array),
});
```

**Solution**: Remove `totalSize` and `maxDepth` from test expectations or add them to the implementation.

---

### Category 7: Analyzer API Return Type Mismatches (5 tests)
**Affected Tests**:
- "should detect multiple frameworks in monorepo"
- "should provide confidence levels for framework detection"
- "should detect and analyze configuration files"
- "should detect test frameworks and their configurations"
- "should count test files correctly"

**Root Causes**:

1. **detectFrameworks()** returns `FrameworkDetection` object, not array:
   ```typescript
   // Test expects:
   frameworks.forEach(framework => { ... })
   // But returns:
   { frameworks: [], languages: [], runtime: ..., packageManager: ... }
   ```

2. **getConfigurationInfoList()** returns configs without `purposes` field

3. **getTestFrameworkInfoList()** returns `TestFrameworkInfo[]` but missing:
   - `runnerType` (test expects it but schema uses `type`)
   - `configFiles` (test expects array, schema has `configFile` singular)

**Solutions**:
1. Change `frameworks.forEach(...)` to `frameworks.frameworks.forEach(...)`
2. Access correct property names (`type` instead of `runnerType`)
3. Access `configFile` instead of `configFiles` array

---

## Implementation Steps

### Step 1: Fix Imports (1 change)
Add `ProjectContextSchema` to test imports at line 36.

### Step 2: Fix createDoctorCheckResult Calls (10+ changes)
Update all calls to include `id` and `category`, fix `details` type.

### Step 3: Fix GitStatus Test Data (2 changes)
- Change `status: 'modified'` to `status: 'M'`
- Add `tracking: null`

### Step 4: Fix HealthReport Expectation (1 change)
Remove `errors` from summary expectation.

### Step 5: Fix NPM Registry Tests (4 tests)
Either:
- Refactor to use module-level mocking
- Or skip tests and document as known limitation

### Step 6: Fix Project Structure Test (1 change)
Remove `maxDepth` and `totalSize` expectations.

### Step 7: Fix Analyzer API Usage (5+ changes)
- Access `frameworks.frameworks` instead of `frameworks`
- Use correct property names

---

## Technical Constraints

1. **Schema Backwards Compatibility**: The schemas in `types.ts` should not be modified as they may affect other parts of the system.

2. **Test Correctness**: Tests should be updated to match actual API contracts, not the other way around.

3. **Mock Boundaries**: NPM registry mocking requires careful consideration of when modules cache references.

---

## Decision

The test file `v060-features-validation.test.ts` should be updated to:
1. Use correct imports
2. Pass correct parameters to factory functions
3. Use correct enum values
4. Match actual API return types
5. Handle mocking appropriately

The implementation code (schemas, utilities) should NOT be modified as part of this fix - the tests were incorrectly written.

## Consequences

### Positive
- Tests will pass and accurately validate v0.6.0 features
- Test file will serve as accurate documentation of APIs

### Negative
- Requires careful review to ensure test logic remains valid
- May need to skip or refactor NPM registry tests

## Files to Modify

| File | Changes |
|------|---------|
| `tests/v060-features-validation.test.ts` | All fixes |

## Estimated Complexity

**Medium** - 14 tests to fix with clear patterns for each category.
