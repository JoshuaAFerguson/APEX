# ADR-003: Priority-Based Parent Task Auto-Resume on Session Limit

## Status
Proposed

## Date
2024-12-20

## Context

When APEX daemon operates with multiple concurrent tasks (both parent tasks and their subtasks), capacity may be restored after hitting usage limits or budget constraints. The current implementation in `DaemonRunner.handleCapacityRestored()` fetches paused tasks via `TaskStore.getPausedTasksForResume()` and iterates through them without special handling for parent/subtask relationships.

### Current Behavior
1. `getPausedTasksForResume()` returns all paused tasks with resumable reasons (`usage_limit`, `budget`, `capacity`), ordered by priority and creation time
2. `handleCapacityRestored()` resumes tasks in the order returned, without distinguishing between parent tasks and subtasks
3. When a subtask is resumed, it calls `checkAndResumeParent()` to potentially resume the parent if all subtasks are unpaused

### Problem
This approach has several issues:
1. **Priority inversion**: A low-priority subtask may be resumed before a high-priority parent task
2. **Cascading resumes**: Resuming individual subtasks may not efficiently resume their parents
3. **Resource waste**: Resuming subtasks without their parent context may lead to orphaned executions
4. **Inconsistent ordering**: Parent tasks should logically be resumed before their dependent subtasks to maintain workflow coherence

## Decision

Implement priority-based parent task auto-resume with the following architectural changes:

### 1. New Store Method: `findHighestPriorityParentTask()`

Add a new method to `TaskStore` that finds paused parent tasks (tasks with subtasks) ordered by priority:

```typescript
/**
 * Find the highest priority parent task that is paused and resumable.
 * Parent tasks are tasks that have subtaskIds defined.
 *
 * @returns Parent tasks ordered by priority (urgent > high > normal > low), then by creation time
 */
async findHighestPriorityParentTask(): Promise<Task[]> {
  const now = new Date().toISOString();

  const sql = `
    SELECT t.*
    FROM tasks t
    WHERE t.status = 'paused'
    AND t.pause_reason IN ('usage_limit', 'budget', 'capacity')
    AND (t.resume_after IS NULL OR t.resume_after <= ?)
    AND t.subtask_ids IS NOT NULL
    AND t.subtask_ids != '[]'
    ORDER BY CASE t.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
      ELSE 5
    END ASC, t.created_at ASC
  `;

  // ... implementation details
}
```

### 2. Modified `handleCapacityRestored()` in DaemonRunner

Modify the capacity restoration handler to prioritize parent tasks:

```typescript
private async handleCapacityRestored(event: CapacityRestoredEvent): Promise<void> {
  // Phase 1: Resume highest priority parent tasks first
  const pausedParentTasks = await this.store.findHighestPriorityParentTask();

  for (const parentTask of pausedParentTasks) {
    const resumed = await this.orchestrator.resumePausedTask(parentTask.id);
    if (resumed) {
      // Parent resumed - also check and resume its subtasks if needed
      await this.resumeParentSubtasksIfNeeded(parentTask.id);
    }
  }

  // Phase 2: Resume remaining paused tasks (non-parent) by priority
  const remainingPausedTasks = await this.store.getPausedTasksForResume();
  // Filter out already-resumed parent tasks and their subtasks
  // Resume in priority order
}
```

### 3. New Method: `resumeParentSubtasksIfNeeded()`

When resuming a parent task, check if its subtasks also need to be resumed:

```typescript
/**
 * Resume paused subtasks of a parent task when the parent is resumed.
 * Only resumes subtasks that were paused due to resumable reasons.
 */
private async resumeParentSubtasksIfNeeded(parentTaskId: string): Promise<void> {
  const parentTask = await this.store.getTask(parentTaskId);
  if (!parentTask?.subtaskIds?.length) return;

  for (const subtaskId of parentTask.subtaskIds) {
    const subtask = await this.store.getTask(subtaskId);
    if (subtask?.status === 'paused' &&
        ['usage_limit', 'budget', 'capacity'].includes(subtask.pauseReason || '')) {
      await this.orchestrator.resumePausedTask(subtaskId);
    }
  }
}
```

## Technical Design

### Data Flow

```
Capacity Restored Event
         │
         ▼
┌─────────────────────────────────┐
│ 1. Find paused parent tasks     │
│    (ordered by priority)        │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 2. For each parent task:        │
│    a) Resume parent             │
│    b) Resume paused subtasks    │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 3. Resume remaining non-parent  │
│    paused tasks by priority     │
└─────────────────────────────────┘
```

### SQL Query Design

The `findHighestPriorityParentTask()` query:

```sql
SELECT t.*
FROM tasks t
WHERE t.status = 'paused'
  AND t.pause_reason IN ('usage_limit', 'budget', 'capacity')
  AND (t.resume_after IS NULL OR t.resume_after <= ?)
  AND t.subtask_ids IS NOT NULL
  AND t.subtask_ids != '[]'
  AND t.subtask_ids != 'null'
ORDER BY
  CASE t.priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
    ELSE 5
  END ASC,
  t.created_at ASC
```

### Interface Changes

#### TaskStore (store.ts)

```typescript
export class TaskStore {
  // Existing methods...

  /**
   * Find paused parent tasks (tasks with subtasks) ordered by priority.
   * This is used for priority-based auto-resume when capacity is restored.
   *
   * A parent task is defined as a task where:
   * - status = 'paused'
   * - pause_reason IN ('usage_limit', 'budget', 'capacity')
   * - resume_after is null or in the past
   * - subtask_ids is a non-empty JSON array
   *
   * @returns Array of parent tasks sorted by priority (urgent > high > normal > low),
   *          then by creation time (oldest first)
   */
  async findHighestPriorityParentTask(): Promise<Task[]>;
}
```

#### DaemonRunner (runner.ts)

```typescript
export class DaemonRunner {
  // Existing methods...

  /**
   * Handle capacity restored events with priority-based parent task resume.
   *
   * Resume order:
   * 1. Parent tasks (tasks with subtasks) by priority
   * 2. Their subtasks (if paused with resumable reasons)
   * 3. Remaining non-parent paused tasks by priority
   */
  private async handleCapacityRestored(event: CapacityRestoredEvent): Promise<void>;

  /**
   * Resume paused subtasks when their parent is resumed.
   * Only resumes subtasks paused due to usage_limit, budget, or capacity.
   */
  private async resumeParentSubtasksIfNeeded(parentTaskId: string): Promise<void>;
}
```

### Edge Cases

1. **Nested parent tasks**: A subtask may itself be a parent task (with its own subtasks). The implementation should handle recursive relationships by processing the hierarchy top-down.

2. **Partial subtask completion**: When a parent is resumed, some subtasks may already be completed. Only paused subtasks with resumable reasons should be resumed.

3. **Parent paused for different reason**: If a parent is paused for a non-resumable reason (e.g., 'manual'), it should not be auto-resumed even if its subtasks are resumable.

4. **Subtask dependency order**: When resuming subtasks, respect the `subtaskStrategy` (sequential/parallel/dependency-based) and `dependsOn` relationships.

5. **Concurrent resume attempts**: Use the existing mutex/locking mechanisms in `ApexOrchestrator` to prevent race conditions during resume.

## File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/orchestrator/src/store.ts` | Add method | `findHighestPriorityParentTask()` |
| `packages/orchestrator/src/runner.ts` | Modify | Update `handleCapacityRestored()` |
| `packages/orchestrator/src/runner.ts` | Add method | `resumeParentSubtasksIfNeeded()` |
| `packages/orchestrator/src/store.test.ts` | Add tests | Unit tests for `findHighestPriorityParentTask()` |
| `packages/orchestrator/src/runner.auto-resume.test.ts` | Add tests | Tests for priority-based parent resume |

## Testing Strategy

### Unit Tests

1. **`findHighestPriorityParentTask()` tests**:
   - Returns only parent tasks (tasks with subtaskIds)
   - Orders by priority correctly (urgent > high > normal > low)
   - Within same priority, orders by creation time
   - Excludes tasks with non-resumable pause reasons
   - Excludes tasks with future resumeAfter dates
   - Returns empty array when no parent tasks are paused

2. **`handleCapacityRestored()` tests**:
   - Parent tasks are resumed before subtasks
   - Subtasks are resumed after their parent
   - Non-parent tasks are resumed after all parent+subtask combinations
   - Priority ordering is maintained across all phases

3. **`resumeParentSubtasksIfNeeded()` tests**:
   - Only resumes subtasks with resumable pause reasons
   - Skips already-resumed or completed subtasks
   - Handles nested parent tasks correctly

### Integration Tests

1. **Multi-level hierarchy resume**:
   - Parent with subtasks where subtasks also have subtasks
   - Verify top-down resume order

2. **Mixed priority scenario**:
   - Multiple parents with different priorities
   - Verify urgent parent and its subtasks resume before low-priority parent

3. **Partial pause scenario**:
   - Parent paused, some subtasks completed, some paused
   - Verify only paused subtasks are resumed

## Consequences

### Positive
- Parent tasks are prioritized correctly during auto-resume
- Subtasks resume in context of their parent task
- Clear ordering guarantees (priority > creation time)
- Maintains workflow coherence during recovery

### Negative
- Slightly more complex resume logic
- Additional database query for parent task lookup
- Potential for longer resume cycles if many parent tasks exist

### Neutral
- No change to existing `getPausedTasksForResume()` behavior
- Existing pause/resume infrastructure is reused
- SQLite query performance should remain acceptable (indexed on status)

## Implementation Notes

1. **Performance**: The `findHighestPriorityParentTask()` query benefits from the existing `idx_tasks_status` index. Consider adding a composite index if performance becomes an issue with large task counts.

2. **Atomicity**: Resume operations should be wrapped in try-catch to handle partial failures gracefully. A failed parent resume should not prevent other tasks from resuming.

3. **Logging**: Add comprehensive logging to track resume order and any failures for debugging purposes.

4. **Event Emission**: Emit appropriate events (`tasks:auto-resumed`) with details about which tasks were resumed and in what order.
