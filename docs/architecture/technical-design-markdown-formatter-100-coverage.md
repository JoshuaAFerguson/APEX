# Technical Design: markdown-formatter.ts 100% Test Coverage

## Overview

This document provides the technical design for achieving 100% test coverage of `packages/core/src/export/markdown-formatter.ts`.

## Current Coverage Analysis

| Metric     | Current | Target | Gap  |
|------------|---------|--------|------|
| Statements | 93.73%  | 100%   | 6.27%|
| Branches   | 80.19%  | 100%   |19.81%|
| Functions  | 97.61%  | 100%   | 2.39%|
| Lines      | 94.47%  | 100%   | 5.53%|

### Identified Uncovered Lines

Based on coverage analysis, the following specific lines need coverage:

| Line | Function | Issue Description |
|------|----------|-------------------|
| 13   | Module   | Import statement (not executable) |
| 785  | generateArtifactsSection | `sectionLimit > artifacts.length` branch for "more artifacts" message |
| 870  | formatDuration | Hour formatting branch (`ms >= 3600000`) |
| 926  | escapeMarkdown | Function never called (unused helper) |

### Identified Uncovered Branches

Based on branch coverage of 80.19%, the following branches need coverage:

1. **Line 438-439**: Default case in `generateTasksSection` switch statement
2. **Line 785**: Truncation message for artifacts when exceeding sectionLimit
3. **Line 870**: Hour formatting in `formatDuration` for durations >= 1 hour
4. **Line 926**: The `escapeMarkdown` function itself (unused)
5. **Various null checks**: Optional field presence checks in detailed layout

## Test Gap Analysis

### Gap 1: formatDuration Hour Branch (Line 870)

**Problem**: No test exercises durations ≥ 3600000ms (1 hour)

**Solution**: Add test with execution time ≥ 1 hour
```typescript
it('should format duration in hours for long execution times', () => {
  const task = createTask({
    usage: createTaskUsage({ executionTimeMs: 7200000 }) // 2 hours
  });
  const result = formatTasksToMarkdown([task], {
    metricsSection: 'separate'
  });
  expect(result).toContain('2.0h');
});
```

### Gap 2: Artifact Section Limit Truncation (Line 785)

**Problem**: No test exercises artifact truncation when `artifacts.length > sectionLimit`

**Solution**: Create task with artifacts per type > sectionLimit
```typescript
it('should truncate artifacts per type when exceeding sectionLimit', () => {
  const taskWithManyArtifactsOfSameType = createTask({
    artifacts: Array.from({ length: 15 }, (_, i) =>
      createTaskArtifact({ name: `file-${i}.ts`, type: 'file' })
    )
  });
  const result = formatTasksToMarkdown([taskWithManyArtifactsOfSameType], {
    artifactsSection: 'separate',
    sectionLimit: 5
  });
  expect(result).toContain('*... 10 more artifacts*');
});
```

### Gap 3: escapeMarkdown Function (Line 926)

**Problem**: Function exists but is never called in the codebase

**Analysis**: This function `escapeMarkdown` appears to be dead code - it's defined but never invoked. The codebase uses:
- `escapeLightly()` for descriptions and content
- `escapeTableCell()` for table cells
- `escapeMetadata()` for metadata fields

**Solution Options**:
1. **Option A (Recommended)**: Remove the unused function to achieve 100% coverage
2. **Option B**: Export and test the function separately if it's intended for future use
3. **Option C**: Add explicit test for the function via direct import (if exported)

**Recommended Approach**: Option A - Remove dead code. The function serves no purpose currently.

### Gap 4: Default Case in Switch Statement (Line 438-439)

**Problem**: The default case in `generateTasksSection` is unreachable due to TypeScript type safety

**Analysis**: The layout type is `'table' | 'list' | 'detailed' | 'summary'` - TypeScript ensures only valid values reach this switch. The default case is defensive programming but unreachable.

**Solution Options**:
1. Use `/* istanbul ignore next */` or `/* c8 ignore next */` comment
2. Remove default case entirely (TypeScript exhaustiveness check)
3. Cast to bypass type safety to trigger default (not recommended)

**Recommended Approach**: Add ignore comment - this is intentional defensive programming.

### Gap 5: Empty Task Array Branches

Several branches handle empty arrays but may not be fully exercised:

```typescript
// Line 450-454: Empty tasks in table layout
if (tasks.length === 0) {
  lines.push('*No tasks to display.*');
  return lines.join('\n');
}
```

**Solution**: Ensure tests exercise empty arrays with each layout type.

### Gap 6: Optional Field Presence Checks

Multiple branches check for optional fields:
- `task.acceptanceCriteria` (line 564)
- `task.currentStage` (line 576)
- `task.completedAt` (line 585)
- `task.error` (line 617)
- `log.stage` (line 686)
- `log.agent` (line 690)
- `artifact.path` (line 777)

**Solution**: Create comprehensive tests with and without each optional field.

## Implementation Plan

### Phase 1: Add Missing Test Cases

1. **Duration formatting tests**
   - Add test for milliseconds (<1s)
   - Add test for seconds (1s-60s)
   - Add test for minutes (1m-60m)
   - Add test for hours (≥1h)

2. **Artifact section limit tests**
   - Test with many artifacts of same type exceeding limit
   - Verify truncation message appears correctly

3. **Empty layout tests**
   - Verify empty arrays work with each layout: table, list, detailed, summary

4. **Optional field coverage**
   - Test log entries with `stage` and `agent` fields
   - Test artifacts with `path` field
   - Ensure all presence/absence branches covered

### Phase 2: Code Cleanup

1. **Remove unused `escapeMarkdown` function**
   - This function on line 925-927 is dead code
   - Removal achieves instant 100% function coverage

2. **Add ignore comments for unreachable defensive code**
   - Default case in switch (line 438-439)
   - Use `/* c8 ignore next */` for v8 coverage tool

### Phase 3: Verification

1. Run coverage with `--coverage` flag
2. Verify all metrics at 100%
3. Ensure all 51+ tests pass
4. Document any intentional exclusions

## New Test Cases Required

### Test File Additions

```typescript
describe('Duration Formatting Edge Cases', () => {
  it('should format milliseconds for very short durations', () => {
    const task = createTask({
      usage: createTaskUsage({ executionTimeMs: 500 })
    });
    const result = formatTasksToMarkdown([task], { metricsSection: 'inline', layout: 'detailed' });
    expect(result).toContain('500ms');
  });

  it('should format hours for very long durations', () => {
    const task = createTask({
      usage: createTaskUsage({ executionTimeMs: 7200000 }) // 2 hours
    });
    const result = formatTasksToMarkdown([task], { metricsSection: 'separate' });
    expect(result).toContain('2.0h');
  });
});

describe('Artifact Section Truncation', () => {
  it('should show truncation message for artifacts exceeding limit per type', () => {
    const task = createTask({
      artifacts: Array.from({ length: 15 }, (_, i) =>
        createTaskArtifact({ name: `component-${i}.tsx`, type: 'file' })
      )
    });
    const result = formatTasksToMarkdown([task], {
      artifactsSection: 'separate',
      sectionLimit: 5
    });
    expect(result).toContain('... 10 more artifacts');
  });
});

describe('Empty Array Layouts', () => {
  it('should handle empty tasks with list layout', () => {
    const result = formatTasksToMarkdown([], { layout: 'list' });
    expect(result).toContain('*No tasks found.*');
  });

  it('should handle empty tasks with detailed layout', () => {
    const result = formatTasksToMarkdown([], { layout: 'detailed' });
    expect(result).toContain('*No tasks found.*');
  });

  it('should handle empty tasks with summary layout', () => {
    const result = formatTasksToMarkdown([], { layout: 'summary' });
    expect(result).toContain('*No tasks found.*');
  });
});

describe('Log Entry Optional Fields', () => {
  it('should display log stage when present', () => {
    const task = createTask({
      logs: [createTaskLog({ stage: 'implementation', agent: 'coder-agent' })]
    });
    const result = formatTasksToMarkdown([task], { logsSection: 'separate' });
    expect(result).toContain('Stage: implementation');
    expect(result).toContain('Agent: coder-agent');
  });
});

describe('Artifact Path Field', () => {
  it('should display artifact path when present', () => {
    const task = createTask({
      artifacts: [createTaskArtifact({ path: '/src/components/Button.tsx' })]
    });
    const result = formatTasksToMarkdown([task], { artifactsSection: 'separate' });
    expect(result).toContain('Path: `/src/components/Button.tsx`');
  });
});
```

## Code Modifications Required

### 1. Remove Unused escapeMarkdown Function

```typescript
// DELETE lines 922-927:
// /**
//  * Escapes Markdown special characters
//  */
// function escapeMarkdown(text: string): string {
//   return text.replace(/[\\`*_{}[\]()#+\-.!|]/g, '\\$&');
// }
```

### 2. Add Coverage Ignore Comment for Defensive Default

```typescript
// Line 438-439:
    default:
      /* c8 ignore next */
      return generateTasksTable(filteredTasks, options);
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Removing escapeMarkdown breaks future code | Low | Function is unused; add back if needed |
| Test changes cause regressions | Medium | Run full test suite before/after |
| Coverage ignore comments hide bugs | Low | Document why each ignore is justified |

## Success Criteria

1. ✅ All existing 51 tests pass
2. ✅ New tests for uncovered branches pass
3. ✅ Statement coverage: 100%
4. ✅ Branch coverage: 100%
5. ✅ Function coverage: 100%
6. ✅ Line coverage: 100%
7. ✅ `npm run build` succeeds
8. ✅ `npm test` passes

## Architecture Decision

**Decision**: Remove the unused `escapeMarkdown` function rather than artificially testing dead code.

**Rationale**:
- The function is never called anywhere in the codebase
- Three other escape functions serve the actual needs (`escapeLightly`, `escapeTableCell`, `escapeMetadata`)
- Dead code increases maintenance burden
- If the function is needed later, it can be re-added with proper tests

**Consequences**:
- Achieves 100% coverage without artificial tests
- Reduces code complexity
- Follows YAGNI principle (You Aren't Gonna Need It)
