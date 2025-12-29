import * as os from 'os';
import { vi, describe } from 'vitest';

/**
 * Platform detection utilities for testing
 */

/**
 * Check if the current platform is Windows
 * @returns true if running on Windows, false otherwise
 */
export function isWindows(): boolean {
  return os.platform() === 'win32';
}

/**
 * Check if the current platform is Unix-like (Linux, macOS, FreeBSD, etc.)
 * @returns true if running on a Unix-like system, false otherwise
 */
export function isUnix(): boolean {
  return !isWindows();
}

/**
 * Check if the current platform is macOS
 * @returns true if running on macOS, false otherwise
 */
export function isMacOS(): boolean {
  return os.platform() === 'darwin';
}

/**
 * Check if the current platform is Linux
 * @returns true if running on Linux, false otherwise
 */
export function isLinux(): boolean {
  return os.platform() === 'linux';
}

/**
 * Get the platform name as a string
 * @returns The current platform name
 */
export function getPlatform(): string {
  return os.platform();
}

/**
 * Test skipping utilities
 */

/**
 * Skip a test if running on Windows
 * Call this at the beginning of a test to skip it on Windows platforms
 *
 * @example
 * ```typescript
 * it('should work on Unix only', () => {
 *   skipOnWindows();
 *   // test code that only works on Unix
 * });
 * ```
 */
export function skipOnWindows(): void {
  if (isWindows()) {
    vi.skip();
  }
}

/**
 * Skip a test if running on Unix-like systems (Linux, macOS, etc.)
 * Call this at the beginning of a test to skip it on Unix platforms
 *
 * @example
 * ```typescript
 * it('should work on Windows only', () => {
 *   skipOnUnix();
 *   // test code that only works on Windows
 * });
 * ```
 */
export function skipOnUnix(): void {
  if (isUnix()) {
    vi.skip();
  }
}

/**
 * Skip a test if running on macOS
 * Call this at the beginning of a test to skip it on macOS
 *
 * @example
 * ```typescript
 * it('should work on non-macOS systems only', () => {
 *   skipOnMacOS();
 *   // test code that doesn't work on macOS
 * });
 * ```
 */
export function skipOnMacOS(): void {
  if (isMacOS()) {
    vi.skip();
  }
}

/**
 * Skip a test if running on Linux
 * Call this at the beginning of a test to skip it on Linux
 *
 * @example
 * ```typescript
 * it('should work on non-Linux systems only', () => {
 *   skipOnLinux();
 *   // test code that doesn't work on Linux
 * });
 * ```
 */
export function skipOnLinux(): void {
  if (isLinux()) {
    vi.skip();
  }
}

/**
 * Skip a test unless running on Windows
 * Call this at the beginning of a test to only run it on Windows
 *
 * @example
 * ```typescript
 * it('should only run on Windows', () => {
 *   skipUnlessWindows();
 *   // test code that only works on Windows
 * });
 * ```
 */
export function skipUnlessWindows(): void {
  if (!isWindows()) {
    vi.skip();
  }
}

/**
 * Skip a test unless running on Unix-like systems
 * Call this at the beginning of a test to only run it on Unix platforms
 *
 * @example
 * ```typescript
 * it('should only run on Unix', () => {
 *   skipUnlessUnix();
 *   // test code that only works on Unix
 * });
 * ```
 */
export function skipUnlessUnix(): void {
  if (!isUnix()) {
    vi.skip();
  }
}

/**
 * Platform-specific describe blocks
 */

/**
 * Create a describe block that only runs on Windows
 *
 * @param name - Test suite name
 * @param fn - Test suite function
 *
 * @example
 * ```typescript
 * describeWindows('Windows-specific tests', () => {
 *   it('should test Windows behavior', () => {
 *     // Windows-only test code
 *   });
 * });
 * ```
 */
export function describeWindows(name: string, fn: () => void): void {
  if (isWindows()) {
    describe(`${name} (Windows)`, fn);
  } else {
    describe.skip(`${name} (Windows - skipped on ${getPlatform()})`, fn);
  }
}

/**
 * Create a describe block that only runs on Unix-like systems
 *
 * @param name - Test suite name
 * @param fn - Test suite function
 *
 * @example
 * ```typescript
 * describeUnix('Unix-specific tests', () => {
 *   it('should test Unix behavior', () => {
 *     // Unix-only test code
 *   });
 * });
 * ```
 */
export function describeUnix(name: string, fn: () => void): void {
  if (isUnix()) {
    describe(`${name} (Unix)`, fn);
  } else {
    describe.skip(`${name} (Unix - skipped on ${getPlatform()})`, fn);
  }
}

/**
 * Create a describe block that only runs on macOS
 *
 * @param name - Test suite name
 * @param fn - Test suite function
 *
 * @example
 * ```typescript
 * describeMacOS('macOS-specific tests', () => {
 *   it('should test macOS behavior', () => {
 *     // macOS-only test code
 *   });
 * });
 * ```
 */
export function describeMacOS(name: string, fn: () => void): void {
  if (isMacOS()) {
    describe(`${name} (macOS)`, fn);
  } else {
    describe.skip(`${name} (macOS - skipped on ${getPlatform()})`, fn);
  }
}

/**
 * Create a describe block that only runs on Linux
 *
 * @param name - Test suite name
 * @param fn - Test suite function
 *
 * @example
 * ```typescript
 * describeLinux('Linux-specific tests', () => {
 *   it('should test Linux behavior', () => {
 *     // Linux-only test code
 *   });
 * });
 * ```
 */
export function describeLinux(name: string, fn: () => void): void {
  if (isLinux()) {
    describe(`${name} (Linux)`, fn);
  } else {
    describe.skip(`${name} (Linux - skipped on ${getPlatform()})`, fn);
  }
}

/**
 * Platform-specific test conditionals
 */

/**
 * Run a function only if on Windows
 *
 * @param fn - Function to run on Windows
 * @returns Result of the function or undefined if not on Windows
 *
 * @example
 * ```typescript
 * it('should handle platform differences', () => {
 *   const windowsResult = runOnWindows(() => getWindowsSpecificValue());
 *   const unixResult = runOnUnix(() => getUnixSpecificValue());
 *
 *   if (windowsResult) {
 *     expect(windowsResult).toBe(expectedWindowsValue);
 *   }
 *   if (unixResult) {
 *     expect(unixResult).toBe(expectedUnixValue);
 *   }
 * });
 * ```
 */
export function runOnWindows<T>(fn: () => T): T | undefined {
  if (isWindows()) {
    return fn();
  }
  return undefined;
}

/**
 * Run a function only if on Unix-like systems
 *
 * @param fn - Function to run on Unix
 * @returns Result of the function or undefined if not on Unix
 *
 * @example
 * ```typescript
 * it('should handle platform differences', () => {
 *   const result = runOnUnix(() => getUnixSpecificValue());
 *   if (result) {
 *     expect(result).toBe(expectedValue);
 *   }
 * });
 * ```
 */
export function runOnUnix<T>(fn: () => T): T | undefined {
  if (isUnix()) {
    return fn();
  }
  return undefined;
}

/**
 * Run a function only if on macOS
 *
 * @param fn - Function to run on macOS
 * @returns Result of the function or undefined if not on macOS
 */
export function runOnMacOS<T>(fn: () => T): T | undefined {
  if (isMacOS()) {
    return fn();
  }
  return undefined;
}

/**
 * Run a function only if on Linux
 *
 * @param fn - Function to run on Linux
 * @returns Result of the function or undefined if not on Linux
 */
export function runOnLinux<T>(fn: () => T): T | undefined {
  if (isLinux()) {
    return fn();
  }
  return undefined;
}

/**
 * Platform mocking utilities for testing
 */

/**
 * Mock the platform for testing purposes
 *
 * @param platform - Platform to mock ('win32', 'darwin', 'linux', etc.)
 * @returns Function to restore the original platform
 *
 * @example
 * ```typescript
 * describe('cross-platform behavior', () => {
 *   it('should behave correctly on Windows', () => {
 *     const restore = mockPlatform('win32');
 *     expect(isWindows()).toBe(true);
 *     // test Windows behavior
 *     restore();
 *   });
 * });
 * ```
 */
export function mockPlatform(platform: string): () => void {
  const originalPlatform = process.platform;

  // Mock os.platform to return the desired platform
  vi.mocked(os.platform).mockReturnValue(platform as any);

  // Also mock process.platform for consistency
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    configurable: true,
  });

  return () => {
    // Restore original values
    vi.mocked(os.platform).mockReturnValue(originalPlatform);
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true,
    });
  };
}

/**
 * Test a function on all major platforms
 *
 * @param testName - Name of the test
 * @param testFn - Test function that receives the platform name
 *
 * @example
 * ```typescript
 * testOnAllPlatforms('should work on all platforms', (platform) => {
 *   expect(someFunction()).toBeTruthy();
 * });
 * ```
 */
export function testOnAllPlatforms(
  testName: string,
  testFn: (platform: string) => void | Promise<void>
): void {
  const platforms = ['win32', 'darwin', 'linux', 'freebsd'];

  for (const platform of platforms) {
    it(`${testName} on ${platform}`, async () => {
      const restore = mockPlatform(platform);
      try {
        await testFn(platform);
      } finally {
        restore();
      }
    });
  }
}

/**
 * Constants for common platform names
 */
export const PLATFORMS = {
  WINDOWS: 'win32',
  MACOS: 'darwin',
  LINUX: 'linux',
  FREEBSD: 'freebsd',
} as const;

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];

/**
 * Type guard to check if a string is a valid platform
 */
export function isValidPlatform(platform: string): platform is Platform {
  return Object.values(PLATFORMS).includes(platform as Platform);
}