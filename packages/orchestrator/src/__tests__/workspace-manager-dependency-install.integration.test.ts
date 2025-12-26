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

describe('WorkspaceManager - Dependency Installation Integration', () => {
  let workspaceManager: WorkspaceManager;
  let mockContainerManagerInstance: any;
  let mockHealthMonitorInstance: any;
  let mockDependencyDetectorInstance: any;

  const projectPath = '/test/project';
  const options: WorkspaceManagerOptions = {
    projectPath,
    defaultStrategy: 'container'
  };

  const createBaseTask = (taskId: string): Task => ({
    id: taskId,
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
  });

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
    mockFs.access.mockRejectedValue(new Error('File not found'));

    // Mock successful container creation
    mockContainerManagerInstance.createContainer.mockResolvedValue({
      success: true,
      containerId: 'container-test-id'
    });

    workspaceManager = new WorkspaceManager(options);
    await workspaceManager.initialize();
  });

  afterEach(async () => {
    await workspaceManager.cleanup();
  });

  describe('Node.js Project Integration', () => {
    const nodeJsDetectionResults = [
      {
        scenario: 'npm project with package-lock.json',
        detection: {
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
        },
        expectedCommand: 'npm ci'
      },
      {
        scenario: 'yarn project with yarn.lock',
        detection: {
          projectPath,
          detectedManagers: [
            {
              type: 'yarn' as const,
              language: 'javascript' as const,
              installCommand: 'yarn install --frozen-lockfile',
              detected: true,
              configFiles: ['package.json', 'yarn.lock']
            }
          ],
          hasPackageManagers: true,
          primaryManager: {
            type: 'yarn' as const,
            language: 'javascript' as const,
            installCommand: 'yarn install --frozen-lockfile',
            detected: true,
            configFiles: ['package.json', 'yarn.lock']
          },
          installCommands: ['yarn install --frozen-lockfile']
        },
        expectedCommand: 'yarn install --frozen-lockfile'
      },
      {
        scenario: 'pnpm project with pnpm-lock.yaml',
        detection: {
          projectPath,
          detectedManagers: [
            {
              type: 'pnpm' as const,
              language: 'javascript' as const,
              installCommand: 'pnpm install --frozen-lockfile',
              detected: true,
              configFiles: ['package.json', 'pnpm-lock.yaml']
            }
          ],
          hasPackageManagers: true,
          primaryManager: {
            type: 'pnpm' as const,
            language: 'javascript' as const,
            installCommand: 'pnpm install --frozen-lockfile',
            detected: true,
            configFiles: ['package.json', 'pnpm-lock.yaml']
          },
          installCommands: ['pnpm install --frozen-lockfile']
        },
        expectedCommand: 'pnpm install --frozen-lockfile'
      }
    ];

    nodeJsDetectionResults.forEach(({ scenario, detection, expectedCommand }) => {
      it(`should install dependencies for ${scenario}`, async () => {
        // Setup mocks for this scenario
        mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue(detection);
        mockContainerManagerInstance.execCommand.mockResolvedValue({
          success: true,
          stdout: `Successfully executed ${expectedCommand}`,
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
        const task = createBaseTask(`nodejs-${scenario.replace(/\s+/g, '-')}`);
        const workspace = await workspaceManager.createWorkspace(task);

        // Verify command execution
        expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledWith(
          'container-test-id',
          expectedCommand,
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
        expect(startedEvent.installCommand).toBe(expectedCommand);
        expect(startedEvent.packageManager).toBe(detection.primaryManager!.type);
        expect(startedEvent.language).toBe('javascript');

        const completedEvent = events.completed[0];
        expect(completedEvent.success).toBe(true);
        expect(completedEvent.stdout).toBe(`Successfully executed ${expectedCommand}`);
      });
    });
  });

  describe('Python Project Integration', () => {
    const pythonDetectionResults = [
      {
        scenario: 'pip project with requirements.txt',
        detection: {
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
        },
        expectedCommand: 'pip install -r requirements.txt'
      },
      {
        scenario: 'poetry project with pyproject.toml',
        detection: {
          projectPath,
          detectedManagers: [
            {
              type: 'poetry' as const,
              language: 'python' as const,
              installCommand: 'poetry install',
              detected: true,
              configFiles: ['pyproject.toml']
            }
          ],
          hasPackageManagers: true,
          primaryManager: {
            type: 'poetry' as const,
            language: 'python' as const,
            installCommand: 'poetry install',
            detected: true,
            configFiles: ['pyproject.toml']
          },
          installCommands: ['poetry install']
        },
        expectedCommand: 'poetry install'
      },
      {
        scenario: 'pipenv project with Pipfile',
        detection: {
          projectPath,
          detectedManagers: [
            {
              type: 'pipenv' as const,
              language: 'python' as const,
              installCommand: 'pipenv install',
              detected: true,
              configFiles: ['Pipfile']
            }
          ],
          hasPackageManagers: true,
          primaryManager: {
            type: 'pipenv' as const,
            language: 'python' as const,
            installCommand: 'pipenv install',
            detected: true,
            configFiles: ['Pipfile']
          },
          installCommands: ['pipenv install']
        },
        expectedCommand: 'pipenv install'
      }
    ];

    pythonDetectionResults.forEach(({ scenario, detection, expectedCommand }) => {
      it(`should install dependencies for ${scenario}`, async () => {
        // Setup mocks for this scenario
        mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue(detection);
        mockContainerManagerInstance.execCommand.mockResolvedValue({
          success: true,
          stdout: `Successfully installed Python packages using ${detection.primaryManager!.type}`,
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
        const task = createBaseTask(`python-${scenario.replace(/\s+/g, '-')}`);
        const workspace = await workspaceManager.createWorkspace(task);

        // Verify command execution
        expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledWith(
          'container-test-id',
          expectedCommand,
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
        expect(startedEvent.installCommand).toBe(expectedCommand);
        expect(startedEvent.packageManager).toBe(detection.primaryManager!.type);
        expect(startedEvent.language).toBe('python');

        const completedEvent = events.completed[0];
        expect(completedEvent.success).toBe(true);
      });
    });
  });

  describe('Rust Project Integration', () => {
    const rustDetectionResults = [
      {
        scenario: 'cargo project with Cargo.toml',
        detection: {
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
        },
        expectedCommand: 'cargo build'
      }
    ];

    rustDetectionResults.forEach(({ scenario, detection, expectedCommand }) => {
      it(`should install dependencies for ${scenario}`, async () => {
        // Setup mocks for this scenario
        mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue(detection);
        mockContainerManagerInstance.execCommand.mockResolvedValue({
          success: true,
          stdout: 'Successfully built Rust project',
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
        const task = createBaseTask(`rust-${scenario.replace(/\s+/g, '-')}`);
        const workspace = await workspaceManager.createWorkspace(task);

        // Verify command execution
        expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledWith(
          'container-test-id',
          expectedCommand,
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
        expect(startedEvent.installCommand).toBe(expectedCommand);
        expect(startedEvent.packageManager).toBe(detection.primaryManager!.type);
        expect(startedEvent.language).toBe('rust');

        const completedEvent = events.completed[0];
        expect(completedEvent.success).toBe(true);
      });
    });
  });

  describe('Multi-Language Project Integration', () => {
    it('should prioritize the primary package manager in multi-language projects', async () => {
      // Mock detection of multiple package managers
      const multiLanguageDetection = {
        projectPath,
        detectedManagers: [
          {
            type: 'npm' as const,
            language: 'javascript' as const,
            installCommand: 'npm ci',
            detected: true,
            configFiles: ['package.json']
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
          configFiles: ['package.json']
        },
        installCommands: ['npm ci', 'pip install -r requirements.txt']
      };

      mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue(multiLanguageDetection);
      mockContainerManagerInstance.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Successfully installed dependencies',
        stderr: '',
        exitCode: 0
      });

      const events: { started: DependencyInstallEventData[] } = { started: [] };
      workspaceManager.on('dependency-install-started', (data) => events.started.push(data));

      // Create workspace
      const task = createBaseTask('multi-language-project');
      await workspaceManager.createWorkspace(task);

      // Verify only the primary manager's command was executed
      expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledTimes(1);
      expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledWith(
        'container-test-id',
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
  });

  describe('Custom Container Configuration Integration', () => {
    it('should respect custom install timeout and working directory', async () => {
      const taskWithCustomConfig = {
        ...createBaseTask('custom-config'),
        workspace: {
          strategy: 'container' as const,
          cleanup: true,
          container: {
            image: 'python:3.11-alpine',
            autoDependencyInstall: true,
            workingDir: '/app',
            installTimeout: 600000 // 10 minutes
          }
        }
      };

      mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue({
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
      });

      mockContainerManagerInstance.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Successfully installed dependencies',
        stderr: '',
        exitCode: 0
      });

      await workspaceManager.createWorkspace(taskWithCustomConfig);

      // Verify custom timeout and working directory were used
      expect(mockContainerManagerInstance.execCommand).toHaveBeenCalledWith(
        'container-test-id',
        'pip install -r requirements.txt',
        {
          workingDir: '/app',
          timeout: 600000
        },
        'docker'
      );
    });
  });

  describe('Error Scenarios Integration', () => {
    it('should handle container creation failure before dependency installation', async () => {
      // Mock container creation failure
      mockContainerManagerInstance.createContainer.mockResolvedValue({
        success: false,
        error: 'Failed to create container'
      });

      const task = createBaseTask('container-creation-failure');

      // Creating workspace should throw error
      await expect(workspaceManager.createWorkspace(task)).rejects.toThrow('Failed to create container workspace');

      // Verify dependency installation was never attempted
      expect(mockDependencyDetectorInstance.detectPackageManagers).not.toHaveBeenCalled();
      expect(mockContainerManagerInstance.execCommand).not.toHaveBeenCalled();
    });

    it('should complete workspace creation even if dependency installation fails', async () => {
      mockDependencyDetectorInstance.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [
          {
            type: 'npm' as const,
            language: 'javascript' as const,
            installCommand: 'npm ci',
            detected: true,
            configFiles: ['package.json']
          }
        ],
        hasPackageManagers: true,
        primaryManager: {
          type: 'npm' as const,
          language: 'javascript' as const,
          installCommand: 'npm ci',
          detected: true,
          configFiles: ['package.json']
        },
        installCommands: ['npm ci']
      });

      // Mock dependency installation failure
      mockContainerManagerInstance.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'npm ERR! Network error',
        exitCode: 1,
        error: 'Network timeout'
      });

      const task = createBaseTask('dependency-install-failure');
      const workspace = await workspaceManager.createWorkspace(task);

      // Verify workspace was still created successfully
      expect(workspace.taskId).toBe(task.id);
      expect(workspace.status).toBe('active');

      // Verify dependency installation was attempted but failed
      expect(mockContainerManagerInstance.execCommand).toHaveBeenCalled();
    });
  });
});