# ADR: Responsive ParallelExecutionView Column Layout

## Status
Accepted

## Context

The `ParallelExecutionView` component displays parallel agents in a grid layout with side-by-side cards. Currently, it uses a static `maxColumns` prop (defaulting to 3), which can cause:

1. **Horizontal overflow** on narrow terminals when 3 columns don't fit
2. **Wasted space** on wide terminals where more columns could fit
3. **Inconsistent UX** compared to other responsive components (`StatusBar`, `AgentPanel`) that adapt to terminal width

The project has an established pattern for responsive behavior using the `useStdoutDimensions` hook with a 4-tier breakpoint system (narrow < 60, compact 60-100, normal 100-160, wide >= 160).

## Decision

We will make `ParallelExecutionView` responsive by:

1. **Integrating `useStdoutDimensions`** hook for terminal width awareness
2. **Dynamically calculating `maxColumns`** based on available width and card dimensions
3. **Auto-switching to compact mode** for narrow terminals
4. **Adding a `width` prop** for testing purposes (to override terminal width)
5. **Following existing responsive patterns** from `AgentPanel` and `StatusBar`

### Column Calculation Formula

```
maxColumns = floor((terminalWidth + spacing) / (cardWidth + spacing))
```

Where:
- `cardWidth` = 30 chars (normal) or 20 chars (compact)
- `spacing` = 2 chars between cards

### Breakpoint-to-Columns Mapping

| Breakpoint | Terminal Width | Normal Columns | Compact Columns |
|------------|----------------|----------------|-----------------|
| narrow     | < 60           | 1              | 1-2             |
| compact    | 60-100         | 1-2            | 2-3             |
| normal     | 100-160        | 2-3            | 3-5             |
| wide       | >= 160         | 3-5            | 5-8             |

## Consequences

### Positive

1. **Consistent UX**: Aligns with other responsive components in the codebase
2. **No horizontal overflow**: Grid always fits within terminal width
3. **Better space utilization**: Wide terminals show more columns
4. **Backward compatible**: Existing `maxColumns` prop becomes a "maximum" hint
5. **Testable**: `width` prop allows deterministic testing

### Negative

1. **Slight complexity increase**: More logic to manage column calculation
2. **Layout shifts on resize**: Terminal resize causes re-layout (acceptable for terminal apps)

### Neutral

1. **Performance**: useMemo prevents unnecessary recalculations
2. **API change**: `maxColumns` semantics change from "exact" to "maximum allowed"

## Alternatives Considered

### 1. CSS-based Responsive (Rejected)
- Terminal UIs don't have CSS media queries
- Ink uses Yoga layout engine, not CSS

### 2. Fixed Breakpoint-to-Column Mapping (Rejected)
- Less flexible than formula-based calculation
- Wouldn't adapt smoothly to various terminal sizes

### 3. Parent Component Responsibility (Rejected)
- Would duplicate logic across all consumers
- Violates single responsibility principle

## Implementation Notes

- Use `useMemo` for `maxColumns` and `cardWidth` calculations
- Preserve existing `compact` prop behavior
- Add `width` prop for testing (bypasses useStdoutDimensions)
- Follow existing test patterns from `AgentPanel.responsive.test.tsx`

## References

- `packages/cli/src/ui/hooks/useStdoutDimensions.ts` - Hook implementation
- `packages/cli/src/ui/components/agents/AgentPanel.tsx` - Responsive pattern reference
- `packages/cli/src/ui/components/StatusBar.tsx` - Responsive pattern reference
