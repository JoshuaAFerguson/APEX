# Permission Notification Implementation Analysis

## Executive Summary

This document analyzes the current permission notification implementation across the APEX orchestrator, CLI, and API packages. The system implements a comprehensive event-driven architecture for permission requests and approvals, with real-time notifications via WebSockets and interactive CLI prompts.

## Architecture Overview

The permission notification system follows a **publish-subscribe event-driven architecture** across three main components:

1. **Orchestrator** (Publisher): Emits permission and approval events
2. **CLI** (Subscriber): Subscribes to events and displays interactive prompts
3. **API** (Relay): Relays events to WebSocket clients for web-based monitoring

## Event Flow Analysis

### 1. Orchestrator Package - Event Publishers

**Location**: `/packages/orchestrator/src/`

**Core Components**:
- `ApexOrchestrator` class extends `EventEmitter<OrchestratorEvents>`
- `ApprovalGateController` manages approval lifecycle
- `PermissionManager` handles permission checks and grants

**Key Event Types Emitted**:
```typescript
// Approval Events (v0.5.0)
'approval:required' -> ApprovalRequiredEventData
'approval:approved' -> ApprovalGrantedEventData
'approval:denied' -> ApprovalDeniedEventData
'approval:timeout' -> ApprovalTimeoutEventData
'approval:info-requested' -> InfoRequestedEventData

// Permission Events
'permission:granted' -> PermissionEventData
'permission:denied' -> PermissionEventData
'permission:revoked' -> PermissionEventData
```

**Event Emission Points**:
- `ApprovalGateController.requestApproval()` emits `approval:required`
- `ApprovalGateController.resolve()` emits `approval:approved/denied`
- `PermissionManager` operations emit permission events
- Policy enforcer emits `policy:violation` events

**Event Data Structure**:
```typescript
interface ApprovalRequiredEventData {
  approvalId: string;
  taskId: string;
  gateName: string;
  gateType: string;
  description: string;
  approvers: string[];
  minApprovals: number;
  timeoutMinutes?: number;
  expiresAt?: Date;
  stage: string;
  agent: string;
  context?: Record<string, unknown>;
  changesSummary?: string;
  affectedFiles?: string[];
  blocking: boolean;
  approvalUrl?: string;
}
```

### 2. CLI Package - Event Subscribers & Interactive Display

**Location**: `/packages/cli/src/index.ts` (lines 4350-4455)

**Subscription Mechanism**:
```typescript
// Event subscription setup
ctx.orchestrator.on('approval:required', approvalHandler);

// Event cleanup on completion
ctx.orchestrator.off('approval:required', approvalHandler);
```

**Approval Handler Implementation**:
```typescript
const approvalHandler = async (eventData: ApprovalRequiredEventData) => {
  if (eventData.taskId === taskId) {
    console.log(chalk.yellow('⚠️ Approval required for task to continue'));

    await showApprovalPrompt({
      eventData,
      onSelection: async (response) => {
        await ctx.orchestrator!.respondToApproval(eventData.approvalId, response);
      }
    });
  }
};
```

**Interactive Notification Features**:
- Color-coded terminal output using `chalk`
- Interactive prompts via `showApprovalPrompt()` function
- Support for approval responses: approve, deny, info-requested
- Handles follow-up info requests via `approval:info-requested` events

**CLI Notification Components**:
- `utils/approval-prompt.ts` - Interactive approval UI
- `utils/confirmation.ts` - Dangerous operation confirmations
- `repl.tsx` - Real-time event display in REPL mode

### 3. API Package - WebSocket Event Broadcasting

**Location**: `/packages/api/src/index.ts` (lines 2026-2317)

**WebSocket Setup**:
```typescript
// Global WebSocket endpoint with event filtering
app.get('/ws', { websocket: true }, (socket, request) => { ... });

// Task-specific WebSocket streams
app.get('/stream/:taskId', { websocket: true }, (socket, request) => { ... });
```

**Event Broadcasting Architecture**:
```typescript
function setupEventBroadcasting(orchestrator: ApexOrchestrator): void {
  // Approval events
  orchestrator.on('approval:required', (eventData) => {
    broadcast(eventData.taskId!, {
      type: 'approval-required',
      taskId: eventData.taskId!,
      timestamp: new Date(),
      data: { ...eventData }
    });
  });

  orchestrator.on('approval:approved', (eventData) => {
    broadcast(eventData.taskId!, {
      type: 'approval:granted',
      taskId: eventData.taskId!,
      data: { approvalId, approver, comment }
    });
  });
}
```

**WebSocket Client Management**:
```typescript
interface WebSocketClient {
  socket: WebSocket;
  eventFilters?: Set<string>; // Optional event filtering
}

const clients = new Map<string, Set<WebSocketClient>>();
```

**Event Filtering Support**:
- Clients can subscribe to specific event types: `/stream/task123?events=approval:required,approval:granted`
- Supports filtering for targeted notifications
- Broadcasts to all connected clients by default

## Permission Event Types & Data Flow

### 1. Approval Required Flow
```
[Orchestrator] ──approval:required──→ [CLI Display]
                └─approval:required──→ [API WebSocket] ──→ [Web Clients]
```

**Trigger Points**:
- Policy enforcement gates
- Dangerous operation detection
- Manual approval gates in workflows
- Resource access validation

### 2. Approval Response Flow
```
[CLI User Input] ──respondToApproval()──→ [Orchestrator]
                                          ├─approval:approved──→ [WebSocket]
                                          └─approval:denied────→ [WebSocket]
```

### 3. Permission Grant/Deny Flow
```
[Permission Manager] ──permission:granted/denied──→ [Event Listeners]
                                                   └──→ [Audit Logs]
```

## Integration Patterns

### Event Listener Registration
```typescript
// CLI registers for specific task events
ctx.orchestrator.on('approval:required', handler);
ctx.orchestrator.on('approval:info-requested', infoHandler);

// API broadcasts all events via WebSocket
setupEventBroadcasting(orchestrator);
```

### Event Cleanup
```typescript
// CLI properly cleans up event listeners
finally {
  ctx.orchestrator.off('approval:required', approvalHandler);
  ctx.orchestrator.off('approval:info-requested', infoHandler);
}
```

### WebSocket Event Filtering
```typescript
// Clients can filter events by type
const eventFilters = new Set(['approval:required', 'approval:granted']);
if (client.eventFilters && !client.eventFilters.has(event.type)) {
  continue; // Skip filtered events
}
```

## Key Technical Features

### 1. Real-Time Notifications
- **CLI**: Immediate terminal notifications with interactive prompts
- **WebSocket**: Real-time browser notifications for web interfaces
- **Event-driven**: No polling required, instant notification delivery

### 2. Event Persistence & State
- **Approval States**: Persisted in SQLite via `TaskStore`
- **Session Cache**: Temporary permissions stored in memory
- **Event History**: Full audit trail of permission events

### 3. Multi-Channel Support
- **Terminal UI**: Rich interactive CLI experience
- **WebSocket API**: Real-time web integration
- **HTTP API**: RESTful approval management endpoints

### 4. Security & Validation
- **Event Filtering**: Clients receive only relevant events
- **Permission Validation**: Multi-layer permission checking
- **Timeout Handling**: Automatic approval expiration

## Event Schema & Types

### Core Event Types
```typescript
// From @apexcli/core
interface ApexEvent {
  type: ApexEventType;
  taskId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

type ApexEventType =
  | 'approval-required'
  | 'approval:granted'
  | 'approval:denied'
  | 'permission:granted'
  | 'permission:denied'
  | 'permission:revoked';
```

## Conclusion

The APEX permission notification system implements a robust, event-driven architecture that provides:

1. **Real-time notifications** across CLI and web interfaces
2. **Interactive approval workflows** with rich user experience
3. **Scalable WebSocket broadcasting** for web integration
4. **Comprehensive event filtering** for targeted notifications
5. **Persistent state management** with proper cleanup

The system successfully decouples permission logic (orchestrator) from user interaction (CLI) and external monitoring (API/WebSocket), enabling flexible deployment and integration patterns.