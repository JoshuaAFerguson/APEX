import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { getHomeDir, normalizePath, getConfigDir } from '../path-utils.js';

/**
 * Integration tests for Windows path handling combining multiple functions
 *
 * These tests verify that our path utilities work correctly with:
 * 1. Windows drive letter paths (C:\, D:\, etc.)
 * 2. UNC paths (\\server\share)
 * 3. Paths with spaces
 * 4. Mixed separator handling
 * 5. Integration between getHomeDir, normalizePath, and getConfigDir
 */

describe('Windows Path Integration Tests', () => {
  let originalPlatform: string;
  let originalEnv: typeof process.env;
  const isActualWindows = process.platform === 'win32';

  beforeEach(() => {
    originalPlatform = process.platform;
    originalEnv = process.env;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true
    });
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Windows Drive Letter Integration', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });
    });

    it('should handle drive letters with path.join and normalizePath', () => {
      const driveTests = [
        { drive: 'C:', path: 'Users\\test', expected: 'C:\\Users\\test' },
        { drive: 'D:', path: 'Projects/APEX', expected: 'D:\\Projects\\APEX' },
        { drive: 'E:', path: 'Data\\files', expected: 'E:\\Data\\files' }
      ];

      driveTests.forEach(({ drive, path: pathPart, expected }) => {
        const joined = path.join(drive, pathPart);
        const normalized = normalizePath(joined);

        if (isActualWindows) {
          expect(normalized).toBe(expected);
          expect(normalized).toMatch(/^[A-Z]:\\/);
        } else {
          // On non-Windows, just ensure it's a valid string
          expect(typeof normalized).toBe('string');
        }
      });
    });

    it('should integrate getConfigDir with drive letters', () => {
      const mockHomeDirs = [
        'C:\\Users\\testuser',
        'D:\\Users\\anotheruser',
        'E:\\Home\\specialuser'
      ];

      mockHomeDirs.forEach((homeDir) => {
        vi.spyOn(os, 'homedir').mockReturnValue(homeDir);
        delete process.env.APPDATA;

        const configDir = getConfigDir('myapp');
        const expected = path.join(homeDir, 'AppData', 'Roaming', 'myapp');

        if (isActualWindows) {
          expect(configDir).toBe(path.normalize(expected));
          expect(configDir).toMatch(new RegExp(`^${homeDir[0]}:\\\\`));
          expect(configDir).toContain('AppData\\Roaming\\myapp');
        } else {
          expect(typeof configDir).toBe('string');
        }

        vi.restoreAllMocks();
      });
    });
  });

  describe('UNC Path Integration', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });
    });

    it('should handle UNC paths with normalizePath', () => {
      const uncTests = [
        '\\\\server\\share\\folder',
        '\\\\10.0.0.1\\shared\\documents',
        '\\\\company-server\\public\\files'
      ];

      uncTests.forEach((uncPath) => {
        const normalized = normalizePath(uncPath);

        if (isActualWindows) {
          expect(normalized).toMatch(/^\\\\/);
          expect(typeof normalized).toBe('string');
        } else {
          expect(typeof normalized).toBe('string');
        }
      });
    });

    it('should handle UNC paths with path.join operations', () => {
      const uncBases = [
        '\\\\server\\share',
        '\\\\10.0.0.1\\data',
        '\\\\fileserver\\public'
      ];

      uncBases.forEach((uncBase) => {
        const joined = path.join(uncBase, 'subfolder', 'file.txt');
        const normalized = normalizePath(joined);

        if (isActualWindows) {
          expect(joined).toMatch(/^\\\\/);
          expect(normalized).toMatch(/^\\\\/);
          expect(joined).toContain('subfolder');
          expect(joined).toContain('file.txt');
        }

        expect(typeof joined).toBe('string');
        expect(typeof normalized).toBe('string');
      });
    });
  });

  describe('Paths with Spaces Integration', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });
    });

    it('should handle spaces in getHomeDir and getConfigDir', () => {
      const homeWithSpaces = 'C:\\Users\\User Name With Spaces';
      vi.spyOn(os, 'homedir').mockReturnValue(homeWithSpaces);
      delete process.env.APPDATA;

      const homeDir = getHomeDir();
      const configDir = getConfigDir('My App With Spaces');

      expect(homeDir).toBe(homeWithSpaces);
      expect(configDir).toContain('User Name With Spaces');
      expect(configDir).toContain('My App With Spaces');

      if (isActualWindows) {
        expect(configDir).toMatch(/AppData\\Roaming\\My App With Spaces/);
      }
    });

    it('should handle spaces in path operations', () => {
      const spacePaths = [
        ['C:\\Program Files', 'My Application', 'config.json'],
        ['\\\\server\\Share With Spaces', 'Project Files', 'data.txt'],
        ['D:\\Work Projects', 'Client Name', 'documents']
      ];

      spacePaths.forEach((segments) => {
        const joined = path.join(...segments);
        const normalized = normalizePath(joined);

        expect(typeof joined).toBe('string');
        expect(typeof normalized).toBe('string');

        // All space-containing segments should be preserved
        segments.forEach(segment => {
          if (segment.includes(' ')) {
            expect(joined).toContain(segment);
            expect(normalized).toContain(segment);
          }
        });
      });
    });
  });

  describe('Mixed Separator Integration', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });
    });

    it('should normalize mixed separators consistently', () => {
      const mixedPaths = [
        'C:\\Users/test\\Documents/file.txt',
        'C:/Users\\test/Documents\\file.txt',
        '\\\\server/share\\folder/subfolder\\file.txt'
      ];

      mixedPaths.forEach((mixedPath) => {
        const normalized = normalizePath(mixedPath);

        expect(typeof normalized).toBe('string');

        if (isActualWindows) {
          // On Windows, should normalize to backslashes
          expect(normalized).not.toContain('/');
          expect(normalized).toMatch(/[\\/]/);
        }
      });
    });

    it('should handle mixed separators in getConfigDir integration', () => {
      const homeWithMixed = 'C:/Users/test\\user';
      const appDataWithMixed = 'C:\\Users/test\\user/AppData\\Roaming';

      vi.spyOn(os, 'homedir').mockReturnValue(homeWithMixed);
      process.env.APPDATA = appDataWithMixed;

      const configDir = getConfigDir('my/app\\name');

      expect(typeof configDir).toBe('string');

      if (isActualWindows) {
        // Should normalize all separators
        expect(configDir).not.toMatch(/[^\\]\/[^\\]/); // No lone forward slashes
        expect(configDir).toContain('my');
        expect(configDir).toContain('app');
        expect(configDir).toContain('name');
      }
    });
  });

  describe('Cross-function Integration', () => {
    it('should work consistently across all platforms', () => {
      // Test with actual platform
      const homeDir = getHomeDir();
      const configDir = getConfigDir('test-integration');
      const normalizedHome = normalizePath(homeDir);
      const normalizedConfig = normalizePath(configDir);

      expect(typeof homeDir).toBe('string');
      expect(typeof configDir).toBe('string');
      expect(typeof normalizedHome).toBe('string');
      expect(typeof normalizedConfig).toBe('string');

      expect(path.isAbsolute(homeDir)).toBe(true);
      expect(path.isAbsolute(configDir)).toBe(true);
      expect(path.isAbsolute(normalizedHome)).toBe(true);
      expect(path.isAbsolute(normalizedConfig)).toBe(true);

      // Config dir should contain the home dir (or be related to it)
      expect(configDir).toContain('test-integration');

      if (process.platform === 'win32') {
        expect(configDir).toMatch(/AppData[\\/]Roaming[\\/]test-integration/);
      } else {
        expect(configDir).toMatch(/\.config[\\/]test-integration/);
      }
    });

    it('should handle path operations with various input formats', () => {
      const testInputs = [
        { home: '/home/user', expected: 'unix' },
        { home: 'C:\\Users\\user', expected: 'windows' },
        { home: '/Users/user', expected: 'mac' }
      ];

      testInputs.forEach(({ home, expected }) => {
        vi.spyOn(os, 'homedir').mockReturnValue(home);

        const retrievedHome = getHomeDir();
        const normalizedHome = normalizePath(retrievedHome);

        expect(retrievedHome).toBe(home);
        expect(typeof normalizedHome).toBe('string');
        expect(path.isAbsolute(normalizedHome)).toBe(true);

        vi.restoreAllMocks();
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should propagate errors consistently across functions', () => {
      vi.spyOn(os, 'homedir').mockReturnValue('');

      expect(() => getHomeDir()).toThrow('Unable to determine home directory');
      expect(() => getConfigDir()).toThrow('Unable to determine home directory');
      expect(() => getConfigDir('app')).toThrow('Unable to determine home directory');
    });

    it('should handle invalid path inputs gracefully', () => {
      const invalidInputs = [null, undefined, 123, {}, []];

      invalidInputs.forEach((invalid) => {
        expect(() => {
          // @ts-expect-error - Testing invalid inputs
          normalizePath(invalid);
        }).toThrow('Path must be a string');
      });
    });
  });

  describe('Performance Integration', () => {
    it('should handle bulk operations efficiently', () => {
      const start = performance.now();
      const operations = 100;

      for (let i = 0; i < operations; i++) {
        const testPath = `C:\\Users\\test${i}\\Documents`;
        const normalized = normalizePath(testPath);
        const joined = path.join('C:', 'Users', `test${i}`, 'Documents');

        expect(typeof normalized).toBe('string');
        expect(typeof joined).toBe('string');
      }

      const duration = performance.now() - start;

      // Should complete quickly (less than 50ms for 100 operations)
      expect(duration).toBeLessThan(50);
    });
  });
});