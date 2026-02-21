/**
 * @fileoverview Smoke test for ProjectContextAnalyzer
 *
 * This is a simple smoke test that verifies the basic functionality
 * of the ProjectContextAnalyzer class and ensures TypeScript compilation
 * is working correctly.
 */

import { describe, it, expect } from 'vitest';
import { ProjectContextAnalyzer, getProjectContextAnalyzer, analyzeProject } from '../project-context-analyzer';
import {
  GitStatusSchema,
  ProjectStructureSchema,
  FrameworkDetectionSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
  ProjectContextSchema
} from '../types';

describe('ProjectContextAnalyzer - Smoke Test', () => {
  const testPath = '/test/project/path';

  it('should create analyzer instance with default options', () => {
    const analyzer = new ProjectContextAnalyzer(testPath);

    expect(analyzer).toBeInstanceOf(ProjectContextAnalyzer);
    expect(analyzer.getProjectPath()).toBe(testPath);
    expect(analyzer.getOptions()).toBeDefined();
    expect(analyzer.getOptions().maxDepth).toBe(10);
    expect(analyzer.getOptions().includeHidden).toBe(false);
    expect(analyzer.getOptions().analyzeGit).toBe(true);
    expect(analyzer.getOptions().detectFrameworks).toBe(true);
    expect(analyzer.getOptions().analyzeConfiguration).toBe(true);
    expect(analyzer.getOptions().detectTests).toBe(true);
  });

  it('should create analyzer with custom options', () => {
    const options = {
      maxDepth: 5,
      includeHidden: true,
      excludeDirectories: ['custom-exclude'],
      analyzeGit: false,
      detectFrameworks: false,
      analyzeConfiguration: false,
      detectTests: false
    };

    const analyzer = new ProjectContextAnalyzer(testPath, options);
    const actualOptions = analyzer.getOptions();

    expect(actualOptions.maxDepth).toBe(5);
    expect(actualOptions.includeHidden).toBe(true);
    expect(actualOptions.excludeDirectories).toContain('custom-exclude');
    expect(actualOptions.analyzeGit).toBe(false);
    expect(actualOptions.detectFrameworks).toBe(false);
    expect(actualOptions.analyzeConfiguration).toBe(false);
    expect(actualOptions.detectTests).toBe(false);
  });

  it('should have all required methods', () => {
    const analyzer = new ProjectContextAnalyzer(testPath);

    // Check that all public methods exist
    expect(typeof analyzer.analyze).toBe('function');
    expect(typeof analyzer.getGitStatus).toBe('function');
    expect(typeof analyzer.getProjectStructure).toBe('function');
    expect(typeof analyzer.detectFrameworks).toBe('function');
    expect(typeof analyzer.getConfigurationInfoList).toBe('function');
    expect(typeof analyzer.getTestFrameworkInfoList).toBe('function');
    expect(typeof analyzer.getProjectPath).toBe('function');
    expect(typeof analyzer.getOptions).toBe('function');
  });

  it('should create singleton via convenience function', () => {
    const analyzer1 = getProjectContextAnalyzer(testPath);
    const analyzer2 = getProjectContextAnalyzer(testPath);

    expect(analyzer1).toBe(analyzer2);
    expect(analyzer1.getProjectPath()).toBe(testPath);
  });

  it('should create different analyzers for different paths', () => {
    const analyzer1 = getProjectContextAnalyzer('/path1');
    const analyzer2 = getProjectContextAnalyzer('/path2');

    expect(analyzer1).not.toBe(analyzer2);
    expect(analyzer1.getProjectPath()).toBe('/path1');
    expect(analyzer2.getProjectPath()).toBe('/path2');
  });

  it('should have analyzeProject convenience function', () => {
    expect(typeof analyzeProject).toBe('function');
  });

  describe('Schema Validation', () => {
    it('should have valid Zod schemas exported', () => {
      // Verify schemas are defined and are Zod schemas
      expect(GitStatusSchema).toBeDefined();
      expect(typeof GitStatusSchema.parse).toBe('function');

      expect(ProjectStructureSchema).toBeDefined();
      expect(typeof ProjectStructureSchema.parse).toBe('function');

      expect(FrameworkDetectionSchema).toBeDefined();
      expect(typeof FrameworkDetectionSchema.parse).toBe('function');

      expect(ConfigurationInfoSchema).toBeDefined();
      expect(typeof ConfigurationInfoSchema.parse).toBe('function');

      expect(TestFrameworkInfoSchema).toBeDefined();
      expect(typeof TestFrameworkInfoSchema.parse).toBe('function');

      expect(ProjectContextSchema).toBeDefined();
      expect(typeof ProjectContextSchema.parse).toBe('function');
    });

    it('should validate minimal valid data structures', () => {
      // Test minimal valid structures against schemas
      const minimalGitStatus = {
        isRepository: false,
        branch: null,
        remoteBranch: null,
        ahead: 0,
        behind: 0,
        staged: [],
        unstaged: [],
        untracked: [],
        hasConflicts: false,
        isDirty: false,
        stashCount: 0,
        remotes: []
      };

      const minimalProjectStructure = {
        root: '/test',
        totalFiles: 0,
        totalDirectories: 0,
        entries: [],
        rootFiles: [],
        commonDirectories: [],
        hasPackageJson: false,
        hasGitIgnore: false,
        hasReadme: false,
        hasLicense: false,
        excludedDirectories: [],
        scannedAt: new Date(),
        maxDepthScanned: 0
      };

      const minimalFrameworkDetection = {
        frameworks: [],
        languages: []
      };

      const minimalConfigInfo = {
        name: 'config.json',
        path: 'config.json',
        format: 'json' as const,
        purpose: 'other' as const,
        isValid: true,
        size: 100,
        modifiedAt: new Date()
      };

      const minimalTestFramework = {
        name: 'Jest',
        type: 'unit' as const,
        testPatterns: ['**/*.test.js'],
        runCommand: 'npm test'
      };

      const minimalProjectContext = {
        frameworks: [],
        configurations: [],
        testFrameworks: [],
        errors: []
      };

      // All should validate successfully
      expect(() => GitStatusSchema.parse(minimalGitStatus)).not.toThrow();
      expect(() => ProjectStructureSchema.parse(minimalProjectStructure)).not.toThrow();
      expect(() => FrameworkDetectionSchema.parse(minimalFrameworkDetection)).not.toThrow();
      expect(() => ConfigurationInfoSchema.parse(minimalConfigInfo)).not.toThrow();
      expect(() => TestFrameworkInfoSchema.parse(minimalTestFramework)).not.toThrow();
      expect(() => ProjectContextSchema.parse(minimalProjectContext)).not.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should enforce proper TypeScript types', () => {
      const analyzer = new ProjectContextAnalyzer(testPath);
      const options = analyzer.getOptions();

      // These should be the correct types based on the interface
      expect(typeof options.maxDepth).toBe('number');
      expect(typeof options.includeHidden).toBe('boolean');
      expect(Array.isArray(options.excludeDirectories)).toBe(true);
      expect(typeof options.analyzeGit).toBe('boolean');
      expect(typeof options.detectFrameworks).toBe('boolean');
      expect(typeof options.analyzeConfiguration).toBe('boolean');
      expect(typeof options.detectTests).toBe('boolean');
    });
  });
});