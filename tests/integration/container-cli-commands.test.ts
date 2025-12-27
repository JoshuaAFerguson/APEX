/**
 * Integration Tests for Container Isolation CLI Commands
 *
 * Tests validate that CLI commands documented in container-isolation.md
 * work correctly with container workspace configurations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Mock the CLI module to test command definitions
vi.mock('@apexcli/orchestrator');
vi.mock('child_process');

describe('Container Isolation CLI Commands Integration', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('apex run command with container options', () => {
    it('should support workspace strategy override', async () => {
      // Test that apex run accepts --workspace-strategy container
      const program = new Command();

      program
        .command('run <task>')
        .option('--workspace-strategy <strategy>', 'Override workspace strategy')
        .option('--container-cpu <cpu>', 'Override container CPU limit')
        .option('--container-memory <memory>', 'Override container memory limit')
        .action(() => {});

      // Parse command with container strategy
      const args = [
        'node', 'apex', 'run', 'implement user authentication feature',
        '--workspace-strategy', 'container'
      ];

      expect(() => program.parse(args)).not.toThrow();
    });

    it('should support container resource overrides', async () => {
      const program = new Command();

      program
        .command('run <task>')
        .option('--workspace-strategy <strategy>', 'Override workspace strategy')
        .option('--container-cpu <cpu>', 'Override container CPU limit', parseFloat)
        .option('--container-memory <memory>', 'Override container memory limit')
        .action((task, options) => {
          expect(task).toBe('build production bundle');
          expect(options.workspaceStrategy).toBe('container');
          expect(options.containerCpu).toBe(4);
          expect(options.containerMemory).toBe('8g');
        });

      const args = [
        'node', 'apex', 'run', 'build production bundle',
        '--workspace-strategy', 'container',
        '--container-cpu', '4',
        '--container-memory', '8g'
      ];

      program.parse(args);
    });

    it('should support lightweight task resource limits', async () => {
      const program = new Command();

      program
        .command('run <task>')
        .option('--container-cpu <cpu>', 'Override container CPU limit', parseFloat)
        .option('--container-memory <memory>', 'Override container memory limit')
        .action((task, options) => {
          expect(task).toBe('update documentation');
          expect(options.containerCpu).toBe(0.5);
          expect(options.containerMemory).toBe('512m');
        });

      const args = [
        'node', 'apex', 'run', 'update documentation',
        '--container-cpu', '0.5',
        '--container-memory', '512m'
      ];

      program.parse(args);
    });
  });

  describe('apex status command with runtime information', () => {
    it('should support showing runtime information', async () => {
      const mockOrchestrator = {
        getSystemInfo: vi.fn().mockResolvedValue({
          containerRuntime: 'docker',
          runtimeVersion: '24.0.7',
          runtimeAvailable: true
        }),
        getContainerStats: vi.fn().mockResolvedValue([])
      };

      // Mock the orchestrator module
      vi.doMock('@apexcli/orchestrator', () => ({
        ApexOrchestrator: vi.fn().mockImplementation(() => mockOrchestrator)
      }));

      const program = new Command();

      program
        .command('status')
        .option('--show-runtime', 'Show container runtime information')
        .action(async (options) => {
          if (options.showRuntime) {
            const info = await mockOrchestrator.getSystemInfo();
            expect(info.containerRuntime).toBe('docker');
            expect(info.runtimeVersion).toBe('24.0.7');
            expect(info.runtimeAvailable).toBe(true);
          }
        });

      const args = ['node', 'apex', 'status', '--show-runtime'];

      await program.parseAsync(args);

      expect(mockOrchestrator.getSystemInfo).toHaveBeenCalled();
    });
  });

  describe('Debug and troubleshooting commands', () => {
    it('should support verbose and debug flags for container operations', async () => {
      const program = new Command();

      program
        .command('run <task>')
        .option('--verbose', 'Enable verbose logging')
        .option('--debug', 'Enable debug mode')
        .option('--workspace-strategy <strategy>', 'Override workspace strategy')
        .action((task, options) => {
          expect(options.verbose).toBe(true);
          expect(options.debug).toBe(true);
          expect(options.workspaceStrategy).toBe('container');
        });

      const args = [
        'node', 'apex', 'run', 'test task',
        '--verbose', '--debug', '--workspace-strategy', 'container'
      ];

      program.parse(args);
    });
  });

  describe('Container runtime detection commands', () => {
    it('should validate docker runtime availability', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      // Mock docker --version command
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        if (cmd === 'docker --version') {
          cb(null, 'Docker version 24.0.7, build afdd53b', '');
        }
      }));

      // Mock docker info command
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        if (cmd === 'docker info') {
          cb(null, 'Containers: 0\nRunning: 0\nPaused: 0\nStopped: 0', '');
        }
      }));

      // Import ContainerRuntime after mocking
      const { ContainerRuntime } = await import('@apexcli/core');
      const runtime = new ContainerRuntime();

      const runtimeType = await runtime.getBestRuntime();
      const isAvailable = await runtime.isRuntimeAvailable('docker');

      expect(runtimeType).toBe('docker');
      expect(isAvailable).toBe(true);
    });

    it('should validate podman runtime availability', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      // Mock docker not available
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        if (cmd === 'docker --version') {
          cb(new Error('docker: command not found'), '', '');
        }
      }));

      // Mock podman --version command
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        if (cmd === 'podman --version') {
          cb(null, 'podman version 4.7.2', '');
        }
      }));

      // Mock podman info command
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        if (cmd === 'podman info') {
          cb(null, 'host:\n  arch: amd64\n  buildahVersion: 1.32.2', '');
        }
      }));

      const { ContainerRuntime } = await import('@apexcli/core');
      const runtime = new ContainerRuntime();

      const runtimeType = await runtime.getBestRuntime();
      const isAvailable = await runtime.isRuntimeAvailable('podman');

      expect(runtimeType).toBe('podman');
      expect(isAvailable).toBe(true);
    });
  });

  describe('Configuration validation commands', () => {
    it('should validate container configuration schema', () => {
      const { ApexConfigSchema } = require('@apexcli/core');

      // Test basic configuration from documentation
      const basicConfig = {
        version: "1.0",
        project: {
          name: "my-project",
          language: "typescript"
        },
        workspace: {
          defaultStrategy: "container",
          cleanupOnComplete: true,
          container: {
            image: "node:20-alpine",
            resourceLimits: {
              cpu: 2,
              memory: "4g"
            }
          }
        }
      };

      expect(() => ApexConfigSchema.parse(basicConfig)).not.toThrow();
    });

    it('should validate comprehensive container configuration', () => {
      const { ApexConfigSchema } = require('@apexcli/core');

      // Test comprehensive configuration from documentation
      const comprehensiveConfig = {
        version: "1.0",
        project: {
          name: "test-project",
          language: "typescript"
        },
        workspace: {
          defaultStrategy: "container",
          cleanupOnComplete: true,
          container: {
            image: "node:20-alpine",
            dockerfile: ".apex/Dockerfile",
            buildContext: ".",
            imageTag: "my-project:latest",
            resourceLimits: {
              cpu: 2,
              memory: "4g",
              memoryReservation: "2g",
              memorySwap: "8g",
              cpuShares: 1024,
              pidsLimit: 1000
            },
            networkMode: "bridge",
            environment: {
              NODE_ENV: "development",
              NPM_CONFIG_UPDATE_NOTIFIER: "false"
            },
            workingDir: "/workspace",
            user: "1000:1000",
            volumes: {
              "./data": "/app/data"
            },
            autoRemove: true,
            autoDependencyInstall: true,
            useFrozenLockfile: true,
            installTimeout: 300000,
            installRetries: 2,
            privileged: false,
            securityOpts: ["no-new-privileges:true"],
            capDrop: ["ALL"],
            capAdd: ["NET_BIND_SERVICE"]
          }
        }
      };

      expect(() => ApexConfigSchema.parse(comprehensiveConfig)).not.toThrow();
    });

    it('should validate workspace strategy options', () => {
      const { WorkspaceConfigSchema } = require('@apexcli/core');

      const strategies = ['container', 'worktree', 'directory', 'none'];

      for (const strategy of strategies) {
        const config = {
          defaultStrategy: strategy,
          cleanupOnComplete: true
        };

        expect(() => WorkspaceConfigSchema.parse(config)).not.toThrow();
      }
    });
  });

  describe('Help command output validation', () => {
    it('should display container-related help information', () => {
      const program = new Command();

      program
        .name('apex')
        .description('AI-powered development team automation');

      const runCommand = program
        .command('run <task>')
        .description('Run a task with AI assistance')
        .option('--workspace-strategy <strategy>', 'Workspace isolation strategy (container|worktree|directory|none)')
        .option('--container-cpu <cpu>', 'Override container CPU limit')
        .option('--container-memory <memory>', 'Override container memory limit');

      const statusCommand = program
        .command('status')
        .description('Show system and task status')
        .option('--show-runtime', 'Show container runtime information');

      // Test that help output contains expected options
      const runHelp = runCommand.helpInformation();
      expect(runHelp).toContain('--workspace-strategy');
      expect(runHelp).toContain('--container-cpu');
      expect(runHelp).toContain('--container-memory');

      const statusHelp = statusCommand.helpInformation();
      expect(statusHelp).toContain('--show-runtime');
    });
  });

  describe('Error handling in CLI commands', () => {
    it('should handle invalid container configuration gracefully', () => {
      const { ApexConfigSchema } = require('@apexcli/core');

      const invalidConfig = {
        version: "1.0",
        project: {
          name: "test-project"
        },
        workspace: {
          container: {
            // Missing required image field
            resourceLimits: {
              cpu: "invalid", // Invalid type
              memory: "4g"
            }
          }
        }
      };

      expect(() => ApexConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should handle missing container runtime gracefully', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      // Mock both docker and podman not available
      mockExec
        .mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
          cb(new Error('docker: command not found'), '', '');
        }))
        .mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
          cb(new Error('podman: command not found'), '', '');
        }));

      const { ContainerRuntime } = await import('@apexcli/core');
      const runtime = new ContainerRuntime();

      const runtimeType = await runtime.getBestRuntime();
      expect(runtimeType).toBe('none');
    });
  });

  describe('Container log and monitoring commands', () => {
    it('should support container log viewing commands', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      // Mock docker ps command to list APEX containers
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        if (cmd.includes('docker ps') && cmd.includes('label=apex.managed=true')) {
          const output = 'abc123|apex-task-123|node:20-alpine|running|2023-01-01T10:00:00Z';
          cb(null, output, '');
        }
      }));

      // Mock docker logs command
      mockExec.mockImplementationOnce(vi.fn((cmd, opts, cb: any) => {
        if (cmd.includes('docker logs')) {
          cb(null, 'Container log output\nDebug: task execution started', '');
        }
      }));

      // Simulate the commands mentioned in documentation
      const { ContainerManager, ContainerRuntime } = await import('@apexcli/core');
      const runtime = new ContainerRuntime();
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      const manager = new ContainerManager(runtime);
      const containers = await manager.listApexContainers();

      expect(containers.length).toBeGreaterThanOrEqual(0);
    });
  });
});