import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import {
  isWindows,
  isUnix,
  isMacOS,
  isLinux,
  getPlatform,
  mockPlatform,
  testOnAllPlatforms,
  PLATFORMS,
  isValidPlatform,
  type Platform
} from '../test-utils.js';

/**
 * Test suite for platform detection utilities
 */
describe('Platform Detection Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Platform Detection Functions', () => {
    it('should detect Windows platform correctly', () => {
      const restore = mockPlatform('win32');
      expect(isWindows()).toBe(true);
      expect(isUnix()).toBe(false);
      expect(isMacOS()).toBe(false);
      expect(isLinux()).toBe(false);
      restore();
    });

    it('should detect macOS platform correctly', () => {
      const restore = mockPlatform('darwin');
      expect(isWindows()).toBe(false);
      expect(isUnix()).toBe(true);
      expect(isMacOS()).toBe(true);
      expect(isLinux()).toBe(false);
      restore();
    });

    it('should detect Linux platform correctly', () => {
      const restore = mockPlatform('linux');
      expect(isWindows()).toBe(false);
      expect(isUnix()).toBe(true);
      expect(isMacOS()).toBe(false);
      expect(isLinux()).toBe(true);
      restore();
    });

    it('should detect FreeBSD as Unix but not Linux/macOS', () => {
      const restore = mockPlatform('freebsd');
      expect(isWindows()).toBe(false);
      expect(isUnix()).toBe(true);
      expect(isMacOS()).toBe(false);
      expect(isLinux()).toBe(false);
      restore();
    });

    it('should return correct platform string', () => {
      const restore = mockPlatform('win32');
      expect(getPlatform()).toBe('win32');
      restore();
    });

    it('should handle unknown platforms as Unix', () => {
      const restore = mockPlatform('some-unknown-platform');
      expect(isWindows()).toBe(false);
      expect(isUnix()).toBe(true);
      expect(isMacOS()).toBe(false);
      expect(isLinux()).toBe(false);
      restore();
    });
  });

  describe('Platform Mocking', () => {
    it('should mock platform correctly and restore original', () => {
      const originalPlatform = process.platform;

      const restore = mockPlatform('win32');
      expect(process.platform).toBe('win32');
      expect(isWindows()).toBe(true);

      restore();
      expect(process.platform).toBe(originalPlatform);
    });

    it('should handle multiple mocks and restorations', () => {
      const originalPlatform = process.platform;

      const restore1 = mockPlatform('win32');
      expect(isWindows()).toBe(true);

      const restore2 = mockPlatform('linux');
      expect(isLinux()).toBe(true);
      expect(isWindows()).toBe(false);

      restore2();
      restore1();
      expect(process.platform).toBe(originalPlatform);
    });

    it('should work with nested mocking', () => {
      const restore1 = mockPlatform('win32');
      expect(isWindows()).toBe(true);

      const restore2 = mockPlatform('darwin');
      expect(isMacOS()).toBe(true);
      expect(isWindows()).toBe(false);

      restore2();
      // Should return to win32, not original platform
      expect(isWindows()).toBe(true);

      restore1();
    });
  });

  describe('Cross-Platform Testing Utility', () => {
    it('should run test on all major platforms', () => {
      const testFn = vi.fn();

      testOnAllPlatforms('test all platforms', testFn);

      // Should have been called for each platform
      expect(testFn).toHaveBeenCalledTimes(4);
      expect(testFn).toHaveBeenCalledWith('win32');
      expect(testFn).toHaveBeenCalledWith('darwin');
      expect(testFn).toHaveBeenCalledWith('linux');
      expect(testFn).toHaveBeenCalledWith('freebsd');
    });

    it('should handle async test functions', async () => {
      const testFn = vi.fn().mockResolvedValue(undefined);

      testOnAllPlatforms('async test', testFn);

      // Wait for all async calls to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(testFn).toHaveBeenCalledTimes(4);
    });

    it('should restore platform after each test', () => {
      const originalPlatform = process.platform;
      const testFn = vi.fn();

      testOnAllPlatforms('platform restore test', testFn);

      expect(process.platform).toBe(originalPlatform);
    });
  });

  describe('Platform Constants', () => {
    it('should export correct platform constants', () => {
      expect(PLATFORMS.WINDOWS).toBe('win32');
      expect(PLATFORMS.MACOS).toBe('darwin');
      expect(PLATFORMS.LINUX).toBe('linux');
      expect(PLATFORMS.FREEBSD).toBe('freebsd');
    });

    it('should validate platform strings correctly', () => {
      expect(isValidPlatform('win32')).toBe(true);
      expect(isValidPlatform('darwin')).toBe(true);
      expect(isValidPlatform('linux')).toBe(true);
      expect(isValidPlatform('freebsd')).toBe(true);
      expect(isValidPlatform('invalid-platform')).toBe(false);
      expect(isValidPlatform('')).toBe(false);
    });
  });

  describe('Real Platform Detection', () => {
    it('should detect actual current platform without mocking', () => {
      // This test uses the real platform without mocking
      const actualPlatform = os.platform();
      const detectedPlatform = getPlatform();

      expect(detectedPlatform).toBe(actualPlatform);

      // Test platform-specific functions based on actual platform
      if (actualPlatform === 'win32') {
        expect(isWindows()).toBe(true);
        expect(isUnix()).toBe(false);
      } else {
        expect(isWindows()).toBe(false);
        expect(isUnix()).toBe(true);
      }

      if (actualPlatform === 'darwin') {
        expect(isMacOS()).toBe(true);
      } else {
        expect(isMacOS()).toBe(false);
      }

      if (actualPlatform === 'linux') {
        expect(isLinux()).toBe(true);
      } else {
        expect(isLinux()).toBe(false);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty platform string', () => {
      const restore = mockPlatform('');
      expect(isWindows()).toBe(false);
      expect(isUnix()).toBe(true); // Unknown platforms are treated as Unix
      restore();
    });

    it('should handle case sensitivity', () => {
      const restore = mockPlatform('WIN32');
      expect(isWindows()).toBe(false); // Should be case-sensitive
      expect(isUnix()).toBe(true);
      restore();
    });

    it('should handle null/undefined platform gracefully', () => {
      // Mock os.platform to return null/undefined
      const originalOsPlatform = os.platform;
      vi.mocked(os.platform).mockReturnValue(null as any);

      expect(() => isWindows()).not.toThrow();
      expect(() => isUnix()).not.toThrow();

      vi.mocked(os.platform).mockReturnValue(originalOsPlatform());
    });
  });

  describe('Performance', () => {
    it('should not make excessive platform calls', () => {
      const osPlatformSpy = vi.spyOn(os, 'platform');

      // Call platform detection functions multiple times
      for (let i = 0; i < 100; i++) {
        isWindows();
        isUnix();
        isMacOS();
        isLinux();
      }

      // Each call should call os.platform once
      expect(osPlatformSpy).toHaveBeenCalledTimes(400);

      osPlatformSpy.mockRestore();
    });
  });

  describe('Type Safety', () => {
    it('should provide correct TypeScript types', () => {
      const platform: Platform = PLATFORMS.WINDOWS;
      expect(platform).toBe('win32');

      // Type guard should narrow types correctly
      const testPlatform: string = 'win32';
      if (isValidPlatform(testPlatform)) {
        // testPlatform should now be typed as Platform
        expect(typeof testPlatform).toBe('string');
        expect(['win32', 'darwin', 'linux', 'freebsd']).toContain(testPlatform);
      }
    });
  });
});