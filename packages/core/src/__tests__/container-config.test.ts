import { describe, it, expect } from 'vitest';
import {
  ResourceLimitsSchema,
  ResourceLimits,
  ContainerNetworkModeSchema,
  ContainerNetworkMode,
  ContainerConfigSchema,
  ContainerConfig,
  ContainerStatusSchema,
  ContainerStatus,
  ContainerInfo,
  ContainerStats,
  WorkspaceStrategySchema,
  WorkspaceStrategy,
  WorkspaceConfigSchema,
  WorkspaceConfig,
} from '../types';

// ============================================================================
// ResourceLimitsSchema Tests
// ============================================================================

describe('ResourceLimitsSchema', () => {
  describe('cpu field validation', () => {
    it('should accept valid CPU values', () => {
      const validCpuValues = [0.1, 0.5, 1, 2, 4, 8, 16, 32, 64];

      for (const cpu of validCpuValues) {
        const result = ResourceLimitsSchema.parse({ cpu });
        expect(result.cpu).toBe(cpu);
      }
    });

    it('should reject CPU values below minimum', () => {
      expect(() => ResourceLimitsSchema.parse({ cpu: 0 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: 0.05 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: -1 })).toThrow();
    });

    it('should reject CPU values above maximum', () => {
      expect(() => ResourceLimitsSchema.parse({ cpu: 65 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: 100 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: 128 })).toThrow();
    });

    it('should accept fractional CPU values', () => {
      const result = ResourceLimitsSchema.parse({ cpu: 0.25 });
      expect(result.cpu).toBe(0.25);
    });
  });

  describe('memory field validation', () => {
    it('should accept valid memory values', () => {
      const validMemoryValues = ['256m', '512M', '1g', '2G', '4096m', '1024'];

      for (const memory of validMemoryValues) {
        const result = ResourceLimitsSchema.parse({ memory });
        expect(result.memory).toBe(memory);
      }
    });

    it('should accept memory values with different units', () => {
      const memoryWithUnits = [
        { input: '1024k', expected: '1024k' },
        { input: '512K', expected: '512K' },
        { input: '256m', expected: '256m' },
        { input: '256M', expected: '256M' },
        { input: '1g', expected: '1g' },
        { input: '1G', expected: '1G' },
      ];

      for (const { input, expected } of memoryWithUnits) {
        const result = ResourceLimitsSchema.parse({ memory: input });
        expect(result.memory).toBe(expected);
      }
    });

    it('should reject invalid memory values', () => {
      expect(() => ResourceLimitsSchema.parse({ memory: 'invalid' })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ memory: '256mb' })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ memory: '1gb' })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ memory: '' })).toThrow();
    });
  });

  describe('memoryReservation field validation', () => {
    it('should accept valid memory reservation values', () => {
      const result = ResourceLimitsSchema.parse({ memoryReservation: '128m' });
      expect(result.memoryReservation).toBe('128m');
    });

    it('should be optional', () => {
      const result = ResourceLimitsSchema.parse({});
      expect(result.memoryReservation).toBeUndefined();
    });
  });

  describe('memorySwap field validation', () => {
    it('should accept valid memory swap values', () => {
      const result = ResourceLimitsSchema.parse({ memorySwap: '2g' });
      expect(result.memorySwap).toBe('2g');
    });

    it('should be optional', () => {
      const result = ResourceLimitsSchema.parse({});
      expect(result.memorySwap).toBeUndefined();
    });
  });

  describe('cpuShares field validation', () => {
    it('should accept valid CPU shares values', () => {
      const validShares = [2, 512, 1024, 2048, 4096, 262144];

      for (const cpuShares of validShares) {
        const result = ResourceLimitsSchema.parse({ cpuShares });
        expect(result.cpuShares).toBe(cpuShares);
      }
    });

    it('should reject CPU shares below minimum', () => {
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 1 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 0 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpuShares: -1 })).toThrow();
    });

    it('should reject CPU shares above maximum', () => {
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 262145 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 500000 })).toThrow();
    });
  });

  describe('pidsLimit field validation', () => {
    it('should accept valid PIDs limit values', () => {
      const validPidsLimits = [1, 10, 100, 1000, 10000];

      for (const pidsLimit of validPidsLimits) {
        const result = ResourceLimitsSchema.parse({ pidsLimit });
        expect(result.pidsLimit).toBe(pidsLimit);
      }
    });

    it('should reject PIDs limit below minimum', () => {
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 0 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: -1 })).toThrow();
    });
  });

  describe('empty and combined configurations', () => {
    it('should accept empty configuration', () => {
      const result = ResourceLimitsSchema.parse({});
      expect(result).toEqual({});
    });

    it('should accept full configuration', () => {
      const fullConfig = {
        cpu: 2,
        memory: '1g',
        memoryReservation: '512m',
        memorySwap: '2g',
        cpuShares: 1024,
        pidsLimit: 100,
      };

      const result = ResourceLimitsSchema.parse(fullConfig);
      expect(result).toEqual(fullConfig);
    });

    it('should accept partial configuration', () => {
      const partialConfig = {
        cpu: 1,
        memory: '512m',
      };

      const result = ResourceLimitsSchema.parse(partialConfig);
      expect(result.cpu).toBe(1);
      expect(result.memory).toBe('512m');
      expect(result.memoryReservation).toBeUndefined();
      expect(result.cpuShares).toBeUndefined();
    });
  });
});

// ============================================================================
// ContainerNetworkModeSchema Tests
// ============================================================================

describe('ContainerNetworkModeSchema', () => {
  it('should accept all valid network modes', () => {
    const validModes: ContainerNetworkMode[] = ['bridge', 'host', 'none', 'container'];

    for (const mode of validModes) {
      const result = ContainerNetworkModeSchema.parse(mode);
      expect(result).toBe(mode);
    }
  });

  it('should reject invalid network modes', () => {
    expect(() => ContainerNetworkModeSchema.parse('invalid')).toThrow();
    expect(() => ContainerNetworkModeSchema.parse('overlay')).toThrow();
    expect(() => ContainerNetworkModeSchema.parse('')).toThrow();
    expect(() => ContainerNetworkModeSchema.parse(123)).toThrow();
  });

  it('should be case-sensitive', () => {
    expect(() => ContainerNetworkModeSchema.parse('Bridge')).toThrow();
    expect(() => ContainerNetworkModeSchema.parse('HOST')).toThrow();
    expect(() => ContainerNetworkModeSchema.parse('None')).toThrow();
  });
});

// ============================================================================
// ContainerConfigSchema Tests
// ============================================================================

describe('ContainerConfigSchema', () => {
  describe('image field validation', () => {
    it('should accept valid image names', () => {
      const validImages = [
        'node:20-alpine',
        'python:3.11-slim',
        'ubuntu:22.04',
        'registry.example.com/myapp:v1.0.0',
        'ghcr.io/owner/repo:latest',
        'nginx',
        'localhost:5000/my-image:tag',
      ];

      for (const image of validImages) {
        const result = ContainerConfigSchema.parse({ image });
        expect(result.image).toBe(image);
      }
    });

    it('should reject empty image name', () => {
      expect(() => ContainerConfigSchema.parse({ image: '' })).toThrow();
    });

    it('should require image field', () => {
      expect(() => ContainerConfigSchema.parse({})).toThrow();
    });
  });

  describe('volumes field validation', () => {
    it('should accept valid volume mappings', () => {
      const volumes = {
        '/host/path': '/container/path',
        '/data': '/app/data',
        '/home/user/project': '/workspace',
      };

      const result = ContainerConfigSchema.parse({ image: 'node:20', volumes });
      expect(result.volumes).toEqual(volumes);
    });

    it('should accept empty volumes object', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20', volumes: {} });
      expect(result.volumes).toEqual({});
    });

    it('should be optional', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(result.volumes).toBeUndefined();
    });
  });

  describe('environment field validation', () => {
    it('should accept valid environment variables', () => {
      const environment = {
        NODE_ENV: 'production',
        API_KEY: 'secret-key-123',
        DEBUG: 'true',
      };

      const result = ContainerConfigSchema.parse({ image: 'node:20', environment });
      expect(result.environment).toEqual(environment);
    });

    it('should accept empty environment object', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20', environment: {} });
      expect(result.environment).toEqual({});
    });

    it('should be optional', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(result.environment).toBeUndefined();
    });
  });

  describe('resourceLimits field validation', () => {
    it('should accept valid resource limits', () => {
      const resourceLimits = {
        cpu: 2,
        memory: '1g',
        cpuShares: 1024,
      };

      const result = ContainerConfigSchema.parse({ image: 'node:20', resourceLimits });
      expect(result.resourceLimits).toEqual(resourceLimits);
    });

    it('should validate nested resource limits schema', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        resourceLimits: { cpu: -1 },
      })).toThrow();
    });

    it('should be optional', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(result.resourceLimits).toBeUndefined();
    });
  });

  describe('networkMode field validation', () => {
    it('should accept valid network modes', () => {
      const modes: ContainerNetworkMode[] = ['bridge', 'host', 'none', 'container'];

      for (const networkMode of modes) {
        const result = ContainerConfigSchema.parse({ image: 'node:20', networkMode });
        expect(result.networkMode).toBe(networkMode);
      }
    });

    it('should default to bridge mode', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(result.networkMode).toBe('bridge');
    });

    it('should reject invalid network modes', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        networkMode: 'invalid',
      })).toThrow();
    });
  });

  describe('workingDir field validation', () => {
    it('should accept valid working directory paths', () => {
      const workingDir = '/app';
      const result = ContainerConfigSchema.parse({ image: 'node:20', workingDir });
      expect(result.workingDir).toBe(workingDir);
    });

    it('should be optional', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(result.workingDir).toBeUndefined();
    });
  });

  describe('user field validation', () => {
    it('should accept valid user specifications', () => {
      const userSpecs = ['1000:1000', 'node', 'root', '0:0', 'nobody'];

      for (const user of userSpecs) {
        const result = ContainerConfigSchema.parse({ image: 'node:20', user });
        expect(result.user).toBe(user);
      }
    });

    it('should be optional', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(result.user).toBeUndefined();
    });
  });

  describe('labels field validation', () => {
    it('should accept valid labels', () => {
      const labels = {
        'com.example.app': 'myapp',
        'version': '1.0.0',
        'maintainer': 'team@example.com',
      };

      const result = ContainerConfigSchema.parse({ image: 'node:20', labels });
      expect(result.labels).toEqual(labels);
    });

    it('should be optional', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(result.labels).toBeUndefined();
    });
  });

  describe('entrypoint field validation', () => {
    it('should accept valid entrypoint arrays', () => {
      const entrypoint = ['/bin/sh', '-c'];
      const result = ContainerConfigSchema.parse({ image: 'node:20', entrypoint });
      expect(result.entrypoint).toEqual(entrypoint);
    });

    it('should accept single-element entrypoint', () => {
      const entrypoint = ['/app/start.sh'];
      const result = ContainerConfigSchema.parse({ image: 'node:20', entrypoint });
      expect(result.entrypoint).toEqual(entrypoint);
    });

    it('should be optional', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(result.entrypoint).toBeUndefined();
    });
  });

  describe('command field validation', () => {
    it('should accept valid command arrays', () => {
      const command = ['npm', 'start'];
      const result = ContainerConfigSchema.parse({ image: 'node:20', command });
      expect(result.command).toEqual(command);
    });

    it('should accept complex command arrays', () => {
      const command = ['sh', '-c', 'npm install && npm start'];
      const result = ContainerConfigSchema.parse({ image: 'node:20', command });
      expect(result.command).toEqual(command);
    });

    it('should be optional', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(result.command).toBeUndefined();
    });
  });

  describe('autoRemove field validation', () => {
    it('should accept boolean values', () => {
      const resultTrue = ContainerConfigSchema.parse({ image: 'node:20', autoRemove: true });
      expect(resultTrue.autoRemove).toBe(true);

      const resultFalse = ContainerConfigSchema.parse({ image: 'node:20', autoRemove: false });
      expect(resultFalse.autoRemove).toBe(false);
    });

    it('should default to true', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(result.autoRemove).toBe(true);
    });
  });

  describe('privileged field validation', () => {
    it('should accept boolean values', () => {
      const resultTrue = ContainerConfigSchema.parse({ image: 'node:20', privileged: true });
      expect(resultTrue.privileged).toBe(true);

      const resultFalse = ContainerConfigSchema.parse({ image: 'node:20', privileged: false });
      expect(resultFalse.privileged).toBe(false);
    });

    it('should default to false', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(result.privileged).toBe(false);
    });
  });

  describe('securityOpts field validation', () => {
    it('should accept valid security options', () => {
      const securityOpts = ['no-new-privileges:true', 'seccomp:unconfined'];
      const result = ContainerConfigSchema.parse({ image: 'node:20', securityOpts });
      expect(result.securityOpts).toEqual(securityOpts);
    });

    it('should be optional', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(result.securityOpts).toBeUndefined();
    });
  });

  describe('capAdd field validation', () => {
    it('should accept valid capabilities to add', () => {
      const capAdd = ['SYS_ADMIN', 'NET_ADMIN'];
      const result = ContainerConfigSchema.parse({ image: 'node:20', capAdd });
      expect(result.capAdd).toEqual(capAdd);
    });

    it('should be optional', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(result.capAdd).toBeUndefined();
    });
  });

  describe('capDrop field validation', () => {
    it('should accept valid capabilities to drop', () => {
      const capDrop = ['ALL', 'CHOWN'];
      const result = ContainerConfigSchema.parse({ image: 'node:20', capDrop });
      expect(result.capDrop).toEqual(capDrop);
    });

    it('should be optional', () => {
      const result = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(result.capDrop).toBeUndefined();
    });
  });

  describe('full configuration scenarios', () => {
    it('should accept minimal valid configuration', () => {
      const config = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(config.image).toBe('node:20');
      expect(config.networkMode).toBe('bridge');
      expect(config.autoRemove).toBe(true);
      expect(config.privileged).toBe(false);
    });

    it('should accept full configuration', () => {
      const fullConfig = {
        image: 'node:20-alpine',
        volumes: { '/host/path': '/container/path' },
        environment: { NODE_ENV: 'production' },
        resourceLimits: { cpu: 2, memory: '1g' },
        networkMode: 'host' as const,
        workingDir: '/app',
        user: '1000:1000',
        labels: { app: 'myapp' },
        entrypoint: ['/bin/sh'],
        command: ['-c', 'npm start'],
        autoRemove: false,
        privileged: false,
        securityOpts: ['no-new-privileges:true'],
        capAdd: ['SYS_ADMIN'],
        capDrop: ['ALL'],
      };

      const result = ContainerConfigSchema.parse(fullConfig);
      expect(result).toEqual(fullConfig);
    });

    it('should handle typical development configuration', () => {
      const devConfig = {
        image: 'node:20',
        volumes: {
          '/home/user/project': '/app',
          '/home/user/.npm': '/root/.npm',
        },
        environment: {
          NODE_ENV: 'development',
          DEBUG: '*',
        },
        resourceLimits: {
          cpu: 4,
          memory: '4g',
        },
        workingDir: '/app',
      };

      const result = ContainerConfigSchema.parse(devConfig);
      expect(result.image).toBe('node:20');
      expect(result.volumes).toEqual(devConfig.volumes);
      expect(result.resourceLimits?.cpu).toBe(4);
      expect(result.resourceLimits?.memory).toBe('4g');
    });

    it('should handle production configuration with security options', () => {
      const prodConfig = {
        image: 'ghcr.io/company/app:v1.0.0',
        environment: {
          NODE_ENV: 'production',
        },
        resourceLimits: {
          cpu: 2,
          memory: '2g',
          pidsLimit: 100,
        },
        networkMode: 'bridge' as const,
        user: 'node',
        autoRemove: true,
        privileged: false,
        capDrop: ['ALL'],
        securityOpts: ['no-new-privileges:true'],
      };

      const result = ContainerConfigSchema.parse(prodConfig);
      expect(result.privileged).toBe(false);
      expect(result.capDrop).toEqual(['ALL']);
      expect(result.securityOpts).toEqual(['no-new-privileges:true']);
    });
  });
});

// ============================================================================
// ContainerStatusSchema Tests
// ============================================================================

describe('ContainerStatusSchema', () => {
  it('should accept all valid container statuses', () => {
    const validStatuses: ContainerStatus[] = [
      'created',
      'running',
      'paused',
      'restarting',
      'removing',
      'exited',
      'dead',
    ];

    for (const status of validStatuses) {
      const result = ContainerStatusSchema.parse(status);
      expect(result).toBe(status);
    }
  });

  it('should reject invalid statuses', () => {
    expect(() => ContainerStatusSchema.parse('invalid')).toThrow();
    expect(() => ContainerStatusSchema.parse('started')).toThrow();
    expect(() => ContainerStatusSchema.parse('stopped')).toThrow();
    expect(() => ContainerStatusSchema.parse('')).toThrow();
    expect(() => ContainerStatusSchema.parse(123)).toThrow();
  });

  it('should be case-sensitive', () => {
    expect(() => ContainerStatusSchema.parse('Running')).toThrow();
    expect(() => ContainerStatusSchema.parse('EXITED')).toThrow();
    expect(() => ContainerStatusSchema.parse('Paused')).toThrow();
  });
});

// ============================================================================
// ContainerInfo Interface Tests
// ============================================================================

describe('ContainerInfo Interface', () => {
  it('should create valid ContainerInfo with required fields', () => {
    const containerInfo: ContainerInfo = {
      id: 'abc123def456',
      name: 'apex-task-123',
      image: 'node:20-alpine',
      status: 'running',
      createdAt: new Date('2024-01-15T10:00:00Z'),
    };

    expect(containerInfo.id).toBe('abc123def456');
    expect(containerInfo.name).toBe('apex-task-123');
    expect(containerInfo.image).toBe('node:20-alpine');
    expect(containerInfo.status).toBe('running');
    expect(containerInfo.createdAt).toBeInstanceOf(Date);
  });

  it('should create valid ContainerInfo with all fields', () => {
    const containerInfo: ContainerInfo = {
      id: 'abc123def456',
      name: 'apex-task-123',
      image: 'node:20-alpine',
      status: 'exited',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      startedAt: new Date('2024-01-15T10:00:05Z'),
      finishedAt: new Date('2024-01-15T10:30:00Z'),
      exitCode: 0,
      taskId: 'task-abc-123',
      stats: {
        cpuPercent: 25.5,
        memoryUsage: 256 * 1024 * 1024,
        memoryLimit: 1024 * 1024 * 1024,
        memoryPercent: 25.0,
        networkRxBytes: 1024 * 1024,
        networkTxBytes: 512 * 1024,
        blockReadBytes: 2048 * 1024,
        blockWriteBytes: 1024 * 1024,
        pids: 15,
      },
    };

    expect(containerInfo.startedAt).toBeInstanceOf(Date);
    expect(containerInfo.finishedAt).toBeInstanceOf(Date);
    expect(containerInfo.exitCode).toBe(0);
    expect(containerInfo.taskId).toBe('task-abc-123');
    expect(containerInfo.stats?.cpuPercent).toBe(25.5);
    expect(containerInfo.stats?.memoryUsage).toBe(256 * 1024 * 1024);
    expect(containerInfo.stats?.pids).toBe(15);
  });

  it('should handle running container state', () => {
    const runningContainer: ContainerInfo = {
      id: 'container-id-running',
      name: 'running-container',
      image: 'python:3.11',
      status: 'running',
      createdAt: new Date('2024-01-15T09:00:00Z'),
      startedAt: new Date('2024-01-15T09:00:05Z'),
      taskId: 'task-python-001',
    };

    expect(runningContainer.status).toBe('running');
    expect(runningContainer.startedAt).toBeDefined();
    expect(runningContainer.finishedAt).toBeUndefined();
    expect(runningContainer.exitCode).toBeUndefined();
  });

  it('should handle exited container with error', () => {
    const failedContainer: ContainerInfo = {
      id: 'container-id-failed',
      name: 'failed-container',
      image: 'node:20',
      status: 'exited',
      createdAt: new Date('2024-01-15T08:00:00Z'),
      startedAt: new Date('2024-01-15T08:00:02Z'),
      finishedAt: new Date('2024-01-15T08:05:00Z'),
      exitCode: 1,
      taskId: 'task-failed-001',
    };

    expect(failedContainer.status).toBe('exited');
    expect(failedContainer.exitCode).toBe(1);
    expect(failedContainer.finishedAt).toBeDefined();
  });
});

// ============================================================================
// ContainerStats Interface Tests
// ============================================================================

describe('ContainerStats Interface', () => {
  it('should create valid ContainerStats with all fields', () => {
    const stats: ContainerStats = {
      cpuPercent: 45.5,
      memoryUsage: 512 * 1024 * 1024, // 512MB
      memoryLimit: 2 * 1024 * 1024 * 1024, // 2GB
      memoryPercent: 25.0,
      networkRxBytes: 10 * 1024 * 1024, // 10MB
      networkTxBytes: 5 * 1024 * 1024, // 5MB
      blockReadBytes: 100 * 1024 * 1024, // 100MB
      blockWriteBytes: 50 * 1024 * 1024, // 50MB
      pids: 42,
    };

    expect(stats.cpuPercent).toBe(45.5);
    expect(stats.memoryUsage).toBe(512 * 1024 * 1024);
    expect(stats.memoryLimit).toBe(2 * 1024 * 1024 * 1024);
    expect(stats.memoryPercent).toBe(25.0);
    expect(stats.networkRxBytes).toBe(10 * 1024 * 1024);
    expect(stats.networkTxBytes).toBe(5 * 1024 * 1024);
    expect(stats.blockReadBytes).toBe(100 * 1024 * 1024);
    expect(stats.blockWriteBytes).toBe(50 * 1024 * 1024);
    expect(stats.pids).toBe(42);
  });

  it('should handle idle container stats', () => {
    const idleStats: ContainerStats = {
      cpuPercent: 0.1,
      memoryUsage: 32 * 1024 * 1024, // 32MB
      memoryLimit: 1024 * 1024 * 1024, // 1GB
      memoryPercent: 3.125,
      networkRxBytes: 0,
      networkTxBytes: 0,
      blockReadBytes: 0,
      blockWriteBytes: 0,
      pids: 1,
    };

    expect(idleStats.cpuPercent).toBeLessThan(1);
    expect(idleStats.pids).toBe(1);
    expect(idleStats.networkRxBytes).toBe(0);
  });

  it('should handle high-load container stats', () => {
    const highLoadStats: ContainerStats = {
      cpuPercent: 95.5,
      memoryUsage: 3.8 * 1024 * 1024 * 1024, // 3.8GB
      memoryLimit: 4 * 1024 * 1024 * 1024, // 4GB
      memoryPercent: 95.0,
      networkRxBytes: 500 * 1024 * 1024, // 500MB
      networkTxBytes: 200 * 1024 * 1024, // 200MB
      blockReadBytes: 2 * 1024 * 1024 * 1024, // 2GB
      blockWriteBytes: 1 * 1024 * 1024 * 1024, // 1GB
      pids: 500,
    };

    expect(highLoadStats.cpuPercent).toBeGreaterThan(90);
    expect(highLoadStats.memoryPercent).toBeGreaterThan(90);
    expect(highLoadStats.pids).toBe(500);
  });
});

// ============================================================================
// WorkspaceStrategySchema Tests
// ============================================================================

describe('WorkspaceStrategySchema', () => {
  it('should accept all valid workspace strategies', () => {
    const validStrategies: WorkspaceStrategy[] = ['worktree', 'container', 'directory', 'none'];

    for (const strategy of validStrategies) {
      const result = WorkspaceStrategySchema.parse(strategy);
      expect(result).toBe(strategy);
    }
  });

  it('should reject invalid workspace strategies', () => {
    expect(() => WorkspaceStrategySchema.parse('invalid')).toThrow();
    expect(() => WorkspaceStrategySchema.parse('docker')).toThrow();
    expect(() => WorkspaceStrategySchema.parse('')).toThrow();
    expect(() => WorkspaceStrategySchema.parse(123)).toThrow();
  });

  it('should be case-sensitive', () => {
    expect(() => WorkspaceStrategySchema.parse('Container')).toThrow();
    expect(() => WorkspaceStrategySchema.parse('WORKTREE')).toThrow();
    expect(() => WorkspaceStrategySchema.parse('Directory')).toThrow();
  });
});

// ============================================================================
// WorkspaceConfigSchema Tests
// ============================================================================

describe('WorkspaceConfigSchema', () => {
  describe('strategy field validation', () => {
    it('should accept all valid strategies', () => {
      const strategies: WorkspaceStrategy[] = ['worktree', 'container', 'directory', 'none'];

      for (const strategy of strategies) {
        const result = WorkspaceConfigSchema.parse({ strategy, cleanup: true });
        expect(result.strategy).toBe(strategy);
      }
    });

    it('should require strategy field', () => {
      expect(() => WorkspaceConfigSchema.parse({ cleanup: true })).toThrow();
    });

    it('should reject invalid strategies', () => {
      expect(() => WorkspaceConfigSchema.parse({
        strategy: 'invalid',
        cleanup: true
      })).toThrow();
    });
  });

  describe('path field validation', () => {
    it('should accept valid paths', () => {
      const validPaths = [
        '/absolute/path',
        '/home/user/project',
        '/tmp/workspace',
        'relative/path',
      ];

      for (const path of validPaths) {
        const result = WorkspaceConfigSchema.parse({
          strategy: 'worktree',
          path,
          cleanup: true
        });
        expect(result.path).toBe(path);
      }
    });

    it('should be optional', () => {
      const result = WorkspaceConfigSchema.parse({ strategy: 'none', cleanup: true });
      expect(result.path).toBeUndefined();
    });
  });

  describe('container field validation', () => {
    it('should accept valid container configuration', () => {
      const containerConfig = {
        image: 'node:20-alpine',
        volumes: { '/project': '/app' },
        environment: { NODE_ENV: 'development' },
        resourceLimits: { cpu: 2, memory: '2g' },
        networkMode: 'bridge' as const,
      };

      const result = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: containerConfig,
        cleanup: true,
      });

      expect(result.container?.image).toBe('node:20-alpine');
      expect(result.container?.resourceLimits?.cpu).toBe(2);
      expect(result.container?.networkMode).toBe('bridge');
    });

    it('should validate nested container schema', () => {
      expect(() => WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: { image: '' }, // Invalid empty image
        cleanup: true,
      })).toThrow();
    });

    it('should be optional', () => {
      const result = WorkspaceConfigSchema.parse({ strategy: 'worktree', cleanup: true });
      expect(result.container).toBeUndefined();
    });
  });

  describe('cleanup field validation', () => {
    it('should accept boolean values', () => {
      const resultTrue = WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: true
      });
      expect(resultTrue.cleanup).toBe(true);

      const resultFalse = WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: false
      });
      expect(resultFalse.cleanup).toBe(false);
    });

    it('should require cleanup field', () => {
      expect(() => WorkspaceConfigSchema.parse({ strategy: 'none' })).toThrow();
    });

    it('should reject non-boolean values', () => {
      expect(() => WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: 'true'
      })).toThrow();
    });
  });

  describe('workspace strategy scenarios', () => {
    it('should handle worktree strategy with path', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'worktree',
        path: '/tmp/worktrees/task-123',
        cleanup: true,
      });

      expect(config.strategy).toBe('worktree');
      expect(config.path).toBe('/tmp/worktrees/task-123');
      expect(config.container).toBeUndefined();
      expect(config.cleanup).toBe(true);
    });

    it('should handle container strategy with full config', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: {
          image: 'node:20-alpine',
          volumes: {
            '/host/project': '/workspace',
            '/host/cache': '/root/.cache',
          },
          environment: {
            NODE_ENV: 'development',
            DEBUG: '*',
          },
          resourceLimits: {
            cpu: 4,
            memory: '4g',
            pidsLimit: 100,
          },
          networkMode: 'bridge',
          autoRemove: true,
          privileged: false,
        },
        cleanup: true,
      });

      expect(config.strategy).toBe('container');
      expect(config.container?.image).toBe('node:20-alpine');
      expect(config.container?.resourceLimits?.cpu).toBe(4);
      expect(config.container?.environment?.NODE_ENV).toBe('development');
      expect(config.cleanup).toBe(true);
    });

    it('should handle directory strategy', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'directory',
        path: '/tmp/isolated/task-456',
        cleanup: true,
      });

      expect(config.strategy).toBe('directory');
      expect(config.path).toBe('/tmp/isolated/task-456');
      expect(config.container).toBeUndefined();
      expect(config.cleanup).toBe(true);
    });

    it('should handle no isolation strategy', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: false,
      });

      expect(config.strategy).toBe('none');
      expect(config.path).toBeUndefined();
      expect(config.container).toBeUndefined();
      expect(config.cleanup).toBe(false);
    });
  });

  describe('complex integration scenarios', () => {
    it('should handle development workspace with container', () => {
      const devWorkspace = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: {
          image: 'node:20',
          volumes: {
            '/home/developer/project': '/app',
            '/home/developer/.npm': '/root/.npm',
            '/home/developer/.cache': '/root/.cache',
          },
          environment: {
            NODE_ENV: 'development',
            DEBUG: '*',
            PORT: '3000',
          },
          resourceLimits: {
            cpu: 8,
            memory: '8g',
            cpuShares: 1024,
          },
          networkMode: 'bridge',
          workingDir: '/app',
          autoRemove: false, // Keep for debugging
        },
        cleanup: false, // Preserve for development
      });

      expect(devWorkspace.strategy).toBe('container');
      expect(devWorkspace.container?.resourceLimits?.cpu).toBe(8);
      expect(devWorkspace.container?.autoRemove).toBe(false);
      expect(devWorkspace.cleanup).toBe(false);
    });

    it('should handle production workspace with security', () => {
      const prodWorkspace = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: {
          image: 'alpine:3.18',
          environment: {
            NODE_ENV: 'production',
          },
          resourceLimits: {
            cpu: 2,
            memory: '1g',
            pidsLimit: 50,
          },
          networkMode: 'none',
          user: 'nobody',
          privileged: false,
          capDrop: ['ALL'],
          securityOpts: ['no-new-privileges:true'],
          autoRemove: true,
        },
        cleanup: true,
      });

      expect(prodWorkspace.strategy).toBe('container');
      expect(prodWorkspace.container?.privileged).toBe(false);
      expect(prodWorkspace.container?.capDrop).toEqual(['ALL']);
      expect(prodWorkspace.container?.networkMode).toBe('none');
      expect(prodWorkspace.cleanup).toBe(true);
    });

    it('should handle CI/CD workspace configuration', () => {
      const ciWorkspace = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: {
          image: 'ubuntu:22.04',
          volumes: {
            '/var/run/docker.sock': '/var/run/docker.sock',
          },
          environment: {
            CI: 'true',
            DOCKER_BUILDKIT: '1',
          },
          resourceLimits: {
            cpu: 4,
            memory: '6g',
            pidsLimit: 200,
          },
          networkMode: 'bridge',
          capAdd: ['SYS_ADMIN'], // For Docker-in-Docker
          privileged: true, // Required for DinD
          autoRemove: true,
        },
        cleanup: true,
      });

      expect(ciWorkspace.container?.privileged).toBe(true);
      expect(ciWorkspace.container?.capAdd).toEqual(['SYS_ADMIN']);
      expect(ciWorkspace.container?.environment?.CI).toBe('true');
    });
  });
});

// ============================================================================
// Type Safety Tests
// ============================================================================

describe('Type Safety', () => {
  it('should enforce ResourceLimits type correctly', () => {
    const limits: ResourceLimits = {
      cpu: 2,
      memory: '1g',
    };

    expect(typeof limits.cpu).toBe('number');
    expect(typeof limits.memory).toBe('string');
  });

  it('should enforce ContainerConfig type correctly', () => {
    const config: ContainerConfig = {
      image: 'node:20',
      networkMode: 'bridge',
      autoRemove: true,
      privileged: false,
    };

    expect(typeof config.image).toBe('string');
    expect(config.networkMode).toBe('bridge');
    expect(typeof config.autoRemove).toBe('boolean');
  });

  it('should enforce ContainerStatus type correctly', () => {
    const statuses: ContainerStatus[] = [
      'created', 'running', 'paused', 'restarting', 'removing', 'exited', 'dead',
    ];

    expect(statuses).toHaveLength(7);
    statuses.forEach(status => {
      expect(typeof status).toBe('string');
    });
  });

  it('should enforce ContainerNetworkMode type correctly', () => {
    const modes: ContainerNetworkMode[] = ['bridge', 'host', 'none', 'container'];

    expect(modes).toHaveLength(4);
    modes.forEach(mode => {
      expect(typeof mode).toBe('string');
    });
  });

  it('should enforce WorkspaceStrategy type correctly', () => {
    const strategies: WorkspaceStrategy[] = ['worktree', 'container', 'directory', 'none'];

    expect(strategies).toHaveLength(4);
    strategies.forEach(strategy => {
      expect(typeof strategy).toBe('string');
    });
  });

  it('should enforce WorkspaceConfig type correctly', () => {
    const config: WorkspaceConfig = {
      strategy: 'container',
      container: {
        image: 'node:20',
        networkMode: 'bridge',
        autoRemove: true,
        privileged: false,
      },
      cleanup: true,
    };

    expect(config.strategy).toBe('container');
    expect(typeof config.cleanup).toBe('boolean');
    expect(config.container?.image).toBe('node:20');
  });

  it('should enforce WorkspaceConfig without container correctly', () => {
    const config: WorkspaceConfig = {
      strategy: 'worktree',
      path: '/tmp/workspace',
      cleanup: true,
    };

    expect(config.strategy).toBe('worktree');
    expect(config.path).toBe('/tmp/workspace');
    expect(config.container).toBeUndefined();
  });
});
