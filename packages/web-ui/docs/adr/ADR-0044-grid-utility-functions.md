# ADR-0044: Grid Utility Functions for Panel Layout

## Status
Accepted

## Context

The `AgentTerminalPanel` component currently uses grid layout classes directly from `PANEL_WIDTHS` for handling maximized panel states. However, there's a need for:

1. **`getPanelGridClasses(panelId, maximizedPanelId)`** - Returns CSS classes for individual panel visibility based on maximize state
2. **`getGridLayoutClasses(panelCount, maximizedPanelId)`** - Returns CSS grid layout classes for the container based on panel count and maximize state

These utility functions will:
- Centralize grid layout logic
- Support the multi-panel architecture where only one panel can be maximized at a time
- Provide responsive grid configurations based on panel count

## Decision

### 1. Location: `constants.ts`

We will add the utility functions to `packages/web-ui/src/components/agents/constants.ts` rather than creating a new file because:
- The existing `constants.ts` already contains related panel constants (`PANEL_HEIGHTS`, `PANEL_WIDTHS`, `PANEL_TRANSITIONS`)
- The file size remains manageable
- Maintains colocation of related concerns
- Simpler import paths for consumers

### 2. Function Signatures

```typescript
/**
 * Get CSS classes for a panel's grid behavior based on maximize state
 * @param panelId - The ID of the panel to get classes for
 * @param maximizedPanelId - The ID of the currently maximized panel (null if none)
 * @returns CSS class string for the panel
 */
export function getPanelGridClasses(
  panelId: string,
  maximizedPanelId: string | null
): string

/**
 * Get CSS classes for the grid layout container
 * @param panelCount - Number of panels in the grid
 * @param maximizedPanelId - The ID of the currently maximized panel (null if none)
 * @returns CSS class string for the grid container
 */
export function getGridLayoutClasses(
  panelCount: number,
  maximizedPanelId: string | null
): string
```

### 3. Grid Configuration Constants

```typescript
/**
 * Responsive grid configurations based on panel count
 * Uses Tailwind CSS responsive breakpoints
 */
export const GRID_CONFIGS = {
  1: 'grid grid-cols-1 gap-2',
  2: 'grid grid-cols-1 md:grid-cols-2 gap-2',
  3: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2',
  4: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2',
  default: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2',
} as const
```

### 4. Implementation Logic

#### `getPanelGridClasses`:
```typescript
export function getPanelGridClasses(
  panelId: string,
  maximizedPanelId: string | null
): string {
  // No panel is maximized - return empty string (normal grid behavior)
  if (maximizedPanelId === null) {
    return ''
  }

  // This panel is maximized - span full width
  if (panelId === maximizedPanelId) {
    return 'col-span-full'
  }

  // Another panel is maximized - hide this one
  return 'hidden'
}
```

#### `getGridLayoutClasses`:
```typescript
export function getGridLayoutClasses(
  panelCount: number,
  maximizedPanelId: string | null
): string {
  // When a panel is maximized, use single column layout
  if (maximizedPanelId !== null) {
    return 'grid grid-cols-1 gap-2'
  }

  // Otherwise, use responsive config based on panel count
  if (panelCount <= 0) {
    return GRID_CONFIGS[1]
  }

  if (panelCount in GRID_CONFIGS) {
    return GRID_CONFIGS[panelCount as keyof typeof GRID_CONFIGS]
  }

  return GRID_CONFIGS.default
}
```

### 5. Type Exports

```typescript
export type GridConfigKey = keyof typeof GRID_CONFIGS
```

## Consequences

### Positive
- **Centralized Logic**: Grid behavior is defined in one place
- **Type Safety**: Strong typing prevents invalid configurations
- **Testable**: Pure functions are easy to unit test
- **Reusable**: Can be used across different panel layouts
- **Consistent with existing patterns**: Follows the established pattern in `constants.ts`

### Negative
- Slightly increases the size of `constants.ts`

## Test Plan

Unit tests will cover:
1. `getPanelGridClasses`:
   - Returns empty string when no panel is maximized
   - Returns 'col-span-full' for the maximized panel
   - Returns 'hidden' for non-maximized panels when another is maximized

2. `getGridLayoutClasses`:
   - Returns single column layout when a panel is maximized
   - Returns correct responsive classes for 1, 2, 3, 4, and 5+ panels
   - Handles edge cases (0 panels, negative counts)

3. `GRID_CONFIGS`:
   - All configs contain expected Tailwind classes
   - Type exports work correctly
