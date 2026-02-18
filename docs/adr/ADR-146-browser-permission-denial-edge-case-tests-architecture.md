# ADR-146: Browser Permission Denial Edge Case Tests Architecture

## Status

Accepted

## Date

2026-02-12

## Context

The APEX browser automation system requires comprehensive test coverage for browser permission denial edge cases. The current test infrastructure covers basic permission denial scenarios, but lacks coverage for critical edge cases that can occur in production environments:

1. **Denial during mid-operation (partial execution)** - When permission is revoked while a browser operation is already in progress
2. **Denial with pending browser actions in queue** - When multiple operations are queued and permission denial affects the queue
3. **Denial followed by retry attempt** - When a denied operation is retried and proper handling is needed
4. **Concurrent permission denials** - When multiple operations receive permission denials simultaneously
5. **Session cleanup after denial** - Ensuring proper resource cleanup and session state management after permission denial

These scenarios are critical because:
- Browser resources (pages, contexts, browsers) must be properly cleaned up to prevent resource leaks
- Permission denial events must be emitted correctly for downstream consumers
- BrowserResult objects must be returned with correct metadata, not unhandled exceptions
- Session state must remain consistent across denial scenarios

## Decision

### Test File Location

Add edge case tests to the existing test file structure, creating a new dedicated test file:

```
packages/orchestrator/src/tools/__tests__/browser-tool-permission-denial-advanced-edge-cases.test.ts
```

This location is chosen because:
1. It follows the existing test organization pattern in `packages/orchestrator/src/tools/__tests__/`
2. The `browser-tool-permission-denial-*.test.ts` naming convention is already established
3. It colocates with the `browser-tool.ts` implementation under test

### Test Infrastructure

The tests will leverage the existing test utilities:

1. **`BrowserPermissionSimulator`** from `tests/test-utils/browser-permission-simulator.ts`
   - Provides permission request/response simulation
   - Supports custom rules and response delays
   - Enables network failure and timeout simulation

2. **Mock Browser Context** from `tests/test-utils/browser-automation-mocks.ts`
   - `MockBrowserContext` for simulating browser state
   - `MockedPage`, `MockedBrowserContext`, `MockedBrowser` interfaces
   - Navigation, screenshot, and evaluation mocking

3. **`BrowserPermissionDeniedError`** from `@apexcli/core`
   - `isBrowserPermissionDeniedError()` type guard
   - `BrowserPermissionDeniedContext` for error context
   - `BrowserResourceState` for tracking resource cleanup

4. **EventEmitter** from `eventemitter3`
   - For tracking `permission:denied` events
   - For verifying proper event emission timing and content

### Test Scenarios Architecture

#### 1. Denial During Mid-Operation (Partial Execution)

```typescript
describe('Denial During Mid-Operation', () => {
  it('should handle permission revocation during navigation in progress', async () => {
    // Setup: Grant permission, start navigation
    // Mid-operation: Revoke permission
    // Verify: Operation fails gracefully, resources cleaned up, event emitted
  });

  it('should handle permission revocation during multi-step operation', async () => {
    // Setup: Start evaluate operation with multiple statements
    // Mid-operation: Inject permission revocation
    // Verify: Partial results handled, cleanup performed
  });

  it('should not corrupt browser state when denial occurs mid-screenshot', async () => {
    // Setup: Start screenshot capture
    // Mid-operation: Permission revoked
    // Verify: No partial screenshots, state remains valid
  });
});
```

**Implementation Strategy:**
- Use mock implementations that allow intercepting execution mid-operation
- Mock `page.goto()` to accept a Promise that can be rejected mid-flight
- Verify `resourceState.activeOperations` is properly decremented
- Confirm no orphaned browser resources remain

#### 2. Denial with Pending Browser Actions in Queue

```typescript
describe('Denial with Pending Browser Actions', () => {
  it('should cancel pending operations when permission is denied', async () => {
    // Queue multiple operations
    // Deny permission after first operation starts
    // Verify: Queued operations fail, no resource leaks
  });

  it('should properly handle denial with mixed operation queue', async () => {
    // Queue: navigate, click, screenshot, evaluate
    // Deny permission after navigate completes
    // Verify: Only completed operation succeeds
  });

  it('should emit denial events for each affected queued operation', async () => {
    // Queue 5 operations
    // Deny permission
    // Verify: 5 permission:denied events with correct timestamps
  });
});
```

**Implementation Strategy:**
- Use `Promise.all()` to simulate concurrent operation submission
- Mock `checkToolPermission()` to change behavior after N calls
- Track event emission order and timing
- Verify resource cleanup doesn't deadlock on queued operations

#### 3. Denial Followed by Retry Attempt

```typescript
describe('Denial Followed by Retry', () => {
  it('should handle retry after denial with same session', async () => {
    // Operation denied
    // Same session attempts retry
    // Verify: Proper handling (immediate denial or session invalidation)
  });

  it('should handle retry after denial with new session', async () => {
    // Operation denied and session cleaned up
    // New session created, operation retried
    // Verify: Clean slate, proper initialization
  });

  it('should track retry count and emit appropriate events', async () => {
    // Multiple retry attempts
    // Verify: Each attempt properly tracked and evented
  });

  it('should not accumulate resources across retry attempts', async () => {
    // Multiple deny-retry cycles
    // Verify: No memory leaks, resource counts stay bounded
  });
});
```

**Implementation Strategy:**
- Track `sessionId` changes across attempts
- Verify `cleanup()` is called between retries
- Use memory monitoring for resource accumulation checks
- Test both `allow-once` and `allow-always` permission patterns

#### 4. Concurrent Permission Denials

```typescript
describe('Concurrent Permission Denials', () => {
  it('should handle simultaneous denials on different operations', async () => {
    // Start: navigate, click, screenshot in parallel
    // All denied simultaneously
    // Verify: Each operation fails independently
  });

  it('should not double-cleanup on concurrent denials', async () => {
    // Track cleanup call count
    // Trigger concurrent denials
    // Verify: Cleanup called exactly once
  });

  it('should emit events in consistent order for concurrent denials', async () => {
    // Concurrent operations denied
    // Verify: Events have logical ordering (by start time or operation order)
  });

  it('should handle race between denial and operation completion', async () => {
    // Start slow operation
    // Denial arrives just before completion
    // Verify: Either denial or success, not both
  });
});
```

**Implementation Strategy:**
- Use `Promise.allSettled()` for concurrent operation handling
- Implement mutex/lock detection for cleanup
- Use precise timestamp comparison for event ordering
- Test atomic state transitions

#### 5. Session Cleanup After Denial

```typescript
describe('Session Cleanup After Denial', () => {
  it('should cleanup all browser resources on permission denial', async () => {
    // Launch browser with page
    // Permission denied
    // Verify: browser, context, page all closed
  });

  it('should handle cleanup failure gracefully', async () => {
    // Mock page.close() to throw
    // Permission denied
    // Verify: Error logged, no crash, state reset
  });

  it('should transition to destroyed state after cleanup', async () => {
    // Permission denied
    // Verify: state === 'destroyed'
    // Verify: subsequent operations fail with appropriate error
  });

  it('should clear console and error buffers on cleanup', async () => {
    // Accumulate console messages and errors
    // Permission denied, cleanup occurs
    // Verify: Buffers cleared
  });

  it('should emit browser:state:transition events during cleanup', async () => {
    // Track state transition events
    // Permission denied
    // Verify: active -> cleaning_up -> destroyed sequence
  });
});
```

**Implementation Strategy:**
- Verify `getResourceState()` returns all-false after cleanup
- Test `destroy()` method for forceful cleanup
- Verify `consoleStream.stopStream()` called
- Test event emitter cleanup for state transitions

### Test Data and Fixtures

Create fixtures in `tests/test-utils/browser-permission-edge-case-fixtures.ts`:

```typescript
export const EDGE_CASE_OPERATIONS = {
  slowNavigation: { operation: 'navigate', params: { url: 'https://slow.example.com' } },
  complexEvaluate: { operation: 'evaluate', params: { script: 'await sleep(1000); return true;' } },
  multiStepForm: [
    { operation: 'click', params: { selector: '#field1' } },
    { operation: 'type', params: { selector: '#field1', text: 'test' } },
    { operation: 'submit', params: { selector: '#form' } },
  ],
};

export const DENIAL_SCENARIOS = {
  immediateRevocation: { delay: 0 },
  midOperationRevocation: { delay: 50 },
  postCompletionAttemptedDenial: { delay: 1000 },
};

export const CLEANUP_ERROR_SCENARIOS = {
  pageCloseFails: 'Page close failed: Connection closed',
  contextCloseFails: 'Context close failed: Browser crashed',
  browserCloseFails: 'Browser close failed: Process terminated',
};
```

### Expected Test Coverage

| Scenario | Test Count | BrowserTool Methods Covered |
|----------|------------|---------------------------|
| Mid-operation denial | 3 | `execute()`, `cleanup()`, `transitionState()` |
| Pending action queue | 3 | `execute()`, `checkPermissionInternal()`, event emission |
| Retry handling | 4 | `execute()`, `cleanup()`, `destroy()`, session management |
| Concurrent denials | 4 | `execute()`, atomic state, event emission |
| Session cleanup | 5 | `cleanup()`, `destroy()`, `getResourceState()`, buffer management |
| **Total** | **19** | |

### Acceptance Criteria Mapping

| Acceptance Criteria | Test Coverage |
|---------------------|---------------|
| Denial during mid-operation (partial execution) | 3 tests in "Mid-operation Denial" describe block |
| Denial with pending browser actions in queue | 3 tests in "Pending Browser Actions" describe block |
| Denial followed by retry attempt | 4 tests in "Retry Handling" describe block |
| Concurrent permission denials | 4 tests in "Concurrent Denials" describe block |
| Session cleanup after denial | 5 tests in "Session Cleanup" describe block |
| All tests pass with `npm test` | Verified via CI/CD pipeline |

## Consequences

### Positive

1. **Comprehensive edge case coverage** - All 5 acceptance criteria scenarios will have dedicated test coverage
2. **Regression prevention** - Future changes to permission handling will be caught by these tests
3. **Documentation value** - Tests serve as executable documentation for edge case behavior
4. **Improved reliability** - Testing concurrent and partial execution scenarios ensures production reliability

### Negative

1. **Test complexity** - Edge case tests require more sophisticated mocking and timing control
2. **Execution time** - Some tests may require timeouts/delays, increasing test suite duration
3. **Maintenance burden** - As `BrowserTool` evolves, edge case tests may need updates

### Mitigations

1. Use test utilities and fixtures to reduce boilerplate
2. Run edge case tests in parallel where possible
3. Document test dependencies clearly for maintainability

## Implementation Notes

### File Structure

```
packages/orchestrator/src/tools/__tests__/
├── browser-tool-permission-denial-advanced-edge-cases.test.ts  # NEW
├── browser-tool-permission-denial-edge-cases.test.ts           # Existing
├── browser-tool-permission-denial-integration.test.ts          # Existing
└── ...

tests/test-utils/
├── browser-permission-simulator.ts                             # Existing
├── browser-automation-mocks.ts                                 # Existing
├── browser-permission-edge-case-fixtures.ts                    # NEW (if needed)
└── ...
```

### Key Implementation Patterns

```typescript
// Pattern 1: Mock permission state change mid-operation
let callCount = 0;
vi.spyOn(permissionManager, 'checkToolPermission').mockImplementation(async () => {
  callCount++;
  if (callCount <= 2) {
    return { allowed: true, level: 'full' };
  }
  return { allowed: false, denialReason: 'Permission revoked mid-operation' };
});

// Pattern 2: Track event emission
const events: any[] = [];
eventEmitter.on('permission:denied', (e) => events.push({ ...e, receivedAt: Date.now() }));

// Pattern 3: Concurrent operation testing
const results = await Promise.allSettled([
  browserTool.execute({ operation: 'navigate', params: { url: 'https://a.com' } }),
  browserTool.execute({ operation: 'navigate', params: { url: 'https://b.com' } }),
  browserTool.execute({ operation: 'screenshot', params: {} }),
]);

// Pattern 4: Resource state verification
const state = browserTool.getResourceState();
expect(state.browserActive).toBe(false);
expect(state.pageActive).toBe(false);
expect(state.activeOperations).toBe(0);
```

## Related Documents

- `packages/orchestrator/src/tools/__tests__/browser-tool-permission-denial-edge-cases.test.ts` - Existing edge case tests
- `packages/orchestrator/src/tools/__tests__/browser-tool-permission-denial-integration.test.ts` - Integration tests
- `tests/test-utils/browser-permission-simulator.ts` - Permission simulation utilities
- `tests/test-utils/browser-automation-mocks.ts` - Browser mock utilities
- `packages/core/src/tools/browser/browser-permission-denied-error.ts` - Error class implementation
- `packages/orchestrator/src/tools/browser-tool.ts` - BrowserTool implementation
