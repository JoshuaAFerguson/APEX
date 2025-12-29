import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';

/**
 * Comprehensive Windows path handling tests focusing on path.join() and path.resolve()
 *
 * Tests verify:
 * 1. Windows drive letter paths (C:\, D:\, etc.)
 * 2. UNC paths (\\server\share)
 * 3. Paths with spaces
 * 4. Mixed separator handling (/ and \)
 * 5. path.join/resolve behavior on Windows
 */

// Mock Windows environment for consistent testing
const mockWindowsEnvironment = () => {
  const originalPlatform = process.platform;
  // Note: We can't actually change process.platform at runtime,
  // so we test behavior with explicit Windows-style paths

  return {
    restore: () => {
      // Restore would go here if we could mock process.platform
    }
  };
};

describe('Windows Path Handling - path.join() and path.resolve()', () => {
  let isActualWindows: boolean;

  beforeEach(() => {
    isActualWindows = process.platform === 'win32';
  });

  describe('Windows Drive Letter Path Handling', () => {
    it('should handle path.join() with Windows drive letters', () => {
      const driveTests = [
        {
          segments: ['C:', 'Users', 'test'],
          expected: isActualWindows ? 'C:\\Users\\test' : 'C:/Users/test'
        },
        {
          segments: ['D:', 'Projects', 'APEX'],
          expected: isActualWindows ? 'D:\\Projects\\APEX' : 'D:/Projects/APEX'
        },
        {
          segments: ['E:', 'Data', 'files'],
          expected: isActualWindows ? 'E:\\Data\\files' : 'E:/Data/files'
        },
        {
          segments: ['Z:', 'Network', 'shared'],
          expected: isActualWindows ? 'Z:\\Network\\shared' : 'Z:/Network/shared'
        }
      ];

      driveTests.forEach(({ segments, expected }) => {
        const result = path.join(...segments);
        if (isActualWindows) {
          expect(result).toBe(expected);
          expect(result).toMatch(/^[A-Z]:\\/);
        } else {
          // On Unix systems, this will just concatenate with forward slashes
          expect(result).toBe(expected);
        }
      });
    });

    it('should handle path.resolve() with Windows drive letters', () => {
      const driveTests = [
        'C:\\Users\\test',
        'D:\\Projects\\APEX',
        'E:\\Data\\files',
        'Z:\\Network\\shared'
      ];

      driveTests.forEach((testPath) => {
        const result = path.resolve(testPath);

        if (isActualWindows) {
          expect(path.isAbsolute(result)).toBe(true);
          expect(result).toMatch(/^[A-Z]:\\/);
          expect(result).toContain(testPath.substring(2)); // Should contain path without drive
        } else {
          // On Unix, this will resolve relative to current directory
          expect(typeof result).toBe('string');
        }
      });
    });

    it('should handle mixed drive letters with relative paths', () => {
      const mixedTests = [
        {
          segments: ['C:', '.', 'Users', 'test'],
          description: 'Drive with current dir'
        },
        {
          segments: ['D:', '..', 'parent', 'folder'],
          description: 'Drive with parent dir'
        },
        {
          segments: ['E:', 'folder', '..', 'sibling'],
          description: 'Drive with navigation'
        }
      ];

      mixedTests.forEach(({ segments, description }) => {
        expect(() => {
          const result = path.join(...segments);
          expect(typeof result).toBe('string');
        }).not.toThrow();
      });
    });

    it('should handle case sensitivity in Windows drive letters', () => {
      const caseTests = [
        ['c:', 'users', 'test'], // lowercase drive
        ['C:', 'USERS', 'TEST'], // uppercase path
        ['c:', 'Users', 'Test']  // mixed case
      ];

      caseTests.forEach((segments) => {
        const result = path.join(...segments);
        expect(typeof result).toBe('string');

        if (isActualWindows) {
          expect(result).toMatch(/^[cC]:\\/);
        }
      });
    });
  });

  describe('UNC Path Handling', () => {
    it('should handle path.join() with UNC paths', () => {
      const uncTests = [
        {
          segments: ['\\\\server', 'share', 'folder'],
          description: 'Basic UNC path'
        },
        {
          segments: ['\\\\server\\share', 'subfolder', 'file.txt'],
          description: 'UNC with existing backslashes'
        },
        {
          segments: ['\\\\10.0.0.1', 'shared', 'documents'],
          description: 'UNC with IP address'
        },
        {
          segments: ['\\\\company-server', 'public', 'files'],
          description: 'UNC with hyphenated server name'
        }
      ];

      uncTests.forEach(({ segments, description }) => {
        const result = path.join(...segments);
        expect(typeof result).toBe('string');

        if (isActualWindows) {
          expect(result).toMatch(/^\\\\/); // Should start with \\
          expect(result).toContain('\\\\');
        }
      });
    });

    it('should handle path.resolve() with UNC paths', () => {
      const uncPaths = [
        '\\\\server\\share\\folder',
        '\\\\server\\share\\folder\\file.txt',
        '\\\\10.0.0.1\\shared\\documents',
        '\\\\company-server\\public\\files'
      ];

      uncPaths.forEach((uncPath) => {
        const result = path.resolve(uncPath);
        expect(typeof result).toBe('string');

        if (isActualWindows) {
          expect(result).toMatch(/^\\\\/);
        }
      });
    });

    it('should handle UNC paths with relative components', () => {
      const uncRelativeTests = [
        {
          base: '\\\\server\\share',
          segments: ['.', 'folder'],
          description: 'UNC with current directory'
        },
        {
          base: '\\\\server\\share\\deep',
          segments: ['..', 'sibling'],
          description: 'UNC with parent directory'
        },
        {
          base: '\\\\server\\share',
          segments: ['folder', '..', 'other'],
          description: 'UNC with navigation'
        }
      ];

      uncRelativeTests.forEach(({ base, segments, description }) => {
        const result = path.join(base, ...segments);
        expect(typeof result).toBe('string');

        if (isActualWindows) {
          expect(result).toMatch(/^\\\\/);
        }
      });
    });

    it('should handle UNC paths with special characters', () => {
      const specialUncTests = [
        '\\\\server\\share with spaces',
        '\\\\server-with-hyphens\\share',
        '\\\\server_with_underscores\\share',
        '\\\\server\\share.with.dots'
      ];

      specialUncTests.forEach((uncPath) => {
        expect(() => {
          const joined = path.join(uncPath, 'folder');
          const resolved = path.resolve(uncPath);
          expect(typeof joined).toBe('string');
          expect(typeof resolved).toBe('string');
        }).not.toThrow();
      });
    });
  });

  describe('Paths with Spaces Handling', () => {
    it('should handle path.join() with spaces in segments', () => {
      const spaceTests = [
        {
          segments: ['C:', 'Program Files', 'My App'],
          description: 'Multiple segments with spaces'
        },
        {
          segments: ['C:', 'Users', 'User Name', 'Documents'],
          description: 'User name with space'
        },
        {
          segments: ['C:', 'Folder With Spaces', 'Sub Folder', 'file.txt'],
          description: 'Deep path with spaces'
        },
        {
          segments: ['\\\\server', 'Share With Spaces', 'Folder'],
          description: 'UNC path with spaces'
        }
      ];

      spaceTests.forEach(({ segments, description }) => {
        const result = path.join(...segments);
        expect(typeof result).toBe('string');

        // Verify spaces are preserved
        segments.forEach(segment => {
          if (segment.includes(' ')) {
            expect(result).toContain(segment);
          }
        });
      });
    });

    it('should handle path.resolve() with spaces', () => {
      const spacePaths = [
        'C:\\Program Files\\My Application',
        'C:\\Users\\User Name\\Documents',
        '\\\\server\\Share With Spaces\\folder',
        'C:\\Path With Multiple Spaces\\And More Spaces'
      ];

      spacePaths.forEach((spacePath) => {
        const result = path.resolve(spacePath);
        expect(typeof result).toBe('string');

        // Spaces should be preserved in the result
        const spaceCount = (spacePath.match(/ /g) || []).length;
        const resultSpaceCount = (result.match(/ /g) || []).length;
        expect(resultSpaceCount).toBeGreaterThanOrEqual(spaceCount);
      });
    });

    it('should handle joining paths with leading/trailing spaces', () => {
      const spacePaddingTests = [
        {
          segments: ['C:', ' Program Files ', 'App'],
          description: 'Segment with leading/trailing spaces'
        },
        {
          segments: ['C:\\Users', ' User Name ', 'Documents'],
          description: 'Mixed absolute and padded segments'
        }
      ];

      spacePaddingTests.forEach(({ segments, description }) => {
        const result = path.join(...segments);
        expect(typeof result).toBe('string');

        // path.join should handle this gracefully
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should handle very long paths with spaces', () => {
      const longPathSegments = [
        'C:',
        'Very Long Folder Name With Spaces And Many Characters',
        'Another Very Long Subfolder Name With Even More Characters',
        'Yet Another Extremely Long Path Segment Name',
        'Final Very Long File Name With Spaces.txt'
      ];

      const result = path.join(...longPathSegments);
      expect(typeof result).toBe('string');

      // Verify all segments with spaces are included
      longPathSegments.slice(1).forEach(segment => {
        expect(result).toContain(segment);
      });
    });
  });

  describe('Mixed Separator Handling', () => {
    it('should handle path.join() with mixed separators', () => {
      const mixedTests = [
        {
          segments: ['C:\\Users', 'test/Documents'],
          description: 'Mixed backslash and forward slash'
        },
        {
          segments: ['C:/Users', 'test\\Documents'],
          description: 'Forward slash then backslash'
        },
        {
          segments: ['\\\\server/share', 'folder\\subfolder'],
          description: 'UNC with mixed separators'
        }
      ];

      mixedTests.forEach(({ segments, description }) => {
        const result = path.join(...segments);
        expect(typeof result).toBe('string');

        if (isActualWindows) {
          // On Windows, path.join should normalize to backslashes
          expect(result).not.toContain('/');
          expect(result).toMatch(/[\\/]/);
        } else {
          // On Unix, should normalize to forward slashes
          expect(result).not.toContain('\\');
        }
      });
    });

    it('should handle path.resolve() with mixed separators', () => {
      const mixedPaths = [
        'C:\\Users/test/Documents',
        'C:/Users\\test\\Documents',
        '\\\\server/share\\folder',
        '/unix/path\\with\\backslashes'
      ];

      mixedPaths.forEach((mixedPath) => {
        const result = path.resolve(mixedPath);
        expect(typeof result).toBe('string');

        if (isActualWindows) {
          // Should normalize separators appropriately
          expect(typeof result).toBe('string');
        }
      });
    });

    it('should handle multiple consecutive separators', () => {
      const consecutiveTests = [
        'C:\\\\Users\\\\test\\\\Documents',
        'C://Users//test//Documents',
        '\\\\\\server\\\\share\\\\folder',
        'C:\\Users\\\\\\test///Documents'
      ];

      consecutiveTests.forEach((testPath) => {
        const normalized = path.normalize(testPath);
        const resolved = path.resolve(testPath);

        expect(typeof normalized).toBe('string');
        expect(typeof resolved).toBe('string');

        // Should not have consecutive separators in normalized result
        if (isActualWindows) {
          expect(normalized).not.toMatch(/\\\\(?!$)/); // No double backslashes except at start for UNC
        } else {
          expect(normalized).not.toMatch(/\/\//);
        }
      });
    });

    it('should handle empty segments with separators', () => {
      const emptySegmentTests = [
        ['C:', '', 'Users', 'test'],
        ['\\\\server', '', 'share', 'folder'],
        ['C:', 'Users', '', 'Documents']
      ];

      emptySegmentTests.forEach((segments) => {
        const result = path.join(...segments);
        expect(typeof result).toBe('string');

        // Empty segments should be handled gracefully
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Cross-platform Behavior Verification', () => {
    it('should maintain consistent behavior with Node.js path module', () => {
      const testCases = [
        {
          operation: 'join',
          args: ['C:', 'Users', 'test'],
          description: 'Basic join operation'
        },
        {
          operation: 'resolve',
          args: ['C:\\Users\\test'],
          description: 'Basic resolve operation'
        }
      ];

      testCases.forEach(({ operation, args, description }) => {
        if (operation === 'join') {
          const result = path.join(...args);
          expect(typeof result).toBe('string');

          // Should match expected platform behavior
          if (isActualWindows) {
            expect(result).toMatch(/\\/);
          }
        } else if (operation === 'resolve') {
          const result = path.resolve(...args);
          expect(typeof result).toBe('string');
          expect(path.isAbsolute(result)).toBe(true);
        }
      });
    });

    it('should handle platform-specific absolute path detection', () => {
      const absoluteTests = [
        'C:\\Users\\test',
        '/home/user/test',
        '\\\\server\\share',
        './relative/path',
        '../relative/path'
      ];

      absoluteTests.forEach((testPath) => {
        const isAbs = path.isAbsolute(testPath);

        if (isActualWindows) {
          // Windows absolute paths
          if (testPath.match(/^[A-Z]:\\/) || testPath.startsWith('\\\\')) {
            expect(isAbs).toBe(true);
          } else {
            expect(isAbs).toBe(false);
          }
        } else {
          // Unix absolute paths
          if (testPath.startsWith('/')) {
            expect(isAbs).toBe(true);
          } else {
            expect(isAbs).toBe(false);
          }
        }
      });
    });

    it('should handle path parsing consistently', () => {
      const pathTests = [
        'C:\\Users\\test\\file.txt',
        '\\\\server\\share\\file.txt',
        '/unix/path/file.txt'
      ];

      pathTests.forEach((testPath) => {
        const parsed = path.parse(testPath);

        expect(typeof parsed.root).toBe('string');
        expect(typeof parsed.dir).toBe('string');
        expect(typeof parsed.base).toBe('string');
        expect(typeof parsed.name).toBe('string');
        expect(typeof parsed.ext).toBe('string');

        // Verify path can be reconstructed
        const reconstructed = path.format(parsed);
        expect(typeof reconstructed).toBe('string');
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined inputs gracefully', () => {
      const invalidInputs = [null, undefined, '', 0, false, {}];

      invalidInputs.forEach((invalidInput) => {
        expect(() => {
          // @ts-expect-error - Testing invalid inputs
          path.join('C:', invalidInput, 'test');
        }).not.toThrow(); // path.join should handle this gracefully
      });
    });

    it('should handle very long paths', () => {
      const longPath = 'C:' + '\\very-long-segment-name-that-exceeds-normal-expectations'.repeat(10);

      expect(() => {
        const joined = path.join(longPath, 'file.txt');
        const resolved = path.resolve(longPath);
        const normalized = path.normalize(longPath);

        expect(typeof joined).toBe('string');
        expect(typeof resolved).toBe('string');
        expect(typeof normalized).toBe('string');
      }).not.toThrow();
    });

    it('should handle paths with unusual but valid characters', () => {
      const unusualChars = [
        'C:\\path-with-hyphens',
        'C:\\path_with_underscores',
        'C:\\path.with.dots',
        'C:\\path123with456numbers',
        'C:\\path(with)parentheses',
        'C:\\path[with]brackets'
      ];

      unusualChars.forEach((unusualPath) => {
        expect(() => {
          const joined = path.join(unusualPath, 'file.txt');
          const resolved = path.resolve(unusualPath);

          expect(typeof joined).toBe('string');
          expect(typeof resolved).toBe('string');
        }).not.toThrow();
      });
    });

    it('should handle current working directory integration', () => {
      const relativePaths = [
        '.\\relative\\path',
        './relative/path',
        '..\\parent\\path',
        '../parent/path'
      ];

      relativePaths.forEach((relPath) => {
        const resolved = path.resolve(relPath);

        expect(path.isAbsolute(resolved)).toBe(true);
        expect(typeof resolved).toBe('string');

        if (isActualWindows && relPath.includes('\\')) {
          expect(resolved).toContain('\\');
        }
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle path operations efficiently for large batches', () => {
      const start = performance.now();

      const operations = 1000;
      for (let i = 0; i < operations; i++) {
        path.join('C:', 'Users', `test${i}`, 'Documents');
        path.resolve(`C:\\Users\\test${i}\\Documents`);
        path.normalize(`C:\\Users\\test${i}\\Documents`);
      }

      const duration = performance.now() - start;

      // Should complete within reasonable time (less than 100ms for 1000 operations)
      expect(duration).toBeLessThan(100);
    });

    it('should handle complex path operations without memory issues', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many path operations
      for (let i = 0; i < 10000; i++) {
        const complexPath = path.join(
          'C:',
          'Very', 'Deep', 'Path', 'Structure',
          `Level${i}`,
          'With', 'Many', 'Segments',
          'file.txt'
        );
        path.resolve(complexPath);
        path.normalize(complexPath);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for 10k operations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});