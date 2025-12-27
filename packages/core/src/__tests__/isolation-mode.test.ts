import { describe, it, expect } from 'vitest';
import {
  IsolationModeSchema,
  IsolationConfigSchema,
  WorkflowDefinitionSchema,
  ContainerConfigSchema,
  IsolationMode,
  IsolationConfig,
} from '../types';

describe('IsolationMode Schema Validation', () => {
  describe('IsolationModeSchema', () => {
    it('should accept valid isolation modes', () => {
      const validModes: IsolationMode[] = ['full', 'worktree', 'shared'];

      validModes.forEach(mode => {
        const result = IsolationModeSchema.parse(mode);
        expect(result).toBe(mode);
      });
    });

    it('should reject invalid isolation modes', () => {
      const invalidModes = ['invalid', 'container', 'none', '', null, undefined, 123];

      invalidModes.forEach(mode => {
        expect(() => IsolationModeSchema.parse(mode)).toThrow();
      });
    });

    it('should have correct enum values', () => {
      expect(IsolationModeSchema.enum).toEqual(['full', 'worktree', 'shared']);
    });
  });

  describe('IsolationConfigSchema', () => {
    it('should parse valid minimal isolation config', () => {
      const config = {
        mode: 'shared'
      };

      const result = IsolationConfigSchema.parse(config);
      expect(result).toEqual({
        mode: 'shared',
        cleanupOnComplete: true,
        preserveOnFailure: false,
      });
    });

    it('should parse full isolation config with container config', () => {
      const config = {
        mode: 'full',
        container: {
          image: 'node:20-alpine',
          environment: { NODE_ENV: 'test' },
          resourceLimits: {
            cpu: 1.0,
            memory: '512m'
          }
        },
        cleanupOnComplete: false,
        preserveOnFailure: true
      };

      const result = IsolationConfigSchema.parse(config);
      expect(result.mode).toBe('full');
      expect(result.container?.image).toBe('node:20-alpine');
      expect(result.container?.environment?.NODE_ENV).toBe('test');
      expect(result.cleanupOnComplete).toBe(false);
      expect(result.preserveOnFailure).toBe(true);
    });

    it('should parse worktree isolation config', () => {
      const config = {
        mode: 'worktree',
        cleanupOnComplete: true,
        preserveOnFailure: false
      };

      const result = IsolationConfigSchema.parse(config);
      expect(result).toEqual({
        mode: 'worktree',
        cleanupOnComplete: true,
        preserveOnFailure: false,
      });
    });

    it('should apply default values correctly', () => {
      const config = {
        mode: 'full'
      };

      const result = IsolationConfigSchema.parse(config);
      expect(result.cleanupOnComplete).toBe(true);
      expect(result.preserveOnFailure).toBe(false);
    });

    it('should reject config without mode', () => {
      const config = {
        cleanupOnComplete: true
      };

      expect(() => IsolationConfigSchema.parse(config)).toThrow();
    });

    it('should reject config with invalid mode', () => {
      const config = {
        mode: 'invalid-mode',
        cleanupOnComplete: true
      };

      expect(() => IsolationConfigSchema.parse(config)).toThrow();
    });

    it('should handle container config validation for full mode', () => {
      const configWithValidContainer = {
        mode: 'full',
        container: {
          image: 'node:20',
          volumes: { '/host/path': '/container/path' },
          environment: { VAR: 'value' }
        }
      };

      expect(() => IsolationConfigSchema.parse(configWithValidContainer)).not.toThrow();

      // Container config is optional even for full mode
      const configWithoutContainer = {
        mode: 'full'
      };

      expect(() => IsolationConfigSchema.parse(configWithoutContainer)).not.toThrow();
    });
  });
});

describe('WorkflowDefinition with Isolation', () => {
  it('should parse workflow with isolation configuration', () => {
    const workflow = {
      name: 'test-workflow',
      description: 'A test workflow',
      stages: [
        {
          name: 'test-stage',
          agent: 'test-agent'
        }
      ],
      isolation: {
        mode: 'full',
        container: {
          image: 'node:20-alpine'
        },
        cleanupOnComplete: true
      }
    };

    const result = WorkflowDefinitionSchema.parse(workflow);
    expect(result.isolation?.mode).toBe('full');
    expect(result.isolation?.container?.image).toBe('node:20-alpine');
    expect(result.isolation?.cleanupOnComplete).toBe(true);
  });

  it('should parse workflow without isolation configuration', () => {
    const workflow = {
      name: 'test-workflow',
      description: 'A test workflow',
      stages: [
        {
          name: 'test-stage',
          agent: 'test-agent'
        }
      ]
    };

    const result = WorkflowDefinitionSchema.parse(workflow);
    expect(result.isolation).toBeUndefined();
  });

  it('should validate complex isolation configuration in workflow', () => {
    const workflow = {
      name: 'complex-workflow',
      description: 'Complex workflow with isolation',
      stages: [
        { name: 'planning', agent: 'planner' },
        { name: 'implementation', agent: 'developer' },
        { name: 'testing', agent: 'tester' }
      ],
      isolation: {
        mode: 'full',
        container: {
          image: 'node:20-alpine',
          environment: {
            NODE_ENV: 'test',
            CI: 'true'
          },
          resourceLimits: {
            cpu: 2.0,
            memory: '1g',
            cpuShares: 1024
          },
          volumes: {
            '/tmp/cache': '/app/cache'
          },
          workingDir: '/app',
          autoRemove: true,
          useFrozenLockfile: true
        },
        cleanupOnComplete: false,
        preserveOnFailure: true
      }
    };

    expect(() => WorkflowDefinitionSchema.parse(workflow)).not.toThrow();
    const result = WorkflowDefinitionSchema.parse(workflow);

    expect(result.isolation?.mode).toBe('full');
    expect(result.isolation?.container?.resourceLimits?.cpu).toBe(2.0);
    expect(result.isolation?.container?.environment?.NODE_ENV).toBe('test');
    expect(result.isolation?.preserveOnFailure).toBe(true);
  });
});

describe('Container Configuration Integration', () => {
  it('should validate container config when used in isolation config', () => {
    const containerConfig = {
      image: 'python:3.11-slim',
      environment: {
        PYTHONPATH: '/app',
        PIP_NO_CACHE_DIR: '1'
      },
      resourceLimits: {
        memory: '256m',
        cpu: 0.5
      },
      volumes: {
        '/host/data': '/app/data'
      },
      workingDir: '/app',
      autoRemove: true,
      useFrozenLockfile: false,
      autoDependencyInstall: true
    };

    // Test container config validation directly
    expect(() => ContainerConfigSchema.parse(containerConfig)).not.toThrow();

    // Test container config within isolation config
    const isolationConfig = {
      mode: 'full',
      container: containerConfig
    };

    expect(() => IsolationConfigSchema.parse(isolationConfig)).not.toThrow();
    const result = IsolationConfigSchema.parse(isolationConfig);
    expect(result.container?.image).toBe('python:3.11-slim');
    expect(result.container?.environment?.PYTHONPATH).toBe('/app');
  });

  it('should reject invalid container image formats', () => {
    const invalidImages = [
      '',
      'UPPERCASE',
      'image with spaces',
      'image:',
      ':tag',
      'image//',
      'image:tag:extra'
    ];

    invalidImages.forEach(image => {
      const containerConfig = { image };
      expect(() => ContainerConfigSchema.parse(containerConfig)).toThrow();
    });
  });

  it('should accept valid container image formats', () => {
    const validImages = [
      'node',
      'node:20',
      'node:20-alpine',
      'registry.example.com/node:20',
      'localhost:5000/my-app:latest',
      'gcr.io/project/image:v1.2.3'
    ];

    validImages.forEach(image => {
      const containerConfig = { image };
      expect(() => ContainerConfigSchema.parse(containerConfig)).not.toThrow();
    });
  });

  it('should validate resource limits', () => {
    const validResourceLimits = [
      { cpu: 0.1, memory: '128m' },
      { cpu: 64, memory: '16g' },
      { memory: '512M', cpuShares: 512 },
      { cpu: 2.5, memoryReservation: '256m', pidsLimit: 100 }
    ];

    validResourceLimits.forEach(limits => {
      const containerConfig = {
        image: 'node:20',
        resourceLimits: limits
      };
      expect(() => ContainerConfigSchema.parse(containerConfig)).not.toThrow();
    });

    // Test invalid resource limits
    const invalidResourceLimits = [
      { cpu: 0 }, // Below minimum
      { cpu: 65 }, // Above maximum
      { memory: 'invalid' }, // Invalid format
      { cpuShares: 1 }, // Below minimum
      { cpuShares: 262145 } // Above maximum
    ];

    invalidResourceLimits.forEach(limits => {
      const containerConfig = {
        image: 'node:20',
        resourceLimits: limits
      };
      expect(() => ContainerConfigSchema.parse(containerConfig)).toThrow();
    });
  });
});

describe('Type Safety and IntelliSense', () => {
  it('should provide correct TypeScript types', () => {
    // Test that types are correctly inferred
    const mode: IsolationMode = 'full';
    expect(mode).toBe('full');

    const config: IsolationConfig = {
      mode: 'worktree',
      cleanupOnComplete: true,
      preserveOnFailure: false
    };
    expect(config.mode).toBe('worktree');

    // Test union type behavior
    const modes: IsolationMode[] = ['full', 'worktree', 'shared'];
    expect(modes).toHaveLength(3);
  });

  it('should maintain backwards compatibility', () => {
    // Workflows without isolation should still work
    const legacyWorkflow = {
      name: 'legacy',
      description: 'Legacy workflow',
      stages: [{ name: 'stage1', agent: 'agent1' }]
    };

    expect(() => WorkflowDefinitionSchema.parse(legacyWorkflow)).not.toThrow();
    const result = WorkflowDefinitionSchema.parse(legacyWorkflow);
    expect(result.isolation).toBeUndefined();
  });
});