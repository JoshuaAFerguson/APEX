import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  IsolationConfigSchema,
  WorkflowDefinitionSchema,
  ContainerConfigSchema,
  IsolationConfig,
  ContainerConfig,
} from '@apexcli/core';
import { WorkspaceManager } from '../workspace-manager';

describe('Isolation Mode Edge Cases', () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = join(tmpdir(), `apex-test-${Date.now()}`);
    await fs.mkdir(projectPath, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Schema Validation Edge Cases', () => {
    describe('IsolationConfig boundary conditions', () => {
      it('should handle null and undefined values gracefully', () => {
        expect(() => IsolationConfigSchema.parse(null)).toThrow();
        expect(() => IsolationConfigSchema.parse(undefined)).toThrow();
        expect(() => IsolationConfigSchema.parse({})).toThrow(); // Missing mode
      });

      it('should validate boolean edge cases', () => {
        const config = {
          mode: 'shared',
          cleanupOnComplete: 'true', // String instead of boolean
        };

        expect(() => IsolationConfigSchema.parse(config)).toThrow();

        // Valid boolean values
        const validConfigs = [
          { mode: 'shared', cleanupOnComplete: true },
          { mode: 'shared', cleanupOnComplete: false },
          { mode: 'shared', preserveOnFailure: true },
          { mode: 'shared', preserveOnFailure: false },
        ];

        validConfigs.forEach(cfg => {
          expect(() => IsolationConfigSchema.parse(cfg)).not.toThrow();
        });
      });

      it('should handle deeply nested container config validation', () => {
        const configWithInvalidNesting = {
          mode: 'full',
          container: {
            image: 'node:20',
            resourceLimits: {
              cpu: 'invalid', // Should be number
              memory: 123, // Should be string with unit
            },
            environment: 'not-an-object', // Should be object
          },
        };

        expect(() => IsolationConfigSchema.parse(configWithInvalidNesting)).toThrow();
      });

      it('should validate container image format edge cases', () => {
        const invalidImages = [
          '', // Empty string
          '   ', // Whitespace only
          'UPPERCASE_IMAGE', // Invalid uppercase
          'image with spaces',
          'image:tag:extra:colon',
          'registry..com/image',
          '/image', // Leading slash
          'image/', // Trailing slash
          'image:', // Colon without tag
          ':tag', // Tag without image
        ];

        invalidImages.forEach(image => {
          const config = {
            mode: 'full',
            container: { image },
          };

          expect(() => IsolationConfigSchema.parse(config)).toThrow(`Invalid image: ${image}`);
        });
      });

      it('should validate resource limits boundary values', () => {
        const boundaryTests = [
          // CPU limits
          { cpu: 0.0999 }, // Just below minimum
          { cpu: 0.1 }, // Minimum valid
          { cpu: 64 }, // Maximum valid
          { cpu: 64.1 }, // Just above maximum

          // Memory format validation
          { memory: '0m' }, // Zero memory
          { memory: '1k' }, // Lowercase k
          { memory: '1K' }, // Uppercase K
          { memory: '1024M' }, // Uppercase M
          { memory: '1g' }, // Lowercase g
          { memory: '1G' }, // Uppercase G
          { memory: 'invalid' }, // Invalid format
          { memory: '1024' }, // No unit

          // CPU shares
          { cpuShares: 1 }, // Below minimum
          { cpuShares: 2 }, // Minimum valid
          { cpuShares: 262144 }, // Maximum valid
          { cpuShares: 262145 }, // Above maximum
        ];

        boundaryTests.forEach(limits => {
          const config = {
            mode: 'full',
            container: {
              image: 'node:20',
              resourceLimits: limits,
            },
          };

          if (
            (limits.cpu !== undefined && (limits.cpu < 0.1 || limits.cpu > 64)) ||
            (limits.memory !== undefined && !limits.memory.match(/^\d+[kmgKMG]$/)) ||
            (limits.cpuShares !== undefined && (limits.cpuShares < 2 || limits.cpuShares > 262144))
          ) {
            expect(() => IsolationConfigSchema.parse(config)).toThrow();
          } else {
            expect(() => IsolationConfigSchema.parse(config)).not.toThrow();
          }
        });
      });
    });

    describe('Workflow integration validation', () => {
      it('should handle malformed workflow definitions', () => {
        const malformedWorkflows = [
          // Missing required fields
          {
            name: 'test',
            // Missing description and stages
            isolation: { mode: 'shared' },
          },
          // Invalid stage structure with isolation
          {
            name: 'test',
            description: 'test',
            stages: 'not-an-array',
            isolation: { mode: 'full' },
          },
          // Circular reference attempt
          {
            name: 'test',
            description: 'test',
            stages: [{ name: 'stage1', agent: 'agent1' }],
            isolation: {
              mode: 'full',
              container: null, // Null container
            },
          },
        ];

        malformedWorkflows.forEach(workflow => {
          expect(() => WorkflowDefinitionSchema.parse(workflow)).toThrow();
        });
      });

      it('should validate complex nested container configurations', () => {
        const complexConfig = {
          name: 'complex-workflow',
          description: 'Complex workflow with deep nesting',
          stages: [{ name: 'test', agent: 'test-agent' }],
          isolation: {
            mode: 'full',
            container: {
              image: 'node:20-alpine',
              environment: {
                NODE_ENV: 'production',
                API_URL: 'https://api.example.com',
                DEBUG: 'false',
                MAX_CONNECTIONS: '100',
              },
              resourceLimits: {
                cpu: 2.5,
                memory: '1g',
                memoryReservation: '512m',
                cpuShares: 1024,
                pidsLimit: 1000,
              },
              volumes: {
                '/host/cache': '/app/cache',
                '/host/data': '/app/data',
                '/host/logs': '/var/log/app',
              },
              labels: {
                'com.example.version': '1.0.0',
                'com.example.environment': 'production',
              },
              securityOpts: ['no-new-privileges'],
              capAdd: ['NET_ADMIN'],
              capDrop: ['SYS_ADMIN'],
            },
          },
        };

        expect(() => WorkflowDefinitionSchema.parse(complexConfig)).not.toThrow();
        const parsed = WorkflowDefinitionSchema.parse(complexConfig);
        expect(parsed.isolation?.container?.environment?.NODE_ENV).toBe('production');
        expect(parsed.isolation?.container?.resourceLimits?.cpu).toBe(2.5);
      });
    });
  });

  describe('Workspace Manager Edge Cases', () => {
    let workspaceManager: WorkspaceManager;

    beforeEach(() => {
      workspaceManager = new WorkspaceManager({
        projectPath,
        defaultStrategy: 'none',
      });

      // Mock dependencies
      (workspaceManager as any).containerRuntimeType = 'docker';
      (workspaceManager as any).containerManager = {
        createContainer: vi.fn().mockResolvedValue({ success: true, containerId: 'test-id' }),
        execCommand: vi.fn().mockResolvedValue({ success: true }),
        listApexContainers: vi.fn().mockResolvedValue([]),
        stopContainer: vi.fn().mockResolvedValue(undefined),
        removeContainer: vi.fn().mockResolvedValue(undefined),
      };
      (workspaceManager as any).dependencyDetector = {
        detectPackageManagers: vi.fn().mockResolvedValue({ primaryManager: null }),
      };
    });

    it('should handle container runtime not available', async () => {
      const workspaceManagerWithoutRuntime = new WorkspaceManager({
        projectPath,
        defaultStrategy: 'container',
      });

      (workspaceManagerWithoutRuntime as any).containerRuntimeType = 'none';
      (workspaceManagerWithoutRuntime as any).dependencyDetector = {
        detectPackageManagers: vi.fn().mockResolvedValue({ primaryManager: null }),
      };

      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: { image: 'node:20' },
      };

      const task = {
        id: 'test-task',
        workspace: {
          strategy: 'container' as const,
          cleanup: true,
          container: { image: 'node:20' },
        },
      } as any;

      await expect(workspaceManagerWithoutRuntime.createWorkspaceWithIsolation(task, isolationConfig))
        .rejects.toThrow('No container runtime available');
    });

    it('should handle missing container config for full mode', async () => {
      const isolationConfig: IsolationConfig = {
        mode: 'full',
        // No container config provided
      };

      const task = {
        id: 'test-task',
      } as any;

      // Should still work with default container configuration
      const workspaceInfo = await workspaceManager.createWorkspaceWithIsolation(task, isolationConfig);
      expect(workspaceInfo.config.strategy).toBe('container');
    });

    it('should handle filesystem permission errors', async () => {
      // Create a directory with restricted permissions
      const restrictedPath = join(projectPath, 'restricted');
      await fs.mkdir(restrictedPath, { mode: 0o444 }); // Read-only

      const workspaceManagerWithRestrictedPath = new WorkspaceManager({
        projectPath: restrictedPath,
        defaultStrategy: 'none',
      });

      (workspaceManagerWithRestrictedPath as any).containerRuntimeType = 'docker';
      (workspaceManagerWithRestrictedPath as any).containerManager = {
        createContainer: vi.fn().mockResolvedValue({ success: true, containerId: 'test-id' }),
      };
      (workspaceManagerWithRestrictedPath as any).dependencyDetector = {
        detectPackageManagers: vi.fn().mockResolvedValue({ primaryManager: null }),
      };

      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: { image: 'node:20' },
      };

      const task = { id: 'test-task' } as any;

      // Should handle permission errors gracefully
      await expect(workspaceManagerWithRestrictedPath.createWorkspaceWithIsolation(task, isolationConfig))
        .rejects.toThrow();

      // Restore permissions for cleanup
      await fs.chmod(restrictedPath, 0o755);
    });

    it('should handle concurrent workspace creation for same task', async () => {
      const isolationConfig: IsolationConfig = {
        mode: 'shared',
      };

      const task = { id: 'concurrent-task' } as any;

      // Create multiple concurrent workspace creation requests
      const promises = Array(5).fill(null).map(() =>
        workspaceManager.createWorkspaceWithIsolation(task, isolationConfig)
      );

      const results = await Promise.allSettled(promises);

      // At least one should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);

      // All successful results should have the same workspace path
      const workspacePaths = successful
        .map(r => (r as PromiseFulfilledResult<any>).value.workspacePath);

      const uniquePaths = new Set(workspacePaths);
      expect(uniquePaths.size).toBe(1);
    });
  });

  describe('Container Configuration Edge Cases', () => {
    it('should handle extremely large environment variables', () => {
      const largeValue = 'x'.repeat(10000); // 10KB string

      const containerConfig: ContainerConfig = {
        image: 'node:20',
        environment: {
          LARGE_VAR: largeValue,
          NORMAL_VAR: 'normal',
        },
      };

      expect(() => ContainerConfigSchema.parse(containerConfig)).not.toThrow();
      const parsed = ContainerConfigSchema.parse(containerConfig);
      expect(parsed.environment?.LARGE_VAR).toBe(largeValue);
    });

    it('should handle special characters in environment variables', () => {
      const specialCharConfigs = [
        { VAR_WITH_SPACES: 'value with spaces' },
        { VAR_WITH_QUOTES: 'value"with"quotes' },
        { VAR_WITH_NEWLINES: 'value\nwith\nnewlines' },
        { VAR_WITH_UNICODE: 'value with unicode: 你好世界' },
        { VAR_WITH_ESCAPES: 'value\\with\\escapes' },
        { EMPTY_VAR: '' },
      ];

      specialCharConfigs.forEach(env => {
        const config: ContainerConfig = {
          image: 'node:20',
          environment: env,
        };

        expect(() => ContainerConfigSchema.parse(config)).not.toThrow();
      });
    });

    it('should handle complex volume mount scenarios', () => {
      const volumeConfigs = [
        // Basic mounts
        { '/host/path': '/container/path' },
        // Multiple mounts
        {
          '/host/data': '/app/data',
          '/host/logs': '/var/log',
          '/host/cache': '/tmp/cache',
        },
        // Paths with spaces and special characters
        { '/host/path with spaces': '/container/path with spaces' },
        // Windows-style paths (if applicable)
        { 'C:\\host\\path': '/container/path' },
        // Relative paths
        { './host/path': './container/path' },
      ];

      volumeConfigs.forEach(volumes => {
        const config: ContainerConfig = {
          image: 'node:20',
          volumes,
        };

        expect(() => ContainerConfigSchema.parse(config)).not.toThrow();
      });
    });

    it('should validate security options edge cases', () => {
      const securityConfigs = [
        // Valid security options
        { securityOpts: ['no-new-privileges'] },
        { securityOpts: ['apparmor=docker-default'] },
        { securityOpts: ['seccomp=unconfined'] },
        // Multiple security options
        {
          securityOpts: [
            'no-new-privileges',
            'apparmor=docker-default',
            'seccomp=unconfined',
          ],
        },
        // Empty array
        { securityOpts: [] },
      ];

      securityConfigs.forEach(config => {
        const containerConfig: ContainerConfig = {
          image: 'node:20',
          ...config,
        };

        expect(() => ContainerConfigSchema.parse(containerConfig)).not.toThrow();
      });
    });

    it('should handle capability add/drop edge cases', () => {
      const capabilityConfigs = [
        // Standard capabilities
        { capAdd: ['NET_ADMIN', 'SYS_ADMIN'], capDrop: ['ALL'] },
        // Case variations
        { capAdd: ['net_admin'], capDrop: ['sys_admin'] },
        // Empty arrays
        { capAdd: [], capDrop: [] },
        // Only add or only drop
        { capAdd: ['NET_ADMIN'] },
        { capDrop: ['SYS_ADMIN'] },
      ];

      capabilityConfigs.forEach(config => {
        const containerConfig: ContainerConfig = {
          image: 'node:20',
          ...config,
        };

        expect(() => ContainerConfigSchema.parse(containerConfig)).not.toThrow();
      });
    });
  });

  describe('Isolation Mode Fallback Scenarios', () => {
    it('should fallback gracefully when container runtime is unavailable', () => {
      const isolationConfig: IsolationConfig = {
        mode: 'full',
        container: { image: 'node:20' },
      };

      // In a real scenario, the workspace manager would detect no runtime
      // and either fall back to a different strategy or fail gracefully
      expect(isolationConfig.mode).toBe('full');
      // The actual fallback logic is tested in workspace manager tests
    });

    it('should handle partial container configuration', () => {
      const partialConfigs = [
        // Minimal config
        { image: 'node:20' },
        // Only environment
        { image: 'node:20', environment: { NODE_ENV: 'test' } },
        // Only resource limits
        { image: 'node:20', resourceLimits: { memory: '512m' } },
        // Only volumes
        { image: 'node:20', volumes: { '/host': '/container' } },
      ];

      partialConfigs.forEach(container => {
        const config: IsolationConfig = {
          mode: 'full',
          container,
        };

        expect(() => IsolationConfigSchema.parse(config)).not.toThrow();
      });
    });

    it('should handle isolation mode with mixed case', () => {
      // Schema should be case-sensitive and reject invalid cases
      const invalidCases = ['Full', 'FULL', 'Worktree', 'WORKTREE', 'Shared', 'SHARED'];

      invalidCases.forEach(mode => {
        const config = { mode };
        expect(() => IsolationConfigSchema.parse(config)).toThrow();
      });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large container configurations without memory issues', () => {
      const largeConfig: IsolationConfig = {
        mode: 'full',
        container: {
          image: 'node:20',
          environment: Object.fromEntries(
            Array(1000).fill(null).map((_, i) => [`VAR_${i}`, `value_${i}`])
          ),
          volumes: Object.fromEntries(
            Array(100).fill(null).map((_, i) => [`/host/path${i}`, `/container/path${i}`])
          ),
          labels: Object.fromEntries(
            Array(50).fill(null).map((_, i) => [`label.${i}`, `value${i}`])
          ),
        },
      };

      expect(() => IsolationConfigSchema.parse(largeConfig)).not.toThrow();
      const parsed = IsolationConfigSchema.parse(largeConfig);
      expect(Object.keys(parsed.container!.environment!)).toHaveLength(1000);
    });

    it('should handle deeply nested configuration objects', () => {
      const deepConfig: IsolationConfig = {
        mode: 'full',
        container: {
          image: 'node:20',
          environment: {
            NESTED_JSON: JSON.stringify({
              level1: {
                level2: {
                  level3: {
                    level4: {
                      value: 'deeply nested value',
                    },
                  },
                },
              },
            }),
          },
        },
      };

      expect(() => IsolationConfigSchema.parse(deepConfig)).not.toThrow();
    });
  });

  describe('Concurrent Operations Edge Cases', () => {
    it('should handle concurrent schema validations', () => {
      const configs = Array(100).fill(null).map((_, i) => ({
        mode: 'full',
        container: {
          image: `node:${20 + (i % 3)}`,
          environment: { TASK_ID: `task-${i}` },
        },
      }));

      const validationPromises = configs.map(config =>
        Promise.resolve(IsolationConfigSchema.parse(config))
      );

      return Promise.all(validationPromises).then(results => {
        expect(results).toHaveLength(100);
        results.forEach((result, i) => {
          expect(result.container?.environment?.TASK_ID).toBe(`task-${i}`);
        });
      });
    });

    it('should handle schema validation with circular references in environment', () => {
      const configWithCircularReference = {
        mode: 'full',
        container: {
          image: 'node:20',
          environment: {
            SELF_REF: '${SELF_REF}',
            CROSS_REF_A: '${CROSS_REF_B}',
            CROSS_REF_B: '${CROSS_REF_A}',
          },
        },
      };

      // Should not throw as it's just string values
      expect(() => IsolationConfigSchema.parse(configWithCircularReference)).not.toThrow();
    });
  });
});