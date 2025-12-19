# ADR: Integration Tests for Progress and Error Components Responsive Composition

## Status
Proposed

## Context

The APEX CLI includes several critical UI components for displaying progress, errors, and activity logs:
- **ProgressIndicators.tsx**: `ProgressBar`, `CircularProgress`, `SpinnerWithText`, `LoadingSpinner`, `StepProgress`, `TaskProgress`, `MultiTaskProgress`
- **ErrorDisplay.tsx**: `ErrorDisplay`, `ErrorSummary`, `ValidationError`
- **ActivityLog.tsx**: `ActivityLog`, `LogStream`, `CompactLog`

These components use the `useStdoutDimensions` hook for responsive behavior across different terminal widths. The acceptance criteria require tests that verify:
1. Progress bars, error displays, and activity logs render without overflow at all terminal widths
2. Stack traces are handled properly in narrow mode

### Current State Analysis

**Existing Tests:**
- `ProgressIndicators.test.tsx` - Basic functionality tests
- `ProgressIndicators.container-integration.test.tsx` - Container-level responsive tests
- `ProgressIndicators.responsive-edge-cases.test.tsx` - Edge case handling
- `ErrorDisplay.test.tsx` - Basic error display tests
- `ErrorDisplay.enhanced-responsive.test.tsx` - Width adaptation tests
- `ErrorDisplay.stack-trace-coverage.test.tsx` - Stack trace responsive matrix
- `ActivityLog.test.tsx` - Basic activity log tests
- `ActivityLog.displayMode-integration.test.tsx` - Display mode interactions
- `ActivityLog.responsive-width.test.tsx` - Width adaptation tests

**Gap Analysis:**
The existing tests cover individual components well but lack:
1. **Comprehensive composition integration tests** - Testing multiple progress/error/activity components together
2. **Overflow verification across all breakpoints** - Systematic testing of no-overflow behavior at 40, 60, 80, 120, 180 column widths
3. **Stack trace handling in narrow mode** - Ensuring stack traces don't cause overflow in constrained terminals
4. **Cross-component consistency** - Verifying consistent responsive behavior when components are combined

### Terminal Width Breakpoints

Based on `useStdoutDimensions.ts`:
- **narrow**: < 60 columns
- **compact**: 60-99 columns
- **normal**: 100-159 columns
- **wide**: >= 160 columns

Standard test widths: 40, 60, 80, 120, 180 columns

## Decision

Create a new comprehensive integration test file: `progress-error-activity.responsive-composition.integration.test.tsx`

### Test Architecture

```typescript
// Test file structure
├── Foundation Utilities
│   ├── TERMINAL_CONFIGS - Standard terminal configurations
│   ├── mockTerminalWidth() - Helper to set terminal dimensions
│   ├── expectNoOverflow() - Assert no text overflow
│   └── renderResponsive() - Enhanced render with width helpers
│
├── ProgressIndicators Responsive Composition
│   ├── ProgressBar overflow verification (all breakpoints)
│   ├── TaskProgress container composition
│   ├── MultiTaskProgress responsive layout
│   └── StepProgress horizontal/vertical adaptation
│
├── ErrorDisplay Responsive Composition
│   ├── ErrorDisplay overflow verification (all breakpoints)
│   ├── Stack trace narrow mode handling
│   ├── ErrorSummary responsive truncation
│   └── ValidationError width adaptation
│
├── ActivityLog Responsive Composition
│   ├── ActivityLog overflow verification (all breakpoints)
│   ├── LogStream responsive streaming
│   └── CompactLog minimal display
│
└── Cross-Component Composition
    ├── Combined progress + error displays
    ├── Progress + activity log integration
    ├── Error + activity log integration
    └── Full stack composition scenarios
```

### Test Categories

#### 1. Overflow Verification Tests
- Test each component at all 5 standard widths (40, 60, 80, 120, 180)
- Use `expectNoOverflow()` helper to verify text content fits within terminal width
- Ensure all lines in rendered output are <= terminal width

#### 2. Stack Trace Handling Tests
Matrix testing for stack traces based on `getStackTraceConfig()`:
| Breakpoint | Width | Verbose=false | Verbose=true |
|------------|-------|---------------|--------------|
| narrow     | <60   | 0 lines       | 3 lines      |
| compact    | 60-99 | 0 lines       | 5 lines      |
| normal     | 100-159| 5 lines      | 10 lines     |
| wide       | >=160 | 8 lines       | Infinity     |

Verify:
- Stack lines are truncated to fit within `width - 4` (account for indentation)
- "more lines" message appears when stack is truncated
- No horizontal overflow in any scenario

#### 3. Component Composition Tests
Test realistic combinations:
- `TaskProgress` containing `ProgressBar` + `LoadingSpinner`
- `MultiTaskProgress` with multiple task entries
- `ErrorDisplay` with suggestions + stack trace + context
- `ActivityLog` with various entry types and display modes

#### 4. Responsive Transition Tests
Verify smooth behavior when terminal resizes:
- Wide → narrow transition
- Narrow → wide transition
- Verify no layout breaking during transitions

### Key Implementation Details

#### Mock Setup Pattern
```typescript
const mockUseStdoutDimensions = vi.fn();
vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: () => mockUseStdoutDimensions(),
}));

// Standard configurations
const TERMINAL_CONFIGS: Record<TerminalWidth, StdoutDimensions> = {
  40: { width: 40, height: 24, breakpoint: 'narrow', isNarrow: true, ... },
  60: { width: 60, height: 24, breakpoint: 'compact', isCompact: true, ... },
  80: { width: 80, height: 24, breakpoint: 'compact', isCompact: true, ... },
  120: { width: 120, height: 30, breakpoint: 'normal', isNormal: true, ... },
  180: { width: 180, height: 40, breakpoint: 'wide', isWide: true, ... },
};
```

#### Overflow Assertion Helper
```typescript
function expectNoOverflow(element: HTMLElement, maxWidth: number): void {
  const textContent = element.textContent || '';
  const lines = textContent.split('\n');

  lines.forEach((line, index) => {
    if (line.length > maxWidth) {
      throw new Error(
        `Line ${index + 1} exceeds max width of ${maxWidth}. ` +
        `Actual: ${line.length}. Content: "${line.substring(0, 50)}..."`
      );
    }
  });
}
```

#### Stack Trace Test Pattern
```typescript
describe('Stack Trace Narrow Mode Handling', () => {
  const testMatrix = [
    ['narrow', 45, false, { shouldShow: false, maxLines: 0 }],
    ['narrow', 45, true, { shouldShow: true, maxLines: 3 }],
    ['compact', 70, false, { shouldShow: false, maxLines: 0 }],
    // ... full matrix
  ] as const;

  testMatrix.forEach(([breakpoint, width, verbose, expected]) => {
    it(`${breakpoint} (${width}px, verbose=${verbose}): ${expected.maxLines} lines`, () => {
      // Test implementation
    });
  });
});
```

### Files to Create/Modify

1. **New file**: `packages/cli/src/ui/components/__tests__/progress-error-activity.responsive-composition.integration.test.tsx`
   - Comprehensive integration tests following the architecture above
   - ~500-700 lines covering all scenarios

### Dependencies
- `vitest` - Test framework
- `@testing-library/react` - DOM testing utilities
- Local test utils from `../../../__tests__/test-utils`
- Component imports from `../ProgressIndicators`, `../ErrorDisplay`, `../ActivityLog`

## Consequences

### Positive
- Comprehensive coverage of responsive behavior across all breakpoints
- Clear verification that components don't overflow at any terminal width
- Stack trace handling in narrow mode is thoroughly tested
- Cross-component integration scenarios are covered
- Follows established test patterns from existing codebase

### Negative
- Additional test file adds to test suite run time
- Requires maintaining mock configurations if breakpoints change

### Risks
- Mock configurations must stay in sync with actual `useStdoutDimensions` behavior
- Complex nested component testing may be fragile to implementation changes

## Implementation Notes

1. Use existing `test-utils.tsx` patterns for consistent test setup
2. Follow mock patterns from `content-components.responsive-composition.integration.test.tsx`
3. Ensure all tests are independent and can run in parallel
4. Use descriptive test names that indicate breakpoint and scenario
5. Include performance tests for large datasets (many log entries, long stack traces)

## Related Files
- `packages/cli/src/ui/components/ProgressIndicators.tsx`
- `packages/cli/src/ui/components/ErrorDisplay.tsx`
- `packages/cli/src/ui/components/ActivityLog.tsx`
- `packages/cli/src/ui/hooks/useStdoutDimensions.ts`
- `packages/cli/src/ui/components/__tests__/content-components.responsive-composition.integration.test.tsx` (reference implementation)
