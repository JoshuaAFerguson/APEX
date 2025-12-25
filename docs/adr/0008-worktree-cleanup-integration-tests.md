# ADR-0008: Worktree Cleanup Automation Integration Tests

## Status

Proposed

## Context

The APEX platform requires integration tests for worktree cleanup automation across multiple scenarios:
1. Cleanup on task cancellation with delay
2. Cleanup on merge detection
3. Cleanup on task completion with delay
4. Manual cleanup via `/checkout --cleanup <taskId>`

Currently, there are existing unit tests in various files but no comprehensive integration test file that covers all cleanup scenarios in `worktree-integration.test.ts`.

## Decision

Design a comprehensive integration test architecture in `packages/orchestrator/src/worktree-integration.test.ts` that tests all worktree cleanup automation scenarios.

## Technical Design

### 1. Test File Location

The tests should be in: `packages/orchestrator/src/worktree-integration.test.ts`

The file already exists with basic worktree integration tests but needs to be extended to include the required cleanup scenarios.

### 2. Existing Implementation Analysis

#### Key Components

| Component | Location | Description |
|-----------|----------|-------------|
| `WorktreeManager` | `packages/orchestrator/src/worktree-manager.ts` | Handles git worktree CRUD operations |
| `ApexOrchestrator.cleanupWorktree()` | `packages/orchestrator/src/index.ts` (line 1843-1926) | Private method for cleanup on status change |
| `ApexOrchestrator.cleanupTaskWorktree()` | `packages/orchestrator/src/index.ts` (line 1747) | Public method for manual cleanup |
| `ApexOrchestrator.cleanupMergedWorktree()` | `packages/orchestrator/src/index.ts` (line 1764) | Cleanup after PR merge detection |
| `WorktreeConfig.cleanupDelayMs` | `packages/core/src/types.ts` (line 143) | Delay before cleanup in milliseconds |

#### Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `worktree:created` | `(taskId: string, worktreePath: string)` | Emitted when worktree is created |
| `worktree:cleaned` | `(taskId: string, worktreePath: string)` | Emitted when worktree is cleaned up |
| `worktree:merge-cleaned` | `(taskId: string, worktreePath: string, prUrl: string)` | Emitted when worktree is cleaned after merge |

#### Cleanup Triggers

1. **Task Completion (`status === 'completed'`)**: Triggers cleanup if `workspace.cleanup === true`
2. **Task Cancellation (`status === 'cancelled'`)**: Always triggers cleanup
3. **Task Failure (`status === 'failed'`)**: Triggers cleanup unless `preserveOnFailure === true`
4. **PR Merge Detection**: Via `cleanupMergedWorktree()` method
5. **Manual Cleanup**: Via `/checkout --cleanup <taskId>` command → `cleanupTaskWorktree()`

### 3. Required Test Scenarios

#### Scenario 1: Cleanup on Cancel with Delay

```typescript
describe('cleanup on task cancellation', () => {
  it('should cleanup worktree on task cancellation with configured delay', async () => {
    // Setup: Create task with cleanupDelayMs > 0
    // Action: Cancel the task via updateTaskStatus(taskId, 'cancelled')
    // Verify:
    //   - setTimeout is called with correct delay
    //   - After delay, worktree is deleted
    //   - 'worktree:cleaned' event emitted with (taskId, worktreePath)
  });

  it('should cleanup immediately when cleanupDelayMs is 0', async () => {
    // Setup: Create task with cleanupDelayMs = 0
    // Action: Cancel the task
    // Verify: Immediate cleanup without setTimeout
  });
});
```

#### Scenario 2: Cleanup on Merge Detection

```typescript
describe('cleanup on merge detection', () => {
  it('should cleanup worktree when PR is merged', async () => {
    // Setup: Create completed task with prUrl
    // Mock: gh pr view returns state: 'MERGED'
    // Action: Call cleanupMergedWorktree(taskId)
    // Verify:
    //   - checkPRMerged returns true
    //   - worktreeManager.deleteWorktree called
    //   - 'worktree:merge-cleaned' event emitted with (taskId, path, prUrl)
    //   - Appropriate logs created
  });

  it('should skip cleanup when PR is not merged', async () => {
    // Setup: Create completed task with prUrl
    // Mock: gh pr view returns state: 'OPEN'
    // Action: Call cleanupMergedWorktree(taskId)
    // Verify: No cleanup, appropriate log message
  });

  it('should handle gh CLI errors gracefully', async () => {
    // Test: gh CLI not available, auth errors, invalid PR URLs
  });
});
```

#### Scenario 3: Cleanup on Complete with Delay

```typescript
describe('cleanup on task completion with delay', () => {
  it('should schedule cleanup with configured delay on completion', async () => {
    // Setup: Task with cleanupDelayMs = 1000, cleanup = true
    // Action: Complete the task via updateTaskStatus(taskId, 'completed')
    // Verify:
    //   - Log message: "Scheduling worktree cleanup in 1000ms"
    //   - setTimeout called with 1000ms
    //   - After delay, worktree deleted
    //   - 'worktree:cleaned' event emitted
  });

  it('should not cleanup if cleanup is disabled in workspace config', async () => {
    // Setup: Task with workspace.cleanup = false
    // Action: Complete the task
    // Verify: No cleanup triggered
  });
});
```

#### Scenario 4: Manual Cleanup via Checkout Command

```typescript
describe('manual cleanup via /checkout --cleanup <taskId>', () => {
  it('should cleanup worktree for specific task', async () => {
    // Setup: Task with worktree
    // Action: Call cleanupTaskWorktree(taskId)
    // Verify:
    //   - worktreeManager.deleteWorktree called with taskId
    //   - Returns true on success
  });

  it('should throw error if worktree management is not enabled', async () => {
    // Setup: Orchestrator without worktree management
    // Action: Call cleanupTaskWorktree(taskId)
    // Verify: Error thrown: "Worktree management is not enabled"
  });

  it('should return false for non-existent task', async () => {
    // Action: Call cleanupTaskWorktree('non-existent-id')
    // Verify: Returns false
  });
});
```

### 4. Test Architecture

```
worktree-integration.test.ts
├── Setup (beforeEach)
│   ├── Create temp directory
│   ├── Initialize APEX project with git config
│   ├── Create ApexOrchestrator with worktree enabled
│   ├── Set up event spies for all worktree events
│   └── Mock child_process.exec for git commands
│
├── Teardown (afterEach)
│   ├── Clean up temp directory
│   └── Clear all mocks
│
├── describe('createTask with worktree integration')
│   └── [Existing tests - keep as-is]
│
├── describe('task completion cleanup')
│   └── [Existing tests - keep as-is]
│
├── describe('cleanup on cancel with delay') [NEW]
│   ├── should cleanup worktree on cancellation with delay
│   ├── should cleanup immediately when delay is 0
│   └── should emit worktree:cleaned event
│
├── describe('cleanup on merge detection') [NEW]
│   ├── should cleanup when PR is merged
│   ├── should skip cleanup when PR not merged
│   ├── should emit worktree:merge-cleaned event
│   └── should handle gh CLI errors gracefully
│
├── describe('cleanup on complete with delay') [NEW]
│   ├── should schedule cleanup with delay
│   ├── should log delay scheduling message
│   └── should not cleanup if disabled
│
├── describe('manual cleanup via checkout --cleanup') [NEW]
│   ├── should cleanup specific task worktree
│   ├── should throw if worktree not enabled
│   └── should return false for non-existent task
│
├── describe('worktree events')
│   └── [Existing tests - keep as-is]
│
└── describe('edge cases and error handling')
    └── [Existing tests - keep as-is]
```

### 5. Mock Strategy

```typescript
// Mock child_process for git/gh commands
let execMockBehavior: Record<string, { stdout?: string; error?: Error }> = {};

vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts, callback) => {
    // Check for custom behavior based on command pattern
    for (const [pattern, behavior] of Object.entries(execMockBehavior)) {
      if (cmd.includes(pattern)) {
        if (behavior.error) {
          callback(behavior.error);
        } else {
          callback(null, { stdout: behavior.stdout || '' });
        }
        return;
      }
    }
    // Default behaviors for common commands
    if (cmd.includes('git worktree add')) { callback(null, { stdout: '' }); }
    else if (cmd.includes('git worktree remove')) { callback(null, { stdout: '' }); }
    else if (cmd.includes('gh pr view')) {
      callback(null, { stdout: JSON.stringify({ state: 'MERGED' }) });
    }
    // ...
  }),
}));
```

### 6. Event Verification Pattern

```typescript
let eventsSpy: Record<string, any[]> = {};

beforeEach(() => {
  eventsSpy = {};
  const eventTypes = ['worktree:created', 'worktree:cleaned', 'worktree:merge-cleaned'];

  eventTypes.forEach(eventType => {
    eventsSpy[eventType] = [];
    orchestrator.on(eventType, (...args) => {
      eventsSpy[eventType].push(args);
    });
  });
});

// In tests:
expect(eventsSpy['worktree:cleaned']).toHaveLength(1);
expect(eventsSpy['worktree:cleaned'][0]).toEqual([taskId, expectedPath]);
```

### 7. Delay Testing Pattern

```typescript
it('should schedule cleanup with delay', async () => {
  const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

  // Create and complete task
  await orchestrator.updateTaskStatus(task.id, 'completed');

  // Verify setTimeout called with correct delay
  expect(setTimeoutSpy).toHaveBeenCalledWith(
    expect.any(Function),
    1000 // cleanupDelayMs value
  );

  setTimeoutSpy.mockRestore();
});
```

## Acceptance Criteria Verification

The following acceptance criteria must be verified by the tests:

| Criterion | Test Coverage |
|-----------|---------------|
| Cleanup on cancel with delay | `cleanup on cancel with delay` describe block |
| Cleanup on merge detection | `cleanup on merge detection` describe block |
| Cleanup on complete with delay | `cleanup on complete with delay` describe block |
| Manual cleanup via `/checkout --cleanup <taskId>` | `manual cleanup via checkout --cleanup` describe block |
| All tests pass | `npm run test` must pass |

## Implementation Notes

1. **Test Isolation**: Each test should create fresh orchestrator and task instances
2. **Mock Management**: Clear exec mocks between tests to avoid interference
3. **Async Handling**: Use proper async/await patterns for all asynchronous operations
4. **Event Cleanup**: Remove event listeners in afterEach to prevent memory leaks
5. **Timer Handling**: Use `vi.useFakeTimers()` when testing delay functionality

## Dependencies

- vitest (already installed)
- @apexcli/core (workspace dependency)
- @apexcli/orchestrator (test subject)

## Consequences

### Positive
- Comprehensive test coverage for worktree cleanup automation
- Clear documentation of expected behavior
- Regression protection for cleanup scenarios
- Integration validation across orchestrator components

### Negative
- Additional test maintenance burden
- Increased test execution time due to integration tests
- Mock complexity for git/gh CLI commands

## Related

- ADR-0006: Worktree Management Architecture
- ADR-0007: Merge Detection Implementation
- packages/orchestrator/src/worktree-manager.ts
- packages/orchestrator/src/index.ts (cleanupWorktree methods)
