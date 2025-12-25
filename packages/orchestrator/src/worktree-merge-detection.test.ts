import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import type { Task, WorktreeInfo } from '@apexcli/core';

// Mock child_process exec for gh CLI calls
vi.mock('child_process');
const mockExec = exec as any;

/**
 * Integration test suite for merge detection and worktree cleanup
 *
 * Validates the acceptance criteria:
 * 1. Merge detection returns true for merged PRs
 * 2. Worktree cleanup is triggered after merge detection
 * 3. worktree:merge-cleaned event is emitted with correct parameters
 * 4. Error handling for gh CLI failures
 */
describe('Worktree Merge Detection Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let mockTask: Task;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task for merge detection',
    workflow: 'feature',
    autonomy: 'full',
    status: 'completed',
    priority: 'normal',
    effort: 'medium',
    projectPath: testDir,
    branchName: 'apex/test-feature-branch',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    prUrl: 'https://github.com/test/repo/pull/456',
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
    vi.clearAllMocks();

    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-merge-detection-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create basic config file
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `project:
  name: test-project
git:
  autoWorktree: true
  branchPrefix: apex/
limits:
  maxConcurrentTasks: 2
autonomy:
  default: full`
    );

    // Create workflows directory with feature workflow
    await fs.mkdir(path.join(testDir, '.apex', 'workflows'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'feature.yaml'),
      `name: feature
description: Feature workflow
stages:
  - name: implementation
    agent: developer`
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

  describe('Merge Detection Integration', () => {
    it('should return true for merged PRs using gh CLI', async () => {
      // Mock gh CLI commands
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('gh --version')) {
          // Mock gh CLI available
          callback(null, { stdout: 'gh version 2.0.0', stderr: '' });
        } else if (command.includes('gh pr view')) {
          // Mock merged PR response
          const mockPrData = JSON.stringify({ state: 'MERGED' });
          callback(null, { stdout: mockPrData, stderr: '' });
        }
        return {} as any;
      });

      const isMerged = await orchestrator.checkPRMerged(mockTask.id);

      expect(isMerged).toBe(true);

      // Verify gh CLI was called correctly
      expect(mockExec).toHaveBeenCalledWith(
        'gh --version',
        { cwd: testDir },
        expect.any(Function)
      );
      expect(mockExec).toHaveBeenCalledWith(
        'gh pr view 456 --json state',
        { cwd: testDir },
        expect.any(Function)
      );

      // Verify log was created
      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'info' &&
        log.message === 'Pull request #456 has been merged'
      )).toBe(true);
    });

    it('should return false for open/closed PRs', async () => {
      // Mock gh CLI commands for open PR
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0', stderr: '' });
        } else if (command.includes('gh pr view')) {
          // Mock open PR response
          const mockPrData = JSON.stringify({ state: 'OPEN' });
          callback(null, { stdout: mockPrData, stderr: '' });
        }
        return {} as any;
      });

      const isMerged = await orchestrator.checkPRMerged(mockTask.id);

      expect(isMerged).toBe(false);
    });

    it('should return false for closed (but not merged) PRs', async () => {
      // Mock gh CLI commands for closed PR
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0', stderr: '' });
        } else if (command.includes('gh pr view')) {
          // Mock closed PR response
          const mockPrData = JSON.stringify({ state: 'CLOSED' });
          callback(null, { stdout: mockPrData, stderr: '' });
        }
        return {} as any;
      });

      const isMerged = await orchestrator.checkPRMerged(mockTask.id);

      expect(isMerged).toBe(false);
    });
  });

  describe('Worktree Cleanup Integration', () => {
    it('should trigger worktree cleanup after merge detection', async () => {
      // Mock successful merge detection
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0', stderr: '' });
        } else if (command.includes('gh pr view')) {
          const mockPrData = JSON.stringify({ state: 'MERGED' });
          callback(null, { stdout: mockPrData, stderr: '' });
        }
        return {} as any;
      });

      // Mock worktree manager
      const mockWorktreeInfo: WorktreeInfo = {
        path: '/test/project/../.apex-worktrees/task-' + mockTask.id,
        branch: 'apex/test-feature-branch',
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

      // Call the integrated cleanup method that includes merge detection
      const result = await orchestrator.cleanupMergedWorktree(mockTask.id);

      expect(result).toBe(true);

      // Verify the integration flow:
      // 1. Merge detection was called
      expect(mockExec).toHaveBeenCalledWith(
        'gh pr view 456 --json state',
        { cwd: testDir },
        expect.any(Function)
      );

      // 2. Worktree cleanup was triggered after merge detection
      expect(mockWorktreeManager.getWorktree).toHaveBeenCalledWith(mockTask.id);
      expect(mockWorktreeManager.deleteWorktree).toHaveBeenCalledWith(mockTask.id);
    });

    it('should skip worktree cleanup when PR is not merged', async () => {
      // Mock PR not merged
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0', stderr: '' });
        } else if (command.includes('gh pr view')) {
          const mockPrData = JSON.stringify({ state: 'OPEN' });
          callback(null, { stdout: mockPrData, stderr: '' });
        }
        return {} as any;
      });

      const mockWorktreeManager = {
        getWorktree: vi.fn(),
        deleteWorktree: vi.fn()
      };

      vi.spyOn(orchestrator as any, 'worktreeManager', 'get').mockReturnValue(mockWorktreeManager);

      const result = await orchestrator.cleanupMergedWorktree(mockTask.id);

      expect(result).toBe(false);

      // Verify merge detection was called but worktree cleanup was skipped
      expect(mockExec).toHaveBeenCalledWith(
        'gh pr view 456 --json state',
        { cwd: testDir },
        expect.any(Function)
      );
      expect(mockWorktreeManager.getWorktree).not.toHaveBeenCalled();
      expect(mockWorktreeManager.deleteWorktree).not.toHaveBeenCalled();

      // Verify appropriate log message
      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'info' &&
        log.message === 'PR not merged yet, skipping worktree cleanup'
      )).toBe(true);
    });
  });

  describe('Event Emission Integration', () => {
    it('should emit worktree:merge-cleaned event with correct parameters', async () => {
      // Mock successful merge detection
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0', stderr: '' });
        } else if (command.includes('gh pr view')) {
          const mockPrData = JSON.stringify({ state: 'MERGED' });
          callback(null, { stdout: mockPrData, stderr: '' });
        }
        return {} as any;
      });

      const mockWorktreePath = '/test/project/../.apex-worktrees/task-' + mockTask.id;
      const mockWorktreeInfo: WorktreeInfo = {
        path: mockWorktreePath,
        branch: 'apex/test-feature-branch',
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

      // Set up event listener
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
        worktreePath: mockWorktreePath,
        prUrl: 'https://github.com/test/repo/pull/456'
      });
    });

    it('should emit event with "unknown" prUrl when task has no prUrl', async () => {
      // Create task without prUrl
      const taskWithoutPR = createTestTask({ prUrl: undefined });
      await store.createTask(taskWithoutPR);

      // Mock successful merge detection (even though no prUrl, we force merge detection to pass)
      vi.spyOn(orchestrator, 'checkPRMerged').mockResolvedValue(true);

      const mockWorktreePath = '/test/project/../.apex-worktrees/task-' + taskWithoutPR.id;
      const mockWorktreeInfo: WorktreeInfo = {
        path: mockWorktreePath,
        branch: 'apex/test-feature-branch',
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

      // Set up event listener
      let eventData: { taskId: string; worktreePath: string; prUrl: string } | null = null;

      orchestrator.on('worktree:merge-cleaned', (taskId, worktreePath, prUrl) => {
        eventData = { taskId, worktreePath, prUrl };
      });

      const result = await orchestrator.cleanupMergedWorktree(taskWithoutPR.id);

      expect(result).toBe(true);
      expect(eventData?.prUrl).toBe('unknown');
    });
  });

  describe('Error Handling for gh CLI Failures', () => {
    it('should handle gh CLI not available', async () => {
      // Mock gh CLI not available
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('gh --version')) {
          callback(new Error('command not found: gh'), null);
        }
        return {} as any;
      });

      const isMerged = await orchestrator.checkPRMerged(mockTask.id);

      expect(isMerged).toBe(false);

      // Verify warning log was created
      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'warn' &&
        log.message === 'GitHub CLI (gh) not available - cannot check PR merge status'
      )).toBe(true);
    });

    it('should handle authentication errors gracefully', async () => {
      // Mock authentication error
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0', stderr: '' });
        } else if (command.includes('gh pr view')) {
          callback(new Error('authentication required'), null);
        }
        return {} as any;
      });

      const isMerged = await orchestrator.checkPRMerged(mockTask.id);

      expect(isMerged).toBe(false);

      // Verify warning log was created
      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'warn' &&
        log.message === 'GitHub CLI authentication required - cannot check PR merge status'
      )).toBe(true);
    });

    it('should handle invalid PR URL format', async () => {
      // Create task with invalid PR URL
      const taskInvalidUrl = createTestTask({
        prUrl: 'https://github.com/test/repo/invalid-url'
      });
      await store.createTask(taskInvalidUrl);

      // Mock gh CLI available
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0', stderr: '' });
        }
        return {} as any;
      });

      const isMerged = await orchestrator.checkPRMerged(taskInvalidUrl.id);

      expect(isMerged).toBe(false);

      // Verify warning log was created
      const logs = await store.getLogs(taskInvalidUrl.id);
      expect(logs.some(log =>
        log.level === 'warn' &&
        log.message.includes('Invalid PR URL format')
      )).toBe(true);
    });

    it('should handle PR not found error', async () => {
      // Mock PR not found error
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0', stderr: '' });
        } else if (command.includes('gh pr view')) {
          callback(new Error('pull request not found'), null);
        }
        return {} as any;
      });

      const isMerged = await orchestrator.checkPRMerged(mockTask.id);

      expect(isMerged).toBe(false);

      // Verify error log was created
      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'error' &&
        log.message.includes('Failed to check PR merge status')
      )).toBe(true);
    });

    it('should handle malformed JSON response', async () => {
      // Mock malformed JSON response
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0', stderr: '' });
        } else if (command.includes('gh pr view')) {
          // Return invalid JSON
          callback(null, { stdout: 'invalid json {', stderr: '' });
        }
        return {} as any;
      });

      const isMerged = await orchestrator.checkPRMerged(mockTask.id);

      expect(isMerged).toBe(false);

      // Verify error log was created
      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'error' &&
        log.message.includes('Failed to check PR merge status')
      )).toBe(true);
    });
  });

  describe('Integration with Cleanup Workflow', () => {
    it('should complete full merge detection and cleanup workflow', async () => {
      // Mock successful merge detection
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0', stderr: '' });
        } else if (command.includes('gh pr view')) {
          const mockPrData = JSON.stringify({ state: 'MERGED' });
          callback(null, { stdout: mockPrData, stderr: '' });
        }
        return {} as any;
      });

      const mockWorktreePath = '/test/project/../.apex-worktrees/task-' + mockTask.id;
      const mockWorktreeInfo: WorktreeInfo = {
        path: mockWorktreePath,
        branch: 'apex/test-feature-branch',
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

      // Track all events and logs
      const events: any[] = [];
      orchestrator.on('worktree:merge-cleaned', (...args) => {
        events.push({ event: 'worktree:merge-cleaned', args });
      });

      const result = await orchestrator.cleanupMergedWorktree(mockTask.id);

      // Verify complete workflow
      expect(result).toBe(true);

      // 1. Merge detection was performed
      expect(mockExec).toHaveBeenCalledWith(
        'gh pr view 456 --json state',
        { cwd: testDir },
        expect.any(Function)
      );

      // 2. Worktree info was retrieved
      expect(mockWorktreeManager.getWorktree).toHaveBeenCalledWith(mockTask.id);

      // 3. Worktree was deleted
      expect(mockWorktreeManager.deleteWorktree).toHaveBeenCalledWith(mockTask.id);

      // 4. Event was emitted with correct parameters
      expect(events).toHaveLength(1);
      expect(events[0].args).toEqual([
        mockTask.id,
        mockWorktreePath,
        'https://github.com/test/repo/pull/456'
      ]);

      // 5. All appropriate logs were created
      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'info' &&
        log.message === 'Pull request #456 has been merged'
      )).toBe(true);
      expect(logs.some(log =>
        log.level === 'info' &&
        log.message === `Cleaned up worktree after merge detected: ${mockWorktreePath}`
      )).toBe(true);
    });

    it('should handle error in cleanup while preserving merge detection', async () => {
      // Mock successful merge detection
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0', stderr: '' });
        } else if (command.includes('gh pr view')) {
          const mockPrData = JSON.stringify({ state: 'MERGED' });
          callback(null, { stdout: mockPrData, stderr: '' });
        }
        return {} as any;
      });

      const mockWorktreeInfo: WorktreeInfo = {
        path: '/test/project/../.apex-worktrees/task-' + mockTask.id,
        branch: 'apex/test-feature-branch',
        head: 'abc123',
        status: 'active',
        taskId: mockTask.id,
        isMain: false,
        createdAt: new Date(),
        lastUsedAt: new Date()
      };

      // Mock worktree manager with cleanup error
      const mockWorktreeManager = {
        getWorktree: vi.fn().mockResolvedValue(mockWorktreeInfo),
        deleteWorktree: vi.fn().mockRejectedValue(new Error('Cleanup failed'))
      };

      vi.spyOn(orchestrator as any, 'worktreeManager', 'get').mockReturnValue(mockWorktreeManager);

      const result = await orchestrator.cleanupMergedWorktree(mockTask.id);

      expect(result).toBe(false);

      // Verify merge detection succeeded but cleanup failed gracefully
      expect(mockExec).toHaveBeenCalledWith(
        'gh pr view 456 --json state',
        { cwd: testDir },
        expect.any(Function)
      );

      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'info' &&
        log.message === 'Pull request #456 has been merged'
      )).toBe(true);
      expect(logs.some(log =>
        log.level === 'error' &&
        log.message.includes('Error cleaning up worktree after merge')
      )).toBe(true);
    });
  });

  describe('Acceptance Criteria Validation', () => {
    it('should meet all acceptance criteria in integration scenario', async () => {
      // Set up successful merge detection scenario
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0', stderr: '' });
        } else if (command.includes('gh pr view')) {
          const mockPrData = JSON.stringify({ state: 'MERGED' });
          callback(null, { stdout: mockPrData, stderr: '' });
        }
        return {} as any;
      });

      const mockWorktreePath = '/test/project/../.apex-worktrees/task-' + mockTask.id;
      const mockWorktreeInfo: WorktreeInfo = {
        path: mockWorktreePath,
        branch: 'apex/test-feature-branch',
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

      // ACCEPTANCE CRITERIA VERIFICATION:

      // (1) Merge detection returns true for merged PRs
      // Directly test merge detection
      const mergeDetected = await orchestrator.checkPRMerged(mockTask.id);
      expect(mergeDetected).toBe(true);

      // (2) Worktree cleanup is triggered after merge detection
      expect(result).toBe(true);
      expect(mockWorktreeManager.deleteWorktree).toHaveBeenCalledWith(mockTask.id);

      // (3) worktree:merge-cleaned event is emitted with correct parameters
      expect(eventEmitted).toBe(true);
      expect(eventParams).toEqual([
        mockTask.id,                                              // taskId
        mockWorktreePath,                                         // worktreePath
        'https://github.com/test/repo/pull/456'                   // prUrl
      ]);

      // (4) Error handling for gh CLI failures - tested in separate error test cases above
      // Here we verify successful case logs proper messages
      const logs = await store.getLogs(mockTask.id);
      expect(logs.some(log =>
        log.level === 'info' &&
        log.message === 'Pull request #456 has been merged'
      )).toBe(true);
      expect(logs.some(log =>
        log.level === 'info' &&
        log.message === `Cleaned up worktree after merge detected: ${mockWorktreePath}`
      )).toBe(true);
    });
  });
});