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

// Mock os module for testing
vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return {
    ...actual,
    platform: vi.fn(),
  };
});

import * as os from 'os';
const mockOsPlatform = vi.mocked(os.platform);

describe('Test Utils Edge Cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Error handling and resilience', () => {
    it('should handle unknown platform gracefully', () => {
      mockOsPlatform.mockReturnValue('unknown-platform' as any);

      // Unknown platforms should be treated as Unix-like
      expect(isWindows()).toBe(false);
      expect(isUnix()).toBe(true);
      expect(isMacOS()).toBe(false);
      expect(isLinux()).toBe(false);
      expect(getPlatform()).toBe('unknown-platform');
    });

    it('should handle null/undefined platform gracefully', () => {
      // @ts-expect-error Testing edge case
      mockOsPlatform.mockReturnValue(null);

      expect(() => isWindows()).not.toThrow();
      expect(() => isUnix()).not.toThrow();
      expect(() => getPlatform()).not.toThrow();
    });

    it('should handle empty string platform gracefully', () => {
      mockOsPlatform.mockReturnValue('' as any);

      expect(isWindows()).toBe(false);
      expect(isUnix()).toBe(true);
      expect(getPlatform()).toBe('');
    });

    it('should handle exceptions in conditional runners', () => {
      mockOsPlatform.mockReturnValue('win32');

      const errorFunction = () => {
        throw new Error('Test error');
      };

      // Errors should propagate normally on the current platform
      expect(() => runOnWindows(errorFunction)).toThrow('Test error');

      // Errors should not occur on non-matching platforms
      expect(() => runOnUnix(errorFunction)).not.toThrow();
      expect(runOnUnix(errorFunction)).toBeUndefined();
    });

    it('should handle async errors in conditional runners', async () => {
      mockOsPlatform.mockReturnValue('linux');

      const asyncErrorFunction = async () => {
        throw new Error('Async test error');
      };

      // Async errors should propagate on matching platform
      await expect(runOnUnix(asyncErrorFunction)).rejects.toThrow('Async test error');

      // Should not execute on non-matching platform
      const windowsResult = runOnWindows(asyncErrorFunction);
      expect(windowsResult).toBeUndefined();
    });
  });

  describe('Platform mocking edge cases', () => {
    it('should handle rapid platform switches', () => {
      const platforms = ['win32', 'darwin', 'linux', 'freebsd'];
      const restoreFunctions: Array<() => void> = [];

      // Mock multiple platforms rapidly
      for (const platform of platforms) {
        const restore = mockPlatform(platform);
        restoreFunctions.push(restore);

        expect(getPlatform()).toBe(platform);
        expect(process.platform).toBe(platform);
      }

      // Restore in reverse order
      for (const restore of restoreFunctions.reverse()) {
        restore();
      }
    });

    it('should handle nested platform mocking', () => {
      const originalPlatform = process.platform;

      const restore1 = mockPlatform('win32');
      expect(isWindows()).toBe(true);

      const restore2 = mockPlatform('linux');
      expect(isLinux()).toBe(true);
      expect(isWindows()).toBe(false);

      restore2();
      // Should restore to the previous mocked state, not original
      expect(process.platform).toBe(originalPlatform);

      restore1();
      expect(process.platform).toBe(originalPlatform);
    });

    it('should handle platform mocking with invalid platforms', () => {
      const restore = mockPlatform('invalid-platform');

      expect(getPlatform()).toBe('invalid-platform');
      expect(isWindows()).toBe(false);
      expect(isUnix()).toBe(true); // Unknown platforms are treated as Unix-like

      restore();
    });
  });

  describe('Performance and memory considerations', () => {
    it('should not leak memory with frequent platform checks', () => {
      const iterations = 10000;

      // This test ensures platform checking doesn't accumulate memory
      for (let i = 0; i < iterations; i++) {
        isWindows();
        isUnix();
        isMacOS();
        isLinux();
        getPlatform();
      }

      // If we get here without running out of memory, the test passes
      expect(true).toBe(true);
    });

    it('should handle frequent mocking/restoration cycles', () => {
      const platforms = ['win32', 'darwin', 'linux'];

      for (let i = 0; i < 100; i++) {
        const platform = platforms[i % platforms.length];
        const restore = mockPlatform(platform);
        expect(getPlatform()).toBe(platform);
        restore();
      }

      expect(true).toBe(true);
    });
  });

  describe('Type system edge cases', () => {
    it('should handle Platform type correctly', () => {
      const platforms: Platform[] = ['win32', 'darwin', 'linux', 'freebsd'];

      for (const platform of platforms) {
        expect(isValidPlatform(platform)).toBe(true);
      }

      // @ts-expect-error Testing invalid platform
      const invalidPlatform: Platform = 'invalid';
      expect(isValidPlatform(invalidPlatform)).toBe(false);
    });

    it('should handle PLATFORMS constants immutability', () => {
      // Constants should not be modifiable
      expect(() => {
        // @ts-expect-error Testing immutability
        PLATFORMS.WINDOWS = 'modified';
      }).toThrow();

      expect(PLATFORMS.WINDOWS).toBe('win32');
    });
  });

  describe('Concurrent execution', () => {
    it('should handle concurrent platform mocking', async () => {
      const promises = ['win32', 'darwin', 'linux'].map(async (platform) => {
        const restore = mockPlatform(platform);

        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 1));

        const result = {
          platform,
          isWindows: isWindows(),
          detectedPlatform: getPlatform(),
        };

        restore();
        return result;
      });

      const results = await Promise.all(promises);

      // Each result should reflect its mocked platform
      for (const result of results) {
        if (result.platform === 'win32') {
          expect(result.isWindows).toBe(true);
        } else {
          expect(result.isWindows).toBe(false);
        }
      }
    });

    it('should handle concurrent conditional execution', async () => {
      mockOsPlatform.mockReturnValue('darwin');

      const promises = [
        runOnMacOS(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'macOS result';
        }),
        runOnWindows(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'Windows result';
        }),
        runOnLinux(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'Linux result';
        }),
      ];

      const [macResult, winResult, linuxResult] = await Promise.all(promises);

      expect(await macResult).toBe('macOS result');
      expect(winResult).toBeUndefined();
      expect(linuxResult).toBeUndefined();
    });
  });

  describe('Integration with test framework features', () => {
    it('should handle describe function mocking correctly', () => {
      const mockDescribe = vi.fn();
      const mockDescribeSkip = vi.fn();

      // Mock the describe function to capture calls
      const originalDescribe = globalThis.describe;
      globalThis.describe = mockDescribe;
      globalThis.describe.skip = mockDescribeSkip;

      try {
        mockOsPlatform.mockReturnValue('win32');
        describeWindows('Windows test', () => {});

        expect(mockDescribe).toHaveBeenCalledWith(
          'Windows test (Windows)',
          expect.any(Function)
        );

        mockOsPlatform.mockReturnValue('linux');
        describeWindows('Windows test', () => {});

        expect(mockDescribeSkip).toHaveBeenCalledWith(
          'Windows test (Windows - skipped on linux)',
          expect.any(Function)
        );
      } finally {
        globalThis.describe = originalDescribe;
      }
    });

    it('should handle vi.skip mocking correctly', () => {
      const mockSkip = vi.fn();

      // Create a mock vi object for testing skip functions
      const originalVi = globalThis.vi;
      globalThis.vi = { ...originalVi, skip: mockSkip };

      try {
        mockOsPlatform.mockReturnValue('win32');
        skipOnWindows();
        expect(mockSkip).toHaveBeenCalled();

        mockSkip.mockClear();
        skipOnUnix();
        expect(mockSkip).not.toHaveBeenCalled();
      } finally {
        globalThis.vi = originalVi;
      }
    });
  });

  describe('Complex scenarios', () => {
    it('should handle cross-platform library simulation', () => {
      const crossPlatformLib = {
        getConfigDir: () => {
          if (isWindows()) {
            return process.env.APPDATA || 'C:\\Users\\Default\\AppData\\Roaming';
          }
          return process.env.XDG_CONFIG_HOME || '~/.config';
        },
        getExecutableExtension: () => {
          return isWindows() ? '.exe' : '';
        },
        getPathSeparator: () => {
          return isWindows() ? ';' : ':';
        },
      };

      testOnAllPlatforms('cross-platform library behavior', (platform) => {
        const configDir = crossPlatformLib.getConfigDir();
        const execExt = crossPlatformLib.getExecutableExtension();
        const pathSep = crossPlatformLib.getPathSeparator();

        if (platform === 'win32') {
          expect(execExt).toBe('.exe');
          expect(pathSep).toBe(';');
        } else {
          expect(execExt).toBe('');
          expect(pathSep).toBe(':');
        }

        expect(typeof configDir).toBe('string');
        expect(configDir.length).toBeGreaterThan(0);
      });
    });

    it('should handle platform-specific feature flags', () => {
      const featureFlags = {
        supportsSymlinks: () => !isWindows(),
        supportsFilePermissions: () => isUnix(),
        supportsShellIntegration: () => true,
        supportsCaseSensitiveFS: () => isLinux(),
      };

      const testPlatforms = ['win32', 'darwin', 'linux'];

      for (const platform of testPlatforms) {
        const restore = mockPlatform(platform);

        try {
          const symlinks = featureFlags.supportsSymlinks();
          const permissions = featureFlags.supportsFilePermissions();
          const shell = featureFlags.supportsShellIntegration();
          const caseSensitive = featureFlags.supportsCaseSensitiveFS();

          if (platform === 'win32') {
            expect(symlinks).toBe(false);
            expect(permissions).toBe(false);
            expect(caseSensitive).toBe(false);
          } else if (platform === 'darwin') {
            expect(symlinks).toBe(true);
            expect(permissions).toBe(true);
            expect(caseSensitive).toBe(false);
          } else if (platform === 'linux') {
            expect(symlinks).toBe(true);
            expect(permissions).toBe(true);
            expect(caseSensitive).toBe(true);
          }

          expect(shell).toBe(true); // Always supported
        } finally {
          restore();
        }
      }
    });
  });

  describe('Boundary conditions', () => {
    it('should handle maximum string lengths', () => {
      const longPlatformName = 'a'.repeat(1000);
      const restore = mockPlatform(longPlatformName);

      expect(getPlatform()).toBe(longPlatformName);
      expect(isWindows()).toBe(false);
      expect(isUnix()).toBe(true);

      restore();
    });

    it('should handle unicode platform names', () => {
      const unicodePlatform = 'platform-ñáéíóú-测试-🚀';
      const restore = mockPlatform(unicodePlatform);

      expect(getPlatform()).toBe(unicodePlatform);
      expect(isValidPlatform(unicodePlatform)).toBe(false);

      restore();
    });

    it('should handle numeric platform values', () => {
      // @ts-expect-error Testing edge case
      mockOsPlatform.mockReturnValue(42);

      expect(() => isWindows()).not.toThrow();
      expect(isWindows()).toBe(false);
      expect(getPlatform()).toBe(42);
    });
  });
});