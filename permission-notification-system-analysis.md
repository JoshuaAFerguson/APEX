# Permission Notification System Analysis

## Overview

This document provides a comprehensive analysis of the permission notification implementation across the APEX system (orchestrator, CLI, and API packages). The analysis covers the event flow, subscription mechanisms, and notification display systems.

## Architecture Overview

The permission notification system follows an event-driven architecture:

1. **Orchestrator** - Central event emitter that orchestrates tasks and emits permission/approval events
2. **CLI** - Subscribes to orchestrator events and displays interactive notifications
3. **API** - Subscribes to orchestrator events and broadcasts them via WebSocket to connected clients

## Event Types Emitted by Orchestrator

### Core Event Interface

The orchestrator extends `EventEmitter<OrchestratorEvents>` from the eventemitter3 library.

### Permission & Approval Events

The orchestrator emits the following permission-related events:

```typescript
export interface OrchestratorEvents {
  // Permission management events (v0.5.0)
  'permission:request': (event: PermissionRequestEventData) => void;
  'permission:granted': (event: PermissionGrantedEventData) => void;
  'permission:denied': (event: PermissionDeniedEventData) => void;
  'permission:notification': (event: PermissionNotification) => void;
  'dangerous:detected': (event: DangerousOperationDetectedEventData) => void;
  'dangerous:confirmed': (event: DangerousOperationConfirmedEventData) => void;
  'dangerous:blocked': (event: DangerousOperationBlockedEventData) => void;

  // Approval gate events
  'approval:required': (event: ApprovalRequiredEventData) => void;
  'approval:request': (event: ApprovalRequest) => void;
  'approval:approved': (event: ApprovalGrantedEventData) => void;
  'approval:denied': (event: ApprovalDeniedEventData) => void;
  'approval:info-requested': (event: {
    approvalId: string;
    taskId: string;
    requester: string;
    message?: string;
    timestamp: Date;
  }) => void;
  'approval:decision': (event: {
    approvalId: string;
    decision: 'approved' | 'denied';
    approver: string;
    comment?: string;
    reason?: string;
  }) => void;
}
```

### Task Lifecycle Events

Related task events that impact the permission system:
- `task:created`, `task:started`, `task:completed`, `task:failed`
- `task:paused`, `task:stage-changed`
- `agent:message`, `agent:thinking`, `agent:tool-use`
- `usage:updated`

### Event Data Structures

Key interfaces for permission events include:
- `PermissionRequestEventData` - Tool permission request details
- `PermissionGrantedEventData` - Permission grant confirmation
- `PermissionDeniedEventData` - Permission denial details
- `ApprovalRequiredEventData` - Approval gate requirement
- `ApprovalGrantedEventData` - Approval granted confirmation
- `ApprovalDeniedEventData` - Approval denied details

## CLI Event Subscription and Notification Display

### Event Subscription Mechanism

The CLI subscribes to orchestrator events through two main pathways:

#### 1. REPL Interface (`packages/cli/src/repl.tsx`)

```typescript
// Approval event handling
ctx.orchestrator.on('approval:required', async (eventData: ApprovalRequiredEventData) => {
  // Show system message about approval requirement
  ctx.app?.addMessage({
    type: 'system',
    content: `⚠️ Approval required for ${eventData.gateName} (Task: ${eventData.taskId.slice(0, 12)}...)`,
  });

  // Display interactive approval prompt
  const response = await showApprovalPrompt(eventData);

  // Handle approval response
  if (response?.response === 'approved') {
    await ctx.orchestrator?.grantApproval(eventData.approvalId, response.approver, response.comment);
  } else if (response?.response === 'denied') {
    await ctx.orchestrator?.denyApproval(eventData.approvalId, response.approver, response.reason);
  }
});

// Info request handling
ctx.orchestrator?.on('approval:info-requested', handleInfoRequested);
```

#### 2. Standard CLI Interface (`packages/cli/src/index.ts`)

```typescript
// Task execution with approval handling
const approvalHandler = async (eventData: ApprovalRequiredEventData) => {
  if (eventData.taskId === taskId) {
    console.log(chalk.yellow(`⚠️ Approval required for ${eventData.gateName}`));

    const response = await showApprovalPrompt(eventData);

    if (response?.response === 'approved') {
      await ctx.orchestrator?.grantApproval(eventData.approvalId, response.approver, response.comment);
    } else if (response?.response === 'denied') {
      await ctx.orchestrator?.denyApproval(eventData.approvalId, response.approver, response.reason);
    }
  }
};

ctx.orchestrator.on('approval:required', approvalHandler);
```

### Notification Display Components

#### CLI REPL Components (`packages/cli/src/ui/`)

- **useOrchestratorEvents.ts** - React hook for event subscription and state management
- **useToolEventLogger.ts** - Hook for tool-specific event logging
- **approval-prompt.ts** - Interactive approval prompt utilities

Key event subscriptions in the React UI:

```typescript
orchestrator.on('agent:transition', handleAgentTransition);
orchestrator.on('task:stage-changed', handleStageChange);
orchestrator.on('task:started', handleTaskStart);
orchestrator.on('task:completed', handleTaskComplete);
orchestrator.on('task:failed', handleTaskFail);
orchestrator.on('usage:updated', handleUsageUpdated);
orchestrator.on('agent:tool-use', handleToolUse);
orchestrator.on('agent:message', handleAgentMessage);
orchestrator.on('agent:thinking', handleAgentThinking);
```

#### Approval Prompt Implementation

The CLI uses the `showApprovalPrompt` function from `utils/approval-prompt.js` which provides:
- Interactive approval/denial options
- Optional comment/reason input
- Support for additional information requests
- Timeout handling for approval gates

## API WebSocket Event Broadcasting

### Event Broadcasting Setup

The API server subscribes to orchestrator events and broadcasts them to WebSocket clients via the `setupEventBroadcasting` function:

```typescript
function setupEventBroadcasting(orchestrator: ApexOrchestrator): void {
  // Approval events (v0.5.0)
  orchestrator.on('approval:required', (eventData: ApprovalRequiredEventData) => {
    broadcast(eventData.taskId!, {
      type: 'approval-required',
      taskId: eventData.taskId!,
      timestamp: new Date(),
      data: {
        approvalId: eventData.approvalId,
        gateName: eventData.gateName,
        gateType: eventData.gateType,
        description: eventData.description,
        approvers: eventData.approvers,
        minApprovals: eventData.minApprovals,
        timeoutMinutes: eventData.timeoutMinutes,
        // ... additional approval data
      },
    });
  });

  orchestrator.on('approval:approved', (eventData: ApprovalGrantedEventData) => {
    broadcast(eventData.taskId!, {
      type: 'approval:granted',
      taskId: eventData.taskId!,
      timestamp: new Date(),
      data: {
        approvalId: eventData.approvalId,
        approver: eventData.approver,
        comment: eventData.comment,
      },
    });
  });

  orchestrator.on('approval:denied', (eventData: ApprovalDeniedEventData) => {
    broadcast(eventData.taskId!, {
      type: 'approval:denied',
      taskId: eventData.taskId!,
      timestamp: new Date(),
      data: {
        approvalId: eventData.approvalId,
        approver: eventData.approver,
        reason: eventData.reason,
      },
    });
  });

  // Additional events: task lifecycle, auto-fix, browser events, etc.
}
```

### WebSocket Endpoints

The API provides two WebSocket endpoints:

1. **Global WebSocket (`/ws`)** - For general event subscriptions
2. **Task-specific WebSocket (`/stream/:taskId`)** - For task-specific event filtering

```typescript
// Task-specific streaming endpoint
app.get<{
  Params: { taskId: string };
  Querystring: { events?: string };
}>('/stream:taskId', { websocket: true }, (socket, request) => {
  const { taskId } = request.params;
  const { events } = request.query;

  // Client registration and event filtering logic
});
```

### WebSocket Client Management

The API maintains a client registry (`WebSocketClient` interface) with event filtering capabilities:

```typescript
interface WebSocketClient {
  socket: WebSocket;
  taskId?: string;
  eventFilter?: string[];
  subscriptions: Set<string>;
  lastSeen: Date;
}
```

## Event Flow Summary

### Complete Permission Notification Flow

1. **Event Origin**: Orchestrator emits permission/approval events during task execution
2. **CLI Subscription**: CLI subscribes to relevant events and displays interactive prompts
3. **User Interaction**: User responds to prompts via CLI interface
4. **Response Handling**: CLI calls orchestrator methods (`grantApproval`/`denyApproval`)
5. **API Broadcasting**: API subscribes to same events and broadcasts via WebSocket
6. **Client Reception**: Connected WebSocket clients receive real-time notifications

### Event Types and Targets

| Event Type | Orchestrator | CLI Display | API Broadcast | WebSocket Clients |
|------------|-------------|-------------|---------------|------------------|
| `approval:required` | ✅ Emitted | ✅ Interactive prompt | ✅ Broadcasted | ✅ Real-time notification |
| `approval:approved` | ✅ Emitted | ✅ Confirmation display | ✅ Broadcasted | ✅ Status update |
| `approval:denied` | ✅ Emitted | ✅ Denial display | ✅ Broadcasted | ✅ Status update |
| `permission:request` | ✅ Emitted | ❓ Not implemented | ❓ Not implemented | ❓ Potential |
| `permission:granted` | ✅ Emitted | ❓ Not implemented | ❓ Not implemented | ❓ Potential |
| `permission:denied` | ✅ Emitted | ❓ Not implemented | ❓ Not implemented | ❓ Potential |
| `dangerous:detected` | ✅ Emitted | ❓ Not implemented | ❓ Not implemented | ❓ Potential |

### Current Implementation Status

**Fully Implemented:**
- ✅ Approval gate events (`approval:required`, `approval:approved`, `approval:denied`)
- ✅ CLI interactive approval prompts
- ✅ API WebSocket broadcasting for approval events
- ✅ Task lifecycle event notifications

**Partially Implemented:**
- ⚠️ Permission request/grant/deny events (defined in types, but not widely used)
- ⚠️ Dangerous operation events (defined in types, test coverage exists)

**Areas for Enhancement:**
- 🔄 Complete permission event integration in CLI
- 🔄 Permission event broadcasting in API
- 🔄 Dangerous operation notification workflows
- 🔄 WebSocket client filtering and subscription management

## Technical Architecture Strengths

1. **Event-Driven Design**: Clean separation between event emission and consumption
2. **Real-time Updates**: WebSocket broadcasting enables live notification delivery
3. **Interactive CLI**: Rich terminal-based approval workflow with prompts
4. **Type Safety**: Comprehensive TypeScript interfaces for all event data
5. **Extensible**: Well-structured for adding new event types and handlers

## Conclusion

The APEX permission notification system demonstrates a robust event-driven architecture with strong separation of concerns. The orchestrator serves as the central event source, while CLI and API packages provide complementary notification mechanisms - interactive CLI prompts for direct user interaction and WebSocket broadcasting for real-time web-based clients. The approval gate functionality is fully implemented and provides a solid foundation for extending to additional permission and dangerous operation workflows.