import * as os from 'os';
import * as path from 'path';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getHomeDir, normalizePath, getConfigDir } from '../path-utils.js';

describe('path-utils', () => {
  describe('getHomeDir', () => {
    let originalHomedir: typeof os.homedir;

    beforeEach(() => {
      // Store the original function
      originalHomedir = os.homedir;
    });

    afterEach(() => {
      // Restore the original function
      vi.restoreAllMocks();
    });

    it('should return home directory when os.homedir() succeeds', () => {
      const mockHomeDir = '/home/testuser';
      vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);

      const result = getHomeDir();

      expect(result).toBe(mockHomeDir);
      expect(os.homedir).toHaveBeenCalledTimes(1);
    });

    it('should throw error when os.homedir() returns empty string', () => {
      vi.spyOn(os, 'homedir').mockReturnValue('');

      expect(() => getHomeDir()).toThrow('Unable to determine home directory');
    });

    it('should throw error when os.homedir() returns null', () => {
      // @ts-expect-error - Testing edge case with null return
      vi.spyOn(os, 'homedir').mockReturnValue(null);

      expect(() => getHomeDir()).toThrow('Unable to determine home directory');
    });

    it('should throw error when os.homedir() returns undefined', () => {
      // @ts-expect-error - Testing edge case with undefined return
      vi.spyOn(os, 'homedir').mockReturnValue(undefined);

      expect(() => getHomeDir()).toThrow('Unable to determine home directory');
    });

    it('should work with actual os.homedir() call', () => {
      // Test with real os.homedir() to ensure integration works
      const result = getHomeDir();

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe('normalizePath', () => {
    it('should normalize paths with mixed forward and backward slashes', () => {
      const testPath = 'some/path\\with\\mixed/slashes';
      const result = normalizePath(testPath);

      // The result should use the platform's native path separators
      expect(result).toBe(path.normalize(testPath));
    });

    it('should handle relative path components (..)', () => {
      const testPath = 'some/path/../other/path';
      const result = normalizePath(testPath);

      expect(result).toBe(path.normalize(testPath));
      expect(result).toMatch(/some[\\/]other[\\/]path/);
    });

    it('should handle current directory references (.)', () => {
      const testPath = './some/./path/.';
      const result = normalizePath(testPath);

      expect(result).toBe(path.normalize(testPath));
    });

    it('should handle multiple consecutive slashes', () => {
      const testPath = 'some///path//with////multiple/slashes';
      const result = normalizePath(testPath);

      expect(result).toBe(path.normalize(testPath));
      // Should not contain consecutive slashes
      expect(result).not.toMatch(/[\\/]{2,}/);
    });

    it('should handle empty path', () => {
      const result = normalizePath('');

      expect(result).toBe(path.normalize(''));
      expect(result).toBe('.');
    });

    it('should handle root paths', () => {
      if (process.platform === 'win32') {
        const windowsRoot = 'C:\\';
        const result = normalizePath(windowsRoot);
        expect(result).toBe(path.normalize(windowsRoot));
      } else {
        const unixRoot = '/';
        const result = normalizePath(unixRoot);
        expect(result).toBe(path.normalize(unixRoot));
      }
    });

    it('should handle paths with trailing separators', () => {
      const testPath = 'some/path/';
      const result = normalizePath(testPath);

      expect(result).toBe(path.normalize(testPath));
    });

    it('should throw error for non-string input', () => {
      // @ts-expect-error - Testing runtime error handling
      expect(() => normalizePath(123)).toThrow('Path must be a string');

      // @ts-expect-error - Testing runtime error handling
      expect(() => normalizePath(null)).toThrow('Path must be a string');

      // @ts-expect-error - Testing runtime error handling
      expect(() => normalizePath(undefined)).toThrow('Path must be a string');

      // @ts-expect-error - Testing runtime error handling
      expect(() => normalizePath({})).toThrow('Path must be a string');
    });

    it('should handle very long paths', () => {
      const longPath = 'a/'.repeat(100) + 'file.txt';
      const result = normalizePath(longPath);

      expect(result).toBe(path.normalize(longPath));
      expect(typeof result).toBe('string');
    });

    it('should handle paths with special characters', () => {
      const testPath = 'some/path with spaces/and-special_chars.123';
      const result = normalizePath(testPath);

      expect(result).toBe(path.normalize(testPath));
      expect(result).toContain('path with spaces');
      expect(result).toContain('and-special_chars.123');
    });
  });

  describe('getConfigDir', () => {
    let originalPlatform: string;
    let originalEnv: typeof process.env;

    beforeEach(() => {
      // Store original values
      originalPlatform = process.platform;
      originalEnv = process.env;

      // Clear environment variables that might affect the test
      process.env = { ...originalEnv };
      delete process.env.APPDATA;
    });

    afterEach(() => {
      // Restore original values
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      });
      process.env = originalEnv;
      vi.restoreAllMocks();
    });

    describe('Windows platform (win32)', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', {
          value: 'win32',
          writable: true
        });
      });

      it('should use APPDATA environment variable when available', () => {
        const mockAppData = 'C:\\Users\\testuser\\AppData\\Roaming';
        process.env.APPDATA = mockAppData;

        vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\testuser');

        const result = getConfigDir();

        expect(result).toBe(path.normalize(mockAppData));
      });

      it('should fall back to USERPROFILE\\AppData\\Roaming when APPDATA is not set', () => {
        const mockHomeDir = 'C:\\Users\\testuser';
        delete process.env.APPDATA;

        vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);

        const result = getConfigDir();
        const expected = path.join(mockHomeDir, 'AppData', 'Roaming');

        expect(result).toBe(path.normalize(expected));
      });

      it('should append application name when provided', () => {
        const mockAppData = 'C:\\Users\\testuser\\AppData\\Roaming';
        process.env.APPDATA = mockAppData;
        const appName = 'MyApp';

        vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\testuser');

        const result = getConfigDir(appName);
        const expected = path.join(mockAppData, appName);

        expect(result).toBe(path.normalize(expected));
      });

      it('should handle APPDATA with mixed slashes', () => {
        const mockAppData = 'C:/Users/testuser/AppData\\Roaming';
        process.env.APPDATA = mockAppData;

        vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\testuser');

        const result = getConfigDir();

        expect(result).toBe(path.normalize(mockAppData));
        // On Windows, should use backslashes
        expect(result).toMatch(/C:\\Users\\testuser\\AppData\\Roaming/);
      });
    });

    describe('Unix-like platforms (macOS, Linux)', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', {
          value: 'darwin', // macOS
          writable: true
        });
      });

      it('should use ~/.config for Unix-like systems', () => {
        const mockHomeDir = '/Users/testuser';

        vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);

        const result = getConfigDir();
        const expected = path.join(mockHomeDir, '.config');

        expect(result).toBe(path.normalize(expected));
        expect(result).toBe('/Users/testuser/.config');
      });

      it('should append application name when provided', () => {
        const mockHomeDir = '/home/testuser';
        const appName = 'myapp';

        vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);

        const result = getConfigDir(appName);
        const expected = path.join(mockHomeDir, '.config', appName);

        expect(result).toBe(path.normalize(expected));
        expect(result).toBe('/home/testuser/.config/myapp');
      });

      it('should work on Linux platform', () => {
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          writable: true
        });

        const mockHomeDir = '/home/linuxuser';

        vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);

        const result = getConfigDir();
        const expected = path.join(mockHomeDir, '.config');

        expect(result).toBe(path.normalize(expected));
        expect(result).toBe('/home/linuxuser/.config');
      });
    });

    describe('Cross-platform edge cases', () => {
      it('should handle empty application name', () => {
        const mockHomeDir = '/home/testuser';

        vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);

        const result = getConfigDir('');
        const expected = path.join(mockHomeDir, '.config', '');

        expect(result).toBe(path.normalize(expected));
      });

      it('should handle application name with path separators', () => {
        const mockHomeDir = '/home/testuser';
        const appName = 'my/nested/app';

        vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);

        const result = getConfigDir(appName);
        const expected = path.join(mockHomeDir, '.config', appName);

        expect(result).toBe(path.normalize(expected));
        expect(result).toMatch(/\.config[\\/]my[\\/]nested[\\/]app/);
      });

      it('should handle very long application names', () => {
        const mockHomeDir = '/home/testuser';
        const longAppName = 'a'.repeat(100);

        vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);

        const result = getConfigDir(longAppName);
        const expected = path.join(mockHomeDir, '.config', longAppName);

        expect(result).toBe(path.normalize(expected));
        expect(result).toContain(longAppName);
      });

      it('should handle special characters in application name', () => {
        const mockHomeDir = '/home/testuser';
        const specialAppName = 'my-app_with.special-chars123';

        vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);

        const result = getConfigDir(specialAppName);
        const expected = path.join(mockHomeDir, '.config', specialAppName);

        expect(result).toBe(path.normalize(expected));
        expect(result).toContain(specialAppName);
      });
    });

    describe('Integration with getHomeDir', () => {
      it('should propagate errors from getHomeDir', () => {
        vi.spyOn(os, 'homedir').mockReturnValue('');

        expect(() => getConfigDir()).toThrow('Unable to determine home directory');
      });

      it('should work with real home directory', () => {
        // Test integration with actual OS home directory
        const result = getConfigDir();

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        expect(path.isAbsolute(result)).toBe(true);

        if (process.platform === 'win32') {
          expect(result).toMatch(/AppData[\\/]Roaming$/);
        } else {
          expect(result).toMatch(/\.config$/);
        }
      });

      it('should work with real home directory and app name', () => {
        const appName = 'test-app';
        const result = getConfigDir(appName);

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        expect(path.isAbsolute(result)).toBe(true);
        expect(result).toContain(appName);

        if (process.platform === 'win32') {
          expect(result).toMatch(/AppData[\\/]Roaming[\\/]test-app$/);
        } else {
          expect(result).toMatch(/\.config[\\/]test-app$/);
        }
      });
    });
  });
});