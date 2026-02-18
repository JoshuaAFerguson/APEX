# APEX Permission Notification Event Flow Analysis

## Executive Summary

This technical document analyzes the permission notification implementation across APEX's orchestrator, CLI, and API packages, documenting the complete event flow from permission request through user notification display.

## Current Event Flow Architecture

### 1. Event Types Emitted by Orchestrator (@apex/orchestrator)

The orchestrator package defines and emits the following permission-related events:

#### Core Permission Events
- **`permission:request`** - Emitted when an agent requests permission to use a tool
- **`permission:granted`** - Emitted when a permission request is approved
- **`permission:denied`** - Emitted when a permission request is denied

#### Approval Gate Events
- **`approval:required`** - Emitted when autonomy settings require user approval
- **`approval:granted`** - Emitted when user grants approval via gate
- **`approval:denied`** - Emitted when user denies approval via gate

#### Dangerous Operation Events
- **`dangerous:detected`** - Emitted when potentially dangerous operations are detected
- **`dangerous:confirmed`** - Emitted when user confirms dangerous operation
- **`dangerous:blocked`** - Emitted when dangerous operation is blocked

#### Policy Events
- **`policy:blocked`** - Emitted when policy engine blocks an operation
- **`policy:warned`** - Emitted when policy engine issues a warning

### 2. Event Data Structures

Based on the type definitions in `@apex/core/src/types.ts`:

```typescript
interface PermissionRequestEventData {
  requestId: string;
  tool: string;
  scope?: string;
  parameters?: Record<string, any>;
  reason?: string;
  timestamp: Date;
  agentName: string;
  taskId: string;
}

interface PermissionGrantedEventData {
  requestId: string;
  tool: string;
  level: PermissionLevel; // 'allow-once' | 'allow-always' | 'allow-session'
  scope?: string;
  grantor?: string;
  timestamp: Date;
  taskId: string;
}

interface PermissionDeniedEventData {
  requestId: string;
  tool: string;
  scope?: string;
  reason?: string;
  denier?: string;
  timestamp: Date;
  taskId: string;
}
```

### 3. CLI Event Subscription (@apex/cli)

The CLI package subscribes to orchestrator events through the `useOrchestratorEvents` hook:

#### Hook Implementation
- **Location**: `packages/cli/src/ui/hooks/useOrchestratorEvents.ts`
- **Purpose**: Bridges orchestrator events to React UI components
- **Key Features**:
  - Event filtering by task ID
  - Agent state management
  - Real-time UI updates

#### Current Event Handlers
Based on analysis, the hook currently handles:
- `agent:transition` - Agent workflow transitions
- `agent:thinking` - Agent thought processes
- `usage:updated` - Token/cost tracking
- `tool:start/progress/complete` - Tool execution lifecycle
- Various task lifecycle events

#### Permission Event Gap
**Important Finding**: The current `useOrchestratorEvents` implementation does **not** explicitly handle permission events (`permission:request`, `permission:granted`, `permission:denied`).

#### Test Coverage
Comprehensive test coverage exists for permission handling:
- **`useOrchestratorEvents.permission-notifications.test.ts`** - Tests permission event handling
- Mock implementations demonstrate expected permission event flow
- Console output testing for notification display

### 4. API WebSocket Broadcasting (@apex/api)

The API package provides WebSocket broadcasting capabilities:

#### WebSocket Setup
- **Location**: `packages/api/src/index.ts`
- **Global WebSocket**: `/ws` endpoint for real-time updates
- **Task-specific WebSocket**: `/stream/:taskId` for task-filtered events

#### Event Broadcasting Function
```typescript
function setupEventBroadcasting(orchestrator: ApexOrchestrator): void {
  // Currently handles 25+ event types including:
  orchestrator.on('task:created', (task: Task) => { ... });
  orchestrator.on('agent:thinking', (taskId, agent, thinking) => { ... });
  orchestrator.on('approval:required', (eventData) => { ... });
  // ... many others
}
```

#### Permission Event Broadcasting Gap
**Important Finding**: The current API event broadcasting setup does **not** explicitly listen for or broadcast the core permission events:
- Missing: `permission:request` event listener
- Missing: `permission:granted` event listener
- Missing: `permission:denied` event listener
- Missing: `dangerous:*` event listeners
- Missing: `policy:*` event listeners

#### Test Coverage
Extensive WebSocket permission test coverage exists:
- **`websocket-permission-notifications.test.ts`** - Tests WebSocket permission broadcasting
- Mock implementations show expected permission event WebSocket flow
- Real-time permission update verification

### 5. Current Implementation Status

#### What Works ✅
1. **Permission System Architecture**: Comprehensive permission types and schemas defined
2. **Test Infrastructure**: Extensive test coverage for permission flows
3. **Event Infrastructure**: EventEmitter-based architecture supports permission events
4. **ADR Documentation**: ADR-005 documents cross-package permission integration plans

#### What's Missing ⚠️
1. **Orchestrator Permission Event Emission**: Core permission events not actively emitted
2. **CLI Permission Event Handling**: `useOrchestratorEvents` doesn't handle permission events
3. **API Permission Event Broadcasting**: WebSocket setup missing permission event listeners
4. **End-to-End Flow**: Complete permission request → notification → response flow not implemented

## Technical Event Flow Design

Based on the analysis and test implementations, the intended event flow should be:

### Permission Request Flow
```
1. Agent requests permission →
2. PermissionManager.checkToolPermission() →
3. If approval needed → orchestrator.emit('permission:request', data) →
4. CLI: useOrchestratorEvents receives event → displays UI notification →
5. API: WebSocket broadcasts to connected clients →
6. User responds (approve/deny) →
7. orchestrator.emit('permission:granted'|'permission:denied', data) →
8. CLI: Updates UI state →
9. API: Broadcasts decision to clients
```

### Approval Gate Flow
```
1. AutonomyEnforcer determines approval needed →
2. ApprovalGateController creates approval gate →
3. orchestrator.emit('approval:required', data) →
4. CLI: Displays approval prompt →
5. API: WebSocket broadcasts approval request →
6. User responds →
7. orchestrator.emit('approval:granted'|'approval:denied', data) →
8. Task continues or fails accordingly
```

## Integration Architecture

### Package Responsibilities

#### @apex/core
- ✅ Event type definitions (`ApexEventType`)
- ✅ Permission data structures (`PermissionRequestEventData`, etc.)
- ✅ Zod schemas for validation

#### @apex/orchestrator
- ✅ PermissionManager, PermissionStore, AutonomyEnforcer classes
- ⚠️ **Missing**: Active emission of permission events
- ✅ EventEmitter inheritance for event capability

#### @apex/cli
- ✅ `useOrchestratorEvents` hook for React integration
- ⚠️ **Missing**: Permission event handlers in hook
- ✅ Test coverage for permission UI flows

#### @apex/api
- ✅ WebSocket infrastructure via Fastify
- ✅ `setupEventBroadcasting()` function
- ⚠️ **Missing**: Permission event listeners in broadcasting setup
- ✅ Test coverage for WebSocket permission flows

## Recommendations

### Immediate Implementation Needs

1. **Add Permission Event Emission in Orchestrator**
   - Emit `permission:request` when PermissionManager.checkToolPermission() requires user input
   - Emit `permission:granted/denied` after user responses
   - Emit `dangerous:detected` when DangerousOperationDetector finds issues

2. **Extend CLI Event Handling**
   - Add permission event handlers to `useOrchestratorEvents` hook
   - Implement permission notification UI components
   - Connect approval/denial actions to orchestrator responses

3. **Add API Permission Broadcasting**
   - Add permission event listeners to `setupEventBroadcasting()`
   - Ensure WebSocket clients receive real-time permission notifications
   - Support bidirectional permission responses via WebSocket

### Architecture Completeness

The foundation for permission notifications is well-established with comprehensive type definitions, test coverage, and architectural planning. The missing piece is connecting the permission decision logic to the event emission and UI notification systems.

## Conclusion

APEX has a sophisticated permission system architecture with comprehensive test coverage and clear integration points. The main implementation gap is in the actual event emission and handling across packages. With the existing infrastructure, implementing the complete permission notification flow would require targeted additions to:

1. Orchestrator event emission points
2. CLI event subscription handlers
3. API WebSocket broadcasting setup

The test coverage demonstrates the intended behavior and provides a clear implementation roadmap for completing the permission notification system.