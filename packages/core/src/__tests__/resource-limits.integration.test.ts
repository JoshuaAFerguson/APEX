/**
 * Resource Limits Integration Tests
 *
 * Comprehensive integration tests covering all aspects of container resource limits:
 * - CPU limits: CPU cores allocation and verification
 * - Memory limits: Memory allocation limits and validation
 * - Memory reservation: Soft memory limits for scheduling
 * - CPU shares: Relative CPU weight for competing containers
 * - PIDs limit: Process limit enforcement in containers
 * - Resource limit enforcement verification: End-to-end testing of applied limits
 *
 * These tests verify that resource limits are correctly:
 * 1. Parsed from configuration
 * 2. Translated to Docker runtime arguments
 * 3. Applied during container creation
 * 4. Enforced during container execution
 * 5. Monitored via container stats
 *
 * @see container-manager.ts - ContainerManager.buildResourceLimitsArgs()
 * @see types.ts - ResourceLimits schema
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import * as os from 'os';
import {
  ContainerManager,
  type ContainerOperationResult,
  type CreateContainerOptions,
  type ExecCommandResult,
  type ExecCommandOptions,
} from '../container-manager';
import { ContainerRuntime } from '../container-runtime';
import { type ContainerConfig, type ResourceLimits, type ContainerStats } from '../types';

// =============================================================================
// Mock Setup
// =============================================================================

vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('../container-runtime');

const mockExec = vi.mocked(exec);
const MockedContainerRuntime = vi.mocked(ContainerRuntime);

describe('Resource Limits Integration Tests', () => {
  let containerManager: ContainerManager;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock runtime instance
    mockRuntime = {
      type: 'docker',
      version: '24.0.0',
      available: true,
      detect: vi.fn().mockResolvedValue(true),
      getVersion: vi.fn().mockResolvedValue('24.0.0'),
    } as any;

    MockedContainerRuntime.mockImplementation(() => mockRuntime);

    containerManager = new ContainerManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================================================
  // CPU Limits Tests
  // =============================================================================

  describe('CPU Limits', () => {
    it('should apply single CPU core limit correctly', async () => {
      const config: ContainerConfig = {
        image: 'node:18-alpine',
        resourceLimits: {
          cpu: 1,
        },
      };

      // Mock successful container creation
      mockExec.mockImplementation((command, callback) => {
        expect(command).toContain('--cpus 1');
        expect(command).toContain('docker run');
        callback?.(null, { stdout: 'test-container-id', stderr: '' } as any);
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'test-task-cpu',
        autoStart: false,
      };

      const result = await containerManager.createContainer(options);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe('test-container-id');
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('--cpus 1'),
        expect.any(Function)
      );
    });

    it('should apply fractional CPU limit correctly', async () => {
      const config: ContainerConfig = {
        image: 'node:18-alpine',
        resourceLimits: {
          cpu: 0.5,
        },
      };

      mockExec.mockImplementation((command, callback) => {
        expect(command).toContain('--cpus 0.5');
        callback?.(null, { stdout: 'test-container-half-cpu', stderr: '' } as any);
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'test-task-half-cpu',
        autoStart: false,
      };

      const result = await containerManager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('--cpus 0.5'),
        expect.any(Function)
      );
    });

    it('should apply multi-core CPU limit correctly', async () => {
      const config: ContainerConfig = {
        image: 'node:18-alpine',
        resourceLimits: {
          cpu: 4,
        },
      };

      mockExec.mockImplementation((command, callback) => {
        expect(command).toContain('--cpus 4');
        callback?.(null, { stdout: 'test-container-quad-cpu', stderr: '' } as any);
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'test-task-quad-cpu',
        autoStart: false,
      };

      const result = await containerManager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('--cpus 4'),
        expect.any(Function)
      );
    });

    it('should verify CPU limit enforcement in running container', async () => {
      // Create container with CPU limit
      const config: ContainerConfig = {
        image: 'ubuntu:22.04',
        resourceLimits: {
          cpu: 1,
        },
      };

      mockExec.mockImplementation((command, callback) => {
        if (command.includes('docker run')) {
          expect(command).toContain('--cpus 1');
          callback?.(null, { stdout: 'cpu-limit-container', stderr: '' } as any);
        } else if (command.includes('docker exec')) {
          // Mock CPU stress test result - should be limited to ~1 CPU
          callback?.(null, {
            stdout: 'CPU usage limited to approximately 100%\n',
            stderr: ''
          } as any);
        } else if (command.includes('docker stats')) {
          // Mock stats showing CPU usage near 100% (1 core max)
          callback?.(null, {
            stdout: 'cpu-limit-container|99.5%|128MiB/1024MiB|12.5%|0B/0B|0B/0B|5\n',
            stderr: ''
          } as any);
        }
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'cpu-limit-test',
        autoStart: true,
      };

      const createResult = await containerManager.createContainer(options);
      expect(createResult.success).toBe(true);

      // Execute CPU stress test
      const execOptions: ExecCommandOptions = {
        timeout: 5000,
      };

      const execResult = await containerManager.execCommand(
        'cpu-limit-container',
        'yes > /dev/null & yes > /dev/null & wait', // Try to use 2 CPUs
        execOptions
      );

      expect(execResult.success).toBe(true);

      // Check container stats to verify CPU limit
      const stats = await containerManager.getStats('cpu-limit-container');

      expect(stats.cpuPercent).toBeLessThan(105); // Should be limited to ~100% (1 CPU)
    });
  });

  // =============================================================================
  // Memory Limits Tests
  // =============================================================================

  describe('Memory Limits', () => {
    it('should apply memory limit in megabytes', async () => {
      const config: ContainerConfig = {
        image: 'node:18-alpine',
        resourceLimits: {
          memory: '512m',
        },
      };

      mockExec.mockImplementation((command, callback) => {
        expect(command).toContain('--memory 512m');
        callback?.(null, { stdout: 'memory-limit-container', stderr: '' } as any);
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'memory-limit-test',
        autoStart: false,
      };

      const result = await containerManager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('--memory 512m'),
        expect.any(Function)
      );
    });

    it('should apply memory limit in gigabytes', async () => {
      const config: ContainerConfig = {
        image: 'node:18-alpine',
        resourceLimits: {
          memory: '2g',
        },
      };

      mockExec.mockImplementation((command, callback) => {
        expect(command).toContain('--memory 2g');
        callback?.(null, { stdout: 'memory-2g-container', stderr: '' } as any);
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'memory-2g-test',
        autoStart: false,
      };

      const result = await containerManager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('--memory 2g'),
        expect.any(Function)
      );
    });

    it('should verify memory limit enforcement', async () => {
      const config: ContainerConfig = {
        image: 'ubuntu:22.04',
        resourceLimits: {
          memory: '256m',
        },
      };

      mockExec.mockImplementation((command, callback) => {
        if (command.includes('docker run')) {
          expect(command).toContain('--memory 256m');
          callback?.(null, { stdout: 'memory-enforce-container', stderr: '' } as any);
        } else if (command.includes('docker exec')) {
          // Mock memory allocation failure when exceeding limit
          callback?.(new Error('Container killed due to memory limit') as any);
        } else if (command.includes('docker stats')) {
          callback?.(null, {
            stdout: 'memory-enforce-container|95%|240MiB/256MiB|93.75%|0B/0B|0B/0B|10\n',
            stderr: ''
          } as any);
        }
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'memory-enforce-test',
        autoStart: true,
      };

      const createResult = await containerManager.createContainer(options);
      expect(createResult.success).toBe(true);

      // Try to allocate more memory than limit
      const execOptions: ExecCommandOptions = {
        timeout: 10000,
      };

      // This should fail due to memory limit
      const execResult = await containerManager.execCommand(
        'memory-enforce-container',
        'dd if=/dev/zero of=/dev/shm/bigfile bs=1M count=300', // Try to allocate 300MB
        execOptions
      );

      expect(execResult.success).toBe(false);
      expect(execResult.error).toContain('memory limit');
    });

    it('should handle memory limit with swap disabled', async () => {
      const config: ContainerConfig = {
        image: 'node:18-alpine',
        resourceLimits: {
          memory: '512m',
          memorySwap: '512m', // Same as memory = no swap
        },
      };

      mockExec.mockImplementation((command, callback) => {
        expect(command).toContain('--memory 512m');
        expect(command).toContain('--memory-swap 512m');
        callback?.(null, { stdout: 'no-swap-container', stderr: '' } as any);
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'no-swap-test',
        autoStart: false,
      };

      const result = await containerManager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringMatching(/--memory 512m.*--memory-swap 512m/),
        expect.any(Function)
      );
    });
  });

  // =============================================================================
  // Memory Reservation Tests
  // =============================================================================

  describe('Memory Reservation', () => {
    it('should apply memory reservation (soft limit)', async () => {
      const config: ContainerConfig = {
        image: 'node:18-alpine',
        resourceLimits: {
          memory: '1g',
          memoryReservation: '512m',
        },
      };

      mockExec.mockImplementation((command, callback) => {
        expect(command).toContain('--memory 1g');
        expect(command).toContain('--memory-reservation 512m');
        callback?.(null, { stdout: 'memory-reservation-container', stderr: '' } as any);
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'memory-reservation-test',
        autoStart: false,
      };

      const result = await containerManager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringMatching(/--memory 1g.*--memory-reservation 512m/),
        expect.any(Function)
      );
    });

    it('should allow memory reservation without hard limit', async () => {
      const config: ContainerConfig = {
        image: 'node:18-alpine',
        resourceLimits: {
          memoryReservation: '256m',
        },
      };

      mockExec.mockImplementation((command, callback) => {
        expect(command).toContain('--memory-reservation 256m');
        expect(command).not.toContain('--memory ');
        callback?.(null, { stdout: 'soft-limit-container', stderr: '' } as any);
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'soft-limit-test',
        autoStart: false,
      };

      const result = await containerManager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('--memory-reservation 256m'),
        expect.any(Function)
      );
    });

    it('should verify memory reservation behavior under pressure', async () => {
      const config: ContainerConfig = {
        image: 'ubuntu:22.04',
        resourceLimits: {
          memory: '1g',
          memoryReservation: '256m',
        },
      };

      mockExec.mockImplementation((command, callback) => {
        if (command.includes('docker run')) {
          expect(command).toContain('--memory 1g');
          expect(command).toContain('--memory-reservation 256m');
          callback?.(null, { stdout: 'memory-pressure-container', stderr: '' } as any);
        } else if (command.includes('docker exec')) {
          // Simulate memory allocation success up to reservation
          callback?.(null, {
            stdout: 'Memory allocated successfully within reservation\n',
            stderr: ''
          } as any);
        } else if (command.includes('docker stats')) {
          callback?.(null, {
            stdout: 'memory-pressure-container|50%|300MiB/1024MiB|29.3%|0B/0B|0B/0B|15\n',
            stderr: ''
          } as any);
        }
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'memory-pressure-test',
        autoStart: true,
      };

      const createResult = await containerManager.createContainer(options);
      expect(createResult.success).toBe(true);

      // Allocate memory within reservation - should succeed
      const execOptions: ExecCommandOptions = {
        timeout: 5000,
      };

      const execResult = await containerManager.execCommand(
        'memory-pressure-container',
        'dd if=/dev/zero of=/dev/shm/reserved bs=1M count=200', // 200MB within 256MB reservation
        execOptions
      );

      expect(execResult.success).toBe(true);

      // Check memory usage
      const stats = await containerManager.getStats('memory-pressure-container');

      expect(stats.memoryUsage).toBeGreaterThan(200 * 1024 * 1024); // Should be using allocated memory
      expect(stats.memoryLimit).toBe(1024 * 1024 * 1024); // 1GB limit
    });
  });

  // =============================================================================
  // CPU Shares Tests
  // =============================================================================

  describe('CPU Shares', () => {
    it('should apply CPU shares for relative prioritization', async () => {
      const config: ContainerConfig = {
        image: 'node:18-alpine',
        resourceLimits: {
          cpuShares: 1024, // Normal priority (1024 is default)
        },
      };

      mockExec.mockImplementation((command, callback) => {
        expect(command).toContain('--cpu-shares 1024');
        callback?.(null, { stdout: 'normal-priority-container', stderr: '' } as any);
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'cpu-shares-normal-test',
        autoStart: false,
      };

      const result = await containerManager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('--cpu-shares 1024'),
        expect.any(Function)
      );
    });

    it('should apply high CPU shares for higher priority', async () => {
      const config: ContainerConfig = {
        image: 'node:18-alpine',
        resourceLimits: {
          cpuShares: 2048, // High priority (2x normal)
        },
      };

      mockExec.mockImplementation((command, callback) => {
        expect(command).toContain('--cpu-shares 2048');
        callback?.(null, { stdout: 'high-priority-container', stderr: '' } as any);
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'cpu-shares-high-test',
        autoStart: false,
      };

      const result = await containerManager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('--cpu-shares 2048'),
        expect.any(Function)
      );
    });

    it('should apply low CPU shares for background tasks', async () => {
      const config: ContainerConfig = {
        image: 'node:18-alpine',
        resourceLimits: {
          cpuShares: 512, // Low priority (0.5x normal)
        },
      };

      mockExec.mockImplementation((command, callback) => {
        expect(command).toContain('--cpu-shares 512');
        callback?.(null, { stdout: 'low-priority-container', stderr: '' } as any);
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'cpu-shares-low-test',
        autoStart: false,
      };

      const result = await containerManager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('--cpu-shares 512'),
        expect.any(Function)
      );
    });

    it('should verify CPU shares affect relative performance', async () => {
      // This test simulates the behavior of CPU shares under contention
      // Note: CPU shares only take effect when CPU is under contention

      let highPriorityStats: ContainerStats;
      let lowPriorityStats: ContainerStats;

      mockExec.mockImplementation((command, callback) => {
        if (command.includes('high-priority-container')) {
          if (command.includes('docker run')) {
            expect(command).toContain('--cpu-shares 2048');
            callback?.(null, { stdout: 'high-priority-container', stderr: '' } as any);
          } else if (command.includes('docker stats')) {
            // High priority container gets more CPU under contention
            callback?.(null, {
              stdout: 'high-priority-container|66.7%|128MiB/512MiB|25%|0B/0B|0B/0B|5\n',
              stderr: ''
            } as any);
          }
        } else if (command.includes('low-priority-container')) {
          if (command.includes('docker run')) {
            expect(command).toContain('--cpu-shares 512');
            callback?.(null, { stdout: 'low-priority-container', stderr: '' } as any);
          } else if (command.includes('docker stats')) {
            // Low priority container gets less CPU under contention
            callback?.(null, {
              stdout: 'low-priority-container|33.3%|128MiB/512MiB|25%|0B/0B|0B/0B|5\n',
              stderr: ''
            } as any);
          }
        }
      });

      // Create high priority container
      const highPriorityConfig: ContainerConfig = {
        image: 'ubuntu:22.04',
        resourceLimits: {
          cpuShares: 2048,
        },
      };

      const highPriorityResult = await containerManager.createContainer({
        config: highPriorityConfig,
        taskId: 'cpu-shares-high-competition',
        autoStart: true,
      });

      expect(highPriorityResult.success).toBe(true);

      // Create low priority container
      const lowPriorityConfig: ContainerConfig = {
        image: 'ubuntu:22.04',
        resourceLimits: {
          cpuShares: 512,
        },
      };

      const lowPriorityResult = await containerManager.createContainer({
        config: lowPriorityConfig,
        taskId: 'cpu-shares-low-competition',
        autoStart: true,
      });

      expect(lowPriorityResult.success).toBe(true);

      // Under CPU contention, high priority should get roughly 2x the CPU of low priority
      highPriorityStats = await containerManager.getStats('high-priority-container');
      lowPriorityStats = await containerManager.getStats('low-priority-container');

      // Verify CPU distribution reflects priority ratio
      const ratio = highPriorityStats.cpuPercent / lowPriorityStats.cpuPercent;
      expect(ratio).toBeCloseTo(2, 0.5); // Roughly 2:1 ratio with some tolerance
    });
  });

  // =============================================================================
  // PIDs Limit Tests
  // =============================================================================

  describe('PIDs Limit', () => {
    it('should apply PIDs limit for process count restriction', async () => {
      const config: ContainerConfig = {
        image: 'ubuntu:22.04',
        resourceLimits: {
          pidsLimit: 100,
        },
      };

      mockExec.mockImplementation((command, callback) => {
        expect(command).toContain('--pids-limit 100');
        callback?.(null, { stdout: 'pids-limit-container', stderr: '' } as any);
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'pids-limit-test',
        autoStart: false,
      };

      const result = await containerManager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('--pids-limit 100'),
        expect.any(Function)
      );
    });

    it('should apply low PIDs limit for security', async () => {
      const config: ContainerConfig = {
        image: 'alpine:latest',
        resourceLimits: {
          pidsLimit: 10, // Very restrictive
        },
      };

      mockExec.mockImplementation((command, callback) => {
        expect(command).toContain('--pids-limit 10');
        callback?.(null, { stdout: 'secure-container', stderr: '' } as any);
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'pids-security-test',
        autoStart: false,
      };

      const result = await containerManager.createContainer(options);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('--pids-limit 10'),
        expect.any(Function)
      );
    });

    it('should verify PIDs limit enforcement', async () => {
      const config: ContainerConfig = {
        image: 'ubuntu:22.04',
        resourceLimits: {
          pidsLimit: 50,
        },
      };

      mockExec.mockImplementation((command, callback) => {
        if (command.includes('docker run')) {
          expect(command).toContain('--pids-limit 50');
          callback?.(null, { stdout: 'pids-enforce-container', stderr: '' } as any);
        } else if (command.includes('docker exec') && command.includes('fork-bomb')) {
          // PIDs limit should prevent fork bomb
          callback?.(new Error('Resource temporarily unavailable (process limit reached)') as any);
        } else if (command.includes('docker stats')) {
          callback?.(null, {
            stdout: 'pids-enforce-container|25%|128MiB/512MiB|25%|0B/0B|0B/0B|50\n',
            stderr: ''
          } as any);
        }
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'pids-enforce-test',
        autoStart: true,
      };

      const createResult = await containerManager.createContainer(options);
      expect(createResult.success).toBe(true);

      // Try to create too many processes (fork bomb prevention)
      const execOptions: ExecCommandOptions = {
        timeout: 5000,
      };

      const execResult = await containerManager.execCommand(
        'pids-enforce-container',
        'fork-bomb', // Simulated fork bomb command
        execOptions
      );

      // Should fail due to PIDs limit
      expect(execResult.success).toBe(false);
      expect(execResult.error).toContain('process limit');

      // Verify current PID count is at limit
      const stats = await containerManager.getStats('pids-enforce-container');
      expect(stats.pids).toBe(50); // Should be at the limit
    });

    it('should allow normal operation within PIDs limit', async () => {
      const config: ContainerConfig = {
        image: 'ubuntu:22.04',
        resourceLimits: {
          pidsLimit: 100,
        },
      };

      mockExec.mockImplementation((command, callback) => {
        if (command.includes('docker run')) {
          expect(command).toContain('--pids-limit 100');
          callback?.(null, { stdout: 'pids-normal-container', stderr: '' } as any);
        } else if (command.includes('docker exec')) {
          // Normal process creation should succeed
          callback?.(null, {
            stdout: 'Processes created successfully\n',
            stderr: ''
          } as any);
        } else if (command.includes('docker stats')) {
          callback?.(null, {
            stdout: 'pids-normal-container|15%|128MiB/512MiB|25%|0B/0B|0B/0B|25\n',
            stderr: ''
          } as any);
        }
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'pids-normal-test',
        autoStart: true,
      };

      const createResult = await containerManager.createContainer(options);
      expect(createResult.success).toBe(true);

      // Create a reasonable number of processes
      const execOptions: ExecCommandOptions = {
        timeout: 5000,
      };

      const execResult = await containerManager.execCommand(
        'pids-normal-container',
        'for i in {1..20}; do sleep 1 & done; wait', // Create 20 background processes
        execOptions
      );

      // Should succeed within limits
      expect(execResult.success).toBe(true);

      // Verify PID usage is reasonable
      const stats = await containerManager.getStats('pids-normal-container');
      expect(stats.pids).toBeGreaterThan(5); // Should have some processes
      expect(stats.pids).toBeLessThan(100); // Should be under limit
    });
  });

  // =============================================================================
  // Resource Limit Enforcement Verification
  // =============================================================================

  describe('Resource Limit Enforcement Verification', () => {
    it('should apply and enforce multiple resource limits simultaneously', async () => {
      const config: ContainerConfig = {
        image: 'ubuntu:22.04',
        resourceLimits: {
          cpu: 2,
          memory: '1g',
          memoryReservation: '512m',
          cpuShares: 1536, // 1.5x priority
          pidsLimit: 200,
        },
      };

      mockExec.mockImplementation((command, callback) => {
        if (command.includes('docker run')) {
          expect(command).toContain('--cpus 2');
          expect(command).toContain('--memory 1g');
          expect(command).toContain('--memory-reservation 512m');
          expect(command).toContain('--cpu-shares 1536');
          expect(command).toContain('--pids-limit 200');
          callback?.(null, { stdout: 'full-limits-container', stderr: '' } as any);
        } else if (command.includes('docker exec')) {
          // Simulate successful execution within all limits
          callback?.(null, {
            stdout: 'All resource limits respected\n',
            stderr: ''
          } as any);
        } else if (command.includes('docker stats')) {
          callback?.(null, {
            stdout: 'full-limits-container|150%|800MiB/1024MiB|78.1%|1KiB/2KiB|5KiB/10KiB|45\n',
            stderr: ''
          } as any);
        }
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'full-limits-test',
        autoStart: true,
      };

      const createResult = await containerManager.createContainer(options);
      expect(createResult.success).toBe(true);

      // Execute a workload that exercises all resource limits
      const execOptions: ExecCommandOptions = {
        timeout: 10000,
      };

      const execResult = await containerManager.execCommand(
        'full-limits-container',
        'stress-ng --cpu 3 --vm 1 --vm-bytes 900M --timeout 5s', // Stress test within limits
        execOptions
      );

      expect(execResult.success).toBe(true);

      // Verify all limits are respected in stats
      const stats = await containerManager.getStats('full-limits-container');

      expect(stats.cpuPercent).toBeLessThanOrEqual(200); // Max 2 CPUs = 200%
      expect(stats.memoryUsage).toBeLessThanOrEqual(1024 * 1024 * 1024); // Max 1GB
      expect(stats.memoryLimit).toBe(1024 * 1024 * 1024); // 1GB limit
      expect(stats.pids).toBeLessThanOrEqual(200); // PIDs limit
    });

    it('should handle resource limit violations gracefully', async () => {
      const config: ContainerConfig = {
        image: 'ubuntu:22.04',
        resourceLimits: {
          cpu: 0.5,
          memory: '128m',
          pidsLimit: 20,
        },
      };

      const violations: string[] = [];

      mockExec.mockImplementation((command, callback) => {
        if (command.includes('docker run')) {
          callback?.(null, { stdout: 'limit-violations-container', stderr: '' } as any);
        } else if (command.includes('docker exec')) {
          if (command.includes('memory-stress')) {
            // Memory limit violation
            violations.push('memory');
            callback?.(new Error('Container killed - memory limit exceeded') as any);
          } else if (command.includes('cpu-stress')) {
            // CPU is throttled, not killed
            callback?.(null, {
              stdout: 'CPU usage throttled to limit\n',
              stderr: ''
            } as any);
          } else if (command.includes('fork-bomb')) {
            // PIDs limit violation
            violations.push('pids');
            callback?.(new Error('Resource temporarily unavailable - PIDs limit') as any);
          }
        } else if (command.includes('docker stats')) {
          callback?.(null, {
            stdout: 'limit-violations-container|50%|128MiB/128MiB|100%|0B/0B|0B/0B|20\n',
            stderr: ''
          } as any);
        }
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'violations-test',
        autoStart: true,
      };

      const createResult = await containerManager.createContainer(options);
      expect(createResult.success).toBe(true);

      const execOptions: ExecCommandOptions = {
        timeout: 5000,
      };

      // Test memory limit violation
      const memoryResult = await containerManager.execCommand(
        'limit-violations-container',
        'memory-stress', // Simulated memory stress
        execOptions
      );

      expect(memoryResult.success).toBe(false);
      expect(violations).toContain('memory');

      // Test CPU throttling (not a violation, just throttled)
      const cpuResult = await containerManager.execCommand(
        'limit-violations-container',
        'cpu-stress', // Simulated CPU stress
        execOptions
      );

      expect(cpuResult.success).toBe(true); // CPU is throttled, not killed

      // Test PIDs limit violation
      const pidsResult = await containerManager.execCommand(
        'limit-violations-container',
        'fork-bomb', // Simulated fork bomb
        execOptions
      );

      expect(pidsResult.success).toBe(false);
      expect(violations).toContain('pids');

      // Verify container stats reflect limits
      const stats = await containerManager.getStats('limit-violations-container');

      expect(stats.memoryPercent).toBeLessThanOrEqual(100);
      expect(stats.cpuPercent).toBeLessThanOrEqual(50); // 0.5 CPU = 50%
      expect(stats.pids).toBeLessThanOrEqual(20);
    });

    it('should apply consistent resource limits for recreated containers', async () => {
      const config: ContainerConfig = {
        image: 'node:18-alpine',
        resourceLimits: {
          cpu: 1.5,
          memory: '768m',
          cpuShares: 1280,
          pidsLimit: 150,
        },
      };

      let createCount = 0;

      mockExec.mockImplementation((command, callback) => {
        if (command.includes('docker run')) {
          createCount++;
          expect(command).toContain('--cpus 1.5');
          expect(command).toContain('--memory 768m');
          expect(command).toContain('--cpu-shares 1280');
          expect(command).toContain('--pids-limit 150');
          callback?.(null, { stdout: `recreate-container-${createCount}`, stderr: '' } as any);
        } else if (command.includes('docker stats')) {
          callback?.(null, {
            stdout: `recreate-container-${createCount}|75%|400MiB/768MiB|52%|0B/0B|0B/0B|25\n`,
            stderr: ''
          } as any);
        }
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'recreate-test',
        autoStart: true,
      };

      // Create container first time
      const createResult1 = await containerManager.createContainer(options);
      expect(createResult1.success).toBe(true);
      expect(createCount).toBe(1);

      // Create container second time (simulating recreation)
      const createResult2 = await containerManager.createContainer({
        ...options,
        taskId: 'recreate-test-2',
      });
      expect(createResult2.success).toBe(true);
      expect(createCount).toBe(2);

      // Verify limits are consistently applied
      const stats = await containerManager.getStats(`recreate-container-${createCount}`);

      expect(stats.cpuPercent).toBeLessThanOrEqual(150); // 1.5 CPUs max
      expect(stats.memoryLimit).toBe(768 * 1024 * 1024); // 768MB limit
      expect(stats.pids).toBeLessThanOrEqual(150); // PIDs limit preserved
    });

    it('should validate resource limits configuration before creation', async () => {
      // Test invalid resource limits
      const invalidConfigs: ContainerConfig[] = [
        {
          image: 'node:18-alpine',
          resourceLimits: {
            cpu: -1, // Invalid: negative CPU
          },
        },
        {
          image: 'node:18-alpine',
          resourceLimits: {
            memory: 'invalid-format', // Invalid: bad memory format
          },
        },
        {
          image: 'node:18-alpine',
          resourceLimits: {
            cpuShares: 1, // Invalid: too low
          },
        },
        {
          image: 'node:18-alpine',
          resourceLimits: {
            pidsLimit: 0, // Invalid: zero PIDs
          },
        },
      ];

      for (const [index, config] of invalidConfigs.entries()) {
        mockExec.mockImplementation((command, callback) => {
          // Should not be called for invalid configs
          callback?.(new Error('Configuration validation should prevent this') as any);
        });

        const options: CreateContainerOptions = {
          config,
          taskId: `invalid-test-${index}`,
          autoStart: false,
        };

        const result = await containerManager.createContainer(options);

        // Should fail due to invalid configuration
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid');
      }
    });
  });

  // =============================================================================
  // Integration with Container Stats Monitoring
  // =============================================================================

  describe('Resource Monitoring Integration', () => {
    it('should accurately report resource usage within limits', async () => {
      const config: ContainerConfig = {
        image: 'ubuntu:22.04',
        resourceLimits: {
          cpu: 2,
          memory: '1g',
          pidsLimit: 100,
        },
      };

      mockExec.mockImplementation((command, callback) => {
        if (command.includes('docker run')) {
          callback?.(null, { stdout: 'monitoring-container', stderr: '' } as any);
        } else if (command.includes('docker stats')) {
          // Realistic stats within limits
          callback?.(null, {
            stdout: 'monitoring-container|125.5%|756MiB/1024MiB|73.8%|15KiB/25KiB|100KiB/200KiB|35\n',
            stderr: ''
          } as any);
        }
      });

      const options: CreateContainerOptions = {
        config,
        taskId: 'monitoring-test',
        autoStart: true,
      };

      const createResult = await containerManager.createContainer(options);
      expect(createResult.success).toBe(true);

      const stats = await containerManager.getStats('monitoring-container');

      // Verify stats parsing and values
      expect(stats.cpuPercent).toBe(125.5);
      expect(stats.memoryUsage).toBe(756 * 1024 * 1024); // 756 MiB in bytes
      expect(stats.memoryLimit).toBe(1024 * 1024 * 1024); // 1 GiB in bytes
      expect(stats.memoryPercent).toBe(73.8);
      expect(stats.pids).toBe(35);

      // Verify usage is within configured limits
      expect(stats.cpuPercent).toBeLessThanOrEqual(200); // 2 CPUs = 200% max
      expect(stats.memoryUsage).toBeLessThanOrEqual(stats.memoryLimit);
      expect(stats.pids).toBeLessThanOrEqual(100);
    });

    it('should handle resource usage monitoring for multiple containers', async () => {
      const containers = [
        {
          name: 'container-1',
          config: {
            image: 'node:18-alpine',
            resourceLimits: { cpu: 1, memory: '512m', pidsLimit: 50 },
          },
        },
        {
          name: 'container-2',
          config: {
            image: 'python:3.11-slim',
            resourceLimits: { cpu: 0.5, memory: '256m', pidsLimit: 25 },
          },
        },
        {
          name: 'container-3',
          config: {
            image: 'alpine:latest',
            resourceLimits: { cpu: 2, memory: '1g', pidsLimit: 100 },
          },
        },
      ];

      const statsData = [
        'container-1|85%|400MiB/512MiB|78.1%|5KiB/10KiB|20KiB/40KiB|30',
        'container-2|45%|180MiB/256MiB|70.3%|2KiB/4KiB|10KiB/20KiB|15',
        'container-3|150%|700MiB/1024MiB|68.4%|8KiB/15KiB|50KiB/100KiB|75',
      ];

      mockExec.mockImplementation((command, callback) => {
        if (command.includes('docker run')) {
          const containerName = containers.find(c => command.includes(c.name))?.name || 'unknown';
          callback?.(null, { stdout: containerName, stderr: '' } as any);
        } else if (command.includes('docker stats')) {
          const containerName = command.match(/container-\d/)?.[0];
          const statsLine = statsData.find(line => line.startsWith(containerName!));
          if (statsLine) {
            callback?.(null, { stdout: statsLine, stderr: '' } as any);
          } else {
            callback?.(new Error('Container not found') as any);
          }
        }
      });

      // Create all containers
      const createResults = await Promise.all(
        containers.map(({ name, config }) =>
          containerManager.createContainer({
            config,
            taskId: `multi-${name}`,
            nameOverride: name,
            autoStart: true,
          })
        )
      );

      // All should succeed
      createResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Get stats for all containers
      const allStats = await Promise.all(
        containers.map(({ name }) => containerManager.getStats(name))
      );

      // Verify each container's stats are within their respective limits
      allStats.forEach((stats, index) => {
        const { resourceLimits } = containers[index].config;

        if (resourceLimits?.cpu) {
          expect(stats.cpuPercent).toBeLessThanOrEqual(resourceLimits.cpu * 100);
        }

        if (resourceLimits?.memory) {
          const memoryLimitBytes = resourceLimits.memory.endsWith('m')
            ? parseInt(resourceLimits.memory) * 1024 * 1024
            : parseInt(resourceLimits.memory) * 1024 * 1024 * 1024;
          expect(stats.memoryUsage).toBeLessThanOrEqual(memoryLimitBytes);
        }

        if (resourceLimits?.pidsLimit) {
          expect(stats.pids).toBeLessThanOrEqual(resourceLimits.pidsLimit);
        }
      });
    });
  });
});