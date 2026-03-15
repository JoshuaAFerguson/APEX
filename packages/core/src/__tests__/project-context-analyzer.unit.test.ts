/**
 * Unit Tests for ProjectContextAnalyzer
 *
 * These unit tests focus on testing individual methods and functionality
 * in isolation using mocks and stubs. Unlike integration tests, these
 * tests ensure each method works correctly under various conditions.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import {
  ProjectContextAnalyzer,
  getProjectContextAnalyzer,
  analyzeProject,
  type ProjectContextAnalyzerOptions,
} from '../project-context-analyzer.js';
import {
  GitStatusSchema,
  ProjectStructureSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
  FrameworkDetectionSchema,
  type GitStatus,
  type ProjectStructure,
  type ConfigurationInfo,
  type TestFrameworkInfo,
  type FrameworkDetection,
} from '../types.js';
import { getPlatformShell } from '../shell-utils.js';

// Mock external dependencies
vi.mock('child_process');
vi.mock('fs');
vi.mock('path');
vi.mock('../shell-utils.js');

const mockExec = vi.mocked(exec);
const mockFs = vi.mocked(fs, true);
const mockPath = vi.mocked(path, true);
const mockGetPlatformShell = vi.mocked(getPlatformShell);

// Mock promisify to return our mocked exec
const mockExecAsync = vi.fn();
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

describe('ProjectContextAnalyzer Unit Tests', () => {
  let analyzer: ProjectContextAnalyzer;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default shell mock
    mockGetPlatformShell.mockReturnValue({
      shell: '/bin/sh',
      shellArgs: ['-c']
    });

    // Mock path methods with realistic behavior
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.basename.mockImplementation((filePath) => filePath.split('/').pop() || '');
    mockPath.extname.mockImplementation((filePath) => {
      const parts = filePath.split('.');
      return parts.length > 1 ? '.' + parts.pop() : '';
    });

    analyzer = new ProjectContextAnalyzer(testProjectPath);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('creates analyzer with default options', () => {
      const defaultAnalyzer = new ProjectContextAnalyzer('/test');
      const options = defaultAnalyzer.getOptions();

      expect(options.maxDepth).toBe(10);
      expect(options.includeHidden).toBe(false);
      expect(options.excludeDirectories).toEqual([
        'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt'
      ]);
      expect(options.analyzeGit).toBe(true);
      expect(options.detectFrameworks).toBe(true);
      expect(options.analyzeConfiguration).toBe(true);
      expect(options.detectTests).toBe(true);
    });

    it('creates analyzer with custom options', () => {
      const customOptions: ProjectContextAnalyzerOptions = {
        maxDepth: 5,
        includeHidden: true,
        excludeDirectories: ['custom-exclude'],
        analyzeGit: false,
        detectFrameworks: false,
        analyzeConfiguration: false,
        detectTests: false,
      };

      const customAnalyzer = new ProjectContextAnalyzer('/custom', customOptions);
      const options = customAnalyzer.getOptions();

      expect(options.maxDepth).toBe(5);
      expect(options.includeHidden).toBe(true);
      expect(options.excludeDirectories).toEqual(['custom-exclude']);
      expect(options.analyzeGit).toBe(false);
      expect(options.detectFrameworks).toBe(false);
      expect(options.analyzeConfiguration).toBe(false);
      expect(options.detectTests).toBe(false);
    });

    it('merges custom options with defaults correctly', () => {
      const partialOptions: ProjectContextAnalyzerOptions = {
        maxDepth: 3,
        analyzeGit: false,
      };

      const partialAnalyzer = new ProjectContextAnalyzer('/partial', partialOptions);
      const options = partialAnalyzer.getOptions();

      expect(options.maxDepth).toBe(3); // Custom value
      expect(options.analyzeGit).toBe(false); // Custom value
      expect(options.includeHidden).toBe(false); // Default value
      expect(options.detectFrameworks).toBe(true); // Default value
    });

    it('returns correct project path', () => {
      expect(analyzer.getProjectPath()).toBe(testProjectPath);
    });

    it('returns readonly options object', () => {
      const options = analyzer.getOptions();

      // TypeScript should prevent this, but test runtime behavior
      expect(() => {
        (options as any).maxDepth = 999;
      }).not.toThrow(); // JavaScript allows this, but it shouldn't affect the analyzer

      // The analyzer should still have the original value
      expect(analyzer.getOptions().maxDepth).toBe(10);
    });
  });

  describe('getGitStatus method', () => {
    it('returns non-repository status when git check fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repository'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(false);
      expect(gitStatus.branch).toBe(null);
      expect(gitStatus.remoteBranch).toBe(null);
      expect(gitStatus.ahead).toBe(0);
      expect(gitStatus.behind).toBe(0);
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
      expect(gitStatus.untracked).toEqual([]);
      expect(gitStatus.hasConflicts).toBe(false);
      expect(gitStatus.isDirty).toBe(false);
      expect(gitStatus.stashCount).toBe(0);
      expect(gitStatus.remotes).toEqual([]);

      // Verify schema compliance
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });

    it('returns basic git status for valid repository', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' }) // git rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // branch name
        .mockRejectedValueOnce(new Error('no upstream')) // no remote tracking
        .mockRejectedValueOnce(new Error('no ahead/behind')) // no ahead/behind
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // clean status
        .mockRejectedValueOnce(new Error('no commits')) // no commits
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // no stashes
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // no remotes

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('main');
      expect(gitStatus.remoteBranch).toBe(null);
      expect(gitStatus.ahead).toBe(0);
      expect(gitStatus.behind).toBe(0);
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
      expect(gitStatus.untracked).toEqual([]);
      expect(gitStatus.hasConflicts).toBe(false);
      expect(gitStatus.isDirty).toBe(false);
      expect(gitStatus.lastCommitHash).toBeUndefined();
      expect(gitStatus.lastCommitMessage).toBeUndefined();
      expect(gitStatus.stashCount).toBe(0);
      expect(gitStatus.remotes).toEqual([]);

      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });

    it('parses complex git status correctly', async () => {
      const statusOutput = [
        'M  src/modified.ts',      // Staged modification
        ' M src/unstaged.ts',      // Unstaged modification
        'A  src/added.ts',         // Staged addition
        ' D src/deleted.ts',       // Unstaged deletion
        'R  src/old.ts -> src/new.ts', // Renamed
        '?? src/untracked.ts',     // Untracked
        'UU src/conflict.ts',      // Conflict
      ].join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'feature/complex\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'origin/feature/complex\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '3\t1\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: statusOutput, stderr: '' })
        .mockResolvedValueOnce({ stdout: 'abc123|Complex commit message|1640995200\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'stash@{0}: WIP\nstash@{1}: backup\n', stderr: '' })
        .mockResolvedValueOnce({
          stdout: 'origin\tgit@github.com:test/repo.git\t(fetch)\nupstream\thttps://github.com/upstream/repo.git\t(fetch)\n',
          stderr: ''
        });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('feature/complex');
      expect(gitStatus.remoteBranch).toBe('origin/feature/complex');
      expect(gitStatus.ahead).toBe(3);
      expect(gitStatus.behind).toBe(1);
      expect(gitStatus.hasConflicts).toBe(true);
      expect(gitStatus.isDirty).toBe(true);

      // Check staged files
      expect(gitStatus.staged).toHaveLength(3);
      expect(gitStatus.staged[0]).toEqual({ path: 'src/modified.ts', status: 'M' });
      expect(gitStatus.staged[1]).toEqual({ path: 'src/added.ts', status: 'A' });
      expect(gitStatus.staged[2]).toEqual({ path: 'src/old.ts -> src/new.ts', status: 'R' });

      // Check unstaged files
      expect(gitStatus.unstaged).toHaveLength(3);
      expect(gitStatus.unstaged[0]).toEqual({ path: 'src/unstaged.ts', status: 'M' });
      expect(gitStatus.unstaged[1]).toEqual({ path: 'src/deleted.ts', status: 'D' });
      expect(gitStatus.unstaged[2]).toEqual({ path: 'src/conflict.ts', status: 'U' });

      // Check untracked files
      expect(gitStatus.untracked).toEqual(['src/untracked.ts']);

      // Check commit info
      expect(gitStatus.lastCommitHash).toBe('abc123');
      expect(gitStatus.lastCommitMessage).toBe('Complex commit message');
      expect(gitStatus.lastCommitTimestamp).toEqual(new Date(1640995200000));

      // Check stash and remotes
      expect(gitStatus.stashCount).toBe(2);
      expect(gitStatus.remotes).toHaveLength(2);
      expect(gitStatus.remotes[0]).toEqual({ name: 'origin', url: 'git@github.com:test/repo.git' });
      expect(gitStatus.remotes[1]).toEqual({ name: 'upstream', url: 'https://github.com/upstream/repo.git' });

      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });

    it('handles HEAD detached state', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'HEAD\n', stderr: '' }) // Detached HEAD
        .mockRejectedValueOnce(new Error('no upstream'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('no commits'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe(null); // HEAD should be converted to null
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });

    it('handles malformed ahead/behind output', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'origin/main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'invalid-format\n', stderr: '' }) // Bad ahead/behind
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('no commits'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.ahead).toBe(0); // Should default to 0
      expect(gitStatus.behind).toBe(0); // Should default to 0
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });

    it('handles malformed commit output', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no upstream'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'malformed-commit-data\n', stderr: '' }) // Bad commit format
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.lastCommitHash).toBeUndefined();
      expect(gitStatus.lastCommitMessage).toBeUndefined();
      expect(gitStatus.lastCommitTimestamp).toBeUndefined();
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });
  });

  describe('getProjectStructure method', () => {
    it('returns empty structure for empty directory', async () => {
      // Mock fs.promises.readdir to return empty array
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const structure = await analyzer.getProjectStructure();

      expect(structure.root).toBe(testProjectPath);
      expect(structure.totalFiles).toBe(0);
      expect(structure.totalDirectories).toBe(0);
      expect(structure.entries).toEqual([]);
      expect(structure.rootFiles).toEqual([]);
      expect(structure.commonDirectories).toEqual([]);
      expect(structure.hasPackageJson).toBe(false);
      expect(structure.hasGitIgnore).toBe(false);
      expect(structure.hasReadme).toBe(false);
      expect(structure.hasLicense).toBe(false);
      expect(structure.scannedAt).toBeInstanceOf(Date);
      expect(structure.excludedDirectories).toEqual([
        'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt'
      ]);

      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
    });

    it('handles filesystem read errors gracefully', async () => {
      // Mock fs.promises.readdir to throw an error for the root directory
      (mockFs.promises as any).readdir = vi.fn().mockRejectedValue(new Error('Permission denied'));
      (mockFs.promises as any).stat = vi.fn();

      const structure = await analyzer.getProjectStructure();

      expect(structure.root).toBe(testProjectPath);
      expect(structure.totalFiles).toBe(0);
      expect(structure.totalDirectories).toBe(0);
      expect(structure.entries).toEqual([]);
      expect(structure.rootFiles).toEqual([]);
      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
    });

    it('respects excludeDirectories option', () => {
      const customAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        excludeDirectories: ['custom-exclude', 'another-exclude']
      });

      const options = customAnalyzer.getOptions();
      expect(options.excludeDirectories).toEqual(['custom-exclude', 'another-exclude']);
    });

    it('respects maxDepth option', () => {
      const depthLimitedAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        maxDepth: 2
      });

      const options = depthLimitedAnalyzer.getOptions();
      expect(options.maxDepth).toBe(2);
    });

    it('respects includeHidden option', () => {
      const hiddenAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        includeHidden: true
      });

      const options = hiddenAnalyzer.getOptions();
      expect(options.includeHidden).toBe(true);
    });
  });

  describe('detectFrameworks method', () => {
    it('returns empty detection when no frameworks found', async () => {
      // Mock fs operations to return no package.json or config files
      (mockFs.promises as any).readFile = vi.fn().mockRejectedValue(new Error('File not found'));
      (mockFs.promises as any).access = vi.fn().mockRejectedValue(new Error('File not found'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);

      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks).toEqual([]);
      expect(detection.languages).toEqual([]);
      expect(detection.primary).toBeUndefined();
      expect(detection.packageManager).toBeUndefined();
      expect(detection.runtime).toBeUndefined();
      expect(detection.primaryLanguage).toBeUndefined();
      expect(detection.error).toBeUndefined();

      expect(() => FrameworkDetectionSchema.parse(detection)).not.toThrow();
    });

    it('handles package.json parsing errors gracefully', async () => {
      // Mock fs.promises.access to succeed (package.json exists)
      (mockFs.promises as any).access = vi.fn()
        .mockResolvedValueOnce(undefined) // package-lock.json doesn't exist
        .mockRejectedValueOnce(new Error('not found')) // yarn.lock doesn't exist
        .mockRejectedValueOnce(new Error('not found')) // pnpm-lock.yaml doesn't exist
        .mockRejectedValueOnce(new Error('not found')) // bun.lockb doesn't exist
        .mockResolvedValueOnce(undefined); // package.json exists

      // Mock fs.promises.readFile to return invalid JSON
      (mockFs.promises as any).readFile = vi.fn()
        .mockRejectedValue(new Error('Invalid JSON'));

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);

      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks).toEqual([]);
      expect(detection.packageManager).toBe('npm'); // Should default to npm when package.json exists
      expect(() => FrameworkDetectionSchema.parse(detection)).not.toThrow();
    });

    it('detects package manager from lock files', async () => {
      const lockFileTests = [
        { file: 'package-lock.json', expected: 'npm' },
        { file: 'yarn.lock', expected: 'yarn' },
        { file: 'pnpm-lock.yaml', expected: 'pnpm' },
        { file: 'bun.lockb', expected: 'bun' },
      ];

      for (const test of lockFileTests) {
        vi.clearAllMocks();

        // Mock access to succeed only for the specific lock file
        (mockFs.promises as any).access = vi.fn()
          .mockImplementation((filePath: string) => {
            if (filePath.includes(test.file)) {
              return Promise.resolve();
            }
            return Promise.reject(new Error('not found'));
          });

        (mockFs.promises as any).readFile = vi.fn().mockRejectedValue(new Error('not found'));
        (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);

        const detection = await analyzer.detectFrameworks();
        expect(detection.packageManager).toBe(test.expected);
      }
    });
  });

  describe('getConfigurationInfoList method', () => {
    it('returns empty list when no config files found', async () => {
      // Mock fs operations to return no files
      (mockFs.promises as any).access = vi.fn().mockRejectedValue(new Error('File not found'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const configurations = await analyzer.getConfigurationInfoList();

      expect(configurations).toEqual([]);
    });

    it('handles filesystem errors gracefully', async () => {
      // Mock stat to throw errors
      (mockFs.promises as any).access = vi.fn().mockResolvedValue(undefined);
      (mockFs.promises as any).stat = vi.fn().mockRejectedValue(new Error('Permission denied'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);

      const configurations = await analyzer.getConfigurationInfoList();

      expect(configurations).toEqual([]);
    });
  });

  describe('getTestFrameworkInfoList method', () => {
    it('returns empty list when no test frameworks detected', async () => {
      // Mock loadPackageJson to return null
      (mockFs.promises as any).readFile = vi.fn().mockRejectedValue(new Error('No package.json'));
      (mockFs.promises as any).access = vi.fn().mockRejectedValue(new Error('No config files'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      expect(testFrameworks).toEqual([]);
    });

    it('handles package.json parsing errors gracefully', async () => {
      // Mock package.json to exist but be unparseable
      (mockFs.promises as any).readFile = vi.fn()
        .mockRejectedValue(new Error('Invalid JSON'));
      (mockFs.promises as any).access = vi.fn().mockRejectedValue(new Error('No config files'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      expect(testFrameworks).toEqual([]);
    });
  });

  describe('analyze method', () => {
    it('performs complete analysis with all options enabled', async () => {
      // Mock all git commands to fail (non-git repo)
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      // Mock filesystem operations
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).access = vi.fn().mockRejectedValue(new Error('not found'));
      (mockFs.promises as any).readFile = vi.fn().mockRejectedValue(new Error('not found'));
      (mockFs.promises as any).stat = vi.fn();

      const context = await analyzer.analyze();

      expect(context).toBeDefined();
      expect(context.detectedAt).toBeInstanceOf(Date);
      expect(context.errors).toEqual([]);
      expect(context.gitStatus).toBeDefined();
      expect(context.structure).toBeDefined();
      expect(context.frameworks).toEqual([]);
      expect(context.configurations).toEqual([]);
      expect(context.testFrameworks).toEqual([]);
    });

    it('respects disabled analysis options', async () => {
      const selectiveAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        analyzeGit: false,
        detectFrameworks: false,
        analyzeConfiguration: false,
        detectTests: false,
      });

      // Mock filesystem operations
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const context = await selectiveAnalyzer.analyze();

      expect(context.gitStatus).toBeUndefined();
      expect(context.frameworks).toEqual([]);
      expect(context.configurations).toEqual([]);
      expect(context.testFrameworks).toEqual([]);
      expect(context.structure).toBeDefined(); // Always analyzed
    });

    it('handles concurrent analysis calls', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const promises = Array.from({ length: 5 }, () => analyzer.analyze());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.structure.root).toBe(testProjectPath);
      });
    });
  });

  describe('Schema validation', () => {
    it('ensures all return types validate against their schemas', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).access = vi.fn().mockRejectedValue(new Error('not found'));
      (mockFs.promises as any).readFile = vi.fn().mockRejectedValue(new Error('not found'));
      (mockFs.promises as any).stat = vi.fn();

      const gitStatus = await analyzer.getGitStatus();
      const structure = await analyzer.getProjectStructure();
      const frameworks = await analyzer.detectFrameworks();
      const configurations = await analyzer.getConfigurationInfoList();
      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      // All should validate without throwing
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
      expect(() => FrameworkDetectionSchema.parse(frameworks)).not.toThrow();

      configurations.forEach(config => {
        expect(() => ConfigurationInfoSchema.parse(config)).not.toThrow();
      });

      testFrameworks.forEach(framework => {
        expect(() => TestFrameworkInfoSchema.parse(framework)).not.toThrow();
      });
    });
  });
});

describe('Utility Functions Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjectContextAnalyzer', () => {
    it('returns new analyzer for different paths', () => {
      const analyzer1 = getProjectContextAnalyzer('/path1');
      const analyzer2 = getProjectContextAnalyzer('/path2');

      expect(analyzer1).not.toBe(analyzer2);
      expect(analyzer1.getProjectPath()).toBe('/path1');
      expect(analyzer2.getProjectPath()).toBe('/path2');
    });

    it('returns same analyzer instance for same path', () => {
      const analyzer1 = getProjectContextAnalyzer('/same/path');
      const analyzer2 = getProjectContextAnalyzer('/same/path');

      expect(analyzer1).toBe(analyzer2);
    });

    it('creates new analyzer when path changes', () => {
      const analyzer1 = getProjectContextAnalyzer('/path1');
      const analyzer2 = getProjectContextAnalyzer('/path2');
      const analyzer3 = getProjectContextAnalyzer('/path1'); // Back to path1

      expect(analyzer1).not.toBe(analyzer2);
      expect(analyzer1).not.toBe(analyzer3); // New instance created
      expect(analyzer2).not.toBe(analyzer3);
    });
  });

  describe('analyzeProject', () => {
    beforeEach(() => {
      mockGetPlatformShell.mockReturnValue({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });
    });

    it('creates analyzer and performs analysis', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const context = await analyzeProject('/test/analyze');

      expect(context).toBeDefined();
      expect(context.structure.root).toBe('/test/analyze');
      expect(context.detectedAt).toBeInstanceOf(Date);
    });

    it('passes options to analyzer correctly', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const options: ProjectContextAnalyzerOptions = {
        analyzeGit: false,
        maxDepth: 3,
      };

      const context = await analyzeProject('/test/options', options);

      expect(context.gitStatus).toBeUndefined(); // Git analysis disabled
      expect(context.structure).toBeDefined();
    });

    it('handles multiple concurrent calls', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const promises = [
        analyzeProject('/concurrent1'),
        analyzeProject('/concurrent2'),
        analyzeProject('/concurrent3'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0].structure.root).toBe('/concurrent1');
      expect(results[1].structure.root).toBe('/concurrent2');
      expect(results[2].structure.root).toBe('/concurrent3');
    });
  });
});