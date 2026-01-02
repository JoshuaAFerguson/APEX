# ADR-001: MCP Transport Architecture

## Status
Accepted

## Context
APEX needs to integrate with Model Context Protocol (MCP) servers to enable agents to use external tools and data sources. MCP servers communicate via transports - standardized communication channels that handle message passing between clients and servers.

We need an abstraction layer for MCP transports that:
1. Supports multiple transport types (stdio, HTTP/SSE, WebSocket in the future)
2. Provides a consistent interface for connection lifecycle management
3. Handles bidirectional JSON-RPC message passing
4. Follows existing codebase patterns and conventions

## Decision

### Transport Abstraction

We will implement an abstract `MCPTransport` base class that defines the contract for all transport implementations:

```typescript
abstract class MCPTransport extends EventEmitter<MCPTransportEvents> {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(message: JSONRPCMessage): Promise<void>;
  abstract isConnected(): boolean;
}
```

### Event-Based Message Reception

Instead of a `receive()` method, transports will use EventEmitter3 (consistent with existing codebase patterns like `WorkspaceManager`, `ContainerExecutionProxy`, `IdleProcessor`) to emit received messages:

```typescript
interface MCPTransportEvents {
  'message': (message: JSONRPCMessage) => void;
  'error': (error: MCPTransportError) => void;
  'connected': () => void;
  'disconnected': (reason?: string) => void;
}
```

This pattern:
- Aligns with existing codebase conventions (see `OrchestratorEvents`, `WorkspaceManagerEvents`)
- Supports natural async message handling
- Enables multiple listeners for logging, metrics, etc.

### Stdio Transport Implementation

The `StdioTransport` class will:
1. Spawn a child process using Node.js `child_process.spawn()`
2. Communicate via stdin/stdout streams
3. Use newline-delimited JSON for message framing
4. Handle process lifecycle (startup, shutdown, crash recovery)

### Directory Structure

```
packages/orchestrator/src/mcp/
├── transports/
│   ├── index.ts           # Exports all transports
│   ├── transport.ts       # MCPTransport abstract class
│   └── stdio-transport.ts # StdioTransport implementation
├── types.ts               # MCP-related types (JSONRPCMessage, etc.)
└── index.ts               # Main MCP module exports
```

## Type Definitions

### JSON-RPC Message Types

Following the JSON-RPC 2.0 specification used by MCP:

```typescript
interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JSONRPCError;
}

interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}
```

### Transport Error Handling

Custom error class following existing patterns (see `DaemonError`, `WorktreeError`):

```typescript
type MCPTransportErrorCode =
  | 'CONNECTION_FAILED'
  | 'DISCONNECTED'
  | 'SEND_FAILED'
  | 'PROCESS_CRASHED'
  | 'SPAWN_FAILED'
  | 'PARSE_ERROR';

class MCPTransportError extends Error {
  constructor(
    message: string,
    public readonly code: MCPTransportErrorCode,
    public readonly cause?: Error
  );
}
```

## StdioTransport Design

### Configuration

```typescript
interface StdioTransportOptions {
  /** Command to execute (e.g., 'node', 'python') */
  command: string;
  /** Command arguments (e.g., ['./mcp-server.js']) */
  args?: string[];
  /** Working directory for the process */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout for connection in milliseconds (default: 30000) */
  connectionTimeout?: number;
  /** Whether to restart on crash (default: false) */
  autoRestart?: boolean;
  /** Maximum restart attempts (default: 3) */
  maxRestarts?: number;
}
```

### Process Lifecycle

1. **Spawn**: Use `spawn()` with `stdio: ['pipe', 'pipe', 'pipe']` for full control
2. **Message Framing**: Newline-delimited JSON (each message ends with `\n`)
3. **Buffer Management**: Handle partial messages across data chunks
4. **Shutdown**: Send SIGTERM, wait for graceful exit, SIGKILL if needed
5. **Error Handling**: Capture stderr for error reporting

### Message Flow

```
┌─────────────┐           ┌─────────────────┐           ┌────────────┐
│   APEX      │  stdin    │  StdioTransport │  stdout   │  MCP       │
│   Agent     │ ────────► │  (ChildProcess) │ ◄──────── │  Server    │
│             │           │                 │           │            │
│  send()     │           │  serialize()    │           │  process() │
│  ◄──────────│           │  ◄───────────── │           │            │
│  'message'  │  emit     │  parse()        │           │  respond   │
└─────────────┘           └─────────────────┘           └────────────┘
```

## Consequences

### Positive
- Clean abstraction enables future transport types without changing client code
- Event-based design aligns with existing codebase patterns
- Stdio transport is simple, reliable, and works with any language
- Clear separation of concerns (transport vs. protocol vs. client)

### Negative
- Stdio requires spawning external processes (resource overhead)
- Newline-delimited JSON doesn't support multi-line messages in content
- Process management adds complexity (crash handling, restart logic)

### Mitigations
- Use process pooling for frequently-used MCP servers (future enhancement)
- Consider HTTP/SSE transport for long-running servers
- Implement connection health checks and auto-reconnection

## Related Decisions
- Future: ADR-002 - HTTP/SSE Transport for remote MCP servers
- Future: ADR-003 - MCP Client and Tool Registration

## References
- [MCP Specification](https://modelcontextprotocol.io/specification)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- Existing codebase patterns: `ContainerExecutionProxy`, `DaemonManager`, `WorkspaceManager`
