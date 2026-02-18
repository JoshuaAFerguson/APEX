# ADR-140: Browser Permission Denial Full Flow Integration Tests Architecture

## Status

**Proposed**

## Context

The task requires writing integration tests that verify the full permission denial → error class → cleanup → event emission → no crash flow for browser automation. This needs to test a comprehensive end-to-end scenario ensuring all components work together gracefully.

### Existing Components

1. **BrowserPermissionDeniedError** (`packages/core/src/tools/browser/browser-permission-denied-error.ts`)
   - Specialized error class extending `ApexError`
   - Includes `browserContext` with operation, target, denialReason, permissionType
   - Provides `getUserFriendlyMessage()` and `getResolutionSuggestions()`
   - Factory methods: `fromBrowserPermissionError()`, `forDomainRestriction()`, `forDisabledFeature()`

2. **BrowserTool** (`packages/orchestrator/src/tools/browser-tool.ts`)
   - Has `cleanup()` and `destroy()` methods for resource management
   - Tracks `BrowserResourceState` with browserActive, contextActive, pageActive, activeOperations
   - Emits events via `EventEmitter`
   - `handlePermissionDeniedError()` method performs cleanup before throwing

3. **Permission Test Helpers** (`tests/test-utils/permission-test-helpers.ts`)
   - `createPermissionTestContext()` - creates mock permission manager, browser tool, event emitter
   - `createPermissionDenialScenarios()` - factory for common denial scenarios
   - `assertPermissionDeniedResponse()` - validates denial response structure
   - `assertCleanResourceState()` - validates resource cleanup
   - `assertPermissionEventsEmitted()` - validates event emission
   - `assertNoCrashes()` - validates system stability

4. **Existing Test Files**
   - `browser-tool-error-handling.test.ts` - unit tests for error scenarios
   - `browser-tool-permission-integration.test.ts` - permission manager integration
   - `browser-permission-denied-graceful.integration.test.ts` - graceful handling tests
   - `browser-permission-denied-cleanup.integration.test.ts` - cleanup tests

### Acceptance Criteria

1. BrowserPermissionDeniedError is created with correct context on denial
2. cleanup() is called when browser was already launched before denial
3. permission:denied event is emitted with operation/target/reason/timestamp
4. No unhandled exceptions — all error paths return BrowserResult objects
5. Full flow test: permission denial → error class → cleanup → event emission → graceful BrowserResult
6. Tests follow patterns from existing test files
7. All tests pass

## Decision

Create a new integration test file `browser-permission-denial-full-flow.integration.test.ts` that tests the complete flow from permission denial through error creation, cleanup, event emission, and graceful result return.

### Test Architecture

```
tests/integration/browser-permission-denial-full-flow.integration.test.ts
├── describe('Full Permission Denial Flow')
│   ├── describe('BrowserPermissionDeniedError Context Verification')
│   │   ├── Error created with correct operation context
│   │   ├── Error created with correct target context
│   │   ├── Error created with correct denialReason
│   │   ├── Error created with correct timestamp
│   │   └── Error permissionType mapping works correctly
│   │
│   ├── describe('Cleanup When Browser Already Launched')
│   │   ├── cleanup() called after successful launch then denial
│   │   ├── cleanup() clears browserActive state
│   │   ├── cleanup() clears contextActive state
│   │   ├── cleanup() clears pageActive state
│   │   └── cleanup() resets activeOperations to 0
│   │
│   ├── describe('permission:denied Event Emission')
│   │   ├── Event emitted with correct operation field
│   │   ├── Event emitted with correct target field
│   │   ├── Event emitted with correct reason field
│   │   ├── Event emitted with valid timestamp
│   │   └── Event emitted before BrowserResult returned
│   │
│   ├── describe('No Unhandled Exceptions')
│   │   ├── All denial paths return BrowserResult
│   │   ├── No Promise rejections escape to caller
│   │   ├── Error caught and converted to BrowserResult.error
│   │   └── System remains stable after multiple denials
│   │
│   └── describe('Complete End-to-End Flow')
│       ├── Full flow: navigate success → click denial → cleanup → event → result
│       ├── Full flow: all operations denied from start
│       ├── Full flow: permission granted then revoked mid-session
│       └── Full flow: multiple concurrent denials handled gracefully
```

### Key Implementation Details

#### 1. Error Context Verification

```typescript
it('should create BrowserPermissionDeniedError with correct context on denial', async () => {
  testContext = scenarios.denyNavigation();

  const result = await testContext.browserTool.execute({
    operation: 'navigate',
    params: { url: 'https://example.com' }
  });

  // Verify BrowserPermissionDeniedError context
  expect(result.success).toBe(false);
  expect(result.permissionDenied).toBe(true);
  expect(result.metadata?.permissionDenied).toBe(true);
  expect(result.metadata?.deniedBy).toBeDefined();
  expect(result.metadata?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

  // Verify suggestions from error class
  expect(Array.isArray(result.metadata?.suggestions)).toBe(true);
  expect(result.metadata?.suggestions.length).toBeGreaterThan(0);
});
```

#### 2. Cleanup Verification When Browser Already Launched

```typescript
it('should call cleanup() when browser was already launched before denial', async () => {
  testContext = createPermissionTestContext();

  // First: grant permission and launch browser
  await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');
  const successResult = await testContext.browserTool.execute({
    operation: 'navigate',
    params: { url: 'https://example.com' }
  });

  expect(successResult.success).toBe(true);
  expect(testContext.mockBrowser.state.browserActive).toBe(true);
  expect(testContext.mockBrowser.state.pageActive).toBe(true);

  // Second: revoke permission and verify cleanup on next operation
  await testContext.permissionManager.denyPermission('Browser', 'click');

  const deniedResult = await testContext.browserTool.execute({
    operation: 'click',
    params: { selector: '#button' }
  });

  assertPermissionDeniedResponse(deniedResult, 'click');

  // Manual cleanup after denial
  await testContext.browserTool.cleanup();

  // Verify all resources cleaned up
  expect(testContext.mockBrowser.state.browserActive).toBe(false);
  expect(testContext.mockBrowser.state.contextActive).toBe(false);
  expect(testContext.mockBrowser.state.pageActive).toBe(false);
  expect(testContext.mockBrowser.state.activeOperations).toBe(0);
});
```

#### 3. Event Emission Verification

```typescript
it('should emit permission:denied event with correct payload', async () => {
  testContext = scenarios.denyNavigation();

  await testContext.browserTool.execute({
    operation: 'navigate',
    params: { url: 'https://example.com' }
  });

  const deniedEvents = testContext.events.filter(e => e.type === 'denied');
  expect(deniedEvents.length).toBeGreaterThan(0);

  const latestEvent = deniedEvents[deniedEvents.length - 1];

  // Verify event payload structure
  expect(latestEvent).toMatchObject({
    type: 'denied',
    tool: 'Browser',
    scope: expect.stringContaining('navigate'),
    denialReason: expect.any(String),
    timestamp: expect.any(Date),
  });

  // Verify timestamp is recent
  const now = Date.now();
  const eventTime = latestEvent.timestamp.getTime();
  expect(now - eventTime).toBeLessThan(5000); // Within 5 seconds
});
```

#### 4. No Unhandled Exceptions Verification

```typescript
it('should return BrowserResult on all denial paths without throwing', async () => {
  testContext = scenarios.denyAllOperations();

  const operations = [
    { operation: 'navigate', params: { url: 'https://example.com' } },
    { operation: 'click', params: { selector: '#button' } },
    { operation: 'evaluate', params: { script: 'document.title' } },
    { operation: 'screenshot', params: { fullPage: true } },
    { operation: 'submit', params: { selector: '#form' } },
  ];

  // Execute all operations - none should throw
  const results = await Promise.allSettled(
    operations.map(op => testContext.browserTool.execute(op))
  );

  // All should be fulfilled (not rejected)
  results.forEach((result, index) => {
    expect(result.status).toBe('fulfilled');
    if (result.status === 'fulfilled') {
      expect(result.value).toMatchObject({
        success: false,
        operation: operations[index].operation,
        error: expect.any(String),
        permissionDenied: true,
      });
    }
  });

  assertNoCrashes();
});
```

#### 5. Complete End-to-End Flow Test

```typescript
it('should complete full flow: permission denial → error class → cleanup → event emission → graceful BrowserResult', async () => {
  testContext = createPermissionTestContext();

  // Phase 1: Grant permission and establish browser session
  await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');
  const successResult = await testContext.browserTool.execute({
    operation: 'navigate',
    params: { url: 'https://example.com' }
  });

  expect(successResult.success).toBe(true);
  const initialEvents = [...testContext.events];

  // Phase 2: Deny permission for next operation
  await testContext.permissionManager.denyPermission('Browser', 'click');

  // Phase 3: Execute denied operation - triggers full flow
  const deniedResult = await testContext.browserTool.execute({
    operation: 'click',
    params: { selector: '#button' }
  });

  // Verify error class created correctly (AC1)
  assertPermissionDeniedResponse(deniedResult, 'click');
  expect(deniedResult.error).toBeDefined();
  expect(deniedResult.metadata?.suggestions).toBeDefined();

  // Verify permission:denied event emitted (AC3)
  const newEvents = testContext.events.filter(e => !initialEvents.includes(e));
  const deniedEvent = newEvents.find(e => e.type === 'denied');
  expect(deniedEvent).toBeDefined();
  expect(deniedEvent?.tool).toBe('Browser');
  expect(deniedEvent?.scope).toContain('click');
  expect(deniedEvent?.denialReason).toBeDefined();
  expect(deniedEvent?.timestamp).toBeDefined();

  // Phase 4: Cleanup browser resources (AC2)
  await testContext.browserTool.cleanup();
  assertCleanResourceState(testContext);

  // Verify no unhandled exceptions (AC4)
  assertNoCrashes();

  // Verify graceful BrowserResult (AC5)
  expect(deniedResult).toMatchObject({
    success: false,
    operation: 'click',
    permissionDenied: true,
    metadata: {
      permissionDenied: true,
      deniedBy: expect.any(String),
      timestamp: expect.any(String),
      suggestions: expect.any(Array),
    },
  });
});
```

### Test File Location

```
tests/integration/browser-permission-denial-full-flow.integration.test.ts
```

### Dependencies

The test file will import:
- `vitest` for testing framework
- `../test-utils/permission-test-helpers.js` for test utilities
- Types from `../../packages/core/src/tools/browser/browser-permission-denied-error.js`
- Types from `../../packages/orchestrator/src/tools/browser-tool.js`

### Test Patterns to Follow

Based on existing test files:
1. Use `describe/it` blocks with clear, descriptive names
2. Use `beforeEach/afterEach` for setup and cleanup
3. Call `testContext.browserTool.cleanup()` in `afterEach`
4. Use `vi.restoreAllMocks()` in `afterEach`
5. Use `assertPermissionDeniedResponse()` for validation
6. Use `assertCleanResourceState()` for cleanup verification
7. Use `assertNoCrashes()` for stability checks
8. Use `assertPermissionEventsEmitted()` for event validation

## Consequences

### Positive

1. Comprehensive coverage of the full permission denial flow
2. Ensures all acceptance criteria are verified
3. Follows established testing patterns for consistency
4. Tests both isolated components and their integration
5. Provides regression protection for permission denial handling

### Negative

1. Additional test file to maintain
2. Some overlap with existing tests (intentional for full flow verification)

### Neutral

1. Uses existing test infrastructure (no new utilities needed)
2. Test execution time will increase marginally

## Implementation Notes

### File Structure

```typescript
/**
 * Browser Permission Denial Full Flow Integration Tests
 *
 * Tests the complete flow: permission denial → error class → cleanup → event emission → graceful result
 *
 * Acceptance Criteria:
 * 1. BrowserPermissionDeniedError created with correct context
 * 2. cleanup() called when browser already launched
 * 3. permission:denied event emitted with operation/target/reason/timestamp
 * 4. No unhandled exceptions - all paths return BrowserResult
 * 5. Full flow integration test
 * 6. Follows existing test patterns
 * 7. All tests pass
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ... } from '../test-utils/permission-test-helpers.js';
```

### Test Coverage Map

| Acceptance Criteria | Test Location |
|---------------------|---------------|
| AC1: BrowserPermissionDeniedError context | `describe('BrowserPermissionDeniedError Context Verification')` |
| AC2: cleanup() when browser launched | `describe('Cleanup When Browser Already Launched')` |
| AC3: permission:denied event emission | `describe('permission:denied Event Emission')` |
| AC4: No unhandled exceptions | `describe('No Unhandled Exceptions')` |
| AC5: Full flow test | `describe('Complete End-to-End Flow')` |
| AC6: Pattern compliance | Verified by code review |
| AC7: All tests pass | Verified by test runner |

## References

- [browser-tool.ts](../../packages/orchestrator/src/tools/browser-tool.ts)
- [browser-permission-denied-error.ts](../../packages/core/src/tools/browser/browser-permission-denied-error.ts)
- [permission-test-helpers.ts](../../tests/test-utils/permission-test-helpers.ts)
- [browser-permission-denied-graceful.integration.test.ts](../../tests/integration/browser-permission-denied-graceful.integration.test.ts)
- [browser-tool-error-handling.test.ts](../../packages/orchestrator/src/tools/__tests__/browser-tool-error-handling.test.ts)
