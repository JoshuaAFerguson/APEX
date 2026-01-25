# Mock MCP Server Implementation

This directory contains a comprehensive mock MCP server implementation for testing MCP client interactions without requiring real MCP servers.

## Components

### Core Classes

- **`MockMCPServer`** - Full multi-client server with connection lifecycle management
- **`MockMCPServerFacade`** - Single-client convenience API for testing
- **`MockTransport`** - In-process transport implementation for testing
- **`MockBehaviorEngine`** - Configurable behavior simulation (delays, errors, state machines)
- **`MockMCPProtocolHandler`** - MCP protocol routing and lifecycle management

### Factory Functions

- **`createSimpleMockServer()`** - Quick setup for basic testing
- **`createErrorMockServer()`** - Pre-configured for error injection testing
- **`createSlowMockServer()`** - Pre-configured for latency/timeout testing

## Features

### ✅ Configurable Responses
- Define tool handlers with specific responses
- Support conditional responses based on arguments
- Configure response delays and jitter

### ✅ Error Simulation
- Probabilistic error injection
- Method-specific error configuration
- Connection failure simulation
- Custom error codes and messages

### ✅ Connection Lifecycle Management
- Start/stop server lifecycle
- Client connection tracking
- Multi-client support with connection limits
- Graceful shutdown with timeout

### ✅ Testing Utilities
- Request history recording
- Assertion helpers for test verification
- Usage statistics and analytics
- State machine support for complex scenarios

### ✅ Protocol Support
- Full MCP protocol implementation
- JSON-RPC 2.0 compliant
- Supports tools, resources, and prompts
- Notification and event handling

## Usage Examples

### Basic Usage

```typescript
import { createSimpleMockServer } from '@apexcli/orchestrator';

// Create a mock server with tool handlers
const server = createSimpleMockServer('test-server', [
  {
    toolName: 'read_file',
    response: {
      content: [{ type: 'text', text: 'mock file content' }],
      isError: false,
    },
  },
]);

// Start the server
await server.start();

// Get transport for use with MCP client
const transport = server.getTransport();

// Connect client
await transport.connect();

// Use with MCP client...
// const client = new MCPClient({ transport });

// Clean up
await server.stop();
```

### Error Testing

```typescript
import { createErrorMockServer } from '@apexcli/orchestrator';

const server = createErrorMockServer('error-server', {
  enabled: true,
  probability: 0.3, // 30% error rate
  errorCode: -32603,
  errorMessage: 'Simulated server error',
});

await server.start();
// Test error handling...
```

### Scenario-Based Testing

```typescript
import { MockMCPServerFacade } from '@apexcli/orchestrator';

const server = new MockMCPServerFacade({
  serverConfig: { /* ... */ },
  defaultBehavior: { /* ... */ },
  scenarios: [
    {
      name: 'database-error',
      behaviorConfig: {
        errorInjection: { enabled: true, probability: 1.0 },
      },
    },
    {
      name: 'high-latency',
      behaviorConfig: {
        responseDelay: { minMs: 500, maxMs: 2000 },
      },
    },
  ],
});

// Switch scenarios during testing
server.activateScenario('database-error');
// Test error handling...

server.activateScenario('high-latency');
// Test timeout handling...

server.resetToDefault();
// Back to normal behavior...
```

### Assertions and Verification

```typescript
// Assert specific interactions occurred
server.assertMethodCalled('tools/list', 1);
server.assertToolCalled('read_file', 2);
server.assertInitialized();

// Get request history for detailed inspection
const history = server.getRequestHistory();
const toolCalls = server.getToolCalls('read_file');

// Get usage statistics
const stats = server.getStats();
console.log(`Total requests: ${stats.totalRequests}`);
console.log(`Errors injected: ${stats.totalErrorsInjected}`);
```

## Architecture

The mock server is built with a layered architecture:

1. **Transport Layer** (`MockTransport`) - Handles connection simulation
2. **Protocol Layer** (`MockMCPProtocolHandler`) - Routes MCP messages
3. **Behavior Layer** (`MockBehaviorEngine`) - Applies delays, errors, state
4. **Server Layer** (`MockMCPServer`/`MockMCPServerFacade`) - Orchestrates everything

This design ensures:
- Clean separation of concerns
- Testable individual components
- Configurable behavior at each layer
- Support for both simple and complex test scenarios

## Integration

The mock server components are exported from the main orchestrator package:

```typescript
import {
  MockMCPServer,
  MockMCPServerFacade,
  createSimpleMockServer,
  createErrorMockServer,
  createSlowMockServer,
  MockAssertionError,
  type MockServerStats,
  // ... other types
} from '@apexcli/orchestrator';
```

## Testing

Comprehensive integration tests are provided in:
- `__tests__/mock-mcp-integration.test.ts` - Full integration testing
- `mcp/mock-server/*.test.ts` - Component-level unit tests

The tests verify all acceptance criteria:
1. ✅ Mock MCP server implementation that can simulate MCP protocol responses
2. ✅ Supports configurable responses, error simulation, and connection lifecycle
3. ✅ Can be used to test MCP client interactions without real servers

## Implementation Status

All acceptance criteria have been met:

✅ **Mock MCP server implementation** - Complete with full protocol support
✅ **Configurable responses** - Tool handlers, conditional responses, delays
✅ **Error simulation** - Probabilistic injection, custom errors, connection failures
✅ **Connection lifecycle** - Start/stop, multi-client, graceful shutdown
✅ **Client testing support** - Assertion helpers, history, statistics

The implementation provides a comprehensive testing infrastructure for MCP client development and integration testing.