# ADR-060: Concurrent Task Execution Implementation Audit

## Status
**VERIFIED** - All acceptance criteria satisfied

## Date
2026-03-08

## Context
This audit verifies the concurrent task execution implementation in the APEX daemon runner against the specified acceptance criteria.

## Acceptance Criteria Verification

### 1. ✅ maxConcurrentTasks Config Exists

**Location**: `packages/orchestrator/src/runner.ts`

**Interface Definition** (lines 39-42):
```typescript
/**
 * Maximum number of tasks to run concurrently
 * If not provided, uses config.limits.maxConcurrentTasks
 */
maxConcurrentTasks?: number;
```

**Constructor Handling** (line 237):
```typescript
maxConcurrentTasks: options.maxConcurrentTasks ?? 0, // 0 = use config
```

**Config Fallback** (lines 300-302):
```typescript
if (this.options.maxConcurrentTasks === 0) {
  this.options.maxConcurrentTasks = effectiveConfig.limits.maxConcurrentTasks;
}
```

**Type Definition**: `packages/core/src/types.ts` (line 2197):
```typescript
maxConcurrentTasks: z.number().optional().default(3),
```

### 2. ✅ runningTasks Map Tracks Active Tasks

**Declaration** (line 208):
```typescript
private runningTasks: Map<string, Promise<void>> = new Map();
```

**Task Addition** (line 1109):
```typescript
this.runningTasks.set(taskId, taskPromise);
```

**Task Removal** (line 1104):
```typescript
.finally(() => {
  this.runningTasks.delete(taskId);
  // Clean up orphaned child processes after each task ends
  this.cleanupOrphanedProcesses();
});
```

**Metrics Exposure** (lines 558-559):
```typescript
activeTaskCount: this.runningTasks.size,
activeTaskIds: Array.from(this.runningTasks.keys()),
```

### 3. ✅ poll() Respects Concurrency Limits

**Implementation** (lines 995-1003):
```typescript
// Check available concurrent task slots using TOTAL in-progress task count
// (not just top-level runningTasks), so subtask trees are counted against the limit.
// This prevents memory exhaustion from having too many in-flight task trees.
const inProgressCount = this.store.countInProgressTasks(/* excludeParentsWithRunningChildren */ true);
const availableSlots = this.options.maxConcurrentTasks - inProgressCount;
if (availableSlots <= 0) {
  this.log('debug', `At capacity (${inProgressCount} in-progress tasks, limit ${this.options.maxConcurrentTasks})`);
  return;
}
```

**Global Semaphore Check** (lines 1005-1014):
```typescript
// Also check the orchestrator's global semaphore — if all Claude API slots
// are occupied plus waiters, there's no point starting more work.
if (this.orchestrator) {
  const activeSlots = this.orchestrator.getGlobalActiveTaskCount();
  const waiters = this.orchestrator.getGlobalWaiterCount();
  if (activeSlots + waiters >= this.options.maxConcurrentTasks) {
    this.log('debug', `Global semaphore saturated (${activeSlots} active + ${waiters} waiting, limit ${this.options.maxConcurrentTasks})`);
    return;
  }
}
```

**Duplicate Task Prevention** (lines 1032-1036):
```typescript
for (const task of candidates) {
  // Skip if already running
  if (this.runningTasks.has(task.id)) {
    continue;
  }
```

### 4. ✅ Daemon Can Run Multiple Tasks Simultaneously

**Asynchronous Task Execution** (lines 1070-1109):
```typescript
const taskPromise = this.orchestrator.executeTask(taskId)
  .then(() => {
    // Task completed successfully
    this.tasksSucceeded++;
    // ... tracking code
  })
  .catch((error: Error) => {
    // Task failed
    this.tasksFailed++;
    // ... error tracking
  })
  .finally(() => {
    this.runningTasks.delete(taskId);
    this.cleanupOrphanedProcesses();
  });

this.runningTasks.set(taskId, taskPromise);
```

**Key Design Decision**: The implementation uses a **fire-and-forget** pattern where:
1. Tasks are started asynchronously without `await`
2. Multiple tasks can execute concurrently up to `maxConcurrentTasks`
3. Each task is tracked via the `runningTasks` Map
4. Task completion is handled via Promise chains

**Graceful Shutdown** (lines 489-507):
```typescript
if (this.runningTasks.size > 0) {
  this.log('info', `Waiting for ${this.runningTasks.size} task(s) to complete...`);

  const gracePeriod = 30000; // 30 seconds
  const timeout = new Promise<'timeout'>(resolve =>
    setTimeout(() => resolve('timeout'), gracePeriod)
  );

  const result = await Promise.race([
    Promise.allSettled(this.runningTasks.values()).then(() => 'completed' as const),
    timeout,
  ]);
  // ...
}
```

## Architectural Notes

### Subtask-Aware Capacity Management
The implementation uses `store.countInProgressTasks()` instead of `runningTasks.size` for capacity calculations. This ensures subtask trees spawned by parent tasks are counted against the concurrency limit, preventing memory exhaustion.

### Single-Task-Per-Poll Design
Instead of starting multiple tasks per poll cycle, the daemon starts **ONE** task per poll:
```typescript
// Start at most ONE new parent task per poll cycle.
// Each parent task can expand into a tree of subtasks internally, and
// those subtasks take time to register as in-progress in the DB.
// Starting multiple parents per poll creates a "stampede" where each
// parent launches subtask batches before the capacity check catches up.
this.startTask(task.id);
break;
```

This prevents "stampede" effects where multiple parent tasks spawn subtask trees before capacity checks catch up.

## Test Coverage

The following test files verify the implementation:
- `runner.concurrent-audit.test.ts` - 25 passing tests
- `runner.concurrent-basic.test.ts` - 30 passing tests
- `runner.concurrent-validation.test.ts` - 21 passing tests

## Decision

The concurrent task execution implementation **SATISFIES ALL ACCEPTANCE CRITERIA**:

1. ✅ `maxConcurrentTasks` config exists in `DaemonRunnerOptions` with config fallback
2. ✅ `runningTasks` Map correctly tracks active tasks with add/remove operations
3. ✅ `poll()` method respects concurrency limits using DB-level in-progress count
4. ✅ Daemon can run multiple tasks simultaneously via Promise-based async execution

## Related Files

- `packages/orchestrator/src/runner.ts` - Main implementation
- `packages/core/src/types.ts` - LimitsConfigSchema with maxConcurrentTasks
- `packages/orchestrator/src/runner.concurrent-audit.test.ts` - Audit tests
- `packages/orchestrator/src/runner.concurrent-basic.test.ts` - Basic tests
- `packages/orchestrator/src/runner.concurrent-validation.test.ts` - Validation tests
