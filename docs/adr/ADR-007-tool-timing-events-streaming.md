# ADR-007: Tool Timing Events Streaming via WebSocket

## Status
Proposed

## Date
2025-01-XX

## Context

The APEX system needs to properly stream tool execution timing data to WebSocket clients for real-time UI updates. The current implementation has the following components:

1. **Orchestrator** (`packages/orchestrator/src/index.ts`): Emits `tool:start`, `tool:progress`, and `tool:complete` events with timing data
2. **API Server** (`packages/api/src/index.ts`): Forwards events from orchestrator to WebSocket clients
3. **CLI Frontend** (`packages/cli/src/ui/components/ToolCall.tsx`): Displays tool calls with timing information
4. **Hook** (`packages/cli/src/ui/hooks/useToolEventLogger.ts`): Bridges orchestrator events to UI state

### Current Issues Identified

After analyzing the codebase, the following issues were identified:

1. **Missing `tool:progress` emission**: The orchestrator defines the event type but never emits `tool:progress` events during tool execution
2. **`tool:start` missing `startTime` in data payload**: The WebSocket broadcast for `tool:start` includes `toolName`, `input`, `callId` but not `timestamp` as a named timing field
3. **Timing data serialization**: Date objects may not serialize correctly to JSON when sent over WebSocket
4. **ToolCall.tsx receives duration but not intermediate timing**: The component displays `duration` prop but doesn't track real-time elapsed time during `running` state

## Decision

### 1. Event Structure Standardization

All timing-related events should include consistent timing fields:

```typescript
// tool:start event data
{
  type: 'tool:start',
  taskId: string,
  timestamp: string, // ISO 8601 string
  data: {
    toolName: string,
    input: Record<string, unknown>,
    callId: string,
    startTime: string, // ISO 8601 - explicit timing field
  }
}

// tool:progress event data
{
  type: 'tool:progress',
  taskId: string,
  timestamp: string,
  data: {
    toolName: string,
    callId: string,
    progress: {
      message: string,
      percentage?: number,
      elapsedMs?: number, // Time since tool:start
    },
    startTime: string, // Original start time for duration calculation
  }
}

// tool:complete event data
{
  type: 'tool:complete',
  taskId: string,
  timestamp: string,
  data: {
    toolName: string,
    callId: string,
    result: {
      success: boolean,
      output?: unknown,
      error?: string,
    },
    timing: {
      startTime: string, // ISO 8601
      endTime: string,   // ISO 8601
      duration: number,  // milliseconds
    }
  }
}
```

### 2. Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Orchestrator                                │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ runAgentQuery()                                                 │ │
│  │  ├─ case 'tool_call': emit('tool:start', { startTime, ... })  │ │
│  │  ├─ [optional] emit('tool:progress', { elapsedMs, ... })      │ │
│  │  └─ case 'tool_result': emit('tool:complete', { timing, ... })│ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ EventEmitter                                                    │ │
│  │  tool:start ────────────────┐                                  │ │
│  │  tool:progress ─────────────┤                                  │ │
│  │  tool:complete ─────────────┤                                  │ │
│  └────────────────────────────┘│                                  │ │
└─────────────────────────────────│──────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API Server                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Event Handlers                                                  │ │
│  │  on('tool:start'):                                             │ │
│  │    - Serialize Date objects to ISO strings                     │ │
│  │    - Include startTime in data                                 │ │
│  │    - broadcast() to WebSocket clients                          │ │
│  │                                                                 │ │
│  │  on('tool:progress'):                                          │ │
│  │    - Calculate elapsedMs from stored startTime                 │ │
│  │    - broadcast() to WebSocket clients                          │ │
│  │                                                                 │ │
│  │  on('tool:complete'):                                          │ │
│  │    - Serialize timing.startTime/endTime to ISO strings         │ │
│  │    - truncatePayload() for large outputs                       │ │
│  │    - broadcast() to WebSocket clients                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ WebSocket                                                       │ │
│  │  /stream/:taskId ───────────────────────────────────────────────│─┤
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────│──────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CLI Frontend                                 │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ useToolEventLogger Hook                                         │ │
│  │  - Listen for tool:start/progress/complete                     │ │
│  │  - Parse ISO dates back to Date objects                        │ │
│  │  - Track activeToolCalls with startTime                        │ │
│  │  - Update toolLogs with timing data                            │ │
│  │  - Compute averageDuration                                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ ToolCall Component                                              │ │
│  │  - Display spinner during 'running' status                     │ │
│  │  - Show elapsed time using useElapsedTime hook                 │ │
│  │  - Display final duration on completion                        │ │
│  │  - Support all display modes (compact, normal, verbose)        │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Implementation Changes

#### 3.1 Orchestrator Changes (`packages/orchestrator/src/index.ts`)

**Current tool:start emission (line ~4243):**
```typescript
this.emit('tool:start', {
  taskId: task.id,
  toolName,
  input,
  timestamp,  // This is a Date object
  callId,
});
```

**Add `startTime` alias for clarity:**
```typescript
this.emit('tool:start', {
  taskId: task.id,
  toolName,
  input,
  timestamp,    // Date object for backward compatibility
  startTime: timestamp, // Explicit timing field (same value)
  callId,
});
```

**Emit tool:progress for long-running operations (optional enhancement):**
- Add progress emission capability for tools that support it (e.g., Bash commands with streaming output)
- Not required for MVP but interface should be ready

#### 3.2 API Server Changes (`packages/api/src/index.ts`)

**Update tool:start handler (line ~2129):**
```typescript
orchestrator.on('tool:start', (event: ToolCallStartEvent) => {
  broadcast(event.taskId, {
    type: 'tool:start',
    taskId: event.taskId,
    timestamp: event.timestamp.toISOString(), // Serialize to string
    data: {
      toolName: event.toolName,
      input: event.input,
      callId: event.callId,
      startTime: event.timestamp.toISOString(), // Include in data
    },
  });
});
```

**Update tool:complete handler (line ~2155):**
```typescript
orchestrator.on('tool:complete', (event: ToolCallCompleteEvent) => {
  const truncatedData = truncatePayload({
    toolName: event.toolName,
    callId: event.callId,
    result: event.result,
    timing: {
      startTime: event.timing.startTime.toISOString(),
      endTime: event.timing.endTime.toISOString(),
      duration: event.timing.duration,
    },
  }, { maxArrayItems: 1000, maxStringLength: 50 * 1024 });

  broadcast(event.taskId, {
    type: 'tool:complete',
    taskId: event.taskId,
    timestamp: event.timestamp.toISOString(),
    data: truncatedData.data,
    _truncation: truncatedData._truncation,
  });
});
```

#### 3.3 CLI Changes (`packages/cli/src/ui/components/ToolCall.tsx`)

**Add real-time elapsed time display during running status:**
```typescript
import { useElapsedTime } from '../hooks/useElapsedTime.js';

interface ToolCallProps {
  // ... existing props
  startTime?: Date; // Add optional startTime prop
}

export function ToolCall({
  // ... existing props
  startTime,
}: ToolCallProps): React.ReactElement {
  const elapsedTime = useElapsedTime(
    status === 'running' ? startTime : null
  );

  // In the render:
  {status === 'running' && elapsedTime && (
    <Text color="gray" dimColor>
      ({elapsedTime})
    </Text>
  )}
  {duration !== undefined && status !== 'running' && (
    <Text color="gray" dimColor>
      ({formatDuration(duration)})
    </Text>
  )}
}
```

#### 3.4 Hook Changes (`packages/cli/src/ui/hooks/useToolEventLogger.ts`)

**Parse ISO date strings from WebSocket:**
```typescript
const handleToolStart = (event: ToolCallStartEvent) => {
  // If timestamp comes as string (from WebSocket), parse it
  const timestamp = typeof event.timestamp === 'string'
    ? new Date(event.timestamp)
    : event.timestamp;

  const startTime = event.startTime
    ? (typeof event.startTime === 'string' ? new Date(event.startTime) : event.startTime)
    : timestamp;

  // ... rest of handler
};
```

### 4. Test Strategy

1. **Unit Tests** (`packages/orchestrator/src/tool-execution-timing.test.ts`):
   - Verify `tool:start` includes `startTime` field
   - Verify `tool:complete` timing object has correct structure
   - Test duration calculation accuracy

2. **Integration Tests** (`packages/api/src/__tests__/tool-events-integration-comprehensive.test.ts`):
   - Verify WebSocket receives serialized ISO strings
   - Verify event sequence: start → progress → complete
   - Verify timing data integrity across serialization

3. **Component Tests** (`packages/cli/src/ui/components/__tests__/ToolCall.test.tsx`):
   - Test elapsed time display during running state
   - Test duration display after completion
   - Test all display modes with timing

### 5. Backward Compatibility

- Existing `timestamp` field kept as Date object in orchestrator
- New `startTime` field added as alias
- API server converts to ISO strings for JSON serialization
- Clients should accept both Date objects (direct usage) and strings (WebSocket)

## Consequences

### Positive
- Consistent timing data across all tool events
- Real-time elapsed time display during tool execution
- Proper JSON serialization of dates
- Clear interface for future `tool:progress` implementations
- Improved debugging and monitoring capabilities

### Negative
- Minor breaking change if clients expect Date objects from WebSocket
- Additional field (`startTime`) increases payload size slightly
- Need to update existing tests

### Risks
- Clock skew between orchestrator and client could cause timing display issues
- Large outputs may still impact WebSocket performance despite truncation

## Implementation Plan

1. **Phase 1**: Update orchestrator to include `startTime` in `tool:start` event
2. **Phase 2**: Update API server to serialize dates as ISO strings
3. **Phase 3**: Update `ToolCall.tsx` to show real-time elapsed time
4. **Phase 4**: Add/update tests for timing event verification
5. **Phase 5**: (Optional) Implement `tool:progress` emission for long-running tools

## Files to Modify

1. `packages/orchestrator/src/index.ts` - Add startTime to tool:start event
2. `packages/api/src/index.ts` - Serialize dates, include startTime in data
3. `packages/cli/src/ui/components/ToolCall.tsx` - Add elapsed time during running
4. `packages/cli/src/ui/hooks/useToolEventLogger.ts` - Parse ISO date strings
5. `packages/orchestrator/src/tool-execution-timing.test.ts` - Update timing tests
6. `packages/api/src/websocket-tool-events.test.ts` - Update WebSocket tests
7. `packages/cli/src/ui/hooks/__tests__/useToolEventLogger.test.ts` - Update hook tests
8. `packages/cli/src/ui/components/__tests__/ToolCall.test.tsx` - Add timing tests

## Related ADRs
- ADR-XXX: WebSocket Event Protocol (if exists)
- ADR-XXX: Tool Execution Model (if exists)
