# ADR-060: MCP Connection Lifecycle Integration Tests

## Status
Accepted

## Date
2025-01-16

## Context

The APEX orchestrator system integrates with MCP (Model Context Protocol) servers through the `MCPConnectionManager` class, which handles connection lifecycle, automatic reconnection, and event emission. The existing test coverage includes:

- **Unit tests**: `connection-manager.test.ts` - Tests individual methods and behaviors
- **Integration tests**: `connection-manager.integration.test.ts` - Tests with realistic mocked transports
- **Event forwarding tests**: `mcp-event-forwarding.test.ts`, `mcp-event-forwarding.integration.test.ts`, `mcp-event-forwarding.edge-cases.test.ts`
- **Backoff integration tests**: `connection-manager.backoff-integration.test.ts`
- **Health check tests**: `connection-manager.heartbeat.test.ts`, `connection-manager-health-integration.test.ts`
- **Pool tests**: `connection-manager.pool.test.ts`, `connection-manager.pool-strategies.test.ts`

### Gap Analysis

While the existing tests provide solid coverage of individual components, there is a need for comprehensive end-to-end integration tests that verify the complete MCP connection lifecycle scenarios from the orchestrator's perspective, specifically covering:

1. **Initial connection establishment** - From orchestrator instantiation through successful connection
2. **Graceful disconnection** - Clean shutdown with proper resource cleanup and event emission
3. **Connection error handling** - Error propagation and recovery mechanisms
4. **Reconnection scenarios** - Automatic reconnection with exponential backoff through the full event chain
5. **Event verification through orchestrator** - Ensuring all lifecycle events are properly forwarded and formatted

## Decision

We will create a new comprehensive integration test file that tests the MCP connection lifecycle end-to-end through the ApexOrchestrator, verifying that:

1. All connection lifecycle events are properly emitted through the orchestrator's event system
2. Event data is complete and correctly formatted
3. The connection state machine transitions correctly
4. Error handling and recovery mechanisms work as expected
5. Multiple servers can be managed independently

### Test Architecture

#### File Location
```
packages/orchestrator/src/__tests__/mcp-connection-lifecycle.integration.test.ts
```

#### Test Structure

```typescript
/**
 * MCP Connection Lifecycle Integration Tests
 *
 * Comprehensive end-to-end tests verifying MCP connection lifecycle
 * through the ApexOrchestrator, including:
 * - Initial connection establishment
 * - Graceful disconnection
 * - Connection error handling
 * - Reconnection scenarios
 * - Event verification through orchestrator
 */

describe('MCP Connection Lifecycle - Integration Tests', () => {
  describe('Initial Connection Establishment', () => {
    // Tests for first-time connection scenarios
  });

  describe('Graceful Disconnection', () => {
    // Tests for clean shutdown scenarios
  });

  describe('Connection Error Handling', () => {
    // Tests for error propagation and recovery
  });

  describe('Reconnection Scenarios', () => {
    // Tests for automatic reconnection with backoff
  });

  describe('Event Verification Through Orchestrator', () => {
    // Tests verifying event emission and data integrity
  });
});
```

### Test Scenarios

#### 1. Initial Connection Establishment

| Test Case | Description | Expected Events |
|-----------|-------------|-----------------|
| Successful first connection | Connect to a single server | `stateChange(disconnected→connecting)`, `stateChange(connecting→connected)`, `connected`, `healthCheck` |
| Multiple server connection | Connect to multiple servers concurrently | Each server emits its own lifecycle events independently |
| Connection with config discovery | Discover and connect to configured servers | `connected` events for each discovered server |
| Connection timeout handling | Attempt to connect with timeout | `error`, `stateChange(connecting→error)` |

#### 2. Graceful Disconnection

| Test Case | Description | Expected Events |
|-----------|-------------|-----------------|
| Single server disconnect | Explicitly disconnect one server | `stateChange(connected→disconnecting)`, `stateChange(disconnecting→disconnected)`, `disconnected` with reason |
| Disconnect all servers | Call `disconnectAll()` | `disconnected` events for all servers |
| Disconnect during reconnection | Disconnect while reconnection in progress | Reconnection cancelled, clean `disconnected` event |
| Disconnect with cleanup verification | Verify resources are released | No lingering timers/listeners, health checks stopped |

#### 3. Connection Error Handling

| Test Case | Description | Expected Events |
|-----------|-------------|-----------------|
| Transport error | Transport emits error | `error` event with error details, `stateChange` if needed |
| Connection refused | Server unavailable | `error` with connection details, attempt reconnection if enabled |
| Protocol error | JSONRPC/MCP protocol error | `error` event with protocol error code |
| Cascading errors | Multiple errors in sequence | Each error emitted independently, no event loss |

#### 4. Reconnection Scenarios

| Test Case | Description | Expected Events |
|-----------|-------------|-----------------|
| Successful reconnection | Reconnect after disconnect | `reconnecting(attempt 1)`, `stateChange(→reconnecting)`, `connected`, `stateChange(→connected)` |
| Multiple retry attempts | Reconnection with failures | `reconnecting(1)`, `error`, `reconnecting(2)`, `error`, `reconnecting(3)`, `connected` |
| Exhausted retries | All reconnection attempts fail | `reconnecting(1-N)`, `error` for each, final exhaustion `error` |
| Exponential backoff verification | Verify delay timing | Events at expected intervals (500ms, 1000ms, 2000ms, etc.) |
| Reconnection after health check failure | Health check triggers reconnection | `healthCheck(unhealthy)`, `stateChange(→disconnected)`, `reconnecting` |

#### 5. Event Verification Through Orchestrator

| Test Case | Description | Verification |
|-----------|-------------|--------------|
| Event data completeness | All events have required fields | `serverId`, `serverName`, `timestamp` present on all events |
| Event ordering | Events emitted in correct sequence | State changes precede/follow connection events correctly |
| Event timestamp consistency | Timestamps are accurate | All timestamps are Date objects, in chronological order |
| Multi-listener handling | Multiple listeners receive events | All registered listeners called with identical data |
| Error in listener doesn't break forwarding | Faulty listener doesn't crash | Other listeners still receive events |

### Mock Infrastructure

The tests will use a realistic mock infrastructure based on existing patterns:

```typescript
// Mock MCPConnectionManager that simulates realistic connection behavior
class RealisticMCPConnectionManager extends EventEmitter {
  // Simulates connection lifecycle with configurable timing
  simulateConnectionLifecycle(serverId: string, serverName: string): void;

  // Simulates reconnection with configurable attempts
  simulateReconnectionScenario(serverId: string, attempts: number, finalSuccess: boolean): void;

  // Simulates various error conditions
  simulateError(serverId: string, errorType: 'transport' | 'protocol' | 'timeout'): void;

  // Simulates graceful disconnection
  simulateDisconnection(serverId: string, reason: string): void;
}
```

### Event Data Contracts

All forwarded events must conform to these data structures (from `packages/orchestrator/src/index.ts`):

```typescript
interface MCPConnectionEventData {
  serverId: string;
  serverName: string;
  status: string;
  timestamp: Date;
  connectionInfo: {
    type: string;
    url?: string;
    command?: string;
  };
}

interface MCPDisconnectionEventData {
  serverId: string;
  serverName: string;
  reason: string;
  timestamp: Date;
}

interface MCPErrorEventData {
  serverId: string;
  serverName: string;
  error: Error;
  message: string;
  timestamp: Date;
  code: string;
}

interface MCPReconnectingEventData {
  serverId: string;
  serverName: string;
  attempt: number;
  maxAttempts: number;
  timestamp: Date;
}

interface MCPHealthCheckEventData {
  serverId: string;
  serverName: string;
  result: HealthCheckResult;
  responseTimeMs?: number;
  isHealthy: boolean;
  timestamp: Date;
}

interface MCPStateChangeEventData {
  serverId: string;
  serverName: string;
  previousState: MCPConnectionState;
  newState: MCPConnectionState;
  timestamp: Date;
}

interface MCPPoolChangeEventData {
  serverId: string;
  serverName: string;
  poolSize: number;
  activeConnections: number;
  timestamp: Date;
}
```

### Acceptance Criteria

1. **Initial connection establishment**
   - Tests verify `mcp:connected` events include complete server info
   - Tests verify state transitions are emitted in correct order
   - Tests verify connection timing is within expected bounds
   - Tests handle concurrent connections to multiple servers

2. **Graceful disconnection**
   - Tests verify `mcp:disconnected` events include disconnection reason
   - Tests verify resources (timers, listeners) are cleaned up
   - Tests verify reconnection is cancelled when explicitly disconnected
   - Tests handle disconnection during various states (connecting, connected, reconnecting)

3. **Connection error handling**
   - Tests verify `mcp:error` events include error details and codes
   - Tests verify error events don't crash the event forwarding system
   - Tests verify errors trigger reconnection when appropriate
   - Tests handle various error types (transport, protocol, timeout)

4. **Reconnection scenarios**
   - Tests verify `mcp:reconnecting` events include attempt counts
   - Tests verify exponential backoff delays are correct
   - Tests verify successful reconnection emits proper events
   - Tests verify exhausted retries emit appropriate error events
   - Tests verify health check failures can trigger reconnection

5. **Event verification through orchestrator**
   - All events have `serverId`, `serverName`, and `timestamp` fields
   - Events are emitted through the orchestrator's event system (not directly from MCPConnectionManager)
   - Multiple event listeners all receive events
   - Event ordering is consistent and logical
   - All tests pass reliably without flakiness

### Implementation Notes

1. **Use vi.useFakeTimers()** for reconnection timing tests to avoid flaky tests
2. **Follow existing mock patterns** from `mcp-event-forwarding.integration.test.ts`
3. **Test isolation**: Each test should clean up connections and listeners
4. **Event capture pattern**: Use arrays to capture events for sequence verification
5. **Avoid real I/O**: All tests should use mocked transports and connections

### Test File Dependencies

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import type { ApexConfig } from '@apexcli/core';
import fs from 'fs/promises';
```

### Related Files

| File | Purpose |
|------|---------|
| `packages/orchestrator/src/index.ts` | ApexOrchestrator with event forwarding |
| `packages/orchestrator/src/mcp/connection-manager.ts` | MCPConnectionManager implementation |
| `packages/orchestrator/src/__tests__/mcp-event-forwarding.integration.test.ts` | Existing integration test patterns |
| `packages/orchestrator/src/mcp/__tests__/connection-manager.backoff-integration.test.ts` | Backoff testing patterns |

## Consequences

### Positive

1. **Comprehensive lifecycle coverage**: End-to-end tests will catch integration issues between components
2. **Event contract validation**: Tests will ensure event data is complete and correctly formatted
3. **Regression prevention**: Future changes to connection handling will be caught by these tests
4. **Documentation value**: Tests serve as executable documentation of expected behavior
5. **Confidence in reliability**: Thorough reconnection testing ensures robust production behavior

### Negative

1. **Test execution time**: Integration tests are slower than unit tests
2. **Maintenance burden**: More test code to maintain
3. **Mock complexity**: Realistic mocks require careful implementation

### Mitigation

- Use fake timers to keep tests fast
- Organize tests into focused describe blocks for selective running
- Leverage existing mock infrastructure to reduce duplication
- Clear test naming for easy maintenance

## Implementation Plan

### Phase 1: Test Infrastructure Setup
1. Create test file with standard vitest setup
2. Implement realistic mock MCPConnectionManager
3. Set up common test fixtures and helpers

### Phase 2: Connection Establishment Tests
1. Implement successful connection tests
2. Implement multi-server connection tests
3. Implement connection timeout tests

### Phase 3: Disconnection Tests
1. Implement graceful disconnection tests
2. Implement disconnect-all tests
3. Implement resource cleanup verification tests

### Phase 4: Error Handling Tests
1. Implement transport error tests
2. Implement protocol error tests
3. Implement cascading error tests

### Phase 5: Reconnection Tests
1. Implement successful reconnection tests
2. Implement multiple retry tests
3. Implement exhausted retry tests
4. Implement exponential backoff verification

### Phase 6: Event Verification Tests
1. Implement event data completeness tests
2. Implement event ordering tests
3. Implement multi-listener tests

## References

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- Existing test files in `packages/orchestrator/src/__tests__/`
- `packages/core/src/connection-health.ts` for health check patterns
