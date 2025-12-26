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
  WorkspaceConfig,
  ContainerManager,
  DependencyDetector,
  ContainerHealthMonitor,
  containerRuntime
} from '@apexcli/core';

// Mock all external dependencies
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

describe('WorkspaceManager - Dependency Installation', () => {
  let workspaceManager: WorkspaceManager;
  let mockContainerManagerInstance: any;
  let mockHealthMonitorInstance: any;
  let mockDependencyDetectorInstance: any;

  const mockTask: Task = {
    id: 'test-task-123',
    type: 'feature',
    title: 'Test Feature',
    description: 'Test feature implementation',
    workflow: 'feature',
    status: 'running',
    created: new Date(),
    workspace: {
      strategy: 'container',
      cleanup: true,
      container: {
        image: 'node:20-alpine',
        autoDependencyInstall: true
      }
    }
  };

  const projectPath = '/test/project';
  const options: WorkspaceManagerOptions = {
    projectPath,
    defaultStrategy: 'container'
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock ContainerManager
    mockContainerManagerInstance = {
      createContainer: vi.fn(),
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
    mockFs.access.mockRejectedValue(new Error('File not found')); // No custom Dockerfile

    workspaceManager = new WorkspaceManager(options);
    await workspaceManager.initialize();
  });

  afterEach(async () => {
    await workspaceManager.cleanup();
  });

  describe('Container Workspace with Dependency Installation', () => {
    it('should install dependencies when container is created with auto-install enabled', async () => {
      // Setup mocks
      mockContainerManagerInstance.createContainer.mockResolvedValue({
        success: true,
        containerId: 'container-123'
      });

      mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm ci',
          detected: true,
          configFiles: ['package.json']
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm ci',
          detected: true,
          configFiles: ['package.json']
        },
        installCommands: ['npm ci']
      });

      mockContainerManagerInstance.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Dependencies installed successfully',
        stderr: '',
        exitCode: 0
      });

      // Set up event listeners to capture events
      const startedEvents: DependencyInstallEventData[] = [];
      const completedEvents: DependencyInstallCompletedEventData[] = [];

      workspaceManager.on('dependency-install-started', (data) => {
        startedEvents.push(data);
      });

      workspaceManager.on('dependency-install-completed', (data) => {
        completedEvents.push(data);
      });

      // Create workspace with container strategy
      const workspace = await workspaceManager.createWorkspace(mockTask);

      // Verify container creation
      expect(mockContainerManagerInstance.createContainer).toHaveBeenCalledWith({
        config: {
          image: 'node:20-alpine',
          autoDependencyInstall: true,
          volumes: {
            [projectPath]: '/workspace'
          },
          workingDir: '/workspace',
          labels: {
            'apex.task-id': mockTask.id,
            'apex.workspace-type': 'container'
          }
        },
        taskId: mockTask.id,
        autoStart: true
      });

      // Verify dependency detection was called
      expect(mockDependencyDetectorInstance.detectPackageManagers).toHaveBeenCalledWith(projectPath);

      // Verify dependency installation command was executed
      expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledWith(
        'container-123',
        'npm ci',
        {
          workingDir: '/workspace',
          timeout: 300000
        },
        'docker'
      );

      // Verify events were emitted
      expect(startedEvents).toHaveLength(1);
      expect(completedEvents).toHaveLength(1);

      const startedEvent = startedEvents[0];
      expect(startedEvent.taskId).toBe(mockTask.id);
      expect(startedEvent.containerId).toBe('container-123');
      expect(startedEvent.installCommand).toBe('npm ci');
      expect(startedEvent.packageManager).toBe('npm');
      expect(startedEvent.language).toBe('javascript');

      const completedEvent = completedEvents[0];
      expect(completedEvent.success).toBe(true);
      expect(completedEvent.exitCode).toBe(0);
      expect(completedEvent.stdout).toBe('Dependencies installed successfully');

      // Verify workspace was created
      expect(workspace.taskId).toBe(mockTask.id);
      expect(workspace.status).toBe('active');
    });

    it('should not install dependencies when auto-install is disabled', async () => {
      // Create task with auto-install disabled
      const taskWithoutAutoInstall: Task = {
        ...mockTask,
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: false
          }
        }
      };

      mockContainerManagerInstance.createContainer.mockResolvedValue({
        success: true,
        containerId: 'container-123'
      });

      const startedEvents: DependencyInstallEventData[] = [];
      workspaceManager.on('dependency-install-started', (data) => {
        startedEvents.push(data);
      });

      await workspaceManager.createWorkspace(taskWithoutAutoInstall);

      // Verify dependency detection was not called
      expect(mockDependencyDetectorInstance.detectPackageManagers).not.toHaveBeenCalled();

      // Verify no dependency install events were emitted
      expect(startedEvents).toHaveLength(0);
    });

    it('should use custom install command when provided', async () => {
      const customTask: Task = {
        ...mockTask,
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            customInstallCommand: 'yarn install --frozen-lockfile'
          }
        }
      };

      mockContainerManagerInstance.createContainer.mockResolvedValue({
        success: true,
        containerId: 'container-123'
      });

      mockContainerManagerInstance.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Custom command executed',
        stderr: '',
        exitCode: 0
      });

      const startedEvents: DependencyInstallEventData[] = [];
      workspaceManager.on('dependency-install-started', (data) => {
        startedEvents.push(data);
      });

      await workspaceManager.createWorkspace(customTask);

      // Verify dependency detection was not called when custom command is provided
      expect(mockDependencyDetectorInstance.detectPackageManagers).not.toHaveBeenCalled();

      // Verify custom command was executed
      expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledWith(
        'container-123',
        'yarn install --frozen-lockfile',
        {
          workingDir: '/workspace',
          timeout: 300000
        },
        'docker'
      );

      // Verify event contains custom command info
      expect(startedEvents[0].installCommand).toBe('yarn install --frozen-lockfile');
      expect(startedEvents[0].packageManager).toBe('unknown');
    });

    it('should handle dependency installation failure gracefully', async () => {
      mockContainerManagerInstance.createContainer.mockResolvedValue({
        success: true,
        containerId: 'container-123'
      });

      mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm ci',
          detected: true,
          configFiles: ['package.json']
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm ci',
          detected: true,
          configFiles: ['package.json']
        },
        installCommands: ['npm ci']
      });

      mockContainerManagerInstance.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'npm ERR! package-lock.json not found',
        exitCode: 1,
        error: 'Installation failed'
      });

      const completedEvents: DependencyInstallCompletedEventData[] = [];
      workspaceManager.on('dependency-install-completed', (data) => {
        completedEvents.push(data);
      });

      await workspaceManager.createWorkspace(mockTask);

      // Verify failure was handled
      expect(completedEvents).toHaveLength(1);
      const event = completedEvents[0];
      expect(event.success).toBe(false);
      expect(event.exitCode).toBe(1);
      expect(event.stderr).toBe('npm ERR! package-lock.json not found');
      expect(event.error).toBe('Installation failed');
    });

    it('should handle dependency installation timeout/error', async () => {
      mockContainerManagerInstance.createContainer.mockResolvedValue({
        success: true,
        containerId: 'container-123'
      });

      mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm ci',
          detected: true,
          configFiles: ['package.json']
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm ci',
          detected: true,
          configFiles: ['package.json']
        },
        installCommands: ['npm ci']
      });

      // Mock execCommand to throw an error
      mockContainerManagerInstance.execCommand.mockRejectedValue(new Error('Command timeout'));

      const completedEvents: DependencyInstallCompletedEventData[] = [];
      workspaceManager.on('dependency-install-completed', (data) => {
        completedEvents.push(data);
      });

      await workspaceManager.createWorkspace(mockTask);

      // Verify error was handled
      expect(completedEvents).toHaveLength(1);
      const event = completedEvents[0];
      expect(event.success).toBe(false);
      expect(event.exitCode).toBe(1);
      expect(event.error).toBe('Command timeout');
    });

    it('should skip installation when no dependencies are detected', async () => {
      mockContainerManagerInstance.createContainer.mockResolvedValue({
        success: true,
        containerId: 'container-123'
      });

      mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [],
        hasPackageManagers: false,
        installCommands: []
      });

      const startedEvents: DependencyInstallEventData[] = [];
      workspaceManager.on('dependency-install-started', (data) => {
        startedEvents.push(data);
      });

      await workspaceManager.createWorkspace(mockTask);

      // Verify no installation was attempted
      expect(mockContainerManagerInstance.execCommand).not.toHaveBeenCalled();
      expect(startedEvents).toHaveLength(0);
    });
  });

  describe('Non-Container Workspaces', () => {
    it('should not attempt dependency installation for non-container strategies', async () => {
      const directoryTask: Task = {
        ...mockTask,
        workspace: {
          strategy: 'directory',
          cleanup: true
        }
      };

      const startedEvents: DependencyInstallEventData[] = [];
      workspaceManager.on('dependency-install-started', (data) => {
        startedEvents.push(data);
      });

      await workspaceManager.createWorkspace(directoryTask);

      // Verify no dependency installation was attempted
      expect(mockDependencyDetectorInstance.detectPackageManagers).not.toHaveBeenCalled();
      expect(mockContainerManagerInstance.execCommand).not.toHaveBeenCalled();
      expect(startedEvents).toHaveLength(0);
    });
  });

  describe('Event Data Validation', () => {
    it('should emit properly structured dependency install events', async () => {
      mockContainerManagerInstance.createContainer.mockResolvedValue({
        success: true,
        containerId: 'container-123'
      });

      mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'pip',
          language: 'python',
          installCommand: 'pip install -r requirements.txt',
          detected: true,
          configFiles: ['requirements.txt']
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'pip',
          language: 'python',
          installCommand: 'pip install -r requirements.txt',
          detected: true,
          configFiles: ['requirements.txt']
        },
        installCommands: ['pip install -r requirements.txt']
      });

      mockContainerManagerInstance.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Successfully installed packages',
        stderr: 'Some warnings',
        exitCode: 0
      });

      let startedData: DependencyInstallEventData | null = null;
      let completedData: DependencyInstallCompletedEventData | null = null;

      workspaceManager.on('dependency-install-started', (data) => {
        startedData = data;
      });

      workspaceManager.on('dependency-install-completed', (data) => {
        completedData = data;
      });

      await workspaceManager.createWorkspace(mockTask);

      // Verify started event structure
      expect(startedData).toBeTruthy();
      expect(startedData!.taskId).toBe(mockTask.id);
      expect(startedData!.containerId).toBe('container-123');
      expect(startedData!.installCommand).toBe('pip install -r requirements.txt');
      expect(startedData!.packageManager).toBe('pip');
      expect(startedData!.language).toBe('python');
      expect(startedData!.timestamp).toBeInstanceOf(Date);
      expect(startedData!.workspacePath).toMatch(/container-test-task-123/);

      // Verify completed event structure
      expect(completedData).toBeTruthy();
      expect(completedData!.taskId).toBe(mockTask.id);
      expect(completedData!.success).toBe(true);
      expect(completedData!.duration).toBeGreaterThan(0);
      expect(completedData!.stdout).toBe('Successfully installed packages');
      expect(completedData!.stderr).toBe('Some warnings');
      expect(completedData!.exitCode).toBe(0);
      expect(completedData!.error).toBeUndefined();
    });
  });
});