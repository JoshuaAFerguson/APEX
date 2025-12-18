# Technical Design: Responsive ParallelExecutionView

## Overview

This document describes the technical design for making `ParallelExecutionView` dynamically adapt its `maxColumns` based on terminal width, ensuring optimal display across all terminal sizes without horizontal overflow.

## Current State Analysis

### Existing Implementation
- `ParallelExecutionView.tsx` currently accepts a static `maxColumns` prop (default: 3)
- Does NOT use `useStdoutDimensions` hook
- Agents are displayed in a grid with fixed column count
- Card widths: `minWidth: 24` (normal mode), `minWidth: 16` (compact mode)
- Spacing between cards: `width={2}` (2 characters)

### Current Component Structure
```typescript
interface ParallelExecutionViewProps {
  agents: ParallelAgent[];
  maxColumns?: number;  // Static, defaults to 3
  compact?: boolean;
}
```

### Card Width Analysis
- **Normal card**: Border (2) + paddingX (4) + minWidth content (24) = ~30 chars minimum
- **Compact card**: Border (2) + paddingX (2) + minWidth content (16) = ~20 chars minimum
- **Inter-card spacing**: 2 characters
- **Total row width formula**: `(cardWidth * columns) + (spacing * (columns - 1))`

## Proposed Design

### 1. Integration with `useStdoutDimensions`

Add terminal dimension awareness using the existing `useStdoutDimensions` hook:

```typescript
import { useStdoutDimensions, type Breakpoint } from '../../hooks/index.js';

export function ParallelExecutionView({
  agents,
  maxColumns: maxColumnsProp,  // Optional override
  compact = false,
}: ParallelExecutionViewProps): React.ReactElement {
  const { width: terminalWidth, breakpoint } = useStdoutDimensions();

  // Calculate responsive maxColumns
  const maxColumns = useMemo(() =>
    calculateMaxColumns(terminalWidth, compact, maxColumnsProp),
    [terminalWidth, compact, maxColumnsProp]
  );
  // ...
}
```

### 2. Column Calculation Algorithm

The core algorithm calculates optimal columns based on available width:

```typescript
/**
 * Column width constants
 */
const COLUMN_CONFIG = {
  normal: {
    minCardWidth: 30,    // Border + padding + content
    interCardSpacing: 2,
    minColumns: 1,
    maxColumns: 6,
  },
  compact: {
    minCardWidth: 20,
    interCardSpacing: 2,
    minColumns: 1,
    maxColumns: 8,
  },
} as const;

/**
 * Calculate maximum columns that fit within terminal width
 */
function calculateMaxColumns(
  terminalWidth: number,
  compact: boolean,
  maxColumnsProp?: number
): number {
  const config = compact ? COLUMN_CONFIG.compact : COLUMN_CONFIG.normal;

  // Formula: width >= (cardWidth * cols) + (spacing * (cols - 1))
  // Solved for cols: cols <= (width + spacing) / (cardWidth + spacing)
  const calculatedMax = Math.floor(
    (terminalWidth + config.interCardSpacing) /
    (config.minCardWidth + config.interCardSpacing)
  );

  // Clamp to valid range
  const responsiveMax = Math.max(
    config.minColumns,
    Math.min(calculatedMax, config.maxColumns)
  );

  // If prop provided, use minimum of prop and responsive max
  return maxColumnsProp !== undefined
    ? Math.min(maxColumnsProp, responsiveMax)
    : responsiveMax;
}
```

### 3. Breakpoint-Based Behavior

Align with the existing 4-tier breakpoint system:

| Breakpoint | Width Range | Normal Mode Columns | Compact Mode Columns |
|------------|-------------|---------------------|----------------------|
| narrow     | < 60        | 1                   | 1-2                  |
| compact    | 60-100      | 1-2                 | 2-3                  |
| normal     | 100-160     | 2-3                 | 3-5                  |
| wide       | >= 160      | 3-5                 | 5-8                  |

### 4. Auto-Compact Detection

Automatically switch to compact mode when terminal is too narrow:

```typescript
// Determine effective compact mode
const effectiveCompact = useMemo(() => {
  if (compact) return true;
  // Auto-compact for narrow terminals
  if (breakpoint === 'narrow') return true;
  return false;
}, [compact, breakpoint]);
```

### 5. Updated Props Interface

```typescript
export interface ParallelExecutionViewProps {
  agents: ParallelAgent[];
  /**
   * Maximum columns hint. Actual columns may be less based on terminal width.
   * If not provided, calculated automatically from terminal width.
   */
  maxColumns?: number;
  /** Compact display mode (smaller cards) */
  compact?: boolean;
  /**
   * Explicit width override for testing.
   * If provided, bypasses useStdoutDimensions.
   */
  width?: number;
}
```

### 6. Card Width Responsiveness

Dynamic card sizing based on available space:

```typescript
/**
 * Calculate card width based on available space
 */
function calculateCardWidth(
  terminalWidth: number,
  columnCount: number,
  compact: boolean
): number {
  const spacing = (columnCount - 1) * 2;
  const availableWidth = terminalWidth - spacing;
  const rawCardWidth = Math.floor(availableWidth / columnCount);

  // Clamp to reasonable bounds
  const minWidth = compact ? 16 : 24;
  const maxWidth = compact ? 30 : 50;

  return Math.max(minWidth, Math.min(rawCardWidth, maxWidth));
}
```

### 7. Implementation Order

1. **Add `useStdoutDimensions` import and hook call**
2. **Create `calculateMaxColumns` helper function**
3. **Add `width` prop for testing override**
4. **Update `maxColumns` calculation logic**
5. **Add auto-compact detection**
6. **Update `ParallelAgentCard` to accept dynamic width**
7. **Ensure no horizontal overflow**

## Component Changes

### ParallelExecutionView Changes

```tsx
export function ParallelExecutionView({
  agents,
  maxColumns: maxColumnsProp,
  compact = false,
  width: widthProp,  // NEW: Testing override
}: ParallelExecutionViewProps): React.ReactElement {
  // Get terminal dimensions
  const { width: terminalWidth, breakpoint } = useStdoutDimensions();
  const width = widthProp ?? terminalWidth;

  // Auto-compact for narrow terminals
  const effectiveCompact = compact || breakpoint === 'narrow';

  // Calculate responsive maxColumns
  const maxColumns = useMemo(() =>
    calculateMaxColumns(width, effectiveCompact, maxColumnsProp),
    [width, effectiveCompact, maxColumnsProp]
  );

  // Calculate dynamic card width
  const cardWidth = useMemo(() =>
    calculateCardWidth(width, maxColumns, effectiveCompact),
    [width, maxColumns, effectiveCompact]
  );

  // ... rest of component using maxColumns and cardWidth
}
```

### ParallelAgentCard Changes

Update to accept and use dynamic width:

```tsx
interface ParallelAgentCardProps {
  agent: ParallelAgent;
  compact?: boolean;
  width?: number;  // NEW: Dynamic width
}

function ParallelAgentCard({
  agent,
  compact = false,
  width,  // NEW
}: ParallelAgentCardProps): React.ReactElement {
  // Use provided width or fall back to defaults
  const cardWidth = width ?? (compact ? 16 : 24);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={displayColor}
      paddingX={compact ? 1 : 2}
      paddingY={compact ? 0 : 1}
      width={cardWidth}  // NEW: Use dynamic width
    >
      {/* ... card content ... */}
    </Box>
  );
}
```

## Testing Strategy

### Unit Tests Required

1. **Hook Integration Tests**
   - Verify `useStdoutDimensions` is called
   - Verify `width` prop overrides terminal width for testing

2. **Column Calculation Tests**
   - Narrow terminal (< 60): 1 column
   - Compact terminal (60-100): 1-2 columns
   - Normal terminal (100-160): 2-3 columns
   - Wide terminal (>= 160): 3+ columns

3. **Grid Layout Tests**
   - Agents arranged correctly in calculated columns
   - No horizontal overflow at any width

4. **Auto-Compact Tests**
   - Verify auto-switch to compact mode for narrow terminals
   - Verify explicit `compact` prop still works

5. **Edge Case Tests**
   - Single agent displays correctly
   - Many agents wrap to multiple rows
   - Empty agent list handled

### Test File Structure

```typescript
// ParallelExecutionView.responsive.test.tsx

describe('ParallelExecutionView - Responsive Layout', () => {
  describe('Hook Integration', () => {
    it('uses useStdoutDimensions hook');
    it('respects explicit width prop for testing');
  });

  describe('Column Calculation', () => {
    it.each([
      [40, 1],   // narrow: 1 column
      [60, 1],   // compact boundary: 1 column
      [80, 2],   // compact: 2 columns
      [120, 3],  // normal: 3 columns
      [180, 4],  // wide: 4+ columns
    ])('calculates %d width as %d columns', (width, expectedCols) => {
      // ...
    });
  });

  describe('No Horizontal Overflow', () => {
    it.each([40, 60, 80, 100, 120, 160, 200])(
      'renders without overflow at width %d',
      (width) => {
        // ...
      }
    );
  });

  describe('Auto-Compact Mode', () => {
    it('switches to compact mode for narrow terminals');
    it('respects explicit compact prop');
  });
});
```

## Integration Points

### With AgentPanel

`AgentPanel` already uses `ParallelExecutionView` and passes `compact` prop. The responsive behavior will automatically work when:

```tsx
// In DetailedAgentPanel
<ParallelExecutionView
  agents={parallelAgents}
  compact={false}  // Will auto-compact based on terminal width
/>
```

### With Orchestrator Events

No changes needed - the view is purely presentational and responsive to terminal dimensions.

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `ParallelExecutionView.tsx` | Modify | Add responsive column calculation |
| `ParallelExecutionView.responsive.test.tsx` | Create | New test file for responsive behavior |

## Acceptance Criteria Mapping

| Criteria | Implementation |
|----------|---------------|
| Uses useStdoutDimensions hook | Add hook import and call |
| maxColumns calculated based on terminal width | `calculateMaxColumns` function |
| 1 column for narrow | Breakpoint-based logic |
| 2 columns for compact | Breakpoint-based logic |
| 3+ columns for wide | Breakpoint-based logic |
| Agents displayed in appropriate grid | Existing row grouping logic |
| No horizontal overflow | Dynamic card width + column limit |
| Unit tests for different widths | Parameterized test suite |

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing maxColumns prop behavior | Make prop optional, use as max hint |
| Layout issues at boundary widths | Comprehensive edge case testing |
| Performance impact from recalculation | useMemo for expensive calculations |
| Inconsistent with other responsive components | Follow established patterns from StatusBar, AgentPanel |

## Dependencies

- `useStdoutDimensions` hook (existing)
- `ink` Box/Text components (existing)
- `vitest` for testing (existing)

---

**Author**: architect agent
**Created**: During architecture stage
**Status**: Ready for developer implementation
