# ADR-034: useOrchestratorEvents Hook Updates for Verbose Data Population

## Status
Proposed

## Date
2024-12-18

## Related ADRs
- ADR-022: Verbose Mode Enhanced Implementation Architecture
- ADR-023: AgentPanel Verbose Mode with VerboseAgentRow Component

## Context

The `useOrchestratorEvents` hook needs to be updated to populate verbose debug data for the UI components. Currently:

1. **`usage:updated` events** are received but not used to populate `agentTokens` in `VerboseDebugData`
2. **`agent:transition` timestamps** are not tracked for `agentTimings`
3. **`turnCount` and `lastToolCall`** are partially tracked but need proper integration with `VerboseDebugData`
4. **`VerboseDebugData` state** is not being updated reactively from orchestrator events

### Current Implementation Analysis

The hook currently handles these events but doesn't populate `VerboseDebugData`:

```typescript
// Current handleUsageUpdated - just logs, doesn't populate agentTokens
const handleUsageUpdated = (eventTaskId: string, usage: TaskUsage) => {
  log('Usage updated', { taskId: eventTaskId, tokens: usage });
  setState(prev => ({ ...prev })); // No-op essentially
};

// Current handleAgentTurn - updates agent debugInfo.turnCount
const handleAgentTurn = (turnData: { taskId: string; agentName: string; turnNumber: number }) => {
  setState(prev => ({
    ...prev,
    agents: updateAgentDebugInfo(prev.agents, turnData.agentName, (debugInfo) => ({
      ...debugInfo,
      turnCount: turnData.turnNumber,
    })),
  }));
};
```

### Acceptance Criteria (from task)
1. Hook populates `agentTokens` from `usage:updated` events
2. Hook populates `agentTimings` from `agent:transition` timestamps
3. Hook populates `turnCount` and `lastToolCall` from agent events
4. `VerboseDebugData` state updated reactively

## Decision

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         Orchestrator Events                                     │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  usage:updated(taskId, {inputTokens, outputTokens, totalTokens, cost})   │  │
│  │  agent:transition(taskId, fromAgent, toAgent)                             │  │
│  │  agent:tool-use(taskId, toolName, input)                                  │  │
│  │  agent:turn(taskId, agentName, turnNumber)                                │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                     useOrchestratorEvents Hook                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  NEW STATE:                                                               │  │
│  │  verboseDebugData: VerboseDebugData {                                     │  │
│  │    agentTokens: Record<string, AgentUsage>                               │  │
│  │    timing: { agentResponseTimes, toolUsageTimes, ... }                   │  │
│  │    agentDebug: { toolCallCounts, errorCounts, ... }                      │  │
│  │    metrics: { tokensPerSecond, averageResponseTime, ... }                │  │
│  │  }                                                                        │  │
│  │                                                                           │  │
│  │  TRACKING STATE (internal):                                               │  │
│  │  agentStartTimes: Map<string, Date>  // For timing calculations           │  │
│  │  toolStartTimes: Map<string, Date>   // For tool timing                   │  │
│  │  lastUsageByAgent: Map<string, TaskUsage>  // For incremental updates    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                           App.tsx                                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  AppState.verboseData = eventState.verboseDebugData                       │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
             ┌───────────┐    ┌────────────┐    ┌─────────────┐
             │ AgentPanel│    │ StatusBar  │    │ ActivityLog │
             │ (verbose) │    │ (verbose)  │    │ (verbose)   │
             └───────────┘    └────────────┘    └─────────────┘
```

### Interface Design

#### Extended OrchestratorEventState

```typescript
export interface OrchestratorEventState {
  // Existing fields...
  currentAgent?: string;
  previousAgent?: string;
  agents: AgentInfo[];
  parallelAgents: AgentInfo[];
  showParallelPanel: boolean;
  currentTaskId?: string;
  subtaskProgress?: { completed: number; total: number };

  // NEW: Verbose debug data
  verboseDebugData: VerboseDebugData;
}
```

#### Internal Tracking State

```typescript
// Internal state for timing calculations (not exposed)
interface TimingTracker {
  stageStartTime: Date;
  agentStartTimes: Map<string, Date>;
  toolStartTimes: Map<string, Date>;
  lastAgentUsage: Map<string, { input: number; output: number }>;
}
```

### Event Handler Specifications

#### 1. usage:updated Event Handler

**Purpose**: Populate `agentTokens` in `VerboseDebugData` and update `AgentInfo.debugInfo.tokensUsed`

```typescript
const handleUsageUpdated = (
  eventTaskId: string,
  usage: TaskUsage
) => {
  if (taskId && eventTaskId !== taskId) return;

  log('Usage updated', { taskId: eventTaskId, tokens: usage });

  setState(prev => {
    const currentAgentName = prev.currentAgent;
    if (!currentAgentName) return prev;

    // Calculate incremental tokens for this agent
    const previousAgentUsage = timingTracker.lastAgentUsage.get(currentAgentName) || { input: 0, output: 0 };
    const incrementalInput = usage.inputTokens - previousAgentUsage.input;
    const incrementalOutput = usage.outputTokens - previousAgentUsage.output;

    // Update tracking
    timingTracker.lastAgentUsage.set(currentAgentName, {
      input: usage.inputTokens,
      output: usage.outputTokens,
    });

    // Update VerboseDebugData.agentTokens
    const updatedAgentTokens = {
      ...prev.verboseDebugData.agentTokens,
      [currentAgentName]: {
        inputTokens: (prev.verboseDebugData.agentTokens[currentAgentName]?.inputTokens || 0) + incrementalInput,
        outputTokens: (prev.verboseDebugData.agentTokens[currentAgentName]?.outputTokens || 0) + incrementalOutput,
      },
    };

    // Update AgentInfo.debugInfo.tokensUsed
    const updatedAgents = prev.agents.map(agent => {
      if (agent.name === currentAgentName) {
        return {
          ...agent,
          debugInfo: {
            ...agent.debugInfo,
            tokensUsed: updatedAgentTokens[currentAgentName],
          },
        };
      }
      return agent;
    });

    // Calculate tokensPerSecond metric
    const elapsed = Date.now() - timingTracker.stageStartTime.getTime();
    const totalTokens = Object.values(updatedAgentTokens).reduce(
      (sum, t) => sum + t.inputTokens + t.outputTokens, 0
    );
    const tokensPerSecond = elapsed > 0 ? (totalTokens / elapsed) * 1000 : 0;

    return {
      ...prev,
      agents: updatedAgents,
      verboseDebugData: {
        ...prev.verboseDebugData,
        agentTokens: updatedAgentTokens,
        metrics: {
          ...prev.verboseDebugData.metrics,
          tokensPerSecond,
        },
      },
    };
  });
};
```

#### 2. agent:transition Event Handler

**Purpose**: Track agent timing for `agentTimings` and update `agentResponseTimes`

```typescript
const handleAgentTransition = (
  eventTaskId: string,
  fromAgent: string | null,
  toAgent: string
) => {
  if (taskId && eventTaskId !== taskId) return;

  log('Agent transition', { from: fromAgent, to: toAgent, taskId: eventTaskId });

  const now = new Date();

  setState(prev => {
    let updatedAgentResponseTimes = { ...prev.verboseDebugData.timing.agentResponseTimes };

    // Calculate response time for previous agent
    if (fromAgent) {
      const startTime = timingTracker.agentStartTimes.get(fromAgent);
      if (startTime) {
        const responseTime = now.getTime() - startTime.getTime();
        updatedAgentResponseTimes[fromAgent] = responseTime;
      }
    }

    // Record start time for new agent
    timingTracker.agentStartTimes.set(toAgent, now);

    // Update agents list with status changes
    const updatedAgents = updateAgentStatus(
      prev.agents.length > 0 ? prev.agents : derivedAgents,
      toAgent,
      fromAgent || undefined
    );

    // Update agent debugInfo with stageStartedAt
    const agentsWithTiming = updatedAgents.map(agent => {
      if (agent.name === toAgent) {
        return {
          ...agent,
          startedAt: now,
          debugInfo: {
            ...agent.debugInfo,
            stageStartedAt: now,
          },
        };
      }
      return agent;
    });

    return {
      ...prev,
      currentAgent: toAgent,
      previousAgent: fromAgent || undefined,
      agents: agentsWithTiming,
      currentTaskId: eventTaskId,
      verboseDebugData: {
        ...prev.verboseDebugData,
        timing: {
          ...prev.verboseDebugData.timing,
          agentResponseTimes: updatedAgentResponseTimes,
        },
      },
    };
  });
};
```

#### 3. agent:tool-use Event Handler

**Purpose**: Track `lastToolCall` and `toolCallCounts` and `toolUsageTimes`

```typescript
const handleToolUse = (
  eventTaskId: string,
  tool: string,
  input: unknown
) => {
  if (taskId && eventTaskId !== taskId) return;

  log('Tool use', { taskId: eventTaskId, tool });

  const now = new Date();

  // Track tool start time for timing calculation
  timingTracker.toolStartTimes.set(tool, now);

  setState(prev => {
    const currentAgentName = prev.currentAgent;
    if (!currentAgentName) return prev;

    // Update agent's lastToolCall
    const updatedAgents = prev.agents.map(agent => {
      if (agent.name === currentAgentName) {
        return {
          ...agent,
          debugInfo: {
            ...agent.debugInfo,
            lastToolCall: tool,
          },
        };
      }
      return agent;
    });

    // Update toolCallCounts
    const currentAgentToolCounts = prev.verboseDebugData.agentDebug.toolCallCounts[currentAgentName] || {};
    const updatedToolCallCounts = {
      ...prev.verboseDebugData.agentDebug.toolCallCounts,
      [currentAgentName]: {
        ...currentAgentToolCounts,
        [tool]: (currentAgentToolCounts[tool] || 0) + 1,
      },
    };

    return {
      ...prev,
      agents: updatedAgents,
      verboseDebugData: {
        ...prev.verboseDebugData,
        agentDebug: {
          ...prev.verboseDebugData.agentDebug,
          toolCallCounts: updatedToolCallCounts,
        },
      },
    };
  });
};
```

#### 4. agent:tool-result Event Handler (NEW)

**Purpose**: Calculate tool usage time when tool completes

```typescript
const handleToolResult = (
  eventTaskId: string,
  tool: string,
  result: unknown
) => {
  if (taskId && eventTaskId !== taskId) return;

  log('Tool result', { taskId: eventTaskId, tool });

  const now = new Date();
  const startTime = timingTracker.toolStartTimes.get(tool);

  if (startTime) {
    const toolDuration = now.getTime() - startTime.getTime();

    setState(prev => ({
      ...prev,
      verboseDebugData: {
        ...prev.verboseDebugData,
        timing: {
          ...prev.verboseDebugData.timing,
          toolUsageTimes: {
            ...prev.verboseDebugData.timing.toolUsageTimes,
            [tool]: (prev.verboseDebugData.timing.toolUsageTimes[tool] || 0) + toolDuration,
          },
        },
      },
    }));

    timingTracker.toolStartTimes.delete(tool);
  }
};
```

#### 5. agent:turn Event Handler (Enhanced)

**Purpose**: Update `turnCount` in both `AgentInfo.debugInfo` and `VerboseDebugData.agentDebug.conversationLength`

```typescript
const handleAgentTurn = (turnData: {
  taskId: string;
  agentName: string;
  turnNumber: number
}) => {
  if (taskId && turnData.taskId !== taskId) return;

  log('Agent turn', { agent: turnData.agentName, turn: turnData.turnNumber });

  setState(prev => ({
    ...prev,
    agents: updateAgentDebugInfo(prev.agents, turnData.agentName, (debugInfo) => ({
      ...debugInfo,
      turnCount: turnData.turnNumber,
    })),
    verboseDebugData: {
      ...prev.verboseDebugData,
      agentDebug: {
        ...prev.verboseDebugData.agentDebug,
        conversationLength: {
          ...prev.verboseDebugData.agentDebug.conversationLength,
          [turnData.agentName]: turnData.turnNumber,
        },
      },
    },
  }));
};
```

### Initial State

```typescript
const initialVerboseDebugData: VerboseDebugData = {
  agentTokens: {},
  timing: {
    stageStartTime: new Date(),
    stageEndTime: undefined,
    stageDuration: undefined,
    agentResponseTimes: {},
    toolUsageTimes: {},
  },
  agentDebug: {
    conversationLength: {},
    toolCallCounts: {},
    errorCounts: {},
    retryAttempts: {},
  },
  metrics: {
    tokensPerSecond: 0,
    averageResponseTime: 0,
    toolEfficiency: {},
    memoryUsage: undefined,
    cpuUtilization: undefined,
  },
};
```

### Hook Options Extension

```typescript
export interface UseOrchestratorEventsOptions {
  orchestrator?: ApexOrchestrator;
  taskId?: string;
  workflow?: {
    stages: Array<{ name: string; agent: string }>;
  };
  debug?: boolean;
  // NEW: Enable verbose data tracking (false by default for performance)
  trackVerboseData?: boolean;
}
```

### Data Flow Summary

```
Event                     → VerboseDebugData Field        → UI Component
─────────────────────────────────────────────────────────────────────────
usage:updated             → agentTokens[agent]            → VerboseAgentRow
                          → metrics.tokensPerSecond       → StatusBar

agent:transition          → timing.agentResponseTimes     → ActivityLog
                          → AgentInfo.startedAt           → VerboseAgentRow

agent:tool-use            → agentDebug.toolCallCounts     → ActivityLog
                          → AgentInfo.debugInfo.lastToolCall → VerboseAgentRow

agent:tool-result         → timing.toolUsageTimes         → ActivityLog
                          → metrics.toolEfficiency        → StatusBar

agent:turn                → agentDebug.conversationLength → ActivityLog
                          → AgentInfo.debugInfo.turnCount → VerboseAgentRow

error events              → agentDebug.errorCounts        → VerboseAgentRow
                          → AgentInfo.debugInfo.errorCount
```

### Performance Considerations

1. **Conditional Tracking**: Only track verbose data when `trackVerboseData: true` option is set
2. **Throttling**: Consider throttling `usage:updated` handler to max 2 updates/second
3. **Memoization**: Use `useCallback` for all event handlers to prevent recreation
4. **Map vs Object**: Use `Map` for internal tracking (faster lookups/updates) but convert to object for state

### Implementation Phases

#### Phase 1: State Structure
1. Add `verboseDebugData` to `OrchestratorEventState`
2. Create `initialVerboseDebugData` constant
3. Add `trackVerboseData` option

#### Phase 2: Token Tracking
1. Implement enhanced `handleUsageUpdated`
2. Add `lastAgentUsage` tracking
3. Update tests

#### Phase 3: Timing Tracking
1. Implement enhanced `handleAgentTransition` with timing
2. Add `agentStartTimes` tracking
3. Update tests

#### Phase 4: Tool Tracking
1. Implement enhanced `handleToolUse`
2. Add `handleToolResult` handler (if event exists)
3. Add `toolStartTimes` tracking
4. Update tests

#### Phase 5: Turn and Error Tracking
1. Implement enhanced `handleAgentTurn`
2. Implement `handleError` updates
3. Update tests

### File Changes Required

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/cli/src/ui/hooks/useOrchestratorEvents.ts` | Modify | Add verbose data tracking |
| `packages/cli/src/ui/App.tsx` | Modify | Wire verbose data to components |
| Tests | Add/Modify | Test coverage for new functionality |

### Interface Contract

```typescript
// Return type of useOrchestratorEvents
interface OrchestratorEventState {
  currentAgent?: string;
  previousAgent?: string;
  agents: AgentInfo[];
  parallelAgents: AgentInfo[];
  showParallelPanel: boolean;
  currentTaskId?: string;
  subtaskProgress?: { completed: number; total: number };
  verboseDebugData: VerboseDebugData; // NEW
}
```

## Consequences

### Positive
- Complete data flow from orchestrator events to UI verbose mode
- Real-time reactive updates of debug information
- Per-agent token tracking enables detailed cost analysis
- Timing information helps identify performance bottlenecks
- Maintains backward compatibility (opt-in verbose tracking)

### Negative
- Increased state complexity in the hook
- Additional memory for tracking maps
- More frequent state updates in verbose mode
- Need to maintain synchronization between tracking maps and state

### Risks
- **Performance**: Frequent usage updates could cause excessive re-renders
  - Mitigation: Throttle updates, use `trackVerboseData` flag
- **Memory**: Long-running sessions could accumulate tracking data
  - Mitigation: Clear tracking on task completion
- **Event ordering**: Events might arrive out of order
  - Mitigation: Use timestamps and handle gracefully

## Testing Strategy

1. **Unit Tests**: Test each event handler in isolation
2. **Integration Tests**: Test data flow from events to state
3. **Snapshot Tests**: Verify state shape after event sequences
4. **Performance Tests**: Measure update frequency and memory usage

## References

- Existing `useOrchestratorEvents.ts` implementation
- `VerboseDebugData` interface in `packages/core/src/types.ts`
- ADR-022 and ADR-023 for verbose mode architecture
- Orchestrator event definitions in `packages/orchestrator/src/index.ts`
