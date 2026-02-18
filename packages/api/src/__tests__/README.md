# API Integration Test Infrastructure

This directory contains the integration test infrastructure for the APEX API package, providing utilities for testing Fastify applications, WebSocket connections, and database interactions.

## Overview

The test infrastructure includes:

- **Test Setup Utilities** (`setup.ts`) - Core testing infrastructure
- **Integration Example** (`integration-example.test.ts`) - Comprehensive usage examples
- **WebSocket Test Helpers** - Utilities for testing real-time functionality
- **Mock Data Generators** - Consistent test data creation
- **Database Test Utilities** - Test database management

## Quick Start

### Basic Test Setup

```typescript
import { createTestEnvironment } from './setup.js';

describe('My API Tests', () => {
  let testEnv: Awaited<ReturnType<typeof createTestEnvironment>>;

  beforeEach(async () => {
    testEnv = await createTestEnvironment({
      silent: true, // Disable logging during tests
    });
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('should test something', async () => {
    // Your test code here
  });
});
```

### HTTP API Testing

```typescript
// Create a task
const response = await testEnv.httpUtils.createTask('Test task', {
  acceptanceCriteria: 'Should work',
  workflow: 'default',
});

// List tasks
const listResponse = await testEnv.httpUtils.listTasks();

// Get health status
const healthResponse = await testEnv.httpUtils.getHealth();
```

### WebSocket Testing

```typescript
// Task-specific WebSocket
const wsClient = testEnv.createWebSocketClient(taskId);
await wsClient.waitForConnection();

// Listen for specific events
const message = await wsClient.waitForMessage('task:state');

// Global WebSocket
const globalWs = testEnv.createGlobalWebSocketClient();
await globalWs.waitForConnection();

// Event filtering
const filteredWs = testEnv.createWebSocketClient(taskId, ['tool:start', 'tool:complete']);
```

### Mock Data Generation

```typescript
import { TestDataGenerators } from './setup.js';

// Create mock task
const task = TestDataGenerators.createMockTask({
  description: 'Custom test task',
  status: 'in-progress',
});

// Create mock health metrics
const metrics = TestDataGenerators.createMockHealthMetrics({
  uptime: 3600000,
  taskCounts: { processed: 10, succeeded: 8, failed: 1, active: 1 },
});

// Create daemon state
const daemonState = TestDataGenerators.createHealthyDaemonState(12345, metrics);
```

### File System Utilities

```typescript
// Setup mock daemon files
await testEnv.fsUtils.setupDaemonFiles(9999, healthMetrics);

// Update health metrics
await testEnv.fsUtils.updateHealthMetrics(newMetrics);

// File paths
console.log(testEnv.fsUtils.pidFile);    // Path to daemon.pid
console.log(testEnv.fsUtils.stateFile);  // Path to daemon-state.json
console.log(testEnv.fsUtils.apexDir);    // Path to .apex directory
```

### Database Testing

```typescript
// Check if database exists
const exists = await testEnv.dbUtils.exists();

// Clean up database
await testEnv.dbUtils.cleanup();

// Database path
console.log(testEnv.dbUtils.dbPath);
```

## API Reference

### TestSetupConfig

Configuration options for test environment:

```typescript
interface TestSetupConfig {
  projectPath?: string;           // Custom project path (default: temp dir)
  port?: number;                  // Server port (default: 0 for dynamic)
  silent?: boolean;               // Disable logging (default: true)
  mockOrchestrator?: boolean;     // Use mock orchestrator (default: false)
  enableHealthMonitoring?: boolean; // Enable periodic health checks (default: false)
}
```

### TestContext

The main test environment object:

```typescript
interface TestContext {
  app: FastifyInstance;           // Fastify app instance
  tempDir: string;                // Temporary directory path
  serverPort: number;             // Actual server port
  projectPath: string;            // Project directory path
  apexDir: string;                // .apex directory path
  orchestrator: ApexOrchestrator; // Orchestrator instance
  cleanup: () => Promise<void>;   // Cleanup function
}
```

### WebSocketTestClient

WebSocket testing utilities:

```typescript
class WebSocketTestClient {
  // Connection management
  async waitForConnection(timeout?: number): Promise<void>
  close(): void
  get readyState(): number

  // Messaging
  async waitForMessage(type?: string, timeout?: number): Promise<any>
  send(data: any): void
  onMessage(type: string, handler: (message: any) => void): void

  // Message queue management
  getMessages(): any[]
  getMessagesByType(type: string): any[]
  clearMessages(): void
}
```

### HttpTestUtils

HTTP API testing utilities:

```typescript
class HttpTestUtils {
  async createTask(description: string, options?: any)
  async getTask(id: string)
  async listTasks(query?: any)
  async getDaemonHealth()
  async getHealth()
  async createTemplate(template: any)
  async listTemplates()
}
```

### TestDataGenerators

Mock data generation utilities:

```typescript
const TestDataGenerators = {
  createMockTask(overrides?: Partial<Task>): Task
  createMockHealthMetrics(overrides?: Partial<HealthMetrics>): HealthMetrics
  createHealthyDaemonState(pid?: number, healthMetrics?: HealthMetrics)
}
```

## Best Practices

### 1. Test Isolation

Each test should be isolated and not depend on other tests:

```typescript
beforeEach(async () => {
  testEnv = await createTestEnvironment();
});

afterEach(async () => {
  await testEnv.cleanup(); // Important: always cleanup
});
```

### 2. Resource Management

Always close WebSocket connections and cleanup resources:

```typescript
let wsClient: WebSocketTestClient;

afterEach(() => {
  if (wsClient) {
    wsClient.close();
  }
});
```

### 3. Async Operations

Use proper async/await patterns and timeouts:

```typescript
// Good: explicit timeout
const message = await wsClient.waitForMessage('task:state', 2000);

// Good: wait for conditions
await TestSetup.waitFor(() => someCondition(), 5000);
```

### 4. Error Handling

Test both success and error cases:

```typescript
it('should handle invalid requests', async () => {
  const response = await testEnv.app.inject({
    method: 'POST',
    url: '/tasks',
    payload: { /* invalid data */ },
  });

  expect(response.statusCode).toBe(400);
  const body = JSON.parse(response.body);
  expect(body).toHaveProperty('error');
});
```

### 5. Concurrent Testing

Test concurrent operations to verify thread safety:

```typescript
it('should handle concurrent requests', async () => {
  const promises = Array.from({ length: 5 }, (_, i) =>
    testEnv.httpUtils.createTask(`Task ${i}`)
  );

  const responses = await Promise.all(promises);
  responses.forEach(response => {
    expect(response.statusCode).toBe(201);
  });
});
```

## Test Categories

### Unit Tests
- Individual function/method testing
- Mock external dependencies
- Fast execution

### Integration Tests
- Component interaction testing
- Real database/WebSocket connections
- End-to-end workflows

### Performance Tests
- Load testing with multiple requests
- Memory usage validation
- Response time verification

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npx vitest integration-example.test.ts

# Run tests with debugging
npx vitest --inspect-brk
```

## Debugging Tests

### 1. Enable Logging

```typescript
const testEnv = await createTestEnvironment({
  silent: false, // Enable logging
});
```

### 2. Inspect WebSocket Messages

```typescript
wsClient.onMessage('*', (message) => {
  console.log('Received message:', message);
});
```

### 3. Database Inspection

```typescript
console.log('Database path:', testEnv.dbUtils.dbPath);
console.log('Database exists:', await testEnv.dbUtils.exists());
```

### 4. Use Debugger

```typescript
// Set breakpoints in your IDE or use:
debugger;
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Tests use dynamic ports (port: 0) to avoid conflicts
2. **Cleanup failures**: Always call `cleanup()` in `afterEach`
3. **WebSocket timeouts**: Increase timeout values for slow systems
4. **Database locks**: Ensure proper test isolation

### Performance Tips

1. Use `silent: true` in test configuration
2. Disable health monitoring during tests
3. Use appropriate timeouts (not too long, not too short)
4. Clean up resources promptly

## Contributing

When adding new test utilities:

1. Follow existing patterns and naming conventions
2. Add comprehensive JSDoc documentation
3. Include usage examples
4. Test the utilities themselves
5. Update this README

## Examples

See `integration-example.test.ts` for comprehensive examples covering:
- HTTP API testing
- WebSocket real-time communication
- Database operations
- Mock data generation
- Error handling
- Concurrent operations
- Resource cleanup