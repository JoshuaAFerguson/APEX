# APEX Core Test Utilities

Cross-platform test utilities and permission mocking for testing in the APEX ecosystem.

## Quick Start

```typescript
import {
  isWindows,
  skipOnWindows,
  describeWindows,
  runOnWindows,
  mockPlatform,
  testOnAllPlatforms,
  // Permission mocking utilities
  createMockPermission,
  mockAgentPermissions,
  createMockPermissionContext
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

// Permission mocking for agent testing
it('should test agent permissions', () => {
  const permissions = [
    createMockPermission({ tool: 'filesystem', level: 'allow-always' }),
    createMockPermission({ tool: 'shell', level: 'allow-once' })
  ];

  const agentContext = mockAgentPermissions('developer', permissions);

  expect(agentContext.hasPermission('filesystem')).toBe(true);
  expect(agentContext.checkPermission('shell').level).toBe('allow-once');
});

// Comprehensive permission context testing
it('should test permission contexts', () => {
  const context = createMockPermissionContext({
    preset: 'autonomous',
    agents: {
      developer: [{ tool: 'filesystem', level: 'allow-always' }]
    }
  });

  expect(context.checkGlobalPermission('filesystem').allowed).toBe(true);
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

### Permission Mock Utilities
- `createMockPermission(overrides)` - Create mock Permission objects
- `createMockExtendedPermission(overrides)` - Create mock ExtendedPermission objects
- `createMockPermissionQuery(overrides)` - Create mock PermissionQuery objects
- `createMockToolPermissionResult(overrides)` - Create mock ToolPermissionResult objects
- `mockAgentPermissions(agentName, permissions)` - Create mock agent permission contexts
- `mockToolPermissions(toolName, permissions)` - Create mock tool permission contexts
- `createMockPermissionContext(options)` - Create comprehensive permission contexts

## Examples

See the [full documentation](../../docs/test-utilities.md) for comprehensive examples and usage patterns.

## Integration

These utilities integrate with:
- Vitest test framework
- Existing APEX shell utilities
- Cross-platform path utilities
- Container and runtime detection