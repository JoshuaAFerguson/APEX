import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';
import { GitStatusSchema } from '../types.js';
import type { GitStatus } from '../types.js';

/**
 * Comprehensive tests for getGitStatus() method
 *
 * Tests focus on the acceptance criteria:
 * - Returns current branch name
 * - Lists uncommitted changes (staged/unstaged/untracked)
 * - Shows recent commits (last 5)
 * - Detects if inside a git repository
 * - Returns null gracefully if not a git repo
 * - Unit tests cover all scenarios including edge cases
 */

// Mock the shell utilities
vi.mock('../shell-utils.js', () => ({
  getPlatformShell: vi.fn(() => ({ shell: '/bin/bash' }))
}));

// Mock child_process exec
const mockExecAsync = vi.fn();
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync)
}));

describe('getGitStatus() - Comprehensive Testing', () => {
  let analyzer: ProjectContextAnalyzer;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new ProjectContextAnalyzer(testProjectPath);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Git Repository Detection', () => {
    it('should detect a valid git repository', async () => {
      // Mock successful git repository detection
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' }) // git rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // git rev-parse --abbrev-ref HEAD
        .mockResolvedValueOnce({ stdout: 'origin/main\n', stderr: '' }) // remote tracking
        .mockResolvedValueOnce({ stdout: '2\t1\n', stderr: '' }) // ahead/behind count
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git status --porcelain
        .mockResolvedValueOnce({ stdout: 'abc123d|feat: test commit|1640995200', stderr: '' }) // last commit
        .mockResolvedValueOnce({ stdout: 'abc123d|feat: test commit|1640995200|John Doe|john@example.com\ndef456a|fix: bug fix|1640991600|Jane Smith|jane@example.com', stderr: '' }) // recent commits
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // stash list
        .mockResolvedValueOnce({ stdout: 'origin\tgit@github.com:user/repo.git (fetch)\norigin\tgit@github.com:user/repo.git (push)', stderr: '' }); // remotes

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('main');
      expect(gitStatus.remoteBranch).toBe('origin/main');
      expect(gitStatus.ahead).toBe(2);
      expect(gitStatus.behind).toBe(1);
      expect(gitStatus.lastCommitHash).toBe('abc123d');
      expect(gitStatus.lastCommitMessage).toBe('feat: test commit');
      expect(gitStatus.recentCommits).toHaveLength(2);
      expect(gitStatus.remotes).toHaveLength(1);
      expect(gitStatus.remotes[0]).toEqual({
        name: 'origin',
        url: 'git@github.com:user/repo.git'
      });
    });

    it('should return null gracefully if not a git repository', async () => {
      // Mock git repository check failure
      mockExecAsync.mockRejectedValueOnce(new Error('not a git repository'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(false);
      expect(gitStatus.branch).toBeNull();
      expect(gitStatus.remoteBranch).toBeNull();
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
      expect(gitStatus.untracked).toEqual([]);
      expect(gitStatus.hasConflicts).toBe(false);
      expect(gitStatus.isDirty).toBe(false);
      expect(gitStatus.recentCommits).toEqual([]);
      expect(gitStatus.remotes).toEqual([]);
    });

    it('should handle detached HEAD state correctly', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' }) // git rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'HEAD\n', stderr: '' }) // detached HEAD
        .mockRejectedValueOnce(new Error('no upstream')) // no remote tracking
        .mockRejectedValueOnce(new Error('no remote')) // no ahead/behind
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git status
        .mockResolvedValueOnce({ stdout: 'abc123d|commit message|1640995200', stderr: '' }) // last commit
        .mockResolvedValueOnce({ stdout: 'abc123d|commit message|1640995200|Author|email', stderr: '' }) // recent commits
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // stash list
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // remotes

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBeNull(); // HEAD should be converted to null
      expect(gitStatus.remoteBranch).toBeNull();
      expect(gitStatus.ahead).toBe(0);
      expect(gitStatus.behind).toBe(0);
    });
  });

  describe('Branch Information', () => {
    beforeEach(() => {
      // Default successful git repo detection
      mockExecAsync.mockResolvedValueOnce({ stdout: '.git', stderr: '' });
    });

    it('should return current branch name', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'feature/awesome-feature\n', stderr: '' })
        .mockRejectedValue(new Error('default')); // Mock other git calls to fail gracefully

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('feature/awesome-feature');
    });

    it('should handle branch names with special characters', async () => {
      const specialBranchName = 'feature/user-auth-2024.01.01_v2';
      mockExecAsync
        .mockResolvedValueOnce({ stdout: `${specialBranchName}\n`, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.branch).toBe(specialBranchName);
    });

    it('should handle empty branch name gracefully', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '\n', stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.branch).toBeNull();
    });
  });

  describe('Uncommitted Changes Detection', () => {
    beforeEach(() => {
      // Default successful git repo detection
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' });
    });

    it('should detect staged files', async () => {
      const porcelainOutput = `M  src/file1.js
A  src/file2.js
D  src/file3.js
R  src/old.js -> src/new.js
C  src/copied.js`;

      mockExecAsync
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: porcelainOutput, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.staged).toHaveLength(5);
      expect(gitStatus.staged[0]).toEqual({ path: 'src/file1.js', status: 'M' });
      expect(gitStatus.staged[1]).toEqual({ path: 'src/file2.js', status: 'A' });
      expect(gitStatus.staged[2]).toEqual({ path: 'src/file3.js', status: 'D' });
      expect(gitStatus.staged[3]).toEqual({ path: 'src/old.js -> src/new.js', status: 'R' });
      expect(gitStatus.staged[4]).toEqual({ path: 'src/copied.js', status: 'C' });
      expect(gitStatus.isDirty).toBe(true);
    });

    it('should detect unstaged files', async () => {
      const porcelainOutput = ` M src/modified.js
 D src/deleted.js
?? src/untracked.js`;

      mockExecAsync
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: porcelainOutput, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.unstaged).toHaveLength(2);
      expect(gitStatus.unstaged[0]).toEqual({ path: 'src/modified.js', status: 'M' });
      expect(gitStatus.unstaged[1]).toEqual({ path: 'src/deleted.js', status: 'D' });
      expect(gitStatus.untracked).toEqual(['src/untracked.js']);
      expect(gitStatus.isDirty).toBe(true);
    });

    it('should detect both staged and unstaged changes for same file', async () => {
      const porcelainOutput = `MM src/both-changed.js
MD src/staged-modified-deleted.js`;

      mockExecAsync
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: porcelainOutput, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.staged).toHaveLength(2);
      expect(gitStatus.unstaged).toHaveLength(2);
      expect(gitStatus.staged.find(f => f.path === 'src/both-changed.js')?.status).toBe('M');
      expect(gitStatus.unstaged.find(f => f.path === 'src/both-changed.js')?.status).toBe('M');
    });

    it('should detect merge conflicts', async () => {
      const conflictOutput = `UU src/conflict.js
AA src/both-added.js
DD src/both-deleted.js`;

      mockExecAsync
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: conflictOutput, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.hasConflicts).toBe(true);
      expect(gitStatus.isDirty).toBe(true);
    });

    it('should handle clean working directory', async () => {
      mockExecAsync
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // empty status
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
      expect(gitStatus.untracked).toEqual([]);
      expect(gitStatus.hasConflicts).toBe(false);
      expect(gitStatus.isDirty).toBe(false);
    });
  });

  describe('Recent Commits (Last 5)', () => {
    beforeEach(() => {
      // Default successful git repo detection
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // clean status
    });

    it('should return last 5 commits with full information', async () => {
      const recentCommitsOutput = `abc123d|feat: add user authentication|1640995200|John Doe|john@example.com
def456a|fix: resolve login bug|1640991600|Jane Smith|jane@example.com
ghi789b|docs: update API documentation|1640988000|Bob Wilson|bob@example.com
jkl012c|refactor: improve error handling|1640984400|Alice Brown|alice@example.com
mno345d|test: add unit tests for auth|1640980800|Charlie Davis|charlie@example.com`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'abc123d|feat: add user authentication|1640995200', stderr: '' }) // last commit
        .mockResolvedValueOnce({ stdout: recentCommitsOutput, stderr: '' }) // recent commits
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.recentCommits).toHaveLength(5);
      expect(gitStatus.recentCommits[0]).toEqual({
        hash: 'abc123d',
        message: 'feat: add user authentication',
        timestamp: new Date(1640995200 * 1000),
        author: 'John Doe',
        authorEmail: 'john@example.com'
      });
      expect(gitStatus.recentCommits[4]).toEqual({
        hash: 'mno345d',
        message: 'test: add unit tests for auth',
        timestamp: new Date(1640980800 * 1000),
        author: 'Charlie Davis',
        authorEmail: 'charlie@example.com'
      });
    });

    it('should handle fewer than 5 commits', async () => {
      const recentCommitsOutput = `abc123d|initial commit|1640995200|Author|author@example.com
def456a|second commit|1640991600|Author|author@example.com`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'abc123d|initial commit|1640995200', stderr: '' })
        .mockResolvedValueOnce({ stdout: recentCommitsOutput, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.recentCommits).toHaveLength(2);
    });

    it('should handle malformed commit data gracefully', async () => {
      const malformedCommitsOutput = `abc123d|commit message|invalid_timestamp|Author|email
def456a|another commit|1640991600|Author|email
incomplete_entry`;

      mockExecAsync
        .mockRejectedValueOnce(new Error('no last commit'))
        .mockResolvedValueOnce({ stdout: malformedCommitsOutput, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.recentCommits).toHaveLength(1); // Only the valid entry
      expect(gitStatus.recentCommits[0].hash).toBe('def456a');
    });

    it('should handle empty commit history', async () => {
      mockExecAsync
        .mockRejectedValueOnce(new Error('no commits'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.recentCommits).toEqual([]);
      expect(gitStatus.lastCommitHash).toBeUndefined();
      expect(gitStatus.lastCommitMessage).toBeUndefined();
    });
  });

  describe('Advanced Git Information', () => {
    beforeEach(() => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' });
    });

    it('should detect ahead/behind counts', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'origin/main\n', stderr: '' }) // remote tracking
        .mockResolvedValueOnce({ stdout: '3\t2\n', stderr: '' }) // 3 ahead, 2 behind
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // clean status
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.remoteBranch).toBe('origin/main');
      expect(gitStatus.ahead).toBe(3);
      expect(gitStatus.behind).toBe(2);
    });

    it('should handle stash count', async () => {
      mockExecAsync
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // clean status
        .mockRejectedValueOnce(new Error('no last commit'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // no recent commits
        .mockResolvedValueOnce({ stdout: 'stash@{0}: WIP on main: abc123 work in progress\nstash@{1}: WIP on feature: def456 another stash\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remotes'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.stashCount).toBe(2);
    });

    it('should detect multiple remotes', async () => {
      mockExecAsync
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('no last commit'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: `origin\tgit@github.com:user/repo.git (fetch)
origin\tgit@github.com:user/repo.git (push)
upstream\tgit@github.com:upstream/repo.git (fetch)
upstream\tgit@github.com:upstream/repo.git (push)`, stderr: '' });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.remotes).toHaveLength(2);
      expect(gitStatus.remotes).toContainEqual({
        name: 'origin',
        url: 'git@github.com:user/repo.git'
      });
      expect(gitStatus.remotes).toContainEqual({
        name: 'upstream',
        url: 'git@github.com:upstream/repo.git'
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle git command timeouts gracefully', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockImplementationOnce(() => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Command timeout')), 100)
        ));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBeNull(); // Should fallback to null
    });

    it('should handle very long branch names', async () => {
      const longBranchName = 'feature/' + 'a'.repeat(200);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: `${longBranchName}\n`, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.branch).toBe(longBranchName);
    });

    it('should handle unicode characters in commit messages', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'abc123d|feat: 添加用户认证 🔐|1640995200', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'abc123d|feat: 添加用户认证 🔐|1640995200|作者|email@example.com', stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.lastCommitMessage).toBe('feat: 添加用户认证 🔐');
      expect(gitStatus.recentCommits[0].message).toBe('feat: 添加用户认证 🔐');
      expect(gitStatus.recentCommits[0].author).toBe('作者');
    });

    it('should handle large repositories efficiently', async () => {
      // Simulate a large number of changed files
      const largeStatusOutput = Array.from({ length: 1000 }, (_, i) =>
        `M  file${i}.js`
      ).join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: largeStatusOutput, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const startTime = Date.now();
      const gitStatus = await analyzer.getGitStatus();
      const endTime = Date.now();

      expect(gitStatus.staged).toHaveLength(1000);
      expect(gitStatus.isDirty).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });
  });

  describe('Schema Compliance', () => {
    it('should always return data that passes GitStatusSchema validation', async () => {
      // Test various scenarios to ensure schema compliance
      const scenarios = [
        // Non-git repository
        () => mockExecAsync.mockRejectedValueOnce(new Error('not a git repo')),

        // Clean git repository
        () => {
          mockExecAsync
            .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
            .mockRejectedValue(new Error('default'));
        },

        // Repository with changes
        () => {
          mockExecAsync
            .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'feature\n', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'origin/feature\n', stderr: '' })
            .mockResolvedValueOnce({ stdout: '1\t0\n', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'M  file.js\n?? untracked.js\n', stderr: '' })
            .mockRejectedValue(new Error('default'));
        }
      ];

      for (const scenario of scenarios) {
        vi.clearAllMocks();
        analyzer = new ProjectContextAnalyzer(testProjectPath);
        scenario();

        const gitStatus = await analyzer.getGitStatus();

        // Should not throw when validating against schema
        expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();

        // Verify all required properties exist with correct types
        expect(typeof gitStatus.isRepository).toBe('boolean');
        expect(gitStatus.branch === null || typeof gitStatus.branch === 'string').toBe(true);
        expect(Array.isArray(gitStatus.staged)).toBe(true);
        expect(Array.isArray(gitStatus.unstaged)).toBe(true);
        expect(Array.isArray(gitStatus.untracked)).toBe(true);
        expect(typeof gitStatus.hasConflicts).toBe('boolean');
        expect(typeof gitStatus.isDirty).toBe('boolean');
        expect(typeof gitStatus.ahead).toBe('number');
        expect(typeof gitStatus.behind).toBe('number');
        expect(typeof gitStatus.stashCount).toBe('number');
        expect(Array.isArray(gitStatus.remotes)).toBe(true);
        expect(Array.isArray(gitStatus.recentCommits)).toBe(true);
      }
    });

    it('should ensure all GitChangedFile objects are properly formatted', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: 'M  modified.js\nA  added.js\nD  deleted.js\n ?? untracked.js\n', stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      // Validate each changed file structure
      [...gitStatus.staged, ...gitStatus.unstaged].forEach(file => {
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('status');
        expect(typeof file.path).toBe('string');
        expect(['M', 'A', 'D', 'R', 'C', 'U'].includes(file.status)).toBe(true);
      });

      // Validate untracked files are strings
      gitStatus.untracked.forEach(file => {
        expect(typeof file).toBe('string');
      });
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent calls correctly', async () => {
      mockExecAsync
        .mockResolvedValue({ stdout: '.git', stderr: '' }) // git rev-parse --git-dir
        .mockResolvedValue({ stdout: 'main\n', stderr: '' }) // branch
        .mockRejectedValue(new Error('default')); // other calls

      const promises = Array.from({ length: 5 }, () => analyzer.getGitStatus());
      const results = await Promise.all(promises);

      // All results should be identical
      results.forEach(result => {
        expect(result.isRepository).toBe(true);
        expect(result.branch).toBe('main');
      });
    });

    it('should be consistent across multiple calls', async () => {
      mockExecAsync
        .mockResolvedValue({ stdout: '.git', stderr: '' })
        .mockResolvedValue({ stdout: 'main\n', stderr: '' })
        .mockRejectedValue(new Error('default'));

      const result1 = await analyzer.getGitStatus();
      const result2 = await analyzer.getGitStatus();

      expect(result1).toEqual(result2);
    });
  });
});