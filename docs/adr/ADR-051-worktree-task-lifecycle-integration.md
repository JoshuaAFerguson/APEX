# ADR-051: WorktreeManager Integration with Task Lifecycle

## Status

Proposed

## Context

APEX has a `WorktreeManager` class that handles git worktree operations for task isolation. Currently, the `ApexOrchestrator` does not automatically create or manage worktrees during the task lifecycle. This integration would enable tasks to work in isolated git worktrees when `config.git.autoWorktree` is enabled.

### Current State

1. **WorktreeManager** (`packages/orchestrator/src/worktree-manager.ts`):
   - `createWorktree(taskId, branchName)` - Creates a worktree for a task
   - `deleteWorktree(taskId)` - Removes a worktree
   - `getWorktree(taskId)` - Gets worktree info by task ID
   - `listWorktrees()` - Lists all worktrees
   - `cleanupOrphanedWorktrees()` - Cleans stale worktrees

2. **ApexOrchestrator** (`packages/orchestrator/src/index.ts`):
   - `createTask()` - Creates tasks (lines 206-290)
   - `executeTask()` - Executes tasks with workflow (lines 295-463)
   - `cancelTask()` - Cancels running tasks (lines 2397-2420)
   - Task lifecycle events are emitted via EventEmitter

3. **Configuration** (`packages/core/src/types.ts`):
   - `GitConfig.autoWorktree` (boolean, default: false) - Enable automatic worktree creation
   - `GitConfig.worktree` (WorktreeConfig) - Worktree configuration options

4. **Task Type** (`packages/core/src/types.ts`):
   - Currently lacks a `worktreePath` field

## Decision

Integrate `WorktreeManager` with `ApexOrchestrator` task lifecycle with the following design:

### 1. Type Changes (packages/core/src/types.ts)

Add `worktreePath` field to the `Task` interface:

```typescript
export interface Task {
  // ... existing fields ...
  worktreePath?: string;  // Path to git worktree if task uses worktree isolation
}
```

Add new event types to `ApexEventType`:

```typescript
export type ApexEventType =
  | // ... existing types ...
  | 'worktree:created'
  | 'worktree:cleaned';
```

### 2. Configuration Integration (packages/core/src/config.ts)

Update `getEffectiveConfig()` to include git worktree settings:

```typescript
git: {
  // ... existing fields ...
  autoWorktree: config.git?.autoWorktree ?? false,
  worktree: config.git?.worktree,
},
```

### 3. Orchestrator Changes (packages/orchestrator/src/index.ts)

#### 3.1 Add WorktreeManager Instance

```typescript
export class ApexOrchestrator extends EventEmitter<OrchestratorEvents> {
  // ... existing fields ...
  private worktreeManager?: WorktreeManager;

  async initialize(): Promise<void> {
    // ... existing initialization ...

    // Initialize WorktreeManager if autoWorktree is enabled
    if (this.effectiveConfig.git.autoWorktree) {
      this.worktreeManager = new WorktreeManager({
        projectPath: this.projectPath,
        config: this.effectiveConfig.git.worktree,
      });
    }
  }
}
```

#### 3.2 Update OrchestratorEvents Interface

```typescript
export interface OrchestratorEvents {
  // ... existing events ...
  'worktree:created': (taskId: string, worktreePath: string) => void;
  'worktree:cleaned': (taskId: string, worktreePath: string) => void;
}
```

#### 3.3 Modify createTask()

When `config.git.autoWorktree` is `true`, automatically create a worktree:

```typescript
async createTask(options: { /* ... */ }): Promise<Task> {
  // ... existing task creation logic ...

  // Create worktree if autoWorktree is enabled and this is not a subtask
  let worktreePath: string | undefined;
  if (this.effectiveConfig.git.autoWorktree &&
      this.worktreeManager &&
      !options.parentTaskId &&
      branchName) {
    try {
      worktreePath = await this.worktreeManager.createWorktree(taskId, branchName);
      this.emit('worktree:created', taskId, worktreePath);
      await this.store.addLog(taskId, {
        level: 'info',
        message: `Created worktree at ${worktreePath}`,
      });
    } catch (error) {
      // Log but don't fail task creation
      await this.store.addLog(taskId, {
        level: 'warn',
        message: `Failed to create worktree: ${(error as Error).message}`,
      });
    }
  }

  const task: Task = {
    // ... existing fields ...
    worktreePath,
  };

  // ... rest of creation logic ...
}
```

#### 3.4 Add Worktree Cleanup on Task Completion/Cancellation

Create a helper method for worktree cleanup:

```typescript
private async cleanupWorktreeIfNeeded(task: Task): Promise<void> {
  if (!task.worktreePath || !this.worktreeManager) {
    return;
  }

  const worktreeConfig = this.effectiveConfig.git.worktree;

  // Check if we should preserve on failure
  if (task.status === 'failed' && worktreeConfig?.preserveOnFailure) {
    await this.store.addLog(task.id, {
      level: 'info',
      message: `Preserving worktree for debugging: ${task.worktreePath}`,
    });
    return;
  }

  // Check if cleanup is disabled
  if (worktreeConfig?.cleanupOnComplete === false) {
    return;
  }

  try {
    const deleted = await this.worktreeManager.deleteWorktree(task.id);
    if (deleted) {
      this.emit('worktree:cleaned', task.id, task.worktreePath);
      await this.store.addLog(task.id, {
        level: 'info',
        message: `Cleaned up worktree at ${task.worktreePath}`,
      });
    }
  } catch (error) {
    await this.store.addLog(task.id, {
      level: 'warn',
      message: `Failed to cleanup worktree: ${(error as Error).message}`,
    });
  }
}
```

Integrate cleanup into task completion:

```typescript
// In executeTask(), after emitting task:completed
if (shouldComplete) {
  await this.updateTaskStatus(taskId, 'completed');
  const completedTask = await this.store.getTask(taskId);
  this.emit('task:completed', completedTask!);

  // Cleanup worktree
  if (completedTask) {
    await this.cleanupWorktreeIfNeeded(completedTask);
  }
  // ... rest of completion logic ...
}
```

Integrate cleanup into task cancellation:

```typescript
async cancelTask(taskId: string): Promise<boolean> {
  // ... existing cancellation logic ...

  await this.updateTaskStatus(taskId, 'cancelled', 'Task was cancelled by user');

  // Cleanup worktree
  const cancelledTask = await this.store.getTask(taskId);
  if (cancelledTask) {
    await this.cleanupWorktreeIfNeeded(cancelledTask);
  }

  // ... rest of cancellation logic ...
}
```

#### 3.5 Modify Subtask Handling

Subtasks should inherit the parent's worktree path:

```typescript
// In createTask(), when handling subtasks:
if (options.parentTaskId) {
  const parentTask = await this.store.getTask(options.parentTaskId);
  branchName = parentTask?.branchName;
  worktreePath = parentTask?.worktreePath;  // Inherit worktree path
}
```

### 4. Store Changes (packages/orchestrator/src/store.ts)

Update the TaskStore to persist `worktreePath`:

```typescript
// In the task table schema and serialization/deserialization
```

### 5. Data Flow

```
createTask() called
    │
    ├─► Generate task ID and branch name
    │
    ├─► If config.git.autoWorktree && !parentTaskId:
    │       │
    │       ├─► worktreeManager.createWorktree(taskId, branchName)
    │       │
    │       ├─► emit('worktree:created', taskId, path)
    │       │
    │       └─► Store worktreePath in task
    │
    ├─► Store task in database
    │
    └─► emit('task:created', task)

Task completion/cancellation:
    │
    ├─► Update task status
    │
    ├─► If task.worktreePath && cleanupOnComplete:
    │       │
    │       ├─► If failed && preserveOnFailure: skip cleanup
    │       │
    │       ├─► worktreeManager.deleteWorktree(taskId)
    │       │
    │       └─► emit('worktree:cleaned', taskId, path)
    │
    └─► emit('task:completed' | 'task:cancelled', task)
```

### 6. Error Handling

- Worktree creation failure should NOT fail task creation (warn and continue)
- Worktree cleanup failure should NOT fail task completion (warn and continue)
- Use existing `WorktreeError` for typed errors

## Consequences

### Positive

1. **Task Isolation**: Tasks can work in isolated worktrees, preventing conflicts
2. **Automatic Cleanup**: Worktrees are cleaned up when tasks complete
3. **Debugging Support**: `preserveOnFailure` allows inspecting failed task state
4. **Event-Driven**: Events enable UI updates and logging
5. **Backward Compatible**: `autoWorktree` defaults to `false`

### Negative

1. **Disk Space**: Multiple worktrees consume disk space
2. **Git Overhead**: Managing worktrees adds git command overhead
3. **Complexity**: Additional error handling paths

### Neutral

1. **Configuration**: Users must opt-in via `config.git.autoWorktree`
2. **Subtask Inheritance**: Subtasks share parent's worktree

## Implementation Checklist

1. [ ] Add `worktreePath` to `Task` interface in `types.ts`
2. [ ] Add `worktree:created` and `worktree:cleaned` to `ApexEventType`
3. [ ] Update `getEffectiveConfig()` to include `autoWorktree` and `worktree`
4. [ ] Add `OrchestratorEvents` entries for worktree events
5. [ ] Initialize `WorktreeManager` in `ApexOrchestrator.initialize()`
6. [ ] Modify `createTask()` to optionally create worktree
7. [ ] Add `cleanupWorktreeIfNeeded()` helper method
8. [ ] Integrate cleanup into task completion in `executeTask()`
9. [ ] Integrate cleanup into `cancelTask()`
10. [ ] Handle subtask worktree inheritance
11. [ ] Update `TaskStore` for `worktreePath` persistence
12. [ ] Add unit tests for new functionality
13. [ ] Add integration tests for worktree lifecycle
14. [ ] Update documentation

## References

- WorktreeManager implementation: `packages/orchestrator/src/worktree-manager.ts`
- WorktreeConfig type: `packages/core/src/types.ts` (lines 131-143)
- GitConfig type: `packages/core/src/types.ts` (lines 149-165)
- Existing worktree tests: `packages/orchestrator/src/worktree-manager.test.ts`
