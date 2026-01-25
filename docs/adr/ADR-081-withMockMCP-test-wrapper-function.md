# ADR-081: withMockMCP() Test Wrapper Function

## Status
Proposed

## Context

The APEX codebase has a comprehensive MockMCPServer infrastructure for testing MCP client interactions. However, current test patterns require manual setup and cleanup of mock servers in `beforeEach` and `afterEach` hooks:

```typescript
describe('MockMCPServer', () => {
  let server: MockMCPServer;

  beforeEach(() => {
    server = new MockMCPServer(definition);
  });

  afterEach(async () => {
    if (server.isListening()) {
      await server.stop();
    }
    vi.clearAllMocks();
  });

  it('should do something', async () => {
    await server.start();
    // test code
  });
});
```

This pattern has several issues:
1. **Boilerplate code** - Every test file repeats the same setup/cleanup logic
2. **Cleanup reliability** - If tests fail before cleanup, servers may not stop properly
3. **Async complexity** - Managing async lifecycle in beforeEach/afterEach is error-prone
4. **Server state leakage** - Tests may inadvertently share state if cleanup is incomplete

## Decision

Create a `withMockMCP()` test wrapper function that:
1. Handles complete server lifecycle (creation, start, stop)
2. Provides the server instance to the test callback
3. Works with both sync and async tests
4. Guarantees cleanup even on test failure (try/finally pattern)
5. Optionally resets server behavior/state on cleanup
6. Supports various configuration options via builder pattern or definition

## Technical Design

### Function Signatures

```typescript
// Primary overload: with MockMCPServerDefinition
async function withMockMCP<T>(
  definition: MockMCPServerDefinition,
  test: (server: MockMCPServer) => Promise<T> | T,
  options?: WithMockMCPOptions
): Promise<T>;

// Secondary overload: with builder configuration callback
async function withMockMCP<T>(
  configure: (builder: MockMCPServerBuilder) => MockMCPServerBuilder,
  test: (server: MockMCPServer) => Promise<T> | T,
  options?: WithMockMCPOptions
): Promise<T>;

// Tertiary overload: with pre-built facade (for single-client convenience)
async function withMockMCPFacade<T>(
  configure: (builder: MockMCPServerBuilder) => MockMCPServerBuilder,
  test: (facade: MockMCPServerFacade) => Promise<T> | T,
  options?: WithMockMCPOptions
): Promise<T>;
```

### Configuration Options

```typescript
interface WithMockMCPOptions {
  /**
   * Whether to automatically start the server before calling the test.
   * @default true
   */
  autoStart?: boolean;

  /**
   * Whether to reset behavior/state after test completion.
   * @default true
   */
  resetOnCleanup?: boolean;

  /**
   * Timeout for server operations (start, stop) in milliseconds.
   * @default 5000
   */
  timeout?: number;

  /**
   * Custom cleanup logic to run before server stop.
   */
  beforeCleanup?: (server: MockMCPServer) => Promise<void> | void;
}
```

### Implementation

```typescript
// packages/orchestrator/src/mcp/mock-server/with-mock-mcp.ts

import type { MockMCPServerDefinition } from '@apexcli/core';
import { MockMCPServer } from './mock-mcp-server.js';
import { MockMCPServerBuilder } from './mock-mcp-server-builder.js';
import { MockMCPServerFacade } from './mock-server-facade.js';

export interface WithMockMCPOptions {
  autoStart?: boolean;
  resetOnCleanup?: boolean;
  timeout?: number;
  beforeCleanup?: (server: MockMCPServer) => Promise<void> | void;
}

const DEFAULT_OPTIONS: Required<Omit<WithMockMCPOptions, 'beforeCleanup'>> = {
  autoStart: true,
  resetOnCleanup: true,
  timeout: 5000,
};

// Type guards for overload resolution
type ConfigureCallback = (builder: MockMCPServerBuilder) => MockMCPServerBuilder;

function isConfigureCallback(
  value: MockMCPServerDefinition | ConfigureCallback
): value is ConfigureCallback {
  return typeof value === 'function';
}

/**
 * Test wrapper that handles MockMCPServer lifecycle automatically.
 *
 * Provides automatic setup and cleanup of mock MCP servers for testing,
 * ensuring proper resource management even when tests fail.
 *
 * @example
 * ```typescript
 * // Using builder configuration
 * it('should handle tool calls', async () => {
 *   await withMockMCP(
 *     builder => builder
 *       .withName('test-server')
 *       .withTool('read_file')
 *       .withStaticResponse([{ type: 'text', text: 'content' }]),
 *     async (server) => {
 *       const transport = server.createClientTransport();
 *       await transport.connect();
 *       // ... test code
 *       server.assertToolCalled('read_file', 1);
 *     }
 *   );
 * });
 *
 * // Using MockMCPServerDefinition
 * it('should handle complex scenarios', async () => {
 *   await withMockMCP(
 *     myServerDefinition,
 *     async (server) => {
 *       await server.start();
 *       // ... test code
 *     },
 *     { autoStart: false }
 *   );
 * });
 * ```
 */
export async function withMockMCP<T>(
  definitionOrConfigure: MockMCPServerDefinition | ConfigureCallback,
  test: (server: MockMCPServer) => Promise<T> | T,
  options: WithMockMCPOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Build the server
  let server: MockMCPServer;

  if (isConfigureCallback(definitionOrConfigure)) {
    const builder = definitionOrConfigure(new MockMCPServerBuilder());
    server = builder.buildServer();
  } else {
    server = new MockMCPServer(definitionOrConfigure);
  }

  try {
    // Auto-start if configured
    if (opts.autoStart) {
      await Promise.race([
        server.start(),
        createTimeoutPromise(opts.timeout, 'Server start timed out'),
      ]);
    }

    // Run the test
    const result = await test(server);

    return result;
  } finally {
    // Cleanup - always runs even on test failure
    try {
      // Run custom cleanup if provided
      if (opts.beforeCleanup) {
        await opts.beforeCleanup(server);
      }

      // Reset behavior if configured
      if (opts.resetOnCleanup) {
        server.resetBehavior();
        server.resetToDefault();
        server.clearErrorMode();
        server.clearMalformedResponseMode();
      }

      // Stop the server if it's running
      if (server.isListening()) {
        await Promise.race([
          server.stop(),
          createTimeoutPromise(opts.timeout, 'Server stop timed out'),
        ]);
      }
    } catch (cleanupError) {
      // Log cleanup errors but don't override test failures
      console.error('Error during MockMCPServer cleanup:', cleanupError);
    }
  }
}

/**
 * Test wrapper for MockMCPServerFacade (single-client convenience API).
 *
 * Similar to withMockMCP but provides the facade API instead of the
 * raw server, which is more convenient for single-client test scenarios.
 *
 * @example
 * ```typescript
 * it('should work with facade API', async () => {
 *   await withMockMCPFacade(
 *     builder => builder
 *       .withName('test-server')
 *       .withTool('ping')
 *       .withStaticResponse([{ type: 'text', text: 'pong' }]),
 *     async (facade) => {
 *       const transport = facade.getTransport();
 *       await transport.connect();
 *       // ... test code
 *       facade.assertMethodCalled('tools/call', 1);
 *     }
 *   );
 * });
 * ```
 */
export async function withMockMCPFacade<T>(
  configure: ConfigureCallback,
  test: (facade: MockMCPServerFacade) => Promise<T> | T,
  options: WithMockMCPOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Build the facade
  const builder = configure(new MockMCPServerBuilder());
  const facade = builder.build();

  try {
    // Auto-start if configured
    if (opts.autoStart) {
      await Promise.race([
        facade.start(),
        createTimeoutPromise(opts.timeout, 'Server start timed out'),
      ]);
    }

    // Run the test
    const result = await test(facade);

    return result;
  } finally {
    // Cleanup - always runs even on test failure
    try {
      // Reset behavior if configured
      if (opts.resetOnCleanup) {
        facade.resetBehavior();
        facade.resetToDefault();
        facade.clearErrorMode();
        facade.clearMalformedResponseMode();
      }

      // Stop the server if it's running
      if (facade.isListening()) {
        await Promise.race([
          facade.stop(),
          createTimeoutPromise(opts.timeout, 'Server stop timed out'),
        ]);
      }
    } catch (cleanupError) {
      console.error('Error during MockMCPServerFacade cleanup:', cleanupError);
    }
  }
}

/**
 * Helper to create a timeout promise for racing against operations.
 */
function createTimeoutPromise(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}
```

### File Location

The new file should be created at:
```
packages/orchestrator/src/mcp/mock-server/with-mock-mcp.ts
```

### Export Updates

Add to `packages/orchestrator/src/mcp/mock-server/index.ts`:
```typescript
// Test Wrapper Utilities
export {
  withMockMCP,
  withMockMCPFacade,
  type WithMockMCPOptions,
} from './with-mock-mcp.js';
```

### Test File

Create `packages/orchestrator/src/mcp/mock-server/__tests__/with-mock-mcp.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { withMockMCP, withMockMCPFacade } from '../with-mock-mcp.js';
import type { MockMCPServerDefinition } from '@apexcli/core';

describe('withMockMCP', () => {
  describe('with builder configuration', () => {
    it('should provide a started server to the test callback', async () => {
      await withMockMCP(
        builder => builder
          .withName('test-server')
          .withTool('ping')
          .withStaticResponse([{ type: 'text', text: 'pong' }]),
        async (server) => {
          expect(server.isListening()).toBe(true);
          expect(server.getName()).toBe('test-server');
        }
      );
    });

    it('should stop the server after test completion', async () => {
      let capturedServer: MockMCPServer | null = null;

      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async (server) => {
          capturedServer = server;
          expect(server.isListening()).toBe(true);
        }
      );

      expect(capturedServer?.isListening()).toBe(false);
    });

    it('should cleanup even when test fails', async () => {
      let capturedServer: MockMCPServer | null = null;

      await expect(
        withMockMCP(
          builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
          async (server) => {
            capturedServer = server;
            throw new Error('Test failure');
          }
        )
      ).rejects.toThrow('Test failure');

      expect(capturedServer?.isListening()).toBe(false);
    });

    it('should work with sync test callbacks', async () => {
      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        (server) => {
          expect(server.isListening()).toBe(true);
        }
      );
    });

    it('should support autoStart: false option', async () => {
      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async (server) => {
          expect(server.isListening()).toBe(false);
          await server.start();
          expect(server.isListening()).toBe(true);
        },
        { autoStart: false }
      );
    });

    it('should call beforeCleanup callback', async () => {
      const beforeCleanup = vi.fn();

      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async () => {},
        { beforeCleanup }
      );

      expect(beforeCleanup).toHaveBeenCalledOnce();
    });
  });

  describe('with MockMCPServerDefinition', () => {
    const definition: MockMCPServerDefinition = {
      serverConfig: {
        name: 'definition-server',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: { name: 'definition-server', version: '1.0.0' },
        maxConnections: 10,
        shutdownTimeoutMs: 5000,
      },
      defaultBehavior: {
        toolHandlers: [
          { toolName: 'test', response: { content: [], isError: false } },
        ],
        notificationTriggers: [],
      },
      scenarios: [],
    };

    it('should work with MockMCPServerDefinition', async () => {
      await withMockMCP(definition, async (server) => {
        expect(server.isListening()).toBe(true);
        expect(server.getName()).toBe('definition-server');
      });
    });
  });

  describe('error simulation reset', () => {
    it('should reset error mode on cleanup by default', async () => {
      let capturedServer: MockMCPServer | null = null;

      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async (server) => {
          capturedServer = server;
          server.setErrorMode({ mode: 'always_fail', category: 'jsonrpc', affectedClients: 'all' });
          expect(server.getErrorMode()).toBeDefined();
        }
      );

      // Error mode should be cleared during cleanup
      expect(capturedServer?.getErrorMode()).toBeUndefined();
    });

    it('should preserve error mode when resetOnCleanup is false', async () => {
      let capturedServer: MockMCPServer | null = null;

      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async (server) => {
          capturedServer = server;
          server.setErrorMode({ mode: 'always_fail', category: 'jsonrpc', affectedClients: 'all' });
        },
        { resetOnCleanup: false }
      );

      // Error mode should still be set (though server is stopped)
      expect(capturedServer?.getErrorMode()).toBeDefined();
    });
  });
});

describe('withMockMCPFacade', () => {
  it('should provide a started facade to the test callback', async () => {
    await withMockMCPFacade(
      builder => builder
        .withName('facade-server')
        .withTool('ping')
        .withStaticResponse([{ type: 'text', text: 'pong' }]),
      async (facade) => {
        expect(facade.isListening()).toBe(true);
        const transport = facade.getTransport();
        expect(transport).toBeDefined();
      }
    );
  });

  it('should cleanup facade on completion', async () => {
    let capturedFacade: MockMCPServerFacade | null = null;

    await withMockMCPFacade(
      builder => builder.withName('facade-server').withTool('x').withStaticResponse([]),
      async (facade) => {
        capturedFacade = facade;
        expect(facade.isListening()).toBe(true);
      }
    );

    expect(capturedFacade?.isListening()).toBe(false);
  });
});
```

## Usage Examples

### Basic Usage

```typescript
import { withMockMCP } from '@apexcli/orchestrator/mcp/mock-server';

describe('MCP Client Tests', () => {
  it('should call tools successfully', async () => {
    await withMockMCP(
      builder => builder
        .withName('test-server')
        .withTool('read_file')
        .withStaticResponse([{ type: 'text', text: 'file content' }]),
      async (server) => {
        const transport = server.createClientTransport();
        await transport.connect();

        // Simulate client calling the tool
        const result = await transport.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'read_file', arguments: { path: '/test.txt' } },
        });

        server.assertToolCalled('read_file', 1);
      }
    );
  });
});
```

### With Error Simulation

```typescript
it('should handle server errors gracefully', async () => {
  await withMockMCP(
    builder => builder
      .withName('error-server')
      .withTool('flaky_operation')
      .withStaticResponse([{ type: 'text', text: 'success' }])
      .withErrorSimulation({
        mode: 'fail_first_n',
        failCount: 2,
        customError: { code: -32603, message: 'Temporary failure' },
      }),
    async (server) => {
      // Test retry logic here
    }
  );
});
```

### With Definition

```typescript
const customDefinition: MockMCPServerDefinition = {
  // ... complex configuration
};

it('should work with complex definition', async () => {
  await withMockMCP(customDefinition, async (server) => {
    // Test with custom definition
  });
});
```

### Without Auto-Start

```typescript
it('should test startup behavior', async () => {
  await withMockMCP(
    builder => builder.withName('manual-server').withTool('x').withStaticResponse([]),
    async (server) => {
      expect(server.isListening()).toBe(false);

      // Test startup timing
      const startTime = Date.now();
      await server.start();
      const duration = Date.now() - startTime;

      expect(server.isListening()).toBe(true);
      expect(duration).toBeLessThan(1000);
    },
    { autoStart: false }
  );
});
```

## Consequences

### Positive

1. **Reduced boilerplate** - Tests become more concise and focused
2. **Guaranteed cleanup** - try/finally ensures servers are always stopped
3. **Consistent patterns** - All tests follow the same wrapper pattern
4. **Type safety** - Full TypeScript support with proper generics
5. **Flexible API** - Supports both builder and definition approaches
6. **Testable** - The wrapper itself is straightforward to test

### Negative

1. **Learning curve** - Developers need to learn the new wrapper API
2. **Indentation** - Test code is nested one level deeper
3. **Migration effort** - Existing tests need to be updated (optional)

### Neutral

1. **Async requirement** - All wrapped tests must use async/await (but async tests are already the norm)

## Implementation Notes

### Error Handling

The wrapper catches cleanup errors and logs them but doesn't re-throw, ensuring that the original test error (if any) is preserved. This follows the principle that test failures should report the actual test issue, not cleanup issues.

### Timeout Protection

Both server start and stop operations are protected by timeouts to prevent hanging tests. The default timeout (5 seconds) matches the server's default shutdown timeout.

### State Reset

The `resetOnCleanup` option (default: true) ensures that:
- Behavior engine state is reset
- Active scenarios are deactivated
- Error simulation mode is cleared
- Malformed response mode is cleared

This provides complete isolation between tests without requiring manual cleanup.

## Related

- MockMCPServer: `packages/orchestrator/src/mcp/mock-server/mock-mcp-server.ts`
- MockMCPServerBuilder: `packages/orchestrator/src/mcp/mock-server/mock-mcp-server-builder.ts`
- MockMCPServerFacade: `packages/orchestrator/src/mcp/mock-server/mock-server-facade.ts`
- ADR-072: Error Simulation Configuration
- ADR-080: Server Presets
