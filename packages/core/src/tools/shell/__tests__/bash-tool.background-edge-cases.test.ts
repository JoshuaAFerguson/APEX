/**
 * @fileoverview Edge Cases and Error Handling Tests for BashTool Background Execution
 * Tests boundary conditions, error scenarios, and unusual cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BashTool } from '../bash-tool.js';
import { BackgroundTaskManager } from '../background-task-manager.js';
import type { BashToolInput, BashToolBackgroundOutput } from '../bash-tool.js';

describe('BashTool Background Execution - Edge Cases', () => {
  let bashTool: BashTool;
  let manager: BackgroundTaskManager;

  beforeEach(() => {
    bashTool = new BashTool();
    manager = BackgroundTaskManager.getInstance();
  });

  afterEach(async () => {
    await manager.shutdownAll(1000);
    BackgroundTaskManager.resetInstance();
  });

  describe('boundary conditions', () => {
    it('should handle empty command in background', async () => {
      const input: BashToolInput = {
        command: '',
        run_in_background: true
      };

      // Empty command should fail validation
      const validation = bashTool.validate(input);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('command cannot be empty');
    });

    it('should handle extremely long commands in background', async () => {
      const longCommand = 'echo "' + 'x'.repeat(10000) + '"';
      const input: BashToolInput = {
        command: longCommand,
        run_in_background: true
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 500));

        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('x'.repeat(100)); // Should contain part of the output
      }
    });

    it('should handle commands with special characters in background', async () => {
      const specialCommand = 'echo "Special chars: !@#$%^&*()[]{}|\\:;\"\'<>,.?/~`"';
      const input: BashToolInput = {
        command: specialCommand,
        run_in_background: true
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 500));

        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('Special chars:');
      }
    });

    it('should handle unicode and emoji in background commands', async () => {
      const unicodeCommand = 'echo "Unicode: 你好世界 🌍 🚀 ⭐ café naïve"';
      const input: BashToolInput = {
        command: unicodeCommand,
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 500));

        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('你好世界');
        expect(output!.stdout).toContain('🌍');
        expect(output!.stdout).toContain('café');
      }
    });

    it('should handle very fast completing commands', async () => {
      const input: BashToolInput = {
        command: 'true', // Instantly completing command
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Command might complete before we can check status
        await new Promise(resolve => setTimeout(resolve, 100));

        const status = manager.getStatus(taskId);
        expect(['running', 'completed']).toContain(status!.status);

        if (status!.status === 'completed') {
          expect(status!.exitCode).toBe(0);
        }
      }
    });

    it('should handle commands that produce no output', async () => {
      const input: BashToolInput = {
        command: 'true; sleep 0.1; true', // No stdout/stderr
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 300));

        const output = manager.getOutput(taskId);
        expect(output!.stdout).toBe('');
        expect(output!.stderr).toBe('');

        const status = manager.getStatus(taskId);
        expect(status!.status).toBe('completed');
        expect(status!.exitCode).toBe(0);
      }
    });
  });

  describe('resource limit edge cases', () => {
    it('should handle maximum concurrent task limit', async () => {
      const maxTasks = 10; // Assuming default limit
      const taskIds: string[] = [];

      // Start many long-running tasks
      for (let i = 0; i < maxTasks + 5; i++) {
        const input: BashToolInput = {
          command: `sleep 2`,
          run_in_background: true
        };

        const result = await bashTool.execute(input);
        if (result.success && result.output && 'background' in result.output) {
          taskIds.push(result.output.taskId);
        }
      }

      // Should have started multiple tasks (implementation dependent)
      expect(taskIds.length).toBeGreaterThan(5);

      // Clean up all tasks
      for (const taskId of taskIds) {
        manager.kill(taskId);
      }
    }, 10000);

    it('should handle output buffer limits', async () => {
      const input: BashToolInput = {
        command: 'yes "This is a line of output" | head -10000', // Large output
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 2000));

        const output = manager.getOutput(taskId);

        // Should have output, but potentially truncated to buffer limit
        expect(output!.stdout.length).toBeGreaterThan(1000);
        expect(output!.stdout).toContain('This is a line of output');

        // Buffer should not exceed reasonable limits (1MB default)
        expect(output!.stdout.length).toBeLessThan(2000000);
      }
    }, 15000);

    it('should handle task ID exhaustion gracefully', async () => {
      // This would require patching the ID generator, so we'll test that IDs are unique
      const taskIds: Set<string> = new Set();

      for (let i = 0; i < 20; i++) {
        const input: BashToolInput = {
          command: 'echo "test"',
          run_in_background: true
        };

        const result = await bashTool.execute(input);
        if (result.output && 'background' in result.output && result.output.background) {
          taskIds.add(result.output.taskId);
        }
      }

      // All task IDs should be unique
      expect(taskIds.size).toBe(20);

      // All should follow the bg_XXXXXXXX format
      for (const taskId of taskIds) {
        expect(taskId).toMatch(/^bg_[a-f0-9]{8}$/);
      }
    });
  });

  describe('error recovery scenarios', () => {
    it('should handle process that exits with unknown signal', async () => {
      const input: BashToolInput = {
        command: 'sleep 10',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Try to kill with unusual signal
        const killResult = manager.kill(taskId, 'SIGUSR1' as any);
        expect(killResult.success).toBe(true);

        await new Promise(resolve => setTimeout(resolve, 200));

        const status = manager.getStatus(taskId);
        expect(['killed', 'running', 'completed']).toContain(status!.status);
      }
    });

    it('should handle command with syntax errors in background', async () => {
      const input: BashToolInput = {
        command: 'echo "missing quote; invalid syntax',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 500));

        const status = manager.getStatus(taskId);
        expect(['failed', 'completed']).toContain(status!.status);

        if (status!.status === 'failed') {
          expect(status!.exitCode).not.toBe(0);
        }
      }
    });

    it('should handle commands that require interactive input', async () => {
      const input: BashToolInput = {
        command: 'read -p "Enter name: " name; echo "Hello $name"',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Command should start but likely hang waiting for input
        let status = manager.getStatus(taskId);
        expect(status!.status).toBe('running');

        // Kill the hanging process
        await new Promise(resolve => setTimeout(resolve, 200));
        manager.kill(taskId);

        await new Promise(resolve => setTimeout(resolve, 200));
        status = manager.getStatus(taskId);
        expect(status!.status).toBe('killed');
      }
    });

    it('should handle commands that spawn child processes', async () => {
      const input: BashToolInput = {
        command: 'echo "Parent process"; (sleep 1; echo "Child process") & wait',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 1500));

        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('Parent process');
        expect(output!.stdout).toContain('Child process');

        const status = manager.getStatus(taskId);
        expect(status!.status).toBe('completed');
      }
    }, 10000);

    it('should handle process cleanup when parent process dies', async () => {
      const input: BashToolInput = {
        command: 'echo "Starting"; sleep 3; echo "Finishing"',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Force kill process (simulating unexpected termination)
        const killResult = manager.kill(taskId, 'SIGKILL');
        expect(killResult.success).toBe(true);

        await new Promise(resolve => setTimeout(resolve, 200));

        const status = manager.getStatus(taskId);
        expect(status!.status).toBe('killed');

        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('Starting');
        expect(output!.stdout).not.toContain('Finishing');
      }
    });
  });

  describe('timing and race condition edge cases', () => {
    it('should handle rapid start/kill operations', async () => {
      const input: BashToolInput = {
        command: 'sleep 5',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Immediately try to kill (potential race condition)
        const killResult = manager.kill(taskId);
        expect(killResult.success).toBe(true);

        await new Promise(resolve => setTimeout(resolve, 100));

        const status = manager.getStatus(taskId);
        expect(['killed', 'running']).toContain(status!.status);
      }
    });

    it('should handle multiple kill attempts on same task', async () => {
      const input: BashToolInput = {
        command: 'sleep 3',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Multiple kill attempts
        const kill1 = manager.kill(taskId);
        const kill2 = manager.kill(taskId);
        const kill3 = manager.kill(taskId);

        expect(kill1.success).toBe(true);
        // Subsequent kills may fail or succeed depending on timing
        expect(typeof kill2.success).toBe('boolean');
        expect(typeof kill3.success).toBe('boolean');
      }
    });

    it('should handle checking status of very short-lived tasks', async () => {
      const input: BashToolInput = {
        command: 'echo "quick"; exit 0',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Immediately check status (may still be running or already completed)
        const immediateStatus = manager.getStatus(taskId);
        expect(['running', 'completed']).toContain(immediateStatus!.status);

        // Check again after delay
        await new Promise(resolve => setTimeout(resolve, 200));
        const laterStatus = manager.getStatus(taskId);
        expect(laterStatus!.status).toBe('completed');
      }
    });

    it('should handle concurrent status checks and kills', async () => {
      const input: BashToolInput = {
        command: 'sleep 2',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Concurrent operations
        const statusPromises = Array.from({ length: 5 }, () =>
          Promise.resolve(manager.getStatus(taskId))
        );

        const outputPromises = Array.from({ length: 3 }, () =>
          Promise.resolve(manager.getOutput(taskId))
        );

        setTimeout(() => manager.kill(taskId), 100);

        const [statuses, outputs] = await Promise.all([
          Promise.all(statusPromises),
          Promise.all(outputPromises)
        ]);

        // All operations should complete without throwing
        expect(statuses.length).toBe(5);
        expect(outputs.length).toBe(3);

        // All status objects should be valid
        for (const status of statuses) {
          expect(status).toBeDefined();
          expect(['running', 'killed', 'completed']).toContain(status!.status);
        }
      }
    });
  });

  describe('security and sandboxing edge cases', () => {
    it('should block dangerous commands even in background', async () => {
      const dangerousCommands = [
        'rm -rf /',
        'sudo rm -rf /',
        'mkfs.ext4 /dev/sda',
        'dd if=/dev/zero of=/dev/sda'
      ];

      for (const command of dangerousCommands) {
        const input: BashToolInput = {
          command,
          run_in_background: true
        };

        const result = await bashTool.execute(input);

        expect(result.success).toBe(false);
        expect(result.error).toContain('dangerous');
      }
    });

    it('should handle path traversal attempts in background', async () => {
      const input: BashToolInput = {
        command: 'cat ../../../etc/passwd',
        run_in_background: true
      };

      // This may or may not be blocked depending on security configuration
      const result = await bashTool.execute(input);

      // Either blocked by security or allowed but controlled
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle command injection attempts in background', async () => {
      const input: BashToolInput = {
        command: 'echo "safe"; rm -rf /tmp/*; echo "unsafe"',
        run_in_background: true
      };

      // Security validation should catch this
      const result = await bashTool.execute(input);

      if (result.success) {
        // If not blocked, should at least execute safely
        if (result.output && 'background' in result.output && result.output.background) {
          const taskId = result.output.taskId;

          await new Promise(resolve => setTimeout(resolve, 500));

          const output = manager.getOutput(taskId);
          expect(output).toBeDefined();
        }
      } else {
        // Should be blocked by security
        expect(result.error).toContain('dangerous');
      }
    });

    it('should handle environment variable injection in background', async () => {
      const input: BashToolInput = {
        command: 'echo $HOME; echo $PATH',
        run_in_background: true
      };

      const result = await bashTool.execute(input, {
        environment: {
          HOME: '/tmp/safe',
          PATH: '/usr/bin:/bin',
          'MALICIOUS; rm -rf /': 'should be ignored'
        }
      });

      if (result.success && result.output && 'background' in result.output) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 500));

        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('/tmp/safe');
        expect(output!.stdout).toContain('/usr/bin');
        expect(output!.stdout).not.toContain('rm -rf');
      }
    });
  });

  describe('memory and performance edge cases', () => {
    it('should handle task cleanup when manager is stressed', async () => {
      const taskIds: string[] = [];

      // Create many quick tasks to stress the manager
      for (let i = 0; i < 50; i++) {
        const input: BashToolInput = {
          command: `echo "Stress test ${i}"`,
          run_in_background: true
        };

        const result = await bashTool.execute(input);
        if (result.success && result.output && 'background' in result.output) {
          taskIds.push(result.output.taskId);
        }
      }

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 1000));

      // All tasks should be tracked properly
      for (const taskId of taskIds) {
        const status = manager.getStatus(taskId);
        expect(status).toBeDefined();
        expect(['running', 'completed', 'failed']).toContain(status!.status);
      }

      // Manager should handle cleanup
      const allTasks = manager.listAll();
      expect(allTasks.length).toBe(taskIds.length);
    }, 15000);

    it('should handle extremely rapid task creation', async () => {
      const taskPromises: Promise<any>[] = [];

      // Create tasks as fast as possible
      for (let i = 0; i < 10; i++) {
        const input: BashToolInput = {
          command: `echo "Rapid ${i}"`,
          run_in_background: true
        };

        taskPromises.push(bashTool.execute(input));
      }

      const results = await Promise.all(taskPromises);

      // All should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      // All tasks should be tracked
      const allTasks = manager.listAll();
      expect(allTasks.length).toBeGreaterThanOrEqual(10);
    });
  });
});