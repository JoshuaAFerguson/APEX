import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';
import { GitStatusSchema } from '../types.js';
import type { GitStatus } from '../types.js';

/**
 * Testing Stage Final Validation for getGitStatus method
 *
 * This test file validates that the getGitStatus method implementation
 * meets all acceptance criteria specified for the testing stage:
 *
 * - getGitStatus() returns branch name, uncommitted changes count, staged files, recent commits (last 5)
 * - Works in non-git directories
 * - Unit tests pass with >80% coverage
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

describe('getGitStatus - Testing Stage Final Validation', () => {
  let analyzer: ProjectContextAnalyzer;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new ProjectContextAnalyzer(testProjectPath);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Acceptance Criteria Validation', () => {
    it('should return branch name as specified in acceptance criteria', async () => {
      // Mock successful git repository with branch
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' }) // git rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'feature/test-branch\n', stderr: '' }) // branch name
        .mockRejectedValue(new Error('other commands fail'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('feature/test-branch');
      expect(typeof gitStatus.branch).toBe('string');
    });

    it('should return uncommitted changes count as specified in acceptance criteria', async () => {
      const statusOutput = `M  modified.js
A  added.js
D  deleted.js
 M unstaged.js
?? untracked.js`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: statusOutput, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      // Verify staged files count
      expect(gitStatus.staged).toHaveLength(3); // M, A, D
      expect(gitStatus.staged[0]).toEqual({ path: 'modified.js', status: 'M' });
      expect(gitStatus.staged[1]).toEqual({ path: 'added.js', status: 'A' });
      expect(gitStatus.staged[2]).toEqual({ path: 'deleted.js', status: 'D' });

      // Verify unstaged files count
      expect(gitStatus.unstaged).toHaveLength(1); // M
      expect(gitStatus.unstaged[0]).toEqual({ path: 'unstaged.js', status: 'M' });

      // Verify untracked files count
      expect(gitStatus.untracked).toHaveLength(1);
      expect(gitStatus.untracked[0]).toBe('untracked.js');

      // Total uncommitted changes
      const totalUncommittedChanges = gitStatus.staged.length +
                                      gitStatus.unstaged.length +
                                      gitStatus.untracked.length;
      expect(totalUncommittedChanges).toBe(5);
      expect(gitStatus.isDirty).toBe(true);
    });

    it('should return staged files as specified in acceptance criteria', async () => {
      const statusOutput = `M  src/file1.js
A  src/file2.ts
D  src/file3.css
R  old.js -> new.js
C  copied.js`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: statusOutput, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.staged).toHaveLength(5);
      expect(gitStatus.staged).toEqual([
        { path: 'src/file1.js', status: 'M' },
        { path: 'src/file2.ts', status: 'A' },
        { path: 'src/file3.css', status: 'D' },
        { path: 'old.js -> new.js', status: 'R' },
        { path: 'copied.js', status: 'C' }
      ]);

      // Verify each staged file has proper structure
      gitStatus.staged.forEach(file => {
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('status');
        expect(typeof file.path).toBe('string');
        expect(['M', 'A', 'D', 'R', 'C', 'U'].includes(file.status)).toBe(true);
      });
    });

    it('should return recent commits (last 5) as specified in acceptance criteria', async () => {
      const recentCommitsOutput = `abc1234|feat: implement user auth|1640995200|John Doe|john@example.com
def5678|fix: resolve login bug|1640991600|Jane Smith|jane@example.com
ghi9012|docs: update README|1640988000|Bob Wilson|bob@example.com
jkl3456|refactor: improve performance|1640984400|Alice Brown|alice@example.com
mno7890|test: add integration tests|1640980800|Charlie Davis|charlie@example.com`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no remote'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'abc1234|feat: implement user auth|1640995200', stderr: '' })
        .mockResolvedValueOnce({ stdout: recentCommitsOutput, stderr: '' })
        .mockRejectedValue(new Error('default'));

      const gitStatus = await analyzer.getGitStatus();

      // Should return exactly 5 recent commits
      expect(gitStatus.recentCommits).toHaveLength(5);

      // Verify commit structure matches requirements
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

        expect(commit.hash.length).toBe(7); // Short hash
      });

      // Verify first and last commits
      expect(gitStatus.recentCommits[0]).toEqual({
        hash: 'abc1234',
        message: 'feat: implement user auth',
        timestamp: new Date(1640995200 * 1000),
        author: 'John Doe',
        authorEmail: 'john@example.com'
      });

      expect(gitStatus.recentCommits[4]).toEqual({
        hash: 'mno7890',
        message: 'test: add integration tests',
        timestamp: new Date(1640980800 * 1000),
        author: 'Charlie Davis',
        authorEmail: 'charlie@example.com'
      });
    });

    it('should work in non-git directories as specified in acceptance criteria', async () => {
      // Mock failure to detect git repository
      mockExecAsync.mockRejectedValue(new Error('not a git repository'));

      const gitStatus = await analyzer.getGitStatus();

      // Should return graceful defaults for non-git directories
      expect(gitStatus.isRepository).toBe(false);
      expect(gitStatus.branch).toBeNull();
      expect(gitStatus.remoteBranch).toBeNull();
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
      expect(gitStatus.untracked).toEqual([]);
      expect(gitStatus.hasConflicts).toBe(false);
      expect(gitStatus.isDirty).toBe(false);
      expect(gitStatus.ahead).toBe(0);
      expect(gitStatus.behind).toBe(0);
      expect(gitStatus.stashCount).toBe(0);
      expect(gitStatus.remotes).toEqual([]);
      expect(gitStatus.recentCommits).toEqual([]);

      // Should still pass schema validation
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });

    it('should pass comprehensive schema validation', async () => {
      // Test both git and non-git scenarios for schema compliance
      const scenarios = [
        // Non-git repository
        () => mockExecAsync.mockRejectedValue(new Error('not a git repo')),
        // Clean git repository
        () => {
          mockExecAsync
            .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
            .mockRejectedValue(new Error('default'));
        },
        // Repository with full data
        () => {
          mockExecAsync
            .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'feature\n', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'origin/feature\n', stderr: '' })
            .mockResolvedValueOnce({ stdout: '2\t1\n', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'M  file.js\n?? untracked.js\n', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'abc1234|commit message|1640995200', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'abc1234|commit message|1640995200|Author|email', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'stash@{0}: WIP\n', stderr: '' })
            .mockResolvedValueOnce({ stdout: 'origin\tgit@github.com:user/repo.git (fetch)', stderr: '' });
        }
      ];

      for (const scenario of scenarios) {
        vi.clearAllMocks();
        analyzer = new ProjectContextAnalyzer(testProjectPath);
        scenario();

        const gitStatus = await analyzer.getGitStatus();

        // Should pass schema validation for all scenarios
        expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();

        // Verify all required fields exist with correct types
        expect(typeof gitStatus.isRepository).toBe('boolean');
        expect(gitStatus.branch === null || typeof gitStatus.branch === 'string').toBe(true);
        expect(gitStatus.remoteBranch === null || typeof gitStatus.remoteBranch === 'string').toBe(true);
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

        // Verify numeric fields are non-negative
        expect(gitStatus.ahead).toBeGreaterThanOrEqual(0);
        expect(gitStatus.behind).toBeGreaterThanOrEqual(0);
        expect(gitStatus.stashCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Method Availability and Integration', () => {
    it('should have getGitStatus method available on ProjectContextAnalyzer instance', () => {
      expect(typeof analyzer.getGitStatus).toBe('function');
      expect(analyzer.getGitStatus.length).toBe(0); // No parameters expected
    });

    it('should return a Promise from getGitStatus method', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const result = analyzer.getGitStatus();

      expect(result).toBeInstanceOf(Promise);

      // Should resolve successfully
      const gitStatus = await result;
      expect(gitStatus).toBeDefined();
      expect(typeof gitStatus).toBe('object');
    });

    it('should integrate properly with overall analyze method', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      // Create analyzer with git analysis enabled (default)
      const analyzer = new ProjectContextAnalyzer(testProjectPath, { analyzeGit: true });

      // Mock other required methods for full analysis
      vi.spyOn(analyzer, 'getProjectStructure').mockResolvedValue({
        root: testProjectPath,
        totalFiles: 0,
        totalDirectories: 0,
        entries: [],
        rootFiles: [],
        commonDirectories: [],
        hasPackageJson: false,
        hasGitIgnore: false,
        hasReadme: false,
        hasLicense: false,
        excludedDirectories: [],
        scannedAt: new Date()
      });

      vi.spyOn(analyzer, 'detectFrameworks').mockResolvedValue({
        frameworks: { primary: null, secondary: [], ui: [], testing: [], database: [], cloud: [] },
        languages: [],
        packageManagers: [],
        runtime: null
      });

      vi.spyOn(analyzer, 'getConfigurationInfoList').mockResolvedValue([]);
      vi.spyOn(analyzer, 'getTestFrameworkInfoList').mockResolvedValue([]);

      const context = await analyzer.analyze();

      expect(context).toHaveProperty('gitStatus');
      expect(context.gitStatus).toBeDefined();
      expect(context.gitStatus!.isRepository).toBe(false);
    });
  });
});