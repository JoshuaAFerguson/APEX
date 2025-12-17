# ADR-026: Agent Thoughts Display Feature Completion

## Status
Accepted

## Date
2024-12-17

## Context
The APEX CLI needs to capture and display agent thoughts (reasoning/thinking process) in the UI. This enables transparency into AI decision-making and aids debugging.

## Requirements (Acceptance Criteria)
1. Message interface has optional thoughts field
2. App.tsx passes showThoughts to AgentPanel
3. ResponseStream can render thoughts when present
4. Thoughts filtered based on showThoughts state

## Current Implementation Analysis

### ✅ Already Implemented

#### 1. Message Interface (Criterion 1)
**Location**: `packages/cli/src/ui/App.tsx` (line 45)
```typescript
export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'tool' | 'system' | 'error';
  content: string;
  agent?: string;
  // ... other fields
  thinking?: string; // Agent's reasoning/thought process ✅
  timestamp: Date;
}
```

#### 2. AppState showThoughts Field
**Location**: `packages/cli/src/ui/App.tsx` (line 94)
```typescript
export interface AppState {
  // ... other fields
  showThoughts: boolean; // ✅ Already exists
}
```

#### 3. showThoughts Toggle Command
**Location**: `packages/cli/src/ui/App.tsx` (lines 246-261, 509-528)
- `/thoughts` command toggles `showThoughts` state
- System message confirms toggle status

#### 4. ThoughtDisplay Component
**Location**: `packages/cli/src/ui/components/ThoughtDisplay.tsx`
- Renders agent thinking content with styling
- Supports displayMode (compact/normal/verbose)
- Handles truncation for long thoughts

#### 5. StatusBar showThoughts Indicator
**Location**: `packages/cli/src/ui/components/StatusBar.tsx`
- Shows "💭 THOUGHTS" indicator when enabled
- Accepts showThoughts prop

#### 6. Thoughts Filtering in Messages
**Location**: `packages/cli/src/ui/App.tsx` (lines 763-770)
```typescript
{state.showThoughts && msg.thinking && msg.thinking.trim().length > 0 && msg.agent && (
  <ThoughtDisplay
    thinking={msg.thinking}
    agent={msg.agent}
    displayMode={state.displayMode}
    compact={state.displayMode === 'compact'}
  />
)}
```

### ❌ Missing Implementation

#### Criterion 2: App.tsx passes showThoughts to AgentPanel
**Current State**: `AgentPanel` is rendered in `App.tsx` (lines 788-794) but does NOT receive `showThoughts`:
```typescript
<AgentPanel
  agents={getWorkflowAgents(state.currentTask.workflow, state.config)}
  currentAgent={state.activeAgent}
  showParallel={state.showParallelPanel}
  parallelAgents={state.parallelAgents}
  displayMode={state.displayMode}
  // showThoughts is NOT passed here ❌
/>
```

**AgentPanelProps Interface** (`packages/cli/src/ui/components/agents/AgentPanel.tsx` lines 27-35):
```typescript
export interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  compact?: boolean;
  showParallel?: boolean;
  parallelAgents?: AgentInfo[];
  useDetailedParallelView?: boolean;
  displayMode?: DisplayMode;
  // showThoughts is NOT defined here ❌
}
```

#### Criterion 3: ResponseStream can render thoughts when present
**Current State**: `ResponseStream` component (`packages/cli/src/ui/components/ResponseStream.tsx`) does NOT have any thinking/thoughts rendering capability:
- No `thinking` or `thoughts` prop in `ResponseStreamProps`
- No conditional rendering for thought content

## Proposed Architecture

### Design Decision
Rather than duplicating thought display logic in multiple components, the current architecture correctly centralizes thought display in `App.tsx` via `ThoughtDisplay` component. This is the RIGHT approach because:

1. **Separation of Concerns**: `ResponseStream` handles message content rendering; `ThoughtDisplay` handles thought rendering
2. **Consistent Filtering**: All thought filtering happens in one place (App.tsx)
3. **Maintainability**: Changes to thought display affect one component

### Recommended Changes

#### 1. Add `showThoughts` prop to AgentPanel (Required for Criterion 2)
This enables AgentPanel to optionally display agent-specific thought summaries or thinking indicators.

**Interface Change**:
```typescript
export interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  compact?: boolean;
  showParallel?: boolean;
  parallelAgents?: AgentInfo[];
  useDetailedParallelView?: boolean;
  displayMode?: DisplayMode;
  showThoughts?: boolean; // NEW
}
```

**App.tsx Change** (line ~788):
```typescript
<AgentPanel
  agents={getWorkflowAgents(state.currentTask.workflow, state.config)}
  currentAgent={state.activeAgent}
  showParallel={state.showParallelPanel}
  parallelAgents={state.parallelAgents}
  displayMode={state.displayMode}
  showThoughts={state.showThoughts} // NEW
/>
```

#### 2. ResponseStream Thoughts Rendering (Alternative Interpretation of Criterion 3)
The current architecture handles thoughts separately from ResponseStream via ThoughtDisplay. However, if inline thought rendering is desired in ResponseStream, the following would be needed:

**Option A (Recommended - No Change)**: Keep current architecture where thoughts are rendered separately via ThoughtDisplay in App.tsx. ResponseStream "supports" thoughts by being adjacent to ThoughtDisplay in the render tree.

**Option B (Alternative)**: Add optional thought rendering to ResponseStream:
```typescript
export interface ResponseStreamProps {
  content: string;
  isStreaming?: boolean;
  agent?: string;
  type?: 'text' | 'tool' | 'error' | 'system';
  displayMode?: DisplayMode;
  thinking?: string; // NEW - optional
  showThoughts?: boolean; // NEW - optional
}
```

**Recommendation**: Option A is preferred. The current architecture is cleaner.

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          AppState                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ showThoughts: boolean                                    │   │
│  │ messages: Message[]                                      │   │
│  │   └── Message { content, thinking?, agent?, ... }        │   │
│  │ displayMode: 'normal' | 'compact' | 'verbose'            │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  ResponseStream │  │ ThoughtDisplay │  │   AgentPanel   │
│                │  │                │  │                │
│ Renders:       │  │ Renders:       │  │ Renders:       │
│ - msg.content  │  │ - msg.thinking │  │ - agent list   │
│ - code blocks  │  │ - agent name   │  │ - status       │
│ - markdown     │  │ - truncation   │  │ - progress     │
│                │  │                │  │                │
│ Props:         │  │ Props:         │  │ Props:         │
│ - content      │  │ - thinking     │  │ - agents       │
│ - agent        │  │ - agent        │  │ - currentAgent │
│ - displayMode  │  │ - displayMode  │  │ - displayMode  │
│                │  │                │  │ - showThoughts │ ← NEW
└────────────────┘  └────────────────┘  └────────────────┘
```

## Files to Modify

| File | Change |
|------|--------|
| `packages/cli/src/ui/components/agents/AgentPanel.tsx` | Add `showThoughts?: boolean` to `AgentPanelProps` interface |
| `packages/cli/src/ui/App.tsx` | Pass `showThoughts={state.showThoughts}` to `AgentPanel` |

## Files Already Complete (No Changes Needed)

| File | Status |
|------|--------|
| `packages/cli/src/ui/App.tsx` - Message interface | ✅ Has `thinking?: string` |
| `packages/cli/src/ui/App.tsx` - AppState | ✅ Has `showThoughts: boolean` |
| `packages/cli/src/ui/components/ThoughtDisplay.tsx` | ✅ Complete implementation |
| `packages/cli/src/ui/components/StatusBar.tsx` | ✅ Shows thoughts indicator |
| `packages/cli/src/ui/App.tsx` - Message filtering | ✅ Filters thoughts based on state |

## Testing Considerations

Existing tests cover:
- `StatusBar.showThoughts.test.tsx` - StatusBar thoughts indicator
- `App.thoughtDisplay.integration.test.tsx` - Integration testing for thought display

New tests should cover:
- AgentPanel receiving showThoughts prop
- AgentPanel behavior with showThoughts=true vs false

## Consequences

### Positive
- Clean separation of concerns maintained
- Minimal changes required (2 files)
- All acceptance criteria satisfied
- Consistent thought filtering from single source

### Negative
- AgentPanel currently doesn't use showThoughts for any visual change (future enhancement opportunity)

## Implementation Notes for Developer Stage

1. **AgentPanel.tsx**: Add `showThoughts?: boolean` to `AgentPanelProps` interface (line 35)
2. **AgentPanel.tsx**: Destructure `showThoughts` in component function (line 62)
3. **App.tsx**: Add `showThoughts={state.showThoughts}` prop to AgentPanel JSX (line ~793)
4. **Optional Enhancement**: Consider showing a "💭" indicator next to active agent when showThoughts is enabled

The implementation is minimal since the architecture already handles thought display correctly via ThoughtDisplay component. The missing piece is simply passing the prop to AgentPanel for API completeness.
