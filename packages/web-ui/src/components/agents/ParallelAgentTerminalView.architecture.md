# ParallelAgentTerminalView - Architecture Design

## Overview

The `ParallelAgentTerminalView` component provides a responsive CSS grid layout for displaying 1-12 `AgentTerminalPanel` components simultaneously. It enables monitoring multiple parallel agent executions in a single view with proper spacing, overflow handling, and responsive adaptation to different screen sizes.

## Acceptance Criteria

> ParallelAgentTerminalView component renders 1-12 AgentTerminalPanel components in a responsive CSS grid that adapts to screen size, with proper gap spacing and overflow handling

## Architecture Decision Records

### ADR-001: Component Location

**Decision**: Place component in `packages/web-ui/src/components/agents/ParallelAgentTerminalView.tsx`

**Rationale**:
- Consistent with existing agent-related components (`AgentTerminalPanel.tsx`, `ParallelAgentView.tsx`)
- Same package as the `AgentTerminalPanel` component it composes
- Follows the established folder structure pattern

### ADR-002: Grid Layout Strategy

**Decision**: Use Tailwind CSS grid utilities with responsive breakpoint classes, leveraging the existing `GRID_CONFIGS` from `lib/utils.ts`.

**Rationale**:
- Tailwind CSS grid provides declarative, responsive layouts
- Existing `GRID_CONFIGS` already defines responsive grid configurations for 1-6 panels
- Consistent with existing patterns in `ParallelAgentView.tsx` and dashboard layouts
- CSS Grid provides native gap handling and overflow control

**Extension Required**: Add grid configurations for 7-12 panels.

### ADR-003: State Management

**Decision**: Use the existing `useAgentTerminalPanelState` hook for coordinated panel state management.

**Rationale**:
- Hook already implements three-state architecture (minimized/normal/maximized)
- Provides mutual exclusivity for maximized panels
- Supports both controlled and uncontrolled patterns
- Existing implementation is battle-tested with comprehensive tests

### ADR-004: Responsive Breakpoints

**Decision**: Use standard Tailwind breakpoints with mobile-first approach:
- `default`: 1 column (mobile)
- `sm` (640px+): 2 columns
- `lg` (1024px+): 3-4 columns (based on panel count)
- `xl` (1280px+): 4-6 columns (based on panel count)
- `2xl` (1536px+): Up to 6 columns

**Rationale**:
- Aligns with Tailwind's default breakpoint system
- Mobile-first ensures usability on small screens
- Progressive enhancement adds columns as space allows

## Component Interfaces

### Props Interface

```typescript
/**
 * Configuration for a single agent execution to display
 */
export interface AgentTerminalPanelConfig {
  /** Unique identifier for the panel */
  panelId: string;

  /** Agent ID being monitored */
  agentId: string;

  /** Display title for the panel */
  title?: string;

  /** Current agent status */
  agentStatus?: AgentStatus;

  /** Initial panel state */
  initialState?: PanelDisplayState;

  /** Whether to auto-connect to log stream */
  autoConnect?: boolean;

  /** Additional props to pass to AgentTerminalPanel */
  panelProps?: Partial<AgentTerminalPanelProps>;
}

/**
 * Props for ParallelAgentTerminalView component
 */
export interface ParallelAgentTerminalViewProps {
  /**
   * Array of panel configurations (1-12 panels)
   * @minItems 1
   * @maxItems 12
   */
  panels: AgentTerminalPanelConfig[];

  /**
   * Gap size between panels
   * @default 'md'
   */
  gap?: 'sm' | 'md' | 'lg';

  /**
   * Maximum height for the container
   * Enables vertical scrolling when content exceeds
   * @default 'auto'
   */
  maxHeight?: string | 'auto' | 'none';

  /**
   * Controlled panel states (optional)
   * When provided, component operates in controlled mode
   */
  panelStates?: Record<string, PanelDisplayState>;

  /**
   * Callback when any panel state changes
   */
  onPanelStateChange?: (
    panelId: string,
    newState: PanelDisplayState,
    allStates: Record<string, PanelDisplayState>
  ) => void;

  /**
   * Callback when a panel is closed
   */
  onPanelClose?: (panelId: string) => void;

  /**
   * CSS class name for the container
   */
  className?: string;

  /**
   * Test ID for testing
   */
  testId?: string;

  /**
   * Display mode applied to all panels
   * @default 'normal'
   */
  displayMode?: 'normal' | 'compact' | 'verbose';

  /**
   * Whether to show loading skeleton during initial connection
   * @default false
   */
  showLoadingSkeleton?: boolean;
}
```

### Return Interface

The component renders a grid container with `AgentTerminalPanel` children. It exposes imperative methods via `forwardRef`:

```typescript
export interface ParallelAgentTerminalViewRef {
  /** Minimize all panels */
  minimizeAll: () => void;

  /** Restore all panels to normal state */
  restoreAll: () => void;

  /** Get current state of all panels */
  getAllStates: () => Record<string, PanelDisplayState>;

  /** Maximize a specific panel */
  maximizePanel: (panelId: string) => void;

  /** Focus a specific panel */
  focusPanel: (panelId: string) => void;
}
```

## Grid Layout Specifications

### Extended Grid Configurations

```typescript
// Extend existing GRID_CONFIGS in lib/utils.ts
export const EXTENDED_GRID_CONFIGS = {
  ...GRID_CONFIGS, // 1-6 panels already defined
  7: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-2',
  8: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-2',
  9: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-2',
  10: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 gap-2',
  11: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-6 gap-2',
  12: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-6 gap-2',
} as const;
```

### Gap Configurations

```typescript
export const GAP_CONFIGS = {
  sm: 'gap-2',  // 8px
  md: 'gap-4',  // 16px
  lg: 'gap-6',  // 24px
} as const;
```

### Maximized State Handling

When a panel is maximized:
1. Container uses `grid grid-cols-1` layout
2. Maximized panel uses `col-span-full`
3. Other panels are hidden with `hidden` class
4. Existing `getPanelGridClasses` function handles this

## Component Structure

```
ParallelAgentTerminalView/
├── ParallelAgentTerminalView.tsx       # Main component
├── ParallelAgentTerminalView.types.ts  # Type definitions
├── __tests__/
│   ├── ParallelAgentTerminalView.test.tsx
│   ├── ParallelAgentTerminalView.grid.test.tsx
│   └── ParallelAgentTerminalView.responsive.test.tsx
└── index.ts                            # Barrel export
```

## Implementation Outline

```tsx
// ParallelAgentTerminalView.tsx
'use client'

import React, { forwardRef, useImperativeHandle, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { AgentTerminalPanel } from './AgentTerminalPanel'
import { useAgentTerminalPanelState } from '@/hooks/useAgentTerminalPanelState'
import type {
  ParallelAgentTerminalViewProps,
  ParallelAgentTerminalViewRef,
} from './ParallelAgentTerminalView.types'
import {
  getExtendedGridLayoutClasses,
  getPanelGridClasses,
  GAP_CONFIGS,
} from './ParallelAgentTerminalView.utils'

export const ParallelAgentTerminalView = forwardRef<
  ParallelAgentTerminalViewRef,
  ParallelAgentTerminalViewProps
>(({
  panels,
  gap = 'md',
  maxHeight = 'auto',
  panelStates: controlledStates,
  onPanelStateChange,
  onPanelClose,
  className,
  testId,
  displayMode = 'normal',
  showLoadingSkeleton = false,
}, ref) => {
  // Panel state management
  const {
    minimize,
    maximize,
    restore,
    restoreAll,
    getPanelState,
    getAllStates,
    hasMaximizedPanel,
    maximizedPanelId,
    registerPanel,
    unregisterPanel,
  } = useAgentTerminalPanelState({
    controlledStates,
    onStateChange: onPanelStateChange,
  })

  // Validate panel count
  const validatedPanels = useMemo(() => {
    if (panels.length > 12) {
      console.warn('ParallelAgentTerminalView: Maximum 12 panels supported')
      return panels.slice(0, 12)
    }
    return panels
  }, [panels])

  // Grid classes
  const gridClasses = useMemo(() => {
    return getExtendedGridLayoutClasses(validatedPanels.length, hasMaximizedPanel)
  }, [validatedPanels.length, hasMaximizedPanel])

  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    minimizeAll: () => {
      validatedPanels.forEach(p => minimize(p.panelId))
    },
    restoreAll,
    getAllStates,
    maximizePanel: (panelId: string) => maximize(panelId),
    focusPanel: (panelId: string) => {
      // Focus implementation
    },
  }), [validatedPanels, minimize, restoreAll, getAllStates, maximize])

  // Container style
  const containerStyle = useMemo(() => ({
    maxHeight: maxHeight === 'auto' ? undefined : maxHeight,
  }), [maxHeight])

  return (
    <div
      className={cn(
        'w-full',
        gridClasses,
        GAP_CONFIGS[gap],
        maxHeight !== 'auto' && maxHeight !== 'none' && 'overflow-y-auto',
        className
      )}
      style={containerStyle}
      data-testid={testId}
      role="region"
      aria-label="Parallel agent terminals"
    >
      {validatedPanels.map((config) => {
        const panelState = getPanelState(config.panelId)
        const panelGridClasses = getPanelGridClasses(
          hasMaximizedPanel,
          maximizedPanelId === config.panelId
        )

        return (
          <div
            key={config.panelId}
            className={cn(panelGridClasses)}
          >
            <AgentTerminalPanel
              panelId={config.panelId}
              agentId={config.agentId}
              title={config.title}
              agentStatus={config.agentStatus}
              panelState={panelState}
              autoConnect={config.autoConnect}
              onMinimize={() => minimize(config.panelId)}
              onMaximize={() => maximize(config.panelId)}
              onRestore={() => restore(config.panelId)}
              onClose={() => onPanelClose?.(config.panelId)}
              {...config.panelProps}
            />
          </div>
        )
      })}
    </div>
  )
})

ParallelAgentTerminalView.displayName = 'ParallelAgentTerminalView'
```

## Dependencies

### Internal Dependencies
- `@/components/agents/AgentTerminalPanel` - Individual terminal panel
- `@/hooks/useAgentTerminalPanelState` - Panel state management
- `@/lib/utils` - Utility functions including `cn`, `GRID_CONFIGS`
- `@/types/agent-terminal-panel` - Type definitions

### External Dependencies
- `react` - Core React library
- `tailwindcss` - CSS framework (via class names)

## Testing Strategy

### Unit Tests
1. Renders correct number of AgentTerminalPanel components
2. Applies correct grid classes based on panel count
3. Handles minimized/maximized/normal state transitions
4. Validates panel count limits (1-12)
5. Calls onPanelStateChange when states change
6. Calls onPanelClose when panel is closed

### Integration Tests
1. Grid layout responds to viewport changes
2. Panel state management works with useAgentTerminalPanelState
3. Maximizing one panel hides others
4. Restoring panels shows all panels

### Responsive Tests
1. Mobile viewport shows single column
2. Tablet viewport shows 2 columns
3. Desktop viewport shows appropriate columns based on panel count
4. XL viewport shows maximum columns

## Performance Considerations

1. **Memoization**: Use `useMemo` for grid class calculations
2. **Lazy Panel Rendering**: Consider virtualization for 10+ panels
3. **State Updates**: Minimize re-renders by using stable callbacks
4. **CSS Grid**: Native CSS grid performs well with many children

## Accessibility

1. **Role**: `role="region"` with `aria-label`
2. **Keyboard Navigation**: Inherit from AgentTerminalPanel
3. **Focus Management**: Support programmatic focus via ref
4. **Screen Reader**: Announce panel count and state changes

## Future Enhancements

1. Drag-and-drop panel reordering
2. Panel persistence (save/restore layout)
3. Custom grid templates
4. Panel grouping/collapsing
5. Auto-layout optimization based on content

## File Outputs

This architecture will produce the following files:

1. `packages/web-ui/src/components/agents/ParallelAgentTerminalView.tsx`
2. `packages/web-ui/src/components/agents/ParallelAgentTerminalView.types.ts`
3. `packages/web-ui/src/components/agents/ParallelAgentTerminalView.utils.ts`
4. `packages/web-ui/src/components/agents/__tests__/ParallelAgentTerminalView.test.tsx`
5. `packages/web-ui/src/lib/utils.ts` (extend GRID_CONFIGS)
6. `packages/web-ui/src/components/agents/index.ts` (add export)
