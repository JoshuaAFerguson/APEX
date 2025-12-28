/**
 * Edge Cases and Error Scenario Tests for WorkspaceManager Cross-Platform Support
 *
 * This test suite covers edge cases, error handling, and boundary conditions
 * for the cross-platform functionality of WorkspaceManager.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceManager } from './workspace-manager';
import { Task } from '@apexcli/core';
import * as childProcess from 'child_process';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(() => Promise.resolve()),
    readdir: vi.fn(() => Promise.resolve([])),
    readFile: vi.fn(),
    writeFile: vi.fn(() => Promise.resolve()),
    rm: vi.fn(() => Promise.resolve()),
    access: vi.fn(() => Promise.resolve())
  }
}));

vi.mock('child_process');

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    containerRuntime: {
      getBestRuntime: vi.fn(() => Promise.resolve('none'))
    },
    ContainerManager: vi.fn(() => ({
      createContainer: vi.fn(),
      execCommand: vi.fn(),
      listApexContainers: vi.fn(() => Promise.resolve([])),
      stopContainer: vi.fn(),
      removeContainer: vi.fn(),
      startEventsMonitoring: vi.fn(),
      stopEventsMonitoring: vi.fn(),
      isEventsMonitoringActive: vi.fn(() => false)
    })),
    ContainerHealthMonitor: vi.fn(() => ({
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getStats: vi.fn(() => ({})),
      getContainerHealth: vi.fn()
    })),
    DependencyDetector: vi.fn(() => ({
      detectPackageManagers: vi.fn()
    })),
    getInstallCommand: vi.fn(),
    getOptimizedInstallCommand: vi.fn(),
    getPlatformShell: vi.fn(),
    resolveExecutable: vi.fn(),
    isWindows: vi.fn()
  };
});

describe('WorkspaceManager Edge Cases and Error Scenarios', () => {
  let manager: WorkspaceManager;
  let mockGetPlatformShell: any;
  let mockResolveExecutable: any;
  let mockIsWindows: any;
  let mockExec: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const core = await import('@apexcli/core');
    mockGetPlatformShell = core.getPlatformShell;
    mockResolveExecutable = core.resolveExecutable;
    mockIsWindows = core.isWindows;

    mockExec = vi.fn();
    (childProcess.exec as any) = mockExec;

    mockIsWindows.mockReturnValue(false);
    mockGetPlatformShell.mockReturnValue({
      shell: '/bin/sh',
      shellArgs: ['-c']
    });
    mockResolveExecutable.mockImplementation((name: string) => name);

    manager = new WorkspaceManager({
      projectPath: '/test/project',
      defaultStrategy: 'none'
    });

    await manager.initialize();
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe('Package Manager Command Resolution Edge Cases', () => {
    it('should handle null and undefined commands', () => {
      const workspace = manager as any;

      expect(workspace.resolvePackageManagerCommand(null)).toBe(null);
      expect(workspace.resolvePackageManagerCommand(undefined)).toBe(undefined);
    });

    it('should handle empty and whitespace-only commands', () => {
      const workspace = manager as any;

      expect(workspace.resolvePackageManagerCommand('')).toBe('');
      expect(workspace.resolvePackageManagerCommand('   ')).toBe('   ');
      expect(workspace.resolvePackageManagerCommand('\t')).toBe('\t');
      expect(workspace.resolvePackageManagerCommand('\n')).toBe('\n');
    });

    it('should handle commands with special characters', () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) =>
        name === 'npm' ? 'npm.cmd' : name
      );

      const workspace = manager as any;

      // Test various special characters
      expect(workspace.resolvePackageManagerCommand('npm install package@1.0.0')).toBe('npm.cmd install package@1.0.0');
      expect(workspace.resolvePackageManagerCommand('npm install @scope/package')).toBe('npm.cmd install @scope/package');
      expect(workspace.resolvePackageManagerCommand('npm install "package with spaces"')).toBe('npm.cmd install "package with spaces"');
    });

    it('should handle commands with environment variables', () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) =>
        name === 'npm' ? 'npm.cmd' : name
      );

      const workspace = manager as any;

      expect(workspace.resolvePackageManagerCommand('npm config set prefix $HOME/npm')).toBe('npm.cmd config set prefix $HOME/npm');
      expect(workspace.resolvePackageManagerCommand('npm install --prefix %APPDATA%\\npm')).toBe('npm.cmd install --prefix %APPDATA%\\npm');
    });

    it('should handle very long commands', () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) =>
        name === 'npm' ? 'npm.cmd' : name
      );

      const workspace = manager as any;
      const longCommand = 'npm install ' + 'package-name '.repeat(100).trim();
      const expected = 'npm.cmd install ' + 'package-name '.repeat(100).trim();

      expect(workspace.resolvePackageManagerCommand(longCommand)).toBe(expected);
    });

    it('should handle commands with no executable part', () => {
      const workspace = manager as any;

      // Commands that might be just arguments or empty
      expect(workspace.resolvePackageManagerCommand(' --help')).toBe(' --help');
      expect(workspace.resolvePackageManagerCommand('--version')).toBe('--version');
    });

    it('should handle resolveExecutable throwing errors', () => {
      mockResolveExecutable.mockImplementation((name: string) => {
        if (name === 'broken-executable') {
          throw new Error('Executable resolution failed');
        }
        return name;
      });

      const workspace = manager as any;

      expect(() => {
        workspace.resolvePackageManagerCommand('broken-executable install');
      }).toThrow('Executable resolution failed');
    });
  });

  describe('Shell Execution Error Scenarios', () => {
    it('should handle exec errors gracefully', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        process.nextTick(() => {
          callback(new Error('Command execution failed'), null);
        });
      });

      const task: Task = {
        id: 'test-exec-error',
        agentId: 'agent-1',
        status: 'pending',
        prompt: 'Test task',
        createdAt: new Date(),
        workspace: { strategy: 'directory', cleanup: true, preserveOnFailure: false }
      };

      await expect(manager.createWorkspace(task)).rejects.toThrow();
    });

    it('should handle platform detection failures', () => {
      mockIsWindows.mockImplementation(() => {
        throw new Error('Platform detection failed');
      });

      expect(() => {
        mockGetPlatformShell();
      }).toThrow('Platform detection failed');
    });

    it('should handle shell configuration errors', () => {
      mockGetPlatformShell.mockImplementation(() => {
        throw new Error('Shell configuration failed');
      });

      const task: Task = {
        id: 'test-shell-error',
        agentId: 'agent-1',
        status: 'pending',
        prompt: 'Test task',
        createdAt: new Date(),
        workspace: { strategy: 'worktree', cleanup: true, preserveOnFailure: false }
      };

      expect(async () => {
        await manager.createWorkspace(task);
      }).rejects.toThrow();
    });
  });

  describe('Container Dependency Installation Edge Cases', () => {
    it('should handle dependency detector failures', async () => {
      const dependencyDetector = (manager as any).dependencyDetector;
      dependencyDetector.detectPackageManagers.mockRejectedValue(
        new Error('Failed to detect package managers')
      );

      const task: Task = {
        id: 'test-detection-failure',
        agentId: 'agent-1',
        status: 'pending',
        prompt: 'Test task',
        createdAt: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          preserveOnFailure: false,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true
          }
        }
      };

      const containerManager = (manager as any).containerManager;
      containerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container'
      });

      const workspace = await manager.createWorkspace(task);
      expect(workspace.containerId).toBe('test-container');
      // Should still succeed even if dependency detection fails
    });

    it('should handle missing primary manager', async () => {
      const dependencyDetector = (manager as any).dependencyDetector;
      dependencyDetector.detectPackageManagers.mockResolvedValue({
        primaryManager: null,
        allManagers: []
      });

      const task: Task = {
        id: 'test-no-manager',
        agentId: 'agent-1',
        status: 'pending',
        prompt: 'Test task',
        createdAt: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          preserveOnFailure: false,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true
          }
        }
      };

      const containerManager = (manager as any).containerManager;
      containerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container'
      });

      const workspace = await manager.createWorkspace(task);
      expect(workspace.containerId).toBe('test-container');
      // Should skip dependency installation gracefully
    });

    it('should handle exec command timeout errors', async () => {
      const task: Task = {
        id: 'test-timeout',
        agentId: 'agent-1',
        status: 'pending',
        prompt: 'Test task',
        createdAt: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          preserveOnFailure: false,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            installTimeout: 100 // Very short timeout
          }
        }
      };

      const containerManager = (manager as any).containerManager;
      containerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container'
      });

      // Mock a timeout scenario
      containerManager.execCommand.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: false,
              stdout: '',
              stderr: 'ETIMEDOUT: Command timed out',
              exitCode: 124,
              error: 'Command timed out'
            });
          }, 50);
        });
      });

      const dependencyDetector = (manager as any).dependencyDetector;
      dependencyDetector.detectPackageManagers.mockResolvedValue({
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm install',
          metadata: { hasLockfile: true }
        }
      });

      const workspace = await manager.createWorkspace(task);
      expect(workspace.warnings).toBeDefined();
      expect(workspace.warnings?.some(w => w.includes('timeout'))).toBe(true);
    });

    it('should handle multiple consecutive installation failures', async () => {
      const task: Task = {
        id: 'test-multiple-failures',
        agentId: 'agent-1',
        status: 'pending',
        prompt: 'Test task',
        createdAt: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          preserveOnFailure: false,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            installRetries: 3
          }
        }
      };

      const containerManager = (manager as any).containerManager;
      containerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container'
      });

      // Mock consecutive failures
      containerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'Network error: ECONNRESET',
        exitCode: 1,
        error: 'Installation failed'
      });

      const dependencyDetector = (manager as any).dependencyDetector;
      dependencyDetector.detectPackageManagers.mockResolvedValue({
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm install',
          metadata: { hasLockfile: true }
        }
      });

      const workspace = await manager.createWorkspace(task);
      expect(workspace.warnings).toBeDefined();
      expect(workspace.warnings!.length).toBeGreaterThan(0);
      expect(workspace.warnings![0]).toContain('after 4 attempts'); // 3 retries + initial attempt
    });
  });

  describe('Recovery Strategy Edge Cases', () => {
    it('should handle empty error messages in recovery strategies', async () => {
      const workspace = manager as any;

      const recovery = await workspace.applyRecoveryStrategy(
        'npm install',
        'npm',
        '', // Empty error message
        1
      );

      expect(recovery).toBe('npm install'); // Should return original command
      expect(workspace.getRecoveryStrategyName('', 'npm')).toBe('Standard retry');
    });

    it('should handle unknown package manager types', async () => {
      const workspace = manager as any;

      const recovery = await workspace.applyRecoveryStrategy(
        'unknown-pm install',
        'unknown' as any,
        'EACCES permission denied',
        1
      );

      expect(recovery).toBe('unknown-pm install'); // Should return original command
    });

    it('should handle complex error messages', async () => {
      const workspace = manager as any;

      const complexError = `
npm ERR! code EACCES
npm ERR! syscall open
npm ERR! path /usr/local/lib/node_modules/package/package.json
npm ERR! errno -13
npm ERR! Error: EACCES: permission denied, open '/usr/local/lib/node_modules/package/package.json'
npm ERR! [Error: EACCES: permission denied] {
npm ERR!   errno: -13,
npm ERR!   code: 'EACCES',
npm ERR!   syscall: 'open',
npm ERR!   path: '/usr/local/lib/node_modules/package/package.json'
npm ERR! }
      `.trim();

      expect(workspace.getRecoveryStrategyName(complexError, 'npm')).toBe('Cache cleanup and permission retry');
      expect(workspace.getErrorSuggestion(complexError)).toContain('Check file system permissions');
    });

    it('should handle very high retry attempt numbers', async () => {
      const workspace = manager as any;

      const recovery = await workspace.applyRecoveryStrategy(
        'npm install',
        'npm',
        'ECONNRESET',
        999 // Very high attempt number
      );

      expect(recovery).toBe('npm install'); // Should still work
    });
  });

  describe('Workspace Statistics Edge Cases', () => {
    it('should handle disk usage calculation errors', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command.includes('du -s')) {
          process.nextTick(() => {
            callback(new Error('du command failed'), null);
          });
        } else {
          process.nextTick(() => {
            callback(null, { stdout: 'success', stderr: '' });
          });
        }
      });

      // Add a mock workspace
      const workspace = {
        taskId: 'test-task',
        config: { strategy: 'directory' as const, cleanup: true, preserveOnFailure: false },
        workspacePath: '/test/workspace',
        status: 'active' as const,
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      (manager as any).activeWorkspaces.set('test-task', workspace);

      const stats = await manager.getWorkspaceStats();
      expect(stats.totalDiskUsage).toBe(0); // Should gracefully handle error and return 0
    });

    it('should handle empty workspace list', async () => {
      const stats = await manager.getWorkspaceStats();

      expect(stats.activeCount).toBe(0);
      expect(stats.cleanupPendingCount).toBe(0);
      expect(stats.totalDiskUsage).toBe(0);
      expect(stats.oldestWorkspace).toBeUndefined();
      expect(Object.keys(stats.workspacesByStrategy)).toHaveLength(0);
    });

    it('should handle container health monitoring failures', async () => {
      const healthMonitor = (manager as any).healthMonitor;
      healthMonitor.getStats.mockImplementation(() => {
        throw new Error('Health monitoring failed');
      });

      const stats = await manager.getWorkspaceStats();
      expect(stats.containerHealthStats).toBeUndefined();
    });
  });

  describe('Cross-Platform File Path Handling', () => {
    it('should handle Windows-style paths in Unix environment', () => {
      mockIsWindows.mockReturnValue(false);

      const workspace = manager as any;
      const windowsPath = 'C:\\Users\\Test\\npm.cmd install';

      expect(workspace.resolvePackageManagerCommand(windowsPath)).toBe(windowsPath);
    });

    it('should handle Unix-style paths in Windows environment', () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) =>
        name.includes('/') ? name : (name === 'npm' ? 'npm.cmd' : name)
      );

      const workspace = manager as any;
      const unixPath = '/usr/bin/npm install';

      expect(workspace.resolvePackageManagerCommand(unixPath)).toBe('/usr/bin/npm install');
    });

    it('should handle mixed path separators', () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) => name);

      const workspace = manager as any;
      const mixedPath = 'C:/Program Files\\nodejs/npm install';

      expect(workspace.resolvePackageManagerCommand(mixedPath)).toBe(mixedPath);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle workspace cleanup with many active workspaces', async () => {
      // Create many mock workspaces
      for (let i = 0; i < 100; i++) {
        const workspace = {
          taskId: `test-task-${i}`,
          config: { strategy: 'none' as const, cleanup: true, preserveOnFailure: false },
          workspacePath: `/test/workspace-${i}`,
          status: 'active' as const,
          createdAt: new Date(Date.now() - (i * 1000)),
          lastAccessed: new Date(Date.now() - (i * 500))
        };
        (manager as any).activeWorkspaces.set(`test-task-${i}`, workspace);
      }

      const stats = await manager.getWorkspaceStats();
      expect(stats.activeCount).toBe(100);

      // Cleanup old workspaces
      await manager.cleanupOldWorkspaces(1000); // Very short max age

      const newStats = await manager.getWorkspaceStats();
      expect(newStats.activeCount).toBeLessThan(100);
    });

    it('should handle concurrent workspace operations', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent-task-${i}`,
        agentId: 'agent-1',
        status: 'pending' as const,
        prompt: 'Test task',
        createdAt: new Date(),
        workspace: { strategy: 'none' as const, cleanup: true, preserveOnFailure: false }
      }));

      const promises = tasks.map(task => manager.createWorkspace(task));
      const results = await Promise.allSettled(promises);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);
    });
  });
});