# ADR-042: MCP Tools Integration into Claude Agent SDK query() Calls

## Status
Proposed

## Date
2025-01-17

## Context

ADR-041 established the infrastructure for MCP tool discovery and registration within ApexOrchestrator:
- `MCPToolRegistry` fetches tools from connected MCP servers
- `SchemaTranslator` converts MCP JSON Schema to Claude Agent SDK Zod schemas
- `getMcpToolsForAgent()` returns `ClaudeSDKTool[]` from the registry

However, the discovered tools are **not yet being passed to the Claude Agent SDK's `query()` calls**. The acceptance criteria states:

> ApexOrchestrator passes discovered MCP tools to the Claude Agent SDK query() method. Tools appear alongside any built-in tools.

### Key Discovery: SDK Tool Integration Mechanism

The Claude Agent SDK does **NOT** have a direct `tools` parameter for passing custom tools. Instead, it uses **MCP servers** as the mechanism for tool exposure:

1. **Built-in tools** are controlled via `options.tools` (array of tool names or preset)
2. **Custom tools** must be exposed through MCP servers via `options.mcpServers`
3. **SDK MCP servers** (`createSdkMcpServer()`) allow in-process tool definition

The existing `custom-tools.ts` and `browser-mcp.ts` demonstrate this pattern:

```typescript
// From browser-mcp.ts
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

const browserToolDefinition = tool(
  'Browser',
  'Browser automation tool...',
  { operation: operationSchema, params: paramsSchema },
  async (args) => { /* implementation */ }
);

export function buildBrowserToolsServer(browserTool: BrowserTool): BrowserToolsServer {
  return {
    name: 'browser-tools',
    config: createSdkMcpServer({
      name: 'browser-tools',
      tools: [browserToolDefinition],
    }),
  };
}
```

### Current State

The `buildQueryMcpServers()` method (line 8443-8482) already aggregates:
1. External MCP servers from configuration
2. `customToolsServer` (built-in custom tools)
3. `browserToolsServer` (browser automation)

The discovered MCP tools from `MCPToolRegistry` are **not being integrated** because:
1. They're already available through their source MCP servers
2. The SDK handles MCP tool discovery internally when `mcpServers` config is passed

### Architecture Analysis

```
Current Data Flow:
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Server Config                        │
│  (stdio/http/sse servers from config.yaml)                     │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  buildQueryMcpServers()                         │
│  Returns: Record<string, McpServerConfig>                       │
│  - Includes external MCP servers                                │
│  - Includes customToolsServer                                   │
│  - Includes browserToolsServer                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SDK query()                              │
│  options.mcpServers: this.buildQueryMcpServers()               │
│  SDK connects to MCP servers → discovers tools → uses them     │
└─────────────────────────────────────────────────────────────────┘
```

**Key Insight**: The SDK already handles tool discovery from MCP servers! When we pass `mcpServers` config to `query()`, the SDK:
1. Connects to each MCP server
2. Calls `tools/list` to discover available tools
3. Makes those tools available to the Claude model

### The Real Problem

The existing infrastructure provides:
- **Pre-connection** to MCP servers via `MCPConnectionManager`
- **Tool registry** via `MCPToolRegistry` with translated schemas
- **Monitoring** via events and stats

But these are for **orchestrator-level introspection**, not for direct SDK integration. The SDK manages its own MCP connections when you pass `mcpServers` config.

## Decision

### Option A: No Code Changes Required (Recommended)

The current architecture **already works correctly**:

1. `buildQueryMcpServers()` passes all MCP server configs to `query()`
2. The SDK connects to these servers and discovers tools
3. Tools are available to agents during execution

The `MCPToolRegistry` and `getMcpToolsForAgent()` serve a **different purpose**:
- Pre-warming connections for faster first execution
- Providing tool introspection for monitoring/logging
- Supporting custom integration scenarios

**No changes needed** to the query() call because the SDK handles MCP tool discovery automatically.

### Option B: Add SDK MCP Server for Pre-Translated Tools (Alternative)

If we want to bypass the SDK's MCP discovery (e.g., for performance or control), we could:

1. Create an SDK MCP server that wraps discovered tools
2. Pass this server to query() alongside external MCP servers

```typescript
// New file: packages/orchestrator/src/discovered-tools-mcp.ts
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type { ClaudeSDKTool } from './schema-translator';

export type DiscoveredToolsServer = {
  name: string;
  config: ReturnType<typeof createSdkMcpServer>;
};

/**
 * Creates an SDK MCP server that exposes discovered MCP tools
 * This wraps tools that were discovered from external MCP servers
 * and proxies calls back to those servers
 */
export function buildDiscoveredToolsServer(
  tools: ClaudeSDKTool[],
  executeToolCallback: (serverName: string, toolName: string, args: unknown) => Promise<unknown>
): DiscoveredToolsServer {
  const name = 'discovered-tools';

  const toolDefinitions = tools.map(t =>
    tool(
      t.name,
      t.description,
      t.parameters,
      async (args: unknown) => {
        // Proxy to the original MCP server
        const result = await executeToolCallback(t.metadata.serverName || '', t.name, args);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
      }
    )
  );

  return {
    name,
    config: createSdkMcpServer({
      name,
      tools: toolDefinitions,
    }),
  };
}
```

**However, this is NOT recommended** because:
1. It duplicates SDK functionality
2. Adds complexity without clear benefit
3. Requires maintaining proxy implementations

### Recommended Implementation

Keep the current architecture and document that:

1. **MCP tools are passed to SDK via `mcpServers` config** - not via a `tools` parameter
2. **SDK handles tool discovery automatically** when connecting to MCP servers
3. **`getMcpToolsForAgent()` is for introspection** - monitoring, logging, UI display
4. **No code changes required** for basic MCP tool integration

If enhanced control is needed, consider Option B only for specific use cases like:
- Offline testing with mock tools
- Tool filtering/transformation before execution
- Custom permission handling at tool level

## Implementation Steps

### Phase 1: Documentation and Verification (Current)
1. Create this ADR documenting the architecture
2. Verify existing `buildQueryMcpServers()` includes all MCP server configs
3. Add logging to confirm tools are available during execution

### Phase 2: Observability Enhancement (Optional)
1. Log discovered tools when `query()` starts
2. Emit events when MCP tools are used during execution
3. Track tool usage metrics

### Phase 3: SDK MCP Server Wrapper (If Needed)
1. Implement `buildDiscoveredToolsServer()` if direct control is required
2. Integrate with `buildQueryMcpServers()`
3. Add tool execution proxy

## Files Affected

### Current State (No Changes)
- `packages/orchestrator/src/index.ts` - `buildQueryMcpServers()` already works correctly

### Optional Enhancements
- `packages/orchestrator/src/index.ts` - Add logging of available tools
- `packages/orchestrator/src/discovered-tools-mcp.ts` - (NEW) Only if Option B is needed

## Verification

To verify MCP tools are available to agents:

```typescript
// In executeStage(), before query() call
const mcpServers = this.buildQueryMcpServers();
const registryStats = this.mcpToolRegistry?.getStats();
console.log(`MCP Servers: ${Object.keys(mcpServers || {}).join(', ')}`);
console.log(`Discovered Tools: ${registryStats?.totalTools ?? 0}`);
```

The SDK will log tool discovery during connection, confirming tools are available.

## Consequences

### Positive
- No additional code complexity
- SDK handles tool discovery efficiently
- Registry provides monitoring capabilities
- Clear separation of concerns

### Negative
- Less direct control over tool availability
- Tool filtering must happen at MCP server config level
- Cannot easily mock individual tools for testing

### Neutral
- SDK manages MCP connections separately from orchestrator's registry
- Tools may be discovered twice (registry + SDK) - acceptable overhead

## Acceptance Criteria Mapping

| Criteria | Implementation |
|----------|----------------|
| "ApexOrchestrator passes discovered MCP tools to the Claude Agent SDK query() method" | MCP server configs passed via `mcpServers` option; SDK discovers tools automatically |
| "Tools appear alongside any built-in tools" | SDK makes MCP tools available alongside built-in tools when `mcpServers` is provided |

## Related ADRs
- ADR-040: MCP Schema to Claude Agent SDK Tool Format Translator
- ADR-041: MCP Tool Discovery and ApexOrchestrator Integration

## References
- Claude Agent SDK Types (`agentSdkTypes.d.ts`)
- `buildQueryMcpServers()` implementation (index.ts:8443-8482)
- `browser-mcp.ts` - Example of SDK MCP server usage
- `custom-tools.ts` - Example of SDK MCP server with custom tools
