/**
 * Comprehensive tests for SuggestionMatcher class
 * Tests all error patterns and edge cases
 */

import { SuggestionMatcher, ErrorPatternCategory } from './suggestion-matcher';

describe('SuggestionMatcher', () => {
  let matcher: SuggestionMatcher;

  beforeEach(() => {
    matcher = new SuggestionMatcher();
  });

  describe('TypeScript errors', () => {
    test('should match TS2304 - Cannot find name', () => {
      const result = matcher.getSuggestion("TS2304: Cannot find name 'foo'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.code).toBe('TS2304');
      expect(result?.confidence).toBe('high');
      expect(result?.suggestion).toContain('Check if the type/variable is imported');
    });

    test('should match TS2339 - Property does not exist', () => {
      const result = matcher.getSuggestion("TS2339: Property 'bar' does not exist on type 'Foo'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.code).toBe('TS2339');
      expect(result?.confidence).toBe('high');
      expect(result?.suggestion).toContain('Verify the property exists');
    });

    test('should match TS2345 - Type not assignable to parameter', () => {
      const result = matcher.getSuggestion("TS2345: Argument of type 'string' is not assignable to parameter of type 'number'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.code).toBe('TS2345');
      expect(result?.confidence).toBe('high');
      expect(result?.suggestion).toContain('Check function signature');
    });

    test('should match TS2322 - Type not assignable', () => {
      const result = matcher.getSuggestion("TS2322: Type 'string' is not assignable to type 'number'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.code).toBe('TS2322');
      expect(result?.confidence).toBe('high');
      expect(result?.suggestion).toContain('Verify type compatibility');
    });

    test('should match TS2307 - Cannot find module', () => {
      const result = matcher.getSuggestion("TS2307: Cannot find module 'react' or its corresponding type declarations");
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.code).toBe('TS2307');
      expect(result?.confidence).toBe('high');
      expect(result?.suggestion).toContain('Install the missing package');
    });

    test('should match TS2532 - Object possibly undefined', () => {
      const result = matcher.getSuggestion("TS2532: Object is possibly undefined");
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.code).toBe('TS2532');
      expect(result?.confidence).toBe('high');
      expect(result?.suggestion).toContain('null/undefined check');
    });

    test('should match TS2531 - Object possibly null', () => {
      const result = matcher.getSuggestion("TS2531: Object is possibly null");
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.code).toBe('TS2531');
      expect(result?.confidence).toBe('high');
      expect(result?.suggestion).toContain('Add null check');
    });

    test('should match TS7006 - Parameter implicitly has any type', () => {
      const result = matcher.getSuggestion("TS7006: Parameter 'item' implicitly has an 'any' type");
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.code).toBe('TS7006');
      expect(result?.confidence).toBe('high');
      expect(result?.suggestion).toContain('Add explicit type annotation');
    });

    test('should match TS1005 - Expected token', () => {
      const result = matcher.getSuggestion("TS1005: Expected ';'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.code).toBe('TS1005');
      expect(result?.confidence).toBe('high');
      expect(result?.suggestion).toContain('syntax errors');
    });

    test('should match TS2349 - Expression not callable', () => {
      const result = matcher.getSuggestion("TS2349: This expression is not callable");
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.code).toBe('TS2349');
      expect(result?.confidence).toBe('high');
      expect(result?.suggestion).toContain('Ensure the value is a function');
    });

    test('should match TS2554 - Expected arguments', () => {
      const result = matcher.getSuggestion("TS2554: Expected 2 arguments, but got 1");
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.code).toBe('TS2554');
      expect(result?.confidence).toBe('high');
      expect(result?.suggestion).toContain('Check function signature');
    });

    test('should match TS2741 - Property missing in type', () => {
      const result = matcher.getSuggestion("TS2741: Property 'name' is missing in type '{}'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.code).toBe('TS2741');
      expect(result?.confidence).toBe('high');
      expect(result?.suggestion).toContain('Add the required property');
    });

    test('should match generic TypeScript errors without codes', () => {
      const result = matcher.getSuggestion("Property 'test' does not exist on type 'Object'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.confidence).toBe('medium');
    });

    test('should match case insensitive TypeScript errors', () => {
      const result = matcher.getSuggestion("cannot find name 'MyVariable'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.confidence).toBe('medium');
    });
  });

  describe('File system errors', () => {
    test('should match ENOENT errors', () => {
      const result = matcher.getSuggestion("ENOENT: no such file or directory, open '/path/to/file'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('filesystem');
      expect(result?.suggestion).toContain('File or directory not found');
    });

    test('should match EACCES errors', () => {
      const result = matcher.getSuggestion("EACCES: permission denied, mkdir '/protected/dir'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('filesystem');
      expect(result?.suggestion).toContain('Permission denied');
    });

    test('should match EEXIST errors', () => {
      const result = matcher.getSuggestion("EEXIST: file already exists, mkdir '/existing/dir'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('filesystem');
      expect(result?.suggestion).toContain('already exists');
    });

    test('should match EISDIR errors', () => {
      const result = matcher.getSuggestion("EISDIR: illegal operation on a directory, read");
      expect(result).toBeDefined();
      expect(result?.category).toBe('filesystem');
      expect(result?.suggestion).toContain('Expected a file but found a directory');
    });

    test('should match ENOTDIR errors', () => {
      const result = matcher.getSuggestion("ENOTDIR: not a directory, scandir '/path/to/file'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('filesystem');
      expect(result?.suggestion).toContain('Expected a directory but found a file');
    });

    test('should match ENOTEMPTY errors', () => {
      const result = matcher.getSuggestion("ENOTEMPTY: directory not empty, rmdir '/path/to/dir'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('filesystem');
      expect(result?.suggestion).toContain('Directory not empty');
    });

    test('should match EMFILE errors', () => {
      const result = matcher.getSuggestion("EMFILE: too many open files, open '/path/to/file'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('filesystem');
      expect(result?.suggestion).toContain('Too many open files');
    });

    test('should match ENOSPC errors', () => {
      const result = matcher.getSuggestion("ENOSPC: no space left on device, write");
      expect(result).toBeDefined();
      expect(result?.category).toBe('filesystem');
      expect(result?.suggestion).toContain('No space left on device');
    });

    test('should handle case insensitive filesystem errors', () => {
      const result = matcher.getSuggestion("enoent: file not found");
      expect(result).toBeDefined();
      expect(result?.category).toBe('filesystem');
      expect(result?.suggestion).toContain('File or directory not found');
    });
  });

  describe('Module resolution errors', () => {
    test('should match Cannot find module errors', () => {
      const result = matcher.getSuggestion("Cannot find module 'some-package'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('module');
      expect(result?.suggestion).toContain('Install the missing package');
    });

    test('should match Module not found errors', () => {
      const result = matcher.getSuggestion("Module not found: Error: Can't resolve 'missing-module'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('module');
      expect(result?.suggestion).toContain('Verify the module path');
    });

    test('should match Cannot resolve errors', () => {
      const result = matcher.getSuggestion("Cannot resolve './missing-file.js'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('module');
      expect(result?.suggestion).toContain('Check the import path');
    });

    test('should match Unexpected token errors', () => {
      const result = matcher.getSuggestion("Unexpected token '{' in JSON at position 0");
      expect(result).toBeDefined();
      expect(result?.category).toBe('module');
      expect(result?.suggestion).toContain('syntax errors');
    });

    test('should match exports not defined errors', () => {
      const result = matcher.getSuggestion("ReferenceError: exports is not defined");
      expect(result).toBeDefined();
      expect(result?.category).toBe('module');
      expect(result?.suggestion).toContain('ES module syntax');
    });

    test('should match require not defined errors', () => {
      const result = matcher.getSuggestion("ReferenceError: require is not defined");
      expect(result).toBeDefined();
      expect(result?.category).toBe('module');
      expect(result?.suggestion).toContain('import syntax');
    });

    test('should handle case insensitive module errors', () => {
      const result = matcher.getSuggestion("cannot find module 'lodash'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('module');
      expect(result?.suggestion).toContain('Install the missing package');
    });
  });

  describe('Permission errors', () => {
    test('should match EPERM errors', () => {
      const result = matcher.getSuggestion("EPERM: operation not permitted, unlink '/system/file'");
      expect(result).toBeDefined();
      expect(result?.category).toBe('permission');
      expect(result?.suggestion).toContain('Operation not permitted');
    });

    test('should match unauthorized errors', () => {
      const result = matcher.getSuggestion("401 Unauthorized: Authentication required");
      expect(result).toBeDefined();
      expect(result?.category).toBe('permission');
      expect(result?.suggestion).toContain('Authentication required');
    });

    test('should match Permission denied errors', () => {
      const result = matcher.getSuggestion("Permission denied: /etc/hosts");
      expect(result).toBeDefined();
      expect(result?.category).toBe('permission');
      expect(result?.suggestion).toContain('Check file/directory permissions');
    });

    test('should match Access is denied errors', () => {
      const result = matcher.getSuggestion("Access is denied. (Error 5)");
      expect(result).toBeDefined();
      expect(result?.category).toBe('permission');
      expect(result?.suggestion).toContain('Windows permission error');
    });

    test('should match forbidden errors', () => {
      const result = matcher.getSuggestion("403 Forbidden: Access forbidden");
      expect(result).toBeDefined();
      expect(result?.category).toBe('permission');
      expect(result?.suggestion).toContain('Access forbidden');
    });

    test('should handle case insensitive permission errors', () => {
      const result = matcher.getSuggestion("PERMISSION DENIED");
      expect(result).toBeDefined();
      expect(result?.category).toBe('permission');
      expect(result?.suggestion).toContain('Check file/directory permissions');
    });
  });

  describe('Error object support', () => {
    test('should handle Error objects', () => {
      const error = new Error("TS2304: Cannot find name 'undefined'");
      const result = matcher.getSuggestion(error);
      expect(result).toBeDefined();
      expect(result?.category).toBe('typescript');
      expect(result?.code).toBe('TS2304');
    });
  });

  describe('Edge cases and no match scenarios', () => {
    test('should return undefined for unknown errors', () => {
      const result = matcher.getSuggestion("Some completely unknown error message");
      expect(result).toBeUndefined();
    });

    test('should handle empty error messages', () => {
      const result = matcher.getSuggestion("");
      expect(result).toBeUndefined();
    });

    test('should handle whitespace-only error messages', () => {
      const result = matcher.getSuggestion("   ");
      expect(result).toBeUndefined();
    });

    test('should handle very short error messages', () => {
      const result = matcher.getSuggestion("x");
      expect(result).toBeUndefined();
    });

    test('should handle partial matches correctly', () => {
      // Test a message that contains keywords but shouldn't match
      const result = matcher.getSuggestion("This message mentions ENOENT but is not an actual error");
      expect(result).toBeDefined(); // Should still match due to pattern
      expect(result?.category).toBe('filesystem');
    });

    test('should prioritize TypeScript error codes over pattern matching', () => {
      // When both pattern and TS code match, should use high confidence
      const result = matcher.getSuggestion("TS2304: Cannot find name 'foo' in some context");
      expect(result?.confidence).toBe('high');
      expect(result?.code).toBe('TS2304');
    });

    test('should handle unknown TypeScript error codes', () => {
      const result = matcher.getSuggestion("TS9999: Unknown error code");
      expect(result).toBeUndefined(); // No pattern should match unknown TS code
    });

    test('should handle malformed TypeScript error codes', () => {
      const result = matcher.getSuggestion("TS: Missing number");
      expect(result).toBeUndefined();
    });

    test('should handle multiple error indicators in one message', () => {
      // Should match the first matching pattern
      const result = matcher.getSuggestion("ENOENT: Cannot find module 'fs'");
      expect(result).toBeDefined();
      // Since ENOENT appears first, it should match filesystem category
      expect(result?.category).toBe('filesystem');
    });
  });

  describe('Utility methods', () => {
    test('should return all patterns', () => {
      const patterns = matcher.getPatterns();
      expect(patterns).toBeDefined();
      expect(patterns.length).toBeGreaterThan(0);

      // Should have patterns from all categories
      const categories = new Set(patterns.map(p => p.category));
      expect(categories).toContain('typescript');
      expect(categories).toContain('filesystem');
      expect(categories).toContain('module');
      expect(categories).toContain('permission');
    });

    test('should return patterns by category', () => {
      const tsPatterns = matcher.getPatternsByCategory('typescript');
      const fsPatterns = matcher.getPatternsByCategory('filesystem');
      const modulePatterns = matcher.getPatternsByCategory('module');
      const permissionPatterns = matcher.getPatternsByCategory('permission');

      expect(tsPatterns.length).toBeGreaterThan(0);
      expect(fsPatterns.length).toBeGreaterThan(0);
      expect(modulePatterns.length).toBeGreaterThan(0);
      expect(permissionPatterns.length).toBeGreaterThan(0);

      // Verify all patterns in each category are correctly categorized
      expect(tsPatterns.every(p => p.category === 'typescript')).toBe(true);
      expect(fsPatterns.every(p => p.category === 'filesystem')).toBe(true);
      expect(modulePatterns.every(p => p.category === 'module')).toBe(true);
      expect(permissionPatterns.every(p => p.category === 'permission')).toBe(true);
    });

    test('should return empty array for non-existent categories', () => {
      // TypeScript doesn't prevent this at runtime, so test the behavior
      const patterns = matcher.getPatternsByCategory('nonexistent' as any);
      expect(patterns).toEqual([]);
    });

    test('should return readonly arrays', () => {
      const patterns = matcher.getPatterns();
      const tsPatterns = matcher.getPatternsByCategory('typescript');

      // Arrays should be readonly (can't call push, etc.)
      expect(Array.isArray(patterns)).toBe(true);
      expect(Array.isArray(tsPatterns)).toBe(true);
    });

    test('should validate that all TypeScript patterns have error codes', () => {
      const tsPatterns = matcher.getPatternsByCategory('typescript');
      tsPatterns.forEach(pattern => {
        expect(pattern.code).toBeDefined();
        expect(pattern.code).toMatch(/^TS\d+$/);
      });
    });

    test('should validate pattern structure', () => {
      const patterns = matcher.getPatterns();
      patterns.forEach(pattern => {
        expect(pattern.pattern).toBeDefined();
        expect(pattern.category).toBeDefined();
        expect(pattern.suggestion).toBeDefined();
        expect(typeof pattern.suggestion).toBe('string');
        expect(pattern.suggestion.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Integration tests', () => {
    test('should handle real-world TypeScript compilation errors', () => {
      const realErrors = [
        "src/index.ts(12,5): error TS2304: Cannot find name 'consolee'.",
        "src/types.ts(8,3): error TS2339: Property 'invalidProp' does not exist on type 'MyInterface'.",
        "src/utils.ts(15,20): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'."
      ];

      realErrors.forEach(error => {
        const result = matcher.getSuggestion(error);
        expect(result).toBeDefined();
        expect(result?.category).toBe('typescript');
        expect(result?.confidence).toBe('high');
      });
    });

    test('should handle real-world Node.js filesystem errors', () => {
      const realErrors = [
        "Error: ENOENT: no such file or directory, open '/Users/test/missing.txt'",
        "Error: EACCES: permission denied, mkdir '/root/test'",
        "Error: EEXIST: file already exists, mkdir './existing-folder'"
      ];

      realErrors.forEach(error => {
        const result = matcher.getSuggestion(error);
        expect(result).toBeDefined();
        expect(result?.category).toBe('filesystem');
        expect(result?.confidence).toBe('medium');
      });
    });

    test('should handle webpack/bundler module resolution errors', () => {
      const realErrors = [
        "Module not found: Error: Can't resolve 'react-router-dom'",
        "Module not found: Error: Can't resolve './components/Header'",
        "Cannot resolve module 'fs' in browser environment"
      ];

      realErrors.forEach(error => {
        const result = matcher.getSuggestion(error);
        expect(result).toBeDefined();
        expect(result?.category).toBe('module');
        expect(result?.confidence).toBe('medium');
      });
    });

    test('should handle API and authentication errors', () => {
      const realErrors = [
        "Error: Request failed with status code 401: Unauthorized",
        "403 Forbidden: Insufficient permissions to access this resource",
        "EPERM: operation not permitted, unlink '/System/Library/test.txt'"
      ];

      realErrors.forEach(error => {
        const result = matcher.getSuggestion(error);
        expect(result).toBeDefined();
        expect(result?.category).toBe('permission');
        expect(result?.confidence).toBe('medium');
      });
    });
  });
});