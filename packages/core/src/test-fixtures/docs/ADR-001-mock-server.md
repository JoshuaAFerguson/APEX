# ADR-001: MockServer Class for HTTP Testing

## Status
Proposed

## Date
2024-12-XX

## Context

APEX's test infrastructure currently has comprehensive setup utilities in `@apexcli/api/src/__tests__/setup.ts` that couple Fastify server creation with ApexOrchestrator initialization. This works well for integration testing of the API package but has limitations:

1. **Package Coupling**: Tests in `@apexcli/core` cannot easily create mock HTTP servers without depending on `@apexcli/api` and `@apexcli/orchestrator`
2. **Weight**: Full API server setup requires database initialization, orchestrator creation, and file system setup
3. **Flexibility**: Testing scenarios like MCP server mocking, webhook endpoints, or simple HTTP response mocking require a lighter-weight solution
4. **Port Management**: No centralized approach to dynamic port allocation with cleanup guarantees

We need a lightweight, reusable MockServer class in `@apexcli/core/test-fixtures` that can:
- Wrap Fastify for programmatic server lifecycle
- Support dynamic port allocation
- Provide clean start/stop semantics
- Be used across all packages without heavy dependencies

## Decision

### Create MockServer Class in @apexcli/core/test-fixtures

The MockServer class will:

1. **Wrap Fastify** - Use Fastify as the underlying HTTP server (consistent with existing API architecture)
2. **Support Dynamic Ports** - Automatically find an available port when starting with port 0
3. **Provide Clean Lifecycle** - `start()`, `stop()`, `getUrl()` methods with proper async handling
4. **Be Lightweight** - No dependencies on orchestrator, database, or project initialization
5. **Support Route Registration** - Allow adding routes before or after server start for flexibility

### Interface Design

```typescript
/**
 * Configuration options for MockServer
 */
export interface MockServerOptions {
  /** Port number (0 for dynamic allocation) */
  port?: number;
  /** Host to bind to (default: '127.0.0.1') */
  host?: string;
  /** Disable Fastify logging (default: true in test environments) */
  silent?: boolean;
  /** Logger instance for custom logging */
  logger?: boolean | object;
}

/**
 * MockServer class for HTTP testing
 * Wraps Fastify for programmatic test server management
 */
export class MockServer {
  /**
   * Create a new MockServer instance
   */
  constructor(options?: MockServerOptions);

  /**
   * Get the underlying Fastify instance for route registration
   */
  get app(): FastifyInstance;

  /**
   * Check if the server is currently running
   */
  get isRunning(): boolean;

  /**
   * Start the server and listen on the configured port
   * Returns the actual port being used (useful for dynamic allocation)
   */
  start(): Promise<number>;

  /**
   * Stop the server and release resources
   */
  stop(): Promise<void>;

  /**
   * Get the full URL of the running server (e.g., 'http://127.0.0.1:3456')
   * Throws if server is not running
   */
  getUrl(): string;

  /**
   * Get the port the server is listening on
   * Throws if server is not running
   */
  getPort(): number;

  /**
   * Register a route handler (convenience method)
   */
  route(options: RouteOptions): this;

  /**
   * Add a GET route (convenience method)
   */
  get(path: string, handler: RouteHandler): this;

  /**
   * Add a POST route (convenience method)
   */
  post(path: string, handler: RouteHandler): this;

  /**
   * Add a health check route at /health (common pattern)
   */
  withHealthCheck(): this;

  /**
   * Create a fresh MockServer for testing (factory method)
   */
  static create(options?: MockServerOptions): MockServer;
}
```

### File Structure

```
packages/core/src/test-fixtures/
├── mock-server.ts          # MockServer class implementation
├── mock-server.types.ts    # Type definitions (optional, can be inline)
├── __tests__/
│   └── mock-server.test.ts # Unit tests for MockServer
└── docs/
    └── ADR-001-mock-server.md  # This document
```

### Dependencies

The MockServer will have minimal dependencies:
- `fastify` - Already a dependency in `@apexcli/api` but will be added as an optional peer dependency or dev dependency in `@apexcli/core`
- No runtime production dependencies are added to core

**Dependency Strategy Options:**
1. **Add fastify as devDependency in @apexcli/core** - Simple, keeps test-fixtures isolated
2. **Import from @apexcli/api** - Reuses existing dependency but creates package coupling
3. **Make fastify a peerDependency** - Consumers must have fastify, clear contract

**Recommendation**: Option 1 - Add `fastify` as a devDependency in `@apexcli/core` since the test-fixtures module is specifically for testing purposes.

## Consequences

### Positive

1. **Decoupled Testing** - Core package tests can create mock servers without API/orchestrator dependencies
2. **Lightweight** - Simple class that does one thing well
3. **Consistent Patterns** - Uses Fastify, matching the production API architecture
4. **Dynamic Ports** - Avoids port conflicts in parallel test execution
5. **Clean Lifecycle** - Proper async start/stop with guaranteed cleanup
6. **Extensible** - Full Fastify instance access allows any route configuration

### Negative

1. **New Dependency** - Adds fastify as a devDependency to core (acceptable for test utilities)
2. **Duplication** - Some overlap with existing API test setup, but serves different purpose
3. **Maintenance** - Another class to maintain, though it's simple and stable

### Neutral

1. **Migration** - Existing tests can adopt gradually; no breaking changes required
2. **Learning** - Developers familiar with Fastify will find this intuitive

## Implementation Notes

### Error Handling

The MockServer should provide clear error messages for common scenarios:
- Starting when already started
- Stopping when not started
- Getting URL/port when not running
- Port binding failures

### Thread Safety

While JavaScript is single-threaded, the async nature of start/stop requires careful handling:
- Use a state flag to track running status
- Prevent double-start and double-stop
- Ensure cleanup on stop even if routes fail

### Integration with Test Fixtures

The MockServer should integrate with the existing test-fixtures infrastructure:

```typescript
// Usage example
import { MockServer, createTestSuite } from '@apexcli/core/test-fixtures';

describe('My API Client', () => {
  let server: MockServer;

  beforeEach(async () => {
    server = MockServer.create();
    server.get('/api/data', async () => ({ status: 'ok' }));
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('fetches data from API', async () => {
    const response = await fetch(`${server.getUrl()}/api/data`);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
```

### Future Enhancements (Out of Scope for Initial Implementation)

1. **Request Recording** - Capture incoming requests for assertion
2. **Response Mocking** - Dynamic response based on request patterns
3. **Network Delay Simulation** - Configurable response delays
4. **WebSocket Support** - Mock WebSocket endpoints
5. **HTTPS Support** - Self-signed certificates for TLS testing

## References

- Existing API test setup: `packages/api/src/__tests__/setup.ts`
- Fastify documentation: https://www.fastify.io/
- Test fixture types: `packages/core/src/test-fixtures/types.ts`
- Setup-teardown patterns: `packages/core/src/test-fixtures/setup-teardown.ts`
