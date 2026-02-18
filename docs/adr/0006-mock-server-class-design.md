# ADR-0006: MockServer Class Design for Testing

## Status
Accepted

## Context
The APEX API package requires a robust testing infrastructure that allows tests to spin up isolated HTTP servers on dynamic ports. The existing `createServer()` function and test setup utilities (`setup.ts`) provide a foundation, but we need a dedicated `MockServer` class that:

1. Wraps Fastify with a simple, test-friendly API
2. Supports programmatic start/stop lifecycle
3. Automatically selects available ports
4. Provides easy access to the server URL for test clients
5. Includes a health check route for connection verification

## Decision

### Class Design

Create a `MockServer` class in `packages/api/src/testing/MockServer.ts` with the following design:

```typescript
export interface MockServerOptions {
  silent?: boolean;           // Suppress logging (default: true)
  host?: string;              // Host to bind (default: '127.0.0.1')
  port?: number;              // Optional fixed port (default: 0 for dynamic)
}

export class MockServer {
  private app: FastifyInstance | null = null;
  private port: number = 0;
  private host: string = '127.0.0.1';

  constructor(options?: MockServerOptions);

  async start(): Promise<void>;
  async stop(): Promise<void>;
  getUrl(): string;
  getApp(): FastifyInstance;
  isRunning(): boolean;
}
```

### Key Design Decisions

1. **Standalone Fastify Instance**: The MockServer creates its own minimal Fastify instance rather than reusing `createServer()`. This ensures:
   - Fast startup (no ApexOrchestrator initialization overhead)
   - No side effects on the production server configuration
   - Predictable test behavior with minimal dependencies

2. **Dynamic Port Selection**: Use port `0` by default, letting the OS assign an available port. This prevents port conflicts in parallel test runs.

3. **Built-in Health Check**: Include a `/health` route that returns `{ status: 'ok' }` for connection verification.

4. **Explicit Lifecycle**: Require explicit `start()` and `stop()` calls rather than auto-starting in constructor. This gives tests full control over timing.

5. **Error Handling**:
   - `start()` throws if already running
   - `stop()` is idempotent (safe to call multiple times)
   - `getUrl()` throws if not running

6. **TypeScript Strict Mode**: Full type safety with strict null checks.

### File Location

```
packages/api/src/testing/
  MockServer.ts         # Main class implementation
  MockServer.test.ts    # Unit tests for MockServer
  index.ts              # Re-exports for clean imports
```

### Integration with Existing Infrastructure

The MockServer class will complement the existing test infrastructure:

- `setup.ts` - Remains the primary integration test setup (uses full ApexOrchestrator)
- `MockServer.ts` - Lightweight alternative for unit tests and mock scenarios

### Example Usage

```typescript
import { MockServer } from '@apexcli/api/testing';

describe('API Client', () => {
  let server: MockServer;

  beforeEach(async () => {
    server = new MockServer({ silent: true });
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('connects to server', async () => {
    const response = await fetch(`${server.getUrl()}/health`);
    expect(response.ok).toBe(true);
  });
});
```

## Consequences

### Positive
- Clean, testable API with explicit lifecycle management
- No port conflicts in parallel test execution
- Lightweight alternative to full integration setup
- Follows existing APEX code patterns and conventions
- Easy to extend with additional routes for mock scenarios

### Negative
- Adds a new abstraction layer (mitigated by clear documentation)
- Requires maintaining two test infrastructure approaches

### Neutral
- Tests using MockServer will need to handle async setup/teardown
- Dynamic ports mean tests cannot hardcode URLs (by design)

## Implementation Notes

1. **Dependencies**: Only Fastify (already in package.json)
2. **Export Strategy**: Export from `testing/index.ts` for clean imports
3. **Test Coverage**: Unit tests in `MockServer.test.ts` covering:
   - Start/stop lifecycle
   - Dynamic port allocation
   - Health check route
   - Error conditions (double start, stop without start, etc.)
   - URL retrieval

## Related ADRs
- None currently

## References
- Existing `packages/api/src/__tests__/setup.ts` for integration test patterns
- Fastify documentation: https://www.fastify.io/docs/latest/
