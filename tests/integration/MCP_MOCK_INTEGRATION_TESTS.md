# MCP Mock Integration Tests

This directory contains comprehensive integration tests demonstrating MCP mock usage patterns and serving as documentation for developers working with the APEX MCP mock infrastructure.

## Test Files

### 1. `mcp-mock-usage-demonstration.test.ts`

**Purpose**: Comprehensive test suite demonstrating MCP mock usage patterns.

**Features Demonstrated**:
- Basic request/response mocking with static responses
- Dynamic response handlers for complex tool behavior
- Preset-based mock server creation (filesystem, database, API)
- Error handling scenarios with simulation presets
- Connection lifecycle testing and management
- Orchestrator package integration patterns
- End-to-end workflow execution
- Documentation examples for getting started

**Key Test Suites**:
- 📋 Basic Request/Response Mocking
- ⚠️ Error Handling Scenarios
- 🔄 Connection Lifecycle Testing
- 🎯 Orchestrator Package Integration
- 📚 Documentation Examples

### 2. `mcp-orchestrator-mock-integration.test.ts`

**Purpose**: Focused integration tests specifically for orchestrator package usage with MCP mocks.

**Features Demonstrated**:
- Tool discovery and registry integration
- Task execution with mocked MCP tools
- Connection manager integration patterns
- Error handling and resilience testing
- Performance monitoring and metrics

**Key Test Suites**:
- 🔧 Tool Discovery and Registry Integration
- 📋 Task Execution with Mocked Tools
- ⚠️ Error Handling and Resilience
- 📊 Performance and Monitoring

### 3. `mcp-mock-usage-patterns.test.ts`

**Purpose**: Cookbook of usage patterns and best practices for MCP mocks.

**Features Demonstrated**:
- Simple tool testing patterns
- Preset-based configuration examples
- State management in mocks
- Error simulation strategies
- Performance testing approaches
- Debugging and troubleshooting techniques

**Key Test Suites**:
- 🎯 Pattern: Simple Tool Testing
- 🏗️ Pattern: Preset-Based Configuration
- ⚡ Pattern: State Management
- 🔧 Pattern: Error Simulation
- 🏎️ Pattern: Performance Testing
- 🐛 Pattern: Debugging and Troubleshooting

## Usage Patterns Demonstrated

### Basic Tool Mocking

```typescript
await withMockMCPFacade(
  builder => builder
    .withName('simple')
    .withTool('ping').withStaticResponse([{ type: 'text', text: 'pong' }]),
  async (facade) => {
    const transport = facade.getTransport();
    await transport.connect();

    const response = await transport.request('tools/call', {
      name: 'ping',
      arguments: {}
    });

    expect(response.content[0].text).toBe('pong');
  }
);
```

### Dynamic Response Handlers

```typescript
await withMockMCPFacade(
  builder => builder
    .withName('calculator')
    .withTool('calculate')
      .withDynamicHandler(async (toolName, args) => {
        const result = args.a + args.b;
        return {
          content: [{ type: 'text', text: `Result: ${result}` }],
          isError: false
        };
      }),
  async (facade) => {
    // Test dynamic calculations
  }
);
```

### Preset-Based Servers

```typescript
// Filesystem preset
const server = createFileSystemMockServer('fs-demo', {
  files: {
    '/project/README.md': 'Project documentation',
    '/project/package.json': JSON.stringify({ name: 'demo' })
  }
});

// Database preset
const dbServer = createDatabaseMockServer('db-demo', {
  tables: {
    users: [
      { id: 1, name: 'Alice', email: 'alice@example.com' }
    ]
  }
});
```

### Error Simulation

```typescript
await withMockMCP(
  builder => builder
    .withName('error-demo')
    .withTool('flaky_operation')
      .withStaticResponse([{ type: 'text', text: 'Success' }])
    .withErrorSimulation(ERROR_SIMULATION_PRESETS.INTERMITTENT_FAILURES),
  async (server) => {
    // Test retry logic with intermittent failures
  }
);
```

### Orchestrator Integration

```typescript
// Create orchestrator with test config
orchestrator = new ApexOrchestrator({
  projectPath: '/test/project',
  config: testConfig,
  agentApiKey: 'test-key'
});

// Mock tool execution through orchestrator
const result = await connectionManager.executeTool(
  'test-server',
  'analyze_code',
  { filepath: '/src/main.ts' }
);
```

## Running the Tests

These integration tests are part of the project's comprehensive test suite. They can be run using:

```bash
# Run all integration tests
npm test tests/integration/

# Run specific MCP mock tests
npm test -- --grep "MCP Mock"

# Run with verbose output
npm test tests/integration/mcp-*.test.ts -- --verbose
```

## Test Coverage

These tests provide comprehensive coverage of:

✅ **Basic Request/Response Mocking**
- Static responses
- Dynamic handlers
- Parameter validation
- Response transformation

✅ **Error Handling Scenarios**
- Connection failures
- Tool execution errors
- Malformed responses
- Timeout simulation
- Intermittent failures

✅ **Connection Lifecycle Testing**
- Multi-client connections
- Disconnection/reconnection
- Health checks
- State management

✅ **Orchestrator Integration**
- Tool discovery
- Registry integration
- Task execution
- Metrics tracking

✅ **Usage Documentation**
- Getting started examples
- Advanced configuration
- Best practices
- Troubleshooting guides

## Best Practices Demonstrated

1. **Use appropriate wrapper functions**:
   - `withMockMCPFacade()` for single-client scenarios
   - `withMockMCP()` for multi-client or advanced scenarios

2. **Leverage preset factories** for common tool categories:
   - `createFileSystemMockServer()` for file operations
   - `createDatabaseMockServer()` for data queries
   - `createApiMockServer()` for HTTP requests

3. **Implement proper error handling**:
   - Use error simulation presets
   - Test retry logic
   - Validate error propagation

4. **Ensure test isolation**:
   - Reset state between tests
   - Use proper cleanup patterns
   - Mock dependencies appropriately

5. **Track tool interactions**:
   - Use assertion helpers
   - Monitor performance metrics
   - Log for debugging

## Contributing

When adding new MCP mock integration tests:

1. Follow the established patterns in these files
2. Add comprehensive documentation
3. Include both success and failure scenarios
4. Demonstrate real-world usage patterns
5. Update this README with new patterns

These tests serve as both validation and living documentation for the MCP mock infrastructure.