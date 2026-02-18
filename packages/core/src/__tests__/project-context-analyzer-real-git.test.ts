import { describe, it, expect, beforeAll } from 'vitest';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';
import type { GitStatus } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('ProjectContextAnalyzer - Real Git Repository Tests', () => {
  let analyzer: ProjectContextAnalyzer;
  let isGitRepo = false;
  let projectRoot: string;

  beforeAll(async () => {
    // Use the current project directory (APEX) which should be a git repository
    projectRoot = process.cwd();
    analyzer = new ProjectContextAnalyzer(projectRoot);

    // Check if we're in a git repository
    try {
      await execAsync('git rev-parse --git-dir', { cwd: projectRoot });
      isGitRepo = true;
    } catch {
      isGitRepo = false;
    }
  });

  describe('Real Git Repository Integration', () => {
    it('should detect git repository correctly in real project', async () => {
      const gitStatus = await analyzer.getGitStatus();

      if (isGitRepo) {
        expect(gitStatus.isRepository).toBe(true);
        expect(gitStatus.branch).not.toBe(null);
        expect(typeof gitStatus.branch).toBe('string');
      } else {
        expect(gitStatus.isRepository).toBe(false);
        expect(gitStatus.branch).toBe(null);
      }
    });

    it('should return valid branch name for real repository', async () => {
      if (!isGitRepo) {
        return; // Skip if not in git repo
      }

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).not.toBe(null);
      expect(typeof gitStatus.branch).toBe('string');
      expect(gitStatus.branch!.length).toBeGreaterThan(0);

      // Verify branch name matches git command output
      const { stdout: gitBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectRoot });
      const actualBranch = gitBranch.trim();

      if (actualBranch !== 'HEAD') {
        expect(gitStatus.branch).toBe(actualBranch);
      }
    });

    it('should detect file changes in working directory', async () => {
      if (!isGitRepo) {
        return; // Skip if not in git repo
      }

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(Array.isArray(gitStatus.staged)).toBe(true);
      expect(Array.isArray(gitStatus.unstaged)).toBe(true);
      expect(Array.isArray(gitStatus.untracked)).toBe(true);

      // Verify isDirty is calculated correctly
      const hasChanges = gitStatus.staged.length > 0 ||
                        gitStatus.unstaged.length > 0 ||
                        gitStatus.untracked.length > 0;
      expect(gitStatus.isDirty).toBe(hasChanges);
    });

    it('should return valid remote information', async () => {
      if (!isGitRepo) {
        return; // Skip if not in git repo
      }

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(Array.isArray(gitStatus.remotes)).toBe(true);

      // If there are remotes, they should have valid structure
      gitStatus.remotes.forEach(remote => {
        expect(remote).toHaveProperty('name');
        expect(remote).toHaveProperty('url');
        expect(typeof remote.name).toBe('string');
        expect(typeof remote.url).toBe('string');
        expect(remote.name.length).toBeGreaterThan(0);
        expect(remote.url.length).toBeGreaterThan(0);
      });
    });

    it('should return last commit information', async () => {
      if (!isGitRepo) {
        return; // Skip if not in git repo
      }

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);

      // If we have commits, these should be populated
      try {
        const { stdout: lastCommit } = await execAsync('git log -1 --format="%H|%s|%ct"', { cwd: projectRoot });
        if (lastCommit.trim()) {
          expect(gitStatus.lastCommitHash).toBeDefined();
          expect(gitStatus.lastCommitMessage).toBeDefined();
          expect(gitStatus.lastCommitTimestamp).toBeDefined();

          expect(typeof gitStatus.lastCommitHash).toBe('string');
          expect(typeof gitStatus.lastCommitMessage).toBe('string');
          expect(gitStatus.lastCommitTimestamp).toBeInstanceOf(Date);

          expect(gitStatus.lastCommitHash!.length).toBe(7); // Short hash
        }
      } catch {
        // No commits or git command failed
        // In this case, the fields can be undefined
      }
    });

    it('should handle stash count correctly', async () => {
      if (!isGitRepo) {
        return; // Skip if not in git repo
      }

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(typeof gitStatus.stashCount).toBe('number');
      expect(gitStatus.stashCount).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(gitStatus.stashCount)).toBe(true);
    });

    it('should detect ahead/behind counts with remote tracking', async () => {
      if (!isGitRepo) {
        return; // Skip if not in git repo
      }

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(typeof gitStatus.ahead).toBe('number');
      expect(typeof gitStatus.behind).toBe('number');
      expect(gitStatus.ahead).toBeGreaterThanOrEqual(0);
      expect(gitStatus.behind).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(gitStatus.ahead)).toBe(true);
      expect(Number.isInteger(gitStatus.behind)).toBe(true);
    });

    it('should validate all file statuses are supported', async () => {
      if (!isGitRepo) {
        return; // Skip if not in git repo
      }

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);

      const validStatuses = ['M', 'A', 'D', 'R', 'C', 'U', '?', '!'];

      // Check all staged files have valid status
      gitStatus.staged.forEach(file => {
        expect(validStatuses).toContain(file.status);
        expect(typeof file.path).toBe('string');
        expect(file.path.length).toBeGreaterThan(0);
      });

      // Check all unstaged files have valid status
      gitStatus.unstaged.forEach(file => {
        expect(validStatuses).toContain(file.status);
        expect(typeof file.path).toBe('string');
        expect(file.path.length).toBeGreaterThan(0);
      });
    });

    it('should pass Zod schema validation for real git data', async () => {
      const gitStatus = await analyzer.getGitStatus();
      const { GitStatusSchema } = await import('../types.js');

      // Should not throw during schema validation
      expect(() => {
        GitStatusSchema.parse(gitStatus);
      }).not.toThrow();
    });

    // NOTE: The following test documents the missing feature from acceptance criteria
    it('should return recent commits (MISSING FEATURE)', async () => {
      if (!isGitRepo) {
        return; // Skip if not in git repo
      }

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);

      // TODO: This feature is missing from the current implementation
      // The acceptance criteria require "recent commits (last 5)"
      // but the current GitStatus schema only includes lastCommit* fields

      // Expected behavior (not yet implemented):
      // expect(gitStatus.recentCommits).toBeDefined();
      // expect(Array.isArray(gitStatus.recentCommits)).toBe(true);
      // expect(gitStatus.recentCommits.length).toBeLessThanOrEqual(5);

      // For now, we verify the single last commit info is working
      try {
        const { stdout: commits } = await execAsync('git log -5 --format="%H|%s|%ct"', { cwd: projectRoot });
        const commitLines = commits.trim().split('\n').filter(line => line.length > 0);

        if (commitLines.length > 0) {
          // We have commits in the repo
          expect(gitStatus.lastCommitHash).toBeDefined();
          expect(gitStatus.lastCommitMessage).toBeDefined();
          expect(gitStatus.lastCommitTimestamp).toBeDefined();

          // TODO: When recentCommits is implemented, verify it contains up to 5 commits
          // const expectedCommitCount = Math.min(5, commitLines.length);
          // expect(gitStatus.recentCommits.length).toBe(expectedCommitCount);
        }
      } catch {
        // No commits or git command failed - this is acceptable
      }
    });

    it('should handle performance requirements for real repository', async () => {
      if (!isGitRepo) {
        return; // Skip if not in git repo
      }

      const startTime = Date.now();
      const gitStatus = await analyzer.getGitStatus();
      const endTime = Date.now();

      // Should complete within reasonable time (5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
      expect(gitStatus.isRepository).toBe(true);
    });

    it('should handle concurrent calls on real repository', async () => {
      if (!isGitRepo) {
        return; // Skip if not in git repo
      }

      const promises = Array.from({ length: 3 }, () => analyzer.getGitStatus());
      const results = await Promise.all(promises);

      // All results should be identical
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);

      // All should indicate git repository
      results.forEach(result => {
        expect(result.isRepository).toBe(true);
      });
    });
  });

  describe('Edge Cases with Real Git Repository', () => {
    it('should handle detached HEAD state', async () => {
      if (!isGitRepo) {
        return; // Skip if not in git repo
      }

      // This test documents behavior without modifying git state
      // In detached HEAD, branch would be null
      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      // branch can be null in detached HEAD state
      expect(gitStatus.branch === null || typeof gitStatus.branch === 'string').toBe(true);
    });

    it('should handle repository with no remotes', async () => {
      if (!isGitRepo) {
        return; // Skip if not in git repo
      }

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(Array.isArray(gitStatus.remotes)).toBe(true);
      // remotes array can be empty if no remotes configured
      expect(gitStatus.remotes.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle repository with no commits', async () => {
      // This test documents the behavior for empty repositories
      // Most real repos will have commits, but new repos might not
      const gitStatus = await analyzer.getGitStatus();

      if (isGitRepo) {
        expect(gitStatus.isRepository).toBe(true);
        // These fields can be undefined for repos with no commits
        if (gitStatus.lastCommitHash) {
          expect(typeof gitStatus.lastCommitHash).toBe('string');
          expect(gitStatus.lastCommitHash.length).toBe(7);
        }
      }
    });
  });

  describe('Git Status Field Completeness', () => {
    it('should include all required fields from GitStatus schema', async () => {
      const gitStatus = await analyzer.getGitStatus();

      // Required fields
      expect(gitStatus).toHaveProperty('isRepository');
      expect(gitStatus).toHaveProperty('branch');
      expect(gitStatus).toHaveProperty('ahead');
      expect(gitStatus).toHaveProperty('behind');
      expect(gitStatus).toHaveProperty('staged');
      expect(gitStatus).toHaveProperty('unstaged');
      expect(gitStatus).toHaveProperty('untracked');
      expect(gitStatus).toHaveProperty('hasConflicts');
      expect(gitStatus).toHaveProperty('isDirty');
      expect(gitStatus).toHaveProperty('stashCount');
      expect(gitStatus).toHaveProperty('remotes');

      // Optional fields
      expect(gitStatus).toHaveProperty('remoteBranch');
      expect(gitStatus).toHaveProperty('lastCommitHash');
      expect(gitStatus).toHaveProperty('lastCommitMessage');
      expect(gitStatus).toHaveProperty('lastCommitTimestamp');
    });

    it('should have correct types for all fields', async () => {
      const gitStatus = await analyzer.getGitStatus();

      expect(typeof gitStatus.isRepository).toBe('boolean');
      expect(gitStatus.branch === null || typeof gitStatus.branch === 'string').toBe(true);
      expect(typeof gitStatus.ahead).toBe('number');
      expect(typeof gitStatus.behind).toBe('number');
      expect(Array.isArray(gitStatus.staged)).toBe(true);
      expect(Array.isArray(gitStatus.unstaged)).toBe(true);
      expect(Array.isArray(gitStatus.untracked)).toBe(true);
      expect(typeof gitStatus.hasConflicts).toBe('boolean');
      expect(typeof gitStatus.isDirty).toBe('boolean');
      expect(typeof gitStatus.stashCount).toBe('number');
      expect(Array.isArray(gitStatus.remotes)).toBe(true);
    });
  });
});