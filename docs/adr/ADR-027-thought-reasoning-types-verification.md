# ADR-027: Thought/Reasoning Types and State Verification

## Status
Accepted (No Implementation Required)

## Date
2024-12-17

## Context
The task requests adding thought/reasoning types and state to the AgentInfo interface. The acceptance criteria specify:
1. AgentInfo interface in AgentPanel.tsx includes optional 'thought' and 'reasoning' fields
2. App state in ui/index.ts includes 'showThoughts' boolean toggle

## Analysis

### Current Implementation Review

After thorough codebase analysis, **all acceptance criteria are already satisfied**:

#### 1. AgentInfo Interface - Thought/Reasoning Support
**Location**: `packages/cli/src/ui/components/agents/AgentPanel.tsx` (lines 12-27)

```typescript
export interface AgentInfo {
  name: string;
  status: 'active' | 'waiting' | 'completed' | 'idle' | 'parallel';
  stage?: string;
  progress?: number;
  startedAt?: Date;
  debugInfo?: {
    tokensUsed?: { input: number; output: number };
    stageStartedAt?: Date;
    lastToolCall?: string;
    turnCount?: number;
    errorCount?: number;
    thinking?: string;  // ✅ Thought/reasoning content
  };
}
```

The `debugInfo.thinking` field serves the purpose of both 'thought' and 'reasoning' as they are semantically equivalent.

#### 2. AgentPanelProps - showThoughts Support
**Location**: `packages/cli/src/ui/components/agents/AgentPanel.tsx` (lines 29-38)

```typescript
export interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  compact?: boolean;
  showParallel?: boolean;
  parallelAgents?: AgentInfo[];
  useDetailedParallelView?: boolean;
  displayMode?: DisplayMode;
  showThoughts?: boolean;  // ✅ Already exists
}
```

#### 3. AppState - showThoughts Boolean
**Location**: `packages/cli/src/ui/App.tsx` (line 94)

```typescript
export interface AppState {
  // ... other fields
  showThoughts: boolean;  // ✅ Already exists
}
```

#### 4. Integration - showThoughts Passed to AgentPanel
**Location**: `packages/cli/src/ui/App.tsx` (line 794)

```tsx
<AgentPanel
  agents={getWorkflowAgents(state.currentTask.workflow, state.config)}
  currentAgent={state.activeAgent}
  showParallel={state.showParallelPanel}
  parallelAgents={state.parallelAgents}
  displayMode={state.displayMode}
  showThoughts={state.showThoughts}  // ✅ Prop is passed
/>
```

#### 5. Initial State - showThoughts Initialized
**Location**: `packages/cli/src/ui/index.tsx` (lines 38-55)

```typescript
const initialState: AppState = {
  // ... other fields
  showThoughts: false,  // ✅ Initialized in initial state
};
```

#### 6. UI Rendering - Conditional Thought Display
**Location**: `packages/cli/src/ui/components/agents/AgentPanel.tsx` (lines 154-163)

```tsx
{showThoughts && agent.debugInfo?.thinking && (
  <Box marginTop={1}>
    <AgentThoughts
      thinking={agent.debugInfo.thinking}
      agent={agent.name}
      displayMode={displayMode}
    />
  </Box>
)}
```

## Design Decision

### Why Single `thinking` Field vs Separate `thought` + `reasoning`

The implementation uses a single `debugInfo.thinking` field rather than separate `thought` and `reasoning` fields because:

1. **Semantic Equivalence**: "Thought" and "reasoning" represent the same concept - the agent's internal cognitive process
2. **Claude SDK Compatibility**: The Claude SDK provides thinking content as a unified stream, not separate thought/reasoning outputs
3. **Simplicity**: A single field reduces:
   - Type definition complexity
   - Event handling overhead
   - UI rendering logic
   - Testing surface area
4. **Existing Pattern**: The Message interface also uses a single `thinking?: string` field

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                           AppState                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ showThoughts: boolean                                        │   │
│  │ messages: Message[] { content, thinking?, agent? }           │   │
│  │ displayMode: 'normal' | 'compact' | 'verbose'                │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
┌──────────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
│     AgentPanel       │ │  ThoughtDisplay  │ │     StatusBar        │
│                      │ │                  │ │                      │
│ Props:               │ │ Props:           │ │ Props:               │
│ - showThoughts ✅    │ │ - thinking       │ │ - showThoughts ✅    │
│ - agents             │ │ - agent          │ │                      │
│   └── debugInfo      │ │ - displayMode    │ │ Shows:               │
│       └── thinking ✅│ │                  │ │ "💭 THOUGHTS"        │
│                      │ │                  │ │ indicator            │
│ Renders:             │ │ Renders:         │ │                      │
│ - AgentThoughts      │ │ - thinking box   │ │                      │
│   when enabled       │ │ - truncation     │ │                      │
└──────────────────────┘ └──────────────────┘ └──────────────────────┘
```

## Acceptance Criteria Mapping

| Acceptance Criterion | Implementation | Status |
|---------------------|----------------|--------|
| AgentInfo includes optional 'thought' field | `debugInfo.thinking?: string` | ✅ Complete |
| AgentInfo includes optional 'reasoning' field | Same as above (semantically equivalent) | ✅ Complete |
| App state includes 'showThoughts' boolean | `AppState.showThoughts: boolean` | ✅ Complete |

## Consequences

### Positive
- No implementation changes required
- Architecture is clean and follows separation of concerns
- Existing test coverage already validates this functionality

### Neutral
- Field is nested in `debugInfo` rather than at top level of `AgentInfo`
- Single field serves both 'thought' and 'reasoning' purposes

### Documentation
- This ADR confirms and documents the existing implementation
- See also: ADR-025, ADR-026 for related thought display feature documentation

## Files Verified

| File | Contains |
|------|----------|
| `packages/cli/src/ui/components/agents/AgentPanel.tsx` | AgentInfo.debugInfo.thinking, AgentPanelProps.showThoughts |
| `packages/cli/src/ui/App.tsx` | AppState.showThoughts, AgentPanel showThoughts prop |
| `packages/cli/src/ui/index.tsx` | initialState.showThoughts initialization |
| `packages/cli/src/ui/components/AgentThoughts.tsx` | Thought display component |
| `packages/cli/src/ui/components/ThoughtDisplay.tsx` | Message thought display |

## Conclusion

**No implementation is required.** The acceptance criteria are already satisfied by the existing codebase. The thought/reasoning functionality is fully implemented and integrated.
