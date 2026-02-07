# ADR-0024: Integration Tests for Timeout Configurations

## Status

Accepted

## Context

The APEX browser automation system requires comprehensive integration tests to verify timeout behavior across all wait strategies. The system uses Playwright under the hood and supports various timeout configurations:

1. **Session-level timeouts**: Configured via `BrowserSessionConfig.timeout`
2. **Method-level timeouts**: Passed as options to individual methods (e.g., `click()`, `waitForElement()`)
3. **Default timeout fallback**: Uses `BROWSER_LIMITS.ELEMENT_TIMEOUT_MS` (30000ms default)

We need integration tests that verify:
- Default timeout behavior works correctly
- Custom timeouts are respected at both session and method levels
- Timeout errors are properly thrown with descriptive messages
- Zero and negative timeout edge cases are handled gracefully

## Decision

### Test Architecture

We will create integration tests at `/packages/browser/src/__tests__/timeout-configurations-integration.test.ts` that:

1. **Test Structure**: Organize tests into logical groups:
   - Default Timeout Behavior
   - Custom Timeout Overrides
   - Timeout Error Handling
   - Edge Cases and Boundary Conditions
   - Timeout Behavior Across Wait Strategies
   - Timeout Configuration Inheritance
   - Timeout Accuracy and Performance
   - Concurrent Operations with Different Timeouts
   - Zero and Negative Timeout Edge Cases

2. **Test Patterns**: Use the existing patterns from the codebase:
   - Vitest as the testing framework
   - `beforeEach`/`afterEach` for setup/teardown
   - `createBrowserManager()` and `createBrowserSession()` factory functions
   - Data URLs for test pages (`data:text/html,<...>`)
   - Duration measurement via `Date.now()` with tolerance

3. **Operations Covered**:
   - Navigation: `navigate()`, `reload()`, `goBack()`, `goForward()`, `waitForNavigation()`
   - Element Interactions: `click()`, `type()`, `hover()`, `focus()`
   - Wait Strategies: `waitForElement()`, `waitForSelector()`, `waitForFunction()`, `waitForLoadState()`, `waitForRequest()`, `waitForResponse()`
   - Screenshot: `captureElement()`

### Timeout Inheritance Model

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER_LIMITS                            │
│  (defaultBrowserConfig.timeout = 30000ms)                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 BrowserSessionConfig                         │
│  session = createBrowserSession(manager, { timeout: X })     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Method Options                            │
│  session.click(selector, { timeout: Y })                     │
│  (overrides session timeout)                                 │
└─────────────────────────────────────────────────────────────┘
```

### Key Implementation Decisions

1. **Timeout Resolution Priority**:
   - Method-level timeout takes precedence
   - Falls back to session-level timeout
   - Falls back to default timeout (30000ms)

2. **Edge Case Handling**:
   - Zero timeout: Treat as minimal timeout (fail fast)
   - Negative timeout: Treat as zero/minimal timeout
   - Very large timeout: Accept but don't block indefinitely for successful operations

3. **Error Message Standards**:
   - All timeout errors must contain "timeout" or "timed out" (case insensitive)
   - Error messages should be actionable and descriptive

4. **Duration Validation**:
   - Allow 30% tolerance for timing variance
   - Maximum acceptable overrun: 500ms past specified timeout

### Test Coverage Matrix

| Category | Operation | Default | Custom | Zero | Negative |
|----------|-----------|---------|--------|------|----------|
| Navigation | navigate | ✅ | ✅ | - | - |
| Navigation | reload | ✅ | ✅ | - | - |
| Navigation | waitForNavigation | ✅ | ✅ | - | - |
| Element | click | ✅ | ✅ | ✅ | - |
| Element | type | ✅ | ✅ | - | - |
| Element | hover | ✅ | ✅ | - | - |
| Element | focus | ✅ | ✅ | - | - |
| Wait | waitForElement | ✅ | ✅ | ✅ | ✅ |
| Wait | waitForSelector | ✅ | ✅ | ✅ | - |
| Wait | waitForFunction | ✅ | ✅ | - | ✅ |
| Wait | waitForLoadState | ✅ | ✅ | ✅ | - |
| Wait | waitForRequest | ✅ | ✅ | - | ✅ |
| Wait | waitForResponse | ✅ | ✅ | ✅ | - |
| Screenshot | captureElement | ✅ | ✅ | - | - |

### Dependencies

```typescript
// From @apexcli/browser
import {
  createBrowserManager,
  createBrowserSession,
} from '../index.js';

import type {
  BrowserManager,
  BrowserSession,
  BrowserSessionConfig,
  BrowserActionResult,
} from '../types.js';
```

### Test Fixture Strategy

Use inline data URLs for test pages:
```typescript
// Static page
await session.navigate('data:text/html,<div id="element">Content</div>');

// Delayed loading page
await session.navigate('data:text/html,<script>setTimeout(function(){...}, 5000)</script>');

// Dynamic visibility
await session.navigate('data:text/html,' + encodeURIComponent(`
  <div id="hidden" style="display: none;">Hidden</div>
  <script>setTimeout(() => document.getElementById('hidden').style.display = 'block', 2000);</script>
`));
```

## Consequences

### Positive

1. **Comprehensive Coverage**: All timeout scenarios across all wait strategies are tested
2. **Edge Case Handling**: Zero and negative timeouts are explicitly tested
3. **Error Quality Assurance**: Descriptive error messages are validated
4. **Performance Validation**: Timeout accuracy is verified within acceptable tolerances
5. **Documentation**: Tests serve as living documentation for timeout behavior
6. **Regression Prevention**: Catches timeout-related regressions early

### Negative

1. **Test Duration**: Tests involving timeouts are inherently slow
2. **Flakiness Risk**: Timing-based tests can be flaky in CI environments
3. **Resource Usage**: Launching real browsers is resource-intensive

### Mitigations

1. **Timeout Values**: Use short timeouts (500-2000ms) to minimize test duration
2. **Tolerance**: Allow 30% timing tolerance to reduce flakiness
3. **Parallel Execution**: Use Vitest's concurrent test execution
4. **Headless Mode**: All tests run in headless mode for efficiency

## Technical Details

### File Location

```
packages/browser/src/__tests__/timeout-configurations-integration.test.ts
```

### Test Execution

```bash
# Run timeout integration tests specifically
npm test -- packages/browser/src/__tests__/timeout-configurations-integration.test.ts

# Run all browser integration tests
npm run test:browser-integration
```

### Acceptance Criteria Verification

| Criterion | Test Coverage |
|-----------|--------------|
| Default timeouts work correctly | `Default Timeout Behavior` test suite |
| Custom timeouts are respected | `Custom Timeout Overrides` test suite |
| Timeout errors are properly thrown with descriptive messages | `Timeout Error Handling` test suite |
| Zero/negative timeout edge cases are handled | `Edge Cases and Boundary Conditions` test suite |

## References

- Existing test: `/packages/browser/src/__tests__/timeout-configurations-integration.test.ts` (already implemented)
- BrowserSession implementation: `/packages/browser/src/browser-session.ts`
- Types: `/packages/browser/src/types.ts`
- Constants: `/packages/browser/src/constants.ts`
