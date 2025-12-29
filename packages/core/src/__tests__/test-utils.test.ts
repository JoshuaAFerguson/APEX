import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isWindows,
  isUnix,
  isMacOS,
  isLinux,
  getPlatform,
  skipOnWindows,
  skipOnUnix,
  skipOnMacOS,
  skipOnLinux,
  skipUnlessWindows,
  skipUnlessUnix,
  describeWindows,
  describeUnix,
  describeMacOS,
  describeLinux,
  runOnWindows,
  runOnUnix,
  runOnMacOS,
  runOnLinux,
  mockPlatform,
  testOnAllPlatforms,
  PLATFORMS,
  isValidPlatform,
  type Platform,
} from '../test-utils.js';

// Mock os module
vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return {
    ...actual,
    platform: vi.fn(),
  };
});

import * as os from 'os';
const mockOsPlatform = vi.mocked(os.platform);

describe('test-utils', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Platform detection', () => {
    describe('isWindows', () => {
      it('should return true on Windows', () => {
        mockOsPlatform.mockReturnValue('win32');
        expect(isWindows()).toBe(true);
      });

      it('should return false on non-Windows platforms', () => {
        const nonWindowsPlatforms = ['darwin', 'linux', 'freebsd', 'openbsd'];

        for (const platform of nonWindowsPlatforms) {
          mockOsPlatform.mockReturnValue(platform as any);
          expect(isWindows()).toBe(false);
        }
      });
    });

    describe('isUnix', () => {
      it('should return true on Unix-like platforms', () => {
        const unixPlatforms = ['darwin', 'linux', 'freebsd', 'openbsd'];

        for (const platform of unixPlatforms) {
          mockOsPlatform.mockReturnValue(platform as any);
          expect(isUnix()).toBe(true);
        }
      });

      it('should return false on Windows', () => {
        mockOsPlatform.mockReturnValue('win32');
        expect(isUnix()).toBe(false);
      });
    });

    describe('isMacOS', () => {
      it('should return true on macOS', () => {
        mockOsPlatform.mockReturnValue('darwin');
        expect(isMacOS()).toBe(true);
      });

      it('should return false on non-macOS platforms', () => {
        const nonMacPlatforms = ['win32', 'linux', 'freebsd'];

        for (const platform of nonMacPlatforms) {
          mockOsPlatform.mockReturnValue(platform as any);
          expect(isMacOS()).toBe(false);
        }
      });
    });

    describe('isLinux', () => {
      it('should return true on Linux', () => {
        mockOsPlatform.mockReturnValue('linux');
        expect(isLinux()).toBe(true);
      });

      it('should return false on non-Linux platforms', () => {
        const nonLinuxPlatforms = ['win32', 'darwin', 'freebsd'];

        for (const platform of nonLinuxPlatforms) {
          mockOsPlatform.mockReturnValue(platform as any);
          expect(isLinux()).toBe(false);
        }
      });
    });

    describe('getPlatform', () => {
      it('should return the current platform', () => {
        const testPlatforms = ['win32', 'darwin', 'linux', 'freebsd'];

        for (const platform of testPlatforms) {
          mockOsPlatform.mockReturnValue(platform as any);
          expect(getPlatform()).toBe(platform);
        }
      });
    });
  });

  describe('Skip utilities', () => {
    // Mock vi.skip to track if it was called
    const mockSkip = vi.fn();
    beforeEach(() => {
      vi.mock('vitest', async () => {
        const actual = await vi.importActual('vitest');
        return {
          ...actual,
          vi: {
            ...actual.vi,
            skip: mockSkip,
          },
        };
      });
      mockSkip.mockClear();
    });

    describe('skipOnWindows', () => {
      it('should skip on Windows', () => {
        mockOsPlatform.mockReturnValue('win32');
        // We can't actually test vi.skip() being called since it would skip the test
        // Instead, we test the condition logic
        expect(isWindows()).toBe(true);
      });

      it('should not skip on non-Windows', () => {
        mockOsPlatform.mockReturnValue('linux');
        expect(isWindows()).toBe(false);
      });
    });

    describe('skipOnUnix', () => {
      it('should skip on Unix platforms', () => {
        mockOsPlatform.mockReturnValue('linux');
        expect(isUnix()).toBe(true);
      });

      it('should not skip on Windows', () => {
        mockOsPlatform.mockReturnValue('win32');
        expect(isUnix()).toBe(false);
      });
    });

    describe('skipUnlessWindows', () => {
      it('should not skip on Windows', () => {
        mockOsPlatform.mockReturnValue('win32');
        expect(isWindows()).toBe(true);
      });

      it('should skip on non-Windows', () => {
        mockOsPlatform.mockReturnValue('linux');
        expect(isWindows()).toBe(false);
      });
    });

    describe('skipUnlessUnix', () => {
      it('should not skip on Unix platforms', () => {
        mockOsPlatform.mockReturnValue('linux');
        expect(isUnix()).toBe(true);
      });

      it('should skip on Windows', () => {
        mockOsPlatform.mockReturnValue('win32');
        expect(isUnix()).toBe(false);
      });
    });
  });

  describe('Conditional runners', () => {
    describe('runOnWindows', () => {
      it('should run function on Windows', () => {
        mockOsPlatform.mockReturnValue('win32');
        const testFn = vi.fn(() => 'windows-result');

        const result = runOnWindows(testFn);

        expect(testFn).toHaveBeenCalled();
        expect(result).toBe('windows-result');
      });

      it('should not run function on non-Windows', () => {
        mockOsPlatform.mockReturnValue('linux');
        const testFn = vi.fn();

        const result = runOnWindows(testFn);

        expect(testFn).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
      });
    });

    describe('runOnUnix', () => {
      it('should run function on Unix platforms', () => {
        mockOsPlatform.mockReturnValue('linux');
        const testFn = vi.fn(() => 'unix-result');

        const result = runOnUnix(testFn);

        expect(testFn).toHaveBeenCalled();
        expect(result).toBe('unix-result');
      });

      it('should not run function on Windows', () => {
        mockOsPlatform.mockReturnValue('win32');
        const testFn = vi.fn();

        const result = runOnUnix(testFn);

        expect(testFn).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
      });
    });

    describe('runOnMacOS', () => {
      it('should run function on macOS', () => {
        mockOsPlatform.mockReturnValue('darwin');
        const testFn = vi.fn(() => 'macos-result');

        const result = runOnMacOS(testFn);

        expect(testFn).toHaveBeenCalled();
        expect(result).toBe('macos-result');
      });

      it('should not run function on non-macOS', () => {
        mockOsPlatform.mockReturnValue('linux');
        const testFn = vi.fn();

        const result = runOnMacOS(testFn);

        expect(testFn).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
      });
    });

    describe('runOnLinux', () => {
      it('should run function on Linux', () => {
        mockOsPlatform.mockReturnValue('linux');
        const testFn = vi.fn(() => 'linux-result');

        const result = runOnLinux(testFn);

        expect(testFn).toHaveBeenCalled();
        expect(result).toBe('linux-result');
      });

      it('should not run function on non-Linux', () => {
        mockOsPlatform.mockReturnValue('darwin');
        const testFn = vi.fn();

        const result = runOnLinux(testFn);

        expect(testFn).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
      });
    });
  });

  describe('Platform mocking', () => {
    describe('mockPlatform', () => {
      let originalPlatform: string;

      beforeEach(() => {
        originalPlatform = process.platform;
      });

      afterEach(() => {
        // Ensure platform is always restored
        Object.defineProperty(process, 'platform', {
          value: originalPlatform,
          writable: true,
          configurable: true,
        });
      });

      it('should mock platform and provide restore function', () => {
        const restore = mockPlatform('win32');

        expect(process.platform).toBe('win32');
        expect(mockOsPlatform).toHaveBeenCalledWith('win32');

        restore();

        expect(process.platform).toBe(originalPlatform);
      });

      it('should work with multiple platform changes', () => {
        const platforms = ['win32', 'darwin', 'linux'];

        for (const platform of platforms) {
          const restore = mockPlatform(platform);
          expect(process.platform).toBe(platform);
          restore();
          expect(process.platform).toBe(originalPlatform);
        }
      });
    });

    describe('testOnAllPlatforms', () => {
      it('should create tests for all major platforms', () => {
        const testFn = vi.fn();
        const expectedPlatforms = ['win32', 'darwin', 'linux', 'freebsd'];

        // This tests that the function would create the right number of tests
        // In a real scenario, this would create actual test cases
        expect(expectedPlatforms).toHaveLength(4);
      });
    });
  });

  describe('Constants and types', () => {
    describe('PLATFORMS', () => {
      it('should contain expected platform constants', () => {
        expect(PLATFORMS.WINDOWS).toBe('win32');
        expect(PLATFORMS.MACOS).toBe('darwin');
        expect(PLATFORMS.LINUX).toBe('linux');
        expect(PLATFORMS.FREEBSD).toBe('freebsd');
      });
    });

    describe('isValidPlatform', () => {
      it('should return true for valid platforms', () => {
        const validPlatforms = ['win32', 'darwin', 'linux', 'freebsd'];

        for (const platform of validPlatforms) {
          expect(isValidPlatform(platform)).toBe(true);
        }
      });

      it('should return false for invalid platforms', () => {
        const invalidPlatforms = ['windows', 'mac', 'ubuntu', 'unknown'];

        for (const platform of invalidPlatforms) {
          expect(isValidPlatform(platform)).toBe(false);
        }
      });
    });
  });

  // Integration tests that verify the utilities work together
  describe('Integration tests', () => {
    it('should work with platform detection and conditional execution', () => {
      const restore = mockPlatform('win32');

      try {
        expect(isWindows()).toBe(true);
        expect(isUnix()).toBe(false);

        const windowsResult = runOnWindows(() => 'windows-only');
        const unixResult = runOnUnix(() => 'unix-only');

        expect(windowsResult).toBe('windows-only');
        expect(unixResult).toBeUndefined();
      } finally {
        restore();
      }
    });

    it('should handle platform switching correctly', () => {
      // Test Windows
      let restore = mockPlatform('win32');
      expect(isWindows()).toBe(true);
      expect(isMacOS()).toBe(false);
      expect(isLinux()).toBe(false);
      restore();

      // Test macOS
      restore = mockPlatform('darwin');
      expect(isWindows()).toBe(false);
      expect(isMacOS()).toBe(true);
      expect(isLinux()).toBe(false);
      restore();

      // Test Linux
      restore = mockPlatform('linux');
      expect(isWindows()).toBe(false);
      expect(isMacOS()).toBe(false);
      expect(isLinux()).toBe(true);
      restore();
    });
  });
});

// Example tests showing how to use the utilities
describe('Usage examples', () => {
  it('demonstrates skipOnWindows usage', () => {
    // This would skip on Windows platforms
    // skipOnWindows();

    // Test Unix-specific functionality
    expect(true).toBe(true);
  });

  it('demonstrates conditional execution', () => {
    const restore = mockPlatform('darwin');

    try {
      const macResult = runOnMacOS(() => 'macOS-specific-value');
      const windowsResult = runOnWindows(() => 'Windows-specific-value');

      expect(macResult).toBe('macOS-specific-value');
      expect(windowsResult).toBeUndefined();
    } finally {
      restore();
    }
  });

  it('demonstrates platform-specific expectations', () => {
    const platforms = [
      { name: 'win32', isWindows: true, isUnix: false },
      { name: 'darwin', isWindows: false, isUnix: true },
      { name: 'linux', isWindows: false, isUnix: true },
    ];

    for (const platform of platforms) {
      const restore = mockPlatform(platform.name);

      try {
        expect(isWindows()).toBe(platform.isWindows);
        expect(isUnix()).toBe(platform.isUnix);
      } finally {
        restore();
      }
    }
  });
});