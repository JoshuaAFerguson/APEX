/**
 * @fileoverview TypeScript compilation and type checking verification for ProjectContextAnalyzer
 */

import { describe, it, expect } from 'vitest';
import type {
  ProjectContextAnalyzer as ProjectContextAnalyzerType,
  ProjectContextAnalyzerOptions,
} from '../project-context-analyzer.js';

// Import the actual classes and functions
import {
  ProjectContextAnalyzer,
  getProjectContextAnalyzer,
  analyzeProject,
} from '../project-context-analyzer.js';

// Import types from the types module
import type {
  GitStatus,
  ProjectStructure,
  FrameworkDetection,
  ConfigurationInfo,
  TestFrameworkInfo,
  ProjectContext,
  GitChangedFile,
  ProjectEntry,
  FrameworkInfo,
  ConfigFileInfo,
} from '../types.js';

describe('ProjectContextAnalyzer Type Checking', () => {
  describe('Type Definitions', () => {
    it('should have proper type definitions for ProjectContextAnalyzer class', () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      // Verify method signatures exist and return correct types
      const projectPath: string = analyzer.getProjectPath();
      const options: Readonly<Required<ProjectContextAnalyzerOptions>> = analyzer.getOptions();

      expect(typeof projectPath).toBe('string');
      expect(typeof options).toBe('object');
      expect(typeof options.maxDepth).toBe('number');
      expect(typeof options.includeHidden).toBe('boolean');
      expect(typeof options.analyzeGit).toBe('boolean');
    });

    it('should have proper return types for async methods', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      // Test that these methods return Promises of correct types
      const gitStatusPromise: Promise<GitStatus> = analyzer.getGitStatus();
      const structurePromise: Promise<ProjectStructure> = analyzer.getProjectStructure();
      const frameworksPromise: Promise<FrameworkDetection> = analyzer.detectFrameworks();
      const configsPromise: Promise<ConfigurationInfo[]> = analyzer.getConfigurationInfoList();
      const testFrameworksPromise: Promise<TestFrameworkInfo[]> = analyzer.getTestFrameworkInfoList();
      const contextPromise: Promise<ProjectContext> = analyzer.analyze();

      // Verify they are actually promises
      expect(gitStatusPromise).toBeInstanceOf(Promise);
      expect(structurePromise).toBeInstanceOf(Promise);
      expect(frameworksPromise).toBeInstanceOf(Promise);
      expect(configsPromise).toBeInstanceOf(Promise);
      expect(testFrameworksPromise).toBeInstanceOf(Promise);
      expect(contextPromise).toBeInstanceOf(Promise);
    });

    it('should have proper types for convenience functions', async () => {
      // getProjectContextAnalyzer should return ProjectContextAnalyzer
      const analyzer: ProjectContextAnalyzerType = getProjectContextAnalyzer('/test');
      expect(analyzer).toBeInstanceOf(ProjectContextAnalyzer);

      // analyzeProject should return Promise<ProjectContext>
      const contextPromise: Promise<ProjectContext> = analyzeProject('/test');
      expect(contextPromise).toBeInstanceOf(Promise);

      const context: ProjectContext = await contextPromise;
      expect(context).toBeDefined();
      expect(typeof context.detectedAt).toBe('object');
      expect(context.detectedAt).toBeInstanceOf(Date);
    });

    it('should have proper option types', () => {
      // Test various option combinations to ensure types work
      const options1: ProjectContextAnalyzerOptions = {};
      const options2: ProjectContextAnalyzerOptions = {
        maxDepth: 5,
        includeHidden: true,
        analyzeGit: false
      };
      const options3: ProjectContextAnalyzerOptions = {
        excludeDirectories: ['node_modules', 'dist'],
        detectFrameworks: true,
        analyzeConfiguration: false,
        detectTests: true
      };

      // Should compile without issues
      expect(options1).toBeDefined();
      expect(options2).toBeDefined();
      expect(options3).toBeDefined();

      // Test creating analyzers with these options
      const analyzer1 = new ProjectContextAnalyzer('/test', options1);
      const analyzer2 = new ProjectContextAnalyzer('/test', options2);
      const analyzer3 = new ProjectContextAnalyzer('/test', options3);

      expect(analyzer1).toBeDefined();
      expect(analyzer2).toBeDefined();
      expect(analyzer3).toBeDefined();
    });
  });

  describe('Interface Compatibility', () => {
    it('should have proper GitStatus interface implementation', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');
      const gitStatus: GitStatus = await analyzer.getGitStatus();

      // Verify all required GitStatus fields exist with correct types
      expect(typeof gitStatus.isRepository).toBe('boolean');
      expect(gitStatus.branch === null || typeof gitStatus.branch === 'string').toBe(true);
      expect(gitStatus.remoteBranch === null || typeof gitStatus.remoteBranch === 'string').toBe(true);
      expect(typeof gitStatus.ahead).toBe('number');
      expect(typeof gitStatus.behind).toBe('number');
      expect(Array.isArray(gitStatus.staged)).toBe(true);
      expect(Array.isArray(gitStatus.unstaged)).toBe(true);
      expect(Array.isArray(gitStatus.untracked)).toBe(true);
      expect(typeof gitStatus.hasConflicts).toBe('boolean');
      expect(typeof gitStatus.isDirty).toBe('boolean');
      expect(typeof gitStatus.stashCount).toBe('number');
      expect(Array.isArray(gitStatus.remotes)).toBe(true);
    });

    it('should have proper ProjectStructure interface implementation', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');
      const structure: ProjectStructure = await analyzer.getProjectStructure();

      // Verify all required ProjectStructure fields
      expect(typeof structure.root).toBe('string');
      expect(typeof structure.totalFiles).toBe('number');
      expect(typeof structure.totalDirectories).toBe('number');
      expect(Array.isArray(structure.entries)).toBe(true);
      expect(Array.isArray(structure.rootFiles)).toBe(true);
      expect(Array.isArray(structure.commonDirectories)).toBe(true);
      expect(typeof structure.hasPackageJson).toBe('boolean');
      expect(typeof structure.hasGitIgnore).toBe('boolean');
      expect(typeof structure.hasReadme).toBe('boolean');
      expect(typeof structure.hasLicense).toBe('boolean');
      expect(Array.isArray(structure.excludedDirectories)).toBe(true);
      expect(structure.scannedAt).toBeInstanceOf(Date);
    });

    it('should have proper FrameworkDetection interface implementation', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');
      const frameworks: FrameworkDetection = await analyzer.detectFrameworks();

      // Verify FrameworkDetection structure
      expect(Array.isArray(frameworks.frameworks)).toBe(true);
      expect(Array.isArray(frameworks.languages)).toBe(true);

      // Optional fields should be undefined or correct type
      if (frameworks.primary !== undefined) {
        expect(typeof frameworks.primary).toBe('object');
        expect(typeof frameworks.primary.name).toBe('string');
      }
      if (frameworks.primaryLanguage !== undefined) {
        expect(typeof frameworks.primaryLanguage).toBe('string');
      }
      if (frameworks.runtime !== undefined) {
        expect(typeof frameworks.runtime).toBe('string');
      }
      if (frameworks.packageManager !== undefined) {
        expect(typeof frameworks.packageManager).toBe('string');
      }
    });

    it('should have proper array types for configuration and test frameworks', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');
      const configs: ConfigurationInfo[] = await analyzer.getConfigurationInfoList();
      const testFrameworks: TestFrameworkInfo[] = await analyzer.getTestFrameworkInfoList();

      // Should be arrays
      expect(Array.isArray(configs)).toBe(true);
      expect(Array.isArray(testFrameworks)).toBe(true);

      // If arrays have items, verify their structure
      if (configs.length > 0) {
        const config = configs[0];
        expect(typeof config.name).toBe('string');
        expect(typeof config.path).toBe('string');
        expect(typeof config.format).toBe('string');
        expect(typeof config.purpose).toBe('string');
        expect(typeof config.isValid).toBe('boolean');
      }

      if (testFrameworks.length > 0) {
        const framework = testFrameworks[0];
        expect(typeof framework.name).toBe('string');
        expect(typeof framework.type).toBe('string');
        expect(Array.isArray(framework.testPatterns)).toBe(true);
      }
    });

    it('should have proper ProjectContext interface implementation', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');
      const context: ProjectContext = await analyzer.analyze();

      // Verify all required ProjectContext fields
      expect(context.structure).toBeDefined();
      expect(typeof context.structure).toBe('object');
      expect(Array.isArray(context.frameworks)).toBe(true);
      expect(Array.isArray(context.configurations)).toBe(true);
      expect(Array.isArray(context.testFrameworks)).toBe(true);
      expect(context.detectedAt).toBeInstanceOf(Date);
      expect(Array.isArray(context.errors)).toBe(true);

      // Optional gitStatus field
      if (context.gitStatus !== undefined) {
        expect(typeof context.gitStatus).toBe('object');
        expect(typeof context.gitStatus.isRepository).toBe('boolean');
      }
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety with readonly options', () => {
      const analyzer = new ProjectContextAnalyzer('/test');
      const options: Readonly<Required<ProjectContextAnalyzerOptions>> = analyzer.getOptions();

      // TypeScript should prevent modification (this is compile-time, but we can verify structure)
      expect(typeof options.maxDepth).toBe('number');
      expect(typeof options.includeHidden).toBe('boolean');
      expect(Array.isArray(options.excludeDirectories)).toBe(true);
      expect(typeof options.analyzeGit).toBe('boolean');
      expect(typeof options.detectFrameworks).toBe('boolean');
      expect(typeof options.analyzeConfiguration).toBe('boolean');
      expect(typeof options.detectTests).toBe('boolean');
    });

    it('should handle union types correctly', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');
      const gitStatus = await analyzer.getGitStatus();

      // branch can be string | null
      expect(gitStatus.branch === null || typeof gitStatus.branch === 'string').toBe(true);

      // remoteBranch can be string | null
      expect(gitStatus.remoteBranch === null || typeof gitStatus.remoteBranch === 'string').toBe(true);

      // Optional fields in GitStatus should work correctly
      if (gitStatus.lastCommitHash !== undefined) {
        expect(typeof gitStatus.lastCommitHash).toBe('string');
      }
      if (gitStatus.lastCommitMessage !== undefined) {
        expect(typeof gitStatus.lastCommitMessage).toBe('string');
      }
      if (gitStatus.lastCommitTimestamp !== undefined) {
        expect(gitStatus.lastCommitTimestamp).toBeInstanceOf(Date);
      }
    });
  });

  describe('Generic and Complex Types', () => {
    it('should handle array item types correctly', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');
      const gitStatus = await analyzer.getGitStatus();

      // GitChangedFile array types
      for (const stagedFile of gitStatus.staged) {
        const file: GitChangedFile = stagedFile;
        expect(typeof file.path).toBe('string');
        expect(typeof file.status).toBe('string');
        expect(['M', 'A', 'D', 'R', 'C', 'U'].includes(file.status)).toBe(true);
      }

      // String array for untracked files
      for (const untrackedFile of gitStatus.untracked) {
        const file: string = untrackedFile;
        expect(typeof file).toBe('string');
      }

      // Remote objects array
      for (const remote of gitStatus.remotes) {
        expect(typeof remote.name).toBe('string');
        expect(typeof remote.url).toBe('string');
      }
    });

    it('should handle nested object types', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');
      const structure = await analyzer.getProjectStructure();

      // ProjectEntry array with nested structure
      for (const entry of structure.entries) {
        const projectEntry: ProjectEntry = entry;
        expect(typeof projectEntry.name).toBe('string');
        expect(typeof projectEntry.path).toBe('string');
        expect(['file', 'directory'].includes(projectEntry.type)).toBe(true);
        expect(projectEntry.modifiedAt).toBeInstanceOf(Date);

        if (projectEntry.size !== undefined) {
          expect(typeof projectEntry.size).toBe('number');
        }

        if (projectEntry.children !== undefined) {
          expect(Array.isArray(projectEntry.children)).toBe(true);
        }
      }
    });
  });
});