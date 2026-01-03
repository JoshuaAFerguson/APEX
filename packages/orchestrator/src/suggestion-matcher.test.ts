/**
 * Tests for SuggestionMatcher class
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
    });

    test('should match generic TypeScript errors without codes', () => {
      const result = matcher.getSuggestion("Property 'test' does not exist on type 'Object'");
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

  describe('No match cases', () => {
    test('should return undefined for unknown errors', () => {
      const result = matcher.getSuggestion("Some completely unknown error message");
      expect(result).toBeUndefined();
    });
  });

  describe('Utility methods', () => {
    test('should return all patterns', () => {
      const patterns = matcher.getPatterns();
      expect(patterns).toBeDefined();
      expect(patterns.length).toBeGreaterThan(0);
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

      expect(tsPatterns.every(p => p.category === 'typescript')).toBe(true);
      expect(fsPatterns.every(p => p.category === 'filesystem')).toBe(true);
    });
  });
});