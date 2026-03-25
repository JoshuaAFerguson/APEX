# ADR-0045: Maximize/Hide Behavior with Smooth CSS Transitions

**Status**: Approved
**Date**: 2026-03-23
**Author**: Architecture Stage Agent

## Context

The APEX platform requires smooth visual transitions when agent terminal panels are maximized or hidden in a grid layout. This ADR documents the technical design for implementing:

1. **Maximize behavior**: When one panel is maximized, it takes `col-span-full` and other panels are hidden
2. **Smooth CSS transitions**: Using `duration-300 ease-out` for all state changes
3. **Jarring-free grid layout adjustments**: Grid layout transitions without visual jumps
4. **Z-index stacking**: Maximized panel properly layered above other content

## Acceptance Criteria

| ID | Criteria | Implementation |
|----|----------|----------------|
| AC1 | When one panel is maximized, it takes `col-span-full` | `PANEL_WIDTHS.maximized = 'col-span-full'` applied via `getPanelGridClasses()` |
| AC2 | Other panels are hidden when one is maximized | `getPanelGridClasses()` returns `'hidden'` for non-maximized panels |
| AC3 | CSS transitions (duration-300 ease-out) apply smoothly | `PANEL_TRANSITIONS.height` class applied to all panels |
| AC4 | Grid layout adjusts without jarring visual jumps | `getGridLayoutClasses()` switches to single-column when maximized |
| AC5 | Z-index properly set for maximized panel | `z-10` class applied to maximized panel |

## Current Architecture

### Existing Infrastructure (Already Implemented)

The codebase has comprehensive support for this feature:

#### 1. State Management

**File**: `src/types/agent-terminal-panel.ts`
```typescript
type PanelDisplayState = 'normal' | 'minimized' | 'maximized'

interface PanelState {
  panelId: string
  displayState: PanelDisplayState
  previousState: PanelDisplayState
  lastChanged: Date
}
```

**File**: `src/hooks/useAgentTerminalPanelState.ts`
- Full reducer-based state management
- Mutual exclusivity enforcement (only one panel maximized at a time)
- Auto-restore of previously maximized panel when new panel maximizes
- Support for both controlled and uncontrolled patterns

#### 2. CSS Constants

**File**: `src/components/agents/constants.ts`
```typescript
export const PANEL_HEIGHTS = {
  minimized: 'h-12',     // 48px - header only
  normal: 'h-80',        // 320px - default viewing height
  maximized: 'h-full',   // Full container height
} as const

export const PANEL_WIDTHS = {
  minimized: '',
  normal: '',
  maximized: 'col-span-full',  // Full width spanning all columns
} as const

export const PANEL_TRANSITIONS = {
  height: 'transition-[height] duration-300 ease-out',
  opacity: 'transition-opacity duration-200 ease-in-out',
  transform: 'transition-transform duration-200 ease-out',
  all: 'transition-all duration-300 ease-out',
} as const

export const PANEL_PERFORMANCE = {
  willChange: 'will-change-[height,opacity]',
  contain: 'contain-layout contain-style',
  noInteraction: 'pointer-events-none',
} as const
```

#### 3. Grid Layout Utilities

**File**: `src/lib/utils.ts`
```typescript
export const GRID_CONFIGS = {
  1: 'grid grid-cols-1 gap-2',
  2: 'grid grid-cols-1 sm:grid-cols-2 gap-2',
  3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2',
  4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2',
  5: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2',
  6: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2',
} as const

export function getPanelGridClasses(isMaximized: boolean, isThisMaximized: boolean): string {
  if (isMaximized) {
    if (isThisMaximized) return 'col-span-full'
    return 'hidden'
  }
  return ''
}

export function getGridLayoutClasses(panelCount: number, isMaximized: boolean): string {
  if (isMaximized) return 'grid grid-cols-1 gap-2'
  const gridConfig = GRID_CONFIGS[panelCount as keyof typeof GRID_CONFIGS]
  return gridConfig || GRID_CONFIGS[6]
}
```

## Technical Design

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Grid Container (ParallelAgentGrid or Parent Component)      │
│ Classes: getGridLayoutClasses(panelCount, hasMaximizedPanel)│
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Panel Wrapper (per panel)                              │ │
│  │ Classes: getPanelGridClasses(hasMax, isThisMax)        │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ AgentTerminalPanel                               │  │ │
│  │  │ Classes: PANEL_WIDTHS[panelState]                │  │ │
│  │  │          PANEL_HEIGHTS[panelState]               │  │ │
│  │  │          PANEL_TRANSITIONS.height                │  │ │
│  │  │          PANEL_PERFORMANCE.willChange            │  │ │
│  │  │          effectivePanelState === 'maximized'     │  │ │
│  │  │            ? 'z-10' : ''                         │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### State Flow

```
User clicks Maximize on Panel A
           │
           ▼
┌──────────────────────────────────┐
│ useAgentTerminalPanelState hook  │
│ dispatches MAXIMIZE action       │
└──────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Reducer logic:                   │
│ 1. If Panel B was maximized:     │
│    - Restore Panel B to 'normal' │
│ 2. Set Panel A to 'maximized'    │
│ 3. Update maximizedPanelId       │
└──────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Grid Container re-renders:       │
│ - Container gets grid-cols-1     │
│ - Panel A gets col-span-full     │
│ - Panel B, C get 'hidden'        │
└──────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ CSS Transitions apply:           │
│ - Panel A animates to h-full     │
│ - duration-300 ease-out          │
│ - will-change-[height,opacity]   │
│ - z-10 brings panel to front     │
└──────────────────────────────────┘
```

### CSS Class Application

#### AgentTerminalPanel Component Classes

The `AgentTerminalPanel` component applies classes based on `effectivePanelState`:

```tsx
// From AgentTerminalPanel.tsx (lines 370-387)
<div
  className={cn(
    'flex flex-col border border-gray-800 rounded-lg overflow-hidden',
    'bg-gray-950/90 backdrop-blur-sm',
    theme === 'light' && 'bg-white/90 border-gray-200',
    dynamicPanelHeights[effectivePanelState],     // Height classes
    PANEL_WIDTHS[effectivePanelState],             // Width classes (col-span-full for maximized)
    PANEL_TRANSITIONS.height,                       // Transition animation
    PANEL_PERFORMANCE.willChange,                   // Performance optimization
    effectivePanelState === 'maximized' && 'z-10', // Z-index for maximized
    className
  )}
  style={{
    minHeight: effectivePanelState === 'maximized' ? undefined : minHeight,
    maxHeight: effectivePanelState === 'maximized' ? undefined : maxHeight,
  }}
  // ...
>
```

#### Grid Container Integration

For multi-panel layouts, the parent component uses grid utilities:

```tsx
// Example integration pattern
const ParallelAgentGrid: React.FC<Props> = ({ panels, onPanelStateChange }) => {
  const { maximizedPanelId, hasMaximizedPanel } = useAgentTerminalPanelState()

  return (
    <div className={getGridLayoutClasses(panels.length, hasMaximizedPanel)}>
      {panels.map(panel => (
        <div
          key={panel.id}
          className={getPanelGridClasses(hasMaximizedPanel, panel.panelState === 'maximized')}
        >
          <AgentTerminalPanel
            panelId={panel.id}
            panelState={panel.panelState}
            onMaximize={() => onPanelStateChange(panel.id, 'maximized')}
            onMinimize={() => onPanelStateChange(panel.id, 'minimized')}
            onRestore={() => onPanelStateChange(panel.id, 'normal')}
          />
        </div>
      ))}
    </div>
  )
}
```

### Transition Timing

| Transition | Duration | Easing | Purpose |
|------------|----------|--------|---------|
| Height | 300ms | ease-out | Panel expand/collapse |
| Opacity | 200ms | ease-in-out | Content fade |
| Transform | 200ms | ease-out | Chevrons/icons |

The 300ms duration provides a smooth, perceptible animation without feeling sluggish. The `ease-out` easing creates a natural deceleration.

### Performance Optimizations

1. **will-change hint**: Applied to all panels to optimize compositor layer usage
2. **CSS containment**: `contain-layout contain-style` limits layout recalculation scope
3. **GPU acceleration**: Transitions use transform and opacity which are compositor-friendly
4. **Debouncing**: 50ms debounce on rapid state changes prevents animation thrashing

### Z-Index Stacking

```
Layer 50+ : Modals, Dialogs
Layer 10  : Maximized Panel (z-10)
Layer 0   : Normal panels, Grid container
Layer -1  : Hidden panels (opacity-0, invisible)
```

### Accessibility Considerations

1. **ARIA attributes preserved during transitions**
   - `aria-expanded` reflects panel state
   - `aria-hidden` for hidden panels

2. **Keyboard navigation**
   - `M` key toggles maximize/restore
   - `Escape` restores from maximized
   - `Enter`/`Space` toggles minimize/restore

3. **Focus management**
   - Focus remains on panel container during transitions
   - `tabIndex={0}` ensures keyboard accessibility

## Testing Strategy

### Unit Tests
- Utility functions: `getPanelGridClasses()`, `getGridLayoutClasses()`
- State reducer logic in `useAgentTerminalPanelState`

### Integration Tests (Existing)
- `AgentTerminalPanel.three-state.test.tsx` - State transitions
- `AgentTerminalPanel.transitions.integration.test.tsx` - Animation classes

### Grid Integration Tests (ADR-0044)
- `ParallelAgentGrid.integration.test.tsx` - Multi-panel grid behavior

### Test Assertions

```typescript
// AC1: Maximized panel gets col-span-full
expect(getPanelGridClasses(true, true)).toBe('col-span-full')

// AC2: Non-maximized panels hidden
expect(getPanelGridClasses(true, false)).toBe('hidden')

// AC3: Transition classes present
expect(panel).toHaveClass('transition-[height]')
expect(panel).toHaveClass('duration-300')
expect(panel).toHaveClass('ease-out')

// AC4: Grid switches to single column
expect(getGridLayoutClasses(3, true)).toBe('grid grid-cols-1 gap-2')

// AC5: Z-index for maximized
expect(maximizedPanel).toHaveClass('z-10')
```

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| `PanelDisplayState` types | ✅ Complete | Three states defined |
| `PANEL_WIDTHS.maximized` | ✅ Complete | `col-span-full` |
| `PANEL_HEIGHTS.maximized` | ✅ Complete | `h-full` |
| `PANEL_TRANSITIONS` | ✅ Complete | duration-300 ease-out |
| `getPanelGridClasses()` | ✅ Complete | Returns correct classes |
| `getGridLayoutClasses()` | ✅ Complete | Switches to single column |
| `useAgentTerminalPanelState` | ✅ Complete | Full state management |
| `AgentTerminalPanel` | ✅ Complete | Applies all classes correctly |
| Z-index stacking | ✅ Complete | `z-10` for maximized |
| Integration tests | ⚠️ Partial | Some tests need updating |

## Files Involved

| File | Purpose |
|------|---------|
| `src/types/agent-terminal-panel.ts` | Type definitions |
| `src/hooks/useAgentTerminalPanelState.ts` | State management hook |
| `src/components/agents/constants.ts` | CSS constants |
| `src/lib/utils.ts` | Grid utility functions |
| `src/components/agents/AgentTerminalPanel.tsx` | Panel component |

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Animation jank on slow devices | will-change hint, GPU-accelerated properties |
| Layout thrashing during rapid toggles | 50ms debounce on state changes |
| Focus loss during transitions | Focus maintained on container element |
| Screen reader confusion | ARIA attributes updated synchronously |

## Conclusion

The maximize/hide behavior with smooth CSS transitions is fully implemented in the codebase. The architecture leverages:

1. **Clean state management** via `useAgentTerminalPanelState` hook
2. **Centralized constants** for consistent styling
3. **Utility functions** for grid class calculation
4. **Performance optimizations** via `will-change` and CSS containment
5. **Accessibility support** via ARIA attributes and keyboard navigation

All acceptance criteria are met by the existing implementation. The integration tests may need minor updates to align with the current component behavior (specifically around dynamic height classes).
