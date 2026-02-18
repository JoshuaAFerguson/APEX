import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';
import type { GitStatus, GitChangedFile } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock git command outputs for comprehensive testing
const mockGitOutputs = {
  // Standard git status output
  cleanRepo: {
    'git rev-parse --git-dir': '.git\n',
    'git rev-parse --abbrev-ref HEAD': 'main\n',
    'git rev-parse --abbrev-ref "main@{upstream}"': 'origin/main\n',
    'git rev-list --count --left-right HEAD...origin/main': '0\t0\n',
    'git status --porcelain=v1': '',
    'git log -1 --format="%H|%s|%ct"': 'abc1234567890123456789012345678901234567890|Initial commit|1640000000\n',
    'git stash list': '',
    'git remote -v': 'origin\tgit@github.com:user/repo.git (fetch)\norigin\tgit@github.com:user/repo.git (push)\n'
  },

  dirtyRepo: {
    'git rev-parse --git-dir': '.git\n',
    'git rev-parse --abbrev-ref HEAD': 'feature/test\n',
    'git status --porcelain=v1': ' M modified-file.ts\nA  staged-file.ts\nD  deleted-file.ts\n?? untracked-file.ts\nUU conflict-file.ts\n',
    'git log -1 --format="%H|%s|%ct"': 'def4567890123456789012345678901234567890ab|Add new feature|1640100000\n',
    'git stash list': 'stash@{0}: WIP on main: abc1234 Initial commit\nstash@{1}: WIP on main: abc1234 Another stash\n'
  },

  aheadBehind: {
    'git rev-parse --git-dir': '.git\n',
    'git rev-parse --abbrev-ref HEAD': 'feature/ahead\n',
    'git rev-parse --abbrev-ref "feature/ahead@{upstream}"': 'origin/feature/ahead\n',
    'git rev-list --count --left-right HEAD...origin/feature/ahead': '3\t2\n'
  },

  detachedHead: {
    'git rev-parse --git-dir': '.git\n',
    'git rev-parse --abbrev-ref HEAD': 'HEAD\n'
  },

  noRemote: {
    'git rev-parse --git-dir': '.git\n',
    'git rev-parse --abbrev-ref HEAD': 'main\n',
    'git remote -v': ''
  },

  multipleRemotes: {
    'git remote -v': 'origin\tgit@github.com:user/repo.git (fetch)\norigin\tgit@github.com:user/repo.git (push)\nupstream\tgit@github.com:upstream/repo.git (fetch)\nupstream\tgit@github.com:upstream/repo.git (push)\n'
  }
};

describe('ProjectContextAnalyzer - Comprehensive Git Tests', () => {
  let analyzer: ProjectContextAnalyzer;
  let originalExecAsync: typeof execAsync;

  beforeEach(() => {
    analyzer = new ProjectContextAnalyzer('/test/repo');
    originalExecAsync = execAsync;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockExecAsync = (outputs: Record<string, string>) => {
    vi.mocked(execAsync).mockImplementation(async (command: string) => {
      const output = outputs[command.trim()];
      if (output !== undefined) {
        return { stdout: output, stderr: '' };
      }
      throw new Error(`Command failed: ${command}`);
    });
  };

  describe('Git Status Parsing - Comprehensive Coverage', () => {
    beforeEach(() => {
      vi.mocked(execAsync) = vi.fn();
    });

    it('should parse clean repository correctly', async () => {
      mockExecAsync(mockGitOutputs.cleanRepo);

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('main');
      expect(gitStatus.remoteBranch).toBe('origin/main');
      expect(gitStatus.ahead).toBe(0);
      expect(gitStatus.behind).toBe(0);
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
      expect(gitStatus.untracked).toEqual([]);
      expect(gitStatus.hasConflicts).toBe(false);
      expect(gitStatus.isDirty).toBe(false);
      expect(gitStatus.lastCommitHash).toBe('abc1234');
      expect(gitStatus.lastCommitMessage).toBe('Initial commit');
      expect(gitStatus.lastCommitTimestamp).toEqual(new Date(1640000000 * 1000));
      expect(gitStatus.stashCount).toBe(0);
      expect(gitStatus.remotes).toEqual([
        { name: 'origin', url: 'git@github.com:user/repo.git' }
      ]);
    });

    it('should parse dirty repository with all file status types', async () => {
      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        ...mockGitOutputs.dirtyRepo
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('feature/test');
      expect(gitStatus.staged).toEqual([
        { path: 'staged-file.ts', status: 'A' },
        { path: 'deleted-file.ts', status: 'D' }
      ]);
      expect(gitStatus.unstaged).toEqual([
        { path: 'modified-file.ts', status: 'M' },
        { path: 'conflict-file.ts', status: 'U' }
      ]);
      expect(gitStatus.untracked).toEqual(['untracked-file.ts']);
      expect(gitStatus.hasConflicts).toBe(true);
      expect(gitStatus.isDirty).toBe(true);
      expect(gitStatus.stashCount).toBe(2);
    });

    it('should handle ahead/behind tracking correctly', async () => {
      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        ...mockGitOutputs.aheadBehind
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('feature/ahead');
      expect(gitStatus.remoteBranch).toBe('origin/feature/ahead');
      expect(gitStatus.ahead).toBe(3);
      expect(gitStatus.behind).toBe(2);
    });

    it('should handle detached HEAD state', async () => {
      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        ...mockGitOutputs.detachedHead
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe(null); // HEAD means detached state
    });

    it('should handle repository with no remotes', async () => {
      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        ...mockGitOutputs.noRemote
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.remotes).toEqual([]);
    });

    it('should handle multiple remotes correctly', async () => {
      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        ...mockGitOutputs.multipleRemotes
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.remotes).toEqual([
        { name: 'origin', url: 'git@github.com:user/repo.git' },
        { name: 'upstream', url: 'git@github.com:upstream/repo.git' }
      ]);
    });
  });

  describe('Git Status - Advanced File Status Parsing', () => {
    beforeEach(() => {
      vi.mocked(execAsync) = vi.fn();
    });

    it('should parse all git file status codes correctly', async () => {
      const allStatusCodes = {
        ...mockGitOutputs.cleanRepo,
        'git status --porcelain=v1':
          'M  modified-staged.ts\n' +      // Modified and staged
          ' M modified-unstaged.ts\n' +    // Modified but unstaged
          'MM modified-both.ts\n' +        // Modified in both index and working tree
          'A  added-staged.ts\n' +         // Added and staged
          'D  deleted-staged.ts\n' +       // Deleted and staged
          ' D deleted-unstaged.ts\n' +     // Deleted but unstaged
          'R  renamed-file.ts\n' +         // Renamed
          'C  copied-file.ts\n' +          // Copied
          'UU unmerged-conflict.ts\n' +    // Unmerged (conflict)
          'AU added-by-us.ts\n' +          // Added by us (conflict)
          'UA added-by-them.ts\n' +        // Added by them (conflict)
          '?? untracked-file.ts\n'         // Untracked
      };

      mockExecAsync(allStatusCodes);

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);

      // Check staged files
      const stagedPaths = gitStatus.staged.map(f => f.path);
      expect(stagedPaths).toContain('modified-staged.ts');
      expect(stagedPaths).toContain('modified-both.ts');
      expect(stagedPaths).toContain('added-staged.ts');
      expect(stagedPaths).toContain('deleted-staged.ts');
      expect(stagedPaths).toContain('renamed-file.ts');
      expect(stagedPaths).toContain('copied-file.ts');

      // Check unstaged files
      const unstagedPaths = gitStatus.unstaged.map(f => f.path);
      expect(unstagedPaths).toContain('modified-unstaged.ts');
      expect(unstagedPaths).toContain('modified-both.ts');
      expect(unstagedPaths).toContain('deleted-unstaged.ts');

      // Check conflict detection
      expect(gitStatus.hasConflicts).toBe(true);

      // Check untracked files
      expect(gitStatus.untracked).toContain('untracked-file.ts');

      // Verify status codes are mapped correctly
      const modifiedStaged = gitStatus.staged.find(f => f.path === 'modified-staged.ts');
      expect(modifiedStaged?.status).toBe('M');

      const addedStaged = gitStatus.staged.find(f => f.path === 'added-staged.ts');
      expect(addedStaged?.status).toBe('A');

      const renamedFile = gitStatus.staged.find(f => f.path === 'renamed-file.ts');
      expect(renamedFile?.status).toBe('R');

      const copiedFile = gitStatus.staged.find(f => f.path === 'copied-file.ts');
      expect(copiedFile?.status).toBe('C');
    });

    it('should handle empty git status output', async () => {
      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        'git status --porcelain=v1': ''
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
      expect(gitStatus.untracked).toEqual([]);
      expect(gitStatus.hasConflicts).toBe(false);
      expect(gitStatus.isDirty).toBe(false);
    });

    it('should handle malformed git status lines gracefully', async () => {
      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        'git status --porcelain=v1':
          'M  normal-file.ts\n' +
          'invalid-line\n' +          // Invalid format
          ' \n' +                     // Empty status
          '?? another-file.ts\n'
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.staged.length).toBe(1);
      expect(gitStatus.staged[0].path).toBe('normal-file.ts');
      expect(gitStatus.untracked).toEqual(['another-file.ts']);
    });
  });

  describe('Git Status - Error Handling and Edge Cases', () => {
    beforeEach(() => {
      vi.mocked(execAsync) = vi.fn();
    });

    it('should handle git command failures gracefully', async () => {
      // Mock git commands to fail
      vi.mocked(execAsync).mockRejectedValue(new Error('Git command failed'));

      const gitStatus = await analyzer.getGitStatus();

      // Should return default non-git status
      expect(gitStatus.isRepository).toBe(false);
      expect(gitStatus.branch).toBe(null);
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
      expect(gitStatus.untracked).toEqual([]);
    });

    it('should handle partial git command failures', async () => {
      // Only the initial git-dir check succeeds
      vi.mocked(execAsync).mockImplementation(async (command: string) => {
        if (command.includes('git rev-parse --git-dir')) {
          return { stdout: '.git\n', stderr: '' };
        }
        throw new Error('Command failed');
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      // Other fields should have default values
      expect(gitStatus.branch).toBe(null);
      expect(gitStatus.ahead).toBe(0);
      expect(gitStatus.behind).toBe(0);
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.hasConflicts).toBe(false);
      expect(gitStatus.isDirty).toBe(false);
    });

    it('should handle invalid commit timestamp', async () => {
      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        'git log -1 --format="%H|%s|%ct"': 'abc1234|Test commit|invalid-timestamp\n'
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.lastCommitHash).toBe('abc123'); // First 7 chars
      expect(gitStatus.lastCommitMessage).toBe('Test commit');
      // Invalid timestamp should result in invalid date
      expect(gitStatus.lastCommitTimestamp).toBeInstanceOf(Date);
      expect(isNaN(gitStatus.lastCommitTimestamp!.getTime())).toBe(true);
    });

    it('should handle ahead/behind parsing errors', async () => {
      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        'git rev-list --count --left-right HEAD...origin/main': 'invalid\tdata\n'
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      // Should fall back to default values
      expect(gitStatus.ahead).toBe(0);
      expect(gitStatus.behind).toBe(0);
    });

    it('should handle repository with no HEAD (empty repo)', async () => {
      mockExecAsync({
        'git rev-parse --git-dir': '.git\n',
        'git rev-parse --abbrev-ref HEAD': '', // Empty output for new repo
        'git status --porcelain=v1': '',
        'git log -1 --format="%H|%s|%ct"': '', // No commits
        'git stash list': '',
        'git remote -v': ''
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe(null); // Empty string treated as null
      expect(gitStatus.lastCommitHash).toBeUndefined();
      expect(gitStatus.lastCommitMessage).toBeUndefined();
      expect(gitStatus.lastCommitTimestamp).toBeUndefined();
    });
  });

  describe('Git Status - Schema Validation', () => {
    beforeEach(() => {
      vi.mocked(execAsync) = vi.fn();
    });

    it('should produce Zod-compliant output for all scenarios', async () => {
      const scenarios = [
        mockGitOutputs.cleanRepo,
        { ...mockGitOutputs.cleanRepo, ...mockGitOutputs.dirtyRepo },
        { ...mockGitOutputs.cleanRepo, ...mockGitOutputs.detachedHead },
        { ...mockGitOutputs.cleanRepo, ...mockGitOutputs.noRemote }
      ];

      const { GitStatusSchema } = await import('../types.js');

      for (const scenario of scenarios) {
        mockExecAsync(scenario);
        const gitStatus = await analyzer.getGitStatus();

        expect(() => {
          GitStatusSchema.parse(gitStatus);
        }).not.toThrow();
      }
    });

    it('should validate GitChangedFile structure', async () => {
      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        'git status --porcelain=v1': 'M  test-file.ts\n?? another-file.ts\n'
      });

      const gitStatus = await analyzer.getGitStatus();
      const { GitChangedFileSchema } = await import('../types.js');

      // Validate each changed file
      gitStatus.staged.forEach(file => {
        expect(() => {
          GitChangedFileSchema.parse(file);
        }).not.toThrow();

        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('status');
        expect(typeof file.path).toBe('string');
        expect(file.path.length).toBeGreaterThan(0);
      });

      gitStatus.unstaged.forEach(file => {
        expect(() => {
          GitChangedFileSchema.parse(file);
        }).not.toThrow();
      });
    });
  });

  describe('Git Status - Performance and Reliability', () => {
    beforeEach(() => {
      vi.mocked(execAsync) = vi.fn();
    });

    it('should handle large number of files efficiently', async () => {
      // Create large file list
      const largeFileList = Array.from({ length: 1000 }, (_, i) =>
        `M  large-file-${i}.ts`
      ).join('\n');

      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        'git status --porcelain=v1': largeFileList
      });

      const startTime = Date.now();
      const gitStatus = await analyzer.getGitStatus();
      const endTime = Date.now();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.staged.length).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent getGitStatus calls', async () => {
      mockExecAsync(mockGitOutputs.cleanRepo);

      const promises = Array.from({ length: 10 }, () => analyzer.getGitStatus());
      const results = await Promise.all(promises);

      // All results should be identical
      results.forEach((result, index) => {
        if (index > 0) {
          expect(result).toEqual(results[0]);
        }
      });
    });

    it('should maintain consistent results across multiple calls', async () => {
      mockExecAsync(mockGitOutputs.cleanRepo);

      const call1 = await analyzer.getGitStatus();
      const call2 = await analyzer.getGitStatus();
      const call3 = await analyzer.getGitStatus();

      expect(call1).toEqual(call2);
      expect(call2).toEqual(call3);
    });
  });

  // Test to document the missing recent commits feature
  describe('Missing Feature: Recent Commits', () => {
    beforeEach(() => {
      vi.mocked(execAsync) = vi.fn();
    });

    it('should document missing recent commits functionality', async () => {
      // Mock recent commits data that should be available
      const recentCommitsOutput =
        'abc1234567890|First commit|1640000000\n' +
        'def4567890123|Second commit|1640010000\n' +
        'ghi7890123456|Third commit|1640020000\n' +
        'jkl0123456789|Fourth commit|1640030000\n' +
        'mno3456789012|Fifth commit|1640040000\n';

      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        'git log -5 --format="%H|%s|%ct"': recentCommitsOutput
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);

      // TODO: The acceptance criteria require "recent commits (last 5)"
      // but this feature is not implemented in the current GitStatus schema

      // Current implementation only has single commit info:
      expect(gitStatus.lastCommitHash).toBe('abc1234');
      expect(gitStatus.lastCommitMessage).toBe('Initial commit');
      expect(gitStatus.lastCommitTimestamp).toBeDefined();

      // Expected implementation (not yet available):
      // expect(gitStatus.recentCommits).toBeDefined();
      // expect(Array.isArray(gitStatus.recentCommits)).toBe(true);
      // expect(gitStatus.recentCommits.length).toBeLessThanOrEqual(5);
      //
      // gitStatus.recentCommits.forEach(commit => {
      //   expect(commit).toHaveProperty('hash');
      //   expect(commit).toHaveProperty('message');
      //   expect(commit).toHaveProperty('timestamp');
      //   expect(typeof commit.hash).toBe('string');
      //   expect(typeof commit.message).toBe('string');
      //   expect(commit.timestamp).toBeInstanceOf(Date);
      // });

      // For now, we verify the implementation meets other acceptance criteria:
      // ✅ Returns current branch name
      expect(gitStatus.branch).toBe('main');

      // ✅ List of uncommitted changes
      expect(Array.isArray(gitStatus.unstaged)).toBe(true);

      // ✅ Staged files
      expect(Array.isArray(gitStatus.staged)).toBe(true);

      // ✅ Detects if inside a git repository
      expect(gitStatus.isRepository).toBe(true);

      // ❌ Recent commits (last 5) - NOT IMPLEMENTED
      // This would require adding recentCommits field to GitStatus schema
      // and implementing the git log parsing logic
    });
  });
});