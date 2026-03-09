# ADR: StatusBar Display Modes Implementation Audit

**Status**: Proposed
**Date**: 2025-03-05
**Author**: Architecture Agent
**Context**: Feature workflow - Audit StatusBar display modes (compact/normal/verbose) implementation

## Summary

This ADR documents the technical design for fixing failing tests in the StatusBar display modes implementation. The audit identified **55 total failing tests** across 4 test files that require systematic fixes.

## Problem Statement

The StatusBar component has a well-designed 3-tier display mode system (compact/normal/verbose), but the test files have multiple issues:

1. **Test-implementation misalignment**: Tests expect behaviors that don't match the current implementation
2. **Mock configuration issues**: Some tests use incompatible mock patterns
3. **Missing test utilities**: `@testing-library/jest-dom` matchers not properly configured in some tests
4. **Responsive system conflicts**: Tests don't account for the priority-based segment filtering system

## Test Files Analysis

### 1. StatusBar.compact-mode.test.tsx (13 tests, 6 failing)

| Test | Issue Type | Root Cause |
|------|-----------|------------|
| should show only status icon, git branch, and cost in compact mode | Implementation mismatch | Test expects `cost:` label NOT to be shown, but implementation shows it |
| should show connection status icon correctly in compact mode | Test assertion error | Uses `.toHaveProperty('color')` but DOM elements don't have direct color property |
| should maintain compact layout in narrow terminal | Mock error | Uses `require()` inside test which doesn't work with ES modules |
| should maintain compact layout in wide terminal | Mock error | Same require() issue |
| should show different information than normal mode | Implementation mismatch | Normal mode doesn't show all segments due to width-based filtering |
| should show different information than verbose mode | Implementation mismatch | Same width filtering issue |

### 2. StatusBar.verbose-mode.test.tsx (26 tests, 15 failing)

| Category | Failing Count | Root Cause |
|----------|---------------|------------|
| Detailed Timing Segments | 5 | Timing segments being filtered out by `trimToFit` width algorithm |
| Session Cost Display | 2 | Session cost segment filtered by width constraints |
| All Metrics Without Width Filtering | 5 | Width filtering removes segments despite verbose mode |
| Integration Tests | 3 | Preview/Thoughts indicators filtered out |

### 3. StatusBar.display-modes.test.tsx (18 tests, 8 failing)

| Category | Failing Count | Root Cause |
|----------|---------------|------------|
| Normal Mode Tests | 2 | Expects `▶` workflow stage icon but implementation uses different icon or filtering |
| Compact Mode Tests | 2 | Mocking issues with `require('ink').useStdout` |
| Verbose Mode Tests | 2 | Expects all segments visible but width filtering removes them |
| Edge Cases | 2 | Mock configuration issues |

### 4. StatusBar.displayMode.test.tsx (27 tests, 26 failing)

**Critical Issue**: This file uses a **MockStatusBar** component instead of testing the actual StatusBar, AND it's missing `@testing-library/jest-dom` setup:
- Uses `toHaveAttribute`, `toHaveTextContent`, `toBeInTheDocument` without importing jest-dom
- The file imports from `@testing-library/react` directly, not from the custom test-utils

## Technical Design

### Architecture Analysis

The StatusBar uses a 4-step segment processing pipeline:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     StatusBar Segment Pipeline                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. createSegmentConfigs() ──► All segments with priority/side      │
│              ↓                                                       │
│  2. filterByDisplayMode() ──► compact/normal/verbose filtering      │
│              ↓                                                       │
│  3. filterByTier() ──► narrow/normal/wide responsive filtering      │
│              │         (SKIPPED for verbose mode)                    │
│              ↓                                                       │
│  4. trimToFit() ──► Width-based removal of low-priority segments    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Issue**: Step 4 (`trimToFit`) runs for ALL display modes, including verbose mode. This contradicts the verbose mode design intent: "Always shows all segments (overrides responsive)".

### Priority System

```
Priority    │ Numeric │ Segments
────────────┼─────────┼─────────────────────────────────────────
CRITICAL    │    1    │ connection, sessionTimer
HIGH        │    2    │ gitBranch, agent, cost, model
MEDIUM      │    3    │ workflowStage, tokens, subtaskProgress,
            │         │ activeTime, idleTime, stageTime
LOW         │    4    │ sessionName, apiUrl, webUrl, previewMode,
            │         │ showThoughts, verboseMode, sessionCost
```

### Display Mode Filtering

```typescript
// Compact mode: connection + gitBranch + cost only
compact: ['connection', 'gitBranch', 'cost']

// Normal mode: Everything except verbose-only segments
normal: excludes ['activeTime', 'idleTime', 'stageTime',
                   'tokensBreakdown', 'tokensTotal', 'sessionCost']

// Verbose mode: All segments
verbose: all segments
```

## Proposed Fixes

### Fix Category 1: StatusBar Implementation Fix

**Issue**: `trimToFit()` removes segments even in verbose mode

**Code Location**: `buildSegments()` function (lines 253-275)

The current code correctly skips tier filtering for verbose mode:
```typescript
// Line 266-268 - This is CORRECT
const tierFiltered = (props.displayMode === 'verbose')
  ? modeFiltered
  : filterByTier(modeFiltered, displayTier);
```

But then unconditionally runs trimToFit:
```typescript
// Line 274 - This is the BUG
return trimToFit(formatted, terminalWidth);
```

**Fix**: Add verbose mode bypass in the `buildSegments()` function:

```typescript
// 5. Final width-based trimming (fallback safety) - SKIP for verbose mode
if (props.displayMode === 'verbose') {
  return formatted;
}
return trimToFit(formatted, terminalWidth);
```

Alternative approach (pass displayMode to trimToFit):
```typescript
function trimToFit(
  segments: { left: Segment[]; right: Segment[] },
  terminalWidth: number,
  displayMode?: 'normal' | 'compact' | 'verbose' // Add parameter
): { left: Segment[]; right: Segment[] } {
  // In verbose mode, don't trim - show everything
  if (displayMode === 'verbose') {
    return segments;
  }
  // ... rest of existing logic
}
```

**Recommendation**: Use the inline check in `buildSegments()` for consistency with the existing tier filtering bypass pattern.

### Fix Category 2: Test Utility Configuration

**File**: StatusBar.displayMode.test.tsx
**Issue**: Missing jest-dom matchers
**Fix**: Change import from `@testing-library/react` to custom test-utils

```typescript
// Before
import { render, screen } from '@testing-library/react';

// After
import { render, screen } from '../../__tests__/test-utils';
```

### Fix Category 3: Mock Pattern Fixes

**Issue**: Using `require()` inside tests doesn't work with ES modules
**Fix**: Use proper Vitest mock patterns

```typescript
// Before (fails)
const useStdoutDimensionsMock = vi.mocked(require('../../hooks/useStdoutDimensions').useStdoutDimensions);

// After (works)
import { useStdoutDimensions } from '../../hooks/useStdoutDimensions';
// Then in test:
vi.mocked(useStdoutDimensions).mockReturnValue({...});
```

### Fix Category 4: Test Expectations Alignment

Several tests need expectations aligned with actual implementation behavior:

1. **Compact mode shows `cost:` label** - Implementation includes label, tests should expect it
2. **Color assertions** - Use `toHaveStyle` or check class names, not `.toHaveProperty('color')`
3. **Normal mode filtering** - Tests should account for width-based filtering at 120px default width

### Fix Category 5: MockStatusBar Test Replacement

**File**: StatusBar.displayMode.test.tsx
**Decision**: This file tests a MockStatusBar, not the real implementation. Options:
1. Delete the file (redundant with other tests)
2. Convert to test actual StatusBar component
3. Fix jest-dom imports and keep as unit tests for display mode logic

**Recommendation**: Option 2 - Convert to test actual StatusBar, ensuring we have coverage for the real implementation.

## Implementation Plan

### Phase 1: Implementation Fixes (StatusBar.tsx)

1. Pass `displayMode` to `trimToFit()` function
2. Add verbose mode bypass in `trimToFit()`
3. Ensure all segments remain visible in verbose mode

### Phase 2: Test Utility Fixes (StatusBar.displayMode.test.tsx)

1. Fix import to use custom test-utils with jest-dom
2. Either convert to test real StatusBar OR delete redundant file

### Phase 3: Mock Pattern Fixes (All test files)

1. Fix require() patterns to use proper ES module mocks
2. Ensure vi.mock() is at top level with factory function

### Phase 4: Test Expectation Alignment

1. Update compact mode tests to expect `cost:` label
2. Fix color assertions to use proper DOM testing patterns
3. Update normal mode tests to account for width filtering

## Segment Visibility Matrix (Expected After Fixes)

| Segment | Compact | Normal (120px) | Verbose |
|---------|---------|----------------|---------|
| connection | ✓ | ✓ | ✓ |
| gitBranch | ✓ | ✓ | ✓ |
| agent | ✗ | ✓ | ✓ |
| workflowStage | ✗ | ✓ | ✓ |
| subtaskProgress | ✗ | ✓ | ✓ |
| sessionName | ✗ | ✓ (wide only) | ✓ |
| apiUrl | ✗ | ✓ (wide only) | ✓ |
| webUrl | ✗ | ✓ (wide only) | ✓ |
| sessionTimer | ✗ | ✓ | ✓ |
| tokens | ✗ | ✓ | ✓ (breakdown) |
| cost | ✓ | ✓ | ✓ |
| model | ✗ | ✓ | ✓ |
| previewMode | ✗ | ✓ (wide only) | ✓ |
| showThoughts | ✗ | ✓ (wide only) | ✓ |
| verboseMode | ✗ | ✗ | ✓ |
| activeTime | ✗ | ✗ | ✓ |
| idleTime | ✗ | ✗ | ✓ |
| stageTime | ✗ | ✗ | ✓ |
| sessionCost | ✗ | ✗ | ✓ |

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing StatusBar behavior | High | Run full test suite after changes |
| Mock changes affecting other tests | Medium | Test files are isolated |
| Verbose mode showing too much | Low | Width constraints still apply to layout |

## Decision

Proceed with implementation in this order:
1. Fix StatusBar.tsx `trimToFit()` to respect verbose mode
2. Fix test utilities/imports in StatusBar.displayMode.test.tsx
3. Fix mock patterns in remaining test files
4. Align test expectations with implementation behavior

## Files to Modify

### Implementation
- `/packages/cli/src/ui/components/StatusBar.tsx` - Add verbose mode bypass in trimToFit

### Tests
- `/packages/cli/src/ui/components/__tests__/StatusBar.compact-mode.test.tsx`
- `/packages/cli/src/ui/components/__tests__/StatusBar.verbose-mode.test.tsx`
- `/packages/cli/src/ui/components/__tests__/StatusBar.display-modes.test.tsx`
- `/packages/cli/src/ui/components/__tests__/StatusBar.displayMode.test.tsx`

## Acceptance Criteria Verification

Per the task requirements:
- [ ] All 3 display modes work correctly with proper segment visibility
- [ ] StatusBar.compact-mode.test.tsx - All 13 tests pass
- [ ] StatusBar.verbose-mode.test.tsx - All 26 tests pass
- [ ] StatusBar.display-modes.test.tsx - All 18 tests pass
- [ ] StatusBar.displayMode.test.tsx - All 27 tests pass (or file converted/removed)
- [ ] Documentation of any gaps

## Gaps Identified

1. **No width overflow handling in verbose mode**: When terminal is very narrow, verbose mode may overflow
2. **Missing test for responsive breakpoint transitions**: Tests don't cover switching between breakpoints
3. **Session timer not in compact mode**: By design, but might be useful to show elapsed time
4. **Token label inconsistency**: Uses both `tokens:` and `tk:` abbreviation depending on tier

---

**Next Steps**: Implement the fixes in the developer stage following this technical design.
