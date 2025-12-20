# ADR-007: AgentPanel Enhancements Event Wiring

## Status
Proposed

## Context

The APEX CLI's AgentPanel component has been enhanced with handoff animation support and parallel execution visualization. However, these features are not yet wired to the REPL and orchestrator events. The AgentPanel needs to:

1. Track `previousAgent` and `currentAgent` for handoff display animations
2. Receive parallel task events to update the `parallelAgents` prop
3. Receive proper props from App.tsx to enable these features

Currently, the orchestrator emits relevant events (`task:stage-changed`, parallel stage execution logs), but the REPL doesn't listen to them to update agent state. The App.tsx doesn't pass the AgentPanel props, and the REPL doesn't track the necessary state.

## Decision

### 1. AppState Extension

Extend `AppState` in `packages/cli/src/ui/App.tsx` with new fields:

```typescript
export interface AppState {
  // ... existing fields

  // Agent handoff tracking
  previousAgent?: string;  // Previous agent for handoff animation
  activeAgent?: string;    // Current active agent (already exists)

  // Parallel execution tracking
  parallelAgents?: AgentInfo[];  // Agents running in parallel
  showParallelPanel?: boolean;   // Whether to show parallel section
}
```

### 2. New Orchestrator Events

Add new events to `OrchestratorEvents` in `packages/orchestrator/src/index.ts`:

```typescript
export interface OrchestratorEvents {
  // ... existing events

  // New events for parallel execution
  'stage:parallel-started': (taskId: string, stages: string[], agents: string[]) => void;
  'stage:parallel-completed': (taskId: string) => void;

  // Agent transition event (more explicit than task:stage-changed)
  'agent:transition': (taskId: string, fromAgent: string | null, toAgent: string) => void;
}
```

### 3. REPL Event Listener Setup

Add event listeners in `packages/cli/src/repl.tsx`:

```typescript
// Track agent transitions for handoff animation
ctx.orchestrator.on('task:stage-changed', async (task, stageName) => {
  // Look up the agent for this stage from the workflow
  const workflow = await ctx.orchestrator.getWorkflow(task.workflow);
  const stage = workflow?.stages.find(s => s.name === stageName);

  if (stage?.agent) {
    const currentState = ctx.app?.getState();
    ctx.app?.updateState({
      previousAgent: currentState?.activeAgent,  // Save current as previous
      activeAgent: stage.agent,                   // Set new current
    });
  }
});

// Track parallel execution
ctx.orchestrator.on('stage:parallel-started', (taskId, stages, agents) => {
  const parallelAgents: AgentInfo[] = agents.map(name => ({
    name,
    status: 'parallel' as const,
    stage: stages[agents.indexOf(name)] || undefined,
  }));

  ctx.app?.updateState({
    parallelAgents,
    showParallelPanel: parallelAgents.length > 1,
  });
});

ctx.orchestrator.on('stage:parallel-completed', (taskId) => {
  ctx.app?.updateState({
    parallelAgents: [],
    showParallelPanel: false,
  });
});
```

### 4. Orchestrator Emission Points

Modify `runWorkflow()` in orchestrator to emit parallel events:

```typescript
// In runWorkflow(), when starting parallel stages:
if (readyStages.length > 1) {
  const stageNames = readyStages.map(s => s.name);
  const agentNames = readyStages.map(s => s.agent);
  this.emit('stage:parallel-started', task.id, stageNames, agentNames);
}

// After parallel batch completes:
if (readyStages.length > 1) {
  this.emit('stage:parallel-completed', task.id);
}
```

### 5. App.tsx AgentPanel Integration

Pass new props to AgentPanel in App.tsx render:

```tsx
// In the render method, add AgentPanel:
{state.currentTask && (
  <AgentPanel
    agents={getWorkflowAgents(state.currentTask.workflow)}
    currentAgent={state.activeAgent}
    showParallel={state.showParallelPanel}
    parallelAgents={state.parallelAgents}
  />
)}
```

### 6. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR                                   │
│                                                                          │
│  runWorkflow()                                                          │
│    │                                                                     │
│    ├── emit('task:stage-changed', task, stageName)                      │
│    │     └── For each stage transition                                  │
│    │                                                                     │
│    ├── emit('stage:parallel-started', taskId, stages, agents)           │
│    │     └── When readyStages.length > 1                                │
│    │                                                                     │
│    └── emit('stage:parallel-completed', taskId)                         │
│          └── After parallel batch completes                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Events
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              REPL                                        │
│                                                                          │
│  Event Listeners:                                                       │
│    │                                                                     │
│    ├── on('task:stage-changed')                                         │
│    │     └── updateState({ previousAgent, activeAgent })                │
│    │                                                                     │
│    ├── on('stage:parallel-started')                                     │
│    │     └── updateState({ parallelAgents, showParallelPanel: true })   │
│    │                                                                     │
│    └── on('stage:parallel-completed')                                   │
│          └── updateState({ parallelAgents: [], showParallelPanel: false})│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ updateState()
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              APP.TSX                                     │
│                                                                          │
│  AppState:                                                              │
│    - activeAgent: string                                                │
│    - previousAgent: string (NEW)                                        │
│    - parallelAgents: AgentInfo[] (NEW)                                  │
│    - showParallelPanel: boolean (NEW)                                   │
│                                                                          │
│  Render:                                                                │
│    <AgentPanel                                                          │
│      currentAgent={state.activeAgent}                                   │
│      showParallel={state.showParallelPanel}                             │
│      parallelAgents={state.parallelAgents}                              │
│    />                                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Props
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           AGENT PANEL                                    │
│                                                                          │
│  useAgentHandoff(currentAgent)                                          │
│    └── Detects currentAgent changes                                     │
│    └── Tracks previousAgent internally                                  │
│    └── Returns HandoffAnimationState                                    │
│                                                                          │
│  HandoffIndicator                                                       │
│    └── Shows "fromAgent → toAgent" animation                            │
│                                                                          │
│  ParallelSection                                                        │
│    └── Shows parallel agents when showParallel && parallelAgents > 1    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: AppState Extension (App.tsx)
1. Add `previousAgent`, `parallelAgents`, `showParallelPanel` to AppState interface
2. Ensure `updateState()` properly handles these new fields
3. No breaking changes to existing functionality

### Phase 2: Orchestrator Events (orchestrator/src/index.ts)
1. Add `stage:parallel-started` and `stage:parallel-completed` events to OrchestratorEvents type
2. Emit `stage:parallel-started` in `runWorkflow()` when multiple stages are ready
3. Emit `stage:parallel-completed` after parallel batch execution

### Phase 3: REPL Event Wiring (cli/src/repl.tsx)
1. Add listener for `task:stage-changed` to track agent transitions
   - Lookup stage agent from workflow definition
   - Update `previousAgent` and `activeAgent` in app state
2. Add listener for `stage:parallel-started` to populate `parallelAgents`
3. Add listener for `stage:parallel-completed` to clear parallel state
4. Ensure cleanup of state when task completes/fails

### Phase 4: App.tsx Integration
1. Import AgentPanel component
2. Add AgentPanel to render tree (in appropriate location - near TaskProgress)
3. Pass required props: `currentAgent`, `showParallel`, `parallelAgents`
4. Build agent list from workflow configuration

### Phase 5: Integration Testing
1. Test single-agent workflow: verify handoff animation doesn't trigger incorrectly
2. Test multi-stage sequential workflow: verify handoff animations occur
3. Test parallel workflow: verify parallel section displays correctly
4. Test task completion: verify state cleanup
5. Test task cancellation: verify state cleanup

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/orchestrator/src/index.ts` | Modify | Add new events, emit parallel events |
| `packages/cli/src/ui/App.tsx` | Modify | Extend AppState, add AgentPanel |
| `packages/cli/src/repl.tsx` | Modify | Add event listeners |
| `packages/cli/src/ui/components/agents/AgentPanel.tsx` | None | Already complete |
| `packages/cli/src/ui/hooks/useAgentHandoff.ts` | None | Already complete |

## Risks and Mitigations

### Risk 1: Race Conditions
**Risk**: Parallel event emissions could race with sequential state updates.
**Mitigation**: Use atomic state updates in React. Events are processed in order on the event loop.

### Risk 2: Stale State on Task Failure
**Risk**: If a task fails mid-execution, parallel/agent state could remain stale.
**Mitigation**: Clear all agent-related state in `task:completed` and `task:failed` handlers.

### Risk 3: Performance Impact
**Risk**: Frequent state updates during parallel execution could cause UI flickering.
**Mitigation**: AgentPanel already uses debounced animation state. Consider batching parallel updates if needed.

### Risk 4: Workflow Not Found
**Risk**: Looking up workflow/stage info in event handler could fail.
**Mitigation**: Add null checks and graceful fallbacks. Log warnings but don't break execution.

## Alternative Approaches Considered

### Alternative 1: Push previousAgent from Orchestrator
Instead of REPL tracking previousAgent, have orchestrator emit it.
**Rejected**: This requires orchestrator to maintain UI state, violating separation of concerns.

### Alternative 2: AgentPanel Self-Manages Parallel State
Have AgentPanel query orchestrator directly for parallel execution state.
**Rejected**: Breaks unidirectional data flow. Components shouldn't query backend directly.

### Alternative 3: Use a State Management Library (Redux/Zustand)
Centralize all UI state in a dedicated store.
**Rejected**: Over-engineering for current scope. React's useState is sufficient.

## Success Criteria

1. When agent transitions occur, handoff animation displays "planner → developer" style indicator
2. When multiple stages run in parallel, parallel section shows all running agents
3. State is properly cleaned up when tasks complete or fail
4. No memory leaks from event listeners
5. All existing tests pass
6. New integration tests cover the wiring

## References

- [AgentPanel Component](/packages/cli/src/ui/components/agents/AgentPanel.tsx)
- [useAgentHandoff Hook](/packages/cli/src/ui/hooks/useAgentHandoff.ts)
- [Orchestrator Events](/packages/orchestrator/src/index.ts)
- [REPL Event Setup](/packages/cli/src/repl.tsx)
- [App State Management](/packages/cli/src/ui/App.tsx)
