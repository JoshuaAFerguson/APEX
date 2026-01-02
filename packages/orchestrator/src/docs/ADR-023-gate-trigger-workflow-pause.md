# ADR-023: Gate Trigger Logic in Workflow Execution

## Status
**Approved** - Ready for Implementation

## Context

APEX workflows support approval gates that can be defined at the workflow level and attached to specific stages via the `stage.gate` property. When a workflow stage is configured with an approval gate, the task should pause and await human approval before proceeding.

### Existing Infrastructure

The codebase already has extensive support for:

1. **Gate Definitions**:
   - `ApprovalGate` type in `@apexcli/core` with `type`, `required`, `autoApprove`, `timeout`, etc.
   - `WorkflowGate` type for gates defined in workflow YAML files
   - `WorkflowStage.gate` field (nullable optional string) referencing a gate ID

2. **Task Pause Mechanism**:
   - `pauseTask(taskId, reason, resumeAfterSeconds?)` method supporting multiple pause reasons:
     - `rate_limit`, `usage_limit`, `budget`, `manual`, `session_limit`, `container_failure`, `token_limit`
   - Task fields: `status`, `pausedAt`, `pauseReason`, `resumeAfter`
   - Automatic parent task pausing when subtask is paused

3. **Checkpoint Mechanism**:
   - `saveCheckpoint(taskId, options)` for persisting task state
   - Checkpoint stores: `stage`, `stageIndex`, `conversationState`, `metadata`
   - Resume from checkpoint via `resumeTask()`

4. **Approval State**:
   - `ApprovalState` type with `id`, `taskId`, `gateName`, `status`, `approver`, timestamps, etc.
   - `ApprovalStatus` enum: `pending`, `approved`, `denied`
   - `TaskSchema` includes optional `approvalState` field
   - `TaskStatus` includes `awaiting-approval` status

5. **Gate Storage**:
   - `TaskStore.setGate(taskId, gate)` for persisting gate state
   - `TaskStore.getGate(taskId, gateName)` for retrieving gate state
   - `TaskStore.approveGate()` / `rejectGate()` for updating gate status

6. **Gate Events**:
   - `gate:required` - emitted when task hits approval gate
   - `gate:approved` - emitted when gate is approved
   - `gate:rejected` - emitted when gate is rejected

### Missing Functionality

The workflow execution logic (`runWorkflow` and `executeWorkflowStage`) does not currently:
1. Check if a stage has an associated gate before execution
2. Pause the task with `awaiting-approval` status when a gate is encountered
3. Create and store an `ApprovalState` record
4. Emit `gate:required` event with appropriate data
5. Set task `pauseReason` to `approval_gate`

## Decision

### 1. Add 'approval_gate' to pauseTask Reason Types

Extend the `pauseTask` method's reason parameter:

```typescript
async pauseTask(
  taskId: string,
  reason: 'rate_limit' | 'usage_limit' | 'budget' | 'manual' | 'session_limit' |
          'container_failure' | 'token_limit' | 'approval_gate',  // Add approval_gate
  resumeAfterSeconds?: number
): Promise<void>
```

### 2. Gate Check Location

Add gate checking logic in `runWorkflow` **before** executing each stage. This is the optimal location because:
- It occurs after dependency checks but before agent execution
- It allows the workflow to pause before spending resources on the stage
- It integrates naturally with the existing parallel stage execution logic

### 3. Implementation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          runWorkflow()                              │
│                                                                     │
│  for each stage in ready_stages:                                    │
│    ┌─────────────────────────────────────────────────────────────┐  │
│    │ 1. Check if stage.gate exists                               │  │
│    │    └── if yes:                                              │  │
│    │        a. Lookup gate definition from this.gates            │  │
│    │        b. Check if gate is autoApprove → skip pause         │  │
│    │        c. Create ApprovalState (status: pending)            │  │
│    │        d. Save ApprovalState with task                      │  │
│    │        e. Create Gate record in store (status: pending)     │  │
│    │        f. Save checkpoint with gate context                 │  │
│    │        g. Update task status to 'awaiting-approval'         │  │
│    │        h. Set task.pauseReason = 'approval_gate'            │  │
│    │        i. Emit 'gate:required' event                        │  │
│    │        j. Return false (workflow incomplete)                │  │
│    │                                                             │  │
│    │ 2. If no gate or gate already approved:                     │  │
│    │    └── executeWorkflowStage() as normal                     │  │
│    └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. Data Structures

#### ApprovalState Creation

```typescript
const approvalState: ApprovalState = {
  id: generateApprovalId(),           // e.g., "apr_<ulid>"
  taskId: task.id,
  gateName: stage.gate,
  status: 'pending',
  requestedAt: new Date(),
  stage: stage.name,
  agent: stage.agent,
  approvalsReceived: 0,
  approvalsRequired: gate.minApprovals || 1,
  timeoutMinutes: gate.timeout,
  expiresAt: gate.timeout ? new Date(Date.now() + gate.timeout * 60000) : undefined,
  context: {
    workflowName: workflow.name,
    stageDescription: stage.description,
    gateDescription: gate.description,
  },
};
```

#### Checkpoint Metadata

```typescript
await this.saveCheckpoint(task.id, {
  stage: stage.name,
  stageIndex: workflow.stages.findIndex(s => s.name === stage.name),
  conversationState: currentTask?.conversation || [],
  metadata: {
    pauseReason: 'approval_gate',
    gateName: stage.gate,
    gateId: gate.id,
    approvalId: approvalState.id,
    resumePoint: 'pre_stage_gate',
    completedStages: Array.from(completedStages),
    inProgressStages: [], // Stage hasn't started yet
    stageResults: Object.fromEntries(stageResults),
  },
});
```

### 5. Gate Lookup Logic

```typescript
private shouldPauseForGate(stage: WorkflowStage): { pause: boolean; gate?: ApprovalGate } {
  // No gate configured
  if (!stage.gate) {
    return { pause: false };
  }

  // Lookup gate definition
  const gate = this.gates.get(stage.gate);
  if (!gate) {
    // Log warning but don't block execution
    console.warn(`Gate "${stage.gate}" referenced by stage "${stage.name}" not found`);
    return { pause: false };
  }

  // Auto-approve gates don't pause
  if (gate.autoApprove) {
    return { pause: false };
  }

  // Non-required gates can be skipped (optional behavior)
  if (!gate.required) {
    // Could emit advisory event but not pause
    return { pause: false };
  }

  return { pause: true, gate };
}
```

### 6. Task Status Update

When pausing for a gate, update task with both status and approval state:

```typescript
await this.store.updateTask(taskId, {
  status: 'awaiting-approval',
  pausedAt: new Date(),
  pauseReason: 'approval_gate',
  approvalState,  // Store the ApprovalState object
  updatedAt: new Date(),
});
```

### 7. Event Emission

Emit `gate:required` event with full context:

```typescript
const eventData: ApprovalRequiredEventData = {
  approvalId: approvalState.id,
  taskId: task.id,
  gateName: stage.gate,
  gateType: gate.type,
  description: gate.description,
  approvers: gate.approvers,
  minApprovals: gate.minApprovals || 1,
  timeoutMinutes: gate.timeout,
  expiresAt: approvalState.expiresAt,
  stage: stage.name,
  agent: stage.agent,
  timestamp: new Date(),
  context: approvalState.context,
  changesSummary: this.summarizeCompletedStages(stageResults),
  blocking: gate.required ?? true,
};

this.emit('gate:required', eventData);
```

### 8. Resume Behavior

When a task with `pauseReason: 'approval_gate'` is resumed (after approval):

1. The existing `resumeTask()` method will load the checkpoint
2. The checkpoint metadata contains `resumePoint: 'pre_stage_gate'`
3. Resume logic should check if the gate is now approved:
   - If approved: proceed to execute the stage
   - If still pending: re-pause (shouldn't happen if properly triggered)
   - If denied: fail the task

### 9. Integration Points

| Component | Integration |
|-----------|-------------|
| `runWorkflow()` | Add gate check before `executeWorkflowStage()` |
| `pauseTask()` | Add `approval_gate` reason type |
| `store.updateTask()` | Store `approvalState` field |
| `store.setGate()` | Create Gate record for tracking |
| Event system | Emit `gate:required` |
| Resume logic | Check gate status before proceeding |

## Consequences

### Positive

1. **Clear pause semantics**: Using `awaiting-approval` status and `approval_gate` pause reason provides clear visibility into why a task is paused.

2. **Leverages existing infrastructure**: Reuses checkpoint, pause/resume, and gate storage mechanisms.

3. **Non-blocking for optional gates**: Gates with `autoApprove: true` or `required: false` don't interrupt workflow.

4. **Event-driven UI integration**: `gate:required` event enables real-time UI updates.

5. **Timeout support**: Gate timeout configuration enables auto-approve or auto-deny after expiration.

### Negative

1. **Single gate per stage**: Current design supports only one gate per stage. Multiple gates would require array support.

2. **Sequential gate checking**: Gates are checked stage-by-stage; doesn't support workflow-level gates that span multiple stages.

### Risks

1. **Gate not found**: If `stage.gate` references a non-existent gate ID, execution continues with a warning. Consider making this configurable (strict vs. lenient mode).

2. **Race conditions**: If gate is approved while task is being paused, ensure atomic state transitions.

## Implementation Checklist

- [ ] Add `approval_gate` to `pauseTask` reason union type
- [ ] Implement `shouldPauseForGate()` helper method
- [ ] Add gate checking logic in `runWorkflow()` before stage execution
- [ ] Create and store `ApprovalState` when gate is encountered
- [ ] Call `store.setGate()` to create pending Gate record
- [ ] Save checkpoint with gate context in metadata
- [ ] Update task status to `awaiting-approval` with `pauseReason: 'approval_gate'`
- [ ] Emit `gate:required` event
- [ ] Add unit tests for gate trigger behavior
- [ ] Update resume logic to check gate status
- [ ] Add integration tests for full pause/resume cycle

## Test Strategy

### Unit Tests

1. **Gate detection tests**:
   - Stage with no gate → proceeds normally
   - Stage with autoApprove gate → proceeds normally
   - Stage with required gate → pauses task
   - Stage with unknown gate ID → logs warning, proceeds

2. **Pause behavior tests**:
   - Task status set to `awaiting-approval`
   - `pauseReason` set to `approval_gate`
   - `ApprovalState` created with correct fields
   - Checkpoint saved with gate metadata
   - `gate:required` event emitted

3. **Resume behavior tests**:
   - Resume after approval → stage executes
   - Resume without approval → re-pauses (or throws)
   - Resume after denial → task fails

### Integration Tests

1. Full workflow with single gate
2. Workflow with multiple gated stages
3. Parallel stages with one gated and one non-gated
4. Gate timeout behavior
5. Multi-approval gates

## References

- ADR-022: Approval Granted/Denied Event Handlers
- `@apexcli/core/types.ts`: ApprovalGate, ApprovalState, TaskStatus
- `packages/orchestrator/src/index.ts`: runWorkflow, pauseTask, saveCheckpoint
- `packages/orchestrator/src/store.ts`: setGate, getGate, updateTask
