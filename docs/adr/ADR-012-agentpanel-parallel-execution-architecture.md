# ADR-012: AgentPanel Parallel Execution Props Architecture

## Status
Accepted

## Date
2024-12-12

## Context

The AgentPanel component needed to be enhanced to support parallel execution visualization as part of the APEX v0.3.0 Rich Terminal UI feature set. The acceptance criteria specified:

1. AgentPanel accepts `parallelAgents`, `showParallel` props
2. AgentInfo type includes `'parallel'` status
3. Type definitions exported correctly

## Technical Design Analysis

### Current Implementation Status: ✅ COMPLETE

After comprehensive analysis, all acceptance criteria have been fully implemented:

#### 1. AgentInfo Type Enhancement

**File**: `packages/cli/src/ui/components/agents/AgentPanel.tsx`

```typescript
export interface AgentInfo {
  name: string;
  status: 'active' | 'waiting' | 'completed' | 'idle' | 'parallel';  // ✅ 'parallel' added
  stage?: string;
  progress?: number; // 0-100
}
```

The `'parallel'` status is fully integrated with:
- Status icon: `⟂` symbol for parallel agents
- Color scheme: Cyan color for parallel agents
- Both compact and full rendering modes

#### 2. AgentPanelProps Interface Enhancement

**File**: `packages/cli/src/ui/components/agents/AgentPanel.tsx`

```typescript
export interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  compact?: boolean;
  showParallel?: boolean;      // ✅ Added - controls parallel section visibility
  parallelAgents?: AgentInfo[]; // ✅ Added - list of parallel agents
}
```

#### 3. Type Exports

**File**: `packages/cli/src/ui/components/agents/index.ts`

```typescript
export { AgentPanel, type AgentInfo, type AgentPanelProps } from './AgentPanel.js';
export { HandoffIndicator, type HandoffIndicatorProps } from './HandoffIndicator.js';
```

**File**: `packages/cli/src/ui/components/index.ts`

```typescript
export { AgentPanel, HandoffIndicator, type AgentInfo, type AgentPanelProps, type HandoffIndicatorProps } from './agents/index.js';
```

### Architecture Decisions

#### Decision 1: Prop-Based Parallel State

**Choice**: Parallel execution state is passed via props rather than internal state or context.

**Rationale**:
- Follows React's unidirectional data flow principle
- State is owned by the REPL/App layer and flows down
- Enables easy testing with prop injection
- Matches the existing pattern for `currentAgent`

**Alternative Considered**: Internal polling of orchestrator state.
**Rejected Because**: Breaks separation of concerns; components shouldn't access backend directly.

#### Decision 2: Conditional Parallel Section Rendering

**Choice**: ParallelSection renders only when `showParallel=true && parallelAgents.length > 1`

**Rationale**:
- Single parallel agent doesn't require a dedicated section (just update status)
- Explicit `showParallel` prop gives control to parent component
- Prevents UI flickering during brief parallel windows

**Behavior Matrix**:

| showParallel | parallelAgents.length | Result |
|--------------|----------------------|--------|
| false        | any                  | Hidden |
| true         | 0                    | Hidden |
| true         | 1                    | Hidden |
| true         | 2+                   | Shown  |

#### Decision 3: Parallel Status Icon

**Choice**: `⟂` (perpendicular symbol) for parallel execution

**Rationale**:
- Visually represents forking/parallelism
- Distinct from other status icons (⚡ active, ○ waiting, ✓ completed, · idle)
- Unicode-safe for terminal environments

### Component Architecture

```
┌─────────────────────────────────────────────────┐
│                 App.tsx                         │
│  ┌───────────────────────────────────────────┐  │
│  │ AppState:                                 │  │
│  │  - activeAgent?: string                   │  │
│  │  - previousAgent?: string                 │  │
│  │  - parallelAgents?: AgentInfo[]          │  │
│  │  - showParallelPanel?: boolean           │  │
│  └───────────────────────────────────────────┘  │
│                      │                          │
│                      │ Props                    │
│                      ▼                          │
│  ┌───────────────────────────────────────────┐  │
│  │ AgentPanel                                │  │
│  │  Props: agents, currentAgent, compact,    │  │
│  │         showParallel, parallelAgents      │  │
│  │                                           │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │ useAgentHandoff(currentAgent)       │  │  │
│  │  │  → HandoffAnimationState            │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  │                                           │  │
│  │  Renders:                                │  │
│  │   - AgentRow (for each agent)            │  │
│  │   - HandoffIndicator                     │  │
│  │   - ParallelSection (conditional)        │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Data Flow for Parallel Execution

```
Orchestrator
    │
    │ emits: 'stage:parallel-started'
    │        (taskId, stageNames, agentNames)
    ▼
REPL Event Handler
    │
    │ converts to: AgentInfo[]
    │
    ▼
App.updateState({
    parallelAgents: [...],
    showParallelPanel: true
})
    │
    │ props
    ▼
<AgentPanel
    showParallel={state.showParallelPanel}
    parallelAgents={state.parallelAgents}
/>
    │
    │ renders
    ▼
<ParallelSection agents={parallelAgents} />
```

### UI Rendering Details

#### Full Mode Parallel Section

```
┌────────────────────────────────┐
│ Active Agents                  │
├────────────────────────────────┤
│ ⚡ planner (planning)          │
│ · architect                    │
│ · developer                    │
│ · tester                       │
│                                │
│ ⟂ Parallel Execution           │
│   ⟂ developer (development)   │
│   ⟂ tester (testing)          │
└────────────────────────────────┘
```

#### Compact Mode Parallel Display

```
⚡planner │ ○architect │ ○developer │ ⟂developer,tester
```

### Build Status Note

The source implementation is complete. However, the TypeScript declaration files (`.d.ts`) in `dist/` are outdated and need a rebuild:

**Current dist/ui/components/agents/AgentPanel.d.ts**:
```typescript
// OUTDATED - missing 'parallel' status and new props
export interface AgentInfo {
    name: string;
    status: 'active' | 'waiting' | 'completed' | 'idle';  // Missing 'parallel'
    stage?: string;
    progress?: number;
}
export interface AgentPanelProps {
    agents: AgentInfo[];
    currentAgent?: string;
    compact?: boolean;          // Missing showParallel, parallelAgents
}
```

**Action Required**: Run `npm run build` to regenerate type declarations.

## Consequences

### Positive
- Clean separation of concerns between data and presentation
- Testable architecture with prop-based state
- Consistent with React best practices
- Extensible for future parallel execution features

### Negative
- Requires coordinated updates across REPL, App, and AgentPanel
- Build step required to sync type declarations

## References

- [AgentPanel Implementation](/packages/cli/src/ui/components/agents/AgentPanel.tsx)
- [ADR-007: AgentPanel Event Wiring](/docs/architecture/ADR-007-agent-panel-event-wiring.md)
- [ADR-008: Test Coverage Improvement](/docs/adr/ADR-008-agentpanel-test-coverage-improvement.md)
- [App.tsx Integration](/packages/cli/src/ui/App.tsx)

## Appendix: Complete Interface Specifications

### AgentInfo (Final)
```typescript
export interface AgentInfo {
  name: string;
  status: 'active' | 'waiting' | 'completed' | 'idle' | 'parallel';
  stage?: string;
  progress?: number; // 0-100
}
```

### AgentPanelProps (Final)
```typescript
export interface AgentPanelProps {
  agents: AgentInfo[];          // Main agent list
  currentAgent?: string;        // Currently active agent (drives handoff)
  compact?: boolean;            // Layout mode toggle
  showParallel?: boolean;       // Whether to show parallel section
  parallelAgents?: AgentInfo[]; // Agents executing in parallel
}
```

### Status Icon Mapping
```typescript
const statusIcons: Record<AgentInfo['status'], string> = {
  active: '⚡',     // Lightning bolt - currently executing
  waiting: '○',    // Circle - queued/pending
  completed: '✓',  // Checkmark - finished
  idle: '·',       // Dot - not yet started
  parallel: '⟂',   // Perpendicular - parallel execution
};
```
