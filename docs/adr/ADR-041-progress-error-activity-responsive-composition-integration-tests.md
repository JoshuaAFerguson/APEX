# ADR-041: Progress, Error, and Activity Components Responsive Composition Integration Tests

## Status
**Approved** - Ready for implementation

## Context

The APEX CLI includes three core component families for displaying operational feedback:
1. **ProgressIndicators** - `ProgressBar`, `SpinnerWithText`, `LoadingSpinner`, `StepProgress`, `TaskProgress`, `MultiTaskProgress`
2. **ErrorDisplay** - `ErrorDisplay`, `ErrorSummary`, `ValidationError`
3. **ActivityLog** - `ActivityLog`, `LogStream`, `CompactLog`

These components are responsive and adapt to terminal widths using the `useStdoutDimensions` hook with 4 breakpoints:
- **narrow** (<60 columns): Minimal display, abbreviated text
- **compact** (60-99 columns): Reduced elements, truncated content
- **normal** (100-159 columns): Standard display
- **wide** (≥160 columns): Full content, verbose options

### Acceptance Criteria from Feature Request
Tests verify:
1. Progress bars, error displays, and activity logs render without overflow at all terminal widths
2. Stack traces handled properly in narrow mode

### Current Test Coverage Analysis

**Existing comprehensive test files:**
1. `progress-error-activity.responsive-composition.integration.test.tsx` (~1,196 lines)
   - Already provides extensive coverage for all components
   - Tests all 5 breakpoints (40, 60, 80, 120, 180 columns)
   - Includes cross-component composition scenarios

2. `ProgressIndicators.responsive-edge-cases.test.tsx` (~630 lines)
   - Edge case testing for ProgressBar, SpinnerWithText, LoadingSpinner
   - Boundary conditions (extremely narrow, min/max width constraints)
   - Performance tests for concurrent component instances

3. `ErrorDisplay.stack-responsive.test.tsx` (~500 lines)
   - Comprehensive stack trace responsive behavior matrix
   - Tests all breakpoint/verbose mode combinations

**Test Infrastructure:**
- `responsive-test-utils.ts` - Shared utilities for responsive testing
- `TERMINAL_CONFIGS` for standard breakpoints
- `mockTerminalWidth()` helper function
- `expectNoOverflow()` and `expectStackTraceHandling()` assertion helpers

## Decision

Based on the analysis, **comprehensive integration tests already exist** for the acceptance criteria. The technical design will:

1. **Validate existing coverage** against acceptance criteria
2. **Identify any remaining gaps** for specific edge cases
3. **Document the test architecture** for future maintenance
4. **Propose minimal additions** if gaps are found

### Test Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│       Progress/Error/Activity Responsive Composition Test Suite             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  FOUNDATION: responsive-test-utils.ts                                │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │  • BREAKPOINT_CONFIGS (narrow/compact/normal/wide)                   │   │
│  │  • mockTerminalWidth(cols) - Sets up hook mock                       │   │
│  │  • stripAnsi() - For accurate width measurement                      │   │
│  │  • assertNoOverflow(frame, maxWidth) - Overflow assertion            │   │
│  │  • createResponsiveMockForWidth(width)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  INTEGRATION: progress-error-activity.responsive-composition.test   │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │  Section 1: Terminal Width Mock Helper                               │   │
│  │  Section 2: Component Composition Wrapper                            │   │
│  │  Section 3: Responsive Assertion Helpers                             │   │
│  │  Section 4: Test Data Fixtures                                       │   │
│  │  Section 5: ProgressIndicators Composition Tests                     │   │
│  │  Section 6: ErrorDisplay Composition Tests                           │   │
│  │  Section 7: ActivityLog Composition Tests                            │   │
│  │  Section 8: Cross-Component Composition Tests                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  EDGE CASES: ProgressIndicators.responsive-edge-cases.test.tsx       │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │  • Extremely narrow terminals (width < 20)                           │   │
│  │  • minWidth/maxWidth constraint edge cases                           │   │
│  │  • Rapid terminal resize sequences                                   │   │
│  │  • Unicode character handling                                        │   │
│  │  • Performance with 100+ updates                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STACK TRACE: ErrorDisplay.stack-responsive.test.tsx                 │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │  Stack Trace Line Limits Matrix:                                     │   │
│  │  ┌──────────┬─────────────┬──────────────┐                          │   │
│  │  │Breakpoint│ Normal Mode │ Verbose Mode │                          │   │
│  │  ├──────────┼─────────────┼──────────────┤                          │   │
│  │  │ narrow   │   0 lines   │   3 lines    │                          │   │
│  │  │ compact  │   0 lines   │   5 lines    │                          │   │
│  │  │ normal   │   5 lines   │  10 lines    │                          │   │
│  │  │ wide     │   8 lines   │  Infinity    │                          │   │
│  │  └──────────┴─────────────┴──────────────┘                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Coverage Matrix

| Component | File | Overflow Check | Breakpoint Adaptation | Truncation | Composition |
|-----------|------|----------------|----------------------|------------|-------------|
| ProgressBar | integration.test | ✅ 5 widths | ✅ 4 breakpoints | ✅ Label | ✅ TaskProgress |
| SpinnerWithText | integration.test | ✅ 5 widths | ✅ 4 breakpoints | ✅ Text | ✅ LoadingSpinner |
| TaskProgress | integration.test | ✅ 5 widths | ✅ Narrow/wide | ✅ Name/step | ✅ ProgressBar |
| MultiTaskProgress | integration.test | ✅ 5 widths | ✅ All | ✅ Task names | ✅ Multiple |
| StepProgress | integration.test | ✅ 5 widths | ✅ H/V layout | ✅ Descriptions | ✅ Spinners |
| ErrorDisplay | integration.test | ✅ 5 widths | ✅ 4 breakpoints | ✅ Message | ✅ Stack trace |
| ErrorSummary | integration.test | ✅ 5 widths | ✅ Timestamp abbr | ✅ Messages | ✅ Multiple errors |
| ValidationError | integration.test | ✅ 5 widths | ✅ Field truncation | ✅ Values | ✅ Suggestions |
| ActivityLog | integration.test | ✅ 5 widths | ✅ Display modes | ✅ Messages | ✅ Timestamps |
| LogStream | integration.test | ✅ 5 widths | ✅ Streaming | ✅ Entries | ✅ Filters |
| CompactLog | integration.test | ✅ 5 widths | ✅ Minimal | ✅ Lines | ✅ Icons |

### Stack Trace Handling Tests (Acceptance Criteria 2)

The `ErrorDisplay.stack-responsive.test.tsx` file provides comprehensive stack trace testing:

```typescript
// Test matrix for stack trace display based on breakpoint and verbose mode
const testMatrix = [
  ['narrow', 40, false, { shouldShow: false, maxLines: 0 }],
  ['narrow', 40, true, { shouldShow: true, maxLines: 3 }],
  ['compact', 60, false, { shouldShow: false, maxLines: 0 }],
  ['compact', 60, true, { shouldShow: true, maxLines: 5 }],
  ['compact', 80, false, { shouldShow: false, maxLines: 0 }],
  ['compact', 80, true, { shouldShow: true, maxLines: 5 }],
  ['normal', 120, false, { shouldShow: true, maxLines: 5 }],
  ['normal', 120, true, { shouldShow: true, maxLines: 10 }],
  ['wide', 180, false, { shouldShow: true, maxLines: 8 }],
  ['wide', 180, true, { shouldShow: true, maxLines: Infinity }],
];
```

Key assertions for narrow mode:
1. **Non-verbose narrow**: Stack trace is hidden (0 lines)
2. **Verbose narrow**: Shows max 3 lines with truncation
3. **Line truncation**: Long lines are truncated to `width - 4` characters
4. **"More lines" indicator**: Shows count of hidden lines

### Cross-Component Composition Scenarios

The integration test file covers these composition scenarios:

1. **Progress + Error Display** in narrow terminals
2. **Progress + ActivityLog** in normal terminals
3. **Error + ActivityLog** in compact terminals
4. **Full Stack** (All three component types) in wide terminals
5. **Dynamic width transitions** (wide → narrow → wide)

### Test Execution Pattern

```typescript
// Standard test pattern for all breakpoints
const testWidths: TerminalWidth[] = [40, 60, 80, 120, 180];

testWidths.forEach(width => {
  it(`adapts to ${width} columns without overflow`, () => {
    mockTerminalWidth(width);

    const { container } = render(
      <ComponentUnderTest {...props} />
    );

    // Primary assertion: No overflow
    expectNoOverflow(container, width);

    // Secondary assertions: Component-specific behavior
    expect(screen.getByText(/expected content/)).toBeInTheDocument();
  });
});
```

## Implementation Status

### Existing Tests (No Changes Needed)

| Test File | Lines | Status |
|-----------|-------|--------|
| `progress-error-activity.responsive-composition.integration.test.tsx` | 1,196 | ✅ Complete |
| `ProgressIndicators.responsive-edge-cases.test.tsx` | 630 | ✅ Complete |
| `ErrorDisplay.stack-responsive.test.tsx` | 500 | ✅ Complete |
| `ErrorDisplay.enhanced-responsive.test.tsx` | ~300 | ✅ Complete |
| `ActivityLog.responsive-width.test.tsx` | ~250 | ✅ Complete |

### Test Commands

```bash
# Run all responsive integration tests
npm test -- --grep "responsive" --workspace=@apexcli/cli

# Run specific test suites
npm test -- packages/cli/src/ui/components/__tests__/progress-error-activity.responsive-composition.integration.test.tsx
npm test -- packages/cli/src/ui/components/__tests__/ProgressIndicators.responsive-edge-cases.test.tsx
npm test -- packages/cli/src/ui/components/__tests__/ErrorDisplay.stack-responsive.test.tsx
```

## Consequences

### Positive
- **Comprehensive coverage**: All acceptance criteria are met by existing tests
- **No duplicate work**: Existing tests are well-structured and thorough
- **Maintainable architecture**: Clear separation between integration and edge case tests
- **Documented patterns**: ADR provides reference for future responsive testing

### Neutral
- **Test file size**: Integration test file is large (~1,196 lines) but well-organized
- **Test execution time**: Multiple breakpoint tests increase test suite duration

### Risks Mitigated
- **Overflow at any terminal width**: Tested at 5 representative widths
- **Stack trace issues in narrow mode**: Comprehensive matrix testing
- **Composition breakage**: Cross-component scenarios verified

## Verification Checklist

- [x] Progress bars render without overflow at all terminal widths (40, 60, 80, 120, 180)
- [x] Error displays render without overflow at all terminal widths
- [x] Activity logs render without overflow at all terminal widths
- [x] Stack traces hidden in narrow non-verbose mode
- [x] Stack traces show 3 lines max in narrow verbose mode
- [x] Stack trace lines truncated to fit terminal width
- [x] Cross-component composition tested at all breakpoints
- [x] Dynamic width transition behavior tested

## References

- Existing test file: `packages/cli/src/ui/components/__tests__/progress-error-activity.responsive-composition.integration.test.tsx`
- Edge cases: `packages/cli/src/ui/components/__tests__/ProgressIndicators.responsive-edge-cases.test.tsx`
- Stack trace tests: `packages/cli/src/ui/components/__tests__/ErrorDisplay.stack-responsive.test.tsx`
- Test utilities: `packages/cli/src/ui/__tests__/responsive-test-utils.ts`
- ADR-036: Responsive Layout Integration Test Foundation
