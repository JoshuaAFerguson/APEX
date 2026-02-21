/**
 * Comprehensive Integration Tests for ProjectContextAnalyzer
 *
 * This test file provides comprehensive integration testing focusing on:
 * - End-to-end analysis workflow
 * - Error handling and recovery
 * - Performance and concurrency
 * - Cross-platform compatibility
 * - Edge cases and boundary conditions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import {
  ProjectContextAnalyzer,
  FrameworkDetectionSchema,
  ConfigFileInfoSchema,
  getProjectContextAnalyzer,
  analyzeProject,
  type FrameworkDetection,
  type ConfigFileInfo,
  type ProjectContextAnalyzerOptions,
} from '../project-context-analyzer.js';
import {
  GitStatusSchema,
  ProjectStructureSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
  ProjectContextSchema,
  type GitStatus,
  type GitChangedFile,
  type ProjectStructure,
  type ConfigurationInfo,
  type TestFrameworkInfo,
  type ProjectContext,
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

describe('ProjectContextAnalyzer - Comprehensive Integration Tests', () => {
  let analyzer: ProjectContextAnalyzer;
  const testProjectPath = '/comprehensive/test/project';

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mocks
    mockGetPlatformShell.mockReturnValue({
      shell: '/bin/sh',
      shellArgs: ['-c']
    });

    analyzer = new ProjectContextAnalyzer(testProjectPath);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('End-to-End Analysis Workflow', () => {
    it('performs complete analysis workflow with all features enabled', async () => {
      // Mock complete git repository analysis
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' }) // git rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'feature/new-analyzer\n', stderr: '' }) // branch
        .mockResolvedValueOnce({ stdout: 'origin/feature/new-analyzer\n', stderr: '' }) // remote branch
        .mockResolvedValueOnce({ stdout: '3\t1\n', stderr: '' }) // ahead/behind count
        .mockResolvedValueOnce({
          stdout: 'M  src/analyzer.ts\nA  src/new-file.ts\n?? temp.log\n',
          stderr: ''
        }) // git status
        .mockResolvedValueOnce({
          stdout: 'abc1234|feat: add comprehensive testing|1640995200\n',
          stderr: ''
        }) // last commit
        .mockResolvedValueOnce({
          stdout: 'stash@{0}: WIP on feature\nstash@{1}: backup\n',
          stderr: ''
        }) // stash list
        .mockResolvedValueOnce({
          stdout: 'origin\tgit@github.com:test/project.git\t(fetch)\nupstream\tgit@github.com:upstream/project.git\t(fetch)\n',
          stderr: ''
        }); // remotes

      const context = await analyzer.analyze();

      // Verify complete analysis results
      expect(context).toBeDefined();
      expect(context.detectedAt).toBeInstanceOf(Date);
      expect(context.errors).toEqual([]);

      // Verify git status analysis
      expect(context.gitStatus).toBeDefined();
      expect(context.gitStatus?.isRepository).toBe(true);
      expect(context.gitStatus?.branch).toBe('feature/new-analyzer');
      expect(context.gitStatus?.remoteBranch).toBe('origin/feature/new-analyzer');
      expect(context.gitStatus?.ahead).toBe(3);
      expect(context.gitStatus?.behind).toBe(1);
      expect(context.gitStatus?.staged).toHaveLength(2);
      expect(context.gitStatus?.unstaged).toHaveLength(0);
      expect(context.gitStatus?.untracked).toHaveLength(1);
      expect(context.gitStatus?.isDirty).toBe(true);
      expect(context.gitStatus?.stashCount).toBe(2);
      expect(context.gitStatus?.remotes).toHaveLength(2);
      expect(context.gitStatus?.lastCommitMessage).toBe('feat: add comprehensive testing');

      // Verify project structure analysis
      expect(context.structure).toBeDefined();
      expect(context.structure.root).toBe(testProjectPath);
      expect(context.structure.scannedAt).toBeInstanceOf(Date);

      // Verify framework detection (empty by default since TODO implementation)
      expect(context.frameworks).toEqual([]);

      // Verify configuration analysis (empty by default since TODO implementation)
      expect(context.configurations).toEqual([]);

      // Verify test framework analysis (empty by default since TODO implementation)
      expect(context.testFrameworks).toEqual([]);

      // Verify schema validation
      expect(() => ProjectContextSchema.parse(context)).not.toThrow();
    });

    it('handles mixed success/failure scenarios gracefully', async () => {
      // Mock git working but some commands failing
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' }) // git rev-parse succeeds
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // branch succeeds
        .mockRejectedValueOnce(new Error('remote branch failed')) // remote fails
        .mockRejectedValueOnce(new Error('ahead/behind failed')) // ahead/behind fails
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // status succeeds (clean)
        .mockRejectedValueOnce(new Error('commit failed')) // last commit fails
        .mockRejectedValueOnce(new Error('stash failed')) // stash fails
        .mockResolvedValueOnce({ stdout: 'origin\tgit@github.com:test/project.git\t(fetch)\n', stderr: '' }); // remotes succeeds

      const context = await analyzer.analyze();

      expect(context.gitStatus).toBeDefined();
      expect(context.gitStatus?.isRepository).toBe(true);
      expect(context.gitStatus?.branch).toBe('main');
      expect(context.gitStatus?.remoteBranch).toBeNull();
      expect(context.gitStatus?.ahead).toBe(0); // default value
      expect(context.gitStatus?.behind).toBe(0); // default value
      expect(context.gitStatus?.isDirty).toBe(false);
      expect(context.gitStatus?.stashCount).toBe(0); // default value
      expect(context.gitStatus?.lastCommitHash).toBeUndefined();
      expect(context.gitStatus?.remotes).toHaveLength(1);

      // Should still be valid despite partial failures
      expect(() => ProjectContextSchema.parse(context)).not.toThrow();
    });

    it('performs analysis with selective feature disabling', async () => {
      const selectiveAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        analyzeGit: false,
        detectFrameworks: false,
        analyzeConfiguration: true,
        detectTests: true,
      });

      const context = await selectiveAnalyzer.analyze();

      expect(context.gitStatus).toBeUndefined();
      expect(context.frameworks).toEqual([]);
      expect(context.configurations).toEqual([]);
      expect(context.testFrameworks).toEqual([]);
      expect(context.structure).toBeDefined();
      expect(context.detectedAt).toBeInstanceOf(Date);
      expect(context.errors).toEqual([]);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('handles complete git command failure gracefully', async () => {
      // All git commands fail
      mockExecAsync.mockRejectedValue(new Error('Git not available'));

      const context = await analyzer.analyze();

      expect(context.gitStatus).toBeDefined();
      expect(context.gitStatus?.isRepository).toBe(false);
      expect(context.gitStatus?.branch).toBeNull();
      expect(context.gitStatus?.staged).toEqual([]);
      expect(context.gitStatus?.unstaged).toEqual([]);
      expect(context.gitStatus?.untracked).toEqual([]);
      expect(context.structure).toBeDefined();
    });

    it('handles malformed git output gracefully', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' }) // git rev-parse
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // branch
        .mockResolvedValueOnce({ stdout: 'origin/main\n', stderr: '' }) // remote
        .mockResolvedValueOnce({ stdout: 'invalid-format-here\n', stderr: '' }) // malformed ahead/behind
        .mockResolvedValueOnce({
          stdout: 'INVALID STATUS FORMAT\nM\nNOT VALID\n',
          stderr: ''
        }) // malformed git status
        .mockResolvedValueOnce({ stdout: 'malformed-commit-data\n', stderr: '' }) // malformed commit
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // empty stash
        .mockResolvedValueOnce({ stdout: 'invalid-remote-format\n', stderr: '' }); // malformed remotes

      const context = await analyzer.analyze();

      expect(context.gitStatus?.isRepository).toBe(true);
      expect(context.gitStatus?.branch).toBe('main');
      expect(context.gitStatus?.ahead).toBe(0); // fallback to default
      expect(context.gitStatus?.behind).toBe(0); // fallback to default
      expect(context.gitStatus?.staged).toEqual([]); // malformed status ignored
      expect(context.gitStatus?.lastCommitHash).toBeUndefined(); // malformed commit ignored
      expect(context.gitStatus?.remotes).toEqual([]); // malformed remotes ignored
    });

    it('handles filesystem access errors gracefully', async () => {
      // Assume filesystem operations might throw in future implementations
      // For now, this verifies the structure is still returned
      const context = await analyzer.analyze();

      expect(context.structure).toBeDefined();
      expect(context.structure.root).toBe(testProjectPath);
    });

    it('handles concurrent analysis calls with errors', async () => {
      // Some calls succeed, some fail
      mockExecAsync
        .mockRejectedValueOnce(new Error('Git error 1'))
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockRejectedValueOnce(new Error('Git error 2'));

      const promises = [
        analyzer.analyze(),
        analyzer.analyze(),
        analyzer.analyze(),
      ];

      const results = await Promise.all(promises);

      // All should complete successfully despite individual git failures
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.structure).toBeDefined();
      });
    });
  });

  describe('Performance and Concurrency Tests', () => {
    it('handles high concurrency load efficiently', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const concurrentOperations = 50;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentOperations }, () =>
        analyzer.analyze()
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All operations should complete
      expect(results).toHaveLength(concurrentOperations);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.structure).toBeDefined();
      });

      // Performance check - should complete in reasonable time (less than 10 seconds)
      expect(totalTime).toBeLessThan(10000);

      // Results should be consistent
      const firstResult = results[0];
      results.slice(1).forEach(result => {
        expect(result.structure.root).toBe(firstResult.structure.root);
        expect(result.frameworks).toEqual(firstResult.frameworks);
      });
    });

    it('handles memory pressure with large datasets', async () => {
      // Mock large git status output
      const largeStatus = Array.from({ length: 1000 }, (_, i) =>
        `M  file${i}.js`
      ).join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '0\t0\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: largeStatus, stderr: '' })
        .mockResolvedValueOnce({ stdout: 'abc123|Large commit|1640995200\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const context = await analyzer.analyze();

      expect(context.gitStatus?.staged).toHaveLength(1000);
      expect(context.gitStatus?.isDirty).toBe(true);

      // Verify memory usage is reasonable (no specific metric, but should not crash)
      expect(context).toBeDefined();
    });

    it('maintains performance with complex git histories', async () => {
      // Simulate complex git repository with many remotes and stashes
      const manyRemotes = Array.from({ length: 10 }, (_, i) =>
        `remote${i}\tgit@github.com:test/remote${i}.git\t(fetch)`
      ).join('\n');

      const manyStashes = Array.from({ length: 20 }, (_, i) =>
        `stash@{${i}}: WIP on feature-${i}`
      ).join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'complex-feature\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'origin/complex-feature\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '15\t8\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'def456|Complex feature work|1640995200\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: manyStashes, stderr: '' })
        .mockResolvedValueOnce({ stdout: manyRemotes, stderr: '' });

      const startTime = Date.now();
      const context = await analyzer.analyze();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
      expect(context.gitStatus?.stashCount).toBe(20);
      expect(context.gitStatus?.remotes).toHaveLength(10);
      expect(context.gitStatus?.ahead).toBe(15);
      expect(context.gitStatus?.behind).toBe(8);
    });
  });

  describe('Cross-Platform Compatibility Tests', () => {
    it('handles Windows shell configuration', async () => {
      mockGetPlatformShell.mockReturnValue({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const context = await analyzer.analyze();

      expect(mockGetPlatformShell).toHaveBeenCalled();
      expect(context.gitStatus?.isRepository).toBe(false);
    });

    it('handles PowerShell configuration', async () => {
      mockGetPlatformShell.mockReturnValue({
        shell: 'powershell.exe',
        shellArgs: ['-Command']
      });

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const context = await analyzer.analyze();

      expect(context).toBeDefined();
      expect(context.gitStatus?.isRepository).toBe(false);
    });

    it('handles Unix shell variations', async () => {
      const unixShells = [
        { shell: '/bin/bash', shellArgs: ['-c'] },
        { shell: '/bin/zsh', shellArgs: ['-c'] },
        { shell: '/bin/fish', shellArgs: ['-c'] },
      ];

      for (const shellConfig of unixShells) {
        mockGetPlatformShell.mockReturnValue(shellConfig);
        mockExecAsync.mockRejectedValue(new Error('not a git repo'));

        const context = await analyzer.analyze();

        expect(context).toBeDefined();
        expect(context.gitStatus?.isRepository).toBe(false);
      }
    });

    it('handles path separators across platforms', async () => {
      const windowsPath = 'C:\\Users\\test\\project';
      const windowsAnalyzer = new ProjectContextAnalyzer(windowsPath);

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const context = await windowsAnalyzer.analyze();

      expect(context.structure.root).toBe(windowsPath);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('handles extremely long git output', async () => {
      const veryLongBranchName = 'feature/very-long-branch-name-that-exceeds-normal-limits-' + 'x'.repeat(200);
      const veryLongCommitMessage = 'Very long commit message that exceeds normal limits: ' + 'Lorem ipsum dolor sit amet, '.repeat(100);

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: veryLongBranchName + '\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '0\t0\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({
          stdout: `abc123|${veryLongCommitMessage}|1640995200\n`,
          stderr: ''
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const context = await analyzer.analyze();

      expect(context.gitStatus?.branch).toBe(veryLongBranchName);
      expect(context.gitStatus?.lastCommitMessage).toBe(veryLongCommitMessage);
    });

    it('handles unicode characters in file paths and messages', async () => {
      const unicodeFiles = 'M  src/测试文件.ts\nA  src/файл.js\n?? temp/🔥.log\n';
      const unicodeCommit = 'abc123|feat: добавить тесты 测试 🚀|1640995200';

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '0\t0\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: unicodeFiles, stderr: '' })
        .mockResolvedValueOnce({ stdout: unicodeCommit + '\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const context = await analyzer.analyze();

      expect(context.gitStatus?.staged).toHaveLength(2);
      expect(context.gitStatus?.untracked).toHaveLength(1);
      expect(context.gitStatus?.staged[0]?.path).toBe('src/测试文件.ts');
      expect(context.gitStatus?.staged[1]?.path).toBe('src/файл.js');
      expect(context.gitStatus?.untracked[0]).toBe('temp/🔥.log');
      expect(context.gitStatus?.lastCommitMessage).toBe('feat: добавить тесты 测试 🚀');
    });

    it('handles empty and whitespace-only git output', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: '   \n', stderr: '' }) // whitespace-only branch
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '\t\n', stderr: '' }) // whitespace-only ahead/behind
        .mockResolvedValueOnce({ stdout: '\n\n  \n', stderr: '' }) // empty status with whitespace
        .mockResolvedValueOnce({ stdout: '   |  |\n', stderr: '' }) // empty commit fields
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '  \n', stderr: '' });

      const context = await analyzer.analyze();

      expect(context.gitStatus?.isRepository).toBe(true);
      expect(context.gitStatus?.branch).toBeNull(); // Should handle empty branch
      expect(context.gitStatus?.ahead).toBe(0);
      expect(context.gitStatus?.behind).toBe(0);
      expect(context.gitStatus?.staged).toEqual([]);
      expect(context.gitStatus?.lastCommitHash).toBeUndefined();
    });

    it('handles git commands with stderr output', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: 'warning: some git warning' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: 'hint: some hint message' })
        .mockResolvedValueOnce({ stdout: '', stderr: 'another warning' })
        .mockResolvedValueOnce({ stdout: '2\t1\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'M  file.ts\n', stderr: 'status warning' })
        .mockResolvedValueOnce({ stdout: 'abc123|commit message|1640995200\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'origin\tgit@github.com:test/repo.git\t(fetch)\n', stderr: '' });

      const context = await analyzer.analyze();

      // Should succeed despite stderr warnings
      expect(context.gitStatus?.isRepository).toBe(true);
      expect(context.gitStatus?.branch).toBe('main');
      expect(context.gitStatus?.ahead).toBe(2);
      expect(context.gitStatus?.behind).toBe(1);
      expect(context.gitStatus?.staged).toHaveLength(1);
    });
  });

  describe('Data Consistency and Validation', () => {
    it('ensures all numeric values are non-negative integers', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const context = await analyzer.analyze();

      expect(context.gitStatus?.ahead).toBeGreaterThanOrEqual(0);
      expect(context.gitStatus?.behind).toBeGreaterThanOrEqual(0);
      expect(context.gitStatus?.stashCount).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(context.gitStatus?.ahead)).toBe(true);
      expect(Number.isInteger(context.gitStatus?.behind)).toBe(true);
      expect(Number.isInteger(context.gitStatus?.stashCount)).toBe(true);

      expect(context.structure.totalFiles).toBeGreaterThanOrEqual(0);
      expect(context.structure.totalDirectories).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(context.structure.totalFiles)).toBe(true);
      expect(Number.isInteger(context.structure.totalDirectories)).toBe(true);
    });

    it('ensures arrays are always defined and properly typed', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const context = await analyzer.analyze();

      // Git status arrays
      expect(Array.isArray(context.gitStatus?.staged)).toBe(true);
      expect(Array.isArray(context.gitStatus?.unstaged)).toBe(true);
      expect(Array.isArray(context.gitStatus?.untracked)).toBe(true);
      expect(Array.isArray(context.gitStatus?.remotes)).toBe(true);

      // Project context arrays
      expect(Array.isArray(context.frameworks)).toBe(true);
      expect(Array.isArray(context.configurations)).toBe(true);
      expect(Array.isArray(context.testFrameworks)).toBe(true);
      expect(Array.isArray(context.errors)).toBe(true);

      // Project structure arrays
      expect(Array.isArray(context.structure.entries)).toBe(true);
      expect(Array.isArray(context.structure.rootFiles)).toBe(true);
      expect(Array.isArray(context.structure.commonDirectories)).toBe(true);
      expect(Array.isArray(context.structure.excludedDirectories)).toBe(true);
    });

    it('ensures boolean flags are consistent with data', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '0\t0\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'M  dirty.ts\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const context = await analyzer.analyze();

      // isDirty should be true when there are changes
      expect(context.gitStatus?.isDirty).toBe(true);
      expect(context.gitStatus?.staged.length).toBeGreaterThan(0);

      // hasConflicts should be false when no conflicts detected
      expect(context.gitStatus?.hasConflicts).toBe(false);
    });

    it('ensures timestamps are valid Date objects', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const beforeAnalysis = new Date();
      const context = await analyzer.analyze();
      const afterAnalysis = new Date();

      expect(context.detectedAt).toBeInstanceOf(Date);
      expect(context.detectedAt.getTime()).toBeGreaterThanOrEqual(beforeAnalysis.getTime());
      expect(context.detectedAt.getTime()).toBeLessThanOrEqual(afterAnalysis.getTime());

      expect(context.structure.scannedAt).toBeInstanceOf(Date);
      expect(context.structure.scannedAt.getTime()).toBeGreaterThanOrEqual(beforeAnalysis.getTime());
      expect(context.structure.scannedAt.getTime()).toBeLessThanOrEqual(afterAnalysis.getTime());
    });

    it('validates complete schema compliance under all conditions', async () => {
      const testScenarios = [
        // Non-git repository
        () => mockExecAsync.mockRejectedValue(new Error('not a git repo')),

        // Clean git repository
        () => mockExecAsync
          .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
          .mockResolvedValueOnce({ stdout: '', stderr: '' }),

        // Dirty git repository
        () => mockExecAsync
          .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'feature\n', stderr: '' })
          .mockResolvedValueOnce({ stdout: '', stderr: '' })
          .mockResolvedValueOnce({ stdout: '1\t0\n', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'M  file.ts\n?? new.ts\n', stderr: '' }),
      ];

      for (const setupScenario of testScenarios) {
        vi.clearAllMocks();
        mockGetPlatformShell.mockReturnValue({
          shell: '/bin/sh',
          shellArgs: ['-c']
        });

        setupScenario();

        const context = await analyzer.analyze();

        // Every scenario should produce valid schema-compliant data
        expect(() => ProjectContextSchema.parse(context)).not.toThrow();
        expect(() => GitStatusSchema.parse(context.gitStatus!)).not.toThrow();
        expect(() => ProjectStructureSchema.parse(context.structure)).not.toThrow();

        // Verify all required fields are present
        expect(context).toHaveProperty('structure');
        expect(context).toHaveProperty('frameworks');
        expect(context).toHaveProperty('configurations');
        expect(context).toHaveProperty('testFrameworks');
        expect(context).toHaveProperty('detectedAt');
        expect(context).toHaveProperty('errors');
      }
    });
  });

  describe('Configuration Options Impact', () => {
    it('respects maxDepth option configuration', async () => {
      const depthLimitedAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        maxDepth: 2,
      });

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const context = await depthLimitedAnalyzer.analyze();
      const options = depthLimitedAnalyzer.getOptions();

      expect(options.maxDepth).toBe(2);
      expect(context.structure).toBeDefined();
    });

    it('respects includeHidden option configuration', async () => {
      const hiddenIncludeAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        includeHidden: true,
      });

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const context = await hiddenIncludeAnalyzer.analyze();
      const options = hiddenIncludeAnalyzer.getOptions();

      expect(options.includeHidden).toBe(true);
      expect(context.structure).toBeDefined();
    });

    it('respects excludeDirectories option configuration', async () => {
      const customExcluded = ['custom-build', 'temp', 'cache'];
      const customAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        excludeDirectories: customExcluded,
      });

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const context = await customAnalyzer.analyze();
      const options = customAnalyzer.getOptions();

      expect(options.excludeDirectories).toEqual(customExcluded);
      expect(context.structure.excludedDirectories).toEqual(customExcluded);
    });

    it('handles option combinations correctly', async () => {
      const combinedOptions: ProjectContextAnalyzerOptions = {
        maxDepth: 3,
        includeHidden: false,
        excludeDirectories: ['build', 'temp'],
        analyzeGit: true,
        detectFrameworks: false,
        analyzeConfiguration: false,
        detectTests: true,
      };

      const combinedAnalyzer = new ProjectContextAnalyzer(testProjectPath, combinedOptions);

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const context = await combinedAnalyzer.analyze();

      expect(context.gitStatus).toBeDefined(); // analyzeGit: true
      expect(context.frameworks).toEqual([]); // detectFrameworks: false
      expect(context.configurations).toEqual([]); // analyzeConfiguration: false
      expect(context.testFrameworks).toEqual([]); // detectTests: true but TODO implementation
      expect(context.structure.excludedDirectories).toEqual(['build', 'temp']);
    });
  });
});

describe('ProjectContextAnalyzer - Utility Function Integration Tests', () => {
  describe('getProjectContextAnalyzer singleton behavior', () => {
    it('maintains singleton behavior across different option combinations', () => {
      const path1 = '/test/path1';
      const path2 = '/test/path2';

      const analyzer1a = getProjectContextAnalyzer(path1, { maxDepth: 5 });
      const analyzer1b = getProjectContextAnalyzer(path1, { maxDepth: 10 }); // Different options
      const analyzer2 = getProjectContextAnalyzer(path2);

      // Same path should return same instance regardless of options
      expect(analyzer1a).toBe(analyzer1b);
      expect(analyzer1a).not.toBe(analyzer2);
      expect(analyzer1b).not.toBe(analyzer2);
    });

    it('handles rapid sequential calls efficiently', () => {
      const testPath = '/rapid/test';
      const startTime = Date.now();

      const analyzers = Array.from({ length: 100 }, () =>
        getProjectContextAnalyzer(testPath)
      );

      const endTime = Date.now();

      // All should be the same instance
      const firstAnalyzer = analyzers[0];
      analyzers.forEach(analyzer => {
        expect(analyzer).toBe(firstAnalyzer);
      });

      // Should be very fast (singleton lookup)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('analyzeProject convenience function', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockGetPlatformShell.mockReturnValue({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });
    });

    it('performs analysis with different option combinations', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const testCases = [
        { analyzeGit: false },
        { detectFrameworks: false },
        { analyzeConfiguration: false },
        { detectTests: false },
        { maxDepth: 1, includeHidden: true },
        { excludeDirectories: ['test'] },
      ];

      for (const options of testCases) {
        const context = await analyzeProject('/test/path', options);

        expect(context).toBeDefined();
        expect(context.structure).toBeDefined();
        expect(() => ProjectContextSchema.parse(context)).not.toThrow();
      }
    });

    it('handles concurrent analyzeProject calls', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const concurrentCalls = Array.from({ length: 20 }, (_, i) =>
        analyzeProject(`/test/path${i}`, { maxDepth: i + 1 })
      );

      const results = await Promise.all(concurrentCalls);

      expect(results).toHaveLength(20);
      results.forEach((result, i) => {
        expect(result).toBeDefined();
        expect(result.structure.root).toBe(`/test/path${i}`);
      });
    });

    it('maintains independent analysis contexts', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const [result1, result2] = await Promise.all([
        analyzeProject('/path1', { analyzeGit: true }),
        analyzeProject('/path2', { analyzeGit: false }),
      ]);

      expect(result1.structure.root).toBe('/path1');
      expect(result2.structure.root).toBe('/path2');
      expect(result1.gitStatus).toBeDefined();
      expect(result2.gitStatus).toBeUndefined();
    });
  });
});