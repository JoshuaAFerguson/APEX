# Test Utilities

Cross-platform test utilities for APEX packages, providing platform detection, conditional test execution, and platform-specific test helpers.

## Overview

The `@apex/core` package exports a comprehensive set of testing utilities designed to handle cross-platform testing scenarios. These utilities help you write tests that behave correctly across Windows, macOS, and Linux environments.

## Platform Detection

### Basic Platform Checks

```typescript
import { isWindows, isUnix, isMacOS, isLinux, getPlatform } from '@apex/core';

// Check current platform
if (isWindows()) {
  // Windows-specific code
}

if (isUnix()) {
  // Unix-like systems (Linux, macOS, FreeBSD, etc.)
}

if (isMacOS()) {
  // macOS-specific code
}

if (isLinux()) {
  // Linux-specific code
}

// Get platform name
const platform = getPlatform(); // 'win32', 'darwin', 'linux', etc.
```

## Test Skipping

### Conditional Test Skipping

Skip tests based on the current platform:

```typescript
import { skipOnWindows, skipOnUnix, skipOnMacOS, skipOnLinux } from '@apex/core';

it('should work on Unix only', () => {
  skipOnWindows();
  // This test will be skipped on Windows
  expect(unixOnlyFunction()).toBeTruthy();
});

it('should work on Windows only', () => {
  skipOnUnix();
  // This test will be skipped on Unix-like systems
  expect(windowsOnlyFunction()).toBeTruthy();
});
```

### Positive Skipping

Skip tests unless running on a specific platform:

```typescript
import { skipUnlessWindows, skipUnlessUnix } from '@apex/core';

it('should only run on Windows', () => {
  skipUnlessWindows();
  // This test only runs on Windows
  expect(windowsSpecificFeature()).toBeTruthy();
});

it('should only run on Unix systems', () => {
  skipUnlessUnix();
  // This test only runs on Unix-like systems
  expect(unixSpecificFeature()).toBeTruthy();
});
```

## Platform-Specific Test Suites

### Describe Blocks

Create test suites that only run on specific platforms:

```typescript
import { describeWindows, describeUnix, describeMacOS, describeLinux } from '@apex/core';

describeWindows('Windows file system tests', () => {
  it('should handle drive letters', () => {
    expect('C:\\Program Files').toMatch(/^[A-Z]:\\/);
  });

  it('should handle backslashes', () => {
    const path = 'C:\\Users\\test\\file.txt';
    expect(path).toContain('\\');
  });
});

describeUnix('Unix file system tests', () => {
  it('should handle forward slashes', () => {
    const path = '/usr/local/bin/app';
    expect(path).toContain('/');
  });

  it('should handle home directory', () => {
    const homePath = '~/Documents';
    expect(homePath).toMatch(/^~/);
  });
});

describeMacOS('macOS application bundles', () => {
  it('should handle .app bundles', () => {
    const appPath = '/Applications/MyApp.app';
    expect(appPath).toMatch(/\\.app$/);
  });
});

describeLinux('Linux package management', () => {
  it('should handle package managers', () => {
    const packageManagers = ['apt', 'yum', 'dnf', 'pacman'];
    expect(packageManagers.length).toBeGreaterThan(0);
  });
});
```

## Conditional Execution

### Platform-Specific Functions

Execute functions only on specific platforms:

```typescript
import { runOnWindows, runOnUnix, runOnMacOS, runOnLinux } from '@apex/core';

it('should handle platform differences', () => {
  const windowsResult = runOnWindows(() => {
    return {
      shell: 'cmd.exe',
      separator: ';',
      lineEnding: '\\r\\n'
    };
  });

  const unixResult = runOnUnix(() => {
    return {
      shell: '/bin/sh',
      separator: ':',
      lineEnding: '\\n'
    };
  });

  // Only one will have a result, the other will be undefined
  if (windowsResult) {
    expect(windowsResult.shell).toBe('cmd.exe');
  }

  if (unixResult) {
    expect(unixResult.shell).toBe('/bin/sh');
  }
});
```

## Platform Mocking

### Mock Platform for Testing

Test your code on different platforms:

```typescript
import { mockPlatform } from '@apex/core';

it('should behave correctly on all platforms', () => {
  // Test Windows behavior
  const restoreWindows = mockPlatform('win32');
  expect(isWindows()).toBe(true);
  expect(getPathSeparator()).toBe(';');
  restoreWindows();

  // Test macOS behavior
  const restoreMacOS = mockPlatform('darwin');
  expect(isMacOS()).toBe(true);
  expect(getPathSeparator()).toBe(':');
  restoreMacOS();

  // Test Linux behavior
  const restoreLinux = mockPlatform('linux');
  expect(isLinux()).toBe(true);
  expect(getPathSeparator()).toBe(':');
  restoreLinux();
});
```

### Test on All Platforms

Automatically test your function on all major platforms:

```typescript
import { testOnAllPlatforms } from '@apex/core';

testOnAllPlatforms('path separator detection', (platform) => {
  const separator = getPathSeparator();

  if (platform === 'win32') {
    expect(separator).toBe(';');
  } else {
    expect(separator).toBe(':');
  }
});
```

## Constants and Types

### Platform Constants

```typescript
import { PLATFORMS } from '@apex/core';

const platform = PLATFORMS.WINDOWS;    // 'win32'
const platform = PLATFORMS.MACOS;      // 'darwin'
const platform = PLATFORMS.LINUX;      // 'linux'
const platform = PLATFORMS.FREEBSD;    // 'freebsd'
```

### Type Guards

```typescript
import { isValidPlatform, type Platform } from '@apex/core';

function handlePlatform(platform: string) {
  if (isValidPlatform(platform)) {
    // platform is now typed as Platform
    console.log(`Valid platform: ${platform}`);
  } else {
    console.log(`Invalid platform: ${platform}`);
  }
}
```

## Real-World Examples

### File Path Testing

```typescript
it('should handle file paths correctly', () => {
  testOnAllPlatforms('file path handling', (platform) => {
    if (platform === 'win32') {
      const windowsPath = 'C:\\Program Files\\MyApp\\config.json';
      expect(windowsPath).toMatch(/^[A-Z]:\\\\/);
    } else {
      const unixPath = '/usr/local/share/myapp/config.json';
      expect(unixPath).toMatch(/^\//);
    }
  });
});
```

### Command Execution

```typescript
it('should use correct shell commands', () => {
  const getShellCommand = () => {
    return runOnWindows(() => ({
      shell: 'cmd.exe',
      args: ['/c', 'dir']
    })) || runOnUnix(() => ({
      shell: '/bin/sh',
      args: ['-c', 'ls']
    }));
  };

  const command = getShellCommand();
  expect(command).toBeDefined();

  if (isWindows()) {
    expect(command?.shell).toBe('cmd.exe');
  } else {
    expect(command?.shell).toBe('/bin/sh');
  }
});
```

### Environment Variables

```typescript
it('should handle environment variables correctly', () => {
  const getConfigPath = () => {
    if (isWindows()) {
      return `${process.env.APPDATA}\\\\MyApp`;
    } else if (isMacOS()) {
      return `${process.env.HOME}/Library/Preferences/MyApp`;
    } else {
      return `${process.env.HOME}/.config/myapp`;
    }
  };

  testOnAllPlatforms('config path resolution', (platform) => {
    const configPath = getConfigPath();

    if (platform === 'win32') {
      expect(configPath).toMatch(/AppData/);
    } else if (platform === 'darwin') {
      expect(configPath).toMatch(/Library\\/Preferences/);
    } else {
      expect(configPath).toMatch(/\\.config/);
    }
  });
});
```

## Best Practices

1. **Use Specific Skipping**: Prefer `skipOnWindows()` over checking platform manually
2. **Test All Platforms**: Use `testOnAllPlatforms()` for cross-platform utilities
3. **Clean Up Mocks**: Always call the restore function returned by `mockPlatform()`
4. **Use Describe Blocks**: Group platform-specific tests with `describeWindows()`, etc.
5. **Conditional Logic**: Use `runOnWindows()` for platform-specific behavior testing

## Integration with Existing Code

The test utilities integrate seamlessly with existing APEX packages and can be used alongside other testing frameworks and utilities in the codebase.