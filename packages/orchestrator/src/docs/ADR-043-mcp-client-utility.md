# ADR-043: MCP Client Utility for Server Connection and Tool Discovery

## Status
Proposed

## Date
2025-01-18

## Context

The APEX orchestrator needs a simplified, high-level utility API for connecting to MCP (Model Context Protocol) servers and discovering their available tools. While the existing infrastructure provides robust low-level components:

1. **MCPClient** (`mcp/client.ts`): JSON-RPC client for MCP protocol communication
2. **StdioTransport** (`mcp/transports/stdio-transport.ts`): Child process stdio transport for spawning MCP servers
3. **MCPConnectionManager** (`mcp/connection-manager.ts`): Full-featured connection lifecycle manager with pooling, health monitoring, and reconnection

The acceptance criteria require a **utility** file that provides a simplified API to:
- Spawn MCP server processes
- Establish JSON-RPC connections
- Call `tools/list` to retrieve available tools

This utility should act as a **facade** that wraps the existing infrastructure for common use cases without requiring the full complexity of `MCPConnectionManager`.

## Decision

### Architecture Overview

Create a new `mcp-client.ts` utility in the orchestrator package that provides a simplified, stateless API for one-off MCP server interactions:

```
packages/orchestrator/src/
├── mcp-client.ts          # NEW: Simplified MCP client utility
├── mcp/
│   ├── client.ts          # Low-level JSON-RPC client (existing)
│   ├── connection-manager.ts  # Full connection management (existing)
│   └── transports/
│       └── stdio-transport.ts # Process transport (existing)
```

### Use Case Comparison

| Use Case | Recommended Component |
|----------|----------------------|
| One-off tool discovery | `mcp-client.ts` (NEW) |
| Quick connection for testing | `mcp-client.ts` (NEW) |
| Long-lived managed connections | `MCPConnectionManager` |
| Connection pooling & health monitoring | `MCPConnectionManager` |
| Integration with ApexOrchestrator | `MCPConnectionManager` + `MCPToolRegistry` |

### Interface Design

```typescript
// packages/orchestrator/src/mcp-client.ts

import type { MCPToolDefinition } from './mcp/client.js';

/**
 * Options for creating an MCP client connection
 */
export interface MCPClientUtilOptions {
  /** Command to spawn the MCP server (e.g., 'npx', 'node', 'python') */
  command: string;
  /** Arguments for the command */
  args?: string[];
  /** Working directory for the spawned process */
  cwd?: string;
  /** Environment variables to pass to the process */
  env?: Record<string, string>;
  /** Connection timeout in milliseconds (default: 10000) */
  connectionTimeoutMs?: number;
  /** Request timeout in milliseconds (default: 30000) */
  requestTimeoutMs?: number;
}

/**
 * Result of discovering tools from an MCP server
 */
export interface MCPToolDiscoveryResult {
  /** List of discovered tools */
  tools: MCPToolDefinition[];
  /** Server process ID (if applicable) */
  pid?: number;
  /** Time taken to discover tools in milliseconds */
  durationMs: number;
}

/**
 * Active MCP connection handle for advanced usage
 */
export interface MCPConnectionHandle {
  /** List available tools from the server */
  listTools(): Promise<MCPToolDefinition[]>;
  /** Call a tool with arguments */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  /** Ping the server for health check */
  ping(): Promise<void>;
  /** Close the connection and terminate the server process */
  close(): Promise<void>;
  /** Get the process ID of the MCP server */
  getPid(): number | undefined;
}

/**
 * Discover tools from an MCP server (one-off operation)
 *
 * Spawns the MCP server, connects, lists tools, and disconnects.
 * Use this for quick tool discovery without maintaining a connection.
 *
 * @example
 * ```typescript
 * const result = await discoverMCPTools({
 *   command: 'npx',
 *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
 * });
 * console.log('Discovered tools:', result.tools);
 * ```
 */
export async function discoverMCPTools(
  options: MCPClientUtilOptions
): Promise<MCPToolDiscoveryResult>;

/**
 * Connect to an MCP server and return a connection handle
 *
 * Use this when you need to make multiple calls to the server.
 * Remember to call `handle.close()` when done.
 *
 * @example
 * ```typescript
 * const connection = await connectMCPServer({
 *   command: 'node',
 *   args: ['./my-mcp-server.js'],
 * });
 *
 * try {
 *   const tools = await connection.listTools();
 *   const result = await connection.callTool('read_file', { path: '/tmp/test.txt' });
 * } finally {
 *   await connection.close();
 * }
 * ```
 */
export async function connectMCPServer(
  options: MCPClientUtilOptions
): Promise<MCPConnectionHandle>;

/**
 * Spawn an MCP server process and establish a JSON-RPC connection
 *
 * Low-level function that returns both the transport and client.
 * Use `connectMCPServer` for most use cases.
 */
export async function spawnMCPServer(
  options: MCPClientUtilOptions
): Promise<{
  transport: MCPTransport;
  client: MCPClient;
}>;
```

### Implementation Strategy

The implementation will be a thin wrapper around existing components:

```typescript
// Simplified implementation outline

import { StdioTransport, type StdioTransportOptions } from './mcp/transports/index.js';
import { MCPClient, type MCPToolDefinition } from './mcp/client.js';
import type { MCPTransport } from './mcp/transports/transport.js';

export async function discoverMCPTools(
  options: MCPClientUtilOptions
): Promise<MCPToolDiscoveryResult> {
  const startTime = Date.now();
  const connection = await connectMCPServer(options);

  try {
    const tools = await connection.listTools();
    return {
      tools,
      pid: connection.getPid(),
      durationMs: Date.now() - startTime,
    };
  } finally {
    await connection.close();
  }
}

export async function connectMCPServer(
  options: MCPClientUtilOptions
): Promise<MCPConnectionHandle> {
  const { transport, client } = await spawnMCPServer(options);

  return {
    listTools: () => client.listTools(),
    callTool: (name, args) => client.callTool(name, args),
    ping: () => client.ping(),
    close: async () => {
      await client.disconnect();
    },
    getPid: () => (transport as StdioTransport).getProcessId(),
  };
}

export async function spawnMCPServer(
  options: MCPClientUtilOptions
): Promise<{ transport: MCPTransport; client: MCPClient }> {
  const transportOptions: StdioTransportOptions = {
    command: options.command,
    args: options.args ?? [],
    cwd: options.cwd ?? process.cwd(),
    env: options.env,
    connectionTimeout: options.connectionTimeoutMs ?? 10000,
  };

  const transport = new StdioTransport(transportOptions);
  const client = new MCPClient({
    transport,
    timeoutMs: options.requestTimeoutMs ?? 30000,
  });

  await client.connect();

  return { transport, client };
}
```

### Error Handling

The utility will propagate errors from the underlying components:

| Error Type | Source | Handling |
|-----------|--------|----------|
| `MCPTransportError` with code `SPAWN_FAILED` | StdioTransport | Command not found or process crashed immediately |
| `MCPTransportError` with code `TIMEOUT` | StdioTransport | Connection timeout during spawn |
| `Error` with "MCP request timeout" | MCPClient | Server not responding to JSON-RPC requests |
| `Error` with JSON-RPC error message | MCPClient | Server returned an error response |

### Integration with Existing Infrastructure

The utility can be used alongside `MCPConnectionManager`:

1. **Quick Discovery**: Use `discoverMCPTools()` for one-off tool inspection
2. **Testing**: Use `connectMCPServer()` in tests for controlled server lifecycle
3. **Production**: Use `MCPConnectionManager` for managed, resilient connections

```typescript
// Example: Quick tool inspection during setup
import { discoverMCPTools } from './mcp-client.js';
import { MCPConnectionManager } from './mcp/connection-manager.js';

// Quick discovery for validation
const result = await discoverMCPTools({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
});

if (result.tools.length > 0) {
  // Use full connection manager for production
  const manager = new MCPConnectionManager({ ... });
  await manager.connect('github');
}
```

### Exports

Add the new utility to the package exports:

```typescript
// packages/orchestrator/src/index.ts (additions)

export {
  discoverMCPTools,
  connectMCPServer,
  spawnMCPServer,
  type MCPClientUtilOptions,
  type MCPToolDiscoveryResult,
  type MCPConnectionHandle,
} from './mcp-client.js';
```

## Consequences

### Positive

- **Simplified API**: Easy-to-use functions for common MCP operations
- **No Duplication**: Reuses existing `MCPClient` and `StdioTransport`
- **Stateless Option**: `discoverMCPTools()` handles full lifecycle automatically
- **Type-Safe**: Full TypeScript types with clear interfaces
- **Testable**: Simple functions that are easy to test in isolation

### Negative

- **Additional Surface Area**: New functions to maintain and document
- **Potential Confusion**: Users must choose between utility and `MCPConnectionManager`

### Mitigations

- Clear JSDoc documentation explaining when to use each option
- Examples in documentation showing appropriate use cases
- Utility explicitly documented as "simple wrapper" over existing infrastructure

## Test Strategy

### Unit Tests

1. **discoverMCPTools()**: Test successful discovery with mock server
2. **connectMCPServer()**: Test connection lifecycle
3. **spawnMCPServer()**: Test low-level spawn functionality
4. **Error scenarios**: Test timeout, spawn failure, server error

### Integration Tests

1. **Real MCP Server**: Test with actual MCP server (e.g., filesystem server)
2. **Tool Execution**: Test `callTool()` with real server

### Test File Location

```
packages/orchestrator/src/__tests__/mcp-client.test.ts
```

## Files to Create/Modify

### New Files

- `packages/orchestrator/src/mcp-client.ts` - Main utility implementation
- `packages/orchestrator/src/__tests__/mcp-client.test.ts` - Unit tests

### Modified Files

- `packages/orchestrator/src/index.ts` - Add exports for new utility

## Related ADRs

- ADR-040: MCP Schema to Claude Agent SDK Tool Format Translator
- ADR-041: MCP Tool Discovery and ApexOrchestrator Integration
- ADR-042: MCP Tools Query Integration
- ADR-001 (mcp/): MCP Transport Architecture

## References

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- Existing `MCPClient` implementation in `mcp/client.ts`
- Existing `StdioTransport` implementation in `mcp/transports/stdio-transport.ts`
