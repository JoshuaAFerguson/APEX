# Navigation Test Utilities - Test Coverage

This directory contains comprehensive test suites for the APEX navigation test utilities. The tests are organized into several specialized test files, each focusing on different aspects of the navigation testing infrastructure.

## Test Files Overview

### 1. `navigation-test-utils.test.ts` - Core Functionality Tests
**Coverage**: Basic functionality and API compliance

- **NavigationTestHelper Tests**:
  - Basic navigation operations (`goto`, `waitForNavigation`)
  - URL assertions with various patterns
  - Page content assertions (text, selectors, visibility)
  - Element waiting functionality
  - Metrics collection and performance data

- **NavigationTestSetup Tests**:
  - Factory methods for different configurations (basic, headless, CI, debug)
  - Configuration validation
  - Setup/teardown lifecycle management

- **NavigationTestFixture Tests**:
  - Test isolation and cleanup
  - Network and console logging capture
  - Custom page creation with configurations
  - Browser context management

- **Test Templates and Scenarios**:
  - Validation of HTML templates (simple, form, SPA, loading)
  - Scenario setup verification
  - Template functionality testing

### 2. `navigation-test-utils.comprehensive.test.ts` - Extended Functionality
**Coverage**: Advanced features, edge cases, and comprehensive scenarios

- **Advanced Navigation Scenarios**:
  - Complex URL assertion patterns (regex, pathname, query/hash handling)
  - Dynamic content interactions
  - Event emission verification
  - Real-time content changes

- **NavigationTestHelper Advanced Features**:
  - Multiple page management
  - Performance metrics analysis
  - Complex form interactions
  - SPA navigation with history management

- **Factory Methods Testing**:
  - Custom fixture configurations
  - Different isolation options
  - Environment-specific setups (unit, integration, debug, CI)

- **Event System Validation**:
  - Navigation event emission
  - Assertion event tracking
  - Error event handling

### 3. `navigation-error-handling.test.ts` - Error Scenarios and Edge Cases
**Coverage**: Error conditions, recovery mechanisms, and robustness

- **Error State Management**:
  - Uninitialized helper usage
  - Browser crash simulation
  - Network error handling
  - Malformed HTML processing
  - Invalid selector patterns

- **Timeout Scenarios**:
  - Various timeout configurations
  - Navigation timeout with retries
  - Element waiting timeouts
  - Performance under time pressure

- **Resource Management**:
  - Memory intensive operations
  - Large page content handling
  - Resource cleanup after errors
  - Multiple teardown call safety

- **Concurrent Error Handling**:
  - Error isolation between concurrent operations
  - Mixed success/failure scenarios
  - Error message quality validation

### 4. `navigation-integration.test.ts` - End-to-End Integration
**Coverage**: Real-world workflows and complex integration scenarios

- **Complete User Workflows**:
  - Multi-page navigation journeys
  - Form submission workflows
  - Authentication flow simulation
  - E-commerce transaction simulation

- **Complex Async Scenarios**:
  - Dynamic content loading
  - Progress tracking
  - Multi-step workflows
  - Real-time updates

- **Multi-Page Application Testing**:
  - Page isolation between tests
  - Cross-page data persistence
  - State management validation
  - Browser history manipulation

- **Performance and Monitoring**:
  - Navigation performance analysis
  - Network activity monitoring
  - Console message capture
  - Performance trend analysis

### 5. `navigation-performance.test.ts` - Performance and Load Testing
**Coverage**: Performance benchmarks, load testing, and resource optimization

- **Navigation Performance Benchmarks**:
  - Navigation timing measurements
  - Rapid successive navigation testing
  - Different navigation pattern benchmarks
  - Performance regression detection

- **Concurrent Load Testing**:
  - Multiple concurrent navigation helpers
  - Concurrent fixture management
  - Resource contention handling
  - Scalability validation

- **Memory and Resource Testing**:
  - Large page content efficiency
  - Memory leak detection
  - Resource cleanup validation
  - Long-running test stability

- **Setup/Teardown Performance**:
  - Setup and teardown timing
  - Configuration impact on performance
  - Resource allocation optimization
  - Environment-specific benchmarks

## Test Coverage Metrics

### Functional Coverage
- ✅ **Navigation Operations**: goto, waitForNavigation, assertURL, assertPageContent
- ✅ **Test Fixtures**: Setup, teardown, reset, isolation
- ✅ **Factory Methods**: All factory configurations and custom options
- ✅ **Event System**: All navigation and assertion events
- ✅ **Error Handling**: All error paths and recovery mechanisms

### Edge Case Coverage
- ✅ **Invalid Inputs**: Malformed URLs, invalid selectors, bad configurations
- ✅ **Network Issues**: Timeout, connection failures, slow responses
- ✅ **Browser Issues**: Crashes, memory issues, resource constraints
- ✅ **Concurrent Usage**: Multiple instances, race conditions, resource conflicts
- ✅ **Large Scale**: Big pages, many elements, high load scenarios

### Integration Coverage
- ✅ **Real-world Workflows**: Authentication, e-commerce, form handling
- ✅ **SPA Interactions**: History management, dynamic routing, async loading
- ✅ **Multi-page Applications**: Cross-page navigation, state persistence
- ✅ **Performance Monitoring**: Metrics collection, trend analysis, benchmarking

### Performance Coverage
- ✅ **Navigation Timing**: Speed measurements, optimization validation
- ✅ **Concurrency**: Multi-helper performance, resource sharing
- ✅ **Memory Management**: Leak detection, cleanup efficiency
- ✅ **Scalability**: Load testing, stress testing, capacity planning

## Running the Tests

### Run All Navigation Tests
```bash
npm test -- tests/test-utils/__tests__/
```

### Run Specific Test Suites
```bash
# Core functionality
npm test -- tests/test-utils/__tests__/navigation-test-utils.test.ts

# Comprehensive scenarios
npm test -- tests/test-utils/__tests__/navigation-test-utils.comprehensive.test.ts

# Error handling
npm test -- tests/test-utils/__tests__/navigation-error-handling.test.ts

# Integration testing
npm test -- tests/test-utils/__tests__/navigation-integration.test.ts

# Performance testing
npm test -- tests/test-utils/__tests__/navigation-performance.test.ts
```

### Test Environment Configuration

Tests support various environment configurations:

- **CI Environment**: `CI=true` enables headless mode and optimized settings
- **Debug Mode**: `DEBUG=true` enables verbose logging and slower execution
- **Performance Mode**: `PERF=true` enables detailed performance measurements
- **Headless Override**: `BROWSER_TEST_HEADLESS=true` forces headless mode

## Test Data and Fixtures

### Test Page Templates
- **Simple Page**: Basic HTML with navigation elements
- **Form Page**: Complex form with validation and submission
- **SPA Page**: Single-page application with client-side routing
- **Loading Page**: Async content loading with progress indicators

### Test Scenarios
- **Basic Navigation**: Simple page-to-page navigation
- **Form Submission**: Form filling and submission workflows
- **SPA Navigation**: Client-side routing and state management
- **Async Loading**: Dynamic content loading and state changes

## Testing Best Practices

### Test Organization
1. **Isolation**: Each test is fully isolated with proper setup/teardown
2. **Parallelization**: Tests can run concurrently without interference
3. **Deterministic**: Tests produce consistent results across environments
4. **Fast Feedback**: Core tests run quickly, performance tests are separate

### Error Handling
1. **Graceful Degradation**: Tests handle errors without cascading failures
2. **Resource Cleanup**: All resources are properly cleaned up on failures
3. **Clear Error Messages**: Failures provide actionable error information
4. **Timeout Management**: Appropriate timeouts prevent hanging tests

### Performance Considerations
1. **Efficient Setup**: Minimal overhead for test initialization
2. **Resource Sharing**: Reuse browser instances where appropriate
3. **Memory Management**: Monitor and prevent memory leaks
4. **Scalable Design**: Tests scale well with increased concurrency

## Coverage Reports

The test suite generates comprehensive coverage reports including:

- **Line Coverage**: Percentage of code lines executed
- **Branch Coverage**: Percentage of code branches tested
- **Function Coverage**: Percentage of functions called
- **Statement Coverage**: Percentage of statements executed

### Viewing Coverage
```bash
npm run test:coverage -- tests/test-utils/__tests__/
```

## Contributing

When adding new tests:

1. **Follow Naming Convention**: Use descriptive test names with clear expectations
2. **Add Documentation**: Document test purpose and expected behavior
3. **Include Edge Cases**: Consider error conditions and boundary cases
4. **Maintain Performance**: Ensure new tests don't significantly impact test speed
5. **Update Coverage**: Add tests to appropriate test files based on their focus

## Troubleshooting

### Common Issues

**Browser Launch Failures**:
- Check system dependencies for Playwright
- Verify headless mode configuration
- Ensure sufficient system resources

**Timeout Issues**:
- Adjust timeout values for slower environments
- Check network connectivity for external resources
- Monitor system load during test execution

**Memory Issues**:
- Reduce concurrent test execution
- Verify proper resource cleanup
- Monitor for memory leaks in test code

**Flaky Tests**:
- Add proper wait conditions
- Increase timeout values where appropriate
- Ensure test isolation and cleanup