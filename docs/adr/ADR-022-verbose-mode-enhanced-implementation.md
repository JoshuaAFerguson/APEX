# ADR-022: Verbose Mode Enhanced Implementation Architecture

## Status
Proposed

## Date
2024-12-17

## Related ADRs
- ADR-020: Display Modes (Compact and Verbose) - Base architecture

## Context

APEX CLI needs enhanced verbose mode functionality to provide detailed debugging information for troubleshooting and advanced users. While ADR-020 established the foundational display modes architecture, this ADR specifies the detailed implementation for verbose mode enhancements.

The acceptance criteria specify:

1. **Token breakdown**: Show input/output tokens separately
2. **Detailed timing info**: Show comprehensive timing information
3. **Agent debug info**: Show detailed agent information in AgentPanel
4. **ActivityLog debug level**: Show debug-level logs
5. **StatusBar all info**: Show all available information

Currently, verbose mode exists as a `DisplayMode` type but provides minimal differentiation from normal mode beyond bypassing width-based segment filtering in StatusBar.

## Decision

We will implement verbose mode enhancements through a layered architecture that respects existing patterns while adding debug-specific information.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      App.tsx (State Manager)                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  AppState.displayMode: DisplayMode ('normal'|'compact'|'verbose') │
│  │  AppState.tokens: { input, output }                           │
│  │  AppState.verboseData?: VerboseDebugData (NEW)               │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│              displayMode + verboseData passed to components       │
└──────────────────────────────┼────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────────┐
        │                      │                          │
        ▼                      ▼                          ▼
┌───────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   StatusBar   │    │   AgentPanel    │    │   ActivityLog    │
│               │    │                 │    │                  │
│ verbose mode: │    │ verbose mode:   │    │ verbose mode:    │
│ - Token I/O   │    │ - Debug metrics │    │ - filterLevel:   │
│ - Detailed    │    │ - Stage timing  │    │   'debug'        │
│   timing      │    │ - Token/agent   │    │ - Full data      │
│ - All metrics │    │ - Handoff info  │    │   expansion      │
└───────────────┘    └─────────────────┘    └──────────────────┘
```

### Component-Level Design

#### 1. StatusBar Verbose Mode Enhancement

**Current State**: Shows total tokens as `1.5k`
**Verbose State**: Shows input/output breakdown as `1.2k→300` with detailed cost

```typescript
// StatusBar.tsx - Enhanced verbose token display
interface StatusBarProps {
  // existing props...
  tokens?: { input: number; output: number };
  displayMode?: DisplayMode;
  // NEW: Optional detailed timing for verbose mode
  detailedTiming?: {
    totalElapsed: number;      // Total session time in ms
    activeTime: number;        // Time spent processing
    idleTime: number;          // Time waiting for input
    stageTimings?: Record<string, number>;  // Per-stage timing
  };
}

// In buildSegments() for verbose mode:
if (props.displayMode === 'verbose' && props.tokens) {
  right.push({
    label: 'tokens:',
    labelColor: 'gray',
    value: `${formatTokens(input)}→${formatTokens(output)}`, // "1.2k→300"
    valueColor: 'cyan',
    minWidth: 16,
  });

  // Also show total for context
  right.push({
    label: 'total:',
    labelColor: 'gray',
    value: formatTokens(input + output),
    valueColor: 'cyan',
    minWidth: 10,
  });
}
```

**Key Design Decisions**:
- Use the existing `TokenCounter` component pattern (`input→output` format)
- Show both breakdown AND total in verbose mode for complete information
- Add detailed timing segment when `detailedTiming` prop is provided

#### 2. AgentPanel Verbose Mode Enhancement

**Current State**: Shows agent name, status, and stage
**Verbose State**: Shows additional debug information

```typescript
// AgentPanel.tsx - Enhanced verbose display
interface AgentInfo {
  name: string;
  status: 'active' | 'waiting' | 'completed' | 'idle' | 'parallel';
  stage?: string;
  progress?: number;
  startedAt?: Date;
  // NEW: Verbose mode additions
  tokensUsed?: { input: number; output: number };
  stageStartedAt?: Date;
  lastToolCall?: string;
  turnCount?: number;
}

// New VerboseAgentRow component
function VerboseAgentRow({ agent, isActive }: { agent: AgentInfo; isActive: boolean }) {
  return (
    <Box flexDirection="column">
      {/* Standard row content */}
      <AgentRow agent={agent} isActive={isActive} />

      {/* Verbose debug info */}
      {isActive && (
        <Box marginLeft={2} flexDirection="column">
          {agent.tokensUsed && (
            <Text color="gray" dimColor>
              tokens: {formatTokens(agent.tokensUsed.input)}→{formatTokens(agent.tokensUsed.output)}
            </Text>
          )}
          {agent.turnCount !== undefined && (
            <Text color="gray" dimColor>turns: {agent.turnCount}</Text>
          )}
          {agent.lastToolCall && (
            <Text color="gray" dimColor>last tool: {agent.lastToolCall}</Text>
          )}
        </Box>
      )}
    </Box>
  );
}
```

**Key Design Decisions**:
- Extend `AgentInfo` interface with optional verbose fields
- Create `VerboseAgentRow` component for enhanced display
- Only show debug info for active agents to reduce noise

#### 3. ActivityLog Verbose Mode Integration

**Current State**: Uses `filterLevel` prop but doesn't consider `displayMode`
**Verbose State**: Auto-sets `filterLevel: 'debug'` and expands data

```typescript
// ActivityLog.tsx - Add displayMode awareness
interface ActivityLogProps {
  entries: LogEntry[];
  displayMode?: DisplayMode;  // NEW
  // ... existing props
}

export function ActivityLog({
  entries,
  displayMode = 'normal',
  filterLevel: explicitFilterLevel,
  // ...
}: ActivityLogProps) {
  // Auto-set debug level in verbose mode unless explicitly overridden
  const effectiveFilterLevel = displayMode === 'verbose'
    ? (explicitFilterLevel ?? 'debug')
    : (explicitFilterLevel ?? 'info');

  // Auto-expand data in verbose mode
  const autoExpandData = displayMode === 'verbose';

  // ... rest of implementation
}
```

**Key Design Decisions**:
- Add `displayMode` prop to ActivityLog
- Auto-set `filterLevel: 'debug'` in verbose mode
- Auto-expand log entry data (don't collapse by default)
- Respect explicit `filterLevel` override if provided

#### 4. New VerboseDebugData Type

```typescript
// packages/core/src/types.ts
export interface VerboseDebugData {
  // Token tracking per agent
  agentTokens: Record<string, { input: number; output: number }>;

  // Timing information
  timing: {
    sessionStart: Date;
    totalElapsed: number;
    stageTimings: Record<string, number>;
    agentTimings: Record<string, number>;
  };

  // Agent debug info
  agentDebug: Record<string, {
    turnCount: number;
    lastToolCall?: string;
    errorCount: number;
    retryCount: number;
  }>;

  // Performance metrics
  metrics: {
    tokensPerSecond: number;
    costPerMinute: number;
    averageTurnLatency: number;
  };
}
```

### Data Flow for Verbose Mode

```
Orchestrator Events                  App State                    Components
──────────────────                   ─────────                    ──────────

usage:updated ─────────────────────▶ tokens: {input, output} ────▶ StatusBar
                                     verboseData.agentTokens       TokenCounter

agent:transition ──────────────────▶ activeAgent                 ─▶ AgentPanel
                                     verboseData.agentDebug        VerboseAgentRow
                                     verboseData.agentTimings

task:log ──────────────────────────▶ messages                    ─▶ ActivityLog
                                     (includes debug level)         (filterLevel auto)

task:stage-changed ────────────────▶ verboseData.timing          ─▶ StatusBar
                                     .stageTimings                  AgentPanel
```

### Implementation Phases

#### Phase 1: StatusBar Token Breakdown
1. Modify `buildSegments()` to show input/output breakdown in verbose mode
2. Add `formatTokenBreakdown()` helper function
3. Update tests in `StatusBar.display-modes.test.tsx`

#### Phase 2: AgentPanel Debug Info
1. Extend `AgentInfo` interface with verbose fields
2. Create `VerboseAgentRow` component
3. Modify `AgentPanel` to conditionally render verbose rows
4. Update orchestrator events to populate verbose data

#### Phase 3: ActivityLog Integration
1. Add `displayMode` prop to ActivityLog
2. Implement auto-filter and auto-expand logic
3. Update App.tsx to pass `displayMode` to ActivityLog
4. Update tests

#### Phase 4: Enhanced Timing & Metrics
1. Add `VerboseDebugData` type to core
2. Add `verboseData` state to App.tsx
3. Implement timing calculations in orchestrator event handlers
4. Add detailed timing display to StatusBar

### File Changes Required

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/core/src/types.ts` | Modify | Add `VerboseDebugData` interface |
| `packages/cli/src/ui/components/StatusBar.tsx` | Modify | Token breakdown, detailed timing |
| `packages/cli/src/ui/components/agents/AgentPanel.tsx` | Modify | Verbose agent row, debug info |
| `packages/cli/src/ui/components/ActivityLog.tsx` | Modify | Add displayMode prop |
| `packages/cli/src/ui/App.tsx` | Modify | Pass displayMode to components, track verbose data |
| `packages/cli/src/ui/hooks/useOrchestratorEvents.ts` | Modify | Populate verbose debug data |
| Tests | Add/Modify | Test coverage for verbose mode enhancements |

### Interface Contracts

#### StatusBar Verbose Segment Output
```typescript
// Verbose mode token segment
{
  label: 'tokens:',
  labelColor: 'gray',
  value: '1.2k→300 (1.5k)', // input→output (total)
  valueColor: 'cyan',
  minWidth: 20,
}

// Verbose mode timing segment
{
  label: 'timing:',
  labelColor: 'gray',
  value: '02:30 active | 00:45 idle',
  valueColor: 'gray',
  minWidth: 25,
}
```

#### AgentPanel Verbose Display Format
```
┌─────────────────────────────────────────────────┐
│ Active Agents                                    │
├─────────────────────────────────────────────────┤
│ ⚡ developer (implementation) [01:23]            │
│   tokens: 1.2k→300                               │
│   turns: 5                                       │
│   last tool: Edit                                │
│ ○ tester                                         │
│ ○ reviewer                                       │
└─────────────────────────────────────────────────┘
```

#### ActivityLog Verbose Behavior
- `filterLevel` automatically set to `'debug'`
- Log entry data auto-expanded (not collapsed)
- Show full timestamps with milliseconds
- Display all metadata without truncation

## Consequences

### Positive
- Clear differentiation between normal and verbose modes
- Valuable debugging information for troubleshooting
- Extensible architecture for future verbose enhancements
- Minimal changes to existing interfaces (additive)
- Backward compatible with existing code

### Negative
- Increased complexity in component rendering logic
- Additional state management for verbose data
- Potential performance impact with frequent debug updates
- More data flowing through the system in verbose mode

### Risks
- **Performance**: Verbose mode may generate more frequent UI updates. Mitigate by throttling updates or using React.memo.
- **Information overload**: Too much debug info could overwhelm users. Mitigate by careful design of what to show.
- **State synchronization**: Verbose data must stay in sync with actual state. Mitigate by deriving from authoritative sources.

## Testing Strategy

1. **Unit Tests**: Test each component's verbose mode rendering in isolation
2. **Integration Tests**: Test verbose mode data flow from orchestrator to UI
3. **Visual Tests**: Manual verification of verbose mode layout and readability
4. **Performance Tests**: Ensure verbose mode doesn't significantly impact performance

## References

- Existing display modes implementation in `StatusBar.display-modes.test.tsx`
- `TokenCounter` component pattern at `packages/cli/src/ui/components/status/TokenCounter.tsx`
- Orchestrator events at `packages/orchestrator/src/index.ts`
- Core types at `packages/core/src/types.ts`
