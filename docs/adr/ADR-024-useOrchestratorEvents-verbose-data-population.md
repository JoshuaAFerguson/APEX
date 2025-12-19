# ADR-024: useOrchestratorEvents Hook Verbose Data Population

## Status
Proposed

## Date
2024-12-18

## Related ADRs
- ADR-022: Verbose Mode Enhanced Implementation Architecture
- ADR-023: AgentPanel Verbose Mode with VerboseAgentRow Component

## Context

The `useOrchestratorEvents` hook needs to populate verbose debug data from orchestrator events to enable the VerboseDebugData state for verbose mode display. Based on the codebase analysis:

### Current State

1. **`useOrchestratorEvents.ts`** (lines 258-319) has handlers for:
   - `usage:updated` - Currently does nothing meaningful (empty setState)
   - `agent:tool-use` - Only logs, doesn't update state
   - `agent:turn` - Updates `turnCount` in `debugInfo` (already implemented)
   - `agent:thinking` - Updates `thinking` in `debugInfo` (already implemented)

2. **`OrchestratorEvents` interface** defines available events:
   - `usage:updated`: `(taskId: string, usage: TaskUsage) => void`
   - `agent:tool-use`: `(taskId: string, tool: string, input: unknown) => void`
   - `agent:transition`: `(taskId: string, fromAgent: string | null, toAgent: string) => void`
   - `agent:thinking`: `(taskId: string, agent: string, thinking: string) => void`

3. **`AgentInfo.debugInfo`** interface already has:
   ```typescript
   debugInfo?: {
     tokensUsed?: { input: number; output: number };
     stageStartedAt?: Date;
     lastToolCall?: string;
     turnCount?: number;
     errorCount?: number;
     thinking?: string;
   };
   ```

4. **`VerboseDebugData`** interface in `@apexcli/core/types.ts`:
   ```typescript
   interface VerboseDebugData {
     agentTokens: Record<string, AgentUsage>;
     timing: {
       stageStartTime: Date;
       stageEndTime?: Date;
       stageDuration?: number;
       agentResponseTimes: Record<string, number>;
       toolUsageTimes: Record<string, number>;
     };
     agentDebug: {
       conversationLength: Record<string, number>;
       toolCallCounts: Record<string, Record<string, number>>;
       errorCounts: Record<string, number>;
       retryAttempts: Record<string, number>;
     };
     metrics: {
       tokensPerSecond: number;
       averageResponseTime: number;
       toolEfficiency: Record<string, number>;
       memoryUsage?: number;
       cpuUtilization?: number;
     };
   }
   ```

### What's Missing

1. **Token population from `usage:updated`** - Need to track per-agent token usage
2. **Tool tracking from `agent:tool-use`** - Need to update `lastToolCall` and tool usage times
3. **Agent timing from `agent:transition`** - Need to track agent response times
4. **VerboseDebugData state management** - Hook needs to return or update VerboseDebugData

### Acceptance Criteria

- Hook populates `agentTokens` from `usage:updated` events
- Hook populates `agentTimings` from `agent:transition` timestamps
- Hook populates `turnCount` and `lastToolCall` from agent events
- `VerboseDebugData` state updated reactively

## Decision

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ApexOrchestrator Events                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  usage:updated ──────────► (taskId, { inputTokens, outputTokens, ... }) │ │
│  │  agent:tool-use ─────────► (taskId, toolName, input)                    │ │
│  │  agent:transition ───────► (taskId, fromAgent, toAgent)                 │ │
│  │  agent:thinking ─────────► (taskId, agentName, thinking)                │ │
│  │  task:stage-changed ─────► (task, stageName)                            │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       useOrchestratorEvents Hook                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Internal State:                                                         │ │
│  │  - verboseData: VerboseDebugData                                        │ │
│  │  - agentStartTimes: Map<string, Date>                                   │ │
│  │  - toolStartTimes: Map<string, Date>                                    │ │
│  │  - currentAgentName: string                                             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│  Event Handlers:                     │                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  handleUsageUpdated: accumulates tokens per current agent               │  │
│  │  handleToolUse: tracks lastToolCall, updates toolUsageTimes             │  │
│  │  handleAgentTransition: calculates agent response times                 │  │
│  │  handleAgentTurn: increments turnCount                                  │  │
│  │  handleStageChange: resets timing context, sets stageStartTime          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OrchestratorEventState (Returned)                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  agents: AgentInfo[] (with debugInfo populated)                         │ │
│  │  verboseData?: VerboseDebugData                                         │ │
│  │  currentAgent?: string                                                  │ │
│  │  ...existing fields                                                     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation Design

#### 1. Extended Hook State Interface

```typescript
export interface OrchestratorEventState {
  // ...existing fields...

  /** Verbose debug data populated from orchestrator events */
  verboseData?: VerboseDebugData;
}
```

#### 2. Internal State for Timing Tracking

```typescript
// Inside useOrchestratorEvents hook
const [verboseData, setVerboseData] = useState<VerboseDebugData>(() => ({
  agentTokens: {},
  timing: {
    stageStartTime: new Date(),
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
  },
}));

// Refs for timing calculations (not triggering re-renders)
const agentStartTimeRef = useRef<Map<string, Date>>(new Map());
const toolStartTimeRef = useRef<Map<string, Date>>(new Map());
const totalTokensRef = useRef<number>(0);
const stageStartTimeRef = useRef<Date>(new Date());
```

#### 3. Event Handler Implementations

##### handleUsageUpdated
```typescript
const handleUsageUpdated = useCallback((
  eventTaskId: string,
  usage: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCost: number }
) => {
  if (taskId && eventTaskId !== taskId) return;

  log('Usage updated', { taskId: eventTaskId, tokens: usage });

  // Get current agent name from state
  const currentAgentName = state.currentAgent;
  if (!currentAgentName) return;

  // Update agentTokens in verboseData
  setVerboseData(prev => {
    const prevAgentTokens = prev.agentTokens[currentAgentName] || {
      inputTokens: 0,
      outputTokens: 0,
    };

    const newAgentTokens = {
      ...prev.agentTokens,
      [currentAgentName]: {
        inputTokens: prevAgentTokens.inputTokens + usage.inputTokens,
        outputTokens: prevAgentTokens.outputTokens + usage.outputTokens,
      },
    };

    // Calculate tokens per second metric
    const now = Date.now();
    const elapsed = (now - stageStartTimeRef.current.getTime()) / 1000;
    totalTokensRef.current += usage.totalTokens;
    const tokensPerSecond = elapsed > 0 ? totalTokensRef.current / elapsed : 0;

    return {
      ...prev,
      agentTokens: newAgentTokens,
      metrics: {
        ...prev.metrics,
        tokensPerSecond,
      },
    };
  });

  // Also update agent's debugInfo for immediate display
  setState(prev => ({
    ...prev,
    agents: updateAgentDebugInfo(prev.agents, currentAgentName, (debugInfo) => ({
      ...debugInfo,
      tokensUsed: {
        input: (debugInfo?.tokensUsed?.input || 0) + usage.inputTokens,
        output: (debugInfo?.tokensUsed?.output || 0) + usage.outputTokens,
      },
    })),
  }));
}, [taskId, state.currentAgent, log, updateAgentDebugInfo]);
```

##### handleToolUse (Enhanced)
```typescript
const handleToolUse = useCallback((
  eventTaskId: string,
  tool: string,
  _input: unknown
) => {
  if (taskId && eventTaskId !== taskId) return;

  log('Tool use', { taskId: eventTaskId, tool });

  const currentAgentName = state.currentAgent;
  const now = new Date();

  // Track tool call completion if there's a previous tool in progress
  const prevToolStart = toolStartTimeRef.current.get(tool);
  if (prevToolStart) {
    const duration = now.getTime() - prevToolStart.getTime();
    setVerboseData(prev => ({
      ...prev,
      timing: {
        ...prev.timing,
        toolUsageTimes: {
          ...prev.timing.toolUsageTimes,
          [tool]: (prev.timing.toolUsageTimes[tool] || 0) + duration,
        },
      },
    }));
  }

  // Start timing for this tool call
  toolStartTimeRef.current.set(tool, now);

  // Update agentDebug tool call counts
  if (currentAgentName) {
    setVerboseData(prev => {
      const agentToolCounts = prev.agentDebug.toolCallCounts[currentAgentName] || {};
      return {
        ...prev,
        agentDebug: {
          ...prev.agentDebug,
          toolCallCounts: {
            ...prev.agentDebug.toolCallCounts,
            [currentAgentName]: {
              ...agentToolCounts,
              [tool]: (agentToolCounts[tool] || 0) + 1,
            },
          },
        },
      };
    });

    // Update agent's debugInfo.lastToolCall
    setState(prev => ({
      ...prev,
      agents: updateAgentDebugInfo(prev.agents, currentAgentName, (debugInfo) => ({
        ...debugInfo,
        lastToolCall: tool,
      })),
    }));
  }
}, [taskId, state.currentAgent, log, updateAgentDebugInfo]);
```

##### handleAgentTransition (Enhanced)
```typescript
const handleAgentTransition = useCallback((
  eventTaskId: string,
  fromAgent: string | null,
  toAgent: string
) => {
  if (taskId && eventTaskId !== taskId) return;

  log('Agent transition', { from: fromAgent, to: toAgent, taskId: eventTaskId });

  const now = new Date();

  // Calculate response time for previous agent
  if (fromAgent) {
    const agentStartTime = agentStartTimeRef.current.get(fromAgent);
    if (agentStartTime) {
      const responseTime = now.getTime() - agentStartTime.getTime();
      setVerboseData(prev => ({
        ...prev,
        timing: {
          ...prev.timing,
          agentResponseTimes: {
            ...prev.timing.agentResponseTimes,
            [fromAgent]: (prev.timing.agentResponseTimes[fromAgent] || 0) + responseTime,
          },
        },
      }));
    }
  }

  // Start timing for new agent
  agentStartTimeRef.current.set(toAgent, now);

  // Set stageStartedAt for the new agent
  setState(prev => {
    const updatedAgents = updateAgentStatus(
      prev.agents.length > 0 ? prev.agents : derivedAgents,
      toAgent,
      fromAgent || undefined
    );

    // Update stageStartedAt for new agent
    return {
      ...prev,
      currentAgent: toAgent,
      previousAgent: fromAgent || undefined,
      agents: updatedAgents.map(agent =>
        agent.name === toAgent
          ? { ...agent, debugInfo: { ...agent.debugInfo, stageStartedAt: now } }
          : agent
      ),
      currentTaskId: eventTaskId,
    };
  });
}, [taskId, log, updateAgentStatus, derivedAgents]);
```

##### handleStageChange (Enhanced)
```typescript
const handleStageChange = useCallback((task: any, stageName: string) => {
  if (taskId && task.id !== taskId) return;

  log('Stage change', { stage: stageName, taskId: task.id });

  const now = new Date();
  const stageAgent = workflow?.stages.find(s => s.name === stageName)?.agent;

  // Calculate previous stage duration if applicable
  const prevStageStart = stageStartTimeRef.current;
  const stageDuration = now.getTime() - prevStageStart.getTime();

  // Update stage timing
  stageStartTimeRef.current = now;
  totalTokensRef.current = 0; // Reset for new stage

  setVerboseData(prev => ({
    ...prev,
    timing: {
      ...prev.timing,
      stageStartTime: now,
      stageEndTime: undefined,
      stageDuration: undefined,
      // Keep accumulated agentResponseTimes and toolUsageTimes
    },
  }));

  // ...existing stage change logic...
}, [taskId, workflow, log]);
```

#### 4. Return Updated State

```typescript
return {
  ...state,
  verboseData,  // Include verboseData in returned state
};
```

### Data Flow

```
Orchestrator Event                   Hook Processing                    Output State
─────────────────                   ───────────────                    ────────────

usage:updated ────────────────────► Accumulate tokens per agent ──────► verboseData.agentTokens
(taskId, usage)                     Update tokensPerSecond metric       agents[].debugInfo.tokensUsed

agent:tool-use ───────────────────► Track tool timing ────────────────► verboseData.timing.toolUsageTimes
(taskId, tool, input)               Update tool call counts             verboseData.agentDebug.toolCallCounts
                                    Set lastToolCall                    agents[].debugInfo.lastToolCall

agent:transition ─────────────────► Calculate agent response time ────► verboseData.timing.agentResponseTimes
(taskId, from, to)                  Start timing for new agent          agents[].debugInfo.stageStartedAt
                                    Update agent status                 currentAgent, previousAgent

agent:turn ───────────────────────► Increment turn count ─────────────► agents[].debugInfo.turnCount
(turnData)                          (Already implemented)

task:stage-changed ───────────────► Reset stage timing ───────────────► verboseData.timing.stageStartTime
(task, stageName)                   Set new stage start time
```

### Implementation Phases

#### Phase 1: Token Population from `usage:updated`
1. Modify `handleUsageUpdated` to track per-agent token usage
2. Update `verboseData.agentTokens` with accumulated tokens
3. Calculate `tokensPerSecond` metric
4. Update `agents[].debugInfo.tokensUsed`

#### Phase 2: Tool Tracking from `agent:tool-use`
1. Enhance `handleToolUse` to track tool timing
2. Update `verboseData.timing.toolUsageTimes`
3. Update `verboseData.agentDebug.toolCallCounts`
4. Set `agents[].debugInfo.lastToolCall`

#### Phase 3: Agent Timing from `agent:transition`
1. Add timing refs for agent start times
2. Calculate and accumulate `agentResponseTimes`
3. Set `stageStartedAt` when agent becomes active

#### Phase 4: VerboseDebugData State Management
1. Add `verboseData` state to hook
2. Initialize with default structure
3. Return in `OrchestratorEventState`
4. Add helper for `averageResponseTime` calculation

### File Changes Required

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/cli/src/ui/hooks/useOrchestratorEvents.ts` | Modify | Add verboseData state, enhance event handlers |
| `packages/cli/src/ui/hooks/__tests__/useOrchestratorEvents.verbose.test.ts` | Create | Tests for verbose data population |

### Interface Contracts

#### OrchestratorEventState (Extended)
```typescript
export interface OrchestratorEventState {
  currentAgent?: string;
  previousAgent?: string;
  agents: AgentInfo[];
  parallelAgents: AgentInfo[];
  showParallelPanel: boolean;
  currentTaskId?: string;
  subtaskProgress?: { completed: number; total: number };

  // NEW: Verbose debug data populated from events
  verboseData?: VerboseDebugData;
}
```

#### AgentInfo.debugInfo Data Flow
```typescript
// From usage:updated
debugInfo.tokensUsed = { input: accumulated, output: accumulated }

// From agent:tool-use
debugInfo.lastToolCall = toolName

// From agent:transition
debugInfo.stageStartedAt = transitionTimestamp

// From agent:turn (already implemented)
debugInfo.turnCount = turnNumber

// From error events
debugInfo.errorCount = incrementedCount
```

### Testing Strategy

1. **Unit Tests for Event Handlers**
   - `handleUsageUpdated` accumulates tokens correctly
   - `handleToolUse` tracks tool timing and counts
   - `handleAgentTransition` calculates response times
   - Edge cases: missing agent, empty events, rapid succession

2. **Integration Tests**
   - Full event flow from orchestrator to UI state
   - Multiple agents with interleaved events
   - Stage transitions resetting timing correctly

3. **Property-Based Tests**
   - Token accumulation never loses data
   - Timing calculations are monotonically increasing
   - Tool counts match actual tool use events

## Consequences

### Positive
- Enables rich verbose mode debugging display
- Per-agent token tracking provides cost attribution
- Tool timing helps identify performance bottlenecks
- Consistent with existing VerboseDebugData interface
- Minimal impact on non-verbose mode performance

### Negative
- Increased hook complexity with more state management
- Additional memory usage for timing tracking refs
- Need to carefully handle agent/stage transitions

### Risks
- **Performance**: Frequent setState calls could cause re-renders
  - Mitigation: Use refs for timing data, batch updates where possible
- **Race Conditions**: Events arriving out of order
  - Mitigation: Use timestamps and accumulated values, not deltas
- **Memory Leaks**: Refs not cleaned up on unmount
  - Mitigation: Clear refs in cleanup function

## Implementation Notes

### Key Considerations

1. **Current Agent Context**: The `usage:updated` event only provides `taskId`, not `agentName`. We must use `state.currentAgent` to attribute tokens to the right agent.

2. **Event Ordering**: Events may arrive in unexpected order. Always use accumulated values and timestamps rather than assuming sequential delivery.

3. **Metric Calculation**: `tokensPerSecond` and `averageResponseTime` should be calculated reactively from accumulated data.

4. **State Batching**: Consider batching multiple setState calls in rapid event sequences using `useReducer` or `unstable_batchedUpdates` if needed.

## References

- ADR-022: Verbose Mode Enhanced Implementation Architecture
- ADR-023: AgentPanel Verbose Mode with VerboseAgentRow Component
- `packages/orchestrator/src/index.ts` - OrchestratorEvents interface
- `packages/core/src/types.ts` - VerboseDebugData, AgentUsage interfaces
- `packages/cli/src/ui/hooks/useOrchestratorEvents.ts` - Current implementation
