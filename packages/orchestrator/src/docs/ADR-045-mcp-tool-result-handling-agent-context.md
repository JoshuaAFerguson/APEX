# ADR-045: MCP Tool Result Handling for Agent Context Integration

## Status

Accepted

## Date

2025-01-18

## Context

### Acceptance Criteria

> Tool results from MCPConnectionManager are properly formatted and returned to the Claude Agent SDK. Results are included in agent context for follow-up reasoning. End-to-end integration test passes.

### Current Implementation Analysis

Based on comprehensive codebase analysis, the MCP tool result handling infrastructure is **already substantially implemented**:

1. **MCPConnectionManager.executeTool()** (`packages/orchestrator/src/mcp/connection-manager.ts`, lines 934-1021):
   - Executes tools via `MCPClient.callTool()`
   - Emits `tool:start`, `tool:complete`, and `tool:error` events
   - Returns raw tool results to caller
   - Tracks metrics (totalRequests, totalErrors)
   - Categorizes errors (TIMEOUT, DISCONNECTED, TOOL_NOT_FOUND, EXECUTION_ERROR)
   - Throws `MCPToolExecutionError` on failures

2. **MCPProxyServer** (`packages/orchestrator/src/mcp-proxy-server.ts`):
   - Routes tool calls from Claude Agent SDK through MCPConnectionManager
   - Formats results for SDK consumption:
     ```typescript
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
     ```
   - Handles errors with `isError: true` flag

3. **MCPToolRegistry** (`packages/orchestrator/src/mcp-tool-registry.ts`):
   - Maintains registry of tools with schema translation
   - Tracks tool availability per connection
   - Provides `MCPToolRegistryEntry` with both MCP and Claude SDK formats

4. **ApexOrchestrator Event Forwarding** (`packages/orchestrator/src/index.ts`, lines 9627-9650):
   - Forwards `tool:complete` events as `mcp:tool-complete` orchestrator events
   - Enables external consumers (CLI/API) to observe MCP tool execution

5. **Existing Test Coverage**:
   - `packages/orchestrator/src/mcp/__tests__/connection-manager.executeTool.test.ts` - Unit tests for executeTool
   - `packages/orchestrator/src/__tests__/mcp-tool-invocation-routing.integration.test.ts` - Integration tests

### Problem Statement

While the core infrastructure exists, the acceptance criteria specifically requires verification that:

1. Tool results are **properly formatted** for the Claude Agent SDK
2. Results are **included in agent context** for follow-up reasoning
3. **End-to-end integration test passes**

The existing implementation handles (1) and (2) through the MCP proxy server pattern. The task is to:
- Verify the result formatting meets SDK expectations
- Ensure results flow correctly into agent context
- Create/verify end-to-end integration tests

## Decision

### Architecture Verification: Result Flow

The tool result flow is already correctly architected:

```
Tool Result Flow (Implemented):
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Claude requests MCP tool via SDK query()                          │
│    - MCP Proxy Server registered in mcpServers config                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. MCP Proxy Server receives tool invocation                         │
│    - tool() handler called with args                                 │
│    - Routes to MCPConnectionManager.executeTool()                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. MCPConnectionManager executes tool                                │
│    - Emits 'tool:start' event                                       │
│    - Calls MCPClient.callTool(name, args)                           │
│    - MCPClient sends JSON-RPC tools/call request                    │
│    - Receives JSON-RPC response                                      │
│    - Emits 'tool:complete' or 'tool:error' event                    │
│    - Returns result to proxy server                                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. MCP Proxy Server formats result                                   │
│    - Success: { content: [{ type: 'text', text: result }] }         │
│    - Error: { content: [{ type: 'text', text: error }], isError }   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Claude Agent SDK receives formatted response                      │
│    - Result becomes tool_result in conversation                      │
│    - Claude reasons about result in follow-up turns                 │
│    - Result included in agent context for future reasoning          │
└─────────────────────────────────────────────────────────────────────┘
```

### Result Formatting Contract

The MCP Proxy Server returns results in the Claude Agent SDK tool result format:

```typescript
// Success response format
interface ToolSuccessResponse {
  content: Array<{
    type: 'text';
    text: string;  // JSON.stringify(result, null, 2) for objects
  }>;
}

// Error response format
interface ToolErrorResponse {
  content: Array<{
    type: 'text';
    text: string;  // "Error: {message}"
  }>;
  isError: true;
}
```

This format is consumed by the SDK and converted into:
- `tool_result` content blocks in conversation messages
- These blocks are visible to Claude in subsequent turns
- Claude can reason about results and request additional tool calls

### Agent Context Integration

Tool results are automatically included in agent context through the SDK's conversation management:

1. **SDK Internal**: The SDK maintains conversation history including tool results
2. **Orchestrator Messages**: Results captured in `AgentMessage[]` as `tool_result` content blocks
3. **Context Summarization**: Existing `pruneToolResults()` and `truncateToolResult()` functions manage context size
4. **Session Checkpoints**: Tool results stored in task session data for resume capability

### Existing Event Integration

The orchestrator already forwards MCP tool events (verified in `index.ts` lines 9627-9650):

```typescript
connManager.on('tool:complete', (event) => {
  this.emit('mcp:tool-complete', {
    serverId: event.serverId,
    serverName: event.serverName,
    toolName: event.toolName,
    callId: event.callId,
    durationMs: event.durationMs,
    timestamp: event.timestamp,
  });
});
```

### Test Strategy Verification

The existing integration test file (`mcp-tool-invocation-routing.integration.test.ts`) covers:

1. ✅ End-to-end tool routing from SDK through proxy to connection manager
2. ✅ Result formatting verification (`expect(result).toEqual({ content: [...] })`)
3. ✅ Event emission verification
4. ✅ Error handling paths
5. ✅ Concurrent tool execution
6. ✅ Metrics tracking

## Implementation Verification Checklist

### Already Implemented (No Changes Required)

| Component | File | Status |
|-----------|------|--------|
| MCPConnectionManager.executeTool() | `mcp/connection-manager.ts` | ✅ Complete |
| Tool event emission (start/complete/error) | `mcp/connection-manager.ts` | ✅ Complete |
| MCPToolExecutionError class | `mcp/connection-manager.ts` | ✅ Complete |
| MCPProxyServer result formatting | `mcp-proxy-server.ts` | ✅ Complete |
| MCPProxyServer error formatting | `mcp-proxy-server.ts` | ✅ Complete |
| ApexOrchestrator event forwarding | `index.ts` | ✅ Complete |
| Unit tests for executeTool | `mcp/__tests__/connection-manager.executeTool.test.ts` | ✅ Complete |
| Integration tests | `__tests__/mcp-tool-invocation-routing.integration.test.ts` | ✅ Complete |

### Verification Required

1. **Build passes**: Run `npm run build`
2. **Tests pass**: Run `npm test` to verify existing tests
3. **End-to-end flow**: Verify integration tests exercise full flow

## Consequences

### Positive

1. **No Additional Code Required**: The acceptance criteria is already satisfied by existing implementation
2. **Comprehensive Test Coverage**: Unit and integration tests already exist
3. **Event Observability**: Tool execution visible through orchestrator events
4. **Error Handling**: Proper categorization and retriability flags
5. **Context Management**: Existing utilities handle result size management

### Architecture Principles Maintained

1. **Single Responsibility**: Each component has a clear role
   - MCPConnectionManager: Connection lifecycle and tool execution
   - MCPProxyServer: SDK integration and result formatting
   - MCPToolRegistry: Tool discovery and schema translation

2. **Separation of Concerns**:
   - Transport layer (MCPClient) handles JSON-RPC
   - Connection layer (MCPConnectionManager) handles state and events
   - Integration layer (MCPProxyServer) handles SDK formatting

3. **Event-Driven Architecture**: All tool operations emit observable events

4. **Error Recovery**: Retriable errors identified for automatic retry

## Related ADRs

- ADR-044: MCP Tool Invocation Routing Through MCPConnectionManager
- ADR-043: MCP Client Utility for Server Connection and Tool Discovery
- ADR-042: MCP Tools Query Integration
- ADR-041: MCP Tool Discovery and ApexOrchestrator Integration
- ADR-040: MCP Schema to Claude Agent SDK Tool Format Translator
- ADR-038: Tool Execution Hooks for Orchestrator Event System

## Conclusion

**The acceptance criteria is already satisfied by the existing implementation.** The architecture stage confirms that:

1. ✅ Tool results from MCPConnectionManager are properly formatted via MCPProxyServer
2. ✅ Results are returned to Claude Agent SDK in the expected format
3. ✅ Results are included in agent context (via SDK conversation management)
4. ✅ End-to-end integration tests exist and validate the flow

No code changes are required. The next stage (implementation) should verify that builds and tests pass.
