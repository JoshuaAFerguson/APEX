# ADR-135: Browser Permission-Denied Graceful Handling Integration Tests

## Status

Proposed

## Related ADRs

- **ADR-052**: Permission Denial and Error Handling Test Architecture (parent architecture)
- **ADR-052-browser-permission-denied-error**: BrowserPermissionDeniedError class design
- **ADR-090**: Browser Automation Integration Test Infrastructure

## Context

This ADR extends ADR-052 with **browser-specific integration tests** for permission-denied scenarios. While ADR-052 covers general permission denial across the system, this ADR focuses specifically on browser automation with real Playwright/Puppeteer-like interactions.

The APEX browser automation system needs comprehensive integration tests to verify that permission-denied scenarios are handled gracefully. When a user denies permission for browser operations, the system must:

1. Handle the denial gracefully without crashes
2. Provide appropriate, user-friendly error messages
3. Perform proper cleanup of browser resources (pages, contexts, browsers)
4. Not leak resources when permissions are denied mid-operation
5. Emit appropriate events for monitoring and debugging
6. Support retry/recovery workflows

### Current State

The codebase already has:
- `BrowserPermissionDeniedError` class in `packages/core/src/tools/browser/browser-permission-denied-error.ts`
- `BrowserTool` with permission checking in both `packages/core/src/tools/browser/browser-tool.ts` and `packages/orchestrator/src/tools/browser-tool.ts`
- `ApexError` hierarchy with `BROWSER_PERMISSION_DENIED`, `BROWSER_RESOURCE_LEAK`, and `BROWSER_SESSION_INVALID` error codes
- Existing permission integration tests in `tests/integration/browser-tool-permission-integration.test.ts`
- Resource state tracking via `BrowserResourceState` interface
- Cleanup methods (`cleanup()`, `destroy()`, `cleanupAllSessions()`)

### Gap Analysis

Missing comprehensive tests for:
1. Permission denial at different lifecycle stages (pre-launch, during operation, mid-workflow)
2. Cleanup verification after permission denial
3. Error message quality and user-friendliness
4. Event emission on permission denial
5. Concurrent operation handling when one permission is denied
6. Recovery from denied state
7. Edge cases: timeout during cleanup, partial cleanup failures

## Decision

Implement a comprehensive integration test suite for permission-denied scenarios organized into the following test categories:

### Test File Structure

```
tests/integration/
├── browser-permission-denied-graceful.integration.test.ts  (NEW - primary focus)
├── browser-permission-denied-cleanup.integration.test.ts   (NEW - resource cleanup)
├── browser-permission-denied-messages.integration.test.ts  (NEW - error messages)
└── browser-permission-denied-recovery.integration.test.ts  (NEW - recovery scenarios)
```

### Primary Test Categories

#### 1. Graceful Denial Tests (`browser-permission-denied-graceful.integration.test.ts`)

```typescript
describe('Permission Denied - Graceful Handling', () => {
  describe('Pre-Operation Denial', () => {
    // Tests for denial before any browser resources are allocated
  });

  describe('Mid-Operation Denial', () => {
    // Tests for denial during active browser operations
  });

  describe('No Crash Scenarios', () => {
    // Verify system stability after permission denial
  });

  describe('Error Response Structure', () => {
    // Verify returned error objects have correct structure
  });
});
```

#### 2. Resource Cleanup Tests (`browser-permission-denied-cleanup.integration.test.ts`)

```typescript
describe('Permission Denied - Resource Cleanup', () => {
  describe('Browser Session Cleanup', () => {
    // Verify browser, context, page cleanup
  });

  describe('No Resource Leaks', () => {
    // Verify all resources are released
  });

  describe('Partial Cleanup Failures', () => {
    // Handle cases where cleanup partially fails
  });

  describe('Resource State Tracking', () => {
    // Verify BrowserResourceState is updated correctly
  });
});
```

#### 3. Error Message Tests (`browser-permission-denied-messages.integration.test.ts`)

```typescript
describe('Permission Denied - Error Messages', () => {
  describe('User-Friendly Messages', () => {
    // Verify getUserFriendlyMessage() quality
  });

  describe('Resolution Suggestions', () => {
    // Verify getResolutionSuggestions() are helpful
  });

  describe('Permission Type Specific Messages', () => {
    // Test messages for each permission type
  });

  describe('Sanitized Error Messages', () => {
    // Verify no internal paths/secrets are exposed
  });
});
```

#### 4. Recovery Tests (`browser-permission-denied-recovery.integration.test.ts`)

```typescript
describe('Permission Denied - Recovery Scenarios', () => {
  describe('Retry After Denial', () => {
    // Test granting permission after initial denial
  });

  describe('Fresh Session After Denial', () => {
    // Test creating new session after cleanup
  });

  describe('Event Handling', () => {
    // Verify permission:denied events are emitted
  });
});
```

### Key Test Scenarios

| Scenario | Expected Behavior | Verification Method |
|----------|------------------|---------------------|
| Deny before browser launch | No resources allocated, clean error | Check resourceState, no mocks called |
| Deny during navigation | Page closed, browser cleaned up | Verify cleanup() called, state reset |
| Deny during click operation | Operation aborted, resources released | Check operation result, verify cleanup |
| Deny JavaScript execution | Blocked with clear message | Verify error type and message |
| Deny form submission | Blocked with clear message | Verify error type and message |
| Deny screenshot | Operation rejected gracefully | Check permissionDenied flag |
| Concurrent denial | All affected operations handled | Promise.all with mixed results |
| Timeout during cleanup | Resource leak error thrown | Catch ApexError with BROWSER_RESOURCE_LEAK |
| Multiple denials in sequence | System remains stable | No memory growth, consistent behavior |

### Mock Strategy

```typescript
// Mock Permission Manager for controlled testing
const createMockPermissionManager = (denyList: string[] = []) => ({
  checkToolPermission: vi.fn(async (tool: string, options: { scope: string }) => {
    const shouldDeny = denyList.some(pattern => options.scope.includes(pattern));
    return {
      allowed: !shouldDeny,
      level: shouldDeny ? null : 'full',
      requiresConfirmation: false,
      denialReason: shouldDeny ? 'Permission denied by test policy' : undefined,
    };
  }),
  getToolConfig: vi.fn(async () => ({ enabled: true })),
});

// Mock Browser for resource tracking
const createTrackedMockBrowser = () => {
  const state = { closed: false, contexts: [], pages: [] };
  return {
    browser: { /* mock implementation */ },
    getState: () => state,
    verifyCleanup: () => {
      expect(state.closed).toBe(true);
      expect(state.contexts.every(c => c.closed)).toBe(true);
      expect(state.pages.every(p => p.closed)).toBe(true);
    },
  };
};
```

### Assertions to Verify

1. **No Crashes**
   - All tests complete without unhandled exceptions
   - Process remains stable after permission denial

2. **Error Messages**
   - Error messages are user-friendly
   - No internal paths exposed
   - Resolution suggestions are actionable

3. **Resource Cleanup**
   - `resourceState.browserActive === false` after cleanup
   - `resourceState.contextActive === false` after cleanup
   - `resourceState.pageActive === false` after cleanup
   - `resourceState.activeOperations === 0` after cleanup

4. **Event Emission**
   - `permission:denied` event emitted with correct payload
   - Event includes operation, target, and reason

5. **Response Structure**
   ```typescript
   interface ExpectedPermissionDeniedResponse {
     success: false;
     operation: BrowserOperation;
     error: string; // User-friendly message
     permissionDenied: true;
     metadata: {
       permissionDenied: true;
       deniedBy: string;
       timestamp: string;
       suggestions: string[];
     };
   }
   ```

## Technical Implementation

### File Locations
- Tests: `tests/integration/browser-permission-denied-*.integration.test.ts`
- Shared utilities: `tests/test-utils/permission-test-helpers.ts`

### Dependencies
- vitest for test framework
- eventemitter3 for event testing
- @apexcli/core types
- @apexcli/orchestrator BrowserTool

### Test Utilities to Create

```typescript
// tests/test-utils/permission-test-helpers.ts
export interface PermissionTestContext {
  browserTool: BrowserTool;
  permissionManager: MockPermissionManager;
  eventEmitter: EventEmitter;
  events: PermissionEvent[];
}

export function createPermissionTestContext(
  options?: { denyOperations?: string[] }
): PermissionTestContext;

export function assertCleanResourceState(
  browserTool: BrowserTool
): void;

export function assertPermissionDeniedResponse(
  result: BrowserResult,
  expectedOperation: BrowserOperation
): void;

export function collectPermissionEvents(
  emitter: EventEmitter,
  timeout?: number
): Promise<PermissionEvent[]>;
```

## Consequences

### Positive
- Comprehensive coverage of permission-denied scenarios
- Clear documentation of expected behavior
- Regression prevention for graceful degradation
- Improved confidence in production stability
- Better developer experience when debugging permission issues

### Negative
- Additional test maintenance overhead
- Test execution time increase (mitigated by parallel execution)
- Mock complexity for browser resources

### Neutral
- Test patterns established for future permission-related features

## Implementation Stages

For the development stage, implement tests in this order:

1. **Stage 1**: Create test utilities (`permission-test-helpers.ts`)
2. **Stage 2**: Implement graceful handling tests (primary focus)
3. **Stage 3**: Implement cleanup verification tests
4. **Stage 4**: Implement error message tests
5. **Stage 5**: Implement recovery scenario tests
6. **Stage 6**: Verify all tests pass with `npm run test`

## References

- Existing test: `tests/integration/browser-tool-permission-integration.test.ts`
- Error class: `packages/core/src/tools/browser/browser-permission-denied-error.ts`
- Browser tool: `packages/orchestrator/src/tools/browser-tool.ts`
- ApexError: `packages/core/src/apex-error.ts`
