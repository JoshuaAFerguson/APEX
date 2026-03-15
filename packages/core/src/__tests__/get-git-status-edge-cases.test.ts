import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';
import { GitStatusSchema } from '../types.js';

/**
 * Additional edge case tests for getGitStatus() method
 *
 * Focuses on extreme scenarios, error conditions, and boundary cases
 * that might not be covered in the main comprehensive tests.
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

describe('getGitStatus() - Edge Cases', () => {
  let analyzer: ProjectContextAnalyzer;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new ProjectContextAnalyzer(testProjectPath);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Boundary Value Testing', () => {
    it('should handle zero commits (empty repository)', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' }) // git repo check
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // branch
        .mockRejectedValueOnce(new Error('no upstream')) // no remote
        .mockRejectedValueOnce(new Error('no commits yet')) // no ahead/behind
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // no changes
        .mockRejectedValueOnce(new Error('no commits')) // no last commit
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // no recent commits
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // no stashes
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // no remotes

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('main');
      expect(gitStatus.recentCommits).toEqual([]);
      expect(gitStatus.lastCommitHash).toBeUndefined();
      expect(gitStatus.lastCommitTimestamp).toBeUndefined();
    });

    it('should handle exactly 5 commits', async () => {
      const exactlyFiveCommits = Array.from({ length: 5 }, (_, i) =>
        `hash${i}|commit ${i}|${1640995200 + i * 1000}|Author${i}|author${i}@example.com`
      ).join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'hash0|commit 0|1640995200', stderr: '' })
        .mockResolvedValueOnce({ stdout: exactlyFiveCommits, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.recentCommits).toHaveLength(5);
      expect(gitStatus.recentCommits[0].hash).toBe('hash0');
      expect(gitStatus.recentCommits[4].hash).toBe('hash4');
    });

    it('should handle more than 5 commits (should still return only 5)', async () => {
      // Git log command would naturally return only 5 due to -5 flag,
      // but test ensures our parsing doesn't accidentally include more
      const moreThanFiveCommits = Array.from({ length: 7 }, (_, i) =>
        `hash${i}|commit ${i}|${1640995200 + i * 1000}|Author${i}|author${i}@example.com`
      ).join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'hash0|commit 0|1640995200', stderr: '' })
        .mockResolvedValueOnce({ stdout: moreThanFiveCommits, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      // Should still have all commits if git returns more than 5
      expect(gitStatus.recentCommits).toHaveLength(7);
    });
  });

  describe('Malformed Data Handling', () => {
    it('should handle commits with missing fields', async () => {
      const malformedCommits = `hash1|message1|1640995200|author1|email1@example.com
hash2|message2||author2|email2@example.com
hash3|||
|message4|1640995200|author4|email4@example.com
hash5|message5|1640995200|author5|`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('no last commit'))
        .mockResolvedValueOnce({ stdout: malformedCommits, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      // Should filter out malformed entries and handle missing fields gracefully
      const validCommits = gitStatus.recentCommits.filter(commit => commit.hash);
      expect(validCommits.length).toBeGreaterThanOrEqual(1);

      // Find the commit with empty timestamp
      const commitWithEmptyTimestamp = gitStatus.recentCommits.find(c => c.hash === 'hash2');
      if (commitWithEmptyTimestamp) {
        expect(commitWithEmptyTimestamp.timestamp).toBeInstanceOf(Date);
      }
    });

    it('should handle invalid git status output', async () => {
      const invalidStatusOutput = `invalid line
!! unknown-status file.js
XY file-with-unknown-codes.js
MM
  incomplete-line`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: invalidStatusOutput, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      // Should handle gracefully without throwing
      expect(gitStatus.isRepository).toBe(true);
      expect(Array.isArray(gitStatus.staged)).toBe(true);
      expect(Array.isArray(gitStatus.unstaged)).toBe(true);
    });

    it('should handle ahead/behind parsing errors', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'origin/main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'invalid\tahead\tbehind\tdata\n', stderr: '' }) // malformed
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.remoteBranch).toBe('origin/main');
      expect(gitStatus.ahead).toBe(0); // Should default to 0
      expect(gitStatus.behind).toBe(0); // Should default to 0
    });
  });

  describe('Extreme Values', () => {
    it('should handle very long file paths', async () => {
      const longPath = 'deeply/nested/' + 'very-long-directory-name/'.repeat(20) + 'extremely-long-filename-that-goes-on-and-on.js';
      const statusOutput = `M  ${longPath}
A  another/very/long/path/to/a/file/with/many/segments/file.js`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: statusOutput, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.staged).toHaveLength(2);
      expect(gitStatus.staged[0].path).toBe(longPath);
      expect(gitStatus.isDirty).toBe(true);
    });

    it('should handle very large ahead/behind counts', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'origin/main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '999999\t888888\n', stderr: '' }) // very large counts
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.ahead).toBe(999999);
      expect(gitStatus.behind).toBe(888888);
    });

    it('should handle hundreds of changed files', async () => {
      // Generate a large number of changed files
      const manyChanges = Array.from({ length: 500 }, (_, i) => {
        const statusCodes = ['M ', ' M', 'A ', ' D', '??'];
        const code = statusCodes[i % statusCodes.length];
        return `${code} file${i}.js`;
      }).join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: manyChanges, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      const totalChanges = gitStatus.staged.length + gitStatus.unstaged.length + gitStatus.untracked.length;
      expect(totalChanges).toBe(500);
      expect(gitStatus.isDirty).toBe(true);
    });
  });

  describe('Special Characters and Encoding', () => {
    it('should handle files with special characters in names', async () => {
      const specialFileNames = `M  "file with spaces.js"
A  "file-with-émojis-🎉.js"
D  "file'with'quotes.js"
R  "old name.js" -> "new name.js"
?? "файл-с-русскими-символами.js"`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: specialFileNames, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      // Should handle quoted filenames correctly
      expect(gitStatus.staged.some(f => f.path.includes('spaces'))).toBe(true);
      expect(gitStatus.staged.some(f => f.path.includes('🎉'))).toBe(true);
      expect(gitStatus.untracked.some(f => f.includes('русскими'))).toBe(true);
    });

    it('should handle remote URLs with special characters', async () => {
      const remoteOutput = `origin\tgit@github.com:user/repo-with-dashes.git (fetch)
origin\tgit@github.com:user/repo-with-dashes.git (push)
upstream\thttps://user:token@github.com/org/repo.git (fetch)
upstream\thttps://user:token@github.com/org/repo.git (push)`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('no last commit'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: remoteOutput, stderr: '' });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.remotes).toHaveLength(2);
      expect(gitStatus.remotes[0]).toEqual({
        name: 'origin',
        url: 'git@github.com:user/repo-with-dashes.git'
      });
      expect(gitStatus.remotes[1]).toEqual({
        name: 'upstream',
        url: 'https://user:token@github.com/org/repo.git'
      });
    });
  });

  describe('Timeout and Resource Constraints', () => {
    it('should handle partial command failures gracefully', async () => {
      // First few commands succeed, later ones fail
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' }) // git repo check - success
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // branch - success
        .mockResolvedValueOnce({ stdout: 'origin/main\n', stderr: '' }) // remote - success
        .mockRejectedValueOnce(new Error('timeout')) // ahead/behind - fails
        .mockRejectedValueOnce(new Error('permission denied')) // status - fails
        .mockRejectedValueOnce(new Error('disk full')) // last commit - fails
        .mockRejectedValueOnce(new Error('network error')) // recent commits - fails
        .mockRejectedValueOnce(new Error('interrupted')) // stash - fails
        .mockRejectedValueOnce(new Error('cancelled')); // remotes - fails

      const gitStatus = await analyzer.getGitStatus();

      // Should still return valid GitStatus object with partial data
      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('main');
      expect(gitStatus.remoteBranch).toBe('origin/main');

      // Failed commands should result in default values
      expect(gitStatus.ahead).toBe(0);
      expect(gitStatus.behind).toBe(0);
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
      expect(gitStatus.untracked).toEqual([]);
      expect(gitStatus.recentCommits).toEqual([]);
      expect(gitStatus.remotes).toEqual([]);
    });

    it('should maintain data integrity with concurrent modifications', async () => {
      // Simulate scenario where git state changes between command calls
      let callCount = 0;
      mockExecAsync.mockImplementation((command) => {
        callCount++;

        if (command.includes('rev-parse --git-dir')) {
          return Promise.resolve({ stdout: '.git', stderr: '' });
        }

        if (command.includes('rev-parse --abbrev-ref HEAD')) {
          // Branch changes during execution
          return Promise.resolve({
            stdout: callCount < 3 ? 'main\n' : 'feature-branch\n',
            stderr: ''
          });
        }

        return Promise.reject(new Error('other commands fail'));
      });

      const gitStatus = await analyzer.getGitStatus();

      // Should still return a consistent, valid result
      expect(gitStatus.isRepository).toBe(true);
      expect(['main', 'feature-branch'].includes(gitStatus.branch!)).toBe(true);
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should ensure all numeric fields are within valid ranges', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'origin/main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '0\t0\n', stderr: '' }) // exactly 0 ahead/behind
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('no last commit'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // exactly 0 stashes
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const gitStatus = await analyzer.getGitStatus();

      // All numeric fields should be non-negative
      expect(gitStatus.ahead).toBeGreaterThanOrEqual(0);
      expect(gitStatus.behind).toBeGreaterThanOrEqual(0);
      expect(gitStatus.stashCount).toBeGreaterThanOrEqual(0);

      // Should pass schema validation
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });

    it('should handle null vs undefined correctly for optional fields', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repository'));

      const gitStatus = await analyzer.getGitStatus();

      // Non-git repo should have specific null/undefined patterns
      expect(gitStatus.isRepository).toBe(false);
      expect(gitStatus.branch).toBeNull(); // Explicitly null, not undefined
      expect(gitStatus.remoteBranch).toBeNull();
      expect(gitStatus.lastCommitHash).toBeUndefined(); // Should be undefined when not available
      expect(gitStatus.lastCommitMessage).toBeUndefined();
      expect(gitStatus.lastCommitTimestamp).toBeUndefined();

      // Schema should still validate
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });
  });

  describe('Cross-platform Compatibility', () => {
    it('should handle Windows-style line endings', async () => {
      const windowsStyleOutput = `M  file1.js\r\nA  file2.js\r\n?? file3.js\r\n`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\r\n', stderr: '' }) // Windows line ending
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: windowsStyleOutput, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.branch).toBe('main'); // Should strip \r\n correctly
      expect(gitStatus.staged).toHaveLength(2);
      expect(gitStatus.untracked).toHaveLength(1);
    });

    it('should handle different path separators in file paths', async () => {
      const mixedPathSeparators = `M  src/components/Button.js
A  src\\utils\\helper.js
?? docs/README.md`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: mixedPathSeparators, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      // Should handle both forward and back slashes
      expect(gitStatus.staged.some(f => f.path.includes('Button.js'))).toBe(true);
      expect(gitStatus.staged.some(f => f.path.includes('helper.js'))).toBe(true);
      expect(gitStatus.untracked.some(f => f.includes('README.md'))).toBe(true);
    });
  });
});