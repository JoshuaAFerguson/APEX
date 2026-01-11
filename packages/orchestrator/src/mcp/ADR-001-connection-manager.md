# ADR-001: MCPConnectionManager Core Class Design

## Status
Proposed

## Context

APEX needs a centralized manager to handle MCP (Model Context Protocol) server connections. The orchestrator requires the ability to:

1. Discover available MCP servers from configuration
2. Establish and manage connections to multiple servers
3. Handle connection lifecycle events (connect, disconnect, error, reconnect)
4. Provide a unified API for connection management

### Existing Infrastructure

The codebase already provides:
- **MCPTransport** (abstract base class) - Defines transport contract with state management, events, and reconnection support
- **StdioTransport** - Stdio-based transport implementation for child process communication
- **MCPClient** - JSON-RPC client wrapper around transports for tool invocation
- **MCPServerManager** - Configuration-based server management (marketplace, install, uninstall)
- **MCPServerStore** - SQLite persistence for MCP installations

### Acceptance Criteria
- MCPConnectionManager class with methods:
  - `discoverServers()` - Discover available servers from config
  - `connect(serverId)` - Connect to a specific server
  - `disconnect(serverId)` - Disconnect from a server
  - `getConnection(serverId)` - Get a connection by ID
  - `listConnections()` - List all current connections
- Extends EventEmitter3 and emits connection events:
  - `connected` - Server connected successfully
  - `disconnected` - Server disconnected
  - `error` - Connection error occurred
  - `reconnecting` - Attempting reconnection

## Decision

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCPConnectionManager                         │
│  - Manages connection lifecycle for multiple servers             │
│  - Emits connection events to orchestrator                       │
│  - Handles auto-reconnection with exponential backoff            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Connection 1 │  │ Connection 2 │  │ Connection N │          │
│  │  - client    │  │  - client    │  │  - client    │          │
│  │  - transport │  │  - transport │  │  - transport │          │
│  │  - state     │  │  - state     │  │  - state     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ MCPTransport │     │ MCPTransport │     │ MCPTransport │
│  (Stdio/SSE) │     │  (Stdio/SSE) │     │  (Stdio/SSE) │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Type Definitions

New types to be added to `@apexcli/core` types:

```typescript
/**
 * Connection state for an MCP server
 */
export type MCPConnectionState =
  | 'disconnected'  // Not connected
  | 'connecting'    // Connection in progress
  | 'connected'     // Connected and ready
  | 'reconnecting'  // Attempting reconnection
  | 'error';        // Error state

/**
 * Represents an active MCP connection
 */
export interface MCPConnection {
  /** Server identifier (config key name) */
  serverId: string;
  /** Server name from config */
  serverName: string;
  /** Server configuration */
  config: MCPServerConfig;
  /** Current connection state */
  state: MCPConnectionState;
  /** When the connection was established */
  connectedAt?: Date;
  /** When the connection was last active */
  lastActivityAt?: Date;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Last error if in error state */
  lastError?: string;
}

/**
 * Connection event data
 */
export interface MCPConnectionEvent {
  type: 'connected' | 'disconnected' | 'error' | 'reconnecting';
  serverId: string;
  serverName: string;
  previousState: MCPConnectionState;
  newState: MCPConnectionState;
  timestamp: Date;
  message?: string;
  error?: Error;
}
```

### MCPConnectionManager Interface

```typescript
import { EventEmitter } from 'eventemitter3';

export interface MCPConnectionManagerOptions {
  /** Project root path */
  projectPath: string;
  /** APEX configuration */
  config: ApexConfig;
  /** Whether to automatically reconnect on disconnection */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts (default: 3) */
  maxReconnectAttempts?: number;
  /** Initial reconnection delay in ms (default: 1000) */
  reconnectDelayMs?: number;
  /** Maximum reconnection delay in ms (default: 30000) */
  maxReconnectDelayMs?: number;
}

export interface MCPConnectionManagerEvents {
  'connected': (connection: MCPConnection) => void;
  'disconnected': (serverId: string, reason?: string) => void;
  'error': (serverId: string, error: Error) => void;
  'reconnecting': (serverId: string, attempt: number, maxAttempts: number) => void;
}

export class MCPConnectionManager extends EventEmitter<MCPConnectionManagerEvents> {
  constructor(options: MCPConnectionManagerOptions);

  /**
   * Discover available MCP servers from configuration
   * Reads from config.mcp.servers and returns enabled server configs
   */
  discoverServers(): MCPServerConfig[];

  /**
   * Connect to a specific MCP server
   * Creates transport, establishes connection, and tracks state
   */
  connect(serverId: string): Promise<MCPConnection>;

  /**
   * Disconnect from a specific MCP server
   * Gracefully closes the connection and cleans up resources
   */
  disconnect(serverId: string): Promise<void>;

  /**
   * Get a connection by server ID
   * Returns undefined if not connected
   */
  getConnection(serverId: string): MCPConnection | undefined;

  /**
   * List all current connections
   * Returns array of all active and pending connections
   */
  listConnections(): MCPConnection[];
}
```

### Implementation Strategy

1. **Connection Storage**: Use a `Map<string, ConnectionContext>` internally where `ConnectionContext` includes:
   - The `MCPConnection` data object
   - The `MCPTransport` instance
   - The `MCPClient` instance
   - Reconnection timer references

2. **Transport Factory**: Based on `MCPServerConfig.type`:
   - `'stdio'` → `StdioTransport`
   - `'sse'`/`'http'` → SSE transport (future implementation)
   - `'sdk'` → Direct SDK integration (skip connection manager)

3. **Event Forwarding**: Transport events are forwarded through the manager:
   - Transport `connected` → Manager `connected` event
   - Transport `disconnected` → Manager `disconnected` event + trigger reconnect
   - Transport `error` → Manager `error` event

4. **Reconnection Logic**:
   - Exponential backoff with jitter
   - Configurable max attempts
   - State tracked in `MCPConnection.reconnectAttempts`
   - Emit `reconnecting` event before each attempt

### File Structure

```
packages/orchestrator/src/mcp/
├── connection-manager.ts     # NEW: MCPConnectionManager implementation
├── connection-manager.test.ts # NEW: Unit tests
├── client.ts                  # Existing MCPClient
├── server-manager.ts          # Existing MCPServerManager
├── types.ts                   # Existing transport types
├── transports/
│   ├── transport.ts          # Base transport class
│   ├── stdio-transport.ts    # Stdio implementation
│   └── index.ts              # Transport exports
└── index.ts                   # Update to export ConnectionManager

packages/core/src/
└── types.ts                   # Add MCPConnection types
```

### Integration with Orchestrator

The `MCPConnectionManager` will be integrated into `ApexOrchestrator`:

```typescript
// In ApexOrchestrator constructor
this.mcpConnectionManager = new MCPConnectionManager({
  projectPath: this.projectPath,
  config: this.config,
  autoReconnect: true,
});

// Forward events to orchestrator event stream
this.mcpConnectionManager.on('connected', (connection) => {
  this.emit('mcp:connected', connection);
});

this.mcpConnectionManager.on('error', (serverId, error) => {
  this.emit('mcp:error', { serverId, error });
});
```

## Consequences

### Positive

1. **Centralized Connection Management**: Single point of control for all MCP connections
2. **Event-Driven Architecture**: Clean integration with orchestrator's event system
3. **Automatic Recovery**: Reconnection logic handles transient failures gracefully
4. **Extensibility**: Easy to add new transport types (SSE, WebSocket) later
5. **Testability**: Clean interfaces enable comprehensive unit testing

### Negative

1. **Additional Complexity**: New abstraction layer between orchestrator and transports
2. **Memory Overhead**: Tracking connection state for all servers
3. **Type Dependencies**: New types in core package require careful versioning

### Risks

1. **Reconnection Storms**: Need circuit breaker if all servers fail simultaneously
2. **Resource Leaks**: Must carefully clean up transports on disconnect
3. **Race Conditions**: Multiple connect/disconnect calls need synchronization

## Implementation Plan

1. **Phase 1**: Add types to `@apexcli/core`
   - `MCPConnectionState`, `MCPConnection`, `MCPConnectionEvent`

2. **Phase 2**: Implement `MCPConnectionManager`
   - Core class with all required methods
   - Event emission
   - Basic reconnection logic

3. **Phase 3**: Testing
   - Unit tests for all methods
   - Integration tests with mock transports

4. **Phase 4**: Integration
   - Update MCP index to export new class
   - Integrate with ApexOrchestrator (future stage)

## References

- [Model Context Protocol Specification](https://github.com/anthropics/model-context-protocol)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [EventEmitter3 Documentation](https://github.com/primus/eventemitter3)
