# ADR 0001: Approval State Persistence in TaskStore

## Status
Proposed

## Context

APEX needs to persist approval states to SQLite so they survive process restarts. Currently, the `ApprovalState` type is defined in `@apexcli/core` types but there is no persistence mechanism in `TaskStore`. Tasks can reach approval gates (`waiting-approval` status) but the detailed approval state (who requested, timeout, multi-approval progress, context) is not persisted.

### Existing Patterns

The codebase has well-established patterns for similar persistence:

1. **Gates table** - Simple approval tracking with `gates` table (task_id, name, status, required_at, responded_at, approver, comment)
2. **Permissions table** - Extended persistence with JSON columns for complex data (config, tags)
3. **Task iterations table** - Separate table with foreign key to tasks, stores structured data like before/after state

### Requirements from Acceptance Criteria

1. SQLite schema extended with approval_state table or column
2. `saveApprovalState(taskId, state)` method
3. `getApprovalState(taskId)` method
4. `getPendingApprovals()` method for listing awaiting tasks
5. Approval state survives process restart
6. Unit tests verify persistence and recovery

## Decision

### Approach: New `approval_states` Table

We will create a new `approval_states` table rather than adding columns to an existing table because:

1. **ApprovalState has rich structure** - Multiple fields (id, taskId, gateName, status, approver, requestedAt, respondedAt, comment, context, stage, agent, approvalsReceived, approvalsRequired, timeoutMinutes, expiresAt)
2. **Multiple approvals per task** - A task may have multiple approval points at different gates
3. **Querying pending approvals** - Need efficient query for `getPendingApprovals()` across all tasks
4. **Follows existing patterns** - Similar to `task_iterations`, `gates`, `permissions` tables

### Schema Design

```sql
CREATE TABLE IF NOT EXISTS approval_states (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  gate_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  approver TEXT,
  requested_at TEXT NOT NULL,
  responded_at TEXT,
  comment TEXT,
  context TEXT,  -- JSON object
  stage TEXT,
  agent TEXT,
  approvals_received INTEGER DEFAULT 0,
  approvals_required INTEGER DEFAULT 1,
  timeout_minutes INTEGER,
  expires_at TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  UNIQUE(task_id, gate_name)  -- One approval state per gate per task
);

CREATE INDEX IF NOT EXISTS idx_approval_states_task_id ON approval_states(task_id);
CREATE INDEX IF NOT EXISTS idx_approval_states_status ON approval_states(status);
CREATE INDEX IF NOT EXISTS idx_approval_states_expires_at ON approval_states(expires_at);
```

### API Design

```typescript
// Save/update approval state (upsert on task_id + gate_name)
async saveApprovalState(taskId: string, state: ApprovalState): Promise<void>

// Get approval state by task and gate name
async getApprovalState(taskId: string, gateName: string): Promise<ApprovalState | null>

// Get approval state by approval ID
async getApprovalStateById(approvalId: string): Promise<ApprovalState | null>

// Get all approval states for a task
async getApprovalStates(taskId: string): Promise<ApprovalState[]>

// List all pending approvals across all tasks
async getPendingApprovals(): Promise<ApprovalState[]>

// Delete approval state (for cleanup)
async deleteApprovalState(taskId: string, gateName: string): Promise<void>

// Delete all approval states for a task
async deleteAllApprovalStates(taskId: string): Promise<void>
```

### Implementation Details

1. **Table Creation**: Add to `createTables()` method alongside existing tables
2. **Migration**: Add to `runMigrations()` for existing databases (create table if not exists is sufficient)
3. **Row Interface**: Add `ApprovalStateRow` interface following existing patterns
4. **Type Conversion**: Add `rowToApprovalState()` helper following `rowToCheckpoint()` pattern
5. **Date Handling**: Store dates as ISO strings, parse on read (consistent with existing patterns)
6. **Context Field**: Store as JSON string, parse on read (similar to permissions.config)

### Files to Modify

1. **packages/orchestrator/src/store.ts**
   - Add `approval_states` table to `createTables()`
   - Add `ApprovalStateRow` interface
   - Add `rowToApprovalState()` helper
   - Add all CRUD methods

2. **packages/orchestrator/src/store.test.ts**
   - Add tests for approval state persistence
   - Add tests for `getPendingApprovals()`
   - Add tests for process restart recovery

3. **packages/core/src/types.ts** (may need minor updates)
   - Ensure `ApprovalState` is properly exported

## Consequences

### Positive

- Approval states survive process restarts
- Can query pending approvals across all tasks efficiently
- Rich approval data preserved (context, multi-approval progress, timeout)
- Follows established patterns in codebase
- Clean separation of concerns (gates = simple, approval_states = rich)

### Negative

- Slight overlap with existing `gates` table functionality
- Additional table to maintain
- Need to ensure consistency between gates and approval_states if both are used

### Mitigation

- Document that `approval_states` is the source of truth for rich approval data
- Consider deprecating gates table in future or using approval_states as single source
- Add cleanup logic to remove approval_states when task is deleted

## Implementation Plan

1. Add `approval_states` table schema to `createTables()`
2. Add `ApprovalStateRow` interface
3. Add `rowToApprovalState()` helper method
4. Implement `saveApprovalState()` method
5. Implement `getApprovalState()` method
6. Implement `getApprovalStateById()` method
7. Implement `getApprovalStates()` method
8. Implement `getPendingApprovals()` method
9. Implement `deleteApprovalState()` and `deleteAllApprovalStates()` methods
10. Add import for `ApprovalState` type from `@apexcli/core`
11. Write unit tests for all methods
12. Write integration test for process restart recovery
