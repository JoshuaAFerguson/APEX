# ADR: APEX Retry Command Architecture

**Status**: Verified
**Date**: 2026-03-06
**Author**: Architecture Agent

## Context

The `/retry <taskId>` command allows users to retry failed, cancelled, or stuck tasks in the APEX CLI. This audit verifies that the implementation correctly validates retryable statuses, resets task state to pending, and re-executes the task through the orchestrator.

## Decision

### Architectural Overview

The retry command follows a **three-layer architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLI Layer (repl.tsx)                       │
│  - Command parsing and routing                                  │
│  - User feedback via InkApp messages                            │
│  - Input validation (task ID presence)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Orchestrator Layer (index.ts)                  │
│  - Task retrieval (getTask)                                     │
│  - Status updates (updateTaskStatus)                            │
│  - Task execution (executeTask)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Store Layer (store.ts)                        │
│  - SQLite-backed task persistence                               │
│  - Status transitions with timestamp updates                    │
│  - Task state management                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Details

#### 1. Command Handler (`packages/cli/src/repl.tsx`)

```typescript
async function handleRetry(args: string[]): Promise<void> {
  // 1. Validate initialization
  if (!ctx.initialized || !ctx.orchestrator) {
    ctx.app?.addMessage({ type: 'error', content: 'APEX not initialized...' });
    return;
  }

  // 2. Validate task ID parameter
  const taskId = args[0];
  if (!taskId) {
    ctx.app?.addMessage({ type: 'error', content: 'Usage: /retry <task_id>' });
    return;
  }

  // 3. Retrieve and validate task existence
  const task = await ctx.orchestrator.getTask(taskId);
  if (!task) {
    ctx.app?.addMessage({ type: 'error', content: `Task not found: ${taskId}` });
    return;
  }

  // 4. Validate retryable status
  const retryableStatuses = ['failed', 'cancelled', 'in-progress', 'planning'];
  if (!retryableStatuses.includes(task.status)) {
    ctx.app?.addMessage({ type: 'error', content: 'Only failed, cancelled, or stuck tasks...' });
    return;
  }

  // 5. Reset status to pending and re-execute
  await ctx.orchestrator.updateTaskStatus(taskId, 'pending');
  ctx.orchestrator.executeTask(taskId).catch((error: Error) => {
    ctx.app?.addMessage({ type: 'error', content: `Task failed: ${error.message}` });
  });

  ctx.app?.addMessage({ type: 'system', content: `Retrying task ${taskId}...` });
}
```

#### 2. Retryable Status Definitions

| Status | Retryable | Rationale |
|--------|-----------|-----------|
| `failed` | Yes | Task encountered an error and terminated |
| `cancelled` | Yes | Task was manually cancelled by user |
| `in-progress` | Yes | Task may be stuck (no heartbeat/updates) |
| `planning` | Yes | Task stuck during planning phase |
| `completed` | **No** | Task finished successfully |
| `pending` | **No** | Task hasn't started yet |
| `queued` | **No** | Task is already waiting to run |
| `paused` | **No** | Use `/resume` command instead |

#### 3. Orchestrator `updateTaskStatus` Method

The `updateTaskStatus` method in `packages/orchestrator/src/index.ts` includes:
- **Safeguard**: Prevents marking parent tasks as completed if subtasks are incomplete
- **Status propagation**: Propagates `in-progress` status up the ancestor chain
- **Worktree cleanup**: Cleans up worktrees for terminal states (completed/failed/cancelled)

```typescript
async updateTaskStatus(taskId: string, status: TaskStatus, error?: string): Promise<void> {
  // Safeguard: Check for incomplete subtasks before completion
  if (status === 'completed') {
    // ... validation logic for subtasks
  }

  await this.store.updateTask(taskId, {
    status,
    error,
    updatedAt: new Date(),
    ...(status === 'completed' ? {
      completedAt: new Date(),
      resumeAttempts: 0,
      pauseReason: undefined,
      pausedAt: undefined,
      resumeAfter: undefined,
    } : {}),
  });

  // Handle worktree cleanup for terminal states
  if ((status === 'completed' || status === 'failed' || status === 'cancelled') && this.worktreeManager) {
    await this.cleanupWorktree(taskId, status);
  }
}
```

### Sequence Diagram

```
User                CLI (repl.tsx)          Orchestrator           Store
  │                      │                       │                   │
  │ /retry task_123      │                       │                   │
  │─────────────────────>│                       │                   │
  │                      │                       │                   │
  │                      │ getTask(task_123)     │                   │
  │                      │──────────────────────>│                   │
  │                      │                       │ SELECT * FROM...  │
  │                      │                       │──────────────────>│
  │                      │                       │<──────────────────│
  │                      │<──────────────────────│                   │
  │                      │                       │                   │
  │                      │ [validate status]     │                   │
  │                      │                       │                   │
  │                      │ updateTaskStatus      │                   │
  │                      │ (task_123, 'pending') │                   │
  │                      │──────────────────────>│                   │
  │                      │                       │ UPDATE tasks...   │
  │                      │                       │──────────────────>│
  │                      │                       │<──────────────────│
  │                      │<──────────────────────│                   │
  │                      │                       │                   │
  │                      │ executeTask(task_123) │                   │
  │                      │──────────────────────>│ [async]           │
  │                      │                       │                   │
  │ "Retrying task..."   │                       │                   │
  │<─────────────────────│                       │                   │
```

## Test Coverage

### Existing Test Suites

1. **`tests/apex-retry-command-audit.test.ts`** - 16 tests
   - Status validation for all retryable states
   - Non-retryable status rejection
   - Error handling (missing task ID, non-existent task, uninitialized)
   - Execution flow sequence verification

2. **`tests/apex-retry-command-integration.test.ts`** - 9 tests
   - Real orchestrator behavior simulation
   - Task state transitions
   - Complete retry flow with execution

3. **`tests/apex-retry-command-edge-cases.test.ts`** - Edge case scenarios
4. **`tests/apex-retry-command-e2e.test.ts`** - End-to-end scenarios
5. **`tests/apex-retry-command-security.test.ts`** - Security validation

## Verification Results

| Check | Status | Notes |
|-------|--------|-------|
| `handleRetry` validates retryable statuses | ✅ PASS | `['failed', 'cancelled', 'in-progress', 'planning']` |
| Resets task to `pending` status | ✅ PASS | Calls `updateTaskStatus(taskId, 'pending')` |
| Re-executes task via orchestrator | ✅ PASS | Calls `executeTask(taskId)` asynchronously |
| Build passes | ✅ PASS | `npm run build` succeeds |
| Tests pass | ✅ PASS | 25 retry-specific tests pass |

## Consequences

### Positive
- Clean separation of concerns across layers
- Proper error handling with user-friendly messages
- Supports multiple stuck states (not just failed)
- Async execution doesn't block the CLI

### Negative
- `in-progress` retry could conflict with still-running tasks (mitigated by concurrent execution guards in orchestrator)
- No confirmation prompt before retrying

### Future Considerations
- Add optional `--force` flag to skip status validation
- Consider adding retry count limits at orchestrator level
- Implement retry backoff for repeatedly failing tasks

## Related Commands

- `/cancel <taskId>` - Cancel a running task
- `/resume <taskId>` - Resume a paused task
- `/status <taskId>` - Check task status
