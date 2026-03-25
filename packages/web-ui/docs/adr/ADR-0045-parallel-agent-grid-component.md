# ADR-0045: ParallelAgentGrid Component

## Status
Proposed

## Context

The APEX web-ui needs a focused, lightweight grid container component for rendering multiple `AgentTerminalPanel` children in a responsive CSS grid layout. While `ParallelAgentTerminalView` exists and provides comprehensive panel management (validation, state management, imperative API), there's a need for a simpler composition pattern that:

1. Provides **pure grid layout functionality** without panel configuration validation
2. Allows **direct composition** of AgentTerminalPanel children (React children pattern)
3. **Delegates state management** to the parent component via `useAgentTerminalPanelState` hook
4. Maintains **clean separation of concerns** between layout and behavior

### Current Architecture Analysis

```
┌─────────────────────────────────────────────────────────────────────┐
│ ParallelAgentTerminalView (Complex)                                 │
│ - Panel configuration validation                                    │
│ - State management integration                                      │
│ - Grid layout rendering                                             │
│ - Imperative ref API                                                │
│ - Error handling / Empty states                                     │
└─────────────────────────────────────────────────────────────────────┘

Proposed Addition:

┌─────────────────────────────────────────────────────────────────────┐
│ ParallelAgentGrid (Simple)                                          │
│ - Grid layout rendering ONLY                                        │
│ - Uses getGridLayoutClasses + getPanelGridClasses                   │
│ - Accepts children (AgentTerminalPanel components)                  │
│ - Minimal props surface                                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Existing Dependencies

The component will leverage existing utilities:

| Utility | Location | Purpose |
|---------|----------|---------|
| `getGridLayoutClasses` | `@/lib/utils` | Grid container CSS classes based on panel count |
| `getPanelGridClasses` | `@/lib/utils` | Individual panel visibility/spanning classes |
| `useAgentTerminalPanelState` | `@/hooks` | Panel state management hook (used by parent) |
| `GRID_CONFIGS` | `@/lib/utils` | Grid layout configurations for 1-12 panels |

## Decision

### 1. Create `ParallelAgentGrid` Component

Create a new focused component at `packages/web-ui/src/components/agents/ParallelAgentGrid.tsx`.

### 2. Component Interface

```typescript
interface ParallelAgentGridProps {
  /** Number of panels in the grid (1-12) */
  panelCount: number

  /** Whether any panel is currently maximized */
  hasMaximizedPanel: boolean

  /** Optional CSS class name for the container */
  className?: string

  /** Test ID for testing */
  testId?: string

  /** AgentTerminalPanel children wrapped in panel containers */
  children: React.ReactNode
}
```

### 3. Implementation Pattern

The component follows a **container + render function** pattern:

```tsx
export const ParallelAgentGrid: React.FC<ParallelAgentGridProps> = ({
  panelCount,
  hasMaximizedPanel,
  className,
  testId = 'parallel-agent-grid',
  children,
}) => {
  const gridClasses = useMemo(
    () => getGridLayoutClasses(panelCount, hasMaximizedPanel),
    [panelCount, hasMaximizedPanel]
  )

  return (
    <div
      className={cn(gridClasses, className)}
      data-testid={testId}
      role="region"
      aria-label={`Agent terminal grid (${panelCount} panels)`}
    >
      {children}
    </div>
  )
}
```

### 4. Usage Pattern

Parent components provide state management and wrap panels:

```tsx
const ParentComponent = () => {
  const {
    hasMaximizedPanel,
    getPanelState,
    maximize,
    minimize,
    restore,
    maximizedPanelId,
  } = useAgentTerminalPanelState()

  const panels = [
    { panelId: 'agent-1', agentId: 'agent-1', title: 'Agent 1' },
    { panelId: 'agent-2', agentId: 'agent-2', title: 'Agent 2' },
    { panelId: 'agent-3', agentId: 'agent-3', title: 'Agent 3' },
  ]

  return (
    <ParallelAgentGrid
      panelCount={panels.length}
      hasMaximizedPanel={hasMaximizedPanel}
    >
      {panels.map((panel) => {
        const isThisPanelMaximized = maximizedPanelId === panel.panelId
        const panelGridClasses = getPanelGridClasses(
          hasMaximizedPanel,
          isThisPanelMaximized
        )

        return (
          <div key={panel.panelId} className={panelGridClasses}>
            <AgentTerminalPanel
              panelId={panel.panelId}
              agentId={panel.agentId}
              title={panel.title}
              panelState={getPanelState(panel.panelId)}
              onMaximize={() => maximize(panel.panelId)}
              onMinimize={() => minimize(panel.panelId)}
              onRestore={() => restore(panel.panelId)}
            />
          </div>
        )
      })}
    </ParallelAgentGrid>
  )
}
```

### 5. Component Composition Hierarchy

```
ParallelAgentGrid (Container)
└── div.{panelGridClasses} (Panel Wrapper)
    └── AgentTerminalPanel (Child)
```

### 6. File Structure

```
packages/web-ui/src/components/agents/
├── ParallelAgentGrid.tsx              # New component
├── ParallelAgentGrid.test.tsx         # Unit tests (if needed beyond integration)
├── ParallelAgentTerminalView.tsx      # Existing (comprehensive version)
├── AgentTerminalPanel.tsx             # Existing panel component
└── index.ts                           # Add export
```

## Architectural Principles

### Single Responsibility Principle (SRP)
- `ParallelAgentGrid`: Layout only (grid classes, accessibility attributes)
- `useAgentTerminalPanelState`: State management only
- `AgentTerminalPanel`: Panel rendering only

### Open/Closed Principle (OCP)
- Grid component accepts any children (React.ReactNode)
- Can be extended with additional layout features via composition

### Dependency Inversion Principle (DIP)
- Depends on abstractions (panelCount, hasMaximizedPanel) not implementations
- State management provided by hook at higher level

## Comparison with ParallelAgentTerminalView

| Feature | ParallelAgentGrid | ParallelAgentTerminalView |
|---------|-------------------|---------------------------|
| Panel configuration validation | No | Yes |
| State management integration | External (hook) | Internal |
| Imperative ref API | No | Yes |
| Children composition | React.ReactNode | Config array |
| Complexity | Low | High |
| Use case | Simple layouts | Full-featured dashboards |

## Consequences

### Positive

1. **Simplified component** - Focused responsibility, easy to understand
2. **Flexible composition** - Parent controls state and panel rendering
3. **Reusable utilities** - Leverages existing grid utility functions
4. **Testable** - Pure layout component with predictable behavior
5. **Accessibility** - Built-in ARIA attributes for screen readers

### Negative

1. **Two grid components** - Potential confusion between ParallelAgentGrid and ParallelAgentTerminalView
2. **Boilerplate for consumers** - Parent must wrap panels with panelGridClasses manually

### Mitigations

- Clear documentation distinguishing the two components
- Consider a `ParallelAgentGridPanel` helper component for wrapping

## Test Strategy

The existing `ParallelAgentGrid.integration.test.tsx` tests cover:

- AC1: Maximized panel gets `col-span-full` class
- AC2: Non-maximized panels are hidden when one is maximized
- AC3: Grid layout classes change based on panel count and maximize state
- AC4: Smooth transitions are applied

Additional unit tests should cover:
- Edge cases (0 panels, 13+ panels)
- Accessibility attributes
- Custom className merging

## Related ADRs

- ADR-0043: Animation timing specifications
- ADR-0044: Grid utility functions (`getGridLayoutClasses`, `getPanelGridClasses`)
- ADR-003: useAgentTerminalPanelState hook

## Implementation Checklist

1. [x] Analyze existing architecture
2. [ ] Create `ParallelAgentGrid.tsx` component
3. [ ] Add export to `index.ts`
4. [ ] Verify existing integration tests pass
5. [ ] Run build verification
6. [ ] Update documentation if needed
