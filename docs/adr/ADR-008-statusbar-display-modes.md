# ADR-008: StatusBar Display Modes Implementation

## Status
**Proposed** - Pending Implementation

## Date
2024-03-05

## Context

The StatusBar component implements three display modes (compact, normal, verbose) with a responsive breakpoint-based adaptation system. An audit of the 4 test files revealed systematic test failures stemming from architectural mismatches between test expectations and actual component behavior.

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     StatusBar Component                          │
├─────────────────────────────────────────────────────────────────┤
│  Props → buildSegments() → filterByDisplayMode() →               │
│          filterByTier() → applyAbbreviations() → trimToFit()     │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         compact          normal          verbose
    (connection,      (responsive       (all segments
     gitBranch,        filtering)       without tier
     cost only)                          filtering)
```

### Test Files Under Audit

1. **StatusBar.compact-mode.test.tsx** - 6 failures / 13 tests
2. **StatusBar.verbose-mode.test.tsx** - 15 failures / 26 tests
3. **StatusBar.display-modes.test.tsx** - 8 failures / 18 tests
4. **StatusBar.displayMode.test.tsx** - 26 failures / 27 tests (uses MockStatusBar, not actual component)

### Root Causes Identified

#### 1. `trimToFit` Priority-Based Removal

The `trimToFit` function removes low-priority segments when content exceeds terminal width. This causes tests to fail because:
- Tests expect certain segments to always be visible
- The function removes segments based on priority even when tests mock specific widths
- "medium" priority segments (workflowStage, tokens, subtaskProgress) get removed before "high" priority ones

**Affected Tests:**
- "should show all available information in normal mode"
- "should show all segments in narrow terminal width"
- "verbose mode shows all info regardless of width"

#### 2. Mock Test File (displayMode.test.tsx)

The `StatusBar.displayMode.test.tsx` file tests a **MockStatusBar** component, not the actual StatusBar. This means:
- 26/27 tests fail because they test mock behavior
- The mock has different segment visibility logic than actual component
- Tests use `data-testid` selectors that don't exist in real component

#### 3. Display Mode Filter Logic

Current `filterByDisplayMode()`:
```typescript
if (displayMode === 'compact') {
  return segments.filter(s =>
    s.id === 'connection' ||
    s.id === 'gitBranch' ||
    s.id === 'cost'
  );
}
```

**Issues:**
- Timer is NOT included in compact mode (tests expect it sometimes)
- Verbose mode bypasses tier filtering but NOT trimToFit
- Tests expect verbose mode to show ALL segments, but trimToFit still removes them

#### 4. Timing Mock Issues

Tests using fake timers show incorrect timer display:
- Observed output: `-1144142:-19` instead of expected `02:00`
- Session timer calculation uses `Date.now()` which conflicts with `vi.useFakeTimers()`

#### 5. useStdoutDimensions Mock Inconsistency

Tests mock the hook differently:
- Some use `vi.mock('../../hooks/useStdoutDimensions')`
- Some use `vi.mocked(require(...))` pattern
- Width values don't propagate correctly to component internals

## Decision

### Architecture Fix: Segment Visibility Matrix

Implement a clear segment visibility matrix that respects display modes:

```typescript
const SEGMENT_VISIBILITY: Record<string, {
  compact: boolean;
  normal: SegmentPriority[];  // Visible at these priorities
  verbose: boolean;           // Always visible in verbose
}> = {
  connection: { compact: true, normal: ['critical'], verbose: true },
  gitBranch: { compact: true, normal: ['high'], verbose: true },
  agent: { compact: false, normal: ['high'], verbose: true },
  workflowStage: { compact: false, normal: ['medium'], verbose: true },
  subtaskProgress: { compact: false, normal: ['medium'], verbose: true },
  sessionName: { compact: false, normal: ['low'], verbose: true },
  sessionTimer: { compact: false, normal: ['critical'], verbose: true },
  tokens: { compact: false, normal: ['medium'], verbose: true },
  cost: { compact: true, normal: ['high'], verbose: true },
  model: { compact: false, normal: ['high'], verbose: true },
  // ... etc
};
```

### Test Architecture Fixes

#### Fix 1: Verbose Mode Should Skip trimToFit

```typescript
// In buildSegments
if (props.displayMode === 'verbose') {
  // Skip trimToFit entirely for verbose mode
  return applyAbbreviations(modeFiltered, displayTier);
}
return trimToFit(formatted, terminalWidth);
```

#### Fix 2: Update displayMode.test.tsx to Test Real Component

Replace MockStatusBar with actual StatusBar component testing. The mock-based tests should be either:
- Converted to test the real StatusBar component
- Moved to a dedicated "mock" test file for component design documentation
- Deleted if redundant with other test files

#### Fix 3: Timer Mock Consistency

```typescript
beforeEach(() => {
  vi.useFakeTimers();
  const baseTime = new Date('2024-01-01T10:00:00Z');
  vi.setSystemTime(baseTime);
});

// Ensure sessionStartTime is calculated relative to mocked time
const fullProps = {
  sessionStartTime: new Date(Date.now() - 120000), // 2 min before mocked time
};
```

#### Fix 4: Standardize Hook Mocking

Create a test helper:
```typescript
// In test-utils.ts
export function mockTerminalWidth(width: number, breakpoint: 'narrow' | 'normal' | 'wide') {
  vi.mocked(useStdoutDimensions).mockReturnValue({
    width,
    height: 30,
    breakpoint,
    isAvailable: true,
  });
}
```

### Interface Contracts

#### Display Mode Contract

| Mode | Connection | Branch | Agent | Stage | Timer | Tokens | Cost | Model | URLs | Session |
|------|------------|--------|-------|-------|-------|--------|------|-------|------|---------|
| compact | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| normal | ✓ | ✓* | ✓* | ✓* | ✓ | ✓* | ✓* | ✓* | ✗* | ✗* |
| verbose | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

*Subject to terminal width constraints (tier-based filtering)

#### Breakpoint Tiers

| Tier | Width | Priorities Shown |
|------|-------|-----------------|
| narrow | <60 | critical, high |
| normal | 60-160 | critical, high, medium |
| wide | >160 | critical, high, medium, low |

## Consequences

### Positive
- Clear, documented segment visibility behavior
- Consistent test expectations matching component behavior
- Verbose mode guaranteed to show all segments
- Reduced test maintenance burden

### Negative
- Breaking change if users rely on current trimToFit behavior in verbose mode
- Need to update/fix all 4 test files plus related tests
- displayMode.test.tsx requires significant rewrite

### Risks
- Timer precision issues with fake timers need careful handling
- Hook mocking patterns need standardization across test suite

## Implementation Plan

### Phase 1: Component Fixes
1. Add `displayMode === 'verbose'` check before `trimToFit()` call
2. Update segment visibility to match documented contract
3. Fix timer calculation to be mock-friendly

### Phase 2: Test Infrastructure
1. Create standardized hook mocking utilities
2. Update test-utils with helper functions
3. Fix timer-related test setup

### Phase 3: Test File Fixes
1. **StatusBar.compact-mode.test.tsx**: Update expectations for actual behavior
2. **StatusBar.verbose-mode.test.tsx**: Add trimToFit bypass verification
3. **StatusBar.display-modes.test.tsx**: Align with visibility matrix
4. **StatusBar.displayMode.test.tsx**: Rewrite to test real component

### Phase 4: Documentation
1. Update component JSDoc with visibility matrix
2. Document testing patterns for StatusBar
3. Create segment priority reference

## Gap Analysis Summary

### Test Result Totals (as of audit)

| Test File | Passed | Failed | Total |
|-----------|--------|--------|-------|
| StatusBar.compact-mode.test.tsx | 7 | 6 | 13 |
| StatusBar.verbose-mode.test.tsx | 11 | 15 | 26 |
| StatusBar.display-modes.test.tsx | 10 | 8 | 18 |
| StatusBar.displayMode.test.tsx | 1 | 26 | 27 |
| **Total** | **29** | **55** | **84** |

### Categorized Gap Analysis

#### Category 1: Mock Architecture Issues (26 tests - displayMode.test.tsx)
- Uses `MockStatusBar` instead of actual `StatusBar` component
- Missing `@testing-library/jest-dom` imports causing Chai assertion errors
- `data-testid` selectors don't exist in real component
- **Fix**: Rewrite tests to use actual component OR remove redundant file

#### Category 2: trimToFit Behavior Mismatch (15 tests)
- Tests expect all segments visible in verbose mode
- `trimToFit()` still removes segments based on priority
- Observable behavior: medium-priority segments (workflowStage, tokens) disappear
- **Fix**: Skip `trimToFit()` for verbose mode

#### Category 3: Hook Mocking Inconsistency (8 tests)
- `require()` pattern fails: "Cannot find module '../../hooks/useStdoutDimensions'"
- `vi.mock()` at file level works, but `vi.mocked(require(...))` in test body fails
- Width changes don't propagate to component internals
- **Fix**: Standardize to file-level `vi.mock()` with per-test `mockReturnValue()`

#### Category 4: Floating Point Precision (1 test)
- Cost comparison `0.1 + 0.2 !== 0.3` causes session cost to appear
- Test expects session cost hidden when "same" as regular cost
- **Fix**: Use epsilon-based comparison or round before comparison

#### Category 5: Test-Utils Path Issues (imports)
- Multiple path patterns: `../../__tests__/test-utils`, `../../../__tests__/test-utils`
- Missing `@testing-library/jest-dom` setup in some test contexts
- **Fix**: Standardize import paths and ensure jest-dom matchers available

### Files Requiring Updates

1. **StatusBar.tsx** - Add verbose mode trimToFit bypass
2. **test-utils.ts** - Add hook mocking helpers
3. **StatusBar.compact-mode.test.tsx** - Fix mock patterns
4. **StatusBar.verbose-mode.test.tsx** - Fix mock patterns, add trimToFit bypass tests
5. **StatusBar.display-modes.test.tsx** - Fix mock patterns
6. **StatusBar.displayMode.test.tsx** - Major rewrite or deletion

## References

- [StatusBar Component](../../packages/cli/src/ui/components/StatusBar.tsx)
- [useStdoutDimensions Hook](../../packages/cli/src/ui/hooks/useStdoutDimensions.ts)
- [Vitest Fake Timers](https://vitest.dev/api/vi.html#vi-usefaketimers)
- [Testing Library Jest-DOM](https://github.com/testing-library/jest-dom)
