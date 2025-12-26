/**
 * Integration tests for ContainerExecutionProxy with real scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ContainerExecutionProxy,
  type ExecutionContext,
  type CommandExecutionOptions,
} from './container-execution-proxy';
import type {
  ContainerManager,
  ExecCommandResult,
} from '@apexcli/core';

// Mock ContainerManager with more realistic behavior
const createMockContainerManager = (): ContainerManager => {
  const manager = {
    execCommand: vi.fn(),
  } as unknown as ContainerManager;

  // Set up realistic exec behavior
  vi.mocked(manager.execCommand).mockImplementation(async (containerId, command, options) => {
    const commandStr = Array.isArray(command) ? command.join(' ') : command;

    // Simulate different command behaviors
    if (commandStr.includes('npm install')) {
      return {
        success: true,
        stdout: 'added 142 packages from 124 contributors',
        stderr: 'npm WARN deprecated package@1.0.0',
        exitCode: 0,
        command: commandStr,
      };
    }

    if (commandStr.includes('npm test')) {
      return {
        success: true,
        stdout: 'Test Suites: 5 passed, 5 total\nTests: 25 passed, 25 total',
        stderr: '',
        exitCode: 0,
        command: commandStr,
      };
    }

    if (commandStr.includes('build') && commandStr.includes('fail')) {
      return {
        success: false,
        stdout: 'Building application...',
        stderr: 'Error: Build failed due to compilation errors',
        exitCode: 1,
        command: commandStr,
        error: 'Build process failed',
      };
    }

    if (commandStr.includes('timeout-test')) {
      // Simulate timeout by waiting longer than the timeout
      await new Promise(resolve => setTimeout(resolve, (options?.timeout || 30000) + 1000));
      return {
        success: false,
        stdout: '',
        stderr: '',
        exitCode: 124,
        error: 'Command timed out',
      };
    }

    // Default success response
    return {
      success: true,
      stdout: `Command executed: ${commandStr}`,
      stderr: '',
      exitCode: 0,
      command: commandStr,
    };
  });

  return manager;
};

describe('ContainerExecutionProxy Integration Tests', () => {
  let mockContainerManager: ContainerManager;
  let proxy: ContainerExecutionProxy;

  beforeEach(() => {
    mockContainerManager = createMockContainerManager();
    proxy = new ContainerExecutionProxy(mockContainerManager, {
      defaultTimeout: 30000,
    });
  });

  describe('Real-world Development Workflows', () => {
    const developmentContext: ExecutionContext = {
      taskId: 'dev-workflow-001',
      containerId: 'dev-container-nodejs',
      isContainerWorkspace: true,
      runtimeType: 'docker',
      workingDir: '/app',
    };

    it('should handle a complete Node.js build pipeline', async () => {
      const commands = [
        'npm install',
        'npm run build',
        'npm test',
        'npm run lint',
      ];

      const results = await proxy.executeSequential(commands, developmentContext, {
        timeout: 120000,
        environment: { NODE_ENV: 'production' },
      });

      expect(results).toHaveLength(4);

      // All commands should succeed in this scenario
      expect(results.every(r => r.success)).toBe(true);
      expect(results[0].stdout).toContain('added 142 packages');
      expect(results[2].stdout).toContain('Test Suites: 5 passed');

      // Verify each used container execution
      expect(results.every(r => r.mode === 'container')).toBe(true);

      // Verify container manager was called correctly for each
      expect(mockContainerManager.execCommand).toHaveBeenCalledTimes(4);

      commands.forEach((command, index) => {
        expect(mockContainerManager.execCommand).toHaveBeenNthCalledWith(
          index + 1,
          'dev-container-nodejs',
          command,
          expect.objectContaining({
            timeout: 120000,
            workingDir: '/app',
            environment: { NODE_ENV: 'production' },
          }),
          'docker'
        );
      });
    });

    it('should stop pipeline on build failure', async () => {
      const commands = [
        'npm install',
        'npm run build-fail', // This will fail
        'npm test',           // This should not execute
      ];

      const results = await proxy.executeSequential(commands, developmentContext);

      expect(results).toHaveLength(2); // Should stop after second command fails
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].stderr).toContain('Build failed due to compilation errors');

      // Third command should not have been called
      expect(mockContainerManager.execCommand).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed container and local execution in development workflow', async () => {
      // Mock local execution
      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'Local git status clean', stderr: '' });
        }
        return {} as any;
      });

      // Container context for build commands
      const containerContext: ExecutionContext = {
        taskId: 'mixed-workflow',
        containerId: 'build-container',
        isContainerWorkspace: true,
        runtimeType: 'docker',
        workingDir: '/app',
      };

      // Local context for git operations
      const localContext: ExecutionContext = {
        taskId: 'mixed-workflow',
        isContainerWorkspace: false,
      };

      // Execute container command first
      const buildResult = await proxy.execute('npm run build', containerContext);
      expect(buildResult.mode).toBe('container');
      expect(buildResult.success).toBe(true);

      // Execute local command second
      const gitResult = await proxy.execute('git status --porcelain', localContext);
      expect(gitResult.mode).toBe('local');
      expect(gitResult.success).toBe(true);
      expect(gitResult.stdout).toContain('Local git status clean');
    });
  });

  describe('Error Scenarios and Recovery', () => {
    const prodContext: ExecutionContext = {
      taskId: 'prod-deployment',
      containerId: 'prod-container',
      isContainerWorkspace: true,
      runtimeType: 'podman',
      workingDir: '/deploy',
    };

    it('should handle container runtime errors gracefully', async () => {
      // Mock container manager to throw runtime error
      vi.mocked(mockContainerManager.execCommand).mockRejectedValueOnce(
        new Error('podman: container not running')
      );

      const result = await proxy.execute('echo test', prodContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('podman: container not running');
      expect(result.mode).toBe('container');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle timeout scenarios appropriately', async () => {
      const timeoutContext: ExecutionContext = {
        taskId: 'timeout-scenario',
        containerId: 'slow-container',
        isContainerWorkspace: true,
        runtimeType: 'docker',
      };

      // This will simulate a timeout by the mock
      const result = await proxy.execute('timeout-test', timeoutContext, {
        timeout: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(124);
    }, 10000); // Give test itself more time

    it('should handle missing container gracefully by falling back to local', async () => {
      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'Local fallback execution', stderr: '' });
        }
        return {} as any;
      });

      const missingContainerContext: ExecutionContext = {
        taskId: 'missing-container',
        isContainerWorkspace: true,
        // containerId is missing - should fallback to local
      };

      const result = await proxy.execute('echo fallback', missingContainerContext);

      expect(result.mode).toBe('local');
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Local fallback execution');
    });
  });

  describe('Event Monitoring in Real Scenarios', () => {
    it('should provide comprehensive event tracking for CI/CD pipeline', async () => {
      const events: Array<{ type: string; data: any; timestamp: number }> = [];

      proxy.on('execution:started', (data) => {
        events.push({ type: 'started', data, timestamp: Date.now() });
      });

      proxy.on('execution:completed', (data) => {
        events.push({ type: 'completed', data, timestamp: Date.now() });
      });

      proxy.on('execution:failed', (data) => {
        events.push({ type: 'failed', data, timestamp: Date.now() });
      });

      const ciContext: ExecutionContext = {
        taskId: 'ci-pipeline-001',
        containerId: 'ci-runner',
        isContainerWorkspace: true,
        runtimeType: 'docker',
        workingDir: '/ci',
      };

      // Execute a series of commands
      await proxy.execute('npm install', ciContext);
      await proxy.execute('npm test', ciContext);

      // Should have 4 events total (2 started, 2 completed)
      expect(events).toHaveLength(4);

      const startedEvents = events.filter(e => e.type === 'started');
      const completedEvents = events.filter(e => e.type === 'completed');

      expect(startedEvents).toHaveLength(2);
      expect(completedEvents).toHaveLength(2);

      // Verify event ordering and timing
      expect(startedEvents[0].timestamp).toBeLessThan(completedEvents[0].timestamp);
      expect(startedEvents[1].timestamp).toBeLessThan(completedEvents[1].timestamp);

      // Verify event data contains required fields
      startedEvents.forEach(event => {
        expect(event.data).toMatchObject({
          taskId: 'ci-pipeline-001',
          mode: 'container',
          containerId: 'ci-runner',
          timestamp: expect.any(Date),
        });
      });

      completedEvents.forEach(event => {
        expect(event.data).toMatchObject({
          taskId: 'ci-pipeline-001',
          mode: 'container',
          result: expect.objectContaining({
            success: true,
            mode: 'container',
          }),
          timestamp: expect.any(Date),
        });
      });

      proxy.removeAllListeners();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle high-concurrency execution efficiently', async () => {
      const concurrentContext: ExecutionContext = {
        taskId: 'concurrent-test',
        containerId: 'performance-container',
        isContainerWorkspace: true,
        runtimeType: 'docker',
      };

      const startTime = Date.now();

      // Execute 50 concurrent commands
      const promises = Array.from({ length: 50 }, (_, i) =>
        proxy.execute(`echo "Task ${i}"`, concurrentContext)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(50);
      expect(results.every(r => r.success)).toBe(true);

      // All results should be from container execution
      expect(results.every(r => r.mode === 'container')).toBe(true);

      // Performance check: should complete within reasonable time
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000); // 10 seconds max

      // Verify each command was unique
      const commands = results.map(r => r.command);
      const uniqueCommands = new Set(commands);
      expect(uniqueCommands.size).toBe(50);
    });

    it('should manage memory efficiently during long-running sequences', async () => {
      const memoryTestContext: ExecutionContext = {
        taskId: 'memory-management',
        containerId: 'memory-test-container',
        isContainerWorkspace: true,
        runtimeType: 'docker',
      };

      // Execute a long sequence of commands to test memory management
      const longSequence = Array.from({ length: 200 }, (_, i) => `echo "Memory test ${i}"`);

      const results = await proxy.executeSequential(longSequence, memoryTestContext);

      expect(results).toHaveLength(200);
      expect(results.every(r => r.success)).toBe(true);

      // Verify the proxy still functions correctly after many operations
      const finalTest = await proxy.execute('echo "Final test"', memoryTestContext);
      expect(finalTest.success).toBe(true);
      expect(finalTest.stdout).toContain('Final test');
    });
  });

  describe('Realistic Multi-Stage Deployment', () => {
    it('should handle a complete deployment pipeline with rollback capability', async () => {
      const deploymentEvents: Array<{ stage: string; success: boolean; output: string }> = [];

      proxy.on('execution:completed', (data) => {
        if (data.result.success) {
          deploymentEvents.push({
            stage: data.command,
            success: true,
            output: data.result.stdout,
          });
        }
      });

      proxy.on('execution:failed', (data) => {
        deploymentEvents.push({
          stage: data.command,
          success: false,
          output: data.error,
        });
      });

      const deployContext: ExecutionContext = {
        taskId: 'deployment-v2.1.0',
        containerId: 'deployment-runner',
        isContainerWorkspace: true,
        runtimeType: 'docker',
        workingDir: '/deploy',
      };

      // Simulate deployment pipeline
      const deploymentStages = [
        'npm ci',                    // Install dependencies
        'npm run build',            // Build application
        'npm run test:integration', // Integration tests
        'docker build -t app:v2.1.0 .', // Build container
      ];

      const deploymentResults = await proxy.executeSequential(
        deploymentStages,
        deployContext,
        {
          timeout: 300000, // 5 minute timeout for each stage
          environment: {
            NODE_ENV: 'production',
            VERSION: 'v2.1.0',
          },
        }
      );

      // All stages should succeed
      expect(deploymentResults.every(r => r.success)).toBe(true);
      expect(deploymentEvents).toHaveLength(4);

      // Verify each stage completed successfully
      expect(deploymentEvents[0].stage).toContain('npm ci');
      expect(deploymentEvents[1].stage).toContain('npm run build');
      expect(deploymentEvents[2].stage).toContain('test:integration');
      expect(deploymentEvents[3].stage).toContain('docker build');

      // Cleanup
      proxy.removeAllListeners();
    });
  });
});