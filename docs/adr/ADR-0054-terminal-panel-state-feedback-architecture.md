# ADR-0054: Terminal Panel State Feedback Architecture

## Status
**Proposed**

## Context

The `AgentTerminalPanel` component needs terminal-friendly accessibility feedback for panel state changes (minimized, maximized, normal). Traditional web applications use ARIA live regions for screen reader announcements, but terminal environments (CLI/TUI using Ink) don't have native ARIA support. This creates an accessibility gap for terminal users.

### Current State

- `AgentTerminalPanel` exists in both CLI (`packages/cli/src/ui/components/agents/`) and web-ui (`packages/web-ui/src/components/agents/`) packages
- Panel states are defined in `PanelState` enum: `Normal`, `Minimized`, `Maximized`
- The web-ui version has ARIA attributes (`aria-label`, `aria-expanded`, `tabIndex`)
- The CLI version uses Ink (React for terminal) but lacks ARIA-equivalent feedback
- Display modes exist: `normal`, `compact`, `verbose` (defined in `TerminalPanelDisplayMode`)

### Requirements from Acceptance Criteria

1. Component provides ARIA-equivalent terminal feedback via status text
2. Shows current state (e.g., '[minimized]', '[maximized]', '[normal]')
3. Feedback is accessible via `displayMode='verbose'`
4. Always shown when panel is focused

## Decision

### 1. Status Text Feedback Strategy

**Decision**: Add a `statusText` property to the rendered output that displays panel state as bracketed text labels.

```typescript
// Status text format for terminal accessibility
type PanelStateStatusText = '[minimized]' | '[maximized]' | '[normal]';

// Function to derive status text from panel state
export function getPanelStateStatusText(state: PanelState): PanelStateStatusText {
  const STATUS_TEXT_MAP: Record<PanelState, PanelStateStatusText> = {
    [PanelState.Minimized]: '[minimized]',
    [PanelState.Maximized]: '[maximized]',
    [PanelState.Normal]: '[normal]',
  };
  return STATUS_TEXT_MAP[state];
}
```

**Rationale**:
- Bracketed format (`[state]`) is a recognized terminal convention for status indicators
- Visually distinct from content text
- Easy for screen readers and terminal users to identify
- Consistent with Unix/Linux terminal conventions

### 2. Conditional Display Logic

**Decision**: Status text visibility is controlled by `displayMode` and `focused` props.

```typescript
// Display conditions for status text
interface StatusTextDisplayConditions {
  displayMode: TerminalPanelDisplayMode;
  focused: boolean;
  panelState?: PanelState;
}

function shouldShowStatusText(conditions: StatusTextDisplayConditions): boolean {
  const { displayMode, focused, panelState } = conditions;

  // Always show in verbose mode
  if (displayMode === 'verbose') {
    return true;
  }

  // Show when focused (regardless of display mode)
  if (focused) {
    return true;
  }

  // In normal mode, only show if state is not 'normal' (changed state)
  if (displayMode === 'normal' && panelState && panelState !== PanelState.Normal) {
    return true;
  }

  // Hide in compact mode unless focused
  return false;
}
```

**Rationale**:
- Verbose mode shows all information (matches acceptance criteria)
- Focused panels always show status (keyboard accessibility requirement)
- Compact mode minimizes visual noise but respects focus
- Non-normal states always surface feedback (accessibility best practice)

### 3. Component Interface Changes

**Decision**: Extend `AgentTerminalPanelProps` interface with optional status feedback props.

```typescript
export interface AgentTerminalPanelProps {
  // ... existing props ...

  /**
   * Current panel display state for controlled mode
   * When provided, enables state feedback functionality
   * @see PanelState
   */
  panelState?: PanelState;

  /**
   * Whether to show status text feedback for panel state
   * - 'auto': Show based on displayMode and focus state (default)
   * - 'always': Always show status text
   * - 'never': Never show status text
   * @default 'auto'
   */
  showStateStatus?: 'auto' | 'always' | 'never';

  /**
   * Callback invoked when panel state changes (for state change announcements)
   * Useful for parent components that manage multiple panels
   */
  onStateChange?: (newState: PanelState, previousState: PanelState) => void;
}
```

### 4. Visual Placement

**Decision**: Status text appears in the header section, adjacent to the agent name.

```
┌─────────────────────────────────────────────────┐
│ ● Test Agent [minimized]        1m 30s          │
└─────────────────────────────────────────────────┘
```

**Layout Structure**:
```tsx
<HeaderSection>
  <Box alignItems="center" gap={1}>
    <AgentStatusIndicator status={indicatorStatus} />
    <Text>{displayName}</Text>
    {shouldShowStatusText && (
      <Text dimColor color="gray">{getPanelStateStatusText(panelState)}</Text>
    )}
  </Box>
  {/* Elapsed time, etc. */}
</HeaderSection>
```

**Rationale**:
- Header is visible in all panel states (including minimized)
- Adjacent to agent name provides context
- Dimmed color prevents visual dominance
- Consistent with terminal UI conventions

### 5. Implementation Architecture

**Decision**: Create a dedicated `PanelStateStatus` sub-component for encapsulation.

```typescript
// packages/cli/src/ui/components/agents/PanelStateStatus.tsx

export interface PanelStateStatusProps {
  /** Current panel state */
  panelState: PanelState;

  /** Current display mode */
  displayMode: TerminalPanelDisplayMode;

  /** Whether the panel is focused */
  focused: boolean;

  /** Override visibility ('auto' uses displayMode/focused logic) */
  visibility?: 'auto' | 'always' | 'never';
}

export function PanelStateStatus({
  panelState,
  displayMode,
  focused,
  visibility = 'auto',
}: PanelStateStatusProps): React.ReactElement | null {
  // Calculate visibility
  const isVisible = visibility === 'always' ||
    (visibility === 'auto' && shouldShowStatusText({ displayMode, focused, panelState }));

  if (!isVisible) {
    return null;
  }

  const statusText = getPanelStateStatusText(panelState);

  return (
    <Text dimColor color="gray">
      {statusText}
    </Text>
  );
}
```

### 6. State Change Announcements

**Decision**: Use React effect to detect state changes and invoke callback.

```typescript
// In AgentTerminalPanel.tsx
function useStateChangeAnnouncement(
  currentState: PanelState | undefined,
  onStateChange?: (newState: PanelState, previousState: PanelState) => void
) {
  const previousStateRef = useRef<PanelState | undefined>(currentState);

  useEffect(() => {
    if (
      currentState !== undefined &&
      previousStateRef.current !== undefined &&
      currentState !== previousStateRef.current &&
      onStateChange
    ) {
      onStateChange(currentState, previousStateRef.current);
    }
    previousStateRef.current = currentState;
  }, [currentState, onStateChange]);
}
```

**Rationale**:
- Enables parent components to provide additional feedback (e.g., toast, sound)
- Maintains separation of concerns
- Does not modify core component behavior

### 7. Type Exports

**Decision**: Export all state feedback types from the types file.

```typescript
// In AgentTerminalPanel.types.ts

export {
  PanelState,
  getPanelStateStatusText,
  shouldShowStatusText,
  type PanelStateStatusText,
  type StatusTextDisplayConditions,
};
```

### 8. Test Strategy

**Tests Required**:

1. **Unit Tests** (`PanelStateStatus.test.tsx`):
   - Renders correct status text for each state
   - Visibility logic matches specification
   - Handles undefined/null states gracefully

2. **Integration Tests** (`AgentTerminalPanel.status-feedback.test.tsx`):
   - Status text appears in verbose mode
   - Status text appears when focused
   - Status text hidden in compact mode (unless focused)
   - State change callback invoked correctly

3. **Accessibility Tests**:
   - Status text is readable by screen readers
   - Focus triggers status visibility
   - Status text uses accessible color contrast

## File Changes

### New Files
- `packages/cli/src/ui/components/agents/PanelStateStatus.tsx`
- `packages/cli/src/ui/components/agents/__tests__/PanelStateStatus.test.tsx`
- `packages/cli/src/ui/components/agents/__tests__/AgentTerminalPanel.status-feedback.test.tsx`

### Modified Files
- `packages/cli/src/ui/components/agents/AgentTerminalPanel.tsx` - Add PanelStateStatus integration
- `packages/cli/src/ui/components/agents/AgentTerminalPanel.types.ts` - Add types and utilities
- `packages/cli/src/ui/components/agents/index.ts` - Export new component

## Consequences

### Positive
1. **Terminal accessibility**: Provides ARIA-equivalent feedback for terminal users
2. **Configurable visibility**: Users can choose when to see status feedback
3. **Focus-aware**: Respects keyboard navigation context
4. **Consistent patterns**: Follows established codebase conventions
5. **Testable**: Encapsulated logic is easy to unit test

### Negative
1. **Additional visual element**: May increase visual complexity in verbose mode
2. **Performance overhead**: Additional render logic (minimal impact)

### Mitigations
1. **Visual complexity**: Dimmed color minimizes visual impact; hidden by default in compact mode
2. **Performance**: Memoization of visibility calculation

## Integration with Web-UI

The web-ui `AgentTerminalPanel` already has ARIA attributes. This ADR focuses on the CLI terminal version. However, for consistency:

- The status text format (`[state]`) could be added as `aria-describedby` content in web-ui
- The `onStateChange` callback pattern should be available in both packages

## References

- ADR-0032: AgentTerminalPanel Minimize/Maximize Architecture
- Existing Types: `packages/cli/src/ui/components/agents/AgentTerminalPanel.types.ts`
- Hook: `packages/cli/src/ui/hooks/useAgentTerminalPanelState.ts`
- WAI-ARIA Live Regions: https://www.w3.org/WAI/ARIA/apg/patterns/alert/
