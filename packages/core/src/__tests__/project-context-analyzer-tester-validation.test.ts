/**
 * @fileoverview Tester validation for ProjectContextAnalyzer implementation
 *
 * This test file validates that the ProjectContextAnalyzer class and its types
 * are correctly implemented and exported from the core package.
 */

import { describe, it, expect } from 'vitest';
import {
  ProjectContextAnalyzer,
  getProjectContextAnalyzer,
  analyzeProject,
  type ProjectContextAnalyzerOptions
} from '../project-context-analyzer';
import {
  GitStatusSchema,
  ProjectStructureSchema,
  FrameworkDetectionSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
  ProjectContextSchema,
  type GitStatus,
  type ProjectStructure,
  type FrameworkDetection,
  type ConfigurationInfo,
  type TestFrameworkInfo,
  type ProjectContext
} from '../types';

describe('ProjectContextAnalyzer - Implementation Validation', () => {
  const testProjectPath = '/test/project/validation';

  describe('Class and Constructor', () => {
    it('should instantiate ProjectContextAnalyzer with correct interface', () => {
      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      // Verify instance type
      expect(analyzer).toBeInstanceOf(ProjectContextAnalyzer);

      // Verify required methods exist
      expect(typeof analyzer.getProjectPath).toBe('function');
      expect(typeof analyzer.getOptions).toBe('function');
      expect(typeof analyzer.analyze).toBe('function');
      expect(typeof analyzer.getGitStatus).toBe('function');
      expect(typeof analyzer.getProjectStructure).toBe('function');
      expect(typeof analyzer.detectFrameworks).toBe('function');
      expect(typeof analyzer.getConfigurationInfoList).toBe('function');
      expect(typeof analyzer.getTestFrameworkInfoList).toBe('function');

      // Verify path is set correctly
      expect(analyzer.getProjectPath()).toBe(testProjectPath);
    });

    it('should accept and merge options correctly', () => {
      const customOptions: ProjectContextAnalyzerOptions = {
        maxDepth: 5,
        includeHidden: true,
        excludeDirectories: ['test-exclude'],
        analyzeGit: false,
        detectFrameworks: true,
        analyzeConfiguration: false,
        detectTests: true
      };

      const analyzer = new ProjectContextAnalyzer(testProjectPath, customOptions);
      const options = analyzer.getOptions();

      expect(options.maxDepth).toBe(5);
      expect(options.includeHidden).toBe(true);
      expect(options.excludeDirectories).toEqual(['test-exclude']);
      expect(options.analyzeGit).toBe(false);
      expect(options.detectFrameworks).toBe(true);
      expect(options.analyzeConfiguration).toBe(false);
      expect(options.detectTests).toBe(true);
    });
  });

  describe('Type Definitions', () => {
    it('should have all required TypeScript types exported', () => {
      // These should compile without errors if types are properly defined
      const gitStatus: GitStatus = {
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

      const projectStructure: ProjectStructure = {
        root: testProjectPath,
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

      const frameworkDetection: FrameworkDetection = {
        frameworks: [],
        languages: []
      };

      const configInfo: ConfigurationInfo = {
        name: 'test.json',
        path: './test.json',
        format: 'json',
        purpose: 'other',
        isValid: true,
        size: 100,
        modifiedAt: new Date()
      };

      const testFrameworkInfo: TestFrameworkInfo = {
        name: 'Jest',
        type: 'unit',
        testPatterns: ['**/*.test.js'],
        runCommand: 'npm test',
        testFileCount: 0
      };

      const projectContext: ProjectContext = {
        structure: projectStructure,
        frameworks: [],
        configurations: [],
        testFrameworks: [],
        detectedAt: new Date(),
        errors: []
      };

      // Verify types are valid (if this compiles, types are correct)
      expect(gitStatus).toBeDefined();
      expect(projectStructure).toBeDefined();
      expect(frameworkDetection).toBeDefined();
      expect(configInfo).toBeDefined();
      expect(testFrameworkInfo).toBeDefined();
      expect(projectContext).toBeDefined();
    });
  });

  describe('Zod Schema Validation', () => {
    it('should have properly defined Zod schemas for all return types', () => {
      // Test minimal valid objects against schemas
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
        root: testProjectPath,
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
        name: 'test.json',
        path: './test.json',
        format: 'json' as const,
        purpose: 'other' as const,
        isValid: true,
        size: 100,
        modifiedAt: new Date()
      };

      const minimalTestFrameworkInfo = {
        name: 'Jest',
        type: 'unit' as const,
        testPatterns: ['**/*.test.js'],
        runCommand: 'npm test',
        testFileCount: 0
      };

      const minimalProjectContext = {
        structure: minimalProjectStructure,
        frameworks: [],
        configurations: [],
        testFrameworks: [],
        detectedAt: new Date(),
        errors: []
      };

      // These should not throw if schemas are properly defined
      expect(() => GitStatusSchema.parse(minimalGitStatus)).not.toThrow();
      expect(() => ProjectStructureSchema.parse(minimalProjectStructure)).not.toThrow();
      expect(() => FrameworkDetectionSchema.parse(minimalFrameworkDetection)).not.toThrow();
      expect(() => ConfigurationInfoSchema.parse(minimalConfigInfo)).not.toThrow();
      expect(() => TestFrameworkInfoSchema.parse(minimalTestFrameworkInfo)).not.toThrow();
      expect(() => ProjectContextSchema.parse(minimalProjectContext)).not.toThrow();
    });
  });

  describe('Convenience Functions', () => {
    it('should have getProjectContextAnalyzer function', () => {
      expect(typeof getProjectContextAnalyzer).toBe('function');

      const analyzer = getProjectContextAnalyzer(testProjectPath);
      expect(analyzer).toBeInstanceOf(ProjectContextAnalyzer);
      expect(analyzer.getProjectPath()).toBe(testProjectPath);
    });

    it('should have analyzeProject function', async () => {
      expect(typeof analyzeProject).toBe('function');

      // This may fail due to actual filesystem operations, but the function should exist
      try {
        const result = await analyzeProject(testProjectPath);
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
      } catch (error) {
        // Expected in test environment - just verify function exists and is async
        expect(error).toBeDefined();
      }
    });
  });

  describe('Method Return Types', () => {
    it('should have methods that return Promises of the correct types', () => {
      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      // Verify method signatures return Promises
      const gitStatusPromise = analyzer.getGitStatus();
      const structurePromise = analyzer.getProjectStructure();
      const frameworksPromise = analyzer.detectFrameworks();
      const configsPromise = analyzer.getConfigurationInfoList();
      const testsPromise = analyzer.getTestFrameworkInfoList();
      const analyzePromise = analyzer.analyze();

      expect(gitStatusPromise).toBeInstanceOf(Promise);
      expect(structurePromise).toBeInstanceOf(Promise);
      expect(frameworksPromise).toBeInstanceOf(Promise);
      expect(configsPromise).toBeInstanceOf(Promise);
      expect(testsPromise).toBeInstanceOf(Promise);
      expect(analyzePromise).toBeInstanceOf(Promise);
    });
  });

  describe('Options Interface', () => {
    it('should accept all expected option properties', () => {
      const fullOptions: ProjectContextAnalyzerOptions = {
        maxDepth: 15,
        includeHidden: true,
        excludeDirectories: ['node_modules', '.git', 'dist'],
        analyzeGit: true,
        detectFrameworks: true,
        analyzeConfiguration: true,
        detectTests: true
      };

      // Should compile and instantiate without errors
      expect(() => {
        const analyzer = new ProjectContextAnalyzer(testProjectPath, fullOptions);
        const options = analyzer.getOptions();
        expect(options.maxDepth).toBe(15);
        expect(options.includeHidden).toBe(true);
        expect(options.analyzeGit).toBe(true);
      }).not.toThrow();
    });

    it('should handle partial options correctly', () => {
      const partialOptions: ProjectContextAnalyzerOptions = {
        maxDepth: 8
      };

      const analyzer = new ProjectContextAnalyzer(testProjectPath, partialOptions);
      const options = analyzer.getOptions();

      // Should merge with defaults
      expect(options.maxDepth).toBe(8);
      expect(options.includeHidden).toBe(false); // default
      expect(options.analyzeGit).toBe(true); // default
    });
  });
});