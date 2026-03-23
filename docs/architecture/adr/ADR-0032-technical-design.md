# ADR-0032 Technical Design: AgentTerminalPanel Three-State Architecture

## Status
**Technical Design - Architecture Stage**

## Overview

This document provides the detailed technical design for implementing the three-state (minimized, normal, maximized) architecture for the `AgentTerminalPanel` component as specified in ADR-0032.

## Current State Analysis

### Existing Implementation
The current `AgentTerminalPanel` component in `/packages/web-ui/src/components/agents/AgentTerminalPanel.tsx`:
- Uses a simple boolean `isMinimized` state
- Only supports toggle between minimized (header-only) and non-minimized states
- Does NOT implement the full three-state architecture from ADR-0032

### Required Changes
Transform from binary state to tri-state architecture:
```
Current: isMinimized: boolean
Target:  panelState: 'minimized' | 'normal' | 'maximized'
```

## Technical Design

### 1. Component Props Interface (ADR-0032 Compliant)

```typescript
export interface AgentTerminalPanelCoreProps {
  // Required props
  panelId: string
  agentId: string

  // Display state (controlled pattern)
  panelState: PanelDisplayState  // 'minimized' | 'normal' | 'maximized'

  // Agent information for header
  title?: string
  agentStatus?: AgentStatus

  // State change callbacks
  onMinimize?: () => void
  onMaximize?: () => void
  onRestore?: () => void

  // Additional panel callbacks
  onClose?: () => void
  onPause?: () => void
  onResume?: () => void
  onClear?: () => void

  // ARIA attributes
  'aria-expanded'?: boolean
  'aria-label'?: string
  tabIndex?: number

  // Styling
  className?: string
  testId?: string
}
```

### 2. State Machine

```
                    ┌──────────────┐
                    │   normal     │◀─────────────────┐
                    └──────┬───────┘                  │
                           │                          │
             minimize()    │    maximize()           restore()
                           │                          │
            ┌──────────────┼──────────────┐          │
            ▼              │              ▼          │
     ┌──────────────┐      │       ┌──────────────┐  │
     │  minimized   │      │       │  maximized   │──┘
     └──────────────┘      │       └──────────────┘
            │              │              ▲
            │              │              │
            └──────────────┴──────────────┘
                    restore()
```

**State Transitions:**
| From | Action | To |
|------|--------|-----|
| normal | minimize() | minimized |
| normal | maximize() | maximized |
| minimized | restore() | normal |
| minimized | maximize() | maximized |
| maximized | restore() | normal |
| maximized | minimize() | minimized |

### 3. Component Structure

```
AgentTerminalPanel/
├── AgentTerminalPanel.tsx        # Core component with three states
├── AgentTerminalPanelHeader.tsx  # Header (existing, minor updates)
├── AgentTerminalPanelControls.tsx # Controls (existing, no changes)
├── AgentTerminalPanelLogEntry.tsx # Log entry (existing, no changes)
├── AgentStatusIndicator.tsx      # Status indicator (existing, no changes)
└── hooks/
    └── useAgentTerminalPanelState.ts  # State management hook (new)
```

### 4. Visual States & CSS Classes

```typescript
// Panel height configuration
const PANEL_HEIGHTS = {
  minimized: 'h-12',     // 48px - header only
  normal: 'h-80',        // 320px - default (configurable via props)
  maximized: 'h-full',   // Full container height
} as const

// Panel width configuration (for maximized in grid)
const PANEL_WIDTHS = {
  minimized: '',         // Normal grid column
  normal: '',            // Normal grid column
  maximized: 'col-span-full',  // Full width
} as const

// Transition classes
const PANEL_TRANSITIONS = {
  height: 'transition-[height] duration-300 ease-out',
  opacity: 'transition-opacity duration-200 ease-in-out',
  transform: 'transition-transform duration-200 ease-out',
} as const
```

### 5. Rendering Logic by State

#### Minimized State
```tsx
// Height: 48px, shows only header
<div className="h-12 overflow-hidden">
  <AgentTerminalPanelHeader
    title={title}
    agentId={agentId}
    agentStatus={agentStatus}
    panelState="minimized"
    onMaximize={onRestore}  // Click to restore
    onClose={onClose}
  />
</div>
```
- Content area hidden (`opacity-0 h-0 invisible`)
- Controls hidden
- Status bar hidden
- Only header with expand/restore button visible

#### Normal State
```tsx
// Height: 320px (configurable), full panel
<div className="h-80 flex flex-col">
  <AgentTerminalPanelHeader
    title={title}
    panelState="normal"
    onMinimize={onMinimize}
    onMaximize={onMaximize}
    onClose={onClose}
  />
  <AgentTerminalPanelControls />
  <div className="flex-1 overflow-y-auto">
    {/* Log entries */}
  </div>
  <StatusBar />
</div>
```
- Full panel with header, controls, content, status bar
- Minimize and maximize buttons visible

#### Maximized State
```tsx
// Height: 100%, full container
<div className="h-full col-span-full z-10">
  <AgentTerminalPanelHeader
    title={title}
    panelState="maximized"
    onRestore={onRestore}
    onClose={onClose}
  />
  <AgentTerminalPanelControls />
  <div className="flex-1 overflow-y-auto">
    {/* Log entries - enhanced view */}
  </div>
  <StatusBar />
</div>
```
- Full container height and width
- Restore button visible (no minimize in maximized state)
- Other panels hidden via grid or CSS

### 6. Accessibility (ARIA)

```tsx
<div
  role="region"
  aria-label={`Agent terminal panel: ${title}`}
  aria-expanded={panelState !== 'minimized'}
  aria-describedby={`${panelId}-description`}
  tabIndex={0}
  onKeyDown={handleKeyDown}
>
```

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| `Enter` / `Space` | Toggle minimize/restore (when focused) |
| `M` | Toggle maximize (when focused) |
| `Escape` | Restore from maximized |
| `Tab` | Navigate between panels |

### 7. Integration with Parent Component

The `AgentTerminalPanel` should work as a controlled component:

```tsx
// In ParallelAgentView or similar parent
const { getPanelState, minimize, maximize, restore } = useAgentTerminalPanelState()

<AgentTerminalPanel
  panelId="agent-1"
  agentId="agent-1"
  panelState={getPanelState('agent-1')}
  onMinimize={() => minimize('agent-1')}
  onMaximize={() => maximize('agent-1')}
  onRestore={() => restore('agent-1')}
/>
```

### 8. Header Component Updates

The existing `AgentTerminalPanelHeader` needs minor updates to support three states:

```typescript
interface AgentTerminalPanelHeaderProps {
  // ... existing props

  // Change from isMinimized boolean to panelState
  panelState: PanelDisplayState

  // Callbacks for all three transitions
  onMinimize?: () => void
  onMaximize?: () => void
  onRestore?: () => void
}
```

**Button visibility logic:**
- **Minimized**: Show restore/expand button only
- **Normal**: Show minimize and maximize buttons
- **Maximized**: Show restore button only

### 9. Testing Strategy

#### Unit Tests
1. Component renders correctly in all three states
2. State transitions fire correct callbacks
3. Content visibility matches state
4. ARIA attributes update correctly
5. Keyboard shortcuts work

#### Integration Tests
1. Panel state persists through re-renders
2. Works correctly as controlled component
3. Integrates with `useAgentTerminalPanelState` hook

#### Acceptance Tests (per acceptance criteria)
1. ✓ Component renders correctly in all three states
2. ✓ Props interface matches ADR-0032 specification
3. ✓ Header shows agent name, status indicator, and control buttons
4. ✓ Content area hidden when minimized

### 10. Implementation Files

| File | Action | Description |
|------|--------|-------------|
| `AgentTerminalPanel.tsx` | Modify | Update to three-state architecture |
| `AgentTerminalPanelHeader.tsx` | Modify | Update props and button logic |
| `useAgentTerminalPanelState.ts` | Create | Implement state management hook |
| `hooks/index.ts` | Modify | Export new hook |
| `agent-terminal-panel.ts` | Existing | Types already defined |

### 11. Migration Path

The change is backward-compatible with a migration path:

1. **Phase 1**: Add `panelState` prop alongside `isMinimized`
2. **Phase 2**: Update all consumers to use `panelState`
3. **Phase 3**: Deprecate and remove `isMinimized`

For this implementation, we'll implement Phase 1-2 together since the component is new enough that migration is straightforward.

## Consequences

### Positive
- Clean, maintainable three-state architecture
- Full ARIA accessibility support
- Smooth CSS-based animations
- Type-safe with existing type definitions

### Negative
- Breaking change to component props (mitigated by migration path)
- Slightly more complex state management

### Risks & Mitigations
- **Animation edge cases**: Use CSS containment and debounce rapid clicks
- **Grid layout shifts**: CSS containment and layout animations

## Implementation Checklist

- [ ] Update `AgentTerminalPanel.tsx` to support `panelState` prop
- [ ] Update state management from boolean to three-state
- [ ] Implement CSS classes for all three states
- [ ] Update `AgentTerminalPanelHeader.tsx` for three-state button logic
- [ ] Create `useAgentTerminalPanelState.ts` hook
- [ ] Add ARIA attributes and keyboard handlers
- [ ] Write unit tests for all states
- [ ] Write acceptance tests per criteria
- [ ] Verify build passes
- [ ] Verify all tests pass

## References

- ADR-0032: AgentTerminalPanel Minimize/Maximize Functionality Architecture
- ADR-003: useAgentTerminalPanelState Hook Design
- Existing Types: `packages/web-ui/src/types/agent-terminal-panel.ts`
- WAI-ARIA Disclosure Pattern
