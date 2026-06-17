# ADR-0036: ParallelAgentTerminalView + useAgentTerminals Integration Tests Architecture

## Status
Approved

## Date
2024-03-25

## Context

The `ConnectedParallelAgentTerminalView` component integrates the `ParallelAgentTerminalView` grid layout with the `useAgentTerminals` WebSocket log streaming hook. This integration requires comprehensive unit tests that verify the interaction between these two layers:

1. **ParallelAgentTerminalView**: Responsive grid layout for multiple agent terminal panels
2. **useAgentTerminals**: WebSocket log streaming coordination for up to 12 agents

### Testing Requirements from Acceptance Criteria

The tests must verify:
- Hook initialization with panels
- Agent registration/unregistration on panel changes
- Log data flowing to correct panels
- Pause/resume propagation
- Connection health display

## Decision

### Test Architecture Overview

We adopt a **layered testing strategy** with existing tests covering different integration levels:

```
┌─────────────────────────────────────────────────────────────────────┐
│               ParallelAgentTerminalView.useAgentTerminals.test.tsx │
│                     (Integration Layer - 28 tests)                 │
│  Tests full integration between Component + Hook with mocked I/O   │
├─────────────────────────────────────────────────────────────────────┤
│            ConnectedParallelAgentTerminalView.test.tsx              │
│                     (Component Layer - 27 tests)                    │
│  Tests component behavior with mocked useAgentTerminals hook       │
├─────────────────────────────────────────────────────────────────────┤
│                  useAgentTerminals.test.tsx                         │
│                      (Hook Layer - 43 tests)                        │
│  Tests hook behavior with mocked WebSocket client                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Test File Structure

```
packages/web-ui/src/
├── hooks/__tests__/
│   ├── useAgentTerminals.test.tsx           # Hook unit tests (43 tests)
│   ├── useAgentTerminals.edge-cases.test.tsx
│   ├── useAgentTerminals.integration.test.tsx
│   └── useAgentTerminals.performance.test.tsx
└── components/agents/__tests__/
    ├── ConnectedParallelAgentTerminalView.test.tsx  # Component tests (27 tests)
    ├── ConnectedParallelAgentTerminalView.integration.test.tsx
    ├── ConnectedParallelAgentTerminalView.edge-cases.test.tsx
    └── ParallelAgentTerminalView.useAgentTerminals.test.tsx  # Integration (28 tests)
```

### Test Categorization

#### 1. Hook Initialization with Panels (4 tests)
Location: `ParallelAgentTerminalView.useAgentTerminals.test.tsx`

```typescript
describe('Hook Initialization with Panels', () => {
  it('initializes hook with empty panels')
  it('initializes hook with multiple panel configurations')
  it('applies defaultMaxLogs to all agents')
  it('passes autoConnect option to WebSocket')
})
```

**Verifies:**
- Empty state initialization
- Multiple agent configuration handling
- Default configuration propagation
- WebSocket connection options

#### 2. Agent Registration/Unregistration (5 tests)
Location: `ParallelAgentTerminalView.useAgentTerminals.test.tsx`

```typescript
describe('Agent Registration/Unregistration', () => {
  it('registers agents when panels are added')
  it('unregisters agents when panels are removed')
  it('handles panel reordering without re-registration')
  it('respects max 12 agent limit')
  it('cleanup unregisters all agents on unmount')
})
```

**Verifies:**
- Dynamic agent registration
- Automatic cleanup on panel removal
- Stable identity during reordering
- MAX_AGENTS constraint enforcement
- Proper cleanup on component unmount

#### 3. Log Data Flow to Panels (5 tests)
Location: `ParallelAgentTerminalView.useAgentTerminals.test.tsx`

```typescript
describe('Log Data Flow to Panels', () => {
  it('routes log events to correct agent panel')
  it('applies per-agent log buffer limits')
  it('applies per-agent filters to logs')
  it('ignores events for unregistered agents')
  it('handles high-frequency log events')
})
```

**Verifies:**
- Event routing by agentId
- FIFO buffer management
- Filter application
- Event isolation
- Performance under load

#### 4. Pause/Resume Propagation (5 tests)
Location: `ParallelAgentTerminalView.useAgentTerminals.test.tsx`

```typescript
describe('Pause/Resume Propagation', () => {
  it('pauses individual agent via ref API')
  it('resumes individual agent via ref API')
  it('pauseAll stops all agent streams')
  it('resumeAll resumes all agent streams')
  it('paused agent ignores incoming events')
})
```

**Verifies:**
- Individual agent pause/resume
- Bulk pause/resume operations
- Stream isolation during pause
- Ref API accessibility

#### 5. Connection Health Display (5 tests)
Location: `ParallelAgentTerminalView.useAgentTerminals.test.tsx`

```typescript
describe('Connection Health Display', () => {
  it('reflects connected status correctly')
  it('reflects disconnected status correctly')
  it('reflects reconnecting status correctly')
  it('tracks per-agent last event timestamp')
  it('identifies stale agent connections')
})
```

**Verifies:**
- Connection status reflection
- Status transitions
- Event timestamp tracking
- Stale detection (STALE_EVENT_THRESHOLD_MS)

### Mock Strategy

The integration tests use strategic mocking to isolate the component + hook integration from external dependencies:

```typescript
// Mock WebSocket client - external dependency
vi.mock('@/lib/websocket-client', () => ({
  wsClient: {
    isConnected: vi.fn(() => true),
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((eventType, handler) => { /* store handler */ }),
    off: vi.fn(),
    emit: (eventType, event) => { /* trigger handlers */ }
  },
}))

// Mock connection health hook - external dependency
vi.mock('@/hooks/useWebSocketConnection', () => ({
  useWebSocketConnection: vi.fn(() => mockConnectionHealth),
}))

// Mock ParallelAgentTerminalView - focus on hook integration
vi.mock('../ParallelAgentTerminalView', () => ({
  ParallelAgentTerminalView: React.forwardRef(/* simplified impl */)
}))

// Real useAgentTerminals hook - under test
// Import actual implementation
```

### Test Factories

Consistent test data creation through factory functions:

```typescript
// Agent configuration factory
function createMockAgentConfig(agentId: string, overrides?: Partial<ConnectedAgentConfig>): ConnectedAgentConfig

// Event factory
function createMockApexEvent(type: string, agentId: string, overrides?: object): ApexEvent

// Connection health factory
function createMockConnectionHealth(status: 'connected' | 'disconnected' | 'reconnecting'): WebSocketConnectionHealth

// Log entry factory
function createMockLogEntry(agentId: string, message?: string): AgentLogEntry
```

### Ref API Verification

The integration tests verify the combined ref API:

```typescript
const expectedMethods = [
  // Panel View Controls (from ParallelAgentTerminalView)
  'minimizeAll', 'restoreAll', 'getAllStates', 'maximizePanel', 'focusPanel',

  // Per-Agent Stream Controls (from useAgentTerminals)
  'pauseAgent', 'resumeAgent', 'clearAgentLogs', 'setAgentFilter',
  'resetAgentFilter', 'exportAgentLogs', 'getAgentLogs', 'getAgentFilteredLogs',

  // Bulk Stream Controls
  'pauseAll', 'resumeAll', 'clearAll', 'reconnect',

  // Agent Registration
  'registerAgent', 'unregisterAgent', 'isAgentRegistered',

  // Status
  'getAggregateStats'
]

// Boolean properties
expect(typeof ref.current?.isConnected).toBe('boolean')
expect(typeof ref.current?.isReconnecting).toBe('boolean')
```

## Implementation Summary

### Current Test Coverage

| Test File | Tests | Focus Area |
|-----------|-------|------------|
| `useAgentTerminals.test.tsx` | 43 | Hook behavior |
| `ConnectedParallelAgentTerminalView.test.tsx` | 27 | Component behavior |
| `ParallelAgentTerminalView.useAgentTerminals.test.tsx` | 28 | Integration |
| **Total** | **98** | Full coverage |

### Acceptance Criteria Mapping

| Criteria | Test Coverage |
|----------|--------------|
| Hook initialization with panels | ✅ 4 tests in integration file |
| Agent registration/unregistration | ✅ 5 tests in integration file + 5 in hook tests |
| Log data flowing to correct panels | ✅ 5 tests in integration file + 5 in hook tests |
| Pause/resume propagation | ✅ 5 tests in integration file + 3 in hook tests |
| Connection health display | ✅ 5 tests in integration file + 2 in hook tests |

## Consequences

### Positive
1. **Comprehensive coverage**: 98 tests cover all acceptance criteria
2. **Layered testing**: Failures isolated to specific layers
3. **Fast execution**: Mocked WebSocket enables synchronous tests
4. **Maintainable**: Factory functions reduce test boilerplate
5. **Documented**: Test names describe expected behavior

### Negative
1. **Mocking complexity**: Multiple mock layers require careful coordination
2. **Test isolation**: Some real integration scenarios not covered (use E2E for those)

### Neutral
1. **Vitest**: Uses project's standard test framework
2. **jsdom**: Uses project's standard test environment

## Verification

All tests pass:
```bash
npm run test -- --run src/components/agents/__tests__/ParallelAgentTerminalView.useAgentTerminals.test.tsx
# ✓ 28 tests passed

npm run test -- --run src/hooks/__tests__/useAgentTerminals.test.tsx
# ✓ 43 tests passed

npm run test -- --run src/components/agents/__tests__/ConnectedParallelAgentTerminalView.test.tsx
# ✓ 27 tests passed
```

## References

- ADR-0033: useAgentTerminals hook design
- ADR-0032: Agent Terminal Panel three-state architecture
- Existing test patterns in `packages/web-ui/src/**/__tests__/`
