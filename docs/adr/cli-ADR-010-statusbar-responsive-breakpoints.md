# ADR-010: StatusBar Responsive Breakpoint Architecture

## Status
**Proposed** - Architecture stage

## Date
2026-03-05

## Context

The StatusBar component implements a responsive segment adaptation system that adjusts displayed information based on terminal width. The current implementation has test failures (6 in StatusBar.responsive.test.tsx, 14 in StatusBar.width-adaptation.test.tsx) revealing a mismatch between test expectations and actual behavior.

### Root Cause Analysis

After analyzing the implementation and test failures, the following issues were identified:

1. **trimToFit is Too Aggressive**: The `trimToFit` function removes segments based on priority even after tier-based filtering has already been applied. At widths like 100 cols (normal tier), medium priority segments like `implementation` and `[3/5]` are being trimmed even though they should be displayed per the tier rules.

2. **Test-Implementation Mismatch on Breakpoint Terminology**: The tests use `compact` breakpoint (60-99 cols) as a distinct tier, but the StatusBar implementation only recognizes 3 tiers:
   - `narrow`: < 60 cols
   - `normal`: 60-160 cols
   - `wide`: > 160 cols

   The `useStdoutDimensions` hook provides 4 breakpoints (`narrow`, `compact`, `normal`, `wide`), but StatusBar's `displayTier` calculation uses a 3-tier model.

3. **Priority Confusion**: Some tests expect certain segments to be shown/hidden based on the hook's breakpoint value, but the implementation derives its own `displayTier` from the raw `terminalWidth`, ignoring the hook's breakpoint entirely.

4. **Width Calculation in trimToFit Overestimates**: The `calculateActualWidth` function doesn't account for the fact that narrow mode removes labels (abbreviated labels are often empty strings or shorter).

## Decision Drivers

1. **Acceptance Criteria Compliance**: The system must implement 3-tier breakpoints:
   - Narrow: < 60 cols - shows CRITICAL + HIGH priority
   - Normal: 60-160 cols - shows CRITICAL + HIGH + MEDIUM priority
   - Wide: > 160 cols - shows all priority levels

2. **Predictable Behavior**: The tier-based filtering should be the primary mechanism, with trimToFit only as a safety valve for edge cases.

3. **Test Alignment**: Tests and implementation must use consistent breakpoint models.

4. **Maintainability**: Clear separation between tier-based filtering and emergency width-based trimming.

## Technical Design

### Option A: Fix trimToFit to Respect Tier-Based Decisions (Recommended)

Modify `trimToFit` to be less aggressive by:

1. **Increase Width Tolerance**: Add buffer in width calculation to avoid over-trimming
2. **Only Trim When Necessary**: Only remove segments when the calculated width genuinely exceeds terminal width by a meaningful margin
3. **Better Width Estimation**: Account for abbreviated labels when calculating widths

```typescript
// Current problematic code:
const padding = 6; // Box border (2) + paddingX (2 each side)
const centerGap = 2; // Gap between left and right sections

// Proposed fix:
const padding = 4; // More realistic padding estimate
const centerGap = 2;
const safetyBuffer = 5; // Allow some tolerance before trimming
```

### Option B: Align Test Expectations with 3-Tier Model

Update tests to match the actual 3-tier implementation where:
- `compact` breakpoint (60-99) maps to `normal` displayTier
- Medium priority segments should be visible at 60+ cols (not just 80+)

### Option C: Expand to 4-Tier Model (Not Recommended)

Add a `compact` tier (60-99 cols) between narrow and normal. This would require significant refactoring and doesn't align with the documented acceptance criteria specifying a 3-tier model.

## Recommended Approach

**Combine Options A and B:**

### Phase 1: Fix trimToFit Algorithm

1. Reduce padding estimate from 6 to 4
2. Add safety buffer before triggering trimming
3. Account for empty/abbreviated labels in narrow mode when calculating widths
4. Only start removing segments when content actually overflows

```typescript
function trimToFit(
  segments: { left: Segment[]; right: Segment[] },
  terminalWidth: number
): { left: Segment[]; right: Segment[] } {
  const calculateActualWidth = (segs: Segment[]) =>
    segs.reduce((sum, s) => {
      const iconWidth = s.icon ? 2 : 0;
      const labelWidth = s.label ? s.label.length : 0;
      const valueWidth = s.value.length;
      const segWidth = iconWidth + labelWidth + valueWidth;
      return sum + segWidth + (segWidth > 0 ? 1 : 0); // Only add gap if segment has content
    }, 0);

  const padding = 4; // Box border (2) + minimal padding
  const centerGap = 2;
  const safetyBuffer = 5; // Don't trim unless truly needed

  let leftSegs = [...segments.left];
  let rightSegs = [...segments.right];

  while (true) {
    const leftWidth = calculateActualWidth(leftSegs);
    const rightWidth = calculateActualWidth(rightSegs);
    const totalWidth = leftWidth + rightWidth + padding + centerGap;

    // Only trim if we exceed width by more than the safety buffer
    if (totalWidth <= terminalWidth + safetyBuffer) break;

    // ... rest of trimming logic
  }
}
```

### Phase 2: Update Test Expectations

For tests that use `breakpoint: 'compact'` with width 60-99:
- These should expect `displayTier: 'normal'` behavior (medium priority visible)
- Update test assertions to match the 3-tier model

### Phase 3: Clarify Tier Boundaries

Add explicit documentation and potentially expose the tier calculation:

```typescript
// Make tier calculation transparent
export function getDisplayTier(width: number): DisplayTier {
  if (width < 60) return 'narrow';
  if (width <= 160) return 'normal';
  return 'wide';
}
```

## Specific Test Fixes Required

### StatusBar.responsive.test.tsx (6 failures)

| Test | Issue | Fix |
|------|-------|-----|
| shows medium priority segments | trimToFit removes segments at 100 cols | Reduce trimToFit aggressiveness |
| shows subtask progress at normal width | Same as above | Same fix |
| verbose mode shows all info regardless of width | trimToFit still runs on verbose | Skip trimToFit for verbose mode |
| normal mode respects responsive tier | Medium segments trimmed | Fix trimToFit |
| handles boundary values correctly | 60 cols should show medium | Fix tier logic |
| progressively shows segments as width increases | Medium not showing at 100 | Fix trimToFit |

### StatusBar.width-adaptation.test.tsx (14 failures)

Most failures are due to:
1. Narrow mode tests expecting segments that get trimmed
2. Tests expecting `m:` abbreviated label but seeing `mod:` (test expectation incorrect)
3. Wide mode tests expecting segments that get trimmed

## Consequences

### Positive
- Tests will pass, validating the responsive behavior
- Clear 3-tier model per acceptance criteria
- Predictable segment visibility based on terminal width
- trimToFit becomes a true fallback, not primary filter

### Negative
- Some test expectations need updates to match actual design
- Minor behavior change in edge cases where trimToFit was over-aggressive

### Risks
- Some edge cases at very narrow widths may show overflow
- Need to verify visual rendering in real terminal

## Implementation Plan

1. **Fix trimToFit algorithm** - Reduce aggressiveness, add safety buffer
2. **Update test expectations** - Align with 3-tier model
3. **Add tier boundary tests** - Verify 59/60 and 160/161 boundaries
4. **Manual verification** - Test in actual terminal emulators

## Related Files

- `/packages/cli/src/ui/components/StatusBar.tsx` - Main implementation
- `/packages/cli/src/ui/components/__tests__/StatusBar.responsive.test.tsx` - 6 failures
- `/packages/cli/src/ui/components/__tests__/StatusBar.width-adaptation.test.tsx` - 14 failures
- `/packages/cli/src/ui/components/__tests__/StatusBar.priority-breakpoints.test.tsx` - Related tests
