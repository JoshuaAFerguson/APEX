# ADR-052: Browser Error Scenarios Integration Tests

## Status
Proposed

## Context

The acceptance criteria require integration tests for browser error scenarios covering:
1. Network failure simulation
2. Request timeout handling
3. Page load timeout
4. Element not found errors
5. Navigation errors
6. Graceful error recovery mechanisms

### Current State Analysis

The codebase already has:
- **`packages/browser/src/__tests__/error-scenarios.test.ts`**: Unit-level error scenarios with real browser (Playwright)
- **`packages/orchestrator/src/tools/__tests__/browser-tool-error-handling.test.ts`**: Mock-based error handling tests for BrowserTool
- **`packages/browser/src/mocks/`**: Comprehensive mock infrastructure with scenario builder

### Gap Analysis

Current tests primarily focus on:
- Unit-level error handling with real browsers
- Mock-based orchestrator tool testing

Missing:
- **Integration tests** that validate the full error flow from BrowserSession through to result handling
- **Network failure simulation** using Playwright's route interception
- **Comprehensive timeout cascade testing** across different timeout types
- **Error recovery flow validation** with retry mechanisms
- **Error state propagation** through the event system

## Decision

Create a new integration test file `packages/browser/src/__tests__/browser-error-integration.test.ts` that provides comprehensive integration testing for browser error scenarios.

### Architecture Approach

```
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Test Layer                       │
├─────────────────────────────────────────────────────────────────┤
│  browser-error-integration.test.ts                              │
│  ├── Network Failure Scenarios                                  │
│  │   ├── Route interception for network failures                │
│  │   ├── DNS resolution failure simulation                      │
│  │   └── Connection timeout simulation                          │
│  ├── Timeout Scenarios                                          │
│  │   ├── Navigation timeout (page.goto)                         │
│  │   ├── Element wait timeout (waitForSelector)                 │
│  │   ├── JavaScript execution timeout                           │
│  │   └── Screenshot timeout                                     │
│  ├── Element Error Scenarios                                    │
│  │   ├── Element not found                                      │
│  │   ├── Element becomes stale                                  │
│  │   ├── Element not visible                                    │
│  │   └── Element not clickable                                  │
│  ├── Navigation Error Scenarios                                 │
│  │   ├── Invalid URL handling                                   │
│  │   ├── Navigation interrupted                                 │
│  │   ├── Redirect loop detection                                │
│  │   └── SSL certificate errors                                 │
│  └── Recovery Mechanism Tests                                   │
│      ├── Session recovery after browser crash                   │
│      ├── Context recovery after page error                      │
│      ├── Retry behavior validation                              │
│      └── Error event propagation                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Package Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  BrowserSession + BrowserManager                                │
│  ├── Error capture via events                                   │
│  ├── Lifecycle state management                                 │
│  └── Resource cleanup on error                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Playwright Runtime                           │
├─────────────────────────────────────────────────────────────────┤
│  Real browser (Chromium/Firefox/WebKit)                         │
│  ├── Route interception for network mocking                     │
│  ├── Page.on('pageerror') for runtime errors                    │
│  └── Page.on('console') for console capture                     │
└─────────────────────────────────────────────────────────────────┘
```

### Test Categories

#### 1. Network Failure Simulation Tests

Use Playwright's route interception to simulate:
- `net::ERR_NAME_NOT_RESOLVED` (DNS failure)
- `net::ERR_INTERNET_DISCONNECTED` (network offline)
- `net::ERR_CONNECTION_REFUSED` (server unavailable)
- `net::ERR_CONNECTION_TIMED_OUT` (connection timeout)
- `net::ERR_ABORTED` (request aborted)

```typescript
// Example approach
await page.route('**/*', route => route.abort('internetdisconnected'));
```

#### 2. Request/Page Timeout Handling

Test timeout scenarios at different levels:
- **Navigation timeout**: Very short timeout for slow-loading pages
- **Element wait timeout**: Element that never appears
- **Script execution timeout**: Long-running JavaScript

```typescript
// Use data URLs with delayed scripts
const slowPage = `data:text/html,<script>setTimeout(()=>{}, 60000)</script>`;
await session.navigate(slowPage, { timeout: 100 });
```

#### 3. Element Not Found Errors

Test element interaction failures:
- Click on non-existent selector
- Type into missing input
- Scroll to absent element
- Get text from removed element

#### 4. Navigation Errors

Test navigation failure modes:
- Invalid URL schemes
- Redirect loops (via route mocking)
- Navigation during page transition
- Back/forward on empty history

#### 5. Graceful Error Recovery

Test recovery mechanisms:
- Session continues after non-fatal errors
- Error events are properly emitted
- Resource cleanup occurs on fatal errors
- Manager handles crashed sessions

### Test Infrastructure Requirements

#### Error Fixtures

Create test fixtures for controlled error scenarios:

```typescript
// packages/browser/src/__tests__/fixtures/error-pages/
- network-error.html      // Triggers network requests that fail
- timeout-page.html       // Contains long-running scripts
- error-trigger.html      // Contains JavaScript errors
- redirect-loop.html      // Creates redirect chain
```

#### Route Interceptors

Implement reusable route interceptors for network simulation:

```typescript
interface NetworkErrorSimulator {
  simulateOffline(): Promise<void>;
  simulateDNSFailure(): Promise<void>;
  simulateTimeout(delayMs: number): Promise<void>;
  simulateServerError(statusCode: number): Promise<void>;
  restore(): Promise<void>;
}
```

#### Error Verification Utilities

Create assertion helpers:

```typescript
interface ErrorAssertions {
  expectNetworkError(result: BrowserActionResult<unknown>): void;
  expectTimeoutError(result: BrowserActionResult<unknown>): void;
  expectElementNotFoundError(result: BrowserActionResult<unknown>): void;
  expectNavigationError(result: BrowserActionResult<unknown>): void;
}
```

### File Structure

```
packages/browser/src/__tests__/
├── browser-error-integration.test.ts     # Main integration test file
├── fixtures/
│   └── error-pages/
│       ├── network-error.html
│       ├── timeout-page.html
│       ├── error-trigger.html
│       └── redirect-loop.html
└── test-utils/
    ├── error-simulators.ts              # Network/error simulation utilities
    └── error-assertions.ts              # Error-specific test assertions
```

### Test Implementation Pattern

Each test should follow this pattern:

```typescript
describe('Error Scenario: <Category>', () => {
  it('should handle <specific error> gracefully', async () => {
    // Arrange: Set up error condition
    await setupErrorCondition();

    // Act: Perform operation that triggers error
    const result = await session.operation();

    // Assert: Verify error handling
    expect(result.success).toBe(false);
    expect(result.error).toContain('<expected error indicator>');
    expect(result.duration).toBeGreaterThan(0);

    // Verify: Session can continue (recovery)
    const recoveryResult = await session.navigate('data:text/html,<h1>Recovered</h1>');
    expect(recoveryResult.success).toBe(true);
  });
});
```

### Acceptance Criteria Mapping

| Acceptance Criteria | Test Category | Implementation Approach |
|---------------------|---------------|------------------------|
| Network failure simulation | Network Failure Scenarios | Playwright route.abort() |
| Request timeout handling | Timeout Scenarios | Short timeout + slow requests |
| Page load timeout | Timeout Scenarios | Short navigate timeout |
| Element not found errors | Element Error Scenarios | Non-existent selectors |
| Navigation errors | Navigation Error Scenarios | Invalid URLs, redirects |
| Graceful error recovery | Recovery Mechanism Tests | Post-error continuation |

### Integration Points

The tests will validate integration between:

1. **BrowserSession** ↔ **BrowserManager**: Error propagation through lifecycle
2. **BrowserSession** ↔ **EventEmitter**: Error event emission
3. **BrowserSession** ↔ **Playwright Page**: Native error capture
4. **Error handling** ↔ **Resource cleanup**: Proper cleanup on errors

### Performance Considerations

- Use `data:` URLs where possible to avoid network overhead
- Set short timeouts for timeout tests (100-500ms)
- Run error tests in isolation to prevent state leakage
- Use `afterEach` cleanup to ensure session closure

## Consequences

### Positive

- Comprehensive coverage of all specified error scenarios
- Integration-level validation of error flow
- Reusable error simulation infrastructure
- Clear documentation of error handling behavior

### Negative

- Tests depend on real browser behavior (may vary slightly)
- Some network error simulations may be platform-dependent
- Timeout tests add to overall test duration

### Mitigation

- Use generous timeout thresholds for assertions
- Skip platform-specific tests when necessary
- Run error tests in parallel where possible

## Implementation Notes

### Phase 1: Core Infrastructure
1. Create error simulator utilities
2. Create error assertion helpers
3. Set up test fixtures

### Phase 2: Network Error Tests
1. Network failure simulation tests
2. Request timeout tests
3. DNS resolution tests

### Phase 3: Element and Navigation Tests
1. Element not found tests
2. Navigation error tests
3. Page load timeout tests

### Phase 4: Recovery Tests
1. Error recovery validation
2. Session continuation after errors
3. Event propagation verification

## References

- Existing error tests: `packages/browser/src/__tests__/error-scenarios.test.ts`
- Mock infrastructure: `packages/browser/src/mocks/`
- Browser types: `packages/browser/src/types.ts`
- Constants: `packages/browser/src/constants.ts`
