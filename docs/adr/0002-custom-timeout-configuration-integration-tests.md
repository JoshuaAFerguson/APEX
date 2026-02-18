# ADR-0002: Custom Timeout Configuration Integration Tests

## Status
Proposed

## Date
2026-02-13

## Context

The APEX project needs comprehensive integration tests to verify that custom timeout configurations properly override default values across all wait strategies. This requirement is derived from the acceptance criteria:

1. **AC1**: Custom timeout values override defaults
2. **AC2**: Custom timeouts are respected for each wait strategy
3. **AC3**: Longer custom timeouts allow operations to complete that would fail with defaults

### Existing Infrastructure Analysis

After analyzing the codebase, the following test infrastructure exists:

| File | Purpose | Lines |
|------|---------|-------|
| `packages/orchestrator/src/__tests__/timeout-configurations.test.ts` | Unit tests for timeout config types | 643 |
| `packages/core/src/__tests__/timeout-configurations.test.ts` | Schema-based timeout validation | 620 |
| `packages/orchestrator/src/__tests__/wait-strategies.integration.test.ts` | Wait strategy integration tests | 720 |
| `packages/browser/src/__tests__/timeout-configurations-integration.test.ts` | Browser timeout integration | 746 |
| `packages/orchestrator/src/timeout-documentation.ts` | Timeout patterns and defaults | 655 |

### Gap Analysis

While existing tests cover:
- Default timeout behaviors
- Timeout configuration validation (Zod schemas)
- Individual wait strategy patterns
- Browser-specific timeout handling

**Missing coverage** includes:
- Explicit tests showing custom timeouts **override** defaults across components
- Cross-component custom timeout propagation
- Tests demonstrating longer custom timeouts enabling success where defaults fail

## Decision

Create a new integration test file: `packages/orchestrator/src/__tests__/custom-timeout-configurations.integration.test.ts`

### Technical Design

#### Test File Structure

```typescript
/**
 * @fileoverview Integration tests for custom timeout configurations
 *
 * Verifies acceptance criteria:
 * - AC1: Custom timeout values override defaults
 * - AC2: Custom timeouts are respected for each wait strategy
 * - AC3: Longer custom timeouts allow operations to complete that would fail with defaults
 */

describe('Custom Timeout Configuration Integration Tests', () => {
  describe('AC1: Custom Timeout Override Behavior', () => {
    // Tests that custom values replace defaults at all levels
  });

  describe('AC2: Custom Timeouts Per Wait Strategy', () => {
    describe('Promise.race Pattern', () => {});
    describe('Polling Pattern', () => {});
    describe('Exponential Backoff Pattern', () => {});
    describe('SetTimeout with Cleanup Pattern', () => {});
  });

  describe('AC3: Extended Timeouts Enable Success', () => {
    // Tests showing operations succeed with longer timeouts
  });
});
```

#### Key Test Scenarios

##### AC1: Custom Timeout Override Tests

| Test Case | Description | Validation |
|-----------|-------------|------------|
| Operation-level override | Custom timeout in method call overrides session default | Timeout occurs at custom value, not default |
| Component config override | Component-specific config overrides global defaults | Verify propagation through config hierarchy |
| Zero/negative edge cases | Edge case handling for invalid overrides | Graceful handling, fallback to defaults |

##### AC2: Wait Strategy Respects Custom Timeouts

| Wait Strategy | Default Timeout | Custom Timeout | Test Approach |
|---------------|-----------------|----------------|---------------|
| Promise.race | 30000ms | 500ms | Race with slow operation |
| Polling | 30000ms | 1000ms | Condition never true, measure timeout |
| Exponential Backoff | Per-attempt | Custom max | Verify delay capping |
| setTimeout Cleanup | N/A | 2000ms | Cancel before timeout fires |

##### AC3: Extended Timeout Success Tests

| Scenario | Default Fails | Extended Succeeds |
|----------|---------------|-------------------|
| Slow element appearance | 1000ms | 3000ms, element appears at 2000ms |
| Connection retry | 2 retries | 5 retries with custom backoff |
| Approval gate | 1 minute | 10 minutes, approval at 5 minutes |

#### Implementation Patterns

**Pattern 1: Timeout Override Verification**
```typescript
it('should use custom timeout instead of default', async () => {
  const DEFAULT_TIMEOUT = 30000;
  const CUSTOM_TIMEOUT = 500;

  const startTime = Date.now();
  const result = await operationWithTimeout({
    timeout: CUSTOM_TIMEOUT // Override default
  });
  const duration = Date.now() - startTime;

  expect(result.success).toBe(false);
  expect(duration).toBeGreaterThanOrEqual(CUSTOM_TIMEOUT * 0.9);
  expect(duration).toBeLessThan(DEFAULT_TIMEOUT); // Must be less than default
});
```

**Pattern 2: Extended Timeout Success**
```typescript
it('should succeed with longer custom timeout where default would fail', async () => {
  const SHORT_DEFAULT = 1000;
  const OPERATION_DURATION = 2000;
  const EXTENDED_TIMEOUT = 3000;

  // First, prove default fails
  const failResult = await operationWithDelayedSuccess({
    timeout: SHORT_DEFAULT,
    delayMs: OPERATION_DURATION
  });
  expect(failResult.success).toBe(false);

  // Then, prove extended timeout succeeds
  const successResult = await operationWithDelayedSuccess({
    timeout: EXTENDED_TIMEOUT,
    delayMs: OPERATION_DURATION
  });
  expect(successResult.success).toBe(true);
});
```

**Pattern 3: Wait Strategy Specific Tests**
```typescript
// Promise.race pattern
it('should respect custom timeout in Promise.race pattern', async () => {
  const customTimeout = 500;
  const result = await TimeoutUtils.withTimeout(
    neverResolves(),
    customTimeout,
    'Custom timeout message'
  );
  // Verify timeout occurred at custom value
});

// Polling pattern
it('should respect custom timeout in polling pattern', async () => {
  const customTimeout = 1000;
  await expect(
    PollingWaitPattern.waitForCondition(
      () => false, // Never true
      { timeoutMs: customTimeout, intervalMs: 100 }
    )
  ).rejects.toThrow(/1000ms/);
});
```

#### Mock Components Required

```typescript
// Mock implementations to control timing precisely
class MockSlowOperation {
  constructor(private resolveAfterMs: number) {}
  async execute(options: { timeout?: number }): Promise<Result> {
    // Simulates operation that takes resolveAfterMs to complete
  }
}

class MockConfigurableComponent {
  private defaultTimeout = 30000;

  async operateWithTimeout(options?: { timeout?: number }): Promise<Result> {
    const effectiveTimeout = options?.timeout ?? this.defaultTimeout;
    // Use effectiveTimeout for operation
  }
}
```

#### Test Infrastructure

- Use `vitest` with `vi.useFakeTimers()` for deterministic timing
- `vi.advanceTimersByTime()` for controlled time progression
- EventEmitter for timeout event verification
- Mock implementations for controlled timing scenarios

## Consequences

### Positive
- Clear verification of all three acceptance criteria
- Reusable test patterns for future timeout testing
- Documentation through tests of expected timeout behavior
- Confidence in custom timeout configuration correctness

### Negative
- Additional test maintenance as timeout systems evolve
- Fake timer tests can be brittle if not carefully designed
- May need updates when new wait strategies are added

### Neutral
- Test file will be ~300-400 lines to cover all scenarios
- Integration tests may take longer to run than unit tests

## File Location

```
packages/orchestrator/src/__tests__/custom-timeout-configurations.integration.test.ts
```

## Dependencies

- Existing timeout infrastructure in `timeout-documentation.ts`
- Vitest testing framework
- EventEmitter for event-based testing

## Notes for Implementation Stage

1. Follow existing test patterns from `wait-strategies.integration.test.ts`
2. Use similar mock structures as `timeout-configurations-integration.test.ts`
3. Ensure each AC is explicitly tested with clear comments
4. Include both positive (success) and negative (timeout) test cases
5. Add edge cases for boundary timeout values
