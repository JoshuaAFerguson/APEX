# ADR: State Tracking Persistence Integration Tests

## Status
Proposed

## Context

APEX has two persistence systems that track state:

1. **TaskStore (SQLite)** - `packages/orchestrator/src/store.ts`
   - Persists Task objects with `usage` field containing: `inputTokens`, `outputTokens`, `totalTokens`, `estimatedCost`
   - Stores task logs, artifacts, checkpoints, and dependencies
   - Uses ISO string serialization for Date objects

2. **SessionStore (JSON Files)** - `packages/cli/src/services/SessionStore.ts`
   - Persists Session objects with `state` field containing: `totalTokens`, `totalCost`, `tasksCreated`, `tasksCompleted`, `currentTaskId`, `lastGitBranch`
   - Stores messages with `toolCalls` containing timestamps
   - Uses JSON serialization with manual Date reconstruction

The task requires creating integration tests that verify these state tracking fields persist correctly across "restarts" (store re-instantiation) with specific acceptance criteria.

## Decision

### Test Architecture

We will create **two integration test files** that test real file system operations without mocking:

1. **`packages/orchestrator/src/__tests__/state-tracking.persistence.integration.test.ts`**
   - Tests TaskStore state tracking persistence for orchestrator-level concerns

2. **`packages/cli/src/services/__tests__/state-tracking.persistence.integration.test.ts`**
   - Tests SessionStore state tracking persistence for CLI/session-level concerns (extends existing tests)

### Test Design Patterns

Following established patterns from `SessionStore.persistence.integration.test.ts` and `store.test.ts`:

```typescript
// Pattern: NO MOCKING - Real file system operations
// Each test creates temp directory, performs operations, simulates restart, verifies persistence

describe('State Tracking Persistence', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-state-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should persist X across restart', async () => {
    // Create store instance 1
    const store1 = new XStore(tempDir);
    await store1.initialize();

    // Perform operations
    // ...

    // "Restart" - Create new instance (simulates process restart)
    const store2 = new XStore(tempDir);
    await store2.initialize();

    // Verify state persisted correctly
    // ...
  });
});
```

### Test Cases by Acceptance Criteria

#### AC1: Test totalTokens accumulation across messages persists correctly

**TaskStore Test (Orchestrator)**:
```typescript
it('should persist totalTokens accumulation across multiple task updates after restart', async () => {
  // Create task with initial tokens
  // Update tokens incrementally (simulating multiple agent interactions)
  // Restart store
  // Verify accumulated totalTokens matches expected value
});
```

**SessionStore Test (CLI)**:
```typescript
it('should persist totalTokens accumulation from multiple messages after restart', async () => {
  // Create session
  // Add multiple messages with token counts
  // Update state.totalTokens
  // Restart store
  // Verify state.totalTokens.input and state.totalTokens.output match
});
```

#### AC2: Test totalCost calculation persists and survives restarts

```typescript
it('should persist totalCost through multiple restart cycles', async () => {
  // CYCLE 1: Create with initial cost
  // CYCLE 2: Restart, add more cost, verify accumulated
  // CYCLE 3: Restart, verify final cost matches
  // Uses 3+ restart cycles to ensure robustness
});
```

#### AC3: Test message history with toolCalls persists with correct timestamps

```typescript
it('should preserve message history with toolCalls and correct timestamps after restart', async () => {
  // Create session with messages containing toolCalls
  // Each message and toolCall has explicit timestamp
  // Restart store
  // Verify:
  //   - Message timestamps are Date objects (not strings)
  //   - Message timestamps match original values (toISOString comparison)
  //   - ToolCall timestamps are Date objects
  //   - ToolCall timestamps match original values
  //   - Message order preserved
});
```

#### AC4: Test tasksCreated/tasksCompleted arrays persist

```typescript
it('should persist tasksCreated and tasksCompleted arrays after restart', async () => {
  // Create session
  // Update state with tasksCreated: ['task-1', 'task-2', 'task-3']
  // Update state with tasksCompleted: ['task-1']
  // Restart store
  // Verify arrays match exactly (order matters)
  // Add more tasks, restart again, verify cumulative arrays
});
```

#### AC5: Test currentTaskId and lastGitBranch state fields persist

```typescript
it('should persist currentTaskId state field after restart', async () => {
  // Create session
  // Set state.currentTaskId = 'active-task-123'
  // Restart store
  // Verify currentTaskId matches

  // Test null/undefined handling
  // Clear currentTaskId
  // Restart, verify undefined
});

it('should persist lastGitBranch state field after restart', async () => {
  // Create session
  // Set state.lastGitBranch = 'feature/apex-test-branch'
  // Restart store
  // Verify lastGitBranch matches

  // Test branch name with special characters
  // Set state.lastGitBranch = 'user/name@123/feat-branch'
  // Restart, verify matches
});
```

#### AC6: Verify Date objects are correctly serialized/deserialized

```typescript
it('should correctly serialize and deserialize all Date fields', async () => {
  // Create known timestamps
  const timestamps = {
    messageTime: new Date('2024-06-15T10:30:00.000Z'),
    toolCallTime: new Date('2024-06-15T10:30:05.500Z'),
    createdAt: new Date('2024-06-15T09:00:00.000Z'),
  };

  // Create session/task with these specific timestamps
  // Restart store

  // Verify each Date field:
  expect(restored.createdAt).toBeInstanceOf(Date);
  expect(restored.createdAt.toISOString()).toBe(timestamps.createdAt.toISOString());
  // ... for all Date fields
});
```

### File Structure

```
packages/
├── orchestrator/
│   └── src/
│       └── __tests__/
│           └── state-tracking.persistence.integration.test.ts  # NEW
├── cli/
│   └── src/
│       └── services/
│           └── __tests__/
│               ├── SessionStore.persistence.integration.test.ts  # EXISTS - extend
│               └── state-tracking.persistence.integration.test.ts  # NEW (alternative)
```

### Test Utilities

Create shared test helpers to reduce duplication:

```typescript
// Test data factories
interface TestStateData {
  totalTokens: { input: number; output: number };
  totalCost: number;
  tasksCreated: string[];
  tasksCompleted: string[];
  currentTaskId?: string;
  lastGitBranch?: string;
}

function createTestSessionState(overrides?: Partial<TestStateData>): SessionState;
function createTestTaskUsage(overrides?: Partial<TaskUsage>): TaskUsage;

// Verification helpers
function verifyDateSerialization(original: Date, restored: Date): void {
  expect(restored).toBeInstanceOf(Date);
  expect(restored.toISOString()).toBe(original.toISOString());
}

function verifyStateIntegrity(original: SessionState, restored: SessionState): void {
  expect(restored.totalTokens).toEqual(original.totalTokens);
  expect(restored.totalCost).toBe(original.totalCost);
  expect(restored.tasksCreated).toEqual(original.tasksCreated);
  expect(restored.tasksCompleted).toEqual(original.tasksCompleted);
  expect(restored.currentTaskId).toBe(original.currentTaskId);
  expect(restored.lastGitBranch).toBe(original.lastGitBranch);
}
```

### Edge Cases to Test

1. **Empty/null values**: `currentTaskId: undefined`, `lastGitBranch: undefined`
2. **Zero values**: `totalTokens: { input: 0, output: 0 }`, `totalCost: 0`
3. **Large values**: `totalTokens: { input: 1000000, output: 2000000 }`
4. **Precision**: `totalCost: 123.456789` (float precision)
5. **Empty arrays**: `tasksCreated: []`, `tasksCompleted: []`
6. **Large arrays**: `tasksCreated` with 100+ entries
7. **Special characters in strings**: `lastGitBranch: 'user/name@example.com/feature'`
8. **Timezone handling**: Dates with different UTC offsets

## Consequences

### Positive
- Tests validate actual persistence behavior, not mocked implementations
- Tests catch serialization/deserialization bugs (especially Date handling)
- Tests verify data survives process restarts (store re-instantiation)
- Follows established project patterns for integration tests
- Uses temp directories for isolation (no test pollution)

### Negative
- Integration tests are slower than unit tests (~10-15 seconds timeout per test)
- Requires real file system access (not suitable for sandboxed CI without permissions)
- More complex setup/teardown compared to mocked tests

### Neutral
- Tests complement existing unit tests with mocks (`SessionStore.test.ts`)
- May discover existing bugs in persistence implementation

## Implementation Notes

1. **Test Timeout**: Set appropriate timeouts (10-15 seconds) for file I/O operations
2. **Cleanup**: Use `afterEach` with `fs.rm(tempDir, { recursive: true, force: true })`
3. **Store Lifecycle**: Properly close/dispose stores before re-instantiating
4. **Assertions**: Use `toBeInstanceOf(Date)` for Date type verification
5. **Comparison**: Use `toISOString()` for Date value comparison (handles timezone normalization)

## Related Files

- `packages/orchestrator/src/store.ts` - TaskStore implementation
- `packages/orchestrator/src/store.test.ts` - Existing TaskStore unit tests
- `packages/cli/src/services/SessionStore.ts` - SessionStore implementation
- `packages/cli/src/services/__tests__/SessionStore.test.ts` - Existing mocked tests
- `packages/cli/src/services/__tests__/SessionStore.persistence.integration.test.ts` - Existing real FS tests
- `tests/integration/workflow.integration.test.ts` - Integration test patterns
