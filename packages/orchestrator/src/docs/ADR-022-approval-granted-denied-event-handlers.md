# ADR-022: Approval Granted/Denied Event Handlers

## Status
**Proposed** - Architecture Design

## Context

APEX requires the ability to handle approval workflows where tasks can be paused awaiting human approval and then resumed or aborted based on approval decisions. The existing codebase has:

1. **ApprovalGate** type in `@apexcli/core` - defines approval checkpoints with timeout, approvers, etc.
2. **ApprovalState** type - tracks approval request status (pending/approved/denied)
3. **ApprovalRequiredEventData** / **ApprovalResponseEventData** - event payloads for approval workflows
4. **Task status** - includes 'waiting-approval' and 'awaiting-approval' states
5. **OrchestratorEvents** interface - defines all emittable events
6. **Existing checkpoint/resume infrastructure** - `saveCheckpoint()`, `resumeTask()`, `resumePausedTask()`

However, the orchestrator lacks:
- Methods to programmatically grant or deny approvals (`grantApproval()`, `denyApproval()`)
- Events for approval decisions (`approval-granted`, `approval-denied`)
- Integration between approval decisions and task lifecycle (resume/abort)

## Decision

### 1. New Event Types

Add two new events to `OrchestratorEvents`:

```typescript
// In packages/orchestrator/src/index.ts

export interface OrchestratorEvents {
  // ... existing events ...

  // Approval workflow events (v0.5.0)
  'approval-granted': (event: ApprovalGrantedEventData) => void;
  'approval-denied': (event: ApprovalDeniedEventData) => void;
}
```

### 2. New Event Data Interfaces

```typescript
// In packages/orchestrator/src/index.ts

/**
 * Event payload for approval-granted event
 * Emitted when an approval request is granted and task resumes
 */
export interface ApprovalGrantedEventData {
  /** Unique identifier for this approval request */
  approvalId: string;
  /** ID of the task that was approved */
  taskId: string;
  /** Name of the gate/checkpoint that was approved */
  gateName: string;
  /** Who granted the approval */
  approver: string;
  /** Optional comment from approver */
  comment?: string;
  /** Timestamp when approval was granted */
  timestamp: Date;
  /** Checkpoint ID that will be used to resume the task */
  checkpointId?: string;
  /** Previous task status before resume */
  previousStatus: TaskStatus;
}

/**
 * Event payload for approval-denied event
 * Emitted when an approval request is denied and task is aborted
 */
export interface ApprovalDeniedEventData {
  /** Unique identifier for this approval request */
  approvalId: string;
  /** ID of the task that was denied */
  taskId: string;
  /** Name of the gate/checkpoint that was denied */
  gateName: string;
  /** Who denied the approval */
  approver: string;
  /** Reason for denial */
  reason: string;
  /** Timestamp when approval was denied */
  timestamp: Date;
  /** Previous task status before failure */
  previousStatus: TaskStatus;
}
```

### 3. New Orchestrator Methods

```typescript
// In ApexOrchestrator class

/**
 * Grant approval for a pending approval request
 * Resumes the task from its checkpoint and sets status to 'running'
 *
 * @param approvalId - The approval request ID
 * @param approver - Who is granting the approval
 * @param comment - Optional comment explaining the approval
 * @returns Promise<boolean> - true if approval was successfully processed
 */
async grantApproval(
  approvalId: string,
  approver: string,
  comment?: string
): Promise<boolean>;

/**
 * Deny approval for a pending approval request
 * Aborts the task and sets status to 'failed'
 *
 * @param approvalId - The approval request ID
 * @param approver - Who is denying the approval
 * @param reason - Reason for denial (required)
 * @returns Promise<boolean> - true if denial was successfully processed
 */
async denyApproval(
  approvalId: string,
  approver: string,
  reason: string
): Promise<boolean>;
```

### 4. Implementation Design

#### 4.1 Approval State Storage

Add approval state tracking to TaskStore:

```typescript
// In packages/orchestrator/src/store.ts

interface ApprovalRequest {
  id: string;
  taskId: string;
  gateName: string;
  gateType: ApprovalCheckpointType;
  status: ApprovalStatus; // 'pending' | 'approved' | 'denied'
  approvers?: string[];
  approver?: string;  // Who made the decision
  comment?: string;   // Comment or reason
  requestedAt: Date;
  respondedAt?: Date;
  checkpointId?: string;  // Associated checkpoint for resume
}

// New methods
saveApprovalRequest(request: ApprovalRequest): Promise<void>;
getApprovalRequest(approvalId: string): Promise<ApprovalRequest | null>;
updateApprovalRequest(approvalId: string, updates: Partial<ApprovalRequest>): Promise<void>;
getApprovalRequestByTaskId(taskId: string): Promise<ApprovalRequest | null>;
```

#### 4.2 grantApproval() Implementation Flow

```
grantApproval(approvalId, approver, comment?)
    │
    ├─▶ 1. Validate approval exists and is pending
    │       - getApprovalRequest(approvalId)
    │       - Check status === 'pending'
    │
    ├─▶ 2. Get associated task
    │       - getTask(request.taskId)
    │       - Verify task status is 'waiting-approval' or 'awaiting-approval'
    │
    ├─▶ 3. Update approval state
    │       - updateApprovalRequest(approvalId, {
    │           status: 'approved',
    │           approver,
    │           comment,
    │           respondedAt: new Date()
    │         })
    │
    ├─▶ 4. Resume task from checkpoint
    │       - Update task status to 'in-progress' (or 'running')
    │       - resumeTask(taskId, { checkpointId: request.checkpointId })
    │
    ├─▶ 5. Emit 'approval-granted' event
    │       - emit('approval-granted', {
    │           approvalId,
    │           taskId,
    │           gateName,
    │           approver,
    │           comment,
    │           timestamp,
    │           checkpointId,
    │           previousStatus
    │         })
    │
    └─▶ 6. Add log entry
            - store.addLog(taskId, { level: 'info', message: 'Approval granted...' })
```

#### 4.3 denyApproval() Implementation Flow

```
denyApproval(approvalId, approver, reason)
    │
    ├─▶ 1. Validate approval exists and is pending
    │       - getApprovalRequest(approvalId)
    │       - Check status === 'pending'
    │
    ├─▶ 2. Get associated task
    │       - getTask(request.taskId)
    │       - Verify task status is 'waiting-approval' or 'awaiting-approval'
    │
    ├─▶ 3. Update approval state
    │       - updateApprovalRequest(approvalId, {
    │           status: 'denied',
    │           approver,
    │           comment: reason,
    │           respondedAt: new Date()
    │         })
    │
    ├─▶ 4. Fail the task
    │       - Update task status to 'failed'
    │       - Set task.error = `Approval denied: ${reason}`
    │       - Store denial reason in task metadata
    │
    ├─▶ 5. Emit 'approval-denied' event
    │       - emit('approval-denied', {
    │           approvalId,
    │           taskId,
    │           gateName,
    │           approver,
    │           reason,
    │           timestamp,
    │           previousStatus
    │         })
    │
    ├─▶ 6. Emit 'task:failed' event
    │       - emit('task:failed', task, new Error(`Approval denied: ${reason}`))
    │
    └─▶ 7. Add log entry
            - store.addLog(taskId, { level: 'error', message: 'Approval denied...' })
```

### 5. Database Schema Updates

Add to SQLite schema (store.ts):

```sql
-- New table for approval requests
CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  gate_name TEXT NOT NULL,
  gate_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approvers TEXT,  -- JSON array
  approver TEXT,
  comment TEXT,
  requested_at TEXT NOT NULL,
  responded_at TEXT,
  checkpoint_id TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_task_id ON approval_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
```

### 6. Integration Points

#### 6.1 Existing OrchestratorEvents

The new events integrate with existing events:
- `'task:paused'` - Emitted when task enters approval wait state
- `'task:stage-changed'` - Emitted when task resumes after approval
- `'task:failed'` - Emitted when approval is denied

#### 6.2 Existing Methods

Integration with:
- `resumeTask()` - Called by `grantApproval()` to resume from checkpoint
- `updateTaskStatus()` - Called to update task status
- `saveCheckpoint()` - Checkpoints should be saved before entering approval wait
- `pauseTask()` - Called when task enters approval gate

### 7. Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    APPROVAL WORKFLOW EVENT FLOW                      │
└─────────────────────────────────────────────────────────────────────┘

Task reaches approval gate
         │
         ▼
    ┌─────────────┐
    │saveCheckpoint│
    └─────────────┘
         │
         ▼
    ┌─────────────┐      ┌──────────────────┐
    │ pauseTask   │─────▶│emit('task:paused')│
    └─────────────┘      └──────────────────┘
         │
         ▼
  Status: 'waiting-approval'
         │
         ▼
 ┌───────────────────────┐
 │ Await human decision  │
 └───────────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 GRANTED    DENIED
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│grant   │ │deny    │
│Approval│ │Approval│
└────────┘ └────────┘
    │         │
    ▼         ▼
┌────────────────┐  ┌────────────────┐
│emit('approval- │  │emit('approval- │
│granted')       │  │denied')        │
└────────────────┘  └────────────────┘
    │                     │
    ▼                     ▼
┌────────────────┐  ┌────────────────┐
│resumeTask()    │  │updateTaskStatus│
│                │  │('failed')      │
└────────────────┘  └────────────────┘
    │                     │
    ▼                     ▼
Status: 'in-progress'  Status: 'failed'
    │                     │
    ▼                     ▼
┌──────────────────┐ ┌──────────────────┐
│emit('task:stage- │ │emit('task:failed')│
│changed')         │ └──────────────────┘
└──────────────────┘
```

## Files to Modify

### Primary Changes

1. **packages/orchestrator/src/index.ts**
   - Add `ApprovalGrantedEventData` interface
   - Add `ApprovalDeniedEventData` interface
   - Add `'approval-granted'` and `'approval-denied'` to `OrchestratorEvents`
   - Add `grantApproval()` method to `ApexOrchestrator`
   - Add `denyApproval()` method to `ApexOrchestrator`

2. **packages/orchestrator/src/store.ts**
   - Add `approval_requests` table schema
   - Add `saveApprovalRequest()` method
   - Add `getApprovalRequest()` method
   - Add `updateApprovalRequest()` method
   - Add `getApprovalRequestByTaskId()` method

### Supporting Changes

3. **packages/core/src/types.ts**
   - Add `'approval-granted'` and `'approval-denied'` to `ApexEventType` union

4. **packages/orchestrator/src/__tests__/approval-handlers.test.ts** (new file)
   - Unit tests for `grantApproval()` method
   - Unit tests for `denyApproval()` method
   - Event emission verification
   - Task resume/abort behavior tests

## Test Strategy

### Unit Tests

```typescript
describe('grantApproval()', () => {
  it('should resume task from checkpoint when approval is granted');
  it('should update task status to in-progress');
  it('should emit approval-granted event with correct payload');
  it('should return false for non-existent approval');
  it('should return false for already processed approval');
  it('should store approval decision in approval_requests table');
});

describe('denyApproval()', () => {
  it('should fail task when approval is denied');
  it('should update task status to failed');
  it('should emit approval-denied event with correct payload');
  it('should emit task:failed event');
  it('should store denial reason in task error field');
  it('should return false for non-existent approval');
  it('should return false for already processed approval');
});
```

### Integration Tests

```typescript
describe('Approval Workflow Integration', () => {
  it('should complete full approval grant workflow');
  it('should complete full approval denial workflow');
  it('should handle concurrent approval requests');
  it('should handle approval timeout scenarios');
});
```

## Acceptance Criteria Verification

| # | Criterion | Implementation |
|---|-----------|----------------|
| 1 | Orchestrator has `grantApproval(approvalId, approver, comment)` method | `ApexOrchestrator.grantApproval()` |
| 2 | Orchestrator has `denyApproval(approvalId, approver, reason)` method | `ApexOrchestrator.denyApproval()` |
| 3 | On granted: task resumes from checkpoint, status restored to 'running' | `grantApproval()` calls `resumeTask()`, updates status to 'in-progress' |
| 4 | On denied: task status set to 'failed', denial reason stored | `denyApproval()` updates status to 'failed', stores reason in task.error |
| 5 | Events 'approval-granted' and 'approval-denied' emitted | Both events added to `OrchestratorEvents`, emitted by respective methods |
| 6 | Unit tests verify resume and abort behavior | Test file with comprehensive unit tests |

## Consequences

### Positive

- **Programmatic approval control**: External systems can grant/deny approvals via the orchestrator API
- **Event-driven**: UI/CLI can react to approval events for user feedback
- **Consistent with existing patterns**: Uses established checkpoint/resume infrastructure
- **Type-safe**: Full TypeScript types for all events and methods
- **Auditable**: Approval decisions stored with timestamp and approver info

### Negative

- **Additional database table**: Requires schema migration for `approval_requests`
- **State complexity**: More states to track (approval + task status)
- **Testing complexity**: Requires mocking approval flow in tests

### Risks

- **Race conditions**: Multiple approval decisions for same request
  - Mitigation: Check status before processing, use transactions
- **Orphaned approvals**: Approvals for deleted/completed tasks
  - Mitigation: Validate task state before processing approval

## Implementation Order

1. Add database schema changes to `store.ts`
2. Add event data interfaces to `index.ts`
3. Add events to `OrchestratorEvents` interface
4. Add `ApexEventType` union updates to `@apexcli/core`
5. Implement `grantApproval()` method
6. Implement `denyApproval()` method
7. Write unit tests
8. Write integration tests
9. Run build and test to verify

## References

- `packages/orchestrator/src/index.ts` - ApexOrchestrator class
- `packages/orchestrator/src/store.ts` - TaskStore class
- `packages/core/src/types.ts` - ApprovalState, ApprovalRequiredEventData types
- ADR-007: Max Resume Attempts (related checkpoint/resume patterns)
