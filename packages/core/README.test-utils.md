# APEX Core Test Utilities

Cross-platform test utilities for handling platform-specific testing scenarios in the APEX ecosystem.

## Quick Start

```typescript
import {
  isWindows,
  skipOnWindows,
  describeWindows,
  runOnWindows,
  mockPlatform,
  testOnAllPlatforms
} from '@apex/core';

// Skip tests on specific platforms
it('Unix-only test', () => {
  skipOnWindows();
  // Test Unix-specific functionality
});

// Platform-specific test suites
describeWindows('Windows tests', () => {
  it('should handle Windows paths', () => {
    expect('C:\\Program Files').toMatch(/^[A-Z]:\\/);
  });
});

// Conditional execution
it('should handle platform differences', () => {
  const result = runOnWindows(() => 'windows-value') || 'default-value';
  expect(result).toBeDefined();
});

// Test on all platforms
testOnAllPlatforms('cross-platform function', (platform) => {
  const result = myFunction();
  expect(result).toBeDefined();
});
```

## Available Utilities

### Platform Detection
- `isWindows()` - Check if running on Windows
- `isUnix()` - Check if running on Unix-like systems
- `isMacOS()` - Check if running on macOS
- `isLinux()` - Check if running on Linux
- `getPlatform()` - Get current platform name

### Test Skipping
- `skipOnWindows()` - Skip test on Windows
- `skipOnUnix()` - Skip test on Unix-like systems
- `skipOnMacOS()` - Skip test on macOS
- `skipOnLinux()` - Skip test on Linux
- `skipUnlessWindows()` - Only run on Windows
- `skipUnlessUnix()` - Only run on Unix-like systems

### Platform-Specific Test Suites
- `describeWindows(name, fn)` - Windows-only test suite
- `describeUnix(name, fn)` - Unix-only test suite
- `describeMacOS(name, fn)` - macOS-only test suite
- `describeLinux(name, fn)` - Linux-only test suite

### Conditional Execution
- `runOnWindows(fn)` - Execute function only on Windows
- `runOnUnix(fn)` - Execute function only on Unix
- `runOnMacOS(fn)` - Execute function only on macOS
- `runOnLinux(fn)` - Execute function only on Linux

### Platform Mocking
- `mockPlatform(platform)` - Mock platform for testing
- `testOnAllPlatforms(name, testFn)` - Test on all platforms

### Constants and Types
- `PLATFORMS` - Platform name constants
- `isValidPlatform(platform)` - Type guard for platforms
- `Platform` - TypeScript type for valid platforms

## Examples

See the [full documentation](../../docs/test-utilities.md) for comprehensive examples and usage patterns.

## Integration

These utilities integrate with:
- Vitest test framework
- Existing APEX shell utilities
- Cross-platform path utilities
- Container and runtime detection