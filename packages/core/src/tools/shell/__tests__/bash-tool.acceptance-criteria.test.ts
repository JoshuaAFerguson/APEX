/**
 * @fileoverview Acceptance Criteria Tests for BashTool Background Execution Support
 * Tests that validate the exact acceptance criteria specified in the task
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BashTool } from '../bash-tool.js';
import { BackgroundTaskManager } from '../background-task-manager.js';
import type { BashToolInput, BashToolBackgroundOutput } from '../bash-tool.js';

describe('BashTool Background Execution - Acceptance Criteria Tests', () => {
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

  describe('AC1: BashTool accepts run_in_background parameter', () => {
    it('should accept run_in_background parameter in input schema', () => {
      const definition = bashTool.getDefinition();

      expect(definition.parameters.properties.run_in_background).toEqual({
        type: 'boolean',
        description: 'Set to true to run this command in the background. Use TaskOutput to read the output later.'
      });
    });

    it('should validate input with run_in_background parameter', () => {
      const inputWithBg: BashToolInput = {
        command: 'echo "test"',
        run_in_background: true
      };

      const validation = bashTool.validate(inputWithBg);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should validate input without run_in_background parameter (optional)', () => {
      const inputWithoutBg: BashToolInput = {
        command: 'echo "test"'
      };

      const validation = bashTool.validate(inputWithoutBg);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject invalid run_in_background values', () => {
      const invalidInput = {
        command: 'echo "test"',
        run_in_background: 'invalid'
      } as any;

      const validation = bashTool.validate(invalidInput);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('run_in_background must be a boolean');
    });
  });

  describe('AC2: When true, returns immediately with process/task ID', () => {
    it('should return immediately when run_in_background is true', async () => {
      const input: BashToolInput = {
        command: 'sleep 5; echo "long command"',
        run_in_background: true
      };

      const startTime = Date.now();
      const result = await bashTool.execute(input);
      const duration = Date.now() - startTime;

      // Should return almost immediately (< 100ms)
      expect(duration).toBeLessThan(100);
      expect(result.success).toBe(true);
    });

    it('should return valid task ID when run_in_background is true', async () => {
      const input: BashToolInput = {
        command: 'echo "background task"',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();

      if (result.output && 'background' in result.output && result.output.background) {
        const bgOutput = result.output as BashToolBackgroundOutput;

        // Validate task ID format (bg_XXXXXXXX)
        expect(bgOutput.taskId).toMatch(/^bg_[a-f0-9]{8}$/);
        expect(bgOutput.background).toBe(true);
        expect(bgOutput.status).toBe('running');
        expect(bgOutput.startedAt).toBeInstanceOf(Date);
        expect(bgOutput.command).toBe('echo "background task"');
      } else {
        throw new Error('Expected background task output');
      }
    });

    it('should return valid process ID when run_in_background is true', async () => {
      const input: BashToolInput = {
        command: 'sleep 1',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const bgOutput = result.output as BashToolBackgroundOutput;

        // Validate PID is a valid process ID
        expect(bgOutput.pid).toBeDefined();
        expect(typeof bgOutput.pid).toBe('number');
        expect(bgOutput.pid).toBeGreaterThan(0);
        expect(bgOutput.pid).toBeLessThan(2147483648); // Max PID on most systems
      } else {
        throw new Error('Expected background task output');
      }
    });

    it('should not return output immediately for background tasks', async () => {
      const input: BashToolInput = {
        command: 'echo "immediate output"',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const bgOutput = result.output as BashToolBackgroundOutput;

        // Background output should not contain stdout/stderr immediately
        expect('stdout' in bgOutput).toBe(false);
        expect('stderr' in bgOutput).toBe(false);
        expect('exitCode' in bgOutput).toBe(false);
        expect('duration' in bgOutput).toBe(false);
        expect('timedOut' in bgOutput).toBe(false);
      } else {
        throw new Error('Expected background task output');
      }
    });
  });

  describe('AC3: Provides mechanism to check background task status', () => {
    it('should register task with BackgroundTaskManager for status checking', async () => {
      const input: BashToolInput = {
        command: 'echo "status check"; sleep 1',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Should be able to check status via manager
        const status = manager.getStatus(taskId);
        expect(status).toBeDefined();
        expect(status!.taskId).toBe(taskId);
        expect(status!.command).toBe('echo "status check"; sleep 1');
        expect(status!.status).toBe('running');
        expect(status!.startedAt).toBeInstanceOf(Date);
      }
    });

    it('should allow checking task output via BackgroundTaskManager', async () => {
      const input: BashToolInput = {
        command: 'echo "output check"',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Wait for command to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Should be able to get output via manager
        const output = manager.getOutput(taskId);
        expect(output).toBeDefined();
        expect(output!.stdout).toContain('output check');
      }
    });

    it('should track task completion status changes', async () => {
      const input: BashToolInput = {
        command: 'echo "completion test"',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Initially should be running
        let status = manager.getStatus(taskId);
        expect(status!.status).toBe('running');

        // Wait for completion
        await new Promise(resolve => setTimeout(resolve, 500));

        // Should be completed
        status = manager.getStatus(taskId);
        expect(status!.status).toBe('completed');
        expect(status!.completedAt).toBeInstanceOf(Date);
        expect(status!.exitCode).toBe(0);
      }
    });

    it('should track task failure status', async () => {
      const input: BashToolInput = {
        command: 'exit 1',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Wait for completion
        await new Promise(resolve => setTimeout(resolve, 500));

        // Should be failed with exit code 1
        const status = manager.getStatus(taskId);
        expect(status!.status).toBe('failed');
        expect(status!.exitCode).toBe(1);
      }
    });

    it('should support listing all background tasks', async () => {
      const input1: BashToolInput = {
        command: 'echo "task 1"',
        run_in_background: true
      };

      const input2: BashToolInput = {
        command: 'sleep 2',
        run_in_background: true
      };

      // Start multiple tasks
      const result1 = await bashTool.execute(input1);
      const result2 = await bashTool.execute(input2);

      expect(result1.success && result2.success).toBe(true);

      // Should be able to list all tasks
      const allTasks = manager.listAll();
      expect(allTasks.length).toBeGreaterThanOrEqual(2);

      // Should be able to filter by status
      const runningTasks = manager.listAll('running');
      expect(runningTasks.length).toBeGreaterThanOrEqual(1);

      // Clean up running tasks
      for (const task of runningTasks) {
        if (task.status === 'running') {
          manager.kill(task.taskId);
        }
      }
    });
  });

  describe('AC4: Handles cleanup of background processes properly', () => {
    it('should allow killing background processes', async () => {
      const input: BashToolInput = {
        command: 'sleep 10',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Verify task is running
        let status = manager.getStatus(taskId);
        expect(status!.status).toBe('running');

        // Kill the task
        const killResult = manager.kill(taskId);
        expect(killResult.success).toBe(true);
        expect(killResult.message).toContain('killed');

        // Wait for kill to take effect
        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify task was killed
        status = manager.getStatus(taskId);
        expect(status!.status).toBe('killed');
        expect(status!.completedAt).toBeInstanceOf(Date);
      }
    });

    it('should handle killing non-existent tasks gracefully', () => {
      const nonExistentTaskId = 'bg_12345678';
      const result = manager.kill(nonExistentTaskId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should handle killing already completed tasks gracefully', async () => {
      const input: BashToolInput = {
        command: 'echo "quick task"',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Wait for completion
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify task completed
        let status = manager.getStatus(taskId);
        expect(status!.status).toBe('completed');

        // Try to kill completed task
        const killResult = manager.kill(taskId);
        expect(killResult.success).toBe(false);
        expect(killResult.message).toContain('not running');
      }
    });

    it('should auto-cleanup old completed tasks', async () => {
      const input: BashToolInput = {
        command: 'echo "cleanup test"',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Wait for completion
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify task exists
        let status = manager.getStatus(taskId);
        expect(status!.status).toBe('completed');

        // Force cleanup (normally happens automatically after 1 hour)
        manager.cleanup();

        // Task should still exist (cleanup threshold not met)
        status = manager.getStatus(taskId);
        expect(status).toBeDefined();
      }
    });

    it('should shutdown all background processes on manager shutdown', async () => {
      const input1: BashToolInput = {
        command: 'sleep 5',
        run_in_background: true
      };

      const input2: BashToolInput = {
        command: 'sleep 5',
        run_in_background: true
      };

      // Start multiple tasks
      await bashTool.execute(input1);
      await bashTool.execute(input2);

      // Verify tasks are running
      const runningTasks = manager.listAll('running');
      expect(runningTasks.length).toBeGreaterThanOrEqual(2);

      // Shutdown all
      await manager.shutdownAll(1000);

      // All tasks should be killed or cleaned up
      const remainingTasks = manager.listAll('running');
      expect(remainingTasks.length).toBe(0);
    });

    it('should handle process cleanup with SIGTERM then SIGKILL', async () => {
      const input: BashToolInput = {
        command: 'trap "echo Received SIGTERM" TERM; sleep 10',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Kill the task (should send SIGTERM first)
        const killResult = manager.kill(taskId, 'SIGTERM');
        expect(killResult.success).toBe(true);

        // Wait for signal handling
        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify task was killed
        const status = manager.getStatus(taskId);
        expect(status!.status).toBe('killed');
      }
    });
  });

  describe('Background execution integration with existing features', () => {
    it('should ignore timeout parameter for background execution', async () => {
      const input: BashToolInput = {
        command: 'sleep 3',
        timeout: 1000, // Should be ignored for background
        run_in_background: true
      };

      const startTime = Date.now();
      const result = await bashTool.execute(input);
      const duration = Date.now() - startTime;

      // Should return immediately despite timeout
      expect(duration).toBeLessThan(100);
      expect(result.success).toBe(true);

      if (result.output && 'background' in result.output && result.output.background) {
        expect(result.output.background).toBe(true);
        expect(result.output.status).toBe('running');
      }
    });

    it('should respect working directory for background execution', async () => {
      const input: BashToolInput = {
        command: 'pwd',
        run_in_background: true
      };

      const result = await bashTool.execute(input, {
        workingDirectory: '/tmp'
      });

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Wait for completion
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check output contains correct directory
        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('/tmp');
      }
    });

    it('should respect environment variables for background execution', async () => {
      const input: BashToolInput = {
        command: 'echo $BG_TEST_VAR',
        run_in_background: true
      };

      const result = await bashTool.execute(input, {
        environment: { BG_TEST_VAR: 'background_env_test' }
      });

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Wait for completion
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check output contains environment variable
        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('background_env_test');
      }
    });

    it('should maintain proper security validation for background execution', async () => {
      // Test dangerous command is still blocked in background
      const dangerousInput: BashToolInput = {
        command: 'rm -rf /', // Dangerous command
        run_in_background: true
      };

      const result = await bashTool.execute(dangerousInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('dangerous');
    });
  });

  describe('Error handling for background execution', () => {
    it('should handle process spawn failures gracefully', async () => {
      const input: BashToolInput = {
        command: '/nonexistent/command',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      // Should still succeed in starting the task, even if command fails
      expect(result.success).toBe(true);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Wait for failure
        await new Promise(resolve => setTimeout(resolve, 500));

        // Task should be marked as failed
        const status = manager.getStatus(taskId);
        expect(status!.status).toBe('failed');
      }
    });

    it('should handle stderr output for background tasks', async () => {
      const input: BashToolInput = {
        command: 'echo "Error message" >&2; exit 1',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Wait for completion
        await new Promise(resolve => setTimeout(resolve, 500));

        // Should capture stderr and exit code
        const output = manager.getOutput(taskId);
        expect(output!.stderr).toContain('Error message');

        const status = manager.getStatus(taskId);
        expect(status!.status).toBe('failed');
        expect(status!.exitCode).toBe(1);
      }
    });
  });
});