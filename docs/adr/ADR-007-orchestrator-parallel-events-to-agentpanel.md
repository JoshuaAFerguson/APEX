# ADR-007: Wire Orchestrator Parallel Execution Events to AgentPanel

**Status**: Accepted
**Date**: 2024-12-16
**Context**: AgentPanel enhancements for handoff animations and parallel execution visualization

## Context

The APEX orchestrator supports parallel execution of workflow stages when dependency constraints allow multiple stages to run concurrently. This capability needs to be surfaced in the CLI UI (AgentPanel) so users can visualize which agents are running in parallel.

## Analysis Summary

### Current State: ✅ **ALREADY IMPLEMENTED**

After comprehensive analysis of the codebase, the wiring between orchestrator parallel execution events and AgentPanel is **already fully implemented**. The implementation follows a clean, well-architected pattern.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ApexOrchestrator                              │
│  (EventEmitter<OrchestratorEvents>)                             │
│                                                                  │
│  Emits:                                                          │
│    - stage:parallel-started(taskId, stages[], agents[])         │
│    - stage:parallel-completed(taskId)                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
  ┌───────────┐   ┌──────────────┐  ┌──────────────┐
  │ CLI REPL  │   │ useOrch-     │  │ API Server   │
  │ (repl.tsx)│   │ estratorEvents│  │ (WebSocket)  │
  └─────┬─────┘   └──────┬───────┘  └──────────────┘
        │                │
        ▼                ▼
  ┌───────────┐   ┌──────────────┐
  │ App.tsx   │   │ AgentPanel   │
  │ (state)   │   │ (props)      │
  └───────────┘   └──────────────┘
```

### Integration Points

#### 1. Orchestrator Event Definition
**File**: `packages/orchestrator/src/index.ts`

```typescript
export interface OrchestratorEvents {
  // ... other events
  'stage:parallel-started': (taskId: string, stages: string[], agents: string[]) => void;
  'stage:parallel-completed': (taskId: string) => void;
}
```

#### 2. Event Emission
**File**: `packages/orchestrator/src/index.ts` (lines 776, 884)

The orchestrator emits parallel events in `runWorkflow()`:
- When `readyStages.length > 1`: emits `stage:parallel-started`
- After `Promise.all()` completion when `results.length > 1`: emits `stage:parallel-completed`

#### 3. REPL Event Wiring (Primary Path)
**File**: `packages/cli/src/repl.tsx` (lines 1506-1525)

```typescript
// In startInkREPL()
ctx.orchestrator.on('stage:parallel-started', (taskId, stages, agents) => {
  const parallelAgents = agents.map(name => ({
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

#### 4. Hook-Based Event Wiring (Alternative Path)
**File**: `packages/cli/src/ui/hooks/useOrchestratorEvents.ts`

A React hook that provides an alternative integration pattern for components that receive an orchestrator instance as a prop:

```typescript
// Event listeners registered
orchestrator.on('stage:parallel-started', handleParallelStart);
orchestrator.on('stage:parallel-completed', handleParallelComplete);

// handleParallelStart updates state:
setState(prev => ({
  ...prev,
  parallelAgents: agents.map((agent, index) => ({
    name: agent,
    status: 'parallel' as const,
    stage: stages[index],
  })),
  showParallelPanel: agents.length > 1,
}));
```

#### 5. App State Structure
**File**: `packages/cli/src/ui/App.tsx`

```typescript
export interface AppState {
  // ... other fields

  // Parallel execution tracking
  parallelAgents?: AgentInfo[];  // Agents running in parallel
  showParallelPanel?: boolean;   // Whether to show parallel section
}
```

#### 6. AgentPanel Props
**File**: `packages/cli/src/ui/components/agents/AgentPanel.tsx`

```typescript
export interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  compact?: boolean;
  showParallel?: boolean;          // Controls parallel section visibility
  parallelAgents?: AgentInfo[];    // Parallel agent data
  useDetailedParallelView?: boolean;
}
```

#### 7. AgentPanel Usage in App
**File**: `packages/cli/src/ui/App.tsx` (lines 509-515)

```typescript
<AgentPanel
  agents={getWorkflowAgents(state.currentTask.workflow, state.config)}
  currentAgent={state.activeAgent}
  showParallel={state.showParallelPanel}
  parallelAgents={state.parallelAgents}
/>
```

### Data Flow

1. **Orchestrator** detects multiple ready stages in `runWorkflow()`
2. **Orchestrator** emits `stage:parallel-started` with task ID, stage names, and agent names
3. **REPL** (`repl.tsx`) receives event and calls `ctx.app?.updateState()`
4. **App** (`App.tsx`) state updates with `parallelAgents` and `showParallelPanel`
5. **AgentPanel** receives updated props and renders parallel execution UI
6. When parallel stages complete, **Orchestrator** emits `stage:parallel-completed`
7. **REPL** clears parallel state via `updateState()`
8. **AgentPanel** hides parallel section

### Supporting Components

#### ParallelExecutionView
**File**: `packages/cli/src/ui/components/agents/ParallelExecutionView.tsx`

Detailed view component for rendering parallel agents in a card grid layout:
- Displays agent name, status, stage, elapsed time, and progress
- Groups agents into rows (default 3 columns)
- Uses cyan color scheme for parallel indicators

#### ParallelSection (inline in AgentPanel)
A simpler inline view within AgentPanel for displaying parallel agents with the `⟂` icon.

### Cleanup on Task Completion/Failure
**File**: `packages/cli/src/repl.tsx` (lines 1389-1407)

```typescript
ctx.orchestrator.on('task:completed', (task) => {
  ctx.app?.updateState({
    subtaskProgress: undefined,
    previousAgent: undefined,
    parallelAgents: [],
    showParallelPanel: false,
  });
});

ctx.orchestrator.on('task:failed', (task, error) => {
  ctx.app?.updateState({
    subtaskProgress: undefined,
    previousAgent: undefined,
    parallelAgents: [],
    showParallelPanel: false,
  });
});
```

## Decision

**No code changes are required.** The implementation is complete and follows the architectural patterns established in the codebase.

The acceptance criteria are satisfied:
1. ✅ REPL/App receives orchestrator events for parallel task execution
2. ✅ parallelAgents state is updated when agents start/complete parallel work
3. ✅ Integration works with existing event system

## Verification Points

### Test Coverage
The implementation includes comprehensive tests in:
- `AgentPanel.integration.test.tsx` - Event integration tests
- `AgentPanel.workflow-integration.test.tsx` - End-to-end workflow tests
- `AgentPanel.parallel-orchestrator-event-wiring.test.tsx` - Specific wiring tests
- Test utilities including `MockOrchestrator` for event simulation

### Key Files Summary

| File | Role |
|------|------|
| `packages/orchestrator/src/index.ts` | Event emission |
| `packages/cli/src/repl.tsx` | Event listening & state updates |
| `packages/cli/src/ui/App.tsx` | State management & prop passing |
| `packages/cli/src/ui/components/agents/AgentPanel.tsx` | UI rendering |
| `packages/cli/src/ui/components/agents/ParallelExecutionView.tsx` | Detailed parallel view |
| `packages/cli/src/ui/hooks/useOrchestratorEvents.ts` | Alternative hook-based integration |

## Consequences

### Positive
- Clean separation of concerns between orchestrator, REPL, and UI components
- Two integration patterns available (direct event subscription vs hook-based)
- Comprehensive test coverage with MockOrchestrator utility
- Real-time visual feedback for parallel execution

### Considerations for Future Work
- The `useOrchestratorEvents` hook is available for components that need orchestrator integration but don't have access to the global context
- Progress tracking for individual parallel agents could be enhanced if the orchestrator emits progress events
- The elapsed time display uses the `useElapsedTime` hook but requires `startedAt` to be set in the parallel agent info

## References

- `packages/orchestrator/src/index.ts` - OrchestratorEvents interface (lines 47-70)
- `packages/cli/src/repl.tsx` - Event wiring (lines 1506-1525)
- `packages/cli/src/ui/App.tsx` - State and rendering (lines 66-71, 509-515)
- `packages/cli/src/ui/hooks/useOrchestratorEvents.ts` - Hook implementation
- Test files in `packages/cli/src/ui/components/agents/__tests__/`
