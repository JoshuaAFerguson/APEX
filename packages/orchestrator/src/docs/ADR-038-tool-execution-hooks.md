# ADR-038: Tool Execution Hooks for Orchestrator Event System

## Status

Proposed

## Date

2025-01-11

## Context

APEX's orchestrator already has a robust event system that emits `tool:start`, `tool:complete`, and `tool:progress` events when Claude SDK makes tool calls. However, users need a way to register **hooks** (custom callbacks) that can:

1. Be notified when tools start execution (`onToolStart`)
2. Be notified when tools complete execution (`onToolComplete`)
3. Be notified when tool execution fails (`onToolError`)

These hooks differ from events in that they:
- Are registered programmatically via an API on `ApexOrchestrator`
- Can receive rich execution context including tool name, input parameters, and task context
- Are executed synchronously within the tool execution flow
- Can potentially intercept/modify tool execution (though this ADR focuses on notification-only hooks)

### Current State

1. **Tool Events Already Exist** (v0.5.0):
   - `tool:start` event with `ToolCallStartEvent` payload
   - `tool:complete` event with `ToolCallCompleteEvent` payload
   - `tool:progress` event with `ToolCallProgressEvent` payload
   - Events emitted via `EventEmitter3` at lines 307-309 of `index.ts`

2. **HookManager Class** (`hook-manager.ts`):
   - Manages lifecycle hooks and tool hooks
   - Executes pre/post hooks with `PreHookContext`/`PostHookContext`
   - Emits `hook:pre:start`, `hook:pre:complete`, `hook:post:start`, `hook:post:complete` events
   - Uses external script handlers via `handlerPath`

3. **Gap Analysis**:
   - No simple callback-based API for registering tool hooks at runtime
   - Existing hooks require external scripts, not inline callbacks
   - Need a lightweight way for consumers to subscribe to tool events with callbacks

### Acceptance Criteria

> New hook types: `onToolStart`, `onToolComplete`, `onToolError`. Hooks receive tool name, input parameters, and execution context. Hook registration API in ApexOrchestrator. Events emitted via existing EventEmitter.

## Decision

Implement a callback-based tool hook registration API that:

1. **Leverages Existing Events**: Hooks are implemented as wrapped event listeners
2. **Provides Type-Safe API**: Strongly typed hook registration methods
3. **Maintains Event Compatibility**: Existing event system continues to work unchanged
4. **Supports Deregistration**: Hooks can be removed when no longer needed

### Architecture Design

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          ApexOrchestrator                                 │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    Tool Hook Registration API                       │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  onToolStart(callback): () => void                            │  │  │
│  │  │  onToolComplete(callback): () => void                         │  │  │
│  │  │  onToolError(callback): () => void                            │  │  │
│  │  │                                                                │  │  │
│  │  │  Internal: wraps callbacks around existing events              │  │  │
│  │  │  - 'tool:start' → onToolStart callbacks                       │  │  │
│  │  │  - 'tool:complete' (success) → onToolComplete callbacks       │  │  │
│  │  │  - 'tool:complete' (error) → onToolError callbacks            │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                      │
│                                    ▼                                      │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    Existing Event System                            │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  EventEmitter3<OrchestratorEvents>                            │  │  │
│  │  │                                                                │  │  │
│  │  │  'tool:start': (event: ToolCallStartEvent) => void           │  │  │
│  │  │  'tool:complete': (event: ToolCallCompleteEvent) => void     │  │  │
│  │  │  'tool:progress': (event: ToolCallProgressEvent) => void     │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Type Definitions

#### Hook Context Types

```typescript
/**
 * Context provided to onToolStart hooks
 * Contains information available at tool execution start
 */
export interface ToolStartHookContext {
  /** Name of the tool being executed */
  toolName: string;
  /** Input parameters passed to the tool */
  input: Record<string, unknown>;
  /** Unique identifier for this tool call */
  callId: string;
  /** Task ID that initiated this tool call */
  taskId: string;
  /** Timestamp when the tool execution started */
  timestamp: Date;
  /** Agent name executing the tool (if available) */
  agentName?: string;
  /** Workflow stage name (if available) */
  stageName?: string;
}

/**
 * Context provided to onToolComplete hooks
 * Contains full execution details including result
 */
export interface ToolCompleteHookContext {
  /** Name of the tool that was executed */
  toolName: string;
  /** Input parameters that were passed to the tool */
  input: Record<string, unknown>;
  /** Unique identifier for this tool call */
  callId: string;
  /** Task ID that initiated this tool call */
  taskId: string;
  /** Timestamp when the tool execution completed */
  timestamp: Date;
  /** Result of the tool execution */
  result: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
  /** Timing information */
  timing: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  /** Agent name that executed the tool (if available) */
  agentName?: string;
  /** Workflow stage name (if available) */
  stageName?: string;
}

/**
 * Context provided to onToolError hooks
 * Focused on error details for failed tool executions
 */
export interface ToolErrorHookContext {
  /** Name of the tool that failed */
  toolName: string;
  /** Input parameters that were passed to the tool */
  input: Record<string, unknown>;
  /** Unique identifier for this tool call */
  callId: string;
  /** Task ID that initiated this tool call */
  taskId: string;
  /** Timestamp when the error occurred */
  timestamp: Date;
  /** Error message describing the failure */
  error: string;
  /** Timing information (if available) */
  timing?: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  /** Agent name that executed the tool (if available) */
  agentName?: string;
  /** Workflow stage name (if available) */
  stageName?: string;
}

/**
 * Callback types for hook registration
 */
export type ToolStartHookCallback = (context: ToolStartHookContext) => void;
export type ToolCompleteHookCallback = (context: ToolCompleteHookContext) => void;
export type ToolErrorHookCallback = (context: ToolErrorHookContext) => void;
```

#### Registration API

```typescript
/**
 * Extended ApexOrchestrator class with hook registration methods
 */
export class ApexOrchestrator extends EventEmitter<OrchestratorEvents> {
  // ... existing implementation ...

  /**
   * Register a callback to be invoked when a tool starts execution
   * @param callback Function to call when a tool starts
   * @returns Unsubscribe function to remove the hook
   */
  onToolStart(callback: ToolStartHookCallback): () => void {
    const handler = (event: ToolCallStartEvent) => {
      const context: ToolStartHookContext = {
        toolName: event.toolName,
        input: event.input as Record<string, unknown>,
        callId: event.callId,
        taskId: event.taskId,
        timestamp: event.timestamp,
        // agentName and stageName from active tool execution tracking
        agentName: this.getActiveToolExecution(event.callId)?.agentName,
        stageName: this.getActiveToolExecution(event.callId)?.stageName,
      };
      callback(context);
    };
    this.on('tool:start', handler);
    return () => this.off('tool:start', handler);
  }

  /**
   * Register a callback to be invoked when a tool completes successfully
   * @param callback Function to call when a tool completes
   * @returns Unsubscribe function to remove the hook
   */
  onToolComplete(callback: ToolCompleteHookCallback): () => void {
    const handler = (event: ToolCallCompleteEvent) => {
      if (!event.result.success) return; // Skip errors, handled by onToolError

      const activeExecution = this.getActiveToolExecution(event.callId);
      const context: ToolCompleteHookContext = {
        toolName: event.toolName,
        input: activeExecution?.input as Record<string, unknown> ?? {},
        callId: event.callId,
        taskId: event.taskId,
        timestamp: event.timestamp,
        result: event.result,
        timing: event.timing,
        agentName: activeExecution?.agentName,
        stageName: activeExecution?.stageName,
      };
      callback(context);
    };
    this.on('tool:complete', handler);
    return () => this.off('tool:complete', handler);
  }

  /**
   * Register a callback to be invoked when a tool execution fails
   * @param callback Function to call when a tool fails
   * @returns Unsubscribe function to remove the hook
   */
  onToolError(callback: ToolErrorHookCallback): () => void {
    const handler = (event: ToolCallCompleteEvent) => {
      if (event.result.success) return; // Skip successes, handled by onToolComplete

      const activeExecution = this.getActiveToolExecution(event.callId);
      const context: ToolErrorHookContext = {
        toolName: event.toolName,
        input: activeExecution?.input as Record<string, unknown> ?? {},
        callId: event.callId,
        taskId: event.taskId,
        timestamp: event.timestamp,
        error: event.result.error ?? 'Unknown error',
        timing: event.timing,
        agentName: activeExecution?.agentName,
        stageName: activeExecution?.stageName,
      };
      callback(context);
    };
    this.on('tool:complete', handler);
    return () => this.off('tool:complete', handler);
  }

  /**
   * Helper to get active tool execution for context enrichment
   * @private
   */
  private getActiveToolExecution(callId: string): ToolExecution | undefined {
    return this.activeToolExecutions.get(callId);
  }
}
```

### Data Flow Sequence

```
1. Claude Agent SDK invokes a tool
                    │
                    ▼
2. ApexOrchestrator detects tool_use block in response
   │ Creates ToolExecution record with context
   │ Stores in activeToolExecutions Map
                    │
                    ▼
3. 'tool:start' event emitted
   │ ToolCallStartEvent payload
   │   └─► onToolStart hooks invoked
   │       └─► Each callback receives ToolStartHookContext
                    │
                    ▼
4. Tool executes (handled by Claude Agent SDK)
                    │
                    ▼
5. ApexOrchestrator detects tool_result block
   │ Updates ToolExecution record
                    │
                    ▼
6. 'tool:complete' event emitted
   │ ToolCallCompleteEvent payload
   │   ├─► If success: onToolComplete hooks invoked
   │   │   └─► Each callback receives ToolCompleteHookContext
   │   └─► If error: onToolError hooks invoked
   │       └─► Each callback receives ToolErrorHookContext
                    │
                    ▼
7. ToolExecution cleaned up from activeToolExecutions
```

### Usage Examples

```typescript
// Example 1: Basic tool execution logging
const orchestrator = new ApexOrchestrator({ projectPath: '/my/project' });

const unsubStart = orchestrator.onToolStart((ctx) => {
  console.log(`[${ctx.taskId}] Tool started: ${ctx.toolName}`);
  console.log(`  Input:`, JSON.stringify(ctx.input, null, 2));
});

const unsubComplete = orchestrator.onToolComplete((ctx) => {
  console.log(`[${ctx.taskId}] Tool completed: ${ctx.toolName}`);
  console.log(`  Duration: ${ctx.timing.duration}ms`);
  console.log(`  Output:`, ctx.result.output);
});

const unsubError = orchestrator.onToolError((ctx) => {
  console.error(`[${ctx.taskId}] Tool failed: ${ctx.toolName}`);
  console.error(`  Error: ${ctx.error}`);
});

// Later: cleanup
unsubStart();
unsubComplete();
unsubError();
```

```typescript
// Example 2: Metrics collection
const toolMetrics: Map<string, { count: number; totalDuration: number; errors: number }> = new Map();

orchestrator.onToolComplete((ctx) => {
  const metrics = toolMetrics.get(ctx.toolName) ?? { count: 0, totalDuration: 0, errors: 0 };
  metrics.count++;
  metrics.totalDuration += ctx.timing.duration;
  toolMetrics.set(ctx.toolName, metrics);
});

orchestrator.onToolError((ctx) => {
  const metrics = toolMetrics.get(ctx.toolName) ?? { count: 0, totalDuration: 0, errors: 0 };
  metrics.errors++;
  toolMetrics.set(ctx.toolName, metrics);
});
```

```typescript
// Example 3: Security monitoring
const SENSITIVE_TOOLS = ['Bash', 'Write', 'Edit'];

orchestrator.onToolStart((ctx) => {
  if (SENSITIVE_TOOLS.includes(ctx.toolName)) {
    auditLog.record({
      event: 'sensitive_tool_invoked',
      taskId: ctx.taskId,
      tool: ctx.toolName,
      input: ctx.input,
      timestamp: ctx.timestamp,
    });
  }
});
```

### Alternative Considered: Separate Hook Manager

An alternative would be to extend the existing `HookManager` class with callback registration. However, this was rejected because:

1. **Complexity**: `HookManager` is designed for external script handlers, not callbacks
2. **Coupling**: Would require significant changes to hook execution flow
3. **Purpose**: `HookManager` handles pre/post hooks that can modify execution; these are notification-only
4. **Simplicity**: The proposed approach leverages existing events with minimal new code

### Integration with Existing Systems

1. **EventEmitter**: Hooks wrap the existing `tool:start` and `tool:complete` events
2. **ToolExecution Tracking**: Context enriched from `activeToolExecutions` Map
3. **HookManager**: Unchanged; continues to handle script-based pre/post hooks
4. **OrchestratorEvents**: No changes to the event interface

### Test Strategy

1. **Unit Tests**:
   - Hook registration returns unsubscribe function
   - Callbacks receive correct context data
   - onToolStart fires on 'tool:start' event
   - onToolComplete fires only on successful 'tool:complete'
   - onToolError fires only on failed 'tool:complete'
   - Unsubscribe removes the handler

2. **Integration Tests**:
   - Full tool execution flow triggers appropriate hooks
   - Multiple hooks can be registered simultaneously
   - Hooks receive context from actual tool executions

3. **Type Safety Tests**:
   - Context types are correctly inferred
   - Callback signatures are enforced

## Consequences

### Positive

- Simple, callback-based API for tool execution monitoring
- No breaking changes to existing event system
- Type-safe context objects with full execution details
- Easy cleanup via unsubscribe functions
- Consistent with common JavaScript/TypeScript patterns

### Negative

- Additional memory for wrapped handlers (minimal)
- Slight indirection between events and hooks (negligible performance impact)
- onToolComplete and onToolError share 'tool:complete' event (clear separation via success flag)

### Neutral

- Existing HookManager continues to serve different use case (script-based hooks)
- Events still available for direct subscription if preferred

## Implementation Plan

| Step | Description | Files |
|------|-------------|-------|
| 1 | Add hook context interfaces to core types | `packages/core/src/types.ts` |
| 2 | Add callback type definitions | `packages/core/src/types.ts` |
| 3 | Implement onToolStart method | `packages/orchestrator/src/index.ts` |
| 4 | Implement onToolComplete method | `packages/orchestrator/src/index.ts` |
| 5 | Implement onToolError method | `packages/orchestrator/src/index.ts` |
| 6 | Export new types from packages | `packages/core/src/index.ts`, `packages/orchestrator/src/index.ts` |
| 7 | Add unit tests | `packages/orchestrator/src/__tests__/tool-execution-hooks.test.ts` |
| 8 | Add integration tests | `packages/orchestrator/src/__tests__/tool-execution-hooks.integration.test.ts` |
| 9 | Update documentation | `packages/orchestrator/README.md` |

## References

- Existing `tool:start`, `tool:complete`, `tool:progress` events (index.ts:307-309)
- `ToolCallStartEvent`, `ToolCallCompleteEvent`, `ToolCallProgressEvent` interfaces (index.ts:552-597)
- `HookManager` class (hook-manager.ts)
- `ToolExecution` interface (@apexcli/core)
- ADR-028: Snapshot Capture Integration with Tool Execution Tracking
