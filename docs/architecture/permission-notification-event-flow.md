# Permission Notification Event Flow - Technical Analysis

## Overview

This document describes the current implementation of permission notification events across the APEX codebase, including how events are emitted by the orchestrator, subscribed to by the CLI, and broadcasted via WebSocket by the API.

## Event Types

### Permission Events (v0.5.0)

The orchestrator emits the following permission-related events defined in `packages/orchestrator/src/index.ts`:

| Event Name | Event Data Type | Description |
|------------|-----------------|-------------|
| `permission:request` | `PermissionRequestEventData` | Emitted when an agent requests permission to use a tool |
| `permission:granted` | `PermissionGrantedEventData` | Emitted when a permission request is approved |
| `permission:denied` | `PermissionDeniedEventData` | Emitted when a permission request is rejected |
| `permission:notification` | `PermissionNotification` | General permission notification |
| `dangerous:detected` | `DangerousOperationDetectedEventData` | Emitted when a dangerous operation is detected |
| `dangerous:confirmed` | `DangerousOperationConfirmedEventData` | Emitted when a dangerous operation is confirmed |
| `dangerous:blocked` | `DangerousOperationBlockedEventData` | Emitted when a dangerous operation is blocked |

### Event Data Structures

```typescript
// Permission Request Event
interface PermissionRequestEventData {
  requestId: string;
  tool: string;
  scope?: string;
  description: string;
  isDangerous: boolean;
  agent?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Permission Granted Event
interface PermissionGrantedEventData {
  requestId: string;
  tool: string;
  scope?: string;
  level: PermissionLevel;  // 'allow-always' | 'allow-once' | 'deny'
  grantedBy: string;
  timestamp: Date;
  reason?: string;
}

// Permission Denied Event
interface PermissionDeniedEventData {
  requestId: string;
  tool: string;
  scope?: string;
  deniedBy: string;
  timestamp: Date;
  reason: string;
}
```

## Event Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ORCHESTRATOR                                    │
│  (packages/orchestrator/src/index.ts)                                       │
│                                                                              │
│  ApexOrchestrator extends EventEmitter                                      │
│  ├── requestToolPermission() → emit('permission:request', ...)              │
│  ├── grantPermission() → emit('permission:granted', ...)                    │
│  └── denyPermission() → emit('permission:denied', ...)                      │
│                                                                              │
│  Hook System (packages/orchestrator/src/hooks.ts)                           │
│  └── checkPermissionPreset() → emit permission events based on preset rules │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ EventEmitter events
                                    ▼
        ┌───────────────────────────┴───────────────────────────┐
        │                                                        │
        ▼                                                        ▼
┌───────────────────────────────────┐    ┌──────────────────────────────────────┐
│              CLI                   │    │               API                     │
│  (packages/cli)                    │    │  (packages/api/src/index.ts)          │
│                                    │    │                                        │
│  Subscribes via orchestrator.on() │    │  setupEventBroadcasting()              │
│                                    │    │  ├── orchestrator.on() listeners       │
│  Event Handlers:                   │    │  └── broadcast() to WebSocket clients  │
│  ├── handlePermissionRequest()    │    │                                        │
│  ├── handlePermissionGranted()    │    │  WebSocket Route: /stream/:taskId      │
│  └── handlePermissionDenied()     │    │  ├── Client connects                   │
│                                    │    │  ├── Optional event filtering          │
│  Display (chalk, ora):            │    │  └── JSON messages broadcast           │
│  ├── 🔐 Permission required       │    │                                        │
│  ├── ✅ Permission granted        │    │  WebSocketClient interface:            │
│  └── ❌ Permission denied         │    │  { socket: WebSocket,                  │
│                                    │    │    eventFilters?: Set<string> }        │
└───────────────────────────────────┘    └──────────────────────────────────────┘
```

## Orchestrator Event Emission

### 1. Permission Request Hook (`packages/orchestrator/src/hooks.ts`)

The `checkPermissionPreset` function in the hook system emits permission events:

```typescript
// When tool is denied by preset
context.eventEmitter?.emit('permission:denied', {
  taskId: context.taskId,
  toolName,
  scope,
  timestamp: new Date(),
  denialReason: `Tool ${toolName} is not allowed by current permission preset`,
  deniedBy: `permission-preset:${preset}`,
});

// When tool is allowed by preset
context.eventEmitter?.emit('permission:granted', {
  taskId: context.taskId,
  toolName,
  scope,
  timestamp: new Date(),
  level: 'allow-always',
  grantedBy: `permission-preset:${preset}`,
  grantReason: `Tool ${toolName} is automatically allowed by permission preset`,
});

// When tool requires confirmation
context.eventEmitter?.emit('permission:request', {
  taskId: context.taskId,
  toolName,
  scope,
  timestamp: new Date(),
  reason: `Tool ${toolName} requires user confirmation`,
  agentName: 'orchestrator',
});
```

### 2. Orchestrator Methods (`packages/orchestrator/src/index.ts`)

The `ApexOrchestrator` class provides explicit permission management methods:

- `requestToolPermission(taskId, tool, scope, description, isDangerous, agent, metadata)`
- `grantPermission(requestId, tool, scope, level, grantedBy, reason)`
- `denyPermission(requestId, tool, scope, deniedBy, reason)`

## CLI Event Subscription

### Test Implementation (`packages/cli/src/__tests__/permission-notifications.test.ts`)

The CLI subscribes to permission events and displays notifications:

```typescript
class PermissionNotificationHandler {
  constructor(orchestrator: ApexOrchestrator) {
    this.subscribeToPermissionEvents();
  }

  private subscribeToPermissionEvents(): void {
    this.orchestrator.on('permission:request', this.handlePermissionRequest.bind(this));
    this.orchestrator.on('permission:granted', this.handlePermissionGranted.bind(this));
    this.orchestrator.on('permission:denied', this.handlePermissionDenied.bind(this));
  }
}
```

### Display Formatting

- **Request**: `🔐 Permission required for {tool}` (yellow)
- **Granted**: `✅ Permission granted for {tool}` (green)
- **Denied**: `❌ Permission denied for {tool}` (red)

## API WebSocket Broadcasting

### Current State

**IMPORTANT FINDING**: The `setupEventBroadcasting()` function in `packages/api/src/index.ts` does **NOT** currently include handlers for permission events (`permission:request`, `permission:granted`, `permission:denied`).

The function handles:
- Task lifecycle events (created, started, completed, failed, paused)
- Agent events (message, thinking, tool-use)
- Tool call events (start, progress, complete)
- Subtask events
- Approval events
- Auto-fix events
- Browser events

### Test Expectations (`packages/api/src/__tests__/websocket-permission-notifications.test.ts`)

Tests verify that the API should broadcast permission events:

```typescript
// Expected WebSocket message format
{
  type: 'permission:request',
  timestamp: Date.toISOString(),
  data: {
    taskId: string,
    toolName: string,
    scope?: string,
    reason: string,
    agentName: string
  }
}
```

### Broadcast Function

```typescript
function broadcast(taskId: string, event: ApexEvent): void {
  const taskClients = clients.get(taskId);
  if (!taskClients) return;

  const message = JSON.stringify(event);
  for (const client of taskClients) {
    // Support event filtering
    if (client.eventFilters && client.eventFilters.size > 0) {
      if (!client.eventFilters.has(event.type)) continue;
    }
    if (client.socket.readyState === 1) {
      client.socket.send(message);
    }
  }
}
```

## Gap Analysis

### Missing Implementation

1. **API WebSocket Broadcasting**: Permission events are NOT being broadcasted in `setupEventBroadcasting()`. The following handlers need to be added:

```typescript
orchestrator.on('permission:request', (event: PermissionRequestEventData) => {
  broadcast(event.taskId || 'permissions', {
    type: 'permission:request',
    taskId: event.taskId || 'permissions',
    timestamp: new Date(),
    data: { ...event },
  });
});

orchestrator.on('permission:granted', (event: PermissionGrantedEventData) => {
  broadcast(event.taskId || 'permissions', {
    type: 'permission:granted',
    taskId: event.taskId || 'permissions',
    timestamp: new Date(),
    data: { ...event },
  });
});

orchestrator.on('permission:denied', (event: PermissionDeniedEventData) => {
  broadcast(event.taskId || 'permissions', {
    type: 'permission:denied',
    taskId: event.taskId || 'permissions',
    timestamp: new Date(),
    data: { ...event },
  });
});
```

2. **Event Type Registration**: Permission event types need to be added to the console output list of documented WebSocket events.

## Integration Points

### Event Emitter Chain

1. **Source**: Hook system or ApexOrchestrator methods
2. **Transport**: EventEmitter3 (`ApexOrchestrator extends EventEmitter`)
3. **CLI Consumer**: Direct subscription via `orchestrator.on()`
4. **API Consumer**: `setupEventBroadcasting()` → `broadcast()` → WebSocket clients

### Client Connection Flow

1. Client connects to `/stream/:taskId`
2. Optional query param: `?events=permission:request,permission:granted`
3. Client added to `clients.get(taskId)` Set
4. Events broadcasted as JSON messages
5. Client disconnection removes from Set

## Recommendations

1. Add permission event handlers to `setupEventBroadcasting()` in API package
2. Add `permission:request`, `permission:granted`, `permission:denied` to documented WebSocket events list
3. Consider adding `dangerous:*` events for comprehensive permission notifications
4. Ensure taskId is consistently available in all permission event payloads
