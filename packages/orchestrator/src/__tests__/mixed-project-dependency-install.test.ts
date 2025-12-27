/**
 * Mixed Project Type Dependency Installation Tests
 *
 * Tests scenarios where projects have multiple dependency files:
 * - Node.js + Python (package.json + requirements.txt)
 * - Rust + Node.js (Cargo.toml + package.json)
 * - Nested project structures
 * - Symlinked dependency files
 * - Priority resolution for primary package manager
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

describe('Mixed Project Type Dependency Installation', () => {
  let workspaceManager: WorkspaceManager;
  let mockContainerManager: any;
  let mockDependencyDetector: any;
  const projectPath = '/test/mixed-project';

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContainerManager = {
      createContainer: vi.fn().mockResolvedValue({ success: true, containerId: 'test-container' }),
      execCommand: vi.fn().mockResolvedValue({ success: true, stdout: 'Success', stderr: '', exitCode: 0 }),
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

  describe('Node.js + Python Mixed Projects', () => {
    it('should install both Node.js and Python dependencies', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [
          { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true, configFile: 'package.json' },
          { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true, configFile: 'requirements.txt' }
        ],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install', 'pip install -r requirements.txt']
      });

      const task: Task = {
        id: 'test-nodejs-python',
        type: 'feature',
        title: 'Test Node.js + Python Mixed Project',
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

      await workspaceManager.createWorkspace(task);

      // Should install both package managers
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'npm install',
        expect.objectContaining({ workingDir: '/workspace' }),
        'docker'
      );
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'pip install -r requirements.txt',
        expect.objectContaining({ workingDir: '/workspace' }),
        'docker'
      );
    });

    it('should prioritize Node.js when both exist', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [
          { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true, configFile: 'package.json' },
          { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true, configFile: 'requirements.txt' }
        ],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install', 'pip install -r requirements.txt']
      });

      const task: Task = {
        id: 'test-priority',
        type: 'feature',
        title: 'Test Priority Resolution',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'node:20-alpine', autoDependencyInstall: true, primaryOnly: true }
        }
      };

      await workspaceManager.createWorkspace(task);

      // Only npm install should be called when primaryOnly is true
      expect(mockContainerManager.execCommand).toHaveBeenCalledTimes(1);
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'npm install',
        expect.objectContaining({ workingDir: '/workspace' }),
        'docker'
      );
    });

    it('should handle Python scripts with Node.js tooling dependencies', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [
          { type: 'npm', language: 'javascript', installCommand: 'npm install --production', detected: true, configFile: 'package.json', devDependenciesOnly: true },
          { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true, configFile: 'requirements.txt' }
        ],
        hasPackageManagers: true,
        primaryManager: { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true },
        installCommands: ['pip install -r requirements.txt', 'npm install --production']
      });

      const task: Task = {
        id: 'test-python-with-nodejs-tools',
        type: 'feature',
        title: 'Test Python with Node.js Tooling',
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

      await workspaceManager.createWorkspace(task);

      // Python should be primary, Node.js secondary for tooling
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'pip install -r requirements.txt',
        expect.objectContaining({ workingDir: '/workspace' }),
        'docker'
      );
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'npm install --production',
        expect.objectContaining({ workingDir: '/workspace' }),
        'docker'
      );
    });
  });

  describe('Rust + Node.js Mixed Projects', () => {
    it('should handle Rust project with Node.js frontend', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [
          { type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true, configFile: 'Cargo.toml' },
          { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true, configFile: 'frontend/package.json' }
        ],
        hasPackageManagers: true,
        primaryManager: { type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true },
        installCommands: ['cargo build', 'cd frontend && npm install']
      });

      const task: Task = {
        id: 'test-rust-nodejs',
        type: 'feature',
        title: 'Test Rust + Node.js Mixed Project',
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

      await workspaceManager.createWorkspace(task);

      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'cargo build',
        expect.objectContaining({ workingDir: '/workspace' }),
        'docker'
      );
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'cd frontend && npm install',
        expect.objectContaining({ workingDir: '/workspace' }),
        'docker'
      );
    });

    it('should handle workspace errors gracefully in mixed projects', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [
          { type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true },
          { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }
        ],
        hasPackageManagers: true,
        primaryManager: { type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true },
        installCommands: ['cargo build', 'npm install']
      });

      // First command succeeds, second fails
      mockContainerManager.execCommand
        .mockResolvedValueOnce({ success: true, stdout: 'Finished dev [unoptimized + debuginfo] target(s)', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ success: false, stdout: '', stderr: 'npm ERR! missing package.json', exitCode: 1 });

      const task: Task = {
        id: 'test-partial-failure',
        type: 'feature',
        title: 'Test Partial Installation Failure',
        description: 'Test',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'rust:1.75-alpine', autoDependencyInstall: true, failOnAnyError: false }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      // Should succeed overall but with warnings about partial failure
      expect(result.success).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringMatching(/npm.*failed.*missing package\.json/i)
      );
    });
  });

  describe('Nested Project Structures', () => {
    it('should handle nested dependency files in subdirectories', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [
          { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true, configFile: 'package.json' },
          { type: 'npm', language: 'javascript', installCommand: 'cd backend && npm install', detected: true, configFile: 'backend/package.json' },
          { type: 'npm', language: 'javascript', installCommand: 'cd frontend && npm install', detected: true, configFile: 'frontend/package.json' }
        ],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install', 'cd backend && npm install', 'cd frontend && npm install']
      });

      const task: Task = {
        id: 'test-nested-structure',
        type: 'feature',
        title: 'Test Nested Project Structure',
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

      await workspaceManager.createWorkspace(task);

      expect(mockContainerManager.execCommand).toHaveBeenCalledTimes(3);
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'npm install',
        expect.objectContaining({ workingDir: '/workspace' }),
        'docker'
      );
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'cd backend && npm install',
        expect.objectContaining({ workingDir: '/workspace' }),
        'docker'
      );
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'cd frontend && npm install',
        expect.objectContaining({ workingDir: '/workspace' }),
        'docker'
      );
    });

    it('should handle monorepo structure with workspace detection', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [
          {
            type: 'yarn',
            language: 'javascript',
            installCommand: 'yarn install',
            detected: true,
            configFile: 'package.json',
            isWorkspace: true,
            workspacePackages: ['packages/*', 'apps/*']
          }
        ],
        hasPackageManagers: true,
        primaryManager: { type: 'yarn', language: 'javascript', installCommand: 'yarn install', detected: true, isWorkspace: true },
        installCommands: ['yarn install']
      });

      const task: Task = {
        id: 'test-monorepo',
        type: 'feature',
        title: 'Test Monorepo Structure',
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

      await workspaceManager.createWorkspace(task);

      // Single workspace install should handle all packages
      expect(mockContainerManager.execCommand).toHaveBeenCalledTimes(1);
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'yarn install',
        expect.objectContaining({ workingDir: '/workspace' }),
        'docker'
      );
    });
  });

  describe('Symlinked and Complex File Structures', () => {
    it('should handle symlinked dependency files', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [
          { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true, configFile: 'package.json', isSymlink: true }
        ],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      });

      const task: Task = {
        id: 'test-symlinks',
        type: 'feature',
        title: 'Test Symlinked Files',
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

      expect(result.success).toBe(true);
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'npm install',
        expect.objectContaining({ workingDir: '/workspace' }),
        'docker'
      );
    });

    it('should handle complex dependency file patterns', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [
          { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true, configFile: 'requirements.txt' },
          { type: 'pip', language: 'python', installCommand: 'pip install -r requirements-dev.txt', detected: true, configFile: 'requirements-dev.txt' },
          { type: 'pip', language: 'python', installCommand: 'pip install -r requirements-test.txt', detected: true, configFile: 'requirements-test.txt' },
          { type: 'poetry', language: 'python', installCommand: 'poetry install', detected: true, configFile: 'pyproject.toml' }
        ],
        hasPackageManagers: true,
        primaryManager: { type: 'poetry', language: 'python', installCommand: 'poetry install', detected: true },
        installCommands: ['poetry install'] // Poetry should override pip when both exist
      });

      const task: Task = {
        id: 'test-complex-python',
        type: 'feature',
        title: 'Test Complex Python Project',
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

      await workspaceManager.createWorkspace(task);

      // Only poetry install should be called (primary manager)
      expect(mockContainerManager.execCommand).toHaveBeenCalledTimes(1);
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'poetry install',
        expect.objectContaining({ workingDir: '/workspace' }),
        'docker'
      );
    });
  });

  describe('Custom Configuration for Mixed Projects', () => {
    it('should handle custom install commands for mixed projects', async () => {
      const customCommand = 'npm ci && pip install -r requirements.txt --upgrade';

      const task: Task = {
        id: 'test-custom-mixed',
        type: 'feature',
        title: 'Test Custom Mixed Command',
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
            customInstallCommand: customCommand
          }
        }
      };

      await workspaceManager.createWorkspace(task);

      // Custom command should bypass detection and run directly
      expect(mockDependencyDetector.detectPackageManagers).not.toHaveBeenCalled();
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        customCommand,
        expect.objectContaining({ workingDir: '/workspace' }),
        'docker'
      );
    });

    it('should validate mixed project detection results', async () => {
      // Test that detection returns expected structure for mixed projects
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [
          { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
          { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true }
        ],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install', 'pip install -r requirements.txt'],
        projectTypes: ['javascript', 'python'],
        complexity: 'mixed'
      });

      const task: Task = {
        id: 'test-detection-validation',
        type: 'feature',
        title: 'Test Detection Validation',
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

      expect(result.success).toBe(true);
      expect(mockDependencyDetector.detectPackageManagers).toHaveBeenCalledWith(
        projectPath,
        expect.objectContaining({
          includeMixed: true,
          maxDepth: 3
        })
      );
    });
  });
});