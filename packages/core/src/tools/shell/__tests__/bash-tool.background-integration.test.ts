/**
 * @fileoverview Comprehensive Integration Tests for BashTool Background Execution
 * Tests real-world scenarios and edge cases for background task management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BashTool } from '../bash-tool.js';
import { BackgroundTaskManager } from '../background-task-manager.js';
import type { BashToolInput, BashToolBackgroundOutput } from '../bash-tool.js';

describe('BashTool Background Execution - Integration Tests', () => {
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

  describe('real-world development scenarios', () => {
    it('should handle long-running development server in background', async () => {
      const input: BashToolInput = {
        command: 'echo "Starting dev server..."; sleep 0.5; echo "Server listening on port 3000"; sleep 5; echo "Request received"',
        run_in_background: true,
        description: 'Development server simulation'
      };

      const startTime = Date.now();
      const result = await bashTool.execute(input);
      const returnDuration = Date.now() - startTime;

      // Should return immediately
      expect(returnDuration).toBeLessThan(100);
      expect(result.success).toBe(true);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Check initial status
        let status = manager.getStatus(taskId);
        expect(status!.status).toBe('running');
        expect(status!.command).toContain('Starting dev server');

        // Check progressive output collection
        await new Promise(resolve => setTimeout(resolve, 300));
        let output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('Starting dev server');

        await new Promise(resolve => setTimeout(resolve, 400));
        output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('Server listening on port 3000');

        // Kill the "server"
        const killResult = manager.kill(taskId);
        expect(killResult.success).toBe(true);

        await new Promise(resolve => setTimeout(resolve, 200));
        status = manager.getStatus(taskId);
        expect(status!.status).toBe('killed');
      }
    }, 10000);

    it('should handle file watching scenarios', async () => {
      const input: BashToolInput = {
        command: 'echo "Watching files..."; for i in $(seq 1 3); do echo "File changed: file$i.txt"; sleep 0.2; done',
        run_in_background: true,
        description: 'File watcher simulation'
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Wait for file changes to be detected
        await new Promise(resolve => setTimeout(resolve, 1000));

        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('Watching files');
        expect(output!.stdout).toContain('File changed: file1.txt');
        expect(output!.stdout).toContain('File changed: file2.txt');
        expect(output!.stdout).toContain('File changed: file3.txt');

        const status = manager.getStatus(taskId);
        expect(status!.status).toBe('completed');
      }
    }, 10000);

    it('should handle background test runners', async () => {
      const input: BashToolInput = {
        command: `
          echo "Running test suite in watch mode..."
          echo "✓ test1.spec.js - 3 tests passed"
          sleep 0.1
          echo "✓ test2.spec.js - 2 tests passed"
          sleep 0.1
          echo "✓ test3.spec.js - 4 tests passed"
          echo "All tests passed (9/9)"
        `,
        run_in_background: true,
        description: 'Test runner in watch mode'
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 500));

        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('Running test suite in watch mode');
        expect(output!.stdout).toContain('test1.spec.js - 3 tests passed');
        expect(output!.stdout).toContain('All tests passed (9/9)');

        const status = manager.getStatus(taskId);
        expect(status!.status).toBe('completed');
        expect(status!.exitCode).toBe(0);
      }
    });

    it('should handle build processes that output progress', async () => {
      const input: BashToolInput = {
        command: `
          echo "Starting build process..."
          echo "Compiling TypeScript..."
          sleep 0.1
          echo "✓ Compiled successfully"
          echo "Bundling assets..."
          sleep 0.1
          echo "✓ Assets bundled"
          echo "Build completed in 2.3s"
        `,
        run_in_background: true,
        description: 'Build process with progress'
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 500));

        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('Starting build process');
        expect(output!.stdout).toContain('Compiled successfully');
        expect(output!.stdout).toContain('Assets bundled');
        expect(output!.stdout).toContain('Build completed in 2.3s');
      }
    });
  });

  describe('concurrent task management', () => {
    it('should handle multiple concurrent background processes', async () => {
      const tasks: string[] = [];

      // Start multiple concurrent tasks
      for (let i = 0; i < 5; i++) {
        const input: BashToolInput = {
          command: `echo "Task ${i} started"; sleep 0.${i + 2}; echo "Task ${i} completed"`,
          run_in_background: true
        };

        const result = await bashTool.execute(input);
        if (result.output && 'background' in result.output && result.output.background) {
          tasks.push(result.output.taskId);
        }
      }

      expect(tasks).toHaveLength(5);

      // All should be running initially
      for (const taskId of tasks) {
        const status = manager.getStatus(taskId);
        expect(status!.status).toBe('running');
      }

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 1000));

      // All should complete successfully
      let completedCount = 0;
      for (const taskId of tasks) {
        const status = manager.getStatus(taskId);
        if (status!.status === 'completed') {
          completedCount++;
        }
        expect(['completed', 'running']).toContain(status!.status);
      }

      expect(completedCount).toBeGreaterThan(0);
    }, 15000);

    it('should handle task priority and resource management', async () => {
      const shortTasks: string[] = [];
      const longTasks: string[] = [];

      // Start short tasks
      for (let i = 0; i < 3; i++) {
        const input: BashToolInput = {
          command: `echo "Quick task ${i}"; sleep 0.1`,
          run_in_background: true
        };

        const result = await bashTool.execute(input);
        if (result.output && 'background' in result.output && result.output.background) {
          shortTasks.push(result.output.taskId);
        }
      }

      // Start long tasks
      for (let i = 0; i < 2; i++) {
        const input: BashToolInput = {
          command: `echo "Long task ${i}"; sleep 2`,
          run_in_background: true
        };

        const result = await bashTool.execute(input);
        if (result.output && 'background' in result.output && result.output.background) {
          longTasks.push(result.output.taskId);
        }
      }

      // Check all are running
      const allTasks = manager.listAll('running');
      expect(allTasks.length).toBe(5);

      // Wait for short tasks to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Short tasks should complete first
      for (const taskId of shortTasks) {
        const status = manager.getStatus(taskId);
        expect(status!.status).toBe('completed');
      }

      // Long tasks should still be running
      for (const taskId of longTasks) {
        const status = manager.getStatus(taskId);
        expect(['running', 'completed']).toContain(status!.status);
      }

      // Clean up long tasks
      for (const taskId of longTasks) {
        manager.kill(taskId);
      }
    }, 10000);

    it('should handle task cancellation scenarios', async () => {
      const input: BashToolInput = {
        command: 'echo "Long running task"; sleep 10; echo "Should not reach here"',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Verify task starts
        let status = manager.getStatus(taskId);
        expect(status!.status).toBe('running');

        // Cancel after short delay
        await new Promise(resolve => setTimeout(resolve, 200));
        const killResult = manager.kill(taskId, 'SIGTERM');
        expect(killResult.success).toBe(true);

        await new Promise(resolve => setTimeout(resolve, 300));

        // Should be killed
        status = manager.getStatus(taskId);
        expect(status!.status).toBe('killed');

        // Should have partial output
        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('Long running task');
        expect(output!.stdout).not.toContain('Should not reach here');
      }
    }, 10000);
  });

  describe('error recovery and edge cases', () => {
    it('should handle commands that fail immediately', async () => {
      const input: BashToolInput = {
        command: 'echo "About to fail"; exit 1',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 300));

        const status = manager.getStatus(taskId);
        expect(status!.status).toBe('failed');
        expect(status!.exitCode).toBe(1);

        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('About to fail');
      }
    });

    it('should handle commands that produce large output', async () => {
      const input: BashToolInput = {
        command: 'for i in $(seq 1 100); do echo "Line $i of large output"; done',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 1000));

        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('Line 1 of large output');
        expect(output!.stdout).toContain('Line 50 of large output');
        expect(output!.stdout).toContain('Line 100 of large output');

        // Output should be properly buffered
        const lines = output!.stdout.split('\n').filter(line => line.includes('Line'));
        expect(lines.length).toBeGreaterThan(90); // Should capture most lines
      }
    }, 10000);

    it('should handle mixed stdout and stderr output', async () => {
      const input: BashToolInput = {
        command: `
          echo "Normal output line 1"
          echo "Error line 1" >&2
          echo "Normal output line 2"
          echo "Error line 2" >&2
        `,
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 500));

        const output = manager.getOutput(taskId);

        // Stdout should contain normal output
        expect(output!.stdout).toContain('Normal output line 1');
        expect(output!.stdout).toContain('Normal output line 2');

        // Stderr should contain error output
        expect(output!.stderr).toContain('Error line 1');
        expect(output!.stderr).toContain('Error line 2');

        // Cross contamination check
        expect(output!.stdout).not.toContain('Error line');
        expect(output!.stderr).not.toContain('Normal output');
      }
    });

    it('should handle process that exits with different signals', async () => {
      const input: BashToolInput = {
        command: 'trap "echo Caught SIGTERM; exit 130" TERM; sleep 5',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Let it start
        await new Promise(resolve => setTimeout(resolve, 100));

        // Send SIGTERM
        const killResult = manager.kill(taskId, 'SIGTERM');
        expect(killResult.success).toBe(true);

        await new Promise(resolve => setTimeout(resolve, 300));

        const status = manager.getStatus(taskId);
        expect(status!.status).toBe('killed');

        const output = manager.getOutput(taskId);
        // May or may not catch the trap depending on timing
        expect(output).toBeDefined();
      }
    }, 10000);
  });

  describe('performance and resource management', () => {
    it('should handle rapid task creation and completion', async () => {
      const taskIds: string[] = [];

      // Rapidly create many short tasks
      for (let i = 0; i < 20; i++) {
        const input: BashToolInput = {
          command: `echo "Rapid task ${i}"`,
          run_in_background: true
        };

        const result = await bashTool.execute(input);
        if (result.output && 'background' in result.output && result.output.background) {
          taskIds.push(result.output.taskId);
        }
      }

      expect(taskIds).toHaveLength(20);

      // All should start successfully
      for (const taskId of taskIds) {
        const status = manager.getStatus(taskId);
        expect(['running', 'completed']).toContain(status!.status);
      }

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Count completed tasks
      let completedCount = 0;
      for (const taskId of taskIds) {
        const status = manager.getStatus(taskId);
        if (status!.status === 'completed') {
          completedCount++;
        }
      }

      expect(completedCount).toBeGreaterThan(15); // Most should complete
    }, 10000);

    it('should handle memory usage with output buffering', async () => {
      const input: BashToolInput = {
        command: 'for i in $(seq 1 1000); do echo "Memory test line $i with some additional text to increase size"; done',
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 2000));

        const output = manager.getOutput(taskId);

        // Should handle large output without issues
        expect(output!.stdout).toContain('Memory test line 1');
        expect(output!.stdout).toContain('Memory test line 1000');

        // Output should be reasonably bounded (buffer management)
        const outputSize = output!.stdout.length;
        expect(outputSize).toBeGreaterThan(1000); // Should capture significant output
        expect(outputSize).toBeLessThan(2000000); // But not exceed reasonable limits
      }
    }, 15000);
  });

  describe('integration with context and environment', () => {
    it('should maintain working directory across background execution', async () => {
      const input: BashToolInput = {
        command: 'pwd; echo "Working in: $(pwd)"; ls -la',
        run_in_background: true
      };

      const result = await bashTool.execute(input, {
        workingDirectory: '/tmp'
      });

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 500));

        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('/tmp');
        expect(output!.stdout).toContain('Working in: /tmp');
      }
    });

    it('should preserve environment variables in background execution', async () => {
      const input: BashToolInput = {
        command: `
          echo "NODE_ENV: $NODE_ENV"
          echo "CUSTOM_VAR: $CUSTOM_VAR"
          echo "PATH exists: $([ -n "$PATH" ] && echo "yes" || echo "no")"
        `,
        run_in_background: true
      };

      const result = await bashTool.execute(input, {
        environment: {
          NODE_ENV: 'test',
          CUSTOM_VAR: 'background_test_value'
        }
      });

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        await new Promise(resolve => setTimeout(resolve, 500));

        const output = manager.getOutput(taskId);
        expect(output!.stdout).toContain('NODE_ENV: test');
        expect(output!.stdout).toContain('CUSTOM_VAR: background_test_value');
        expect(output!.stdout).toContain('PATH exists: yes');
      }
    });

    it('should handle AbortSignal gracefully for background tasks', async () => {
      const controller = new AbortController();

      const input: BashToolInput = {
        command: 'sleep 5',
        run_in_background: true
      };

      // Abort signal should not affect background task creation
      setTimeout(() => controller.abort(), 50);

      const result = await bashTool.execute(input, {
        signal: controller.signal
      });

      // Background task creation should succeed despite signal
      expect(result.success).toBe(true);

      if (result.output && 'background' in result.output && result.output.background) {
        const taskId = result.output.taskId;

        // Task should still be running
        const status = manager.getStatus(taskId);
        expect(['running', 'completed']).toContain(status!.status);

        // Clean up
        manager.kill(taskId);
      }
    });
  });
});