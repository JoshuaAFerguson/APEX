# ADR-095: Timeout Configuration Integration Tests

## Status
Accepted (Implemented)

## Context

The APEX orchestrator supports multiple wait strategies and timeout configurations across various components:

1. **Browser Tool Wait Strategies**:
   - Navigation timeout via `pageLoadTimeout` in `BrowserToolConfig`
   - Wait for selector timeout via `BrowserWaitForSelectorParams.timeout`
   - Wait until strategies: `load`, `domcontentloaded`, `networkidle`

2. **MCP Server Timeouts**:
   - Connection timeout for MCP server handshakes
   - Request timeout for tool calls
   - Shutdown timeout for graceful termination

3. **Approval Gate Timeouts**:
   - Timeout for approval requests
   - Auto-approve/auto-deny on timeout configurations

The current test coverage focuses on individual components but lacks comprehensive integration tests that verify timeout behavior across all wait strategies in realistic scenarios.

## Decision

Create a comprehensive integration test suite for timeout configurations that verifies:

1. **Default Timeout Behavior**
   - Default timeouts are applied when no custom timeout is specified
   - Default timeouts match documented values
   - Components function correctly with implicit default timeouts

2. **Custom Timeout Configurations**
   - Custom timeouts are respected and override defaults
   - Timeout values propagate correctly through the call stack
   - Custom timeouts work across all wait strategies

3. **Timeout Error Handling**
   - Timeout errors are properly thrown with descriptive messages
   - Error messages include relevant context (operation, timeout value, target)
   - Timeout errors are distinguishable from other error types
   - Cleanup occurs properly after timeout

4. **Edge Cases**
   - Zero timeout (immediate timeout)
   - Negative timeout handling (validation/rejection)
   - Very small fractional timeouts
   - Very large timeout values
   - Timeout at exact millisecond boundaries
   - Race conditions between timeout and successful completion

## Technical Design

### Test File Locations

The integration tests are implemented in:

```
packages/browser/src/__tests__/timeout-configurations-integration.test.ts
```

This location aligns with the browser package which contains the primary wait strategies and timeout configurations for browser automation.

### Test Structure

```typescript
describe('Timeout Configuration Integration Tests', () => {
  describe('Browser Tool Timeouts', () => {
    describe('Navigation Timeout', () => {
      // Default pageLoadTimeout behavior
      // Custom timeout via BrowserNavigateParams.timeout
      // Custom timeout via BrowserToolConfig.pageLoadTimeout
      // Timeout error messages for navigation
    });

    describe('WaitForSelector Timeout', () => {
      // Default wait timeout behavior
      // Custom timeout via BrowserWaitForSelectorParams.timeout
      // Visible element wait with timeout
      // Timeout error messages for selector waits
    });

    describe('Wait Strategies', () => {
      // waitUntil: 'load' behavior
      // waitUntil: 'domcontentloaded' behavior
      // waitUntil: 'networkidle' behavior
      // Backend differences (Playwright vs Puppeteer)
    });
  });

  describe('MCP Server Timeouts', () => {
    describe('Connection Timeout', () => {
      // Default connection timeout
      // Custom connection timeout
      // Connection timeout error handling
    });

    describe('Request Timeout', () => {
      // Tool call timeouts
      // Custom request timeouts
      // Timeout error propagation
    });
  });

  describe('Edge Cases', () => {
    describe('Zero Timeout', () => {
      // Immediate timeout behavior
      // Error message includes timeout value
      // Resources cleaned up properly
    });

    describe('Negative Timeout', () => {
      // Validation errors thrown
      // Error messages descriptive
      // No side effects on invalid input
    });

    describe('Boundary Conditions', () => {
      // Very small timeouts (< 1ms)
      // Very large timeouts (> MAX_SAFE_INTEGER)
      // Exact millisecond boundary timing
    });

    describe('Race Conditions', () => {
      // Completion just before timeout
      // Completion at exact timeout moment
      // Multiple operations with same timeout
    });
  });

  describe('Error Message Quality', () => {
    // All timeout errors include operation type
    // All timeout errors include timeout value
    // All timeout errors include target/context
    // Error messages are actionable
  });
});
```

### Wait Strategy Configuration Matrix

| Strategy | Playwright | Puppeteer | Default Timeout | Configurable |
|----------|------------|-----------|-----------------|--------------|
| `load` | Yes | Yes | 30s | Yes |
| `domcontentloaded` | Yes | Yes | 30s | Yes |
| `networkidle` | Yes | `networkidle0` | 30s | Yes |
| `waitForSelector` | Yes | Yes | 30s | Yes |

### Error Message Format

All timeout errors should follow this format:

```
TimeoutError: [Operation] timed out after [X]ms
  - Operation: [navigate|waitForSelector|toolCall|...]
  - Target: [URL|selector|tool name]
  - Timeout: [value]ms
  - Strategy: [wait strategy if applicable]
```

### Test Implementation Priorities

1. **P0 - Critical**
   - Default timeout works correctly
   - Custom timeout is respected
   - Timeout error is thrown (not silently failing)
   - Basic error message includes timeout value

2. **P1 - Important**
   - All wait strategies work correctly
   - Error messages are descriptive
   - Cleanup occurs after timeout
   - Cross-backend consistency

3. **P2 - Nice to Have**
   - Race condition handling
   - Exact boundary timing
   - Performance characteristics

### Mock Strategy

Use fake timers (`vi.useFakeTimers()`) to control timeout behavior:

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('should timeout after configured duration', async () => {
  const promise = browserTool.execute({
    operation: 'navigate',
    params: { url: 'https://slow.example.com', timeout: 5000 }
  });

  // Advance time past timeout
  vi.advanceTimersByTime(5000);

  await expect(promise).rejects.toThrow(/timed out after 5000ms/);
});
```

### Integration with Existing Tests

The new tests complement existing tests in:
- `timeout-simulation.test.ts` - MCP mock server timeout simulation
- `approval-gate-controller.timeout-edge-cases.test.ts` - Approval timeout handling
- `browser-tool.test.ts` - Basic browser operations

### Acceptance Criteria Verification

| Criterion | Test Coverage |
|-----------|---------------|
| Default timeouts work correctly | `Default Timeout Behavior` suite |
| Custom timeouts are respected | `Custom Timeout Configurations` suite |
| Timeout errors are properly thrown | `Timeout Error Handling` suite |
| Descriptive error messages | `Error Message Quality` suite |
| Zero/negative timeout edge cases | `Edge Cases` suite |

## Consequences

### Positive
- Comprehensive coverage of timeout behavior across all wait strategies
- Clear documentation of expected timeout behavior
- Regression protection for timeout-related changes
- Better error messages for timeout debugging

### Negative
- Additional test maintenance overhead
- Fake timer tests can be fragile
- Some edge cases may be platform-specific

### Neutral
- Tests use mocks rather than real network delays
- Test suite may take longer to run with many timeout scenarios

## Implementation Plan

### Phase 1: Browser Tool Timeouts
1. Implement navigation timeout tests
2. Implement waitForSelector timeout tests
3. Implement wait strategy tests

### Phase 2: Edge Cases
1. Implement zero timeout tests
2. Implement negative timeout validation tests
3. Implement boundary condition tests

### Phase 3: Error Message Quality
1. Verify all error messages include required context
2. Add tests for error message actionability
3. Document error message format

## Implementation Details

### Test Coverage Summary

The implemented test suite in `packages/browser/src/__tests__/timeout-configurations-integration.test.ts` covers:

| Test Suite | Description | Tests |
|------------|-------------|-------|
| Default Timeout Behavior | Tests default timeout application | 3 tests |
| Custom Timeout Overrides | Tests timeout override via method options | 4 tests |
| Timeout Error Handling | Tests error message quality and session recovery | 2 tests |
| Edge Cases and Boundary Conditions | Tests zero, negative, and large timeouts | 3 tests |
| Timeout Behavior Across Wait Strategies | Tests waitUntil and element state options | 2 tests |
| Timeout Configuration Inheritance | Tests session vs method timeout precedence | 2 tests |
| Timeout Accuracy and Performance | Tests timing precision | 2 tests |
| Concurrent Operations | Tests parallel timeout handling | 1 test |

### Acceptance Criteria Verification

| Criterion | Status | Test Coverage |
|-----------|--------|---------------|
| Default timeouts work correctly | ✅ Verified | `Default Timeout Behavior` suite |
| Custom timeouts are respected | ✅ Verified | `Custom Timeout Overrides` suite |
| Timeout errors are properly thrown | ✅ Verified | `Timeout Error Handling` suite |
| Descriptive error messages | ✅ Verified | Error message regex validation |
| Zero/negative timeout edge cases | ✅ Verified | `Edge Cases and Boundary Conditions` suite |

## Related

- [ADR-010-graceful-shutdown-integration-tests.md](./ADR-010-graceful-shutdown-integration-tests.md)
- [ADR-043-mcp-client-utility.md](./ADR-043-mcp-client-utility.md)
- [timeout-simulation.test.ts](../mcp/mock-server/timeout-simulation.test.ts)
- [approval-gate-controller.timeout-edge-cases.test.ts](../__tests__/approval-gate-controller.timeout-edge-cases.test.ts)
- [timeout-configurations-integration.test.ts](../../browser/src/__tests__/timeout-configurations-integration.test.ts) - Primary implementation
