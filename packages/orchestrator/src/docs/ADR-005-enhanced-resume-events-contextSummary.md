# ADR-005: Enhanced Resume Events with contextSummary in runner.ts

## Status
Proposed

## Context
The current `handleCapacityRestored` method in `runner.ts` emits a `TasksAutoResumedEvent` with the v0.4.0 enhanced fields (`resumeReason` and `contextSummary`), but these fields are not fully populated with meaningful data derived from the actual task session data. Additionally, when individual tasks are resumed, the system should emit a `task:session-resumed` event for each task with rich context information.

### Current State
The `handleCapacityRestored` method (lines 389-475 in runner.ts):
1. Finds paused parent tasks and regular paused tasks
2. Calls `orchestrator.resumePausedTask()` for each
3. Emits a `TasksAutoResumedEvent` with basic counts but without populated `contextSummary`

### Acceptance Criteria
1. `handleCapacityRestored` method generates `contextSummary` using task session data
2. Emits enhanced `TasksAutoResumedEvent` with the `contextSummary` field populated
3. Each individual task resume emits `task:session-resumed` event

## Technical Design

### 1. Import Requirements

Add the following imports to `runner.ts`:

```typescript
import { createContextSummary } from './context';
import { TaskSessionResumedEvent } from './index';
```

### 2. Helper Function: generateAggregatedContextSummary

Create a new helper method in `DaemonRunner` class to aggregate context summaries from multiple resumed tasks:

```typescript
/**
 * Generate an aggregated context summary for all resumed tasks.
 * This provides a high-level overview of what tasks were resumed and their context.
 *
 * @param resumedTasks - Array of successfully resumed tasks with their session data
 * @param failedTasks - Array of tasks that failed to resume with error details
 * @param reason - The capacity restoration reason
 * @returns A formatted context summary string
 */
private generateAggregatedContextSummary(
  resumedTasks: Array<{
    task: Task;
    sessionData?: TaskSessionData;
  }>,
  failedTasks: Array<{ taskId: string; error: string }>,
  reason: string
): string {
  const parts: string[] = [];

  // Summary header
  const totalCount = resumedTasks.length + failedTasks.length;
  parts.push(`Auto-resume triggered by ${reason}.`);

  if (resumedTasks.length > 0) {
    parts.push(`\nSuccessfully resumed ${resumedTasks.length} of ${totalCount} task(s):`);

    // Group tasks by workflow/type for better summarization
    const tasksByWorkflow = new Map<string, typeof resumedTasks>();
    for (const { task, sessionData } of resumedTasks) {
      const workflow = task.workflow || 'unknown';
      if (!tasksByWorkflow.has(workflow)) {
        tasksByWorkflow.set(workflow, []);
      }
      tasksByWorkflow.get(workflow)!.push({ task, sessionData });
    }

    // Summarize by workflow
    for (const [workflow, tasks] of tasksByWorkflow) {
      const descriptions = tasks.slice(0, 3).map(t =>
        t.task.description.substring(0, 50) + (t.task.description.length > 50 ? '...' : '')
      );
      parts.push(`  - ${workflow}: ${tasks.length} task(s)`);
      descriptions.forEach(desc => parts.push(`    • ${desc}`));
      if (tasks.length > 3) {
        parts.push(`    • (+${tasks.length - 3} more)`);
      }
    }

    // Include context from first 3 tasks' session data
    const tasksWithContext = resumedTasks
      .filter(t => t.sessionData?.contextSummary)
      .slice(0, 3);

    if (tasksWithContext.length > 0) {
      parts.push(`\nTask context highlights:`);
      for (const { task, sessionData } of tasksWithContext) {
        const summary = sessionData!.contextSummary!;
        // Extract key info from context summary (first 100 chars)
        const highlight = summary.substring(0, 100).replace(/\n/g, ' ');
        parts.push(`  - [${task.id.substring(0, 8)}]: ${highlight}...`);
      }
    }
  }

  if (failedTasks.length > 0) {
    parts.push(`\n${failedTasks.length} task(s) failed to resume:`);
    for (const { taskId, error } of failedTasks.slice(0, 5)) {
      parts.push(`  - ${taskId.substring(0, 8)}: ${error.substring(0, 60)}`);
    }
    if (failedTasks.length > 5) {
      parts.push(`  (+${failedTasks.length - 5} more failures)`);
    }
  }

  if (resumedTasks.length === 0 && failedTasks.length === 0) {
    parts.push('No tasks were available for resumption.');
  }

  return parts.join('\n');
}
```

### 3. Helper Function: generateDetailedResumeReason

Create a helper to generate detailed resume reason strings:

```typescript
/**
 * Generate a detailed human-readable resume reason string.
 *
 * @param event - The capacity restored event
 * @param totalTasks - Total number of tasks found for resume
 * @returns Detailed resume reason string
 */
private generateDetailedResumeReason(
  event: CapacityRestoredEvent,
  totalTasks: number
): string {
  const parts: string[] = [];

  // Base reason from event
  switch (event.reason) {
    case 'mode_switch':
      parts.push(`Capacity mode switched to ${event.previousMode ? `from ${event.previousMode}` : 'new mode'}.`);
      break;
    case 'budget_reset':
      parts.push('Daily budget has been reset, restoring capacity for paused tasks.');
      break;
    case 'capacity_dropped':
      parts.push('System capacity usage dropped below threshold.');
      break;
    default:
      parts.push(`Capacity restored: ${event.reason}.`);
  }

  // Add context about capacity state if available
  if (event.currentCapacity !== undefined) {
    parts.push(`Current capacity utilization: ${Math.round(event.currentCapacity * 100)}%.`);
  }

  // Add info about tasks being resumed
  if (totalTasks > 0) {
    parts.push(`${totalTasks} paused task(s) eligible for resumption.`);
  }

  return parts.join(' ');
}
```

### 4. Updated handleCapacityRestored Method

Modify the `handleCapacityRestored` method to:
1. Collect task and session data for each resumed task
2. Emit `task:session-resumed` for each individual task
3. Generate and include `contextSummary` in `TasksAutoResumedEvent`

```typescript
private async handleCapacityRestored(event: CapacityRestoredEvent): Promise<void> {
  if (this.isShuttingDown || !this.store || !this.orchestrator) {
    return;
  }

  try {
    this.log('info', `Capacity restored: ${event.reason}`, {
      taskId: undefined,
    });

    let totalResumedCount = 0;
    const errors: Array<{taskId: string; error: string}> = [];

    // Track resumed tasks with their session data for context summary
    const resumedTasksWithContext: Array<{
      task: Task;
      sessionData?: TaskSessionData;
    }> = [];

    // Phase 1: Resume highest priority parent tasks first
    const pausedParentTasks = await this.store.findHighestPriorityParentTask();

    if (pausedParentTasks.length > 0) {
      this.log('info', `Found ${pausedParentTasks.length} paused parent task(s) for resume`);

      for (const parentTask of pausedParentTasks) {
        try {
          // Get session data before resuming
          const sessionData = parentTask.sessionData;

          const resumed = await this.orchestrator.resumePausedTask(parentTask.id);
          if (resumed) {
            totalResumedCount++;
            resumedTasksWithContext.push({ task: parentTask, sessionData });
            this.log('info', `Auto-resumed parent task ${parentTask.id}`, { taskId: parentTask.id });

            // Emit task:session-resumed event for this individual task
            this.emitTaskSessionResumed(parentTask, sessionData, 'auto_resume');

            // Parent resumed - also check and resume its subtasks if needed
            await this.resumeParentSubtasksIfNeeded(parentTask.id);
          } else {
            this.log('warn', `Failed to resume parent task ${parentTask.id}: Task not in resumable state`, { taskId: parentTask.id });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ taskId: parentTask.id, error: errorMessage });
          this.log('error', `Error resuming parent task ${parentTask.id}: ${errorMessage}`, { taskId: parentTask.id });
        }
      }
    }

    // Phase 2: Resume remaining paused tasks (non-parent) by priority
    const allPausedTasks = await this.store.getPausedTasksForResume();
    const resumedParentIds = new Set(pausedParentTasks.map(p => p.id));

    // Filter out already-resumed parent tasks
    const remainingTasks = allPausedTasks.filter(task => !resumedParentIds.has(task.id));

    if (remainingTasks.length > 0) {
      this.log('info', `Found ${remainingTasks.length} remaining paused task(s) for resume`);

      for (const task of remainingTasks) {
        try {
          // Get session data before resuming
          const sessionData = task.sessionData;

          const resumed = await this.orchestrator.resumePausedTask(task.id);
          if (resumed) {
            totalResumedCount++;
            resumedTasksWithContext.push({ task, sessionData });
            this.log('info', `Auto-resumed task ${task.id}`, { taskId: task.id });

            // Emit task:session-resumed event for this individual task
            this.emitTaskSessionResumed(task, sessionData, 'auto_resume');
          } else {
            this.log('warn', `Failed to resume task ${task.id}: Task not in resumable state`, { taskId: task.id });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ taskId: task.id, error: errorMessage });
          this.log('error', `Error resuming task ${task.id}: ${errorMessage}`, { taskId: task.id });
        }
      }
    }

    // Generate enhanced event data
    const totalTasks = allPausedTasks.length;
    const resumeReason = this.generateDetailedResumeReason(event, totalTasks);
    const contextSummary = this.generateAggregatedContextSummary(
      resumedTasksWithContext,
      errors,
      event.reason
    );

    // Emit auto-resumed event with enhanced summary
    if (this.orchestrator) {
      this.orchestrator.emit('tasks:auto-resumed', {
        reason: event.reason,
        totalTasks,
        resumedCount: totalResumedCount,
        errors,
        timestamp: new Date(),
        // v0.4.0 enhanced fields
        resumeReason,
        contextSummary,
      });
    }

    this.log('info', `Auto-resume completed: ${totalResumedCount}/${totalTasks} tasks resumed`);

    if (errors.length > 0) {
      this.log('warn', `${errors.length} tasks failed to resume during auto-resume`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.log('error', `Auto-resume process failed: ${errorMessage}`);
  }
}
```

### 5. Helper Method: emitTaskSessionResumed

Add a helper method to emit individual task session resumed events:

```typescript
/**
 * Emit a task:session-resumed event for an individual task.
 * Generates contextSummary from session data if not already present.
 *
 * @param task - The task that was resumed
 * @param sessionData - The task's session data (may be undefined)
 * @param resumeReason - The reason for resuming
 */
private emitTaskSessionResumed(
  task: Task,
  sessionData: TaskSessionData | undefined,
  resumeReason: 'auto_resume' | 'manual_resume' | 'checkpoint_restore'
): void {
  if (!this.orchestrator) return;

  // Generate context summary from conversation history if not in session data
  let contextSummary: string;
  if (sessionData?.contextSummary) {
    contextSummary = sessionData.contextSummary;
  } else if (sessionData?.conversationHistory && sessionData.conversationHistory.length > 0) {
    contextSummary = createContextSummary(sessionData.conversationHistory);
  } else {
    // Fallback: generate basic context from task description
    contextSummary = `Task "${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}" resumed from ${task.pauseReason || 'paused'} state. Previous stage: ${task.currentStage || 'unknown'}.`;
  }

  // Build session data with defaults if not present
  const effectiveSessionData: TaskSessionData = sessionData ?? {
    lastCheckpoint: task.pausedAt ?? new Date(),
    contextSummary,
  };

  const event: TaskSessionResumedEvent = {
    taskId: task.id,
    resumeReason,
    contextSummary,
    previousStatus: task.status,
    sessionData: effectiveSessionData,
    timestamp: new Date(),
  };

  this.orchestrator.emit('task:session-resumed', event);

  this.log('debug', `Emitted task:session-resumed for ${task.id}`, {
    taskId: task.id,
    metadata: {
      resumeReason,
      contextSummaryLength: contextSummary.length,
      hasSessionData: !!sessionData,
    },
  });
}
```

### 6. Update resumeParentSubtasksIfNeeded

Also update the subtask resume method to emit individual events:

```typescript
private async resumeParentSubtasksIfNeeded(parentTaskId: string): Promise<void> {
  if (!this.store || !this.orchestrator) {
    return;
  }

  try {
    const parentTask = await this.store.getTask(parentTaskId);
    if (!parentTask?.subtaskIds?.length) {
      this.log('debug', `Parent task ${parentTaskId} has no subtasks to resume`);
      return;
    }

    this.log('info', `Checking ${parentTask.subtaskIds.length} subtask(s) for auto-resume after parent task ${parentTaskId} resumed`);

    let subtasksResumedCount = 0;

    for (const subtaskId of parentTask.subtaskIds) {
      try {
        const subtask = await this.store.getTask(subtaskId);

        if (subtask?.status === 'paused' &&
            ['usage_limit', 'budget', 'capacity'].includes(subtask.pauseReason || '')) {

          // Check if subtask can be resumed (resumeAfter date check)
          if (subtask.resumeAfter && subtask.resumeAfter > new Date()) {
            this.log('debug', `Subtask ${subtaskId} has future resumeAfter date, skipping auto-resume`);
            continue;
          }

          // Get session data before resuming
          const sessionData = subtask.sessionData;

          const resumed = await this.orchestrator.resumePausedTask(subtaskId);
          if (resumed) {
            subtasksResumedCount++;
            this.log('info', `Auto-resumed subtask ${subtaskId} after parent resume`, { taskId: subtaskId });

            // Emit task:session-resumed event for this subtask
            this.emitTaskSessionResumed(subtask, sessionData, 'auto_resume');
          } else {
            this.log('warn', `Failed to resume subtask ${subtaskId}: Task not in resumable state`, { taskId: subtaskId });
          }
        } else {
          this.log('debug', `Subtask ${subtaskId} is not paused with resumable reason (status: ${subtask?.status}, reason: ${subtask?.pauseReason})`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.log('error', `Error resuming subtask ${subtaskId}: ${errorMessage}`, { taskId: subtaskId });
      }
    }

    if (subtasksResumedCount > 0) {
      this.log('info', `Resumed ${subtasksResumedCount} subtask(s) for parent task ${parentTaskId}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.log('error', `Error in resumeParentSubtasksIfNeeded for parent ${parentTaskId}: ${errorMessage}`);
  }
}
```

## Interface Dependencies

The following interfaces are already defined and will be used:

### From `@apexcli/core` (packages/core/src/types.ts):
- `Task` - The task entity with `sessionData?: TaskSessionData`
- `TaskSessionData` - Session recovery data containing:
  - `lastCheckpoint: Date`
  - `contextSummary?: string`
  - `conversationHistory?: AgentMessage[]`
  - `stageState?: Record<string, unknown>`
  - `resumePoint?: { stage: string; stepIndex: number; metadata?: Record<string, unknown> }`

### From `packages/orchestrator/src/index.ts`:
- `TasksAutoResumedEvent` - Enhanced with `resumeReason?: string` and `contextSummary?: string`
- `TaskSessionResumedEvent` - Contains `taskId`, `resumeReason`, `contextSummary`, `previousStatus`, `sessionData`, `timestamp`

### From `packages/orchestrator/src/context.ts`:
- `createContextSummary(messages: AgentMessage[]): string` - Generates context summary from conversation history

### From `packages/orchestrator/src/capacity-monitor.ts`:
- `CapacityRestoredEvent` - The input event containing `reason`, `previousMode`, `currentCapacity`

## Data Flow

```
CapacityMonitor emits 'capacity:restored'
           │
           ▼
DaemonRunner.handleCapacityRestored()
           │
           ├── 1. Find paused parent tasks
           │       └── For each: resume + emit task:session-resumed
           │
           ├── 2. Find remaining paused tasks
           │       └── For each: resume + emit task:session-resumed
           │
           ├── 3. Generate aggregated contextSummary
           │       └── From all resumed tasks' session data
           │
           └── 4. Emit tasks:auto-resumed with enhanced fields
                   └── {reason, totalTasks, resumedCount, errors,
                       timestamp, resumeReason, contextSummary}
```

## Testing Strategy

### Unit Tests
1. Test `generateAggregatedContextSummary` with various task combinations
2. Test `generateDetailedResumeReason` for different event types
3. Test `emitTaskSessionResumed` with and without session data

### Integration Tests
1. Verify `task:session-resumed` is emitted for each resumed task
2. Verify `tasks:auto-resumed` contains populated `contextSummary`
3. Test with tasks that have rich session data
4. Test with tasks that have minimal/no session data
5. Test error scenarios and partial resume cases

## Implementation Notes

1. **Import Order**: Add imports at the top of `runner.ts` near existing imports
2. **Method Placement**: Add helper methods as private class methods
3. **Error Handling**: All context generation should be fail-safe (return empty/default on errors)
4. **Logging**: Debug-level logging for context generation, info for resume events
5. **Memory**: Limit context summary length to prevent memory bloat

## Files to Modify

1. `packages/orchestrator/src/runner.ts`:
   - Add imports
   - Add `generateAggregatedContextSummary` method
   - Add `generateDetailedResumeReason` method
   - Add `emitTaskSessionResumed` method
   - Update `handleCapacityRestored` method
   - Update `resumeParentSubtasksIfNeeded` method

## Estimated Implementation Effort

- **Complexity**: Low-Medium
- **Risk**: Low (additive changes, no breaking changes to existing behavior)
- **Lines of Code**: ~200 additions/modifications

## Conclusion

This design provides a clean implementation path for:
1. Generating meaningful `contextSummary` from task session data
2. Emitting `task:session-resumed` for individual task resumes
3. Aggregating context into the `TasksAutoResumedEvent`

The implementation follows existing patterns in the codebase and leverages the existing `createContextSummary` utility from `context.ts`.
