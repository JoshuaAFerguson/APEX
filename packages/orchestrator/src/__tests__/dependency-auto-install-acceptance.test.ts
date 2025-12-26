/**
 * Comprehensive Integration Tests for Dependency Auto-Install Feature
 *
 * This test suite validates all acceptance criteria for the dependency auto-install feature:
 * 1. Node.js project with package.json triggers npm install
 * 2. Python project with requirements.txt triggers pip install
 * 3. Rust project with Cargo.toml triggers cargo build
 * 4. autoDependencyInstall=false skips installation
 * 5. customInstallCommand overrides detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { promises as fs } from 'fs';
import {
  WorkspaceManager,
  WorkspaceManagerOptions,
  DependencyInstallEventData,
  DependencyInstallCompletedEventData
} from '../workspace-manager';
import {
  Task,
  DependencyDetector,
  ContainerManager,
  ContainerHealthMonitor,
  containerRuntime,
  type PackageManagerDetectionResult
} from '@apexcli/core';

// Mock external dependencies
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

vi.mock('child_process', () => ({
  exec: vi.fn()
}));

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    ContainerManager: vi.fn(),
    ContainerHealthMonitor: vi.fn(),
    DependencyDetector: vi.fn(),
    containerRuntime: {
      getBestRuntime: vi.fn()
    }
  };
});

const mockFs = vi.mocked(fs);
const mockContainerManager = vi.mocked(ContainerManager);
const mockContainerHealthMonitor = vi.mocked(ContainerHealthMonitor);
const mockDependencyDetector = vi.mocked(DependencyDetector);
const mockContainerRuntime = vi.mocked(containerRuntime);

describe('Dependency Auto-Install Feature - Acceptance Criteria', () => {
  let workspaceManager: WorkspaceManager;
  let mockContainerManagerInstance: any;
  let mockHealthMonitorInstance: any;
  let mockDependencyDetectorInstance: any;

  const projectPath = '/test/project';
  const options: WorkspaceManagerOptions = {
    projectPath,
    defaultStrategy: 'container'
  };

  const createBaseTask = (taskId: string, containerConfig: any = {}): Task => ({
    id: taskId,
    type: 'feature',
    title: `Test Feature - ${taskId}`,
    description: `Integration test for ${taskId}`,
    workflow: 'feature',
    status: 'running',
    created: new Date(),
    workspace: {
      strategy: 'container',
      cleanup: true,
      container: {
        image: 'node:20-alpine',
        autoDependencyInstall: true,
        ...containerConfig
      }
    }
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock ContainerManager
    mockContainerManagerInstance = {
      createContainer: vi.fn().mockResolvedValue({
        success: true,
        containerId: 'test-container-id'
      }),
      execCommand: vi.fn(),
      startEventsMonitoring: vi.fn(),
      stopEventsMonitoring: vi.fn(),
      isEventsMonitoringActive: vi.fn(),
      listApexContainers: vi.fn(),
      stopContainer: vi.fn(),
      removeContainer: vi.fn()
    };
    mockContainerManager.mockImplementation(() => mockContainerManagerInstance);

    // Mock ContainerHealthMonitor
    mockHealthMonitorInstance = {
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getContainerHealth: vi.fn(),
      getStats: vi.fn()
    };
    mockContainerHealthMonitor.mockImplementation(() => mockHealthMonitorInstance);

    // Mock DependencyDetector
    mockDependencyDetectorInstance = {
      detectPackageManagers: vi.fn()
    };
    mockDependencyDetector.mockImplementation(() => mockDependencyDetectorInstance);

    // Mock container runtime detection
    mockContainerRuntime.getBestRuntime.mockResolvedValue('docker');

    // Mock filesystem operations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockRejectedValue(new Error('File not found'));

    workspaceManager = new WorkspaceManager(options);
    await workspaceManager.initialize();
  });

  afterEach(async () => {
    await workspaceManager.cleanup();
  });

  describe('Acceptance Criteria 1: Node.js project with package.json triggers npm install', () => {
    it('should detect package.json and execute npm install', async () => {
      // Setup Node.js project detection
      const npmDetection = {
        projectPath,
        detectedManagers: [
          {
            type: 'npm' as const,
            language: 'javascript' as const,
            installCommand: 'npm install',
            detected: true,
            configFiles: ['package.json']
          }
        ],
        hasPackageManagers: true,
        primaryManager: {
          type: 'npm' as const,
          language: 'javascript' as const,
          installCommand: 'npm install',
          detected: true,
          configFiles: ['package.json']
        },
        installCommands: ['npm install']
      };

      mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue(npmDetection);
      mockContainerManagerInstance.execCommand.mockResolvedValue({
        success: true,
        stdout: 'added 42 packages from 123 contributors',
        stderr: '',
        exitCode: 0
      });

      // Track events
      const events: { started: DependencyInstallEventData[], completed: DependencyInstallCompletedEventData[] } = {
        started: [],
        completed: []
      };

      workspaceManager.on('dependency-install-started', (data) => events.started.push(data));
      workspaceManager.on('dependency-install-completed', (data) => events.completed.push(data));

      // Create workspace
      const task = createBaseTask('nodejs-npm-test');
      const workspace = await workspaceManager.createWorkspace(task);

      // Verify npm install was executed
      expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledWith(
        'test-container-id',
        'npm install',
        {
          workingDir: '/workspace',
          timeout: 300000
        },
        'docker'
      );

      // Verify events
      expect(events.started).toHaveLength(1);
      expect(events.completed).toHaveLength(1);

      const startedEvent = events.started[0];
      expect(startedEvent.installCommand).toBe('npm install');
      expect(startedEvent.packageManager).toBe('npm');
      expect(startedEvent.language).toBe('javascript');

      const completedEvent = events.completed[0];
      expect(completedEvent.success).toBe(true);
      expect(completedEvent.stdout).toBe('added 42 packages from 123 contributors');
    });
  });

  describe('Acceptance Criteria 2: Python project with requirements.txt triggers pip install', () => {
    it('should detect requirements.txt and execute pip install', async () => {
      // Setup Python project detection
      const pipDetection = {
        projectPath,
        detectedManagers: [
          {
            type: 'pip' as const,
            language: 'python' as const,
            installCommand: 'pip install -r requirements.txt',
            detected: true,
            configFiles: ['requirements.txt']
          }
        ],
        hasPackageManagers: true,
        primaryManager: {
          type: 'pip' as const,
          language: 'python' as const,
          installCommand: 'pip install -r requirements.txt',
          detected: true,
          configFiles: ['requirements.txt']
        },
        installCommands: ['pip install -r requirements.txt']
      };

      mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue(pipDetection);
      mockContainerManagerInstance.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Successfully installed flask-2.3.3 click-8.1.7',
        stderr: '',
        exitCode: 0
      });

      // Track events
      const events: { started: DependencyInstallEventData[], completed: DependencyInstallCompletedEventData[] } = {
        started: [],
        completed: []
      };

      workspaceManager.on('dependency-install-started', (data) => events.started.push(data));
      workspaceManager.on('dependency-install-completed', (data) => events.completed.push(data));

      // Create workspace with Python image
      const task = createBaseTask('python-pip-test', { image: 'python:3.11-slim' });
      const workspace = await workspaceManager.createWorkspace(task);

      // Verify pip install was executed
      expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledWith(
        'test-container-id',
        'pip install -r requirements.txt',
        {
          workingDir: '/workspace',
          timeout: 300000
        },
        'docker'
      );

      // Verify events
      expect(events.started).toHaveLength(1);
      expect(events.completed).toHaveLength(1);

      const startedEvent = events.started[0];
      expect(startedEvent.installCommand).toBe('pip install -r requirements.txt');
      expect(startedEvent.packageManager).toBe('pip');
      expect(startedEvent.language).toBe('python');

      const completedEvent = events.completed[0];
      expect(completedEvent.success).toBe(true);
      expect(completedEvent.stdout).toBe('Successfully installed flask-2.3.3 click-8.1.7');
    });
  });

  describe('Acceptance Criteria 3: Rust project with Cargo.toml triggers cargo build', () => {
    it('should detect Cargo.toml and execute cargo build', async () => {
      // Setup Rust project detection
      const cargoDetection = {
        projectPath,
        detectedManagers: [
          {
            type: 'cargo' as const,
            language: 'rust' as const,
            installCommand: 'cargo build',
            detected: true,
            configFiles: ['Cargo.toml']
          }
        ],
        hasPackageManagers: true,
        primaryManager: {
          type: 'cargo' as const,
          language: 'rust' as const,
          installCommand: 'cargo build',
          detected: true,
          configFiles: ['Cargo.toml']
        },
        installCommands: ['cargo build']
      };

      mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue(cargoDetection);
      mockContainerManagerInstance.execCommand.mockResolvedValue({
        success: true,
        stdout: '   Compiling my-rust-app v0.1.0 (/workspace)\n    Finished dev [unoptimized + debuginfo] target(s) in 2.34s',
        stderr: '',
        exitCode: 0
      });

      // Track events
      const events: { started: DependencyInstallEventData[], completed: DependencyInstallCompletedEventData[] } = {
        started: [],
        completed: []
      };

      workspaceManager.on('dependency-install-started', (data) => events.started.push(data));
      workspaceManager.on('dependency-install-completed', (data) => events.completed.push(data));

      // Create workspace with Rust image
      const task = createBaseTask('rust-cargo-test', { image: 'rust:1.75-alpine' });
      const workspace = await workspaceManager.createWorkspace(task);

      // Verify cargo build was executed
      expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledWith(
        'test-container-id',
        'cargo build',
        {
          workingDir: '/workspace',
          timeout: 300000
        },
        'docker'
      );

      // Verify events
      expect(events.started).toHaveLength(1);
      expect(events.completed).toHaveLength(1);

      const startedEvent = events.started[0];
      expect(startedEvent.installCommand).toBe('cargo build');
      expect(startedEvent.packageManager).toBe('cargo');
      expect(startedEvent.language).toBe('rust');

      const completedEvent = events.completed[0];
      expect(completedEvent.success).toBe(true);
      expect(completedEvent.stdout).toContain('Finished dev [unoptimized + debuginfo] target(s)');
    });
  });

  describe('Acceptance Criteria 4: autoDependencyInstall=false skips installation', () => {
    it('should skip dependency installation when autoDependencyInstall is false', async () => {
      // Track events to verify none are emitted
      const events: { started: DependencyInstallEventData[], completed: DependencyInstallCompletedEventData[] } = {
        started: [],
        completed: []
      };

      workspaceManager.on('dependency-install-started', (data) => events.started.push(data));
      workspaceManager.on('dependency-install-completed', (data) => events.completed.push(data));

      // Create task with auto-install disabled
      const task = createBaseTask('auto-install-disabled-test', {
        autoDependencyInstall: false
      });
      const workspace = await workspaceManager.createWorkspace(task);

      // Verify dependency detection was NOT called
      expect(mockDependencyDetectorInstance.detectPackageManagers).not.toHaveBeenCalled();

      // Verify no install command was executed
      expect(mockContainerManagerInstance.execCommand).not.toHaveBeenCalled();

      // Verify no dependency install events were emitted
      expect(events.started).toHaveLength(0);
      expect(events.completed).toHaveLength(0);

      // Verify workspace was still created successfully
      expect(workspace.taskId).toBe(task.id);
      expect(workspace.status).toBe('active');
    });
  });

  describe('Acceptance Criteria 5: customInstallCommand overrides detection', () => {
    it('should use custom install command and skip automatic detection', async () => {
      const customCommand = 'npm ci --production --silent';

      mockContainerManagerInstance.execCommand.mockResolvedValue({
        success: true,
        stdout: 'added 23 packages in 3.45s',
        stderr: '',
        exitCode: 0
      });

      // Track events
      const events: { started: DependencyInstallEventData[], completed: DependencyInstallCompletedEventData[] } = {
        started: [],
        completed: []
      };

      workspaceManager.on('dependency-install-started', (data) => events.started.push(data));
      workspaceManager.on('dependency-install-completed', (data) => events.completed.push(data));

      // Create task with custom install command
      const task = createBaseTask('custom-install-test', {
        customInstallCommand: customCommand
      });
      const workspace = await workspaceManager.createWorkspace(task);

      // Verify dependency detection was NOT called (custom command overrides detection)
      expect(mockDependencyDetectorInstance.detectPackageManagers).not.toHaveBeenCalled();

      // Verify custom command was executed
      expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledWith(
        'test-container-id',
        customCommand,
        {
          workingDir: '/workspace',
          timeout: 300000
        },
        'docker'
      );

      // Verify events
      expect(events.started).toHaveLength(1);
      expect(events.completed).toHaveLength(1);

      const startedEvent = events.started[0];
      expect(startedEvent.installCommand).toBe(customCommand);
      expect(startedEvent.packageManager).toBe('unknown'); // Custom command doesn't have known package manager

      const completedEvent = events.completed[0];
      expect(completedEvent.success).toBe(true);
      expect(completedEvent.stdout).toBe('added 23 packages in 3.45s');
    });

    it('should support custom install command with custom timeout', async () => {
      const customCommand = 'poetry install --no-dev';
      const customTimeout = 600000; // 10 minutes

      mockContainerManagerInstance.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Installing dependencies from lock file',
        stderr: '',
        exitCode: 0
      });

      // Create task with custom install command and timeout
      const task = createBaseTask('custom-install-timeout-test', {
        customInstallCommand: customCommand,
        installTimeout: customTimeout
      });
      await workspaceManager.createWorkspace(task);

      // Verify custom command was executed with custom timeout
      expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledWith(
        'test-container-id',
        customCommand,
        {
          workingDir: '/workspace',
          timeout: customTimeout
        },
        'docker'
      );
    });
  });

  describe('Integration: Combined scenario testing', () => {
    it('should handle mixed project with primary package manager selection', async () => {
      // Setup detection of multiple package managers with primary selection
      const multiLanguageDetection = {
        projectPath,
        detectedManagers: [
          {
            type: 'npm' as const,
            language: 'javascript' as const,
            installCommand: 'npm ci',
            detected: true,
            configFiles: ['package.json', 'package-lock.json']
          },
          {
            type: 'pip' as const,
            language: 'python' as const,
            installCommand: 'pip install -r requirements.txt',
            detected: true,
            configFiles: ['requirements.txt']
          }
        ],
        hasPackageManagers: true,
        primaryManager: {
          type: 'npm' as const,
          language: 'javascript' as const,
          installCommand: 'npm ci',
          detected: true,
          configFiles: ['package.json', 'package-lock.json']
        },
        installCommands: ['npm ci', 'pip install -r requirements.txt']
      };

      mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue(multiLanguageDetection);
      mockContainerManagerInstance.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Dependencies installed successfully',
        stderr: '',
        exitCode: 0
      });

      // Track events
      const events: { started: DependencyInstallEventData[] } = { started: [] };
      workspaceManager.on('dependency-install-started', (data) => events.started.push(data));

      // Create workspace
      const task = createBaseTask('multi-language-test');
      await workspaceManager.createWorkspace(task);

      // Verify only the primary manager's command was executed
      expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledTimes(1);
      expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledWith(
        'test-container-id',
        'npm ci',
        {
          workingDir: '/workspace',
          timeout: 300000
        },
        'docker'
      );

      // Verify event contains primary manager info
      expect(events.started).toHaveLength(1);
      expect(events.started[0].installCommand).toBe('npm ci');
      expect(events.started[0].packageManager).toBe('npm');
      expect(events.started[0].language).toBe('javascript');
    });

    it('should handle installation failure gracefully and complete workspace creation', async () => {
      // Setup npm project detection
      const npmDetection = {
        projectPath,
        detectedManagers: [
          {
            type: 'npm' as const,
            language: 'javascript' as const,
            installCommand: 'npm ci',
            detected: true,
            configFiles: ['package.json', 'package-lock.json']
          }
        ],
        hasPackageManagers: true,
        primaryManager: {
          type: 'npm' as const,
          language: 'javascript' as const,
          installCommand: 'npm ci',
          detected: true,
          configFiles: ['package.json', 'package-lock.json']
        },
        installCommands: ['npm ci']
      };

      mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue(npmDetection);

      // Mock installation failure
      mockContainerManagerInstance.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'npm ERR! package-lock.json not found',
        exitCode: 1,
        error: 'Installation failed'
      });

      const events: { completed: DependencyInstallCompletedEventData[] } = { completed: [] };
      workspaceManager.on('dependency-install-completed', (data) => events.completed.push(data));

      // Create workspace
      const task = createBaseTask('installation-failure-test');
      const workspace = await workspaceManager.createWorkspace(task);

      // Verify workspace was still created successfully despite installation failure
      expect(workspace.taskId).toBe(task.id);
      expect(workspace.status).toBe('active');

      // Verify failure event was emitted
      expect(events.completed).toHaveLength(1);
      const failureEvent = events.completed[0];
      expect(failureEvent.success).toBe(false);
      expect(failureEvent.exitCode).toBe(1);
      expect(failureEvent.stderr).toBe('npm ERR! package-lock.json not found');
      expect(failureEvent.error).toBe('Installation failed');
    });
  });
});