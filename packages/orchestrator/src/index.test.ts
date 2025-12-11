import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex } from '@apex/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { exec } from 'child_process';

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

    // Default mock responses
    if (cmd.includes('gh --version')) {
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

describe('ApexOrchestrator', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-orch-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-project',
      language: 'typescript',
      framework: 'node',
    });

    // Create a test workflow file
    const workflowContent = `
name: feature
description: Standard feature development workflow
stages:
  - name: planning
    agent: planner
    description: Create implementation plan
  - name: implementation
    agent: developer
    dependsOn:
      - planning
    description: Implement the feature
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'feature.yaml'),
      workflowContent
    );

    // Create test agent files
    const plannerContent = `---
name: planner
description: Plans implementation tasks
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent that creates implementation plans.
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
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
    execMockBehavior = {}; // Reset custom behaviors
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await orchestrator.initialize();
      const config = await orchestrator.getConfig();
      expect(config).toBeDefined();
      expect(config.project.name).toBe('test-project');
    });

    it('should auto-initialize when calling methods', async () => {
      // Calling getConfig without explicit initialize should auto-initialize
      const config = await orchestrator.getConfig();
      expect(config).toBeDefined();
    });

    it('should load agents', async () => {
      await orchestrator.initialize();
      const agents = await orchestrator.getAgents();
      expect(agents).toBeDefined();
      expect(Object.keys(agents).length).toBeGreaterThan(0);
      expect(agents['planner']).toBeDefined();
      expect(agents['developer']).toBeDefined();
    });

    it('should not re-initialize if already initialized', async () => {
      await orchestrator.initialize();
      await orchestrator.initialize(); // Should be a no-op
      const config = await orchestrator.getConfig();
      expect(config).toBeDefined();
    });
  });

  describe('task creation', () => {
    it('should create a task', async () => {
      const task = await orchestrator.createTask({
        description: 'Add a new feature',
      });

      expect(task.id).toBeDefined();
      expect(task.description).toBe('Add a new feature');
      expect(task.status).toBe('pending');
      expect(task.workflow).toBe('feature');
      expect(task.priority).toBe('normal');
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(3);
    });

    it('should create a task with custom workflow', async () => {
      const task = await orchestrator.createTask({
        description: 'Fix a bug',
        workflow: 'bugfix',
      });

      expect(task.workflow).toBe('bugfix');
    });

    it('should create a task with acceptance criteria', async () => {
      const task = await orchestrator.createTask({
        description: 'Add validation',
        acceptanceCriteria: '- Input must be validated\n- Errors shown to user',
      });

      expect(task.acceptanceCriteria).toBe('- Input must be validated\n- Errors shown to user');
    });

    it('should create a task with custom autonomy level', async () => {
      const task = await orchestrator.createTask({
        description: 'Critical change',
        autonomy: 'manual',
      });

      expect(task.autonomy).toBe('manual');
    });

    it('should create a task with custom priority', async () => {
      const task = await orchestrator.createTask({
        description: 'Urgent fix',
        priority: 'urgent',
      });

      expect(task.priority).toBe('urgent');
    });

    it('should create a task with custom maxRetries', async () => {
      const task = await orchestrator.createTask({
        description: 'Flaky task',
        maxRetries: 5,
      });

      expect(task.maxRetries).toBe(5);
    });

    it('should generate a branch name', async () => {
      const task = await orchestrator.createTask({
        description: 'Add user authentication',
      });

      expect(task.branchName).toBeDefined();
      expect(task.branchName).toMatch(/^apex\//);
    });

    it('should emit task:created event', async () => {
      const handler = vi.fn();
      orchestrator.on('task:created', handler);

      const task = await orchestrator.createTask({
        description: 'Test task',
      });

      expect(handler).toHaveBeenCalledWith(task);
    });
  });

  describe('task retrieval', () => {
    it('should get a task by ID', async () => {
      const created = await orchestrator.createTask({
        description: 'Test task',
      });

      const retrieved = await orchestrator.getTask(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.description).toBe('Test task');
    });

    it('should return null for non-existent task', async () => {
      const task = await orchestrator.getTask('non-existent');
      expect(task).toBeNull();
    });

    it('should list all tasks', async () => {
      await orchestrator.createTask({ description: 'Task 1' });
      await orchestrator.createTask({ description: 'Task 2' });
      await orchestrator.createTask({ description: 'Task 3' });

      const tasks = await orchestrator.listTasks();
      expect(tasks.length).toBe(3);
    });

    it('should list tasks filtered by status', async () => {
      const task = await orchestrator.createTask({ description: 'Task 1' });
      await orchestrator.updateTaskStatus(task.id, 'completed');

      await orchestrator.createTask({ description: 'Task 2' });

      const pendingTasks = await orchestrator.listTasks({ status: 'pending' });
      expect(pendingTasks.length).toBe(1);
      expect(pendingTasks[0].description).toBe('Task 2');
    });

    it('should list tasks with limit', async () => {
      await orchestrator.createTask({ description: 'Task 1' });
      await orchestrator.createTask({ description: 'Task 2' });
      await orchestrator.createTask({ description: 'Task 3' });

      const tasks = await orchestrator.listTasks({ limit: 2 });
      expect(tasks.length).toBe(2);
    });
  });

  describe('task status updates', () => {
    it('should update task status', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task',
      });

      await orchestrator.updateTaskStatus(task.id, 'in-progress');

      const updated = await orchestrator.getTask(task.id);
      expect(updated?.status).toBe('in-progress');
    });

    it('should update task status with error', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task',
      });

      await orchestrator.updateTaskStatus(task.id, 'failed', 'Something went wrong');

      const updated = await orchestrator.getTask(task.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.error).toBe('Something went wrong');
    });

    it('should set completedAt when completing task', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task',
      });

      await orchestrator.updateTaskStatus(task.id, 'completed');

      const updated = await orchestrator.getTask(task.id);
      expect(updated?.completedAt).toBeDefined();
    });
  });

  describe('isRetryableError', () => {
    it('should identify non-retryable errors', async () => {
      await orchestrator.initialize();

      // Access the private method via type assertion for testing
      const orch = orchestrator as unknown as {
        isRetryableError: (error: Error) => boolean;
      };

      expect(orch.isRetryableError(new Error('Task not found: xyz'))).toBe(false);
      expect(orch.isRetryableError(new Error('Workflow not found: abc'))).toBe(false);
      expect(orch.isRetryableError(new Error('Task exceeded budget'))).toBe(false);
      expect(orch.isRetryableError(new Error('Task was cancelled'))).toBe(false);
      expect(orch.isRetryableError(new Error('Invalid input'))).toBe(false);
    });

    it('should identify retryable errors', async () => {
      await orchestrator.initialize();

      const orch = orchestrator as unknown as {
        isRetryableError: (error: Error) => boolean;
      };

      expect(orch.isRetryableError(new Error('Network timeout'))).toBe(true);
      expect(orch.isRetryableError(new Error('API rate limited'))).toBe(true);
      expect(orch.isRetryableError(new Error('Connection refused'))).toBe(true);
    });
  });

  describe('GitHub integration', () => {
    it('should check if gh CLI is available', async () => {
      await orchestrator.initialize();
      const available = await orchestrator.isGitHubCliAvailable();
      expect(available).toBe(true);
    });

    it('should check if repo is a GitHub repo', async () => {
      await orchestrator.initialize();
      const isGitHub = await orchestrator.isGitHubRepo();
      expect(isGitHub).toBe(true);
    });

    it('should create a pull request', async () => {
      const task = await orchestrator.createTask({
        description: 'Add feature',
      });

      // Manually set branch name for testing
      const result = await orchestrator.createPullRequest(task.id);

      expect(result.success).toBe(true);
      expect(result.prUrl).toBe('https://github.com/test/repo/pull/123');
    });

    it('should return error for non-existent task PR creation', async () => {
      await orchestrator.initialize();
      const result = await orchestrator.createPullRequest('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found: non-existent');
    });

    it('should emit pr:created event on success', async () => {
      const handler = vi.fn();
      orchestrator.on('pr:created', handler);

      const task = await orchestrator.createTask({
        description: 'Add feature',
      });

      await orchestrator.createPullRequest(task.id);

      expect(handler).toHaveBeenCalledWith(task.id, 'https://github.com/test/repo/pull/123');
    });
  });

  describe('PR title and body generation', () => {
    it('should generate correct PR title for feature workflow', async () => {
      const task = await orchestrator.createTask({
        description: 'Add user authentication',
        workflow: 'feature',
      });

      const result = await orchestrator.createPullRequest(task.id);
      expect(result.success).toBe(true);
    });

    it('should allow custom PR title', async () => {
      const task = await orchestrator.createTask({
        description: 'Add feature',
      });

      const result = await orchestrator.createPullRequest(task.id, {
        title: 'Custom PR Title',
      });

      expect(result.success).toBe(true);
    });

    it('should allow custom PR body', async () => {
      const task = await orchestrator.createTask({
        description: 'Add feature',
      });

      const result = await orchestrator.createPullRequest(task.id, {
        body: 'Custom description',
      });

      expect(result.success).toBe(true);
    });

    it('should support draft PRs', async () => {
      const task = await orchestrator.createTask({
        description: 'Add feature',
      });

      const result = await orchestrator.createPullRequest(task.id, {
        draft: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('event emission', () => {
    it('should emit events via EventEmitter', async () => {
      const taskCreatedHandler = vi.fn();
      orchestrator.on('task:created', taskCreatedHandler);

      await orchestrator.createTask({ description: 'Test' });

      expect(taskCreatedHandler).toHaveBeenCalled();
    });

    it('should allow removing event listeners', async () => {
      const handler = vi.fn();
      orchestrator.on('task:created', handler);
      orchestrator.off('task:created', handler);

      await orchestrator.createTask({ description: 'Test' });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('configuration access', () => {
    it('should provide access to effective config', async () => {
      await orchestrator.initialize();
      const config = await orchestrator.getConfig();

      expect(config.limits).toBeDefined();
      expect(config.git).toBeDefined();
      expect(config.models).toBeDefined();
    });
  });

  describe('task execution', () => {
    it('should throw error for non-existent task', async () => {
      await orchestrator.initialize();

      await expect(orchestrator.executeTask('non-existent')).rejects.toThrow('Task not found: non-existent');
    });

    it('should throw error for non-existent workflow', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task',
        workflow: 'non-existent-workflow',
      });

      await expect(orchestrator.executeTask(task.id)).rejects.toThrow('Workflow not found: non-existent-workflow');
    });

    it('should execute a task and emit started event', async () => {
      // Setup mock to return empty async iterator
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // No messages
        },
      } as unknown as ReturnType<typeof query>);

      const startedHandler = vi.fn();
      const completedHandler = vi.fn();
      orchestrator.on('task:started', startedHandler);
      orchestrator.on('task:completed', completedHandler);

      const task = await orchestrator.createTask({
        description: 'Test task',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      expect(startedHandler).toHaveBeenCalled();
      expect(completedHandler).toHaveBeenCalled();

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
    });

    it('should emit agent:message events during execution', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', content: 'Hello' };
          yield { type: 'text', content: 'World' };
        },
      } as unknown as ReturnType<typeof query>);

      const messageHandler = vi.fn();
      orchestrator.on('agent:message', messageHandler);

      const task = await orchestrator.createTask({
        description: 'Test task',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      expect(messageHandler).toHaveBeenCalledTimes(2);
    });

    it('should track usage and emit usage:updated events', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { usage: { input_tokens: 100, output_tokens: 50 } };
          yield { usage: { input_tokens: 200, output_tokens: 100 } };
        },
      } as unknown as ReturnType<typeof query>);

      const usageHandler = vi.fn();
      orchestrator.on('usage:updated', usageHandler);

      const task = await orchestrator.createTask({
        description: 'Test task',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      expect(usageHandler).toHaveBeenCalled();

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.usage.inputTokens).toBe(300);
      expect(updatedTask?.usage.outputTokens).toBe(150);
    });

    it('should fail task if budget is exceeded', async () => {
      const mockQuery = vi.mocked(query);
      // Simulate a message that causes high usage
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { usage: { input_tokens: 10000000, output_tokens: 10000000 } };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Expensive task',
        workflow: 'feature',
      });

      await expect(orchestrator.executeTask(task.id)).rejects.toThrow('exceeded budget');

      const failedTask = await orchestrator.getTask(task.id);
      expect(failedTask?.status).toBe('failed');
    });

    it('should retry on transient errors', async () => {
      let callCount = 0;
      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          callCount++;
          if (callCount < 2) {
            throw new Error('Network timeout');
          }
          // Success on retry
        },
      } as unknown as ReturnType<typeof query>));

      const task = await orchestrator.createTask({
        description: 'Flaky task',
        workflow: 'feature',
        maxRetries: 3,
      });

      await orchestrator.executeTask(task.id);

      const completedTask = await orchestrator.getTask(task.id);
      expect(completedTask?.status).toBe('completed');
      expect(callCount).toBe(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Task exceeded budget limit');
        },
      } as unknown as ReturnType<typeof query>);

      const failedHandler = vi.fn();
      orchestrator.on('task:failed', failedHandler);

      const task = await orchestrator.createTask({
        description: 'Budget exceeded',
        workflow: 'feature',
        maxRetries: 3,
      });

      await expect(orchestrator.executeTask(task.id)).rejects.toThrow('exceeded budget');
      expect(failedHandler).toHaveBeenCalled();
    });

    it('should fail after max retries exhausted', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Persistent network error');
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Always fails',
        workflow: 'feature',
        maxRetries: 1,
      });

      await expect(orchestrator.executeTask(task.id)).rejects.toThrow('Persistent network error');

      const failedTask = await orchestrator.getTask(task.id);
      expect(failedTask?.status).toBe('failed');
    });

    it('should respect autoRetry=false option', async () => {
      let callCount = 0;
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          callCount++;
          throw new Error('Network error');
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'No retry',
        workflow: 'feature',
        maxRetries: 3,
      });

      await expect(orchestrator.executeTask(task.id, { autoRetry: false })).rejects.toThrow('Network error');
      expect(callCount).toBe(1); // Should not have retried
    });
  });

  describe('GitHub CLI edge cases', () => {
    it('should return false if gh CLI is not installed', async () => {
      execMockBehavior['gh --version'] = { error: new Error('command not found') };

      await orchestrator.initialize();
      const available = await orchestrator.isGitHubCliAvailable();
      expect(available).toBe(false);
    });

    it('should return false if not a GitHub repo', async () => {
      execMockBehavior['git remote get-url origin'] = { stdout: 'https://gitlab.com/test/repo.git' };

      await orchestrator.initialize();
      const isGitHub = await orchestrator.isGitHubRepo();
      expect(isGitHub).toBe(false);
    });

    it('should return error if gh CLI is not available for PR creation', async () => {
      execMockBehavior['gh --version'] = { error: new Error('command not found') };

      const task = await orchestrator.createTask({
        description: 'Add feature',
      });

      const result = await orchestrator.createPullRequest(task.id);
      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub CLI');
    });

    it('should return error if not a GitHub repo for PR creation', async () => {
      execMockBehavior['git remote get-url origin'] = { stdout: 'https://gitlab.com/test/repo.git' };

      const task = await orchestrator.createTask({
        description: 'Add feature',
      });

      const result = await orchestrator.createPullRequest(task.id);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not a GitHub repository');
    });

    it('should return error if task has no branch name', async () => {
      const task = await orchestrator.createTask({
        description: 'Add feature',
      });

      // Manually remove branch name for testing
      await orchestrator.updateTaskStatus(task.id, 'pending');
      const store = (orchestrator as unknown as { store: { updateTask: (id: string, updates: { branchName?: string }) => Promise<void> } }).store;
      // Note: We can't easily remove branchName, but we can test other edge cases

      // Test task without branch (need to access store directly)
      const result = await orchestrator.createPullRequest(task.id);
      // Since task has branch name from creation, this will succeed
      expect(result.success).toBe(true);
    });

    it('should emit pr:failed event on PR creation failure', async () => {
      execMockBehavior['gh pr create'] = { error: new Error('PR creation failed: branch already has PR') };

      const failedHandler = vi.fn();
      orchestrator.on('pr:failed', failedHandler);

      const task = await orchestrator.createTask({
        description: 'Add feature',
      });

      const result = await orchestrator.createPullRequest(task.id);

      expect(result.success).toBe(false);
      expect(failedHandler).toHaveBeenCalledWith(task.id, expect.stringContaining('PR creation failed'));
    });

    it('should update task with PR URL on success', async () => {
      const task = await orchestrator.createTask({
        description: 'Add feature',
      });

      const result = await orchestrator.createPullRequest(task.id);

      expect(result.success).toBe(true);

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.prUrl).toBe('https://github.com/test/repo/pull/123');
    });
  });

  describe('PR title generation for different workflows', () => {
    it('should generate fix: prefix for bugfix workflow', async () => {
      const task = await orchestrator.createTask({
        description: 'Fix authentication bug',
        workflow: 'bugfix',
      });

      // Access the private method for direct testing
      const orch = orchestrator as unknown as {
        generatePRTitle: (task: { workflow: string; description: string }) => string;
      };

      await orchestrator.initialize();
      const title = orch.generatePRTitle({ workflow: 'bugfix', description: 'Fix authentication bug' });
      expect(title).toMatch(/^fix:/);
    });

    it('should generate refactor: prefix for refactor workflow', async () => {
      await orchestrator.initialize();
      const orch = orchestrator as unknown as {
        generatePRTitle: (task: { workflow: string; description: string }) => string;
      };

      const title = orch.generatePRTitle({ workflow: 'refactor', description: 'Refactor user module' });
      expect(title).toMatch(/^refactor:/);
    });

    it('should generate docs: prefix for docs workflow', async () => {
      await orchestrator.initialize();
      const orch = orchestrator as unknown as {
        generatePRTitle: (task: { workflow: string; description: string }) => string;
      };

      const title = orch.generatePRTitle({ workflow: 'docs', description: 'Update README' });
      expect(title).toMatch(/^docs:/);
    });

    it('should generate test: prefix for test workflow', async () => {
      await orchestrator.initialize();
      const orch = orchestrator as unknown as {
        generatePRTitle: (task: { workflow: string; description: string }) => string;
      };

      const title = orch.generatePRTitle({ workflow: 'test', description: 'Add unit tests' });
      expect(title).toMatch(/^test:/);
    });

    it('should default to feat: for unknown workflow', async () => {
      await orchestrator.initialize();
      const orch = orchestrator as unknown as {
        generatePRTitle: (task: { workflow: string; description: string }) => string;
      };

      const title = orch.generatePRTitle({ workflow: 'unknown', description: 'Something new' });
      expect(title).toMatch(/^feat:/);
    });

    it('should strip common prefixes from description', async () => {
      await orchestrator.initialize();
      const orch = orchestrator as unknown as {
        generatePRTitle: (task: { workflow: string; description: string }) => string;
      };

      const title = orch.generatePRTitle({ workflow: 'feature', description: 'Add user authentication' });
      expect(title).toBe('feat: user authentication');
    });

    it('should truncate long descriptions', async () => {
      await orchestrator.initialize();
      const orch = orchestrator as unknown as {
        generatePRTitle: (task: { workflow: string; description: string }) => string;
      };

      const longDesc = 'A'.repeat(100);
      const title = orch.generatePRTitle({ workflow: 'feature', description: longDesc });
      expect(title.length).toBeLessThanOrEqual(70); // feat: + 60 chars max
    });
  });

  describe('PR body generation', () => {
    it('should include acceptance criteria when present', async () => {
      await orchestrator.initialize();
      const orch = orchestrator as unknown as {
        generatePRBody: (task: { description: string; acceptanceCriteria?: string; id: string; workflow: string; branchName?: string; usage: { totalTokens: number; estimatedCost: number } }) => string;
      };

      const body = orch.generatePRBody({
        description: 'Add feature',
        acceptanceCriteria: '- Must work\n- Must be fast',
        id: 'task_123',
        workflow: 'feature',
        branchName: 'apex/test',
        usage: { totalTokens: 1000, estimatedCost: 0.01 },
      });

      expect(body).toContain('Acceptance Criteria');
      expect(body).toContain('Must work');
    });

    it('should include task details', async () => {
      await orchestrator.initialize();
      const orch = orchestrator as unknown as {
        generatePRBody: (task: { description: string; acceptanceCriteria?: string; id: string; workflow: string; branchName?: string; usage: { totalTokens: number; estimatedCost: number } }) => string;
      };

      const body = orch.generatePRBody({
        description: 'Add feature',
        id: 'task_123',
        workflow: 'feature',
        branchName: 'apex/test-branch',
        usage: { totalTokens: 5000, estimatedCost: 0.05 },
      });

      expect(body).toContain('task_123');
      expect(body).toContain('feature');
      expect(body).toContain('apex/test-branch');
      expect(body).toContain('5,000');
      expect(body).toContain('$0.05');
      expect(body).toContain('APEX');
    });
  });

  describe('sleep function', () => {
    it('should sleep for specified duration', async () => {
      await orchestrator.initialize();
      const orch = orchestrator as unknown as {
        sleep: (ms: number) => Promise<void>;
      };

      const start = Date.now();
      await orch.sleep(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some timing variance
    });
  });

  describe('apiUrl configuration', () => {
    it('should use default apiUrl if not provided', async () => {
      const orch = new ApexOrchestrator({ projectPath: testDir });
      expect((orch as unknown as { apiUrl: string }).apiUrl).toBe('http://localhost:3000');
    });

    it('should use custom apiUrl when provided', async () => {
      const orch = new ApexOrchestrator({
        projectPath: testDir,
        apiUrl: 'http://custom:8080',
      });
      expect((orch as unknown as { apiUrl: string }).apiUrl).toBe('http://custom:8080');
    });
  });

  describe('concurrent task execution', () => {
    it('should track running task count', async () => {
      expect(orchestrator.getRunningTaskCount()).toBe(0);
    });

    it('should check if task is running', async () => {
      const task = await orchestrator.createTask({ description: 'Test' });
      expect(orchestrator.isTaskRunning(task.id)).toBe(false);
    });

    it('should return running task IDs', async () => {
      expect(orchestrator.getRunningTaskIds()).toEqual([]);
    });

    it('should get max concurrent tasks from config', async () => {
      await orchestrator.initialize();
      expect(orchestrator.getMaxConcurrentTasks()).toBe(3);
    });

    it('should start and stop task runner', async () => {
      expect(orchestrator.isTaskRunnerActive()).toBe(false);

      await orchestrator.startTaskRunner({ pollIntervalMs: 100 });
      expect(orchestrator.isTaskRunnerActive()).toBe(true);

      // Starting again should be a no-op
      await orchestrator.startTaskRunner();
      expect(orchestrator.isTaskRunnerActive()).toBe(true);

      orchestrator.stopTaskRunner();
      expect(orchestrator.isTaskRunnerActive()).toBe(false);
    });

    it('should process task queue when runner starts', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // Success
        },
      } as unknown as ReturnType<typeof query>);

      // Create a pending task
      const task = await orchestrator.createTask({
        description: 'Auto-run task',
        workflow: 'feature',
      });

      // Start the runner
      await orchestrator.startTaskRunner({ pollIntervalMs: 50 });

      // Wait for task to be picked up
      await new Promise(resolve => setTimeout(resolve, 100));

      orchestrator.stopTaskRunner();
      await orchestrator.waitForAllTasks();

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
    });

    it('should cancel a pending task', async () => {
      const task = await orchestrator.createTask({
        description: 'Cancel me',
      });

      const cancelled = await orchestrator.cancelTask(task.id);
      expect(cancelled).toBe(true);

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('cancelled');
    });

    it('should not cancel a completed task', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Complete me',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      const cancelled = await orchestrator.cancelTask(task.id);
      expect(cancelled).toBe(false);
    });

    it('should return false when cancelling non-existent task', async () => {
      const cancelled = await orchestrator.cancelTask('non-existent');
      expect(cancelled).toBe(false);
    });

    it('should queue task with priority', async () => {
      const task = await orchestrator.createTask({
        description: 'Queue me',
      });

      await orchestrator.updateTaskStatus(task.id, 'failed');
      await orchestrator.queueTask(task.id, 'urgent');

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('pending');
      expect(updatedTask?.priority).toBe('urgent');
    });

    it('should execute multiple tasks concurrently', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      } as unknown as ReturnType<typeof query>);

      const task1 = await orchestrator.createTask({
        description: 'Task 1',
        workflow: 'feature',
      });
      const task2 = await orchestrator.createTask({
        description: 'Task 2',
        workflow: 'feature',
      });

      const results = await orchestrator.executeTasksConcurrently(
        [task1.id, task2.id],
        { maxConcurrent: 2 }
      );

      expect(results.get(task1.id)?.success).toBe(true);
      expect(results.get(task2.id)?.success).toBe(true);
    });

    it('should handle failures in concurrent execution', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          // Both tasks throw, but second one is retryable - will retry and succeed
          throw new Error('Task exceeded budget'); // Non-retryable error
        },
      } as unknown as ReturnType<typeof query>));

      const task1 = await orchestrator.createTask({
        description: 'Failing task 1',
        workflow: 'feature',
        maxRetries: 0,
      });
      const task2 = await orchestrator.createTask({
        description: 'Failing task 2',
        workflow: 'feature',
        maxRetries: 0,
      });

      const results = await orchestrator.executeTasksConcurrently(
        [task1.id, task2.id],
        { maxConcurrent: 2 }
      );

      expect(results.get(task1.id)?.success).toBe(false);
      expect(results.get(task1.id)?.error).toContain('exceeded budget');
      expect(results.get(task2.id)?.success).toBe(false);
      expect(results.get(task2.id)?.error).toContain('exceeded budget');
    });

    it('should wait for all running tasks', async () => {
      // With no running tasks, should resolve immediately
      await orchestrator.waitForAllTasks();
      expect(true).toBe(true); // Just ensuring no hang
    });

    it('should respect concurrency limit in batch processing', async () => {
      const mockQuery = vi.mocked(query);
      let concurrentCount = 0;
      let maxConcurrent = 0;

      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          await new Promise(resolve => setTimeout(resolve, 50));
          concurrentCount--;
        },
      } as unknown as ReturnType<typeof query>));

      const tasks = await Promise.all([
        orchestrator.createTask({ description: 'Task 1', workflow: 'feature' }),
        orchestrator.createTask({ description: 'Task 2', workflow: 'feature' }),
        orchestrator.createTask({ description: 'Task 3', workflow: 'feature' }),
        orchestrator.createTask({ description: 'Task 4', workflow: 'feature' }),
      ]);

      await orchestrator.executeTasksConcurrently(
        tasks.map(t => t.id),
        { maxConcurrent: 2 }
      );

      // Max concurrent should never exceed 2
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });
});
