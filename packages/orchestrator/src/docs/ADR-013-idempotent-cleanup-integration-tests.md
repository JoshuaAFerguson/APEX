# ADR-013: Idempotent Cleanup Integration Tests

## Status
Proposed

## Date
2024-12-26

## Context

The APEX workspace cleanup system needs comprehensive integration tests to verify idempotent behavior. Idempotency is critical for:

1. **Multiple cleanup calls safety** - The same cleanup can be triggered from multiple sources (task completion, cancellation, manual cleanup)
2. **Already-cleaned workspace handling** - Re-running cleanup on an already-cleaned workspace must not error
3. **Concurrent cleanup requests** - Multiple concurrent cleanup attempts must not cause race conditions or errors

### Current Cleanup Architecture

The cleanup system has several layers of built-in idempotency:

1. **WorkspaceManager.cleanupWorkspace()** (`workspace-manager.ts` lines 220-258):
   ```typescript
   async cleanupWorkspace(taskId: string): Promise<void> {
     const workspace = this.activeWorkspaces.get(taskId);
     if (!workspace) {
       return;  // Early return if workspace not found - IDEMPOTENT
     }
     // ... cleanup logic
     workspace.status = 'cleaned';
     this.activeWorkspaces.delete(taskId);  // Remove from tracking
   }
   ```

2. **Container cleanup** (`cleanupContainer()` lines 511-530):
   - Searches for container by name before removal
   - Only removes if container exists
   - Uses `force: true` flag on directory removal

3. **Directory cleanup** (`cleanupDirectory()` lines 555-561):
   - Uses `fs.rm(path, { recursive: true, force: true })`
   - The `force: true` flag makes it idempotent

4. **Worktree cleanup** (`cleanupWorktree()` lines 411-419):
   - Uses `git worktree remove --force`
   - Falls back to `fs.rm()` on error

### Current Cleanup Triggers

1. **Task completion** - via `task:completed` event
2. **Task failure** - via `task:failed` event (respects preserveOnFailure)
3. **Task cancellation** - via `cancelTask()` method
4. **Manual cleanup** - via `cleanupOldWorkspaces()`

### Gap Analysis

While the implementation appears idempotent by design, there are no explicit integration tests that verify:

1. Calling `cleanupWorkspace(taskId)` multiple times in succession
2. Calling cleanup on an already-cleaned workspace after it's been removed from tracking
3. Multiple concurrent cleanup calls happening simultaneously
4. Cleanup behavior when workspace is in various states (active, cleanup-pending, cleaned)

## Decision

Create a new integration test file `cleanup-idempotency.integration.test.ts` that comprehensively tests idempotent cleanup behavior.

### Test Architecture

```
packages/orchestrator/src/__tests__/
└── cleanup-idempotency.integration.test.ts
```

### Test Suites

#### 1. Multiple Sequential Cleanup Calls

Tests that verify calling cleanup multiple times sequentially is safe:

```typescript
describe('Multiple Sequential Cleanup Calls', () => {
  it('should handle multiple cleanup calls on the same task without error')
  it('should only perform actual cleanup on first call')
  it('should emit workspace-cleaned event only once')
  it('should handle interleaved cleanup calls on different tasks')
})
```

#### 2. Already-Cleaned Workspace Handling

Tests for cleanup of workspaces that have already been cleaned:

```typescript
describe('Already-Cleaned Workspace Idempotency', () => {
  it('should return silently when cleaning non-existent workspace')
  it('should handle cleanup after workspace was removed from tracking')
  it('should not throw when cleaning workspace with status=cleaned')
  it('should handle mixed state cleanup scenarios')
})
```

#### 3. Concurrent Cleanup Requests

Tests for race condition safety:

```typescript
describe('Concurrent Cleanup Requests', () => {
  it('should handle multiple simultaneous cleanup calls safely')
  it('should handle concurrent cleanup from different sources (event + direct call)')
  it('should not double-remove containers during concurrent cleanup')
  it('should handle high-concurrency cleanup scenarios')
})
```

#### 4. Strategy-Specific Idempotency

Tests for each workspace strategy:

```typescript
describe('Strategy-Specific Idempotency', () => {
  describe('Container Strategy', () => {
    it('should handle cleanup when container already removed')
    it('should handle cleanup when container was never created')
  })

  describe('Worktree Strategy', () => {
    it('should handle cleanup when worktree already removed')
    it('should handle cleanup when worktree directory missing')
  })

  describe('Directory Strategy', () => {
    it('should handle cleanup when directory already removed')
  })

  describe('None Strategy', () => {
    it('should handle cleanup gracefully for none strategy')
  })
})
```

### Mock Strategy

Following the existing patterns in the codebase:

```typescript
vi.mock('../store.js');
vi.mock('../workspace-manager.js');
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn()
}));
```

### Test Factory Pattern

Use factory functions for consistent test data:

```typescript
const createTestWorkspace = (options: {
  taskId?: string;
  strategy?: WorkspaceConfig['strategy'];
  status?: 'active' | 'cleanup-pending' | 'cleaned';
} = {}): WorkspaceInfo => ({
  taskId: options.taskId || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  config: {
    strategy: options.strategy || 'container',
    cleanup: true
  },
  workspacePath: `/tmp/apex-workspace-${options.taskId || 'test'}`,
  status: options.status || 'active',
  createdAt: new Date(),
  lastAccessed: new Date()
});
```

### Async Event Testing Pattern

Following the established pattern for testing async event handlers:

```typescript
// Emit event and wait for async handler
orchestrator.emit('task:completed', task);
await new Promise(resolve => setTimeout(resolve, 50));

// Verify expected behavior
expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith(task.id);
```

### Concurrency Testing Pattern

For concurrent cleanup tests:

```typescript
// Launch multiple concurrent cleanup calls
const cleanupPromises = [
  workspaceManager.cleanupWorkspace(taskId),
  workspaceManager.cleanupWorkspace(taskId),
  workspaceManager.cleanupWorkspace(taskId)
];

// All should resolve without error
await expect(Promise.all(cleanupPromises)).resolves.not.toThrow();
```

## Implementation Plan

### Phase 1: Test File Creation

1. Create `packages/orchestrator/src/__tests__/cleanup-idempotency.integration.test.ts`
2. Set up mock infrastructure following existing patterns
3. Implement factory functions for test data

### Phase 2: Sequential Cleanup Tests

1. Multiple cleanup calls on same task
2. Event emission verification
3. Mixed task cleanup scenarios

### Phase 3: Already-Cleaned Tests

1. Non-existent workspace handling
2. Post-cleanup calls
3. Status-based cleanup scenarios

### Phase 4: Concurrent Cleanup Tests

1. Simultaneous cleanup calls
2. Event + direct call concurrency
3. High-concurrency stress test

### Phase 5: Strategy-Specific Tests

1. Container cleanup idempotency
2. Worktree cleanup idempotency
3. Directory cleanup idempotency
4. None strategy handling

## Acceptance Criteria

1. **Multiple cleanup calls are safe**: Calling `cleanupWorkspace(taskId)` multiple times in succession completes without error
2. **Cleanup of already-cleaned workspace is idempotent**: Cleaning a workspace that was already cleaned returns silently without error
3. **Concurrent cleanup requests handled correctly**: Multiple simultaneous cleanup calls resolve safely without race conditions
4. **Full test suite passes**: `npm test` completes with all tests passing

## Test File Structure

```typescript
// packages/orchestrator/src/__tests__/cleanup-idempotency.integration.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceManager } from '../workspace-manager.js';
import { ApexOrchestrator } from '../index.js';
import { Task, WorkspaceConfig } from '@apexcli/core';

// Mock dependencies
vi.mock('../store.js');
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: vi.fn() }));

// Factory functions
const createTestTask = (options = {}) => { /* ... */ };
const createTestWorkspace = (options = {}) => { /* ... */ };

describe('Cleanup Idempotency Integration Tests', () => {
  // Test suites as described above
});
```

## Consequences

### Positive

1. **Verified idempotency**: Explicit tests confirm cleanup is safe to call multiple times
2. **Race condition detection**: Tests will catch any concurrent access issues
3. **Documentation through tests**: Tests document expected idempotent behavior
4. **Regression prevention**: Future changes won't accidentally break idempotency

### Negative

1. **Test execution time**: Concurrent tests with delays may slow down test suite
2. **Complexity**: Testing async/concurrent behavior requires careful setup

### Neutral

1. **Following existing patterns**: Uses established test patterns from codebase
2. **Mock-based testing**: Tests use mocks rather than real resources

## Files to Create/Modify

### New Files

1. `packages/orchestrator/src/__tests__/cleanup-idempotency.integration.test.ts`
   - All idempotency integration tests

### Related Existing Files (for reference patterns)

1. `packages/orchestrator/src/__tests__/container-cleanup-comprehensive.integration.test.ts`
   - Test patterns and mock setup
2. `packages/orchestrator/src/workspace-cleanup-integration.test.ts`
   - Event testing patterns
3. `packages/orchestrator/src/workspace-manager.ts`
   - Implementation under test

## Related ADRs

- ADR-011: Container Cleanup on Task Failure with preserveOnFailure Support
- ADR-012: Orphan Container Detection Integration Tests
