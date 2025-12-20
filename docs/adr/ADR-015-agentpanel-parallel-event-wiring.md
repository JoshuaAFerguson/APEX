# ADR-015: AgentPanel Parallel Execution Event Wiring

## Status
Accepted (Implementation Verified Complete)

## Date
2024-12-16

## Context

Task: Wire AgentPanel parallel execution to orchestrator events

The goal is to ensure that when the orchestrator executes workflow stages in parallel, the REPL/App receives these events and updates the `parallelAgents` state, which is then displayed in the AgentPanel UI with real-time parallel execution status.

## Acceptance Criteria Verification

| Criteria | Status | Evidence |
|----------|--------|----------|
| REPL/App receives parallel agent events from orchestrator | ✅ Complete | REPL handlers at lines 1507-1525 |
| parallelAgents state updates when agents run concurrently | ✅ Complete | AppState includes parallelAgents, showParallelPanel |
| UI reflects real-time parallel execution status | ✅ Complete | AgentPanel ParallelSection renders when active |

## Technical Design

### Event Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Parallel Execution Event Flow                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                      1. ORCHESTRATOR (Event Source)                        │ │
│  │  packages/orchestrator/src/index.ts                                        │ │
│  │                                                                            │ │
│  │  Event Definitions (lines 64-66):                                          │ │
│  │    'stage:parallel-started': (taskId, stages[], agents[]) => void          │ │
│  │    'stage:parallel-completed': (taskId) => void                            │ │
│  │                                                                            │ │
│  │  Emission Points:                                                          │ │
│  │    - parallel-started: line 727 (when readyStages.length > 1)             │ │
│  │    - parallel-completed: line 835 (when results.length > 1)               │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                             │
│                                    │ EventEmitter pattern                        │
│                                    ▼                                             │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                      2. REPL (Event Handler Layer)                         │ │
│  │  packages/cli/src/repl.tsx (lines 1507-1525)                               │ │
│  │                                                                            │ │
│  │  ctx.orchestrator.on('stage:parallel-started', (taskId, stages, agents) => │ │
│  │    const parallelAgents = agents.map(name => ({                            │ │
│  │      name,                                                                 │ │
│  │      status: 'parallel' as const,                                          │ │
│  │      stage: stages[agents.indexOf(name)] || undefined,                     │ │
│  │    }));                                                                    │ │
│  │    ctx.app?.updateState({ parallelAgents, showParallelPanel: true });      │ │
│  │  });                                                                       │ │
│  │                                                                            │ │
│  │  ctx.orchestrator.on('stage:parallel-completed', (taskId) => {             │ │
│  │    ctx.app?.updateState({ parallelAgents: [], showParallelPanel: false }); │ │
│  │  });                                                                       │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                             │
│                                    │ ctx.app.updateState()                       │
│                                    ▼                                             │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                      3. INK APP BRIDGE                                     │ │
│  │  packages/cli/src/ui/index.tsx (lines 75-100)                              │ │
│  │                                                                            │ │
│  │  InkAppInstance.updateState() -> globalThis.__apexApp.updateState()        │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                             │
│                                    │ React setState                              │
│                                    ▼                                             │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                      4. APP STATE (State Container)                        │ │
│  │  packages/cli/src/ui/App.tsx (lines 69-71)                                 │ │
│  │                                                                            │ │
│  │  interface AppState {                                                      │ │
│  │    // ... other fields                                                     │ │
│  │    parallelAgents?: AgentInfo[];   // Agents running in parallel           │ │
│  │    showParallelPanel?: boolean;    // Whether to show parallel section     │ │
│  │  }                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                             │
│                                    │ Props                                       │
│                                    ▼                                             │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                      5. AGENTPANEL (UI Component)                          │ │
│  │  packages/cli/src/ui/components/agents/AgentPanel.tsx                      │ │
│  │                                                                            │ │
│  │  <AgentPanel                                                               │ │
│  │    agents={...}                                                            │ │
│  │    currentAgent={state.activeAgent}                                        │ │
│  │    showParallel={state.showParallelPanel}  // ← from state                 │ │
│  │    parallelAgents={state.parallelAgents}   // ← from state                 │ │
│  │  />                                                                        │ │
│  │                                                                            │ │
│  │  Renders ParallelSection when:                                             │ │
│  │    showParallel === true && parallelAgents.length > 1                      │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Component Interfaces

#### AgentInfo (with parallel status)
```typescript
// packages/cli/src/ui/components/agents/AgentPanel.tsx:8-14
export interface AgentInfo {
  name: string;
  status: 'active' | 'waiting' | 'completed' | 'idle' | 'parallel';  // 'parallel' for concurrent execution
  stage?: string;
  progress?: number; // 0-100
  startedAt?: Date;  // For elapsed time tracking
}
```

#### AgentPanelProps (parallel props)
```typescript
// packages/cli/src/ui/components/agents/AgentPanel.tsx:16-22
export interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  compact?: boolean;
  showParallel?: boolean;      // Controls parallel section visibility
  parallelAgents?: AgentInfo[]; // Agents executing in parallel
}
```

#### AppState (parallel tracking)
```typescript
// packages/cli/src/ui/App.tsx:69-71
export interface AppState {
  // ... other fields
  parallelAgents?: AgentInfo[];  // Agents running in parallel
  showParallelPanel?: boolean;   // Whether to show parallel section
}
```

### Orchestrator Event Emission Logic

```typescript
// packages/orchestrator/src/index.ts:717-728
// When multiple stages are ready to execute
if (readyStages.length > 1) {
  await this.store.addLog(task.id, {
    level: 'info',
    message: `Running ${readyStages.length} stages in parallel: ${readyStages.map(s => s.name).join(', ')}`,
  });

  // Emit parallel execution started event
  const stageNames = readyStages.map(s => s.name);
  const agentNames = readyStages.map(s => s.agent);
  this.emit('stage:parallel-started', task.id, stageNames, agentNames);
}

// packages/orchestrator/src/index.ts:833-836
// After all parallel stages complete
if (results.length > 1) {
  this.emit('stage:parallel-completed', task.id);
}
```

### Alternative Integration: useOrchestratorEvents Hook

For React components that need direct orchestrator integration:

```typescript
// packages/cli/src/ui/hooks/useOrchestratorEvents.ts:132-165
export function useOrchestratorEvents(options) {
  // ... setup ...

  const handleParallelStart = (eventTaskId, stages, agents) => {
    const parallelAgents = agents.map((agent, index) => ({
      name: agent,
      status: 'parallel' as const,
      stage: stages[index],
    }));
    setState(prev => ({
      ...prev,
      parallelAgents,
      showParallelPanel: agents.length > 1,
    }));
  };

  const handleParallelComplete = (eventTaskId) => {
    setState(prev => ({
      ...prev,
      parallelAgents: [],
      showParallelPanel: false,
    }));
  };

  // Register listeners
  orchestrator.on('stage:parallel-started', handleParallelStart);
  orchestrator.on('stage:parallel-completed', handleParallelComplete);
}
```

### UI Rendering

#### Full Mode (ParallelSection)
```
╭────────────────────────────────────╮
│ Active Agents                       │
├────────────────────────────────────┤
│ ⚡ planner (planning)               │
│ · architect                         │
│                                    │
│ ⟂ Parallel Execution                │
│   ⟂ developer (implementation)      │
│     ████████████░░░░░░░░ 50%       │
│   ⟂ tester (testing)                │
│     ██████░░░░░░░░░░░░░░ 30%       │
╰────────────────────────────────────╯
```

#### Compact Mode
```
⚡planner[42s] │ ○architect │ ⟂developer,tester
```

### State Lifecycle

```
Task Started
    │
    ▼
Sequential Stage Execution
    │
    ▼
Multiple Stages Ready? ──No──▶ Continue Sequential
    │
    Yes
    │
    ▼
emit('stage:parallel-started')
    │
    ▼
REPL Handler → updateState({
    parallelAgents: [...],
    showParallelPanel: true
})
    │
    ▼
AgentPanel renders ParallelSection
    │
    ▼
Promise.all(stagePromises)
    │
    ▼
emit('stage:parallel-completed')
    │
    ▼
REPL Handler → updateState({
    parallelAgents: [],
    showParallelPanel: false
})
    │
    ▼
ParallelSection hidden
```

### State Cleanup Points

The parallel state is automatically cleared at:
1. `stage:parallel-completed` event (normal completion)
2. `task:completed` event (task success)
3. `task:failed` event (task error)

```typescript
// packages/cli/src/repl.tsx - cleanup on completion/failure
ctx.orchestrator.on('task:completed', (task) => {
  ctx.app?.updateState({
    parallelAgents: [],
    showParallelPanel: false,
    // ... other cleanup
  });
});

ctx.orchestrator.on('task:failed', (task, error) => {
  ctx.app?.updateState({
    parallelAgents: [],
    showParallelPanel: false,
    // ... other cleanup
  });
});
```

## Architectural Decisions

### Decision 1: Event-Driven Architecture
**Choice**: Use EventEmitter pattern for orchestrator → UI communication
**Rationale**: Decouples backend execution from UI rendering; enables multiple listeners
**Trade-off**: Requires careful event cleanup to prevent memory leaks

### Decision 2: Props-Based UI State
**Choice**: Pass parallel state via props rather than context or internal polling
**Rationale**: Follows React's unidirectional data flow; enables easy testing
**Trade-off**: Requires prop drilling through component hierarchy

### Decision 3: Conditional Rendering Threshold
**Choice**: Only show ParallelSection when `parallelAgents.length > 1`
**Rationale**: Single parallel agent doesn't require dedicated section; prevents UI flicker
**Trade-off**: Users won't see parallel indicator for single-agent parallel scenarios

### Decision 4: Cyan Color for Parallel Status
**Choice**: Use cyan color and ⟂ icon for parallel agents
**Rationale**: Distinct from agent-specific colors; visually indicates special state
**Trade-off**: Loses agent color identity during parallel execution

## Testing Strategy

The implementation includes comprehensive test coverage:
- `AgentPanel.parallel-integration.test.tsx` - Integration tests
- `AgentPanel.parallel-edge-cases.test.tsx` - Edge case scenarios
- `AgentPanel.parallel-timing.test.tsx` - Timing and lifecycle tests
- `useOrchestratorEvents.ts` - Hook unit tests

## Consequences

### Positive
- Clean event-driven architecture separating concerns
- Real-time UI updates reflect actual execution state
- Comprehensive test coverage ensures reliability
- Works with both full and compact AgentPanel modes

### Negative
- Multiple layers of event/state transformation
- Requires understanding of full event flow for debugging

### Neutral
- Existing architecture is stable and well-documented
- No additional implementation needed - wiring is complete

## Verification

To verify the implementation is working:

1. Run a workflow with parallel stages (e.g., developer + tester stages with no dependencies)
2. Observe orchestrator log: "Running 2 stages in parallel: ..."
3. REPL should update UI to show ParallelSection
4. Upon completion, ParallelSection should hide

## Related ADRs

- [ADR-012: AgentPanel Parallel Execution Props Architecture](./ADR-012-agentpanel-parallel-execution-architecture.md)
- [ADR-014: AgentPanel Enhancements Complete Architecture](./ADR-014-agentpanel-enhancements-complete-architecture.md)

## File References

| Component | File | Key Lines |
|-----------|------|-----------|
| Event Definitions | `/packages/orchestrator/src/index.ts` | 64-66 |
| Event Emission (start) | `/packages/orchestrator/src/index.ts` | 724-727 |
| Event Emission (complete) | `/packages/orchestrator/src/index.ts` | 833-835 |
| REPL Event Handlers | `/packages/cli/src/repl.tsx` | 1507-1525 |
| App State | `/packages/cli/src/ui/App.tsx` | 69-71 |
| AgentPanel Props | `/packages/cli/src/ui/components/agents/AgentPanel.tsx` | 16-22 |
| AgentPanel Rendering | `/packages/cli/src/ui/App.tsx` | 509-514 |
| ParallelSection | `/packages/cli/src/ui/components/agents/AgentPanel.tsx` | 187-243 |
| useOrchestratorEvents Hook | `/packages/cli/src/ui/hooks/useOrchestratorEvents.ts` | 132-165 |
