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

// Mock child_process for git commands
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    const cb = callback as (error: Error | null, result?: { stdout: string }) => void;

    // Mock git worktree commands
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
    } else {
      cb(null, { stdout: '' });
    }
  }),
}));

const mockedQuery = vi.mocked(query);
const mockedExec = vi.mocked(exec);

describe('Worktree Cleanup Delay', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create temporary directory for test project
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-worktree-delay-test-'));

    // Initialize a mock APEX project
    await initializeApex(tempDir, {
      project: { name: 'test-project' },
      git: {
        autoWorktree: true,
        worktree: {
          cleanupOnComplete: true,
          maxWorktrees: 5,
          pruneStaleAfterDays: 7,
          preserveOnFailure: false,
          cleanupDelayMs: 1000, // 1 second delay for testing
        },
      },
    });

    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
      agentsDir: path.join(tempDir, '.apex', 'agents'),
      workflowsDir: path.join(tempDir, '.apex', 'workflows'),
    });

    // Mock the Claude query to return a successful completion
    mockedQuery.mockResolvedValue({
      messages: [
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Task completed successfully.' }],
        },
      ],
      usage: { inputTokens: 100, outputTokens: 50 },
    });
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should delay worktree cleanup when cleanupDelayMs > 0', async () => {
    const task = await orchestrator.createTask({
      description: 'Test task with delayed cleanup',
      workflow: 'feature',
      autonomy: 'full',
      priority: 'normal',
      effort: 'small',
      projectPath: tempDir,
    });

    // Mock setTimeout to capture the delay behavior
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    // Start and complete the task
    await orchestrator.startTask(task.id);

    // Wait a bit for the task to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update task status to completed (triggering cleanup)
    await orchestrator.updateTaskStatus(task.id, 'completed', 'Test completion');

    // Check that setTimeout was called with the correct delay
    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      1000 // cleanupDelayMs value
    );

    setTimeoutSpy.mockRestore();
  });

  it('should not delay worktree cleanup when cleanupDelayMs is 0', async () => {
    // Reconfigure orchestrator with no delay
    await initializeApex(tempDir, {
      project: { name: 'test-project' },
      git: {
        autoWorktree: true,
        worktree: {
          cleanupOnComplete: true,
          maxWorktrees: 5,
          pruneStaleAfterDays: 7,
          preserveOnFailure: false,
          cleanupDelayMs: 0, // No delay
        },
      },
    });

    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
      agentsDir: path.join(tempDir, '.apex', 'agents'),
      workflowsDir: path.join(tempDir, '.apex', 'workflows'),
    });

    const task = await orchestrator.createTask({
      description: 'Test task with immediate cleanup',
      workflow: 'feature',
      autonomy: 'full',
      priority: 'normal',
      effort: 'small',
      projectPath: tempDir,
    });

    // Mock setTimeout to capture the delay behavior
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    // Start and complete the task
    await orchestrator.startTask(task.id);

    // Wait a bit for the task to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update task status to completed (triggering cleanup)
    await orchestrator.updateTaskStatus(task.id, 'completed', 'Test completion');

    // Check that setTimeout was NOT called (immediate cleanup)
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    setTimeoutSpy.mockRestore();
  });

  it('should log the delay scheduling message when delaying cleanup', async () => {
    const task = await orchestrator.createTask({
      description: 'Test task with delay logging',
      workflow: 'feature',
      autonomy: 'full',
      priority: 'normal',
      effort: 'small',
      projectPath: tempDir,
    });

    // Start and complete the task
    await orchestrator.startTask(task.id);

    // Wait a bit for the task to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update task status to completed (triggering cleanup)
    await orchestrator.updateTaskStatus(task.id, 'completed', 'Test completion');

    // Check the task logs for the delay message
    const updatedTask = await orchestrator.getTask(task.id);
    const delayLog = updatedTask?.logs.find(log =>
      log.message.includes('Scheduling worktree cleanup in') &&
      log.message.includes('1000ms')
    );

    expect(delayLog).toBeDefined();
    expect(delayLog?.level).toBe('info');
  });

  it('should handle delay cleanup completion with proper logging', async () => {
    const task = await orchestrator.createTask({
      description: 'Test delayed cleanup completion',
      workflow: 'feature',
      autonomy: 'full',
      priority: 'normal',
      effort: 'small',
      projectPath: tempDir,
    });

    // Mock setTimeout to execute the callback immediately for testing
    const originalSetTimeout = global.setTimeout;
    vi.spyOn(global, 'setTimeout').mockImplementation((callback: Function, delay: number) => {
      // Execute callback immediately for testing, but still verify the delay value
      expect(delay).toBe(1000);
      process.nextTick(() => callback());
      return 1 as NodeJS.Timeout;
    });

    // Start and complete the task
    await orchestrator.startTask(task.id);

    // Wait a bit for the task to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update task status to completed (triggering cleanup)
    await orchestrator.updateTaskStatus(task.id, 'completed', 'Test completion');

    // Wait for the delayed cleanup to execute
    await new Promise(resolve => process.nextTick(resolve));

    // Check that the worktree remove command was called
    expect(mockedExec).toHaveBeenCalledWith(
      expect.stringContaining('git worktree remove'),
      expect.anything(),
      expect.any(Function)
    );

    global.setTimeout = originalSetTimeout;
  });

  it('should handle different delay values correctly', async () => {
    // Test with a larger delay value
    await initializeApex(tempDir, {
      project: { name: 'test-project' },
      git: {
        autoWorktree: true,
        worktree: {
          cleanupOnComplete: true,
          maxWorktrees: 5,
          pruneStaleAfterDays: 7,
          preserveOnFailure: false,
          cleanupDelayMs: 5000, // 5 second delay
        },
      },
    });

    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
      agentsDir: path.join(tempDir, '.apex', 'agents'),
      workflowsDir: path.join(tempDir, '.apex', 'workflows'),
    });

    const task = await orchestrator.createTask({
      description: 'Test task with 5 second delay',
      workflow: 'feature',
      autonomy: 'full',
      priority: 'normal',
      effort: 'small',
      projectPath: tempDir,
    });

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    // Start and complete the task
    await orchestrator.startTask(task.id);

    // Wait a bit for the task to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update task status to completed (triggering cleanup)
    await orchestrator.updateTaskStatus(task.id, 'completed', 'Test completion');

    // Verify the correct delay value was used
    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      5000 // 5 second delay
    );

    setTimeoutSpy.mockRestore();
  });

  it('should still preserve worktree on failure regardless of delay setting', async () => {
    // Configure with preserveOnFailure true
    await initializeApex(tempDir, {
      project: { name: 'test-project' },
      git: {
        autoWorktree: true,
        worktree: {
          cleanupOnComplete: true,
          maxWorktrees: 5,
          pruneStaleAfterDays: 7,
          preserveOnFailure: true, // Preserve on failure
          cleanupDelayMs: 1000,
        },
      },
    });

    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
      agentsDir: path.join(tempDir, '.apex', 'agents'),
      workflowsDir: path.join(tempDir, '.apex', 'workflows'),
    });

    const task = await orchestrator.createTask({
      description: 'Test task that fails',
      workflow: 'feature',
      autonomy: 'full',
      priority: 'normal',
      effort: 'small',
      projectPath: tempDir,
    });

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    // Start and fail the task
    await orchestrator.startTask(task.id);

    // Wait a bit for the task to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update task status to failed
    await orchestrator.updateTaskStatus(task.id, 'failed', 'Test failure');

    // Check that setTimeout was NOT called (no cleanup on failure when preserved)
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    // Check the task logs for the preservation message
    const updatedTask = await orchestrator.getTask(task.id);
    const preservationLog = updatedTask?.logs.find(log =>
      log.message.includes('Preserved worktree for debugging')
    );

    expect(preservationLog).toBeDefined();

    setTimeoutSpy.mockRestore();
  });
});