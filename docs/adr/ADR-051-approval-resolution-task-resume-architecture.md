# ADR-051: Approval Resolution and Task Resume Architecture

## Status
**Accepted** - Architecture Review (Existing Implementation)

## Date
2025-01-04

## Context
APEX requires a mechanism for tasks to pause at approval gates, receive approval/rejection decisions, and resume execution from the paused state. This ADR documents the technical architecture of the existing approval resolution and task resume mechanism.

## Decision

### Component Architecture

The approval resolution and task resume mechanism consists of the following components:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Approval Flow                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌─────────────────────┐    ┌────────────────────────┐  │
│  │  Workflow    │───>│ ApprovalGateController│───>│    Event Emission     │  │
│  │  Executor    │    │                       │    │ (approval:required)   │  │
│  └──────────────┘    └─────────────────────┘    └────────────────────────┘  │
│         │                      │                           │                 │
│         │                      │                           ▼                 │
│         │                      │                   ┌──────────────────┐     │
│         │                      │                   │   REST API       │     │
│         │                      │                   │ /api/approvals   │     │
│         │                      │                   └──────────────────┘     │
│         │                      │                           │                 │
│         │                      │                           ▼                 │
│         │                      │                   ┌──────────────────┐     │
│         │                      │                   │ grantApproval()  │     │
│         │                      │                   │ denyApproval()   │     │
│         │                      │                   └──────────────────┘     │
│         │                      │                           │                 │
│         ▼                      ▼                           ▼                 │
│  ┌──────────────┐    ┌─────────────────────┐    ┌────────────────────────┐  │
│  │   TaskStore  │<───│   ApprovalState     │<───│   Update Status        │  │
│  │              │    │   (persistence)     │    │   Resume Task          │  │
│  └──────────────┘    └─────────────────────┘    └────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. Type Definitions (`@apexcli/core`)

**File**: `packages/core/src/types.ts`

```typescript
// Approval Status Values
export type ApprovalStatus = 'pending' | 'approved' | 'denied';

// Approval State - Tracks the full lifecycle of an approval request
export interface ApprovalState {
  id: string;                    // Unique approval request ID
  taskId: string;                // Associated task ID
  gateName: string;              // Name of the approval gate
  status: ApprovalStatus;        // Current status
  approver?: string;             // Who granted/denied
  requestedAt: Date;             // When approval was requested
  respondedAt?: Date;            // When decision was made
  comment?: string;              // Decision comment
  context?: Record<string, unknown>; // Additional context
  stage?: string;                // Workflow stage
  agent?: string;                // Agent handling the stage
  approvalsReceived?: number;    // For multi-approval gates
  approvalsRequired?: number;    // Minimum approvals needed
  timeoutMinutes?: number;       // Timeout configuration
  expiresAt?: Date;              // Expiration timestamp
}

// Event Data Types
export interface ApprovalRequiredEventData {
  approvalId: string;
  taskId: string;
  gateName: string;
  gateType: ApprovalCheckpointType;
  description?: string;
  approvers?: string[];
  minApprovals: number;
  timeoutMinutes?: number;
  expiresAt?: Date;
  stage: string;
  agent: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  changesSummary?: string;
  affectedFiles?: string[];
  blocking?: boolean;
  approvalUrl?: string;
}

export interface ApprovalGrantedEventData {
  approvalId: string;
  taskId: string;
  approver: string;
  comment?: string;
  timestamp: Date;
}

export interface ApprovalDeniedEventData {
  approvalId: string;
  taskId: string;
  approver: string;
  reason: string;
  timestamp: Date;
}
```

### 2. ApprovalGateController (`@apexcli/orchestrator`)

**File**: `packages/orchestrator/src/approval-gate-controller.ts`

The controller manages the lifecycle of individual approval gates:

```typescript
export class ApprovalGateController extends EventEmitter<ApprovalGateEvents> {
  private state: ApprovalState;
  private store: TaskStore;
  private timeoutHandle?: NodeJS.Timeout;
  private resolveWait?: (result: ApprovalResult) => void;

  // Request approval and wait for resolution
  async requestApproval(): Promise<ApprovalResult>;

  // Grant the approval
  async grant(approver: string, comment?: string): Promise<void>;

  // Deny the approval
  async deny(approver: string, reason: string): Promise<void>;

  // Cancel pending approval
  async cancel(): Promise<void>;
}
```

**Key Features**:
- Event emission: `approval:requested`, `approval:resolved`, `approval:timeout`
- State persistence via TaskStore
- Timeout handling with auto-approve/auto-deny options
- Multi-approval support (minApprovals > 1)

### 3. ApexOrchestrator Methods

**File**: `packages/orchestrator/src/index.ts`

#### Grant Approval Method
```typescript
async grantApproval(
  approvalId: string,
  approver: string,
  comment?: string
): Promise<void> {
  // 1. Validate approval exists and is pending
  const approvalState = await this.store.getApprovalStateById(approvalId);
  if (!approvalState) throw new Error(`Approval request not found: ${approvalId}`);
  if (approvalState.status !== 'pending') throw new Error('Approval already resolved');

  // 2. Update approval state in database
  await this.store.updateApprovalState(approvalId, {
    status: 'approved',
    approver,
    respondedAt: new Date(),
    comment,
    approvalsReceived: (approvalState.approvalsReceived || 0) + 1
  });

  // 3. Emit approval:approved event
  this.emit('approval:approved', { approvalId, taskId, approver, comment, timestamp });

  // 4. Resume the task from checkpoint
  await this.resumeTask(taskId);

  // 5. Log the action
  await this.store.addLog(taskId, { level: 'info', message: 'Task resumed after approval' });
}
```

#### Deny Approval Method
```typescript
async denyApproval(
  approvalId: string,
  approver: string,
  reason: string
): Promise<void> {
  // 1. Validate (reason is required)
  if (!reason?.trim()) throw new Error('Reason is required when denying');

  // 2. Update approval state
  await this.store.updateApprovalState(approvalId, {
    status: 'denied',
    approver,
    respondedAt: new Date(),
    comment: reason
  });

  // 3. Emit approval:denied event
  this.emit('approval:denied', { approvalId, taskId, approver, reason, timestamp });

  // 4. Mark task as failed
  await this.updateTaskStatus(taskId, 'failed', `Approval denied by ${approver}: ${reason}`);
}
```

#### Resume Task Method
```typescript
async resumeTask(taskId: string, options?: { checkpointId?: string }): Promise<boolean> {
  // 1. Load task and checkpoint
  const task = await this.store.getTask(taskId);
  const checkpoint = options?.checkpointId
    ? await this.store.getCheckpoint(taskId, options.checkpointId)
    : await this.store.getLatestCheckpoint(taskId);

  if (!checkpoint) return false;

  // 2. Increment resume attempts (for max retry protection)
  await this.store.updateTask(taskId, { resumeAttempts: task.resumeAttempts + 1 });

  // 3. Emit task:session-resumed event
  this.emit('task:session-resumed', {
    taskId,
    resumeReason: 'checkpoint_restore',
    contextSummary: createContextSummary(checkpoint),
    previousStatus: task.status,
    sessionData: task.sessionData,
    timestamp: new Date()
  });

  // 4. Continue workflow from checkpoint stage
  await this.executeFromCheckpoint(task, checkpoint);

  return true;
}
```

### 4. TaskStore Persistence Layer

**File**: `packages/orchestrator/src/store.ts`

Database schema for approval states:
```sql
CREATE TABLE approval_states (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  gate_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  approver TEXT,
  requested_at TEXT NOT NULL,
  responded_at TEXT,
  comment TEXT,
  context TEXT,
  stage TEXT,
  agent TEXT,
  approvals_received INTEGER DEFAULT 0,
  approvals_required INTEGER DEFAULT 1,
  timeout_minutes INTEGER,
  expires_at TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

Store methods:
```typescript
class TaskStore {
  async saveApprovalState(state: ApprovalState): Promise<void>;
  async getApprovalState(taskId: string, approvalId?: string): Promise<ApprovalState | null>;
  async getApprovalStateById(approvalId: string): Promise<ApprovalState | null>;
  async getPendingApprovals(): Promise<ApprovalState[]>;
  async getApprovalStatesByTask(taskId: string): Promise<ApprovalState[]>;
  async updateApprovalState(approvalId: string, updates: Partial<ApprovalState>): Promise<void>;
  async deleteApprovalState(approvalId: string): Promise<void>;
  async getExpiredApprovals(): Promise<ApprovalState[]>;
}
```

### 5. REST API Endpoints

**File**: `packages/api/src/index.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/approvals` | GET | List all pending approvals |
| `/api/approvals/:id/approve` | POST | Grant an approval request |
| `/api/approvals/:id/deny` | POST | Deny an approval request |

**Request/Response Examples**:

```typescript
// POST /api/approvals/:id/approve
Request: { approver: string; comment?: string }
Response: { success: boolean; approvalState?: ApprovalState; taskWillProceed: boolean }

// POST /api/approvals/:id/deny
Request: { approver: string; comment: string } // comment is required
Response: { success: boolean; approvalState?: ApprovalState; taskWillProceed: boolean }
```

### 6. Event System

Events emitted during the approval lifecycle:

| Event | When Emitted | Data |
|-------|--------------|------|
| `approval:required` | Task reaches approval gate | ApprovalRequiredEventData |
| `approval:approved` | Approval granted | ApprovalGrantedEventData |
| `approval:denied` | Approval denied | ApprovalDeniedEventData |
| `task:session-resumed` | Task resumes from checkpoint | TaskSessionResumedEvent |
| `task:paused` | Task pauses at gate | Task, reason |
| `task:failed` | Task fails after denial | Task, Error |

### 7. Task Status Transitions

```
┌─────────────────────────────────────────────────────────────────┐
│                    Approval-Related States                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   in-progress ──► waiting-approval ──► approved ──► in-progress │
│                           │                                      │
│                           ▼                                      │
│                        denied ──► failed                         │
│                           │                                      │
│                           ▼                                      │
│                       timeout                                    │
│                      (auto-approve or auto-deny)                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

Task statuses defined in `@apexcli/core`:
- `pending`, `queued`, `planning`, `in-progress`
- `waiting-approval` - Task paused at approval gate
- `paused` - Task paused for other reasons (rate limits, capacity)
- `completed`, `failed`, `cancelled`

## Consequences

### Positive
1. **Complete separation of concerns**: Approval logic isolated in ApprovalGateController
2. **Event-driven architecture**: Easy integration with CLI, API, and WebSocket clients
3. **Persistent state**: Approval decisions survive restarts
4. **Flexible approval workflows**: Support for multi-approver gates and timeout handling
5. **Robust resume mechanism**: Checkpoints enable reliable task continuation

### Negative
1. **Complexity**: Multiple components involved in approval flow
2. **Database dependency**: Requires SQLite for state persistence
3. **Event ordering**: Must handle concurrent approval requests carefully

### Neutral
1. **Polling required**: Clients must poll or use WebSocket for approval notifications
2. **Manual resume trigger**: Approval grant automatically triggers resume

## Related Decisions
- ADR-0004: Checkpoint saving before session ends
- ADR-044: Session persistence and restart integration

## Test Coverage

Existing test files validating this architecture:
- `approval-gate-controller.test.ts` - Unit tests for controller
- `approval-gate-controller.edge-cases.test.ts` - Edge case handling
- `approval-gate-controller.integration.test.ts` - Integration tests
- `approval-state-persistence.integration.test.ts` - Persistence tests
- `approval-state-recovery-restart.integration.test.ts` - Recovery tests
- `approval-handlers.integration.test.ts` - API handler tests
- `approval-gate-workflow.integration.test.ts` - Full workflow tests

## References
- `packages/core/src/types.ts` - Type definitions
- `packages/orchestrator/src/approval-gate-controller.ts` - Controller implementation
- `packages/orchestrator/src/index.ts` - Orchestrator integration
- `packages/orchestrator/src/store.ts` - Persistence layer
- `packages/api/src/index.ts` - REST API endpoints
