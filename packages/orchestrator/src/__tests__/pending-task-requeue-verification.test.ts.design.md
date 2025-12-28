# Technical Design: Pending Task Re-Queue Verification Tests

## ADR-011: Pending Task Re-Queue Verification Test Suite

### Status
Proposed

### Context
The APEX orchestrator daemon needs to handle pending tasks correctly after daemon restarts. While `queue-recovery-daemon-restart.integration.test.ts` provides comprehensive tests for recovery of pending, paused, and orphaned tasks, we need specific tests that verify:

1. **Pending tasks remain in queue after restart**: Tasks with `status: 'pending'` must persist and be retrievable after daemon shutdown/restart
2. **Tasks are picked up correctly by poll cycle after restart**: The `DaemonRunner.poll()` method must correctly fetch pending tasks via `TaskStore.getNextQueuedTask()` after restart
3. **Priority ordering is respected when re-queuing**: Urgent > High > Normal > Low ordering must be maintained after restart

### Decision

#### Test Architecture

The tests will follow the established patterns in `queue-recovery-daemon-restart.integration.test.ts`:

1. **Test Isolation**: Each test creates a unique temporary directory with its own SQLite database
2. **Daemon Restart Simulation**: Use `simulateDaemonRestart()` pattern - close existing `TaskStore` and `DaemonRunner`, create fresh instances
3. **Poll Cycle Verification**: Directly invoke `(daemonRunner as any).poll()` to test task pickup behavior

#### Test File Structure

```typescript
// pending-task-requeue-verification.test.ts
describe('Pending Task Re-Queue Verification', () => {
  // Test infrastructure (beforeEach/afterEach)

  describe('Pending tasks persist after restart', () => {
    // AC1: Pending tasks remain in queue after restart
  });

  describe('Poll cycle picks up pending tasks correctly', () => {
    // AC2: Tasks are picked up by poll cycle after restart
  });

  describe('Priority ordering respected on re-queue', () => {
    // AC3: Priority ordering is respected
  });
});
```

#### Detailed Test Cases

##### AC1: Pending Tasks Remain in Queue After Restart

```typescript
it('should preserve pending tasks in database after daemon restart', async () => {
  // Setup: Create multiple pending tasks
  const task1 = await createPendingTask('Task 1');
  const task2 = await createPendingTask('Task 2');
  const task3 = await createPendingTask('Task 3');

  // Verify tasks exist before restart
  const beforeRestart = await store.getTasksByStatus('pending');
  expect(beforeRestart).toHaveLength(3);

  // Simulate daemon restart (closes old store, creates new)
  const { newStore } = await simulateDaemonRestart();

  // Verify: All pending tasks still exist with same IDs
  const afterRestart = await newStore.getTasksByStatus('pending');
  expect(afterRestart).toHaveLength(3);
  expect(afterRestart.map(t => t.id).sort()).toEqual([task1, task2, task3].sort());

  // Cleanup
  newStore.close();
});

it('should preserve pending task metadata after restart', async () => {
  // Create task with specific metadata
  const taskId = await createPendingTask('Detailed task', 'high', 'large');
  await store.addLog(taskId, { level: 'info', message: 'Pre-restart log' });

  // Restart
  const { newStore } = await simulateDaemonRestart();

  // Verify all metadata preserved
  const task = await newStore.getTask(taskId);
  expect(task?.status).toBe('pending');
  expect(task?.priority).toBe('high');
  expect(task?.effort).toBe('large');
  expect(task?.description).toBe('Detailed task');

  newStore.close();
});

it('should maintain pending task dependencies after restart', async () => {
  // Create dependency chain
  const dep1 = await createCompletedTask('Dependency 1');
  const dep2 = await createPendingTask('Dependency 2');
  const dependentTask = await createPendingTask('Dependent task');
  await store.addDependency(dependentTask, dep1);
  await store.addDependency(dependentTask, dep2);

  // Restart
  const { newStore } = await simulateDaemonRestart();

  // Verify dependencies preserved
  const deps = await newStore.getTaskDependencies(dependentTask);
  expect(deps).toContain(dep1);
  expect(deps).toContain(dep2);

  newStore.close();
});
```

##### AC2: Tasks Picked Up Correctly by Poll Cycle

```typescript
it('should pick up pending tasks on first poll after restart', async () => {
  // Create pending task before restart
  const taskId = await createPendingTask('Poll pickup test');

  // Simulate restart with new DaemonRunner
  const { newStore, newRunner } = await simulateDaemonRestart();

  // Start daemon and trigger poll
  await newRunner.start();

  // Verify task was picked up (check metrics or task status)
  const metrics = newRunner.getMetrics();
  expect(metrics.pollCount).toBeGreaterThan(0);

  // Stop and cleanup
  await newRunner.stop();
  newStore.close();
});

it('should correctly use getNextQueuedTask after restart', async () => {
  // Create multiple pending tasks
  await createPendingTask('Task A');
  await createPendingTask('Task B');

  // Restart
  const { newStore } = await simulateDaemonRestart();

  // Verify getNextQueuedTask returns pending tasks
  const nextTask = await newStore.getNextQueuedTask();
  expect(nextTask).not.toBeNull();
  expect(nextTask?.status).toBe('pending');

  newStore.close();
});

it('should handle empty pending queue after restart gracefully', async () => {
  // Create no pending tasks (only completed/failed)
  await createCompletedTask('Completed');
  await createFailedTask('Failed');

  // Restart
  const { newStore, newRunner } = await simulateDaemonRestart();

  // Verify poll handles empty queue gracefully
  await newRunner.start();

  // Should be running without errors
  const metrics = newRunner.getMetrics();
  expect(metrics.isRunning).toBe(true);
  expect(metrics.tasksFailed).toBe(0);

  await newRunner.stop();
  newStore.close();
});

it('should respect dependencies when picking up tasks after restart', async () => {
  // Create blocked and unblocked pending tasks
  const blocker = await createInProgressTask('Blocker');
  const blockedTask = await createPendingTask('Blocked task');
  const unblockedTask = await createPendingTask('Unblocked task');

  await store.addDependency(blockedTask, blocker);

  // Restart
  const { newStore } = await simulateDaemonRestart();

  // getReadyTasks should only return unblocked task
  const readyTasks = await newStore.getReadyTasks();
  const readyIds = readyTasks.map(t => t.id);

  expect(readyIds).toContain(unblockedTask);
  expect(readyIds).not.toContain(blockedTask);

  newStore.close();
});
```

##### AC3: Priority Ordering Respected

```typescript
it('should maintain priority order after restart', async () => {
  // Create tasks in non-priority order
  const lowTask = await createPendingTask('Low task', 'low');
  const urgentTask = await createPendingTask('Urgent task', 'urgent');
  const normalTask = await createPendingTask('Normal task', 'normal');
  const highTask = await createPendingTask('High task', 'high');

  // Restart
  const { newStore } = await simulateDaemonRestart();

  // Verify priority ordering: urgent > high > normal > low
  const readyTasks = await newStore.getReadyTasks({ orderByPriority: true });
  expect(readyTasks[0].id).toBe(urgentTask);
  expect(readyTasks[1].id).toBe(highTask);
  expect(readyTasks[2].id).toBe(normalTask);
  expect(readyTasks[3].id).toBe(lowTask);

  newStore.close();
});

it('should pick up highest priority pending task first after restart', async () => {
  // Create multiple pending tasks with different priorities
  await createPendingTask('Normal task', 'normal');
  const urgentTask = await createPendingTask('Urgent task', 'urgent');
  await createPendingTask('Low task', 'low');

  // Restart
  const { newStore } = await simulateDaemonRestart();

  // getNextQueuedTask should return urgent task
  const nextTask = await newStore.getNextQueuedTask();
  expect(nextTask?.id).toBe(urgentTask);
  expect(nextTask?.priority).toBe('urgent');

  newStore.close();
});

it('should maintain priority order with same-priority tasks (FIFO)', async () => {
  // Create multiple tasks with same priority - should be FIFO
  const firstNormal = await createPendingTask('First normal');
  // Add small delay to ensure different timestamps
  await new Promise(resolve => setTimeout(resolve, 10));
  const secondNormal = await createPendingTask('Second normal');
  await new Promise(resolve => setTimeout(resolve, 10));
  const thirdNormal = await createPendingTask('Third normal');

  // Restart
  const { newStore } = await simulateDaemonRestart();

  // Same priority should be ordered by created_at (oldest first)
  const readyTasks = await newStore.getReadyTasks({ orderByPriority: true });
  const normalTasks = readyTasks.filter(t => t.priority === 'normal');

  expect(normalTasks[0].id).toBe(firstNormal);
  expect(normalTasks[1].id).toBe(secondNormal);
  expect(normalTasks[2].id).toBe(thirdNormal);

  newStore.close();
});

it('should respect effort as secondary sort after priority', async () => {
  // Create tasks with same priority but different effort
  const largeTask = await createPendingTask('Large effort', 'high', 'large');
  await new Promise(resolve => setTimeout(resolve, 10));
  const smallTask = await createPendingTask('Small effort', 'high', 'small');

  // Restart
  const { newStore } = await simulateDaemonRestart();

  // Same priority, smaller effort should come first
  const readyTasks = await newStore.getReadyTasks({ orderByPriority: true });
  const highTasks = readyTasks.filter(t => t.priority === 'high');

  // Based on TaskStore.getReadyTasks() implementation:
  // ORDER BY priority ASC, effort ASC (smaller effort first)
  expect(highTasks[0].id).toBe(smallTask);
  expect(highTasks[1].id).toBe(largeTask);

  newStore.close();
});
```

#### Key Implementation Details

1. **Database Persistence**: SQLite with WAL mode ensures durability across restarts
2. **Store Methods Used**:
   - `getTasksByStatus('pending')` - Get all pending tasks
   - `getNextQueuedTask()` - Priority-aware task fetching
   - `getReadyTasks({ orderByPriority: true })` - Get tasks ready to run with priority ordering
   - `getTaskDependencies()` - Verify dependency preservation

3. **Priority Ordering Logic** (from `store.ts`):
   ```sql
   ORDER BY CASE priority
     WHEN 'urgent' THEN 1
     WHEN 'high' THEN 2
     WHEN 'normal' THEN 3
     WHEN 'low' THEN 4
     ELSE 5
   END ASC, CASE effort
     WHEN 'xs' THEN 1
     WHEN 'small' THEN 2
     WHEN 'medium' THEN 3
     WHEN 'large' THEN 4
     WHEN 'xl' THEN 5
     ELSE 3
   END ASC, created_at ASC
   ```

4. **Restart Simulation Pattern**:
   ```typescript
   async function simulateDaemonRestart(): Promise<{ newStore: TaskStore; newRunner: DaemonRunner }> {
     // Close existing connections
     store.close();
     await daemonRunner.stop();

     // Create new instances
     const newStore = new TaskStore(testProjectPath);
     await newStore.initialize();

     const newRunner = new DaemonRunner({
       projectPath: testProjectPath,
       pollIntervalMs: 1000,
       logToStdout: false,
       config: testConfig
     });

     return { newStore, newRunner };
   }
   ```

### Consequences

**Positive:**
- Comprehensive test coverage for pending task re-queue behavior
- Tests use established patterns from existing test suites
- Clear verification of all acceptance criteria
- Tests are isolated and reproducible

**Negative:**
- Additional test execution time
- More tests to maintain

### Dependencies

- `vitest` for test framework
- `TaskStore` for database operations
- `DaemonRunner` for daemon lifecycle testing
- Existing test infrastructure from `queue-recovery-daemon-restart.integration.test.ts`

### File Location

`packages/orchestrator/src/__tests__/pending-task-requeue-verification.test.ts`

### Test Execution

```bash
npm run test --workspace=@apex/orchestrator -- pending-task-requeue-verification
```
