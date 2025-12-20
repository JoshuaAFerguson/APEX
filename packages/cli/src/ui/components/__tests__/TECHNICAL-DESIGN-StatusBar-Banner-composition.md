# Technical Design: StatusBar + Banner Responsive Composition Integration Tests

## Overview

This document describes the technical design for integration tests that verify the **StatusBar** and **Banner** components render correctly when composed together at various terminal widths (40, 60, 80, 120, 160 columns).

## Problem Statement

While individual responsive tests exist for both StatusBar and Banner components, there is a **gap in integration testing** for verifying their **composed behavior**. When both components render together in a terminal session, they must:

1. Not overflow or cause visual artifacts at any terminal width
2. Maintain proper segment visibility according to their respective breakpoint systems
3. Avoid text truncation when their combined height is displayed
4. Gracefully adapt as terminal width changes

## Architecture Decision

### ADR: Integration Test Strategy for StatusBar + Banner Composition

**Context**: StatusBar and Banner are two key UI components that always appear together at the top of the APEX CLI interface. Each has its own responsive breakpoint system, but they share the same terminal width from `useStdoutDimensions`.

**Decision**: Create dedicated integration tests that render both components in a composition wrapper and verify correct behavior at all acceptance criteria widths.

**Consequences**:
- Ensures visual consistency across terminal sizes
- Validates that breakpoint systems don't conflict
- Catches regressions in composed rendering scenarios

## Test File Structure

```
packages/cli/src/ui/components/__tests__/
  StatusBar-Banner.composition.test.tsx  # New integration test file
```

## Test Architecture

### 1. Mock Strategy

Both components use `useStdoutDimensions` hook. The tests will mock this hook at the module level to control terminal dimensions:

```typescript
// Mock pattern matching existing tests
const mockUseStdoutDimensions = vi.fn();

vi.mock('../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));
```

### 2. Composition Wrapper Component

Create a test wrapper that mimics the actual App layout:

```typescript
interface ComposedLayoutProps {
  statusBarProps: StatusBarProps;
  bannerProps: BannerProps;
}

const ComposedLayout: React.FC<ComposedLayoutProps> = ({
  statusBarProps,
  bannerProps,
}) => (
  <Box flexDirection="column">
    <Banner {...bannerProps} />
    <StatusBar {...statusBarProps} />
  </Box>
);
```

### 3. Test Width Matrix

Based on acceptance criteria, test at these specific widths:

| Width | Banner Mode | StatusBar Tier | Expected Behavior |
|-------|-------------|----------------|-------------------|
| 40    | compact (text box) | narrow | Minimal segments, abbreviated labels |
| 60    | full (ASCII art) | normal | Medium priority segments, full labels |
| 80    | full (ASCII art) | normal | Medium priority segments, full labels |
| 120   | full (ASCII art) | normal | All except low priority |
| 160   | full (ASCII art) | wide | All segments visible |

### 4. Hook Mock Configuration

Helper function to generate mock return values:

```typescript
function createDimensionsMock(width: number): StdoutDimensions {
  return {
    width,
    height: 24,
    breakpoint: width < 60 ? 'narrow' : width < 100 ? 'compact' : width < 160 ? 'normal' : 'wide',
    isAvailable: true,
    isNarrow: width < 60,
    isCompact: width >= 60 && width < 100,
    isNormal: width >= 100 && width < 160,
    isWide: width >= 160,
  };
}
```

## Test Cases

### Test Suite 1: Composed Rendering at All Breakpoints

```typescript
describe('StatusBar + Banner Composition at All Terminal Widths', () => {
  const testWidths = [40, 60, 80, 120, 160];

  testWidths.forEach(width => {
    describe(`at ${width} columns`, () => {
      it('renders without overflow');
      it('shows proper segment visibility');
      it('has no text truncation for visible elements');
    });
  });
});
```

### Test Suite 2: No Overflow Verification

For each width, verify:
1. Banner fits within width constraints
2. StatusBar Box uses `width={terminalWidth}` correctly
3. Combined height doesn't cause layout issues

```typescript
it('renders without overflow at ${width} columns', () => {
  mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(width));

  const { container } = render(
    <ComposedLayout
      bannerProps={defaultBannerProps}
      statusBarProps={defaultStatusBarProps}
    />
  );

  // Verify StatusBar Box uses correct width
  const statusBarBox = container.querySelector('[borderStyle="single"]');
  expect(statusBarBox).toHaveAttribute('width', width.toString());

  // Verify no overflow indicators
  expect(container).not.toContainHTML('...'); // Unless expected truncation
});
```

### Test Suite 3: Segment Visibility by Breakpoint

| Width | StatusBar Segments Expected | Banner Elements Expected |
|-------|----------------------------|--------------------------|
| 40    | connection, timer, branch, cost, model | compact box, version, status |
| 60    | + workflow stage, tokens, subtask | full ASCII art, tagline |
| 80    | same as 60 | same as 60 |
| 120   | same as 60 (121+ shows low priority) | same as 60 |
| 160   | + session name, API/web URLs | same as 60 |

### Test Suite 4: Text Truncation Verification

Verify text is NOT truncated unexpectedly:

```typescript
it('does not truncate visible text at ${width} columns', () => {
  mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(width));

  render(
    <ComposedLayout
      bannerProps={{ version: '0.1.0', initialized: true, projectPath: '/short/path' }}
      statusBarProps={defaultStatusBarProps}
    />
  );

  // Version should be complete
  expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument();

  // Short path should not be truncated
  if (width >= 60) {
    expect(screen.getByText('/short/path')).toBeInTheDocument();
  }
});
```

### Test Suite 5: Terminal Resize Simulation

```typescript
it('adapts both components when terminal resizes', () => {
  // Start at 80
  mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(80));
  const { rerender } = render(<ComposedLayout {...props} />);

  // Verify normal tier behavior
  expect(screen.getByText('implementation')).toBeInTheDocument();
  expect(screen.getByText(/█████╗/)).toBeInTheDocument();

  // Resize to 40
  mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(40));
  rerender(<ComposedLayout {...props} />);

  // Verify narrow tier behavior
  expect(screen.queryByText('implementation')).not.toBeInTheDocument();
  expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();
  expect(screen.getByText('│   ◆ APEX ◆     │')).toBeInTheDocument();
});
```

### Test Suite 6: Display Mode Interactions

Test that display modes (compact, normal, verbose) work correctly with composed layout:

```typescript
describe('Display mode interactions in composition', () => {
  it('verbose mode shows all StatusBar segments at narrow width', () => {
    mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(40));

    render(
      <ComposedLayout
        bannerProps={defaultBannerProps}
        statusBarProps={{ ...defaultStatusBarProps, displayMode: 'verbose' }}
      />
    );

    // Banner should still be compact
    expect(screen.getByText('│   ◆ APEX ◆     │')).toBeInTheDocument();

    // StatusBar should show all segments despite narrow width
    expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
  });
});
```

## Implementation Approach

### Phase 1: Test Infrastructure (developer stage)
1. Create test file with mock setup
2. Create ComposedLayout wrapper component
3. Create dimension mock helpers
4. Setup beforeEach/afterEach hooks

### Phase 2: Core Test Implementation (developer stage)
1. Implement all width breakpoint tests (40, 60, 80, 120, 160)
2. Implement overflow verification tests
3. Implement segment visibility tests
4. Implement text truncation tests

### Phase 3: Advanced Tests (developer stage)
1. Implement terminal resize simulation tests
2. Implement display mode interaction tests
3. Implement edge case tests (very narrow, very wide)

## File Dependencies

```
StatusBar-Banner.composition.test.tsx
├── imports from
│   ├── '../StatusBar' (StatusBar, StatusBarProps)
│   ├── '../Banner' (Banner, BannerProps)
│   ├── '../../hooks/useStdoutDimensions' (StdoutDimensions type, mocked via vi.mock)
│   ├── '../../__tests__/test-utils' (render, screen) [follows existing pattern]
│   ├── 'vitest' (describe, it, expect, vi, beforeEach, afterEach)
│   └── 'ink' (Box)
```

**Import Path Notes**:
- Existing tests in `components/__tests__/` use `'../../__tests__/test-utils'`
- The canonical test-utils is at `packages/cli/src/__tests__/test-utils.tsx`
- **Follow existing pattern** for consistency with other tests in the same directory
- The existing tests (StatusBar.responsive.test.tsx, Banner.test.tsx) all use `'../../__tests__/test-utils'`

## Expected Test Output Structure

```
StatusBar + Banner Responsive Composition
  ✓ renders both components at 40 columns
    ✓ without overflow
    ✓ with proper segment visibility (narrow tier + compact banner)
    ✓ without unexpected text truncation
  ✓ renders both components at 60 columns
    ✓ without overflow
    ✓ with proper segment visibility (normal tier + full banner)
    ✓ without unexpected text truncation
  ✓ renders both components at 80 columns
    ...
  ✓ renders both components at 120 columns
    ...
  ✓ renders both components at 160 columns
    ...
  Terminal Resize Behavior
    ✓ adapts both components when resizing from 80 to 40
    ✓ adapts both components when resizing from 40 to 160
  Display Mode Interactions
    ✓ verbose StatusBar + narrow Banner composition works
    ✓ compact StatusBar at wide terminal works
```

## Acceptance Criteria Mapping

| Acceptance Criteria | Test Coverage |
|---------------------|---------------|
| StatusBar + Banner render without overflow at 40/60/80/120/160 cols | Test Suite 1, 2 |
| Proper segment visibility at each breakpoint | Test Suite 3 |
| No text truncation when composed together | Test Suite 4 |

## Notes for Developer Stage

1. **Use existing test patterns** from `StatusBar.responsive.test.tsx` and `Banner.responsive.test.tsx`
2. **Follow mock structure** from `responsive-integration.test.tsx`
3. **Leverage test-utils.tsx** for render wrapper
4. **Keep tests focused** on composition behavior, not individual component internals
5. **Document any discovered edge cases** for future reference

## Breakpoint Reference

### Banner Breakpoints (from Banner.tsx)
```typescript
const BANNER_BREAKPOINTS = {
  FULL_ART_MIN: 60,      // Show full ASCII art (>= 60)
  COMPACT_MIN: 40,       // Show compact text box (40-59)
  // < 40: Text-only mode
};
```

### StatusBar Breakpoints (from StatusBar.tsx)
```typescript
// DisplayTier based on width:
// - narrow: < 60 cols (shows CRITICAL + HIGH priority only)
// - normal: 60-160 cols (shows CRITICAL + HIGH + MEDIUM)
// - wide: > 160 cols (shows all priorities including LOW)
```

### useStdoutDimensions Breakpoints (from useStdoutDimensions.ts)
```typescript
const DEFAULT_BREAKPOINTS = {
  narrow: 60,    // < 60 = narrow
  compact: 100,  // >= 60 and < 100 = compact
  normal: 160,   // >= 100 and < 160 = normal
  // >= 160 = wide
};
```

## Test Props Reference

### Default StatusBar Props
```typescript
const defaultStatusBarProps: StatusBarProps = {
  isConnected: true,
  gitBranch: 'main',
  agent: 'developer',
  workflowStage: 'implementation',
  tokens: { input: 1000, output: 500 },
  cost: 0.0234,
  sessionCost: 0.1234,
  model: 'opus',
  apiUrl: 'http://localhost:4000',
  webUrl: 'http://localhost:3000',
  sessionName: 'Test Session',
  subtaskProgress: { completed: 2, total: 5 },
};
```

### Default Banner Props
```typescript
const defaultBannerProps: BannerProps = {
  version: '0.3.0',
  projectPath: '/home/user/project',
  initialized: true,
};
```

## Critical Test Verifications

For each width, verify these key behaviors:

### 40 Columns (Narrow)
- **Banner**: Shows compact box `│   ◆ APEX ◆     │`, version, truncated path
- **StatusBar**: Shows connection `●`, timer, branch (truncated if long), cost, model with `m:` label
- **Hidden**: workflow stage, tokens, subtask progress, session name, URLs

### 60 Columns (Compact/Normal boundary)
- **Banner**: Shows full ASCII art `█████╗`, full tagline, full path
- **StatusBar**: Shows all high + medium priority (workflow stage, tokens, subtask progress)
- **Hidden**: session name, URLs (low priority)

### 80 Columns (Normal)
- Same as 60 columns, more comfortable layout

### 120 Columns (Normal)
- Same as 80 columns
- Note: 121+ triggers session name visibility per StatusBar.responsive.test.tsx

### 160 Columns (Wide)
- **Banner**: Same as 60 (full mode)
- **StatusBar**: All segments including session name, API/web URLs

## Edge Cases to Test

1. **Very long git branch**: Should truncate in narrow, show full in wide
2. **Very long project path**: Should truncate appropriately for width
3. **Missing optional props**: Both components should handle gracefully
4. **Terminal resize mid-render**: Rerender should update both components correctly
5. **Conflicting display modes**: verbose StatusBar + narrow terminal = Banner still compact
