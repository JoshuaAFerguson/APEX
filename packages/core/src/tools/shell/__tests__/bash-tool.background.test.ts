/**
 * @fileoverview Background execution tests for BashTool
 * Tests the background task functionality including task management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BashTool } from '../bash-tool.js';
import { BackgroundTaskManager } from '../background-task-manager.js';
import type { BashToolInput, BashToolBackgroundOutput } from '../bash-tool.js';

describe('BashTool Background Execution Tests', () => {
  let bashTool: BashTool;
  let manager: BackgroundTaskManager;

  beforeEach(() => {
    bashTool = new BashTool();
    manager = BackgroundTaskManager.getInstance();
  });

  afterEach(async () => {
    // Clean up any running tasks
    await manager.shutdownAll(1000);
    BackgroundTaskManager.resetInstance();
  });

  describe('background execution basics', () => {
    it('should execute command in background and return task info', async () => {
      const input: BashToolInput = {
        command: 'echo "Hello background"; sleep 1; echo "Done"',
        run_in_background: true,
        description: 'Test background echo'
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();

      // Type narrowing for background output
      if (result.output && 'background' in result.output && result.output.background) {
        const bgOutput = result.output as BashToolBackgroundOutput;
        expect(bgOutput.taskId).toBeDefined();
        expect(bgOutput.taskId).toMatch(/^bg_[a-f0-9]{8}$/);
        expect(bgOutput.pid).toBeGreaterThan(0);
        expect(bgOutput.command).toBe('echo "Hello background"; sleep 1; echo "Done"');
        expect(bgOutput.background).toBe(true);
        expect(bgOutput.status).toBe('running');
        expect(bgOutput.startedAt).toBeInstanceOf(Date);
      } else {
        throw new Error('Expected background task output');
      }
    });

    it('should register task with background task manager', async () => {
      const input: BashToolInput = {
        command: 'echo "Manager test"; sleep 1',
        run_in_background: true
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Check task is registered with manager
        const status = manager.getStatus(taskId);
        expect(status).toBeDefined();
        expect(status!.taskId).toBe(taskId);
        expect(status!.command).toBe('echo "Manager test"; sleep 1');
        expect(status!.status).toBe('running');
      }
    });

    it('should ignore timeout parameter for background execution', async () => {
      const input: BashToolInput = {
        command: 'echo "Timeout ignored"; sleep 2',
        timeout: 500, // This should be ignored
        run_in_background: true
      };

      const startTime = Date.now();
      const result = await bashTool.execute(input);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // Should return immediately, not wait for timeout
      expect(duration).toBeLessThan(100);

      if (result.output && 'background' in result.output && result.output.background) {
        expect(result.output.background).toBe(true);
        expect(result.output.status).toBe('running');
      }
    });
  });

  describe('task monitoring and output', () => {
    it('should collect stdout output from background task', async () => {
      const input: BashToolInput = {
        command: 'echo "Line 1"; sleep 0.1; echo "Line 2"',
        run_in_background: true
      };

      const result = await bashTool.execute(input);
      if (!result.success || !result.output || !('background' in result.output)) {
        throw new Error('Failed to start background task');
      }

      const taskId = result.output.taskId;

      // Wait a bit for command to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const output = manager.getOutput(taskId);
      expect(output).toBeDefined();
      expect(output!.stdout).toContain('Line 1');
      expect(output!.stdout).toContain('Line 2');
    });

    it('should track task completion status', async () => {
      const input: BashToolInput = {
        command: 'echo "Quick task"',
        run_in_background: true
      };

      const result = await bashTool.execute(input);
      if (!result.success || !result.output || !('background' in result.output)) {
        throw new Error('Failed to start background task');
      }

      const taskId = result.output.taskId;

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 500));

      const status = manager.getStatus(taskId);
      expect(status).toBeDefined();
      expect(status!.status).toBe('completed');
      expect(status!.completedAt).toBeDefined();
      expect(status!.exitCode).toBe(0);
    });

    it('should handle stderr output', async () => {
      const input: BashToolInput = {
        command: 'echo "Error message" >&2',
        run_in_background: true
      };

      const result = await bashTool.execute(input);
      if (!result.success || !result.output || !('background' in result.output)) {
        throw new Error('Failed to start background task');
      }

      const taskId = result.output.taskId;

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 300));

      const output = manager.getOutput(taskId);
      expect(output).toBeDefined();
      expect(output!.stderr).toContain('Error message');
    });

    it('should handle task failures with non-zero exit codes', async () => {
      const input: BashToolInput = {
        command: 'exit 42',
        run_in_background: true
      };

      const result = await bashTool.execute(input);
      if (!result.success || !result.output || !('background' in result.output)) {
        throw new Error('Failed to start background task');
      }

      const taskId = result.output.taskId;

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 300));

      const status = manager.getStatus(taskId);
      expect(status).toBeDefined();
      expect(status!.status).toBe('failed');
      expect(status!.exitCode).toBe(42);
    });
  });

  describe('task management operations', () => {
    it('should allow killing background tasks', async () => {
      const input: BashToolInput = {
        command: 'sleep 10',
        run_in_background: true
      };

      const result = await bashTool.execute(input);
      if (!result.success || !result.output || !('background' in result.output)) {
        throw new Error('Failed to start background task');
      }

      const taskId = result.output.taskId;

      // Verify task is running
      let status = manager.getStatus(taskId);
      expect(status!.status).toBe('running');

      // Kill the task
      const killResult = manager.kill(taskId);
      expect(killResult.success).toBe(true);

      // Wait for the kill to take effect
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify task was killed
      status = manager.getStatus(taskId);
      expect(status!.status).toBe('killed');
    });

    it('should list all background tasks', async () => {
      const input1: BashToolInput = {
        command: 'echo "Task 1"',
        run_in_background: true
      };

      const input2: BashToolInput = {
        command: 'sleep 2',
        run_in_background: true
      };

      // Start two tasks
      const result1 = await bashTool.execute(input1);
      const result2 = await bashTool.execute(input2);

      expect(result1.success && result2.success).toBe(true);

      // List all tasks
      const allTasks = manager.listAll();
      expect(allTasks.length).toBeGreaterThanOrEqual(2);

      // List only running tasks
      const runningTasks = manager.listAll('running');
      expect(runningTasks.length).toBeGreaterThanOrEqual(1);

      // Clean up
      for (const task of runningTasks) {
        if (task.status === 'running') {
          manager.kill(task.taskId);
        }
      }
    });
  });

  describe('working directory and environment', () => {
    it('should respect working directory context', async () => {
      const input: BashToolInput = {
        command: 'pwd',
        run_in_background: true
      };

      const result = await bashTool.execute(input, {
        workingDirectory: '/tmp'
      });

      if (!result.success || !result.output || !('background' in result.output)) {
        throw new Error('Failed to start background task');
      }

      const taskId = result.output.taskId;

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 300));

      const output = manager.getOutput(taskId);
      expect(output!.stdout).toContain('/tmp');
    });

    it('should respect environment variables context', async () => {
      const input: BashToolInput = {
        command: 'echo $TEST_BG_VAR',
        run_in_background: true
      };

      const result = await bashTool.execute(input, {
        environment: { TEST_BG_VAR: 'background_value' }
      });

      if (!result.success || !result.output || !('background' in result.output)) {
        throw new Error('Failed to start background task');
      }

      const taskId = result.output.taskId;

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 300));

      const output = manager.getOutput(taskId);
      expect(output!.stdout).toContain('background_value');
    });
  });

  describe('concurrent background tasks', () => {
    it('should handle multiple concurrent background tasks', async () => {
      const tasks = [];

      for (let i = 0; i < 3; i++) {
        const input: BashToolInput = {
          command: `echo "Task ${i}"; sleep 0.${i + 1}`,
          run_in_background: true
        };

        const result = await bashTool.execute(input);
        expect(result.success).toBe(true);

        if (result.output && 'background' in result.output && result.output.background) {
          tasks.push(result.output.taskId);
        }
      }

      expect(tasks).toHaveLength(3);

      // Wait for all to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify all completed
      for (const taskId of tasks) {
        const status = manager.getStatus(taskId);
        expect(status!.status).toBe('completed');
      }
    });
  });
});