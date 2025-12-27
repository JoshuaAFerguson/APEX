/**
 * Package Manager Install Integration Tests
 *
 * Tests the integration between dependency detection and workspace manager
 * for npm/yarn/pnpm install variants, including frozen lockfile commands,
 * monorepo detection, and workspace configurations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
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

describe('Package Manager Install Integration Tests', () => {
  let workspaceManager: WorkspaceManager;
  let mockContainerManager: any;
  let mockDependencyDetector: any;
  const projectPath = '/test/project';

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

  // ============================================================================
  // NPM Package Manager Integration Tests
  // ============================================================================

  describe('NPM Install Integration', () => {
    it('should execute npm install for basic npm project', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm install',
          detected: true,
          metadata: {
            packageName: 'test-npm-project',
            hasLockfile: false,
            dependencyCount: 3
          }
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm install',
          detected: true,
          metadata: {
            packageName: 'test-npm-project',
            hasLockfile: false,
            dependencyCount: 3
          }
        },
        installCommands: ['npm install']
      });

      const task: Task = {
        id: 'npm-basic-install',
        type: 'feature',
        title: 'NPM Basic Install Test',
        description: 'Test basic npm install',
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
      // With CI optimization, npm without lockfile gets optimization flags
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'npm install --prefer-offline --no-audit',
        expect.any(Object)
      );
    });

    it('should execute npm ci for npm project with package-lock.json', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm install',
          detected: true,
          metadata: {
            packageName: 'test-npm-ci-project',
            hasLockfile: true,
            lockfileType: 'package-lock.json',
            dependencyCount: 5
          }
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm install',
          detected: true,
          metadata: {
            packageName: 'test-npm-ci-project',
            hasLockfile: true,
            lockfileType: 'package-lock.json',
            dependencyCount: 5
          }
        },
        installCommands: ['npm install']
      });

      const task: Task = {
        id: 'npm-ci-install',
        type: 'feature',
        title: 'NPM CI Install Test',
        description: 'Test npm ci for frozen lockfile install',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            useFrozenLockfile: true
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(true);
      // Workspace manager should detect lockfile and use npm ci with optimization flags
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'npm ci --prefer-offline --no-audit',
        expect.any(Object)
      );
    });

    it('should handle npm workspaces monorepo', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm install',
          detected: true,
          metadata: {
            packageName: 'npm-workspaces-root',
            hasLockfile: false,
            hasWorkspaces: true,
            isMonorepoRoot: true,
            workspacePatterns: ['packages/*', 'apps/*'],
            dependencyCount: 2
          }
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm install',
          detected: true
        },
        installCommands: ['npm install']
      });

      const task: Task = {
        id: 'npm-workspaces-install',
        type: 'feature',
        title: 'NPM Workspaces Install Test',
        description: 'Test npm install for workspaces',
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
      // Should still use npm install for workspaces root
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'npm install',
        expect.any(Object)
      );
    });
  });

  // ============================================================================
  // Yarn Package Manager Integration Tests
  // ============================================================================

  describe('Yarn Install Integration', () => {
    it('should execute yarn install for basic yarn project', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'yarn',
          language: 'javascript',
          installCommand: 'yarn install',
          detected: true,
          metadata: {
            packageName: 'test-yarn-project',
            hasLockfile: true,
            lockfileType: 'yarn.lock',
            dependencyCount: 4
          }
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'yarn',
          language: 'javascript',
          installCommand: 'yarn install',
          detected: true
        },
        installCommands: ['yarn install']
      });

      const task: Task = {
        id: 'yarn-basic-install',
        type: 'feature',
        title: 'Yarn Basic Install Test',
        description: 'Test basic yarn install',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'node:18-alpine', autoDependencyInstall: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(true);
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'yarn install',
        expect.any(Object)
      );
    });

    it('should execute yarn install --frozen-lockfile for frozen lockfile install', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'yarn',
          language: 'javascript',
          installCommand: 'yarn install',
          detected: true,
          metadata: {
            packageName: 'test-yarn-frozen-project',
            hasLockfile: true,
            lockfileType: 'yarn.lock',
            dependencyCount: 6
          }
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'yarn',
          language: 'javascript',
          installCommand: 'yarn install',
          detected: true
        },
        installCommands: ['yarn install']
      });

      const task: Task = {
        id: 'yarn-frozen-install',
        type: 'feature',
        title: 'Yarn Frozen Install Test',
        description: 'Test yarn frozen lockfile install',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:18-alpine',
            autoDependencyInstall: true,
            useFrozenLockfile: true
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(true);
      // Workspace manager should detect lockfile and use frozen lockfile command
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'yarn install --frozen-lockfile',
        expect.any(Object)
      );
    });

    it('should handle yarn workspaces monorepo', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'yarn',
          language: 'javascript',
          installCommand: 'yarn install',
          detected: true,
          metadata: {
            packageName: 'yarn-workspaces-root',
            hasLockfile: true,
            hasWorkspaces: true,
            isMonorepoRoot: true,
            workspacePatterns: ['packages/*', 'tools/*'],
            hasNohoistConfig: true,
            dependencyCount: 1
          }
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'yarn',
          language: 'javascript',
          installCommand: 'yarn install',
          detected: true
        },
        installCommands: ['yarn install']
      });

      const task: Task = {
        id: 'yarn-workspaces-install',
        type: 'feature',
        title: 'Yarn Workspaces Install Test',
        description: 'Test yarn workspaces install',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'node:18-alpine', autoDependencyInstall: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(true);
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'yarn install',
        expect.any(Object)
      );
    });

    it('should handle yarn Berry (v2+) projects', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'yarn',
          language: 'javascript',
          installCommand: 'yarn install',
          detected: true,
          metadata: {
            packageName: 'yarn-berry-project',
            hasLockfile: true,
            yarnVersion: '3.6.0',
            isYarnBerry: true,
            nodeLinker: 'pnp',
            hasYarnrcConfig: true,
            dependencyCount: 1
          }
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'yarn',
          language: 'javascript',
          installCommand: 'yarn install',
          detected: true
        },
        installCommands: ['yarn install']
      });

      const task: Task = {
        id: 'yarn-berry-install',
        type: 'feature',
        title: 'Yarn Berry Install Test',
        description: 'Test yarn Berry install',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: { image: 'node:18-alpine', autoDependencyInstall: true }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(true);
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'yarn install',
        expect.any(Object)
      );
    });
  });

  // ============================================================================
  // PNPM Package Manager Integration Tests
  // ============================================================================

  describe('PNPM Install Integration', () => {
    it('should execute pnpm install for basic pnpm project', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'pnpm',
          language: 'javascript',
          installCommand: 'pnpm install',
          detected: true,
          metadata: {
            packageName: 'test-pnpm-project',
            hasLockfile: true,
            lockfileType: 'pnpm-lock.yaml',
            lockfileVersion: '6.0',
            dependencyCount: 4
          }
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'pnpm',
          language: 'javascript',
          installCommand: 'pnpm install',
          detected: true
        },
        installCommands: ['pnpm install']
      });

      const task: Task = {
        id: 'pnpm-basic-install',
        type: 'feature',
        title: 'PNPM Basic Install Test',
        description: 'Test basic pnpm install',
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
        'pnpm install',
        expect.any(Object)
      );
    });

    it('should execute pnpm install --frozen-lockfile for frozen lockfile install', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'pnpm',
          language: 'javascript',
          installCommand: 'pnpm install',
          detected: true,
          metadata: {
            packageName: 'test-pnpm-frozen-project',
            hasLockfile: true,
            lockfileType: 'pnpm-lock.yaml',
            lockfileVersion: '6.0',
            dependencyCount: 3
          }
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'pnpm',
          language: 'javascript',
          installCommand: 'pnpm install',
          detected: true
        },
        installCommands: ['pnpm install']
      });

      const task: Task = {
        id: 'pnpm-frozen-install',
        type: 'feature',
        title: 'PNPM Frozen Install Test',
        description: 'Test pnpm frozen lockfile install',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            useFrozenLockfile: true
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(true);
      // Workspace manager should detect lockfile and use frozen lockfile command
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'pnpm install --frozen-lockfile',
        expect.any(Object)
      );
    });

    it('should handle pnpm workspaces monorepo', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'pnpm',
          language: 'javascript',
          installCommand: 'pnpm install',
          detected: true,
          metadata: {
            packageName: 'pnpm-workspaces-root',
            hasLockfile: true,
            hasWorkspaces: true,
            isMonorepoRoot: true,
            workspacePatterns: ['packages/*', 'apps/*', '!**/test/**'],
            hasWorkspaceConfig: true,
            dependencyCount: 2
          }
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'pnpm',
          language: 'javascript',
          installCommand: 'pnpm install',
          detected: true
        },
        installCommands: ['pnpm install']
      });

      const task: Task = {
        id: 'pnpm-workspaces-install',
        type: 'feature',
        title: 'PNPM Workspaces Install Test',
        description: 'Test pnpm workspaces install',
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
        'pnpm install',
        expect.any(Object)
      );
    });

    it('should handle pnpm with custom configuration', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'pnpm',
          language: 'javascript',
          installCommand: 'pnpm install',
          detected: true,
          metadata: {
            packageName: 'pnpm-config-project',
            hasLockfile: true,
            hasPnpmrcConfig: true,
            pnpmConfig: {
              strictPeerDependencies: false,
              autoInstallPeers: true,
              shamefullyHoist: false,
              storeDir: '~/.pnpm-store'
            },
            dependencyCount: 1
          }
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'pnpm',
          language: 'javascript',
          installCommand: 'pnpm install',
          detected: true
        },
        installCommands: ['pnpm install']
      });

      const task: Task = {
        id: 'pnpm-config-install',
        type: 'feature',
        title: 'PNPM Config Install Test',
        description: 'Test pnpm install with custom configuration',
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
        'pnpm install',
        expect.any(Object)
      );
    });
  });

  // ============================================================================
  // Package Manager Priority and Error Handling Tests
  // ============================================================================

  describe('Package Manager Priority and Error Handling', () => {
    it('should prioritize pnpm when multiple package managers are detected', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [
          {
            type: 'npm',
            language: 'javascript',
            installCommand: 'npm install',
            detected: true,
            metadata: { packageName: 'multi-manager-project', dependencyCount: 3 }
          },
          {
            type: 'yarn',
            language: 'javascript',
            installCommand: 'yarn install',
            detected: true,
            metadata: { packageName: 'multi-manager-project', dependencyCount: 3 }
          },
          {
            type: 'pnpm',
            language: 'javascript',
            installCommand: 'pnpm install',
            detected: true,
            metadata: { packageName: 'multi-manager-project', dependencyCount: 3 }
          }
        ],
        hasPackageManagers: true,
        primaryManager: {
          type: 'pnpm',
          language: 'javascript',
          installCommand: 'pnpm install',
          detected: true
        },
        installCommands: ['pnpm install']
      });

      const task: Task = {
        id: 'multi-manager-priority',
        type: 'feature',
        title: 'Multi Manager Priority Test',
        description: 'Test package manager priority',
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
      // Should use pnpm as the primary manager
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'pnpm install',
        expect.any(Object)
      );
    });

    it('should handle dependency installation failures gracefully', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm install',
          detected: true,
          metadata: { packageName: 'failing-project', dependencyCount: 2 }
        }],
        hasPackageManagers: true,
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          installCommand: 'npm install',
          detected: true
        },
        installCommands: ['npm install']
      });

      // Mock installation failure
      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'npm ERR! 404 Not Found - GET https://registry.npmjs.org/non-existent-package',
        exitCode: 1
      });

      const task: Task = {
        id: 'install-failure',
        type: 'feature',
        title: 'Install Failure Test',
        description: 'Test installation failure handling',
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
      expect(result.error).toMatch(/npm ERR!|404.*not found/i);
    });

    it('should skip dependency installation when no package managers are detected', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [],
        hasPackageManagers: false,
        installCommands: []
      });

      const task: Task = {
        id: 'no-package-manager',
        type: 'feature',
        title: 'No Package Manager Test',
        description: 'Test behavior when no package managers detected',
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

      expect(result.success).toBe(true);
      // Should not attempt any package installation
      expect(mockContainerManager.execCommand).not.toHaveBeenCalledWith(
        'test-container',
        expect.stringMatching(/install/),
        expect.any(Object)
      );
    });
  });
});