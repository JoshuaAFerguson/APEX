# ADR 0007: MCP Integration Test Architecture

## Status

Proposed

## Context

The APEX platform includes MCP (Model Context Protocol) integration for connecting to external tool servers. The key components are:

1. **MCPConnectionManager** (`packages/orchestrator/src/mcp/connection-manager.ts`) - Centralized manager for MCP server connections with:
   - Connection lifecycle management (connect, disconnect, reconnect)
   - Exponential backoff reconnection with `ExponentialBackoffReconnector`
   - Health monitoring via `ConnectionHealthManager`
   - Connection pooling support
   - Tool execution routing

2. **MCPToolRegistry** (`packages/orchestrator/src/mcp-tool-registry.ts`) - Registry for MCP tools with:
   - Tool discovery from connected servers
   - Schema translation to Claude Agent SDK format via `SchemaTranslator`
   - Tool availability tracking based on connection state
   - Auto-refresh capabilities
   - Event emission for registration/unregistration

3. **MCPClient** (`packages/orchestrator/src/mcp/client.ts`) - Low-level JSON-RPC client for:
   - Transport abstraction via `MCPTransport` interface
   - Request/response correlation with timeout handling
   - Tool listing and invocation

4. **Supporting Infrastructure**:
   - `StdioTransport` - Process-based transport implementation
   - `SchemaTranslator` - JSON Schema to Zod schema conversion
   - Types from `@apexcli/core` for configuration and connection state

The acceptance criteria require:
- Unit tests for MCPConnectionManager and MCPToolRegistry
- Integration tests verifying MCP server connection and tool invocation
- Mock MCP server for testing
- All tests pass with `npm run test`

## Decision

### Test Architecture Overview

We will implement a comprehensive test suite following a **three-tier testing strategy**:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Integration Tests                            │
│  - End-to-end workflows with mock MCP servers                   │
│  - Multi-server coordination scenarios                          │
│  - Error recovery and resilience testing                        │
├─────────────────────────────────────────────────────────────────┤
│                      Unit Tests                                  │
│  - MCPConnectionManager (connection lifecycle, events)          │
│  - MCPToolRegistry (tool registration, schema translation)      │
│  - MCPClient (JSON-RPC protocol handling)                       │
├─────────────────────────────────────────────────────────────────┤
│                    Mock Infrastructure                           │
│  - MockMCPTransport (transport simulation)                      │
│  - MockMCPServer (full server behavior simulation)              │
│  - Test fixtures and helpers                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 1. Mock MCP Server Design

Create a reusable `MockMCPServer` class that simulates real MCP server behavior:

```typescript
// packages/orchestrator/src/__tests__/mocks/mock-mcp-server.ts

export interface MockMCPServerConfig {
  tools: MCPToolDefinition[];
  simulateLatency?: number;
  simulateErrors?: ErrorSimulationConfig;
  supportedMethods?: string[];
}

export class MockMCPServer extends EventEmitter {
  // Simulates JSON-RPC 2.0 protocol
  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse>;

  // Tool behavior customization
  setToolHandler(toolName: string, handler: ToolHandler): void;

  // Error simulation
  simulateDisconnection(): void;
  simulateLatency(ms: number): void;
  simulateError(error: Error): void;

  // State inspection
  getRequestHistory(): RequestRecord[];
  getToolCallCount(toolName: string): number;
}
```

### 2. Unit Test Structure

#### MCPConnectionManager Unit Tests (`mcp-connection-manager.unit.test.ts`)

```typescript
describe('MCPConnectionManager', () => {
  describe('Constructor & Configuration', () => {
    // Default configuration application
    // Custom configuration override
    // Health manager initialization
  });

  describe('Server Discovery', () => {
    // Discover stdio servers
    // Filter SDK servers
    // Handle missing configuration
    // Use serverId as fallback name
  });

  describe('Connection Lifecycle', () => {
    // Connect to valid server
    // Handle already connected state
    // Handle connection-in-progress state
    // Connection failure and cleanup
    // Emit connected event
  });

  describe('Disconnection', () => {
    // Graceful disconnect
    // Idempotent disconnect
    // Cleanup resources (reconnector, health manager)
    // Emit disconnected event
  });

  describe('Health Monitoring', () => {
    // Start health monitoring on connect
    // Perform manual health check
    // Handle health check failures
    // Trigger reconnection on threshold breach
    // Heartbeat ping/pong support
  });

  describe('Reconnection', () => {
    // Schedule reconnection with backoff
    // Respect max retry attempts
    // Emit reconnecting events
    // Handle reconnection success
    // Handle reconnection exhaustion
  });

  describe('Tool Execution', () => {
    // Execute tool on connected server
    // Handle connection not found
    // Handle not-connected state
    // Emit tool:start/complete/error events
    // Track metrics
  });

  describe('Connection Pooling', () => {
    // Acquire pooled connection
    // Release pooled connection
    // Pool selection strategies (round-robin, least-busy, random)
    // Pool cleanup on disconnect
  });
});
```

#### MCPToolRegistry Unit Tests (`mcp-tool-registry.unit.test.ts`)

```typescript
describe('MCPToolRegistry', () => {
  describe('Initialization', () => {
    // Empty registry on init
    // Custom schema translator
    // Auto-refresh configuration
  });

  describe('Connection Management', () => {
    // Add connection and emit event
    // Remove connection and unregister tools
    // Update connection state
    // Track tools by connection
  });

  describe('Tool Discovery', () => {
    // Refresh tools from active connections
    // Skip inactive connections
    // Handle discovery timeout
    // Handle discovery errors
    // Emit tool:registered events
  });

  describe('Schema Translation', () => {
    // Translate string type
    // Translate number/integer types
    // Translate boolean type
    // Translate array type
    // Translate nested object type
    // Handle enum constraints
    // Handle oneOf/anyOf/allOf
    // Handle nullable types
    // Preserve format validations (email, url, uuid)
  });

  describe('Registry Access', () => {
    // Get all tools
    // Get available tools only
    // Get tools by connection
    // Get single tool by name
    // Check tool existence
    // Check tool availability
  });

  describe('Statistics', () => {
    // Total tools count
    // Available tools count
    // Active connections count
    // Tools by connection breakdown
  });

  describe('Auto-Refresh', () => {
    // Start auto-refresh timer
    // Stop auto-refresh
    // Update refresh interval
  });

  describe('Error Handling', () => {
    // Handle missing connection manager
    // Handle malformed tool schemas
    // Emit error events
  });
});
```

### 3. Integration Test Structure

#### MCP Server Connection Integration (`mcp-server-connection.integration.test.ts`)

```typescript
describe('MCP Server Connection Integration', () => {
  describe('Single Server Workflow', () => {
    // Connect → Discover tools → Execute tool → Disconnect
    // Verify event sequence
    // Verify metrics accumulation
  });

  describe('Multi-Server Coordination', () => {
    // Connect to multiple servers
    // Cross-server tool invocation
    // Handle partial server failures
    // Aggregate tools from all servers
  });

  describe('Error Recovery', () => {
    // Automatic reconnection on disconnect
    // Tool availability during reconnection
    // Queue operations during reconnection
    // Graceful degradation
  });

  describe('Health Monitoring Integration', () => {
    // Health check affects connection state
    // Health failure triggers reconnection
    // Health recovery restores availability
  });
});
```

#### Tool Invocation Integration (`mcp-tool-invocation.integration.test.ts`)

```typescript
describe('MCP Tool Invocation Integration', () => {
  describe('Successful Invocation', () => {
    // Execute tool with valid parameters
    // Receive and parse response
    // Track execution metrics
  });

  describe('Parameter Validation', () => {
    // Missing required parameters
    // Invalid parameter types
    // Extra unexpected parameters
  });

  describe('Error Handling', () => {
    // Tool not found
    // Tool execution failure
    // Connection lost during execution
    // Timeout during execution
  });

  describe('Concurrent Execution', () => {
    // Multiple simultaneous tool calls
    // Request ordering
    // Response correlation
  });
});
```

### 4. Test File Organization

```
packages/orchestrator/src/
├── __tests__/
│   ├── mocks/
│   │   ├── mock-mcp-server.ts          # MockMCPServer class
│   │   ├── mock-mcp-transport.ts       # MockMCPTransport class
│   │   ├── mock-tool-definitions.ts    # Standard mock tools
│   │   └── index.ts                    # Exports
│   │
│   ├── fixtures/
│   │   ├── mcp-server-configs.ts       # Test server configurations
│   │   ├── mcp-tool-schemas.ts         # Test tool schemas
│   │   └── apex-configs.ts             # Test ApexConfig objects
│   │
│   ├── mcp-connection-manager.unit.test.ts
│   ├── mcp-tool-registry.unit.test.ts
│   ├── mcp-server-connection.integration.test.ts
│   └── mcp-tool-invocation.integration.test.ts
│
├── mcp/
│   ├── connection-manager.test.ts      # Existing tests (enhanced)
│   └── client.test.ts                  # Existing tests (enhanced)
│
├── mcp-tool-registry.test.ts           # Existing tests (enhanced)
└── schema-translator.test.ts           # Existing tests (enhanced)
```

### 5. Mock Tool Definitions

Standard set of mock tools for consistent testing:

```typescript
// packages/orchestrator/src/__tests__/mocks/mock-tool-definitions.ts

export const MOCK_TOOLS = {
  filesystem: {
    'file-read': {
      name: 'file-read',
      description: 'Read file contents',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          encoding: { type: 'string', enum: ['utf8', 'base64'], default: 'utf8' }
        },
        required: ['path']
      }
    },
    'file-write': {
      name: 'file-write',
      description: 'Write content to file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
          append: { type: 'boolean', default: false }
        },
        required: ['path', 'content']
      }
    }
  },
  database: {
    'db-query': {
      name: 'db-query',
      description: 'Execute SQL query',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          params: { type: 'array', items: { type: 'string' } }
        },
        required: ['query']
      }
    }
  },
  utilities: {
    'delay': {
      name: 'delay',
      description: 'Wait for specified duration',
      inputSchema: {
        type: 'object',
        properties: {
          ms: { type: 'integer', minimum: 0, maximum: 10000 }
        },
        required: ['ms']
      }
    },
    'echo': {
      name: 'echo',
      description: 'Return input unchanged',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      }
    },
    'failing-tool': {
      name: 'failing-tool',
      description: 'Always fails for testing',
      inputSchema: { type: 'object', properties: {} }
    }
  }
};
```

### 6. Test Patterns and Best Practices

#### Event-Driven Testing
```typescript
it('should emit events in correct sequence', async () => {
  const events: string[] = [];

  manager.on('connected', () => events.push('connected'));
  manager.on('tool:start', () => events.push('tool:start'));
  manager.on('tool:complete', () => events.push('tool:complete'));

  await manager.connect('test-server');
  await manager.executeTool('test-server', 'echo', { message: 'hi' });

  expect(events).toEqual(['connected', 'tool:start', 'tool:complete']);
});
```

#### Timeout Testing
```typescript
it('should handle operation timeouts', async () => {
  vi.useFakeTimers();

  const slowTransport = new MockMCPTransport({ simulateLatency: 5000 });
  const promise = client.listTools();

  vi.advanceTimersByTime(1100); // Past 1000ms timeout

  await expect(promise).rejects.toThrow('timeout');

  vi.useRealTimers();
});
```

#### State Machine Testing
```typescript
it('should transition through connection states correctly', async () => {
  const states: MCPConnectionState[] = [];

  manager.on('stateChange', (_, prev, next) => states.push(next));

  await manager.connect('test-server');
  // Simulate disconnect
  mockTransport.simulateDisconnection();
  // Wait for reconnection
  await vi.advanceTimersByTimeAsync(1000);

  expect(states).toEqual(['connecting', 'connected', 'disconnected', 'reconnecting', 'connected']);
});
```

### 7. Coverage Requirements

Target coverage metrics:
- **Line Coverage**: ≥ 85%
- **Branch Coverage**: ≥ 80%
- **Function Coverage**: ≥ 90%

Critical paths requiring 100% coverage:
- Connection lifecycle (connect/disconnect/reconnect)
- Tool execution flow
- Error handling paths
- Event emission

## Consequences

### Positive

1. **Comprehensive Test Coverage**: Three-tier strategy ensures testing at appropriate abstraction levels
2. **Reusable Mock Infrastructure**: `MockMCPServer` and `MockMCPTransport` enable consistent testing across the codebase
3. **Event-Driven Testing**: Validates asynchronous behavior critical for MCP integration
4. **Error Resilience**: Dedicated error simulation enables robust error handling validation
5. **Documentation Through Tests**: Well-structured tests serve as usage documentation

### Negative

1. **Maintenance Overhead**: Mock infrastructure requires maintenance as MCP protocol evolves
2. **Test Complexity**: Event-driven and async testing requires careful handling of timing
3. **Mock Drift**: Risk of mocks diverging from real MCP server behavior over time

### Mitigation

1. Keep mock behavior minimal and focused on interface contracts
2. Use TypeScript types to enforce mock/implementation alignment
3. Consider periodic validation against real MCP servers in CI
4. Document mock behavior assumptions explicitly

## Implementation Plan

### Phase 1: Mock Infrastructure (Immediate)
1. Create `MockMCPServer` class
2. Create `MockMCPTransport` class
3. Define standard mock tool definitions
4. Create test fixtures

### Phase 2: Unit Tests (Week 1)
1. MCPConnectionManager unit tests
2. MCPToolRegistry unit tests
3. Enhance existing MCPClient tests

### Phase 3: Integration Tests (Week 2)
1. Server connection integration tests
2. Tool invocation integration tests
3. Error recovery integration tests

### Phase 4: Coverage & Polish (Week 3)
1. Review coverage reports
2. Add tests for uncovered paths
3. Document testing patterns
4. Update CI configuration

## References

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Vitest Documentation](https://vitest.dev/)
- Existing test files:
  - `packages/orchestrator/src/mcp/connection-manager.test.ts`
  - `packages/orchestrator/src/mcp/client.test.ts`
  - `packages/orchestrator/src/mcp-tool-registry.test.ts`
  - `packages/orchestrator/src/__tests__/mcp-mock-server-integration.test.ts`
