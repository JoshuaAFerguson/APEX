import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkspaceManager, WorkspaceInfo, WorkspaceManagerOptions } from '../packages/orchestrator/src/workspace-manager';
import {
  WorkspaceConfig,
  IsolationMode,
  IsolationConfig,
  ContainerConfig,
  ContainerDefaults,
  ContainerRuntimeType,
  Task,
  TaskStatus
} from '@apexcli/core';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock filesystem operations
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      rmdir: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
      cp: vi.fn(),
      rm: vi.fn(),
    },
  };
});

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

// Mock util.promisify
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    promisify: vi.fn().mockImplementation((fn) => {
      if (fn.name === 'exec') {
        return vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
      }
      return fn;
    }),
  };
});

describe('V0.4.0 Workspace Isolation Feature', () => {
  describe('WorkspaceManager Core Functionality', () => {
    let workspaceManager: WorkspaceManager;
    let mockOptions: WorkspaceManagerOptions;

    beforeEach(() => {
      mockOptions = {
        projectPath: '/test/project',
        defaultStrategy: 'container',
        containerDefaults: {
          image: 'node:18-alpine',
          workingDir: '/app',
          environment: { NODE_ENV: 'development' },
          volumes: ['/test/project:/app'],
          ports: ['3000:3000'],
          networkMode: 'bridge'
        }
      };

      workspaceManager = new WorkspaceManager(mockOptions);

      // Reset mocks
      vi.clearAllMocks();

      // Mock successful operations
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.readFile as any).mockResolvedValue('{}');
      (fs.access as any).mockResolvedValue(undefined);
      (fs.stat as any).mockResolvedValue({ isDirectory: () => true });
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    describe('Container-based Isolation', () => {
      it('should create isolated container workspace', async () => {
        const mockTask: Task = {
          id: 'task-container-test',
          description: 'Test container isolation',
          status: 'pending' as TaskStatus,
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: '/test/project'
        };

        const containerConfig: WorkspaceConfig = {
          strategy: 'container',
          isolation: {
            level: 'full',
            containerConfig: {
              image: 'node:18-alpine',
              workingDir: '/app',
              environment: {
                NODE_ENV: 'test',
                TASK_ID: mockTask.id
              },
              volumes: ['/test/project:/app:ro'],
              ports: ['3001:3000'],
              networkMode: 'bridge',
              memoryLimit: '512m',
              cpuLimit: '1.0'
            }
          }
        };

        // Mock Docker commands
        (execAsync as any)
          .mockResolvedValueOnce({ stdout: '', stderr: '' }) // docker --version
          .mockResolvedValueOnce({ stdout: 'container-123\n', stderr: '' }) // docker run
          .mockResolvedValueOnce({ stdout: 'running\n', stderr: '' }); // docker inspect

        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, containerConfig);

        expect(workspaceInfo.success).toBe(true);
        expect(workspaceInfo.status).toBe('active');
        expect(workspaceInfo.containerId).toBeDefined();
        expect(workspaceInfo.config.strategy).toBe('container');
        expect(workspaceInfo.taskId).toBe(mockTask.id);
      });

      it('should handle Docker runtime detection', async () => {
        // Mock Docker availability check
        (execAsync as any).mockResolvedValueOnce({
          stdout: 'Docker version 24.0.0, build 1234567\n',
          stderr: ''
        });

        const runtime = await (workspaceManager as any).detectContainerRuntime();

        expect(runtime.type).toBe('docker');
        expect(runtime.available).toBe(true);
        expect(runtime.version).toBeDefined();
      });

      it('should fallback to Podman when Docker unavailable', async () => {
        // Mock Docker unavailable, Podman available
        (execAsync as any)
          .mockRejectedValueOnce(new Error('Docker not found'))
          .mockResolvedValueOnce({
            stdout: 'podman version 4.0.0\n',
            stderr: ''
          });

        const runtime = await (workspaceManager as any).detectContainerRuntime();

        expect(runtime.type).toBe('podman');
        expect(runtime.available).toBe(true);
      });

      it('should configure container resource limits', async () => {
        const mockTask: Task = {
          id: 'task-limits-test',
          description: 'Test resource limits',
          status: 'pending',
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: '/test/project'
        };

        const resourceConfig: WorkspaceConfig = {
          strategy: 'container',
          isolation: {
            level: 'full',
            containerConfig: {
              image: 'node:18-alpine',
              workingDir: '/app',
              memoryLimit: '1g',
              cpuLimit: '2.0',
              diskLimit: '10g',
              networkBandwidthLimit: '100m'
            }
          }
        };

        // Mock container creation with resource limits
        (execAsync as any)
          .mockResolvedValueOnce({ stdout: '', stderr: '' }) // docker --version
          .mockResolvedValueOnce({ stdout: 'container-456\n', stderr: '' }); // docker run with limits

        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, resourceConfig);

        expect(workspaceInfo.success).toBe(true);

        // Verify Docker command included resource limits
        expect(execAsync).toHaveBeenCalledWith(
          expect.stringContaining('--memory=1g')
        );
        expect(execAsync).toHaveBeenCalledWith(
          expect.stringContaining('--cpus=2.0')
        );
      });

      it('should mount project files with proper permissions', async () => {
        const mockTask: Task = {
          id: 'task-mount-test',
          description: 'Test file mounting',
          status: 'pending',
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: '/test/project'
        };

        const mountConfig: WorkspaceConfig = {
          strategy: 'container',
          isolation: {
            level: 'partial',
            containerConfig: {
              image: 'node:18-alpine',
              workingDir: '/app',
              volumes: [
                '/test/project:/app:ro',  // Read-only project files
                '/test/project/src:/app/src:rw',  // Read-write source
                'apex-cache:/app/.cache'  // Named volume for cache
              ]
            }
          }
        };

        (execAsync as any)
          .mockResolvedValueOnce({ stdout: '', stderr: '' }) // docker --version
          .mockResolvedValueOnce({ stdout: 'container-789\n', stderr: '' }); // docker run

        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, mountConfig);

        expect(workspaceInfo.success).toBe(true);

        // Verify mount configurations
        const dockerRunCall = (execAsync as any).mock.calls.find(call =>
          call[0].includes('docker run')
        );
        expect(dockerRunCall).toBeDefined();
        expect(dockerRunCall[0]).toContain('-v /test/project:/app:ro');
        expect(dockerRunCall[0]).toContain('-v /test/project/src:/app/src:rw');
        expect(dockerRunCall[0]).toContain('-v apex-cache:/app/.cache');
      });

      it('should handle network isolation', async () => {
        const mockTask: Task = {
          id: 'task-network-test',
          description: 'Test network isolation',
          status: 'pending',
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: '/test/project'
        };

        const networkConfig: WorkspaceConfig = {
          strategy: 'container',
          isolation: {
            level: 'full',
            containerConfig: {
              image: 'node:18-alpine',
              workingDir: '/app',
              networkMode: 'none',  // No network access
              ports: []  // No port mappings
            }
          }
        };

        (execAsync as any)
          .mockResolvedValueOnce({ stdout: '', stderr: '' }) // docker --version
          .mockResolvedValueOnce({ stdout: 'container-network\n', stderr: '' }); // docker run

        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, networkConfig);

        expect(workspaceInfo.success).toBe(true);

        // Verify network isolation
        const dockerRunCall = (execAsync as any).mock.calls.find(call =>
          call[0].includes('docker run')
        );
        expect(dockerRunCall[0]).toContain('--network=none');
      });

      it('should monitor container health', async () => {
        const containerId = 'container-health-test';

        // Mock container health check
        (execAsync as any)
          .mockResolvedValueOnce({
            stdout: JSON.stringify([{
              State: { Status: 'running', Health: { Status: 'healthy' } },
              Config: { Image: 'node:18-alpine' }
            }]),
            stderr: ''
          });

        const healthStatus = await (workspaceManager as any).checkContainerHealth(containerId);

        expect(healthStatus.status).toBe('healthy');
        expect(healthStatus.running).toBe(true);
      });
    });

    describe('Git Worktree Isolation', () => {
      it('should create git worktree workspace', async () => {
        const mockTask: Task = {
          id: 'task-worktree-test',
          description: 'Test worktree isolation',
          status: 'pending',
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: '/test/project'
        };

        const worktreeConfig: WorkspaceConfig = {
          strategy: 'worktree',
          isolation: {
            level: 'partial',
            worktreeConfig: {
              branchName: `apex/task-${mockTask.id}`,
              baseBranch: 'main',
              path: `/tmp/apex/worktrees/task-${mockTask.id}`
            }
          }
        };

        // Mock git operations
        (execAsync as any)
          .mockResolvedValueOnce({ stdout: 'main', stderr: '' }) // git branch --show-current
          .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git worktree add
          .mockResolvedValueOnce({ stdout: '', stderr: '' }); // git checkout -b

        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, worktreeConfig);

        expect(workspaceInfo.success).toBe(true);
        expect(workspaceInfo.status).toBe('active');
        expect(workspaceInfo.config.strategy).toBe('worktree');
        expect(workspaceInfo.workspacePath).toContain('worktrees');
      });

      it('should handle branch creation and switching', async () => {
        const mockTask: Task = {
          id: 'task-branch-test',
          description: 'Test branch management',
          status: 'pending',
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: '/test/project'
        };

        const branchConfig: WorkspaceConfig = {
          strategy: 'worktree',
          isolation: {
            level: 'partial',
            worktreeConfig: {
              branchName: 'feature/new-authentication',
              baseBranch: 'develop',
              path: '/tmp/apex/worktrees/auth-feature',
              autoCommit: true,
              autoPush: false
            }
          }
        };

        // Mock git operations for branching
        (execAsync as any)
          .mockResolvedValueOnce({ stdout: 'develop', stderr: '' }) // current branch
          .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git fetch
          .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git worktree add
          .mockResolvedValueOnce({ stdout: '', stderr: '' }); // git checkout -b

        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, branchConfig);

        expect(workspaceInfo.success).toBe(true);

        // Verify git worktree creation
        expect(execAsync).toHaveBeenCalledWith(
          expect.stringMatching(/git worktree add.*feature\/new-authentication/)
        );
      });

      it('should clean up worktree on workspace removal', async () => {
        const workspaceInfo: WorkspaceInfo = {
          taskId: 'task-cleanup-test',
          config: {
            strategy: 'worktree',
            isolation: {
              level: 'partial',
              worktreeConfig: {
                branchName: 'feature/cleanup-test',
                baseBranch: 'main',
                path: '/tmp/apex/worktrees/cleanup-test'
              }
            }
          },
          workspacePath: '/tmp/apex/worktrees/cleanup-test',
          status: 'active',
          createdAt: new Date(),
          lastAccessed: new Date()
        };

        // Mock cleanup operations
        (execAsync as any)
          .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git worktree remove
          .mockResolvedValueOnce({ stdout: '', stderr: '' }); // git branch -D (if needed)

        await workspaceManager.cleanupWorkspace(workspaceInfo);

        // Verify worktree removal
        expect(execAsync).toHaveBeenCalledWith(
          expect.stringMatching(/git worktree remove/)
        );
      });
    });

    describe('Process Isolation', () => {
      it('should create process-isolated workspace', async () => {
        const mockTask: Task = {
          id: 'task-process-test',
          description: 'Test process isolation',
          status: 'pending',
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: '/test/project'
        };

        const processConfig: WorkspaceConfig = {
          strategy: 'process',
          isolation: {
            level: 'minimal',
            processConfig: {
              env: {
                NODE_ENV: 'sandbox',
                TASK_ID: mockTask.id,
                ISOLATION_MODE: 'process'
              },
              cwd: '/tmp/apex/process-workspace',
              uid: 1001,
              gid: 1001
            }
          }
        };

        // Mock process setup
        (fs.mkdir as any).mockResolvedValue(undefined);
        (fs.cp as any).mockResolvedValue(undefined);

        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, processConfig);

        expect(workspaceInfo.success).toBe(true);
        expect(workspaceInfo.config.strategy).toBe('process');

        // Verify directory creation
        expect(fs.mkdir).toHaveBeenCalledWith(
          expect.stringContaining('process-workspace'),
          { recursive: true }
        );
      });

      it('should configure environment isolation', async () => {
        const processConfig = {
          env: {
            NODE_ENV: 'test',
            PATH: '/usr/local/bin:/usr/bin:/bin',
            CUSTOM_VAR: 'isolated-value'
          },
          cwd: '/isolated/workspace',
          uid: 1000,
          gid: 1000
        };

        const isolatedEnv = await (workspaceManager as any).createIsolatedEnvironment(processConfig);

        expect(isolatedEnv.NODE_ENV).toBe('test');
        expect(isolatedEnv.CUSTOM_VAR).toBe('isolated-value');
        expect(isolatedEnv.PATH).toBe('/usr/local/bin:/usr/bin:/bin');
      });
    });

    describe('Cross-Platform Compatibility', () => {
      it('should handle Windows-specific paths and commands', async () => {
        // Mock Windows environment
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });

        const mockTask: Task = {
          id: 'task-windows-test',
          description: 'Test Windows compatibility',
          status: 'pending',
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: 'C:\\test\\project'
        };

        const windowsConfig: WorkspaceConfig = {
          strategy: 'container',
          isolation: {
            level: 'full',
            containerConfig: {
              image: 'mcr.microsoft.com/windows/servercore:ltsc2022',
              workingDir: 'C:\\app',
              volumes: ['C:\\test\\project:C:\\app'],
              shell: 'powershell'
            }
          }
        };

        // Mock Docker on Windows
        (execAsync as any)
          .mockResolvedValueOnce({ stdout: 'Docker Desktop version', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'container-windows\n', stderr: '' });

        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, windowsConfig);

        expect(workspaceInfo.success).toBe(true);

        // Restore original platform
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });

      it('should handle macOS-specific Docker configurations', async () => {
        // Mock macOS environment
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'darwin' });

        const mockTask: Task = {
          id: 'task-macos-test',
          description: 'Test macOS compatibility',
          status: 'pending',
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: '/Users/test/project'
        };

        const macosConfig: WorkspaceConfig = {
          strategy: 'container',
          isolation: {
            level: 'full',
            containerConfig: {
              image: 'node:18-alpine',
              workingDir: '/app',
              volumes: ['/Users/test/project:/app'],
              platform: 'linux/amd64'  // For M1 Macs
            }
          }
        };

        (execAsync as any)
          .mockResolvedValueOnce({ stdout: 'Docker version', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'container-macos\n', stderr: '' });

        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, macosConfig);

        expect(workspaceInfo.success).toBe(true);

        // Verify platform specification for M1 compatibility
        const dockerRunCall = (execAsync as any).mock.calls.find(call =>
          call[0].includes('docker run')
        );
        expect(dockerRunCall[0]).toContain('--platform=linux/amd64');

        // Restore original platform
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });

      it('should handle Linux-specific security contexts', async () => {
        // Mock Linux environment
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'linux' });

        const mockTask: Task = {
          id: 'task-linux-test',
          description: 'Test Linux security',
          status: 'pending',
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: '/home/test/project'
        };

        const linuxConfig: WorkspaceConfig = {
          strategy: 'container',
          isolation: {
            level: 'full',
            containerConfig: {
              image: 'node:18-alpine',
              workingDir: '/app',
              securityContext: {
                readOnlyRootFilesystem: true,
                runAsNonRoot: true,
                runAsUser: 1000,
                runAsGroup: 1000,
                capabilities: {
                  drop: ['ALL'],
                  add: []
                }
              }
            }
          }
        };

        (execAsync as any)
          .mockResolvedValueOnce({ stdout: 'Docker version', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'container-linux\n', stderr: '' });

        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, linuxConfig);

        expect(workspaceInfo.success).toBe(true);

        // Verify security options
        const dockerRunCall = (execAsync as any).mock.calls.find(call =>
          call[0].includes('docker run')
        );
        expect(dockerRunCall[0]).toContain('--read-only');
        expect(dockerRunCall[0]).toContain('--user=1000:1000');

        // Restore original platform
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });
    });

    describe('Workspace Lifecycle Management', () => {
      it('should track workspace creation and access times', async () => {
        const mockTask: Task = {
          id: 'task-lifecycle-test',
          description: 'Test lifecycle tracking',
          status: 'pending',
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: '/test/project'
        };

        const config: WorkspaceConfig = {
          strategy: 'container',
          isolation: {
            level: 'partial',
            containerConfig: {
              image: 'node:18-alpine',
              workingDir: '/app'
            }
          }
        };

        (execAsync as any)
          .mockResolvedValueOnce({ stdout: '', stderr: '' }) // docker --version
          .mockResolvedValueOnce({ stdout: 'container-lifecycle\n', stderr: '' }); // docker run

        const beforeCreate = new Date();
        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, config);
        const afterCreate = new Date();

        expect(workspaceInfo.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
        expect(workspaceInfo.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
        expect(workspaceInfo.lastAccessed).toBeDefined();
      });

      it('should update access times on workspace operations', async () => {
        const workspaceInfo: WorkspaceInfo = {
          taskId: 'task-access-test',
          config: { strategy: 'container', isolation: { level: 'partial' } },
          workspacePath: '/tmp/workspace-test',
          status: 'active',
          createdAt: new Date(Date.now() - 60000), // 1 minute ago
          lastAccessed: new Date(Date.now() - 60000),
          containerId: 'container-access-test'
        };

        const beforeAccess = new Date();
        await workspaceManager.updateLastAccessed(workspaceInfo);
        const afterAccess = new Date();

        expect(workspaceInfo.lastAccessed.getTime()).toBeGreaterThanOrEqual(beforeAccess.getTime());
        expect(workspaceInfo.lastAccessed.getTime()).toBeLessThanOrEqual(afterAccess.getTime());
      });

      it('should identify idle workspaces for cleanup', async () => {
        const activeWorkspace: WorkspaceInfo = {
          taskId: 'active-task',
          config: { strategy: 'container', isolation: { level: 'partial' } },
          workspacePath: '/tmp/active',
          status: 'active',
          createdAt: new Date(),
          lastAccessed: new Date(), // Recent access
          containerId: 'container-active'
        };

        const idleWorkspace: WorkspaceInfo = {
          taskId: 'idle-task',
          config: { strategy: 'container', isolation: { level: 'partial' } },
          workspacePath: '/tmp/idle',
          status: 'active',
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          lastAccessed: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          containerId: 'container-idle'
        };

        const workspaces = [activeWorkspace, idleWorkspace];
        const idleThreshold = 60 * 60 * 1000; // 1 hour

        const idleWorkspaces = await workspaceManager.getIdleWorkspaces(workspaces, idleThreshold);

        expect(idleWorkspaces).toHaveLength(1);
        expect(idleWorkspaces[0].taskId).toBe('idle-task');
      });

      it('should perform automatic cleanup of expired workspaces', async () => {
        const expiredWorkspace: WorkspaceInfo = {
          taskId: 'expired-task',
          config: { strategy: 'container', isolation: { level: 'full' } },
          workspacePath: '/tmp/expired',
          status: 'active',
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
          lastAccessed: new Date(Date.now() - 48 * 60 * 60 * 1000),
          containerId: 'container-expired'
        };

        // Mock container cleanup
        (execAsync as any)
          .mockResolvedValueOnce({ stdout: '', stderr: '' }) // docker stop
          .mockResolvedValueOnce({ stdout: '', stderr: '' }); // docker rm

        const cleanupResult = await workspaceManager.cleanupWorkspace(expiredWorkspace);

        expect(cleanupResult.success).toBe(true);
        expect(expiredWorkspace.status).toBe('cleaned');

        // Verify container cleanup commands
        expect(execAsync).toHaveBeenCalledWith(
          expect.stringMatching(/docker stop.*container-expired/)
        );
        expect(execAsync).toHaveBeenCalledWith(
          expect.stringMatching(/docker rm.*container-expired/)
        );
      });
    });

    describe('Error Handling and Recovery', () => {
      it('should handle Docker daemon unavailability', async () => {
        const mockTask: Task = {
          id: 'task-docker-fail',
          description: 'Test Docker failure handling',
          status: 'pending',
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: '/test/project'
        };

        const containerConfig: WorkspaceConfig = {
          strategy: 'container',
          isolation: {
            level: 'full',
            containerConfig: {
              image: 'node:18-alpine',
              workingDir: '/app'
            }
          }
        };

        // Mock Docker failure
        (execAsync as any).mockRejectedValue(new Error('Docker daemon not running'));

        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, containerConfig);

        expect(workspaceInfo.success).toBe(false);
        expect(workspaceInfo.warnings).toBeDefined();
        expect(workspaceInfo.warnings!.length).toBeGreaterThan(0);
        expect(workspaceInfo.warnings![0]).toContain('Docker daemon not running');
      });

      it('should gracefully degrade when container creation fails', async () => {
        const mockTask: Task = {
          id: 'task-fallback',
          description: 'Test fallback mechanism',
          status: 'pending',
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: '/test/project'
        };

        const fallbackConfig: WorkspaceConfig = {
          strategy: 'container',
          isolation: {
            level: 'partial',
            fallbackStrategy: 'process' // Fallback to process isolation
          }
        };

        // Mock container failure, process success
        (execAsync as any)
          .mockRejectedValueOnce(new Error('Container creation failed'))
          .mockResolvedValueOnce({ stdout: '', stderr: '' }); // Process setup success

        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, fallbackConfig);

        expect(workspaceInfo.success).toBe(true);
        expect(workspaceInfo.config.strategy).toBe('process'); // Fell back to process
        expect(workspaceInfo.warnings).toContain('Fell back to process isolation');
      });

      it('should handle filesystem permission errors', async () => {
        const mockTask: Task = {
          id: 'task-permission-test',
          description: 'Test permission handling',
          status: 'pending',
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: '/restricted/project'
        };

        const config: WorkspaceConfig = {
          strategy: 'worktree',
          isolation: {
            level: 'partial',
            worktreeConfig: {
              branchName: 'test-branch',
              baseBranch: 'main',
              path: '/restricted/worktree'
            }
          }
        };

        // Mock permission denied
        (fs.mkdir as any).mockRejectedValue(new Error('EACCES: permission denied'));

        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, config);

        expect(workspaceInfo.success).toBe(false);
        expect(workspaceInfo.warnings).toBeDefined();
        expect(workspaceInfo.warnings!.some(w => w.includes('permission denied'))).toBe(true);
      });

      it('should recover from partial workspace creation failures', async () => {
        const mockTask: Task = {
          id: 'task-recovery-test',
          description: 'Test recovery mechanism',
          status: 'pending',
          createdAt: new Date(),
          priority: 'medium',
          workflow: 'feature',
          projectPath: '/test/project'
        };

        const config: WorkspaceConfig = {
          strategy: 'container',
          isolation: {
            level: 'full',
            containerConfig: {
              image: 'node:18-alpine',
              workingDir: '/app'
            }
          }
        };

        // Mock partial failure - container created but health check fails
        (execAsync as any)
          .mockResolvedValueOnce({ stdout: '', stderr: '' }) // docker --version
          .mockResolvedValueOnce({ stdout: 'container-partial\n', stderr: '' }) // docker run
          .mockRejectedValueOnce(new Error('Health check failed')); // docker inspect

        const workspaceInfo = await workspaceManager.createWorkspace(mockTask, config);

        expect(workspaceInfo.containerId).toBe('container-partial');
        expect(workspaceInfo.warnings).toBeDefined();
        expect(workspaceInfo.warnings!.some(w => w.includes('Health check failed'))).toBe(true);
      });
    });

    describe('Performance and Resource Management', () => {
      it('should handle concurrent workspace creation efficiently', async () => {
        const tasks = Array.from({ length: 10 }, (_, i) => ({
          id: `concurrent-task-${i}`,
          description: `Concurrent test ${i}`,
          status: 'pending' as TaskStatus,
          createdAt: new Date(),
          priority: 'medium' as const,
          workflow: 'feature' as const,
          projectPath: '/test/project'
        }));

        const config: WorkspaceConfig = {
          strategy: 'process',
          isolation: {
            level: 'minimal',
            processConfig: {
              env: { NODE_ENV: 'test' },
              cwd: '/tmp/concurrent-test'
            }
          }
        };

        // Mock successful process creation
        (fs.mkdir as any).mockResolvedValue(undefined);

        const startTime = Date.now();
        const promises = tasks.map(task => workspaceManager.createWorkspace(task, config));
        const results = await Promise.all(promises);
        const endTime = Date.now();

        expect(results.every(r => r.success)).toBe(true);
        expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

        // Verify all workspaces have unique paths
        const paths = results.map(r => r.workspacePath);
        const uniquePaths = new Set(paths);
        expect(uniquePaths.size).toBe(10);
      });

      it('should monitor and limit resource usage', async () => {
        const highResourceTask: Task = {
          id: 'resource-intensive-task',
          description: 'Resource intensive operation',
          status: 'pending',
          createdAt: new Date(),
          priority: 'high',
          workflow: 'feature',
          projectPath: '/test/project'
        };

        const resourceConfig: WorkspaceConfig = {
          strategy: 'container',
          isolation: {
            level: 'full',
            containerConfig: {
              image: 'node:18-alpine',
              workingDir: '/app',
              memoryLimit: '2g',
              cpuLimit: '1.5',
              oomKillDisable: false,
              memorySwappiness: 10
            }
          }
        };

        (execAsync as any)
          .mockResolvedValueOnce({ stdout: '', stderr: '' }) // docker --version
          .mockResolvedValueOnce({ stdout: 'resource-container\n', stderr: '' }); // docker run

        const workspaceInfo = await workspaceManager.createWorkspace(highResourceTask, resourceConfig);

        expect(workspaceInfo.success).toBe(true);

        // Verify resource limits were applied
        const dockerRunCall = (execAsync as any).mock.calls.find(call =>
          call[0].includes('docker run')
        );
        expect(dockerRunCall[0]).toContain('--memory=2g');
        expect(dockerRunCall[0]).toContain('--cpus=1.5');
        expect(dockerRunCall[0]).toContain('--memory-swappiness=10');
      });

      it('should clean up resources on process termination', async () => {
        const workspaces: WorkspaceInfo[] = [
          {
            taskId: 'cleanup-task-1',
            config: { strategy: 'container', isolation: { level: 'full' } },
            workspacePath: '/tmp/cleanup-1',
            status: 'active',
            createdAt: new Date(),
            lastAccessed: new Date(),
            containerId: 'cleanup-container-1'
          },
          {
            taskId: 'cleanup-task-2',
            config: { strategy: 'worktree', isolation: { level: 'partial' } },
            workspacePath: '/tmp/cleanup-2',
            status: 'active',
            createdAt: new Date(),
            lastAccessed: new Date()
          }
        ];

        // Mock cleanup operations
        (execAsync as any)
          .mockResolvedValue({ stdout: '', stderr: '' }); // All cleanup commands

        await workspaceManager.cleanupAllWorkspaces(workspaces);

        // Verify container cleanup
        expect(execAsync).toHaveBeenCalledWith(
          expect.stringMatching(/docker stop.*cleanup-container-1/)
        );

        // Verify worktree cleanup
        expect(execAsync).toHaveBeenCalledWith(
          expect.stringMatching(/git worktree remove/)
        );
      });
    });
  });
});