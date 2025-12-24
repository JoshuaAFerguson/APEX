import { describe, it, expect } from 'vitest';
import {
  WorktreeStatusSchema,
  WorktreeConfigSchema,
  WorktreeInfo,
  WorktreeStatus,
  WorktreeConfig,
  GitConfigSchema,
} from '../types';

describe('WorktreeStatusSchema', () => {
  it('should accept valid worktree status values', () => {
    const validStatuses: WorktreeStatus[] = ['active', 'stale', 'locked', 'prunable'];

    for (const status of validStatuses) {
      expect(WorktreeStatusSchema.parse(status)).toBe(status);
    }
  });

  it('should reject invalid worktree status values', () => {
    const invalidStatuses = ['unknown', 'pending', 'ready', ''];

    for (const status of invalidStatuses) {
      expect(() => WorktreeStatusSchema.parse(status)).toThrow();
    }
  });

  it('should be used correctly in TypeScript type checking', () => {
    const status: WorktreeStatus = 'active';
    expect(['active', 'stale', 'locked', 'prunable']).toContain(status);
  });
});

describe('WorktreeConfigSchema', () => {
  it('should parse empty config with all defaults', () => {
    const config = WorktreeConfigSchema.parse({});

    expect(config.baseDir).toBeUndefined();
    expect(config.cleanupOnComplete).toBe(true);
    expect(config.maxWorktrees).toBe(5);
    expect(config.pruneStaleAfterDays).toBe(7);
    expect(config.preserveOnFailure).toBe(false);
  });

  it('should parse config with custom values', () => {
    const config = WorktreeConfigSchema.parse({
      baseDir: '/custom/worktrees/path',
      cleanupOnComplete: false,
      maxWorktrees: 10,
      pruneStaleAfterDays: 14,
      preserveOnFailure: true,
    });

    expect(config.baseDir).toBe('/custom/worktrees/path');
    expect(config.cleanupOnComplete).toBe(false);
    expect(config.maxWorktrees).toBe(10);
    expect(config.pruneStaleAfterDays).toBe(14);
    expect(config.preserveOnFailure).toBe(true);
  });

  it('should apply defaults for missing optional fields', () => {
    const config = WorktreeConfigSchema.parse({
      maxWorktrees: 8,
    });

    expect(config.baseDir).toBeUndefined();
    expect(config.cleanupOnComplete).toBe(true); // default
    expect(config.maxWorktrees).toBe(8);
    expect(config.pruneStaleAfterDays).toBe(7); // default
    expect(config.preserveOnFailure).toBe(false); // default
  });

  it('should validate maxWorktrees minimum value', () => {
    // Valid values (>= 1)
    expect(() => WorktreeConfigSchema.parse({ maxWorktrees: 1 })).not.toThrow();
    expect(() => WorktreeConfigSchema.parse({ maxWorktrees: 5 })).not.toThrow();
    expect(() => WorktreeConfigSchema.parse({ maxWorktrees: 100 })).not.toThrow();

    // Invalid values (< 1)
    expect(() => WorktreeConfigSchema.parse({ maxWorktrees: 0 })).toThrow();
    expect(() => WorktreeConfigSchema.parse({ maxWorktrees: -1 })).toThrow();
  });

  it('should validate pruneStaleAfterDays minimum value', () => {
    // Valid values (>= 1)
    expect(() => WorktreeConfigSchema.parse({ pruneStaleAfterDays: 1 })).not.toThrow();
    expect(() => WorktreeConfigSchema.parse({ pruneStaleAfterDays: 7 })).not.toThrow();
    expect(() => WorktreeConfigSchema.parse({ pruneStaleAfterDays: 365 })).not.toThrow();

    // Invalid values (< 1)
    expect(() => WorktreeConfigSchema.parse({ pruneStaleAfterDays: 0 })).toThrow();
    expect(() => WorktreeConfigSchema.parse({ pruneStaleAfterDays: -5 })).toThrow();
  });

  it('should reject invalid field types', () => {
    const invalidConfigs = [
      { baseDir: 123 },
      { cleanupOnComplete: 'true' },
      { maxWorktrees: '5' },
      { pruneStaleAfterDays: 'week' },
      { preserveOnFailure: 1 },
    ];

    for (const invalidConfig of invalidConfigs) {
      expect(() => WorktreeConfigSchema.parse(invalidConfig)).toThrow();
    }
  });

  it('should handle realistic configuration scenarios', () => {
    // Small team configuration
    const smallTeamConfig = WorktreeConfigSchema.parse({
      baseDir: '/home/shared/apex-worktrees',
      cleanupOnComplete: true,
      maxWorktrees: 3,
      pruneStaleAfterDays: 3,
      preserveOnFailure: false,
    });

    expect(smallTeamConfig.maxWorktrees).toBe(3);
    expect(smallTeamConfig.pruneStaleAfterDays).toBe(3);

    // Large team configuration
    const largeTeamConfig = WorktreeConfigSchema.parse({
      baseDir: '/var/lib/apex/worktrees',
      cleanupOnComplete: false,
      maxWorktrees: 20,
      pruneStaleAfterDays: 30,
      preserveOnFailure: true,
    });

    expect(largeTeamConfig.maxWorktrees).toBe(20);
    expect(largeTeamConfig.pruneStaleAfterDays).toBe(30);
    expect(largeTeamConfig.preserveOnFailure).toBe(true);
  });
});

describe('WorktreeInfo interface', () => {
  it('should create valid WorktreeInfo objects', () => {
    const worktreeInfo: WorktreeInfo = {
      path: '/home/user/project/.apex-worktrees/task-123',
      branch: 'apex/feature-abc',
      head: 'a1b2c3d4e5f6789012345678901234567890abcd',
      status: 'active',
      taskId: 'task-123',
      isMain: false,
      createdAt: new Date('2023-10-15T10:30:00Z'),
      lastUsedAt: new Date('2023-10-15T12:15:00Z'),
    };

    expect(worktreeInfo.path).toContain('task-123');
    expect(worktreeInfo.branch).toBe('apex/feature-abc');
    expect(worktreeInfo.head).toHaveLength(40); // SHA-1 hash length
    expect(['active', 'stale', 'locked', 'prunable']).toContain(worktreeInfo.status);
    expect(worktreeInfo.taskId).toBe('task-123');
    expect(worktreeInfo.isMain).toBe(false);
    expect(worktreeInfo.createdAt).toBeInstanceOf(Date);
    expect(worktreeInfo.lastUsedAt).toBeInstanceOf(Date);
  });

  it('should handle main worktree scenario', () => {
    const mainWorktree: WorktreeInfo = {
      path: '/home/user/project',
      branch: 'main',
      head: 'f1e2d3c4b5a6789012345678901234567890fedc',
      status: 'active',
      isMain: true,
    };

    expect(mainWorktree.isMain).toBe(true);
    expect(mainWorktree.taskId).toBeUndefined();
    expect(mainWorktree.createdAt).toBeUndefined();
    expect(mainWorktree.lastUsedAt).toBeUndefined();
  });

  it('should handle different worktree statuses', () => {
    const statuses: WorktreeStatus[] = ['active', 'stale', 'locked', 'prunable'];

    for (const status of statuses) {
      const worktree: WorktreeInfo = {
        path: `/worktrees/${status}-worktree`,
        branch: `branch-${status}`,
        head: '1234567890123456789012345678901234567890',
        status,
        isMain: false,
      };

      expect(worktree.status).toBe(status);
    }
  });

  it('should handle optional fields correctly', () => {
    // Minimal required fields only
    const minimalWorktree: WorktreeInfo = {
      path: '/minimal/worktree',
      branch: 'minimal-branch',
      head: '0000111122223333444455556666777788889999',
      status: 'stale',
      isMain: false,
    };

    expect(minimalWorktree.taskId).toBeUndefined();
    expect(minimalWorktree.createdAt).toBeUndefined();
    expect(minimalWorktree.lastUsedAt).toBeUndefined();

    // With all optional fields
    const completeWorktree: WorktreeInfo = {
      path: '/complete/worktree',
      branch: 'complete-branch',
      head: 'aaabbbbccccddddeeeeffffgggghhhhiiiijjjj',
      status: 'locked',
      taskId: 'complete-task-456',
      isMain: false,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    expect(completeWorktree.taskId).toBeDefined();
    expect(completeWorktree.createdAt).toBeDefined();
    expect(completeWorktree.lastUsedAt).toBeDefined();
  });

  it('should support realistic worktree scenarios', () => {
    // Active task worktree
    const activeTaskWorktree: WorktreeInfo = {
      path: '/apex-worktrees/task-789',
      branch: 'apex/fix-authentication-bug',
      head: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4',
      status: 'active',
      taskId: 'task-789',
      isMain: false,
      createdAt: new Date('2023-10-15T09:00:00Z'),
      lastUsedAt: new Date('2023-10-15T14:30:00Z'),
    };

    expect(activeTaskWorktree.status).toBe('active');
    expect(activeTaskWorktree.taskId).toBe('task-789');

    // Stale worktree (task completed but not cleaned up)
    const staleWorktree: WorktreeInfo = {
      path: '/apex-worktrees/task-456',
      branch: 'apex/old-feature',
      head: 'b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0',
      status: 'stale',
      taskId: 'task-456',
      isMain: false,
      createdAt: new Date('2023-10-10T10:00:00Z'),
      lastUsedAt: new Date('2023-10-12T16:00:00Z'),
    };

    expect(staleWorktree.status).toBe('stale');
    expect(staleWorktree.lastUsedAt! < new Date()).toBe(true);
  });
});

describe('GitConfigSchema worktree integration', () => {
  it('should parse GitConfig with autoWorktree disabled by default', () => {
    const gitConfig = GitConfigSchema.parse({});

    expect(gitConfig.autoWorktree).toBe(false);
    expect(gitConfig.worktree).toBeUndefined();
  });

  it('should parse GitConfig with autoWorktree enabled', () => {
    const gitConfig = GitConfigSchema.parse({
      autoWorktree: true,
    });

    expect(gitConfig.autoWorktree).toBe(true);
    expect(gitConfig.worktree).toBeUndefined(); // still optional
  });

  it('should parse GitConfig with worktree configuration', () => {
    const gitConfig = GitConfigSchema.parse({
      autoWorktree: true,
      worktree: {
        baseDir: '/custom/worktrees',
        maxWorktrees: 8,
        cleanupOnComplete: false,
        pruneStaleAfterDays: 14,
        preserveOnFailure: true,
      },
    });

    expect(gitConfig.autoWorktree).toBe(true);
    expect(gitConfig.worktree).toBeDefined();
    expect(gitConfig.worktree?.baseDir).toBe('/custom/worktrees');
    expect(gitConfig.worktree?.maxWorktrees).toBe(8);
    expect(gitConfig.worktree?.cleanupOnComplete).toBe(false);
    expect(gitConfig.worktree?.pruneStaleAfterDays).toBe(14);
    expect(gitConfig.worktree?.preserveOnFailure).toBe(true);
  });

  it('should parse GitConfig with worktree defaults', () => {
    const gitConfig = GitConfigSchema.parse({
      autoWorktree: true,
      worktree: {},
    });

    expect(gitConfig.autoWorktree).toBe(true);
    expect(gitConfig.worktree?.baseDir).toBeUndefined();
    expect(gitConfig.worktree?.cleanupOnComplete).toBe(true);
    expect(gitConfig.worktree?.maxWorktrees).toBe(5);
    expect(gitConfig.worktree?.pruneStaleAfterDays).toBe(7);
    expect(gitConfig.worktree?.preserveOnFailure).toBe(false);
  });

  it('should handle complete GitConfig with existing and new fields', () => {
    const gitConfig = GitConfigSchema.parse({
      branchPrefix: 'feature/',
      commitFormat: 'conventional',
      autoPush: true,
      defaultBranch: 'develop',
      commitAfterSubtask: true,
      pushAfterTask: true,
      createPR: 'always',
      prDraft: false,
      prLabels: ['enhancement', 'needs-review'],
      prReviewers: ['lead-dev', 'tech-lead'],
      autoWorktree: true,
      worktree: {
        baseDir: '/shared/apex-worktrees',
        maxWorktrees: 10,
        cleanupOnComplete: true,
        pruneStaleAfterDays: 5,
        preserveOnFailure: false,
      },
    });

    // Verify existing fields work
    expect(gitConfig.branchPrefix).toBe('feature/');
    expect(gitConfig.commitFormat).toBe('conventional');
    expect(gitConfig.autoPush).toBe(true);
    expect(gitConfig.defaultBranch).toBe('develop');
    expect(gitConfig.prLabels).toEqual(['enhancement', 'needs-review']);

    // Verify new worktree fields work
    expect(gitConfig.autoWorktree).toBe(true);
    expect(gitConfig.worktree?.baseDir).toBe('/shared/apex-worktrees');
    expect(gitConfig.worktree?.maxWorktrees).toBe(10);
    expect(gitConfig.worktree?.cleanupOnComplete).toBe(true);
  });

  it('should reject invalid worktree configuration in GitConfig', () => {
    expect(() => {
      GitConfigSchema.parse({
        autoWorktree: true,
        worktree: {
          maxWorktrees: 0, // Invalid: should be >= 1
        },
      });
    }).toThrow();

    expect(() => {
      GitConfigSchema.parse({
        autoWorktree: true,
        worktree: {
          pruneStaleAfterDays: -1, // Invalid: should be >= 1
        },
      });
    }).toThrow();

    expect(() => {
      GitConfigSchema.parse({
        autoWorktree: 'yes', // Invalid: should be boolean
      });
    }).toThrow();
  });
});

describe('WorktreeConfig type safety and validation', () => {
  it('should enforce type safety for WorktreeConfig properties', () => {
    const config: WorktreeConfig = {
      baseDir: '/test/worktrees',
      cleanupOnComplete: true,
      maxWorktrees: 5,
      pruneStaleAfterDays: 7,
      preserveOnFailure: false,
    };

    expect(typeof config.baseDir).toBe('string');
    expect(typeof config.cleanupOnComplete).toBe('boolean');
    expect(typeof config.maxWorktrees).toBe('number');
    expect(typeof config.pruneStaleAfterDays).toBe('number');
    expect(typeof config.preserveOnFailure).toBe('boolean');
  });

  it('should enforce type safety for WorktreeStatus enum', () => {
    const statuses: WorktreeStatus[] = ['active', 'stale', 'locked', 'prunable'];

    for (const status of statuses) {
      expect(typeof status).toBe('string');
      expect(['active', 'stale', 'locked', 'prunable']).toContain(status);
    }
  });

  it('should work correctly with arrays and filtering', () => {
    const worktrees: WorktreeInfo[] = [
      {
        path: '/worktree1',
        branch: 'branch1',
        head: 'hash1',
        status: 'active',
        isMain: false,
        taskId: 'task1',
      },
      {
        path: '/worktree2',
        branch: 'branch2',
        head: 'hash2',
        status: 'stale',
        isMain: false,
        taskId: 'task2',
      },
      {
        path: '/worktree3',
        branch: 'main',
        head: 'hash3',
        status: 'active',
        isMain: true,
      },
    ];

    // Filter active worktrees
    const activeWorktrees = worktrees.filter(w => w.status === 'active');
    expect(activeWorktrees).toHaveLength(2);

    // Filter task worktrees (non-main)
    const taskWorktrees = worktrees.filter(w => !w.isMain && w.taskId);
    expect(taskWorktrees).toHaveLength(2);

    // Map to paths
    const paths = worktrees.map(w => w.path);
    expect(paths).toEqual(['/worktree1', '/worktree2', '/worktree3']);
  });

  it('should handle edge case values correctly', () => {
    // Edge case: minimal valid configuration
    const minConfig = WorktreeConfigSchema.parse({
      maxWorktrees: 1,
      pruneStaleAfterDays: 1,
    });

    expect(minConfig.maxWorktrees).toBe(1);
    expect(minConfig.pruneStaleAfterDays).toBe(1);

    // Edge case: very large values
    const maxConfig = WorktreeConfigSchema.parse({
      maxWorktrees: 1000,
      pruneStaleAfterDays: 365,
    });

    expect(maxConfig.maxWorktrees).toBe(1000);
    expect(maxConfig.pruneStaleAfterDays).toBe(365);
  });
});

describe('WorktreeManager integration scenarios', () => {
  it('should support complete worktree lifecycle scenarios', () => {
    // Scenario: Task starts, creates worktree, completes, cleans up
    const config: WorktreeConfig = {
      baseDir: '/apex-worktrees',
      cleanupOnComplete: true,
      maxWorktrees: 5,
      pruneStaleAfterDays: 7,
      preserveOnFailure: false,
    };

    // Task worktree created
    const taskWorktree: WorktreeInfo = {
      path: `${config.baseDir}/task-abc123`,
      branch: 'apex/implement-feature-x',
      head: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
      status: 'active',
      taskId: 'task-abc123',
      isMain: false,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    expect(taskWorktree.status).toBe('active');
    expect(taskWorktree.path).toContain('task-abc123');

    // Task completes, worktree becomes stale
    const staleWorktree: WorktreeInfo = {
      ...taskWorktree,
      status: 'stale',
      lastUsedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
    };

    expect(staleWorktree.status).toBe('stale');

    // Cleanup check - should be pruned (older than 7 days)
    const shouldBePruned = staleWorktree.lastUsedAt! <
      new Date(Date.now() - config.pruneStaleAfterDays * 24 * 60 * 60 * 1000);
    expect(shouldBePruned).toBe(true);
  });

  it('should handle multiple concurrent worktrees', () => {
    const config: WorktreeConfig = {
      maxWorktrees: 3,
      cleanupOnComplete: true,
      pruneStaleAfterDays: 7,
      preserveOnFailure: false,
    };

    const worktrees: WorktreeInfo[] = [
      {
        path: '/worktrees/task-1',
        branch: 'apex/task-1',
        head: 'hash1',
        status: 'active',
        taskId: 'task-1',
        isMain: false,
      },
      {
        path: '/worktrees/task-2',
        branch: 'apex/task-2',
        head: 'hash2',
        status: 'active',
        taskId: 'task-2',
        isMain: false,
      },
      {
        path: '/worktrees/task-3',
        branch: 'apex/task-3',
        head: 'hash3',
        status: 'locked',
        taskId: 'task-3',
        isMain: false,
      },
    ];

    const activeCount = worktrees.filter(w => w.status === 'active').length;
    expect(activeCount).toBe(2);
    expect(worktrees.length).toBeLessThanOrEqual(config.maxWorktrees);
  });

  it('should handle failure preservation scenario', () => {
    const config: WorktreeConfig = {
      cleanupOnComplete: true,
      preserveOnFailure: true,
      maxWorktrees: 5,
      pruneStaleAfterDays: 7,
    };

    // Failed task worktree (would normally be cleaned up but preserved due to failure)
    const failedTaskWorktree: WorktreeInfo = {
      path: '/apex-worktrees/failed-task-xyz',
      branch: 'apex/failed-feature',
      head: 'failurehash1234567890123456789012345678',
      status: 'stale', // Changed to stale after failure but preserved for debugging
      taskId: 'failed-task-xyz',
      isMain: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      lastUsedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    };

    // Even though config has preserveOnFailure: true, the worktree status
    // indicates it's stale and should be preserved for debugging
    expect(config.preserveOnFailure).toBe(true);
    expect(failedTaskWorktree.status).toBe('stale');
    expect(failedTaskWorktree.taskId).toBe('failed-task-xyz');
  });
});