# ADR-007: Display Modes (Compact and Verbose)

## Status
Accepted (Implemented)

## Context
Users need the ability to control the verbosity of the APEX CLI output to match their preferences and use cases:
- **Compact mode**: Minimizes visual noise for experienced users who want only essential status information
- **Verbose mode**: Provides detailed debug information for troubleshooting and understanding agent behavior

## Decision

### Display Mode Architecture

We will implement a display mode system with three states: `normal` (default), `compact`, and `verbose`. The mode will be stored in the global `ApexContext` and propagated to UI components via `AppState`.

### State Management

#### 1. Display Mode Type Definition
Add to `packages/core/src/types.ts`:

```typescript
export type DisplayMode = 'normal' | 'compact' | 'verbose';
```

#### 2. Context Extension
Add to `ApexContext` in `packages/cli/src/repl.tsx`:

```typescript
interface ApexContext {
  // ... existing fields
  displayMode: DisplayMode;
}
```

Initialize in the context:
```typescript
const ctx: ApexContext = {
  // ... existing fields
  displayMode: 'normal',
};
```

#### 3. App State Extension
Add to `AppState` in `packages/cli/src/ui/App.tsx`:

```typescript
export interface AppState {
  // ... existing fields
  displayMode: DisplayMode;
}
```

### Command Implementation

#### `/compact` Command
- **Behavior**: Toggles compact mode on/off (cycles: normal → compact → normal)
- **Location**: Add handler in `packages/cli/src/repl.tsx`

```typescript
async function handleCompact(): Promise<void> {
  const newMode: DisplayMode = ctx.displayMode === 'compact' ? 'normal' : 'compact';
  ctx.displayMode = newMode;
  ctx.app?.updateState({ displayMode: newMode });
  ctx.app?.addMessage({
    type: 'system',
    content: newMode === 'compact'
      ? 'Compact mode enabled - condensed output active'
      : 'Normal display mode restored',
  });
}
```

#### `/verbose` Command
- **Behavior**: Toggles verbose mode on/off (cycles: normal → verbose → normal)
- **Location**: Add handler in `packages/cli/src/repl.tsx`

```typescript
async function handleVerbose(): Promise<void> {
  const newMode: DisplayMode = ctx.displayMode === 'verbose' ? 'normal' : 'verbose';
  ctx.displayMode = newMode;
  ctx.app?.updateState({ displayMode: newMode });
  ctx.app?.addMessage({
    type: 'system',
    content: newMode === 'verbose'
      ? 'Verbose mode enabled - showing debug information'
      : 'Normal display mode restored',
  });
}
```

### Component Behavior by Display Mode

#### Compact Mode Behavior
| Component | Normal | Compact |
|-----------|--------|---------|
| Banner | Full header with project info | Single line: "APEX v0.3.0 \| project-name" |
| StatusBar | Full status with all metrics | Single line: essential metrics only |
| ActivityLog | Full log view | Hidden completely |
| Messages | Full message content | Truncated to single line per message |
| AgentPanel | Full agent list with status | Single line: current agent only |
| TaskProgress | Full progress display | Single line: "Task: [status] agent-name" |
| ToolCall | Expandable tool call details | Single line: "tool: input-summary" |

#### Verbose Mode Behavior
| Component | Normal | Verbose |
|-----------|--------|---------|
| Banner | Standard | Same + build info |
| StatusBar | Standard | Same + detailed token breakdown |
| Messages | Standard | Same + timestamps + message IDs |
| ToolCall | Standard | Same + full input/output JSON |
| Debug Info | Hidden | Show all debug logs |
| Agent Events | Minimal | Full event stream with timing |

### UI Component Changes

#### 1. App.tsx Changes
Pass `displayMode` to all child components:

```tsx
<Banner
  version={VERSION}
  projectPath={state.projectPath}
  initialized={state.initialized}
  displayMode={state.displayMode}  // NEW
/>

{/* Conditionally render ActivityLog based on display mode */}
{state.displayMode !== 'compact' && (
  <ActivityLog ... />
)}

<StatusBar
  // ... existing props
  displayMode={state.displayMode}  // NEW
/>
```

#### 2. StatusBar.tsx Changes
Add compact rendering mode:

```tsx
interface StatusBarProps {
  // ... existing props
  displayMode?: DisplayMode;
}

// In component:
if (displayMode === 'compact') {
  return (
    <Box paddingX={1}>
      <Text color="gray">
        {isConnected ? '●' : '○'} {gitBranch || 'no-branch'} |
        {agent ? `⚡${agent}` : '...'} |
        ${cost?.toFixed(2) || '0.00'}
      </Text>
    </Box>
  );
}
```

#### 3. Banner.tsx Changes
Add compact rendering mode:

```tsx
interface BannerProps {
  // ... existing props
  displayMode?: DisplayMode;
}

// In component:
if (displayMode === 'compact') {
  return (
    <Box>
      <Text color="cyan" bold>APEX v{version}</Text>
      <Text color="gray"> | </Text>
      <Text color="yellow">{projectPath ? path.basename(projectPath) : 'not initialized'}</Text>
    </Box>
  );
}
```

#### 4. ResponseStream.tsx Changes
Support truncated messages in compact mode:

```tsx
interface ResponseStreamProps {
  // ... existing props
  displayMode?: DisplayMode;
}

// In component:
const displayContent = displayMode === 'compact' && content.length > 100
  ? content.substring(0, 97) + '...'
  : content;
```

### Command Routing
Add to `handleCommand` switch in `packages/cli/src/repl.tsx`:

```typescript
case 'compact':
  await handleCompact();
  break;
case 'verbose':
  await handleVerbose();
  break;
```

Add to suggestions in `getSmartSuggestions()` in `packages/cli/src/ui/App.tsx`:

```typescript
const commands = [
  // ... existing commands
  '/compact',
  '/verbose',
];
```

### Help Text Updates
Add to help overlay in `App.tsx`:

```tsx
<Text>
  <Text color="yellow">/compact</Text>
  <Text color="gray"> - Toggle compact display mode</Text>
</Text>
<Text>
  <Text color="yellow">/verbose</Text>
  <Text color="gray"> - Toggle verbose/debug output</Text>
</Text>
```

### Session Persistence
The display mode state persists within the CLI session (in-memory) but does NOT persist to disk. Each new session starts with `normal` mode. This is intentional to avoid surprising behavior.

If future requirements call for persistent display mode:
- Store in `.apex/config.yaml` under `cli.displayMode`
- Load on startup in `startInkREPL()`

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/core/src/types.ts` | Add type | Add `DisplayMode` type |
| `packages/cli/src/repl.tsx` | Modify | Add display mode to context, command handlers |
| `packages/cli/src/ui/App.tsx` | Modify | Add to state, pass to components, update help |
| `packages/cli/src/ui/components/Banner.tsx` | Modify | Add compact rendering |
| `packages/cli/src/ui/components/StatusBar.tsx` | Modify | Add compact rendering |
| `packages/cli/src/ui/components/ResponseStream.tsx` | Modify | Add message truncation |
| `packages/cli/src/ui/components/ToolCall.tsx` | Modify | Add verbose output |

## Consequences

### Positive
- Users can customize output verbosity to their needs
- Compact mode reduces visual noise for focused work
- Verbose mode aids debugging and understanding agent behavior
- Simple toggle commands are easy to remember and use
- In-memory state means no configuration file pollution

### Negative
- More props to pass through component tree
- Each component needs to handle multiple display modes
- Potential for inconsistent behavior if components don't all respect the mode

### Risks
- Display mode state could become out of sync between context and app state
- Mitigation: Always update both simultaneously via `handleCompact/handleVerbose`

## Implementation Order

1. Add `DisplayMode` type to core package
2. Add display mode state to `ApexContext` and `AppState`
3. Implement `/compact` and `/verbose` command handlers
4. Update `Banner` component for compact mode
5. Update `StatusBar` component for compact mode
6. Update `App.tsx` to conditionally render `ActivityLog`
7. Update `ResponseStream` for message truncation
8. Update `ToolCall` for verbose output
9. Update help text and command suggestions
10. Test all display modes

## Alternatives Considered

### Single `/display <mode>` Command
- **Rejected**: Less discoverable, requires remembering mode names
- Toggle commands are more intuitive and quicker to use

### Persistent Display Mode
- **Deferred**: In-memory only for now; can add persistence later if needed
- Keeps implementation simpler and avoids config file changes

### React Context for Display Mode
- **Rejected**: Overkill for this use case
- Props are sufficient given the shallow component hierarchy
