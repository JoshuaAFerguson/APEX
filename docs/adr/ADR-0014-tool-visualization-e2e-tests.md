# ADR-0014: End-to-End Verification Tests for Tool Visualization Features

## Status

Proposed

## Context

The APEX tool visualization system includes 4 key features that require comprehensive end-to-end verification:

1. **Circular Reference Handling** - Safe serialization of objects with circular references
2. **Large Payload Truncation** - Preventing UI crashes from oversized data
3. **Timing Events Streaming** - Real-time tool execution duration tracking
4. **MCP Error Display** - User-friendly error presentation with suggestions

These features span multiple packages (`@apexcli/core`, `@apexcli/api`, `@apexcli/cli`, `@apexcli/orchestrator`) and require integration testing to verify the full event flow from orchestrator through WebSocket to UI components.

### Current State

Existing test coverage includes:
- **Unit tests**: `ToolCall.test.tsx`, `ErrorDisplay.test.tsx` with component-level verification
- **Integration tests**: `websocket-safe-serialization.integration.test.ts` with circular reference handling
- **Audit tests**: `v050-tool-visualization-audit.test.tsx` with feature validation

However, there is no comprehensive E2E test suite that verifies all 4 features together with:
- Real WebSocket connections
- Mock orchestrator emitting all event types
- Full rendering verification for all components

## Decision

We will implement a comprehensive **End-to-End Verification Test Suite** with the following architecture:

### 1. Test Suite Structure

```
tests/
└── e2e/
    └── tool-visualization/
        ├── tool-visualization.e2e.test.ts       # Main E2E test suite
        ├── fixtures/
        │   ├── circular-reference-fixtures.ts   # Circular ref test data
        │   ├── large-payload-fixtures.ts        # Large payload test data
        │   ├── timing-event-fixtures.ts         # Timing event scenarios
        │   └── mcp-error-fixtures.ts            # MCP error scenarios
        └── utils/
            ├── mock-websocket-server.ts         # Mock WebSocket server
            ├── orchestrator-event-emitter.ts    # Event simulation
            └── component-render-helpers.ts      # React render utilities
```

### 2. Test Architecture Components

#### 2.1 Mock Orchestrator Event Emitter

Extends existing `MockOrchestrator` from `packages/cli/src/ui/components/agents/__tests__/test-utils/MockOrchestrator.ts`:

```typescript
/**
 * Extended mock orchestrator for tool visualization E2E testing
 * Adds simulation methods for all 4 visualization features
 */
export class ToolVisualizationMockOrchestrator extends MockOrchestrator {
  /**
   * Simulate tool events with circular references
   */
  simulateCircularReferenceToolEvent(taskId: string): void;

  /**
   * Simulate tool events with large payloads
   */
  simulateLargePayloadToolEvent(taskId: string, payloadConfig: LargePayloadConfig): void;

  /**
   * Simulate timing events for tool execution
   */
  simulateTimingEvents(taskId: string, timingScenario: TimingScenario): void;

  /**
   * Simulate MCP error events with various error types
   */
  simulateMCPError(taskId: string, errorType: MCPErrorType): void;
}
```

#### 2.2 Mock WebSocket Server

Lightweight mock server for WebSocket testing without full API server:

```typescript
/**
 * Mock WebSocket server that bridges orchestrator events
 * for testing without real API server dependency
 */
export class MockWebSocketServer {
  private wss: WebSocketServer;
  private orchestrator: ToolVisualizationMockOrchestrator;

  constructor(port: number);

  /** Connect mock orchestrator to broadcast events */
  attachOrchestrator(orchestrator: ToolVisualizationMockOrchestrator): void;

  /** Get connected client count */
  getClientCount(): number;

  /** Close server and all connections */
  close(): Promise<void>;
}
```

#### 2.3 Component Render Helpers

Utilities for consistent component rendering in tests:

```typescript
/**
 * Render ToolCall component with full provider context
 */
export function renderToolCall(props: ToolCallProps): RenderResult;

/**
 * Render ToolExecutionPanel with mock orchestrator
 */
export function renderToolExecutionPanel(
  orchestrator: MockOrchestrator,
  props?: Partial<ToolExecutionPanelProps>
): RenderResult;

/**
 * Render ErrorDisplay with various error types
 */
export function renderErrorDisplay(props: ErrorDisplayProps): RenderResult;
```

### 3. Test Scenarios

#### 3.1 Circular Reference Tests

| Scenario | Description | Expected Result |
|----------|-------------|-----------------|
| Self-referential object | Object with `obj.self = obj` | `[Circular]` marker in output |
| Nested circular reference | `obj.child.parent = obj` | Deep circular detection |
| Array with circular reference | `arr.push(arr)` | Array safely serialized |
| Multiple circular paths | Multiple self-references | All paths marked |
| WeakSet performance | 1000+ object tree | No memory leak |

#### 3.2 Large Payload Tests

| Scenario | Description | Expected Result |
|----------|-------------|-----------------|
| Array > 1000 items | 10,000 item array | Truncated to 1000 |
| String > 50KB | 100KB string | Truncated with `... [truncated]` |
| Deeply nested object | 50 levels deep | Safely traversed |
| Mixed large payload | Large arrays + strings | Both truncated |
| Truncation metadata | Any truncation | `_truncation` object present |

#### 3.3 Timing Event Tests

| Scenario | Description | Expected Result |
|----------|-------------|-----------------|
| Fast tool execution | < 100ms | Duration displayed in ms |
| Normal tool execution | 1-10s | Duration displayed in seconds |
| Long tool execution | > 60s | Duration in minutes:seconds |
| Concurrent tool timing | 5 parallel tools | Independent timing per tool |
| Real-time duration | Active tool | Live updating duration |
| Average duration stats | Multiple completions | Accurate rolling average |

#### 3.4 MCP Error Tests

| Scenario | Description | Expected Result |
|----------|-------------|-----------------|
| Permission denied | MCP permission error | Permission suggestion shown |
| Connection timeout | MCP timeout | Retry suggestion shown |
| Tool not found | Missing MCP tool | Resource not found suggestion |
| Protocol error | Invalid MCP message | Syntax error suggestion |
| Server disconnect | MCP server died | Network error suggestion |
| Nested error | Error with cause chain | All causes displayed |

### 4. Test Implementation Patterns

#### 4.1 WebSocket Event Flow Testing

```typescript
describe('WebSocket Event Flow', () => {
  let mockOrchestrator: ToolVisualizationMockOrchestrator;
  let wsServer: MockWebSocketServer;
  let wsClient: WebSocket;

  beforeAll(async () => {
    wsServer = new MockWebSocketServer(0); // Dynamic port
    mockOrchestrator = new ToolVisualizationMockOrchestrator();
    wsServer.attachOrchestrator(mockOrchestrator);
    await wsServer.start();
  });

  afterAll(async () => {
    await wsServer.close();
    mockOrchestrator.cleanup();
  });

  it('should stream timing events to connected clients', async () => {
    // Connect WebSocket client
    wsClient = new WebSocket(wsServer.url);
    await waitForConnection(wsClient);

    // Collect messages
    const messages: WebSocketMessage[] = [];
    wsClient.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    // Emit timing events from orchestrator
    mockOrchestrator.simulateTimingEvents('task-1', {
      toolName: 'Read',
      startDelay: 0,
      duration: 1500,
    });

    // Wait for events
    await waitForMessages(messages, 2); // start + complete

    // Verify timing data
    const completeEvent = messages.find(m => m.type === 'tool:complete');
    expect(completeEvent.data.timing.duration).toBe(1500);
    expect(completeEvent.data.timing.startTime).toBeDefined();
    expect(completeEvent.data.timing.endTime).toBeDefined();
  });
});
```

#### 4.2 Component Rendering Testing

```typescript
describe('ToolCall Component Rendering', () => {
  it('should render circular reference indicator for self-referential input', () => {
    const circularInput: any = { name: 'test' };
    circularInput.self = circularInput;

    const { lastFrame } = renderToolCall({
      toolName: 'Read',
      input: circularInput,
      status: 'success',
      displayMode: 'normal',
    });

    // Component should not crash and should show param count
    expect(lastFrame()).toContain('Read');
    expect(lastFrame()).toContain('2 params');
  });

  it('should truncate large output and show line count', () => {
    const largeOutput = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');

    const { lastFrame } = renderToolCall({
      toolName: 'Grep',
      output: largeOutput,
      status: 'success',
      displayMode: 'normal',
    });

    expect(lastFrame()).toContain('more lines');
  });
});
```

#### 4.3 ErrorDisplay Component Testing

```typescript
describe('ErrorDisplay MCP Error Rendering', () => {
  it('should generate auto-suggestions for MCP permission errors', () => {
    const mcpError = new Error('MCP server permission denied for tool: Write');

    const { lastFrame } = renderErrorDisplay({
      error: mcpError,
      showSuggestions: true,
    });

    expect(lastFrame()).toContain('Permission Issue');
    expect(lastFrame()).toContain('Check file/directory permissions');
  });

  it('should display MCP timeout errors with retry suggestion', () => {
    const timeoutError = new Error('MCP tool execution timeout after 30000ms');

    const { lastFrame } = renderErrorDisplay({
      error: timeoutError,
      showSuggestions: true,
    });

    expect(lastFrame()).toContain('Timeout');
    expect(lastFrame()).toContain('retry');
  });
});
```

### 5. Test Data Fixtures

#### 5.1 Circular Reference Fixtures

```typescript
// circular-reference-fixtures.ts
export const circularReferenceFixtures = {
  selfReference: () => {
    const obj: any = { name: 'test', value: 42 };
    obj.self = obj;
    return obj;
  },

  nestedCircular: () => {
    const parent: any = { type: 'parent' };
    const child: any = { type: 'child' };
    parent.child = child;
    child.parent = parent;
    return parent;
  },

  arrayCircular: () => {
    const arr: any[] = [1, 2, 3];
    arr.push(arr);
    return arr;
  },

  deepCircular: (depth: number = 10) => {
    let obj: any = { level: 0 };
    const root = obj;
    for (let i = 1; i < depth; i++) {
      obj.child = { level: i };
      obj = obj.child;
    }
    obj.root = root; // Create circular reference
    return root;
  },

  multipleCircularPaths: () => {
    const a: any = { id: 'a' };
    const b: any = { id: 'b' };
    const c: any = { id: 'c' };
    a.toB = b;
    b.toC = c;
    c.toA = a;
    a.toC = c;
    b.toA = a;
    c.toB = b;
    return a;
  },
};
```

#### 5.2 Large Payload Fixtures

```typescript
// large-payload-fixtures.ts
export const largePayloadFixtures = {
  largeArray: (size: number = 10000) => {
    return Array.from({ length: size }, (_, i) => ({
      index: i,
      value: `item-${i}`,
      timestamp: new Date().toISOString(),
    }));
  },

  largeString: (sizeKB: number = 100) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const targetLength = sizeKB * 1024;
    let result = '';
    while (result.length < targetLength) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  },

  deeplyNested: (depth: number = 50) => {
    let obj: any = { value: 'leaf' };
    for (let i = depth; i > 0; i--) {
      obj = { level: i, child: obj };
    }
    return obj;
  },

  mixedLargePayload: () => ({
    largeArray: largePayloadFixtures.largeArray(5000),
    largeString: largePayloadFixtures.largeString(100),
    nested: largePayloadFixtures.deeplyNested(20),
    metadata: {
      timestamp: new Date().toISOString(),
      source: 'test-fixture',
    },
  }),
};
```

#### 5.3 MCP Error Fixtures

```typescript
// mcp-error-fixtures.ts
export const mcpErrorFixtures = {
  permissionDenied: () => new Error('MCP permission denied: Cannot write to /system/protected'),

  connectionTimeout: () => {
    const error = new Error('MCP connection timeout after 30000ms');
    (error as any).code = 'ETIMEDOUT';
    return error;
  },

  toolNotFound: () => new Error('MCP tool "custom-tool" not found on server'),

  protocolError: () => {
    const error = new Error('Invalid JSON-RPC message: missing "id" field');
    (error as any).code = 'PROTOCOL_ERROR';
    return error;
  },

  serverDisconnect: () => {
    const error = new Error('MCP server disconnected unexpectedly');
    (error as any).code = 'ECONNRESET';
    return error;
  },

  nestedError: () => {
    const rootCause = new Error('Network unreachable');
    const midLevel = new Error('Failed to connect to MCP server');
    (midLevel as any).cause = rootCause;
    const topLevel = new Error('MCP tool execution failed');
    (topLevel as any).cause = midLevel;
    return topLevel;
  },

  apiKeyError: () => new Error('Invalid API key for MCP marketplace authentication'),
};
```

### 6. Configuration

#### 6.1 Vitest Configuration

Add to `vitest.e2e.config.ts`:

```typescript
export default defineConfig({
  test: {
    include: [
      'tests/e2e/tool-visualization/**/*.test.ts',
    ],
    testTimeout: 60000, // 60s for E2E tests
    hookTimeout: 30000, // 30s for setup/teardown
    environment: 'node',
    poolOptions: {
      forks: {
        maxForks: 2, // Limit concurrency for WebSocket tests
      },
    },
  },
});
```

### 7. Test Execution Order

```
1. Setup Phase
   ├── Start MockWebSocketServer
   ├── Create ToolVisualizationMockOrchestrator
   └── Attach orchestrator to server

2. Feature Verification Phase (parallel where possible)
   ├── Circular Reference Tests
   │   ├── WebSocket serialization
   │   ├── Component rendering
   │   └── Memory leak verification
   ├── Large Payload Tests
   │   ├── Truncation verification
   │   ├── Metadata generation
   │   └── Performance bounds
   ├── Timing Event Tests
   │   ├── Event streaming
   │   ├── Duration calculation
   │   └── Statistics aggregation
   └── MCP Error Tests
       ├── Error categorization
       ├── Suggestion generation
       └── Context display

3. Teardown Phase
   ├── Close WebSocket connections
   ├── Stop MockWebSocketServer
   └── Cleanup orchestrator listeners
```

### 8. Edge Cases and Limitations

#### Documented Edge Cases

| Edge Case | Behavior | Test Coverage |
|-----------|----------|---------------|
| Empty circular reference | Object with only self-reference | Should serialize as `{ self: [Circular] }` |
| Zero-length truncation | String with maxLength=0 | Should produce empty string |
| Sub-millisecond timing | Duration < 1ms | Should display "0ms" |
| Unicode in errors | Non-ASCII error messages | Should preserve encoding |
| Concurrent truncations | Multiple payloads truncated | Independent tracking |
| WebSocket reconnection | Connection lost mid-event | Should gracefully handle |

#### Known Limitations

1. **Browser-specific testing**: These tests run in Node.js environment; browser-specific behaviors need separate Playwright tests
2. **Real API server**: Tests use mock WebSocket server; full API integration needs separate test suite
3. **React component snapshots**: Ink components render to text; visual verification limited
4. **Timing precision**: Node.js timers may have variance; tests use tolerance ranges

### 9. Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| All circular reference scenarios handled | 0 JSON.stringify failures |
| Large payloads truncated correctly | Payload size < 100KB after truncation |
| Timing events accurate | Measured duration within ±50ms of actual |
| MCP errors display suggestions | ≥1 suggestion for each error type |
| No memory leaks | Heap growth < 10MB after 100 test iterations |
| Test execution time | Full suite completes in < 60 seconds |

## File Changes

### New Files

- `tests/e2e/tool-visualization/tool-visualization.e2e.test.ts`
- `tests/e2e/tool-visualization/fixtures/circular-reference-fixtures.ts`
- `tests/e2e/tool-visualization/fixtures/large-payload-fixtures.ts`
- `tests/e2e/tool-visualization/fixtures/timing-event-fixtures.ts`
- `tests/e2e/tool-visualization/fixtures/mcp-error-fixtures.ts`
- `tests/e2e/tool-visualization/utils/mock-websocket-server.ts`
- `tests/e2e/tool-visualization/utils/orchestrator-event-emitter.ts`
- `tests/e2e/tool-visualization/utils/component-render-helpers.ts`

### Modified Files

- `vitest.e2e.config.ts` - Add tool-visualization test patterns

## Consequences

### Positive

- **Comprehensive coverage**: All 4 visualization features verified in single test suite
- **Realistic testing**: Real WebSocket connections with mock orchestrator
- **Regression prevention**: Catches integration issues between packages
- **Documentation**: Test fixtures serve as examples for event formats
- **Performance validation**: Timing and memory tests prevent degradation

### Negative

- **Test complexity**: E2E tests are inherently more complex to maintain
- **Execution time**: Longer than unit tests (target: < 60s total)
- **Environment dependencies**: Requires Node.js WebSocket support

### Neutral

- **Parallel with existing tests**: Complements but doesn't replace unit tests
- **Mock vs real**: Uses mock orchestrator; real orchestrator tests separate

## Implementation Priority

1. **Phase 1**: Core test infrastructure (mock server, event emitter)
2. **Phase 2**: Feature test suites (circular refs, payloads, timing, errors)
3. **Phase 3**: Edge cases and stress tests
4. **Phase 4**: CI integration and performance baselines

## References

- `packages/api/src/__tests__/websocket-safe-serialization.integration.test.ts` - Existing circular reference tests
- `packages/cli/src/ui/components/agents/__tests__/test-utils/MockOrchestrator.ts` - Base mock orchestrator
- `ADR-0013: WebSocket Payload Truncation` - Truncation system design
- `packages/cli/src/ui/hooks/useToolEventLogger.ts` - Event logger implementation
