/**
 * Dependency Install Performance Tests
 *
 * Tests performance characteristics and resource usage during dependency installation:
 * - Installation time benchmarks
 * - Memory usage monitoring
 * - Concurrent installation handling
 * - Large dependency tree performance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceManager } from '../workspace-manager';
import { Task, DependencyDetector, ContainerManager, ContainerHealthMonitor, containerRuntime } from '@apexcli/core';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rm: vi.fn(),
    access: vi.fn(),
  }
}));

vi.mock('child_process', () => ({ exec: vi.fn() }));

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    ContainerManager: vi.fn(),
    ContainerHealthMonitor: vi.fn(),
    DependencyDetector: vi.fn(),
    containerRuntime: { getBestRuntime: vi.fn() }
  };
});

describe('Dependency Install Performance Tests', () => {
  let workspaceManager: WorkspaceManager;
  let mockContainerManager: any;
  let mockDependencyDetector: any;
  let mockHealthMonitor: any;
  const projectPath = '/test/performance-project';

  beforeEach(async () => {
    vi.clearAllMocks();

    mockHealthMonitor = {
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getContainerHealth: vi.fn(),
      getStats: vi.fn().mockResolvedValue({
        memory: { usage: 128000000, limit: 512000000 },
        cpu: { usage: 25.5 },
        io: { read: 1000000, write: 500000 }
      })
    };

    mockContainerManager = {
      createContainer: vi.fn().mockResolvedValue({ success: true, containerId: 'perf-container' }),
      execCommand: vi.fn(),
      startEventsMonitoring: vi.fn(),
      stopEventsMonitoring: vi.fn(),
      isEventsMonitoringActive: vi.fn(),
      listApexContainers: vi.fn(),
      stopContainer: vi.fn(),
      removeContainer: vi.fn()
    };

    mockDependencyDetector = { detectPackageManagers: vi.fn() };

    vi.mocked(ContainerManager).mockImplementation(() => mockContainerManager);
    vi.mocked(ContainerHealthMonitor).mockImplementation(() => mockHealthMonitor);
    vi.mocked(DependencyDetector).mockImplementation(() => mockDependencyDetector);
    vi.mocked(containerRuntime).getBestRuntime.mockResolvedValue('docker');

    const mockFs = vi.mocked(require('fs').promises);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockRejectedValue(new Error('File not found'));

    workspaceManager = new WorkspaceManager({ projectPath, defaultStrategy: 'container' });
    await workspaceManager.initialize();
  });

  describe('Installation Time Benchmarks', () => {
    it('should complete npm install within reasonable time limits', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      });

      // Simulate realistic npm install time (30 seconds)
      mockContainerManager.execCommand.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Shortened for test
        return { success: true, stdout: 'added 1000 packages', stderr: '', exitCode: 0 };
      });

      const task: Task = {
        id: 'test-npm-performance',
        type: 'feature',
        title: 'Test NPM Performance',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'node:20-alpine', autoDependencyInstall: true, timeoutSeconds: 300 }
        }
      };

      const startTime = Date.now();
      const result = await workspaceManager.createWorkspace(task);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds in test
      expect(result.installationStats).toEqual(
        expect.objectContaining({
          duration: expect.any(Number),
          packagesInstalled: expect.any(Number)
        })
      );
    });

    it('should handle timeout gracefully for large projects', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      });

      // Simulate timeout scenario
      mockContainerManager.execCommand.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200)); // Simulate long operation
        throw new Error('Operation timed out after 180 seconds');
      });

      const task: Task = {
        id: 'test-timeout-handling',
        type: 'feature',
        title: 'Test Timeout Handling',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'node:20-alpine', autoDependencyInstall: true, timeoutSeconds: 180 }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/timeout|timed out/i);
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should monitor memory usage during installation', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true },
        installCommands: ['pip install -r requirements.txt']
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Successfully installed 50 packages',
        stderr: '',
        exitCode: 0
      });

      const task: Task = {
        id: 'test-memory-monitoring',
        type: 'feature',
        title: 'Test Memory Monitoring',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'python:3.11-slim',
            autoDependencyInstall: true,
            memoryLimit: '512m',
            monitorResources: true
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(true);
      expect(mockHealthMonitor.startMonitoring).toHaveBeenCalled();
      expect(mockHealthMonitor.getStats).toHaveBeenCalled();
      expect(result.resourceStats).toEqual(
        expect.objectContaining({
          peakMemoryUsage: expect.any(Number),
          averageMemoryUsage: expect.any(Number),
          memoryEfficiency: expect.any(Number)
        })
      );
    });

    it('should detect memory pressure during large installations', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      });

      // Simulate high memory usage
      mockHealthMonitor.getStats.mockResolvedValue({
        memory: { usage: 480000000, limit: 512000000 }, // 94% memory usage
        cpu: { usage: 85.2 },
        io: { read: 5000000, write: 2500000 }
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'added 5000 packages',
        stderr: 'npm WARN high memory usage detected',
        exitCode: 0
      });

      const task: Task = {
        id: 'test-memory-pressure',
        type: 'feature',
        title: 'Test Memory Pressure',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            memoryLimit: '512m',
            monitorResources: true
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringMatching(/high memory usage|memory pressure/i)
      );
      expect(result.resourceStats?.memoryEfficiency).toBeLessThan(0.1); // Low efficiency due to high usage
    });
  });

  describe('Concurrent Installation Handling', () => {
    it('should handle concurrent workspace creation efficiently', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'added 100 packages',
        stderr: '',
        exitCode: 0
      });

      const tasks: Task[] = Array.from({ length: 3 }, (_, i) => ({
        id: `test-concurrent-${i}`,
        type: 'feature',
        title: `Test Concurrent ${i}`,
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'node:20-alpine', autoDependencyInstall: true }
        }
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        tasks.map(task => workspaceManager.createWorkspace(task))
      );
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // All should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
      });

      // Concurrent execution should be faster than sequential
      expect(totalDuration).toBeLessThan(1000); // Should complete within 1 second for 3 concurrent tasks
    });

    it('should manage resource contention during concurrent installations', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true },
        installCommands: ['cargo build']
      });

      // Simulate varying execution times
      let callCount = 0;
      mockContainerManager.execCommand.mockImplementation(async () => {
        callCount++;
        const delay = callCount * 50; // Staggered completion
        await new Promise(resolve => setTimeout(resolve, delay));
        return { success: true, stdout: 'Finished dev target', stderr: '', exitCode: 0 };
      });

      const heavyTasks: Task[] = Array.from({ length: 2 }, (_, i) => ({
        id: `test-heavy-${i}`,
        type: 'feature',
        title: `Test Heavy ${i}`,
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'rust:1.75-alpine',
            autoDependencyInstall: true,
            cpuLimit: '1.0',
            memoryLimit: '1g'
          }
        }
      }));

      const results = await Promise.all(
        heavyTasks.map(task => workspaceManager.createWorkspace(task))
      );

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(callCount).toBe(2); // All tasks should have executed
    });
  });

  describe('Large Dependency Tree Performance', () => {
    it('should handle projects with large dependency trees', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install'],
        estimatedPackageCount: 2500 // Large project
      });

      mockContainerManager.execCommand.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 150)); // Longer installation time
        return {
          success: true,
          stdout: 'added 2500 packages from 1800 contributors',
          stderr: '',
          exitCode: 0
        };
      });

      const task: Task = {
        id: 'test-large-dependencies',
        type: 'feature',
        title: 'Test Large Dependency Tree',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            timeoutSeconds: 600,
            memoryLimit: '2g'
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(true);
      expect(result.installationStats?.packagesInstalled).toBeGreaterThan(2000);
    });

    it('should optimize installation for monorepos', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [
          {
            type: 'yarn',
            language: 'javascript',
            installCommand: 'yarn install',
            detected: true,
            isWorkspace: true,
            workspacePackages: Array.from({ length: 20 }, (_, i) => `packages/package-${i}`)
          }
        ],
        hasPackageManagers: true,
        primaryManager: { type: 'yarn', language: 'javascript', installCommand: 'yarn install', detected: true },
        installCommands: ['yarn install']
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Done in 45.23s. [workspace optimization enabled]',
        stderr: '',
        exitCode: 0
      });

      const task: Task = {
        id: 'test-monorepo-optimization',
        type: 'feature',
        title: 'Test Monorepo Optimization',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            optimizeForMonorepos: true
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(true);
      expect(mockContainerManager.execCommand).toHaveBeenCalledTimes(1); // Single workspace install
      expect(result.installationStats?.optimizationsApplied).toContain('workspace-hoisting');
    });
  });

  describe('Resource Usage Analytics', () => {
    it('should provide detailed resource usage analytics', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true },
        installCommands: ['pip install -r requirements.txt']
      });

      // Simulate varying resource usage over time
      let statsCalls = 0;
      mockHealthMonitor.getStats.mockImplementation(async () => {
        statsCalls++;
        return {
          memory: { usage: 100000000 + (statsCalls * 20000000), limit: 512000000 },
          cpu: { usage: 20 + (statsCalls * 10) },
          io: { read: statsCalls * 500000, write: statsCalls * 250000 }
        };
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Successfully installed 25 packages',
        stderr: '',
        exitCode: 0
      });

      const task: Task = {
        id: 'test-resource-analytics',
        type: 'feature',
        title: 'Test Resource Analytics',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'python:3.11-slim',
            autoDependencyInstall: true,
            monitorResources: true,
            resourceSamplingInterval: 100
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(true);
      expect(result.resourceStats).toEqual(
        expect.objectContaining({
          peakMemoryUsage: expect.any(Number),
          averageMemoryUsage: expect.any(Number),
          peakCpuUsage: expect.any(Number),
          totalIoOperations: expect.any(Number),
          resourceEfficiency: expect.any(Number),
          samplingCount: expect.any(Number)
        })
      );
    });
  });
});