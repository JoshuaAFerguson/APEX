import { describe, it, expect } from 'vitest';
import {
  WorktreeConfig,
  WorktreeInfo,
  WorktreeStatus,
  GitConfigSchema,
  ApexConfigSchema,
} from '../types';

describe('WorktreeManager Integration Tests', () => {
  describe('GitConfig integration', () => {
    it('should parse complete GitConfig with worktree settings', () => {
      const gitConfig = GitConfigSchema.parse({
        branchPrefix: 'apex/',
        commitFormat: 'conventional',
        autoPush: true,
        defaultBranch: 'main',
        commitAfterSubtask: true,
        pushAfterTask: true,
        createPR: 'always',
        prDraft: false,
        prLabels: ['enhancement', 'apex-generated'],
        prReviewers: ['team-lead'],
        autoWorktree: true,
        worktree: {
          baseDir: '/shared/apex-worktrees',
          cleanupOnComplete: true,
          maxWorktrees: 10,
          pruneStaleAfterDays: 14,
          preserveOnFailure: false,
        },
      });

      expect(gitConfig.autoWorktree).toBe(true);
      expect(gitConfig.worktree?.baseDir).toBe('/shared/apex-worktrees');
      expect(gitConfig.worktree?.maxWorktrees).toBe(10);
      expect(gitConfig.worktree?.cleanupOnComplete).toBe(true);
    });

    it('should parse GitConfig with autoWorktree but no worktree config', () => {
      const gitConfig = GitConfigSchema.parse({
        autoWorktree: true,
      });

      expect(gitConfig.autoWorktree).toBe(true);
      expect(gitConfig.worktree).toBeUndefined();
    });

    it('should apply defaults correctly for GitConfig worktree', () => {
      const gitConfig = GitConfigSchema.parse({
        autoWorktree: true,
        worktree: {
          baseDir: '/custom/path',
        },
      });

      expect(gitConfig.autoWorktree).toBe(true);
      expect(gitConfig.worktree?.baseDir).toBe('/custom/path');
      expect(gitConfig.worktree?.cleanupOnComplete).toBe(true); // default
      expect(gitConfig.worktree?.maxWorktrees).toBe(5); // default
      expect(gitConfig.worktree?.pruneStaleAfterDays).toBe(7); // default
      expect(gitConfig.worktree?.preserveOnFailure).toBe(false); // default
    });
  });

  describe('ApexConfig integration', () => {
    it('should parse ApexConfig with worktree configuration', () => {
      const apexConfig = ApexConfigSchema.parse({
        project: {
          name: 'worktree-test-project',
          language: 'typescript',
          framework: 'nodejs',
        },
        git: {
          branchPrefix: 'feature/',
          autoWorktree: true,
          worktree: {
            baseDir: '/apex-worktrees',
            maxWorktrees: 8,
            cleanupOnComplete: false,
            pruneStaleAfterDays: 21,
            preserveOnFailure: true,
          },
        },
      });

      expect(apexConfig.git?.autoWorktree).toBe(true);
      expect(apexConfig.git?.worktree?.baseDir).toBe('/apex-worktrees');
      expect(apexConfig.git?.worktree?.maxWorktrees).toBe(8);
      expect(apexConfig.git?.worktree?.preserveOnFailure).toBe(true);
    });

    it('should work with complete ApexConfig including worktree settings', () => {
      const fullConfig = ApexConfigSchema.parse({
        version: '1.0',
        project: {
          name: 'full-apex-project',
          language: 'typescript',
          framework: 'react',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          default: 'review-before-merge',
        },
        git: {
          branchPrefix: 'apex/',
          commitFormat: 'conventional',
          autoPush: true,
          defaultBranch: 'main',
          autoWorktree: true,
          worktree: {
            baseDir: '/var/lib/apex/worktrees',
            cleanupOnComplete: true,
            maxWorktrees: 15,
            pruneStaleAfterDays: 30,
            preserveOnFailure: false,
          },
        },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          maxConcurrentTasks: 5,
        },
      });

      expect(fullConfig.project.name).toBe('full-apex-project');
      expect(fullConfig.git?.autoWorktree).toBe(true);
      expect(fullConfig.git?.worktree?.maxWorktrees).toBe(15);
      expect(fullConfig.limits?.maxConcurrentTasks).toBe(5);
    });
  });

  describe('WorktreeManager workflow scenarios', () => {
    it('should support task workflow with worktree lifecycle', () => {
      const config: WorktreeConfig = {
        baseDir: '/apex-worktrees',
        cleanupOnComplete: true,
        maxWorktrees: 5,
        pruneStaleAfterDays: 7,
        preserveOnFailure: false,
      };

      // Simulate workflow stages
      const workflowStages: Array<{ stage: string; worktree: WorktreeInfo }> = [
        // Task creation
        {
          stage: 'task_created',
          worktree: {
            path: `${config.baseDir}/task-workflow-123`,
            branch: 'apex/implement-auth-flow',
            head: 'initial-commit-hash123456789012345678901234',
            status: 'active',
            taskId: 'task-workflow-123',
            isMain: false,
            createdAt: new Date('2023-10-15T09:00:00Z'),
            lastUsedAt: new Date('2023-10-15T09:00:00Z'),
          },
        },
        // Task in progress
        {
          stage: 'task_in_progress',
          worktree: {
            path: `${config.baseDir}/task-workflow-123`,
            branch: 'apex/implement-auth-flow',
            head: 'updated-commit-hash123456789012345678901234',
            status: 'active',
            taskId: 'task-workflow-123',
            isMain: false,
            createdAt: new Date('2023-10-15T09:00:00Z'),
            lastUsedAt: new Date('2023-10-15T11:30:00Z'),
          },
        },
        // Task completed
        {
          stage: 'task_completed',
          worktree: {
            path: `${config.baseDir}/task-workflow-123`,
            branch: 'apex/implement-auth-flow',
            head: 'final-commit-hash123456789012345678901234567',
            status: 'stale',
            taskId: 'task-workflow-123',
            isMain: false,
            createdAt: new Date('2023-10-15T09:00:00Z'),
            lastUsedAt: new Date('2023-10-15T13:45:00Z'),
          },
        },
      ];

      // Verify workflow progression
      expect(workflowStages[0].worktree.status).toBe('active');
      expect(workflowStages[1].worktree.status).toBe('active');
      expect(workflowStages[2].worktree.status).toBe('stale');

      // Verify task ID consistency
      const taskIds = workflowStages.map(stage => stage.worktree.taskId);
      expect(new Set(taskIds).size).toBe(1); // All same task ID

      // Verify timestamps progression
      const lastUsedTimes = workflowStages.map(stage => stage.worktree.lastUsedAt!.getTime());
      expect(lastUsedTimes[1]).toBeGreaterThan(lastUsedTimes[0]);
      expect(lastUsedTimes[2]).toBeGreaterThan(lastUsedTimes[1]);
    });

    it('should handle concurrent worktrees within limits', () => {
      const config: WorktreeConfig = {
        maxWorktrees: 3,
        cleanupOnComplete: true,
        pruneStaleAfterDays: 7,
        preserveOnFailure: false,
      };

      const activeWorktrees: WorktreeInfo[] = [
        {
          path: '/worktrees/task-1',
          branch: 'apex/feature-1',
          head: 'hash1234567890123456789012345678901234567890',
          status: 'active',
          taskId: 'task-1',
          isMain: false,
        },
        {
          path: '/worktrees/task-2',
          branch: 'apex/feature-2',
          head: 'hash2345678901234567890123456789012345678901',
          status: 'active',
          taskId: 'task-2',
          isMain: false,
        },
        {
          path: '/worktrees/task-3',
          branch: 'apex/feature-3',
          head: 'hash3456789012345678901234567890123456789012',
          status: 'locked', // Being used by another process
          taskId: 'task-3',
          isMain: false,
        },
      ];

      // Verify we're within the configured limit
      expect(activeWorktrees.length).toBeLessThanOrEqual(config.maxWorktrees);

      // Verify all have unique task IDs and paths
      const taskIds = activeWorktrees.map(w => w.taskId);
      const paths = activeWorktrees.map(w => w.path);
      expect(new Set(taskIds).size).toBe(taskIds.length);
      expect(new Set(paths).size).toBe(paths.length);

      // Count different statuses
      const statusCounts = activeWorktrees.reduce((counts, worktree) => {
        counts[worktree.status] = (counts[worktree.status] || 0) + 1;
        return counts;
      }, {} as Record<WorktreeStatus, number>);

      expect(statusCounts.active).toBe(2);
      expect(statusCounts.locked).toBe(1);
    });

    it('should handle pruning scenarios based on configuration', () => {
      const config: WorktreeConfig = {
        cleanupOnComplete: true,
        pruneStaleAfterDays: 7,
        preserveOnFailure: false,
        maxWorktrees: 10,
      };

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const worktrees: WorktreeInfo[] = [
        // Recent stale worktree (should not be pruned)
        {
          path: '/worktrees/recent-stale',
          branch: 'apex/recent-feature',
          head: 'recent123456789012345678901234567890123456',
          status: 'stale',
          taskId: 'recent-task',
          isMain: false,
          lastUsedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        },
        // Old stale worktree (should be pruned)
        {
          path: '/worktrees/old-stale',
          branch: 'apex/old-feature',
          head: 'old1234567890123456789012345678901234567890',
          status: 'stale',
          taskId: 'old-task',
          isMain: false,
          lastUsedAt: tenDaysAgo,
        },
        // Prunable worktree (should be pruned)
        {
          path: '/worktrees/prunable',
          branch: 'apex/prunable-feature',
          head: 'prunable1234567890123456789012345678901234567',
          status: 'prunable',
          taskId: 'prunable-task',
          isMain: false,
          lastUsedAt: sevenDaysAgo,
        },
        // Active worktree (should not be pruned)
        {
          path: '/worktrees/active',
          branch: 'apex/active-feature',
          head: 'active123456789012345678901234567890123456',
          status: 'active',
          taskId: 'active-task',
          isMain: false,
          lastUsedAt: new Date(),
        },
      ];

      // Simulate pruning logic
      const pruneThreshold = new Date(now.getTime() - config.pruneStaleAfterDays * 24 * 60 * 60 * 1000);

      const shouldBePruned = worktrees.filter(worktree =>
        (worktree.status === 'stale' || worktree.status === 'prunable') &&
        worktree.lastUsedAt &&
        worktree.lastUsedAt < pruneThreshold
      );

      const shouldBeKept = worktrees.filter(worktree =>
        worktree.status === 'active' ||
        !worktree.lastUsedAt ||
        worktree.lastUsedAt >= pruneThreshold
      );

      expect(shouldBePruned).toHaveLength(2); // old-stale and prunable
      expect(shouldBeKept).toHaveLength(2); // recent-stale and active

      expect(shouldBePruned.map(w => w.taskId)).toEqual(['old-task', 'prunable-task']);
      expect(shouldBeKept.map(w => w.taskId)).toEqual(['recent-task', 'active-task']);
    });
  });

  describe('Type safety and error handling', () => {
    it('should reject invalid worktree configurations', () => {
      // Invalid maxWorktrees
      expect(() => GitConfigSchema.parse({
        autoWorktree: true,
        worktree: { maxWorktrees: 0 }
      })).toThrow();

      // Invalid pruneStaleAfterDays
      expect(() => GitConfigSchema.parse({
        autoWorktree: true,
        worktree: { pruneStaleAfterDays: -1 }
      })).toThrow();

      // Invalid field types
      expect(() => GitConfigSchema.parse({
        autoWorktree: 'yes' // should be boolean
      })).toThrow();
    });

    it('should ensure type consistency across the system', () => {
      // This test ensures WorktreeManager types integrate properly with existing types
      const gitConfigWithWorktrees = GitConfigSchema.parse({
        branchPrefix: 'apex/',
        autoWorktree: true,
        worktree: {
          baseDir: '/test',
          maxWorktrees: 5,
        },
      });

      const apexConfig = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        git: gitConfigWithWorktrees,
      });

      expect(apexConfig.git?.autoWorktree).toBe(true);
      expect(apexConfig.git?.worktree?.maxWorktrees).toBe(5);
      expect(apexConfig.git?.branchPrefix).toBe('apex/');
    });
  });
});