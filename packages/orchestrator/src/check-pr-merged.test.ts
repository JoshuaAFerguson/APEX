import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import type { Task } from '@apexcli/core';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock child_process to control exec behavior
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    exec: vi.fn(),
  };
});

describe('ApexOrchestrator.checkPRMerged', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let taskWithPR: Task;
  let taskWithoutPR: Task;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task for PR merge check',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: testDir,
    branchName: 'apex/test-branch',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-pr-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create basic config file
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      'git:\n  defaultBranch: main\n  branchPrefix: apex\n'
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();

    store = new TaskStore(testDir);
    await store.initialize();

    // Create test tasks
    taskWithPR = createTestTask({
      prUrl: 'https://github.com/test/repo/pull/123'
    });

    taskWithoutPR = createTestTask({
      prUrl: undefined
    });

    // Add tasks to store
    await store.createTask(taskWithPR);
    await store.createTask(taskWithoutPR);
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('basic functionality', () => {
    it('should return false when task has no PR URL', async () => {
      const result = await orchestrator.checkPRMerged(taskWithoutPR.id);
      expect(result).toBe(false);
    });

    it('should throw error when task does not exist', async () => {
      await expect(orchestrator.checkPRMerged('nonexistent')).rejects.toThrow('Task not found: nonexistent');
    });

    it('should have a checkPRMerged method that returns boolean', async () => {
      expect(typeof orchestrator.checkPRMerged).toBe('function');

      // Test with task that has no PR - should return false gracefully
      const result = await orchestrator.checkPRMerged(taskWithoutPR.id);
      expect(typeof result).toBe('boolean');
      expect(result).toBe(false);
    });

    it('should handle invalid PR URL format gracefully', async () => {
      // Create task with invalid PR URL
      const invalidPRTask = createTestTask({
        prUrl: 'https://github.com/test/repo/invalid-url'
      });
      await store.createTask(invalidPRTask);

      const result = await orchestrator.checkPRMerged(invalidPRTask.id);
      expect(result).toBe(false);

      // Check if warning was logged
      const logs = await store.getLogs(invalidPRTask.id);
      const warnLog = logs.find(log => log.level === 'warn' && log.message.includes('Invalid PR URL format'));
      expect(warnLog).toBeDefined();
    });

    it('should extract PR number from valid URL', async () => {
      // This test verifies the URL parsing logic
      const validPRTask = createTestTask({
        prUrl: 'https://github.com/owner/repo/pull/456'
      });
      await store.createTask(validPRTask);

      // Even if gh CLI is not available, it should still validate the URL format correctly
      // and return false (not throw an error)
      const result = await orchestrator.checkPRMerged(validPRTask.id);
      expect(typeof result).toBe('boolean');
    });

    it('should handle PR URLs with different formats', async () => {
      const testCases = [
        'https://github.com/owner/repo/pull/123',
        'https://github.com/org-name/repo-name/pull/456',
        'https://github.com/user/my-repo/pull/1',
      ];

      for (const prUrl of testCases) {
        const task = createTestTask({ prUrl });
        await store.createTask(task);

        const result = await orchestrator.checkPRMerged(task.id);
        expect(typeof result).toBe('boolean');
      }
    });

    it('should reject URLs that are not GitHub pull requests', async () => {
      const invalidUrls = [
        'https://gitlab.com/owner/repo/pull/123',
        'https://github.com/owner/repo/issues/123',
        'https://github.com/owner/repo',
        'not-a-url',
        '',
      ];

      for (const prUrl of invalidUrls) {
        const task = createTestTask({ prUrl });
        await store.createTask(task);

        const result = await orchestrator.checkPRMerged(task.id);
        expect(result).toBe(false);
      }
    });
  });

  describe('GitHub CLI interaction tests', () => {
    let taskWithValidPR: Task;
    let mockExec: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      // Create task with valid PR URL for mocking tests
      taskWithValidPR = createTestTask({
        prUrl: 'https://github.com/test/repo/pull/123'
      });
      await store.createTask(taskWithValidPR);

      // Get the mocked exec function
      mockExec = vi.mocked(exec);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return true when PR is merged', async () => {
      // Mock successful gh pr view response for merged PR
      mockExec.mockImplementation((cmd: string, options: any, callback?: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (cmd.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0' });
        } else if (cmd.includes('gh pr view 123 --json state')) {
          callback(null, { stdout: '{"state":"MERGED"}' });
        } else {
          callback(new Error('Command not found'));
        }
        return {} as any; // Return a mock child process
      });

      const result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(true);

      // Check if success log was added
      const logs = await store.getLogs(taskWithValidPR.id);
      const successLog = logs.find(log =>
        log.level === 'info' &&
        log.message.includes('Pull request #123 has been merged')
      );
      expect(successLog).toBeDefined();
    });

    it('should return false when PR is open', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback?: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (cmd.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0' });
        } else if (cmd.includes('gh pr view 123 --json state')) {
          callback(null, { stdout: '{"state":"OPEN"}' });
        } else {
          callback(new Error('Command not found'));
        }
        return {} as any;
      });

      const result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(false);
    });

    it('should return false when PR is closed without merge', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback?: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (cmd.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0' });
        } else if (cmd.includes('gh pr view 123 --json state')) {
          callback(null, { stdout: '{"state":"CLOSED"}' });
        } else {
          callback(new Error('Command not found'));
        }
        return {} as any;
      });

      const result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(false);
    });
  });

  describe('error handling tests', () => {
    let taskWithValidPR: Task;
    let mockExec: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      taskWithValidPR = createTestTask({
        prUrl: 'https://github.com/test/repo/pull/456'
      });
      await store.createTask(taskWithValidPR);

      mockExec = vi.mocked(exec);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should handle authentication errors gracefully', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback?: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (cmd.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0' });
        } else if (cmd.includes('gh pr view 456 --json state')) {
          callback(new Error('gh: To use GitHub CLI, please authenticate by running: gh auth login'));
        } else {
          callback(new Error('Command not found'));
        }
        return {} as any;
      });

      const result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(false);

      const logs = await store.getLogs(taskWithValidPR.id);
      const authErrorLog = logs.find(log =>
        log.level === 'warn' &&
        log.message.includes('GitHub CLI authentication required')
      );
      expect(authErrorLog).toBeDefined();
    });

    it('should handle PR not found errors gracefully', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback?: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (cmd.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0' });
        } else if (cmd.includes('gh pr view 456 --json state')) {
          callback(new Error('gh: Could not resolve to a Repository with the name \'test/repo\''));
        } else {
          callback(new Error('Command not found'));
        }
        return {} as any;
      });

      const result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(false);

      const logs = await store.getLogs(taskWithValidPR.id);
      const notFoundLog = logs.find(log =>
        log.level === 'warn' &&
        log.message.includes('Pull request not found or access denied')
      );
      expect(notFoundLog).toBeDefined();
    });

    it('should handle 404 errors gracefully', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback?: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (cmd.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0' });
        } else if (cmd.includes('gh pr view 456 --json state')) {
          callback(new Error('gh: HTTP 404: Pull request #456 not found'));
        } else {
          callback(new Error('Command not found'));
        }
        return {} as any;
      });

      const result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(false);

      const logs = await store.getLogs(taskWithValidPR.id);
      const notFoundLog = logs.find(log =>
        log.level === 'warn' &&
        log.message.includes('Pull request not found or access denied')
      );
      expect(notFoundLog).toBeDefined();
    });

    it('should handle network errors gracefully', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback?: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (cmd.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0' });
        } else if (cmd.includes('gh pr view 456 --json state')) {
          callback(new Error('gh: network error: request timeout'));
        } else {
          callback(new Error('Command not found'));
        }
        return {} as any;
      });

      const result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(false);

      const logs = await store.getLogs(taskWithValidPR.id);
      const networkErrorLog = logs.find(log =>
        log.level === 'warn' &&
        log.message.includes('Network error while checking PR merge status')
      );
      expect(networkErrorLog).toBeDefined();
    });

    it('should handle generic errors gracefully', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback?: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (cmd.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0' });
        } else if (cmd.includes('gh pr view 456 --json state')) {
          callback(new Error('Unexpected error occurred'));
        } else {
          callback(new Error('Command not found'));
        }
        return {} as any;
      });

      const result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(false);

      const logs = await store.getLogs(taskWithValidPR.id);
      const genericErrorLog = logs.find(log =>
        log.level === 'warn' &&
        log.message.includes('Error checking PR merge status: Unexpected error occurred')
      );
      expect(genericErrorLog).toBeDefined();
    });

    it('should handle GitHub CLI not available', async () => {
      // Mock isGitHubCliAvailable to return false
      const originalIsGitHubCliAvailable = orchestrator.isGitHubCliAvailable;
      orchestrator.isGitHubCliAvailable = vi.fn().mockResolvedValue(false);

      const result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(false);

      const logs = await store.getLogs(taskWithValidPR.id);
      const ghNotAvailableLog = logs.find(log =>
        log.level === 'warn' &&
        log.message.includes('GitHub CLI (gh) not available - cannot check PR merge status')
      );
      expect(ghNotAvailableLog).toBeDefined();

      // Restore original method
      orchestrator.isGitHubCliAvailable = originalIsGitHubCliAvailable;
    });
  });

  describe('JSON parsing tests', () => {
    let taskWithValidPR: Task;
    let mockExec: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      taskWithValidPR = createTestTask({
        prUrl: 'https://github.com/test/repo/pull/789'
      });
      await store.createTask(taskWithValidPR);

      mockExec = vi.mocked(exec);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should handle malformed JSON response', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback?: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (cmd.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0' });
        } else if (cmd.includes('gh pr view 789 --json state')) {
          callback(null, { stdout: 'invalid json response' });
        } else {
          callback(new Error('Command not found'));
        }
        return {} as any;
      });

      const result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(false);

      const logs = await store.getLogs(taskWithValidPR.id);
      const errorLog = logs.find(log =>
        log.level === 'warn' &&
        log.message.includes('Error checking PR merge status')
      );
      expect(errorLog).toBeDefined();
    });

    it('should handle JSON with missing state field', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback?: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (cmd.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0' });
        } else if (cmd.includes('gh pr view 789 --json state')) {
          callback(null, { stdout: '{"title":"Test PR","number":789}' });
        } else {
          callback(new Error('Command not found'));
        }
        return {} as any;
      });

      const result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(false);
    });

    it('should handle empty JSON response', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback?: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (cmd.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0' });
        } else if (cmd.includes('gh pr view 789 --json state')) {
          callback(null, { stdout: '{}' });
        } else {
          callback(new Error('Command not found'));
        }
        return {} as any;
      });

      const result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(false);
    });

    it('should handle different case states correctly', async () => {
      const testCases = [
        { state: 'merged', expected: false }, // Only 'MERGED' (uppercase) is valid
        { state: 'MERGED', expected: true },
        { state: 'Merged', expected: false },
        { state: 'open', expected: false },
        { state: 'OPEN', expected: false },
        { state: 'closed', expected: false },
        { state: 'CLOSED', expected: false },
        { state: 'draft', expected: false },
        { state: 'unknown_state', expected: false },
      ];

      for (const testCase of testCases) {
        mockExec.mockImplementation((cmd: string, options: any, callback?: any) => {
          if (typeof options === 'function') {
            callback = options;
          }

          if (cmd.includes('gh --version')) {
            callback(null, { stdout: 'gh version 2.0.0' });
          } else if (cmd.includes('gh pr view 789 --json state')) {
            callback(null, { stdout: `{"state":"${testCase.state}"}` });
          } else {
            callback(new Error('Command not found'));
          }
          return {} as any;
        });

        const result = await orchestrator.checkPRMerged(taskWithValidPR.id);
        expect(result).toBe(testCase.expected);
      }
    });
  });

  describe('integration-style tests with realistic scenarios', () => {
    let taskWithValidPR: Task;
    let mockExec: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      taskWithValidPR = createTestTask({
        prUrl: 'https://github.com/owner/repo-name/pull/123'
      });
      await store.createTask(taskWithValidPR);

      mockExec = vi.mocked(exec);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should extract correct PR number from complex URL formats', async () => {
      const testUrls = [
        'https://github.com/owner/repo/pull/123',
        'https://github.com/org-name/repo-with-dashes/pull/456',
        'https://github.com/user123/my.repo/pull/1',
        'https://github.com/company/product-api/pull/9999'
      ];

      for (const prUrl of testUrls) {
        const prNumber = prUrl.match(/\/pull\/(\d+)/)?.[1];
        const task = createTestTask({ prUrl });
        await store.createTask(task);

        mockExec.mockImplementation((cmd: string, options: any, callback?: any) => {
          if (typeof options === 'function') {
            callback = options;
          }

          if (cmd.includes('gh --version')) {
            callback(null, { stdout: 'gh version 2.0.0' });
          } else if (cmd.includes(`gh pr view ${prNumber} --json state`)) {
            callback(null, { stdout: '{"state":"MERGED"}' });
          } else {
            callback(new Error('Command not found'));
          }
          return {} as any;
        });

        const result = await orchestrator.checkPRMerged(task.id);
        expect(result).toBe(true);
      }
    });

    it('should handle workflow with multiple status checks', async () => {
      // Simulate checking the same PR multiple times
      let callCount = 0;
      const responses = ['{"state":"OPEN"}', '{"state":"OPEN"}', '{"state":"MERGED"}'];

      mockExec.mockImplementation((cmd: string, options: any, callback?: any) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (cmd.includes('gh --version')) {
          callback(null, { stdout: 'gh version 2.0.0' });
        } else if (cmd.includes('gh pr view 123 --json state')) {
          const response = responses[callCount] || '{"state":"MERGED"}';
          callCount++;
          callback(null, { stdout: response });
        } else {
          callback(new Error('Command not found'));
        }
        return {} as any;
      });

      // First check - should be open
      let result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(false);

      // Reset mock for second call
      callCount = 1; // Start from second response

      // Second check - still open
      result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(false);

      // Reset mock for third call
      callCount = 2; // Start from third response

      // Third check - now merged
      result = await orchestrator.checkPRMerged(taskWithValidPR.id);
      expect(result).toBe(true);

      // Verify we made the expected calls
      expect(mockExec).toHaveBeenCalled();
    });
  });
});