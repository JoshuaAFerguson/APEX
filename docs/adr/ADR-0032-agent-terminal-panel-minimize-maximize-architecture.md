# ADR-0032: AgentTerminalPanel Minimize/Maximize Functionality Architecture

## Status
**Proposed**

## Context

The `AgentTerminalPanel` component (part of the ParallelAgentView system) requires minimize and maximize functionality to allow users to collapse panels to header-only view or expand them to full-width view. This feature is specified in the technical design document (`parallel-agent-view-technical-design.md`) and referenced in ADR-007.

### Current State

- The `AgentTerminalPanel` component interface is defined in the technical design but not yet implemented
- The technical design specifies `isMinimized` and `isMaximized` props with corresponding callbacks
- Panel height configuration exists: `minimized: 48px`, `normal: 320px`, `maximized: '100%'`
- Related collapsible patterns exist in `CollapsibleSection.tsx` (CLI package) with smooth animations

### Requirements from Acceptance Criteria

1. **Minimize state**: Panel collapsed to header only (showing agent name, status, and controls)
2. **Maximize state**: Panel expanded to full container width
3. **Smooth transition animations**: Visual feedback during state changes
4. **Keyboard accessibility**: Full keyboard navigation and shortcuts

## Decision

### 1. State Management Architecture

**Decision**: Use a **Controlled Component Pattern** with state lifted to `ParallelAgentView` container.

```typescript
// State in ParallelAgentView container
interface PanelUIState {
  minimizedPanels: Set<string>      // Panel IDs that are minimized
  maximizedPanelId: string | null   // Only one panel can be maximized at a time
  selectedPanelId: string | null    // For keyboard focus tracking
}
```

**Rationale**:
- Maximizing one panel should automatically minimize others (mutual exclusivity)
- Parent container controls grid layout based on panel states
- Enables global keyboard shortcuts (Escape to restore all, etc.)
- Consistent with compound component pattern from ADR-007

### 2. Component Interface

```typescript
export interface AgentTerminalPanelProps {
  /** Agent execution data */
  execution: AgentExecution

  /** Log entries for this agent */
  logs: LogEntry[]

  /** Panel display state */
  panelState: 'minimized' | 'normal' | 'maximized'

  /** Show progress bar */
  showProgress?: boolean

  /** Show elapsed time */
  showElapsedTime?: boolean

  /** Show token usage */
  showTokenUsage?: boolean

  /** Callbacks */
  onMinimize?: () => void
  onMaximize?: () => void
  onRestore?: () => void
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  onRetry?: () => void
  onClick?: () => void

  /** Accessibility */
  tabIndex?: number
  'aria-expanded'?: boolean

  /** Styling */
  className?: string
  testId?: string
}
```

**Key Design Choices**:
- Single `panelState` prop instead of separate `isMinimized`/`isMaximized` booleans to prevent invalid states
- Clear callback separation: `onMinimize`, `onMaximize`, `onRestore`
- Built-in ARIA support for accessibility

### 3. Animation Strategy

**Decision**: Use CSS transitions with Tailwind classes for smooth state changes.

```typescript
// Panel height configuration
const PANEL_HEIGHTS = {
  minimized: 'h-12',     // 48px - header only
  normal: 'h-80',        // 320px - default
  maximized: 'h-full',   // Full container height
} as const

// Transition classes
const PANEL_TRANSITIONS = {
  height: 'transition-[height] duration-300 ease-out',
  opacity: 'transition-opacity duration-200 ease-in-out',
  scale: 'transition-transform duration-200 ease-out',
} as const
```

**Animation Behaviors**:

| Transition | Animation | Duration |
|------------|-----------|----------|
| Normal → Minimized | Height collapse, content fade out | 300ms |
| Minimized → Normal | Height expand, content fade in | 300ms |
| Normal → Maximized | Smooth expand, others minimize | 300ms |
| Maximized → Normal | Smooth collapse, others restore | 300ms |

**Implementation Approach**:
```tsx
// Animated content visibility
const contentClasses = cn(
  PANEL_TRANSITIONS.opacity,
  panelState === 'minimized' ? 'opacity-0 invisible h-0' : 'opacity-100 visible'
)

// Panel container with height transition
const panelClasses = cn(
  'flex flex-col overflow-hidden',
  PANEL_TRANSITIONS.height,
  PANEL_HEIGHTS[panelState],
  panelState === 'maximized' && 'col-span-full row-span-full z-10',
  statusStyles.bg,
  statusStyles.border
)
```

**Rationale**:
- CSS transitions are more performant than JavaScript-based animations
- `duration-300` provides smooth yet responsive feel
- `ease-out` creates natural deceleration
- Hardware-accelerated via transform/opacity properties

### 4. Keyboard Accessibility

**Decision**: Implement full keyboard navigation following WAI-ARIA patterns.

| Key | Scope | Action |
|-----|-------|--------|
| `Enter` / `Space` | Focused panel | Toggle expand/collapse |
| `M` | Focused panel | Toggle maximize |
| `Escape` | Global | Restore maximized panel to normal |
| `Tab` | Global | Move focus between panels |
| `Arrow Up/Down` | Maximized panel | Scroll logs |
| `-` (minus) | Focused panel | Minimize panel |
| `+` (plus) | Focused panel | Restore from minimized |

**ARIA Implementation**:
```tsx
<div
  role="region"
  aria-label={`Agent panel: ${execution.agentName}`}
  aria-expanded={panelState !== 'minimized'}
  aria-describedby={`panel-${execution.id}-description`}
  tabIndex={0}
  onKeyDown={handleKeyDown}
>
  {/* Panel content */}
</div>
```

**Rationale**:
- `role="region"` with aria-label provides screen reader context
- `aria-expanded` communicates collapse state
- Standard keyboard patterns (Enter/Space for activation)
- Escape for dismissal is a common pattern

### 5. Grid Layout Integration

**Decision**: Maximized panel takes full grid span while others minimize.

```tsx
// ParallelAgentGrid layout logic
const getGridLayoutClasses = (
  panelCount: number,
  maximizedId: string | null
): string => {
  if (maximizedId) {
    // When maximized, use simple 1-column layout
    return 'grid grid-cols-1 gap-2'
  }

  // Normal responsive grid
  return cn(
    'grid gap-4',
    GRID_CONFIGS[Math.min(panelCount, 12) as keyof typeof GRID_CONFIGS]
  )
}

// Individual panel grid placement
const getPanelGridClasses = (
  panelId: string,
  maximizedId: string | null,
  minimizedIds: Set<string>
): string => {
  if (panelId === maximizedId) {
    return 'col-span-full'  // Full width when maximized
  }

  if (maximizedId && panelId !== maximizedId) {
    return 'hidden'  // Hide other panels when one is maximized
  }

  return ''  // Normal grid placement
}
```

**Rationale**:
- Simple CSS-based approach without complex positioning calculations
- Hidden panels don't affect layout calculations
- Smooth transition when toggling maximize state

### 6. Visual State Indicators

**Decision**: Use clear visual cues for panel states.

**Minimized State**:
- Header bar only (48px height)
- Chevron icon rotated pointing right
- Status dot visible
- Agent name truncated if necessary
- Controls condensed (single expand button)

**Normal State**:
- Full panel with header, content, and footer
- Chevron pointing down
- All controls visible
- Log stream active

**Maximized State**:
- Full container width and height
- "Restore" button in header
- Enhanced log viewing area
- Search bar always visible

### 7. Component Structure

```
AgentTerminalPanel/
├── AgentTerminalPanel.tsx      # Main component
├── AgentPanelHeader.tsx        # Header with controls
├── AgentPanelContent.tsx       # Log stream wrapper
├── AgentPanelFooter.tsx        # Progress/metrics
├── hooks/
│   └── useAgentPanelKeyboard.ts  # Keyboard handling
└── __tests__/
    ├── AgentTerminalPanel.test.tsx
    ├── AgentTerminalPanel.accessibility.test.tsx
    └── AgentTerminalPanel.animations.test.tsx
```

### 8. Custom Hook for Panel State

```typescript
export function useAgentTerminalPanelState(
  initialMaximizedId: string | null = null,
  initialMinimizedIds: string[] = []
) {
  const [maximizedPanelId, setMaximizedPanelId] = useState(initialMaximizedId)
  const [minimizedPanels, setMinimizedPanels] = useState(
    new Set(initialMinimizedIds)
  )

  const minimize = useCallback((panelId: string) => {
    // Can't minimize if maximized
    if (maximizedPanelId === panelId) return

    setMinimizedPanels(prev => new Set([...prev, panelId]))
  }, [maximizedPanelId])

  const maximize = useCallback((panelId: string) => {
    // Restore if already maximized, otherwise maximize
    setMaximizedPanelId(prev => prev === panelId ? null : panelId)

    // Auto-minimize other panels (handled by grid hiding)
  }, [])

  const restore = useCallback((panelId: string) => {
    if (maximizedPanelId === panelId) {
      setMaximizedPanelId(null)
    } else {
      setMinimizedPanels(prev => {
        const next = new Set(prev)
        next.delete(panelId)
        return next
      })
    }
  }, [maximizedPanelId])

  const restoreAll = useCallback(() => {
    setMaximizedPanelId(null)
    setMinimizedPanels(new Set())
  }, [])

  const getPanelState = useCallback((panelId: string): PanelDisplayState => {
    if (maximizedPanelId === panelId) return 'maximized'
    if (minimizedPanels.has(panelId)) return 'minimized'
    return 'normal'
  }, [maximizedPanelId, minimizedPanels])

  return {
    maximizedPanelId,
    minimizedPanels,
    minimize,
    maximize,
    restore,
    restoreAll,
    getPanelState,
  }
}
```

## Consequences

### Positive

1. **Clean separation of concerns**: State management in container, presentation in panel
2. **Smooth animations**: CSS-based transitions with consistent timing
3. **Full accessibility**: Keyboard navigation and screen reader support
4. **Predictable behavior**: Single maximized panel, clear state transitions
5. **Performance**: Hardware-accelerated CSS animations
6. **Testability**: State hook can be tested independently

### Negative

1. **State complexity**: Panel states are interdependent
2. **Animation edge cases**: Rapid toggling may cause visual glitches
3. **Grid layout shifts**: Minimizing/maximizing causes layout reflow

### Mitigations

1. **State complexity**: Well-defined state machine with clear transitions
2. **Animation edge cases**: Use `will-change` hints and debounce rapid clicks
3. **Grid layout shifts**: Use CSS containment and layout animations

## Testing Strategy

### Unit Tests
- Panel renders correctly in each state (minimized, normal, maximized)
- Callback props fire on appropriate interactions
- ARIA attributes update correctly

### Integration Tests
- Multiple panels interact correctly (maximize one, others hide)
- Keyboard navigation works across panels
- State persists through re-renders

### Accessibility Tests
- Screen reader announces state changes
- Focus management is correct
- Keyboard shortcuts work as expected

### Animation Tests
- Transitions complete without visual glitches
- Content visibility syncs with height changes
- No layout thrashing during transitions

## Implementation Plan

### Phase 1: Core Structure
1. Create `AgentTerminalPanel` component with three states
2. Implement `useAgentTerminalPanelState` hook
3. Basic minimize/maximize without animations

### Phase 2: Animations
1. Add CSS transitions for height/opacity
2. Implement chevron rotation animation
3. Add grid layout transitions

### Phase 3: Keyboard & Accessibility
1. Implement keyboard handlers
2. Add ARIA attributes
3. Test with screen readers

### Phase 4: Testing & Polish
1. Write comprehensive tests
2. Handle edge cases
3. Performance optimization

## References

- ADR-007: Parallel Agent View Component Architecture
- Technical Design: `docs/design/parallel-agent-view-technical-design.md`
- Existing Pattern: `packages/cli/src/ui/components/CollapsibleSection.tsx`
- WAI-ARIA: [Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
- Existing Types: `packages/web-ui/src/types/parallel-agent-view.ts`
