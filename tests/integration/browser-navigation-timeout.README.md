# Browser Navigation Timeout Integration Tests

This document describes the comprehensive integration tests for browser navigation timeout handling in the APEX system.

## Test Coverage Overview

The browser navigation timeout integration tests validate the following scenarios:

### 1. Default Timeout Behavior
- **Default timeout handling**: Tests that navigation requests without custom timeouts use appropriate defaults
- **Slow page loads**: Tests navigation to pages that load slowly but within acceptable limits
- **Permission validation**: Ensures timeout scenarios maintain proper permission tracking

### 2. Custom Timeout Configuration
- **Short timeouts**: Validates that short custom timeouts (e.g., 500ms) are respected and cause appropriate failures
- **Long timeouts**: Tests navigation with extended timeout values (e.g., 60 seconds)
- **Wait condition combinations**: Tests different `waitUntil` conditions ('load', 'domcontentloaded', 'networkidle') with custom timeouts

### 3. Timeout Error Handling
- **Detailed error messages**: Ensures timeout errors provide clear, actionable information
- **Network-level timeouts**: Tests DNS resolution timeouts (ENOTFOUND errors)
- **Connection timeouts**: Tests connection refused scenarios (ECONNREFUSED)
- **Browser state consistency**: Verifies browser remains functional after timeout errors

### 4. Configuration-Based Timeout
- **Global page load timeout**: Tests using `pageLoadTimeout` from browser configuration
- **Parameter override**: Validates that explicit timeout parameters override configuration defaults
- **Dynamic configuration**: Tests behavior when configuration changes during operation

### 5. Slow Page Load Scenarios
- **Gradual loading**: Tests different page loading patterns with various wait conditions
- **Sequential operations**: Tests mixed success/failure scenarios in sequence
- **Concurrent operations**: Validates handling of multiple navigation attempts with different timeouts

### 6. Resource Cleanup
- **Post-timeout cleanup**: Ensures browser resources are properly released after timeout errors
- **State consistency**: Validates resource state tracking remains accurate during timeout scenarios
- **Memory management**: Tests that timeout scenarios don't create resource leaks

### 7. Permission Integration
- **Permission tracking**: Ensures permission grants/denials are properly recorded during timeout scenarios
- **Permission-denied timeouts**: Tests behavior when permissions are denied for timing-out operations
- **Event emission**: Validates that appropriate permission events are emitted

### 8. Error Message Quality
- **Standard timeout messages**: Tests for clear, consistent timeout error reporting
- **Network error propagation**: Ensures network-level errors are properly surfaced
- **Context preservation**: Validates error messages include relevant operation context

## Key Test Scenarios

### Scenario: Navigation Timeout with Custom Value
```typescript
await browserTool.execute({
  operation: 'navigate',
  params: {
    url: 'https://slow-site.example.com',
    timeout: 2000
  }
});
```

Expected behavior:
- Navigation attempt times out after 2000ms
- Clear error message indicating timeout duration
- Browser remains active and functional
- Permission events are properly emitted

### Scenario: Configuration-Based Timeout
```typescript
// Configuration sets pageLoadTimeout: 5000
await browserTool.execute({
  operation: 'navigate',
  params: { url: 'https://example.com' } // No explicit timeout
});
```

Expected behavior:
- Navigation uses 5000ms timeout from configuration
- Parameter timeouts override configuration when provided
- Configuration changes affect subsequent operations

### Scenario: Sequential Timeout Recovery
```typescript
// First navigation times out
await browserTool.execute({
  operation: 'navigate',
  params: { url: 'https://timeout-site.com', timeout: 1000 }
});

// Second navigation succeeds
await browserTool.execute({
  operation: 'navigate',
  params: { url: 'https://working-site.com' }
});
```

Expected behavior:
- First navigation fails with timeout error
- Browser state remains stable
- Second navigation succeeds normally
- No resource leaks or state corruption

## Mock Infrastructure

The tests use comprehensive Playwright mocking:

- **mockPage.goto()**: Simulates navigation with configurable delays and timeout behavior
- **Error simulation**: Various timeout and network errors can be triggered
- **State tracking**: Mock objects maintain consistent state across operations
- **Event emission**: Permission and browser lifecycle events are captured and validated

## Integration Points

These tests specifically validate integration between:

1. **BrowserTool** - Core browser automation functionality
2. **PermissionManager** - Permission checking and event emission
3. **Playwright backend** - Browser automation library integration
4. **Configuration system** - Global and tool-specific configuration
5. **Event system** - State transitions and permission events

## Test Maintenance

When modifying timeout-related functionality:

1. Update relevant test scenarios to cover new behavior
2. Ensure error messages remain clear and actionable
3. Validate that resource cleanup still works correctly
4. Test permission integration with any new timeout features
5. Update this documentation to reflect changes

## Performance Considerations

The tests use short delays and timeouts to maintain fast test execution while still validating timeout behavior. Real-world timeout values would typically be much longer, but the test patterns are representative of actual usage scenarios.