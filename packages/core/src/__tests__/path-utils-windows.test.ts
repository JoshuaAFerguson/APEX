import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { getHomeDir, normalizePath, getConfigDir } from '../path-utils.js';

// These tests will only run on actual Windows systems
// They validate that the functions work correctly with real Windows environment
const isActualWindows = process.platform === 'win32';

describe('path-utils Windows Integration Tests', () => {
  // Skip all tests if not on Windows
  beforeEach(function () {
    if (!isActualWindows) {
      this.skip();
    }
  });

  describe('Real Windows Environment Tests', () => {
    it('should get Windows home directory correctly', () => {
      const homeDir = getHomeDir();

      expect(typeof homeDir).toBe('string');
      expect(homeDir.length).toBeGreaterThan(0);
      expect(path.isAbsolute(homeDir)).toBe(true);

      // Windows home directory should typically be in C:\Users\
      expect(homeDir).toMatch(/^[A-Z]:\\/);
      expect(homeDir.toLowerCase()).toContain('users');
    });

    it('should normalize Windows paths correctly', () => {
      // Test various Windows path formats
      const testCases = [
        {
          input: 'C:\\Users\\test\\Documents',
          expected: 'C:\\Users\\test\\Documents'
        },
        {
          input: 'C:/Users/test/Documents',
          expected: 'C:\\Users\\test\\Documents'
        },
        {
          input: 'C:\\Users\\test\\..\\other\\Documents',
          expected: 'C:\\Users\\other\\Documents'
        },
        {
          input: '.\\relative\\path',
          expected: 'relative\\path'
        },
        {
          input: '..\\parent\\path',
          expected: '..\\parent\\path'
        },
        {
          input: 'C:\\\\Users\\\\test\\\\\\Documents',
          expected: 'C:\\Users\\test\\Documents'
        }
      ];

      for (const testCase of testCases) {
        const result = normalizePath(testCase.input);
        expect(result).toBe(testCase.expected);
      }
    });

    it('should get Windows config directory correctly', () => {
      const configDir = getConfigDir();

      expect(typeof configDir).toBe('string');
      expect(configDir.length).toBeGreaterThan(0);
      expect(path.isAbsolute(configDir)).toBe(true);

      // Should end with AppData\Roaming on Windows
      expect(configDir.toLowerCase()).toMatch(/appdata[\\/]roaming$/);
    });

    it('should get Windows config directory with app name correctly', () => {
      const appName = 'TestApp';
      const configDir = getConfigDir(appName);

      expect(configDir).toContain(appName);
      expect(configDir.toLowerCase()).toMatch(/appdata[\\/]roaming[\\/]testapp$/);
    });

    describe('Windows-specific path features', () => {
      it('should handle Windows drive letters correctly', () => {
        const drives = ['C:', 'D:', 'E:', 'Z:'];

        for (const drive of drives) {
          const testPath = `${drive}\\Users\\test`;
          const normalized = normalizePath(testPath);
          expect(normalized).toMatch(new RegExp(`^${drive.charAt(0)}:\\\\`));
        }
      });

      it('should handle UNC paths correctly', () => {
        const uncPaths = [
          '\\\\server\\share\\folder',
          '\\\\server\\share\\folder\\file.txt',
          '\\\\10.0.0.1\\shared\\documents'
        ];

        for (const uncPath of uncPaths) {
          const normalized = normalizePath(uncPath);
          expect(normalized).toMatch(/^\\\\/);
          expect(typeof normalized).toBe('string');
        }
      });

      it('should handle Windows reserved names correctly', () => {
        // Windows reserved device names
        const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM9', 'LPT1', 'LPT9'];

        for (const reserved of reservedNames) {
          const testPath = `C:\\temp\\${reserved}.txt`;
          const normalized = normalizePath(testPath);
          expect(normalized).toContain(reserved);
          expect(typeof normalized).toBe('string');
        }
      });

      it('should handle very long Windows paths', () => {
        // Create a path longer than the traditional MAX_PATH (260 characters)
        const longDir = 'very_long_directory_name_that_exceeds_normal_limits'.repeat(5);
        const longPath = `C:\\${longDir}\\file.txt`;

        // Should not throw, modern Windows can handle long paths with proper configuration
        expect(() => {
          const normalized = normalizePath(longPath);
          expect(typeof normalized).toBe('string');
        }).not.toThrow();
      });

      it('should handle Windows special characters in paths', () => {
        const specialChars = [
          'path with spaces',
          'path-with-hyphens',
          'path_with_underscores',
          'path.with.dots',
          'path123with456numbers',
          'path(with)parentheses',
          'path[with]brackets'
        ];

        for (const special of specialChars) {
          const testPath = `C:\\Users\\${special}\\Documents`;
          const normalized = normalizePath(testPath);
          expect(normalized).toContain(special);
          expect(normalized).toMatch(/^C:\\/);
        }
      });

      it('should handle case sensitivity appropriately', () => {
        // Windows paths are case-insensitive but case-preserving
        const testPaths = [
          'C:\\Users\\TEST\\Documents',
          'C:\\USERS\\test\\DOCUMENTS',
          'C:\\users\\Test\\documents'
        ];

        for (const testPath of testPaths) {
          const normalized = normalizePath(testPath);
          expect(normalized).toMatch(/^C:\\/);
          expect(typeof normalized).toBe('string');
          // Case should be preserved as provided
          expect(normalized).toBe(testPath);
        }
      });

      it('should handle relative paths from different drives', () => {
        // Test relative paths that might cross drives
        const relativePaths = [
          '.\\Documents\\file.txt',
          '..\\..\\Other\\folder',
          'subfolder\\..\\file.txt'
        ];

        for (const relPath of relativePaths) {
          const normalized = normalizePath(relPath);
          expect(typeof normalized).toBe('string');
          // Should not start with drive letter for relative paths
          expect(normalized).not.toMatch(/^[A-Z]:\\/);
        }
      });

      it('should handle Windows path length edge cases', () => {
        // Test paths of various lengths
        const pathLengths = [1, 10, 50, 100, 200, 260, 300];

        for (const length of pathLengths) {
          const pathContent = 'a'.repeat(Math.max(1, length - 10)); // Leave room for drive and separators
          const testPath = `C:\\${pathContent}`;

          if (length <= 260) {
            // Traditional MAX_PATH should always work
            const normalized = normalizePath(testPath);
            expect(normalized).toBe(testPath);
          } else {
            // Very long paths might work on modern Windows
            expect(() => {
              const normalized = normalizePath(testPath);
              expect(typeof normalized).toBe('string');
            }).not.toThrow();
          }
        }
      });
    });

    describe('Integration with Windows environment', () => {
      it('should work with real APPDATA environment variable', () => {
        const originalAppData = process.env.APPDATA;

        if (originalAppData) {
          const configDir = getConfigDir();
          expect(configDir).toContain(originalAppData);
          expect(path.isAbsolute(configDir)).toBe(true);
        }
      });

      it('should work with real USERPROFILE environment variable', () => {
        const originalUserProfile = process.env.USERPROFILE;

        if (originalUserProfile) {
          // Temporarily remove APPDATA to test fallback
          const originalAppData = process.env.APPDATA;
          delete process.env.APPDATA;

          try {
            const configDir = getConfigDir();
            expect(configDir).toContain(originalUserProfile);
            expect(configDir.toLowerCase()).toContain('appdata');
            expect(configDir.toLowerCase()).toContain('roaming');
          } finally {
            // Restore original environment
            if (originalAppData) {
              process.env.APPDATA = originalAppData;
            }
          }
        }
      });

      it('should handle Windows user profiles with special characters', () => {
        // Some Windows usernames might have special characters
        const testUserProfiles = [
          'C:\\Users\\user.name',
          'C:\\Users\\user-name',
          'C:\\Users\\user_name',
          'C:\\Users\\User Name', // Space in username
          'C:\\Users\\用户', // Unicode username (Chinese)
        ];

        for (const userProfile of testUserProfiles) {
          // Mock os.homedir to return our test profile
          const mockHomedir = vi.spyOn(os, 'homedir').mockReturnValue(userProfile);

          try {
            const homeDir = getHomeDir();
            expect(homeDir).toBe(userProfile);

            const configDir = getConfigDir();
            expect(configDir).toContain(userProfile);
          } finally {
            mockHomedir.mockRestore();
          }
        }
      });
    });

    describe('Windows path normalization edge cases', () => {
      it('should handle mixed separators consistently', () => {
        const mixedPaths = [
          'C:\\Users/test\\Documents/file.txt',
          'C:/Users\\test/Documents\\file.txt',
          '\\\\server/share\\folder/file.txt'
        ];

        for (const mixedPath of mixedPaths) {
          const normalized = normalizePath(mixedPath);
          // All separators should be backslashes on Windows
          expect(normalized).not.toContain('/');
          expect(normalized).toMatch(/[\\/]/);
        }
      });

      it('should handle trailing separators correctly', () => {
        const pathsWithTrailing = [
          'C:\\Users\\test\\',
          'C:\\Users\\test\\\\',
          'C:\\Users\\test/',
          'C:\\Users\\test//',
        ];

        for (const pathWithTrailing of pathsWithTrailing) {
          const normalized = normalizePath(pathWithTrailing);
          expect(typeof normalized).toBe('string');
          // Behavior should match Node.js path.normalize
          expect(normalized).toBe(path.normalize(pathWithTrailing));
        }
      });

      it('should handle current and parent directory references', () => {
        const pathsWithDots = [
          'C:\\Users\\test\\.\\Documents',
          'C:\\Users\\test\\..\\other',
          '.\\relative\\path',
          '..\\parent\\path',
          'C:\\Users\\test\\.\\..\\other\\.\\Documents'
        ];

        for (const pathWithDots of pathsWithDots) {
          const normalized = normalizePath(pathWithDots);
          expect(typeof normalized).toBe('string');
          // Should resolve . and .. correctly
          expect(normalized).not.toMatch(/[\\/]\.[^\\/.]/);
          expect(normalized).not.toMatch(/[\\/]\.\.[^\\/.]/);
        }
      });
    });

    describe('Performance on Windows file system', () => {
      it('should handle path operations efficiently', () => {
        const start = performance.now();

        // Perform multiple path operations
        for (let i = 0; i < 1000; i++) {
          normalizePath(`C:\\Users\\test${i}\\Documents`);
          getHomeDir();
          getConfigDir(`app${i}`);
        }

        const duration = performance.now() - start;

        // Should complete within reasonable time (less than 200ms for 1000 operations)
        expect(duration).toBeLessThan(200);
      });

      it('should handle very deep directory structures', () => {
        // Create a very deep path (approaching or exceeding traditional limits)
        const deepPath = 'C:\\' + 'folder\\'.repeat(50) + 'file.txt';

        const start = performance.now();
        const normalized = normalizePath(deepPath);
        const duration = performance.now() - start;

        expect(typeof normalized).toBe('string');
        expect(duration).toBeLessThan(10); // Should be very fast
      });
    });

    describe('Error handling on Windows', () => {
      it('should handle invalid characters gracefully', () => {
        // Windows doesn't allow certain characters in paths: < > : " | ? *
        const invalidChars = ['<', '>', '"', '|', '?', '*'];

        for (const invalidChar of invalidChars) {
          const pathWithInvalid = `C:\\Users\\test${invalidChar}file\\Documents`;

          // Should not throw, just normalize what it can
          expect(() => {
            const normalized = normalizePath(pathWithInvalid);
            expect(typeof normalized).toBe('string');
          }).not.toThrow();
        }
      });

      it('should handle colon in non-drive positions', () => {
        // Colon is only valid as part of drive letter
        const pathWithColon = 'C:\\Users\\test:file\\Documents';

        expect(() => {
          const normalized = normalizePath(pathWithColon);
          expect(typeof normalized).toBe('string');
        }).not.toThrow();
      });

      it('should provide meaningful errors for corrupted environment', () => {
        // Test with corrupted os.homedir() response
        const mockHomedir = vi.spyOn(os, 'homedir').mockReturnValue('');

        try {
          expect(() => getHomeDir()).toThrow('Unable to determine home directory');
        } finally {
          mockHomedir.mockRestore();
        }
      });
    });
  });
});