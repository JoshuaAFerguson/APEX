# ADR-052: Data Integrity Tests for Mid-Stream Permission Revocation

## Status
Proposed

## Context

APEX requires a comprehensive test suite that verifies no data corruption occurs during mid-stream permission revocation. This is critical for ensuring system reliability when permissions change during active task execution.

### Problem Statement

When a permission is revoked while a task is actively running:
1. The SQLite TaskStore must maintain data integrity
2. Task status must not be left in an inconsistent state
3. Concurrent operations (multiple tasks, parallel updates) must not cause race conditions
4. The system must be able to recover from interrupted states

### Current State Analysis

#### Existing Test Coverage
- `mid-stream-permission-revocation.test.ts` - Tests permission revocation detection and handling
- `permission-concurrent-modifications.test.ts` - Tests concurrent permission operations
- `store.state-persistence.integration.test.ts` - Tests TaskStore persistence across restarts
- `store.lifecycle.additional.test.ts` - Tests task lifecycle state transitions

#### Gaps Identified
1. **No tests for TaskStore integrity during interruption** - Existing tests don't simulate database operations being interrupted mid-write
2. **No explicit race condition tests for task status updates** - While permission concurrency is tested, task status update concurrency is not
3. **No recovery verification tests** - No tests verify recovery from partially-written states
4. **No cross-table consistency tests** - No tests verify related tables (logs, artifacts, checkpoints) remain consistent

### TaskStore Architecture Analysis

From `packages/orchestrator/src/store.ts`:

**Key Characteristics:**
- Uses better-sqlite3 with WAL journal mode for crash safety
- Foreign keys disabled for performance (self-managed relationships)
- Transactions used for multi-table operations (e.g., `purgeExpiredTrashedTasks`)
- Uses prepared statements for all queries
- Auto-initializes on construction

**Transaction Usage:**
```typescript
// Example: purgeExpiredTrashedTasks uses explicit transaction
this.db.exec('BEGIN TRANSACTION');
// ... multiple DELETE statements ...
this.db.exec('COMMIT');
// ROLLBACK on error
```

**Critical Update Operations:**
- `updateTask()` - Updates task fields atomically
- `updateTaskStatus()` - Delegates to updateTask with status-specific logic
- `replaceTodos()` - Uses `db.transaction()` wrapper for atomicity

## Decision

### 1. Test Architecture Overview

Create a new dedicated test file for data integrity tests:

```
packages/orchestrator/src/__tests__/
└── store.data-integrity.mid-stream-revocation.test.ts   # NEW
```

### 2. Test Categories and Scenarios

#### 2.1 SQLite TaskStore Integrity During Interruption (AC1)

| Test Scenario | Purpose | Simulation Technique |
|--------------|---------|---------------------|
| Task update interrupted | Verify partial writes don't corrupt DB | Mock db.prepare().run() to throw mid-update |
| Batch operation failure | Verify transaction rollback works | Force error in multi-statement transaction |
| WAL checkpoint during write | Verify WAL mode handles concurrent access | Parallel writes during checkpoint |
| Database close during write | Verify graceful handling | Close DB in separate thread during write |

#### 2.2 Task Status Consistency (AC2)

| Test Scenario | Purpose | Expected Behavior |
|--------------|---------|-------------------|
| Status update during permission revocation | Verify atomic status transition | Status either fully updates or remains unchanged |
| Multiple concurrent status updates | Verify last-write-wins semantics | Final status is deterministic |
| Status + usage update atomicity | Verify compound updates are atomic | Both or neither field updates |
| Invalid status transition detection | Verify state machine enforcement | Invalid transitions rejected |

#### 2.3 Concurrent Operation Race Conditions (AC3)

| Test Scenario | Purpose | Expected Behavior |
|--------------|---------|-------------------|
| Parallel task creation | Verify unique IDs and no duplicates | All tasks created with unique IDs |
| Concurrent updates to same task | Verify no lost updates | All updates applied (last wins) |
| Task deletion during update | Verify no orphaned data | Clean deletion or update retry |
| Log/artifact addition during task update | Verify cross-table consistency | Related data remains linked |

#### 2.4 Recovery from Interrupted State (AC4)

| Test Scenario | Purpose | Expected Behavior |
|--------------|---------|-------------------|
| Store restart after crash simulation | Verify state recovery | Task at last known-good state |
| Checkpoint restoration | Verify checkpoint validity | Can resume from checkpoint |
| Orphaned related data cleanup | Verify referential integrity | No orphaned logs/artifacts |
| WAL recovery simulation | Verify WAL replay works | Database consistent after recovery |

### 3. Technical Implementation

#### 3.1 Test Infrastructure

```typescript
// Helper types
interface InterruptionPoint {
  operation: 'updateTask' | 'createTask' | 'deleteTask' | 'transaction';
  afterStatements: number; // Throw after N statements
}

interface ConcurrencyScenario {
  operations: Array<{
    fn: () => Promise<void>;
    delay: number; // ms before execution
  }>;
  expectedOutcome: 'all-succeed' | 'some-fail' | 'deterministic-final-state';
}
```

#### 3.2 Core Test Implementation Pattern

```typescript
describe('TaskStore Data Integrity During Mid-Stream Permission Revocation', () => {
  let testDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-integrity-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store?.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('AC1: SQLite TaskStore maintains integrity during interruption', () => {
    it('should maintain database consistency when update is interrupted', async () => {
      // Create task in known state
      const task = createTestTask({ status: 'pending' });
      await store.createTask(task);

      // Simulate interrupted update by using transaction with error
      const originalExec = store['db'].exec.bind(store['db']);
      let callCount = 0;
      store['db'].exec = (sql: string) => {
        callCount++;
        if (sql.includes('UPDATE') && callCount > 1) {
          throw new Error('Simulated interruption');
        }
        return originalExec(sql);
      };

      // Attempt update that will fail mid-stream
      try {
        await store.updateTask(task.id, {
          status: 'in-progress',
          currentStage: 'testing',
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01 }
        });
      } catch (e) {
        // Expected
      }

      // Restore original exec
      store['db'].exec = originalExec;

      // Verify database is in consistent state (original or fully updated)
      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
      // Status should be either 'pending' (rollback) or 'in-progress' (completed)
      expect(['pending', 'in-progress']).toContain(retrieved?.status);
    });
  });
});
```

#### 3.3 Concurrency Testing Pattern

```typescript
describe('AC3: Concurrent operations don\'t cause race conditions', () => {
  it('should handle concurrent task updates without data loss', async () => {
    const task = createTestTask();
    await store.createTask(task);

    // Launch concurrent updates
    const updates = Array.from({ length: 10 }, (_, i) => ({
      status: i % 2 === 0 ? 'in-progress' : 'pending' as const,
      retryCount: i,
      usage: {
        inputTokens: i * 100,
        outputTokens: i * 50,
        totalTokens: i * 150,
        estimatedCost: i * 0.01
      }
    }));

    const results = await Promise.allSettled(
      updates.map(update => store.updateTask(task.id, update))
    );

    // All operations should complete (success or handled failure)
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);

    // Final state should be consistent (one of the updates)
    const final = await store.getTask(task.id);
    expect(final).not.toBeNull();
    expect(final!.usage.totalTokens).toBe(final!.usage.inputTokens + final!.usage.outputTokens);
  });

  it('should handle concurrent task creation without duplicate IDs', async () => {
    const createPromises = Array.from({ length: 20 }, (_, i) => {
      const task = createTestTask();
      task.id = `concurrent_task_${i}`;
      return store.createTask(task);
    });

    const results = await Promise.allSettled(createPromises);

    // All creations should succeed
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(20);

    // All tasks should exist and be unique
    const allTasks = await store.listTasks();
    const ids = new Set(allTasks.map(t => t.id));
    expect(ids.size).toBe(allTasks.length); // No duplicates
  });
});
```

#### 3.4 Recovery Testing Pattern

```typescript
describe('AC4: Recovery from interrupted state works correctly', () => {
  it('should recover task state after simulated crash and restart', async () => {
    // Create and update task
    const task = createTestTask();
    await store.createTask(task);
    await store.updateTask(task.id, {
      status: 'in-progress',
      currentStage: 'development'
    });

    // Get state before "crash"
    const beforeCrash = await store.getTask(task.id);

    // Close store (simulates process termination)
    store.close();

    // Reopen store (simulates restart)
    const store2 = new TaskStore(testDir);
    await store2.initialize();

    // Verify state persisted correctly
    const afterRestart = await store2.getTask(task.id);
    expect(afterRestart).not.toBeNull();
    expect(afterRestart?.status).toBe(beforeCrash?.status);
    expect(afterRestart?.currentStage).toBe(beforeCrash?.currentStage);

    store2.close();
  });

  it('should maintain cross-table consistency after restart', async () => {
    const task = createTestTask();
    await store.createTask(task);

    // Add related data
    await store.addLog(task.id, { level: 'info', message: 'Test log' });
    await store.addArtifact(task.id, {
      name: 'test-artifact',
      type: 'file',
      path: '/tmp/test'
    });

    // Get counts
    const logsBefore = await store.getTaskLogs(task.id);
    const artifactsBefore = await store.getTaskArtifacts(task.id);

    // Restart
    store.close();
    const store2 = new TaskStore(testDir);
    await store2.initialize();

    // Verify related data persisted
    const logsAfter = await store2.getTaskLogs(task.id);
    const artifactsAfter = await store2.getTaskArtifacts(task.id);

    expect(logsAfter.length).toBe(logsBefore.length);
    expect(artifactsAfter.length).toBe(artifactsBefore.length);

    store2.close();
  });
});
```

### 4. Integration with Permission Revocation

The tests should also verify the interaction between permission revocation and task state:

```typescript
describe('Permission revocation with task integrity', () => {
  it('should maintain task state when permission is revoked during update', async () => {
    const task = createTestTask({ status: 'in-progress' });
    await store.createTask(task);

    // Simulate permission check that returns false mid-update
    const updatePromise = store.updateTask(task.id, {
      status: 'running',
      currentStage: 'testing'
    });

    // Permission revocation happening concurrently (simulated)
    // This would typically be handled by PermissionManager

    await updatePromise;

    // Task should be in valid state regardless
    const final = await store.getTask(task.id);
    expect(final).not.toBeNull();
    expect(['in-progress', 'running']).toContain(final?.status);
  });
});
```

### 5. Test Utilities

Create reusable test helpers:

```typescript
// packages/orchestrator/src/__tests__/helpers/data-integrity-helpers.ts

export const createTestTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  description: 'Test task for data integrity',
  workflow: 'feature',
  autonomy: 'full',
  status: 'pending',
  priority: 'normal',
  effort: 'medium',
  projectPath: '/tmp/test',
  branchName: 'apex/test-branch',
  retryCount: 0,
  maxRetries: 3,
  resumeAttempts: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  usage: {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  },
  logs: [],
  artifacts: [],
  dependsOn: [],
  blockedBy: [],
  ...overrides,
});

export const simulateInterruption = (
  db: Database.Database,
  afterOperations: number
): () => void => {
  const original = db.prepare.bind(db);
  let opCount = 0;

  db.prepare = (sql: string) => {
    const stmt = original(sql);
    const originalRun = stmt.run.bind(stmt);
    stmt.run = (...args: any[]) => {
      opCount++;
      if (opCount > afterOperations) {
        throw new Error('Simulated interruption');
      }
      return originalRun(...args);
    };
    return stmt;
  };

  // Return cleanup function
  return () => {
    db.prepare = original;
  };
};

export const runConcurrently = async <T>(
  operations: Array<() => Promise<T>>,
  staggerMs = 0
): Promise<PromiseSettledResult<T>[]> => {
  const promises = operations.map((op, i) =>
    new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        op().then(resolve).catch(reject);
      }, i * staggerMs);
    })
  );
  return Promise.allSettled(promises);
};
```

## Consequences

### Positive
- Comprehensive test coverage for data integrity during mid-stream permission revocation
- Increased confidence in system reliability
- Clear documentation of expected behavior in edge cases
- Reusable test utilities for future integrity testing

### Negative
- Additional test maintenance burden
- Some tests may be flaky due to timing-dependent behavior
- Test execution time may increase due to concurrent operation tests

### Risks and Mitigations
| Risk | Mitigation |
|------|------------|
| Flaky tests | Use deterministic timing where possible; document expected variability |
| Test isolation | Each test creates isolated temp directory |
| Mock pollution | Restore all mocks in afterEach |

## Acceptance Criteria Mapping

| AC | Test Category | Primary Test File Location |
|----|--------------|---------------------------|
| 1. SQLite TaskStore maintains integrity during interruption | 2.1 | `store.data-integrity.mid-stream-revocation.test.ts` |
| 2. Task status is correctly updated (not left in inconsistent state) | 2.2 | Same file, "Task Status Consistency" describe block |
| 3. Concurrent operations don't cause race conditions | 2.3 | Same file, "Concurrent Operation Race Conditions" describe block |
| 4. Recovery from interrupted state works correctly | 2.4 | Same file, "Recovery from Interrupted State" describe block |

## References

- Existing test: `packages/orchestrator/src/__tests__/mid-stream-permission-revocation.test.ts`
- Existing test: `packages/orchestrator/src/__tests__/permission-concurrent-modifications.test.ts`
- TaskStore implementation: `packages/orchestrator/src/store.ts`
- better-sqlite3 transaction documentation
