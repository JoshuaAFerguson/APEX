# ADR-207: MCP Install Error WebSocket Integration Test Design

## Status
Proposed

## Context

The APEX system needs integration tests to verify that `mcp:install-error` events are properly broadcast to WebSocket clients when MCP server installation fails. The acceptance criteria are:

1. **WebSocket clients receive `mcp:install-error` events when installation fails**
2. **Error events contain `serverId`, error message, `stage`, and `timestamp`**
3. **Multiple clients receive the same error broadcast**

### Existing Infrastructure Analysis

After analyzing the codebase, I found robust existing infrastructure:

1. **WebSocket Test Client** (`tests/e2e/utils/ws-test-client.ts`)
   - Full-featured `WebSocketTestClient` interface with `waitForEvent()`, `collectEvents()`, event buffering
   - Factory function `createWebSocketTestClient(url)`
   - Supports timeout handling, message filtering, and predicate-based waiting

2. **Existing MCP Event Tests**
   - `packages/api/src/__tests__/mcp-event-broadcasting-integration.test.ts` - Has 765 lines of tests for MCP event broadcasting
   - `packages/api/src/__tests__/mcp-websocket-events.test.ts` - WebSocket event streaming tests
   - `packages/api/src/__tests__/mcp-error-broadcasting.integration.test.ts` - Error event broadcasting patterns
   - `tests/e2e/mcp-marketplace-api-flow.e2e.test.ts` - E2E test patterns with `APITestServer`

3. **Event Data Structures** (from ADR-202)
   ```typescript
   interface MCPInstallErrorEventData {
     serverId: string;
     serverName?: string;
     stage: 'error';
     progress: number;
     message: string;
     error: {
       message: string;
       code?: string;
       stack?: string;
       recoverable: boolean;
       suggestedAction?: string;
     };
     timestamp: Date;
   }
   ```

4. **Broadcasting Architecture**
   - Events flow: Orchestrator → `setupEventBroadcasting()` → `broadcast()` → WebSocket clients
   - Task ID for MCP installation events: `'mcp-installation'`
   - WebSocket endpoint: `/stream/:taskId`

## Decision

### Technical Design: MCP Install Error WebSocket Integration Test

Create a focused integration test file that verifies the acceptance criteria using the existing test infrastructure.

### 1. Test File Location

```
packages/api/src/__tests__/mcp-install-error-websocket.integration.test.ts
```

Rationale: Follows the existing pattern in `packages/api/src/__tests__/` where similar MCP WebSocket tests reside.

### 2. Test Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Test Architecture                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌─────────────────┐                       │
│  │ Test Server  │────▶│  Mock          │                       │
│  │ (Fastify +   │     │  Orchestrator  │                       │
│  │  WebSocket)  │     │  (EventEmitter)│                       │
│  └──────────────┘     └─────────────────┘                       │
│         │                     │                                 │
│         │                     │ emit('mcp:install-error')       │
│         │                     ▼                                 │
│         │            ┌─────────────────┐                        │
│         │            │ Event Handler   │                        │
│         │            │ (broadcast)     │                        │
│         │            └─────────────────┘                        │
│         │                     │                                 │
│         ▼                     ▼                                 │
│  ┌──────────────┐     ┌─────────────────┐                       │
│  │ WebSocket    │◀───▶│ WebSocket       │                       │
│  │ Client 1     │     │ Client 2 (opt)  │                       │
│  └──────────────┘     └─────────────────┘                       │
│         │                     │                                 │
│         ▼                     ▼                                 │
│  ┌──────────────────────────────────────┐                       │
│  │ Assertions on received events       │                       │
│  └──────────────────────────────────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Test Implementation Design

#### 3.1 Core Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

// Test Server Factory
async function createMCPInstallErrorTestServer() {
  const fastify = Fastify();
  await fastify.register(websocket);

  // Mock orchestrator using EventEmitter
  const mockOrchestrator = new EventEmitter();

  // Client tracking
  const clients = new Map<string, Set<{ socket: WebSocket }>>();
  const broadcastedEvents: any[] = [];

  // Broadcast function
  function broadcast(taskId: string, event: any): void {
    broadcastedEvents.push({ taskId, event });
    const taskClients = clients.get(taskId);
    if (!taskClients) return;

    const message = JSON.stringify(event);
    for (const client of taskClients) {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(message);
      }
    }
  }

  // Wire up mcp:install-error event handler
  mockOrchestrator.on('mcp:install-error', (event: any) => {
    broadcast('mcp-installation', {
      type: 'mcp:install-error',
      taskId: 'mcp-installation',
      timestamp: event.timestamp || new Date(),
      data: {
        serverId: event.serverId,
        serverName: event.serverName,
        stage: event.stage,
        progress: event.progress,
        message: event.message,
        error: event.error,
      },
    });
  });

  // WebSocket endpoint
  fastify.get('/stream/:taskId', { websocket: true }, (socket, request) => {
    const { taskId } = request.params as { taskId: string };

    const client = { socket };
    if (!clients.has(taskId)) {
      clients.set(taskId, new Set());
    }
    clients.get(taskId)!.add(client);

    socket.on('close', () => {
      clients.get(taskId)?.delete(client);
      if (clients.get(taskId)?.size === 0) {
        clients.delete(taskId);
      }
    });
  });

  return { fastify, mockOrchestrator, clients, broadcastedEvents, broadcast };
}
```

#### 3.2 Test Cases Mapped to Acceptance Criteria

**Acceptance Criterion 1: WebSocket clients receive `mcp:install-error` events when installation fails**

```typescript
it('delivers mcp:install-error events to connected WebSocket clients', async () => {
  // 1. Connect WebSocket client
  // 2. Emit mcp:install-error from mock orchestrator
  // 3. Assert client receives the error event
  // 4. Assert event.type === 'mcp:install-error'
});
```

**Acceptance Criterion 2: Error events contain serverId, error message, stage, and timestamp**

```typescript
it('validates error event structure contains required fields', async () => {
  // 1. Emit error event with full data
  // 2. Capture received event
  // 3. Assert: event.data.serverId exists and is correct
  // 4. Assert: event.data.error (message) exists
  // 5. Assert: event.data.stage === 'error'
  // 6. Assert: event.timestamp exists and is valid Date
});
```

**Acceptance Criterion 3: Multiple clients receive the same error broadcast**

```typescript
it('broadcasts error events to multiple connected clients simultaneously', async () => {
  // 1. Connect 2+ WebSocket clients
  // 2. Wait for all to be connected
  // 3. Emit single mcp:install-error event
  // 4. Assert both clients received the event
  // 5. Assert both received identical data
});
```

### 4. Error Event Payload Structure

The test should validate this exact structure:

```typescript
interface MCPInstallErrorBroadcastEvent {
  type: 'mcp:install-error';
  taskId: 'mcp-installation';
  timestamp: string | Date;
  data: {
    serverId: string;           // Required - identifies failing server
    serverName?: string;        // Optional - human-readable name
    stage: 'error';            // Required - always 'error' for error events
    progress: number;          // Required - typically 0 for errors
    message: string;           // Required - error description
    error: {                   // Required - detailed error info
      message: string;
      code?: string;
      stack?: string;
      recoverable?: boolean;
      suggestedAction?: string;
    };
  };
}
```

### 5. Test Scenarios

| Scenario | Description | Validates AC |
|----------|-------------|--------------|
| Single client receives error | Connect 1 client, emit error, verify receipt | AC1 |
| Error event has serverId | Check `data.serverId` in received event | AC2 |
| Error event has message | Check `data.error.message` in received event | AC2 |
| Error event has stage | Check `data.stage === 'error'` | AC2 |
| Error event has timestamp | Check `timestamp` is valid | AC2 |
| Multiple clients receive same event | Connect 2+ clients, verify both get same event | AC3 |
| Clients get identical payloads | Compare events across clients | AC3 |

### 6. Implementation Considerations

1. **Use Native EventEmitter**: Instead of mocking `ApexOrchestrator`, use Node.js `EventEmitter` directly as the mock orchestrator to avoid constructor issues seen in existing tests.

2. **WebSocket Client Connection**: Use raw `ws` library directly rather than the E2E `WebSocketTestClient` for simpler setup.

3. **Promise-based Test Structure**: Use async/await with Promise wrappers for WebSocket events.

4. **Proper Cleanup**: Ensure all WebSocket connections close in `afterEach`.

5. **Timeout Handling**: Use reasonable timeouts (5s) for WebSocket operations.

## Consequences

### Positive
- Clean, focused test file with clear mapping to acceptance criteria
- Uses existing proven patterns from codebase
- Avoids complex mock setup issues
- Tests actual WebSocket broadcasting behavior

### Negative
- Requires running a Fastify server in tests (minimal overhead)
- Tests are integration-level rather than unit-level

### Neutral
- Follows existing test patterns in the codebase
- Uses same infrastructure as other MCP WebSocket tests

## Files to Create

1. `packages/api/src/__tests__/mcp-install-error-websocket.integration.test.ts`
   - ~150-200 lines
   - 5-7 focused test cases
   - Maps directly to acceptance criteria

## References

- ADR-202: MCP Install Event Broadcasting Architecture
- `tests/e2e/utils/ws-test-client.ts` - WebSocket test client
- `packages/api/src/__tests__/mcp-event-broadcasting-integration.test.ts` - Existing patterns
- `packages/api/src/__tests__/mcp-websocket-events.test.ts` - WebSocket event patterns
