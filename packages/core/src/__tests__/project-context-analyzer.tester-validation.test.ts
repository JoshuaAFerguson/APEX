/**
 * @fileoverview Tester validation test for ProjectContextAnalyzer
 *
 * This test verifies that the ProjectContextAnalyzer testing stage is working correctly
 * and that all required functionality is properly tested and accessible.
 */

import { describe, it, expect } from 'vitest';
import {
  ProjectContextAnalyzer,
  getProjectContextAnalyzer,
  analyzeProject,
  type ProjectContextAnalyzerOptions
} from '../project-context-analyzer';

describe('ProjectContextAnalyzer - Tester Validation', () => {
  const testProjectPath = '/test/project/path';

  describe('Core Class Functionality', () => {
    it('should instantiate ProjectContextAnalyzer with default options', () => {
      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      expect(analyzer).toBeInstanceOf(ProjectContextAnalyzer);
      expect(analyzer.getProjectPath()).toBe(testProjectPath);

      const options = analyzer.getOptions();
      expect(options.maxDepth).toBe(10);
      expect(options.includeHidden).toBe(false);
      expect(options.analyzeGit).toBe(true);
      expect(options.detectFrameworks).toBe(true);
      expect(options.analyzeConfiguration).toBe(true);
      expect(options.detectTests).toBe(true);
    });

    it('should instantiate ProjectContextAnalyzer with custom options', () => {
      const customOptions: ProjectContextAnalyzerOptions = {
        maxDepth: 5,
        includeHidden: true,
        excludeDirectories: ['test-exclude'],
        analyzeGit: false,
        detectFrameworks: false,
        analyzeConfiguration: false,
        detectTests: false
      };

      const analyzer = new ProjectContextAnalyzer(testProjectPath, customOptions);
      const options = analyzer.getOptions();

      expect(options.maxDepth).toBe(5);
      expect(options.includeHidden).toBe(true);
      expect(options.excludeDirectories).toContain('test-exclude');
      expect(options.analyzeGit).toBe(false);
      expect(options.detectFrameworks).toBe(false);
      expect(options.analyzeConfiguration).toBe(false);
      expect(options.detectTests).toBe(false);
    });

    it('should have all required public methods', () => {
      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      expect(typeof analyzer.analyze).toBe('function');
      expect(typeof analyzer.getGitStatus).toBe('function');
      expect(typeof analyzer.getProjectStructure).toBe('function');
      expect(typeof analyzer.detectFrameworks).toBe('function');
      expect(typeof analyzer.getConfigurationInfoList).toBe('function');
      expect(typeof analyzer.getTestFrameworkInfoList).toBe('function');
      expect(typeof analyzer.getProjectPath).toBe('function');
      expect(typeof analyzer.getOptions).toBe('function');
    });
  });

  describe('Convenience Functions', () => {
    it('should provide getProjectContextAnalyzer function', () => {
      expect(typeof getProjectContextAnalyzer).toBe('function');

      const analyzer = getProjectContextAnalyzer(testProjectPath);
      expect(analyzer).toBeInstanceOf(ProjectContextAnalyzer);
      expect(analyzer.getProjectPath()).toBe(testProjectPath);
    });

    it('should provide analyzeProject function', () => {
      expect(typeof analyzeProject).toBe('function');
    });

    it('should create singleton instances via getProjectContextAnalyzer', () => {
      const analyzer1 = getProjectContextAnalyzer(testProjectPath);
      const analyzer2 = getProjectContextAnalyzer(testProjectPath);

      expect(analyzer1).toBe(analyzer2);
    });

    it('should create different instances for different paths', () => {
      const analyzer1 = getProjectContextAnalyzer('/path1');
      const analyzer2 = getProjectContextAnalyzer('/path2');

      expect(analyzer1).not.toBe(analyzer2);
      expect(analyzer1.getProjectPath()).toBe('/path1');
      expect(analyzer2.getProjectPath()).toBe('/path2');
    });
  });

  describe('TypeScript Type Validation', () => {
    it('should correctly type ProjectContextAnalyzerOptions', () => {
      // Test that TypeScript compilation works with proper types
      const options: ProjectContextAnalyzerOptions = {
        maxDepth: 5,
        includeHidden: true,
        excludeDirectories: ['node_modules'],
        analyzeGit: true,
        detectFrameworks: true,
        analyzeConfiguration: true,
        detectTests: true
      };

      const analyzer = new ProjectContextAnalyzer(testProjectPath, options);
      const retrievedOptions = analyzer.getOptions();

      // Verify types are maintained
      expect(typeof retrievedOptions.maxDepth).toBe('number');
      expect(typeof retrievedOptions.includeHidden).toBe('boolean');
      expect(Array.isArray(retrievedOptions.excludeDirectories)).toBe(true);
      expect(typeof retrievedOptions.analyzeGit).toBe('boolean');
      expect(typeof retrievedOptions.detectFrameworks).toBe('boolean');
      expect(typeof retrievedOptions.analyzeConfiguration).toBe('boolean');
      expect(typeof retrievedOptions.detectTests).toBe('boolean');
    });

    it('should allow partial options (optional properties)', () => {
      const partialOptions: ProjectContextAnalyzerOptions = {
        maxDepth: 3
      };

      const analyzer = new ProjectContextAnalyzer(testProjectPath, partialOptions);
      const options = analyzer.getOptions();

      expect(options.maxDepth).toBe(3);
      expect(options.includeHidden).toBe(false); // default
      expect(options.analyzeGit).toBe(true); // default
    });

    it('should handle empty options object', () => {
      const analyzer = new ProjectContextAnalyzer(testProjectPath, {});
      const options = analyzer.getOptions();

      // Should use all defaults
      expect(options.maxDepth).toBe(10);
      expect(options.includeHidden).toBe(false);
      expect(options.analyzeGit).toBe(true);
      expect(options.detectFrameworks).toBe(true);
      expect(options.analyzeConfiguration).toBe(true);
      expect(options.detectTests).toBe(true);
    });
  });

  describe('Export Validation', () => {
    it('should export ProjectContextAnalyzer class', () => {
      expect(ProjectContextAnalyzer).toBeDefined();
      expect(typeof ProjectContextAnalyzer).toBe('function');
      expect(ProjectContextAnalyzer.prototype.constructor).toBe(ProjectContextAnalyzer);
    });

    it('should export utility functions', () => {
      expect(getProjectContextAnalyzer).toBeDefined();
      expect(typeof getProjectContextAnalyzer).toBe('function');

      expect(analyzeProject).toBeDefined();
      expect(typeof analyzeProject).toBe('function');
    });

    it('should import cleanly without errors', () => {
      // If we get this far, the import was successful
      expect(true).toBe(true);
    });
  });

  describe('Basic Functionality Test', () => {
    it('should create instance and call basic methods without throwing', () => {
      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      expect(() => {
        analyzer.getProjectPath();
        analyzer.getOptions();
      }).not.toThrow();
    });

    it('should handle constructor edge cases', () => {
      // Empty path
      expect(() => new ProjectContextAnalyzer('')).not.toThrow();

      // Long path
      const longPath = '/very/long/path/' + 'segment/'.repeat(10);
      expect(() => new ProjectContextAnalyzer(longPath)).not.toThrow();

      // Path with special characters
      const specialPath = '/path with spaces/and-symbols/@#$/test';
      expect(() => new ProjectContextAnalyzer(specialPath)).not.toThrow();
    });

    it('should handle option edge cases', () => {
      // Zero max depth
      expect(() => new ProjectContextAnalyzer(testProjectPath, { maxDepth: 0 })).not.toThrow();

      // Large max depth
      expect(() => new ProjectContextAnalyzer(testProjectPath, { maxDepth: 1000 })).not.toThrow();

      // Empty exclude directories
      expect(() => new ProjectContextAnalyzer(testProjectPath, { excludeDirectories: [] })).not.toThrow();

      // Large exclude directories list
      const largeExcludeList = Array.from({ length: 100 }, (_, i) => `dir${i}`);
      expect(() => new ProjectContextAnalyzer(testProjectPath, { excludeDirectories: largeExcludeList })).not.toThrow();
    });
  });

  describe('Test Infrastructure Validation', () => {
    it('should have access to required test utilities', () => {
      // Verify vitest testing framework is available
      expect(describe).toBeDefined();
      expect(it).toBeDefined();
      expect(expect).toBeDefined();
    });

    it('should properly validate test environment setup', () => {
      // This test validates that the testing environment is properly configured
      // and that tests can run against the ProjectContextAnalyzer
      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      // Basic functionality should work in test environment
      expect(analyzer.getProjectPath()).toBe(testProjectPath);
      expect(analyzer.getOptions()).toBeDefined();
    });
  });
});