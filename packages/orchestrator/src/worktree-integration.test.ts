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
let execMockBehavior: Record<string, { stdout?: string; error?: Error }> = {};

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
        if (behavior.error) {
          cb(behavior.error);
        } else {
          cb(null, { stdout: behavior.stdout || '' });
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

describe('Worktree Integration', () => {
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-worktree-test-'));

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
      'worktree:cleaned'
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

  describe('createTask with worktree integration', () => {
    it('should create worktree when autoWorktree is enabled', async () => {
      // Set up successful worktree creation
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${testDir}/../.apex-worktrees/task-test-123\nHEAD abcd1234\nbranch refs/heads/feature/test-branch\n`
      };

      const task = await orchestrator.createTask({
        description: 'Add new feature with worktree',
        workflow: 'feature',
      });

      expect(task.id).toBeDefined();
      expect(task.workspace).toBeDefined();
      expect(task.workspace?.strategy).toBe('worktree');
      expect(task.workspace?.path).toMatch(/task-[a-z0-9]+$/);
      expect(task.workspace?.cleanup).toBe(true);

      // Verify worktree:created event was emitted
      expect(eventsSpy['worktree:created']).toHaveLength(1);
      expect(eventsSpy['worktree:created'][0][0]).toBe(task.id);
      expect(eventsSpy['worktree:created'][0][1]).toBe(task.workspace?.path);
    });

    it('should not create worktree for subtasks', async () => {
      // First create a parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent task',
        workflow: 'feature',
      });

      // Clear events from parent task creation
      eventsSpy['worktree:created'] = [];

      // Create subtask with parent ID
      const subtask = await orchestrator.createTask({
        description: 'Subtask',
        parentTaskId: parentTask.id,
      });

      expect(subtask.workspace).toBeUndefined();
      expect(eventsSpy['worktree:created']).toHaveLength(0);
    });

    it('should handle worktree creation failure gracefully', async () => {
      // Set up worktree creation failure
      execMockBehavior['git worktree add'] = {
        error: new Error('Git worktree add failed')
      };

      const task = await orchestrator.createTask({
        description: 'Task with worktree creation failure',
        workflow: 'feature',
      });

      // Task should still be created even if worktree creation fails
      expect(task.id).toBeDefined();
      expect(task.workspace).toBeUndefined();
      expect(eventsSpy['worktree:created']).toHaveLength(0);
    });

    it('should not create worktree when autoWorktree is disabled', async () => {
      // Update config to disable autoWorktree
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const config = `
project:
  name: test-project
  description: Test project

git:
  autoWorktree: false

autonomy:
  default: guided
`;
      await fs.writeFile(configPath, config);

      // Reinitialize orchestrator to pick up new config
      orchestrator = new ApexOrchestrator({ projectPath: testDir });

      const task = await orchestrator.createTask({
        description: 'Task without worktree',
        workflow: 'feature',
      });

      expect(task.workspace).toBeUndefined();
      expect(eventsSpy['worktree:created']).toHaveLength(0);
    });
  });

  describe('task completion cleanup', () => {
    let taskWithWorktree: any;

    beforeEach(async () => {
      // Set up successful worktree creation
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${testDir}/../.apex-worktrees/task-test-123\nHEAD abcd1234\nbranch refs/heads/feature/test-branch\n`
      };

      taskWithWorktree = await orchestrator.createTask({
        description: 'Task with worktree for cleanup test',
        workflow: 'feature',
      });

      // Reset events
      eventsSpy['worktree:cleaned'] = [];
    });

    it('should cleanup worktree on task completion', async () => {
      execMockBehavior['git worktree remove'] = { stdout: '' };

      await orchestrator.updateTaskStatus(taskWithWorktree.id, 'completed');

      expect(eventsSpy['worktree:cleaned']).toHaveLength(1);
      expect(eventsSpy['worktree:cleaned'][0][0]).toBe(taskWithWorktree.id);
      expect(eventsSpy['worktree:cleaned'][0][1]).toBe(taskWithWorktree.workspace?.path);
    });

    it('should cleanup worktree on task cancellation', async () => {
      execMockBehavior['git worktree remove'] = { stdout: '' };

      await orchestrator.updateTaskStatus(taskWithWorktree.id, 'cancelled');

      expect(eventsSpy['worktree:cleaned']).toHaveLength(1);
      expect(eventsSpy['worktree:cleaned'][0][0]).toBe(taskWithWorktree.id);
    });

    it('should cleanup worktree on task failure when preserveOnFailure is false', async () => {
      execMockBehavior['git worktree remove'] = { stdout: '' };

      await orchestrator.updateTaskStatus(taskWithWorktree.id, 'failed');

      expect(eventsSpy['worktree:cleaned']).toHaveLength(1);
      expect(eventsSpy['worktree:cleaned'][0][0]).toBe(taskWithWorktree.id);
    });

    it('should preserve worktree on task failure when preserveOnFailure is true', async () => {
      // Update config to preserve on failure
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const config = `
project:
  name: test-project
  description: Test project

git:
  autoWorktree: true
  worktree:
    cleanupOnComplete: true
    preserveOnFailure: true

autonomy:
  default: guided
`;
      await fs.writeFile(configPath, config);

      // Reinitialize orchestrator to pick up new config
      orchestrator = new ApexOrchestrator({ projectPath: testDir });

      // Create new task with updated config
      const task = await orchestrator.createTask({
        description: 'Task to test preserve on failure',
        workflow: 'feature',
      });

      // Reset events
      eventsSpy['worktree:cleaned'] = [];

      await orchestrator.updateTaskStatus(task.id, 'failed');

      expect(eventsSpy['worktree:cleaned']).toHaveLength(0);
    });

    it('should not cleanup when cleanupOnComplete is false', async () => {
      // Create task with custom workspace config
      const task = await orchestrator.createTask({
        description: 'Task with no cleanup',
        workflow: 'feature',
      });

      // Manually update task workspace to disable cleanup
      await orchestrator.store.updateTask(task.id, {
        workspace: {
          ...task.workspace,
          cleanup: false,
        },
        updatedAt: new Date(),
      });

      // Reset events
      eventsSpy['worktree:cleaned'] = [];

      await orchestrator.updateTaskStatus(task.id, 'completed');

      expect(eventsSpy['worktree:cleaned']).toHaveLength(0);
    });

    it('should handle cleanup failure gracefully', async () => {
      execMockBehavior['git worktree remove'] = {
        error: new Error('Failed to remove worktree')
      };
      mockFsBehavior.rmError = {
        [taskWithWorktree.workspace?.path]: new Error('Failed to rm directory')
      };

      // Should not throw error even if cleanup fails
      await expect(orchestrator.updateTaskStatus(taskWithWorktree.id, 'completed')).resolves.not.toThrow();

      // But should not emit cleaned event
      expect(eventsSpy['worktree:cleaned']).toHaveLength(0);
    });
  });

  describe('worktree events', () => {
    it('should emit worktree:created event with correct parameters', async () => {
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${testDir}/../.apex-worktrees/task-test-123\nHEAD abcd1234\nbranch refs/heads/feature/test-branch\n`
      };

      const task = await orchestrator.createTask({
        description: 'Test worktree created event',
        workflow: 'feature',
      });

      expect(eventsSpy['worktree:created']).toHaveLength(1);
      expect(eventsSpy['worktree:created'][0]).toHaveLength(2);
      expect(eventsSpy['worktree:created'][0][0]).toBe(task.id);
      expect(typeof eventsSpy['worktree:created'][0][1]).toBe('string');
      expect(eventsSpy['worktree:created'][0][1]).toMatch(/task-[a-z0-9]+$/);
    });

    it('should emit worktree:cleaned event with correct parameters', async () => {
      // Set up task with worktree
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${testDir}/../.apex-worktrees/task-test-123\nHEAD abcd1234\nbranch refs/heads/feature/test-branch\n`
      };

      const task = await orchestrator.createTask({
        description: 'Test worktree cleaned event',
        workflow: 'feature',
      });

      // Reset events
      eventsSpy['worktree:cleaned'] = [];

      // Set up cleanup
      execMockBehavior['git worktree remove'] = { stdout: '' };

      await orchestrator.updateTaskStatus(task.id, 'completed');

      expect(eventsSpy['worktree:cleaned']).toHaveLength(1);
      expect(eventsSpy['worktree:cleaned'][0]).toHaveLength(2);
      expect(eventsSpy['worktree:cleaned'][0][0]).toBe(task.id);
      expect(eventsSpy['worktree:cleaned'][0][1]).toBe(task.workspace?.path);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle missing task in cleanup', async () => {
      // Try to cleanup non-existent task
      await expect(orchestrator.updateTaskStatus('non-existent-task', 'completed')).rejects.toThrow();
    });

    it('should handle task without workspace in cleanup', async () => {
      // Create task without worktree
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const config = `
project:
  name: test-project
  description: Test project

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

      // Should not attempt cleanup
      await orchestrator.updateTaskStatus(task.id, 'completed');
      expect(eventsSpy['worktree:cleaned']).toHaveLength(0);
    });

    it('should handle worktree creation when directory creation fails', async () => {
      mockFsBehavior.mkdirError = {
        [path.join(testDir, '..', '.apex-worktrees')]: new Error('Permission denied')
      };

      const task = await orchestrator.createTask({
        description: 'Task with directory creation failure',
        workflow: 'feature',
      });

      // Task should still be created without worktree
      expect(task.workspace).toBeUndefined();
      expect(eventsSpy['worktree:created']).toHaveLength(0);
    });

    it('should handle concurrent worktree creation within limits', async () => {
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${testDir}/../.apex-worktrees/task-test-123\nHEAD abcd1234\nbranch refs/heads/feature/test-branch\n`
      };

      // Create multiple tasks concurrently
      const taskPromises = [];
      for (let i = 0; i < 3; i++) {
        taskPromises.push(orchestrator.createTask({
          description: `Concurrent task ${i}`,
          workflow: 'feature',
        }));
      }

      const tasks = await Promise.all(taskPromises);

      // All tasks should be created successfully
      expect(tasks).toHaveLength(3);
      tasks.forEach(task => {
        expect(task.id).toBeDefined();
      });
    });

    it('should handle status updates for tasks without worktrees', async () => {
      // Create task without worktree
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const config = `
project:
  name: test-project
  description: Test project

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

      // Status update should work normally
      await orchestrator.updateTaskStatus(task.id, 'completed');

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
    });
  });
});