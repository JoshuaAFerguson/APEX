import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';
import type { GitStatus, GitChangedFile, GitCommit } from '../types.js';
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
    'git log -5 --format="%H|%s|%ct|%an|%ae"': 'abc1234567890123456789012345678901234567890|Initial commit|1640000000|Test Author|test@example.com\n',
    'git stash list': '',
    'git remote -v': 'origin\tgit@github.com:user/repo.git (fetch)\norigin\tgit@github.com:user/repo.git (push)\n'
  },

  dirtyRepo: {
    'git rev-parse --git-dir': '.git\n',
    'git rev-parse --abbrev-ref HEAD': 'feature/test\n',
    'git status --porcelain=v1': ' M modified-file.ts\nA  staged-file.ts\nD  deleted-file.ts\n?? untracked-file.ts\nUU conflict-file.ts\n',
    'git log -1 --format="%H|%s|%ct"': 'def4567890123456789012345678901234567890ab|Add new feature|1640100000\n',
    'git log -5 --format="%H|%s|%ct|%an|%ae"': 'def4567890123456789012345678901234567890ab|Add new feature|1640100000|Dev Author|dev@example.com\nabc1234567890123456789012345678901234567890|Initial commit|1640000000|Test Author|test@example.com\n',
    'git stash list': 'stash@{0}: WIP on main: abc1234 Initial commit\nstash@{1}: WIP on main: abc1234 Another stash\n'
  },

  aheadBehind: {
    'git rev-parse --git-dir': '.git\n',
    'git rev-parse --abbrev-ref HEAD': 'feature/ahead\n',
    'git rev-parse --abbrev-ref "feature/ahead@{upstream}"': 'origin/feature/ahead\n',
    'git rev-list --count --left-right HEAD...origin/feature/ahead': '3\t2\n',
    'git log -5 --format="%H|%s|%ct|%an|%ae"': 'ghi7890123456789012345678901234567890cdef|Feature commit|1640200000|Feature Author|feature@example.com\n'
  },

  detachedHead: {
    'git rev-parse --git-dir': '.git\n',
    'git rev-parse --abbrev-ref HEAD': 'HEAD\n',
    'git log -5 --format="%H|%s|%ct|%an|%ae"': 'jkl0123456789012345678901234567890ghij|Detached commit|1640300000|Detached Author|detached@example.com\n'
  },

  noRemote: {
    'git rev-parse --git-dir': '.git\n',
    'git rev-parse --abbrev-ref HEAD': 'main\n',
    'git remote -v': '',
    'git log -5 --format="%H|%s|%ct|%an|%ae"': 'mno3456789012345678901234567890klmn|No remote commit|1640400000|Local Author|local@example.com\n'
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
      expect(gitStatus.recentCommits).toBeDefined();
      expect(Array.isArray(gitStatus.recentCommits)).toBe(true);
      expect(gitStatus.recentCommits.length).toBe(1);
      expect(gitStatus.recentCommits[0]).toEqual({
        hash: 'abc1234',
        message: 'Initial commit',
        timestamp: new Date(1640000000 * 1000),
        author: 'Test Author',
        authorEmail: 'test@example.com'
      });
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

  // Test recent commits feature implementation
  describe('Recent Commits Feature', () => {
    beforeEach(() => {
      vi.mocked(execAsync) = vi.fn();
    });

    it('should fetch and parse recent commits (last 5)', async () => {
      // Mock recent commits data
      const recentCommitsOutput =
        'abc1234567890123456789012345678901234567890|First commit|1640000000|John Doe|john@example.com\n' +
        'def4567890123456789012345678901234567890ab|Second commit|1640010000|Jane Smith|jane@example.com\n' +
        'ghi7890123456789012345678901234567890cdef|Third commit|1640020000|Bob Wilson|bob@example.com\n' +
        'jkl0123456789012345678901234567890ghij|Fourth commit|1640030000|Alice Brown|alice@example.com\n' +
        'mno3456789012345678901234567890klmn|Fifth commit|1640040000|Charlie Davis|charlie@example.com\n';

      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        'git log -5 --format="%H|%s|%ct|%an|%ae"': recentCommitsOutput
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);

      // ✅ Recent commits (last 5) - NOW IMPLEMENTED
      expect(gitStatus.recentCommits).toBeDefined();
      expect(Array.isArray(gitStatus.recentCommits)).toBe(true);
      expect(gitStatus.recentCommits.length).toBe(5);

      // Verify each commit structure
      gitStatus.recentCommits.forEach((commit, index) => {
        expect(commit).toHaveProperty('hash');
        expect(commit).toHaveProperty('message');
        expect(commit).toHaveProperty('timestamp');
        expect(commit).toHaveProperty('author');
        expect(commit).toHaveProperty('authorEmail');

        expect(typeof commit.hash).toBe('string');
        expect(typeof commit.message).toBe('string');
        expect(commit.timestamp).toBeInstanceOf(Date);
        expect(typeof commit.author).toBe('string');
        expect(typeof commit.authorEmail).toBe('string');

        // Hash should be shortened to 7 characters
        expect(commit.hash).toHaveLength(7);
      });

      // Verify specific commit data
      expect(gitStatus.recentCommits[0].hash).toBe('abc1234');
      expect(gitStatus.recentCommits[0].message).toBe('First commit');
      expect(gitStatus.recentCommits[0].author).toBe('John Doe');
      expect(gitStatus.recentCommits[0].authorEmail).toBe('john@example.com');
      expect(gitStatus.recentCommits[0].timestamp).toEqual(new Date(1640000000 * 1000));

      expect(gitStatus.recentCommits[4].hash).toBe('mno3456');
      expect(gitStatus.recentCommits[4].message).toBe('Fifth commit');
      expect(gitStatus.recentCommits[4].author).toBe('Charlie Davis');

      // Verify all acceptance criteria are now met:
      // ✅ Returns current branch name
      expect(gitStatus.branch).toBe('main');

      // ✅ List of uncommitted changes
      expect(Array.isArray(gitStatus.unstaged)).toBe(true);

      // ✅ Staged files
      expect(Array.isArray(gitStatus.staged)).toBe(true);

      // ✅ Recent commits (last 5)
      expect(gitStatus.recentCommits.length).toBeLessThanOrEqual(5);

      // ✅ Detects if inside a git repository
      expect(gitStatus.isRepository).toBe(true);
    });

    it('should handle repositories with fewer than 5 commits', async () => {
      const recentCommitsOutput =
        'abc1234567890123456789012345678901234567890|First commit|1640000000|John Doe|john@example.com\n' +
        'def4567890123456789012345678901234567890ab|Second commit|1640010000|Jane Smith|jane@example.com\n';

      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        'git log -5 --format="%H|%s|%ct|%an|%ae"': recentCommitsOutput
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.recentCommits).toBeDefined();
      expect(gitStatus.recentCommits.length).toBe(2);
      expect(gitStatus.recentCommits[0].hash).toBe('abc1234');
      expect(gitStatus.recentCommits[1].hash).toBe('def4567');
    });

    it('should handle empty repository with no commits', async () => {
      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        'git log -5 --format="%H|%s|%ct|%an|%ae"': '' // No commits
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.recentCommits).toBeDefined();
      expect(gitStatus.recentCommits).toEqual([]);
    });

    it('should handle git log command failure gracefully', async () => {
      vi.mocked(execAsync).mockImplementation(async (command: string) => {
        if (command.includes('git log -5')) {
          throw new Error('Git log command failed');
        }
        if (command.includes('git rev-parse --git-dir')) {
          return { stdout: '.git\n', stderr: '' };
        }
        return mockGitOutputs.cleanRepo[command.trim()]
          ? { stdout: mockGitOutputs.cleanRepo[command.trim()], stderr: '' }
          : Promise.reject(new Error('Command failed'));
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.recentCommits).toBeDefined();
      expect(gitStatus.recentCommits).toEqual([]); // Should fall back to empty array
    });

    it('should handle malformed commit data gracefully', async () => {
      const malformedCommitsOutput =
        'abc1234567890123456789012345678901234567890|First commit|1640000000|John Doe|john@example.com\n' +
        'invalid-line-missing-fields\n' +
        'def4567890123456789012345678901234567890ab|Second commit|invalid-timestamp|Jane Smith|jane@example.com\n' +
        'ghi7890123456789012345678901234567890cdef|Third commit|1640020000|Bob Wilson|bob@example.com\n';

      mockExecAsync({
        ...mockGitOutputs.cleanRepo,
        'git log -5 --format="%H|%s|%ct|%an|%ae"': malformedCommitsOutput
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.recentCommits).toBeDefined();

      // Should parse valid commits and skip/handle invalid ones gracefully
      const validCommits = gitStatus.recentCommits.filter(commit =>
        commit.hash && commit.message && commit.timestamp instanceof Date
      );

      expect(validCommits.length).toBeGreaterThan(0);
      expect(validCommits[0].hash).toBe('abc1234');
      expect(validCommits[0].message).toBe('First commit');
    });
  });
});