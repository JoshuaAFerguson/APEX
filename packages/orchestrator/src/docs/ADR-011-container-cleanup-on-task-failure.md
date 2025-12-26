# ADR-011: Container Cleanup on Task Failure with preserveOnFailure Support

## Status
Proposed

## Date
2024-12-26

## Context

Currently, the `ApexOrchestrator` has a `setupAutomaticWorkspaceCleanup()` method that listens to the `task:completed` event and calls `workspaceManager.cleanupWorkspace()` to clean up workspaces (including containers, worktrees, and directories) after successful task completion. However, there is no corresponding handler for the `task:failed` event, which means:

1. **Container resources may leak** when tasks fail - containers keep running consuming resources
2. **Worktrees are not cleaned up** on failure by default
3. **The `preserveOnFailure` configuration is only partially implemented** - it's defined in types but not fully enforced

### Current State

1. **`task:completed` event handler exists** (`packages/orchestrator/src/index.ts` line 4319-4336):
   ```typescript
   private setupAutomaticWorkspaceCleanup(): void {
     this.on('task:completed', async (task: Task) => {
       if (this.effectiveConfig.workspace?.cleanupOnComplete !== false) {
         try {
           await this.workspaceManager.cleanupWorkspace(task.id);
         } catch (error) {
           // Log cleanup error...
         }
       }
     });
   }
   ```

2. **`task:failed` event is emitted** but no cleanup handler exists for it

3. **`preserveOnFailure` configuration exists** in multiple places:
   - `WorkspaceConfigSchema` (`packages/core/src/types.ts` line 678)
   - `WorktreeConfigSchema` (`packages/core/src/types.ts` line 141)
   - Task-level `workspace.preserveOnFailure` field

4. **Partial implementation in `updateTaskStatus`** for worktree cleanup (line 1963):
   ```typescript
   const preserveOnFailure = this.effectiveConfig.git.worktree?.preserveOnFailure ?? false;
   shouldCleanup = task.workspace.cleanup && !preserveOnFailure;
   ```

### Problem

- When a task fails, no cleanup is triggered for container workspaces
- The `preserveOnFailure` flag is not consistently checked for container-based workspaces
- Developers have no way to preserve failed task containers for debugging in some cases, while in other cases containers are never cleaned up

## Decision

Extend the `setupAutomaticWorkspaceCleanup()` method to also listen for `task:failed` events and implement the following logic:

### 1. Add `task:failed` Event Handler

```typescript
private setupAutomaticWorkspaceCleanup(): void {
  // Existing task:completed handler
  this.on('task:completed', async (task: Task) => {
    if (this.effectiveConfig.workspace?.cleanupOnComplete !== false) {
      try {
        await this.workspaceManager.cleanupWorkspace(task.id);
      } catch (error) {
        console.warn(`Failed to cleanup workspace for completed task ${task.id}:`, error);
        await this.store.addLog(task.id, {
          level: 'warn',
          message: `Workspace cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
          component: 'workspace-cleanup'
        });
      }
    }
  });

  // NEW: Handle task:failed event
  this.on('task:failed', async (task: Task, error: Error) => {
    // Check if workspace should be preserved on failure for debugging
    const preserveOnFailure = this.shouldPreserveOnFailure(task);

    if (preserveOnFailure) {
      // Log that workspace is being preserved for debugging
      console.log(`Preserving workspace for failed task ${task.id} for debugging`);
      await this.store.addLog(task.id, {
        level: 'info',
        message: `Workspace preserved for debugging. Strategy: ${task.workspace?.strategy ?? 'none'}. ` +
                 `Path/Container: ${task.workspace?.path ?? 'N/A'}`,
        timestamp: new Date(),
        component: 'workspace-cleanup'
      });
    } else {
      // Clean up workspace since preserveOnFailure is false
      if (this.effectiveConfig.workspace?.cleanupOnComplete !== false) {
        try {
          await this.workspaceManager.cleanupWorkspace(task.id);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup workspace for failed task ${task.id}:`, cleanupError);
          await this.store.addLog(task.id, {
            level: 'warn',
            message: `Workspace cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`,
            timestamp: new Date(),
            component: 'workspace-cleanup'
          });
        }
      }
    }
  });
}
```

### 2. Add Helper Method to Check preserveOnFailure

```typescript
/**
 * Determines if a workspace should be preserved when the task fails.
 * Checks both task-level and global configuration.
 */
private shouldPreserveOnFailure(task: Task): boolean {
  // First, check task-level workspace configuration (highest priority)
  if (task.workspace?.preserveOnFailure !== undefined) {
    return task.workspace.preserveOnFailure;
  }

  // For worktree strategy, check git.worktree config
  if (task.workspace?.strategy === 'worktree') {
    return this.effectiveConfig.git?.worktree?.preserveOnFailure ?? false;
  }

  // For other strategies, default to false (cleanup on failure)
  return false;
}
```

### 3. Configuration Hierarchy

The `preserveOnFailure` setting should follow this precedence:

1. **Task-level** (`task.workspace.preserveOnFailure`) - Highest priority
2. **Strategy-specific** (`git.worktree.preserveOnFailure` for worktrees)
3. **Global default** - `false` (clean up on failure)

### 4. Logging Preserved Containers

When a container is preserved for debugging, the log message should include:
- Task ID
- Workspace strategy (container, worktree, directory)
- Container ID (if applicable)
- Workspace path
- Reason for preservation (preserveOnFailure=true)

This information helps developers locate and debug the preserved resources.

## Implementation Plan

### Phase 1: Core Implementation (This Task)

1. Add `shouldPreserveOnFailure()` helper method to `ApexOrchestrator`
2. Extend `setupAutomaticWorkspaceCleanup()` with `task:failed` handler
3. Implement logging for preserved containers

### Phase 2: Unit Tests

Create comprehensive tests in a new file `container-cleanup-on-failure.test.ts`:

1. **Test: Cleanup when preserveOnFailure=false (default)**
   - Emit `task:failed` event
   - Verify `cleanupWorkspace` is called

2. **Test: Preserve when task.workspace.preserveOnFailure=true**
   - Create task with `workspace.preserveOnFailure=true`
   - Emit `task:failed` event
   - Verify `cleanupWorkspace` is NOT called
   - Verify info log about preservation is created

3. **Test: Preserve when git.worktree.preserveOnFailure=true for worktree strategy**
   - Configure `effectiveConfig.git.worktree.preserveOnFailure=true`
   - Create task with `workspace.strategy='worktree'`
   - Emit `task:failed` event
   - Verify workspace is preserved

4. **Test: Task-level config overrides global config**
   - Configure global `preserveOnFailure=true`
   - Create task with `workspace.preserveOnFailure=false`
   - Verify cleanup happens (task-level wins)

5. **Test: Cleanup errors are logged but don't throw**
   - Mock `cleanupWorkspace` to throw
   - Verify error is logged
   - Verify no exception propagates

## Consequences

### Positive

1. **Resource cleanup**: Container resources are properly cleaned up on task failure
2. **Debug support**: Developers can preserve failed containers for debugging when needed
3. **Configuration consistency**: `preserveOnFailure` is now fully implemented and respected
4. **Logging visibility**: Clear logs indicate when containers are preserved for debugging

### Negative

1. **Slight complexity increase**: Additional event handler and helper method
2. **Testing overhead**: New tests required for failure scenarios

### Neutral

1. **Default behavior**: By default, cleanup happens on failure (preserveOnFailure=false)
2. **Backward compatible**: Existing configurations continue to work as expected

## Files to Modify

1. `packages/orchestrator/src/index.ts`
   - Add `shouldPreserveOnFailure()` method
   - Extend `setupAutomaticWorkspaceCleanup()` with `task:failed` handler

2. `packages/orchestrator/src/index.test.ts` or new `container-cleanup-on-failure.test.ts`
   - Add unit tests for new functionality

## Related

- ADR-007: Max Resume Attempts (similar event-driven cleanup pattern)
- WorkspaceConfigSchema.preserveOnFailure in `packages/core/src/types.ts`
- WorktreeConfigSchema.preserveOnFailure in `packages/core/src/types.ts`
- Existing tests in `workspace-cleanup-integration.test.ts`
