# ADR-005: Approval Timeout and Error Scenario Integration Tests

## Status
Proposed

## Context
Following ADR-004 which addressed timeout edge cases, additional integration tests are needed to cover error scenarios, invalid state transitions, orphaned approval requests, and concurrent approval attempts. The existing test suite provides comprehensive timeout coverage but gaps remain in error handling and edge case scenarios.

### Current Test Coverage Analysis
Existing test files reviewed:
- `approval-gate-controller.test.ts` - Basic functionality, state persistence, auto-approval
- `approval-gate-controller.edge-cases.test.ts` - Configuration edge cases, rapid operations, error handling
- `approval-gate-controller.integration.test.ts` - Store persistence, event forwarding, workflow scenarios
- `approval-gate-controller.timeout-edge-cases.test.ts` - Comprehensive timeout scenarios (ADR-004)
- `approval-gate-controller.performance.test.ts` - Performance and load testing

### Identified Gaps Requiring Additional Tests
Based on the acceptance criteria, the following gaps need coverage:

1. **Network/SDK Error Scenarios** - Not currently tested at the approval gate level
2. **Invalid State Transitions** - Partial coverage exists but needs expansion
3. **Orphaned Approval Requests** - Basic coverage exists but comprehensive scenarios needed
4. **Concurrent Approval Attempts** - Basic coverage exists but race conditions need more testing

## Decision
Create a new test file `approval-gate-controller.error-scenarios.test.ts` that provides comprehensive coverage of error scenarios, invalid state transitions, orphaned approvals, and concurrent operations.

### Test Structure

```
approval-gate-controller.error-scenarios.test.ts
├── Network/SDK Error Scenarios
│   ├── should handle database connection errors during approval save
│   ├── should handle database connection errors during state update
│   ├── should recover gracefully when store becomes available again
│   ├── should emit error event on persistent store failure
│   └── should maintain consistent state after recoverable error
│
├── Invalid State Transitions
│   ├── should reject grant after timeout has fired
│   ├── should reject deny after grant (double resolution)
│   ├── should reject grant after deny
│   ├── should reject approval request on disposed controller
│   ├── should reject multiple timeout firings (race prevention)
│   ├── should reject grant with invalid approver (empty string)
│   └── should maintain previous state on rejected transition
│
├── Orphaned Approval Requests
│   ├── should detect approval state without corresponding task
│   ├── should handle task deletion while approval is pending
│   ├── should provide mechanism to clean up orphaned approvals
│   ├── should query orphaned approvals by age threshold
│   ├── should handle getExpiredApprovals for cleanup scenarios
│   └── should not affect valid approvals during cleanup
│
├── Concurrent Approval Attempts
│   ├── should handle simultaneous grants from multiple users
│   ├── should handle concurrent grant and deny (first wins)
│   ├── should handle approval during timeout window
│   ├── should handle race between cancellation and resolution
│   ├── should handle parallel approval requests for same gate
│   ├── should serialize approval state updates correctly
│   └── should maintain data integrity under concurrent load
│
└── Error Recovery and Resilience
    ├── should recover from transient database failures
    ├── should maintain event emission despite store errors
    ├── should handle malformed approval state data
    ├── should validate approval state consistency on load
    └── should cleanup resources properly on error paths
```

## Technical Design

### File Location
```
packages/orchestrator/src/__tests__/approval-gate-controller.error-scenarios.test.ts
```

### Dependencies
- vitest (test framework with fake timers)
- eventemitter3 (event handling)
- TaskStore (persistence layer with approval methods)
- ApprovalGateController (system under test)

### Test Patterns

#### 1. Database Error Simulation
Use `vi.spyOn()` to mock store methods and simulate various failure modes:

```typescript
// Simulate transient database errors
vi.spyOn(store, 'saveApprovalState').mockRejectedValueOnce(new Error('SQLITE_BUSY'));
vi.spyOn(store, 'updateApprovalState').mockRejectedValueOnce(new Error('Connection lost'));

// Simulate recovery after failure
let callCount = 0;
vi.spyOn(store, 'saveApprovalState').mockImplementation(async (state) => {
  callCount++;
  if (callCount <= 2) {
    throw new Error('Transient error');
  }
  return originalSave(state);
});
```

#### 2. Invalid State Transition Testing
Verify proper error handling and state preservation:

```typescript
it('should reject grant after timeout has fired', async () => {
  vi.useFakeTimers();
  const controller = new ApprovalGateController(createTestOptions({
    timeout: 1,
    autoApproveOnTimeout: false,
  }));

  const promise = controller.requestApproval();
  vi.advanceTimersByTime(60 * 1000);
  await promise;

  // Attempt grant after timeout
  await expect(controller.grant('late-approver', 'Too late')).rejects.toThrow(
    'Cannot grant approval - gate is not pending'
  );

  // Verify state unchanged
  expect(controller.approvalState.approver).toBe('system');
  vi.useRealTimers();
});
```

#### 3. Orphaned Approval Testing
Test detection and cleanup of orphaned approvals:

```typescript
it('should handle task deletion while approval is pending', async () => {
  const task = createMockTask();
  await store.saveTask(task);

  const controller = new ApprovalGateController({
    config: createGateConfig(),
    taskId: task.id,
    stage: 'testing',
    agent: 'tester',
    store,
  });

  // Start approval
  const approvalPromise = controller.requestApproval();

  // Delete task while approval is pending
  await store.deleteTask(task.id);

  // Verify approval state still exists (orphaned)
  const orphanedState = await store.getApprovalStateById(controller.id);
  expect(orphanedState).toBeDefined();
  expect(orphanedState!.taskId).toBe(task.id);

  // Cleanup should find this orphaned approval
  const orphanedApprovals = await store.getApprovalStatesByTask(task.id);
  expect(orphanedApprovals).toHaveLength(1);

  // Cancel to resolve promise
  await controller.cancel();
  await expect(approvalPromise).rejects.toThrow('cancelled');
});
```

#### 4. Concurrent Operations Testing
Use Promise.allSettled and race conditions:

```typescript
it('should handle simultaneous grants from multiple users', async () => {
  const controller = new ApprovalGateController(createTestOptions({
    minApprovals: 1, // Only one needed
  }));

  const approvalPromise = controller.requestApproval();

  // Simulate concurrent grants
  const grantPromises = Promise.allSettled([
    controller.grant('user1', 'First grant'),
    controller.grant('user2', 'Second grant'),
    controller.grant('user3', 'Third grant'),
  ]);

  const results = await grantPromises;

  // Exactly one should succeed, others should fail
  const successes = results.filter(r => r.status === 'fulfilled');
  const failures = results.filter(r => r.status === 'rejected');

  expect(successes).toHaveLength(1);
  expect(failures).toHaveLength(2);

  // Verify final state is consistent
  const result = await approvalPromise;
  expect(result.status).toBe('approved');
  expect(result.approvalsReceived).toBe(1);
});
```

### Key Implementation Considerations

#### Error Event Handling
The ApprovalGateController uses eventemitter3 which doesn't throw on listener errors by default. Tests should verify:
- Events are still emitted despite errors
- State remains consistent after listener errors
- Resources are cleaned up on error paths

#### Store Method Dependencies
The following store methods are used by ApprovalGateController:
- `saveApprovalState()` - Initial state persistence
- `updateApprovalState()` - State updates on resolution
- `getApprovalStateById()` - State retrieval (used in tests)
- `getApprovalStatesByTask()` - Task-scoped queries
- `getApprovalStatesByGate()` - Gate-scoped queries
- `getExpiredApprovals()` - Cleanup queries

#### Fake Timer Integration
For timeout-related error tests, always:
1. Use `vi.useFakeTimers()` in test
2. Restore with `vi.useRealTimers()` in afterEach
3. Be careful with Promise resolution order when using fake timers

#### Concurrent Test Isolation
Each test should:
1. Create a unique temp directory
2. Use fresh TaskStore instance
3. Cleanup in afterEach
4. Not rely on shared state between tests

### Mock Utilities Available
From `packages/orchestrator/src/__tests__/mocks/`:
- `MockClaudeAgentSDK` - For SDK error simulation (if needed for orchestrator integration)
- `MockErrors` - Pre-built error types (networkTimeout, rateLimit, etc.)

Note: These mocks are primarily for orchestrator-level tests. Approval gate tests mainly use `vi.spyOn()` on TaskStore methods.

## Consequences

### Positive
- Comprehensive error scenario coverage
- Clear documentation of expected behavior under failure conditions
- Protection against regression in error handling
- Improved confidence in production reliability
- Validates concurrent operation handling

### Negative
- Additional test maintenance overhead
- Some tests may be flaky due to race condition simulation
- Increased test suite runtime (mitigated by fake timers)

## Implementation Notes

### Phase 1: Core Error Scenarios
1. Database error simulation tests
2. Invalid state transition tests
3. Basic concurrent operation tests

### Phase 2: Orphaned Approval Handling
1. Orphaned approval detection tests
2. Cleanup mechanism tests
3. Task lifecycle integration tests

### Phase 3: Advanced Concurrent Scenarios
1. Multi-user race condition tests
2. Timeout + manual resolution races
3. High concurrency stress tests

### Test File Template
```typescript
/**
 * Error scenario tests for ApprovalGateController
 *
 * Tests comprehensive error handling, invalid state transitions,
 * orphaned approval handling, and concurrent operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'eventemitter3';
import {
  ApprovalGateController,
  type ApprovalGateOptions,
} from '../approval-gate-controller';
import { TaskStore } from '../store';
import type { ApprovalGate as ApprovalGateConfig, Task } from '@apexcli/core';

describe('ApprovalGateController - Error Scenarios', () => {
  let testDir: string;
  let store: TaskStore;
  let parentEmitter: EventEmitter;

  // Helper functions for test setup
  const createTestGateConfig = (overrides?: Partial<ApprovalGateConfig>): ApprovalGateConfig => ({
    id: 'error-test-gate',
    type: 'stage-completion',
    name: 'Error Test Gate',
    description: 'Error scenario testing gate',
    required: true,
    timeout: undefined,
    autoApprove: false,
    autoApproveOnTimeout: false,
    minApprovals: 1,
    tags: ['error-test'],
    ...overrides,
  });

  const createTestOptions = (gateConfig?: Partial<ApprovalGateConfig>): ApprovalGateOptions => ({
    config: createTestGateConfig(gateConfig),
    taskId: 'error-test-task-123',
    stage: 'testing-errors',
    agent: 'error-tester',
    store,
    parentEmitter,
    context: { errorScenario: true },
  });

  const createMockTask = (id?: string): Task => ({
    id: id || 'error-test-task-123',
    description: 'Error test task',
    status: 'running',
    priority: 'normal',
    createdAt: new Date(),
    workflowName: 'error-test-workflow',
    agent: 'tester',
    stage: 'testing',
    context: {},
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-error-test-'));
    store = new TaskStore(path.join(testDir, 'error-test.db'));
    parentEmitter = new EventEmitter();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  // Test suites to be implemented...
});
```

## Verification Checklist
Before marking implementation complete:
- [ ] All new tests pass locally
- [ ] `npm run build` succeeds
- [ ] `npm run test` passes (all tests)
- [ ] No TypeScript errors
- [ ] Test coverage for all acceptance criteria items:
  - [ ] Approval timeout handling
  - [ ] Network/SDK errors during approval
  - [ ] Invalid state transitions are rejected
  - [ ] Orphaned approval requests are handled
  - [ ] Concurrent approval attempts are handled correctly

## References
- ADR-004: Approval Timeout Edge Case Tests
- `packages/orchestrator/src/approval-gate-controller.ts` - Implementation
- `packages/orchestrator/src/store.ts` - Approval state persistence methods
- `packages/orchestrator/src/__tests__/mocks/` - Mock utilities
