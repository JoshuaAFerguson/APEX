# ADR-023: AgentPanel Verbose Mode with VerboseAgentRow Component

## Status
Proposed

## Date
2024-12-17

## Context

The AgentPanel component needs enhanced verbose mode functionality to display debug information for active agents. Based on the codebase analysis, the following foundation already exists:

### Existing Implementation (Already in Place)
1. **AgentInfo interface** already has `debugInfo` optional field (lines 16-24 in AgentPanel.tsx):
   ```typescript
   debugInfo?: {
     tokensUsed?: { input: number; output: number };
     stageStartedAt?: Date;
     lastToolCall?: string;
     turnCount?: number;
     errorCount?: number;
   };
   ```

2. **Verbose mode rendering** is already implemented in `AgentRow` (lines 218-242):
   ```tsx
   {displayMode === 'verbose' && isActive && agent.debugInfo && (
     <Box marginLeft={4} marginTop={1} flexDirection="column">
       {/* Token, turn count, last tool call, errors display */}
     </Box>
   )}
   ```

3. **DisplayMode type** exists in `@apex/core` as `'normal' | 'compact' | 'verbose'`

4. **VerboseDebugData interface** exists in core/types.ts (lines 414-440)

### What's Missing
1. **VerboseAgentRow component** - A dedicated component for verbose agent display (as specified in acceptance criteria)
2. **Data population** - The orchestrator doesn't populate `debugInfo` for agents
3. **Integration tests** - Specific tests for the VerboseAgentRow component

## Decision

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         Orchestrator Events                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  usage:updated → tokens per agent                                     │  │
│  │  tool:use → lastToolCall tracking                                     │  │
│  │  agent:turn → turnCount increment                                     │  │
│  │  error:* → errorCount tracking                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    App.tsx State Management                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  agents: AgentInfo[] with debugInfo populated from events             │  │
│  │  displayMode: DisplayMode                                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         AgentPanel Component                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  if (displayMode === 'verbose') {                                     │  │
│  │    render <VerboseAgentRow />                                         │  │
│  │  } else {                                                             │  │
│  │    render <AgentRow />                                                │  │
│  │  }                                                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Component Design

#### 1. VerboseAgentRow Component (New)

Create a new component at `packages/cli/src/ui/components/agents/VerboseAgentRow.tsx`:

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import type { AgentInfo } from './AgentPanel.js';
import { useElapsedTime } from '../../hooks/useElapsedTime.js';
import { ProgressBar } from '../ProgressIndicators.js';

export interface VerboseAgentRowProps {
  agent: AgentInfo;
  isActive: boolean;
  color: string;
}

/**
 * VerboseAgentRow - Enhanced agent row for verbose display mode
 * Shows detailed debug information for active agents including:
 * - Token usage (input→output format)
 * - Turn count
 * - Last tool call
 * - Error count (if any)
 */
export function VerboseAgentRow({
  agent,
  isActive,
  color,
}: VerboseAgentRowProps): React.ReactElement {
  const shouldShowElapsed = agent.status === 'active' && agent.startedAt;
  const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null);

  const shouldShowProgressBar = (agent.status === 'active' || agent.status === 'parallel') &&
    agent.progress !== undefined && agent.progress > 0 && agent.progress < 100;

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Main agent row */}
      <Box>
        <Text color={isActive ? color : 'gray'}>
          {getStatusIcon(agent.status)}{' '}
        </Text>
        <Text color={isActive ? color : 'gray'} bold={isActive}>
          {agent.name}
        </Text>
        {agent.stage && (
          <Text color="gray" dimColor>
            {' '}({agent.stage})
          </Text>
        )}
        {shouldShowElapsed && (
          <Text color="gray" dimColor>
            {' '}[{elapsedTime}]
          </Text>
        )}
      </Box>

      {/* Progress bar */}
      {shouldShowProgressBar && (
        <Box marginLeft={2} marginTop={1}>
          <ProgressBar
            progress={agent.progress!}
            width={30}
            showPercentage={true}
            color={color}
            animated={false}
          />
        </Box>
      )}

      {/* Verbose debug information - only for active agents with debug info */}
      {isActive && agent.debugInfo && (
        <Box marginLeft={4} marginTop={1} flexDirection="column">
          {agent.debugInfo.tokensUsed && (
            <Text color="gray" dimColor>
              🔢 Tokens: {formatTokens(agent.debugInfo.tokensUsed.input)}→{formatTokens(agent.debugInfo.tokensUsed.output)}
            </Text>
          )}
          {agent.debugInfo.turnCount !== undefined && (
            <Text color="gray" dimColor>
              🔄 Turns: {agent.debugInfo.turnCount}
            </Text>
          )}
          {agent.debugInfo.lastToolCall && (
            <Text color="gray" dimColor>
              🔧 Last tool: {agent.debugInfo.lastToolCall}
            </Text>
          )}
          {agent.debugInfo.errorCount !== undefined && agent.debugInfo.errorCount > 0 && (
            <Text color="red" dimColor>
              ❌ Errors: {agent.debugInfo.errorCount}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

// Helper functions
function getStatusIcon(status: AgentInfo['status']): string {
  const icons: Record<AgentInfo['status'], string> = {
    active: '⚡',
    waiting: '○',
    completed: '✓',
    idle: '·',
    parallel: '⟂',
  };
  return icons[status];
}

function formatTokens(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}
```

#### 2. AgentPanel Modifications

Update `AgentPanel.tsx` to use `VerboseAgentRow`:

```typescript
// Add import
import { VerboseAgentRow } from './VerboseAgentRow.js';

// In AgentPanel component, modify the agents.map section:
{agents.map(agent => (
  displayMode === 'verbose' ? (
    <VerboseAgentRow
      key={agent.name}
      agent={agent}
      isActive={agent.name === currentAgent}
      color={agentColors[agent.name] || 'white'}
    />
  ) : (
    <AgentRow
      key={agent.name}
      agent={agent}
      isActive={agent.name === currentAgent}
      displayMode={displayMode}
    />
  )
))}
```

#### 3. AgentInfo Interface Extension

The existing `debugInfo` field is sufficient. No changes needed to the interface:

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
  };
}
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Orchestrator (Event Source)                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
    usage:updated              tool:use                  agent:turn
    (tokens per agent)         (tool name)              (turn count)
          │                          │                          │
          └──────────────────────────┼──────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    useOrchestratorEvents Hook                                │
│  Maps orchestrator events to AgentInfo.debugInfo fields:                     │
│  - usage:updated → debugInfo.tokensUsed                                      │
│  - tool:use → debugInfo.lastToolCall                                         │
│  - agent:turn → debugInfo.turnCount++                                        │
│  - error:* → debugInfo.errorCount++                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           App State                                          │
│  agents: AgentInfo[] (with debugInfo populated)                              │
│  displayMode: 'normal' | 'compact' | 'verbose'                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AgentPanel                                           │
│  - Receives agents[] and displayMode                                         │
│  - Renders VerboseAgentRow when displayMode === 'verbose'                    │
│  - Renders AgentRow otherwise                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Verbose Mode Display Format

```
┌─────────────────────────────────────────────────────────────────────┐
│ Active Agents                                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ⚡ developer (implementation) [02:15]                                │
│     ██████████████░░░░░░░░░░░░░░░░░░ 45%                            │
│     🔢 Tokens: 12.5k→3.2k                                           │
│     🔄 Turns: 8                                                      │
│     🔧 Last tool: Edit                                              │
│                                                                      │
│ ○ tester                                                             │
│                                                                      │
│ ○ reviewer                                                           │
│                                                                      │
│ ✓ planner (completed)                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase 1: Create VerboseAgentRow Component
1. Create `VerboseAgentRow.tsx` with the specified interface
2. Export from the agents module index
3. Add unit tests for the component

#### Phase 2: Integrate with AgentPanel
1. Modify `AgentPanel.tsx` to conditionally render `VerboseAgentRow`
2. Remove inline verbose rendering from `AgentRow` (move to `VerboseAgentRow`)
3. Update integration tests

#### Phase 3: Wire Orchestrator Events
1. Update `useOrchestratorEvents` hook to populate `debugInfo`
2. Add event handlers for:
   - `usage:updated` → `tokensUsed`
   - `tool:use` → `lastToolCall`
   - `agent:turn` → `turnCount`
   - `error:*` → `errorCount`
3. Add integration tests for event → UI data flow

### File Changes Required

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/cli/src/ui/components/agents/VerboseAgentRow.tsx` | **Create** | New component for verbose agent display |
| `packages/cli/src/ui/components/agents/index.ts` | Modify | Export `VerboseAgentRow` |
| `packages/cli/src/ui/components/agents/AgentPanel.tsx` | Modify | Import and use `VerboseAgentRow` conditionally |
| `packages/cli/src/ui/hooks/useOrchestratorEvents.ts` | Modify | Populate `debugInfo` from orchestrator events |
| `packages/cli/src/ui/components/agents/__tests__/VerboseAgentRow.test.tsx` | **Create** | Unit tests for VerboseAgentRow |
| `packages/cli/src/ui/components/agents/__tests__/AgentPanel.verbose-mode.test.tsx` | **Create** | Integration tests for verbose mode |

### Interface Contracts

#### VerboseAgentRowProps
```typescript
interface VerboseAgentRowProps {
  agent: AgentInfo;      // Agent data including debugInfo
  isActive: boolean;     // Whether this is the currently active agent
  color: string;         // Color for the agent (from agentColors mapping)
}
```

#### AgentInfo.debugInfo (Already Defined)
```typescript
debugInfo?: {
  tokensUsed?: { input: number; output: number };
  stageStartedAt?: Date;
  lastToolCall?: string;
  turnCount?: number;
  errorCount?: number;
};
```

### Testing Strategy

1. **Unit Tests for VerboseAgentRow**
   - Renders agent name and status correctly
   - Shows debug info only for active agents
   - Formats tokens correctly (k, M suffixes)
   - Shows error count only when > 0
   - Handles missing optional fields gracefully

2. **Integration Tests**
   - AgentPanel switches to VerboseAgentRow in verbose mode
   - Debug info displays correctly for active agent
   - Non-active agents don't show debug info
   - Mode switching preserves agent state

3. **E2E Tests**
   - Orchestrator events populate debugInfo correctly
   - Real-time updates show in verbose mode
   - Token counts accumulate correctly

## Consequences

### Positive
- Clean separation of concerns with dedicated `VerboseAgentRow` component
- Reusable verbose display logic
- Consistent with existing architecture patterns
- Testable in isolation
- Existing `debugInfo` interface requires no changes

### Negative
- Additional component to maintain
- Slight complexity increase in AgentPanel rendering logic
- Need to wire orchestrator events to populate debugInfo

### Risks
- **Performance**: Frequent updates to debugInfo could cause excessive re-renders
  - Mitigation: Use React.memo on VerboseAgentRow
- **Data staleness**: Token counts might lag behind actual usage
  - Mitigation: Throttle updates with reasonable interval (500ms)

## References

- ADR-022: Verbose Mode Enhanced Implementation Architecture
- ADR-020: Display Modes (Compact and Verbose)
- Existing implementation in `AgentPanel.tsx` lines 218-242
- VerboseDebugData interface in `packages/core/src/types.ts` lines 414-440
