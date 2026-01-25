# ADR-072: MockMCPServer Error Simulation Infrastructure

## Status
**Proposed**

## Date
2025-01-25

## Context

APEX's MockMCPServer infrastructure provides comprehensive mock MCP server capabilities for testing MCP client integrations. While the existing infrastructure supports basic error injection through `MockErrorInjection` (probability-based errors, after-count triggers), there is a need for more sophisticated error simulation capabilities that can:

1. Simulate specific MCP protocol error scenarios (initialization failures, capability negotiation errors)
2. Reproduce transport-level failures (connection drops, timeouts, malformed responses)
3. Model complex error patterns (intermittent failures, error recovery scenarios)
4. Support deterministic error testing (not just probability-based)

### Current Infrastructure Analysis

**Existing Components:**
- `MockMCPServer` (packages/orchestrator/src/mcp/mock-server/mock-mcp-server.ts): Multi-client server with lifecycle management
- `MockBehaviorEngine` (packages/orchestrator/src/mcp/mock-server/mock-behavior-engine.ts): Handles delays and basic error injection
- `MockErrorInjection` schema (packages/core/src/mcp/mock-types.ts): Probability-based error injection config
- `MockMCPServerBuilder`: Fluent API for server configuration

**Current Error Injection Capabilities:**
- Probability-based error injection (0.0 to 1.0)
- After-request-count triggering
- Maximum error count limits
- Method filtering
- Connection failure simulation (boolean flag)
- Error delay simulation

**Gaps Identified:**
- No deterministic error mode configuration API
- No transport-level error simulation (malformed JSON, partial messages)
- No protocol-level error simulation (invalid handshake, capability mismatch)
- No error sequence patterns (error-then-recover, error escalation)
- No network-level simulations (latency spikes, packet loss patterns)

## Decision

### Architecture Overview

We will extend the MockMCPServer infrastructure with a dedicated **Error Simulation Layer** that provides:

1. **Error Mode Configuration Types** - Declarative configuration for various error scenarios
2. **Error Simulation Hooks** - Integration points in the request processing pipeline
3. **setErrorMode() API** - Runtime configuration method for switching error behaviors

### Type Definitions

Add new types to `packages/core/src/mcp/mock-types.ts`:

```typescript
// ============================================================================
// Error Simulation Configuration Types
// ============================================================================

/**
 * Error simulation modes for deterministic testing
 */
export const MockErrorModeSchema = z.enum([
  /** No error simulation (default behavior) */
  'none',
  /** All requests fail with configured error */
  'always_fail',
  /** Requests fail in a repeating pattern (e.g., fail every 3rd request) */
  'periodic_fail',
  /** Requests fail until a specific condition is met */
  'fail_until',
  /** First N requests fail, then succeed */
  'fail_first_n',
  /** Last N requests fail (useful for testing cleanup) */
  'fail_after_n',
  /** Requests fail based on method name pattern */
  'method_pattern',
  /** Requests fail based on argument content */
  'argument_pattern',
  /** Custom error sequence with specific patterns */
  'sequence',
]);
export type MockErrorMode = z.infer<typeof MockErrorModeSchema>;

/**
 * Categories of errors that can be simulated
 */
export const MockErrorCategorySchema = z.enum([
  /** JSON-RPC level errors (parse error, invalid request, method not found) */
  'jsonrpc',
  /** MCP protocol errors (initialization failure, capability mismatch) */
  'protocol',
  /** Transport level errors (connection lost, timeout, malformed data) */
  'transport',
  /** Application level errors (tool execution failure, resource not found) */
  'application',
  /** Network level errors (latency spikes, intermittent connectivity) */
  'network',
]);
export type MockErrorCategory = z.infer<typeof MockErrorCategorySchema>;

/**
 * Predefined error scenarios for common test cases
 */
export const MockErrorScenarioPresetSchema = z.enum([
  /** Server rejects initialization with invalid protocol version */
  'init_protocol_mismatch',
  /** Server rejects initialization with capability negotiation failure */
  'init_capability_rejection',
  /** Server drops connection during initialization handshake */
  'init_connection_drop',
  /** Server sends malformed JSON in response */
  'malformed_response',
  /** Server sends response with mismatched request ID */
  'response_id_mismatch',
  /** Server sends partial response then disconnects */
  'partial_response',
  /** Server becomes unresponsive (infinite delay) */
  'server_hang',
  /** Server rate limits requests */
  'rate_limit',
  /** Server authentication/authorization failure */
  'auth_failure',
  /** Server internal error with stack trace */
  'internal_error_with_details',
  /** Tool not found error */
  'tool_not_found',
  /** Resource access denied */
  'resource_access_denied',
  /** Request timeout */
  'request_timeout',
  /** Connection reset by peer */
  'connection_reset',
]);
export type MockErrorScenarioPreset = z.infer<typeof MockErrorScenarioPresetSchema>;

/**
 * Complete error simulation configuration
 */
export const MockErrorSimulationConfigSchema = z.object({
  /** Error simulation mode */
  mode: MockErrorModeSchema.default('none'),

  /** Error category to simulate */
  category: MockErrorCategorySchema.default('jsonrpc'),

  /** Use a predefined error scenario preset */
  preset: MockErrorScenarioPresetSchema.optional(),

  /** Custom error configuration (overrides preset defaults) */
  customError: z.object({
    /** JSON-RPC error code */
    code: z.number(),
    /** Error message */
    message: z.string(),
    /** Additional error data */
    data: z.unknown().optional(),
  }).optional(),

  /** For periodic_fail mode: fail every Nth request */
  failPeriod: z.number().int().min(1).optional(),

  /** For fail_first_n mode: number of initial failures */
  failCount: z.number().int().min(0).optional(),

  /** For fail_after_n mode: succeed first N, then fail */
  succeedCount: z.number().int().min(0).optional(),

  /** For method_pattern mode: regex pattern to match method names */
  methodPattern: z.string().optional(),

  /** For argument_pattern mode: JSON path and value to match */
  argumentMatcher: z.object({
    path: z.string(),
    value: z.unknown(),
  }).optional(),

  /** For sequence mode: specific sequence of outcomes */
  sequence: z.array(z.object({
    /** 'success' or 'error' */
    outcome: z.enum(['success', 'error']),
    /** Error details if outcome is 'error' */
    error: z.object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    }).optional(),
    /** Optional delay before this outcome */
    delayMs: z.number().int().min(0).optional(),
  })).optional(),

  /** For network errors: simulate specific network conditions */
  networkConditions: z.object({
    /** Base latency to add (ms) */
    latencyMs: z.number().int().min(0).optional(),
    /** Latency variance for jitter (ms) */
    latencyJitter: z.number().int().min(0).optional(),
    /** Packet loss probability (0.0 to 1.0) */
    packetLoss: z.number().min(0).max(1).optional(),
    /** Bandwidth throttle (bytes per second, 0 = unlimited) */
    bandwidth: z.number().int().min(0).optional(),
    /** Connection timeout (ms) */
    connectionTimeout: z.number().int().min(0).optional(),
  }).optional(),

  /** Whether this configuration affects all connections or specific client IDs */
  affectedClients: z.union([
    z.literal('all'),
    z.array(z.string()),
  ]).default('all'),

  /** Optional description for test documentation */
  description: z.string().optional(),
});
export type MockErrorSimulationConfig = z.infer<typeof MockErrorSimulationConfigSchema>;
```

### MockMCPServer API Extensions

Add to `MockMCPServer` class:

```typescript
/**
 * Set the error simulation mode for deterministic error testing.
 *
 * @param config - Error simulation configuration
 * @example
 * ```typescript
 * // All requests fail with timeout
 * server.setErrorMode({
 *   mode: 'always_fail',
 *   preset: 'request_timeout'
 * });
 *
 * // First 3 requests fail, then succeed
 * server.setErrorMode({
 *   mode: 'fail_first_n',
 *   failCount: 3,
 *   customError: { code: -32603, message: 'Service starting up' }
 * });
 *
 * // Use a specific error sequence
 * server.setErrorMode({
 *   mode: 'sequence',
 *   sequence: [
 *     { outcome: 'error', error: { code: -32603, message: 'First failure' } },
 *     { outcome: 'success' },
 *     { outcome: 'error', error: { code: -32603, message: 'Second failure' } },
 *     { outcome: 'success' },
 *   ]
 * });
 * ```
 */
setErrorMode(config: MockErrorSimulationConfig): void;

/**
 * Clear the error simulation mode, returning to normal operation.
 */
clearErrorMode(): void;

/**
 * Get the current error simulation configuration.
 */
getErrorMode(): MockErrorSimulationConfig | undefined;

/**
 * Apply a preset error scenario for common test cases.
 *
 * @param preset - Predefined error scenario
 * @example
 * ```typescript
 * server.applyErrorPreset('init_connection_drop');
 * ```
 */
applyErrorPreset(preset: MockErrorScenarioPreset): void;
```

### MockMCPServerBuilder API Extensions

Add to `MockMCPServerBuilder` class:

```typescript
/**
 * Configure error simulation for the mock server.
 *
 * @param config - Error simulation configuration
 * @returns This builder instance for chaining
 *
 * @example
 * ```typescript
 * const server = new MockMCPServerBuilder()
 *   .withName('flaky-server')
 *   .withErrorSimulation({
 *     mode: 'periodic_fail',
 *     failPeriod: 3,
 *     preset: 'internal_error_with_details'
 *   })
 *   .build();
 * ```
 */
withErrorSimulation(config: MockErrorSimulationConfig): this;

/**
 * Configure network condition simulation.
 *
 * @param conditions - Network conditions to simulate
 * @returns This builder instance for chaining
 *
 * @example
 * ```typescript
 * const server = new MockMCPServerBuilder()
 *   .withName('slow-network-server')
 *   .withNetworkConditions({
 *     latencyMs: 500,
 *     latencyJitter: 100,
 *     packetLoss: 0.05
 *   })
 *   .build();
 * ```
 */
withNetworkConditions(conditions: MockErrorSimulationConfig['networkConditions']): this;
```

### Error Simulation Hooks Architecture

The error simulation layer integrates into the existing request processing pipeline:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Request Processing Pipeline                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────┐   ┌─────────────────────┐   ┌─────────────────┐             │
│  │  Transport │ → │  Network Simulation │ → │  JSON-RPC Parse │             │
│  │  Receive   │   │  (latency, loss)    │   │                 │             │
│  └────────────┘   └─────────────────────┘   └────────┬────────┘             │
│                                                       │                      │
│                           ┌───────────────────────────┴──────────────┐       │
│                           ▼                                          │       │
│                 ┌──────────────────────┐                             │       │
│                 │ ERROR SIMULATION     │ ◄── setErrorMode() config   │       │
│                 │ DECISION POINT       │                             │       │
│                 │ (check mode, pattern,│                             │       │
│                 │  sequence, etc.)     │                             │       │
│                 └──────────┬───────────┘                             │       │
│                           │                                          │       │
│         ┌─────────────────┴─────────────────┐                        │       │
│         ▼                                   ▼                        │       │
│  ┌──────────────┐                  ┌──────────────────┐              │       │
│  │ Generate     │                  │ Continue Normal  │              │       │
│  │ Error        │                  │ Processing       │              │       │
│  │ Response     │                  │ (Behavior Engine)│              │       │
│  └──────┬───────┘                  └────────┬─────────┘              │       │
│         │                                   │                        │       │
│         └─────────────────┬─────────────────┘                        │       │
│                           ▼                                          │       │
│                 ┌──────────────────────┐                             │       │
│                 │ Response Preparation │                             │       │
│                 │ (apply delays, etc.) │                             │       │
│                 └──────────┬───────────┘                             │       │
│                           │                                          │       │
│                           ▼                                          │       │
│                 ┌──────────────────────┐                             │       │
│                 │ Transport Send       │                             │       │
│                 │ (may also simulate   │                             │       │
│                 │  transport errors)   │                             │       │
│                 └──────────────────────┘                             │       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Error Preset Definitions

The implementation will include preset configurations for common scenarios:

```typescript
const ERROR_PRESETS: Record<MockErrorScenarioPreset, Partial<MockErrorSimulationConfig>> = {
  'init_protocol_mismatch': {
    mode: 'method_pattern',
    methodPattern: 'initialize',
    customError: { code: -32600, message: 'Protocol version not supported' },
  },
  'init_capability_rejection': {
    mode: 'method_pattern',
    methodPattern: 'initialize',
    customError: { code: -32601, message: 'Required capabilities not available' },
  },
  'init_connection_drop': {
    mode: 'method_pattern',
    methodPattern: 'initialize',
    category: 'transport',
    customError: { code: -32000, message: 'Connection closed unexpectedly' },
  },
  'malformed_response': {
    mode: 'always_fail',
    category: 'transport',
    customError: { code: -32700, message: 'Parse error' },
  },
  'response_id_mismatch': {
    mode: 'always_fail',
    category: 'protocol',
    customError: { code: -32603, message: 'Response ID does not match request' },
  },
  'partial_response': {
    mode: 'always_fail',
    category: 'transport',
    customError: { code: -32000, message: 'Incomplete response received' },
  },
  'server_hang': {
    mode: 'always_fail',
    category: 'network',
    networkConditions: { connectionTimeout: 0 }, // Infinite wait
  },
  'rate_limit': {
    mode: 'always_fail',
    category: 'application',
    customError: { code: -32429, message: 'Too many requests' },
  },
  'auth_failure': {
    mode: 'always_fail',
    category: 'protocol',
    customError: { code: -32401, message: 'Authentication required' },
  },
  'internal_error_with_details': {
    mode: 'always_fail',
    category: 'application',
    customError: {
      code: -32603,
      message: 'Internal server error',
      data: { stack: 'Error: Internal failure\n    at Server.process()' }
    },
  },
  'tool_not_found': {
    mode: 'method_pattern',
    methodPattern: 'tools/call',
    customError: { code: -32601, message: 'Tool not found' },
  },
  'resource_access_denied': {
    mode: 'method_pattern',
    methodPattern: 'resources/.*',
    customError: { code: -32600, message: 'Access denied' },
  },
  'request_timeout': {
    mode: 'always_fail',
    category: 'network',
    networkConditions: { connectionTimeout: 1 }, // Immediate timeout
    customError: { code: -32000, message: 'Request timed out' },
  },
  'connection_reset': {
    mode: 'always_fail',
    category: 'transport',
    customError: { code: -32000, message: 'Connection reset by peer' },
  },
};
```

### File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/core/src/mcp/mock-types.ts` | Modified | Add error simulation type definitions |
| `packages/orchestrator/src/mcp/mock-server/types.ts` | Modified | Add internal error simulation types |
| `packages/orchestrator/src/mcp/mock-server/mock-mcp-server.ts` | Modified | Add setErrorMode/clearErrorMode/getErrorMode/applyErrorPreset methods |
| `packages/orchestrator/src/mcp/mock-server/mock-behavior-engine.ts` | Modified | Add error simulation hooks and decision logic |
| `packages/orchestrator/src/mcp/mock-server/mock-mcp-server-builder.ts` | Modified | Add withErrorSimulation/withNetworkConditions methods |
| `packages/orchestrator/src/mcp/mock-server/error-presets.ts` | New | Error preset definitions |
| `packages/orchestrator/src/mcp/mock-server/index.ts` | Modified | Export new types and error presets |

## Consequences

### Positive
- Enables deterministic error testing without probability-based randomness
- Provides comprehensive coverage for edge cases and error handling
- Reusable presets reduce test boilerplate
- Network condition simulation enables realistic latency testing
- Flexible API supports both simple and complex error scenarios

### Negative
- Adds complexity to the MockMCPServer infrastructure
- Additional types to maintain and document
- Test authors need to learn new API surface

### Risks Mitigated
- Client code can be tested against specific error conditions
- Error recovery flows can be verified
- Timeout and retry logic can be validated
- Protocol compliance issues can be detected early

## Implementation Plan

### Phase 1: Base Infrastructure (This Task)
1. Add type definitions to `mock-types.ts`
2. Add internal types to `types.ts`
3. Add stub methods to `MockMCPServer` class
4. Add builder methods to `MockMCPServerBuilder`
5. Create `error-presets.ts` with preset definitions
6. Update exports in `index.ts`

### Phase 2: Implementation (Future Tasks)
1. Implement `checkErrorSimulation()` in MockBehaviorEngine
2. Integrate error simulation hooks into request pipeline
3. Implement network condition simulation
4. Add transport-level error simulation

### Phase 3: Testing (Future Tasks)
1. Unit tests for error simulation logic
2. Integration tests for preset scenarios
3. Performance tests for network condition simulation

## References

- [ADR-004: MCP Testing Architecture](./ADR-004-mcp-testing-architecture.md)
- [ADR-026: Mock Types (in mock-types.ts)](packages/core/src/mcp/mock-types.ts)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [JSON-RPC 2.0 Error Codes](https://www.jsonrpc.org/specification#error_object)
