# ADR: API Package Integration Test Infrastructure

## Status
Proposed

## Context
The `@apexcli/api` package needs a comprehensive integration test infrastructure that:
1. Provides reusable test utilities for Fastify app initialization
2. Includes mock orchestrator to avoid SQLite/database issues in tests
3. Supports test database setup/teardown
4. Provides WebSocket client helpers for testing real-time functionality

### Current State
- Existing tests in `packages/api/src/` manually mock the orchestrator using `vi.mock()`
- Each test file creates its own temporary directory and config setup
- WebSocket tests manually handle connection/message helpers
- No centralized test utilities file exists for the API package

### Related Infrastructure
- `packages/orchestrator/src/test-utils.ts` - Comprehensive database utilities
- `packages/core/src/test-utils.ts` - Platform utilities, permission mocks
- `packages/cli/vitest.config.ts` + `src/__tests__/setup.ts` - Setup file pattern

## Decision

### Architecture Overview

Create a centralized test infrastructure at `packages/api/src/test-utils.ts` with four main components:

```
packages/api/src/test-utils.ts
├── TestServerContext (primary interface)
├── Mock Orchestrator Factory
├── Test Database Utilities
└── WebSocket Test Helpers
```

### 1. TestServerContext Interface

```typescript
export interface TestServerContext {
  /** The Fastify server instance */
  server: FastifyInstance;
  /** Mock orchestrator instance */
  orchestrator: MockOrchestrator;
  /** Temporary project directory */
  projectPath: string;
  /** Server port (dynamically assigned) */
  port: number;
  /** Cleanup function - call in afterEach */
  cleanup: () => Promise<void>;
}
```

### 2. Test Server Factory

```typescript
export interface CreateTestServerOptions {
  /** Override default mock orchestrator behavior */
  orchestratorOverrides?: Partial<MockOrchestratorOptions>;
  /** Custom server options */
  serverOptions?: Partial<ServerOptions>;
  /** Whether to start the server immediately */
  autoStart?: boolean;
}

export async function createTestServer(
  options?: CreateTestServerOptions
): Promise<TestServerContext>;
```

The factory will:
- Create a temporary directory with `.apex/config.yaml`
- Initialize a mock orchestrator with configurable behavior
- Create and optionally start the Fastify server
- Return context with cleanup function

### 3. Mock Orchestrator

```typescript
export interface MockOrchestratorOptions {
  /** Initial tasks to populate */
  initialTasks?: Partial<Task>[];
  /** Initial templates */
  initialTemplates?: Partial<TaskTemplate>[];
  /** Custom method implementations */
  methodOverrides?: Partial<MockOrchestratorMethods>;
  /** Emit events automatically for certain operations */
  autoEmitEvents?: boolean;
}

export class MockOrchestrator {
  // Task management
  tasks: Map<string, Task>;
  templates: Map<string, TaskTemplate>;

  // Event emitter for WebSocket testing
  private listeners: Map<string, Function[]>;

  // Standard orchestrator methods
  async createTask(options: CreateTaskOptions): Promise<Task>;
  async getTask(id: string): Promise<Task | null>;
  async listTasks(options?: ListTasksOptions): Promise<Task[]>;
  // ... all other ApexOrchestrator methods

  // Test helpers
  emit(event: string, ...args: unknown[]): void;
  simulateTaskProgress(taskId: string): Promise<void>;
  simulateTaskCompletion(taskId: string): Promise<void>;
  simulateTaskFailure(taskId: string, error: string): Promise<void>;
}
```

### 4. Test Database Utilities

Reuse and extend from `@apexcli/orchestrator` test-utils:

```typescript
// Re-export from orchestrator for convenience
export {
  createTestDatabase,
  cleanupTestDatabase,
  createMockTask,
  type TestDatabaseContext
} from '@apexcli/orchestrator/test-utils';

// API-specific database helpers
export interface APITestDatabaseContext extends TestDatabaseContext {
  /** Insert sample tasks for API testing */
  seedTasks(tasks: Partial<Task>[]): Promise<Task[]>;
  /** Insert sample templates */
  seedTemplates(templates: Partial<TaskTemplate>[]): Promise<TaskTemplate[]>;
}

export async function createAPITestDatabase(): Promise<APITestDatabaseContext>;
```

### 5. WebSocket Test Helpers

```typescript
export interface WebSocketTestClient {
  /** The WebSocket connection */
  ws: WebSocket;
  /** Received messages */
  messages: any[];
  /** Wait for connection to open */
  waitForOpen(timeout?: number): Promise<void>;
  /** Wait for a specific message type */
  waitForMessage(type: string, timeout?: number): Promise<any>;
  /** Wait for any message */
  waitForAnyMessage(timeout?: number): Promise<any>;
  /** Send a message */
  send(data: any): void;
  /** Close the connection */
  close(): void;
  /** Clear received messages */
  clearMessages(): void;
}

export function createWebSocketClient(
  url: string,
  options?: WebSocketClientOptions
): WebSocketTestClient;

export function createTaskStreamClient(
  port: number,
  taskId: string,
  options?: { events?: string[] }
): WebSocketTestClient;

export function createHealthStreamClient(
  port: number
): WebSocketTestClient;
```

### 6. Setup File Structure

Create `packages/api/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
    // ... coverage config
  },
});
```

Create `packages/api/src/__tests__/setup.ts`:
```typescript
import { vi, beforeAll, afterAll } from 'vitest';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.VITEST = '1';
process.env.DISABLE_HEALTH_MONITORING = '1';

// Global mocks that apply to all tests
vi.mock('@apexcli/orchestrator', async () => {
  const { MockOrchestrator } = await import('../test-utils.js');
  return {
    ApexOrchestrator: MockOrchestrator,
    DaemonManager: vi.fn().mockImplementation(() => ({
      getStatus: vi.fn().mockResolvedValue({ running: false }),
    })),
    HealthMonitor: vi.fn().mockImplementation(() => ({
      getHealthReport: vi.fn().mockReturnValue({
        uptime: 0,
        memoryUsage: { heapUsed: 0, heapTotal: 0, rss: 0 },
        taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 0,
        healthChecksFailed: 0,
        restartHistory: [],
      }),
      performHealthCheck: vi.fn(),
    })),
  };
});
```

### File Structure

```
packages/api/
├── vitest.config.ts           # Vitest configuration
├── src/
│   ├── test-utils.ts          # Main test utilities file
│   ├── __tests__/
│   │   ├── setup.ts           # Global test setup
│   │   ├── health-endpoint.test.ts
│   │   └── ...
│   └── ...
```

## Consequences

### Positive
1. **Consistency**: All API tests use the same mock orchestrator and setup patterns
2. **Maintainability**: Changes to mock behavior are centralized
3. **Reduced Duplication**: No need to repeat mock setup in each test file
4. **Better WebSocket Testing**: Dedicated helpers make async WebSocket testing reliable
5. **Integration with Existing Patterns**: Follows established patterns from orchestrator/core

### Negative
1. **Initial Setup Cost**: Requires creating new files and potentially refactoring existing tests
2. **Learning Curve**: Developers need to understand the test utilities API

### Neutral
1. **Dependency on Other Packages**: Reuses utilities from orchestrator, creating a soft dependency

## Implementation Notes

### Migration Path
1. Create `test-utils.ts` with core utilities
2. Create `vitest.config.ts` and setup file
3. Gradually migrate existing tests to use new utilities
4. Tests can continue using manual mocking during transition

### Key Patterns from Existing Tests
- Use `server.inject()` for HTTP testing (no actual HTTP server needed)
- Use `app.listen({ port: 0, host: '127.0.0.1' })` for WebSocket tests (dynamic port)
- Create temp directories with `fs.mkdtemp()` for isolation
- Always cleanup with `server.close()` and `fs.rm()` in afterEach

## References
- `packages/orchestrator/src/test-utils.ts` - Database test utilities
- `packages/core/src/test-utils.ts` - Platform and permission test utilities
- `packages/api/src/index.test.ts` - Current test patterns
- `packages/api/src/__tests__/health-websocket.test.ts` - WebSocket test patterns
