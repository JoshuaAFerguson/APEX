# ADR-0034: ParallelAgentTerminalView with useAgentTerminals Integration Tests

## Status

Proposed

## Context

The `ParallelAgentTerminalView` component provides a responsive grid layout for displaying multiple agent terminals (1-12 panels). It integrates with the `useAgentTerminals` hook for WebSocket log streaming coordination. We need comprehensive unit tests that verify the integration between these two modules.

### Current Architecture

1. **`ParallelAgentTerminalView`** (`src/components/agents/ParallelAgentTerminalView.tsx`)
   - Grid layout component for 1-12 agent terminal panels
   - Uses `useAgentTerminalPanelState` hook for panel state management (minimize/maximize/restore)
   - Supports controlled and uncontrolled panel states
   - Provides imperative API via ref (`minimizeAll`, `restoreAll`, `getAllStates`, `maximizePanel`, `focusPanel`)

2. **`useAgentTerminals`** (`src/hooks/useAgentTerminals.ts`)
   - WebSocket log streaming coordination hook
   - Manages up to 12 concurrent agent log streams
   - Per-agent log buffering with FIFO trimming
   - Pause/resume functionality per-agent and bulk
   - Connection health tracking via `useWebSocketConnection`

3. **`ConnectedParallelAgentTerminalView`** (`src/components/agents/ConnectedParallelAgentTerminalView.tsx`)
   - Integration wrapper that bridges the above two components
   - Auto-registers/unregisters agents based on props
   - Combines ref APIs from both components

### Acceptance Criteria

The unit tests must verify:
1. Hook initialization with panels
2. Agent registration/unregistration on panel changes
3. Log data flowing to correct panels
4. Pause/resume propagation
5. Connection health display

## Decision

We will create a new test file `ParallelAgentTerminalView.useAgentTerminals.test.tsx` that specifically tests the integration between `ParallelAgentTerminalView` and `useAgentTerminals` through the `ConnectedParallelAgentTerminalView` wrapper.

### Test Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                    Test File Structure                              │
├────────────────────────────────────────────────────────────────────┤
│  ParallelAgentTerminalView.useAgentTerminals.test.tsx               │
│                                                                    │
│  ├── Describe: Hook Initialization with Panels                     │
│  │   ├── initializes hook with empty panels                        │
│  │   ├── initializes hook with multiple panel configs              │
│  │   ├── applies defaultMaxLogs to all agents                      │
│  │   └── passes autoConnect option to WebSocket                    │
│  │                                                                  │
│  ├── Describe: Agent Registration/Unregistration                   │
│  │   ├── registers agents when panels are added                    │
│  │   ├── unregisters agents when panels are removed                │
│  │   ├── handles panel reordering without re-registration          │
│  │   ├── respects max 12 agent limit                               │
│  │   └── cleanup unregisters all agents on unmount                 │
│  │                                                                  │
│  ├── Describe: Log Data Flow to Panels                             │
│  │   ├── routes log events to correct agent panel                  │
│  │   ├── applies per-agent log buffer limits                       │
│  │   ├── applies per-agent filters to logs                         │
│  │   ├── ignores events for unregistered agents                    │
│  │   └── handles high-frequency log events                         │
│  │                                                                  │
│  ├── Describe: Pause/Resume Propagation                            │
│  │   ├── pauses individual agent via ref API                       │
│  │   ├── resumes individual agent via ref API                      │
│  │   ├── pauseAll stops all agent streams                          │
│  │   ├── resumeAll resumes all agent streams                       │
│  │   └── paused agent ignores incoming events                      │
│  │                                                                  │
│  └── Describe: Connection Health Display                           │
│      ├── reflects connected status correctly                       │
│      ├── reflects disconnected status correctly                    │
│      ├── reflects reconnecting status correctly                    │
│      ├── tracks per-agent last event timestamp                     │
│      └── identifies stale agent connections                        │
└────────────────────────────────────────────────────────────────────┘
```

### Mock Strategy

```typescript
// Mock hierarchy (following existing patterns)
┌─────────────────────────────────────────────────────────────────────┐
│ Test File                                                           │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Mock wsClient (WebSocket client)                                 │
│    - Captures event handlers for simulation                         │
│    - Emits synthetic log events                                     │
│    - Controls connection status                                     │
│                                                                     │
│ 2. Mock useWebSocketConnection                                      │
│    - Provides controllable connection health state                  │
│    - Simulates status transitions                                   │
│                                                                     │
│ 3. Mock ParallelAgentTerminalView (optional)                        │
│    - Lightweight rendering for integration tests                    │
│    - Captures props for verification                                │
│    - Forwards ref API                                               │
│                                                                     │
│ 4. Mock AgentTerminalPanel                                          │
│    - Minimal panel rendering                                        │
│    - Event handler capture                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Test Data Factories

```typescript
// Factory functions for test data
function createMockAgentConfig(agentId: string, overrides?: Partial<ConnectedAgentConfig>): ConnectedAgentConfig
function createMockApexEvent(type: string, agentId: string, overrides?: Partial<ApexEvent>): ApexEvent
function createMockConnectionHealth(status: WebSocketConnectionStatus): WebSocketConnectionHealth
function createMockLogEntry(agentId: string, message?: string): AgentLogEntry
```

### Key Test Scenarios

#### 1. Hook Initialization with Panels

```typescript
describe('Hook Initialization with Panels', () => {
  it('initializes hook with panel configurations', () => {
    const agents = [
      { panelId: 'p1', agentId: 'a1', title: 'Agent 1' },
      { panelId: 'p2', agentId: 'a2', title: 'Agent 2' },
    ]

    render(<ConnectedParallelAgentTerminalView agents={agents} />)

    expect(mockRegisterAgent).toHaveBeenCalledTimes(2)
    expect(mockRegisterAgent).toHaveBeenCalledWith({
      agentId: 'a1',
      agentName: 'Agent 1',
      ...
    })
  })
})
```

#### 2. Agent Registration/Unregistration on Panel Changes

```typescript
describe('Agent Registration/Unregistration', () => {
  it('registers new agents when panels are added', async () => {
    const { rerender } = render(
      <ConnectedParallelAgentTerminalView agents={[agent1]} />
    )

    rerender(
      <ConnectedParallelAgentTerminalView agents={[agent1, agent2]} />
    )

    expect(mockRegisterAgent).toHaveBeenLastCalledWith(expect.objectContaining({
      agentId: 'a2'
    }))
  })

  it('unregisters agents when panels are removed', async () => {
    const { rerender } = render(
      <ConnectedParallelAgentTerminalView agents={[agent1, agent2]} />
    )

    rerender(
      <ConnectedParallelAgentTerminalView agents={[agent1]} />
    )

    expect(mockUnregisterAgent).toHaveBeenCalledWith('a2')
  })
})
```

#### 3. Log Data Flowing to Correct Panels

```typescript
describe('Log Data Flow', () => {
  it('routes log events to the correct agent', () => {
    render(<ConnectedParallelAgentTerminalView agents={[agent1, agent2]} />)

    // Emit event for agent1
    act(() => {
      mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a1'))
    })

    // Verify agent1 received the log
    expect(mockOnLogs).toHaveBeenCalledWith('a1', expect.any(Array))
    // Verify agent2 did not receive
    expect(mockOnLogs).not.toHaveBeenCalledWith('a2', expect.any(Array))
  })
})
```

#### 4. Pause/Resume Propagation

```typescript
describe('Pause/Resume Propagation', () => {
  it('paused agent ignores incoming log events', async () => {
    const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()
    render(<ConnectedParallelAgentTerminalView ref={ref} agents={[agent1]} />)

    // Pause agent
    act(() => {
      ref.current!.pauseAgent('a1')
    })

    // Emit event
    act(() => {
      mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a1'))
    })

    // Verify event was ignored
    expect(mockGetAgentState('a1').logs).toHaveLength(0)
  })
})
```

#### 5. Connection Health Display

```typescript
describe('Connection Health Display', () => {
  it('reflects connection status correctly', () => {
    mockUseWebSocketConnection.mockReturnValue({
      status: 'reconnecting',
      reconnectAttempts: 2,
      ...
    })

    const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()
    render(<ConnectedParallelAgentTerminalView ref={ref} agents={[agent1]} />)

    expect(ref.current!.isConnected).toBe(false)
    expect(ref.current!.isReconnecting).toBe(true)
  })
})
```

### File Location

```
packages/web-ui/src/components/agents/__tests__/
├── ParallelAgentTerminalView.test.tsx                    # Existing unit tests
├── ParallelAgentTerminalView.integration.test.tsx        # Existing integration tests
├── ParallelAgentTerminalView.useAgentTerminals.test.tsx  # NEW: Hook integration tests
├── ConnectedParallelAgentTerminalView.test.tsx           # Existing Connected tests
└── ConnectedParallelAgentTerminalView.integration.test.tsx # Existing integration
```

### Testing Dependencies

- **vitest**: Test runner
- **@testing-library/react**: Component rendering and queries
- **@testing-library/user-event**: User interaction simulation
- **jsdom**: Browser environment simulation

## Consequences

### Positive

1. **Comprehensive Coverage**: Tests cover all acceptance criteria explicitly
2. **Follows Existing Patterns**: Consistent with existing test architecture
3. **Isolated Testing**: Mocks allow testing integration without real WebSocket
4. **Regression Prevention**: Catches breaking changes in hook/component interaction
5. **Documentation**: Tests serve as executable documentation of expected behavior

### Negative

1. **Mock Complexity**: Requires careful mock setup to simulate WebSocket behavior
2. **Maintenance Overhead**: Changes to either component require test updates
3. **Test File Size**: Comprehensive coverage leads to larger test file

### Neutral

1. **Test Execution Time**: Additional test file adds to CI time (mitigated by vitest parallelization)
2. **Mock vs Real**: Some edge cases may behave differently with real WebSocket

## Implementation Notes

### Test File Template

```typescript
/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectedParallelAgentTerminalView } from '../ConnectedParallelAgentTerminalView'
import type { ConnectedAgentConfig, ConnectedParallelAgentTerminalViewRef } from '../ConnectedParallelAgentTerminalView.types'

// Mocks follow existing patterns from useAgentTerminals.test.tsx
```

### Estimated Test Count

- Hook Initialization: 4-5 tests
- Registration/Unregistration: 5-6 tests
- Log Data Flow: 5-6 tests
- Pause/Resume: 5-6 tests
- Connection Health: 5-6 tests
- **Total: ~25-30 tests**

## References

- [ADR-003: useAgentTerminalPanelState Hook](./ADR-003-useAgentTerminalPanelState-hook.md)
- [ADR-0033: useAgentTerminals Hook Design](./ADR-0033-useAgentTerminals-hook-design.md)
- Existing test: `useAgentTerminals.test.tsx`
- Existing test: `ConnectedParallelAgentTerminalView.integration.test.tsx`
