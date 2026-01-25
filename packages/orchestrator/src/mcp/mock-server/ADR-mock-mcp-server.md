# ADR: Mock MCP Server Implementation for Testing

## Status
Accepted

## Context

APEX needs comprehensive mock MCP server infrastructure for testing MCP client interactions without requiring real MCP servers. While we already have:

1. **`@apex/core/mcp/mock-types.ts`** - Complete Zod schemas defining mock server configuration (transport, behavior, scenarios, state machines, error injection, etc.)
2. **`packages/orchestrator/src/__tests__/utils/mock-mcp-server.ts`** - A basic mock server class (`MockMCPServer`) used in existing tests

The gap is:
- The existing `MockMCPServer` in test utils is a simplified mock that doesn't implement the MCPTransport interface
- It uses its own ad-hoc request/response pattern rather than proper JSON-RPC 2.0 messages
- It doesn't leverage the comprehensive type system from `mock-types.ts`
- There's no mock transport that can be plugged into the real `MCPClient` for integration testing
- No support for configurable scenarios, state machines, or protocol-level error simulation

## Decision

### Architecture Overview

We will implement a layered mock MCP server architecture with three key components:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      MockMCPServerFacade                            │
│  (Top-level API: create, configure, start, stop mock servers)       │
│  Uses MockMCPServerDefinition from @apex/core/mcp/mock-types        │
├─────────────────────────────────────────────────────────────────────┤
│                      MockMCPProtocolHandler                         │
│  (JSON-RPC 2.0 message routing, MCP protocol lifecycle)             │
│  Handles: initialize, tools/list, tools/call, resources, prompts    │
├─────────────────────────────────────────────────────────────────────┤
│                      MockTransport                                   │
│  (Implements MCPTransport interface for in-process testing)          │
│  Provides: connect, disconnect, send, message events                │
├─────────────────────────────────────────────────────────────────────┤
│                    MockBehaviorEngine                                 │
│  (Executes configurable behaviors: delays, errors, state, notifs)   │
│  Uses: MockBehaviorConfig, MockStatefulBehaviorConfig               │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. MockTransport (implements MCPTransport)

**Purpose**: An in-process transport implementation that simulates a connection to an MCP server without spawning external processes.

**Key Design Decisions**:
- Extends the existing `MCPTransport` abstract class from `transports/transport.ts`
- Provides bidirectional message passing through in-memory channels
- Supports configurable connection latency and failure simulation
- Can be used with the real `MCPClient` class for integration testing
- Emits standard `MCPTransportEvents` (message, error, connected, disconnected)

```typescript
class MockTransport extends MCPTransport {
  constructor(options: MockTransportOptions);
  connect(): Promise<void>;
  disconnect(reason?: string): Promise<void>;
  send(message: JSONRPCMessage): Promise<void>;

  // Test control methods
  injectMessage(message: JSONRPCMessage): void;
  simulateDisconnect(reason?: string): void;
  simulateError(error: MCPTransportError): void;
}
```

**Rationale**: By implementing the real `MCPTransport` interface, we enable testing the actual `MCPClient` code path without mocking. This catches integration issues that unit-level mocks miss.

#### 2. MockMCPProtocolHandler

**Purpose**: Routes incoming JSON-RPC requests to appropriate handlers and manages MCP protocol state (initialization handshake, capabilities negotiation).

**Key Design Decisions**:
- Manages the MCP protocol lifecycle (uninitialized → initialized)
- Routes methods to tool handlers, resource handlers, etc.
- Validates requests against protocol schemas (when `validateRequests: true`)
- Tracks request history for assertion/verification
- Applies response delays and error injection from behavior config

```typescript
class MockMCPProtocolHandler {
  constructor(config: MockMCPServerConfig, behavior: MockBehaviorConfig);

  handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse>;
  handleNotification(notification: JSONRPCNotification): void;

  // State inspection
  getRequestHistory(): RecordedRequest[];
  getState(): string;
  isInitialized(): boolean;
  resetState(): void;
}
```

**Rationale**: Separating protocol handling from transport allows testing protocol logic independently and reusing it across different transport types.

#### 3. MockBehaviorEngine

**Purpose**: Executes configurable behaviors including response delays, error injection, state machine transitions, and notification triggers.

**Key Design Decisions**:
- Consumes `MockBehaviorConfig` from `@apex/core/mcp/mock-types`
- Implements the state machine defined by `MockStatefulBehaviorConfig`
- Handles response delay computation (fixed, range, per-method, jitter)
- Manages error injection (probability-based, method-filtered, count-limited)
- Fires notification triggers based on configured conditions
- Tracks invocation counts for tool handlers with `maxInvocations`

```typescript
class MockBehaviorEngine {
  constructor(config: MockBehaviorConfig);

  // Apply behavior to a response
  applyDelay(method: string): Promise<void>;
  shouldInjectError(method: string): boolean;
  getErrorResponse(): JsonRpcError;

  // State machine
  transition(method: string, args?: Record<string, unknown>): void;
  getCurrentState(): string;
  getStateBehavior(): MockStateBehavior | undefined;

  // Tool handling
  findToolHandler(toolName: string, args?: Record<string, unknown>): MockToolHandler | undefined;

  // Notifications
  checkNotificationTriggers(method: string, requestCount: number): MockNotificationTrigger[];

  // Request recording
  recordRequest(request: JSONRPCRequest): void;
  getRecordedRequests(): RecordedRequest[];

  reset(): void;
}
```

**Rationale**: Isolating behavior logic enables rich test scenarios (slow servers, flaky connections, capability changes) while keeping the protocol handler clean.

#### 4. MockMCPServerFacade

**Purpose**: Top-level API that orchestrates all components and provides a simple interface for test authors.

**Key Design Decisions**:
- Creates and manages MockTransport + MockMCPProtocolHandler + MockBehaviorEngine
- Consumes `MockMCPServerDefinition` from `@apex/core/mcp/mock-types`
- Supports scenario switching at runtime
- Provides factory methods for common test patterns
- Offers assertion helpers for verifying interactions

```typescript
class MockMCPServerFacade {
  constructor(definition: MockMCPServerDefinition);

  // Lifecycle
  getTransport(): MockTransport;
  start(): Promise<void>;
  stop(): Promise<void>;

  // Scenario management
  activateScenario(name: string): void;
  resetToDefault(): void;

  // Assertions
  assertToolCalled(toolName: string, times?: number): void;
  assertMethodCalled(method: string, times?: number): void;
  assertInitialized(): void;
  getRequestHistory(): RecordedRequest[];

  // Dynamic behavior modification
  addToolHandler(handler: MockToolHandler): void;
  removeToolHandler(toolName: string): void;
  setErrorInjection(config: MockErrorInjection): void;
  setResponseDelay(config: MockResponseDelay): void;
}
```

**Rationale**: The facade pattern provides a clean, test-friendly API that hides the complexity of the underlying components.

### Directory Structure

```
packages/orchestrator/src/mcp/mock-server/
├── ADR-mock-mcp-server.md          # This ADR
├── index.ts                        # Public exports
├── mock-transport.ts               # MockTransport (implements MCPTransport)
├── mock-protocol-handler.ts        # MockMCPProtocolHandler
├── mock-behavior-engine.ts         # MockBehaviorEngine
├── mock-server-facade.ts           # MockMCPServerFacade
└── types.ts                        # Internal types (RecordedRequest, etc.)
```

### Integration Points

1. **With MCPClient**: The `MockTransport` plugs directly into `MCPClient`:
   ```typescript
   const mockServer = new MockMCPServerFacade(definition);
   const client = new MCPClient({ transport: mockServer.getTransport() });
   await client.connect();
   const tools = await client.listTools();
   mockServer.assertMethodCalled('tools/list', 1);
   ```

2. **With MCPConnectionManager**: Can be used to test connection lifecycle:
   ```typescript
   // Create mock transport factory for testing
   const mockTransportFactory = (serverId: string) => mockServer.getTransport();
   ```

3. **With existing test utils**: The existing `MockMCPServer` in `__tests__/utils/` continues to work for its current use cases. The new implementation provides a higher-fidelity alternative for protocol-level testing.

### Test Usage Patterns

#### Simple Tool Testing
```typescript
const server = new MockMCPServerFacade({
  serverConfig: { name: 'test', transport: 'stdio', capabilities: { tools: {} } },
  defaultBehavior: {
    toolHandlers: [{
      toolName: 'read_file',
      response: { content: [{ type: 'text', text: 'hello' }] },
    }],
  },
});

const client = new MCPClient({ transport: server.getTransport() });
await client.connect();
const result = await client.callTool('read_file', { path: '/test.txt' });
expect(result).toEqual([{ type: 'text', text: 'hello' }]);
```

#### Error Resilience Testing
```typescript
const server = new MockMCPServerFacade({
  serverConfig: { name: 'flaky', transport: 'stdio' },
  defaultBehavior: {
    errorInjection: {
      enabled: true,
      probability: 0.5,
      errorCode: -32603,
      errorMessage: 'Server overloaded',
    },
  },
});
```

#### Stateful Interaction Testing
```typescript
const server = new MockMCPServerFacade({
  serverConfig: { name: 'stateful', transport: 'stdio' },
  defaultBehavior: {
    statefulBehavior: {
      initialState: 'idle',
      transitions: [
        { from: 'idle', to: 'authenticated', onMethod: 'tools/call', whenArgs: { action: 'login' } },
      ],
      stateBehaviors: [
        { state: 'idle', toolHandlers: [/* unauthorized responses */] },
        { state: 'authenticated', toolHandlers: [/* authorized responses */] },
      ],
    },
  },
});
```

## Consequences

### Positive
- **Protocol fidelity**: Tests exercise the real JSON-RPC 2.0 message flow
- **Type safety**: Leverages existing Zod schemas from `mock-types.ts` for configuration validation
- **Composability**: Components can be used independently or together
- **Integration testing**: MockTransport works with real MCPClient code
- **Rich scenarios**: State machines, error injection, delays all configurable
- **Non-breaking**: Existing mock-mcp-server.ts in test utils remains untouched
- **Follows patterns**: Uses MCPTransport base class, EventEmitter3, existing error types

### Negative
- Adds complexity for tests that only need simple mocks
- Multiple layers may be overkill for basic unit tests
- Need to maintain mock implementations as MCP protocol evolves

### Mitigations
- Factory functions for common patterns (1-liner setups)
- Keep existing simple mocks for basic test cases
- Document when to use which mock approach
- The facade pattern hides complexity from test authors

## Implementation Notes for Developer Stage

1. **Start with MockTransport** - This is the foundation. It must correctly implement `MCPTransport` and pass the same interface tests.
2. **Then MockBehaviorEngine** - Core logic for delays, errors, state. Pure functions, easily unit-testable.
3. **Then MockMCPProtocolHandler** - Wires behavior engine to protocol. Handles JSON-RPC routing.
4. **Finally MockMCPServerFacade** - Integration layer with assertion helpers.
5. **Update orchestrator index.ts** - Export from `./mock-server/index.js`
6. **Write comprehensive tests** - Each component should have its own test file.

## Related

- ADR-001: MCP Transport Architecture (defines the MCPTransport interface)
- ADR-025: MCP Protocol Message Types (protocol-types.ts)
- ADR-026: Mock MCP Server Configuration Types (mock-types.ts)
