# ADR-007: Max Resume Attempts to Prevent Infinite Loops

## Status
Proposed

## Date
2024-12-20

## Context

APEX uses a checkpoint/resume mechanism for session recovery. When a task is paused (due to rate limits, usage limits, session limits, etc.), it saves a checkpoint and can be resumed later. However, there is currently no safeguard against infinite resume loops.

### Current State

The infrastructure for resume attempt tracking already exists:

1. **`resumeAttempts` counter on Task interface** (`packages/core/src/types.ts` line 265):
   ```typescript
   resumeAttempts: number; // Number of times this task has been resumed from checkpoint
   ```

2. **`maxResumeAttempts` config** in `DaemonConfigSchema.sessionRecovery` (`packages/core/src/types.ts` line 182):
   ```typescript
   maxResumeAttempts: z.number().optional().default(3), // Maximum number of resume attempts before giving up
   ```

3. **Database schema** (`packages/orchestrator/src/store.ts` line 103):
   ```sql
   resume_attempts INTEGER DEFAULT 0
   ```

### Problem

Despite this infrastructure, the resume attempt counter is:
1. **Never incremented** - `resumeAttempts` is initialized to 0 but never updated during resume
2. **Never checked** - `maxResumeAttempts` config exists but is not enforced
3. **Never reset** - On successful completion, the counter is not reset

This creates a risk of infinite resume loops where a task repeatedly fails and resumes without ever succeeding or giving up, potentially wasting resources indefinitely.

### Scenarios Leading to Infinite Loops

1. **Persistent API failures**: Task hits rate limit, resumes, immediately hits limit again
2. **Context window issues**: Task approaches session limit, creates checkpoint, resumes, immediately approaches limit again
3. **Buggy agent behavior**: Agent enters a state that always triggers a pause condition
4. **Resource exhaustion**: Memory/disk issues causing repeated failures at the same point

## Decision

Implement resume attempt tracking and enforcement to prevent infinite loops:

### 1. Increment Resume Attempts Counter

Update `resumeTask()` in `ApexOrchestrator` to increment the counter:

```typescript
async resumeTask(taskId: string, options?: { checkpointId?: string }): Promise<boolean> {
  const task = await this.store.getTask(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  // Increment resume attempts counter
  const newResumeAttempts = task.resumeAttempts + 1;
  await this.store.updateTask(taskId, {
    resumeAttempts: newResumeAttempts,
    updatedAt: new Date(),
  });

  // Check if max resume attempts exceeded BEFORE attempting resume
  const maxResumeAttempts = this.effectiveConfig.daemon?.sessionRecovery?.maxResumeAttempts ?? 3;
  if (newResumeAttempts > maxResumeAttempts) {
    await this.failTaskWithMaxResumeError(taskId, newResumeAttempts, maxResumeAttempts);
    return false;
  }

  // Continue with existing resume logic...
}
```

### 2. Add Max Resume Attempts Check

Add a new private method to handle max resume failures:

```typescript
private async failTaskWithMaxResumeError(
  taskId: string,
  attemptCount: number,
  maxAttempts: number
): Promise<void> {
  const errorMessage = `Task failed: Maximum resume attempts exceeded (${attemptCount}/${maxAttempts}). ` +
    `This task has been resumed too many times without completing successfully. ` +
    `Consider: (1) Breaking the task into smaller subtasks, ` +
    `(2) Increasing maxResumeAttempts in daemon.sessionRecovery config, ` +
    `(3) Manually investigating the root cause of repeated pauses.`;

  await this.store.addLog(taskId, {
    level: 'error',
    message: errorMessage,
    metadata: {
      resumeAttempts: attemptCount,
      maxResumeAttempts: maxAttempts,
      failureReason: 'max_resume_attempts_exceeded',
    },
  });

  await this.updateTaskStatus(taskId, 'failed', errorMessage);

  const failedTask = await this.store.getTask(taskId);
  if (failedTask) {
    this.emit('task:failed', failedTask, new Error(errorMessage));
  }
}
```

### 3. Update resumePausedTask() Method

Modify `resumePausedTask()` to also check limits when resuming from paused state:

```typescript
async resumePausedTask(taskId: string): Promise<boolean> {
  const task = await this.store.getTask(taskId);
  if (!task || task.status !== 'paused') {
    return false;
  }

  // Pre-check max resume attempts before clearing pause state
  const maxResumeAttempts = this.effectiveConfig.daemon?.sessionRecovery?.maxResumeAttempts ?? 3;
  const nextAttempt = task.resumeAttempts + 1;

  if (nextAttempt > maxResumeAttempts) {
    await this.failTaskWithMaxResumeError(taskId, nextAttempt, maxResumeAttempts);
    return false;
  }

  // Clear pause-related fields
  await this.store.updateTask(taskId, {
    status: 'in-progress',
    pausedAt: undefined,
    pauseReason: undefined,
    resumeAfter: undefined,
    updatedAt: new Date(),
  });

  // Continue with resume...
  const resumed = await this.resumeTask(taskId);
  // ...
}
```

### 4. Reset Counter on Task Completion

Add logic to reset the counter when a task successfully completes:

```typescript
async updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  message?: string,
  stage?: string
): Promise<void> {
  // ... existing logic ...

  // Reset resume attempts counter on successful completion
  if (status === 'completed') {
    await this.store.updateTask(taskId, {
      resumeAttempts: 0,  // Reset on success
    });
  }
}
```

### 5. Add resumeAttempts to Store.updateTask()

Extend the `updateTask()` method in `TaskStore` to support updating `resumeAttempts`:

```typescript
async updateTask(
  taskId: string,
  updates: Partial<{
    // ... existing fields ...
    resumeAttempts: number;
  }>
): Promise<void> {
  // ... existing logic ...

  if (updates.resumeAttempts !== undefined) {
    setClauses.push('resume_attempts = @resumeAttempts');
    params.resumeAttempts = updates.resumeAttempts;
  }

  // ... existing logic ...
}
```

## Technical Design

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     RESUME FLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  resumePausedTask(taskId)                                    │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────┐                   │
│  │ Pre-check: task.resumeAttempts + 1   │                   │
│  │           > maxResumeAttempts?       │                   │
│  └──────────────────────────────────────┘                   │
│         │                    │                               │
│      NO ▼                 YES ▼                              │
│  ┌─────────────┐     ┌─────────────────────┐                │
│  │ Clear pause │     │ failTaskWithMax...  │                │
│  │ fields      │     │ status = 'failed'   │                │
│  └─────────────┘     └─────────────────────┘                │
│         │                                                    │
│         ▼                                                    │
│  resumeTask(taskId)                                          │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────┐                   │
│  │ Increment: resumeAttempts += 1       │                   │
│  │ (persisted to database)              │                   │
│  └──────────────────────────────────────┘                   │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────┐                   │
│  │ Check: resumeAttempts > max?         │                   │
│  └──────────────────────────────────────┘                   │
│         │                    │                               │
│      NO ▼                 YES ▼                              │
│  ┌─────────────┐     ┌─────────────────────┐                │
│  │ Execute     │     │ Fail task with      │                │
│  │ remaining   │     │ descriptive error   │                │
│  │ stages      │     │                     │                │
│  └─────────────┘     └─────────────────────┘                │
│         │                                                    │
│         ▼                                                    │
│    SUCCESS?                                                  │
│         │                    │                               │
│      YES ▼                 NO ▼                              │
│  ┌─────────────┐     ┌─────────────────────┐                │
│  │ Reset       │     │ Keep resumeAttempts │                │
│  │ resumeAttempts    │ (may pause again)   │                │
│  │ to 0        │     │                     │                │
│  └─────────────┘     └─────────────────────┘                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Error Message Design

The error message when max attempts are exceeded should be:
1. **Clear about the problem**: "Maximum resume attempts exceeded"
2. **Actionable**: Provide specific remediation steps
3. **Traceable**: Include attempt counts in metadata

Example error message:
```
Task failed: Maximum resume attempts exceeded (4/3). This task has been resumed
too many times without completing successfully. Consider: (1) Breaking the task
into smaller subtasks, (2) Increasing maxResumeAttempts in daemon.sessionRecovery
config, (3) Manually investigating the root cause of repeated pauses.
```

### Interface Changes

#### TaskStore (store.ts)

```typescript
export class TaskStore {
  async updateTask(
    taskId: string,
    updates: Partial<{
      // ... existing fields ...
      resumeAttempts: number;  // ADD THIS
    }>
  ): Promise<void>;
}
```

#### ApexOrchestrator (index.ts)

```typescript
export class ApexOrchestrator {
  // Existing methods updated:
  async resumeTask(taskId: string, options?: { checkpointId?: string }): Promise<boolean>;
  async resumePausedTask(taskId: string): Promise<boolean>;
  async updateTaskStatus(taskId: string, status: TaskStatus, message?: string, stage?: string): Promise<void>;

  // New private method:
  private async failTaskWithMaxResumeError(
    taskId: string,
    attemptCount: number,
    maxAttempts: number
  ): Promise<void>;
}
```

### Configuration

The `maxResumeAttempts` setting is already defined in the schema:

```yaml
# .apex/config.yaml
daemon:
  sessionRecovery:
    enabled: true
    maxResumeAttempts: 3  # Default value, can be adjusted
```

Users can increase this value if their workflows legitimately require more resume attempts.

## File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/orchestrator/src/index.ts` | Modify | Update `resumeTask()` to increment counter and check limit |
| `packages/orchestrator/src/index.ts` | Modify | Update `resumePausedTask()` to pre-check limit |
| `packages/orchestrator/src/index.ts` | Add | New `failTaskWithMaxResumeError()` private method |
| `packages/orchestrator/src/index.ts` | Modify | Update task completion to reset counter |
| `packages/orchestrator/src/store.ts` | Modify | Extend `updateTask()` to support `resumeAttempts` |
| `packages/orchestrator/src/max-resume-attempts.test.ts` | Add | Unit and integration tests |

## Testing Strategy

### Unit Tests

1. **Resume attempts increment**:
   - Verify counter increments on each resume call
   - Verify counter persists in database

2. **Max attempts check**:
   - Verify task fails when attempts > maxResumeAttempts
   - Verify correct error message format
   - Verify task status changes to 'failed'

3. **Counter reset on completion**:
   - Verify counter resets to 0 when task status = 'completed'
   - Verify counter is NOT reset on failure

4. **Pre-check in resumePausedTask**:
   - Verify limit is checked before clearing pause fields
   - Verify task fails without clearing pause if limit exceeded

5. **Configuration handling**:
   - Verify default maxResumeAttempts = 3
   - Verify custom maxResumeAttempts is respected

### Integration Tests

1. **Full resume cycle**:
   - Create task, pause it, resume it multiple times
   - Verify failure on 4th resume (with default max of 3)

2. **Successful completion resets counter**:
   - Task with 2 resume attempts completes successfully
   - New task (or resumed task) starts fresh with 0 attempts

3. **Auto-resume respects limits**:
   - Daemon auto-resume should also respect max attempts
   - `scheduleAutoResume()` should check limits before resuming

4. **Parent/subtask interactions**:
   - Parent task hits max resume attempts
   - Subtasks should be appropriately handled (cancelled or orphaned?)

### Edge Cases

1. **Counter at exactly max**:
   - resumeAttempts = 3, maxResumeAttempts = 3
   - Should allow this resume (counter becomes 4, then fails on NEXT resume)
   - OR: Should fail immediately (resume attempt > max check)
   - **Decision**: Fail immediately if newAttempts > max (not >=)

2. **maxResumeAttempts = 0**:
   - Should this disable resume entirely? Or allow unlimited?
   - **Decision**: 0 means no resumes allowed, any positive number is the limit

3. **maxResumeAttempts undefined**:
   - Use default of 3
   - **Decision**: Handled by schema default

4. **Concurrent resume attempts**:
   - Two resume calls for same task at same time
   - **Decision**: Existing mutex should prevent this, but test anyway

## Consequences

### Positive
- Prevents infinite resume loops that waste resources
- Clear error messaging helps users understand and fix issues
- Existing infrastructure reused (no new fields needed)
- Configuration allows tuning per-project needs

### Negative
- Tasks with legitimate need for many resumes may fail prematurely
- Requires user intervention to investigate repeated failures
- Adds complexity to resume logic

### Neutral
- Default of 3 attempts is reasonable for most workflows
- Counter reset on success ensures fresh start for new executions
- No performance impact (single field update)

## Implementation Notes

1. **Order of operations matters**:
   - Increment counter FIRST, then check limit
   - This ensures the counter accurately reflects attempt count

2. **Pre-check vs post-check**:
   - `resumePausedTask` should pre-check to avoid unnecessary state changes
   - `resumeTask` should post-check (after increment) for accurate counting

3. **Logging granularity**:
   - Log each resume attempt with current count
   - Log failure with full context (attempt count, max, reason)

4. **Event emission**:
   - Emit `task:failed` event when max attempts exceeded
   - Include metadata about resume attempt failure reason

5. **Subtask handling**:
   - When parent fails due to max resume, subtasks should be cancelled
   - Or: Leave subtasks as-is and let user decide
   - **Decision**: Leave subtasks as-is (they may complete independently)
