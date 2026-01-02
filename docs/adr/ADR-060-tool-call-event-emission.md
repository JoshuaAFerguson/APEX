# ADR-060: Tool Call Event Emission from ApexOrchestrator

## Status

Proposed

## Context

The ApexOrchestrator currently emits an `agent:tool-use` event when the Claude SDK makes tool calls. However, this is a simple notification that doesn't capture the full lifecycle of tool execution. To provide better observability and enable real-time streaming of tool call progress to consumers (CLI, API, WebSocket clients), we need granular events for:

1. **Tool Start** - When a tool execution begins
2. **Tool Progress** - Optional intermediate updates during tool execution
3. **Tool Complete** - When a tool execution finishes (success or failure)

The Claude Agent SDK provides two hook points:
- `PreToolUse` - Called before tool execution
- `PostToolUse` - Called after tool execution completes

These hooks receive detailed information about the tool being executed and its results.

## Decision

### 1. New Event Types in Core Schema

Add three new event types to `ApexEventType` in `packages/core/src/types.ts`:

```typescript
export type ApexEventType =
  // ... existing events
  | 'tool:start'
  | 'tool:progress'
  | 'tool:complete';
```

### 2. Tool Event Data Schemas

Define new Zod schemas for the tool event payloads:

```typescript
/**
 * Base interface for all tool event data
 * Contains common fields shared across all tool lifecycle events
 */
export interface ToolEventDataBase {
  /** Unique identifier for this tool invocation */
  toolUseId: string;
  /** Name of the tool being executed */
  toolName: string;
  /** Task ID this tool execution belongs to */
  taskId: string;
  /** Agent executing the tool (if available) */
  agentName?: string;
  /** Current workflow stage (if available) */
  stageName?: string;
  /** Timestamp when the event occurred */
  timestamp: Date;
}

/**
 * Event data for 'tool:start' event
 * Emitted when a tool execution begins
 */
export interface ToolStartEventData extends ToolEventDataBase {
  /** Input parameters passed to the tool */
  input: Record<string, unknown>;
  /** Estimated duration in milliseconds (if available) */
  estimatedDuration?: number;
}

/**
 * Event data for 'tool:progress' event
 * Emitted during long-running tool executions
 */
export interface ToolProgressEventData extends ToolEventDataBase {
  /** Progress percentage (0-100) */
  progress?: number;
  /** Current status message */
  message?: string;
  /** Bytes processed (for file/network operations) */
  bytesProcessed?: number;
  /** Total bytes (for file/network operations) */
  totalBytes?: number;
}

/**
 * Event data for 'tool:complete' event
 * Emitted when a tool execution finishes
 */
export interface ToolCompleteEventData extends ToolEventDataBase {
  /** Whether the tool execution was successful */
  success: boolean;
  /** Execution duration in milliseconds */
  duration: number;
  /** Tool result (summarized for large outputs) */
  result?: unknown;
  /** Error message if execution failed */
  error?: string;
  /** Whether the result was truncated */
  resultTruncated?: boolean;
}

/**
 * Union type for all tool event data types
 */
export type ToolEventData =
  | ToolStartEventData
  | ToolProgressEventData
  | ToolCompleteEventData;

/**
 * Type-safe tool event interface
 */
export interface ToolEvent<T extends ToolEventData = ToolEventData> {
  type: Extract<ApexEventType, `tool:${string}`>;
  taskId: string;
  timestamp: Date;
  data: T;
}
```

### 3. OrchestratorEvents Interface Updates

Add the new events to the `OrchestratorEvents` interface in `packages/orchestrator/src/index.ts`:

```typescript
export interface OrchestratorEvents {
  // ... existing events

  // Tool lifecycle events (v0.5.0)
  'tool:start': (event: ToolStartEventData) => void;
  'tool:progress': (event: ToolProgressEventData) => void;
  'tool:complete': (event: ToolCompleteEventData) => void;
}
```

### 4. Hook Context Updates

Extend the `HookContext` interface in `packages/orchestrator/src/hooks.ts`:

```typescript
export interface HookContext {
  taskId: string;
  store: TaskStore;
  permissionPresetManager?: PermissionPresetManager;
  onToolUse?: (tool: string, input: unknown) => void;
  eventEmitter?: {
    emit: (event: string, data: unknown) => void;
  };
  // New: Additional context for tool events
  agentName?: string;
  stageName?: string;
}
```

### 5. PreToolUse Hook Enhancement

Add a new hook in the `createHooks` function to emit `tool:start`:

```typescript
// Emit tool:start event for all tools
{
  hooks: [createHookCallback(context, emitToolStart)],
  timeout: 1, // Minimal overhead
},

async function emitToolStart(
  input: HookInput,
  toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolName = getToolName(input);
  const toolInput = getToolInput(input);

  context.eventEmitter?.emit('tool:start', {
    toolUseId: toolUseId || crypto.randomUUID(),
    toolName,
    taskId: context.taskId,
    agentName: context.agentName,
    stageName: context.stageName,
    input: summarizeInput(toolInput),
    timestamp: new Date(),
  });

  return {};
}
```

### 6. PostToolUse Hook Enhancement

Add a new hook to emit `tool:complete`:

```typescript
// Emit tool:complete event for all tools
{
  hooks: [createHookCallback(context, emitToolComplete)],
  timeout: 1, // Minimal overhead
},

async function emitToolComplete(
  input: HookInput,
  toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolName = getToolName(input);
  const toolResult = getToolResult(input);

  // Track execution time using stored start time
  const startTime = toolExecutionTimes.get(toolUseId || '');
  const duration = startTime ? Date.now() - startTime : 0;
  toolExecutionTimes.delete(toolUseId || '');

  context.eventEmitter?.emit('tool:complete', {
    toolUseId: toolUseId || '',
    toolName,
    taskId: context.taskId,
    agentName: context.agentName,
    stageName: context.stageName,
    success: !toolResult?.error,
    duration,
    result: summarizeResult(toolResult),
    error: toolResult?.error,
    resultTruncated: isResultTruncated(toolResult),
    timestamp: new Date(),
  });

  return {};
}
```

### 7. Execution Time Tracking

Use a Map to track tool execution start times:

```typescript
// Module-level Map to track tool execution times
const toolExecutionTimes = new Map<string, number>();

// In emitToolStart:
if (toolUseId) {
  toolExecutionTimes.set(toolUseId, Date.now());
}
```

### 8. Progress Events (Future Enhancement)

The `tool:progress` event is designed for future enhancement when:
- Long-running bash commands could emit periodic progress
- File operations could report bytes processed
- Network operations could report download/upload progress

Currently, this will not be implemented as the Claude SDK hooks don't provide intermediate callbacks.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ApexOrchestrator                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     query() loop                                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │              Claude Agent SDK                            │    │   │
│  │  │  ┌─────────────────┐    ┌─────────────────┐             │    │   │
│  │  │  │  PreToolUse     │───▶│  Tool Execution  │             │    │   │
│  │  │  │  Hooks          │    │                  │             │    │   │
│  │  │  │  - emitToolStart│    │                  │             │    │   │
│  │  │  │  - permissions  │    │                  │             │    │   │
│  │  │  │  - dangerous    │    │                  │             │    │   │
│  │  │  └─────────────────┘    └────────┬─────────┘             │    │   │
│  │  │                                   │                       │    │   │
│  │  │                         ┌─────────▼─────────┐             │    │   │
│  │  │                         │  PostToolUse      │             │    │   │
│  │  │                         │  Hooks            │             │    │   │
│  │  │                         │  - emitToolComplete│            │    │   │
│  │  │                         │  - logToolResult  │             │    │   │
│  │  │                         └───────────────────┘             │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
│                                  │                                       │
│  ┌──────────────────────────────▼──────────────────────────────────┐   │
│  │                    EventEmitter                                   │   │
│  │  emit('tool:start', data)                                        │   │
│  │  emit('tool:complete', data)                                     │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
└──────────────────────────────────┼───────────────────────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │    CLI      │         │    API      │         │  WebSocket  │
    │  Subscriber │         │  Subscriber │         │   Clients   │
    └─────────────┘         └─────────────┘         └─────────────┘
```

## Data Flow

1. **Tool Execution Initiated**: Claude SDK calls a tool
2. **PreToolUse Hooks Execute**:
   - `emitToolStart` records start time and emits `tool:start` event
   - Permission/dangerous operation checks run
3. **Tool Executes**: Actual tool logic runs
4. **PostToolUse Hooks Execute**:
   - `emitToolComplete` calculates duration and emits `tool:complete` event
   - Result logging hooks run
5. **Events Propagate**: CLI/API/WebSocket consumers receive events

## File Changes Summary

### Core Package (`packages/core/src/types.ts`)
- Add `tool:start`, `tool:progress`, `tool:complete` to `ApexEventType`
- Add `ToolEventDataBase`, `ToolStartEventData`, `ToolProgressEventData`, `ToolCompleteEventData` interfaces
- Add `ToolEventData` union type
- Add `ToolEvent` generic interface
- Add corresponding Zod schemas for validation

### Orchestrator Package (`packages/orchestrator/src/index.ts`)
- Add new events to `OrchestratorEvents` interface
- Pass `agentName` and `stageName` to `createHooks` context

### Hooks Module (`packages/orchestrator/src/hooks.ts`)
- Extend `HookContext` with `agentName` and `stageName`
- Add `emitToolStart` PreToolUse hook
- Add `emitToolComplete` PostToolUse hook
- Add `toolExecutionTimes` Map for duration tracking
- Add `getToolResult` helper function
- Add `summarizeResult` helper function
- Add `isResultTruncated` helper function

## Testing Strategy

1. **Unit Tests** (`packages/orchestrator/src/hooks.test.ts`)
   - Test `emitToolStart` emits correct event data
   - Test `emitToolComplete` emits correct event data
   - Test duration calculation accuracy
   - Test result summarization for large outputs
   - Test error handling in tool completion

2. **Integration Tests** (new file: `packages/orchestrator/src/tool-events.integration.test.ts`)
   - Test full tool lifecycle from start to complete
   - Test event ordering (start before complete)
   - Test concurrent tool executions
   - Test event data consistency

3. **Type Tests** (`packages/core/src/__tests__/tool-events.test.ts`)
   - Validate Zod schemas
   - Test type inference for event data

## Backward Compatibility

- The existing `agent:tool-use` event remains unchanged
- New events are additive; no breaking changes
- Consumers can opt-in to new events without modification

## Performance Considerations

- Hook timeout set to 1ms to minimize overhead
- Input/result summarization prevents memory issues with large data
- Execution time tracking uses lightweight Map operations
- Events are fire-and-forget (no blocking)

## Alternatives Considered

### 1. Modify `agent:tool-use` Event
- **Rejected**: Would break existing consumers expecting current signature
- Adding fields would require all consumers to update

### 2. Single Combined Event
- **Rejected**: Less granular, harder to stream real-time updates
- Would require consumers to filter/parse event types

### 3. Custom Event Emitter in Hooks
- **Rejected**: Adds complexity, duplicates existing EventEmitter pattern
- HookContext already has `eventEmitter` reference

## Implementation Priority

1. **Phase 1** (This PR): `tool:start` and `tool:complete` events
2. **Phase 2** (Future): `tool:progress` events for long-running operations
3. **Phase 3** (Future): Integration with WebSocket streaming

## References

- Claude Agent SDK Hooks: `PreToolUse`, `PostToolUse`
- Existing event patterns: Container events, Permission events
- EventEmitter3 library documentation
