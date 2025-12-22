# ADR-021: Compact Mode Implementation Details

## Status
Accepted (Architecture Verification)

## Context
This ADR documents the technical architecture for compact mode UI behavior as specified in the acceptance criteria:

> In compact mode: StatusBar shows minimal info (just status icon, branch, cost). AgentPanel uses compact=true. TaskProgress shows single-line status. Messages truncated to single line. ActivityLog is hidden.

This document serves as the architecture reference for the development stage to verify and complete the implementation.

## Current Implementation State

### Analysis Summary

Compact mode is **substantially implemented** across all major UI components. The architecture follows a consistent pattern of:
1. `DisplayMode` type defined in `@apexcli/core`
2. `displayMode` state managed in `AppState` (App.tsx)
3. Props propagation to child components
4. Conditional rendering based on `displayMode === 'compact'`

### Component-by-Component Architecture

#### 1. StatusBar (`packages/cli/src/ui/components/StatusBar.tsx`)

**Current Implementation (lines 149-175):**
```typescript
if (props.displayMode === 'compact') {
  // Shows: connection icon, agent name, elapsed time
  left.push({ icon: isConnected ? '●' : '○', ... });
  if (props.agent) left.push({ value: props.agent, ... });
  right.push({ value: elapsed, ... });
  return { left, right };
}
```

**Acceptance Criteria:**
- Status icon ✅ (connection indicator)
- Branch ⚠️ (NOT currently shown in compact - needs to be added)
- Cost ⚠️ (NOT currently shown in compact - needs to be added)

**Required Change:**
Update compact mode to show: `● branch | $cost` instead of `● agent | elapsed`

**Architectural Decision:**
Keep elapsed time but add branch and cost. The compact StatusBar should show:
- Left: `● [branch]`
- Right: `$cost [elapsed]`

#### 2. AgentPanel (`packages/cli/src/ui/components/agents/AgentPanel.tsx`)

**Current Implementation (lines 58-109):**
```typescript
const useCompactDisplay = compact || displayMode === 'compact';
if (useCompactDisplay) {
  // Single line: ⚡developer[42s] | ○tester | ○reviewer
  return (
    <Box>
      {agents.map((agent, index) => (
        <React.Fragment key={agent.name}>
          <Text color={...}>{statusIcons[agent.status]}{agent.name}[elapsed]</Text>
          {index < agents.length - 1 && <Text color="gray"> │ </Text>}
        </React.Fragment>
      ))}
    </Box>
  );
}
```

**Acceptance Criteria:**
- Uses `compact=true` ✅ (via `displayMode === 'compact'` which sets `useCompactDisplay`)

**Status:** ✅ Complete - No changes needed

#### 3. TaskProgress (`packages/cli/src/ui/components/TaskProgress.tsx`)

**Current Implementation (lines 103-125):**
```typescript
if (displayMode === 'compact') {
  return (
    <Box gap={1}>
      {getStatusIcon(status)}
      <Text color={getStatusColor(status)} bold>{status}</Text>
      <Text color="gray" dimColor>{taskId.slice(0, 8)}</Text>
      <Text>{truncateDescription(description, 40)}</Text>
      {agent && <Text color="magenta">⚡{agent}</Text>}
      {tokens && <Text color="cyan">{formatTokens(...)}tk</Text>}
      {cost !== undefined && <Text color="green">{formatCost(cost)}</Text>}
    </Box>
  );
}
```

**Acceptance Criteria:**
- Single-line status ✅

**Status:** ✅ Complete - No changes needed

#### 4. Messages (ResponseStream - `packages/cli/src/ui/components/ResponseStream.tsx`)

**Current Implementation (lines 255-275):**
```typescript
if (displayMode === 'compact') {
  const truncatedContent = content.length > 80 ? content.slice(0, 80) + '...' : content;
  return (
    <Box gap={1}>
      {agent && <Text color="magenta">[{agent}]</Text>}
      {type !== 'text' && <Text color={getTypeColor()}>{getTypePrefix()}</Text>}
      <Text>{truncatedContent.replace(/\n/g, ' ')}</Text>
      {isStreaming && <Text color="cyan" dimColor>█</Text>}
    </Box>
  );
}
```

**Acceptance Criteria:**
- Truncated to single line ✅

**Status:** ✅ Complete - No changes needed

#### 5. ActivityLog (`packages/cli/src/ui/components/ActivityLog.tsx`)

**Current Implementation:**
- ActivityLog is **not rendered** in compact mode - it's filtered at the App.tsx level
- Messages filtering (App.tsx lines 721-732) hides system and tool messages in compact mode
- ActivityLog component itself does NOT have a `displayMode` prop

**App.tsx filtering logic:**
```typescript
if (state.displayMode === 'compact') {
  return msg.type !== 'system' && msg.type !== 'tool';
}
```

**Acceptance Criteria:**
- ActivityLog is hidden ✅ (via filtering, not rendering)

**Status:** ✅ Complete - No changes needed (hidden by not being rendered)

#### 6. ToolCall (`packages/cli/src/ui/components/ToolCall.tsx`)

**Current Implementation:**
- Has `displayMode?: DisplayMode` prop
- Compact mode shows single-line format with truncated input

**Status:** ✅ Complete - No changes needed

## Data Flow Architecture

```
User toggles /compact
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  AppState.displayMode = 'compact'                     │
│  (packages/cli/src/ui/App.tsx)                       │
└───────────────────────────────────────────────────────┘
        │
        ├───────┬───────┬───────┬───────┬───────┐
        ▼       ▼       ▼       ▼       ▼       ▼
   StatusBar  AgentPanel  TaskProgress  ResponseStream  ToolCall  (Messages filtered)
   [compact]  [compact]   [compact]     [compact]       [compact] [system/tool hidden]
```

### State Management Pattern

```typescript
// Type definition (packages/core/src/types.ts)
export type DisplayMode = 'normal' | 'compact' | 'verbose';

// App state (packages/cli/src/ui/App.tsx)
export interface AppState {
  displayMode: DisplayMode;
  // ...
}

// Command handler (packages/cli/src/ui/App.tsx lines 210-225, 473-488)
if (command === 'compact') {
  const newMode = prev.displayMode === 'compact' ? 'normal' : 'compact';
  setState((prev) => ({ ...prev, displayMode: newMode }));
}
```

## Required Implementation Changes

### 1. StatusBar Compact Mode Update

**File:** `packages/cli/src/ui/components/StatusBar.tsx`

**Current Code (lines 149-175):**
```typescript
if (props.displayMode === 'compact') {
  // Show only connection status, active agent, and elapsed time
  left.push({
    icon: props.isConnected !== false ? '●' : '○',
    iconColor: props.isConnected !== false ? 'green' : 'red',
    value: '',
    valueColor: 'white',
    minWidth: 2,
  });

  if (props.agent) {
    left.push({
      value: props.agent,
      valueColor: 'white',
      minWidth: props.agent.length,
    });
  }

  right.push({
    value: elapsed,
    valueColor: 'gray',
    minWidth: 6,
  });

  return { left, right };
}
```

**Required Change - Replace with:**
```typescript
if (props.displayMode === 'compact') {
  // Show only: status icon, branch, cost (per acceptance criteria)
  left.push({
    icon: props.isConnected !== false ? '●' : '○',
    iconColor: props.isConnected !== false ? 'green' : 'red',
    value: '',
    valueColor: 'white',
    minWidth: 2,
  });

  if (props.gitBranch) {
    left.push({
      icon: '',
      iconColor: 'cyan',
      value: props.gitBranch,
      valueColor: 'yellow',
      minWidth: props.gitBranch.length + 3,
    });
  }

  if (props.cost !== undefined) {
    right.push({
      value: `$${props.cost.toFixed(2)}`,
      valueColor: 'green',
      minWidth: 8,
    });
  }

  return { left, right };
}
```

**Visual Result:**
- Before: `● developer | 05:23`
- After: `●  main | $0.42`

**Rationale:**
The acceptance criteria explicitly requires "status icon, branch, cost" which differs from the current implementation showing "status icon, agent, elapsed".

### 2. No Other Changes Required

All other components already implement compact mode correctly per the acceptance criteria:
- AgentPanel: Single-line with pipe separators ✅
- TaskProgress: Single-line with essential info ✅
- Messages/ResponseStream: Truncated to 80 chars, single line ✅
- ActivityLog: Hidden (not rendered) ✅
- ToolCall: Single-line format ✅

## Consequences

### Positive
- Minimal code changes required (only StatusBar needs update)
- Architecture is already well-designed for display modes
- Consistent prop pattern across all components
- Clear separation of concerns (state in App, rendering in components)

### Negative
- StatusBar change may affect users who prefer seeing agent name in compact mode
- Consider adding a "compact-verbose" or user-configurable compact mode in future

### Risks
- None significant - this is a minor UI adjustment

## Implementation Checklist for Developer Stage

- [ ] Update StatusBar compact mode to show: `● [branch] | $cost [elapsed]`
- [ ] Verify AgentPanel uses compact display in compact mode
- [ ] Verify TaskProgress shows single-line status
- [ ] Verify messages are truncated to single line
- [ ] Verify ActivityLog is hidden (not rendered) in compact mode
- [ ] Add unit tests for compact mode behavior
- [ ] Manual testing of `/compact` toggle command

## Files to Modify

1. `packages/cli/src/ui/components/StatusBar.tsx` - Update compact mode section

## Files to Verify (No Changes Expected)

1. `packages/cli/src/ui/components/TaskProgress.tsx` - Verify single-line compact mode
2. `packages/cli/src/ui/components/agents/AgentPanel.tsx` - Verify compact display
3. `packages/cli/src/ui/components/ResponseStream.tsx` - Verify truncation
4. `packages/cli/src/ui/App.tsx` - Verify message filtering and ActivityLog exclusion
