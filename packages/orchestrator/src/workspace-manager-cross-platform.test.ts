/**
 * Comprehensive Cross-Platform Tests for WorkspaceManager
 *
 * This test suite provides comprehensive coverage of cross-platform functionality
 * including shell execution, package manager command resolution, and Windows compatibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceManager } from './workspace-manager';
import { Task } from '@apexcli/core';
import * as childProcess from 'child_process';
import * as os from 'os';

// Mock external dependencies
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

// Mock core dependencies
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    containerRuntime: {
      getBestRuntime: vi.fn(() => Promise.resolve('none'))
    },
    ContainerManager: vi.fn(() => ({
      createContainer: vi.fn(() => Promise.resolve({ success: true, containerId: 'test-id' })),
      execCommand: vi.fn(() => Promise.resolve({ success: true, stdout: '', stderr: '', exitCode: 0 })),
      listApexContainers: vi.fn(() => Promise.resolve([])),
      stopContainer: vi.fn(() => Promise.resolve()),
      removeContainer: vi.fn(() => Promise.resolve()),
      startEventsMonitoring: vi.fn(() => Promise.resolve()),
      stopEventsMonitoring: vi.fn(() => Promise.resolve()),
      isEventsMonitoringActive: vi.fn(() => false)
    })),
    ContainerHealthMonitor: vi.fn(() => ({
      startMonitoring: vi.fn(() => Promise.resolve()),
      stopMonitoring: vi.fn(() => Promise.resolve()),
      getStats: vi.fn(() => ({})),
      getContainerHealth: vi.fn()
    })),
    DependencyDetector: vi.fn(() => ({
      detectPackageManagers: vi.fn(() => Promise.resolve({
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm install',
          metadata: { hasLockfile: true }
        }
      }))
    })),
    getInstallCommand: vi.fn((manager) => manager?.installCommand || `${manager?.type} install`),
    getOptimizedInstallCommand: vi.fn((manager) => `${manager?.type} ci`),
    getPlatformShell: vi.fn(),
    resolveExecutable: vi.fn(),
    isWindows: vi.fn()
  };
});

describe('WorkspaceManager Cross-Platform Functionality', () => {
  let manager: WorkspaceManager;
  let mockGetPlatformShell: any;
  let mockResolveExecutable: any;
  let mockIsWindows: any;
  let mockExec: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked functions
    const core = await import('@apexcli/core');
    mockGetPlatformShell = core.getPlatformShell;
    mockResolveExecutable = core.resolveExecutable;
    mockIsWindows = core.isWindows;

    // Mock exec function
    mockExec = vi.fn((command, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }

      process.nextTick(() => {
        callback(null, { stdout: 'success', stderr: '' });
      });
    });

    (childProcess.exec as any) = mockExec;

    // Setup default mocks
    mockIsWindows.mockReturnValue(false);
    mockGetPlatformShell.mockReturnValue({
      shell: '/bin/sh',
      shellArgs: ['-c']
    });
    mockResolveExecutable.mockImplementation((name: string) => name);

    // Create manager instance
    manager = new WorkspaceManager({
      projectPath: '/test/project',
      defaultStrategy: 'none'
    });

    await manager.initialize();
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe('Package Manager Command Resolution', () => {
    describe('Windows Environment', () => {
      beforeEach(() => {
        mockIsWindows.mockReturnValue(true);
        mockGetPlatformShell.mockReturnValue({
          shell: 'cmd.exe',
          shellArgs: ['/d', '/s', '/c']
        });
      });

      it('should resolve npm commands with .cmd extension', () => {
        mockResolveExecutable.mockImplementation((name: string) =>
          name === 'npm' ? 'npm.cmd' : name
        );

        const workspace = manager as any;
        const resolved = workspace.resolvePackageManagerCommand('npm install express');

        expect(resolved).toBe('npm.cmd install express');
        expect(mockResolveExecutable).toHaveBeenCalledWith('npm');
      });

      it('should resolve yarn commands with .cmd extension', () => {
        mockResolveExecutable.mockImplementation((name: string) =>
          name === 'yarn' ? 'yarn.cmd' : name
        );

        const workspace = manager as any;
        const resolved = workspace.resolvePackageManagerCommand('yarn add express');

        expect(resolved).toBe('yarn.cmd add express');
        expect(mockResolveExecutable).toHaveBeenCalledWith('yarn');
      });

      it('should resolve pnpm commands with .cmd extension', () => {
        mockResolveExecutable.mockImplementation((name: string) =>
          name === 'pnpm' ? 'pnpm.cmd' : name
        );

        const workspace = manager as any;
        const resolved = workspace.resolvePackageManagerCommand('pnpm install express');

        expect(resolved).toBe('pnpm.cmd install express');
        expect(mockResolveExecutable).toHaveBeenCalledWith('pnpm');
      });

      it('should resolve pip commands with .exe extension', () => {
        mockResolveExecutable.mockImplementation((name: string) =>
          name === 'pip' ? 'pip.exe' : name
        );

        const workspace = manager as any;
        const resolved = workspace.resolvePackageManagerCommand('pip install requests');

        expect(resolved).toBe('pip.exe install requests');
        expect(mockResolveExecutable).toHaveBeenCalledWith('pip');
      });

      it('should preserve complex command arguments after resolution', () => {
        mockResolveExecutable.mockImplementation((name: string) =>
          name === 'npm' ? 'npm.cmd' : name
        );

        const workspace = manager as any;
        const complex = workspace.resolvePackageManagerCommand(
          'npm install --save-dev --registry https://custom-registry.com package@1.0.0'
        );

        expect(complex).toBe('npm.cmd install --save-dev --registry https://custom-registry.com package@1.0.0');
      });

      it('should handle commands with quoted arguments', () => {
        mockResolveExecutable.mockImplementation((name: string) =>
          name === 'npm' ? 'npm.cmd' : name
        );

        const workspace = manager as any;
        const quoted = workspace.resolvePackageManagerCommand(
          'npm config set prefix "C:\\Program Files\\nodejs"'
        );

        expect(quoted).toBe('npm.cmd config set prefix "C:\\Program Files\\nodejs"');
      });
    });

    describe('Unix Environment', () => {
      beforeEach(() => {
        mockIsWindows.mockReturnValue(false);
        mockGetPlatformShell.mockReturnValue({
          shell: '/bin/sh',
          shellArgs: ['-c']
        });
        mockResolveExecutable.mockImplementation((name: string) => name);
      });

      it('should not modify package manager commands on Unix', () => {
        const workspace = manager as any;

        expect(workspace.resolvePackageManagerCommand('npm install')).toBe('npm install');
        expect(workspace.resolvePackageManagerCommand('yarn add express')).toBe('yarn add express');
        expect(workspace.resolvePackageManagerCommand('pnpm install')).toBe('pnpm install');
        expect(workspace.resolvePackageManagerCommand('pip install requests')).toBe('pip install requests');
      });

      it('should preserve all arguments in Unix commands', () => {
        const workspace = manager as any;
        const complex = workspace.resolvePackageManagerCommand(
          'npm install --save-dev --registry https://registry.npmjs.org/ package'
        );

        expect(complex).toBe('npm install --save-dev --registry https://registry.npmjs.org/ package');
        expect(mockResolveExecutable).toHaveBeenCalledWith('npm');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty commands gracefully', () => {
        const workspace = manager as any;

        expect(workspace.resolvePackageManagerCommand('')).toBe('');
        expect(workspace.resolvePackageManagerCommand(null)).toBe(null);
        expect(workspace.resolvePackageManagerCommand(undefined)).toBe(undefined);
      });

      it('should handle single-word commands', () => {
        mockIsWindows.mockReturnValue(true);
        mockResolveExecutable.mockImplementation((name: string) =>
          name === 'npm' ? 'npm.cmd' : name
        );

        const workspace = manager as any;
        expect(workspace.resolvePackageManagerCommand('npm')).toBe('npm.cmd');
      });

      it('should handle commands with only spaces', () => {
        const workspace = manager as any;
        expect(workspace.resolvePackageManagerCommand('   ')).toBe('   ');
      });

      it('should not affect non-package-manager commands', () => {
        mockIsWindows.mockReturnValue(true);
        mockResolveExecutable.mockImplementation((name: string) =>
          ['npm', 'yarn', 'pnpm', 'pip'].includes(name) ? name + '.cmd' : name
        );

        const workspace = manager as any;

        expect(workspace.resolvePackageManagerCommand('git status')).toBe('git status');
        expect(workspace.resolvePackageManagerCommand('ls -la')).toBe('ls -la');
        expect(workspace.resolvePackageManagerCommand('echo "hello world"')).toBe('echo "hello world"');
      });
    });
  });

  describe('Shell Configuration', () => {
    it('should use correct shell for Windows', async () => {
      mockIsWindows.mockReturnValue(true);
      mockGetPlatformShell.mockReturnValue({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });

      const task: Task = {
        id: 'test-windows-shell',
        agentId: 'agent-1',
        status: 'pending',
        prompt: 'Test task',
        createdAt: new Date(),
        workspace: { strategy: 'worktree', cleanup: true, preserveOnFailure: false }
      };

      try {
        await manager.createWorkspace(task);
      } catch {
        // Expected to fail in test environment
      }

      expect(mockGetPlatformShell).toHaveBeenCalled();
    });

    it('should use correct shell for Unix systems', async () => {
      mockIsWindows.mockReturnValue(false);
      mockGetPlatformShell.mockReturnValue({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });

      const task: Task = {
        id: 'test-unix-shell',
        agentId: 'agent-1',
        status: 'pending',
        prompt: 'Test task',
        createdAt: new Date(),
        workspace: { strategy: 'worktree', cleanup: true, preserveOnFailure: false }
      };

      try {
        await manager.createWorkspace(task);
      } catch {
        // Expected to fail in test environment
      }

      expect(mockGetPlatformShell).toHaveBeenCalled();
    });

    it('should pass shell configuration to exec calls', async () => {
      mockIsWindows.mockReturnValue(true);
      mockGetPlatformShell.mockReturnValue({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });

      const task: Task = {
        id: 'test-shell-exec',
        agentId: 'agent-1',
        status: 'pending',
        prompt: 'Test task',
        createdAt: new Date(),
        workspace: { strategy: 'directory', cleanup: true, preserveOnFailure: false }
      };

      try {
        await manager.createWorkspace(task);
      } catch {
        // Expected to fail
      }

      // Verify exec was called with shell option
      const execCalls = mockExec.mock.calls;
      const shellCalls = execCalls.filter(call =>
        call[1] && typeof call[1] === 'object' && call[1].shell === 'cmd.exe'
      );

      expect(shellCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Recovery Strategies', () => {
    describe('Windows Recovery', () => {
      beforeEach(() => {
        mockIsWindows.mockReturnValue(true);
      });

      it('should resolve npm in permission recovery strategy', async () => {
        mockResolveExecutable.mockImplementation((name: string) =>
          name === 'npm' ? 'npm.cmd' : name
        );

        const workspace = manager as any;
        const recovery = await workspace.applyRecoveryStrategy(
          'npm install',
          'npm',
          'EACCES permission denied',
          1
        );

        expect(mockResolveExecutable).toHaveBeenCalledWith('npm');
        expect(recovery).toContain('npm.cmd');
      });

      it('should resolve pip in permission recovery strategy', async () => {
        mockResolveExecutable.mockImplementation((name: string) =>
          name === 'pip' ? 'pip.exe' : name
        );

        const workspace = manager as any;
        const recovery = await workspace.applyRecoveryStrategy(
          'pip install requests',
          'pip',
          'EACCES permission denied',
          1
        );

        expect(mockResolveExecutable).toHaveBeenCalledWith('pip');
        expect(recovery).toContain('pip.exe');
      });

      it('should handle registry fallback for npm', async () => {
        mockResolveExecutable.mockImplementation((name: string) => name);

        const workspace = manager as any;
        const recovery = await workspace.applyRecoveryStrategy(
          'npm install',
          'npm',
          'getaddrinfo ENOTFOUND registry.npmjs.org',
          1
        );

        expect(recovery).toContain('--registry https://registry.npmjs.org/');
      });
    });

    describe('Network Error Recovery', () => {
      it('should retry network errors without modification', async () => {
        const workspace = manager as any;
        const originalCommand = 'npm install express';

        const recovery = await workspace.applyRecoveryStrategy(
          originalCommand,
          'npm',
          'ECONNRESET network error',
          1
        );

        expect(recovery).toBe(originalCommand);
      });

      it('should handle timeout errors', async () => {
        const workspace = manager as any;
        const originalCommand = 'yarn install';

        const recovery = await workspace.applyRecoveryStrategy(
          originalCommand,
          'yarn',
          'ETIMEDOUT connection timed out',
          1
        );

        expect(recovery).toBe(originalCommand);
      });
    });

    describe('Recovery Strategy Names', () => {
      it('should return correct strategy names for different errors', () => {
        const workspace = manager as any;

        expect(workspace.getRecoveryStrategyName('ECONNRESET', 'npm')).toBe('Network retry with exponential backoff');
        expect(workspace.getRecoveryStrategyName('EACCES permission denied', 'npm')).toBe('Cache cleanup and permission retry');
        expect(workspace.getRecoveryStrategyName('EACCES permission denied', 'pip')).toBe('Permission escalation (--user flag)');
        expect(workspace.getRecoveryStrategyName('ENOSPC no space left', 'npm')).toBe('Disk space retry');
        expect(workspace.getRecoveryStrategyName('getaddrinfo failed', 'npm')).toBe('Registry fallback strategy');
        expect(workspace.getRecoveryStrategyName('unknown error', 'npm')).toBe('Standard retry');
      });
    });
  });

  describe('Error Suggestions', () => {
    it('should provide helpful error suggestions', () => {
      const workspace = manager as any;

      expect(workspace.getErrorSuggestion('ENOSPC no space left')).toContain('Free up disk space');
      expect(workspace.getErrorSuggestion('Could not find a version')).toContain('Check package name spelling');
      expect(workspace.getErrorSuggestion('failed to connect')).toContain('Check network connectivity');
      expect(workspace.getErrorSuggestion('EACCES permission denied')).toContain('Check file system permissions');
      expect(workspace.getErrorSuggestion('timeout occurred')).toContain('Consider increasing installTimeout');
      expect(workspace.getErrorSuggestion('lockfile EEXIST')).toContain('Remove lockfiles and retry');
      expect(workspace.getErrorSuggestion('unknown error')).toContain('Review error logs');
    });
  });

  describe('Workspace Statistics', () => {
    it('should calculate disk usage with correct shell', async () => {
      mockIsWindows.mockReturnValue(true);
      mockGetPlatformShell.mockReturnValue({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });

      // Mock a workspace
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

      expect(stats.activeCount).toBe(1);
      expect(mockGetPlatformShell).toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    it('should create container workspace with Windows package manager resolution', async () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) =>
        name === 'npm' ? 'npm.cmd' : name
      );

      const task: Task = {
        id: 'test-integration',
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

      // Mock successful container creation
      const containerManager = (manager as any).containerManager;
      containerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container'
      });
      containerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Installation successful',
        stderr: '',
        exitCode: 0
      });

      const workspace = await manager.createWorkspace(task);

      expect(workspace.success).toBe(true);
      expect(workspace.containerId).toBe('test-container');
      expect(mockResolveExecutable).toHaveBeenCalled();
    });

    it('should handle dependency installation failure gracefully', async () => {
      mockIsWindows.mockReturnValue(true);

      const task: Task = {
        id: 'test-failure',
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
            installRetries: 1
          }
        }
      };

      const containerManager = (manager as any).containerManager;
      containerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container'
      });
      containerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'Installation failed',
        exitCode: 1,
        error: 'Command failed'
      });

      const workspace = await manager.createWorkspace(task);

      expect(workspace.warnings).toBeDefined();
      expect(workspace.warnings!.length).toBeGreaterThan(0);
      expect(workspace.warnings![0]).toContain('Dependency installation failed');
    });
  });
});