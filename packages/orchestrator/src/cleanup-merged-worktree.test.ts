import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import { WorktreeManager } from './worktree-manager';
import type { Task, WorktreeInfo } from '@apexcli/core';

/**
 * Test suite for ApexOrchestrator.cleanupMergedWorktree method
 *
 * Validates the acceptance criteria:
 * - cleanupMergedWorktree(taskId) method verifies PR is merged
 * - deletes worktree via worktreeManager.deleteWorktree()
 * - emits worktree:merge-cleaned event with taskId, worktreePath, and prUrl
 * - Logs cleanup action to task logs
 */
describe('ApexOrchestrator.cleanupMergedWorktree', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let mockTask: Task;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task for worktree cleanup',
    workflow: 'feature',
    autonomy: 'full',
    status: 'completed',
    priority: 'normal',
    effort: 'medium',
    projectPath: testDir,
    branchName: 'apex/test-branch',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    prUrl: 'https://github.com/test/repo/pull/123',
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
    ...overrides,
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-cleanup-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create basic config file
    const config = {
      project: { name: 'test-project' },
      git: { autoWorktree: true, branchPrefix: 'apex/' },
      limits: { maxConcurrentTasks: 2 },
      autonomy: { default: 'full' }
    };
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `project:\n  name: test-project\ngit:\n  autoWorktree: true\n  branchPrefix: apex/`
    );

    // Create workflows directory with feature workflow
    await fs.mkdir(path.join(testDir, '.apex', 'workflows'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'feature.yaml'),
      `name: feature\ndescription: Feature workflow\nstages:\n  - name: implementation\n    agent: developer\n`
    );

    // Create agents directory with developer agent
    await fs.mkdir(path.join(testDir, '.apex', 'agents'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      '# Developer Agent\nYou implement features.\n'
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
    store = new TaskStore(testDir);
    await store.initialize();

    mockTask = createTestTask();
    await store.createTask(mockTask);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Basic Functionality', () => {
    it('should throw error when worktree management is not enabled', async () => {
      // Create orchestrator without worktree management
      const noWorktreeOrchestrator = new ApexOrchestrator({ projectPath: testDir });

      // Mock the config to disable worktree management
      vi.spyOn(noWorktreeOrchestrator as any, 'effectiveConfig', 'get').mockReturnValue({
        git: { autoWorktree: false }
      });

      await expect(noWorktreeOrchestrator.cleanupMergedWorktree(mockTask.id))
        .rejects.toThrow('Worktree management is not enabled');
    });

    it('should throw error when taskId is empty', async () => {
      await expect(orchestrator.cleanupMergedWorktree(''))
        .rejects.toThrow('Task ID is required');
    });

    it('should return false when task is not found', async () => {
      const nonExistentTaskId = 'non-existent-task-id';
      const result = await orchestrator.cleanupMergedWorktree(nonExistentTaskId);

      expect(result).toBe(false);

      // Should log warning about task not found
      const logs = await store.getLogs(nonExistentTaskId);
      expect(logs.some(log =>
        log.level === 'warn' &&
        log.message === 'Cannot cleanup worktree: task not found'
      )).toBe(true);
    });
  });

  describe('PR Merge Verification', () => {
    it('should return false when PR is not merged', async () => {
      // Mock checkPRMerged to return false
      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(false);

      const result = await orchestrator.cleanupMergedWorktree(mockTask.id);

      expect(result).toBe(false);
      expect(orchestrator.checkPRMerged).toHaveBeenCalledWith(mockTask.id);

      // Should log that PR is not merged
      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'info' &&
        log.message === 'PR not merged yet, skipping worktree cleanup'
      )).toBe(true);
    });

    it('should proceed with cleanup when PR is merged', async () => {
      // Mock checkPRMerged to return true
      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(true);

      // Mock worktree manager methods
      const mockWorktreeInfo: WorktreeInfo = {
        path: '/test/worktree/path',
        branch: 'apex/test-branch',
        head: 'abc123',
        status: 'active',
        taskId: mockTask.id,
        isMain: false,
        createdAt: new Date(),
        lastUsedAt: new Date()
      };

      const mockWorktreeManager = {
        getWorktree: vi.fn().mockResolvedValue(mockWorktreeInfo),
        deleteWorktree: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(orchestrator as any, 'worktreeManager', 'get').mockReturnValue(mockWorktreeManager);

      const result = await orchestrator.cleanupMergedWorktree(mockTask.id);

      expect(result).toBe(true);
      expect(mockWorktreeManager.getWorktree).toHaveBeenCalledWith(mockTask.id);
      expect(mockWorktreeManager.deleteWorktree).toHaveBeenCalledWith(mockTask.id);
    });
  });

  describe('Worktree Operations', () => {
    it('should return false when no worktree found for task', async () => {
      // Mock checkPRMerged to return true
      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(true);

      // Mock worktree manager to return null (no worktree)
      const mockWorktreeManager = {
        getWorktree: vi.fn().mockResolvedValue(null),
        deleteWorktree: vi.fn()
      };

      vi.spyOn(orchestrator as any, 'worktreeManager', 'get').mockReturnValue(mockWorktreeManager);

      const result = await orchestrator.cleanupMergedWorktree(mockTask.id);

      expect(result).toBe(false);
      expect(mockWorktreeManager.getWorktree).toHaveBeenCalledWith(mockTask.id);
      expect(mockWorktreeManager.deleteWorktree).not.toHaveBeenCalled();

      // Should log that no worktree found
      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'warn' &&
        log.message === 'No worktree found for task, cleanup not needed'
      )).toBe(true);
    });

    it('should return false when worktree deletion fails', async () => {
      // Mock checkPRMerged to return true
      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(true);

      const mockWorktreeInfo: WorktreeInfo = {
        path: '/test/worktree/path',
        branch: 'apex/test-branch',
        head: 'abc123',
        status: 'active',
        taskId: mockTask.id,
        isMain: false,
        createdAt: new Date(),
        lastUsedAt: new Date()
      };

      // Mock worktree manager where deletion fails
      const mockWorktreeManager = {
        getWorktree: vi.fn().mockResolvedValue(mockWorktreeInfo),
        deleteWorktree: vi.fn().mockResolvedValue(false)
      };

      vi.spyOn(orchestrator as any, 'worktreeManager', 'get').mockReturnValue(mockWorktreeManager);

      const result = await orchestrator.cleanupMergedWorktree(mockTask.id);

      expect(result).toBe(false);
      expect(mockWorktreeManager.deleteWorktree).toHaveBeenCalledWith(mockTask.id);

      // Should log warning about deletion failure
      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'warn' &&
        log.message === 'Failed to delete worktree (worktree may not exist)'
      )).toBe(true);
    });

    it('should handle errors during worktree deletion', async () => {
      // Mock checkPRMerged to return true
      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(true);

      const mockWorktreeInfo: WorktreeInfo = {
        path: '/test/worktree/path',
        branch: 'apex/test-branch',
        head: 'abc123',
        status: 'active',
        taskId: mockTask.id,
        isMain: false,
        createdAt: new Date(),
        lastUsedAt: new Date()
      };

      // Mock worktree manager where deletion throws error
      const deletionError = new Error('Worktree deletion failed');
      const mockWorktreeManager = {
        getWorktree: vi.fn().mockResolvedValue(mockWorktreeInfo),
        deleteWorktree: vi.fn().mockRejectedValue(deletionError)
      };

      vi.spyOn(orchestrator as any, 'worktreeManager', 'get').mockReturnValue(mockWorktreeManager);

      const result = await orchestrator.cleanupMergedWorktree(mockTask.id);

      expect(result).toBe(false);

      // Should log error
      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'error' &&
        log.message === 'Error cleaning up worktree after merge: Worktree deletion failed'
      )).toBe(true);
    });
  });

  describe('Event Emission', () => {
    it('should emit worktree:merge-cleaned event on successful cleanup', async () => {
      // Mock checkPRMerged to return true
      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(true);

      const mockWorktreeInfo: WorktreeInfo = {
        path: '/test/worktree/path',
        branch: 'apex/test-branch',
        head: 'abc123',
        status: 'active',
        taskId: mockTask.id,
        isMain: false,
        createdAt: new Date(),
        lastUsedAt: new Date()
      };

      const mockWorktreeManager = {
        getWorktree: vi.fn().mockResolvedValue(mockWorktreeInfo),
        deleteWorktree: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(orchestrator as any, 'worktreeManager', 'get').mockReturnValue(mockWorktreeManager);

      // Listen for the event
      let eventEmitted = false;
      let eventData: { taskId: string; worktreePath: string; prUrl: string } | null = null;

      orchestrator.on('worktree:merge-cleaned', (taskId, worktreePath, prUrl) => {
        eventEmitted = true;
        eventData = { taskId, worktreePath, prUrl };
      });

      const result = await orchestrator.cleanupMergedWorktree(mockTask.id);

      expect(result).toBe(true);
      expect(eventEmitted).toBe(true);
      expect(eventData).toEqual({
        taskId: mockTask.id,
        worktreePath: '/test/worktree/path',
        prUrl: 'https://github.com/test/repo/pull/123'
      });
    });

    it('should use "unknown" as prUrl when task has no prUrl', async () => {
      // Create task without prUrl
      const taskWithoutPR = createTestTask({ prUrl: undefined });
      await store.createTask(taskWithoutPR);

      // Mock checkPRMerged to return true
      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(true);

      const mockWorktreeInfo: WorktreeInfo = {
        path: '/test/worktree/path',
        branch: 'apex/test-branch',
        head: 'abc123',
        status: 'active',
        taskId: taskWithoutPR.id,
        isMain: false,
        createdAt: new Date(),
        lastUsedAt: new Date()
      };

      const mockWorktreeManager = {
        getWorktree: vi.fn().mockResolvedValue(mockWorktreeInfo),
        deleteWorktree: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(orchestrator as any, 'worktreeManager', 'get').mockReturnValue(mockWorktreeManager);

      // Listen for the event
      let eventData: { taskId: string; worktreePath: string; prUrl: string } | null = null;

      orchestrator.on('worktree:merge-cleaned', (taskId, worktreePath, prUrl) => {
        eventData = { taskId, worktreePath, prUrl };
      });

      const result = await orchestrator.cleanupMergedWorktree(taskWithoutPR.id);

      expect(result).toBe(true);
      expect(eventData?.prUrl).toBe('unknown');
    });
  });

  describe('Logging', () => {
    it('should log successful cleanup action', async () => {
      // Mock checkPRMerged to return true
      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(true);

      const mockWorktreeInfo: WorktreeInfo = {
        path: '/test/worktree/path',
        branch: 'apex/test-branch',
        head: 'abc123',
        status: 'active',
        taskId: mockTask.id,
        isMain: false,
        createdAt: new Date(),
        lastUsedAt: new Date()
      };

      const mockWorktreeManager = {
        getWorktree: vi.fn().mockResolvedValue(mockWorktreeInfo),
        deleteWorktree: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(orchestrator as any, 'worktreeManager', 'get').mockReturnValue(mockWorktreeManager);

      const result = await orchestrator.cleanupMergedWorktree(mockTask.id);

      expect(result).toBe(true);

      // Should log successful cleanup
      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'info' &&
        log.message === 'Cleaned up worktree after merge detected: /test/worktree/path'
      )).toBe(true);
    });

    it('should log all intermediate steps', async () => {
      // Test each log message by going through different scenarios

      // Scenario 1: Task not found
      const nonExistentTaskId = 'non-existent';
      await orchestrator.cleanupMergedWorktree(nonExistentTaskId);

      const logs1 = await store.getLogs(nonExistentTaskId);
      expect(logs1.some(log =>
        log.level === 'warn' &&
        log.message === 'Cannot cleanup worktree: task not found'
      )).toBe(true);

      // Scenario 2: PR not merged
      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(false);
      await orchestrator.cleanupMergedWorktree(mockTask.id);

      const logs2 = await store.getLogs(mockTask.id);
      expect(logs2.some(log =>
        log.level === 'info' &&
        log.message === 'PR not merged yet, skipping worktree cleanup'
      )).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should work end-to-end with real worktree manager when configured', async () => {
      // This test verifies the method works with actual worktree manager integration
      // We can't easily test with a real git repo in unit tests, so we mock the components

      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(true);

      const mockWorktreeInfo: WorktreeInfo = {
        path: '/test/worktree/path',
        branch: 'apex/test-branch',
        head: 'abc123',
        status: 'active',
        taskId: mockTask.id,
        isMain: false,
        createdAt: new Date(),
        lastUsedAt: new Date()
      };

      const realWorktreeManager = new WorktreeManager({
        projectPath: testDir,
        config: { cleanupOnComplete: true }
      });

      vi.spyOn(realWorktreeManager, 'getWorktree').mockResolvedValue(mockWorktreeInfo);
      vi.spyOn(realWorktreeManager, 'deleteWorktree').mockResolvedValue(true);
      vi.spyOn(orchestrator as any, 'worktreeManager', 'get').mockReturnValue(realWorktreeManager);

      const result = await orchestrator.cleanupMergedWorktree(mockTask.id);

      expect(result).toBe(true);
      expect(realWorktreeManager.getWorktree).toHaveBeenCalledWith(mockTask.id);
      expect(realWorktreeManager.deleteWorktree).toHaveBeenCalledWith(mockTask.id);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing prUrl gracefully', async () => {
      // Create task without prUrl
      const taskNoPR = createTestTask({ prUrl: undefined });
      await store.createTask(taskNoPR);

      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(true);

      const mockWorktreeInfo: WorktreeInfo = {
        path: '/test/worktree/path',
        branch: 'apex/test-branch',
        head: 'abc123',
        status: 'active',
        taskId: taskNoPR.id,
        isMain: false
      };

      const mockWorktreeManager = {
        getWorktree: vi.fn().mockResolvedValue(mockWorktreeInfo),
        deleteWorktree: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(orchestrator as any, 'worktreeManager', 'get').mockReturnValue(mockWorktreeManager);

      const result = await orchestrator.cleanupMergedWorktree(taskNoPR.id);

      expect(result).toBe(true);
    });

    it('should handle very long paths and URLs', async () => {
      const longPath = '/very/long/path/to/worktree/that/exceeds/normal/length/expectations/for/file/system/paths';
      const longUrl = 'https://github.com/very-long-organization-name/very-long-repository-name-that-might-cause-issues/pull/999999';

      const taskLongValues = createTestTask({ prUrl: longUrl });
      await store.createTask(taskLongValues);

      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(true);

      const mockWorktreeInfo: WorktreeInfo = {
        path: longPath,
        branch: 'apex/test-branch',
        head: 'abc123',
        status: 'active',
        taskId: taskLongValues.id,
        isMain: false
      };

      const mockWorktreeManager = {
        getWorktree: vi.fn().mockResolvedValue(mockWorktreeInfo),
        deleteWorktree: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(orchestrator as any, 'worktreeManager', 'get').mockReturnValue(mockWorktreeManager);

      const result = await orchestrator.cleanupMergedWorktree(taskLongValues.id);

      expect(result).toBe(true);
    });

    it('should handle special characters in task IDs', async () => {
      const specialTaskId = 'task-with_special.chars#123!';
      const specialTask = createTestTask({ id: specialTaskId });
      await store.createTask(specialTask);

      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(true);

      const mockWorktreeInfo: WorktreeInfo = {
        path: '/test/worktree/path',
        branch: 'apex/test-branch',
        head: 'abc123',
        status: 'active',
        taskId: specialTaskId,
        isMain: false
      };

      const mockWorktreeManager = {
        getWorktree: vi.fn().mockResolvedValue(mockWorktreeInfo),
        deleteWorktree: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(orchestrator as any, 'worktreeManager', 'get').mockReturnValue(mockWorktreeManager);

      const result = await orchestrator.cleanupMergedWorktree(specialTaskId);

      expect(result).toBe(true);
    });
  });

  describe('Acceptance Criteria Verification', () => {
    it('should meet all acceptance criteria', async () => {
      // Set up successful scenario
      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(true);

      const mockWorktreeInfo: WorktreeInfo = {
        path: '/test/worktree/path',
        branch: 'apex/test-branch',
        head: 'abc123',
        status: 'active',
        taskId: mockTask.id,
        isMain: false,
        createdAt: new Date(),
        lastUsedAt: new Date()
      };

      const mockWorktreeManager = {
        getWorktree: vi.fn().mockResolvedValue(mockWorktreeInfo),
        deleteWorktree: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(orchestrator as any, 'worktreeManager', 'get').mockReturnValue(mockWorktreeManager);

      // Track event emission
      let eventEmitted = false;
      let eventParams: any[] = [];

      orchestrator.on('worktree:merge-cleaned', (...args) => {
        eventEmitted = true;
        eventParams = args;
      });

      const result = await orchestrator.cleanupMergedWorktree(mockTask.id);

      // Verify acceptance criteria:

      // 1. Method verifies PR is merged
      expect(orchestrator.checkPRMerged).toHaveBeenCalledWith(mockTask.id);

      // 2. Deletes worktree via worktreeManager.deleteWorktree()
      expect(mockWorktreeManager.deleteWorktree).toHaveBeenCalledWith(mockTask.id);

      // 3. Emits worktree:merge-cleaned event with taskId, worktreePath, and prUrl
      expect(eventEmitted).toBe(true);
      expect(eventParams).toEqual([
        mockTask.id,
        '/test/worktree/path',
        'https://github.com/test/repo/pull/123'
      ]);

      // 4. Logs cleanup action to task logs
      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'info' &&
        log.message === 'Cleaned up worktree after merge detected: /test/worktree/path'
      )).toBe(true);

      // Method returns true on success
      expect(result).toBe(true);
    });
  });
});