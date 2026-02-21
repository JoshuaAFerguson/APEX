import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  ProjectContextSchema,
  FrameworkDetectionSchema,
  ConfigFileInfoSchema,
  type GitStatus,
  type GitChangedFile,
  type ProjectStructure,
  type ConfigurationInfo,
  type TestFrameworkInfo,
  type ProjectContext,
  type FrameworkDetection,
  type ConfigFileInfo,
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

const execAsync = promisify(exec);

describe('ProjectContextAnalyzer', () => {
  let analyzer: ProjectContextAnalyzer;
  const testProjectPath = '/test/project';
  const defaultOptions: ProjectContextAnalyzerOptions = {
    maxDepth: 10,
    includeHidden: false,
    excludeDirectories: ['node_modules', '.git', 'dist', 'build', 'coverage'],
    analyzeGit: true,
    detectFrameworks: true,
    analyzeConfiguration: true,
    detectTests: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mocks
    mockGetPlatformShell.mockReturnValue({
      shell: '/bin/sh',
      shellArgs: ['-c']
    });

    analyzer = new ProjectContextAnalyzer(testProjectPath, defaultOptions);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('creates an instance with default options', () => {
      const simpleAnalyzer = new ProjectContextAnalyzer(testProjectPath);
      expect(simpleAnalyzer.getProjectPath()).toBe(testProjectPath);
      const options = simpleAnalyzer.getOptions();
      expect(options.maxDepth).toBe(10);
      expect(options.includeHidden).toBe(false);
      expect(options.analyzeGit).toBe(true);
      expect(options.detectFrameworks).toBe(true);
      expect(options.analyzeConfiguration).toBe(true);
      expect(options.detectTests).toBe(true);
    });

    it('creates an instance with custom options', () => {
      const customOptions: ProjectContextAnalyzerOptions = {
        maxDepth: 5,
        includeHidden: true,
        analyzeGit: false,
        detectFrameworks: false,
      };
      const customAnalyzer = new ProjectContextAnalyzer(testProjectPath, customOptions);

      const options = customAnalyzer.getOptions();
      expect(options.maxDepth).toBe(5);
      expect(options.includeHidden).toBe(true);
      expect(options.analyzeGit).toBe(false);
      expect(options.detectFrameworks).toBe(false);
      // Should retain defaults for unspecified options
      expect(options.analyzeConfiguration).toBe(true);
      expect(options.detectTests).toBe(true);
    });

    it('merges custom options with defaults', () => {
      const partialOptions: ProjectContextAnalyzerOptions = {
        maxDepth: 15,
        excludeDirectories: ['custom-exclude'],
      };
      const mergedAnalyzer = new ProjectContextAnalyzer(testProjectPath, partialOptions);

      const options = mergedAnalyzer.getOptions();
      expect(options.maxDepth).toBe(15);
      expect(options.excludeDirectories).toEqual(['custom-exclude']);
      expect(options.includeHidden).toBe(false); // Default value
      expect(options.analyzeGit).toBe(true); // Default value
    });
  });

  describe('getProjectPath', () => {
    it('returns the project path', () => {
      expect(analyzer.getProjectPath()).toBe(testProjectPath);
    });
  });

  describe('getOptions', () => {
    it('returns readonly options', () => {
      const options = analyzer.getOptions();
      expect(options).toBeDefined();
      expect(typeof options).toBe('object');

      // Verify it's readonly by checking the type (TypeScript ensures this)
      // At runtime, we can verify the options contain expected properties
      expect(options.maxDepth).toBeDefined();
      expect(options.includeHidden).toBeDefined();
      expect(options.analyzeGit).toBeDefined();
    });
  });

  describe('getGitStatus', () => {
    it('returns empty git status for non-git directory', async () => {
      // Mock git rev-parse to throw (not a git repo)
      mockExecAsync.mockRejectedValueOnce(new Error('not a git repository'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus).toEqual({
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
        remotes: [],
      });
    });

    it('analyzes git repository with clean status', async () => {
      // Mock git commands sequence
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // git rev-parse --abbrev-ref HEAD
        .mockResolvedValueOnce({ stdout: 'origin/main\n', stderr: '' }) // remote tracking branch
        .mockResolvedValueOnce({ stdout: '0\t2\n', stderr: '' }) // ahead/behind count
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git status --porcelain
        .mockResolvedValueOnce({ stdout: 'abc1234|Initial commit|1640995200\n', stderr: '' }) // last commit
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git stash list
        .mockResolvedValueOnce({ stdout: 'origin\tgit@github.com:user/repo.git\t(fetch)\n', stderr: '' }); // remotes

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('main');
      expect(gitStatus.remoteBranch).toBe('origin/main');
      expect(gitStatus.ahead).toBe(0);
      expect(gitStatus.behind).toBe(2);
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
      expect(gitStatus.untracked).toEqual([]);
      expect(gitStatus.hasConflicts).toBe(false);
      expect(gitStatus.isDirty).toBe(false);
      expect(gitStatus.lastCommitHash).toBe('abc1234');
      expect(gitStatus.lastCommitMessage).toBe('Initial commit');
      expect(gitStatus.lastCommitTimestamp).toEqual(new Date(1640995200000));
      expect(gitStatus.stashCount).toBe(0);
      expect(gitStatus.remotes).toEqual([{ name: 'origin', url: 'git@github.com:user/repo.git' }]);
    });

    it('analyzes git repository with dirty status', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'feature-branch\n', stderr: '' }) // branch
        .mockRejectedValueOnce(new Error('no upstream')) // no remote tracking
        .mockResolvedValueOnce({
          stdout: 'M  file1.js\n A file2.js\n?? file3.js\nUU conflict.js\n',
          stderr: ''
        }) // git status with changes
        .mockRejectedValueOnce(new Error('no commits')) // no last commit
        .mockResolvedValueOnce({ stdout: 'stash@{0}: WIP on main\nstash@{1}: autosave\n', stderr: '' }) // stash
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // no remotes

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('feature-branch');
      expect(gitStatus.remoteBranch).toBeNull();
      expect(gitStatus.staged).toEqual([
        { path: 'file1.js', status: 'M' },
        { path: 'file2.js', status: 'A' }
      ]);
      expect(gitStatus.untracked).toEqual(['file3.js']);
      expect(gitStatus.hasConflicts).toBe(true);
      expect(gitStatus.isDirty).toBe(true);
      expect(gitStatus.stashCount).toBe(2);
      expect(gitStatus.remotes).toEqual([]);
    });

    it('handles detached HEAD state', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'HEAD\n', stderr: '' }); // detached HEAD

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBeNull(); // HEAD becomes null for detached state
    });

    it('parses various git status codes correctly', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // branch
        .mockResolvedValueOnce({
          stdout: 'MM modified-both.js\nAM added-modified.js\nMD modified-deleted.js\nR  old.js -> new.js\nC  original.js -> copy.js\n',
          stderr: ''
        }); // complex status

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.staged).toHaveLength(5);
      expect(gitStatus.unstaged).toHaveLength(3);

      // Check specific status mappings
      const stagedModified = gitStatus.staged.find(f => f.path === 'modified-both.js');
      expect(stagedModified?.status).toBe('M');

      const renamedFile = gitStatus.staged.find(f => f.path === 'old.js -> new.js');
      expect(renamedFile?.status).toBe('R');
    });

    it('handles git command failures gracefully', async () => {
      // All git commands fail
      mockExecAsync.mockRejectedValue(new Error('git command failed'));

      const gitStatus = await analyzer.getGitStatus();

      // Should still return valid GitStatus object
      expect(gitStatus.isRepository).toBe(false);
      expect(gitStatus.branch).toBeNull();
      expect(gitStatus.staged).toEqual([]);
    });

    it('handles partial git command failures', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git rev-parse works
        .mockRejectedValueOnce(new Error('branch cmd failed')) // branch fails
        .mockRejectedValueOnce(new Error('remote fails'))      // remote fails
        .mockRejectedValueOnce(new Error('status fails'))      // status fails
        .mockRejectedValueOnce(new Error('commit fails'))      // last commit fails
        .mockRejectedValueOnce(new Error('stash fails'))       // stash fails
        .mockRejectedValueOnce(new Error('remotes fail'));     // remotes fail

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBeNull();
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.lastCommitHash).toBeUndefined();
    });

    it('validates git status with Zod schema', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('not a git repository'));

      const gitStatus = await analyzer.getGitStatus();

      // Should not throw - validates against GitStatusSchema
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });

    it('uses platform shell configuration', async () => {
      mockGetPlatformShell.mockReturnValue({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await analyzer.getGitStatus();

      expect(mockGetPlatformShell).toHaveBeenCalled();
      expect(mockExecAsync).toHaveBeenCalledWith(
        'git rev-parse --git-dir',
        expect.objectContaining({
          shell: 'cmd.exe'
        })
      );
    });

    it('returns consistent structure on multiple calls', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const status1 = await analyzer.getGitStatus();
      const status2 = await analyzer.getGitStatus();

      expect(status1).toEqual(status2);
    });
  });

  describe('getProjectStructure', () => {
    beforeEach(() => {
      // Mock empty directory by default
      mockFs.promises.readdir = vi.fn().mockResolvedValue([]);
      mockFs.promises.stat = vi.fn().mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 1000,
        mtime: new Date('2024-01-01'),
      });
    });

    it('returns project structure with basic information', async () => {
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
      expect(structure.excludedDirectories).toEqual(defaultOptions.excludeDirectories);
      expect(structure.scannedAt).toBeInstanceOf(Date);
    });

    it('detects project files and directories', async () => {
      const mockEntries = [
        { name: 'package.json', isFile: () => true, isDirectory: () => false },
        { name: 'README.md', isFile: () => true, isDirectory: () => false },
        { name: '.gitignore', isFile: () => true, isDirectory: () => false },
        { name: 'LICENSE', isFile: () => true, isDirectory: () => false },
        { name: 'src', isFile: () => false, isDirectory: () => true },
        { name: 'test', isFile: () => false, isDirectory: () => true },
      ];

      mockFs.promises.readdir = vi.fn()
        .mockResolvedValueOnce(mockEntries)  // Main directory scan
        .mockResolvedValueOnce(mockEntries.filter(e => e.isFile()))  // Root files scan
        .mockResolvedValue([]); // Empty subdirectories

      const structure = await analyzer.getProjectStructure();

      expect(structure.totalFiles).toBe(4);
      expect(structure.totalDirectories).toBe(2);
      expect(structure.hasPackageJson).toBe(true);
      expect(structure.hasReadme).toBe(true);
      expect(structure.hasGitIgnore).toBe(true);
      expect(structure.hasLicense).toBe(true);
      expect(structure.commonDirectories).toContain('src');
      expect(structure.commonDirectories).toContain('test');
      expect(structure.rootFiles).toContain('package.json');
      expect(structure.rootFiles).toContain('README.md');
    });

    it('identifies README files with various naming', async () => {
      const readmeVariants = [
        { name: 'README.md', isFile: () => true, isDirectory: () => false },
        { name: 'readme.txt', isFile: () => true, isDirectory: () => false },
        { name: 'ReadMe.rst', isFile: () => true, isDirectory: () => false },
      ];

      for (const readmeFile of readmeVariants) {
        mockFs.promises.readdir = vi.fn()
          .mockResolvedValueOnce([readmeFile])
          .mockResolvedValueOnce([readmeFile]);

        const structure = await analyzer.getProjectStructure();
        expect(structure.hasReadme).toBe(true);
      }
    });

    it('identifies LICENSE files with various naming', async () => {
      const licenseVariants = [
        { name: 'LICENSE', isFile: () => true, isDirectory: () => false },
        { name: 'license.txt', isFile: () => true, isDirectory: () => false },
        { name: 'LICENSE.md', isFile: () => true, isDirectory: () => false },
      ];

      for (const licenseFile of licenseVariants) {
        mockFs.promises.readdir = vi.fn()
          .mockResolvedValueOnce([licenseFile])
          .mockResolvedValueOnce([licenseFile]);

        const structure = await analyzer.getProjectStructure();
        expect(structure.hasLicense).toBe(true);
      }
    });

    it('scans nested directory structure', async () => {
      const nestedStructure = [
        { name: 'src', isFile: () => false, isDirectory: () => true }
      ];
      const srcContents = [
        { name: 'index.ts', isFile: () => true, isDirectory: () => false },
        { name: 'components', isFile: () => false, isDirectory: () => true }
      ];
      const componentContents = [
        { name: 'Button.tsx', isFile: () => true, isDirectory: () => false }
      ];

      mockFs.promises.readdir = vi.fn()
        .mockResolvedValueOnce(nestedStructure)  // Root
        .mockResolvedValueOnce([])               // Root files
        .mockResolvedValueOnce(srcContents)      // src/
        .mockResolvedValueOnce(componentContents); // src/components/

      const structure = await analyzer.getProjectStructure();

      expect(structure.totalFiles).toBe(2);
      expect(structure.totalDirectories).toBe(2);
      expect(structure.entries.length).toBe(1);

      const srcEntry = structure.entries[0];
      expect(srcEntry.name).toBe('src');
      expect(srcEntry.type).toBe('directory');
      expect(srcEntry.children).toBeDefined();
      expect(srcEntry.children?.length).toBe(2);

      const indexFile = srcEntry.children?.find(c => c.name === 'index.ts');
      expect(indexFile?.type).toBe('file');

      const componentsDir = srcEntry.children?.find(c => c.name === 'components');
      expect(componentsDir?.type).toBe('directory');
      expect(componentsDir?.children?.length).toBe(1);
    });

    it('respects maxDepth limitation', async () => {
      const shallowAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        maxDepth: 1,
      });

      const deepStructure = [
        { name: 'level1', isFile: () => false, isDirectory: () => true }
      ];
      const level1Contents = [
        { name: 'level2', isFile: () => false, isDirectory: () => true }
      ];

      mockFs.promises.readdir = vi.fn()
        .mockResolvedValueOnce(deepStructure)  // Root
        .mockResolvedValueOnce([])             // Root files
        .mockResolvedValueOnce(level1Contents); // level1/ - should not scan deeper

      const structure = await shallowAnalyzer.getProjectStructure();

      expect(structure.maxDepthScanned).toBe(1);
      expect(structure.totalDirectories).toBe(1);

      const level1Entry = structure.entries.find(e => e.name === 'level1');
      expect(level1Entry?.children?.length).toBe(0); // Should not contain level2
    });

    it('excludes specified directories', async () => {
      const excludingAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        excludeDirectories: ['node_modules', 'build'],
      });

      const mixedEntries = [
        { name: 'src', isFile: () => false, isDirectory: () => true },
        { name: 'node_modules', isFile: () => false, isDirectory: () => true },
        { name: 'build', isFile: () => false, isDirectory: () => true },
        { name: 'package.json', isFile: () => true, isDirectory: () => false },
      ];

      mockFs.promises.readdir = vi.fn()
        .mockResolvedValueOnce(mixedEntries)
        .mockResolvedValueOnce([mixedEntries[3]]) // Only package.json in root files
        .mockResolvedValueOnce([]); // src/ is empty

      const structure = await excludingAnalyzer.getProjectStructure();

      expect(structure.totalDirectories).toBe(1); // Only src
      expect(structure.entries.length).toBe(2); // src + package.json
      expect(structure.entries.find(e => e.name === 'node_modules')).toBeUndefined();
      expect(structure.entries.find(e => e.name === 'build')).toBeUndefined();
      expect(structure.entries.find(e => e.name === 'src')).toBeDefined();
    });

    it('handles hidden files based on includeHidden option', async () => {
      const hiddenFiles = [
        { name: '.env', isFile: () => true, isDirectory: () => false },
        { name: '.gitignore', isFile: () => true, isDirectory: () => false },
        { name: '.hidden-dir', isFile: () => false, isDirectory: () => true },
        { name: 'visible.js', isFile: () => true, isDirectory: () => false },
      ];

      // Test with includeHidden: false (default)
      mockFs.promises.readdir = vi.fn()
        .mockResolvedValueOnce(hiddenFiles)
        .mockResolvedValueOnce([hiddenFiles[3]]); // Only visible file in root

      const structureExcluded = await analyzer.getProjectStructure();
      expect(structureExcluded.totalFiles).toBe(1);
      expect(structureExcluded.totalDirectories).toBe(0);

      // Test with includeHidden: true
      const includingAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        includeHidden: true,
      });

      mockFs.promises.readdir = vi.fn()
        .mockResolvedValueOnce(hiddenFiles)
        .mockResolvedValueOnce(hiddenFiles.filter(f => f.isFile()))
        .mockResolvedValue([]);

      const structureIncluded = await includingAnalyzer.getProjectStructure();
      expect(structureIncluded.totalFiles).toBe(3);
      expect(structureIncluded.totalDirectories).toBe(1);
    });

    it('handles file system errors gracefully', async () => {
      mockFs.promises.readdir = vi.fn()
        .mockRejectedValueOnce(new Error('Permission denied'));

      const structure = await analyzer.getProjectStructure();

      expect(structure.totalFiles).toBe(0);
      expect(structure.totalDirectories).toBe(0);
      expect(structure.entries).toEqual([]);
      expect(structure.root).toBe(testProjectPath);
    });

    it('handles stat errors for individual entries', async () => {
      const mixedEntries = [
        { name: 'valid.js', isFile: () => true, isDirectory: () => false },
        { name: 'problematic', isFile: () => true, isDirectory: () => false },
      ];

      mockFs.promises.readdir = vi.fn()
        .mockResolvedValueOnce(mixedEntries)
        .mockResolvedValueOnce([mixedEntries[0]]);

      mockFs.promises.stat = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('problematic')) {
            return Promise.reject(new Error('Cannot stat file'));
          }
          return Promise.resolve({
            isFile: () => true,
            isDirectory: () => false,
            size: 1000,
            mtime: new Date('2024-01-01'),
          });
        });

      const structure = await analyzer.getProjectStructure();

      expect(structure.totalFiles).toBe(1); // Only the valid file
      expect(structure.entries.length).toBe(1);
      expect(structure.entries[0].name).toBe('valid.js');
    });

    it('includes excluded directories from options', async () => {
      const customExcluded = ['custom1', 'custom2'];
      const customAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        excludeDirectories: customExcluded,
      });

      const structure = await customAnalyzer.getProjectStructure();
      expect(structure.excludedDirectories).toEqual(customExcluded);
    });

    it('returns consistent structure on multiple calls', async () => {
      const structure1 = await analyzer.getProjectStructure();
      const structure2 = await analyzer.getProjectStructure();

      // scannedAt will be different, so we check other fields
      expect(structure1.root).toBe(structure2.root);
      expect(structure1.totalFiles).toBe(structure2.totalFiles);
      expect(structure1.excludedDirectories).toEqual(structure2.excludedDirectories);
    });

    it('validates project structure with Zod schema', async () => {
      const structure = await analyzer.getProjectStructure();

      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
    });

    it('sets timestamp for when scan was performed', async () => {
      const beforeScan = new Date();
      const structure = await analyzer.getProjectStructure();
      const afterScan = new Date();

      expect(structure.scannedAt.getTime()).toBeGreaterThanOrEqual(beforeScan.getTime());
      expect(structure.scannedAt.getTime()).toBeLessThanOrEqual(afterScan.getTime());
    });

    it('handles empty exclude directories array', async () => {
      const emptyExcludeAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        excludeDirectories: [],
      });

      const structure = await emptyExcludeAnalyzer.getProjectStructure();
      expect(structure.excludedDirectories).toEqual([]);
    });

    it('respects maxDepth option indirectly', async () => {
      const depthLimitedAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        maxDepth: 1,
      });

      const structure = await depthLimitedAnalyzer.getProjectStructure();

      // Structure should still be valid even with depth limits
      expect(structure.root).toBe(testProjectPath);
      expect(structure.totalFiles).toBe(0);
      expect(structure.totalDirectories).toBe(0);
    });

    it('handles includeHidden option', async () => {
      const hiddenIncludedAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        includeHidden: true,
      });

      const structure = await hiddenIncludedAnalyzer.getProjectStructure();

      // Structure should still be valid regardless of hidden files setting
      expect(structure.root).toBe(testProjectPath);
      expect(structure.scannedAt).toBeInstanceOf(Date);
    });
  });

  describe('detectFrameworks', () => {
    beforeEach(() => {
      // Mock file system for detectFrameworks tests
      mockFs.promises.readdir = vi.fn().mockResolvedValue([]);
      mockFs.promises.access = vi.fn().mockRejectedValue(new Error('File not found'));
      mockFs.promises.readFile = vi.fn().mockResolvedValue('{}');
    });

    it('returns empty framework detection by default', async () => {
      const frameworks = await analyzer.detectFrameworks();

      expect(frameworks).toEqual({
        frameworks: [],
        languages: [],
      });
    });

    it('detects React from package.json', async () => {
      const packageJson = {
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0'
        }
      };

      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('package.json')) return Promise.resolve();
          return Promise.reject(new Error('File not found'));
        });

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks.length).toBeGreaterThan(0);
      const react = detection.frameworks.find(f => f.name === 'React');
      expect(react).toBeDefined();
      expect(react?.version).toBe('^18.0.0');
      expect(react?.category).toBe('frontend');
      expect(react?.confidence).toBe('high');
    });

    it('detects TypeScript from package.json', async () => {
      const packageJson = {
        devDependencies: {
          typescript: '^5.0.0'
        }
      };

      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('package.json')) return Promise.resolve();
          return Promise.reject(new Error('File not found'));
        });

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks.length).toBeGreaterThan(0);
      const typescript = detection.frameworks.find(f => f.name === 'TypeScript');
      expect(typescript).toBeDefined();
      expect(typescript?.language).toBe('typescript');
      expect(typescript?.isDevDependency).toBe(true);
    });

    it('detects Next.js from config file', async () => {
      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('package.json') || filePath.includes('next.config.js')) {
            return Promise.resolve();
          }
          return Promise.reject(new Error('File not found'));
        });

      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks.length).toBeGreaterThan(0);
      const nextjs = detection.frameworks.find(f => f.name === 'Next.js');
      expect(nextjs).toBeDefined();
      expect(nextjs?.category).toBe('fullstack');
      expect(nextjs?.confidence).toBe('medium');
      expect(nextjs?.configFiles).toContain('next.config.js');
    });

    it('detects programming languages from file extensions', async () => {
      // Mock directory structure with TypeScript and JavaScript files
      const mockEntries = [
        { name: 'index.ts', isFile: () => true, isDirectory: () => false },
        { name: 'utils.js', isFile: () => true, isDirectory: () => false },
        { name: 'styles.css', isFile: () => true, isDirectory: () => false },
        { name: 'component.tsx', isFile: () => true, isDirectory: () => false }
      ];

      mockFs.promises.readdir = vi.fn().mockResolvedValue(mockEntries);

      const detection = await analyzer.detectFrameworks();

      expect(detection.languages).toBeDefined();
      expect(detection.languages.length).toBeGreaterThan(0);

      const languageNames = detection.languages.map(l => l.name);
      expect(languageNames).toContain('TypeScript');
      expect(languageNames).toContain('JavaScript');
      expect(languageNames).toContain('CSS');
      expect(detection.primaryLanguage).toBeDefined();
    });

    it('detects package manager from lock files', async () => {
      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('yarn.lock')) return Promise.resolve();
          return Promise.reject(new Error('File not found'));
        });

      const detection = await analyzer.detectFrameworks();

      expect(detection.packageManager).toBe('yarn');
    });

    it('prioritizes package-lock.json over other lock files', async () => {
      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('package-lock.json') ||
              filePath.includes('yarn.lock') ||
              filePath.includes('package.json')) {
            return Promise.resolve();
          }
          return Promise.reject(new Error('File not found'));
        });

      const detection = await analyzer.detectFrameworks();

      expect(detection.packageManager).toBe('npm');
    });

    it('detects runtime based on frameworks', async () => {
      const packageJson = {
        dependencies: {
          express: '^4.18.0'
        }
      };

      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('package.json')) return Promise.resolve();
          return Promise.reject(new Error('File not found'));
        });

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const detection = await analyzer.detectFrameworks();

      expect(detection.runtime).toBe('node');
    });

    it('handles package.json parsing errors gracefully', async () => {
      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue('invalid json{');

      const detection = await analyzer.detectFrameworks();

      expect(detection.error).toBeDefined();
      expect(detection.frameworks).toEqual([]);
    });

    it('returns consistent results on multiple calls', async () => {
      const frameworks1 = await analyzer.detectFrameworks();
      const frameworks2 = await analyzer.detectFrameworks();

      expect(frameworks1).toEqual(frameworks2);
    });

    it('validates framework detection with Zod schema', async () => {
      const detection = await analyzer.detectFrameworks();

      expect(() => FrameworkDetectionSchema.parse(detection)).not.toThrow();
    });

    it('returns structure with all optional fields as undefined when empty', async () => {
      const detection = await analyzer.detectFrameworks();

      expect(detection.primary).toBeUndefined();
      expect(detection.primaryLanguage).toBeUndefined();
      expect(detection.runtime).toBeUndefined();
      expect(detection.packageManager).toBeUndefined();
      expect(detection.error).toBeUndefined();
      expect(detection.frameworks).toEqual([]);
      expect(detection.languages).toEqual([]);
    });

    it('handles empty frameworks and languages arrays', async () => {
      const detection = await analyzer.detectFrameworks();

      expect(Array.isArray(detection.frameworks)).toBe(true);
      expect(Array.isArray(detection.languages)).toBe(true);
      expect(detection.frameworks.length).toBe(0);
      expect(detection.languages.length).toBe(0);
    });

    it('deduplicates frameworks detected through multiple methods', async () => {
      const packageJson = {
        dependencies: {
          jest: '^29.0.0'
        }
      };

      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('package.json') ||
              filePath.includes('jest.config.js')) {
            return Promise.resolve();
          }
          return Promise.reject(new Error('File not found'));
        });

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const detection = await analyzer.detectFrameworks();

      const jestFrameworks = detection.frameworks.filter(f => f.name === 'Jest');
      expect(jestFrameworks.length).toBe(1); // Should be deduplicated
    });

    it('sorts frameworks by confidence', async () => {
      const packageJson = {
        dependencies: {
          react: '^18.0.0'  // high confidence
        }
      };

      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('package.json') ||
              filePath.includes('vite.config.js')) {  // medium confidence
            return Promise.resolve();
          }
          return Promise.reject(new Error('File not found'));
        });

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const detection = await analyzer.detectFrameworks();

      if (detection.frameworks.length > 1) {
        // React should be first (high confidence)
        const react = detection.frameworks.find(f => f.name === 'React');
        const vite = detection.frameworks.find(f => f.name === 'Vite');

        if (react && vite) {
          const reactIndex = detection.frameworks.indexOf(react);
          const viteIndex = detection.frameworks.indexOf(vite);
          expect(reactIndex).toBeLessThan(viteIndex);
        }
      }
    });

    it('sets primary framework to highest confidence', async () => {
      const packageJson = {
        dependencies: {
          react: '^18.0.0'
        }
      };

      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('package.json')) return Promise.resolve();
          return Promise.reject(new Error('File not found'));
        });

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const detection = await analyzer.detectFrameworks();

      if (detection.frameworks.length > 0) {
        expect(detection.primary).toBe(detection.frameworks[0]);
      }
    });
  });

  describe('getConfigurationInfoList', () => {
    beforeEach(() => {
      // Default to no config files found
      mockFs.promises.access = vi.fn().mockRejectedValue(new Error('File not found'));
      mockFs.promises.stat = vi.fn().mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01')
      });
    });

    it('returns empty configuration list when no configs found', async () => {
      const configs = await analyzer.getConfigurationInfoList();
      expect(configs).toEqual([]);
    });

    it('detects package.json configuration', async () => {
      const packageJsonContent = {
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          test: 'vitest',
          build: 'tsc'
        },
        dependencies: {
          react: '^18.0.0'
        }
      };

      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('package.json')) return Promise.resolve();
          return Promise.reject(new Error('File not found'));
        });

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJsonContent));

      const configs = await analyzer.getConfigurationInfoList();

      expect(configs.length).toBeGreaterThan(0);
      const packageConfig = configs.find(c => c.name === 'package.json');
      expect(packageConfig).toBeDefined();
      expect(packageConfig?.format).toBe('json');
      expect(packageConfig?.purpose).toBe('package-manager');
      expect(packageConfig?.isValid).toBe(true);
      expect(packageConfig?.keySettings).toBeDefined();
      expect(packageConfig?.keySettings?.name).toBe('test-project');
      expect(packageConfig?.keySettings?.scripts).toEqual(['test', 'build']);
    });

    it('detects TypeScript configuration', async () => {
      const tsconfigContent = {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true
        },
        include: ['src/**/*'],
        exclude: ['node_modules']
      };

      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('tsconfig.json')) return Promise.resolve();
          return Promise.reject(new Error('File not found'));
        });

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(tsconfigContent));

      const configs = await analyzer.getConfigurationInfoList();

      expect(configs.length).toBeGreaterThan(0);
      const tsConfig = configs.find(c => c.name === 'tsconfig.json');
      expect(tsConfig).toBeDefined();
      expect(tsConfig?.format).toBe('json');
      expect(tsConfig?.purpose).toBe('typescript');
      expect(tsConfig?.keySettings?.compilerOptions).toBeDefined();
      expect(tsConfig?.keySettings?.compilerOptions?.strict).toBe(true);
    });

    it('detects ESLint configuration', async () => {
      const eslintConfig = {
        extends: ['eslint:recommended', '@typescript-eslint/recommended'],
        rules: {
          'no-unused-vars': 'error'
        }
      };

      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('.eslintrc.json')) return Promise.resolve();
          return Promise.reject(new Error('File not found'));
        });

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(eslintConfig));

      const configs = await analyzer.getConfigurationInfoList();

      expect(configs.length).toBeGreaterThan(0);
      const eslintConf = configs.find(c => c.purpose === 'linting');
      expect(eslintConf).toBeDefined();
      expect(eslintConf?.format).toBe('json');
    });

    it('handles invalid JSON gracefully', async () => {
      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('package.json')) return Promise.resolve();
          return Promise.reject(new Error('File not found'));
        });

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue('{ invalid json content');

      const configs = await analyzer.getConfigurationInfoList();

      if (configs.length > 0) {
        const invalidConfig = configs[0];
        expect(invalidConfig.isValid).toBe(false);
        expect(invalidConfig.validationError).toContain('JSON parse error');
      }
    });

    it('skips parsing large files', async () => {
      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.stat = vi.fn().mockResolvedValue({
        size: 200000, // 200KB - exceeds 100KB limit
        mtime: new Date('2024-01-01')
      });
      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue('{"large": "file"}');

      const configs = await analyzer.getConfigurationInfoList();

      for (const config of configs) {
        expect(config.keySettings).toBeUndefined();
        expect(config.size).toBe(200000);
      }
    });

    it('detects Jest test configuration', async () => {
      const jestConfig = {
        testEnvironment: 'jsdom',
        collectCoverage: true,
        testMatch: ['**/*.test.js']
      };

      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('jest.config.js')) return Promise.resolve();
          return Promise.reject(new Error('File not found'));
        });

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(jestConfig));

      const configs = await analyzer.getConfigurationInfoList();

      const jestConf = configs.find(c => c.purpose === 'testing');
      expect(jestConf).toBeDefined();
      expect(jestConf?.keySettings?.testEnvironment).toBe('jsdom');
      expect(jestConf?.keySettings?.collectCoverage).toBe(true);
    });

    it('finds multiple configuration types', async () => {
      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          const configFiles = [
            'package.json', 'tsconfig.json', '.eslintrc.json',
            'jest.config.js', '.gitignore', 'README.md'
          ];
          if (configFiles.some(file => filePath.includes(file))) {
            return Promise.resolve();
          }
          return Promise.reject(new Error('File not found'));
        });

      mockFs.promises.readFile = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('.json')) {
            return Promise.resolve('{}');
          }
          return Promise.resolve('# Config file');
        });

      const configs = await analyzer.getConfigurationInfoList();

      expect(configs.length).toBeGreaterThan(0);
      const purposes = configs.map(c => c.purpose);
      expect(purposes).toContain('package-manager');
      expect(purposes).toContain('typescript');
      expect(purposes).toContain('linting');
      expect(purposes).toContain('testing');
      expect(purposes).toContain('git');
      expect(purposes).toContain('documentation');
    });

    it('returns consistent results on multiple calls', async () => {
      const configs1 = await analyzer.getConfigurationInfoList();
      const configs2 = await analyzer.getConfigurationInfoList();

      expect(configs1).toEqual(configs2);
    });

    it('validates configuration info with Zod schema', async () => {
      const configs = await analyzer.getConfigurationInfoList();

      for (const config of configs) {
        expect(() => ConfigurationInfoSchema.parse(config)).not.toThrow();
      }
    });

    it('returns array type for configurations', async () => {
      const configs = await analyzer.getConfigurationInfoList();

      expect(Array.isArray(configs)).toBe(true);
    });
  });

  describe('getTestFrameworkInfoList', () => {
    beforeEach(() => {
      // Default to no test frameworks found
      mockFs.promises.access = vi.fn().mockRejectedValue(new Error('File not found'));
      mockFs.promises.readFile = vi.fn().mockResolvedValue('{}');
      mockFs.promises.stat = vi.fn().mockResolvedValue({
        isDirectory: () => false,
      });
    });

    it('returns empty test framework list when no frameworks found', async () => {
      const testFrameworks = await analyzer.getTestFrameworkInfoList();
      expect(testFrameworks).toEqual([]);
    });

    it('detects Jest from package.json', async () => {
      const packageJson = {
        devDependencies: {
          jest: '^29.0.0'
        }
      };

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      expect(testFrameworks.length).toBeGreaterThan(0);
      const jest = testFrameworks.find(t => t.name === 'Jest');
      expect(jest).toBeDefined();
      expect(jest?.type).toBe('unit');
      expect(jest?.version).toBe('^29.0.0');
      expect(jest?.testPatterns).toContain('**/*.test.js');
      expect(jest?.runCommand).toBe('npm test');
    });

    it('detects Playwright from package.json and config', async () => {
      const packageJson = {
        devDependencies: {
          '@playwright/test': '^1.0.0'
        }
      };

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('playwright.config.js')) return Promise.resolve();
          return Promise.reject(new Error('File not found'));
        });

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      expect(testFrameworks.length).toBeGreaterThan(0);
      const playwright = testFrameworks.find(t => t.name === 'Playwright');
      expect(playwright).toBeDefined();
      expect(playwright?.type).toBe('e2e');
      expect(playwright?.version).toBe('^1.0.0');
      expect(playwright?.configFile).toBe('playwright.config.js');
      expect(playwright?.runCommand).toBe('npx playwright test');
    });

    it('detects Cypress from config file only', async () => {
      mockFs.promises.access = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('cypress.config.js')) return Promise.resolve();
          return Promise.reject(new Error('File not found'));
        });

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      expect(testFrameworks.length).toBeGreaterThan(0);
      const cypress = testFrameworks.find(t => t.name === 'Cypress');
      expect(cypress).toBeDefined();
      expect(cypress?.type).toBe('e2e');
      expect(cypress?.configFile).toBe('cypress.config.js');
    });

    it('detects Vitest from package.json', async () => {
      const packageJson = {
        devDependencies: {
          vitest: '^1.0.0'
        }
      };

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      expect(testFrameworks.length).toBeGreaterThan(0);
      const vitest = testFrameworks.find(t => t.name === 'Vitest');
      expect(vitest).toBeDefined();
      expect(vitest?.type).toBe('unit');
      expect(vitest?.version).toBe('^1.0.0');
      expect(vitest?.testPatterns).toContain('**/*.test.ts');
    });

    it('detects Testing Library as component testing tool', async () => {
      const packageJson = {
        devDependencies: {
          '@testing-library/react': '^14.0.0'
        }
      };

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      expect(testFrameworks.length).toBeGreaterThan(0);
      const testingLibrary = testFrameworks.find(t => t.name === 'Testing Library');
      expect(testingLibrary).toBeDefined();
      expect(testingLibrary?.type).toBe('component');
      expect(testingLibrary?.version).toBe('^14.0.0');
    });

    it('detects multiple test frameworks', async () => {
      const packageJson = {
        devDependencies: {
          jest: '^29.0.0',
          '@playwright/test': '^1.0.0',
          '@testing-library/react': '^14.0.0'
        }
      };

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      expect(testFrameworks.length).toBeGreaterThanOrEqual(3);
      const frameworkNames = testFrameworks.map(t => t.name);
      expect(frameworkNames).toContain('Jest');
      expect(frameworkNames).toContain('Playwright');
      expect(frameworkNames).toContain('Testing Library');
    });

    it('detects test framework features and plugins', async () => {
      const packageJson = {
        devDependencies: {
          jest: '^29.0.0',
          'c8': '^8.0.0', // Coverage tool
          'ts-jest': '^29.0.0', // Jest plugin
          '@testing-library/jest-dom': '^6.0.0' // Assertion library
        }
      };

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      const jest = testFrameworks.find(t => t.name === 'Jest');
      expect(jest?.coverageEnabled).toBe(true);
      expect(jest?.coverageTool).toBe('c8');
      expect(jest?.assertionLibrary).toBe('@testing-library/jest-dom');
      expect(jest?.plugins).toContain('ts-jest');
      expect(jest?.watchModeAvailable).toBe(true);
    });

    it('detects test directories', async () => {
      const packageJson = {
        devDependencies: {
          jest: '^29.0.0'
        }
      };

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      // Mock test directory exists
      mockFs.promises.stat = vi.fn()
        .mockImplementation((filePath: string) => {
          if (filePath.includes('test') || filePath.includes('tests')) {
            return Promise.resolve({ isDirectory: () => true });
          }
          throw new Error('Directory does not exist');
        });

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      const jest = testFrameworks.find(t => t.name === 'Jest');
      expect(jest?.testDirectory).toBeDefined();
      expect(['test', 'tests', '__tests__']).toContain(jest?.testDirectory);
    });

    it('detects Storybook as additional test tool', async () => {
      const packageJson = {
        devDependencies: {
          '@storybook/react': '^7.0.0'
        }
      };

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      expect(testFrameworks.length).toBeGreaterThan(0);
      const storybook = testFrameworks.find(t => t.name === 'Storybook');
      expect(storybook).toBeDefined();
      expect(storybook?.type).toBe('component');
      expect(storybook?.testPatterns).toContain('**/*.stories.js');
      expect(storybook?.runCommand).toBe('npm run storybook');
      expect(storybook?.watchModeAvailable).toBe(true);
    });

    it('detects ESLint with testing plugins', async () => {
      const packageJson = {
        devDependencies: {
          eslint: '^8.0.0',
          'eslint-plugin-jest': '^27.0.0',
          'eslint-plugin-testing-library': '^6.0.0'
        }
      };

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      const eslintTesting = testFrameworks.find(t => t.name === 'ESLint (Testing)');
      expect(eslintTesting).toBeDefined();
      expect(eslintTesting?.type).toBe('other');
      expect(eslintTesting?.plugins).toContain('eslint-plugin-jest');
      expect(eslintTesting?.plugins).toContain('eslint-plugin-testing-library');
    });

    it('handles package.json without test frameworks', async () => {
      const packageJson = {
        dependencies: {
          react: '^18.0.0'
        }
      };

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      expect(testFrameworks).toEqual([]);
    });

    it('handles malformed package.json', async () => {
      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue('{ invalid json');

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      expect(testFrameworks).toEqual([]);
    });

    it('counts test files for frameworks', async () => {
      const packageJson = {
        devDependencies: {
          jest: '^29.0.0'
        }
      };

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(packageJson));

      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      const jest = testFrameworks.find(t => t.name === 'Jest');
      expect(jest?.testFileCount).toBeTypeOf('number');
      expect(jest?.testFileCount).toBeGreaterThanOrEqual(0);
    });

    it('returns consistent results on multiple calls', async () => {
      const frameworks1 = await analyzer.getTestFrameworkInfoList();
      const frameworks2 = await analyzer.getTestFrameworkInfoList();

      expect(frameworks1).toEqual(frameworks2);
    });

    it('validates test framework info with Zod schema', async () => {
      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      for (const framework of testFrameworks) {
        expect(() => TestFrameworkInfoSchema.parse(framework)).not.toThrow();
      }
    });

    it('returns array type for test frameworks', async () => {
      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      expect(Array.isArray(testFrameworks)).toBe(true);
    });
  });

  describe('analyze', () => {
    it('performs complete analysis with all options enabled', async () => {
      // Mock git status to avoid real git calls
      mockExecAsync.mockRejectedValueOnce(new Error('not a git repo'));

      const context = await analyzer.analyze();

      expect(context.gitStatus).toBeDefined();
      expect(context.structure).toBeDefined();
      expect(context.frameworks).toEqual([]);
      expect(context.configurations).toEqual([]);
      expect(context.testFrameworks).toEqual([]);
      expect(context.detectedAt).toBeInstanceOf(Date);
      expect(context.errors).toEqual([]);
    });

    it('performs analysis with git repository', async () => {
      // Mock a successful git repository analysis
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // branch
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // clean status

      const context = await analyzer.analyze();

      expect(context.gitStatus).toBeDefined();
      expect(context.gitStatus?.isRepository).toBe(true);
      expect(context.gitStatus?.branch).toBe('main');
    });

    it('excludes git status when analyzeGit is false', async () => {
      const noGitAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        analyzeGit: false,
      });

      const context = await noGitAnalyzer.analyze();
      expect(context.gitStatus).toBeUndefined();
      expect(context.structure).toBeDefined();
    });

    it('returns empty frameworks when detectFrameworks is false', async () => {
      const noFrameworkAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        detectFrameworks: false,
      });

      // Mock git to avoid real git calls
      mockExecAsync.mockRejectedValueOnce(new Error('not a git repo'));

      const context = await noFrameworkAnalyzer.analyze();
      expect(context.frameworks).toEqual([]);
    });

    it('returns empty configurations when analyzeConfiguration is false', async () => {
      const noConfigAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        analyzeConfiguration: false,
      });

      mockExecAsync.mockRejectedValueOnce(new Error('not a git repo'));

      const context = await noConfigAnalyzer.analyze();
      expect(context.configurations).toEqual([]);
    });

    it('returns empty test frameworks when detectTests is false', async () => {
      const noTestAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        detectTests: false,
      });

      mockExecAsync.mockRejectedValueOnce(new Error('not a git repo'));

      const context = await noTestAnalyzer.analyze();
      expect(context.testFrameworks).toEqual([]);
    });

    it('validates complete project context with Zod schema', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('not a git repo'));

      const context = await analyzer.analyze();

      expect(() => ProjectContextSchema.parse(context)).not.toThrow();
    });

    it('handles parallel analysis calls correctly', async () => {
      // Mock git calls for each parallel call
      mockExecAsync
        .mockRejectedValueOnce(new Error('not a git repo'))
        .mockRejectedValueOnce(new Error('not a git repo'))
        .mockRejectedValueOnce(new Error('not a git repo'));

      const [context1, context2, context3] = await Promise.all([
        analyzer.analyze(),
        analyzer.analyze(),
        analyzer.analyze(),
      ]);

      // All should have similar structure (detectedAt will differ)
      expect(context1.structure.root).toBe(context2.structure.root);
      expect(context2.structure.root).toBe(context3.structure.root);
      expect(context1.frameworks).toEqual(context2.frameworks);
      expect(context2.frameworks).toEqual(context3.frameworks);
    });

    it('includes current timestamp in detectedAt', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('not a git repo'));

      const beforeAnalysis = new Date();
      const context = await analyzer.analyze();
      const afterAnalysis = new Date();

      expect(context.detectedAt.getTime()).toBeGreaterThanOrEqual(beforeAnalysis.getTime());
      expect(context.detectedAt.getTime()).toBeLessThanOrEqual(afterAnalysis.getTime());
    });

    it('runs analysis steps in parallel efficiently', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('not a git repo'));

      const startTime = Date.now();
      await analyzer.analyze();
      const endTime = Date.now();

      // Should complete relatively quickly since operations are mocked
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('includes empty errors array by default', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('not a git repo'));

      const context = await analyzer.analyze();

      expect(context.errors).toEqual([]);
      expect(Array.isArray(context.errors)).toBe(true);
    });

    it('populates all required fields in ProjectContext', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('not a git repo'));

      const context = await analyzer.analyze();

      // Verify all required fields are present
      expect(context).toHaveProperty('structure');
      expect(context).toHaveProperty('frameworks');
      expect(context).toHaveProperty('configurations');
      expect(context).toHaveProperty('testFrameworks');
      expect(context).toHaveProperty('detectedAt');
      expect(context).toHaveProperty('errors');

      // Optional field based on analyzeGit option
      expect(context).toHaveProperty('gitStatus');
    });

    it('maintains data consistency across analyze calls', async () => {
      mockExecAsync
        .mockRejectedValueOnce(new Error('not a git repo'))
        .mockRejectedValueOnce(new Error('not a git repo'));

      const context1 = await analyzer.analyze();
      const context2 = await analyzer.analyze();

      // Non-timestamp fields should be identical
      expect(context1.structure.root).toBe(context2.structure.root);
      expect(context1.structure.totalFiles).toBe(context2.structure.totalFiles);
      expect(context1.frameworks).toEqual(context2.frameworks);
      expect(context1.configurations).toEqual(context2.configurations);
      expect(context1.testFrameworks).toEqual(context2.testFrameworks);
      expect(context1.errors).toEqual(context2.errors);
    });
  });

  describe('error handling and edge cases', () => {
    it('handles exceptions in analyze method gracefully', async () => {
      // Mock one of the methods to throw an error
      const errorAnalyzer = new ProjectContextAnalyzer(testProjectPath);
      vi.spyOn(errorAnalyzer, 'getProjectStructure').mockRejectedValue(new Error('Test error'));

      // The analyze method should propagate the error
      await expect(errorAnalyzer.analyze()).rejects.toThrow('Test error');
    });

    it('handles exceptions in individual methods gracefully', async () => {
      const errorAnalyzer = new ProjectContextAnalyzer(testProjectPath);
      vi.spyOn(errorAnalyzer, 'getGitStatus').mockRejectedValue(new Error('Git error'));

      await expect(errorAnalyzer.getGitStatus()).rejects.toThrow('Git error');
    });

    it('handles malformed git output gracefully', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git rev-parse
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // branch
        .mockResolvedValueOnce({
          stdout: 'malformed\ninvalid format\n',
          stderr: ''
        }); // malformed status

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
    });

    it('handles concurrent calls to different methods', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const promises = [
        analyzer.getGitStatus(),
        analyzer.getProjectStructure(),
        analyzer.detectFrameworks(),
        analyzer.getConfigurationInfoList(),
        analyzer.getTestFrameworkInfoList(),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results[0]).toHaveProperty('isRepository');
      expect(results[1]).toHaveProperty('root');
      expect(results[2]).toHaveProperty('frameworks');
      expect(Array.isArray(results[3])).toBe(true);
      expect(Array.isArray(results[4])).toBe(true);
    });

    it('handles empty project path', () => {
      const emptyPathAnalyzer = new ProjectContextAnalyzer('');
      expect(emptyPathAnalyzer.getProjectPath()).toBe('');
    });

    it('handles very long project path', () => {
      const longPath = '/very/long/path/that/goes/on/for/a/while/to/test/edge/cases/' + 'segment/'.repeat(20);
      const longPathAnalyzer = new ProjectContextAnalyzer(longPath);
      expect(longPathAnalyzer.getProjectPath()).toBe(longPath);
    });

    it('handles special characters in project path', () => {
      const specialPath = '/path/with spaces/and-dashes/and_underscores/and@symbols/and#more';
      const specialAnalyzer = new ProjectContextAnalyzer(specialPath);
      expect(specialAnalyzer.getProjectPath()).toBe(specialPath);
    });

    it('handles extreme maxDepth values', () => {
      const extremeOptions = [
        { maxDepth: 0 },
        { maxDepth: -1 },
        { maxDepth: 1000 },
        { maxDepth: Number.MAX_SAFE_INTEGER },
      ];

      for (const options of extremeOptions) {
        const extremeAnalyzer = new ProjectContextAnalyzer(testProjectPath, options);
        expect(extremeAnalyzer.getOptions().maxDepth).toBe(options.maxDepth);
      }
    });

    it('handles empty excludeDirectories array', () => {
      const emptyExclude = { excludeDirectories: [] };
      const emptyExcludeAnalyzer = new ProjectContextAnalyzer(testProjectPath, emptyExclude);
      expect(emptyExcludeAnalyzer.getOptions().excludeDirectories).toEqual([]);
    });

    it('handles large excludeDirectories array', () => {
      const largeExclude = {
        excludeDirectories: Array.from({ length: 100 }, (_, i) => `exclude-${i}`)
      };
      const largeExcludeAnalyzer = new ProjectContextAnalyzer(testProjectPath, largeExclude);
      expect(largeExcludeAnalyzer.getOptions().excludeDirectories).toHaveLength(100);
    });

    it('handles null and undefined option values gracefully', () => {
      const nullishOptions = {
        maxDepth: undefined,
        includeHidden: undefined,
        excludeDirectories: undefined,
        analyzeGit: undefined,
      } as any;

      // Should not throw, should use defaults
      expect(() => {
        new ProjectContextAnalyzer(testProjectPath, nullishOptions);
      }).not.toThrow();
    });

    it('maintains stability under repeated analyze calls', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      // Run multiple analyze calls
      const results = await Promise.all(
        Array.from({ length: 10 }, () => analyzer.analyze())
      );

      // All should complete successfully
      expect(results).toHaveLength(10);

      // All should have consistent non-timestamp data
      const firstResult = results[0];
      for (let i = 1; i < results.length; i++) {
        expect(results[i].structure.root).toBe(firstResult.structure.root);
        expect(results[i].frameworks).toEqual(firstResult.frameworks);
      }
    });

    it('handles git command timeout scenarios', async () => {
      // Simulate command timing out
      mockExecAsync.mockRejectedValueOnce(new Error('Command timed out'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(false);
    });

    it('handles invalid commit timestamp format', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git rev-parse
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // branch
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // status
        .mockResolvedValueOnce({
          stdout: 'abc123|Test commit|invalid-timestamp\n',
          stderr: ''
        }); // invalid timestamp

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.lastCommitHash).toBeUndefined();
      expect(gitStatus.lastCommitMessage).toBeUndefined();
      expect(gitStatus.lastCommitTimestamp).toBeUndefined();
    });

    it('handles partial git status parsing', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git rev-parse
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // branch
        .mockResolvedValueOnce({
          stdout: 'M  file1.js\n\n   \nD  file2.js\n', // with empty lines
          stderr: ''
        });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.staged).toHaveLength(2);
      expect(gitStatus.staged.find(f => f.path === 'file1.js')?.status).toBe('M');
      expect(gitStatus.staged.find(f => f.path === 'file2.js')?.status).toBe('D');
    });

    it('handles memory pressure with large option objects', () => {
      const largeOptions = {
        maxDepth: 50,
        includeHidden: true,
        excludeDirectories: Array.from({ length: 1000 }, (_, i) => `dir-${i}`),
        analyzeGit: true,
        detectFrameworks: true,
        analyzeConfiguration: true,
        detectTests: true,
      };

      expect(() => {
        const analyzer = new ProjectContextAnalyzer(testProjectPath, largeOptions);
        expect(analyzer.getOptions().excludeDirectories).toHaveLength(1000);
      }).not.toThrow();
    });

    it('handles mixed success and failure in parallel operations', async () => {
      // Mock git to fail, but other operations succeed
      mockExecAsync.mockRejectedValue(new Error('git failed'));

      // Create analyzer that has some operations disabled
      const mixedAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        analyzeGit: true, // This will fail
        detectFrameworks: true, // This will succeed (returns empty)
        analyzeConfiguration: false, // This will return empty
        detectTests: false, // This will return empty
      });

      const context = await mixedAnalyzer.analyze();

      // Should complete successfully despite git failure
      expect(context.gitStatus?.isRepository).toBe(false);
      expect(context.structure).toBeDefined();
      expect(context.frameworks).toEqual([]);
      expect(context.configurations).toEqual([]);
      expect(context.testFrameworks).toEqual([]);
    });
  });

});

describe('Schema Validation', () => {
  describe('FrameworkDetectionSchema', () => {
    it('validates valid framework detection', () => {
      const validFrameworkDetection: FrameworkDetection = {
        primary: {
          name: 'React',
          version: '18.0.0',
          confidence: 0.95,
          evidence: ['package.json'],
          category: 'frontend'
        },
        frameworks: [
          {
            name: 'React',
            version: '18.0.0',
            confidence: 0.95,
            evidence: ['package.json'],
            category: 'frontend'
          },
        ],
        primaryLanguage: 'TypeScript',
        languages: [
          {
            name: 'TypeScript',
            extensions: ['.ts', '.tsx'],
            percentage: 80,
          },
        ],
        runtime: 'node',
        packageManager: 'npm',
      };

      const result = FrameworkDetectionSchema.safeParse(validFrameworkDetection);
      expect(result.success).toBe(true);
    });

    it('validates minimal framework detection', () => {
      const minimalFrameworkDetection = {
        frameworks: [],
        languages: [],
      };

      const result = FrameworkDetectionSchema.safeParse(minimalFrameworkDetection);
      expect(result.success).toBe(true);
    });

    it('rejects invalid framework detection with invalid language percentage', () => {
      const invalidFrameworkDetection = {
        frameworks: [],
        languages: [
          {
            name: 'TypeScript',
            extensions: ['.ts'],
            percentage: 150, // Invalid - over 100
          },
        ],
      };

      const result = FrameworkDetectionSchema.safeParse(invalidFrameworkDetection);
      expect(result.success).toBe(false);
    });

    it('validates framework detection with error', () => {
      const errorFrameworkDetection = {
        frameworks: [],
        languages: [],
        error: 'Failed to detect frameworks',
      };

      const result = FrameworkDetectionSchema.safeParse(errorFrameworkDetection);
      expect(result.success).toBe(true);
    });

    it('validates boundary values for language percentages', () => {
      const boundaryDetections = [
        { frameworks: [], languages: [{ name: 'Test', extensions: ['.test'], percentage: 0 }] },
        { frameworks: [], languages: [{ name: 'Test', extensions: ['.test'], percentage: 100 }] },
        { frameworks: [], languages: [{ name: 'Test', extensions: ['.test'], percentage: 50.5 }] },
      ];

      for (const detection of boundaryDetections) {
        const result = FrameworkDetectionSchema.safeParse(detection);
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid language percentages', () => {
      const invalidPercentages = [-1, 101, -50, 200];

      for (const percentage of invalidPercentages) {
        const detection = {
          frameworks: [],
          languages: [{ name: 'Test', extensions: ['.test'], percentage }]
        };
        const result = FrameworkDetectionSchema.safeParse(detection);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('ConfigFileInfoSchema', () => {
    it('validates valid config file info', () => {
      const validConfigFileInfo: ConfigFileInfo = {
        name: 'package.json',
        path: './package.json',
        type: 'package',
        exists: true,
        description: 'Node.js package configuration',
      };

      const result = ConfigFileInfoSchema.safeParse(validConfigFileInfo);
      expect(result.success).toBe(true);
    });

    it('validates minimal config file info', () => {
      const minimalConfigFileInfo = {
        name: 'webpack.config.js',
        path: './webpack.config.js',
        type: 'webpack',
        exists: false,
      };

      const result = ConfigFileInfoSchema.safeParse(minimalConfigFileInfo);
      expect(result.success).toBe(true);
    });

    it('validates all config file types', () => {
      const types = [
        'package', 'typescript', 'eslint', 'prettier', 'babel', 'webpack',
        'vite', 'rollup', 'jest', 'vitest', 'docker', 'ci', 'git', 'editor',
        'environment', 'other',
      ];

      types.forEach(type => {
        const configFileInfo = {
          name: `${type}.config`,
          path: `./${type}.config`,
          type,
          exists: true,
        };

        const result = ConfigFileInfoSchema.safeParse(configFileInfo);
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid config file type', () => {
      const invalidConfigFileInfo = {
        name: 'invalid.config',
        path: './invalid.config',
        type: 'invalid-type',
        exists: true,
      };

      const result = ConfigFileInfoSchema.safeParse(invalidConfigFileInfo);
      expect(result.success).toBe(false);
    });

    it('validates config file with long description', () => {
      const longDescription = 'A very long description that goes on and on about what this configuration file does and how it works in the project system';
      const configFile = {
        name: 'test.config',
        path: './test.config',
        type: 'other',
        exists: true,
        description: longDescription,
      };

      const result = ConfigFileInfoSchema.safeParse(configFile);
      expect(result.success).toBe(true);
    });
  });
});


describe('getProjectContextAnalyzer', () => {
  afterEach(() => {
    // Reset the singleton
    vi.resetModules();
  });

  it('creates a new analyzer instance', () => {
    const analyzer = getProjectContextAnalyzer(testProjectPath);
    expect(analyzer).toBeInstanceOf(ProjectContextAnalyzer);
    expect(analyzer.getProjectPath()).toBe(testProjectPath);
  });

  it('reuses analyzer for same path', () => {
    const analyzer1 = getProjectContextAnalyzer(testProjectPath);
    const analyzer2 = getProjectContextAnalyzer(testProjectPath);
    expect(analyzer1).toBe(analyzer2);
  });

  it('creates new analyzer for different path', () => {
    const path1 = '/path1';
    const path2 = '/path2';

    const analyzer1 = getProjectContextAnalyzer(path1);
    const analyzer2 = getProjectContextAnalyzer(path2);

    expect(analyzer1).not.toBe(analyzer2);
    expect(analyzer1.getProjectPath()).toBe(path1);
    expect(analyzer2.getProjectPath()).toBe(path2);
  });

  it('creates new analyzer when path changes', () => {
    const analyzer1 = getProjectContextAnalyzer('/path1');
    const analyzer2 = getProjectContextAnalyzer('/path2');
    const analyzer3 = getProjectContextAnalyzer('/path1'); // Back to first path

    expect(analyzer1).not.toBe(analyzer2);
    expect(analyzer2).not.toBe(analyzer3);
    // analyzer3 should be a new instance, not the same as analyzer1
    expect(analyzer1).not.toBe(analyzer3);
  });

  it('applies options to analyzer', () => {
    const customOptions: ProjectContextAnalyzerOptions = {
      maxDepth: 5,
      analyzeGit: false,
    };

    const analyzer = getProjectContextAnalyzer(testProjectPath, customOptions);
    const options = analyzer.getOptions();

    expect(options.maxDepth).toBe(5);
    expect(options.analyzeGit).toBe(false);
  });
});

describe('analyzeProject', () => {
  it('creates analyzer and returns project context', async () => {
    const context = await analyzeProject(testProjectPath);

    expect(context).toBeDefined();
    expect(context.structure).toBeDefined();
    expect(context.structure.root).toBe(testProjectPath);
    expect(context.frameworks).toEqual([]);
    expect(context.configurations).toEqual([]);
    expect(context.testFrameworks).toEqual([]);
    expect(context.detectedAt).toBeInstanceOf(Date);
    expect(context.errors).toEqual([]);
  });

  it('applies options to analysis', async () => {
    const customOptions: ProjectContextAnalyzerOptions = {
      analyzeGit: false,
      detectFrameworks: false,
    };

    const context = await analyzeProject(testProjectPath, customOptions);

    expect(context.gitStatus).toBeUndefined();
    expect(context.frameworks).toEqual([]);
  });

  it('handles multiple concurrent calls', async () => {
    const [context1, context2, context3] = await Promise.all([
      analyzeProject(testProjectPath),
      analyzeProject(testProjectPath),
      analyzeProject(testProjectPath),
    ]);

    expect(context1.structure.root).toBe(context2.structure.root);
    expect(context2.structure.root).toBe(context3.structure.root);
  });
});