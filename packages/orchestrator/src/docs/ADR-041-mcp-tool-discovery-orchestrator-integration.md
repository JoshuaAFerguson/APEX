# ADR-041: MCP Tool Discovery and ApexOrchestrator Integration

## Status
Proposed

## Date
2025-01-17

## Context

The ApexOrchestrator currently initializes `MCPConnectionManager` during its `initialize()` method (line 1322-1325), but the MCP tool discovery functionality is not integrated into the agent execution flow. The existing infrastructure includes:

1. **MCPConnectionManager** (`mcp/connection-manager.ts`): Manages connections to MCP servers, provides `discoverServers()` and connection lifecycle methods
2. **MCPToolRegistry** (`mcp-tool-registry.ts`): Fetches and maintains a registry of MCP tools from connected servers, with schema translation support
3. **SchemaTranslator** (`schema-translator.ts`): Converts MCP JSON Schema tool definitions to Claude Agent SDK compatible Zod schemas
4. **buildQueryMcpServers()** (line 8344-8383): Currently only returns MCPServerConfig records for SDK consumption, not discovered tools

The task is to connect these components so that:
- MCP tools are discovered from connected servers during initialization or before agent execution
- Tools are converted to Claude Agent SDK compatible format
- Agents can utilize discovered MCP tools during workflow execution

## Decision

### Architecture Overview

```
ApexOrchestrator
    │
    ├── initialize()
    │       │
    │       ├── MCPConnectionManager (exists)
    │       │       ├── discoverServers()
    │       │       └── connect() for each server
    │       │
    │       └── MCPToolRegistry (NEW integration)
    │               ├── setConnectionManager()
    │               ├── refreshAllTools()
    │               └── getAvailableTools() → ClaudeSDKTool[]
    │
    └── buildQueryMcpServers() (ENHANCED)
            │
            └── Returns mcpServers config + discovered tools metadata
```

### Component Responsibilities

#### 1. MCPToolRegistry Integration

Add `mcpToolRegistry` as a new private member of ApexOrchestrator:

```typescript
// packages/orchestrator/src/index.ts
private mcpToolRegistry?: MCPToolRegistry;
```

#### 2. Enhanced Initialization Flow

Modify `initialize()` to:
1. Initialize `MCPConnectionManager` (already done)
2. Initialize `MCPToolRegistry` with the connection manager
3. Connect to enabled MCP servers
4. Discover tools from all connected servers

```typescript
// In initialize() after line 1328 (setupMCPEventForwarding)
if (this.mcpConnectionManager) {
  // Initialize tool registry
  this.mcpToolRegistry = new MCPToolRegistry({
    operationTimeoutMs: 30000,
    autoRefresh: false, // We'll manually refresh during execution
  });
  this.mcpToolRegistry.setConnectionManager(this.mcpConnectionManager);

  // Connect to enabled servers and discover tools
  await this.discoverAndRegisterMcpTools();
}
```

#### 3. New Method: discoverAndRegisterMcpTools()

```typescript
/**
 * Discover and register MCP tools from all enabled servers
 * Called during initialization and can be called to refresh tools
 */
private async discoverAndRegisterMcpTools(): Promise<void> {
  if (!this.mcpConnectionManager || !this.mcpToolRegistry) {
    return;
  }

  // Discover available servers from config
  const servers = this.mcpConnectionManager.discoverServers();

  // Connect to each server
  for (const serverConfig of servers) {
    const serverId = serverConfig.name ?? Object.keys(this.config.mcp?.servers ?? {})
      .find(key => this.config.mcp?.servers?.[key] === serverConfig);

    if (!serverId) continue;

    try {
      const connection = await this.mcpConnectionManager.connect(serverId);
      await this.mcpToolRegistry.addConnection(connection);
    } catch (error) {
      // Log error but continue with other servers
      console.warn(`Failed to connect to MCP server '${serverId}':`, error);
      this.emit('mcp:connection-error', { serverId, error });
    }
  }

  // Refresh tools from all connected servers
  await this.mcpToolRegistry.refreshAllTools();
}
```

#### 4. New Method: getMcpToolsForAgent()

Provide a method to get Claude SDK-compatible tools for use in agent execution:

```typescript
/**
 * Get available MCP tools translated to Claude Agent SDK format
 * for use in agent execution
 */
public getMcpToolsForAgent(): ClaudeSDKTool[] {
  if (!this.mcpToolRegistry) {
    return [];
  }

  return this.mcpToolRegistry.getAvailableTools()
    .map(entry => entry.claudeTool);
}
```

#### 5. Enhanced buildQueryMcpServers() (Optional Enhancement)

While the Claude Agent SDK accepts `mcpServers` configuration that it manages directly, we can provide tool metadata for logging/debugging:

```typescript
private buildQueryMcpServers(): Record<string, McpServerConfig> | undefined {
  // Existing implementation...

  // Add discovered tools count for debugging
  if (this.mcpToolRegistry) {
    const stats = this.mcpToolRegistry.getStats();
    // Log: `Discovered ${stats.totalTools} tools from ${stats.activeConnections} servers`
  }

  return Object.keys(servers).length > 0 ? servers : undefined;
}
```

### Data Flow During Agent Execution

```
executeStage()
    │
    ├── Build stage prompt
    │
    ├── Call query() with:
    │       ├── mcpServers: this.buildQueryMcpServers()  (SDK manages connections)
    │       │
    │       └── (Optional) Pass tool metadata for prompt enhancement
    │
    └── SDK executes with MCP servers, discovering and using tools automatically
```

**Key Insight**: The Claude Agent SDK's `query()` function already handles MCP tool discovery internally when `mcpServers` is provided. Our enhancement provides:
1. Pre-initialization of connections for faster first-execution
2. Tool registry for introspection/monitoring
3. Schema translation for custom tool integration scenarios
4. Event-based tracking of MCP tool usage

### Interface Definitions

#### MCPToolDiscoveryEvent

```typescript
/**
 * Event emitted when MCP tools are discovered
 */
export interface MCPToolDiscoveryEvent {
  serverId: string;
  serverName: string;
  toolCount: number;
  tools: Array<{ name: string; description: string }>;
  timestamp: Date;
}
```

#### New OrchestratorEvents

```typescript
// Add to OrchestratorEvents interface
'mcp:tools-discovered': (event: MCPToolDiscoveryEvent) => void;
'mcp:connection-error': (event: { serverId: string; error: Error }) => void;
'mcp:tool-refresh-started': () => void;
'mcp:tool-refresh-completed': (stats: MCPToolRegistryStats) => void;
```

### Public API Additions

```typescript
export class ApexOrchestrator extends EventEmitter<OrchestratorEvents> {
  // ... existing methods ...

  /**
   * Get statistics about discovered MCP tools
   */
  public getMcpToolStats(): MCPToolRegistryStats | undefined;

  /**
   * Refresh MCP tools from all connected servers
   */
  public async refreshMcpTools(): Promise<void>;

  /**
   * Check if a specific MCP tool is available
   */
  public isMcpToolAvailable(toolName: string): boolean;

  /**
   * Get available MCP tools in Claude SDK format
   */
  public getMcpToolsForAgent(): ClaudeSDKTool[];
}
```

### Integration with Existing MCP Methods

The orchestrator already has these MCP-related methods that remain unchanged:
- `listMcpConnections()` (line 8708)
- `getMcpConnection()` (line 8718)
- `connectMcpServer()` (line 8728)
- `disconnectMcpServer()` (line 8741)
- `getMcpServerHealth()` (line 8754)

The new tool discovery integrates alongside these.

## Implementation Steps

### Phase 1: Core Integration (Required)
1. Add `mcpToolRegistry` private member to ApexOrchestrator
2. Add import for `MCPToolRegistry`, `MCPToolRegistryStats`, `ClaudeSDKTool`
3. Initialize registry in `initialize()` after MCPConnectionManager
4. Implement `discoverAndRegisterMcpTools()` method
5. Add `getMcpToolsForAgent()` public method
6. Add `getMcpToolStats()` public method

### Phase 2: Events and Monitoring (Recommended)
1. Add MCP tool discovery events to OrchestratorEvents
2. Emit events during tool discovery
3. Add `refreshMcpTools()` public method
4. Add `isMcpToolAvailable()` utility method

### Phase 3: Enhanced Integration (Optional)
1. Pass discovered tool metadata to agent prompts
2. Implement tool usage tracking
3. Add tool-level health monitoring
4. Implement lazy tool discovery (discover on first use)

## Files to Modify

### Primary Changes
- `packages/orchestrator/src/index.ts`:
  - Add import for `MCPToolRegistry`, `MCPToolRegistryStats` from `./mcp-tool-registry.js`
  - Add import for `ClaudeSDKTool` from `./schema-translator.js`
  - Add `mcpToolRegistry` private member
  - Modify `initialize()` to set up tool registry
  - Add `discoverAndRegisterMcpTools()` private method
  - Add `getMcpToolsForAgent()` public method
  - Add `getMcpToolStats()` public method
  - Add `refreshMcpTools()` public method
  - Add `isMcpToolAvailable()` public method
  - Add new event types to `OrchestratorEvents`

### No Changes Required
- `packages/orchestrator/src/mcp-tool-registry.ts` - Already implemented
- `packages/orchestrator/src/schema-translator.ts` - Already implemented
- `packages/orchestrator/src/mcp/connection-manager.ts` - Already implemented

## Consequences

### Positive
- **Pre-warmed Connections**: MCP servers are connected during initialization, reducing first-execution latency
- **Tool Introspection**: Registry provides visibility into available tools
- **Event-Driven Monitoring**: Emits events for tool discovery and errors
- **Schema Translation Ready**: Tools are already translated to Claude SDK format for custom integrations
- **Graceful Degradation**: Connection failures don't block initialization

### Negative
- **Startup Time**: Connecting to MCP servers adds initialization time
- **Resource Usage**: Maintains active connections to MCP servers
- **Complexity**: Additional state to manage

### Mitigations
- Use lazy initialization option for servers that are rarely used
- Implement connection pooling timeouts
- Add configuration to disable automatic tool discovery

## Test Strategy

1. **Unit Tests**:
   - Test `discoverAndRegisterMcpTools()` with mocked connection manager
   - Test `getMcpToolsForAgent()` returns correct format
   - Test error handling during connection failures

2. **Integration Tests**:
   - Test full initialization with mock MCP servers
   - Test tool discovery events are emitted correctly
   - Test tool refresh mechanism

3. **E2E Tests**:
   - Test agent execution with discovered MCP tools
   - Test tool availability after server disconnect/reconnect

## Related ADRs
- ADR-040: MCP Schema to Claude Agent SDK Tool Format Translator
- ADR-001 (mcp/): MCP Connection Manager Architecture

## References
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Claude Agent SDK Documentation](https://docs.anthropic.com/claude-agent-sdk)
- Existing `MCPToolRegistry` implementation in `mcp-tool-registry.ts`
- Existing `SchemaTranslator` implementation in `schema-translator.ts`
