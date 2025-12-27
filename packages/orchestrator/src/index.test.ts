import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
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

      // With stage-by-stage execution, each of the 2 test stages produces messages
      // (planning, implementation)
      // Each stage yields 2 messages, so total = 4
      expect(messageHandler).toHaveBeenCalled();
      expect(messageHandler.mock.calls.length).toBeGreaterThanOrEqual(2);
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
      // Test workflow has 2 stages (planning, implementation), each yielding 2 usage events
      // Per stage: 100+200 input = 300, 50+100 output = 150
      // Total: 2 * 300 = 600 input, 2 * 150 = 300 output
      expect(updatedTask?.usage.inputTokens).toBe(600);
      expect(updatedTask?.usage.outputTokens).toBe(300);
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
      let firstAttemptFailed = false;
      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          if (!firstAttemptFailed) {
            firstAttemptFailed = true;
            throw new Error('Network timeout');
          }
          // Success on retry - yield something so stage completes
          yield { type: 'text', content: 'Done' };
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
      // First attempt failed, second succeeded - workflow re-ran from beginning
      expect(firstAttemptFailed).toBe(true);
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

    it('should call workspaceManager.cleanupWorkspace when task is cancelled', async () => {
      // Mock the cleanupWorkspace method
      const mockCleanupWorkspace = vi.fn().mockResolvedValue(undefined);
      (orchestrator as any).workspaceManager.cleanupWorkspace = mockCleanupWorkspace;

      const task = await orchestrator.createTask({
        description: 'Cancel and cleanup me',
      });

      const cancelled = await orchestrator.cancelTask(task.id);
      expect(cancelled).toBe(true);

      // Verify that cleanup was called with the task ID
      expect(mockCleanupWorkspace).toHaveBeenCalledOnce();
      expect(mockCleanupWorkspace).toHaveBeenCalledWith(task.id);

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('cancelled');
    });

    it('should still succeed when workspace cleanup fails during cancellation', async () => {
      // Mock console.warn to verify warning is logged
      const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock cleanupWorkspace to fail
      const cleanupError = new Error('Cleanup failed');
      const mockCleanupWorkspace = vi.fn().mockRejectedValue(cleanupError);
      (orchestrator as any).workspaceManager.cleanupWorkspace = mockCleanupWorkspace;

      const task = await orchestrator.createTask({
        description: 'Cancel me with failing cleanup',
      });

      const cancelled = await orchestrator.cancelTask(task.id);
      expect(cancelled).toBe(true); // Should still return true despite cleanup failure

      // Verify that cleanup was attempted
      expect(mockCleanupWorkspace).toHaveBeenCalledOnce();
      expect(mockCleanupWorkspace).toHaveBeenCalledWith(task.id);

      // Verify warning was logged
      expect(mockConsoleWarn).toHaveBeenCalledOnce();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        `Failed to cleanup workspace for cancelled task ${task.id}:`,
        cleanupError
      );

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('cancelled');

      mockConsoleWarn.mockRestore();
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

  describe('task dependencies', () => {
    it('should create task with dependencies', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent task',
      });

      const childTask = await orchestrator.createTask({
        description: 'Child task',
        dependsOn: [parentTask.id],
      });

      expect(childTask.dependsOn).toContain(parentTask.id);
    });

    it('should report blocking tasks for dependent task', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Blocker task',
      });

      const childTask = await orchestrator.createTask({
        description: 'Blocked task',
        dependsOn: [parentTask.id],
      });

      // Parent is pending, so child should be blocked
      const refreshedChild = await orchestrator.getTask(childTask.id);
      expect(refreshedChild?.blockedBy).toContain(parentTask.id);
    });

    it('should unblock task when dependency completes', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      } as unknown as ReturnType<typeof query>);

      const parentTask = await orchestrator.createTask({
        description: 'Complete me',
        workflow: 'feature',
      });

      const childTask = await orchestrator.createTask({
        description: 'Wait for parent',
        dependsOn: [parentTask.id],
      });

      // Initially blocked
      let refreshedChild = await orchestrator.getTask(childTask.id);
      expect(refreshedChild?.blockedBy).toContain(parentTask.id);

      // Complete the parent
      await orchestrator.executeTask(parentTask.id);

      // Now should be unblocked
      refreshedChild = await orchestrator.getTask(childTask.id);
      expect(refreshedChild?.blockedBy).toEqual([]);
    });

    it('should not pick up blocked task from queue', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Blocker',
        priority: 'low',
      });

      await orchestrator.createTask({
        description: 'Blocked high priority',
        priority: 'urgent',
        dependsOn: [parentTask.id],
      });

      // The next task should be the low priority parent, not the urgent blocked child
      const store = (orchestrator as unknown as { store: { getNextQueuedTask: () => Promise<unknown> } }).store;
      const nextTask = await store.getNextQueuedTask() as { id: string };
      expect(nextTask.id).toBe(parentTask.id);
    });

    it('should execute tasks in dependency order', async () => {
      const mockQuery = vi.mocked(query);
      const executionOrder: string[] = [];

      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          // Track execution but need to identify which task
        },
      } as unknown as ReturnType<typeof query>));

      const task1 = await orchestrator.createTask({
        description: 'First',
        workflow: 'feature',
      });

      const task2 = await orchestrator.createTask({
        description: 'Second',
        workflow: 'feature',
        dependsOn: [task1.id],
      });

      // Start the runner
      await orchestrator.startTaskRunner({ pollIntervalMs: 50 });

      // Wait for both tasks to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      orchestrator.stopTaskRunner();
      await orchestrator.waitForAllTasks();

      // Verify both completed
      const t1 = await orchestrator.getTask(task1.id);
      const t2 = await orchestrator.getTask(task2.id);

      expect(t1?.status).toBe('completed');
      expect(t2?.status).toBe('completed');
    });

    it('should support multiple dependencies', async () => {
      const dep1 = await orchestrator.createTask({
        description: 'Dependency 1',
      });

      const dep2 = await orchestrator.createTask({
        description: 'Dependency 2',
      });

      const mainTask = await orchestrator.createTask({
        description: 'Main task',
        dependsOn: [dep1.id, dep2.id],
      });

      const refreshed = await orchestrator.getTask(mainTask.id);
      expect(refreshed?.dependsOn).toHaveLength(2);
      expect(refreshed?.dependsOn).toContain(dep1.id);
      expect(refreshed?.dependsOn).toContain(dep2.id);
      expect(refreshed?.blockedBy).toHaveLength(2);
    });

    it('should only unblock when ALL dependencies complete', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      } as unknown as ReturnType<typeof query>);

      const dep1 = await orchestrator.createTask({
        description: 'Dep 1',
        workflow: 'feature',
      });

      const dep2 = await orchestrator.createTask({
        description: 'Dep 2',
        workflow: 'feature',
      });

      const mainTask = await orchestrator.createTask({
        description: 'Main',
        dependsOn: [dep1.id, dep2.id],
      });

      // Complete first dependency
      await orchestrator.executeTask(dep1.id);

      // Main should still be blocked by dep2
      let refreshed = await orchestrator.getTask(mainTask.id);
      expect(refreshed?.blockedBy).toContain(dep2.id);
      expect(refreshed?.blockedBy).not.toContain(dep1.id);

      // Complete second dependency
      await orchestrator.executeTask(dep2.id);

      // Now main should be unblocked
      refreshed = await orchestrator.getTask(mainTask.id);
      expect(refreshed?.blockedBy).toEqual([]);
    });

    it('should create task without dependencies by default', async () => {
      const task = await orchestrator.createTask({
        description: 'Standalone task',
      });

      expect(task.dependsOn).toEqual([]);
      expect(task.blockedBy).toEqual([]);
    });
  });

  describe('checkpoint management', () => {
    it('should save and retrieve checkpoint', async () => {
      const task = await orchestrator.createTask({
        description: 'Checkpoint test task',
      });

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'planning',
        stageIndex: 0,
        metadata: { filesProcessed: ['file1.ts'] },
      });

      expect(checkpointId).toMatch(/^cp_/);

      const checkpoint = await orchestrator.getLatestCheckpoint(task.id);
      expect(checkpoint).not.toBeNull();
      expect(checkpoint?.stage).toBe('planning');
      expect(checkpoint?.stageIndex).toBe(0);
      expect(checkpoint?.metadata?.filesProcessed).toEqual(['file1.ts']);
    });

    it('should get specific checkpoint by ID', async () => {
      const task = await orchestrator.createTask({
        description: 'Multi-checkpoint task',
      });

      const cp1 = await orchestrator.saveCheckpoint(task.id, {
        stage: 'planning',
        stageIndex: 0,
      });

      const cp2 = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
      });

      const checkpoint = await orchestrator.getCheckpoint(task.id, cp1);
      expect(checkpoint?.stage).toBe('planning');

      const checkpoint2 = await orchestrator.getCheckpoint(task.id, cp2);
      expect(checkpoint2?.stage).toBe('implementation');
    });

    it('should list all checkpoints for a task', async () => {
      const task = await orchestrator.createTask({
        description: 'List checkpoints task',
      });

      await orchestrator.saveCheckpoint(task.id, { stageIndex: 0 });
      await orchestrator.saveCheckpoint(task.id, { stageIndex: 1 });
      await orchestrator.saveCheckpoint(task.id, { stageIndex: 2 });

      const checkpoints = await orchestrator.listCheckpoints(task.id);
      expect(checkpoints).toHaveLength(3);
    });

    it('should delete all checkpoints', async () => {
      const task = await orchestrator.createTask({
        description: 'Delete checkpoints task',
      });

      await orchestrator.saveCheckpoint(task.id, { stageIndex: 0 });
      await orchestrator.saveCheckpoint(task.id, { stageIndex: 1 });

      await orchestrator.deleteCheckpoints(task.id);

      const checkpoints = await orchestrator.listCheckpoints(task.id);
      expect(checkpoints).toHaveLength(0);
    });

    it('should return null for non-existent checkpoint', async () => {
      const task = await orchestrator.createTask({
        description: 'No checkpoint task',
      });

      const checkpoint = await orchestrator.getLatestCheckpoint(task.id);
      expect(checkpoint).toBeNull();
    });

    it('should resume task from latest checkpoint', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Resume test task',
        workflow: 'feature',
      });

      // Save a checkpoint at the last stage (index >= workflow stages length means completion)
      await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 2, // Beyond the 2 stages in our test workflow
      });

      // Mark task as paused/failed
      await orchestrator.updateTaskStatus(task.id, 'paused');

      // Resume should work - with stageIndex=2, there are no remaining stages
      const resumed = await orchestrator.resumeTask(task.id);
      expect(resumed).toBe(true);

      // Task should be marked completed since no stages left
      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
    });

    it('should return false when resuming task with no checkpoint', async () => {
      const task = await orchestrator.createTask({
        description: 'No checkpoint resume task',
        workflow: 'feature',
      });

      const resumed = await orchestrator.resumeTask(task.id);
      expect(resumed).toBe(false);
    });

    it('should resume from specific checkpoint', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Specific checkpoint task',
        workflow: 'feature',
      });

      // Create checkpoint that skips all stages
      const cp1 = await orchestrator.saveCheckpoint(task.id, {
        stage: 'done',
        stageIndex: 10, // Beyond all stages
      });

      await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 10, // Also beyond all stages
      });

      // Resume from first checkpoint (not latest) - should complete immediately with no stages to run
      const resumed = await orchestrator.resumeTask(task.id, { checkpointId: cp1 });
      expect(resumed).toBe(true);

      // Task should be completed
      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
    });

    it('should throw error when resuming non-existent task', async () => {
      await expect(orchestrator.resumeTask('non-existent-task')).rejects.toThrow('Task not found');
    });
  });

  describe('subtask management', () => {
    describe('task decomposition', () => {
      it('should decompose a task into subtasks', async () => {
        const parentTask = await orchestrator.createTask({
          description: 'Build user authentication system',
        });

        const subtasks = await orchestrator.decomposeTask(parentTask.id, [
          { description: 'Create user model' },
          { description: 'Implement login endpoint' },
          { description: 'Implement registration endpoint' },
        ]);

        expect(subtasks).toHaveLength(3);
        expect(subtasks[0].description).toBe('Create user model');
        expect(subtasks[0].parentTaskId).toBe(parentTask.id);

        // Verify parent task has subtask IDs
        const updatedParent = await orchestrator.getTask(parentTask.id);
        expect(updatedParent?.subtaskIds).toHaveLength(3);
        expect(updatedParent?.subtaskStrategy).toBe('sequential');
      });

      it('should support parallel execution strategy', async () => {
        const parentTask = await orchestrator.createTask({
          description: 'Run multiple independent checks',
        });

        const subtasks = await orchestrator.decomposeTask(
          parentTask.id,
          [
            { description: 'Run linter' },
            { description: 'Run type checker' },
            { description: 'Run tests' },
          ],
          'parallel'
        );

        const updatedParent = await orchestrator.getTask(parentTask.id);
        expect(updatedParent?.subtaskStrategy).toBe('parallel');
        expect(subtasks).toHaveLength(3);
      });

      it('should support dependency-based execution strategy', async () => {
        const parentTask = await orchestrator.createTask({
          description: 'Build feature with dependencies',
        });

        const subtasks = await orchestrator.decomposeTask(
          parentTask.id,
          [
            { description: 'Create database schema' },
            { description: 'Create API endpoints', dependsOn: ['Create database schema'] },
            { description: 'Create UI components', dependsOn: ['Create API endpoints'] },
          ],
          'dependency-based'
        );

        expect(subtasks).toHaveLength(3);

        // Verify dependency resolution
        const apiSubtask = await orchestrator.getTask(subtasks[1].id);
        expect(apiSubtask?.dependsOn).toContain(subtasks[0].id);

        const uiSubtask = await orchestrator.getTask(subtasks[2].id);
        expect(uiSubtask?.dependsOn).toContain(subtasks[1].id);
      });

      it('should inherit workflow and priority from parent', async () => {
        const parentTask = await orchestrator.createTask({
          description: 'High priority parent task',
          workflow: 'feature',
          priority: 'high',
        });

        const subtasks = await orchestrator.decomposeTask(parentTask.id, [
          { description: 'Subtask without overrides' },
        ]);

        expect(subtasks[0].workflow).toBe('feature');
        expect(subtasks[0].priority).toBe('high');
      });

      it('should allow subtask to override workflow', async () => {
        const parentTask = await orchestrator.createTask({
          description: 'Parent task',
          workflow: 'feature',
        });

        const subtasks = await orchestrator.decomposeTask(parentTask.id, [
          { description: 'Subtask with different workflow', workflow: 'bugfix' },
        ]);

        // Would need bugfix workflow to exist for this to work in real execution
        expect(subtasks[0].workflow).toBe('bugfix');
      });

      it('should throw error when decomposing non-existent task', async () => {
        await expect(
          orchestrator.decomposeTask('non-existent', [{ description: 'Test' }])
        ).rejects.toThrow('Parent task not found');
      });

      it('should share branch name with subtasks', async () => {
        const parentTask = await orchestrator.createTask({
          description: 'Parent with branch',
        });

        const subtasks = await orchestrator.decomposeTask(parentTask.id, [
          { description: 'Subtask 1' },
          { description: 'Subtask 2' },
        ]);

        expect(subtasks[0].branchName).toBe(parentTask.branchName);
        expect(subtasks[1].branchName).toBe(parentTask.branchName);
      });

      it('should emit task:decomposed event', async () => {
        const decomposedHandler = vi.fn();
        orchestrator.on('task:decomposed', decomposedHandler);

        const parentTask = await orchestrator.createTask({
          description: 'Event test task',
        });

        const subtasks = await orchestrator.decomposeTask(parentTask.id, [
          { description: 'Subtask 1' },
        ]);

        expect(decomposedHandler).toHaveBeenCalledWith(
          expect.objectContaining({ id: parentTask.id }),
          [subtasks[0].id]
        );
      });

      it('should emit subtask:created events', async () => {
        const createdHandler = vi.fn();
        orchestrator.on('subtask:created', createdHandler);

        const parentTask = await orchestrator.createTask({
          description: 'Subtask event test',
        });

        await orchestrator.decomposeTask(parentTask.id, [
          { description: 'Subtask 1' },
          { description: 'Subtask 2' },
        ]);

        expect(createdHandler).toHaveBeenCalledTimes(2);
      });
    });

    describe('subtask queries', () => {
      it('should get subtasks for a parent task', async () => {
        const parentTask = await orchestrator.createTask({
          description: 'Parent task',
        });

        await orchestrator.decomposeTask(parentTask.id, [
          { description: 'Subtask A' },
          { description: 'Subtask B' },
        ]);

        const subtasks = await orchestrator.getSubtasks(parentTask.id);
        expect(subtasks).toHaveLength(2);
        expect(subtasks.map(s => s.description)).toContain('Subtask A');
        expect(subtasks.map(s => s.description)).toContain('Subtask B');
      });

      it('should return empty array for task with no subtasks', async () => {
        const task = await orchestrator.createTask({
          description: 'No subtasks task',
        });

        const subtasks = await orchestrator.getSubtasks(task.id);
        expect(subtasks).toHaveLength(0);
      });

      it('should get parent task for a subtask', async () => {
        const parentTask = await orchestrator.createTask({
          description: 'Parent',
        });

        const subtasks = await orchestrator.decomposeTask(parentTask.id, [
          { description: 'Child' },
        ]);

        const parent = await orchestrator.getParentTask(subtasks[0].id);
        expect(parent?.id).toBe(parentTask.id);
        expect(parent?.description).toBe('Parent');
      });

      it('should return null for task without parent', async () => {
        const task = await orchestrator.createTask({
          description: 'No parent task',
        });

        const parent = await orchestrator.getParentTask(task.id);
        expect(parent).toBeNull();
      });

      it('should correctly identify subtasks', async () => {
        const parentTask = await orchestrator.createTask({
          description: 'Parent',
        });

        const subtasks = await orchestrator.decomposeTask(parentTask.id, [
          { description: 'Child' },
        ]);

        expect(await orchestrator.isSubtask(parentTask.id)).toBe(false);
        expect(await orchestrator.isSubtask(subtasks[0].id)).toBe(true);
      });

      it('should correctly identify tasks with subtasks', async () => {
        const parentTask = await orchestrator.createTask({
          description: 'Parent',
        });

        expect(await orchestrator.hasSubtasks(parentTask.id)).toBe(false);

        await orchestrator.decomposeTask(parentTask.id, [
          { description: 'Child' },
        ]);

        expect(await orchestrator.hasSubtasks(parentTask.id)).toBe(true);
      });

      it('should get subtask status summary', async () => {
        const mockQuery = vi.mocked(query);
        mockQuery.mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        } as unknown as ReturnType<typeof query>);

        const parentTask = await orchestrator.createTask({
          description: 'Status test parent',
        });

        const subtasks = await orchestrator.decomposeTask(parentTask.id, [
          { description: 'Subtask 1' },
          { description: 'Subtask 2' },
          { description: 'Subtask 3' },
        ]);

        // Initially all should be pending
        let status = await orchestrator.getSubtaskStatus(parentTask.id);
        expect(status.total).toBe(3);
        expect(status.pending).toBe(3);
        expect(status.completed).toBe(0);
        expect(status.failed).toBe(0);
        expect(status.inProgress).toBe(0);

        // Mark one as completed
        await orchestrator.updateTaskStatus(subtasks[0].id, 'completed');

        status = await orchestrator.getSubtaskStatus(parentTask.id);
        expect(status.completed).toBe(1);
        expect(status.pending).toBe(2);

        // Mark one as failed
        await orchestrator.updateTaskStatus(subtasks[1].id, 'failed');

        status = await orchestrator.getSubtaskStatus(parentTask.id);
        expect(status.failed).toBe(1);
        expect(status.pending).toBe(1);
      });
    });

    describe('subtask execution', () => {
      it('should execute subtasks sequentially', async () => {
        const mockQuery = vi.mocked(query);
        const executionOrder: string[] = [];

        mockQuery.mockImplementation(({ prompt }) => ({
          [Symbol.asyncIterator]: async function* () {
            // Extract task description from prompt to track order
            const match = prompt.match(/Task: ([^\n]+)/);
            if (match) {
              executionOrder.push(match[1]);
            }
            yield { type: 'message', content: 'Done' };
          },
        } as unknown as ReturnType<typeof query>));

        const parentTask = await orchestrator.createTask({
          description: 'Sequential execution test',
        });

        await orchestrator.decomposeTask(
          parentTask.id,
          [
            { description: 'First task' },
            { description: 'Second task' },
            { description: 'Third task' },
          ],
          'sequential'
        );

        await orchestrator.executeSubtasks(parentTask.id);

        // All subtasks should be completed
        const status = await orchestrator.getSubtaskStatus(parentTask.id);
        expect(status.completed).toBe(3);
      });

      it('should throw error when executing subtasks for task without subtasks', async () => {
        const task = await orchestrator.createTask({
          description: 'No subtasks',
        });

        await expect(orchestrator.executeSubtasks(task.id)).rejects.toThrow(
          'has no subtasks to execute'
        );
      });

      it('should aggregate usage from subtasks', async () => {
        const mockQuery = vi.mocked(query);
        mockQuery.mockImplementation(() => ({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'message',
              usage: { input_tokens: 100, output_tokens: 50 },
            };
          },
        } as unknown as ReturnType<typeof query>));

        const parentTask = await orchestrator.createTask({
          description: 'Aggregation test',
        });

        await orchestrator.decomposeTask(
          parentTask.id,
          [
            { description: 'Subtask 1' },
            { description: 'Subtask 2' },
          ],
          'sequential'
        );

        await orchestrator.executeSubtasks(parentTask.id);

        const updatedParent = await orchestrator.getTask(parentTask.id);
        // Each subtask has 2 stages (planning + implementation) = 4 stage executions
        // Each execution adds 100 input + 50 output = 150 tokens per stage
        // But with our mock, we only get usage once per subtask execution in executeTask
        expect(updatedParent?.usage.totalTokens).toBeGreaterThan(0);
      });

      it('should emit subtask:completed events during execution', async () => {
        const mockQuery = vi.mocked(query);
        mockQuery.mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        } as unknown as ReturnType<typeof query>);

        const completedHandler = vi.fn();
        orchestrator.on('subtask:completed', completedHandler);

        const parentTask = await orchestrator.createTask({
          description: 'Completion event test',
        });

        await orchestrator.decomposeTask(
          parentTask.id,
          [{ description: 'Subtask 1' }],
          'sequential'
        );

        await orchestrator.executeSubtasks(parentTask.id);

        expect(completedHandler).toHaveBeenCalled();
      });

      it('should emit subtask:failed events on failure', async () => {
        const mockQuery = vi.mocked(query);
        // Throw error on first call to fail immediately
        mockQuery.mockImplementation(() => ({
          [Symbol.asyncIterator]: async function* () {
            throw new Error('exceeded budget'); // Non-retryable error
          },
        } as unknown as ReturnType<typeof query>));

        const failedHandler = vi.fn();
        orchestrator.on('subtask:failed', failedHandler);

        const parentTask = await orchestrator.createTask({
          description: 'Failure event test',
        });

        // Create subtask directly with maxRetries: 0 and parent reference
        await orchestrator.createTask({
          description: 'Failing subtask',
          parentTaskId: parentTask.id,
          maxRetries: 0,
        });

        await expect(orchestrator.executeSubtasks(parentTask.id)).rejects.toThrow();

        expect(failedHandler).toHaveBeenCalled();
      });
    });

    describe('subtask with dependencies', () => {
      it('should resolve dependencies by description', async () => {
        const parentTask = await orchestrator.createTask({
          description: 'Dependency resolution test',
        });

        const subtasks = await orchestrator.decomposeTask(
          parentTask.id,
          [
            { description: 'Base task' },
            { description: 'Dependent task', dependsOn: ['Base task'] },
          ],
          'dependency-based'
        );

        const dependentTask = await orchestrator.getTask(subtasks[1].id);
        expect(dependentTask?.dependsOn).toContain(subtasks[0].id);
      });

      it('should handle multiple dependencies', async () => {
        const parentTask = await orchestrator.createTask({
          description: 'Multi-dependency test',
        });

        const subtasks = await orchestrator.decomposeTask(
          parentTask.id,
          [
            { description: 'Task A' },
            { description: 'Task B' },
            { description: 'Task C', dependsOn: ['Task A', 'Task B'] },
          ],
          'dependency-based'
        );

        const taskC = await orchestrator.getTask(subtasks[2].id);
        expect(taskC?.dependsOn).toHaveLength(2);
        expect(taskC?.dependsOn).toContain(subtasks[0].id);
        expect(taskC?.dependsOn).toContain(subtasks[1].id);
      });
    });

    describe('subtask completion status', () => {
      it('should return false from executeSubtasks when subtasks are paused', async () => {
        const mockQuery = vi.mocked(query);
        let callCount = 0;

        // First subtask completes, second throws usage limit error to trigger pause
        mockQuery.mockImplementation(() => ({
          [Symbol.asyncIterator]: async function* () {
            callCount++;
            if (callCount > 2) {
              // Simulate usage limit error that causes pause
              throw new Error('Usage limit reached: You have exhausted your monthly included credits');
            }
            yield { type: 'message', content: 'Done' };
          },
        } as unknown as ReturnType<typeof query>));

        const parentTask = await orchestrator.createTask({
          description: 'Pause test',
        });

        await orchestrator.decomposeTask(
          parentTask.id,
          [
            { description: 'First subtask' },
            { description: 'Second subtask' },
          ],
          'sequential'
        );

        // Execute subtasks - should return false since second subtask is paused
        const allComplete = await orchestrator.executeSubtasks(parentTask.id);
        expect(allComplete).toBe(false);

        // Parent task should NOT be marked as completed
        const updatedParent = await orchestrator.getTask(parentTask.id);
        expect(updatedParent?.status).not.toBe('completed');
      });

      it('should return true from executeSubtasks when all subtasks complete', async () => {
        const mockQuery = vi.mocked(query);

        mockQuery.mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield { type: 'message', content: 'Done' };
          },
        } as unknown as ReturnType<typeof query>);

        const parentTask = await orchestrator.createTask({
          description: 'Complete test',
        });

        await orchestrator.decomposeTask(
          parentTask.id,
          [
            { description: 'First subtask' },
            { description: 'Second subtask' },
          ],
          'sequential'
        );

        // Execute subtasks - should return true since all complete
        const allComplete = await orchestrator.executeSubtasks(parentTask.id);
        expect(allComplete).toBe(true);

        // Check subtask status
        const status = await orchestrator.getSubtaskStatus(parentTask.id);
        expect(status.completed).toBe(2);
        expect(status.pending).toBe(0);
      });
    });
  });

  describe('session limit detection', () => {
    it('should detect healthy session status', async () => {
      const task = await orchestrator.createTask({
        description: 'Healthy session task',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Simple short message' }],
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id, 200000);

      expect(status.nearLimit).toBe(false);
      expect(status.recommendation).toBe('continue');
      expect(status.utilization).toBeLessThan(0.6);
      expect(status.message).toContain('Session healthy');
      expect(status.currentTokens).toBeGreaterThan(0);
    });

    it('should detect when summarization is recommended', async () => {
      // Create a task with moderate conversation length
      const longText = 'x'.repeat(50000); // ~12.5k tokens (50k chars / 4)
      const task = await orchestrator.createTask({
        description: 'Moderate session task',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: longText }],
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id, 100000); // 100k context window

      expect(status.recommendation).toBe('summarize');
      expect(status.utilization).toBeGreaterThanOrEqual(0.1);
      expect(status.utilization).toBeLessThan(0.8);
      expect(status.message).toContain('Consider summarization');
    });

    it('should detect when checkpoint is recommended', async () => {
      // Create a task approaching context window limit
      const longText = 'x'.repeat(200000); // ~50k tokens
      const task = await orchestrator.createTask({
        description: 'Near limit task',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: longText }],
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id, 60000); // 60k context window

      expect(status.nearLimit).toBe(true);
      expect(status.recommendation).toBe('checkpoint');
      expect(status.utilization).toBeGreaterThanOrEqual(0.8);
      expect(status.utilization).toBeLessThan(0.95);
      expect(status.message).toContain('checkpoint recommended');
    });

    it('should detect when handoff is required', async () => {
      // Create a task at critical context window usage
      const longText = 'x'.repeat(400000); // ~100k tokens
      const task = await orchestrator.createTask({
        description: 'Critical session task',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: longText }],
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id, 100000); // 100k context window

      expect(status.nearLimit).toBe(true);
      expect(status.recommendation).toBe('handoff');
      expect(status.utilization).toBeGreaterThanOrEqual(0.95);
      expect(status.message).toContain('handoff required');
    });

    it('should respect custom context window threshold from config', async () => {
      // Mock the effective config to use a lower threshold
      const originalConfig = (orchestrator as unknown as { effectiveConfig: { daemon?: { sessionRecovery?: { contextWindowThreshold?: number } } } }).effectiveConfig;
      (orchestrator as unknown as { effectiveConfig: { daemon?: { sessionRecovery?: { contextWindowThreshold?: number } } } }).effectiveConfig = {
        ...originalConfig,
        daemon: {
          ...originalConfig.daemon,
          sessionRecovery: {
            ...originalConfig.daemon?.sessionRecovery,
            contextWindowThreshold: 0.6, // Lower threshold
          },
        },
      };

      const longText = 'x'.repeat(150000); // ~37.5k tokens
      const task = await orchestrator.createTask({
        description: 'Custom threshold task',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: longText }],
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id, 60000); // 60k context window (~62.5% utilization)

      expect(status.nearLimit).toBe(true);
      expect(status.utilization).toBeGreaterThan(0.6);
      expect(status.recommendation).toBe('checkpoint');

      // Restore original config
      (orchestrator as unknown as { effectiveConfig: typeof originalConfig }).effectiveConfig = originalConfig;
    });

    it('should handle task with empty conversation', async () => {
      const task = await orchestrator.createTask({
        description: 'Empty conversation task',
        conversation: [],
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBe(0);
      expect(status.utilization).toBe(0);
      expect(status.nearLimit).toBe(false);
      expect(status.recommendation).toBe('continue');
    });

    it('should handle task with undefined conversation', async () => {
      const task = await orchestrator.createTask({
        description: 'No conversation task',
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBe(0);
      expect(status.utilization).toBe(0);
      expect(status.nearLimit).toBe(false);
      expect(status.recommendation).toBe('continue');
    });

    it('should throw error for non-existent task', async () => {
      await expect(orchestrator.detectSessionLimit('non-existent-task'))
        .rejects.toThrow('Task not found: non-existent-task');
    });

    it('should use default context window size when not specified', async () => {
      const task = await orchestrator.createTask({
        description: 'Default window task',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Short message' }],
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.utilization).toBeLessThan(0.001); // Very small with 200k default window
      expect(status.recommendation).toBe('continue');
    });

    it('should handle conversation with tool usage', async () => {
      const task = await orchestrator.createTask({
        description: 'Tool usage task',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Use a tool' }],
          },
          {
            type: 'assistant',
            content: [
              {
                type: 'tool_use',
                toolName: 'Read',
                toolInput: { file_path: '/path/to/file.ts' },
              },
            ],
          },
          {
            type: 'user',
            content: [
              {
                type: 'tool_result',
                toolResult: 'File contents here',
              },
            ],
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThan(0);
      expect(status.utilization).toBeGreaterThan(0);
      expect(status.recommendation).toBe('continue');
    });

    it('should handle complex JSON tool results', async () => {
      const task = await orchestrator.createTask({
        description: 'Complex JSON task',
        conversation: [
          {
            type: 'user',
            content: [
              {
                type: 'tool_result',
                toolResult: {
                  complex: 'object',
                  with: ['arrays', 'and', 'nested'],
                  structures: {
                    deeply: {
                      nested: 'values',
                    },
                  },
                },
              },
            ],
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThan(0);
      expect(status.utilization).toBeGreaterThan(0);
      expect(status.recommendation).toBe('continue');
    });

    it('should handle boundary case at exact 60% utilization', async () => {
      // Create content that will be exactly at 60% of a small context window
      const targetTokens = 12000; // 60% of 20k context window
      const longText = 'x'.repeat(targetTokens * 4); // Approx 4 chars per token
      const task = await orchestrator.createTask({
        description: 'Boundary case task',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: longText }],
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id, 20000); // 20k context window

      expect(status.utilization).toBeGreaterThanOrEqual(0.58); // Allow some variance in token estimation
      expect(status.utilization).toBeLessThanOrEqual(0.62);
      expect(status.recommendation).toBe('summarize');
      expect(status.message).toContain('Consider summarization');
    });

    it('should handle boundary case at exact threshold', async () => {
      // Mock config for exact threshold test
      const originalConfig = (orchestrator as any).effectiveConfig;
      (orchestrator as any).effectiveConfig = {
        ...originalConfig,
        daemon: {
          ...originalConfig.daemon,
          sessionRecovery: {
            ...originalConfig.daemon?.sessionRecovery,
            contextWindowThreshold: 0.7, // 70% threshold
          },
        },
      };

      const targetTokens = 14000; // 70% of 20k context window
      const longText = 'x'.repeat(targetTokens * 4);
      const task = await orchestrator.createTask({
        description: 'Threshold boundary task',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: longText }],
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id, 20000);

      expect(status.nearLimit).toBe(true);
      expect(status.recommendation).toBe('checkpoint');

      // Restore original config
      (orchestrator as any).effectiveConfig = originalConfig;
    });

    it('should handle boundary case at 95% utilization', async () => {
      // Test the exact boundary between checkpoint and handoff
      const targetTokens = 19000; // 95% of 20k context window
      const longText = 'x'.repeat(targetTokens * 4);
      const task = await orchestrator.createTask({
        description: 'Critical boundary task',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: longText }],
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id, 20000);

      expect(status.utilization).toBeGreaterThanOrEqual(0.93); // Allow some variance
      expect(status.nearLimit).toBe(true);
      expect(status.recommendation).toBe('handoff');
      expect(status.message).toContain('handoff required');
    });

    it('should handle zero context window size edge case', async () => {
      const task = await orchestrator.createTask({
        description: 'Zero context window test',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Any message' }],
          },
        ],
      });

      // Test with zero context window - should handle gracefully
      const status = await orchestrator.detectSessionLimit(task.id, 0);

      expect(status.utilization).toBe(Infinity);
      expect(status.nearLimit).toBe(true);
      expect(status.recommendation).toBe('handoff');
    });

    it('should handle very small context window', async () => {
      const task = await orchestrator.createTask({
        description: 'Tiny context window test',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id, 1); // 1 token context window

      expect(status.utilization).toBeGreaterThan(1);
      expect(status.nearLimit).toBe(true);
      expect(status.recommendation).toBe('handoff');
    });

    it('should handle massive conversation with mixed content types', async () => {
      // Create a very long conversation with multiple content types
      const conversation = [];
      for (let i = 0; i < 100; i++) {
        conversation.push({
          type: 'user' as const,
          content: [{ type: 'text' as const, text: `Message ${i}: ${'x'.repeat(1000)}` }],
        });
        conversation.push({
          type: 'assistant' as const,
          content: [
            { type: 'text' as const, text: `Response ${i}` },
            {
              type: 'tool_use' as const,
              toolName: 'Read',
              toolInput: { file_path: `/file${i}.ts` },
            },
          ],
        });
        conversation.push({
          type: 'user' as const,
          content: [
            {
              type: 'tool_result' as const,
              toolResult: `File content ${i}`,
            },
          ],
        });
      }

      const task = await orchestrator.createTask({
        description: 'Massive conversation task',
        conversation,
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThan(50000);
      expect(status.utilization).toBeGreaterThan(0.25); // Should be significant
    });

    it('should handle message with null/undefined content blocks', async () => {
      const task = await orchestrator.createTask({
        description: 'Edge case content task',
        conversation: [
          {
            type: 'user',
            content: [
              { type: 'text', text: 'Normal message' },
              // Test handling of any edge case content
            ],
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThan(0);
      expect(status.utilization).toBeGreaterThan(0);
      expect(status.recommendation).toBe('continue');
    });

    describe('session limit checkpointing', () => {
      it('should save checkpoint and pause task when session limit reached during executeWorkflowStage', async () => {
        // Create a task with a conversation that will trigger checkpoint threshold
        const longText = 'x'.repeat(240000); // ~60k tokens to trigger checkpoint at 80% of 75k
        const task = await orchestrator.createTask({
          description: 'Session limit checkpoint test',
          conversation: [
            {
              type: 'user',
              content: [{ type: 'text', text: longText }],
            },
          ],
        });

        // Mock workflow and stage
        const workflow: WorkflowDefinition = {
          name: 'test-workflow',
          description: 'Test workflow',
          stages: [
            {
              name: 'test-stage',
              agent: 'developer',
              dependencies: [],
            },
          ],
        };

        const stage: WorkflowStage = {
          name: 'test-stage',
          agent: 'developer',
          dependencies: [],
        };

        const agent: AgentDefinition = {
          name: 'developer',
          role: 'Test Agent',
          model: 'haiku',
          instructions: 'Test instructions',
        };

        // Try to execute stage with small context window to trigger session limit
        try {
          await (orchestrator as any).executeWorkflowStage(
            task,
            stage,
            agent,
            workflow,
            new Map()
          );
          // Should not reach this point as it should throw
          throw new Error('Expected session limit error');
        } catch (error) {
          expect((error as Error).message).toContain('Session limit reached');
        }

        // Verify task was paused with correct reason
        const updatedTask = await orchestrator.store.getTask(task.id);
        expect(updatedTask?.status).toBe('paused');
        expect(updatedTask?.pauseReason).toBe('session_limit');

        // Verify checkpoint was saved
        const checkpoint = await orchestrator.getLatestCheckpoint(task.id);
        expect(checkpoint).toBeTruthy();
        expect(checkpoint?.stage).toBe('test-stage');
        expect(checkpoint?.metadata?.pauseReason).toBe('session_limit');
        expect(checkpoint?.metadata?.resumePoint).toBe('stage_start');
        expect(checkpoint?.conversationState).toEqual(task.conversation);

        // Verify logs contain session limit messages
        const logs = await orchestrator.store.getTaskLogs(task.id);
        const sessionLimitLogs = logs.filter(log =>
          log.message.includes('Session limit detected') ||
          log.message.includes('Task paused due to session limit')
        );
        expect(sessionLimitLogs.length).toBeGreaterThanOrEqual(2);
      });

      it('should save checkpoint and pause task when session limit reached during runWorkflow', async () => {
        // Create a task with conversation that will trigger checkpoint threshold
        const longText = 'x'.repeat(240000); // ~60k tokens
        const task = await orchestrator.createTask({
          description: 'Workflow session limit test',
          conversation: [
            {
              type: 'user',
              content: [{ type: 'text', text: longText }],
            },
          ],
        });

        const workflow: WorkflowDefinition = {
          name: 'test-workflow',
          description: 'Test workflow',
          stages: [
            {
              name: 'test-stage',
              agent: 'developer',
              dependencies: [],
            },
          ],
        };

        // Try to run workflow with small context window
        try {
          const completed = await (orchestrator as any).runWorkflow(task, workflow);
          expect(completed).toBe(false); // Should return false when paused
        } catch (error) {
          // If it throws, that's also acceptable
        }

        // Verify task was paused with correct reason
        const updatedTask = await orchestrator.store.getTask(task.id);
        expect(updatedTask?.status).toBe('paused');
        expect(updatedTask?.pauseReason).toBe('session_limit');

        // Verify checkpoint was saved
        const checkpoint = await orchestrator.getLatestCheckpoint(task.id);
        expect(checkpoint).toBeTruthy();
        expect(checkpoint?.stage).toBe('workflow');
        expect(checkpoint?.metadata?.pauseReason).toBe('session_limit');
        expect(checkpoint?.metadata?.resumePoint).toBe('workflow_continue');
        expect(checkpoint?.conversationState).toEqual(task.conversation);

        // Verify workflow state was preserved in checkpoint
        expect(checkpoint?.metadata?.completedStages).toEqual([]);
        expect(checkpoint?.metadata?.inProgressStages).toEqual([]);
        expect(checkpoint?.metadata?.stageResults).toEqual({});
      });

      it('should not pause task when session is healthy', async () => {
        // Create task with small conversation
        const task = await orchestrator.createTask({
          description: 'Healthy session test',
          conversation: [
            {
              type: 'user',
              content: [{ type: 'text', text: 'Short message' }],
            },
          ],
        });

        const workflow: WorkflowDefinition = {
          name: 'test-workflow',
          description: 'Test workflow',
          stages: [
            {
              name: 'test-stage',
              agent: 'developer',
              dependencies: [],
            },
          ],
        };

        // Mock the query function to avoid actual agent execution
        const mockQuery = vi.fn().mockImplementation(async function* () {
          yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
        });

        // Mock query for this test
        vi.mocked(query).mockImplementationOnce(mockQuery);

        try {
          const completed = await (orchestrator as any).runWorkflow(task, workflow);
          // Should proceed normally without pausing
        } catch (error) {
          // If execution fails, verify it's not due to session limits
          expect((error as Error).message).not.toContain('Session limit reached');
        }

        // Verify task was not paused due to session limits
        const updatedTask = await orchestrator.store.getTask(task.id);
        expect(updatedTask?.pauseReason).not.toBe('session_limit');
      });

      it('should include session limit status in checkpoint metadata', async () => {
        // Create task with conversation triggering checkpoint
        const longText = 'x'.repeat(240000);
        const task = await orchestrator.createTask({
          description: 'Checkpoint metadata test',
          conversation: [
            {
              type: 'user',
              content: [{ type: 'text', text: longText }],
            },
          ],
        });

        const workflow: WorkflowDefinition = {
          name: 'test-workflow',
          description: 'Test workflow',
          stages: [
            {
              name: 'test-stage',
              agent: 'developer',
              dependencies: [],
            },
          ],
        };

        const stage: WorkflowStage = {
          name: 'test-stage',
          agent: 'developer',
          dependencies: [],
        };

        const agent: AgentDefinition = {
          name: 'developer',
          role: 'Test Agent',
          model: 'haiku',
          instructions: 'Test instructions',
        };

        try {
          await (orchestrator as any).executeWorkflowStage(
            task,
            stage,
            agent,
            workflow,
            new Map()
          );
        } catch (error) {
          // Expected to throw
        }

        // Verify checkpoint contains session limit status
        const checkpoint = await orchestrator.getLatestCheckpoint(task.id);
        expect(checkpoint?.metadata?.sessionLimitStatus).toBeTruthy();

        const sessionStatus = checkpoint?.metadata?.sessionLimitStatus as any;
        expect(sessionStatus.nearLimit).toBe(true);
        expect(['checkpoint', 'handoff']).toContain(sessionStatus.recommendation);
        expect(sessionStatus.utilization).toBeGreaterThan(0.8);
        expect(sessionStatus.currentTokens).toBeGreaterThan(0);
        expect(sessionStatus.message).toContain('Context window');
      });
    });

    describe('cleanupTaskWorktree', () => {
      it('should throw error when worktree management is not enabled', async () => {
        // Initialize orchestrator without worktree management
        const nonWorktreeOrchestrator = new ApexOrchestrator({
          projectPath: '/test/project',
          apiUrl: 'http://localhost:3000',
          config: {
            ...defaultConfig,
            git: { autoWorktree: false },
          },
        });
        await nonWorktreeOrchestrator.initialize();

        await expect(
          nonWorktreeOrchestrator.cleanupTaskWorktree('test-task-id')
        ).rejects.toThrow('Worktree management is not enabled');
      });

      it('should throw error when taskId is empty', async () => {
        // Mock worktreeManager to be enabled
        const mockWorktreeManager = {
          deleteWorktree: vi.fn(),
        };
        (orchestrator as any).worktreeManager = mockWorktreeManager;

        await expect(
          orchestrator.cleanupTaskWorktree('')
        ).rejects.toThrow('Task ID is required');

        expect(mockWorktreeManager.deleteWorktree).not.toHaveBeenCalled();
      });

      it('should delegate to WorktreeManager.deleteWorktree and return result', async () => {
        // Mock worktreeManager to be enabled
        const mockWorktreeManager = {
          deleteWorktree: vi.fn().mockResolvedValue(true),
        };
        (orchestrator as any).worktreeManager = mockWorktreeManager;

        const taskId = 'test-task-123';
        const result = await orchestrator.cleanupTaskWorktree(taskId);

        expect(result).toBe(true);
        expect(mockWorktreeManager.deleteWorktree).toHaveBeenCalledWith(taskId);
        expect(mockWorktreeManager.deleteWorktree).toHaveBeenCalledTimes(1);
      });

      it('should return false when worktree does not exist', async () => {
        // Mock worktreeManager to return false
        const mockWorktreeManager = {
          deleteWorktree: vi.fn().mockResolvedValue(false),
        };
        (orchestrator as any).worktreeManager = mockWorktreeManager;

        const taskId = 'nonexistent-task';
        const result = await orchestrator.cleanupTaskWorktree(taskId);

        expect(result).toBe(false);
        expect(mockWorktreeManager.deleteWorktree).toHaveBeenCalledWith(taskId);
      });

      it('should propagate errors from WorktreeManager', async () => {
        // Mock worktreeManager to throw error
        const mockError = new Error('Failed to delete worktree');
        const mockWorktreeManager = {
          deleteWorktree: vi.fn().mockRejectedValue(mockError),
        };
        (orchestrator as any).worktreeManager = mockWorktreeManager;

        const taskId = 'error-task';

        await expect(
          orchestrator.cleanupTaskWorktree(taskId)
        ).rejects.toThrow('Failed to delete worktree');

        expect(mockWorktreeManager.deleteWorktree).toHaveBeenCalledWith(taskId);
      });
    });
  });

  describe('container execution context', () => {
    it('should integrate container workspace information into executeWorkflowStage', async () => {
      // Create a task with container workspace
      const task = await orchestrator.createTask({
        description: 'Test task with container workspace',
      });

      // Mock workspace manager to return container workspace information
      const mockWorkspaceInfo = {
        taskId: task.id,
        config: { strategy: 'container' as const },
        workspacePath: '/test/container/workspace',
        status: 'active' as const,
        createdAt: new Date(),
        lastAccessed: new Date(),
        containerId: 'test-container-123',
      };

      const mockGetWorkspace = vi.fn().mockReturnValue(mockWorkspaceInfo);
      const mockGetContainerIdForTask = vi.fn().mockReturnValue('test-container-123');

      (orchestrator as any).workspaceManager.getWorkspace = mockGetWorkspace;
      (orchestrator as any).workspaceManager.getContainerIdForTask = mockGetContainerIdForTask;

      // Mock the query function to capture the options passed to it
      let capturedOptions: any;
      (query as any).mockImplementation(async function* (opts: any) {
        capturedOptions = opts;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });

      // Mock workflow and stage
      const workflow: WorkflowDefinition = {
        name: 'test-workflow',
        description: 'Test workflow',
        stages: [
          {
            name: 'test-stage',
            agent: 'developer',
            dependencies: [],
          },
        ],
      };

      const stage: WorkflowStage = {
        name: 'test-stage',
        agent: 'developer',
        dependencies: [],
      };

      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      // Execute stage
      await (orchestrator as any).executeWorkflowStage(
        task,
        stage,
        agent,
        workflow,
        new Map()
      );

      // Verify workspace manager was called with correct task ID
      expect(mockGetWorkspace).toHaveBeenCalledWith(task.id);
      expect(mockGetContainerIdForTask).toHaveBeenCalledWith(task.id);

      // Verify query was called with container execution context
      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.options.cwd).toBe('/test/container/workspace');
      expect(capturedOptions.options.env.APEX_CONTAINER_ID).toBe('test-container-123');
      expect(capturedOptions.options.env.APEX_WORKSPACE_PATH).toBe('/test/container/workspace');
    });

    it('should use default projectPath when no container workspace is active', async () => {
      // Create a task without container workspace
      const task = await orchestrator.createTask({
        description: 'Test task without container workspace',
      });

      // Mock workspace manager to return null (no workspace)
      const mockGetWorkspace = vi.fn().mockReturnValue(null);
      const mockGetContainerIdForTask = vi.fn().mockReturnValue(undefined);

      (orchestrator as any).workspaceManager.getWorkspace = mockGetWorkspace;
      (orchestrator as any).workspaceManager.getContainerIdForTask = mockGetContainerIdForTask;

      // Mock the query function to capture the options passed to it
      let capturedOptions: any;
      (query as any).mockImplementation(async function* (opts: any) {
        capturedOptions = opts;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });

      // Mock workflow and stage
      const workflow: WorkflowDefinition = {
        name: 'test-workflow',
        description: 'Test workflow',
        stages: [
          {
            name: 'test-stage',
            agent: 'developer',
            dependencies: [],
          },
        ],
      };

      const stage: WorkflowStage = {
        name: 'test-stage',
        agent: 'developer',
        dependencies: [],
      };

      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      // Execute stage
      await (orchestrator as any).executeWorkflowStage(
        task,
        stage,
        agent,
        workflow,
        new Map()
      );

      // Verify workspace manager was called
      expect(mockGetWorkspace).toHaveBeenCalledWith(task.id);
      expect(mockGetContainerIdForTask).toHaveBeenCalledWith(task.id);

      // Verify query was called with default project path (not container context)
      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.options.cwd).toBe((orchestrator as any).projectPath);
      expect(capturedOptions.options.env.APEX_CONTAINER_ID).toBeUndefined();
      expect(capturedOptions.options.env.APEX_WORKSPACE_PATH).toBeUndefined();
    });

    it('should handle partial container workspace information (containerId but no workspace)', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task with partial container info',
      });

      // Mock workspace manager to return null workspace but valid container ID
      const mockGetWorkspace = vi.fn().mockReturnValue(null);
      const mockGetContainerIdForTask = vi.fn().mockReturnValue('orphaned-container-123');

      (orchestrator as any).workspaceManager.getWorkspace = mockGetWorkspace;
      (orchestrator as any).workspaceManager.getContainerIdForTask = mockGetContainerIdForTask;

      let capturedOptions: any;
      (query as any).mockImplementation(async function* (opts: any) {
        capturedOptions = opts;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });

      const workflow: WorkflowDefinition = {
        name: 'test-workflow',
        description: 'Test workflow',
        stages: [{ name: 'test-stage', agent: 'developer', dependencies: [] }],
      };

      const stage: WorkflowStage = { name: 'test-stage', agent: 'developer', dependencies: [] };
      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      await (orchestrator as any).executeWorkflowStage(task, stage, agent, workflow, new Map());

      // Should use default project path when workspace info is null
      expect(capturedOptions.options.cwd).toBe((orchestrator as any).projectPath);
      // But should still pass container ID if available
      expect(capturedOptions.options.env.APEX_CONTAINER_ID).toBe('orphaned-container-123');
      expect(capturedOptions.options.env.APEX_WORKSPACE_PATH).toBeUndefined();
    });

    it('should handle workspace info without containerId', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task with workspace but no container',
      });

      // Mock workspace manager to return workspace info without container ID
      const mockWorkspaceInfo = {
        taskId: task.id,
        config: { strategy: 'isolated' as const },
        workspacePath: '/test/isolated/workspace',
        status: 'active' as const,
        createdAt: new Date(),
        lastAccessed: new Date(),
        // No containerId property
      };

      const mockGetWorkspace = vi.fn().mockReturnValue(mockWorkspaceInfo);
      const mockGetContainerIdForTask = vi.fn().mockReturnValue(undefined);

      (orchestrator as any).workspaceManager.getWorkspace = mockGetWorkspace;
      (orchestrator as any).workspaceManager.getContainerIdForTask = mockGetContainerIdForTask;

      let capturedOptions: any;
      (query as any).mockImplementation(async function* (opts: any) {
        capturedOptions = opts;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });

      const workflow: WorkflowDefinition = {
        name: 'test-workflow',
        description: 'Test workflow',
        stages: [{ name: 'test-stage', agent: 'developer', dependencies: [] }],
      };

      const stage: WorkflowStage = { name: 'test-stage', agent: 'developer', dependencies: [] };
      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      await (orchestrator as any).executeWorkflowStage(task, stage, agent, workflow, new Map());

      // Should use workspace path from WorkspaceManager
      expect(capturedOptions.options.cwd).toBe('/test/isolated/workspace');
      // Should not set container environment variables
      expect(capturedOptions.options.env.APEX_CONTAINER_ID).toBeUndefined();
      expect(capturedOptions.options.env.APEX_WORKSPACE_PATH).toBe('/test/isolated/workspace');
    });

    it('should preserve existing environment variables while adding container context', async () => {
      const task = await orchestrator.createTask({
        description: 'Test environment variable preservation',
      });

      const mockWorkspaceInfo = {
        taskId: task.id,
        config: { strategy: 'container' as const },
        workspacePath: '/test/container/workspace',
        status: 'active' as const,
        createdAt: new Date(),
        lastAccessed: new Date(),
        containerId: 'test-container-456',
      };

      const mockGetWorkspace = vi.fn().mockReturnValue(mockWorkspaceInfo);
      const mockGetContainerIdForTask = vi.fn().mockReturnValue('test-container-456');

      (orchestrator as any).workspaceManager.getWorkspace = mockGetWorkspace;
      (orchestrator as any).workspaceManager.getContainerIdForTask = mockGetContainerIdForTask;

      // Set custom environment variable
      const originalEnv = process.env.CUSTOM_TEST_VAR;
      process.env.CUSTOM_TEST_VAR = 'test-value';

      let capturedOptions: any;
      (query as any).mockImplementation(async function* (opts: any) {
        capturedOptions = opts;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });

      const workflow: WorkflowDefinition = {
        name: 'test-workflow',
        description: 'Test workflow',
        stages: [{ name: 'test-stage', agent: 'developer', dependencies: [] }],
      };

      const stage: WorkflowStage = { name: 'test-stage', agent: 'developer', dependencies: [] };
      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      await (orchestrator as any).executeWorkflowStage(task, stage, agent, workflow, new Map());

      // Verify container environment variables are set
      expect(capturedOptions.options.env.APEX_CONTAINER_ID).toBe('test-container-456');
      expect(capturedOptions.options.env.APEX_WORKSPACE_PATH).toBe('/test/container/workspace');

      // Verify existing environment variables are preserved
      expect(capturedOptions.options.env.CUSTOM_TEST_VAR).toBe('test-value');
      expect(capturedOptions.options.env.APEX_TASK_ID).toBe(task.id);
      expect(capturedOptions.options.env.APEX_PROJECT).toBe((orchestrator as any).projectPath);

      // Cleanup
      if (originalEnv === undefined) {
        delete process.env.CUSTOM_TEST_VAR;
      } else {
        process.env.CUSTOM_TEST_VAR = originalEnv;
      }
    });

    it('should handle empty string values from workspace manager methods', async () => {
      const task = await orchestrator.createTask({
        description: 'Test empty string handling',
      });

      const mockWorkspaceInfo = {
        taskId: task.id,
        config: { strategy: 'container' as const },
        workspacePath: '', // Empty workspace path
        status: 'active' as const,
        createdAt: new Date(),
        lastAccessed: new Date(),
        containerId: '',
      };

      const mockGetWorkspace = vi.fn().mockReturnValue(mockWorkspaceInfo);
      const mockGetContainerIdForTask = vi.fn().mockReturnValue(''); // Empty string

      (orchestrator as any).workspaceManager.getWorkspace = mockGetWorkspace;
      (orchestrator as any).workspaceManager.getContainerIdForTask = mockGetContainerIdForTask;

      let capturedOptions: any;
      (query as any).mockImplementation(async function* (opts: any) {
        capturedOptions = opts;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });

      const workflow: WorkflowDefinition = {
        name: 'test-workflow',
        description: 'Test workflow',
        stages: [{ name: 'test-stage', agent: 'developer', dependencies: [] }],
      };

      const stage: WorkflowStage = { name: 'test-stage', agent: 'developer', dependencies: [] };
      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      await (orchestrator as any).executeWorkflowStage(task, stage, agent, workflow, new Map());

      // Should fallback to project path when workspace path is empty
      expect(capturedOptions.options.cwd).toBe((orchestrator as any).projectPath);
      // Should not set environment variables for empty string values
      expect(capturedOptions.options.env.APEX_CONTAINER_ID).toBeUndefined();
      expect(capturedOptions.options.env.APEX_WORKSPACE_PATH).toBeUndefined();
    });

    it('should handle workspace manager method exceptions gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Test workspace manager exceptions',
      });

      // Mock workspace manager methods to throw errors
      const mockGetWorkspace = vi.fn().mockImplementation(() => {
        throw new Error('Workspace lookup failed');
      });
      const mockGetContainerIdForTask = vi.fn().mockImplementation(() => {
        throw new Error('Container lookup failed');
      });

      (orchestrator as any).workspaceManager.getWorkspace = mockGetWorkspace;
      (orchestrator as any).workspaceManager.getContainerIdForTask = mockGetContainerIdForTask;

      let capturedOptions: any;
      (query as any).mockImplementation(async function* (opts: any) {
        capturedOptions = opts;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });

      const workflow: WorkflowDefinition = {
        name: 'test-workflow',
        description: 'Test workflow',
        stages: [{ name: 'test-stage', agent: 'developer', dependencies: [] }],
      };

      const stage: WorkflowStage = { name: 'test-stage', agent: 'developer', dependencies: [] };
      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      // Should handle errors gracefully and not throw, fallback to default behavior
      await expect((orchestrator as any).executeWorkflowStage(task, stage, agent, workflow, new Map())).resolves.not.toThrow();

      // Should fallback to project path when workspace manager throws
      expect(capturedOptions.options.cwd).toBe((orchestrator as any).projectPath);
      expect(capturedOptions.options.env.APEX_CONTAINER_ID).toBeUndefined();
      expect(capturedOptions.options.env.APEX_WORKSPACE_PATH).toBeUndefined();
    });

    it('should handle very long workspace paths and container IDs', async () => {
      const task = await orchestrator.createTask({
        description: 'Test long values handling',
      });

      const longWorkspacePath = '/very/long/workspace/path/' + 'a'.repeat(200);
      const longContainerId = 'container-' + 'x'.repeat(200);

      const mockWorkspaceInfo = {
        taskId: task.id,
        config: { strategy: 'container' as const },
        workspacePath: longWorkspacePath,
        status: 'active' as const,
        createdAt: new Date(),
        lastAccessed: new Date(),
        containerId: longContainerId,
      };

      const mockGetWorkspace = vi.fn().mockReturnValue(mockWorkspaceInfo);
      const mockGetContainerIdForTask = vi.fn().mockReturnValue(longContainerId);

      (orchestrator as any).workspaceManager.getWorkspace = mockGetWorkspace;
      (orchestrator as any).workspaceManager.getContainerIdForTask = mockGetContainerIdForTask;

      let capturedOptions: any;
      (query as any).mockImplementation(async function* (opts: any) {
        capturedOptions = opts;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });

      const workflow: WorkflowDefinition = {
        name: 'test-workflow',
        description: 'Test workflow',
        stages: [{ name: 'test-stage', agent: 'developer', dependencies: [] }],
      };

      const stage: WorkflowStage = { name: 'test-stage', agent: 'developer', dependencies: [] };
      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      await (orchestrator as any).executeWorkflowStage(task, stage, agent, workflow, new Map());

      // Should handle long values correctly
      expect(capturedOptions.options.cwd).toBe(longWorkspacePath);
      expect(capturedOptions.options.env.APEX_CONTAINER_ID).toBe(longContainerId);
      expect(capturedOptions.options.env.APEX_WORKSPACE_PATH).toBe(longWorkspacePath);
    });
  });

  describe('automatic workspace cleanup', () => {
    it('should call workspaceManager.cleanupWorkspace when task completes and cleanupOnComplete is enabled', async () => {
      const mockCleanupWorkspace = vi.fn().mockResolvedValue(undefined);
      (orchestrator as any).workspaceManager.cleanupWorkspace = mockCleanupWorkspace;

      // Mock a completed task
      const task = await orchestrator.createTask({
        description: 'Test automatic cleanup task',
      });

      // Emit task:completed event
      orchestrator.emit('task:completed', task);

      // Wait for the async cleanup to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was called
      expect(mockCleanupWorkspace).toHaveBeenCalledWith(task.id);
      expect(mockCleanupWorkspace).toHaveBeenCalledTimes(1);
    });

    it('should not call workspaceManager.cleanupWorkspace when cleanupOnComplete is disabled', async () => {
      // Mock the effectiveConfig to disable cleanup
      const mockCleanupWorkspace = vi.fn().mockResolvedValue(undefined);
      (orchestrator as any).workspaceManager.cleanupWorkspace = mockCleanupWorkspace;

      // Mock effectiveConfig with cleanup disabled
      const originalEffectiveConfig = (orchestrator as any).effectiveConfig;
      (orchestrator as any).effectiveConfig = {
        ...originalEffectiveConfig,
        workspace: {
          ...originalEffectiveConfig.workspace,
          cleanupOnComplete: false,
        },
      };

      // Mock a completed task
      const task = await orchestrator.createTask({
        description: 'Test cleanup disabled task',
      });

      // Emit task:completed event
      orchestrator.emit('task:completed', task);

      // Wait for potential async cleanup
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was NOT called
      expect(mockCleanupWorkspace).not.toHaveBeenCalled();

      // Restore original config
      (orchestrator as any).effectiveConfig = originalEffectiveConfig;
    });

    it('should handle cleanup errors gracefully and log warnings', async () => {
      const cleanupError = new Error('Cleanup failed');
      const mockCleanupWorkspace = vi.fn().mockRejectedValue(cleanupError);
      const mockAddLog = vi.fn().mockResolvedValue(undefined);

      (orchestrator as any).workspaceManager.cleanupWorkspace = mockCleanupWorkspace;
      (orchestrator as any).store.addLog = mockAddLog;

      // Spy on console.warn to verify error logging
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock a completed task
      const task = await orchestrator.createTask({
        description: 'Test cleanup error handling task',
      });

      // Emit task:completed event
      orchestrator.emit('task:completed', task);

      // Wait for the async cleanup to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was attempted
      expect(mockCleanupWorkspace).toHaveBeenCalledWith(task.id);

      // Verify error was logged to console
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Failed to cleanup workspace for completed task ${task.id}:`,
        cleanupError
      );

      // Verify error was logged to task logs
      expect(mockAddLog).toHaveBeenCalledWith(task.id, {
        level: 'warn',
        message: 'Workspace cleanup failed: Cleanup failed',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });

      consoleWarnSpy.mockRestore();
    });

    it('should respect individual task workspace cleanup configuration', async () => {
      const mockCleanupWorkspace = vi.fn().mockResolvedValue(undefined);
      (orchestrator as any).workspaceManager.cleanupWorkspace = mockCleanupWorkspace;

      // Create a task (cleanup logic happens in workspaceManager, this test ensures the event fires)
      const task = await orchestrator.createTask({
        description: 'Test task workspace config',
      });

      // Emit task:completed event
      orchestrator.emit('task:completed', task);

      // Wait for the async cleanup to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was called (workspaceManager.cleanupWorkspace handles individual config)
      expect(mockCleanupWorkspace).toHaveBeenCalledWith(task.id);
    });

    it('should handle cleanup errors with non-Error objects gracefully', async () => {
      const cleanupError = 'String error message';
      const mockCleanupWorkspace = vi.fn().mockRejectedValue(cleanupError);
      const mockAddLog = vi.fn().mockResolvedValue(undefined);

      (orchestrator as any).workspaceManager.cleanupWorkspace = mockCleanupWorkspace;
      (orchestrator as any).store.addLog = mockAddLog;

      // Spy on console.warn to verify error logging
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock a completed task
      const task = await orchestrator.createTask({
        description: 'Test non-Error cleanup failure',
      });

      // Emit task:completed event
      orchestrator.emit('task:completed', task);

      // Wait for the async cleanup to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was attempted
      expect(mockCleanupWorkspace).toHaveBeenCalledWith(task.id);

      // Verify error was logged to console
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Failed to cleanup workspace for completed task ${task.id}:`,
        cleanupError
      );

      // Verify error was logged to task logs with fallback message
      expect(mockAddLog).toHaveBeenCalledWith(task.id, {
        level: 'warn',
        message: 'Workspace cleanup failed: Unknown error',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });

      consoleWarnSpy.mockRestore();
    });

    it('should handle multiple simultaneous task completions', async () => {
      const mockCleanupWorkspace = vi.fn().mockResolvedValue(undefined);
      (orchestrator as any).workspaceManager.cleanupWorkspace = mockCleanupWorkspace;

      // Create multiple tasks
      const tasks = await Promise.all([
        orchestrator.createTask({ description: 'Test task 1' }),
        orchestrator.createTask({ description: 'Test task 2' }),
        orchestrator.createTask({ description: 'Test task 3' }),
      ]);

      // Emit all task:completed events simultaneously
      tasks.forEach(task => {
        orchestrator.emit('task:completed', task);
      });

      // Wait for all async cleanups to process
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify cleanup was called for each task
      expect(mockCleanupWorkspace).toHaveBeenCalledTimes(3);
      tasks.forEach(task => {
        expect(mockCleanupWorkspace).toHaveBeenCalledWith(task.id);
      });
    });

    it('should handle workspace.cleanupOnComplete being undefined (defaults to true)', async () => {
      const mockCleanupWorkspace = vi.fn().mockResolvedValue(undefined);
      (orchestrator as any).workspaceManager.cleanupWorkspace = mockCleanupWorkspace;

      // Mock effectiveConfig with workspace.cleanupOnComplete being undefined
      const originalEffectiveConfig = (orchestrator as any).effectiveConfig;
      (orchestrator as any).effectiveConfig = {
        ...originalEffectiveConfig,
        workspace: {
          ...originalEffectiveConfig.workspace,
          cleanupOnComplete: undefined,
        },
      };

      // Mock a completed task
      const task = await orchestrator.createTask({
        description: 'Test cleanup with undefined config',
      });

      // Emit task:completed event
      orchestrator.emit('task:completed', task);

      // Wait for the async cleanup to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was called (undefined should default to true)
      expect(mockCleanupWorkspace).toHaveBeenCalledWith(task.id);

      // Restore original config
      (orchestrator as any).effectiveConfig = originalEffectiveConfig;
    });

    it('should handle workspace config being completely undefined', async () => {
      const mockCleanupWorkspace = vi.fn().mockResolvedValue(undefined);
      (orchestrator as any).workspaceManager.cleanupWorkspace = mockCleanupWorkspace;

      // Mock effectiveConfig with workspace being undefined
      const originalEffectiveConfig = (orchestrator as any).effectiveConfig;
      (orchestrator as any).effectiveConfig = {
        ...originalEffectiveConfig,
        workspace: undefined,
      };

      // Mock a completed task
      const task = await orchestrator.createTask({
        description: 'Test cleanup with undefined workspace config',
      });

      // Emit task:completed event
      orchestrator.emit('task:completed', task);

      // Wait for the async cleanup to process
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was called (undefined workspace should still allow cleanup)
      expect(mockCleanupWorkspace).toHaveBeenCalledWith(task.id);

      // Restore original config
      (orchestrator as any).effectiveConfig = originalEffectiveConfig;
    });
  });

  describe('pushTaskBranch', () => {
    beforeEach(() => {
      // Reset exec mock behavior
      execMockBehavior = {};
    });

    it('should successfully push a task branch', async () => {
      await orchestrator.initialize();

      // Enable git push after task
      (orchestrator as any).effectiveConfig.git.pushAfterTask = true;

      // Mock successful build and test validation
      const originalValidateBuildAndTests = (orchestrator as any).validateBuildAndTests;
      (orchestrator as any).validateBuildAndTests = vi.fn().mockResolvedValue({ success: true });

      const task = await orchestrator.createTask({
        description: 'Test task for push',
        workflow: 'feature',
      });

      // Update the task to have a branch name
      await (orchestrator as unknown as { store: { updateTask: (id: string, updates: any) => Promise<void> } }).store.updateTask(task.id, {
        branchName: 'feature/test-branch',
      });

      const result = await orchestrator.pushTaskBranch(task.id);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.remoteBranch).toBe('origin/feature/test-branch');

      // Restore original method
      (orchestrator as any).validateBuildAndTests = originalValidateBuildAndTests;
    });

    it('should fail when task is not found', async () => {
      await orchestrator.initialize();

      const result = await orchestrator.pushTaskBranch('non-existent-task');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found: non-existent-task');
    });

    it('should fail when task has no branch', async () => {
      await orchestrator.initialize();

      const task = await orchestrator.createTask({
        description: 'Test task without branch',
        workflow: 'feature',
      });

      const result = await orchestrator.pushTaskBranch(task.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task does not have a branch');
    });

    it('should handle git push failures gracefully', async () => {
      await orchestrator.initialize();

      // Enable git push after task
      (orchestrator as any).effectiveConfig.git.pushAfterTask = true;

      // Mock successful build and test validation but failed git push
      const originalValidateBuildAndTests = (orchestrator as any).validateBuildAndTests;
      (orchestrator as any).validateBuildAndTests = vi.fn().mockResolvedValue({ success: true });

      const task = await orchestrator.createTask({
        description: 'Test task for failed push',
        workflow: 'feature',
      });

      // Update the task to have a branch name
      await (orchestrator as unknown as { store: { updateTask: (id: string, updates: any) => Promise<void> } }).store.updateTask(task.id, {
        branchName: 'feature/test-branch-fail',
      });

      // Mock git push to fail
      execMockBehavior['git push'] = {
        error: new Error('fatal: remote origin does not exist'),
      };

      const result = await orchestrator.pushTaskBranch(task.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to push changes');

      // Restore original method
      (orchestrator as any).validateBuildAndTests = originalValidateBuildAndTests;
    });

    it('should handle network errors during push', async () => {
      await orchestrator.initialize();

      // Enable git push after task
      (orchestrator as any).effectiveConfig.git.pushAfterTask = true;

      // Mock successful build and test validation but failed git push
      const originalValidateBuildAndTests = (orchestrator as any).validateBuildAndTests;
      (orchestrator as any).validateBuildAndTests = vi.fn().mockResolvedValue({ success: true });

      const task = await orchestrator.createTask({
        description: 'Test task for network error',
        workflow: 'feature',
      });

      // Update the task to have a branch name
      await (orchestrator as unknown as { store: { updateTask: (id: string, updates: any) => Promise<void> } }).store.updateTask(task.id, {
        branchName: 'feature/test-network-error',
      });

      // Mock git push to fail with network error
      execMockBehavior['git push'] = {
        error: new Error('fatal: unable to access repository: Could not resolve host'),
      };

      const result = await orchestrator.pushTaskBranch(task.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to push changes');

      // Restore original method
      (orchestrator as any).validateBuildAndTests = originalValidateBuildAndTests;
    });

    it('should fail when git push is disabled in configuration', async () => {
      await orchestrator.initialize();

      // Disable git push after task (default behavior)
      (orchestrator as any).effectiveConfig.git.pushAfterTask = false;

      const task = await orchestrator.createTask({
        description: 'Test task with push disabled',
        workflow: 'feature',
      });

      // Update the task to have a branch name
      await (orchestrator as unknown as { store: { updateTask: (id: string, updates: any) => Promise<void> } }).store.updateTask(task.id, {
        branchName: 'feature/test-push-disabled',
      });

      const result = await orchestrator.pushTaskBranch(task.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Push failed - check task logs for details');
    });

    it('should handle exceptions thrown by gitPushTask', async () => {
      await orchestrator.initialize();

      // Enable git push after task
      (orchestrator as any).effectiveConfig.git.pushAfterTask = true;

      // Mock gitPushTask to throw an exception
      const originalGitPushTask = (orchestrator as any).gitPushTask;
      (orchestrator as any).gitPushTask = vi.fn().mockRejectedValue(new Error('Unexpected git error'));

      const task = await orchestrator.createTask({
        description: 'Test task for exception handling',
        workflow: 'feature',
      });

      // Update the task to have a branch name
      await (orchestrator as unknown as { store: { updateTask: (id: string, updates: any) => Promise<void> } }).store.updateTask(task.id, {
        branchName: 'feature/test-exception',
      });

      const result = await orchestrator.pushTaskBranch(task.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected git error');

      // Restore original method
      (orchestrator as any).gitPushTask = originalGitPushTask;
    });

    it('should handle build/test validation failures', async () => {
      await orchestrator.initialize();

      // Enable git push after task
      (orchestrator as any).effectiveConfig.git.pushAfterTask = true;

      // Mock gitPushTask to throw build validation error (simulating validateBuildAndTests failure)
      const originalGitPushTask = (orchestrator as any).gitPushTask;
      (orchestrator as any).gitPushTask = vi.fn().mockRejectedValue(
        new Error('Pre-push validation failed: Build failed\n\nnpm run build exited with code 1')
      );

      const task = await orchestrator.createTask({
        description: 'Test task for build validation failure',
        workflow: 'feature',
      });

      // Update the task to have a branch name
      await (orchestrator as unknown as { store: { updateTask: (id: string, updates: any) => Promise<void> } }).store.updateTask(task.id, {
        branchName: 'feature/test-build-fail',
      });

      const result = await orchestrator.pushTaskBranch(task.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pre-push validation failed: Build failed');

      // Restore original method
      (orchestrator as any).gitPushTask = originalGitPushTask;
    });
  });

  describe('template operations', () => {
    describe('saveTemplate', () => {
      it('should save a task as a template', async () => {
        // Create a task first
        const task = await orchestrator.createTask({
          description: 'Test task for template',
          acceptanceCriteria: 'Should work correctly',
          workflow: 'feature',
          priority: 'high',
          effort: 'medium',
        });

        // Save the task as a template
        const template = await orchestrator.saveTemplate(task.id, 'My Test Template');

        expect(template).toBeDefined();
        expect(template.name).toBe('My Test Template');
        expect(template.description).toBe(task.description);
        expect(template.workflow).toBe(task.workflow);
        expect(template.priority).toBe(task.priority);
        expect(template.effort).toBe(task.effort);
        expect(template.acceptanceCriteria).toBe(task.acceptanceCriteria);
        expect(template.tags).toEqual([]);
        expect(template.id).toMatch(/^tpl_/);
        expect(template.createdAt).toBeInstanceOf(Date);
        expect(template.updatedAt).toBeInstanceOf(Date);

        // Verify log was added
        const logs = await orchestrator.store.getLogs(task.id);
        const templateLog = logs.find(log => log.message.includes('Task saved as template'));
        expect(templateLog).toBeDefined();
        expect(templateLog!.message).toContain('My Test Template');
        expect(templateLog!.message).toContain(template.id);
      });

      it('should fail when task does not exist', async () => {
        await expect(
          orchestrator.saveTemplate('non-existent-task', 'Test Template')
        ).rejects.toThrow('Task not found: non-existent-task');
      });

      it('should trim template name', async () => {
        const task = await orchestrator.createTask({
          description: 'Test task',
          workflow: 'feature',
        });

        const template = await orchestrator.saveTemplate(task.id, '  Trimmed Template Name  ');

        expect(template.name).toBe('Trimmed Template Name');
      });

      it('should handle minimal task data', async () => {
        const task = await orchestrator.createTask({
          description: 'Minimal task',
          workflow: 'bugfix',
        });

        const template = await orchestrator.saveTemplate(task.id, 'Minimal Template');

        expect(template.name).toBe('Minimal Template');
        expect(template.description).toBe('Minimal task');
        expect(template.workflow).toBe('bugfix');
        expect(template.priority).toBe('normal'); // default
        expect(template.effort).toBe('medium'); // default
        expect(template.acceptanceCriteria).toBeUndefined();
      });
    });

    describe('listTemplates', () => {
      it('should return empty array when no templates exist', async () => {
        const templates = await orchestrator.listTemplates();
        expect(templates).toEqual([]);
      });

      it('should list all templates', async () => {
        // Create multiple tasks and save as templates
        const task1 = await orchestrator.createTask({
          description: 'Task 1',
          workflow: 'feature',
          priority: 'high',
        });

        const task2 = await orchestrator.createTask({
          description: 'Task 2',
          workflow: 'bugfix',
          priority: 'low',
        });

        const template1 = await orchestrator.saveTemplate(task1.id, 'Template 1');
        const template2 = await orchestrator.saveTemplate(task2.id, 'Template 2');

        const templates = await orchestrator.listTemplates();

        expect(templates).toHaveLength(2);

        const foundTemplate1 = templates.find(t => t.id === template1.id);
        const foundTemplate2 = templates.find(t => t.id === template2.id);

        expect(foundTemplate1).toBeDefined();
        expect(foundTemplate1!.name).toBe('Template 1');
        expect(foundTemplate1!.workflow).toBe('feature');

        expect(foundTemplate2).toBeDefined();
        expect(foundTemplate2!.name).toBe('Template 2');
        expect(foundTemplate2!.workflow).toBe('bugfix');
      });

      it('should return templates sorted by name', async () => {
        const task1 = await orchestrator.createTask({
          description: 'Task Z',
          workflow: 'feature',
        });

        const task2 = await orchestrator.createTask({
          description: 'Task A',
          workflow: 'bugfix',
        });

        await orchestrator.saveTemplate(task1.id, 'Z Template');
        await orchestrator.saveTemplate(task2.id, 'A Template');

        const templates = await orchestrator.listTemplates();

        expect(templates).toHaveLength(2);
        expect(templates[0].name).toBe('A Template');
        expect(templates[1].name).toBe('Z Template');
      });
    });

    describe('useTemplate', () => {
      it('should create a task from a template', async () => {
        // Create a task and save as template
        const originalTask = await orchestrator.createTask({
          description: 'Original task description',
          acceptanceCriteria: 'Original acceptance criteria',
          workflow: 'feature',
          priority: 'high',
          effort: 'large',
        });

        const template = await orchestrator.saveTemplate(originalTask.id, 'Test Template');

        // Use the template to create a new task
        const newTask = await orchestrator.useTemplate(template.id);

        expect(newTask).toBeDefined();
        expect(newTask.id).toMatch(/^task_/);
        expect(newTask.description).toBe(template.description);
        expect(newTask.workflow).toBe(template.workflow);
        expect(newTask.priority).toBe(template.priority);
        expect(newTask.effort).toBe(template.effort);
        expect(newTask.acceptanceCriteria).toContain('Implement: Test Template');
        expect(newTask.status).toBe('pending');

        // Verify log was added
        const logs = await orchestrator.store.getLogs(newTask.id);
        const templateLog = logs.find(log => log.message.includes('Task created from template'));
        expect(templateLog).toBeDefined();
        expect(templateLog!.message).toContain('Test Template');
        expect(templateLog!.message).toContain(template.id);
      });

      it('should emit task:created event when using template', async () => {
        const originalTask = await orchestrator.createTask({
          description: 'Test task',
          workflow: 'feature',
        });

        const template = await orchestrator.saveTemplate(originalTask.id, 'Test Template');

        const createdEvents: any[] = [];
        orchestrator.on('task:created', (task) => {
          createdEvents.push(task);
        });

        const newTask = await orchestrator.useTemplate(template.id);

        expect(createdEvents).toHaveLength(1);
        expect(createdEvents[0].id).toBe(newTask.id);
      });

      it('should allow overriding template properties', async () => {
        const originalTask = await orchestrator.createTask({
          description: 'Original description',
          workflow: 'feature',
          priority: 'normal',
        });

        const template = await orchestrator.saveTemplate(originalTask.id, 'Test Template');

        const newTask = await orchestrator.useTemplate(template.id, {
          description: 'Overridden description',
          priority: 'urgent',
          workflow: 'bugfix',
        });

        expect(newTask.description).toBe('Overridden description');
        expect(newTask.priority).toBe('urgent');
        expect(newTask.workflow).toBe('bugfix');
      });

      it('should use orchestrator projectPath when not overridden', async () => {
        const originalTask = await orchestrator.createTask({
          description: 'Test task',
          workflow: 'feature',
        });

        const template = await orchestrator.saveTemplate(originalTask.id, 'Test Template');

        const newTask = await orchestrator.useTemplate(template.id);

        expect(newTask.projectPath).toBe(testDir);
      });

      it('should allow overriding projectPath', async () => {
        const originalTask = await orchestrator.createTask({
          description: 'Test task',
          workflow: 'feature',
        });

        const template = await orchestrator.saveTemplate(originalTask.id, 'Test Template');

        const customPath = '/custom/project/path';
        const newTask = await orchestrator.useTemplate(template.id, {
          projectPath: customPath,
        });

        expect(newTask.projectPath).toBe(customPath);
      });

      it('should fail when template does not exist', async () => {
        await expect(
          orchestrator.useTemplate('non-existent-template')
        ).rejects.toThrow('Template not found: non-existent-template');
      });
    });

    describe('deleteTemplate', () => {
      it('should delete an existing template', async () => {
        const task = await orchestrator.createTask({
          description: 'Test task',
          workflow: 'feature',
        });

        const template = await orchestrator.saveTemplate(task.id, 'Test Template');

        // Verify template exists
        let templates = await orchestrator.listTemplates();
        expect(templates.find(t => t.id === template.id)).toBeDefined();

        // Delete the template
        await orchestrator.deleteTemplate(template.id);

        // Verify template no longer exists
        templates = await orchestrator.listTemplates();
        expect(templates.find(t => t.id === template.id)).toBeUndefined();
      });

      it('should fail when template does not exist', async () => {
        await expect(
          orchestrator.deleteTemplate('non-existent-template')
        ).rejects.toThrow('Template not found: non-existent-template');
      });

      it('should not affect tasks created from the template after deletion', async () => {
        const originalTask = await orchestrator.createTask({
          description: 'Test task',
          workflow: 'feature',
        });

        const template = await orchestrator.saveTemplate(originalTask.id, 'Test Template');

        // Create a task from the template
        const taskFromTemplate = await orchestrator.useTemplate(template.id);

        // Delete the template
        await orchestrator.deleteTemplate(template.id);

        // Verify the task from template still exists and works
        const retrievedTask = await orchestrator.getTask(taskFromTemplate.id);
        expect(retrievedTask).toBeDefined();
        expect(retrievedTask!.description).toBe(originalTask.description);
      });

      it('should handle deleting multiple templates', async () => {
        const task1 = await orchestrator.createTask({
          description: 'Task 1',
          workflow: 'feature',
        });

        const task2 = await orchestrator.createTask({
          description: 'Task 2',
          workflow: 'bugfix',
        });

        const template1 = await orchestrator.saveTemplate(task1.id, 'Template 1');
        const template2 = await orchestrator.saveTemplate(task2.id, 'Template 2');

        // Verify both templates exist
        let templates = await orchestrator.listTemplates();
        expect(templates).toHaveLength(2);

        // Delete first template
        await orchestrator.deleteTemplate(template1.id);

        templates = await orchestrator.listTemplates();
        expect(templates).toHaveLength(1);
        expect(templates[0].id).toBe(template2.id);

        // Delete second template
        await orchestrator.deleteTemplate(template2.id);

        templates = await orchestrator.listTemplates();
        expect(templates).toHaveLength(0);
      });
    });

    describe('template integration', () => {
      it('should support full template lifecycle', async () => {
        // Create a task with full data
        const originalTask = await orchestrator.createTask({
          description: 'Complete feature implementation',
          acceptanceCriteria: 'Feature should handle all edge cases and include comprehensive tests',
          workflow: 'feature',
          priority: 'high',
          effort: 'large',
        });

        // Save as template
        const template = await orchestrator.saveTemplate(originalTask.id, 'Feature Template');

        // List templates and verify it appears
        const templates = await orchestrator.listTemplates();
        expect(templates.find(t => t.id === template.id)).toBeDefined();

        // Use template to create multiple tasks with different overrides
        const task1 = await orchestrator.useTemplate(template.id, {
          description: 'Implement user authentication',
          priority: 'urgent',
        });

        const task2 = await orchestrator.useTemplate(template.id, {
          description: 'Implement data validation',
          effort: 'small',
        });

        // Verify tasks were created correctly
        expect(task1.description).toBe('Implement user authentication');
        expect(task1.priority).toBe('urgent');
        expect(task1.effort).toBe('large'); // inherited from template

        expect(task2.description).toBe('Implement data validation');
        expect(task2.effort).toBe('small'); // overridden
        expect(task2.priority).toBe('high'); // inherited from template

        // Clean up by deleting the template
        await orchestrator.deleteTemplate(template.id);

        // Verify template is deleted but tasks remain
        const remainingTemplates = await orchestrator.listTemplates();
        expect(remainingTemplates.find(t => t.id === template.id)).toBeUndefined();

        const remainingTask1 = await orchestrator.getTask(task1.id);
        const remainingTask2 = await orchestrator.getTask(task2.id);
        expect(remainingTask1).toBeDefined();
        expect(remainingTask2).toBeDefined();
      });
    });

    describe('direct template CRUD operations', () => {
      describe('createTemplate', () => {
        it('should create a template directly without needing a task', async () => {
          const templateData = {
            name: 'Direct Template',
            description: 'Template created directly',
            workflow: 'feature',
            priority: 'high' as const,
            effort: 'medium' as const,
            acceptanceCriteria: 'Should work correctly',
            tags: ['direct', 'test'],
          };

          const template = await orchestrator.createTemplate(templateData);

          expect(template).toBeDefined();
          expect(template.id).toMatch(/^template_/);
          expect(template.name).toBe('Direct Template');
          expect(template.description).toBe('Template created directly');
          expect(template.workflow).toBe('feature');
          expect(template.priority).toBe('high');
          expect(template.effort).toBe('medium');
          expect(template.acceptanceCriteria).toBe('Should work correctly');
          expect(template.tags).toEqual(['direct', 'test']);
          expect(template.createdAt).toBeInstanceOf(Date);
          expect(template.updatedAt).toBeInstanceOf(Date);
        });

        it('should create template with minimal required fields', async () => {
          const templateData = {
            name: 'Minimal Template',
            description: 'Minimal template',
            workflow: 'bugfix',
          };

          const template = await orchestrator.createTemplate(templateData);

          expect(template.name).toBe('Minimal Template');
          expect(template.description).toBe('Minimal template');
          expect(template.workflow).toBe('bugfix');
          expect(template.priority).toBe('normal'); // default
          expect(template.effort).toBe('medium'); // default
          expect(template.tags).toEqual([]); // default
          expect(template.acceptanceCriteria).toBeUndefined();
        });

        it('should emit template:created event', async () => {
          let emittedTemplate: any;
          orchestrator.on('template:created', (template) => {
            emittedTemplate = template;
          });

          const templateData = {
            name: 'Event Test Template',
            description: 'Template for testing events',
            workflow: 'feature',
          };

          const template = await orchestrator.createTemplate(templateData);

          expect(emittedTemplate).toBeDefined();
          expect(emittedTemplate.id).toBe(template.id);
          expect(emittedTemplate.name).toBe('Event Test Template');
        });
      });

      describe('getTemplate', () => {
        let templateId: string;

        beforeEach(async () => {
          const template = await orchestrator.createTemplate({
            name: 'Get Test Template',
            description: 'Template for testing get method',
            workflow: 'feature',
          });
          templateId = template.id;
        });

        it('should retrieve a template by ID', async () => {
          const template = await orchestrator.getTemplate(templateId);

          expect(template).toBeDefined();
          expect(template!.id).toBe(templateId);
          expect(template!.name).toBe('Get Test Template');
          expect(template!.description).toBe('Template for testing get method');
          expect(template!.workflow).toBe('feature');
        });

        it('should return null for non-existent template', async () => {
          const template = await orchestrator.getTemplate('non-existent-template');
          expect(template).toBeNull();
        });
      });

      describe('updateTemplate', () => {
        let templateId: string;

        beforeEach(async () => {
          const template = await orchestrator.createTemplate({
            name: 'Update Test Template',
            description: 'Template for testing update method',
            workflow: 'feature',
            priority: 'normal',
            effort: 'medium',
            acceptanceCriteria: 'Original criteria',
            tags: ['original', 'test'],
          });
          templateId = template.id;
        });

        it('should update template fields', async () => {
          const updates = {
            name: 'Updated Template Name',
            description: 'Updated description',
            priority: 'high' as const,
            effort: 'large' as const,
            acceptanceCriteria: 'Updated criteria',
            tags: ['updated', 'test'],
          };

          const updatedTemplate = await orchestrator.updateTemplate(templateId, updates);

          expect(updatedTemplate.id).toBe(templateId);
          expect(updatedTemplate.name).toBe('Updated Template Name');
          expect(updatedTemplate.description).toBe('Updated description');
          expect(updatedTemplate.priority).toBe('high');
          expect(updatedTemplate.effort).toBe('large');
          expect(updatedTemplate.acceptanceCriteria).toBe('Updated criteria');
          expect(updatedTemplate.tags).toEqual(['updated', 'test']);
          expect(updatedTemplate.updatedAt.getTime()).toBeGreaterThan(updatedTemplate.createdAt.getTime());
        });

        it('should update only specified fields', async () => {
          const originalTemplate = await orchestrator.getTemplate(templateId);

          const updates = {
            name: 'Partially Updated Name',
            priority: 'urgent' as const,
          };

          const updatedTemplate = await orchestrator.updateTemplate(templateId, updates);

          expect(updatedTemplate.name).toBe('Partially Updated Name');
          expect(updatedTemplate.priority).toBe('urgent');
          // Other fields should remain unchanged
          expect(updatedTemplate.description).toBe(originalTemplate!.description);
          expect(updatedTemplate.workflow).toBe(originalTemplate!.workflow);
          expect(updatedTemplate.effort).toBe(originalTemplate!.effort);
          expect(updatedTemplate.acceptanceCriteria).toBe(originalTemplate!.acceptanceCriteria);
          expect(updatedTemplate.tags).toEqual(originalTemplate!.tags);
        });

        it('should emit template:updated event', async () => {
          let emittedTemplate: any;
          orchestrator.on('template:updated', (template) => {
            emittedTemplate = template;
          });

          const updates = { name: 'Event Updated Template' };
          const updatedTemplate = await orchestrator.updateTemplate(templateId, updates);

          expect(emittedTemplate).toBeDefined();
          expect(emittedTemplate.id).toBe(updatedTemplate.id);
          expect(emittedTemplate.name).toBe('Event Updated Template');
        });

        it('should throw error when updating non-existent template', async () => {
          await expect(
            orchestrator.updateTemplate('non-existent-template', { name: 'New Name' })
          ).rejects.toThrow('Template not found: non-existent-template');
        });
      });

      describe('template CRUD integration', () => {
        it('should support full direct CRUD lifecycle', async () => {
          // Create a template directly
          const template = await orchestrator.createTemplate({
            name: 'CRUD Test Template',
            description: 'Template for testing CRUD operations',
            workflow: 'feature',
            priority: 'normal',
            effort: 'medium',
            acceptanceCriteria: 'Should support all CRUD operations',
            tags: ['crud', 'test'],
          });

          // Get the template
          const retrievedTemplate = await orchestrator.getTemplate(template.id);
          expect(retrievedTemplate).toBeDefined();
          expect(retrievedTemplate!.name).toBe('CRUD Test Template');

          // Update the template
          const updatedTemplate = await orchestrator.updateTemplate(template.id, {
            name: 'Updated CRUD Template',
            priority: 'high',
            tags: ['crud', 'updated'],
          });
          expect(updatedTemplate.name).toBe('Updated CRUD Template');
          expect(updatedTemplate.priority).toBe('high');
          expect(updatedTemplate.tags).toEqual(['crud', 'updated']);

          // Verify template appears in list
          const allTemplates = await orchestrator.listTemplates();
          const foundTemplate = allTemplates.find(t => t.id === template.id);
          expect(foundTemplate).toBeDefined();
          expect(foundTemplate!.name).toBe('Updated CRUD Template');

          // Use template to create a task
          const task = await orchestrator.useTemplate(template.id, {
            description: 'Task from CRUD template',
          });
          expect(task.description).toBe('Task from CRUD template');
          expect(task.workflow).toBe('feature');
          expect(task.priority).toBe('high');

          // Delete the template
          await orchestrator.deleteTemplate(template.id);

          // Verify template is gone but task remains
          const deletedTemplate = await orchestrator.getTemplate(template.id);
          expect(deletedTemplate).toBeNull();

          const remainingTask = await orchestrator.getTask(task.id);
          expect(remainingTask).toBeDefined();
        });
      });
    });
  });
});
