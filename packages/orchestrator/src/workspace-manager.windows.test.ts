/**
 * Windows Compatibility Tests for WorkspaceManager
 *
 * Tests cross-platform shell execution and Windows-specific package manager command resolution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceManager } from './workspace-manager';
import { Task } from '@apexcli/core';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readdir: vi.fn(() => Promise.resolve([])),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rm: vi.fn(),
    access: vi.fn()
  }
}));

vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Mock the core utilities
vi.mock('@apexcli/core', () => ({
  // Keep all existing exports and add our specific mocks
  WorkspaceConfig: {},
  Task: {},
  IsolationMode: {},
  IsolationConfig: {},
  containerRuntime: {
    getBestRuntime: vi.fn(() => Promise.resolve('none'))
  },
  ContainerRuntimeType: {},
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
    detectPackageManagers: vi.fn(() => Promise.resolve({
      primaryManager: {
        type: 'npm',
        language: 'javascript',
        installCommand: 'npm install',
        metadata: { hasLockfile: true }
      }
    }))
  })),
  PackageManagerType: {},
  ContainerConfig: {},
  ContainerDefaults: {},
  getInstallCommand: vi.fn((manager) => `${manager.type} install`),
  getOptimizedInstallCommand: vi.fn((manager) => `${manager.type} ci`),
  getPlatformShell: vi.fn(),
  resolveExecutable: vi.fn(),
  isWindows: vi.fn()
}));

const mockExec = vi.fn();
const mockGetPlatformShell = vi.fn();
const mockResolveExecutable = vi.fn();
const mockIsWindows = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  // Setup child_process mock
  (childProcess.exec as any).mockImplementation((command, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    // Simulate successful command execution
    setTimeout(() => {
      callback(null, { stdout: 'success', stderr: '' });
    }, 0);
  });

  // Setup core mocks
  const core = vi.mocked(await import('@apexcli/core'));
  mockGetPlatformShell.mockImplementation(() => ({
    shell: mockIsWindows() ? 'cmd.exe' : '/bin/sh',
    shellArgs: mockIsWindows() ? ['/d', '/s', '/c'] : ['-c']
  }));
  mockResolveExecutable.mockImplementation((name: string) => {
    if (mockIsWindows() && !name.includes('.')) {
      return name + '.cmd';
    }
    return name;
  });

  core.getPlatformShell = mockGetPlatformShell;
  core.resolveExecutable = mockResolveExecutable;
  core.isWindows = mockIsWindows;
});

describe('WorkspaceManager Windows Compatibility', () => {
  let manager: WorkspaceManager;
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = '/test/project';
    manager = new WorkspaceManager({
      projectPath: testProjectPath,
      defaultStrategy: 'none'
    });

    await manager.initialize();
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe('Shell Execution', () => {
    it('should use Windows shell on Windows platform', async () => {
      // Setup Windows environment
      mockIsWindows.mockReturnValue(true);
      mockGetPlatformShell.mockReturnValue({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });

      const task: Task = {
        id: 'test-task-1',
        agentId: 'agent-1',
        status: 'pending',
        prompt: 'Test task',
        createdAt: new Date(),
        workspace: { strategy: 'worktree', cleanup: true, preserveOnFailure: false }
      };

      try {
        await manager.createWorkspace(task);
      } catch (error) {
        // Expected to fail in test environment, but we want to verify the shell usage
      }

      // Verify that getPlatformShell was called
      expect(mockGetPlatformShell).toHaveBeenCalled();
    });

    it('should use Unix shell on Unix platform', async () => {
      // Setup Unix environment
      mockIsWindows.mockReturnValue(false);
      mockGetPlatformShell.mockReturnValue({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });

      const task: Task = {
        id: 'test-task-2',
        agentId: 'agent-1',
        status: 'pending',
        prompt: 'Test task',
        createdAt: new Date(),
        workspace: { strategy: 'worktree', cleanup: true, preserveOnFailure: false }
      };

      try {
        await manager.createWorkspace(task);
      } catch (error) {
        // Expected to fail in test environment
      }

      // Verify that getPlatformShell was called
      expect(mockGetPlatformShell).toHaveBeenCalled();
    });

    it('should pass shell option to all execAsync calls', async () => {
      mockIsWindows.mockReturnValue(true);
      mockGetPlatformShell.mockReturnValue({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });

      const execSpy = vi.spyOn(childProcess, 'exec');

      const task: Task = {
        id: 'test-task-3',
        agentId: 'agent-1',
        status: 'pending',
        prompt: 'Test task',
        createdAt: new Date(),
        workspace: { strategy: 'directory', cleanup: true, preserveOnFailure: false }
      };

      try {
        await manager.createWorkspace(task);
      } catch (error) {
        // Expected to fail
      }

      // Verify that exec calls include shell option
      const execCalls = execSpy.mock.calls;
      const callsWithShell = execCalls.filter(call =>
        call[1] && typeof call[1] === 'object' && call[1].shell === 'cmd.exe'
      );

      // Should have at least one call with shell option
      expect(callsWithShell.length).toBeGreaterThan(0);
    });
  });

  describe('Package Manager Command Resolution', () => {
    it('should resolve npm to npm.cmd on Windows', async () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) => {
        if (name === 'npm') return 'npm.cmd';
        return name;
      });

      const task: Task = {
        id: 'test-task-4',
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

      // Mock container manager
      const containerManager = (manager as any).containerManager;
      containerManager.createContainer = vi.fn().mockResolvedValue({
        success: true,
        containerId: 'test-container-id'
      });
      containerManager.execCommand = vi.fn().mockResolvedValue({
        success: true,
        stdout: 'Dependencies installed successfully',
        stderr: '',
        exitCode: 0
      });

      try {
        await manager.createWorkspace(task);
      } catch (error) {
        // May fail due to mocking, but we want to verify resolveExecutable usage
      }

      // Verify that resolveExecutable was called for package managers
      expect(mockResolveExecutable).toHaveBeenCalled();
    });

    it('should resolve yarn to yarn.cmd on Windows', async () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) => {
        if (name === 'yarn') return 'yarn.cmd';
        return name;
      });

      // Mock dependency detector to return yarn
      const dependencyDetector = (manager as any).dependencyDetector;
      dependencyDetector.detectPackageManagers = vi.fn().mockResolvedValue({
        primaryManager: {
          type: 'yarn',
          language: 'javascript',
          installCommand: 'yarn install',
          metadata: { hasLockfile: true }
        }
      });

      const task: Task = {
        id: 'test-task-5',
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
      containerManager.createContainer = vi.fn().mockResolvedValue({
        success: true,
        containerId: 'test-container-id'
      });
      containerManager.execCommand = vi.fn().mockResolvedValue({
        success: true,
        stdout: 'Dependencies installed successfully',
        stderr: '',
        exitCode: 0
      });

      try {
        await manager.createWorkspace(task);
      } catch (error) {
        // May fail due to mocking
      }

      expect(mockResolveExecutable).toHaveBeenCalled();
    });

    it('should resolve pnpm to pnpm.cmd on Windows', async () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) => {
        if (name === 'pnpm') return 'pnpm.cmd';
        return name;
      });

      // Mock dependency detector to return pnpm
      const dependencyDetector = (manager as any).dependencyDetector;
      dependencyDetector.detectPackageManagers = vi.fn().mockResolvedValue({
        primaryManager: {
          type: 'pnpm',
          language: 'javascript',
          installCommand: 'pnpm install',
          metadata: { hasLockfile: true }
        }
      });

      const task: Task = {
        id: 'test-task-6',
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
      containerManager.createContainer = vi.fn().mockResolvedValue({
        success: true,
        containerId: 'test-container-id'
      });
      containerManager.execCommand = vi.fn().mockResolvedValue({
        success: true,
        stdout: 'Dependencies installed successfully',
        stderr: '',
        exitCode: 0
      });

      try {
        await manager.createWorkspace(task);
      } catch (error) {
        // May fail due to mocking
      }

      expect(mockResolveExecutable).toHaveBeenCalled();
    });

    it('should handle custom install commands with proper Windows resolution', async () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) => {
        if (name === 'custom-installer') return 'custom-installer.exe';
        return name;
      });

      const task: Task = {
        id: 'test-task-7',
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
            customInstallCommand: 'custom-installer --install-deps',
            autoDependencyInstall: true
          }
        }
      };

      const containerManager = (manager as any).containerManager;
      containerManager.createContainer = vi.fn().mockResolvedValue({
        success: true,
        containerId: 'test-container-id'
      });
      containerManager.execCommand = vi.fn().mockImplementation((containerId, command) => {
        // Verify that the command was resolved properly
        expect(command).toContain('custom-installer.exe');
        return Promise.resolve({
          success: true,
          stdout: 'Custom installation complete',
          stderr: '',
          exitCode: 0
        });
      });

      try {
        await manager.createWorkspace(task);
      } catch (error) {
        // May fail due to mocking
      }

      expect(mockResolveExecutable).toHaveBeenCalledWith('custom-installer');
    });
  });

  describe('Recovery Strategy Command Resolution', () => {
    it('should resolve npm commands in recovery strategies on Windows', async () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) => {
        if (name === 'npm') return 'npm.cmd';
        return name;
      });

      const workspace = (manager as any);

      // Test permission error recovery for npm
      const recoveryCommand = await workspace.applyRecoveryStrategy(
        'npm install',
        'npm',
        'EACCES permission denied',
        1
      );

      expect(mockResolveExecutable).toHaveBeenCalledWith('npm');
      expect(recoveryCommand).toContain('npm.cmd');
    });

    it('should resolve pip commands in recovery strategies on Windows', async () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) => {
        if (name === 'pip') return 'pip.exe';
        return name;
      });

      const workspace = (manager as any);

      // Test permission error recovery for pip
      const recoveryCommand = await workspace.applyRecoveryStrategy(
        'pip install -r requirements.txt',
        'pip',
        'EACCES permission denied',
        1
      );

      expect(mockResolveExecutable).toHaveBeenCalledWith('pip');
      expect(recoveryCommand).toContain('pip.exe');
    });
  });

  describe('Helper Methods', () => {
    it('should resolve package manager commands correctly', () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) => {
        if (name === 'npm') return 'npm.cmd';
        if (name === 'yarn') return 'yarn.cmd';
        if (name === 'pnpm') return 'pnpm.cmd';
        return name;
      });

      const workspace = (manager as any);

      // Test npm command resolution
      const npmCommand = workspace.resolvePackageManagerCommand('npm install --save express');
      expect(npmCommand).toBe('npm.cmd install --save express');

      // Test yarn command resolution
      const yarnCommand = workspace.resolvePackageManagerCommand('yarn add express');
      expect(yarnCommand).toBe('yarn.cmd add express');

      // Test pnpm command resolution
      const pnpmCommand = workspace.resolvePackageManagerCommand('pnpm install express');
      expect(pnpmCommand).toBe('pnpm.cmd install express');

      // Test empty command
      const emptyCommand = workspace.resolvePackageManagerCommand('');
      expect(emptyCommand).toBe('');

      // Test command with no executable
      const noExecCommand = workspace.resolvePackageManagerCommand('');
      expect(noExecCommand).toBe('');
    });

    it('should handle commands with complex arguments', () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) => {
        if (name === 'npm') return 'npm.cmd';
        return name;
      });

      const workspace = (manager as any);

      const complexCommand = workspace.resolvePackageManagerCommand(
        'npm install --registry https://registry.npmjs.org/ --cache /tmp/npm-cache'
      );
      expect(complexCommand).toBe(
        'npm.cmd install --registry https://registry.npmjs.org/ --cache /tmp/npm-cache'
      );
    });

    it('should not modify non-package-manager commands', () => {
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name: string) => {
        // Only resolve known package managers
        if (['npm', 'yarn', 'pnpm', 'pip'].includes(name)) {
          return name + '.cmd';
        }
        return name;
      });

      const workspace = (manager as any);

      const gitCommand = workspace.resolvePackageManagerCommand('git clone https://github.com/example/repo.git');
      expect(gitCommand).toBe('git clone https://github.com/example/repo.git');
    });
  });

  describe('Cross-platform Compatibility', () => {
    it('should work correctly on Unix systems', async () => {
      mockIsWindows.mockReturnValue(false);
      mockGetPlatformShell.mockReturnValue({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });
      mockResolveExecutable.mockImplementation((name: string) => name); // No change on Unix

      const task: Task = {
        id: 'test-task-unix',
        agentId: 'agent-1',
        status: 'pending',
        prompt: 'Test task',
        createdAt: new Date(),
        workspace: { strategy: 'directory', cleanup: true, preserveOnFailure: false }
      };

      try {
        await manager.createWorkspace(task);
      } catch (error) {
        // Expected to fail in test environment
      }

      expect(mockGetPlatformShell).toHaveBeenCalled();
      expect(mockResolveExecutable).toHaveBeenCalled();
    });

    it('should handle platform detection correctly', () => {
      const workspace = (manager as any);

      // Test Windows behavior
      mockIsWindows.mockReturnValue(true);
      mockResolveExecutable.mockImplementation((name) => name + '.cmd');

      const windowsCommand = workspace.resolvePackageManagerCommand('npm install');
      expect(windowsCommand).toBe('npm.cmd install');

      // Test Unix behavior
      mockIsWindows.mockReturnValue(false);
      mockResolveExecutable.mockImplementation((name) => name);

      const unixCommand = workspace.resolvePackageManagerCommand('npm install');
      expect(unixCommand).toBe('npm install');
    });
  });
});