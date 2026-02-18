# ADR-004: MCP Testing Architecture

## Status
**Accepted**

## Date
2025-01-19

## Context

APEX integrates with MCP (Model Context Protocol) servers to extend Claude Agent SDK capabilities with external tools. This integration requires comprehensive testing to ensure:

1. **MCPConnectionManager** properly manages server connections, health monitoring, and reconnection
2. **MCPToolRegistry** correctly discovers, registers, and provides tools to Claude agents
3. **Integration flows** work end-to-end (connect → discover tools → invoke tools → handle errors)
4. **Mock MCP servers** enable testing without real external servers

The existing codebase already has extensive test infrastructure that we need to document and organize.

## Decision

### Testing Architecture Layers

We adopt a **3-layer testing architecture** for MCP integration:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Integration Tests                                │
│  (End-to-end workflows, ApexOrchestrator + MCP, multi-server)       │
├─────────────────────────────────────────────────────────────────────┤
│                        Unit Tests                                    │
│  (MCPConnectionManager, MCPToolRegistry, MCPClient, SchemaTranslator)│
├─────────────────────────────────────────────────────────────────────┤
│                    Mock Infrastructure                               │
│  (MockMCPServer, MockScenarioBuilder, Predefined Server Templates)   │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer 1: Mock Infrastructure

**Location:** `packages/orchestrator/src/__tests__/utils/mock-mcp-server.ts`

The mock infrastructure provides:

1. **MockMCPServer class** (~600+ lines)
   - Full MCP server simulation with configurable behavior
   - Connection lifecycle (connect, disconnect, reconnection)
   - Tool discovery and execution
   - Built-in tool simulations (filesystem, database, monitoring)
   - Error injection and latency simulation
   - Statistics tracking

2. **Predefined Server Templates**
   - `filesystem`: File operations (scan, read, write)
   - `database`: Database backup and query
   - `monitoring`: System metrics, log analysis, health checks
   - `utilities`: Slow operations, error tools, timeout tools

3. **MockScenarioBuilder Pattern**
   ```typescript
   createTestScenario()
     .addServer('fs', 'filesystem')
     .addServer('db', 'database')
     .withSlowServer('db', 500)
     .withUnreliableServer('fs', 0.3)
     .build()
   ```

4. **Factory Functions**
   - `createMockServer(id, preset?, overrides?)`
   - `createMockConnection(serverId, state, serverName?, config?)`
   - `createMockClient(server)`

### Layer 2: Unit Tests

**Test Organization:**

| Component | Test Files | Coverage Focus |
|-----------|------------|----------------|
| MCPConnectionManager | 18+ test files | Connection lifecycle, health monitoring, reconnection, pool management, metrics |
| MCPToolRegistry | 7+ test files | Tool discovery, schema translation, availability tracking, auto-refresh |
| MCPClient | 3+ test files | Transport communication, protocol handling |
| SchemaTranslator | Included in registry tests | MCP → Claude SDK schema transformation |

**Test Categories:**

1. **Basic Tests** (`*.test.ts`)
   - Core functionality verification
   - Happy path scenarios
   - Basic error handling

2. **Edge Cases** (`*.edge-cases.test.ts`)
   - Boundary conditions
   - Race conditions
   - Error recovery

3. **Performance Tests** (`*.performance.test.ts`)
   - High volume operations
   - Concurrent connections
   - Memory efficiency

4. **Integration Tests** (`*.integration.test.ts`)
   - Component interaction
   - State synchronization
   - Event propagation

### Layer 3: Integration Tests

**End-to-End Workflows:**

| Test File | Coverage |
|-----------|----------|
| `mcp-mock-server-integration.test.ts` | Full workflow with mock servers |
| `mcp-connection-lifecycle.integration.test.ts` | Connection state transitions |
| `apex-orchestrator.mcp-integration.test.ts` | Orchestrator + MCP integration |
| `mcp-tool-invocation-routing.integration.test.ts` | Tool execution routing |
| `mcp-comprehensive-integration.test.ts` | Multi-server scenarios |

### Test File Naming Conventions

```
{component}.test.ts                          # Basic unit tests
{component}.{category}.test.ts               # Specialized tests
{component}.{category}.{subcategory}.test.ts # Highly specific tests
{feature}.integration.test.ts                # Integration tests
```

### Mock Patterns

**1. Transport Mocking:**
```typescript
vi.mock('./transports/index.js', () => ({
  StdioTransport: vi.fn().mockImplementation(() => createMockTransport()),
}));
```

**2. Client Mocking:**
```typescript
const createMockClient = (tools: MCPToolDefinition[] = []): MCPClient => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  listTools: vi.fn().mockResolvedValue(tools),
  callTool: vi.fn().mockImplementation((name, args) =>
    Promise.resolve({ result: `Called ${name}` })
  ),
  ping: vi.fn().mockResolvedValue(undefined),
});
```

**3. Scenario-Based Testing:**
```typescript
const scenario = createTestScenario()
  .addServer('primary', 'filesystem')
  .addServer('backup', 'filesystem')
  .withUnreliableServer('primary', 0.5)
  .build();

// Test failover behavior
```

### Event Testing

Both MCPConnectionManager and MCPToolRegistry emit events that should be tested:

**MCPConnectionManager Events:**
- `connected`, `disconnected`, `error`, `reconnecting`
- `healthCheck`, `stateChange`, `poolChange`
- `tool:start`, `tool:complete`, `tool:error`

**MCPToolRegistry Events:**
- `tool:registered`, `tool:unregistered`
- `registry:refreshed`
- `connection:added`, `connection:removed`
- `error`

### Test Coverage Requirements

| Area | Target | Rationale |
|------|--------|-----------|
| MCPConnectionManager | 85%+ | Critical infrastructure |
| MCPToolRegistry | 85%+ | Core tool management |
| MCPClient | 75%+ | Transport layer |
| Integration Tests | All acceptance criteria | End-to-end verification |

## Consequences

### Positive
- Comprehensive mock infrastructure enables isolated testing
- Predefined server templates reduce test boilerplate
- Scenario builder enables complex multi-server testing
- Clear test organization improves maintainability
- Event-driven testing validates async behavior

### Negative
- Large number of test files requires organization
- Mock complexity can diverge from real MCP behavior
- Integration tests require more setup time

### Risks Mitigated
- MCP protocol changes can be caught early
- Connection issues are discoverable in tests
- Tool invocation failures are predictable

## Compliance

This ADR addresses the acceptance criteria:
- ✅ Unit tests for MCPConnectionManager (18+ test files)
- ✅ Unit tests for MCPToolRegistry (7+ test files)
- ✅ Integration tests verifying MCP server connection and tool invocation
- ✅ Mock MCP server for testing (946-line implementation)

## References

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- Vitest Testing Framework
- APEX Core Types (`@apexcli/core`)
