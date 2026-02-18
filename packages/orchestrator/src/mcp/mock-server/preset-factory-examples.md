# Preset-Based Mock MCP Server Factory Examples

This document provides examples of using the `createMockMCPServer()` factory function and related preset functionality.

## Basic Usage

### Creating a Filesystem Mock Server

```typescript
import { createMockMCPServer } from '@apexcli/orchestrator/mcp/mock-server';
import { MCPClient } from '@apexcli/orchestrator/mcp';

// Create a filesystem server with default file operations
const server = createMockMCPServer('filesystem');

// Use with MCPClient
const client = new MCPClient({ transport: server.getTransport() });
await client.connect();

// List available tools
const tools = await client.listTools();
console.log('Available tools:', tools.tools.map(t => t.name));
// Output: ['read_file', 'write_file', 'list_directory', 'delete_file', 'create_directory']

// Call a tool
const result = await client.callTool('read_file', { path: '/example.txt' });
console.log('File content:', result.content[0].text);
```

### Creating a Database Mock Server

```typescript
// Create a database server with common SQL operations
const dbServer = createMockMCPServer('database');

await dbServer.start();
const transport = dbServer.getTransport();
await transport.connect();

// Test database operations
const queryResult = await transport.send({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'query',
    arguments: { sql: 'SELECT * FROM users' }
  }
});

console.log('Query result:', JSON.parse(queryResult.result.content[0].text));
// Output: { rows: [...], count: 2 }
```

### Creating an API Mock Server

```typescript
// Create an API server with HTTP operations
const apiServer = createMockMCPServer('api');

await apiServer.start();
const transport = apiServer.getTransport();
await transport.connect();

// Test HTTP operations
const getResult = await transport.send({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'http_get',
    arguments: { url: 'https://api.example.com/users' }
  }
});

console.log('HTTP GET result:', JSON.parse(getResult.result.content[0].text));
// Output: { status: 200, body: { message: 'GET request successful', data: { id: 1 } } }
```

## Behavior Modifiers

### Slow Server for Timeout Testing

```typescript
// Combine filesystem preset with slow behavior
const slowServer = createMockMCPServer(['filesystem', 'slow']);

await slowServer.start();
const transport = slowServer.getTransport();
await transport.connect();

// Requests will take 500-2000ms to respond
const startTime = Date.now();
await transport.send({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
});
const duration = Date.now() - startTime;
console.log(`Request took ${duration}ms`); // Expected: 500-2000ms
```

### Error-Prone Server for Resilience Testing

```typescript
// Combine database preset with error-prone behavior
const errorServer = createMockMCPServer(['database', 'error-prone']);

await errorServer.start();
const transport = errorServer.getTransport();
await transport.connect();

// 30% of requests will fail
let errorCount = 0;
const totalRequests = 10;

for (let i = 0; i < totalRequests; i++) {
  try {
    await transport.send({
      jsonrpc: '2.0',
      id: i + 1,
      method: 'tools/call',
      params: { name: 'query', arguments: { sql: 'SELECT * FROM users' } }
    });
  } catch (error) {
    errorCount++;
  }
}

console.log(`${errorCount}/${totalRequests} requests failed`);
// Expected: ~3 errors out of 10 requests
```

## Customization Options

### Custom Server Name and Additional Tools

```typescript
const customServer = createMockMCPServer('filesystem', {
  name: 'custom-fs-server',
  description: 'Custom filesystem server for testing',
  additionalTools: [
    {
      toolName: 'backup',
      response: {
        content: [{ type: 'text', text: 'Backup completed successfully' }],
        isError: false,
      },
      priority: 50,
    },
    {
      toolName: 'restore',
      response: {
        content: [{ type: 'text', text: 'Restore completed successfully' }],
        isError: false,
      },
      priority: 50,
    },
  ],
});

// Server now has filesystem tools plus backup and restore
const tools = await client.listTools();
console.log('Tools:', tools.tools.map(t => t.name));
// Output: ['read_file', 'write_file', 'list_directory', 'delete_file', 'create_directory', 'backup', 'restore']
```

### Overriding Tool Responses

```typescript
const serverWithOverrides = createMockMCPServer('filesystem', {
  toolOverrides: {
    read_file: {
      response: {
        content: [{ type: 'text', text: 'Custom file content from override' }],
        isError: false,
      },
    },
  },
});

// read_file tool now returns custom content
const result = await client.callTool('read_file', { path: '/any-file.txt' });
console.log(result.content[0].text); // "Custom file content from override"
```

### Custom Delay Configuration

```typescript
// Fixed delay
const fixedDelayServer = createMockMCPServer('minimal', {
  delay: 100, // 100ms fixed delay
});

// Variable delay range
const variableDelayServer = createMockMCPServer('api', {
  delay: { min: 50, max: 200 }, // 50-200ms variable delay
});
```

### Error Simulation

```typescript
// Always fail mode
const alwaysFailServer = createMockMCPServer('filesystem', {
  errorSimulation: {
    mode: 'always_fail',
    category: 'jsonrpc',
    customError: {
      code: -32001,
      message: 'Service temporarily unavailable',
    },
    affectedClients: 'all',
  },
});

// Fail first N requests
const failFirstNServer = createMockMCPServer('database', {
  errorSimulation: {
    mode: 'fail_first_n',
    failCount: 3,
    category: 'jsonrpc',
    customError: {
      code: -32603,
      message: 'Service initializing, please retry',
    },
    affectedClients: 'all',
  },
});

// Sequence-based errors
const sequenceErrorServer = createMockMCPServer('api', {
  errorSimulation: {
    mode: 'sequence',
    sequence: [
      { outcome: 'error', error: { code: -32001, message: 'First error' } },
      { outcome: 'success' },
      { outcome: 'error', error: { code: -32002, message: 'Second error' } },
      { outcome: 'success' },
    ],
    affectedClients: 'all',
  },
});
```

### Error Presets

```typescript
// Apply predefined error scenarios
const timeoutServer = createMockMCPServer('filesystem', {
  errorPreset: 'request_timeout',
});

const authFailureServer = createMockMCPServer('api', {
  errorPreset: 'auth_failure',
});

const rateLimitServer = createMockMCPServer('database', {
  errorPreset: 'rate_limit',
});
```

### Scenarios for Dynamic Testing

```typescript
const scenarioServer = createMockMCPServer('filesystem', {
  scenarios: [
    {
      name: 'maintenance-mode',
      behaviorPreset: 'error-prone',
      errorPreset: 'service_unavailable',
    },
    {
      name: 'slow-network',
      behaviorPreset: 'slow',
    },
  ],
});

// Switch to maintenance mode during test
scenarioServer.activateScenario('maintenance-mode');

// Switch to slow network simulation
scenarioServer.activateScenario('slow-network');

// Reset to default behavior
scenarioServer.resetToDefault();
```

## Convenience Functions

### Specialized Factory Functions

```typescript
import {
  createFileSystemMockServer,
  createDatabaseMockServer,
  createApiMockServer,
  createMinimalMockServer,
} from '@apexcli/orchestrator/mcp/mock-server';

// These are equivalent to the corresponding createMockMCPServer() calls
const fsServer = createFileSystemMockServer({ name: 'test-fs' });
const dbServer = createDatabaseMockServer({ name: 'test-db' });
const apiServer = createApiMockServer({ name: 'test-api' });
const minimalServer = createMinimalMockServer({ name: 'test-minimal' });
```

## Testing Examples

### Integration Test

```typescript
describe('MCP Client Integration', () => {
  let server: MockMCPServerFacade;
  let client: MCPClient;

  beforeEach(async () => {
    server = createMockMCPServer('filesystem');
    await server.start();
    client = new MCPClient({ transport: server.getTransport() });
    await client.connect();
  });

  afterEach(async () => {
    await client.disconnect();
    await server.stop();
  });

  it('should handle file operations', async () => {
    // List tools
    const tools = await client.listTools();
    expect(tools.tools.map(t => t.name)).toContain('read_file');

    // Call read_file tool
    const result = await client.callTool('read_file', { path: '/test.txt' });
    expect(result.content[0].text).toContain('Mock file content');

    // Verify interactions
    server.assertToolCalled('read_file', 1);
    server.assertMethodCalled('tools/list', 1);
  });
});
```

### Error Handling Test

```typescript
describe('Error Handling', () => {
  it('should handle server errors gracefully', async () => {
    const errorServer = createMockMCPServer(['filesystem', 'error-prone']);
    await errorServer.start();

    const client = new MCPClient({ transport: errorServer.getTransport() });
    await client.connect();

    // Make multiple requests and expect some to fail
    let errorCount = 0;
    const requests = Array.from({ length: 10 }, (_, i) =>
      client.callTool('read_file', { path: `/test${i}.txt` })
        .catch(() => errorCount++)
    );

    await Promise.allSettled(requests);
    expect(errorCount).toBeGreaterThan(0); // Some requests should fail
  });
});
```

### Timeout Test

```typescript
describe('Timeout Handling', () => {
  it('should handle slow servers', async () => {
    const slowServer = createMockMCPServer(['minimal', 'slow']);
    await slowServer.start();

    const client = new MCPClient({
      transport: slowServer.getTransport(),
      requestTimeout: 1000, // 1 second timeout
    });
    await client.connect();

    // This should take longer than 1 second and timeout
    await expect(
      client.listTools()
    ).rejects.toThrow(/timeout/i);
  });
});
```

## Advanced Usage

### Custom Complex Server

```typescript
const complexServer = createMockMCPServer(['filesystem', 'slow'], {
  name: 'integration-test-server',
  description: 'Complex server for integration testing',

  // Add custom tools
  additionalTools: [
    {
      toolName: 'analyze_file',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({
            lines: 42,
            characters: 1337,
            language: 'typescript'
          })
        }],
        isError: false,
      },
      priority: 50,
    },
  ],

  // Override existing tools
  toolOverrides: {
    read_file: {
      response: {
        content: [{
          type: 'text',
          text: '// This is a TypeScript file\nexport default "hello";'
        }],
        isError: false,
      },
    },
  },

  // Custom capabilities
  capabilities: {
    tools: { listChanged: true },
    resources: { subscribe: true },
    prompts: {},
  },

  // Add scenarios
  scenarios: [
    {
      name: 'disk-full',
      behaviorPreset: 'error-prone',
      errorPreset: 'resource_exhausted',
    },
    {
      name: 'network-partition',
      errorPreset: 'connection_lost',
    },
  ],

  // Custom transport settings
  transport: 'stdio',
  autoStart: true,
  maxConnections: 5,
  shutdownTimeoutMs: 3000,
});

// Use in complex integration test
await complexServer.start();
const client = new MCPClient({ transport: complexServer.getTransport() });
await client.connect();

// Test normal operation
let tools = await client.listTools();
expect(tools.tools.map(t => t.name)).toContain('analyze_file');

// Switch to error scenario
complexServer.activateScenario('disk-full');
await expect(client.callTool('write_file', { path: '/test.txt', content: 'data' }))
  .rejects.toThrow();

// Switch to network partition scenario
complexServer.activateScenario('network-partition');
await expect(client.listTools()).rejects.toThrow();
```

This factory system provides a powerful yet simple way to create mock MCP servers for testing, with sensible defaults and extensive customization options.