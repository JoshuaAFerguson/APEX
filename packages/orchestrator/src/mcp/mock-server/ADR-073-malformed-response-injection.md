# ADR-073: Malformed Response Injection at Transport Layer

## Status
**Proposed** - January 2025

## Context

The current `MockTransport` and `MockMCPServer` classes provide comprehensive testing infrastructure for MCP client interactions. However, all malformed response handling currently operates at the **protocol/application layer**, returning structured `MockMalformedResponseConfig` data that gets serialized into valid JSON-RPC error responses.

This approach has a significant limitation: **it cannot test client resilience against actual transport-level corruption**. Real-world scenarios that clients need to handle include:

1. **Invalid JSON bytes**: Data that causes `JSON.parse()` to throw (e.g., `{"result": undefined}`, random binary data)
2. **Truncated responses**: Connection drops mid-stream, leaving partial JSON (e.g., `{"jsonrpc": "2.0", "id": 1, "res`)
3. **Empty responses**: Zero-byte responses from the server
4. **Non-JSON data**: Receiving HTML error pages, binary data, or other unexpected content

The existing `MockMalformedResponseConfig` in `@apex/core` defines these types (`invalid_json`, `truncated_json`, `wrong_schema`, `empty_response`), but the `MockMCPServer` currently returns them as structured error responses rather than injecting actual malformed bytes.

### Current Architecture Gap

```
Current Flow (Protocol-Level):
┌─────────────┐    JSON-RPC    ┌──────────────┐    JSON-RPC    ┌─────────────┐
│   Client    │ ─────────────► │ MockTransport │ ─────────────► │ MCPServer   │
│             │ ◄───────────── │              │ ◄───────────── │             │
└─────────────┘  Valid JSON    └──────────────┘  Structured    └─────────────┘
                 Always                          Error Response

What We Need (Transport-Level):
┌─────────────┐    JSON-RPC    ┌──────────────┐    Raw Bytes   ┌─────────────┐
│   Client    │ ─────────────► │ MockTransport │ ─────────────► │ MCPServer   │
│             │ ◄───────────── │              │ ◄───────────── │             │
└─────────────┘  Malformed     └──────────────┘  (intercepted)  └─────────────┘
                 Bytes
```

## Decision

Extend `MockTransport` to support **raw bytes injection** at the transport layer, allowing test code to inject actual malformed data that simulates real transport-level corruption.

### Core Design

We will add a new event type and injection method to `MockTransport` that operates **below the JSON parsing layer**:

```typescript
interface MockTransportEvents extends MCPTransportEvents {
  /** Emitted when raw bytes are received (before JSON parsing) */
  'rawData': (data: Buffer | string) => void;
}

interface MalformedBytesInjectionConfig {
  /** Type of malformed data to inject */
  type: 'invalid_json' | 'truncated_json' | 'empty_response' | 'binary_data' | 'custom';

  /**
   * For truncated_json: position to truncate at
   * - number: byte position
   * - string with %: percentage (e.g., '50%')
   */
  truncateAt?: number | string;

  /** For custom type: exact raw bytes to inject */
  rawBytes?: Buffer | string;

  /** For invalid_json: specific invalid content */
  invalidContent?: string;

  /** Delay before injection (ms) */
  delayMs?: number;
}

class MockTransport extends MCPTransport {
  // Existing methods...

  /**
   * Inject raw malformed bytes as if received from the server.
   * Bypasses JSON parsing to test client error handling.
   */
  injectMalformedBytes(config: MalformedBytesInjectionConfig): void;

  /**
   * Configure automatic malformed response injection for specific requests.
   * When a matching request is received, the response will be malformed.
   */
  setMalformedResponseInjection(config: {
    /** Request method(s) to target (empty = all) */
    targetMethods?: string[];
    /** Malformed injection config */
    injection: MalformedBytesInjectionConfig;
    /** Probability (0-1, default 1.0) */
    probability?: number;
  }): void;
}
```

### Implementation Strategy

#### Phase 1: Raw Bytes Injection in MockTransport

Add methods to `MockTransport` that emit raw data events, bypassing the structured JSON-RPC message flow:

```typescript
/**
 * Inject raw malformed bytes at the transport layer.
 * This bypasses normal message handling to simulate transport corruption.
 */
injectMalformedBytes(config: MalformedBytesInjectionConfig): void {
  if (!this.connected) {
    throw new MCPTransportError('Cannot inject bytes when not connected', 'NOT_CONNECTED');
  }

  let data: string | Buffer;

  switch (config.type) {
    case 'invalid_json':
      data = config.invalidContent ?? '{"result": undefined, broken json here}';
      break;

    case 'truncated_json':
      // Generate a valid response then truncate it
      const fullResponse = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { data: 'some response data that will be truncated' }
      });
      data = this.truncateData(fullResponse, config.truncateAt ?? '50%');
      break;

    case 'empty_response':
      data = '';
      break;

    case 'binary_data':
      data = Buffer.from([0x00, 0x01, 0xFF, 0xFE, 0x89, 0x50, 0x4E, 0x47]);
      break;

    case 'custom':
      data = config.rawBytes ?? '';
      break;
  }

  // Emit raw data event for clients that handle raw transport data
  this.emit('rawData', data);

  // Also try to emit as 'message' to trigger normal error handling
  // This allows testing both raw data handlers and JSON parse error handling
  try {
    const message = JSON.parse(typeof data === 'string' ? data : data.toString());
    this.emit('message', message);
  } catch (parseError) {
    // Emit as transport error since the data couldn't be parsed
    this.emit('error', new MCPTransportError(
      `Malformed data received: ${parseError.message}`,
      'PARSE_ERROR',
      parseError
    ));
  }
}
```

#### Phase 2: Automatic Malformed Response Interception

Extend the request handler mechanism to support response interception:

```typescript
interface MalformedResponseInterceptor {
  targetMethods: string[];
  injection: MalformedBytesInjectionConfig;
  probability: number;
}

private malformedInterceptors: MalformedResponseInterceptor[] = [];

setMalformedResponseInjection(config: {
  targetMethods?: string[];
  injection: MalformedBytesInjectionConfig;
  probability?: number;
}): void {
  this.malformedInterceptors.push({
    targetMethods: config.targetMethods ?? [],
    injection: config.injection,
    probability: config.probability ?? 1.0,
  });
}

// Modified send() method
async send(message: JSONRPCMessage): Promise<void> {
  // ... existing validation ...

  this.sentMessages.push(message);

  if (this.requestHandler) {
    try {
      const response = await this.requestHandler(message);
      if (response) {
        // Check if we should inject malformed response
        if (this.shouldInjectMalformed(message)) {
          await this.injectMalformedForRequest(message, response);
        } else {
          this.emit('message', response);
        }
      }
    } catch (error) {
      // ... existing error handling ...
    }
  }
}

private shouldInjectMalformed(request: JSONRPCMessage): boolean {
  const method = 'method' in request ? request.method : '';

  for (const interceptor of this.malformedInterceptors) {
    const methodMatch = interceptor.targetMethods.length === 0 ||
                       interceptor.targetMethods.includes(method);
    const probabilityMatch = Math.random() < interceptor.probability;

    if (methodMatch && probabilityMatch) {
      return true;
    }
  }
  return false;
}

private async injectMalformedForRequest(
  request: JSONRPCMessage,
  originalResponse: JSONRPCMessage
): Promise<void> {
  const method = 'method' in request ? request.method : '';

  // Find matching interceptor
  const interceptor = this.malformedInterceptors.find(i =>
    i.targetMethods.length === 0 || i.targetMethods.includes(method)
  );

  if (!interceptor) {
    this.emit('message', originalResponse);
    return;
  }

  // Apply delay if specified
  if (interceptor.injection.delayMs) {
    await this.delay(interceptor.injection.delayMs);
  }

  // Use the original response as the base for truncation/corruption
  const config: MalformedBytesInjectionConfig = {
    ...interceptor.injection,
  };

  if (config.type === 'truncated_json') {
    // Truncate the actual response that would have been sent
    const fullResponse = JSON.stringify(originalResponse);
    const truncated = this.truncateData(fullResponse, config.truncateAt ?? '50%');
    this.emit('rawData', truncated);
    this.emit('error', new MCPTransportError(
      'Truncated response received',
      'PARSE_ERROR'
    ));
  } else {
    this.injectMalformedBytes(config);
  }
}
```

### Type Definitions

Add to `packages/orchestrator/src/mcp/mock-server/types.ts`:

```typescript
/**
 * Configuration for injecting malformed bytes at the transport layer.
 *
 * Unlike MockMalformedResponseConfig which operates at the protocol level,
 * this configuration enables injection of actual malformed data that
 * simulates transport-level corruption.
 */
export interface MalformedBytesInjectionConfig {
  /** Type of malformed data to inject */
  type: 'invalid_json' | 'truncated_json' | 'empty_response' | 'binary_data' | 'custom';

  /**
   * For truncated_json: position to truncate at.
   * - number: absolute byte position
   * - string with %: percentage of full response (e.g., '50%')
   */
  truncateAt?: number | string;

  /** For custom type: exact raw bytes to inject */
  rawBytes?: Buffer | string;

  /** For invalid_json: specific invalid JSON content to inject */
  invalidContent?: string;

  /** Delay before injection (ms) */
  delayMs?: number;

  /** Optional description for test documentation */
  description?: string;
}

/**
 * Configuration for automatic malformed response interception.
 */
export interface MalformedResponseInterceptorConfig {
  /** Request method(s) to target (empty array = all methods) */
  targetMethods?: string[];

  /** Malformed injection configuration */
  injection: MalformedBytesInjectionConfig;

  /** Probability of injection (0.0 to 1.0, default 1.0) */
  probability?: number;

  /** Maximum number of injections (0 = unlimited) */
  maxInjections?: number;
}
```

### Extended MCPTransportEvents

Add new event to `packages/orchestrator/src/mcp/types.ts`:

```typescript
export interface MCPTransportEvents {
  // ... existing events ...

  /**
   * Emitted when raw data is received before JSON parsing.
   * Used for testing transport-level error handling.
   */
  'rawData': (data: Buffer | string) => void;
}
```

## Usage Examples

### Basic Malformed Bytes Injection

```typescript
const transport = new MockTransport();
await transport.connect();

// Listen for raw data (malformed bytes)
transport.on('rawData', (data) => {
  console.log('Received raw data:', data);
});

// Listen for parse errors
transport.on('error', (error) => {
  if (error.code === 'PARSE_ERROR') {
    console.log('Parse error:', error.message);
  }
});

// Inject truncated JSON
transport.injectMalformedBytes({
  type: 'truncated_json',
  truncateAt: '50%',
});

// Inject invalid JSON
transport.injectMalformedBytes({
  type: 'invalid_json',
  invalidContent: '{"result": undefined}',
});

// Inject binary garbage
transport.injectMalformedBytes({
  type: 'binary_data',
});
```

### Automatic Response Interception

```typescript
const server = new MockMCPServer({
  serverConfig: { name: 'test', transport: 'stdio' },
  defaultBehavior: {}
});

await server.start();
const clientTransport = server.createClientTransport();

// Configure automatic malformed injection for tools/call
clientTransport.setMalformedResponseInjection({
  targetMethods: ['tools/call'],
  injection: {
    type: 'truncated_json',
    truncateAt: '75%',
  },
  probability: 1.0, // Always inject for testing
});

await clientTransport.connect();

// This request will receive a truncated response
clientTransport.send({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'read_file', arguments: {} }
});
```

### Testing Client Resilience

```typescript
describe('Client resilience to transport errors', () => {
  it('handles truncated JSON gracefully', async () => {
    const transport = new MockTransport();
    const errors: MCPTransportError[] = [];

    transport.on('error', (err) => errors.push(err));
    await transport.connect();

    // Simulate truncated response
    transport.injectMalformedBytes({
      type: 'truncated_json',
      truncateAt: '30%', // Truncate at 30% of response
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('PARSE_ERROR');
  });

  it('handles binary garbage gracefully', async () => {
    const transport = new MockTransport();
    let rawDataReceived: Buffer | string | null = null;

    transport.on('rawData', (data) => {
      rawDataReceived = data;
    });

    await transport.connect();

    transport.injectMalformedBytes({
      type: 'binary_data',
    });

    expect(rawDataReceived).toBeInstanceOf(Buffer);
  });
});
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MockTransport                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌────────────────────┐    ┌────────────────────┐     │
│  │   send()     │───►│ Request Handler    │───►│ Malformed Check    │     │
│  │              │    │ (normal processing)│    │                    │     │
│  └──────────────┘    └────────────────────┘    └─────────┬──────────┘     │
│                                                          │                  │
│                           ┌──────────────────────────────┼───────┐         │
│                           │                              ▼       │         │
│                           │        ┌─────────────────────────┐   │         │
│                           │        │ shouldInjectMalformed() │   │         │
│                           │        └────────────┬────────────┘   │         │
│                           │                     │                │         │
│                     No    │                     │ Yes            │         │
│              ┌────────────┴───────┐     ┌──────▼──────────┐     │         │
│              │                    │     │                 │     │         │
│              ▼                    │     ▼                 │     │         │
│  ┌────────────────────┐          │  ┌────────────────────┐│     │         │
│  │ emit('message',    │          │  │ injectMalformed    ││     │         │
│  │      response)     │          │  │ ForRequest()       ││     │         │
│  └────────────────────┘          │  └─────────┬──────────┘│     │         │
│                                  │            │           │     │         │
│                                  │            ▼           │     │         │
│                                  │  ┌────────────────────┐│     │         │
│                                  │  │ Generate malformed ││     │         │
│                                  │  │ bytes based on     ││     │         │
│                                  │  │ injection config   ││     │         │
│                                  │  └─────────┬──────────┘│     │         │
│                                  │            │           │     │         │
│                                  │            ▼           │     │         │
│                                  │  ┌────────────────────┐│     │         │
│                                  │  │ emit('rawData',    ││     │         │
│                                  │  │      bytes)        ││     │         │
│                                  │  │ emit('error',      ││     │         │
│                                  │  │      PARSE_ERROR)  ││     │         │
│                                  │  └────────────────────┘│     │         │
│                                  │                        │     │         │
│                                  └────────────────────────┘     │         │
│                                                                 │         │
│  Direct Injection API:                                          │         │
│  ┌─────────────────────────────────────────────────────────────┐│         │
│  │ injectMalformedBytes(config: MalformedBytesInjectionConfig) ││         │
│  │  ├─► type: 'invalid_json'   ──► Emit invalid JSON string    ││         │
│  │  ├─► type: 'truncated_json' ──► Emit truncated JSON         ││         │
│  │  ├─► type: 'empty_response' ──► Emit empty string           ││         │
│  │  ├─► type: 'binary_data'    ──► Emit binary buffer          ││         │
│  │  └─► type: 'custom'         ──► Emit custom rawBytes        ││         │
│  └─────────────────────────────────────────────────────────────┘│         │
│                                                                  │         │
└─────────────────────────────────────────────────────────────────┴─────────┘
```

## File Changes

### Modified Files

1. **`packages/orchestrator/src/mcp/mock-server/types.ts`**
   - Add `MalformedBytesInjectionConfig` interface
   - Add `MalformedResponseInterceptorConfig` interface

2. **`packages/orchestrator/src/mcp/types.ts`**
   - Add `rawData` event to `MCPTransportEvents`

3. **`packages/orchestrator/src/mcp/mock-server/mock-transport.ts`**
   - Add `injectMalformedBytes()` method
   - Add `setMalformedResponseInjection()` method
   - Add `clearMalformedResponseInjection()` method
   - Add private interceptor state and methods
   - Modify `send()` to check for malformed injection

### New Files

1. **`packages/orchestrator/src/mcp/mock-server/mock-transport.malformed.test.ts`**
   - Unit tests for malformed bytes injection

## Consequences

### Positive

- **Complete Transport-Layer Testing**: Enables testing of actual malformed byte handling, not just structured error responses
- **Real-World Simulation**: Can simulate real transport corruption scenarios (connection drops, garbage data)
- **Separation of Concerns**: Keeps malformed injection at the transport layer where it belongs
- **Backward Compatible**: Existing `MockMalformedResponseConfig` in `MockMCPServer` continues to work for protocol-level testing
- **Composable**: Can combine with other mock behaviors (delays, errors, state machines)

### Negative

- **Increased Complexity**: Adds another layer of configuration for mock transports
- **Event Proliferation**: New `rawData` event may require updates to existing test code
- **Buffer Handling**: Binary data injection requires careful handling across different environments

### Neutral

- **Type System Extension**: New types need to be exported from appropriate modules
- **Documentation**: Need to clearly distinguish between protocol-level malformed responses and transport-level byte injection

## Migration

No migration required. This is a new, additive feature. Existing tests using `MockMalformedResponseConfig` continue to work as before.

## References

- ADR-072: Error Simulation Architecture
- `packages/core/src/mcp/mock-types.ts` - Existing `MockMalformedResponseConfig` schema
- `packages/orchestrator/src/mcp/mock-server/mock-transport.ts` - Current MockTransport implementation
- JSON-RPC 2.0 Specification
