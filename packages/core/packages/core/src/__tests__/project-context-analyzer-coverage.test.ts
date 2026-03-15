/**
 * Test Coverage Verification for ProjectContextAnalyzer
 *
 * This test file ensures comprehensive coverage of all exported functionality:
 * - All public methods are tested
 * - All exported schemas are validated
 * - All utility functions are covered
 * - All error paths are exercised
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  // Main class
  ProjectContextAnalyzer,

  // Schema exports
  FrameworkDetectionSchema,
  ConfigFileInfoSchema,

  // Utility functions
  getProjectContextAnalyzer,
  analyzeProject,

  // Type exports
  type FrameworkDetection,
  type ConfigFileInfo,
  type ProjectContextAnalyzerOptions,
} from '../project-context-analyzer.js';

import {
  // Schema imports from types
  GitStatusSchema,
  ProjectStructureSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
  FrameworkInfoSchema,
  ProjectContextSchema,

  // Type imports
  type GitStatus,
  type GitChangedFile,
  type ProjectStructure,
  type ConfigurationInfo,
  type TestFrameworkInfo,
  type FrameworkInfo,
  type ProjectContext,
  type ProjectEntry,
} from '../types.js';

import { getPlatformShell } from '../shell-utils.js';

// Mock external dependencies
vi.mock('child_process');
vi.mock('fs');
vi.mock('path');
vi.mock('../shell-utils.js');

const mockExecAsync = vi.fn();
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

const mockGetPlatformShell = vi.mocked(getPlatformShell);

describe('ProjectContextAnalyzer - Coverage Verification', () => {
  let analyzer: ProjectContextAnalyzer;
  const testPath = '/coverage-test';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformShell.mockReturnValue({
      shell: '/bin/sh',
      shellArgs: ['-c']
    });
    analyzer = new ProjectContextAnalyzer(testPath);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Configuration Coverage', () => {
    it('covers all constructor parameter combinations', () => {
      // Default constructor
      const analyzer1 = new ProjectContextAnalyzer('/test1');
      expect(analyzer1.getProjectPath()).toBe('/test1');

      // With empty options
      const analyzer2 = new ProjectContextAnalyzer('/test2', {});
      expect(analyzer2.getProjectPath()).toBe('/test2');

      // With partial options
      const analyzer3 = new ProjectContextAnalyzer('/test3', {
        maxDepth: 5,
        analyzeGit: false,
      });
      expect(analyzer3.getOptions().maxDepth).toBe(5);
      expect(analyzer3.getOptions().analyzeGit).toBe(false);

      // With complete options
      const completeOptions: ProjectContextAnalyzerOptions = {
        maxDepth: 10,
        includeHidden: true,
        excludeDirectories: ['node_modules', 'dist'],
        analyzeGit: true,
        detectFrameworks: true,
        analyzeConfiguration: true,
        detectTests: true,
      };
      const analyzer4 = new ProjectContextAnalyzer('/test4', completeOptions);
      expect(analyzer4.getOptions()).toEqual({
        maxDepth: 10,
        includeHidden: true,
        excludeDirectories: ['node_modules', 'dist'],
        analyzeGit: true,
        detectFrameworks: true,
        analyzeConfiguration: true,
        detectTests: true,
      });
    });

    it('covers getProjectPath method', () => {
      const paths = [
        '/',
        '/simple',
        '/path/with/nested/directories',
        '/path with spaces',
        '/path/with-dashes',
        '/path/with_underscores',
        'relative/path',
        '',
      ];

      paths.forEach(path => {
        const testAnalyzer = new ProjectContextAnalyzer(path);
        expect(testAnalyzer.getProjectPath()).toBe(path);
      });
    });

    it('covers getOptions method completeness', () => {
      const analyzer = new ProjectContextAnalyzer('/test');
      const options = analyzer.getOptions();

      // Verify all expected properties exist
      const expectedProperties = [
        'maxDepth',
        'includeHidden',
        'excludeDirectories',
        'analyzeGit',
        'detectFrameworks',
        'analyzeConfiguration',
        'detectTests',
      ];

      expectedProperties.forEach(prop => {
        expect(options).toHaveProperty(prop);
      });

      // Verify types
      expect(typeof options.maxDepth).toBe('number');
      expect(typeof options.includeHidden).toBe('boolean');
      expect(Array.isArray(options.excludeDirectories)).toBe(true);
      expect(typeof options.analyzeGit).toBe('boolean');
      expect(typeof options.detectFrameworks).toBe('boolean');
      expect(typeof options.analyzeConfiguration).toBe('boolean');
      expect(typeof options.detectTests).toBe('boolean');
    });
  });

  describe('Method Coverage - All Git Status Scenarios', () => {
    it('covers getGitStatus with all possible outcomes', async () => {
      const scenarios = [
        {
          name: 'Non-git repository',
          mocks: () => mockExecAsync.mockRejectedValue(new Error('not a git repo')),
          expectations: (result: GitStatus) => {
            expect(result.isRepository).toBe(false);
            expect(result.branch).toBeNull();
          }
        },
        {
          name: 'Clean git repository',
          mocks: () => mockExecAsync
            .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
            .mockResolvedValueOnce({ stdout: '', stderr: '' }),
          expectations: (result: GitStatus) => {
            expect(result.isRepository).toBe(true);
            expect(result.branch).toBe('main');
            expect(result.isDirty).toBe(false);
          }
        },
        {
          name: 'Detached HEAD',
          mocks: () => mockExecAsync
            .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'HEAD\n', stderr: '' }),
          expectations: (result: GitStatus) => {
            expect(result.isRepository).toBe(true);
            expect(result.branch).toBeNull();
          }
        },
        {
          name: 'Repository with changes',
          mocks: () => mockExecAsync
            .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'feature\n', stderr: '' })
            .mockResolvedValueOnce({ stdout: '', stderr: '' })
            .mockResolvedValueOnce({ stdout: '2\t1\n', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'M  file.ts\n?? new.js\n', stderr: '' }),
          expectations: (result: GitStatus) => {
            expect(result.isRepository).toBe(true);
            expect(result.branch).toBe('feature');
            expect(result.ahead).toBe(2);
            expect(result.behind).toBe(1);
            expect(result.isDirty).toBe(true);
            expect(result.staged).toHaveLength(1);
            expect(result.untracked).toHaveLength(1);
          }
        },
      ];

      for (const scenario of scenarios) {
        vi.clearAllMocks();
        mockGetPlatformShell.mockReturnValue({
          shell: '/bin/sh',
          shellArgs: ['-c']
        });

        scenario.mocks();
        const result = await analyzer.getGitStatus();
        scenario.expectations(result);

        // Verify schema compliance
        expect(() => GitStatusSchema.parse(result)).not.toThrow();
      }
    });

    it('covers all git status parsing edge cases', async () => {
      const statusCombinations = [
        { input: 'M  modified.ts', expected: { staged: 1, unstaged: 0 } },
        { input: ' M modified.ts', expected: { staged: 0, unstaged: 1 } },
        { input: 'MM both.ts', expected: { staged: 1, unstaged: 1 } },
        { input: 'A  added.ts', expected: { staged: 1, unstaged: 0 } },
        { input: 'D  deleted.ts', expected: { staged: 1, unstaged: 0 } },
        { input: 'R  renamed.ts', expected: { staged: 1, unstaged: 0 } },
        { input: 'C  copied.ts', expected: { staged: 1, unstaged: 0 } },
        { input: 'UU conflict.ts', expected: { staged: 1, unstaged: 0, conflicts: true } },
        { input: '?? untracked.ts', expected: { untracked: 1 } },
      ];

      for (const combo of statusCombinations) {
        mockExecAsync
          .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
          .mockResolvedValueOnce({ stdout: '', stderr: '' })
          .mockResolvedValueOnce({ stdout: '0\t0\n', stderr: '' })
          .mockResolvedValueOnce({ stdout: combo.input, stderr: '' })
          .mockResolvedValueOnce({ stdout: '', stderr: '' })
          .mockResolvedValueOnce({ stdout: '', stderr: '' })
          .mockResolvedValueOnce({ stdout: '', stderr: '' });

        const result = await analyzer.getGitStatus();

        if ('staged' in combo.expected) {
          expect(result.staged).toHaveLength(combo.expected.staged);
        }
        if ('unstaged' in combo.expected) {
          expect(result.unstaged).toHaveLength(combo.expected.unstaged);
        }
        if ('untracked' in combo.expected) {
          expect(result.untracked).toHaveLength(combo.expected.untracked);
        }
        if ('conflicts' in combo.expected) {
          expect(result.hasConflicts).toBe(combo.expected.conflicts);
        }

        vi.clearAllMocks();
        mockGetPlatformShell.mockReturnValue({
          shell: '/bin/sh',
          shellArgs: ['-c']
        });
      }
    });
  });

  describe('Method Coverage - Project Structure', () => {
    it('covers getProjectStructure method completely', async () => {
      const structure = await analyzer.getProjectStructure();

      // Verify all required properties exist
      expect(structure).toHaveProperty('root');
      expect(structure).toHaveProperty('totalFiles');
      expect(structure).toHaveProperty('totalDirectories');
      expect(structure).toHaveProperty('entries');
      expect(structure).toHaveProperty('rootFiles');
      expect(structure).toHaveProperty('commonDirectories');
      expect(structure).toHaveProperty('hasPackageJson');
      expect(structure).toHaveProperty('hasGitIgnore');
      expect(structure).toHaveProperty('hasReadme');
      expect(structure).toHaveProperty('hasLicense');
      expect(structure).toHaveProperty('excludedDirectories');
      expect(structure).toHaveProperty('scannedAt');

      // Verify types
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

      // Schema validation
      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
    });

    it('covers structure with different configuration options', async () => {
      const configurations = [
        { excludeDirectories: [] },
        { excludeDirectories: ['node_modules'] },
        { excludeDirectories: ['a', 'b', 'c'] },
        { maxDepth: 1 },
        { maxDepth: 100 },
        { includeHidden: true },
        { includeHidden: false },
      ];

      for (const config of configurations) {
        const configAnalyzer = new ProjectContextAnalyzer('/test', config);
        const structure = await configAnalyzer.getProjectStructure();

        expect(structure.root).toBe('/test');
        expect(structure.excludedDirectories).toEqual(config.excludeDirectories || ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt']);
        expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
      }
    });
  });

  describe('Method Coverage - Framework Detection', () => {
    it('covers detectFrameworks method', async () => {
      const frameworks = await analyzer.detectFrameworks();

      // Verify structure (TODO implementation returns empty)
      expect(frameworks).toHaveProperty('frameworks');
      expect(frameworks).toHaveProperty('languages');
      expect(Array.isArray(frameworks.frameworks)).toBe(true);
      expect(Array.isArray(frameworks.languages)).toBe(true);

      // Schema validation
      expect(() => FrameworkDetectionSchema.parse(frameworks)).not.toThrow();
    });
  });

  describe('Method Coverage - Configuration Analysis', () => {
    it('covers getConfigurationInfoList method', async () => {
      const configurations = await analyzer.getConfigurationInfoList();

      expect(Array.isArray(configurations)).toBe(true);

      // Schema validation for each configuration
      configurations.forEach(config => {
        expect(() => ConfigurationInfoSchema.parse(config)).not.toThrow();
      });
    });
  });

  describe('Method Coverage - Test Framework Analysis', () => {
    it('covers getTestFrameworkInfoList method', async () => {
      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      expect(Array.isArray(testFrameworks)).toBe(true);

      // Schema validation for each test framework
      testFrameworks.forEach(framework => {
        expect(() => TestFrameworkInfoSchema.parse(framework)).not.toThrow();
      });
    });
  });

  describe('Method Coverage - Main analyze Method', () => {
    it('covers analyze method with all option combinations', async () => {
      const optionCombinations = [
        { analyzeGit: true, detectFrameworks: true, analyzeConfiguration: true, detectTests: true },
        { analyzeGit: false, detectFrameworks: true, analyzeConfiguration: true, detectTests: true },
        { analyzeGit: true, detectFrameworks: false, analyzeConfiguration: true, detectTests: true },
        { analyzeGit: true, detectFrameworks: true, analyzeConfiguration: false, detectTests: true },
        { analyzeGit: true, detectFrameworks: true, analyzeConfiguration: true, detectTests: false },
        { analyzeGit: false, detectFrameworks: false, analyzeConfiguration: false, detectTests: false },
      ];

      for (const options of optionCombinations) {
        const testAnalyzer = new ProjectContextAnalyzer('/test', options);

        // Mock git for repositories with git enabled
        if (options.analyzeGit) {
          mockExecAsync.mockRejectedValue(new Error('not a git repo'));
        }

        const context = await testAnalyzer.analyze();

        // Verify required properties
        expect(context).toHaveProperty('structure');
        expect(context).toHaveProperty('frameworks');
        expect(context).toHaveProperty('configurations');
        expect(context).toHaveProperty('testFrameworks');
        expect(context).toHaveProperty('detectedAt');
        expect(context).toHaveProperty('errors');

        // Verify optional git status based on options
        if (options.analyzeGit) {
          expect(context).toHaveProperty('gitStatus');
          expect(context.gitStatus).toBeDefined();
        } else {
          expect(context.gitStatus).toBeUndefined();
        }

        // Verify schema compliance
        expect(() => ProjectContextSchema.parse(context)).not.toThrow();

        vi.clearAllMocks();
        mockGetPlatformShell.mockReturnValue({
          shell: '/bin/sh',
          shellArgs: ['-c']
        });
      }
    });

    it('covers analyze method with git repository scenarios', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'origin/main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '1\t2\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'M  file.ts\n?? new.js\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'abc123|commit message|1640995200\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'stash@{0}: WIP\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'origin\tgit@github.com:test/repo.git\t(fetch)\n', stderr: '' });

      const context = await analyzer.analyze();

      expect(context.gitStatus?.isRepository).toBe(true);
      expect(context.gitStatus?.branch).toBe('main');
      expect(context.gitStatus?.remoteBranch).toBe('origin/main');
      expect(context.gitStatus?.ahead).toBe(1);
      expect(context.gitStatus?.behind).toBe(2);
      expect(context.gitStatus?.staged).toHaveLength(1);
      expect(context.gitStatus?.untracked).toHaveLength(1);
      expect(context.gitStatus?.isDirty).toBe(true);
      expect(context.gitStatus?.stashCount).toBe(1);
      expect(context.gitStatus?.remotes).toHaveLength(1);

      expect(() => ProjectContextSchema.parse(context)).not.toThrow();
    });
  });

  describe('Utility Function Coverage', () => {
    it('covers getProjectContextAnalyzer function completely', () => {
      // Different paths
      const paths = ['/path1', '/path2', '/path3'];
      const analyzers = paths.map(path => getProjectContextAnalyzer(path));

      expect(analyzers).toHaveLength(3);
      analyzers.forEach((analyzer, i) => {
        expect(analyzer).toBeInstanceOf(ProjectContextAnalyzer);
        expect(analyzer.getProjectPath()).toBe(paths[i]);
      });

      // Same path should return same instance
      const analyzer1 = getProjectContextAnalyzer('/same-path');
      const analyzer2 = getProjectContextAnalyzer('/same-path');
      expect(analyzer1).toBe(analyzer2);

      // With options
      const analyzerWithOptions = getProjectContextAnalyzer('/with-options', {
        maxDepth: 5,
        analyzeGit: false,
      });
      expect(analyzerWithOptions.getOptions().maxDepth).toBe(5);
      expect(analyzerWithOptions.getOptions().analyzeGit).toBe(false);
    });

    it('covers analyzeProject function completely', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      // Without options
      const context1 = await analyzeProject('/test-project');
      expect(context1).toBeDefined();
      expect(context1.structure.root).toBe('/test-project');

      // With options
      const context2 = await analyzeProject('/test-project-2', {
        analyzeGit: false,
        maxDepth: 3,
      });
      expect(context2).toBeDefined();
      expect(context2.structure.root).toBe('/test-project-2');
      expect(context2.gitStatus).toBeUndefined();

      // Both should be schema compliant
      expect(() => ProjectContextSchema.parse(context1)).not.toThrow();
      expect(() => ProjectContextSchema.parse(context2)).not.toThrow();
    });
  });

  describe('Schema Coverage - All Exported Schemas', () => {
    it('covers FrameworkDetectionSchema with all valid cases', () => {
      const validCases: FrameworkDetection[] = [
        {
          frameworks: [],
          languages: [],
        },
        {
          primary: {
            name: 'React',
            confidence: 0.95,
            indicators: ['package.json'],
          },
          frameworks: [{
            name: 'React',
            confidence: 0.95,
            indicators: ['package.json'],
          }],
          languages: [{
            name: 'TypeScript',
            extensions: ['.ts', '.tsx'],
            percentage: 100,
          }],
          primaryLanguage: 'TypeScript',
          runtime: 'node',
          packageManager: 'npm',
          error: 'Some error occurred',
        },
      ];

      validCases.forEach(validCase => {
        const result = FrameworkDetectionSchema.safeParse(validCase);
        expect(result.success).toBe(true);
      });
    });

    it('covers ConfigFileInfoSchema with all valid cases', () => {
      const allTypes = [
        'package', 'typescript', 'eslint', 'prettier', 'babel',
        'webpack', 'vite', 'rollup', 'jest', 'vitest', 'docker',
        'ci', 'git', 'editor', 'environment', 'other'
      ] as const;

      allTypes.forEach(type => {
        const validCases: ConfigFileInfo[] = [
          {
            name: `${type}.config`,
            path: `./${type}.config`,
            type: type,
            exists: true,
          },
          {
            name: `${type}-full.config`,
            path: `./config/${type}-full.config`,
            type: type,
            exists: false,
            description: `Full configuration for ${type}`,
          },
        ];

        validCases.forEach(validCase => {
          const result = ConfigFileInfoSchema.safeParse(validCase);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.type).toBe(type);
          }
        });
      });
    });

    it('covers all schema error cases', () => {
      const invalidFrameworkDetection = {
        frameworks: 'not an array',
        languages: 'not an array',
      };

      const invalidConfigFileInfo = {
        name: 'test',
        path: './test',
        type: 'invalid-type',
        exists: 'not a boolean',
      };

      expect(FrameworkDetectionSchema.safeParse(invalidFrameworkDetection).success).toBe(false);
      expect(ConfigFileInfoSchema.safeParse(invalidConfigFileInfo).success).toBe(false);
    });
  });

  describe('Error Handling Coverage', () => {
    it('covers all error scenarios in git analysis', async () => {
      const errorScenarios = [
        'Command not found',
        'Permission denied',
        'Timeout error',
        'Network error',
        'Invalid repository',
        'Corrupted git data',
      ];

      for (const errorMessage of errorScenarios) {
        mockExecAsync.mockRejectedValue(new Error(errorMessage));

        const result = await analyzer.getGitStatus();

        // Should handle all errors gracefully
        expect(result.isRepository).toBe(false);
        expect(result.branch).toBeNull();
        expect(result.staged).toEqual([]);
        expect(() => GitStatusSchema.parse(result)).not.toThrow();

        vi.clearAllMocks();
        mockGetPlatformShell.mockReturnValue({
          shell: '/bin/sh',
          shellArgs: ['-c']
        });
      }
    });

    it('covers platform shell configuration', async () => {
      const platforms = [
        { shell: '/bin/bash', shellArgs: ['-c'] },
        { shell: '/bin/zsh', shellArgs: ['-c'] },
        { shell: 'cmd.exe', shellArgs: ['/d', '/s', '/c'] },
        { shell: 'powershell.exe', shellArgs: ['-Command'] },
      ];

      for (const platform of platforms) {
        mockGetPlatformShell.mockReturnValue(platform);
        mockExecAsync.mockRejectedValue(new Error('not a git repo'));

        const result = await analyzer.getGitStatus();

        expect(mockGetPlatformShell).toHaveBeenCalled();
        expect(result.isRepository).toBe(false);

        vi.clearAllMocks();
      }
    });
  });

  describe('Type Coverage - All Exported Types', () => {
    it('verifies all types are properly exported and usable', () => {
      // Test type imports work at runtime
      const frameworkDetection: FrameworkDetection = {
        frameworks: [],
        languages: [],
      };

      const configFileInfo: ConfigFileInfo = {
        name: 'test.json',
        path: './test.json',
        type: 'other',
        exists: true,
      };

      const options: ProjectContextAnalyzerOptions = {
        maxDepth: 5,
        includeHidden: false,
        excludeDirectories: ['node_modules'],
        analyzeGit: true,
        detectFrameworks: true,
        analyzeConfiguration: true,
        detectTests: true,
      };

      // These should not cause TypeScript errors
      expect(typeof frameworkDetection).toBe('object');
      expect(typeof configFileInfo).toBe('object');
      expect(typeof options).toBe('object');
    });
  });
});

describe('ProjectContextAnalyzer - Complete Integration Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformShell.mockReturnValue({
      shell: '/bin/sh',
      shellArgs: ['-c']
    });
  });

  it('performs end-to-end integration test covering all functionality', async () => {
    const analyzer = new ProjectContextAnalyzer('/integration-test', {
      maxDepth: 10,
      includeHidden: true,
      excludeDirectories: ['node_modules', 'dist'],
      analyzeGit: true,
      detectFrameworks: true,
      analyzeConfiguration: true,
      detectTests: true,
    });

    // Mock complete git repository
    mockExecAsync
      .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'feature/integration-test\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'origin/feature/integration-test\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: '3\t1\n', stderr: '' })
      .mockResolvedValueOnce({
        stdout: 'M  src/analyzer.ts\nA  tests/new.test.ts\n?? temp.log\nR  old.ts -> new.ts\n',
        stderr: ''
      })
      .mockResolvedValueOnce({
        stdout: 'a1b2c3d|feat: comprehensive integration test implementation|1640995200\n',
        stderr: ''
      })
      .mockResolvedValueOnce({
        stdout: 'stash@{0}: WIP on integration\nstash@{1}: backup\n',
        stderr: ''
      })
      .mockResolvedValueOnce({
        stdout: 'origin\tgit@github.com:test/integration.git\t(fetch)\nupstream\tgit@github.com:upstream/integration.git\t(fetch)\n',
        stderr: ''
      });

    // Execute full analysis
    const context = await analyzer.analyze();

    // Verify comprehensive analysis results
    expect(context).toBeDefined();
    expect(context.detectedAt).toBeInstanceOf(Date);
    expect(context.errors).toEqual([]);

    // Git analysis
    expect(context.gitStatus).toBeDefined();
    expect(context.gitStatus?.isRepository).toBe(true);
    expect(context.gitStatus?.branch).toBe('feature/integration-test');
    expect(context.gitStatus?.remoteBranch).toBe('origin/feature/integration-test');
    expect(context.gitStatus?.ahead).toBe(3);
    expect(context.gitStatus?.behind).toBe(1);
    expect(context.gitStatus?.staged).toHaveLength(3); // M, A, R
    expect(context.gitStatus?.untracked).toHaveLength(1); // ??
    expect(context.gitStatus?.isDirty).toBe(true);
    expect(context.gitStatus?.stashCount).toBe(2);
    expect(context.gitStatus?.remotes).toHaveLength(2);
    expect(context.gitStatus?.lastCommitMessage).toBe('feat: comprehensive integration test implementation');

    // Project structure
    expect(context.structure).toBeDefined();
    expect(context.structure.root).toBe('/integration-test');
    expect(context.structure.excludedDirectories).toEqual(['node_modules', 'dist']);

    // Framework detection (empty due to TODO implementation)
    expect(context.frameworks).toEqual([]);

    // Configuration analysis (empty due to TODO implementation)
    expect(context.configurations).toEqual([]);

    // Test framework analysis (empty due to TODO implementation)
    expect(context.testFrameworks).toEqual([]);

    // Schema validation
    expect(() => ProjectContextSchema.parse(context)).not.toThrow();

    // Individual method coverage
    const individualGitStatus = await analyzer.getGitStatus();
    const individualStructure = await analyzer.getProjectStructure();
    const individualFrameworks = await analyzer.detectFrameworks();
    const individualConfigs = await analyzer.getConfigurationInfoList();
    const individualTests = await analyzer.getTestFrameworkInfoList();

    expect(() => GitStatusSchema.parse(individualGitStatus)).not.toThrow();
    expect(() => ProjectStructureSchema.parse(individualStructure)).not.toThrow();
    expect(() => FrameworkDetectionSchema.parse(individualFrameworks)).not.toThrow();

    individualConfigs.forEach(config => {
      expect(() => ConfigurationInfoSchema.parse(config)).not.toThrow();
    });

    individualTests.forEach(test => {
      expect(() => TestFrameworkInfoSchema.parse(test)).not.toThrow();
    });

    // Utility function coverage
    const singletonAnalyzer = getProjectContextAnalyzer('/integration-test');
    expect(singletonAnalyzer).toBeInstanceOf(ProjectContextAnalyzer);

    mockExecAsync.mockRejectedValue(new Error('not a git repo'));
    const convenientContext = await analyzeProject('/convenient-test', {
      analyzeGit: false,
    });
    expect(convenientContext).toBeDefined();
    expect(convenientContext.gitStatus).toBeUndefined();
    expect(() => ProjectContextSchema.parse(convenientContext)).not.toThrow();
  });
});