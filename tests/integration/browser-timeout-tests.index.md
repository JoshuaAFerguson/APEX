# Browser Navigation Timeout Tests Index

This directory contains comprehensive integration tests for browser navigation timeout functionality in the APEX system.

## Test Files

### 1. `browser-navigation-timeout.integration.test.ts`
**Primary comprehensive timeout test suite**

**Coverage:**
- Default timeout behavior for navigation requests
- Custom timeout value validation and application
- Different wait conditions (load, domcontentloaded, networkidle)
- Configuration-based timeout handling
- Slow page load scenarios with various patterns
- Resource cleanup after timeout errors
- Permission system integration during timeouts
- Error message quality and context preservation

**Key Scenarios:**
- Navigation with default vs custom timeouts
- Configuration override behavior
- Sequential mixed success/failure operations
- Permission tracking during timeout scenarios
- Browser state consistency after errors

### 2. `browser-timeout-simple.integration.test.ts`
**Basic timeout functionality validation**

**Coverage:**
- Simple timeout error handling
- Successful navigation with custom timeouts
- Different timeout value configurations
- Wait condition variations
- Network error propagation
- Browser state maintenance after errors

**Key Scenarios:**
- Basic timeout failure and success cases
- Parameter validation for timeout values
- Error message format consistency
- State recovery after timeout failures

### 3. `browser-timeout-edge-cases.integration.test.ts`
**Edge cases and stress testing**

**Coverage:**
- Invalid timeout values (zero, negative, extremely large)
- Browser engine timeout consistency (Chromium, Firefox, WebKit)
- Concurrent timeout scenarios and recovery
- Permission-timeout interaction edge cases
- Resource management under timeout stress
- State recovery from corruption scenarios

**Key Scenarios:**
- Zero and negative timeout handling
- Engine-specific timeout behavior
- Multiple simultaneous timeout failures
- Permission denial during timeout operations
- Resource cleanup stress testing

## Test Organization

```
tests/integration/
├── browser-navigation-timeout.integration.test.ts  # Primary comprehensive tests
├── browser-timeout-simple.integration.test.ts      # Basic functionality tests
├── browser-timeout-edge-cases.integration.test.ts  # Edge cases and stress tests
├── browser-navigation-timeout.README.md            # Detailed documentation
└── browser-timeout-tests.index.md                  # This index file
```

## Running the Tests

### All timeout-related tests:
```bash
npm test -- browser-timeout
```

### Individual test suites:
```bash
npm test -- browser-navigation-timeout.integration.test.ts
npm test -- browser-timeout-simple.integration.test.ts
npm test -- browser-timeout-edge-cases.integration.test.ts
```

### Integration test suite:
```bash
npm run test:integration
```

## Test Patterns and Infrastructure

### Mock Setup
All tests use consistent Playwright mocking:
- **Browser/Context/Page mocking** - Complete browser automation simulation
- **Configurable timeouts** - Mock implementations can simulate various timeout scenarios
- **Error injection** - Network errors, DNS failures, and timeout conditions
- **State tracking** - Resource state and lifecycle event validation

### Permission Integration
Tests validate integration with the APEX permission system:
- Permission grants and denials during timeout scenarios
- Event emission for permission lifecycle
- Resource cleanup when permissions are denied
- Cross-system error handling

### Event Tracking
System events are captured and validated:
- Browser state transitions
- Permission grant/deny events
- Timeout-specific events
- Resource lifecycle events

## Coverage Goals

The timeout test suite aims to achieve:

1. **Functional Coverage** - All timeout-related code paths exercised
2. **Error Coverage** - All timeout error scenarios handled gracefully
3. **Integration Coverage** - Timeout behavior validated across system boundaries
4. **Resource Coverage** - No memory leaks or resource corruption under timeout stress
5. **Permission Coverage** - Timeout behavior consistent with security policies

## Maintenance Guidelines

When modifying timeout-related functionality:

1. **Update relevant test files** - Add new scenarios to appropriate test suite
2. **Maintain mock consistency** - Ensure mock behaviors remain realistic
3. **Validate error messages** - Ensure timeout errors remain clear and actionable
4. **Test resource cleanup** - Verify no resource leaks introduced
5. **Update documentation** - Keep README and index files current

## Performance Considerations

Tests are optimized for speed while maintaining realistic behavior:
- Short timeout values for fast test execution
- Minimal delays in mock implementations
- Parallel test execution where safe
- Resource cleanup to prevent test interference

The test patterns are representative of real-world usage while avoiding unnecessary delays in test execution.