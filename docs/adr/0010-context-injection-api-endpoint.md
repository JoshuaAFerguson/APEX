# ADR 0010: Context Injection API Endpoint

## Status
Proposed

## Date
2026-03-16

## Context

The APEX system requires an API endpoint to inject additional context into running tasks. This allows external systems, users, or other agents to provide supplementary information to a task during execution. Use cases include:

1. Providing clarifying instructions mid-task
2. Injecting environment-specific context
3. Adding user feedback for iterative development
4. Supplying external data from integrations

## Decision

### Endpoint Design

**Endpoint**: `POST /tasks/:id/context`

**Request Body**:
```typescript
interface InjectContextRequest {
  context: string;           // Required: The context string to inject
  source?: string;           // Optional: Source identifier (e.g., "user", "slack", "api")
  priority?: 'low' | 'normal' | 'high'; // Optional: Priority for context handling
}
```

**Response**:
```typescript
// Success (200)
interface InjectContextResponse {
  ok: true;
  taskId: string;
  contextInjected: boolean;
  timestamp: Date;
}

// Error (404)
interface ErrorResponse {
  error: string;
}
```

### Architecture Components

1. **API Layer** (`packages/api/src/index.ts`)
   - New POST endpoint following existing patterns for `/tasks/:id/*` routes
   - Auth middleware automatically applied (non-public route)
   - Input validation for context string (non-empty, max length)
   - Task existence validation

2. **Event Broadcasting**
   - New WebSocket event type: `context:injected`
   - Broadcast to task subscribers when context is injected
   - Event data includes context metadata (source, timestamp)

3. **Core Types** (`packages/core/src/types.ts`)
   - Add `context:injected` to `ApexEventType` union
   - Define `ContextInjectedEventData` interface

4. **Orchestrator Integration** (`packages/orchestrator`)
   - Optional: Store injected context on task for agent access
   - Optional: Emit orchestrator-level event for context injection

### Design Principles

1. **Follow Existing Patterns**: The endpoint follows the established pattern of:
   - `/tasks/:id/status` - Update status
   - `/tasks/:id/log` - Add log entry
   - `/tasks/:id/cancel` - Cancel task

2. **Auth Consistency**: Uses existing auth middleware (non-public route)

3. **Event-Driven**: Broadcasts WebSocket event for real-time updates

4. **Minimal Core Changes**: Initially, context injection is event-based only. Future iterations can add context persistence to the task store.

### Sequence Diagram

```
Client                API Server              Orchestrator           WebSocket Clients
  |                        |                        |                        |
  |-- POST /tasks/:id/context -->                   |                        |
  |                        |                        |                        |
  |                        |-- getTask(id) -------->|                        |
  |                        |<----- task/null -------|                        |
  |                        |                        |                        |
  |                        |-- broadcast() ---------|----------------------->|
  |                        |   (context:injected)   |                        |
  |                        |                        |                        |
  |<-- { ok: true } -------|                        |                        |
```

### Input Validation

- `context`: Required, non-empty string, max 100,000 characters
- `source`: Optional string, max 50 characters
- `priority`: Optional enum, defaults to 'normal'

### Error Handling

| Condition | Status Code | Error Message |
|-----------|-------------|---------------|
| Task not found | 404 | "Task not found" |
| Empty context | 400 | "Context string is required" |
| Context too long | 400 | "Context exceeds maximum length" |
| Invalid task status | 400 | "Cannot inject context into completed/cancelled task" |

## Consequences

### Positive
- Enables dynamic context injection during task execution
- Follows established API patterns for consistency
- Real-time notifications via WebSocket
- Simple, focused implementation

### Negative
- Context is event-based only; not persisted to task by default
- No built-in deduplication of injected context
- Agents must explicitly handle injected context events

### Risks
- Large context injections could impact performance (mitigated by max length)
- Rapid successive injections could cause event flooding (could add rate limiting later)

## Implementation Notes

### Files to Modify

1. `packages/core/src/types.ts`
   - Add `context:injected` to `ApexEventType`
   - Add `ContextInjectedEventData` interface

2. `packages/api/src/index.ts`
   - Add POST `/tasks/:id/context` endpoint
   - Add input validation
   - Add WebSocket broadcast

### Test Requirements

1. Unit tests for input validation
2. Integration tests for endpoint behavior
3. WebSocket event broadcasting tests
4. Auth middleware verification tests

## Related

- `/tasks/:id/log` endpoint (similar pattern)
- `/tasks/:id/status` endpoint (similar pattern)
- WebSocket event system
