import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { exec } from 'child_process';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Store exec mock for dynamic behavior
let execMockBehavior: Record<string, { stdout?: string; error?: Error }> = {};

// Mock child_process for git worktree commands
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

    // Default mock responses
    if (cmd.includes('git worktree add')) {
      cb(null, { stdout: '' });
    } else if (cmd.includes('git worktree list --porcelain')) {
      cb(null, { stdout: 'worktree /tmp/test-project\nHEAD abcd1234\nbranch refs/heads/main\n' });
    } else if (cmd.includes('git worktree remove')) {
      cb(null, { stdout: '' });
    } else if (cmd.includes('git worktree prune')) {
      cb(null, { stdout: '' });
    } else {
      cb(null, { stdout: '' });
    }
  }),
}));

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
      return actual.access(path, mode);
    }),
    mkdir: vi.fn(async (path: string, options?: any) => {
      if (mockFsBehavior.mkdirError && mockFsBehavior.mkdirError[path]) {
        throw mockFsBehavior.mkdirError[path];
      }
      return actual.mkdir(path, options);
    }),
    stat: vi.fn(async (path: string) => {
      if (mockFsBehavior.statError && mockFsBehavior.statError[path]) {
        throw mockFsBehavior.statError[path];
      }
      if (mockFsBehavior.statResult && mockFsBehavior.statResult[path]) {
        return mockFsBehavior.statResult[path];
      }
      return actual.stat(path);
    }),
    utimes: vi.fn(async (path: string, atime: Date, mtime: Date) => {
      if (mockFsBehavior.utimesError && mockFsBehavior.utimesError[path]) {
        throw mockFsBehavior.utimesError[path];
      }
      return actual.utimes(path, atime, mtime);
    }),
    rm: vi.fn(async (path: string, options?: any) => {
      if (mockFsBehavior.rmError && mockFsBehavior.rmError[path]) {
        throw mockFsBehavior.rmError[path];
      }
      return actual.rm(path, options);
    }),
  };
});

/**
 * Coverage Test Suite for WorktreeManager Integration
 *
 * This test suite ensures complete coverage of the acceptance criteria:
 * 1. ApexOrchestrator createTask() optionally creates worktree when config.git.autoWorktree is true
 * 2. Task completion/cancellation triggers worktree cleanup
 * 3. Task object includes worktreePath field
 * 4. Events emitted: worktree:created, worktree:cleaned
 */
describe('WorktreeManager Integration Coverage', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let eventsSpy: Record<string, any[]> = {};

  beforeEach(async () => {
    // Reset mocks
    mockFsBehavior = {};
    execMockBehavior = {};
    eventsSpy = {};

    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-coverage-test-'));

    // Initialize the project
    await initializeApex(testDir, {
      name: 'coverage-test-project',
      description: 'Coverage test project',
    });

    // Create test config with worktree enabled
    const configPath = path.join(testDir, '.apex', 'config.yaml');
    const config = `
project:
  name: coverage-test-project
  description: Coverage test project

agents:
  defaultModel: haiku

workflows:
  feature:
    stages: [planning, implementation]

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

    // Create minimal workflow and agents
    const workflowPath = path.join(testDir, '.apex', 'workflows', 'feature.yaml');
    const workflowContent = `
name: feature
description: Feature development workflow
stages:
  - name: planning
    agent: planner
  - name: implementation
    agent: developer
`;
    await fs.writeFile(workflowPath, workflowContent);

    const plannerContent = `---
name: planner
description: Plans task execution
tools: Read, Write
model: haiku
---
Planner agent.`;
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
Developer agent.`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      developerContent
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });

    // Set up comprehensive event spying
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

    // Mock the query function
    vi.mocked(query).mockResolvedValue({
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

  describe('Acceptance Criteria Coverage', () => {
    it('AC1: createTask() optionally creates worktree when config.git.autoWorktree is true', async () => {
      // Setup successful worktree creation
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${testDir}/../.apex-worktrees/task-abc123\nHEAD abcd1234\nbranch refs/heads/feature/test-branch\n`
      };

      const task = await orchestrator.createTask({
        description: 'Test feature for AC1',
        workflow: 'feature',
      });

      // Verify worktree was created
      expect(task.workspace).toBeDefined();
      expect(task.workspace?.strategy).toBe('worktree');
      expect(task.workspace?.path).toMatch(/task-[a-z0-9]+$/);
      expect(task.workspace?.cleanup).toBe(true);

      // Verify git worktree add was called
      expect(vi.mocked(exec)).toHaveBeenCalledWith(
        expect.stringMatching(/git worktree add .* -b .*/),
        expect.objectContaining({ cwd: testDir }),
        expect.any(Function)
      );

      // Verify worktree:created event
      expect(eventsSpy['worktree:created']).toHaveLength(1);
      expect(eventsSpy['worktree:created'][0][0]).toBe(task.id);
      expect(eventsSpy['worktree:created'][0][1]).toBe(task.workspace?.path);
    });

    it('AC1: createTask() does NOT create worktree when config.git.autoWorktree is false', async () => {
      // Update config to disable autoWorktree
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const config = `
project:
  name: coverage-test-project
  description: Coverage test project

git:
  autoWorktree: false

autonomy:
  default: guided
`;
      await fs.writeFile(configPath, config);

      // Reinitialize orchestrator with updated config
      orchestrator = new ApexOrchestrator({ projectPath: testDir });

      const task = await orchestrator.createTask({
        description: 'Test feature without worktree',
        workflow: 'feature',
      });

      // Verify no worktree was created
      expect(task.workspace).toBeUndefined();
      expect(eventsSpy['worktree:created']).toHaveLength(0);
    });

    it('AC2: Task completion triggers worktree cleanup', async () => {
      // Setup and create task with worktree
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${testDir}/../.apex-worktrees/task-completion\nHEAD abcd1234\nbranch refs/heads/feature/completion\n`
      };

      const task = await orchestrator.createTask({
        description: 'Task for completion cleanup test',
        workflow: 'feature',
      });

      // Reset events after creation
      eventsSpy['worktree:cleaned'] = [];

      // Setup cleanup
      execMockBehavior['git worktree remove'] = { stdout: '' };

      // Complete the task
      await orchestrator.updateTaskStatus(task.id, 'completed');

      // Verify cleanup was triggered
      expect(eventsSpy['worktree:cleaned']).toHaveLength(1);
      expect(eventsSpy['worktree:cleaned'][0][0]).toBe(task.id);
      expect(eventsSpy['worktree:cleaned'][0][1]).toBe(task.workspace?.path);

      // Verify git worktree remove was called
      expect(vi.mocked(exec)).toHaveBeenCalledWith(
        expect.stringMatching(/git worktree remove .* --force/),
        expect.objectContaining({ cwd: testDir }),
        expect.any(Function)
      );
    });

    it('AC2: Task cancellation triggers worktree cleanup', async () => {
      // Setup and create task with worktree
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${testDir}/../.apex-worktrees/task-cancel\nHEAD abcd1234\nbranch refs/heads/feature/cancel\n`
      };

      const task = await orchestrator.createTask({
        description: 'Task for cancellation cleanup test',
        workflow: 'feature',
      });

      // Reset events after creation
      eventsSpy['worktree:cleaned'] = [];

      // Setup cleanup
      execMockBehavior['git worktree remove'] = { stdout: '' };

      // Cancel the task
      await orchestrator.updateTaskStatus(task.id, 'cancelled');

      // Verify cleanup was triggered
      expect(eventsSpy['worktree:cleaned']).toHaveLength(1);
      expect(eventsSpy['worktree:cleaned'][0][0]).toBe(task.id);
    });

    it('AC3: Task object includes worktreePath field (via workspace.path)', async () => {
      // Setup successful worktree creation
      const expectedPath = path.join(testDir, '..', '.apex-worktrees', 'task-path-test');
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${expectedPath}\nHEAD abcd1234\nbranch refs/heads/feature/path-test\n`
      };

      const task = await orchestrator.createTask({
        description: 'Task for path field test',
        workflow: 'feature',
      });

      // Verify task includes workspace path information
      expect(task.workspace).toBeDefined();
      expect(task.workspace?.path).toBeDefined();
      expect(typeof task.workspace?.path).toBe('string');
      expect(task.workspace?.path).toMatch(/task-[a-z0-9]+$/);
      expect(task.workspace?.strategy).toBe('worktree');

      // Verify the path is persisted in the database
      const retrievedTask = await orchestrator.getTask(task.id);
      expect(retrievedTask?.workspace?.path).toBe(task.workspace?.path);
    });

    it('AC4: Events emitted - worktree:created with correct signature', async () => {
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${testDir}/../.apex-worktrees/task-event-test\nHEAD abcd1234\nbranch refs/heads/feature/event-test\n`
      };

      const task = await orchestrator.createTask({
        description: 'Task for event signature test',
        workflow: 'feature',
      });

      // Verify worktree:created event structure
      expect(eventsSpy['worktree:created']).toHaveLength(1);
      const createdEvent = eventsSpy['worktree:created'][0];
      expect(createdEvent).toHaveLength(2);
      expect(createdEvent[0]).toBe(task.id); // taskId
      expect(typeof createdEvent[1]).toBe('string'); // worktreePath
      expect(createdEvent[1]).toBe(task.workspace?.path);
    });

    it('AC4: Events emitted - worktree:cleaned with correct signature', async () => {
      // Setup and create task with worktree
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${testDir}/../.apex-worktrees/task-clean-event\nHEAD abcd1234\nbranch refs/heads/feature/clean-event\n`
      };

      const task = await orchestrator.createTask({
        description: 'Task for cleanup event test',
        workflow: 'feature',
      });

      const originalWorktreePath = task.workspace?.path;

      // Reset events after creation
      eventsSpy['worktree:cleaned'] = [];

      // Setup cleanup
      execMockBehavior['git worktree remove'] = { stdout: '' };

      // Complete the task to trigger cleanup
      await orchestrator.updateTaskStatus(task.id, 'completed');

      // Verify worktree:cleaned event structure
      expect(eventsSpy['worktree:cleaned']).toHaveLength(1);
      const cleanedEvent = eventsSpy['worktree:cleaned'][0];
      expect(cleanedEvent).toHaveLength(2);
      expect(cleanedEvent[0]).toBe(task.id); // taskId
      expect(typeof cleanedEvent[1]).toBe('string'); // worktreePath
      expect(cleanedEvent[1]).toBe(originalWorktreePath);
    });

    it('Full lifecycle: create -> work -> complete -> cleanup', async () => {
      // Setup successful worktree creation
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${testDir}/../.apex-worktrees/task-lifecycle\nHEAD abcd1234\nbranch refs/heads/feature/lifecycle\n`
      };

      // 1. Create task with worktree
      const task = await orchestrator.createTask({
        description: 'Full lifecycle test',
        workflow: 'feature',
      });

      expect(task.workspace?.strategy).toBe('worktree');
      expect(task.workspace?.path).toMatch(/task-[a-z0-9]+$/);
      expect(eventsSpy['worktree:created']).toHaveLength(1);

      // 2. Update task status (simulating work)
      await orchestrator.updateTaskStatus(task.id, 'in_progress');
      const inProgressTask = await orchestrator.getTask(task.id);
      expect(inProgressTask?.status).toBe('in_progress');
      expect(inProgressTask?.workspace?.path).toBe(task.workspace?.path);

      // 3. Complete task and cleanup
      execMockBehavior['git worktree remove'] = { stdout: '' };
      await orchestrator.updateTaskStatus(task.id, 'completed');

      expect(eventsSpy['worktree:cleaned']).toHaveLength(1);
      const completedTask = await orchestrator.getTask(task.id);
      expect(completedTask?.status).toBe('completed');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle worktree creation failure gracefully', async () => {
      execMockBehavior['git worktree add'] = {
        error: new Error('Worktree creation failed')
      };

      // Task creation should succeed even if worktree creation fails
      const task = await orchestrator.createTask({
        description: 'Task with worktree failure',
        workflow: 'feature',
      });

      expect(task.id).toBeDefined();
      expect(task.workspace).toBeUndefined();
      expect(eventsSpy['worktree:created']).toHaveLength(0);
    });

    it('should handle cleanup failure gracefully', async () => {
      // Create task successfully
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${testDir}/../.apex-worktrees/task-cleanup-fail\nHEAD abcd1234\nbranch refs/heads/feature/cleanup-fail\n`
      };

      const task = await orchestrator.createTask({
        description: 'Task with cleanup failure',
        workflow: 'feature',
      });

      // Setup cleanup failure
      execMockBehavior['git worktree remove'] = {
        error: new Error('Cleanup failed')
      };
      mockFsBehavior.rmError = {
        [task.workspace?.path!]: new Error('Manual cleanup failed')
      };

      // Should not throw error even if cleanup fails
      await expect(orchestrator.updateTaskStatus(task.id, 'completed')).resolves.not.toThrow();

      // But should not emit cleaned event
      expect(eventsSpy['worktree:cleaned']).toHaveLength(0);
    });

    it('should not create worktree for subtasks', async () => {
      // Create parent task with worktree
      execMockBehavior['git worktree add'] = { stdout: '' };
      execMockBehavior['git worktree list --porcelain'] = {
        stdout: `worktree ${testDir}/../.apex-worktrees/task-parent\nHEAD abcd1234\nbranch refs/heads/feature/parent\n`
      };

      const parentTask = await orchestrator.createTask({
        description: 'Parent task',
        workflow: 'feature',
      });

      expect(parentTask.workspace).toBeDefined();

      // Clear events
      eventsSpy['worktree:created'] = [];

      // Create subtask - should NOT get worktree
      const subtask = await orchestrator.createTask({
        description: 'Subtask',
        parentTaskId: parentTask.id,
      });

      expect(subtask.workspace).toBeUndefined();
      expect(eventsSpy['worktree:created']).toHaveLength(0);
    });
  });
});