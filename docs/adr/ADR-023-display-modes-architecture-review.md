# ADR-023: Display Modes Architecture Review

## Status
Accepted (Architecture Validation)

## Context
This ADR provides an architecture review for the compact and verbose display modes feature in the APEX CLI. The feature was requested with the following acceptance criteria:

1. `/compact` command toggles condensed output mode
2. `/verbose` command toggles detailed debug output
3. Display mode persists during session
4. StatusBar and ActivityLog adapt to mode

## Current Implementation Analysis

### Architecture Overview

The display modes system follows a **prop-drilling pattern** with state managed at the top-level `App` component and passed down to child components. This is appropriate given the shallow component hierarchy and avoids over-engineering with React Context.

```
┌─────────────────────────────────────────────────────────┐
│                     App.tsx                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ AppState { displayMode: DisplayMode }           │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│         ┌───────────────┼───────────────┐               │
│         ▼               ▼               ▼               │
│   ┌──────────┐   ┌───────────┐   ┌─────────────┐       │
│   │ StatusBar│   │TaskProgress│   │ ActivityLog │       │
│   └──────────┘   └───────────┘   └─────────────┘       │
│                                                         │
│   ┌──────────┐   ┌───────────┐   ┌─────────────┐       │
│   │AgentPanel│   │ResponseStr│   │ThoughtDisp  │       │
│   └──────────┘   └───────────┘   └─────────────┘       │
└─────────────────────────────────────────────────────────┘
```

### Type System

**Location**: `packages/core/src/types.ts` (line 385)

```typescript
export type DisplayMode = 'normal' | 'compact' | 'verbose';
```

The type is defined in the core package, making it available to all packages in the monorepo.

### State Management

**Location**: `packages/cli/src/ui/App.tsx`

```typescript
export interface AppState {
  // ... other fields
  displayMode: DisplayMode;
}
```

**Initialization**: `packages/cli/src/ui/index.tsx` (line 52)
```typescript
displayMode: 'normal', // Always initializes to normal mode
```

### Command Implementation

**Location**: `packages/cli/src/repl.tsx` (lines 1226-1252)

```typescript
// /compact command handler
async function handleCompact(): Promise<void> {
  const currentState = ctx.app?.getState();
  const newMode = currentState?.displayMode === 'compact' ? 'normal' : 'compact';
  ctx.app?.updateState({ displayMode: newMode });
  ctx.app?.addMessage({
    type: 'system',
    content: newMode === 'compact'
      ? 'Display mode set to compact: Single-line status, condensed output'
      : 'Display mode set to normal: Standard display with all components shown',
  });
}

// /verbose command handler
async function handleVerbose(): Promise<void> {
  const currentState = ctx.app?.getState();
  const newMode = currentState?.displayMode === 'verbose' ? 'normal' : 'verbose';
  ctx.app?.updateState({ displayMode: newMode });
  ctx.app?.addMessage({
    type: 'system',
    content: newMode === 'verbose'
      ? 'Display mode set to verbose: Detailed debug output, full information'
      : 'Display mode set to normal: Standard display with all components shown',
  });
}
```

**Toggle Behavior**:
- `/compact`: Toggles between `normal` ↔ `compact`
- `/verbose`: Toggles between `normal` ↔ `verbose`
- Commands are mutually exclusive (compact → normal before verbose can be set)

### Component Adaptations

#### StatusBar (`packages/cli/src/ui/components/StatusBar.tsx`)

**Compact Mode** (lines 186-212):
- Shows only essential information: connection indicator (● or ○), git branch, cost
- Single-line format for minimal vertical space
- Removes agent, workflow stage, session name, API URL

**Verbose Mode** (lines 304-434):
- Shows detailed timing: active time, idle time, stage elapsed time
- Token breakdown: `tokens: input→output` format
- Separate session cost vs task cost
- "🔍 VERBOSE" indicator
- Full metadata display

**Normal Mode** (lines 214-302):
- Standard display with connection, git branch, agent, workflow stage
- Subtask progress, session name, API/Web URLs
- Session timer, tokens, cost, model indicator

#### ActivityLog (`packages/cli/src/ui/components/ActivityLog.tsx`)

**Compact Mode**:
- Abbreviated timestamps
- Reduced message length based on terminal width
- Hides optional metadata

**Verbose Mode** (lines 147-150):
- Auto-sets filter level to 'debug' to show all log entries
- Full timestamps with milliseconds
- Shows all data fields

**Normal Mode**:
- Standard timestamps
- Filter level defaults to 'info'
- Balanced information display

#### Other Components

| Component | Compact Behavior | Verbose Behavior |
|-----------|------------------|------------------|
| `TaskProgress` | Minimal layout, condensed info | Full progress with timing details |
| `AgentPanel` | Single-line current agent only | Full agent list with debug info |
| `ResponseStream` | Truncated messages | Full content display |
| `ThoughtDisplay` | Returns early, minimal display | 1000 char limit vs 200 in normal |
| `ToolCall` | Single-line summary | Full JSON input/output |
| `CollapsibleSection` | Auto-collapsed | Expanded with full content |
| `AgentThoughts` | Hidden or minimal | Full thought content visible |

### Message Filtering

**Location**: `packages/cli/src/ui/App.tsx` (lines 725-734)

```typescript
// Filter messages based on display mode
if (state.displayMode === 'compact') {
  // In compact mode, hide system and tool messages to save space
} else if (state.displayMode === 'verbose') {
  // In verbose mode, show all messages including debug info
}
```

### Session Persistence

**Current Status**: Display mode persists **within session** (in-memory) but does **NOT persist across sessions**.

**Storage**: Not stored in `SessionStore.ts` - each new session starts with `displayMode: 'normal'`

**Design Decision**: This is intentional to avoid surprising behavior and keep implementation simple. The ADR-020 explicitly states this as a design choice.

## Acceptance Criteria Validation

| Criteria | Status | Implementation |
|----------|--------|----------------|
| `/compact` toggles condensed output | ✅ | `handleCompact()` in repl.tsx |
| `/verbose` toggles debug output | ✅ | `handleVerbose()` in repl.tsx |
| Display mode persists during session | ✅ | In-memory `AppState.displayMode` |
| StatusBar adapts to mode | ✅ | `buildSegments()` with mode-specific rendering |
| ActivityLog adapts to mode | ✅ | Filter level and formatting adjustments |

## Technical Design Summary

### Architecture Pattern: Prop Drilling with Top-Level State

**Rationale**:
- Shallow component hierarchy makes prop drilling manageable
- Avoids React Context complexity for a simple state value
- Clear data flow from App → child components
- Easy to trace state changes through the component tree

### State Flow Diagram

```
User Command (/compact or /verbose)
         │
         ▼
    REPL Handler (handleCompact/handleVerbose)
         │
         ├──► ctx.app?.getState() // Read current mode
         │
         ├──► Calculate new mode (toggle logic)
         │
         ├──► ctx.app?.updateState({ displayMode: newMode })
         │         │
         │         ▼
         │    App.tsx setState()
         │         │
         │         ▼
         │    Re-render with new displayMode prop
         │         │
         │    ┌────┴─────────────────────┐
         │    ▼    ▼    ▼    ▼    ▼      ▼
         │   SB   TP   AP   RS   TD   AL  (components)
         │
         └──► ctx.app?.addMessage() // User feedback
```

### Responsive Design Integration

The display mode system integrates with the responsive design hook:

```typescript
const { width, breakpoint } = useStdoutDimensions();
```

Components use both terminal dimensions AND display mode to determine layout:
- Narrow terminal + compact mode → most condensed output
- Wide terminal + verbose mode → most detailed output
- Normal mode respects responsive breakpoints

### Test Coverage

The implementation includes comprehensive test suites:

- **Unit Tests**: Display mode type validation, component props
- **Integration Tests**: Command flow, state updates, component coordination
- **E2E Tests**: Full command lifecycle, mode transitions
- **Component Tests**: StatusBar, ActivityLog, TaskProgress, AgentPanel

Test files:
- `packages/cli/src/__tests__/display-modes-comprehensive.e2e.test.tsx`
- `packages/cli/src/ui/__tests__/App.displayMode.test.tsx`
- `packages/cli/src/ui/__tests__/display-modes.unit.test.tsx`
- `packages/cli/src/ui/components/__tests__/StatusBar.display-modes.test.tsx`
- `packages/cli/src/ui/components/__tests__/ActivityLog.display-modes.test.tsx`

## Future Enhancement Opportunities

### 1. Cross-Session Persistence (Deferred)

If users request persistent display mode preferences:

**Option A**: Store in `SessionStore.SessionState`
```typescript
export interface SessionState {
  // existing fields
  displayMode?: DisplayMode;
}
```

**Option B**: Store in `.apex/config.yaml`
```yaml
cli:
  displayMode: compact  # or normal, verbose
```

### 2. Keyboard Shortcuts (Optional)

Direct key bindings could be added:
- `Ctrl+K`: Toggle compact mode
- `Ctrl+V`: Toggle verbose mode (conflicts with paste - needs alternative)

### 3. Per-Component Mode Overrides (Complex)

Allow users to set different modes per component:
```
/compact statusbar  # Only compact the status bar
/verbose activity   # Only verbose the activity log
```

## Consequences

### Positive
- Clean separation of concerns with mode-specific rendering
- Consistent user experience across all components
- Simple toggle commands are easy to remember
- No configuration file complexity for session-only persistence
- Comprehensive test coverage ensures reliability

### Negative
- Prop drilling adds boilerplate to component interfaces
- Each new component must handle all three display modes
- Mode state could theoretically diverge if handlers aren't synchronized

### Mitigations
- TypeScript ensures `displayMode` prop is properly typed
- Single source of truth in `AppState` prevents divergence
- ADR documentation ensures consistent implementation patterns

## Related ADRs

- **ADR-020**: Initial display modes design decision
- **ADR-021**: Compact mode implementation details
- **ADR-022**: Verbose mode enhanced implementation

## Conclusion

The display modes architecture is **complete and well-designed**. It meets all acceptance criteria with a pragmatic implementation that balances simplicity with functionality. The feature requires no additional implementation work - only documentation and validation of the existing code.
