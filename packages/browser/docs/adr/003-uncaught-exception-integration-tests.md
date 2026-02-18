# ADR-003: Integration Tests for Uncaught Exception Detection with Stack Traces

## Status
**Proposed**

## Date
2025-01-15

## Context

The `@apexcli/browser` package already has comprehensive **unit tests** for uncaught exception detection (`uncaught-exception-enhanced.test.ts`, 853 lines). However, these tests are structured as unit tests that test individual components in isolation.

The task requires adding **integration tests** that:
1. Trigger actual uncaught exceptions in a real browser environment
2. Verify the detection pipeline works end-to-end
3. Validate that stack trace information is captured correctly
4. Ensure all test scenarios pass with `npm test`

### Current State Analysis

**Existing Unit Tests** (`uncaught-exception-enhanced.test.ts`):
- Tests deep stack traces, async errors, event handlers, custom errors
- Tests error types (ReferenceError, TypeError, custom errors)
- Tests complex scenarios (dynamic scripts, Web Workers, timers)
- Tests source mapping and location accuracy
- Tests multi-threaded error capture
- Tests page error event integration

**Existing Integration Tests** (`integration.test.ts`):
- Tests factory functions, session lifecycle
- Tests end-to-end workflow, multiple sessions
- Tests error recovery and resource management
- Does NOT include specific uncaught exception integration scenarios

**Key Components**:
1. `BrowserSession.injectErrorCaptureScript()` - Injects window.error and unhandledrejection listeners
2. `BrowserSession.retrieveCapturedJavaScriptErrors()` - Retrieves errors from `window.__apexErrorCapture`
3. `BrowserSession.startErrorPolling()` / `stopErrorPolling()` - Continuous error polling
4. Page events: `pageerror`, `javascriptError` - Real-time error events

## Decision

We will create a dedicated integration test file `uncaught-exception-integration.test.ts` that tests the **complete integration** of error capture across multiple components in realistic end-to-end scenarios.

### Technical Design

#### 1. File Structure
```
packages/browser/src/__tests__/
├── uncaught-exception-enhanced.test.ts  # Existing unit tests
└── uncaught-exception-integration.test.ts  # NEW integration tests
```

#### 2. Test Categories

**Category 1: End-to-End Error Pipeline**
- Verify complete flow from exception thrown → injected script capture → retrieval → event emission
- Test that errors are correctly propagated through all layers
- Validate data integrity across the capture pipeline

**Category 2: Real Browser Error Scenarios**
- Test actual browser runtime errors (not mocked)
- Verify stack traces contain real file/line/column information
- Test cross-origin and mixed-content error handling

**Category 3: Multi-Session Error Isolation**
- Verify errors in one session don't leak to another
- Test concurrent error capture across multiple sessions
- Validate session cleanup doesn't lose pending errors

**Category 4: Error Capture Timing and Reliability**
- Test error capture under various timing conditions
- Verify no race conditions in error retrieval
- Test error polling start/stop during active errors

**Category 5: Stack Trace Completeness**
- Validate stack traces include function names
- Verify source URLs are correctly captured
- Test line/column accuracy for different error types

#### 3. Key Test Scenarios

| Test | Description | Validates |
|------|-------------|-----------|
| `should capture exception through complete pipeline` | Throw error → verify through all capture mechanisms | Full integration |
| `should maintain stack trace integrity across sessions` | Create multiple sessions, throw errors, verify isolation | Session isolation |
| `should capture errors from dynamically loaded content` | Add scripts at runtime, trigger errors | Dynamic content handling |
| `should handle rapid sequential exceptions` | Throw 20+ errors in quick succession | Error buffer management |
| `should correlate pageError and javascriptError events` | Verify both event types fire for same error | Event correlation |
| `should preserve stack traces after session navigation` | Navigate between pages, verify error history | Navigation handling |
| `should capture errors from iframes` | Create iframes with errors, verify capture | Cross-context handling |

#### 4. Technical Implementation Approach

```typescript
// Integration test structure
describe('Uncaught Exception Integration Tests', () => {
  describe('End-to-End Error Pipeline', () => {
    it('should capture exception through complete pipeline', async () => {
      // 1. Create session with all capture options enabled
      // 2. Navigate to page that will throw error
      // 3. Trigger error via user interaction or timer
      // 4. Verify: pageerror event, javascriptError event, getCapturedJavaScriptErrors()
      // 5. Validate stack trace completeness
    });
  });

  describe('Multi-Session Error Isolation', () => {
    it('should isolate errors between concurrent sessions', async () => {
      // 1. Create 3 concurrent sessions
      // 2. Trigger unique errors in each
      // 3. Verify each session only sees its own errors
    });
  });

  describe('Stack Trace Validation', () => {
    it('should capture accurate line and column numbers', async () => {
      // 1. Create page with known error location
      // 2. Trigger error
      // 3. Validate source.line and source.column match expected values
    });
  });
});
```

#### 5. Differences from Unit Tests

| Aspect | Unit Tests | Integration Tests |
|--------|------------|-------------------|
| Browser | Single session, isolated tests | Multiple sessions, concurrent operations |
| Focus | Individual method behavior | Cross-component data flow |
| Assertions | Method returns correct data | Complete pipeline produces correct output |
| Timing | Fixed delays | Dynamic timing, race condition testing |
| Cleanup | Per-test cleanup | Session/manager lifecycle testing |

#### 6. Dependencies and Constraints

- Uses existing `BrowserSession`, `BrowserManager` classes
- Requires Playwright for browser automation
- Tests run with `vitest` framework
- Timeout: 30-60 seconds for integration tests (browser launch overhead)
- Browser types: Chromium (primary), Firefox/WebKit (optional cross-browser)

## Consequences

### Positive
- Validates that the error capture system works as a cohesive whole
- Catches integration bugs that unit tests might miss
- Provides confidence for real-world usage scenarios
- Documents expected behavior for error capture pipeline

### Negative
- Slower test execution (browser launch overhead)
- More complex test setup and teardown
- May be more flaky due to browser timing variations

### Mitigations
- Use reasonable timeouts (30-60s for integration tests)
- Add retry logic for flaky browser operations
- Focus on core integration scenarios, avoid duplicating unit test coverage

## Implementation Notes

1. **File Location**: `packages/browser/src/__tests__/uncaught-exception-integration.test.ts`
2. **Naming Convention**: Follow existing patterns in `integration.test.ts`
3. **Test Isolation**: Each test creates its own session and cleans up
4. **Error Assertions**: Use `expect(...).toBeDefined()` for optional fields to handle browser variations
5. **Timeouts**: Set individual test timeouts using `it('...', async () => {...}, 30000)`

## References

- Existing unit tests: `packages/browser/src/__tests__/uncaught-exception-enhanced.test.ts`
- Existing integration tests: `packages/browser/src/__tests__/integration.test.ts`
- Error capture implementation: `packages/browser/src/browser-session.ts` (lines 1201-1267)
- Type definitions: `packages/browser/src/types.ts` (CapturedJavaScriptError, PageErrorEvent)
