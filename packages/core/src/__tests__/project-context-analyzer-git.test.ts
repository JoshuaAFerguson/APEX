import { describe, it, expect } from 'vitest';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';
import type { GitStatus, GitChangedFile } from '../types.js';

describe('ProjectContextAnalyzer Git Status', () => {
  describe('getGitStatus edge cases', () => {
    it('handles non-existent directory gracefully', async () => {
      const analyzer = new ProjectContextAnalyzer('/non/existent/path');
      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(false);
      expect(gitStatus.branch).toBe(null);
      expect(gitStatus.remoteBranch).toBe(null);
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
      expect(gitStatus.untracked).toEqual([]);
      expect(gitStatus.hasConflicts).toBe(false);
      expect(gitStatus.isDirty).toBe(false);
      expect(gitStatus.ahead).toBe(0);
      expect(gitStatus.behind).toBe(0);
      expect(gitStatus.stashCount).toBe(0);
      expect(gitStatus.remotes).toEqual([]);
    });

    it('handles directories with special characters in path', async () => {
      const specialPath = '/tmp/test with spaces & symbols!@#$%';
      const analyzer = new ProjectContextAnalyzer(specialPath);
      const gitStatus = await analyzer.getGitStatus();

      // Should not throw and return default non-git status
      expect(gitStatus.isRepository).toBe(false);
    });

    it('validates all required GitStatus properties are present', async () => {
      const analyzer = new ProjectContextAnalyzer('/tmp');
      const gitStatus = await analyzer.getGitStatus();

      // Check all required properties exist
      expect(gitStatus).toHaveProperty('isRepository');
      expect(gitStatus).toHaveProperty('branch');
      expect(gitStatus).toHaveProperty('remoteBranch');
      expect(gitStatus).toHaveProperty('ahead');
      expect(gitStatus).toHaveProperty('behind');
      expect(gitStatus).toHaveProperty('staged');
      expect(gitStatus).toHaveProperty('unstaged');
      expect(gitStatus).toHaveProperty('untracked');
      expect(gitStatus).toHaveProperty('hasConflicts');
      expect(gitStatus).toHaveProperty('isDirty');
      expect(gitStatus).toHaveProperty('stashCount');
      expect(gitStatus).toHaveProperty('remotes');

      // Optional properties should at least be defined or undefined
      expect(gitStatus).toHaveProperty('lastCommitHash');
      expect(gitStatus).toHaveProperty('lastCommitMessage');
      expect(gitStatus).toHaveProperty('lastCommitTimestamp');
    });

    it('returns proper types for all properties', async () => {
      const analyzer = new ProjectContextAnalyzer('/tmp');
      const gitStatus = await analyzer.getGitStatus();

      expect(typeof gitStatus.isRepository).toBe('boolean');
      expect(typeof gitStatus.hasConflicts).toBe('boolean');
      expect(typeof gitStatus.isDirty).toBe('boolean');
      expect(typeof gitStatus.ahead).toBe('number');
      expect(typeof gitStatus.behind).toBe('number');
      expect(typeof gitStatus.stashCount).toBe('number');

      expect(gitStatus.branch === null || typeof gitStatus.branch === 'string').toBe(true);
      expect(gitStatus.remoteBranch === null || gitStatus.remoteBranch === undefined || typeof gitStatus.remoteBranch === 'string').toBe(true);

      expect(Array.isArray(gitStatus.staged)).toBe(true);
      expect(Array.isArray(gitStatus.unstaged)).toBe(true);
      expect(Array.isArray(gitStatus.untracked)).toBe(true);
      expect(Array.isArray(gitStatus.remotes)).toBe(true);
    });

    it('validates GitChangedFile structure if any files are returned', async () => {
      const analyzer = new ProjectContextAnalyzer('/tmp');
      const gitStatus = await analyzer.getGitStatus();

      // If any files are in staged/unstaged, they should have proper structure
      [...gitStatus.staged, ...gitStatus.unstaged].forEach((file: GitChangedFile) => {
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('status');
        expect(typeof file.path).toBe('string');
        expect(file.path.length).toBeGreaterThan(0);

        // Status should be one of the allowed values
        const validStatuses = ['M', 'A', 'D', 'R', 'C', 'U', '?', '!'];
        expect(validStatuses).toContain(file.status);
      });
    });

    it('validates remote structure if any remotes are returned', async () => {
      const analyzer = new ProjectContextAnalyzer('/tmp');
      const gitStatus = await analyzer.getGitStatus();

      gitStatus.remotes.forEach((remote) => {
        expect(remote).toHaveProperty('name');
        expect(remote).toHaveProperty('url');
        expect(typeof remote.name).toBe('string');
        expect(typeof remote.url).toBe('string');
        expect(remote.name.length).toBeGreaterThan(0);
        expect(remote.url.length).toBeGreaterThan(0);
      });
    });

    it('ensures numeric properties have valid ranges', async () => {
      const analyzer = new ProjectContextAnalyzer('/tmp');
      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.ahead).toBeGreaterThanOrEqual(0);
      expect(gitStatus.behind).toBeGreaterThanOrEqual(0);
      expect(gitStatus.stashCount).toBeGreaterThanOrEqual(0);

      // Should be integers
      expect(Number.isInteger(gitStatus.ahead)).toBe(true);
      expect(Number.isInteger(gitStatus.behind)).toBe(true);
      expect(Number.isInteger(gitStatus.stashCount)).toBe(true);
    });

    it('ensures isDirty is calculated correctly', async () => {
      const analyzer = new ProjectContextAnalyzer('/tmp');
      const gitStatus = await analyzer.getGitStatus();

      // For non-git repository, should be false
      if (!gitStatus.isRepository) {
        expect(gitStatus.isDirty).toBe(false);
        expect(gitStatus.staged).toHaveLength(0);
        expect(gitStatus.unstaged).toHaveLength(0);
        expect(gitStatus.untracked).toHaveLength(0);
      } else {
        // If there are changes, isDirty should be true
        const hasChanges = gitStatus.staged.length > 0 ||
                          gitStatus.unstaged.length > 0 ||
                          gitStatus.untracked.length > 0;

        if (hasChanges) {
          expect(gitStatus.isDirty).toBe(true);
        }
      }
    });

    it('handles multiple consecutive calls efficiently', async () => {
      const analyzer = new ProjectContextAnalyzer('/tmp');

      const startTime = Date.now();
      const results = await Promise.all([
        analyzer.getGitStatus(),
        analyzer.getGitStatus(),
        analyzer.getGitStatus(),
      ]);
      const endTime = Date.now();

      // All results should be identical
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);

      // Should complete reasonably quickly (less than 5 seconds for 3 calls)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('schema validation passes for returned git status', async () => {
      const analyzer = new ProjectContextAnalyzer('/tmp');
      const gitStatus = await analyzer.getGitStatus();

      const { GitStatusSchema } = await import('../types.js');

      // Should not throw during schema validation
      expect(() => {
        GitStatusSchema.parse(gitStatus);
      }).not.toThrow();
    });
  });
});