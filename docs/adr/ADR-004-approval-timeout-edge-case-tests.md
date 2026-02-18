# ADR-004: Approval Timeout Edge Case Tests

## Status
Accepted

## Context
The APEX orchestrator includes an ApprovalGateController that handles approval workflows with configurable timeouts. While existing tests cover basic timeout scenarios, edge cases need additional coverage to ensure robustness in production scenarios.

### Current Test Coverage
The existing test suites (`approval-gate-controller.test.ts` and `approval-gate-controller.edge-cases.test.ts`) cover:
- Auto-approve on timeout (`autoApproveOnTimeout: true`)
- Auto-deny on timeout (default behavior)
- Zero timeout (immediate timeout)
- Timeout clearing after manual resolution
- Concurrent timeout and manual approval race conditions

### Identified Gaps
The following edge cases lack comprehensive test coverage:
1. **Event emission ordering during timeout** - Verifying `approval:timeout` fires before `approval:resolved`
2. **State cleanup verification** - Explicit testing of `timeoutHandle` cleanup
3. **Database persistence during timeout** - State correctly persisted when timeout triggers
4. **Timeout with partial approvals** - Multi-approval gates timing out mid-way
5. **Multiple timeout event listeners** - Ensuring all listeners receive the event
6. **Timeout precision/boundary** - Testing at exact timeout boundaries
7. **Denial racing against timeout** - When user denies just as timeout fires
8. **Store update failure during timeout** - Error handling when DB fails during timeout resolution

## Decision
Add a new test file `approval-gate-controller.timeout-edge-cases.test.ts` containing comprehensive edge case tests for approval timeout handling. This keeps timeout-specific edge cases separate and well-organized.

### Test Structure

```
approval-gate-controller.timeout-edge-cases.test.ts
├── Event Emission During Timeout
│   ├── should emit approval:timeout before approval:resolved
│   ├── should include complete state in timeout event
│   ├── should notify all registered timeout listeners
│   └── should forward timeout event to parent emitter
│
├── State Cleanup Verification
│   ├── should clear timeout handle after timeout fires
│   ├── should clear timeout handle when manually resolved before timeout
│   ├── should cleanup properly when disposed during pending timeout
│   └── should not leave orphaned timers on rapid create/dispose cycles
│
├── Database Persistence During Timeout
│   ├── should persist state with respondedAt timestamp on timeout
│   ├── should persist 'system' as approver on timeout
│   ├── should persist correct status based on autoApproveOnTimeout config
│   └── should handle store update failure gracefully during timeout
│
├── Timeout with Partial Approvals
│   ├── should timeout even with partial approvals received
│   ├── should preserve approvalsReceived count on timeout
│   └── should emit timeout event with partial approval context
│
├── Timeout Boundary Conditions
│   ├── should handle very small fractional timeouts
│   ├── should handle timeout at exact millisecond boundary
│   └── should handle timeout immediately after approval requested
│
├── Denial Racing Against Timeout
│   ├── should handle denial just before timeout fires
│   ├── should not emit double events on close race
│   └── should preserve first resolution in race condition
│
└── Error Scenarios
    ├── should handle event listener errors during timeout
    ├── should complete timeout resolution despite listener errors
    └── should maintain consistent state on error during timeout
```

### Implementation Details

#### Event Emission Tests
```typescript
it('should emit approval:timeout before approval:resolved', async () => {
  vi.useFakeTimers();
  const events: string[] = [];

  controller.on('approval:timeout', () => events.push('timeout'));
  controller.on('approval:resolved', () => events.push('resolved'));

  const promise = controller.requestApproval();
  vi.advanceTimersByTime(timeout * 60 * 1000);
  await promise;

  expect(events).toEqual(['timeout', 'resolved']);
  vi.useRealTimers();
});
```

#### State Cleanup Tests
```typescript
it('should clear timeout handle after timeout fires', async () => {
  vi.useFakeTimers();
  const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

  const promise = controller.requestApproval();
  vi.advanceTimersByTime(timeout * 60 * 1000);
  await promise;

  expect(clearTimeoutSpy).toHaveBeenCalled();
  vi.useRealTimers();
});
```

#### Partial Approvals Timeout Tests
```typescript
it('should timeout even with partial approvals received', async () => {
  vi.useFakeTimers();
  const config = createTestGateConfig({
    timeout: 1,
    minApprovals: 3,
    autoApproveOnTimeout: false
  });

  const promise = controller.requestApproval();
  await controller.grant('user1', 'First approval');
  // Only 1 of 3 approvals received

  vi.advanceTimersByTime(1 * 60 * 1000);
  const result = await promise;

  expect(result.status).toBe('denied');
  expect(result.approvalsReceived).toBe(1);
  vi.useRealTimers();
});
```

## Technical Design

### File Location
```
packages/orchestrator/src/__tests__/approval-gate-controller.timeout-edge-cases.test.ts
```

### Dependencies
- vitest (test framework with fake timers)
- eventemitter3 (event handling)
- TaskStore (persistence layer)
- ApprovalGateController (system under test)

### Test Patterns
1. **Fake Timers** - Use `vi.useFakeTimers()` for deterministic timeout testing
2. **Event Ordering** - Track event order using array accumulation
3. **Spy Patterns** - Use `vi.spyOn()` for cleanup verification
4. **Promise Resolution** - Properly handle async operations with fake timers

### Key Implementation Considerations

1. **Fake Timer Cleanup**: Always restore real timers in `afterEach` to prevent test pollution
2. **Promise Handling with Fake Timers**: Use `vi.advanceTimersByTime()` after creating promises
3. **Event Listener Cleanup**: Call `controller.dispose()` in `afterEach`
4. **Database Cleanup**: Use temporary directories and remove after each test

## Consequences

### Positive
- Comprehensive coverage of timeout edge cases
- Clear documentation of expected timeout behavior
- Regression protection for timeout-related changes
- Improved confidence in production reliability

### Negative
- Additional test maintenance overhead
- Increased test suite runtime (mitigated by fake timers)

## Notes for Implementation

1. Create the test file with proper setup/teardown
2. Implement tests in order of complexity (basic → complex)
3. Verify all tests pass with `npm run test`
4. Ensure no regression in existing timeout tests
5. Consider adding tests to CI pipeline for continuous verification
