import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { getHomeDir, normalizePath, getConfigDir } from './path-utils.js';

describe('path-utils', () => {
  describe('getHomeDir', () => {
    it('should return the home directory', () => {
      const homeDir = getHomeDir();
      expect(homeDir).toBeTruthy();
      expect(typeof homeDir).toBe('string');
      expect(path.isAbsolute(homeDir)).toBe(true);
    });

    it('should match os.homedir() result', () => {
      const homeDir = getHomeDir();
      expect(homeDir).toBe(os.homedir());
    });

    it('should throw error if home directory cannot be determined', () => {
      // Mock os.homedir to return empty string
      const originalHomedir = os.homedir;
      vi.spyOn(os, 'homedir').mockReturnValue('');

      expect(() => getHomeDir()).toThrow('Unable to determine home directory');

      // Restore original function
      os.homedir = originalHomedir;
    });
  });

  describe('normalizePath', () => {
    it('should normalize forward slashes on all platforms', () => {
      const result = normalizePath('path/to/file');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should normalize backward slashes on all platforms', () => {
      const result = normalizePath('path\\to\\file');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should resolve relative path components', () => {
      const result = normalizePath('path/to/../file');
      expect(result).toBe(path.normalize('path/to/../file'));
    });

    it('should handle mixed separators', () => {
      const result = normalizePath('path\\to/file');
      expect(result).toBe(path.normalize('path\\to/file'));
    });

    it('should throw error for non-string input', () => {
      expect(() => normalizePath(123 as any)).toThrow('Path must be a string');
      expect(() => normalizePath(null as any)).toThrow('Path must be a string');
      expect(() => normalizePath(undefined as any)).toThrow('Path must be a string');
    });

    it('should handle empty string', () => {
      const result = normalizePath('');
      expect(result).toBe(path.normalize(''));
    });
  });

  describe('getConfigDir', () => {
    let originalPlatform: string;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalPlatform = process.platform;
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: false,
      });
      process.env = originalEnv;
    });

    it('should return Windows config directory when on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
      });
      process.env.APPDATA = 'C:\\Users\\User\\AppData\\Roaming';

      const configDir = getConfigDir();
      expect(configDir).toBe('C:\\Users\\User\\AppData\\Roaming');
    });

    it('should fallback to USERPROFILE on Windows when APPDATA is not set', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
      });
      delete process.env.APPDATA;

      // Mock getHomeDir to return consistent result
      vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\User');

      const configDir = getConfigDir();
      expect(configDir).toBe(normalizePath('C:\\Users\\User\\AppData\\Roaming'));
    });

    it('should return Unix config directory when on Unix-like systems', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: false,
      });

      // Mock getHomeDir to return consistent result
      vi.spyOn(os, 'homedir').mockReturnValue('/home/user');

      const configDir = getConfigDir();
      expect(configDir).toBe('/home/user/.config');
    });

    it('should return macOS config directory when on macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: false,
      });

      // Mock getHomeDir to return consistent result
      vi.spyOn(os, 'homedir').mockReturnValue('/Users/user');

      const configDir = getConfigDir();
      expect(configDir).toBe('/Users/user/.config');
    });

    it('should append app name when provided', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: false,
      });

      // Mock getHomeDir to return consistent result
      vi.spyOn(os, 'homedir').mockReturnValue('/home/user');

      const configDir = getConfigDir('myapp');
      expect(configDir).toBe('/home/user/.config/myapp');
    });

    it('should append app name on Windows when provided', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
      });
      process.env.APPDATA = 'C:\\Users\\User\\AppData\\Roaming';

      const configDir = getConfigDir('myapp');
      expect(configDir).toBe(normalizePath('C:\\Users\\User\\AppData\\Roaming\\myapp'));
    });

    it('should handle app name with special characters', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: false,
      });

      // Mock getHomeDir to return consistent result
      vi.spyOn(os, 'homedir').mockReturnValue('/home/user');

      const configDir = getConfigDir('my-app_v2');
      expect(configDir).toBe('/home/user/.config/my-app_v2');
    });

    it('should handle empty app name', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: false,
      });

      // Mock getHomeDir to return consistent result
      vi.spyOn(os, 'homedir').mockReturnValue('/home/user');

      const configDir = getConfigDir('');
      expect(configDir).toBe('/home/user/.config');
    });

    it('should handle whitespace-only app name', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: false,
      });

      // Mock getHomeDir to return consistent result
      vi.spyOn(os, 'homedir').mockReturnValue('/home/user');

      const configDir = getConfigDir('   ');
      expect(configDir).toBe('/home/user/.config/   ');
    });

    it('should handle app name with path separators', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: false,
      });

      // Mock getHomeDir to return consistent result
      vi.spyOn(os, 'homedir').mockReturnValue('/home/user');

      const configDir = getConfigDir('my/app');
      expect(configDir).toBe('/home/user/.config/my/app');
    });
  });

  describe('integration tests', () => {
    it('should work together - getConfigDir using getHomeDir and normalizePath', () => {
      // This test verifies the functions work together correctly
      const configDir = getConfigDir('testapp');

      // Should be an absolute path
      expect(path.isAbsolute(configDir)).toBe(true);

      // Should contain the app name
      expect(configDir).toContain('testapp');

      // Should be normalized (no double slashes, etc.)
      expect(configDir).toBe(normalizePath(configDir));
    });

    it('should handle complex app names with normalizePath', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: false,
      });

      vi.spyOn(os, 'homedir').mockReturnValue('/home/user');

      const configDir = getConfigDir('../../../dangerous/path');
      const expectedPath = normalizePath('/home/user/.config/../../../dangerous/path');
      expect(configDir).toBe(expectedPath);
    });
  });
});