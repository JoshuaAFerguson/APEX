# ADR-044: MCP Tool Invocation Routing Through MCPConnectionManager

## Status

Proposed

## Date

2025-01-18

## Context

### Acceptance Criteria

> When Claude Agent SDK invokes an MCP tool, the invocation is routed through MCPConnectionManager.executeTool(). Tool execution errors are properly handled.

### Current Architecture Analysis

The APEX orchestrator currently has a mature MCP infrastructure with several components:

1. **MCPConnectionManager** (`mcp/connection-manager.ts`): Manages MCP server connections with:
   - Connection lifecycle management (connect/disconnect)
   - Health monitoring with ping/pong heartbeats
   - Automatic reconnection with exponential backoff
   - Connection pooling support
   - Event emission for connection state changes

2. **MCPToolRegistry** (`mcp-tool-registry.ts`): Maintains a registry of MCP tools with:
   - Tool discovery from connected servers
   - Schema translation to Claude Agent SDK format
   - Tool availability tracking based on connection state

3. **MCPClient** (`mcp/client.ts`): Low-level JSON-RPC client with:
   - `listTools()` - Discover available tools
   - `callTool(name, args)` - Execute a tool
   - `ping()` - Health check

4. **MCPToolManager** (`tools/mcp-tool-manager.ts`): Higher-level tool management with:
   - Permission checking
   - Hook system for before/after execution
   - Tool registration with APEX tool registry

### Current Tool Invocation Flow

```
Current Flow (SDK-Managed):
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Agent SDK query()                      │
│  - mcpServers config passed via buildQueryMcpServers()          │
│  - SDK connects to MCP servers internally                        │
│  - SDK discovers tools via tools/list                           │
│  - SDK invokes tools directly via tools/call                    │
│  - Orchestrator has NO visibility into tool execution           │
└─────────────────────────────────────────────────────────────────┘
```

The SDK currently handles MCP tool invocation internally when `mcpServers` config is passed to `query()`. The orchestrator only sees tool invocations through message parsing (detecting `tool_use` and `tool_result` blocks in SDK responses).

### Problem Statement

The acceptance criteria requires that MCP tool invocations be **routed through** `MCPConnectionManager.executeTool()`. This provides:

1. **Centralized Error Handling**: Consistent error handling, logging, and recovery
2. **Observability**: Events emitted for tool execution start/complete/error
3. **Permission Enforcement**: Tool-level permission checks before execution
4. **Connection Management**: Use pre-warmed connections from the manager
5. **Metrics**: Track tool execution timing, success rates, etc.

### SDK Integration Challenge

The Claude Agent SDK does **not** provide a direct callback mechanism for MCP tool invocations. When you pass `mcpServers` to `query()`, the SDK:

1. Spawns/connects to MCP servers
2. Discovers tools
3. Invokes tools when Claude requests them
4. Returns results to Claude

There is no `onToolInvoke` callback or middleware API in the current SDK.

## Decision

### Architecture: SDK MCP Server Proxy Pattern

Create a **proxy SDK MCP server** that:
1. Exposes tools discovered from external MCP servers
2. Routes tool invocations through `MCPConnectionManager`
3. Handles errors and emits events

```
Proposed Architecture:
┌──────────────────────────────────────────────────────────────────┐
│                       SDK query() call                            │
│  options.mcpServers includes:                                     │
│    - mcp-proxy: SDK MCP Server (NEW)                             │
│    - customToolsServer, browserToolsServer (existing)            │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    MCP Proxy Server (NEW)                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Tool Definitions:                                          │  │
│  │    - Discovered from MCPToolRegistry                        │  │
│  │    - Schemas translated by SchemaTranslator                 │  │
│  │                                                              │  │
│  │  Tool Handler:                                               │  │
│  │    async (toolName, args) => {                              │  │
│  │      // Route through MCPConnectionManager                  │  │
│  │      return connectionManager.executeTool(serverId, name, args)  │  │
│  │    }                                                        │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                   MCPConnectionManager                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  executeTool(serverId, toolName, args):                     │  │
│  │    1. Validate connection state                             │  │
│  │    2. Emit 'mcp:tool-start' event                          │  │
│  │    3. Call client.callTool(toolName, args)                 │  │
│  │    4. Handle errors with proper categorization              │  │
│  │    5. Emit 'mcp:tool-complete' or 'mcp:tool-error' event   │  │
│  │    6. Return result                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                      MCPClient (existing)                         │
│  - JSON-RPC communication with external MCP server               │
│  - callTool() method for tools/call requests                    │
└──────────────────────────────────────────────────────────────────┘
```

### Implementation Design

#### 1. Add `executeTool()` Method to MCPConnectionManager

```typescript
// packages/orchestrator/src/mcp/connection-manager.ts

export interface MCPConnectionManagerEvents {
  // ... existing events ...

  /** Emitted when an MCP tool execution starts */
  'tool:start': (event: MCPToolStartEvent) => void;
  /** Emitted when an MCP tool execution completes */
  'tool:complete': (event: MCPToolCompleteEvent) => void;
  /** Emitted when an MCP tool execution fails */
  'tool:error': (event: MCPToolErrorEvent) => void;
}

export interface MCPToolStartEvent {
  serverId: string;
  serverName: string;
  toolName: string;
  args: Record<string, unknown>;
  callId: string;
  timestamp: Date;
}

export interface MCPToolCompleteEvent {
  serverId: string;
  serverName: string;
  toolName: string;
  callId: string;
  result: unknown;
  durationMs: number;
  timestamp: Date;
}

export interface MCPToolErrorEvent {
  serverId: string;
  serverName: string;
  toolName: string;
  callId: string;
  error: string;
  errorCode?: string;
  durationMs: number;
  timestamp: Date;
  retriable: boolean;
}

export class MCPConnectionManager extends EventEmitter<MCPConnectionManagerEvents> {
  // ... existing implementation ...

  /**
   * Execute a tool on a connected MCP server
   *
   * Routes tool invocations through the connection manager for:
   * - Centralized error handling
   * - Event emission for observability
   * - Connection state validation
   * - Metrics tracking
   *
   * @param serverId - ID of the server to execute on
   * @param toolName - Name of the tool to execute
   * @param args - Arguments to pass to the tool
   * @returns Tool execution result
   * @throws Error if connection not found, not connected, or execution fails
   */
  async executeTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const callId = this.generateCallId();
    const startTime = Date.now();
    const context = this.connections.get(serverId);

    if (!context) {
      throw new MCPToolExecutionError(
        `Connection '${serverId}' not found`,
        'CONNECTION_NOT_FOUND',
        false
      );
    }

    if (context.connection.state !== 'connected') {
      throw new MCPToolExecutionError(
        `Connection '${serverId}' is not connected (state: ${context.connection.state})`,
        'CONNECTION_NOT_READY',
        true // Retriable - connection may recover
      );
    }

    // Emit tool start event
    this.emit('tool:start', {
      serverId,
      serverName: context.connection.serverName,
      toolName,
      args,
      callId,
      timestamp: new Date(),
    });

    try {
      // Execute via MCPClient
      const result = await context.client.callTool(toolName, args);

      const durationMs = Date.now() - startTime;

      // Update metrics
      context.metrics.totalRequests++;

      // Emit success event
      this.emit('tool:complete', {
        serverId,
        serverName: context.connection.serverName,
        toolName,
        callId,
        result,
        durationMs,
        timestamp: new Date(),
      });

      return result;

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = this.categorizeError(error);
      const retriable = this.isRetriableError(errorCode);

      // Update metrics
      context.metrics.totalRequests++;
      context.metrics.totalErrors++;
      context.metrics.lastError = {
        message: errorMessage,
        timestamp: new Date(),
        code: errorCode,
      };

      // Emit error event
      this.emit('tool:error', {
        serverId,
        serverName: context.connection.serverName,
        toolName,
        callId,
        error: errorMessage,
        errorCode,
        durationMs,
        timestamp: new Date(),
        retriable,
      });

      throw new MCPToolExecutionError(errorMessage, errorCode, retriable);
    }
  }

  private generateCallId(): string {
    return `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private categorizeError(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('timeout')) return 'TIMEOUT';
      if (error.message.includes('disconnect')) return 'DISCONNECTED';
      if (error.message.includes('not found')) return 'TOOL_NOT_FOUND';
    }
    return 'EXECUTION_ERROR';
  }

  private isRetriableError(errorCode: string): boolean {
    return ['TIMEOUT', 'DISCONNECTED'].includes(errorCode);
  }
}

/**
 * Custom error class for MCP tool execution failures
 */
export class MCPToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retriable: boolean
  ) {
    super(message);
    this.name = 'MCPToolExecutionError';
  }
}
```

#### 2. Create MCP Proxy Server

```typescript
// packages/orchestrator/src/mcp-proxy-server.ts

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type { MCPConnectionManager } from './mcp/connection-manager';
import type { MCPToolRegistry, MCPToolRegistryEntry } from './mcp-tool-registry';

export interface MCPProxyServerOptions {
  /** Connection manager for routing tool calls */
  connectionManager: MCPConnectionManager;
  /** Tool registry for discovering available tools */
  toolRegistry: MCPToolRegistry;
  /** Name for this proxy server */
  name?: string;
}

export interface MCPProxyServer {
  name: string;
  config: ReturnType<typeof createSdkMcpServer>;
}

/**
 * Build an SDK MCP server that proxies tool calls through MCPConnectionManager
 *
 * This server exposes tools discovered from external MCP servers but routes
 * all invocations through the MCPConnectionManager for centralized handling.
 *
 * @param options - Configuration options
 * @returns SDK MCP server configuration
 */
export function buildMCPProxyServer(options: MCPProxyServerOptions): MCPProxyServer {
  const { connectionManager, toolRegistry, name = 'mcp-proxy' } = options;

  // Get all available tools from the registry
  const registryEntries = toolRegistry.getAvailableTools();

  // Create tool definitions that proxy through connectionManager
  const toolDefinitions = registryEntries.map(entry =>
    createProxiedTool(entry, connectionManager)
  );

  return {
    name,
    config: createSdkMcpServer({
      name,
      tools: toolDefinitions,
    }),
  };
}

/**
 * Create a proxied tool definition that routes through MCPConnectionManager
 */
function createProxiedTool(
  entry: MCPToolRegistryEntry,
  connectionManager: MCPConnectionManager
) {
  const { mcpTool, claudeTool, connectionId, serverName } = entry;

  return tool(
    // Use original tool name (may need namespacing for conflicts)
    claudeTool.name,
    // Use translated description
    claudeTool.description,
    // Use translated Zod schema
    claudeTool.parameters,
    // Handler routes through MCPConnectionManager
    async (args: unknown) => {
      try {
        const result = await connectionManager.executeTool(
          connectionId,
          mcpTool.name,
          args as Record<string, unknown>
        );

        // Format result for Claude Agent SDK
        return {
          content: [
            {
              type: 'text' as const,
              text: typeof result === 'string'
                ? result
                : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        // Return error in SDK format
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Dynamically update proxy server tools when registry changes
 *
 * Note: SDK MCP servers don't support dynamic tool updates after creation.
 * This function creates a new server config that replaces the existing one.
 */
export function refreshMCPProxyServer(
  currentServer: MCPProxyServer,
  options: MCPProxyServerOptions
): MCPProxyServer {
  return buildMCPProxyServer({
    ...options,
    name: currentServer.name,
  });
}
```

#### 3. Integrate into ApexOrchestrator

```typescript
// packages/orchestrator/src/index.ts (additions)

// In buildQueryMcpServers():
private buildQueryMcpServers(): Record<string, McpServerConfig> | undefined {
  const servers: Record<string, McpServerConfig> = {};

  // ... existing server configs ...

  // Add MCP proxy server for routing external MCP tool calls
  if (this.mcpConnectionManager && this.mcpToolRegistry) {
    const proxyServer = buildMCPProxyServer({
      connectionManager: this.mcpConnectionManager,
      toolRegistry: this.mcpToolRegistry,
    });

    if (proxyServer) {
      servers[proxyServer.name] = proxyServer.config;
    }
  }

  return Object.keys(servers).length > 0 ? servers : undefined;
}

// Forward MCPConnectionManager tool events to orchestrator events:
private setupMCPToolEventForwarding(): void {
  if (!this.mcpConnectionManager) return;

  this.mcpConnectionManager.on('tool:start', (event) => {
    // Forward as orchestrator event for API/CLI streaming
    this.emit('mcp:tool-start', {
      serverId: event.serverId,
      serverName: event.serverName,
      toolName: event.toolName,
      callId: event.callId,
      timestamp: event.timestamp,
    });
  });

  this.mcpConnectionManager.on('tool:complete', (event) => {
    this.emit('mcp:tool-complete', {
      serverId: event.serverId,
      serverName: event.serverName,
      toolName: event.toolName,
      callId: event.callId,
      durationMs: event.durationMs,
      timestamp: event.timestamp,
    });
  });

  this.mcpConnectionManager.on('tool:error', (event) => {
    this.emit('mcp:tool-error', {
      serverId: event.serverId,
      serverName: event.serverName,
      toolName: event.toolName,
      callId: event.callId,
      error: event.error,
      errorCode: event.errorCode,
      retriable: event.retriable,
      timestamp: event.timestamp,
    });
  });
}
```

### Error Handling Strategy

#### Error Categories

| Error Code | Description | Retriable | Action |
|-----------|-------------|-----------|--------|
| `CONNECTION_NOT_FOUND` | Server ID not in connection manager | No | Check configuration |
| `CONNECTION_NOT_READY` | Connection exists but not in 'connected' state | Yes | Wait for reconnection |
| `TIMEOUT` | Tool execution timed out | Yes | Retry with backoff |
| `DISCONNECTED` | Connection lost during execution | Yes | Trigger reconnection |
| `TOOL_NOT_FOUND` | Tool name not recognized by server | No | Check tool name |
| `EXECUTION_ERROR` | Tool returned an error | Depends | Return to Claude |

#### Error Propagation

1. **MCPClient** throws raw errors from JSON-RPC
2. **MCPConnectionManager.executeTool()** catches, categorizes, emits events
3. **MCP Proxy Server** catches and formats for SDK
4. **Claude Agent SDK** receives formatted error response
5. **Claude** decides how to proceed (retry, report to user, etc.)

### Event Flow

```
Tool Invocation Event Flow:

1. Claude requests tool via SDK
         │
         ▼
2. MCP Proxy Server receives request
         │
         ▼
3. MCPConnectionManager.executeTool() called
   │
   ├─► 'tool:start' event emitted
   │
   ▼
4. MCPClient.callTool() executes
   │
   ├─► Success ──► 'tool:complete' event emitted
   │
   └─► Error ──► 'tool:error' event emitted
         │
         ▼
5. Result/Error returned to MCP Proxy Server
         │
         ▼
6. Formatted response returned to SDK
         │
         ▼
7. Claude receives result
```

### Configuration

No new configuration is required. The MCP proxy server is automatically enabled when:

1. `MCPConnectionManager` is initialized (MCP enabled in config)
2. `MCPToolRegistry` has discovered tools from connected servers

The proxy server integrates seamlessly with the existing `buildQueryMcpServers()` flow.

## Alternatives Considered

### Alternative A: SDK Hook/Middleware API

**Description**: Request Anthropic to add a tool invocation callback to the Claude Agent SDK.

**Why Rejected**:
- Depends on external SDK changes
- Unknown timeline for implementation
- Current architecture achieves the goal without SDK changes

### Alternative B: Bypass SDK MCP Handling

**Description**: Don't pass external MCP servers to SDK at all; handle all tool calls via custom tools.

**Why Rejected**:
- Loses SDK's automatic tool discovery
- Requires duplicating SDK tool handling logic
- More complex implementation

### Alternative C: Message Interception

**Description**: Intercept SDK messages to detect tool invocations and execute them separately.

**Why Rejected**:
- Fragile - depends on SDK message format
- Race conditions with SDK's internal handling
- Would require blocking SDK's own MCP handling

## Consequences

### Positive

1. **Centralized Control**: All MCP tool invocations routed through single point
2. **Observability**: Events emitted for start/complete/error
3. **Error Handling**: Consistent error categorization and reporting
4. **Metrics**: Tool execution metrics tracked per connection
5. **Extensibility**: Easy to add permission checks, rate limiting, etc.
6. **Backward Compatible**: Existing tool discovery and SDK integration unchanged

### Negative

1. **Slight Overhead**: Additional indirection for tool calls
2. **Tool Duplication**: Same tools visible from both external server and proxy
3. **Dynamic Updates**: SDK MCP servers don't support runtime tool updates

### Mitigations

1. **Performance**: Overhead is minimal (event emission + function call)
2. **Duplication**: Can filter external servers from `buildQueryMcpServers()` if using proxy
3. **Dynamic Updates**: Registry refresh triggers proxy server recreation

## Implementation Plan

| Phase | Task | Files |
|-------|------|-------|
| 1 | Add `executeTool()` to MCPConnectionManager | `mcp/connection-manager.ts` |
| 2 | Add tool event types to connection manager | `mcp/connection-manager.ts` |
| 3 | Create MCPToolExecutionError class | `mcp/connection-manager.ts` |
| 4 | Create MCP proxy server module | `mcp-proxy-server.ts` (NEW) |
| 5 | Integrate proxy server into buildQueryMcpServers() | `index.ts` |
| 6 | Add orchestrator event forwarding | `index.ts` |
| 7 | Add orchestrator event types | `index.ts` |
| 8 | Export new types | `index.ts` |
| 9 | Unit tests for executeTool() | `mcp/__tests__/connection-manager.executeTool.test.ts` |
| 10 | Unit tests for proxy server | `__tests__/mcp-proxy-server.test.ts` |
| 11 | Integration tests | `__tests__/mcp-tool-routing.integration.test.ts` |

## Test Strategy

### Unit Tests

1. **MCPConnectionManager.executeTool()**
   - Success path returns result
   - Emits 'tool:start' event
   - Emits 'tool:complete' on success
   - Emits 'tool:error' on failure
   - Throws MCPToolExecutionError on failure
   - Validates connection state before execution
   - Updates metrics on success/failure

2. **MCP Proxy Server**
   - Creates tool definitions from registry
   - Routes tool calls through connection manager
   - Formats successful results for SDK
   - Formats errors for SDK

### Integration Tests

1. **End-to-End Tool Routing**
   - Claude requests MCP tool
   - Proxy server receives request
   - Connection manager executes tool
   - Result returned to Claude
   - Events emitted throughout flow

2. **Error Handling**
   - Connection not found
   - Connection disconnected mid-execution
   - Tool execution timeout
   - Tool returns error

## Related ADRs

- ADR-040: MCP Schema to Claude Agent SDK Tool Format Translator
- ADR-041: MCP Tool Discovery and ApexOrchestrator Integration
- ADR-042: MCP Tools Query Integration
- ADR-043: MCP Client Utility for Server Connection and Tool Discovery
- ADR-038: Tool Execution Hooks for Orchestrator Event System

## References

- Claude Agent SDK `createSdkMcpServer()` API
- Existing `MCPConnectionManager` implementation
- Existing `MCPToolRegistry` implementation
- Existing `buildQueryMcpServers()` in ApexOrchestrator
