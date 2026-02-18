# ADR-080: Preset-Based Mock MCP Server Factory

## Status
**Proposed**

## Context

APEX's MCP testing infrastructure currently provides multiple ways to create mock servers:

1. **Factory Functions**: `createSimpleMockServer()`, `createErrorMockServer()`, `createSlowMockServer()`
2. **Builder Pattern**: `MockMCPServerBuilder` with fluent API
3. **Direct Construction**: `new MockMCPServerFacade(definition)`

While these APIs are powerful, they require users to understand the underlying configuration structure. For common testing scenarios, developers want a single function call that creates a fully-configured mock server with sensible defaults.

### Problem Statement

The task is to create a `createMockMCPServer()` factory function that:
1. Supports **built-in presets** (filesystem, database, api, minimal, error-prone, slow)
2. Enables **single function call** server creation using preset names
3. Allows **custom config overrides** on top of preset defaults

### Existing Architecture

The mock server infrastructure is already well-designed with:
- **Type Definitions**: `@apexcli/core/mcp/mock-types.ts` - Zod schemas for all configuration
- **Error Presets**: `error-presets.ts` - 18 predefined error scenarios
- **Builder**: `mock-mcp-server-builder.ts` - Fluent configuration API
- **Facade**: `mock-server-facade.ts` - Single-client convenience API
- **Multi-client Server**: `mock-mcp-server.ts` - Full server with connection lifecycle

## Decision

### 1. Create Server Preset System

Define server presets in a new file `packages/orchestrator/src/mcp/mock-server/server-presets.ts`:

```typescript
// Server preset names
export type MockServerPreset =
  | 'filesystem'   // File system tools (read_file, write_file, list_directory)
  | 'database'     // Database tools (query, insert, update, delete)
  | 'api'          // HTTP API tools (get, post, put, delete)
  | 'minimal'      // Empty server, no tools, minimal config
  | 'error-prone'  // Server configured to fail frequently
  | 'slow';        // Server with high latency for timeout testing

// Preset configuration structure
export interface ServerPresetConfig {
  name: string;
  description: string;
  serverConfig: Partial<MockMCPServerConfig>;
  behaviorConfig: Partial<MockBehaviorConfig>;
  toolHandlers: MockToolHandler[];
  dynamicHandlers?: MockDynamicHandler[];
  errorSimulation?: MockErrorSimulationConfig;
}
```

### 2. Define Built-in Presets

| Preset | Purpose | Tools | Behavior |
|--------|---------|-------|----------|
| `filesystem` | File system operations | `read_file`, `write_file`, `list_directory`, `delete_file` | Normal delays, realistic responses |
| `database` | Database operations | `query`, `insert`, `update`, `delete`, `list_tables` | Slight delays, structured results |
| `api` | HTTP/REST operations | `http_get`, `http_post`, `http_put`, `http_delete` | Variable delays, status codes |
| `minimal` | Bare minimum server | None | No delays, no tools, minimal config |
| `error-prone` | Error testing | Inherits from other presets | High error injection (30%), random failures |
| `slow` | Timeout/performance testing | Inherits from other presets | 500-2000ms delays |

### 3. Factory Function API

```typescript
/**
 * Create a mock MCP server from a preset configuration.
 *
 * @param preset - Preset name or configuration
 * @param overrides - Optional configuration overrides
 * @returns Configured MockMCPServerFacade
 *
 * @example
 * // Basic usage with preset name
 * const server = createMockMCPServer('filesystem');
 *
 * // With custom server name
 * const server = createMockMCPServer('database', { name: 'my-db-server' });
 *
 * // Combining presets (error-prone filesystem)
 * const server = createMockMCPServer('filesystem', {
 *   behavior: { preset: 'error-prone' }
 * });
 *
 * // Custom tool handlers on top of preset
 * const server = createMockMCPServer('api', {
 *   additionalTools: [
 *     { toolName: 'custom_endpoint', response: { content: [...] } }
 *   ]
 * });
 */
export function createMockMCPServer(
  preset: MockServerPreset | MockServerPreset[],
  overrides?: CreateMockServerOptions
): MockMCPServerFacade;
```

### 4. Override Options Interface

```typescript
export interface CreateMockServerOptions {
  /** Custom server name (overrides preset default) */
  name?: string;

  /** Custom description */
  description?: string;

  /** Additional tool handlers to add to preset */
  additionalTools?: MockToolHandler[];

  /** Override preset tool handlers (by tool name) */
  toolOverrides?: Record<string, Partial<MockToolHandler>>;

  /** Behavior preset to apply (e.g., 'error-prone', 'slow') */
  behaviorPreset?: 'error-prone' | 'slow';

  /** Custom delay configuration */
  delay?: number | { min: number; max: number };

  /** Error simulation configuration */
  errorSimulation?: MockErrorSimulationConfig;

  /** Error preset to apply */
  errorPreset?: MockErrorScenarioPreset;

  /** Server capabilities override */
  capabilities?: MCPServerCapabilities;

  /** Named scenarios to add */
  scenarios?: Array<{
    name: string;
    behaviorPreset?: 'error-prone' | 'slow';
    errorPreset?: MockErrorScenarioPreset;
  }>;
}
```

### 5. Preset Composition

The factory supports combining presets:

```typescript
// Combine filesystem tools with slow behavior
const server = createMockMCPServer(['filesystem', 'slow']);

// Combine database tools with error-prone behavior
const server = createMockMCPServer(['database', 'error-prone']);
```

### 6. Implementation Strategy

The implementation leverages existing infrastructure:

```typescript
export function createMockMCPServer(
  preset: MockServerPreset | MockServerPreset[],
  overrides?: CreateMockServerOptions
): MockMCPServerFacade {
  // 1. Normalize preset to array
  const presets = Array.isArray(preset) ? preset : [preset];

  // 2. Get base preset configuration
  const basePreset = getServerPreset(presets[0]);

  // 3. Apply behavior modifiers (slow, error-prone)
  let config = applyBehaviorPresets(basePreset, presets.slice(1));

  // 4. Apply overrides
  config = applyOverrides(config, overrides);

  // 5. Use builder to create server (leverages existing infrastructure)
  const builder = new MockMCPServerBuilder()
    .withName(config.name, config.description)
    .withCapabilities(config.capabilities);

  // Add tools from preset
  for (const handler of config.toolHandlers) {
    // ... add tool configuration
  }

  // Apply behavior configuration
  if (config.delay) {
    builder.withDelay(config.delay.fixed, config.delay.max);
  }

  if (config.errorSimulation) {
    builder.withErrorSimulation(config.errorSimulation);
  }

  return builder.build();
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        createMockMCPServer()                            │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────────────┐   │
│  │   Preset     │ +  │   Behavior   │ +  │     Overrides           │   │
│  │  Selection   │    │   Modifiers  │    │   (optional)            │   │
│  └──────────────┘    └──────────────┘    └─────────────────────────┘   │
│         │                    │                       │                 │
│         └────────────────────┼───────────────────────┘                 │
│                              ▼                                         │
│                    ┌──────────────────┐                                │
│                    │   Configuration  │                                │
│                    │     Merger       │                                │
│                    └──────────────────┘                                │
│                              │                                         │
│                              ▼                                         │
│                    ┌──────────────────┐                                │
│                    │ MockMCPServer    │                                │
│                    │    Builder       │ (existing infrastructure)      │
│                    └──────────────────┘                                │
│                              │                                         │
│                              ▼                                         │
│                    ┌──────────────────┐                                │
│                    │ MockMCPServer    │                                │
│                    │    Facade        │ (returned to user)             │
│                    └──────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
packages/orchestrator/src/mcp/mock-server/
├── server-presets.ts          # NEW: Server preset definitions
├── preset-factory.ts          # NEW: createMockMCPServer() implementation
├── index.ts                   # Updated: Export new factory
├── mock-server-facade.ts      # Existing
├── mock-mcp-server-builder.ts # Existing
├── error-presets.ts           # Existing
└── ...
```

## Preset Definitions

### filesystem Preset

```typescript
export const FILESYSTEM_PRESET: ServerPresetConfig = {
  name: 'filesystem-server',
  description: 'Mock server with file system operations',
  serverConfig: {
    capabilities: { tools: { listChanged: true } },
  },
  behaviorConfig: {
    responseDelay: { fixedMs: 10, jitter: true },
  },
  toolHandlers: [
    {
      toolName: 'read_file',
      response: {
        content: [{ type: 'text', text: 'Mock file content' }],
        isError: false,
      },
    },
    {
      toolName: 'write_file',
      response: {
        content: [{ type: 'text', text: 'File written successfully' }],
        isError: false,
      },
    },
    {
      toolName: 'list_directory',
      response: {
        content: [{ type: 'text', text: 'file1.txt\nfile2.txt\ndir1/' }],
        isError: false,
      },
    },
    {
      toolName: 'delete_file',
      response: {
        content: [{ type: 'text', text: 'File deleted' }],
        isError: false,
      },
    },
  ],
};
```

### database Preset

```typescript
export const DATABASE_PRESET: ServerPresetConfig = {
  name: 'database-server',
  description: 'Mock server with database operations',
  serverConfig: {
    capabilities: { tools: { listChanged: true } },
  },
  behaviorConfig: {
    responseDelay: { fixedMs: 25, jitter: true },
  },
  toolHandlers: [
    {
      toolName: 'query',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({ rows: [{ id: 1, name: 'test' }], count: 1 })
        }],
        isError: false,
      },
    },
    {
      toolName: 'insert',
      response: {
        content: [{ type: 'text', text: '{"inserted": 1, "id": 1}' }],
        isError: false,
      },
    },
    {
      toolName: 'update',
      response: {
        content: [{ type: 'text', text: '{"updated": 1}' }],
        isError: false,
      },
    },
    {
      toolName: 'delete',
      response: {
        content: [{ type: 'text', text: '{"deleted": 1}' }],
        isError: false,
      },
    },
    {
      toolName: 'list_tables',
      response: {
        content: [{ type: 'text', text: '["users", "posts", "comments"]' }],
        isError: false,
      },
    },
  ],
};
```

### api Preset

```typescript
export const API_PRESET: ServerPresetConfig = {
  name: 'api-server',
  description: 'Mock server with HTTP/REST operations',
  serverConfig: {
    capabilities: { tools: { listChanged: true } },
  },
  behaviorConfig: {
    responseDelay: { minMs: 50, maxMs: 200, jitter: true },
  },
  toolHandlers: [
    {
      toolName: 'http_get',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({ status: 200, body: { message: 'OK' } })
        }],
        isError: false,
      },
    },
    {
      toolName: 'http_post',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({ status: 201, body: { id: 1, created: true } })
        }],
        isError: false,
      },
    },
    {
      toolName: 'http_put',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({ status: 200, body: { updated: true } })
        }],
        isError: false,
      },
    },
    {
      toolName: 'http_delete',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({ status: 204 })
        }],
        isError: false,
      },
    },
  ],
};
```

### minimal Preset

```typescript
export const MINIMAL_PRESET: ServerPresetConfig = {
  name: 'minimal-server',
  description: 'Minimal mock server with no tools',
  serverConfig: {
    capabilities: {},
  },
  behaviorConfig: {
    responseDelay: { fixedMs: 0 },
    recordRequests: true,
    validateRequests: true,
  },
  toolHandlers: [],
};
```

### error-prone Behavior Modifier

```typescript
export const ERROR_PRONE_MODIFIER: Partial<ServerPresetConfig> = {
  behaviorConfig: {
    errorInjection: {
      enabled: true,
      probability: 0.3,
      errorCode: -32603,
      errorMessage: 'Simulated error for testing',
      methods: [],
      afterRequestCount: 0,
      maxErrors: 0,
      simulateConnectionFailure: false,
      errorDelayMs: 0,
    },
  },
};
```

### slow Behavior Modifier

```typescript
export const SLOW_MODIFIER: Partial<ServerPresetConfig> = {
  behaviorConfig: {
    responseDelay: {
      minMs: 500,
      maxMs: 2000,
      jitter: true,
    },
  },
};
```

## Consequences

### Positive

1. **Simpler API**: Single function call for common scenarios
2. **Discoverability**: Preset names are self-documenting
3. **Consistency**: Standard configurations for common use cases
4. **Flexibility**: Override capability preserves power-user options
5. **Composition**: Behavior modifiers (slow, error-prone) work with any base preset
6. **Backwards Compatible**: Existing APIs remain unchanged

### Negative

1. **Additional Abstraction**: One more layer on top of existing infrastructure
2. **Maintenance**: Presets need updates as tool patterns evolve
3. **Learning Curve**: Users must understand preset composition

### Neutral

1. **No Breaking Changes**: Purely additive to existing API
2. **Leverages Existing Code**: Built on top of MockMCPServerBuilder

## Implementation Notes

### For Developer Stage

1. Create `server-presets.ts` with preset definitions
2. Create `preset-factory.ts` with `createMockMCPServer()` function
3. Update `index.ts` to export new types and function
4. Create comprehensive tests in `__tests__/preset-factory.test.ts`

### Testing Requirements

```typescript
describe('createMockMCPServer', () => {
  describe('basic preset usage', () => {
    it('creates filesystem server from preset', () => {});
    it('creates database server from preset', () => {});
    it('creates api server from preset', () => {});
    it('creates minimal server from preset', () => {});
  });

  describe('behavior modifiers', () => {
    it('applies slow modifier to base preset', () => {});
    it('applies error-prone modifier to base preset', () => {});
    it('combines multiple behavior modifiers', () => {});
  });

  describe('override options', () => {
    it('allows custom server name', () => {});
    it('adds additional tools to preset', () => {});
    it('overrides preset tool handlers', () => {});
    it('applies custom delay configuration', () => {});
    it('applies error simulation configuration', () => {});
    it('applies error preset', () => {});
  });

  describe('integration', () => {
    it('server responds to tool calls correctly', () => {});
    it('error-prone server injects errors', () => {});
    it('slow server has expected latency', () => {});
  });
});
```

## Related ADRs

- **ADR-026**: Mock MCP Server Configuration Types
- **ADR-072**: Error Simulation for Mock MCP Servers
