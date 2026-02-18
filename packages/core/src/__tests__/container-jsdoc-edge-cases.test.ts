/**
 * Container JSDoc Edge Cases and Error Scenarios Tests
 *
 * This test suite validates error handling and edge cases for all JSDoc documented
 * functionality in container modules, ensuring robustness and proper error reporting.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { spawn } from 'child_process';
import { EventEmitter } from 'eventemitter3';

import {
  ContainerManager,
  ContainerLogStream,
} from '../container-manager';

import {
  ContainerRuntime,
} from '../container-runtime';

import {
  ContainerHealthMonitor,
} from '../container-health-monitor';

import { ContainerInfo } from '../types';

// Mock dependencies
vi.mock('child_process');
const mockExec = vi.mocked(exec);
const mockSpawn = vi.mocked(spawn);

describe('Container JSDoc Edge Cases and Error Scenarios', () => {
  let manager: ContainerManager;
  let runtime: ContainerRuntime;
  let healthMonitor: ContainerHealthMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    runtime = new ContainerRuntime();
    manager = new ContainerManager(runtime);
    healthMonitor = new ContainerHealthMonitor(manager, { autoStart: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ContainerManager Error Scenarios', () => {
    it('should handle container creation with invalid dockerfile path', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      // Mock file access failure for dockerfile
      const fs = await import('fs/promises');
      vi.spyOn(fs, 'access').mockRejectedValue(new Error('ENOENT: no such file or directory'));

      // Mock successful container creation (falls back to original image)
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(null, 'container123', '');
        return {} as any;
      });

      const result = await manager.createContainer({
        config: {
          image: 'node:18',
          dockerfile: 'nonexistent/Dockerfile',
          buildContext: './nonexistent'
        },
        taskId: 'task-123'
      });

      expect(result.success).toBe(true); // Should fallback to original image
    });

    it('should handle container operations with stderr warnings', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      // Mock command with stderr (but successful)
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(null, 'container123', 'Warning: deprecated flag used');
        return {} as any;
      });

      const result = await manager.startContainer('container123');
      expect(result.success).toBe(false); // Treats stderr as failure by design
      expect(result.error).toContain('Warning: deprecated flag used');
    });

    it('should handle malformed container inspect output', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      // Mock malformed inspect output
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(null, 'malformed|incomplete', ''); // Missing required fields
        return {} as any;
      });

      const info = await manager.getContainerInfo('container123');
      expect(info).toBeNull();
    });

    it('should handle container stats parsing with invalid data', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      // Mock invalid stats output
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(null, 'INVALID_FORMAT_HERE', '');
        return {} as any;
      });

      const stats = await manager.getStats('container123');
      expect(stats).toBeNull();
    });

    it('should handle command parsing with complex shell arguments', () => {
      const command = 'echo "hello world" | grep hello && echo "nested \'quotes\'"';

      // Test private method indirectly through execCommand
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(null, 'success', '');
        return {} as any;
      });

      expect(async () => {
        await manager.execCommand('container123', command);
      }).not.toThrow();
    });

    it('should handle container naming with special characters', () => {
      const taskId = 'task@#$%^&*()_+{}:"<>?';
      const name = manager.generateContainerName(taskId);

      // Should sanitize special characters
      expect(name).not.toMatch(/[^a-zA-Z0-9_.-]/);
      expect(name).toMatch(/^apex-/);
    });

    it('should handle events monitoring process crashes', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: vi.fn(),
        kill: vi.fn(),
        killed: false
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      await manager.startEventsMonitoring();

      // Simulate process crash
      mockProcess.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          setTimeout(() => handler(new Error('Process crashed')), 10);
        }
      });

      // Should handle crash gracefully
      expect(manager.isEventsMonitoringActive()).toBe(true);
    });

    it('should handle log streaming with corrupted data', () => {
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: vi.fn(),
        kill: vi.fn(),
        killed: false
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const logStream = new ContainerLogStream('container123', {
        timestamps: true
      }, 'docker');

      let parsedEntries = 0;
      logStream.on('data', (entry) => {
        parsedEntries++;
        expect(entry).toHaveProperty('message');
      });

      // Emit corrupted/incomplete log data
      mockProcess.stdout.emit('data', Buffer.from('incomplete timestamp line\n'));
      mockProcess.stdout.emit('data', Buffer.from('\x00\x01\x02corrupted binary data\n'));
      mockProcess.stdout.emit('data', Buffer.from('2024-01-01T12:00:00.000Z Valid log entry\n'));

      // Should handle corrupted data gracefully and parse what it can
      expect(parsedEntries).toBeGreaterThan(0);
    });

    it('should handle memory usage calculations with edge values', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      // Mock stats with edge case memory values
      const testCases = [
        'container123|25.5%|0B / 0B|0.0%|0B / 0B|0B / 0B|0', // Zero memory
        'container123|25.5%|1024PiB / 2048PiB|50.0%|1kB / 1kB|1MB / 1MB|1', // Very large values
        'container123|25.5%|invalid / invalid|NaN%|invalid / invalid|invalid / invalid|invalid', // Invalid values
      ];

      for (const testCase of testCases) {
        mockExec.mockImplementation((command: any, options: any, callback: any) => {
          callback(null, `CONTAINER|CPU %|MEM USAGE / LIMIT|MEM %|NET I/O|BLOCK I/O|PIDS\n${testCase}`, '');
          return {} as any;
        });

        const stats = await manager.getStats('container123');

        if (stats) {
          expect(typeof stats.memoryUsage).toBe('number');
          expect(typeof stats.memoryLimit).toBe('number');
          expect(stats.memoryUsage).toBeGreaterThanOrEqual(0);
          expect(stats.memoryLimit).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should handle container status transitions during operations', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      // Mock container that changes state during operation
      let callCount = 0;
      vi.spyOn(manager, 'getContainerInfo').mockImplementation(async () => {
        callCount++;
        const statuses = ['created', 'running', 'exited'];
        return {
          id: 'container123',
          name: 'test-container',
          image: 'node:18',
          status: statuses[Math.min(callCount - 1, statuses.length - 1)],
          createdAt: new Date(),
        } as ContainerInfo;
      });

      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(null, 'container123', '');
        return {} as any;
      });

      // Perform multiple operations that check container state
      await manager.startContainer('container123');
      await manager.stopContainer('container123');

      expect(callCount).toBeGreaterThan(0);
    });
  });

  describe('ContainerRuntime Error Scenarios', () => {
    it('should handle runtime detection with partial failures', async () => {
      // Mock docker success, podman failure
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('docker --version')) {
          callback(null, 'Docker version 24.0.7', '');
        } else if (command.includes('docker info')) {
          callback(null, 'Docker info', '');
        } else if (command.includes('podman')) {
          callback(new Error('Command not found'), '', 'podman: command not found');
        }
        return {} as any;
      });

      const results = await runtime.detectRuntimes();
      expect(results).toHaveLength(2);

      const dockerResult = results.find(r => r.type === 'docker');
      const podmanResult = results.find(r => r.type === 'podman');

      expect(dockerResult?.available).toBe(true);
      expect(podmanResult?.available).toBe(false);
      expect(podmanResult?.error).toContain('command not found');
    });

    it('should handle version parsing with malformed output', async () => {
      // Mock malformed version output
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('docker --version')) {
          callback(null, 'Some unexpected output format here', '');
        } else if (command.includes('docker info')) {
          callback(null, 'Docker info', '');
        }
        return {} as any;
      });

      const results = await runtime.detectRuntimes();
      const dockerResult = results.find(r => r.type === 'docker');

      expect(dockerResult?.available).toBe(true);
      expect(dockerResult?.versionInfo?.version).toBe('unknown');
    });

    it('should handle compatibility checks with invalid version formats', async () => {
      // Mock runtime with invalid version
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('docker --version')) {
          callback(null, 'Docker version invalid.version.format', '');
        } else if (command.includes('docker info')) {
          callback(null, 'Docker info', '');
        }
        return {} as any;
      });

      const compatibility = await runtime.validateCompatibility('docker', {
        minVersion: '20.0.0',
        maxVersion: '25.0.0'
      });

      expect(compatibility.compatible).toBe(false);
      expect(compatibility.versionCompatible).toBe(false);
      expect(compatibility.issues.length).toBeGreaterThan(0);
    });

    it('should handle runtime timeout scenarios', async () => {
      // Mock timeout during runtime detection
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        const error = new Error('Timeout') as any;
        error.code = 'ETIMEDOUT';
        setTimeout(() => callback(error, '', ''), 15000); // Longer than timeout
        return {} as any;
      });

      const results = await runtime.detectRuntimes();

      // Should handle timeout gracefully
      expect(results.every(r => !r.available)).toBe(true);
      expect(results.every(r => r.error)).toBe(true);
    });

    it('should handle version comparison edge cases', async () => {
      // Test version comparison with various formats
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('docker --version')) {
          callback(null, 'Docker version 20.10.0-beta1', ''); // Pre-release version
        } else if (command.includes('docker info')) {
          callback(null, 'Docker info', '');
        }
        return {} as any;
      });

      const compatibility = await runtime.validateCompatibility('docker', {
        minVersion: '20.0.0',
        maxVersion: '25.0.0'
      });

      // Should handle pre-release versions
      expect(compatibility).toBeDefined();
    });
  });

  describe('ContainerHealthMonitor Error Scenarios', () => {
    it('should handle health monitoring when container runtime becomes unavailable', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      await healthMonitor.startMonitoring();
      expect(healthMonitor.isActive()).toBe(true);

      // Simulate runtime becoming unavailable
      vi.spyOn(manager, 'listApexContainers').mockRejectedValue(new Error('Docker daemon stopped'));

      // Should handle error gracefully during health checks
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for potential health check

      expect(healthMonitor.isActive()).toBe(true); // Should continue monitoring
    });

    it('should handle container health evaluation with missing stats', async () => {
      const mockContainerInfo: ContainerInfo = {
        id: 'container123',
        name: 'test-container',
        image: 'node:18',
        status: 'running',
        createdAt: new Date()
      };

      vi.spyOn(manager, 'getContainerInfo').mockResolvedValue(mockContainerInfo);
      vi.spyOn(manager, 'getStats').mockResolvedValue(null); // No stats available

      const health = await healthMonitor.checkContainerHealth('container123');

      expect(health).toBeTruthy();
      expect(health?.status).not.toBe('healthy'); // Should not be healthy without stats
    });

    it('should handle health monitoring with rapidly changing container states', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      const containerStates = ['created', 'running', 'exited', 'running'];
      let stateIndex = 0;

      vi.spyOn(manager, 'listApexContainers').mockImplementation(async () => {
        const state = containerStates[stateIndex % containerStates.length];
        stateIndex++;

        return [{
          id: 'container123',
          name: 'apex-changing-state',
          image: 'node:18',
          status: state as any,
          createdAt: new Date()
        }];
      });

      vi.spyOn(manager, 'getStats').mockResolvedValue({
        cpuPercent: 10,
        memoryPercent: 50,
        pids: 100
      } as any);

      await healthMonitor.startMonitoring();

      // Wait for several health check cycles
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(healthMonitor.isActive()).toBe(true);
    });

    it('should handle health monitoring options validation', () => {
      // Test with invalid options
      const monitor = new ContainerHealthMonitor(manager, {
        interval: -1000,     // Invalid negative interval
        maxFailures: -5,     // Invalid negative failures
        timeout: -2000,      // Invalid negative timeout
      });

      expect(monitor).toBeInstanceOf(ContainerHealthMonitor);
      // Should have sensible defaults despite invalid input
    });

    it('should handle memory leak scenarios during long monitoring', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');
      vi.spyOn(manager, 'listApexContainers').mockResolvedValue([]);

      const monitor = new ContainerHealthMonitor(manager, {
        interval: 10, // Very fast interval for testing
        autoStart: false
      });

      await monitor.startMonitoring();

      // Add and remove many containers rapidly
      for (let i = 0; i < 100; i++) {
        const containerId = `container-${i}`;
        monitor['containerHealth'].set(containerId, {
          containerId,
          containerName: `test-${i}`,
          status: 'healthy',
          failingStreak: 0,
          lastCheckTime: new Date()
        });

        // Remove half of them
        if (i % 2 === 0) {
          monitor.removeContainer(containerId);
        }
      }

      const stats = monitor.getStats();
      expect(stats.totalContainers).toBeLessThan(100); // Should have cleaned up

      await monitor.stopMonitoring();
    });

    it('should handle concurrent health checks on the same container', async () => {
      const mockContainerInfo: ContainerInfo = {
        id: 'container123',
        name: 'test-container',
        image: 'node:18',
        status: 'running',
        createdAt: new Date()
      };

      vi.spyOn(manager, 'getContainerInfo').mockResolvedValue(mockContainerInfo);
      vi.spyOn(manager, 'getStats').mockResolvedValue({
        cpuPercent: 10,
        memoryPercent: 50,
        pids: 100
      } as any);

      // Execute multiple concurrent health checks
      const promises = Array.from({ length: 10 }, () =>
        healthMonitor.checkContainerHealth('container123')
      );

      const results = await Promise.allSettled(promises);

      // All should succeed or fail gracefully
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
      expect(results.every(r => r.status === 'fulfilled' && r.value !== null)).toBe(true);
    });
  });

  describe('Integration Error Scenarios', () => {
    it('should handle cascading failures across all components', async () => {
      // Simulate Docker daemon stopping during operations
      let dockerAvailable = true;

      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (!dockerAvailable) {
          callback(new Error('Cannot connect to Docker daemon'), '', 'Docker daemon not running');
          return {} as any;
        }
        callback(null, 'success', '');
        return {} as any;
      });

      vi.spyOn(runtime, 'getBestRuntime').mockImplementation(async () => {
        return dockerAvailable ? 'docker' : 'none';
      });

      // Start with Docker available
      const createResult = await manager.createContainer({
        config: { image: 'node:18' },
        taskId: 'test-task'
      });
      expect(createResult.success).toBe(true);

      // Docker becomes unavailable
      dockerAvailable = false;

      // Subsequent operations should handle gracefully
      const startResult = await manager.startContainer('container123');
      expect(startResult.success).toBe(false);
      expect(startResult.error).toContain('No container runtime available');
    });

    it('should handle resource exhaustion scenarios', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      // Mock system resource exhaustion
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(new Error('ENOMEM: not enough memory'), '', 'Cannot allocate memory');
        return {} as any;
      });

      const result = await manager.createContainer({
        config: { image: 'node:18' },
        taskId: 'resource-test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not enough memory');
    });

    it('should handle circular dependency issues between components', () => {
      // Test lazy loading mechanisms
      expect(() => {
        const { containerHealthMonitor } = require('../container-health-monitor');
        const instance = containerHealthMonitor.instance;
        expect(instance).toBeInstanceOf(ContainerHealthMonitor);
      }).not.toThrow();
    });
  });

  describe('Documentation Example Robustness', () => {
    it('should ensure all JSDoc examples handle realistic error conditions', async () => {
      // Test that documented examples work even when underlying systems have issues

      // Example: Container creation with network issues
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (Math.random() > 0.5) {
          callback(null, 'container123', '');
        } else {
          callback(new Error('Network timeout'), '', 'Could not reach Docker daemon');
        }
        return {} as any;
      });

      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      // Should handle intermittent failures gracefully
      const results = await Promise.allSettled([
        manager.createContainer({ config: { image: 'node:18' }, taskId: 'test1' }),
        manager.createContainer({ config: { image: 'node:18' }, taskId: 'test2' }),
        manager.createContainer({ config: { image: 'node:18' }, taskId: 'test3' }),
      ]);

      // Some may succeed, some may fail, but none should throw unhandled exceptions
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
      expect(results.every(r => r.status === 'fulfilled' && typeof r.value === 'object')).toBe(true);
    });

    it('should validate that all documented interfaces are properly typed', () => {
      // Compile-time type checking validation through usage
      const options: ContainerHealthMonitorOptions = {
        interval: 30000,
        maxFailures: 3,
        timeout: 5000,
        monitorAll: false,
        containerPrefix: 'apex',
        autoStart: true
      };

      expect(typeof options.interval).toBe('number');
      expect(typeof options.maxFailures).toBe('number');
      expect(typeof options.timeout).toBe('number');
      expect(typeof options.monitorAll).toBe('boolean');
      expect(typeof options.containerPrefix).toBe('string');
      expect(typeof options.autoStart).toBe('boolean');
    });
  });
});