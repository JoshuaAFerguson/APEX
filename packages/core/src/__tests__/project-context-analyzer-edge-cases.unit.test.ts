/**
 * Edge Case Unit Tests for ProjectContextAnalyzer
 *
 * These tests focus on edge cases, boundary conditions, and error scenarios
 * that might not be covered in the main unit tests. They ensure robustness
 * and proper error handling in all situations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import {
  ProjectContextAnalyzer,
  type ProjectContextAnalyzerOptions,
} from '../project-context-analyzer.js';
import {
  GitStatusSchema,
  ProjectStructureSchema,
  FrameworkDetectionSchema,
} from '../types.js';
import { getPlatformShell } from '../shell-utils.js';

// Mock external dependencies
vi.mock('fs');
vi.mock('../shell-utils.js');

const mockFs = vi.mocked(fs, true);
const mockGetPlatformShell = vi.mocked(getPlatformShell);

// Mock exec
const mockExecAsync = vi.fn();
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

describe('ProjectContextAnalyzer Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetPlatformShell.mockReturnValue({
      shell: '/bin/sh',
      shellArgs: ['-c']
    });
  });

  describe('Path and Unicode Handling', () => {
    it('handles unicode characters in project path', async () => {
      const unicodePath = '/测试/проект/🚀/project';
      const analyzer = new ProjectContextAnalyzer(unicodePath);

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const context = await analyzer.analyze();

      expect(context.structure.root).toBe(unicodePath);
      expect(() => ProjectStructureSchema.parse(context.structure)).not.toThrow();
    });

    it('handles very long file paths', async () => {
      const longPath = '/very/long/path/that/exceeds/normal/limits/' + 'segment/'.repeat(50) + 'project';
      const analyzer = new ProjectContextAnalyzer(longPath);

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const context = await analyzer.analyze();

      expect(context.structure.root).toBe(longPath);
      expect(analyzer.getProjectPath()).toBe(longPath);
    });

    it('handles paths with special characters', async () => {
      const specialPath = "/path with spaces/quotes'and\"double/[brackets]/project";
      const analyzer = new ProjectContextAnalyzer(specialPath);

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const context = await analyzer.analyze();

      expect(context.structure.root).toBe(specialPath);
    });

    it('handles Windows-style paths', async () => {
      const windowsPath = 'C:\\Users\\Test\\Project\\With Spaces';
      const analyzer = new ProjectContextAnalyzer(windowsPath);

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const context = await analyzer.analyze();

      expect(context.structure.root).toBe(windowsPath);
    });
  });

  describe('Git Status Edge Cases', () => {
    it('handles extremely large number of changed files', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      // Create a large status output (1000 files)
      const largeStatus = Array.from({ length: 1000 }, (_, i) =>
        `M  file${i.toString().padStart(4, '0')}.ts`
      ).join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no upstream'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: largeStatus, stderr: '' })
        .mockRejectedValueOnce(new Error('no commits'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.staged).toHaveLength(1000);
      expect(gitStatus.isDirty).toBe(true);
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });

    it('handles git output with only whitespace', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: '   \n\t\n  \n', stderr: '' }) // only whitespace
        .mockRejectedValueOnce(new Error('no upstream'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '\n\n\n', stderr: '' }) // empty lines
        .mockRejectedValueOnce(new Error('no commits'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.branch).toBe(null); // Should handle whitespace as empty
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
      expect(gitStatus.untracked).toEqual([]);
    });

    it('handles git status with unusual status codes', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      const unusualStatus = [
        'T  type-changed.txt',     // Type changed
        'X  unknown-status.txt',   // Unknown status code
        '!! ignored.txt',          // Unusual status
        'MM both-modified.txt',    // Both index and worktree modified
      ].join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no upstream'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: unusualStatus, stderr: '' })
        .mockRejectedValueOnce(new Error('no commits'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const gitStatus = await analyzer.getGitStatus();

      // Should handle unknown status codes gracefully, defaulting to 'M'
      expect(gitStatus.staged.length).toBeGreaterThan(0);
      expect(gitStatus.unstaged.length).toBeGreaterThan(0);
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });

    it('handles commit message with special characters', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      const specialCommit = 'abc123|feat: добавить поддержку 测试 🚀 "quotes" and \'apostrophes\'|1640995200';

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no upstream'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: specialCommit + '\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.lastCommitMessage).toBe('feat: добавить поддержку 测试 🚀 "quotes" and \'apostrophes\'');
      expect(gitStatus.lastCommitHash).toBe('abc123');
    });

    it('handles very long branch names', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      const veryLongBranch = 'feature/very-long-branch-name-that-exceeds-normal-git-limits-' + 'x'.repeat(200);

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: veryLongBranch + '\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no upstream'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('no commits'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.branch).toBe(veryLongBranch);
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });

    it('handles negative ahead/behind values gracefully', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'origin/main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '-5\t-3\n', stderr: '' }) // Negative values
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('no commits'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const gitStatus = await analyzer.getGitStatus();

      // Should handle negative values as 0 or absolute value
      expect(gitStatus.ahead).toBeGreaterThanOrEqual(0);
      expect(gitStatus.behind).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(gitStatus.ahead)).toBe(true);
      expect(Number.isInteger(gitStatus.behind)).toBe(true);
    });
  });

  describe('Options Boundary Cases', () => {
    it('handles zero maxDepth', async () => {
      const analyzer = new ProjectContextAnalyzer('/test', { maxDepth: 0 });

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const structure = await analyzer.getProjectStructure();

      expect(analyzer.getOptions().maxDepth).toBe(0);
      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
    });

    it('handles extremely high maxDepth', async () => {
      const analyzer = new ProjectContextAnalyzer('/test', { maxDepth: 999999 });

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const structure = await analyzer.getProjectStructure();

      expect(analyzer.getOptions().maxDepth).toBe(999999);
      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
    });

    it('handles empty excludeDirectories array', async () => {
      const analyzer = new ProjectContextAnalyzer('/test', { excludeDirectories: [] });

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const structure = await analyzer.getProjectStructure();

      expect(analyzer.getOptions().excludeDirectories).toEqual([]);
      expect(structure.excludedDirectories).toEqual([]);
    });

    it('handles very large excludeDirectories array', async () => {
      const largeExcludeList = Array.from({ length: 1000 }, (_, i) => `exclude${i}`);
      const analyzer = new ProjectContextAnalyzer('/test', { excludeDirectories: largeExcludeList });

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const structure = await analyzer.getProjectStructure();

      expect(analyzer.getOptions().excludeDirectories).toEqual(largeExcludeList);
      expect(structure.excludedDirectories).toEqual(largeExcludeList);
    });

    it('handles all boolean options as false', async () => {
      const allFalseOptions: ProjectContextAnalyzerOptions = {
        analyzeGit: false,
        detectFrameworks: false,
        analyzeConfiguration: false,
        detectTests: false,
        includeHidden: false,
      };

      const analyzer = new ProjectContextAnalyzer('/test', allFalseOptions);

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const context = await analyzer.analyze();

      expect(context.gitStatus).toBeUndefined();
      expect(context.frameworks).toEqual([]);
      expect(context.configurations).toEqual([]);
      expect(context.testFrameworks).toEqual([]);
      expect(context.structure).toBeDefined(); // Always analyzed
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('handles very large package.json files', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      // Create a very large package.json with many dependencies
      const largeDeps = {};
      for (let i = 0; i < 10000; i++) {
        (largeDeps as any)[`package${i}`] = `^${i}.0.0`;
      }

      const largePackageJson = JSON.stringify({
        name: 'large-project',
        dependencies: largeDeps,
        devDependencies: largeDeps,
      });

      (mockFs.promises as any).access = vi.fn().mockResolvedValue(undefined);
      (mockFs.promises as any).readFile = vi.fn().mockResolvedValue(largePackageJson);
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);

      const frameworks = await analyzer.detectFrameworks();

      expect(frameworks).toBeDefined();
      expect(() => FrameworkDetectionSchema.parse(frameworks)).not.toThrow();
    });

    it('handles concurrent method calls on same instance', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).access = vi.fn().mockRejectedValue(new Error('not found'));
      (mockFs.promises as any).readFile = vi.fn().mockRejectedValue(new Error('not found'));
      (mockFs.promises as any).stat = vi.fn();

      // Call all methods concurrently
      const promises = [
        analyzer.getGitStatus(),
        analyzer.getProjectStructure(),
        analyzer.detectFrameworks(),
        analyzer.getConfigurationInfoList(),
        analyzer.getTestFrameworkInfoList(),
      ];

      const [gitStatus, structure, frameworks, configurations, testFrameworks] = await Promise.all(promises);

      expect(gitStatus).toBeDefined();
      expect(structure).toBeDefined();
      expect(frameworks).toBeDefined();
      expect(configurations).toBeDefined();
      expect(testFrameworks).toBeDefined();

      // All should be schema-valid
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
      expect(() => FrameworkDetectionSchema.parse(frameworks)).not.toThrow();
    });

    it('handles rapid successive calls', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      // Make many rapid calls
      const promises = Array.from({ length: 100 }, () => analyzer.getProjectStructure());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result.root).toBe('/test');
        expect(() => ProjectStructureSchema.parse(result)).not.toThrow();
      });
    });
  });

  describe('Platform-Specific Edge Cases', () => {
    it('handles different shell configurations', async () => {
      const shellConfigs = [
        { shell: 'cmd.exe', shellArgs: ['/c'] },
        { shell: 'powershell.exe', shellArgs: ['-Command'] },
        { shell: '/bin/bash', shellArgs: ['-c'] },
        { shell: '/bin/zsh', shellArgs: ['-c'] },
        { shell: '/bin/fish', shellArgs: ['-c'] },
      ];

      for (const shellConfig of shellConfigs) {
        vi.clearAllMocks();
        mockGetPlatformShell.mockReturnValue(shellConfig);

        const analyzer = new ProjectContextAnalyzer('/test');
        mockExecAsync.mockRejectedValue(new Error('not git'));

        const gitStatus = await analyzer.getGitStatus();

        expect(gitStatus.isRepository).toBe(false);
        expect(mockGetPlatformShell).toHaveBeenCalled();
      }
    });

    it('handles shell command failures gracefully', async () => {
      mockGetPlatformShell.mockReturnValue({
        shell: '/nonexistent/shell',
        shellArgs: ['--invalid']
      });

      const analyzer = new ProjectContextAnalyzer('/test');
      mockExecAsync.mockRejectedValue(new Error('Shell not found'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(false);
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });
  });

  describe('Data Consistency Edge Cases', () => {
    it('ensures timestamps are always in the past or present', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const beforeAnalysis = new Date();
      const structure = await analyzer.getProjectStructure();
      const afterAnalysis = new Date();

      expect(structure.scannedAt.getTime()).toBeGreaterThanOrEqual(beforeAnalysis.getTime());
      expect(structure.scannedAt.getTime()).toBeLessThanOrEqual(afterAnalysis.getTime());
    });

    it('ensures all arrays are immutable references', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const gitStatus = await analyzer.getGitStatus();

      // Try to modify arrays (should not affect the analyzer)
      const originalStagedLength = gitStatus.staged.length;
      gitStatus.staged.push({ path: 'test', status: 'M' });

      // Get a fresh copy
      const freshGitStatus = await analyzer.getGitStatus();
      expect(freshGitStatus.staged.length).toBe(originalStagedLength);
    });

    it('ensures numeric values are never NaN or Infinity', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'origin/main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'NaN\tInfinity\n', stderr: '' }) // Invalid numbers
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('no commits'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const gitStatus = await analyzer.getGitStatus();

      expect(Number.isFinite(gitStatus.ahead)).toBe(true);
      expect(Number.isFinite(gitStatus.behind)).toBe(true);
      expect(Number.isFinite(gitStatus.stashCount)).toBe(true);
      expect(!Number.isNaN(gitStatus.ahead)).toBe(true);
      expect(!Number.isNaN(gitStatus.behind)).toBe(true);
      expect(!Number.isNaN(gitStatus.stashCount)).toBe(true);
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('handles schema validation with minimal data', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).access = vi.fn().mockRejectedValue(new Error('not found'));
      (mockFs.promises as any).readFile = vi.fn().mockRejectedValue(new Error('not found'));
      (mockFs.promises as any).stat = vi.fn();

      const context = await analyzer.analyze();

      // Should validate even with minimal data
      expect(context.gitStatus?.isRepository).toBe(false);
      expect(context.structure.totalFiles).toBe(0);
      expect(context.structure.totalDirectories).toBe(0);
      expect(context.frameworks).toEqual([]);
      expect(context.configurations).toEqual([]);
      expect(context.testFrameworks).toEqual([]);
      expect(context.errors).toEqual([]);
    });

    it('handles schema validation with maximum realistic data', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      // Mock maximum realistic git status
      const maxStatus = Array.from({ length: 100 }, (_, i) => `M  file${i}.ts`).join('\n');
      const maxStashes = Array.from({ length: 50 }, (_, i) => `stash@{${i}}: WIP ${i}`).join('\n');
      const maxRemotes = Array.from({ length: 10 }, (_, i) =>
        `remote${i}\tgit@github.com:test/repo${i}.git\t(fetch)`
      ).join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'origin/main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '100\t50\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: maxStatus, stderr: '' })
        .mockResolvedValueOnce({ stdout: 'abc123|Max commit message|1640995200\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: maxStashes, stderr: '' })
        .mockResolvedValueOnce({ stdout: maxRemotes, stderr: '' });

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const context = await analyzer.analyze();

      expect(context.gitStatus?.staged).toHaveLength(100);
      expect(context.gitStatus?.stashCount).toBe(50);
      expect(context.gitStatus?.remotes).toHaveLength(10);
      expect(context.gitStatus?.ahead).toBe(100);
      expect(context.gitStatus?.behind).toBe(50);

      // Should still validate with large amounts of data
      expect(() => GitStatusSchema.parse(context.gitStatus!)).not.toThrow();
    });
  });
});

describe('Error Recovery Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformShell.mockReturnValue({
      shell: '/bin/sh',
      shellArgs: ['-c']
    });
  });

  it('recovers from filesystem permission errors', async () => {
    const analyzer = new ProjectContextAnalyzer('/root/restricted');

    mockExecAsync.mockRejectedValue(new Error('Permission denied'));
    (mockFs.promises as any).readdir = vi.fn().mockRejectedValue(new Error('EACCES: permission denied'));
    (mockFs.promises as any).stat = vi.fn().mockRejectedValue(new Error('EACCES: permission denied'));
    (mockFs.promises as any).access = vi.fn().mockRejectedValue(new Error('EACCES: permission denied'));
    (mockFs.promises as any).readFile = vi.fn().mockRejectedValue(new Error('EACCES: permission denied'));

    const context = await analyzer.analyze();

    expect(context).toBeDefined();
    expect(context.structure).toBeDefined();
    expect(context.gitStatus).toBeDefined();
    expect(context.errors).toEqual([]);
  });

  it('recovers from network timeouts during git operations', async () => {
    const analyzer = new ProjectContextAnalyzer('/test');

    mockExecAsync
      .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
      .mockRejectedValueOnce(new Error('Timeout: network unreachable')) // Remote branch timeout
      .mockRejectedValueOnce(new Error('Connection timed out')) // Ahead/behind timeout
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockRejectedValueOnce(new Error('Remote timeout'));

    const gitStatus = await analyzer.getGitStatus();

    expect(gitStatus.isRepository).toBe(true);
    expect(gitStatus.remoteBranch).toBe(null); // Should handle timeout gracefully
    expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
  });

  it('handles out of memory scenarios gracefully', async () => {
    const analyzer = new ProjectContextAnalyzer('/test');

    mockExecAsync.mockRejectedValue(new Error('JavaScript heap out of memory'));
    (mockFs.promises as any).readdir = vi.fn().mockRejectedValue(new Error('ENOMEM'));

    const context = await analyzer.analyze();

    expect(context).toBeDefined();
    expect(context.structure.totalFiles).toBe(0);
    expect(context.structure.totalDirectories).toBe(0);
  });
});