/**
 * Dependency Install Error Handling Tests
 *
 * Covers error scenarios and edge cases identified in gap analysis:
 * - Network timeouts during installation
 * - Insufficient disk space errors
 * - Permission denied errors in container environments
 * - Corrupted dependency files
 * - Version conflict resolution
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

describe('Dependency Install Error Handling', () => {
  let workspaceManager: WorkspaceManager;
  let mockContainerManager: any;
  let mockDependencyDetector: any;
  const projectPath = '/test/project';

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContainerManager = {
      createContainer: vi.fn().mockResolvedValue({ success: true, containerId: 'test-container' }),
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
    vi.mocked(ContainerHealthMonitor).mockImplementation(() => ({
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getContainerHealth: vi.fn(),
      getStats: vi.fn()
    }));
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

  describe('Network and Timeout Errors', () => {
    it('should handle network timeout during npm install', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      });

      // Simulate network timeout
      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'npm ERR! network request to https://registry.npmjs.org/package failed, reason: socket hang up',
        exitCode: 1
      });

      const task: Task = {
        id: 'test-timeout',
        type: 'feature',
        title: 'Test Network Timeout',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'node:20-alpine', autoDependencyInstall: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/network.*timeout|socket hang up/i);
    });

    it('should handle DNS resolution failures', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true },
        installCommands: ['pip install -r requirements.txt']
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'ERROR: Could not find a version that satisfies the requirement package (from versions: none)\nERROR: No matching distribution found for package',
        exitCode: 1
      });

      const task: Task = {
        id: 'test-dns-fail',
        type: 'feature',
        title: 'Test DNS Failure',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'python:3.11-slim', autoDependencyInstall: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no matching distribution|could not find.*version/i);
    });

    it('should retry installation on transient network errors', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true },
        installCommands: ['cargo build']
      });

      // First call fails with network error, second succeeds
      mockContainerManager.execCommand
        .mockResolvedValueOnce({
          success: false,
          stdout: '',
          stderr: 'warning: spurious network error (2 tries remaining)',
          exitCode: 1
        })
        .mockResolvedValueOnce({
          success: true,
          stdout: 'Finished dev [unoptimized + debuginfo] target(s)',
          stderr: '',
          exitCode: 0
        });

      const task: Task = {
        id: 'test-retry',
        type: 'feature',
        title: 'Test Retry Logic',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'rust:1.75-alpine', autoDependencyInstall: true, installRetries: 2 }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(mockContainerManager.execCommand).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });
  });

  describe('Disk Space and Resource Errors', () => {
    it('should handle insufficient disk space errors', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'npm ERR! ENOSPC: no space left on device, write',
        exitCode: 1
      });

      const task: Task = {
        id: 'test-disk-space',
        type: 'feature',
        title: 'Test Disk Space Error',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'node:20-alpine', autoDependencyInstall: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no space left|ENOSPC/i);
    });

    it('should handle memory exhaustion during large installations', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'npm ERR! Cannot allocate memory\nKilled',
        exitCode: 137  // SIGKILL typically indicates OOM
      });

      const task: Task = {
        id: 'test-oom',
        type: 'feature',
        title: 'Test Out of Memory',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'node:20-alpine', autoDependencyInstall: true, memoryLimit: '128m' }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/memory|killed|oom/i);
    });
  });

  describe('Permission and Security Errors', () => {
    it('should handle permission denied errors in containers', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true },
        installCommands: ['pip install -r requirements.txt']
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'ERROR: Could not install packages due to an EnvironmentError: [Errno 13] Permission denied',
        exitCode: 1
      });

      const task: Task = {
        id: 'test-permissions',
        type: 'feature',
        title: 'Test Permission Error',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'python:3.11-slim', autoDependencyInstall: true, runAsUser: 'nobody' }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission denied|errno 13/i);
    });

    it('should handle read-only filesystem errors', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true },
        installCommands: ['cargo build']
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'error: failed to write file: Read-only file system (os error 30)',
        exitCode: 1
      });

      const task: Task = {
        id: 'test-readonly-fs',
        type: 'feature',
        title: 'Test Read-only FS',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'rust:1.75-alpine', autoDependencyInstall: true, readOnlyRootFilesystem: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/read.*only.*file.*system/i);
    });
  });

  describe('Corrupted Dependency Files', () => {
    it('should handle corrupted package.json', async () => {
      // Mock file detection but corrupted content
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [],
        hasPackageManagers: false,
        primaryManager: null,
        installCommands: [],
        errors: [{ file: 'package.json', error: 'Invalid JSON: Unexpected token' }]
      });

      const task: Task = {
        id: 'test-corrupted-json',
        type: 'feature',
        title: 'Test Corrupted package.json',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'node:20-alpine', autoDependencyInstall: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      // Should skip installation due to detection failure but still create workspace
      expect(result.success).toBe(true);
      expect(mockContainerManager.execCommand).not.toHaveBeenCalled();
    });

    it('should handle malformed requirements.txt', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true },
        installCommands: ['pip install -r requirements.txt']
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'ERROR: Invalid requirement: "invalid===version===format"',
        exitCode: 1
      });

      const task: Task = {
        id: 'test-malformed-requirements',
        type: 'feature',
        title: 'Test Malformed Requirements',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'python:3.11-slim', autoDependencyInstall: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid requirement/i);
    });

    it('should handle missing Cargo.toml dependencies section', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true },
        installCommands: ['cargo build']
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'error: failed to parse manifest at `/workspace/Cargo.toml`\n\nCaused by:\n  missing field `name`',
        exitCode: 101
      });

      const task: Task = {
        id: 'test-malformed-cargo',
        type: 'feature',
        title: 'Test Malformed Cargo.toml',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'rust:1.75-alpine', autoDependencyInstall: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/failed to parse manifest|missing field/i);
    });
  });

  describe('Version Conflicts and Dependency Resolution', () => {
    it('should handle npm version conflicts', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'npm ERR! peer dep missing: @types/node@>=14.0.0, required by some-package@1.0.0\nnpm ERR! ERESOLVE unable to resolve dependency tree',
        exitCode: 1
      });

      const task: Task = {
        id: 'test-version-conflict',
        type: 'feature',
        title: 'Test Version Conflict',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'node:20-alpine', autoDependencyInstall: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/eresolve|peer dep missing|dependency tree/i);
    });

    it('should handle Python version compatibility issues', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true },
        installCommands: ['pip install -r requirements.txt']
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'ERROR: Package some-package requires a different Python: 3.8.0 not in ">=3.9"',
        exitCode: 1
      });

      const task: Task = {
        id: 'test-python-version-conflict',
        type: 'feature',
        title: 'Test Python Version Conflict',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'python:3.8-slim', autoDependencyInstall: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/requires a different python|not in/i);
    });

    it('should handle Rust edition compatibility issues', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true },
        installCommands: ['cargo build']
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'error[E0658]: async fn` is not permitted in Rust 2015\n  --> src/main.rs:5:1\n   |\n 5 | async fn main() {\n   | ^^^^^\n   |\n   = note: to use `async fn`, switch to Rust 2018 or later',
        exitCode: 1
      });

      const task: Task = {
        id: 'test-rust-edition-conflict',
        type: 'feature',
        title: 'Test Rust Edition Conflict',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'rust:1.75-alpine', autoDependencyInstall: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not permitted in rust|switch to rust/i);
    });
  });

  describe('Container Environment Issues', () => {
    it('should handle container networking issues', async () => {
      mockContainerManager.createContainer.mockResolvedValue({
        success: false,
        error: 'Could not connect to container registry',
        containerId: null
      });

      const task: Task = {
        id: 'test-container-network',
        type: 'feature',
        title: 'Test Container Network Issue',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'node:20-alpine', autoDependencyInstall: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/could not connect|container registry/i);
    });

    it('should handle mount path permission issues', async () => {
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container'
      });

      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'ls: cannot access \'/workspace\': Permission denied',
        exitCode: 1
      });

      const task: Task = {
        id: 'test-mount-permissions',
        type: 'feature',
        title: 'Test Mount Permission Issue',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'alpine:latest', autoDependencyInstall: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(false);
    });
  });
});