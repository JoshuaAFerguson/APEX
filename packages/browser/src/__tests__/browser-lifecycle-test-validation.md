# Browser Lifecycle Integration Test Suite

## Overview

The `browser-lifecycle-integration.test.ts` file provides comprehensive integration tests for browser launch/close lifecycle operations in the APEX browser automation system.

## Test Coverage

### 1. Browser Instantiation Tests
- **All Supported Browser Types**: Tests chromium, firefox, and webkit browser launches
- **Default Configuration**: Validates launching with default settings
- **Custom Configuration**: Tests custom viewport, timeout, HTTPS error handling, and launch options
- **Headless/Non-headless Modes**: Verifies both display modes work correctly
- **Launch Duration Tracking**: Ensures accurate timing measurement

### 2. Multiple Browser Instance Management
- **Concurrent Browser Launches**: Tests launching multiple browsers simultaneously
- **Instance Limits Enforcement**: Validates maximum instance limits are respected
- **Instance Reuse**: Tests browser instance reuse when enabled
- **Context Management**: Validates contexts across multiple browser instances
- **Resource Usage Tracking**: Tests memory and resource monitoring across instances

### 3. Graceful Shutdown and Cleanup
- **Single Browser Shutdown**: Clean closure of browser and associated contexts
- **Multiple Browser Shutdown**: Coordinated shutdown of multiple browsers
- **Idle Instance Cleanup**: Automatic cleanup of idle browser instances
- **Concurrent Shutdown**: Handling parallel close operations
- **Resource Cleanup Order**: Proper sequence of context → browser closure
- **BrowserSession Lifecycle**: Integration with session-level lifecycle management

### 4. Error Handling During Launch/Close
- **Launch Timeout**: Graceful handling of browser launch timeouts
- **Invalid Configuration**: Error handling for invalid executable paths or settings
- **Post-shutdown Operations**: Proper rejection of operations after manager shutdown
- **Closed Browser Context Operations**: Error handling for operations on closed browsers
- **Double Close Operations**: Idempotent close operations
- **Resource Limit Enforcement**: Memory and CPU limit violation handling
- **Browser Crash Scenarios**: Recovery from unexpected browser termination

### 5. Edge Cases and Timeout Scenarios
- **Multiple Shutdown Calls**: Idempotent shutdown behavior
- **Concurrent Launch/Shutdown**: Race condition handling
- **Rapid Instance Creation/Destruction**: Stress testing resource management
- **Maximum Context Creation**: Handling many contexts per browser
- **Instance Reuse Edge Cases**: Complex reuse scenarios
- **BrowserSession Edge Cases**: Multiple launch/close calls on sessions
- **Memory Pressure**: Behavior under resource constraints

### 6. Performance and Timing Validation
- **Launch Time Limits**: Ensures browsers launch within reasonable timeframes
- **Resource Monitoring Performance**: Fast resource usage calculation
- **Concurrent Operation Performance**: Performance under concurrent load

## Test Infrastructure

### Helper Functions
- `createManager()`: Creates and tracks BrowserManager instances for cleanup
- `createSession()`: Creates and tracks BrowserSession instances for cleanup
- Automatic cleanup in `afterEach()` to prevent resource leaks

### Test Configuration
- Extended timeouts for browser operations (60-90 seconds)
- Resource limits testing with controlled values
- Concurrent operation testing with appropriate parallelism limits

## Acceptance Criteria Coverage

✅ **Browser Instantiation**: Tests cover all browser types, configuration options, and launch scenarios

✅ **Multiple Browser Instances**: Comprehensive testing of concurrent instances, limits, and resource management

✅ **Graceful Shutdown**: All shutdown scenarios including cleanup order and resource deallocation

✅ **Error Handling**: Timeout scenarios, invalid configurations, resource limits, and edge cases

## Prerequisites for Running

1. Playwright browsers installed (`npx playwright install`)
2. Sufficient system resources for concurrent browser instances
3. Network access for browser downloads (if not cached)

## Test Execution

```bash
# Run just the lifecycle tests
npm run test --workspace=@apex/browser -- browser-lifecycle-integration.test.ts

# Run all browser tests
npm run test --workspace=@apex/browser

# Run with coverage
npm run test --workspace=@apex/browser -- --coverage
```

## Expected Outcomes

- All tests should pass on systems with adequate resources
- Browser instances should be properly cleaned up after each test
- No memory leaks or hanging processes
- Performance tests should complete within reasonable time limits
- Error scenarios should fail gracefully without throwing uncaught exceptions

## Notes

- Tests use headless mode by default for CI/CD compatibility
- Some tests include non-headless mode testing for local development
- Resource limit tests use conservative values to avoid system impact
- Timing tests include reasonable buffers for CI environments
- Cleanup is defensive to handle partial failures gracefully