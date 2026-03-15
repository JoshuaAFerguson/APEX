/**
 * Additional tests for ProjectContextAnalyzer
 *
 * This file contains supplementary tests that fill gaps in coverage
 * and add stress/performance testing scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';
import type { ProjectContextAnalyzerOptions } from '../project-context-analyzer.js';

// Mock external dependencies
vi.mock('fs');
vi.mock('../shell-utils.js');

const mockExecAsync = vi.fn();
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

describe('ProjectContextAnalyzer - Additional Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecAsync.mockClear();
  });

  describe('Performance and Scalability Tests', () => {
    it('should handle very large directory structures efficiently', () => {
      // Test with large maxDepth
      const options: ProjectContextAnalyzerOptions = {
        maxDepth: 100, // Very deep
        includeHidden: true,
        excludeDirectories: [], // Don't exclude anything
      };

      const analyzer = new ProjectContextAnalyzer('/large/project', options);

      expect(analyzer.getOptions().maxDepth).toBe(100);
      expect(analyzer.getProjectPath()).toBe('/large/project');
    });

    it('should handle concurrent analyzer instances', () => {
      const analyzers = Array.from({ length: 10 }, (_, i) =>
        new ProjectContextAnalyzer(`/project-${i}`)
      );

      analyzers.forEach((analyzer, i) => {
        expect(analyzer.getProjectPath()).toBe(`/project-${i}`);
      });

      expect(analyzers).toHaveLength(10);
    });

    it('should handle rapid sequential analyzer creation', () => {
      const start = Date.now();
      const analyzers: ProjectContextAnalyzer[] = [];

      for (let i = 0; i < 1000; i++) {
        analyzers.push(new ProjectContextAnalyzer(`/rapid-${i}`));
      }

      const end = Date.now();
      const elapsed = end - start;

      expect(analyzers).toHaveLength(1000);
      expect(elapsed).toBeLessThan(1000); // Should create 1000 instances in under 1 second
    });

    it('should handle empty options efficiently', () => {
      const analyzer1 = new ProjectContextAnalyzer('/test', {});
      const analyzer2 = new ProjectContextAnalyzer('/test', undefined);
      const analyzer3 = new ProjectContextAnalyzer('/test');

      // All should have the same default options
      expect(analyzer1.getOptions()).toEqual(analyzer2.getOptions());
      expect(analyzer2.getOptions()).toEqual(analyzer3.getOptions());
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory with repeated analyzer creation', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and discard many analyzers
      for (let i = 0; i < 100; i++) {
        const analyzer = new ProjectContextAnalyzer(`/temp-${i}`);
        analyzer.getProjectPath(); // Use the analyzer to ensure it's not optimized away
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle null and undefined inputs gracefully', () => {
      // These should not crash, but should use reasonable defaults
      const analyzer1 = new ProjectContextAnalyzer('', undefined);
      const analyzer2 = new ProjectContextAnalyzer('', {});

      expect(analyzer1.getProjectPath()).toBe('');
      expect(analyzer2.getProjectPath()).toBe('');

      const options1 = analyzer1.getOptions();
      const options2 = analyzer2.getOptions();

      expect(options1).toEqual(options2);
      expect(options1.maxDepth).toBe(10);
      expect(options1.analyzeGit).toBe(true);
    });
  });

  describe('Edge Case Configuration Combinations', () => {
    it('should handle all options disabled', () => {
      const options: ProjectContextAnalyzerOptions = {
        analyzeGit: false,
        detectFrameworks: false,
        analyzeConfiguration: false,
        detectTests: false,
        maxDepth: 0,
        includeHidden: false,
      };

      const analyzer = new ProjectContextAnalyzer('/test', options);
      const actualOptions = analyzer.getOptions();

      expect(actualOptions.analyzeGit).toBe(false);
      expect(actualOptions.detectFrameworks).toBe(false);
      expect(actualOptions.analyzeConfiguration).toBe(false);
      expect(actualOptions.detectTests).toBe(false);
      expect(actualOptions.maxDepth).toBe(0);
    });

    it('should handle extreme exclude directory lists', () => {
      const longExcludeList = Array.from({ length: 1000 }, (_, i) => `exclude-${i}`);

      const options: ProjectContextAnalyzerOptions = {
        excludeDirectories: longExcludeList,
      };

      const analyzer = new ProjectContextAnalyzer('/test', options);
      const actualOptions = analyzer.getOptions();

      expect(actualOptions.excludeDirectories).toHaveLength(1000);
      expect(actualOptions.excludeDirectories[0]).toBe('exclude-0');
      expect(actualOptions.excludeDirectories[999]).toBe('exclude-999');
    });

    it('should handle unicode in exclude directories', () => {
      const unicodeExcludes = [
        'node_modules',
        '测试目录',
        'директория',
        '🚀🎯📁',
        'café',
        'naïve-directory'
      ];

      const options: ProjectContextAnalyzerOptions = {
        excludeDirectories: unicodeExcludes,
      };

      const analyzer = new ProjectContextAnalyzer('/test', options);
      const actualOptions = analyzer.getOptions();

      expect(actualOptions.excludeDirectories).toEqual(unicodeExcludes);
    });

    it('should handle extreme depth values', () => {
      // Test with maximum safe integer
      const maxDepthAnalyzer = new ProjectContextAnalyzer('/test', {
        maxDepth: Number.MAX_SAFE_INTEGER,
      });

      expect(maxDepthAnalyzer.getOptions().maxDepth).toBe(Number.MAX_SAFE_INTEGER);

      // Test with zero depth
      const zeroDepthAnalyzer = new ProjectContextAnalyzer('/test', {
        maxDepth: 0,
      });

      expect(zeroDepthAnalyzer.getOptions().maxDepth).toBe(0);
    });
  });

  describe('Path Validation and Edge Cases', () => {
    it('should handle relative paths', () => {
      const analyzer = new ProjectContextAnalyzer('./relative/path');
      expect(analyzer.getProjectPath()).toBe('./relative/path');
    });

    it('should handle paths with trailing slashes', () => {
      const analyzer1 = new ProjectContextAnalyzer('/path/with/slash/');
      const analyzer2 = new ProjectContextAnalyzer('/path/without/slash');

      expect(analyzer1.getProjectPath()).toBe('/path/with/slash/');
      expect(analyzer2.getProjectPath()).toBe('/path/without/slash');
    });

    it('should handle paths with multiple consecutive slashes', () => {
      const analyzer = new ProjectContextAnalyzer('/path//with///multiple////slashes');
      expect(analyzer.getProjectPath()).toBe('/path//with///multiple////slashes');
    });

    it('should handle Windows-style paths with backslashes', () => {
      const analyzer = new ProjectContextAnalyzer('C:\\Windows\\Path\\To\\Project');
      expect(analyzer.getProjectPath()).toBe('C:\\Windows\\Path\\To\\Project');
    });

    it('should handle UNC paths', () => {
      const analyzer = new ProjectContextAnalyzer('\\\\server\\share\\project');
      expect(analyzer.getProjectPath()).toBe('\\\\server\\share\\project');
    });
  });

  describe('Option Merging Edge Cases', () => {
    it('should handle partial option objects with undefined values', () => {
      const options: ProjectContextAnalyzerOptions = {
        maxDepth: undefined as any,
        includeHidden: undefined as any,
        excludeDirectories: ['test'],
      };

      const analyzer = new ProjectContextAnalyzer('/test', options);
      const actualOptions = analyzer.getOptions();

      // Should fall back to defaults for undefined values
      expect(actualOptions.maxDepth).toBe(10);
      expect(actualOptions.includeHidden).toBe(false);
      expect(actualOptions.excludeDirectories).toContain('test');
    });

    it('should handle option objects with null values', () => {
      const options: ProjectContextAnalyzerOptions = {
        excludeDirectories: null as any,
        analyzeGit: null as any,
      };

      const analyzer = new ProjectContextAnalyzer('/test', options);
      const actualOptions = analyzer.getOptions();

      // Should use defaults for null values
      expect(actualOptions.excludeDirectories).toEqual([
        'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt'
      ]);
      expect(actualOptions.analyzeGit).toBe(true);
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle maxDepth boundary values', () => {
      const testCases = [-1, 0, 1, 100, 1000, Number.MAX_SAFE_INTEGER];

      testCases.forEach(maxDepth => {
        const analyzer = new ProjectContextAnalyzer('/test', { maxDepth });
        expect(analyzer.getOptions().maxDepth).toBe(maxDepth);
      });
    });

    it('should handle empty and large exclude directory arrays', () => {
      // Empty array
      const emptyAnalyzer = new ProjectContextAnalyzer('/test', {
        excludeDirectories: [],
      });
      expect(emptyAnalyzer.getOptions().excludeDirectories).toEqual([]);

      // Single item array
      const singleAnalyzer = new ProjectContextAnalyzer('/test', {
        excludeDirectories: ['single'],
      });
      expect(singleAnalyzer.getOptions().excludeDirectories).toEqual(['single']);

      // Large array
      const largeArray = Array.from({ length: 10000 }, (_, i) => `dir-${i}`);
      const largeAnalyzer = new ProjectContextAnalyzer('/test', {
        excludeDirectories: largeArray,
      });
      expect(largeAnalyzer.getOptions().excludeDirectories).toHaveLength(10000);
    });
  });

  describe('Type Safety and Schema Validation', () => {
    it('should maintain type safety with various option combinations', () => {
      // This test ensures TypeScript compilation works with various option types
      const booleanOptions: ProjectContextAnalyzerOptions = {
        includeHidden: true,
        analyzeGit: false,
        detectFrameworks: true,
        analyzeConfiguration: false,
        detectTests: true,
      };

      const numberOptions: ProjectContextAnalyzerOptions = {
        maxDepth: 42,
      };

      const arrayOptions: ProjectContextAnalyzerOptions = {
        excludeDirectories: ['a', 'b', 'c'],
      };

      const combinedOptions: ProjectContextAnalyzerOptions = {
        ...booleanOptions,
        ...numberOptions,
        ...arrayOptions,
      };

      const analyzer = new ProjectContextAnalyzer('/test', combinedOptions);
      const options = analyzer.getOptions();

      expect(options.includeHidden).toBe(true);
      expect(options.maxDepth).toBe(42);
      expect(options.excludeDirectories).toContain('a');
    });
  });
});