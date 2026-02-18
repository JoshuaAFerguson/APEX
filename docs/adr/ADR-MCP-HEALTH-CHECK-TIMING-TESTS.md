# ADR: MCP Connection Health Check Timing Tests

## Status
Proposed

## Context
The `MCPConnectionManager` class in `packages/orchestrator/src/mcp/connection-manager.ts` implements comprehensive health check functionality for MCP server connections, including:

1. **Health check interval timing** via `setInterval` with configurable `healthCheckIntervalMs`
2. **Consecutive failure threshold detection** via `healthCheckFailureThreshold`
3. **Automatic reconnection triggering** after failure threshold is reached
4. **Health status event emission** via `healthCheck` and `stateChange` events
5. **Configurable timeout handling** via `healthCheckTimeoutMs`

The task is to design a comprehensive test suite specifically for health check timing accuracy and failure detection, using mocked timers for reliable timing assertions.

## Decision

### Test File Location
Create a new test file:
```
packages/orchestrator/src/mcp/connection-manager.health-timing.test.ts
```

This separates timing-specific tests from existing tests in:
- `connection-manager.test.ts` (basic functionality)
- `connection-manager.enhanced.test.ts` (enhanced features)
- `connection-manager.heartbeat.test.ts` (heartbeat/ping-pong protocol)

### Test Architecture

#### 1. Mock Setup Strategy

Use Vitest's fake timers (`vi.useFakeTimers()`, `vi.advanceTimersByTime()`, `vi.runAllTimersAsync()`) consistently for all timing tests. This approach is already proven in the existing test files.

**Mock Dependencies:**
```typescript
// Mock core module for ExponentialBackoffReconnector
vi.mock('@apexcli/core', () => ({
  ExponentialBackoffReconnector: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    notifyConnected: vi.fn(),
    notifyDisconnected: vi.fn(),
    notifyConnectionFailed: vi.fn(),
    scheduleReconnect: vi.fn((fn) => fn()), // Execute immediately for testing
    isExhausted: vi.fn(() => false),
    destroy: vi.fn(),
  })),
}));

// Mock transport and client
vi.mock('./transports/index.js', () => ({
  StdioTransport: vi.fn().mockImplementation(() => createMockTransport()),
}));

vi.mock('./client.js', () => ({
  MCPClient: vi.fn().mockImplementation(({ transport }) => createMockClient(transport)),
}));
```

#### 2. Test Suites Structure

```typescript
describe('MCPConnectionManager - Health Check Timing', () => {
  describe('Health Check Interval Timing Accuracy', () => {
    // Tests for verifying health checks occur at correct intervals
  });

  describe('Consecutive Failure Threshold Detection', () => {
    // Tests for failure counting and threshold triggering
  });

  describe('Automatic Reconnection Triggering', () => {
    // Tests for reconnection after threshold is reached
  });

  describe('Health Status Event Emission', () => {
    // Tests for healthCheck and stateChange events
  });

  describe('Configurable Timeout Handling', () => {
    // Tests for timeout configuration and behavior
  });
});
```

#### 3. Test Cases

##### Health Check Interval Timing Accuracy

| Test Case | Description | Assertion Strategy |
|-----------|-------------|-------------------|
| `should trigger first health check at configured interval` | Verify first check happens at `healthCheckIntervalMs` | Advance timer by interval, verify `healthCheck` event emitted once |
| `should trigger health checks at consistent intervals` | Verify multiple checks at regular intervals | Advance timer by 5x interval, verify 5 events |
| `should not trigger health check before interval elapsed` | Verify no premature health checks | Advance by interval-1ms, verify no events |
| `should respect custom health check intervals` | Test with different interval configs (500ms, 1000ms, 5000ms) | Parameterized tests with different configs |
| `should continue health checks after successful check` | Verify interval resets after each check | Track time between events |

##### Consecutive Failure Threshold Detection

| Test Case | Description | Assertion Strategy |
|-----------|-------------|-------------------|
| `should track consecutive failures accurately` | Count failures correctly | Mock client.ping to fail, verify `consecutiveFailures` in event |
| `should reset failure count on successful health check` | Reset after success | Fail twice, succeed once, verify count = 0 |
| `should trigger threshold at exact failure count` | Threshold triggers precisely | With threshold=3, fail exactly 3 times, verify unhealthy |
| `should not trigger threshold before reaching count` | No premature unhealthy state | With threshold=3, fail 2 times, verify still healthy |
| `should handle configurable thresholds (1, 2, 3, 5)` | Parameterized threshold tests | Test with different `healthCheckFailureThreshold` values |

##### Automatic Reconnection Triggering

| Test Case | Description | Assertion Strategy |
|-----------|-------------|-------------------|
| `should trigger reconnection after threshold failures` | Reconnect on unhealthy | Verify `scheduleReconnect` called after threshold |
| `should emit stateChange to disconnected before reconnection` | Proper state transition | Verify `stateChange(serverId, 'connected', 'disconnected')` |
| `should not trigger reconnection when autoReconnect is false` | Respect config | Set `autoReconnect: false`, verify no reconnection |
| `should not trigger reconnection when intentionally disconnected` | Respect intentional disconnect | Call `disconnect()`, verify no reconnection attempts |
| `should not trigger reconnection when reconnector is exhausted` | Respect exhaustion state | Mock `isExhausted() => true`, verify no reconnection |

##### Health Status Event Emission

| Test Case | Description | Assertion Strategy |
|-----------|-------------|-------------------|
| `should emit healthCheck event with correct payload on success` | Verify event structure | Check `{success, latencyMs, consecutiveFailures, isHealthy, timestamp}` |
| `should emit healthCheck event with error on failure` | Verify failure payload | Check `{success: false, error, consecutiveFailures}` |
| `should emit stateChange when transitioning to unhealthy` | State transition event | Verify `stateChange` when `isHealthy` becomes `false` |
| `should include latency measurement in successful checks` | Latency tracking | Verify `latencyMs` is present and reasonable |
| `should update health state timestamps correctly` | Timestamp tracking | Verify `lastHealthyAt`, `lastCheckAt` updated |

##### Configurable Timeout Handling

| Test Case | Description | Assertion Strategy |
|-----------|-------------|-------------------|
| `should timeout health check at configured duration` | Timeout triggers | Mock slow ping, verify timeout error at `healthCheckTimeoutMs` |
| `should handle timeout as failure` | Timeout counts as failure | Verify `consecutiveFailures` incremented on timeout |
| `should not timeout before configured duration` | No premature timeout | Verify ping completes if faster than timeout |
| `should respect different timeout configurations` | Parameterized configs | Test with 100ms, 500ms, 1000ms timeouts |
| `should race between ping response and timeout` | Race condition handling | Test edge cases near timeout boundary |

### Key Implementation Details

#### Timer Control Pattern

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Advance time precisely
vi.advanceTimersByTime(healthCheckIntervalMs);

// Wait for async operations in timers
await vi.runAllTimersAsync();
```

#### Simulating Slow Responses for Timeout Tests

```typescript
context.client.ping.mockImplementation(() =>
  new Promise((resolve) => {
    setTimeout(resolve, slowResponseTime);
  })
);

// Advance to timeout threshold
vi.advanceTimersByTime(healthCheckTimeoutMs + 10);
await vi.runAllTimersAsync();
```

#### Verifying Health Check Event Payload

```typescript
expect(healthCheckSpy).toHaveBeenCalledWith(
  'test-server',
  expect.objectContaining({
    success: true,
    isHealthy: true,
    consecutiveFailures: 0,
    latencyMs: expect.any(Number),
    timestamp: expect.any(Date),
  })
);
```

### Integration with Existing Tests

The new test file should:
1. Use the same mock setup patterns as existing tests
2. Share test configuration helpers (`createTestConfig`)
3. Follow the same structure and naming conventions
4. Be independent and runnable in isolation

### Test Configuration Matrix

| Config Parameter | Default | Test Values |
|-----------------|---------|-------------|
| `healthCheckIntervalMs` | 30000 | 100, 500, 1000, 2000 |
| `healthCheckTimeoutMs` | 5000 | 50, 100, 500 |
| `healthCheckFailureThreshold` | 3 | 1, 2, 3, 5 |
| `autoReconnect` | true | true, false |
| `heartbeatEnabled` | true | true, false |

## Consequences

### Positive
- Comprehensive coverage of health check timing behavior
- Reliable tests using mocked timers (no flakiness)
- Clear separation from other connection manager tests
- Parameterized tests for configuration validation
- Documentation of expected behavior through tests

### Negative
- Additional test file adds to test suite size
- Mocked timers require careful handling of async operations
- Tests may need updating if health check implementation changes

### Risks
- Timer mocking may not perfectly simulate real-world timing
- Complex async/timer interactions may have edge cases

## Implementation Notes

### File Structure
```
packages/orchestrator/src/mcp/
├── connection-manager.ts              # Main implementation
├── connection-manager.test.ts          # Basic tests
├── connection-manager.enhanced.test.ts # Enhanced feature tests
├── connection-manager.heartbeat.test.ts # Heartbeat tests
├── connection-manager.health-timing.test.ts # NEW: Health timing tests
└── ...
```

### Dependencies
- `vitest` for testing framework
- `eventemitter3` for event handling mocks
- Existing mock infrastructure from other test files

### Estimated Test Count
- ~25-30 individual test cases
- 5 describe blocks
- Expected execution time: <5 seconds with fake timers
