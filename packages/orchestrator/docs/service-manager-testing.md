# ServiceManager Testing Documentation

## Overview

This document describes the comprehensive test suite for the ServiceManager install/uninstall functionality. The tests ensure robust service management with proper error handling, platform compatibility, and edge case coverage.

## Test Coverage Areas

### 1. Install Method Testing

The install method tests cover:

**Success Scenarios:**
- Default installation with various options
- Installation with auto-enable functionality
- Force overwrite of existing services
- Platform-specific installations (Linux systemd, macOS launchd)

**Error Scenarios:**
- Permission denied during directory creation
- Permission denied during file write operations
- Existing service conflicts (without force option)
- Unsupported platform handling
- Partial installation failures with warning collection

**Edge Cases:**
- System-level vs user-level service paths
- Complex environment variable handling
- Service reload failures with graceful degradation
- Enable failures after successful installation

### 2. Uninstall Method Testing

The uninstall method tests cover:

**Success Scenarios:**
- Standard uninstallation of inactive services
- Graceful stop and removal of running services
- Platform-specific cleanup operations
- Custom timeout handling

**Error Scenarios:**
- Service file not found
- Permission denied during file removal
- Service stop failures (with and without force option)
- Service disable failures with warning collection

**Edge Cases:**
- Force uninstallation when services are stuck
- Handling of already-deleted files (ENOENT errors)
- Timeout scenarios for service stopping
- Partial cleanup scenarios

### 3. Platform-Specific Testing

**Linux (systemd) Tests:**
- User-level service management in `~/.config/systemd/user/`
- System-level service management in `/etc/systemd/system/` (for root)
- systemctl command integration and error handling
- Daemon reload operations and failure recovery

**macOS (launchd) Tests:**
- LaunchAgent plist generation and installation
- launchctl command integration
- Service label format handling
- Platform-specific restart behavior (stop + start)

**Unsupported Platforms:**
- Proper error handling for Windows and other platforms
- Graceful degradation of operations

### 4. Integration Testing

**Complete Service Lifecycle:**
- Install → Enable → Start → Status Check → Stop → Disable → Uninstall
- State consistency throughout the lifecycle
- Error recovery and retry scenarios
- Service restart operations

**Advanced Scenarios:**
- Complex configuration handling
- Multiple environment variables
- Special characters in service names and paths
- Long path handling
- Concurrent operation safety

### 5. Error Handling and Recovery

**Permission Error Scenarios:**
- Detailed error messages with actionable advice
- Proper ServiceError type usage with specific error codes
- Graceful degradation when possible

**System Integration Errors:**
- systemctl/launchctl command failures
- Filesystem operation errors
- Network or system unavailability scenarios

**Warning Collection:**
- Non-fatal issues during installation
- Partial operation failures
- Recovery guidance for users

## Test Structure

### Main Test File: `service-manager.test.ts`

Contains the primary test suites with:
- Basic functionality tests
- Platform detection tests
- Generator class tests (SystemdGenerator, LaunchdGenerator)
- Error handling tests
- Edge case scenarios

### Integration Test File: `service-manager.integration.test.ts`

Contains comprehensive integration tests with:
- Full service lifecycle scenarios
- Cross-platform behavior verification
- Complex configuration testing
- Real-world usage patterns

## Test Quality Metrics

### Coverage Areas:

1. **Method Coverage**: All public methods of ServiceManager tested
2. **Branch Coverage**: All conditional logic paths tested
3. **Error Path Coverage**: All error conditions and exceptions tested
4. **Platform Coverage**: Linux, macOS, and unsupported platform scenarios
5. **Integration Coverage**: End-to-end workflows tested

### Test Categories:

1. **Unit Tests**: Individual method testing with mocked dependencies
2. **Integration Tests**: Multi-method workflows with realistic scenarios
3. **Error Tests**: Comprehensive error condition coverage
4. **Platform Tests**: Platform-specific behavior verification
5. **Edge Case Tests**: Boundary conditions and unusual scenarios

## Key Testing Principles

### 1. Comprehensive Mocking
- All external dependencies (fs, child_process) are mocked
- Process environment is controlled for consistent testing
- Platform detection is mocked for cross-platform testing

### 2. Realistic Scenarios
- Tests simulate real-world usage patterns
- Error conditions match actual system behaviors
- Platform-specific command outputs are accurately mocked

### 3. Error Message Validation
- Error messages are tested for clarity and usefulness
- Error codes are verified for proper categorization
- Suggested solutions are included in error messages

### 4. State Management
- Service state is tracked throughout test scenarios
- State consistency is verified across operations
- State transitions are properly tested

### 5. Performance Considerations
- Timeout scenarios are tested with appropriate delays
- Concurrent operation handling is verified
- Resource cleanup is validated

## Running the Tests

### Individual Test Files
```bash
npm test --workspace=@apex/orchestrator
```

### Coverage Report
```bash
npm run test:coverage
```

### Integration Tests Only
```bash
npx vitest run packages/orchestrator/src/service-manager.integration.test.ts
```

## Expected Outcomes

When tests pass, they verify:

1. **Functional Correctness**: All install/uninstall operations work as specified
2. **Error Resilience**: System handles errors gracefully with helpful messages
3. **Platform Compatibility**: Proper operation on supported platforms
4. **Edge Case Handling**: Unusual scenarios are handled appropriately
5. **Integration Stability**: Complex workflows complete successfully

## Future Testing Considerations

### Potential Enhancements:
- Performance benchmarking tests
- Memory usage validation
- Real system integration tests (with actual systemd/launchd)
- Security vulnerability testing
- Load testing for concurrent operations

### Monitoring:
- Test execution time tracking
- Coverage trend analysis
- Error pattern identification
- Platform-specific failure rates