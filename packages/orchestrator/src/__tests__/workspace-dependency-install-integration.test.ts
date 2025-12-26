import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { WorkspaceManager, DependencyInstallEventData, DependencyInstallCompletedEventData } from '../workspace-manager';
import { TaskStore } from '../store';
import { DependencyDetector, Task, ContainerConfig } from '@apexcli/core';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rmdir, writeFile, mkdir } from 'fs/promises';

// Mock modules
vi.mock('../store');
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    DependencyDetector: vi.fn(),
    ContainerManager: vi.fn(),
    ContainerHealthMonitor: vi.fn(),
    containerRuntime: {
      getBestRuntime: vi.fn().mockResolvedValue('docker')
    }
  };
});

describe('WorkspaceManager Dependency Installation Integration', () => {
  let workspaceManager: WorkspaceManager;
  let mockDependencyDetector: Mock;
  let mockContainerManager: Mock;
  let testProjectPath: string;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await mkdtemp(join(tmpdir(), 'apex-workspace-test-'));
    testProjectPath = tempDir;

    // Create .apex directory structure
    await mkdir(join(testProjectPath, '.apex'), { recursive: true });

    // Mock DependencyDetector
    mockDependencyDetector = vi.fn();
    const DependencyDetectorMock = vi.mocked(DependencyDetector);
    DependencyDetectorMock.mockImplementation(() => ({
      detectPackageManagers: mockDependencyDetector,
    } as any));

    // Mock ContainerManager
    const mockExecCommand = vi.fn();
    const mockCreateContainer = vi.fn();
    const mockListApexContainers = vi.fn();
    const mockStopContainer = vi.fn();
    const mockRemoveContainer = vi.fn();
    const mockStartEventsMonitoring = vi.fn();
    const mockStopEventsMonitoring = vi.fn();
    const mockIsEventsMonitoringActive = vi.fn();

    mockContainerManager = {
      execCommand: mockExecCommand,
      createContainer: mockCreateContainer,
      listApexContainers: mockListApexContainers,
      stopContainer: mockStopContainer,
      removeContainer: mockRemoveContainer,
      startEventsMonitoring: mockStartEventsMonitoring,
      stopEventsMonitoring: mockStopEventsMonitoring,
      isEventsMonitoringActive: mockIsEventsMonitoringActive,
      on: vi.fn(),
      emit: vi.fn(),
    };

    const ContainerManagerMock = vi.mocked(require('@apexcli/core').ContainerManager);
    ContainerManagerMock.mockImplementation(() => mockContainerManager);

    // Mock ContainerHealthMonitor
    const ContainerHealthMonitorMock = vi.mocked(require('@apexcli/core').ContainerHealthMonitor);
    ContainerHealthMonitorMock.mockImplementation(() => ({
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getStats: vi.fn(),
      getContainerHealth: vi.fn(),
    }));

    // Initialize WorkspaceManager
    workspaceManager = new WorkspaceManager({
      projectPath: testProjectPath,
      defaultStrategy: 'container',
    });

    await workspaceManager.initialize();
  });

  afterEach(async () => {
    if (workspaceManager) {
      await workspaceManager.cleanup();
    }
    // Clean up temporary directory
    try {
      await rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Node.js project dependency installation', () => {
    it('should run npm install for detected npm project', async () => {
      // Setup npm project detection
      mockDependencyDetector.mockResolvedValue({
        projectPath: testProjectPath,
        detectedManagers: [{
          type: 'npm',
          detected: true,
          language: 'javascript',
          installCommand: 'npm install'
        }],
        primaryManager: {
          type: 'npm',
          detected: true,
          language: 'javascript',
          installCommand: 'npm install'
        },
        hasPackageManagers: true,
        installCommands: ['npm install']
      });

      // Mock successful container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container-123'
      });

      // Mock successful install command execution
      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'npm install completed successfully',
        stderr: '',
        exitCode: 0
      });

      // Create test task
      const task: Task = {
        id: 'test-task-npm',
        type: 'feature',
        description: 'Test npm dependency installation',
        status: 'pending' as const,
        priority: 'medium' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workspace: {
          strategy: 'container' as const,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true
          }
        }
      };

      // Track events
      const startedEvents: DependencyInstallEventData[] = [];
      const completedEvents: DependencyInstallCompletedEventData[] = [];

      workspaceManager.on('dependency-install-started', (event) => {
        startedEvents.push(event);
      });

      workspaceManager.on('dependency-install-completed', (event) => {
        completedEvents.push(event);
      });

      // Create workspace (this should trigger dependency installation)
      const workspaceInfo = await workspaceManager.createWorkspace(task);

      // Verify workspace was created
      expect(workspaceInfo).toBeDefined();
      expect(workspaceInfo.taskId).toBe(task.id);

      // Verify container was created
      expect(mockContainerManager.createContainer).toHaveBeenCalledWith({
        config: expect.objectContaining({
          image: 'node:20-alpine',
          autoDependencyInstall: true
        }),
        taskId: task.id,
        autoStart: true
      });

      // Verify dependency detection was called
      expect(mockDependencyDetector).toHaveBeenCalledWith(testProjectPath);

      // Verify install command was executed
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container-123',
        'npm install',
        {
          workingDir: '/workspace',
          timeout: 300000
        },
        'docker'
      );

      // Verify events were emitted
      expect(startedEvents).toHaveLength(1);
      expect(startedEvents[0]).toMatchObject({
        taskId: task.id,
        containerId: 'test-container-123',
        installCommand: 'npm install',
        packageManager: 'npm',
        language: 'javascript'
      });

      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0]).toMatchObject({
        taskId: task.id,
        success: true,
        exitCode: 0,
        stdout: 'npm install completed successfully'
      });
    });

    it('should run yarn install for detected yarn project', async () => {
      // Setup yarn project detection
      mockDependencyDetector.mockResolvedValue({
        projectPath: testProjectPath,
        detectedManagers: [{
          type: 'yarn',
          detected: true,
          language: 'javascript',
          installCommand: 'yarn install'
        }],
        primaryManager: {
          type: 'yarn',
          detected: true,
          language: 'javascript',
          installCommand: 'yarn install'
        },
        hasPackageManagers: true,
        installCommands: ['yarn install']
      });

      // Mock successful container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container-yarn'
      });

      // Mock successful install command execution
      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'yarn install v1.22.19',
        stderr: '',
        exitCode: 0
      });

      // Create test task
      const task: Task = {
        id: 'test-task-yarn',
        type: 'feature',
        description: 'Test yarn dependency installation',
        status: 'pending' as const,
        priority: 'medium' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workspace: {
          strategy: 'container' as const,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true
          }
        }
      };

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Verify yarn install was executed
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container-yarn',
        'yarn install',
        expect.any(Object),
        'docker'
      );
    });

    it('should run pnpm install for detected pnpm project', async () => {
      // Setup pnpm project detection
      mockDependencyDetector.mockResolvedValue({
        projectPath: testProjectPath,
        detectedManagers: [{
          type: 'pnpm',
          detected: true,
          language: 'javascript',
          installCommand: 'pnpm install'
        }],
        primaryManager: {
          type: 'pnpm',
          detected: true,
          language: 'javascript',
          installCommand: 'pnpm install'
        },
        hasPackageManagers: true,
        installCommands: ['pnpm install']
      });

      // Mock successful container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container-pnpm'
      });

      // Mock successful install command execution
      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Packages installed successfully',
        stderr: '',
        exitCode: 0
      });

      // Create test task
      const task: Task = {
        id: 'test-task-pnpm',
        type: 'feature',
        description: 'Test pnpm dependency installation',
        status: 'pending' as const,
        priority: 'medium' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workspace: {
          strategy: 'container' as const,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true
          }
        }
      };

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Verify pnpm install was executed
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container-pnpm',
        'pnpm install',
        expect.any(Object),
        'docker'
      );
    });
  });

  describe('Python project dependency installation', () => {
    it('should run pip install for detected pip project', async () => {
      // Setup pip project detection
      mockDependencyDetector.mockResolvedValue({
        projectPath: testProjectPath,
        detectedManagers: [{
          type: 'pip',
          detected: true,
          language: 'python',
          installCommand: 'pip install -r requirements.txt'
        }],
        primaryManager: {
          type: 'pip',
          detected: true,
          language: 'python',
          installCommand: 'pip install -r requirements.txt'
        },
        hasPackageManagers: true,
        installCommands: ['pip install -r requirements.txt']
      });

      // Mock successful container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container-pip'
      });

      // Mock successful install command execution
      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Successfully installed packages',
        stderr: '',
        exitCode: 0
      });

      // Create test task
      const task: Task = {
        id: 'test-task-pip',
        type: 'feature',
        description: 'Test pip dependency installation',
        status: 'pending' as const,
        priority: 'medium' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workspace: {
          strategy: 'container' as const,
          container: {
            image: 'python:3.11-slim',
            autoDependencyInstall: true
          }
        }
      };

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Verify pip install was executed
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container-pip',
        'pip install -r requirements.txt',
        expect.any(Object),
        'docker'
      );
    });

    it('should run poetry install for detected poetry project', async () => {
      // Setup poetry project detection
      mockDependencyDetector.mockResolvedValue({
        projectPath: testProjectPath,
        detectedManagers: [{
          type: 'poetry',
          detected: true,
          language: 'python',
          installCommand: 'poetry install'
        }],
        primaryManager: {
          type: 'poetry',
          detected: true,
          language: 'python',
          installCommand: 'poetry install'
        },
        hasPackageManagers: true,
        installCommands: ['poetry install']
      });

      // Mock successful container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container-poetry'
      });

      // Mock successful install command execution
      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Installing dependencies from lock file',
        stderr: '',
        exitCode: 0
      });

      // Create test task
      const task: Task = {
        id: 'test-task-poetry',
        type: 'feature',
        description: 'Test poetry dependency installation',
        status: 'pending' as const,
        priority: 'medium' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workspace: {
          strategy: 'container' as const,
          container: {
            image: 'python:3.11-slim',
            autoDependencyInstall: true
          }
        }
      };

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Verify poetry install was executed
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container-poetry',
        'poetry install',
        expect.any(Object),
        'docker'
      );
    });
  });

  describe('Rust project dependency installation', () => {
    it('should run cargo build for detected cargo project', async () => {
      // Setup cargo project detection
      mockDependencyDetector.mockResolvedValue({
        projectPath: testProjectPath,
        detectedManagers: [{
          type: 'cargo',
          detected: true,
          language: 'rust',
          installCommand: 'cargo build'
        }],
        primaryManager: {
          type: 'cargo',
          detected: true,
          language: 'rust',
          installCommand: 'cargo build'
        },
        hasPackageManagers: true,
        installCommands: ['cargo build']
      });

      // Mock successful container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container-cargo'
      });

      // Mock successful install command execution
      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Compiling dependencies',
        stderr: '',
        exitCode: 0
      });

      // Create test task
      const task: Task = {
        id: 'test-task-cargo',
        type: 'feature',
        description: 'Test cargo dependency installation',
        status: 'pending' as const,
        priority: 'medium' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workspace: {
          strategy: 'container' as const,
          container: {
            image: 'rust:1.75-alpine',
            autoDependencyInstall: true
          }
        }
      };

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Verify cargo build was executed
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container-cargo',
        'cargo build',
        expect.any(Object),
        'docker'
      );
    });
  });

  describe('Configuration options', () => {
    it('should skip installation when autoDependencyInstall is false', async () => {
      // Mock successful container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container-disabled'
      });

      // Create test task with autoDependencyInstall disabled
      const task: Task = {
        id: 'test-task-disabled',
        type: 'feature',
        description: 'Test disabled dependency installation',
        status: 'pending' as const,
        priority: 'medium' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workspace: {
          strategy: 'container' as const,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: false
          }
        }
      };

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Verify dependency detection was NOT called
      expect(mockDependencyDetector).not.toHaveBeenCalled();

      // Verify install command was NOT executed
      expect(mockContainerManager.execCommand).not.toHaveBeenCalled();
    });

    it('should use custom install command when provided', async () => {
      // Mock successful container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container-custom'
      });

      // Mock successful install command execution
      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Custom install completed',
        stderr: '',
        exitCode: 0
      });

      // Create test task with custom install command
      const task: Task = {
        id: 'test-task-custom',
        type: 'feature',
        description: 'Test custom dependency installation',
        status: 'pending' as const,
        priority: 'medium' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workspace: {
          strategy: 'container' as const,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            customInstallCommand: 'npm ci --production'
          }
        }
      };

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Verify custom install command was executed
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container-custom',
        'npm ci --production',
        expect.any(Object),
        'docker'
      );

      // Verify dependency detection was NOT called (custom command overrides detection)
      expect(mockDependencyDetector).not.toHaveBeenCalled();
    });

    it('should respect custom install timeout', async () => {
      // Setup npm project detection
      mockDependencyDetector.mockResolvedValue({
        projectPath: testProjectPath,
        detectedManagers: [{
          type: 'npm',
          detected: true,
          language: 'javascript',
          installCommand: 'npm install'
        }],
        primaryManager: {
          type: 'npm',
          detected: true,
          language: 'javascript',
          installCommand: 'npm install'
        },
        hasPackageManagers: true,
        installCommands: ['npm install']
      });

      // Mock successful container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container-timeout'
      });

      // Mock successful install command execution
      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'npm install completed',
        stderr: '',
        exitCode: 0
      });

      // Create test task with custom timeout
      const task: Task = {
        id: 'test-task-timeout',
        type: 'feature',
        description: 'Test custom timeout dependency installation',
        status: 'pending' as const,
        priority: 'medium' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workspace: {
          strategy: 'container' as const,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            installTimeout: 600000 // 10 minutes
          }
        }
      };

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Verify custom timeout was used
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container-timeout',
        'npm install',
        {
          workingDir: '/workspace',
          timeout: 600000
        },
        'docker'
      );
    });
  });

  describe('Error handling', () => {
    it('should handle installation failure gracefully', async () => {
      // Setup npm project detection
      mockDependencyDetector.mockResolvedValue({
        projectPath: testProjectPath,
        detectedManagers: [{
          type: 'npm',
          detected: true,
          language: 'javascript',
          installCommand: 'npm install'
        }],
        primaryManager: {
          type: 'npm',
          detected: true,
          language: 'javascript',
          installCommand: 'npm install'
        },
        hasPackageManagers: true,
        installCommands: ['npm install']
      });

      // Mock successful container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container-fail'
      });

      // Mock failed install command execution
      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'Error: ENOENT: no such file or directory',
        exitCode: 1,
        error: 'Install command failed'
      });

      // Create test task
      const task: Task = {
        id: 'test-task-fail',
        type: 'feature',
        description: 'Test failed dependency installation',
        status: 'pending' as const,
        priority: 'medium' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workspace: {
          strategy: 'container' as const,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true
          }
        }
      };

      // Track events
      const completedEvents: DependencyInstallCompletedEventData[] = [];
      workspaceManager.on('dependency-install-completed', (event) => {
        completedEvents.push(event);
      });

      // Create workspace (should not throw despite install failure)
      const workspaceInfo = await workspaceManager.createWorkspace(task);

      // Verify workspace was still created
      expect(workspaceInfo).toBeDefined();

      // Verify failure event was emitted
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0]).toMatchObject({
        taskId: task.id,
        success: false,
        exitCode: 1,
        error: 'Install command failed'
      });
    });

    it('should handle dependency detection failure gracefully', async () => {
      // Mock dependency detection failure
      mockDependencyDetector.mockRejectedValue(new Error('Detection failed'));

      // Mock successful container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container-detection-fail'
      });

      // Create test task
      const task: Task = {
        id: 'test-task-detection-fail',
        type: 'feature',
        description: 'Test dependency detection failure',
        status: 'pending' as const,
        priority: 'medium' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workspace: {
          strategy: 'container' as const,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true
          }
        }
      };

      // Track events
      const completedEvents: DependencyInstallCompletedEventData[] = [];
      workspaceManager.on('dependency-install-completed', (event) => {
        completedEvents.push(event);
      });

      // Create workspace (should not throw despite detection failure)
      const workspaceInfo = await workspaceManager.createWorkspace(task);

      // Verify workspace was still created
      expect(workspaceInfo).toBeDefined();

      // Verify failure event was emitted
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0]).toMatchObject({
        taskId: task.id,
        success: false,
        exitCode: 1,
        error: 'Detection failed'
      });
    });

    it('should skip installation when no package managers are detected', async () => {
      // Setup no package managers detected
      mockDependencyDetector.mockResolvedValue({
        projectPath: testProjectPath,
        detectedManagers: [],
        primaryManager: undefined,
        hasPackageManagers: false,
        installCommands: []
      });

      // Mock successful container creation
      mockContainerManager.createContainer.mockResolvedValue({
        success: true,
        containerId: 'test-container-none'
      });

      // Create test task
      const task: Task = {
        id: 'test-task-none',
        type: 'feature',
        description: 'Test no package managers',
        status: 'pending' as const,
        priority: 'medium' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workspace: {
          strategy: 'container' as const,
          container: {
            image: 'alpine:3.18',
            autoDependencyInstall: true
          }
        }
      };

      // Create workspace
      await workspaceManager.createWorkspace(task);

      // Verify dependency detection was called
      expect(mockDependencyDetector).toHaveBeenCalledWith(testProjectPath);

      // Verify install command was NOT executed (no dependencies found)
      expect(mockContainerManager.execCommand).not.toHaveBeenCalled();
    });
  });
});