import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { exec } from 'child_process';
import { WorktreeManager, WorktreeError } from './worktree-manager';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Store exec mock for dynamic behavior
let execMockBehavior: Record<string, { stdout?: string; error?: Error; delay?: number }> = {};

// Mock child_process for git/gh commands
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    const cb = callback as (error: Error | null, result?: { stdout: string }) => void;

    // Check for custom behavior first
    for (const [pattern, behavior] of Object.entries(execMockBehavior)) {
      if (cmd.includes(pattern)) {
        const executeCallback = () => {
          if (behavior.error) {
            cb(behavior.error);
          } else {
            cb(null, { stdout: behavior.stdout || '' });
          }
        };

        if (behavior.delay) {
          setTimeout(executeCallback, behavior.delay);
        } else {
          executeCallback();
        }
        return;
      }
    }

    // Default mock responses for git worktree commands
    if (cmd.includes('git worktree add')) {
      cb(null, { stdout: '' });
    } else if (cmd.includes('git worktree list --porcelain')) {
      cb(null, { stdout: 'worktree /tmp/test-project\nHEAD abcd1234\nbranch refs/heads/main\n' });
    } else if (cmd.includes('git worktree remove')) {
      cb(null, { stdout: '' });
    } else if (cmd.includes('git worktree prune')) {
      cb(null, { stdout: '' });
    } else if (cmd.includes('gh --version')) {
      cb(null, { stdout: 'gh version 2.0.0' });
    } else if (cmd.includes('git remote get-url origin')) {
      cb(null, { stdout: 'https://github.com/test/repo.git' });
    } else if (cmd.includes('git push')) {
      cb(null, { stdout: '' });
    } else if (cmd.includes('gh pr create')) {
      cb(null, { stdout: 'https://github.com/test/repo/pull/123' });
    } else if (cmd.includes('gh pr view')) {
      cb(null, { stdout: '{"state": "MERGED"}' });
    } else {
      cb(null, { stdout: '' });
    }
  }),
}));

// Mock fs operations for worktree directory management
const originalAccess = fs.access;
const originalMkdir = fs.mkdir;
const originalStat = fs.stat;
const originalUtimes = fs.utimes;
const originalRm = fs.rm;

let mockFsBehavior: Record<string, any> = {};

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
    access: vi.fn(async (path: string, mode?: number) => {
      if (mockFsBehavior.accessError && mockFsBehavior.accessError[path]) {
        throw mockFsBehavior.accessError[path];
      }
      if (mockFsBehavior.shouldFailAccess && mockFsBehavior.shouldFailAccess.includes(path)) {
        throw new Error(`ENOENT: no such file or directory, access '${path}'`);
      }
      return originalAccess(path, mode);
    }),
    mkdir: vi.fn(async (path: string, options?: any) => {
      if (mockFsBehavior.mkdirError && mockFsBehavior.mkdirError[path]) {
        throw mockFsBehavior.mkdirError[path];
      }
      return originalMkdir(path, options);
    }),
    stat: vi.fn(async (path: string) => {
      if (mockFsBehavior.statError && mockFsBehavior.statError[path]) {
        throw mockFsBehavior.statError[path];
      }
      if (mockFsBehavior.statResult && mockFsBehavior.statResult[path]) {
        return mockFsBehavior.statResult[path];
      }
      return originalStat(path);
    }),
    utimes: vi.fn(async (path: string, atime: Date, mtime: Date) => {
      if (mockFsBehavior.utimesError && mockFsBehavior.utimesError[path]) {
        throw mockFsBehavior.utimesError[path];
      }
      return originalUtimes(path, atime, mtime);
    }),
    rm: vi.fn(async (path: string, options?: any) => {
      if (mockFsBehavior.rmError && mockFsBehavior.rmError[path]) {
        throw mockFsBehavior.rmError[path];
      }
      return originalRm(path, options);
    }),
  };
});

/**
 * Integration tests for worktree cleanup automation
 *
 * These tests verify the acceptance criteria:
 * - Cleanup on cancel with delay
 * - Cleanup on merge detection
 * - Cleanup on complete with delay
 * - Manual cleanup via checkout --cleanup <taskId>
 */
describe('Worktree Cleanup Automation Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;
  let eventsSpy: Record<string, any[]> = {};

  beforeEach(async () => {
    // Reset mocks
    mockFsBehavior = {};
    execMockBehavior = {};
    eventsSpy = {};

    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-worktree-integration-'));

    // Initialize the project
    await initializeApex(testDir, {
      name: 'test-project',
      description: 'Test project for worktree integration tests',
    });

    // Create test config with worktree enabled
    const configPath = path.join(testDir, '.apex', 'config.yaml');
    const config = `
project:
  name: test-project
  description: Test project

agents:
  defaultModel: haiku

workflows:
  feature:
    stages: [planning, implementation, testing, review]

git:
  autoWorktree: true
  worktree:
    cleanupOnComplete: true
    maxWorktrees: 5
    pruneStaleAfterDays: 7
    preserveOnFailure: false
    cleanupDelayMs: 1000

autonomy:
  default: guided
`;
    await fs.writeFile(configPath, config);

    // Create test workflows
    const workflowPath = path.join(testDir, '.apex', 'workflows', 'feature.yaml');
    const workflowContent = `
name: feature
description: Feature development workflow
stages:
  - name: planning
    agent: planner
  - name: implementation
    agent: developer
  - name: testing
    agent: tester
  - name: review
    agent: reviewer
`;
    await fs.writeFile(workflowPath, workflowContent);

    // Create test agents
    const plannerContent = `---
name: planner
description: Plans task execution
tools: Read, Write, Edit
model: sonnet
---
You are a planner agent that breaks down tasks.
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'planner.md'),
      plannerContent
    );

    const developerContent = `---
name: developer
description: Implements code changes
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a developer agent that implements code changes.
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      developerContent
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });

    // Set up event spying
    const eventTypes = [
      'task:created',
      'task:updated',
      'task:completed',
      'task:failed',
      'task:cancelled',
      'worktree:created',
      'worktree:cleaned',
      'worktree:merge-cleaned'
    ];

    eventTypes.forEach(eventType => {
      eventsSpy[eventType] = [];
      orchestrator.on(eventType, (...args) => {
        eventsSpy[eventType].push(args);
      });
    });

    // Mock the query function to return a simple response
    mockQuery = vi.mocked(query);
    mockQuery.mockResolvedValue({
      messages: [{
        role: 'assistant',
        content: 'Task completed successfully',
      }],
    });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
    execMockBehavior = {};
    mockFsBehavior = {};
    eventsSpy = {};
  });

  describe('Cleanup on Cancel with Delay', () => {
    it('should cleanup worktree on task cancellation with configured delay', async () => {
      // Set up successful worktree creation
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${testDir}/../.apex-worktrees/task-cancel-123\nHEAD abcd1234\nbranch refs/heads/feature/test-branch\n`
      };
      execMockBehavior['git worktree remove'] = { stdout: '' };

      const task = await orchestrator.createTask({
        description: 'Task to be cancelled',
        workflow: 'feature',
      });

      expect(task.workspace).toBeDefined();
      expect(task.workspace?.cleanup).toBe(true);

      // Clear worktree:created events
      eventsSpy['worktree:created'] = [];
      eventsSpy['worktree:cleaned'] = [];

      // Mock setTimeout to track delay behavior
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      // Cancel the task
      await orchestrator.updateTaskStatus(task.id, 'cancelled', 'User cancelled task');

      // Verify setTimeout was called with correct delay (1000ms from config)
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        1000
      );

      // Simulate delay completion by triggering the callback
      const timeoutCallback = setTimeoutSpy.mock.calls[0][0] as Function;
      timeoutCallback();

      // Wait for any async operations
      await new Promise(resolve => process.nextTick(resolve));

      // Verify cleanup occurred
      expect(eventsSpy['worktree:cleaned']).toHaveLength(1);
      expect(eventsSpy['worktree:cleaned'][0][0]).toBe(task.id);

      setTimeoutSpy.mockRestore();
    });

    it('should handle cancellation with zero delay (immediate cleanup)', async () => {
      // Update config for immediate cleanup
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const config = `
project:
  name: test-project

git:
  autoWorktree: true
  worktree:
    cleanupOnComplete: true
    cleanupDelayMs: 0

autonomy:
  default: guided
`;
      await fs.writeFile(configPath, config);

      // Reinitialize orchestrator
      orchestrator = new ApexOrchestrator({ projectPath: testDir });

      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree remove'] = { stdout: '' };

      const task = await orchestrator.createTask({
        description: 'Task for immediate cleanup on cancel',
        workflow: 'feature',
      });

      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      await orchestrator.updateTaskStatus(task.id, 'cancelled');

      // With zero delay, setTimeout should not be called
      expect(setTimeoutSpy).not.toHaveBeenCalled();

      setTimeoutSpy.mockRestore();
    });

    it('should log delay scheduling for cancellation cleanup', async () => {
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree remove'] = { stdout: '' };

      const task = await orchestrator.createTask({
        description: 'Task for delay logging on cancel',
        workflow: 'feature',
      });

      await orchestrator.updateTaskStatus(task.id, 'cancelled', 'Test cancellation');

      // Check task logs for delay scheduling message
      const updatedTask = await orchestrator.getTask(task.id);
      const delayLog = updatedTask?.logs.find(log =>
        log.message.includes('Scheduling worktree cleanup') &&
        log.message.includes('1000ms')
      );

      expect(delayLog).toBeDefined();
      expect(delayLog?.level).toBe('info');
    });
  });

  describe('Cleanup on Merge Detection', () => {
    it('should detect merged PR and cleanup worktree automatically', async () => {
      // Set up task with PR URL
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree remove'] = { stdout: '' };
      execMockBehavior['gh pr view'] = { stdout: '{"state": "MERGED"}' };

      const task = await orchestrator.createTask({
        description: 'Task with PR for merge detection',
        workflow: 'feature',
      });

      // Simulate PR creation
      await orchestrator.store.updateTask(task.id, {
        prUrl: 'https://github.com/test/repo/pull/456',
        updatedAt: new Date(),
      });

      eventsSpy['worktree:merge-cleaned'] = [];

      // Trigger merge detection
      const mergeResult = await orchestrator.cleanupMergedWorktree(task.id);

      expect(mergeResult).toBe(true);
      expect(eventsSpy['worktree:merge-cleaned']).toHaveLength(1);

      const [taskId, worktreePath, prUrl] = eventsSpy['worktree:merge-cleaned'][0];
      expect(taskId).toBe(task.id);
      expect(worktreePath).toMatch(/task-[a-z0-9]+$/);
      expect(prUrl).toBe('https://github.com/test/repo/pull/456');
    });

    it('should skip cleanup when PR is not merged', async () => {
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['gh pr view'] = { stdout: '{"state": "OPEN"}' };

      const task = await orchestrator.createTask({
        description: 'Task with open PR',
        workflow: 'feature',
      });

      // Simulate PR creation
      await orchestrator.store.updateTask(task.id, {
        prUrl: 'https://github.com/test/repo/pull/789',
        updatedAt: new Date(),
      });

      eventsSpy['worktree:merge-cleaned'] = [];

      const mergeResult = await orchestrator.cleanupMergedWorktree(task.id);

      expect(mergeResult).toBe(false);
      expect(eventsSpy['worktree:merge-cleaned']).toHaveLength(0);

      // Check logs for appropriate message
      const logs = await orchestrator.store.getLogs(task.id);
      const skipLog = logs.find(log => log.message.includes('PR not merged yet'));
      expect(skipLog).toBeDefined();
    });

    it('should handle gh CLI errors gracefully in merge detection', async () => {
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['gh --version'] = { error: new Error('gh not found') };

      const task = await orchestrator.createTask({
        description: 'Task for gh CLI error handling',
        workflow: 'feature',
      });

      await orchestrator.store.updateTask(task.id, {
        prUrl: 'https://github.com/test/repo/pull/999',
        updatedAt: new Date(),
      });

      const mergeResult = await orchestrator.cleanupMergedWorktree(task.id);

      expect(mergeResult).toBe(false);

      // Check for warning log about gh CLI unavailable
      const logs = await orchestrator.store.getLogs(task.id);
      const warningLog = logs.find(log =>
        log.level === 'warn' &&
        log.message.includes('GitHub CLI (gh) not available')
      );
      expect(warningLog).toBeDefined();
    });

    it('should handle malformed PR URL in merge detection', async () => {
      execMockBehavior['git worktree add'] = { stdout: '' };

      const task = await orchestrator.createTask({
        description: 'Task with invalid PR URL',
        workflow: 'feature',
      });

      await orchestrator.store.updateTask(task.id, {
        prUrl: 'invalid-url-format',
        updatedAt: new Date(),
      });

      const mergeResult = await orchestrator.checkPRMerged(task.id);

      expect(mergeResult).toBe(false);

      // Check for warning log about invalid URL
      const logs = await orchestrator.store.getLogs(task.id);
      const warningLog = logs.find(log =>
        log.level === 'warn' &&
        log.message.includes('Invalid PR URL format')
      );
      expect(warningLog).toBeDefined();
    });
  });

  describe('Cleanup on Complete with Delay', () => {
    it('should cleanup worktree on task completion with configured delay', async () => {
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree remove'] = { stdout: '' };

      const task = await orchestrator.createTask({
        description: 'Task to be completed with delay',
        workflow: 'feature',
      });

      eventsSpy['worktree:cleaned'] = [];
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      // Complete the task
      await orchestrator.updateTaskStatus(task.id, 'completed', 'Task completed successfully');

      // Verify setTimeout was called with correct delay
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        1000
      );

      // Execute the delayed callback
      const timeoutCallback = setTimeoutSpy.mock.calls[0][0] as Function;
      timeoutCallback();

      await new Promise(resolve => process.nextTick(resolve));

      // Verify cleanup occurred
      expect(eventsSpy['worktree:cleaned']).toHaveLength(1);
      expect(eventsSpy['worktree:cleaned'][0][0]).toBe(task.id);

      setTimeoutSpy.mockRestore();
    });

    it('should handle completion cleanup with different delay values', async () => {
      // Test with 5-second delay
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const config = `
project:
  name: test-project

git:
  autoWorktree: true
  worktree:
    cleanupOnComplete: true
    cleanupDelayMs: 5000

autonomy:
  default: guided
`;
      await fs.writeFile(configPath, config);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });

      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree remove'] = { stdout: '' };

      const task = await orchestrator.createTask({
        description: 'Task with 5-second delay',
        workflow: 'feature',
      });

      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      await orchestrator.updateTaskStatus(task.id, 'completed');

      // Verify 5-second delay was used
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        5000
      );

      setTimeoutSpy.mockRestore();
    });

    it('should preserve worktree on failure when preserveOnFailure is true', async () => {
      // Update config to preserve on failure
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const config = `
project:
  name: test-project

git:
  autoWorktree: true
  worktree:
    cleanupOnComplete: true
    preserveOnFailure: true
    cleanupDelayMs: 1000

autonomy:
  default: guided
`;
      await fs.writeFile(configPath, config);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });

      execMockBehavior['git worktree add'] = { stdout: '' };

      const task = await orchestrator.createTask({
        description: 'Task that will fail',
        workflow: 'feature',
      });

      eventsSpy['worktree:cleaned'] = [];
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      // Fail the task
      await orchestrator.updateTaskStatus(task.id, 'failed', 'Task failed');

      // Verify no cleanup was scheduled (preserveOnFailure = true)
      expect(setTimeoutSpy).not.toHaveBeenCalled();
      expect(eventsSpy['worktree:cleaned']).toHaveLength(0);

      // Check for preservation log message
      const logs = await orchestrator.store.getLogs(task.id);
      const preservationLog = logs.find(log =>
        log.message.includes('Preserved worktree for debugging')
      );
      expect(preservationLog).toBeDefined();

      setTimeoutSpy.mockRestore();
    });
  });

  describe('Manual Cleanup via Checkout Command', () => {
    it('should support manual cleanup through checkout --cleanup command', async () => {
      // This test simulates the checkout command functionality
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree remove'] = { stdout: '' };

      const task = await orchestrator.createTask({
        description: 'Task for manual cleanup testing',
        workflow: 'feature',
      });

      expect(task.workspace).toBeDefined();

      // Simulate manual cleanup call (what checkout --cleanup would do)
      const cleanupResult = await orchestrator.cleanupTaskWorktree(task.id);

      expect(cleanupResult).toBe(true);

      // Check that logs indicate manual cleanup
      const logs = await orchestrator.store.getLogs(task.id);
      const cleanupLog = logs.find(log =>
        log.message.includes('Worktree cleanup requested manually')
      );
      expect(cleanupLog).toBeDefined();
    });

    it('should handle manual cleanup for non-existent tasks gracefully', async () => {
      const cleanupResult = await orchestrator.cleanupTaskWorktree('non-existent-task');
      expect(cleanupResult).toBe(false);
    });

    it('should handle manual cleanup when task has no worktree', async () => {
      // Create task without worktree
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const config = `
project:
  name: test-project

git:
  autoWorktree: false

autonomy:
  default: guided
`;
      await fs.writeFile(configPath, config);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });

      const task = await orchestrator.createTask({
        description: 'Task without worktree',
        workflow: 'feature',
      });

      expect(task.workspace).toBeUndefined();

      const cleanupResult = await orchestrator.cleanupTaskWorktree(task.id);
      expect(cleanupResult).toBe(false);

      const logs = await orchestrator.store.getLogs(task.id);
      const noWorktreeLog = logs.find(log =>
        log.message.includes('No worktree found for task')
      );
      expect(noWorktreeLog).toBeDefined();
    });

    it('should handle manual cleanup failures gracefully', async () => {
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree remove'] = {
        error: new Error('Failed to remove worktree')
      };

      const task = await orchestrator.createTask({
        description: 'Task for cleanup failure testing',
        workflow: 'feature',
      });

      const cleanupResult = await orchestrator.cleanupTaskWorktree(task.id);
      expect(cleanupResult).toBe(false);

      // Check error was logged
      const logs = await orchestrator.store.getLogs(task.id);
      const errorLog = logs.find(log =>
        log.level === 'error' && log.message.includes('Failed to cleanup worktree')
      );
      expect(errorLog).toBeDefined();
    });
  });

  describe('Cross-scenario Integration', () => {
    it('should handle multiple concurrent tasks with different cleanup scenarios', async () => {
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree remove'] = { stdout: '' };
      execMockBehavior['gh pr view'] = { stdout: '{"state": "MERGED"}' };

      // Create multiple tasks
      const cancelTask = await orchestrator.createTask({
        description: 'Task to be cancelled',
        workflow: 'feature',
      });

      const completeTask = await orchestrator.createTask({
        description: 'Task to be completed',
        workflow: 'feature',
      });

      const mergeTask = await orchestrator.createTask({
        description: 'Task with merged PR',
        workflow: 'feature',
      });

      // Add PR URL to merge task
      await orchestrator.store.updateTask(mergeTask.id, {
        prUrl: 'https://github.com/test/repo/pull/555',
        updatedAt: new Date(),
      });

      eventsSpy['worktree:cleaned'] = [];
      eventsSpy['worktree:merge-cleaned'] = [];

      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      // Trigger different cleanup scenarios
      await Promise.all([
        orchestrator.updateTaskStatus(cancelTask.id, 'cancelled'),
        orchestrator.updateTaskStatus(completeTask.id, 'completed'),
        orchestrator.cleanupMergedWorktree(mergeTask.id),
      ]);

      // Verify all scenarios were handled appropriately
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2); // cancel and complete should use delay
      expect(eventsSpy['worktree:merge-cleaned']).toHaveLength(1); // merge cleanup should be immediate

      setTimeoutSpy.mockRestore();
    });

    it('should handle edge case where cleanup is disabled', async () => {
      // Update config to disable cleanup
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const config = `
project:
  name: test-project

git:
  autoWorktree: true
  worktree:
    cleanupOnComplete: false

autonomy:
  default: guided
`;
      await fs.writeFile(configPath, config);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });

      execMockBehavior['git worktree add'] = { stdout: '' };

      const task = await orchestrator.createTask({
        description: 'Task with cleanup disabled',
        workflow: 'feature',
      });

      expect(task.workspace?.cleanup).toBe(false);

      eventsSpy['worktree:cleaned'] = [];
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      await orchestrator.updateTaskStatus(task.id, 'completed');

      // No cleanup should occur
      expect(setTimeoutSpy).not.toHaveBeenCalled();
      expect(eventsSpy['worktree:cleaned']).toHaveLength(0);

      setTimeoutSpy.mockRestore();
    });

    it('should validate all acceptance criteria are met', async () => {
      // This is a comprehensive test that validates all the acceptance criteria
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree remove'] = { stdout: '' };
      execMockBehavior['gh pr view'] = { stdout: '{"state": "MERGED"}' };

      // Test 1: Cleanup on cancel with delay
      const cancelTask = await orchestrator.createTask({
        description: 'Cancel test task',
        workflow: 'feature',
      });

      eventsSpy['worktree:cleaned'] = [];
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      await orchestrator.updateTaskStatus(cancelTask.id, 'cancelled');
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      // Test 2: Cleanup on merge detection
      const mergeTask = await orchestrator.createTask({
        description: 'Merge test task',
        workflow: 'feature',
      });

      await orchestrator.store.updateTask(mergeTask.id, {
        prUrl: 'https://github.com/test/repo/pull/777',
        updatedAt: new Date(),
      });

      eventsSpy['worktree:merge-cleaned'] = [];
      const mergeResult = await orchestrator.cleanupMergedWorktree(mergeTask.id);
      expect(mergeResult).toBe(true);
      expect(eventsSpy['worktree:merge-cleaned']).toHaveLength(1);

      // Test 3: Cleanup on complete with delay
      const completeTask = await orchestrator.createTask({
        description: 'Complete test task',
        workflow: 'feature',
      });

      await orchestrator.updateTaskStatus(completeTask.id, 'completed');
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      // Test 4: Manual cleanup via checkout --cleanup
      const manualTask = await orchestrator.createTask({
        description: 'Manual cleanup test task',
        workflow: 'feature',
      });

      const manualResult = await orchestrator.cleanupTaskWorktree(manualTask.id);
      expect(manualResult).toBe(true);

      // All tests passed - acceptance criteria validated
      setTimeoutSpy.mockRestore();
    });
  });
});