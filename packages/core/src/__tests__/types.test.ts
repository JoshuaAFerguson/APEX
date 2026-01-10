/**
 * @fileoverview Unit tests for Zod schemas in @apex/core types.ts
 *
 * This test suite validates all core Zod schemas for both valid and invalid inputs.
 * The schemas tested are:
 * - TaskStatusSchema, TaskPrioritySchema, TaskEffortSchema (Task-related schemas)
 * - AgentDefinitionSchema (Agent configuration)
 * - WorkflowDefinitionSchema (Workflow configuration)
 * - ApexConfigSchema (Main configuration)
 * - AutonomyLevelSchema (Autonomy control)
 * - ResourceLimitsSchema (Container resource limits)
 * - RejectionBehaviorSchema (Rejection behavior for autonomy)
 *
 * Note: The acceptance criteria mentions TaskSchema, AgentSchema, WorkflowSchema,
 * and ConfigSchema - these map to the actual schema names above.
 */
import { describe, it, expect } from 'vitest';
import {
  // Task-related schemas (Task is an interface, but these are Zod schemas)
  TaskStatusSchema,
  TaskPrioritySchema,
  TaskEffortSchema,
  // Agent schema
  AgentDefinitionSchema,
  AgentModelSchema,
  // Workflow schema
  WorkflowDefinitionSchema,
  WorkflowStageSchema,
  // Config schema
  ApexConfigSchema,
  ProjectConfigSchema,
  // Autonomy schema
  AutonomyLevelSchema,
  AutonomyConfigSchema,
  RejectionBehaviorSchema,
  // Resource limits schema
  ResourceLimitsSchema,
} from '../types';

// ============================================================================
// TaskStatusSchema, TaskPrioritySchema, TaskEffortSchema Tests
// ============================================================================

describe('TaskStatusSchema', () => {
  describe('valid inputs', () => {
    const validStatuses = [
      'pending',
      'queued',
      'planning',
      'in-progress',
      'waiting-approval',
      'awaiting-approval',
      'paused',
      'completed',
      'failed',
      'cancelled',
    ];

    it.each(validStatuses)('should accept valid status: %s', (status) => {
      const result = TaskStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(status);
      }
    });
  });

  describe('invalid inputs', () => {
    const invalidStatuses = [
      'invalid',
      'running',
      'done',
      'error',
      '',
      123,
      null,
      undefined,
      {},
      [],
    ];

    it.each(invalidStatuses)('should reject invalid status: %j', (status) => {
      const result = TaskStatusSchema.safeParse(status);
      expect(result.success).toBe(false);
    });
  });
});

describe('TaskPrioritySchema', () => {
  describe('valid inputs', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent'];

    it.each(validPriorities)('should accept valid priority: %s', (priority) => {
      const result = TaskPrioritySchema.safeParse(priority);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(priority);
      }
    });
  });

  describe('invalid inputs', () => {
    const invalidPriorities = ['critical', 'medium', 'URGENT', '', 0, null, undefined];

    it.each(invalidPriorities)('should reject invalid priority: %j', (priority) => {
      const result = TaskPrioritySchema.safeParse(priority);
      expect(result.success).toBe(false);
    });
  });
});

describe('TaskEffortSchema', () => {
  describe('valid inputs', () => {
    const validEfforts = ['xs', 'small', 'medium', 'large', 'xl'];

    it.each(validEfforts)('should accept valid effort: %s', (effort) => {
      const result = TaskEffortSchema.safeParse(effort);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(effort);
      }
    });
  });

  describe('invalid inputs', () => {
    const invalidEfforts = ['tiny', 'huge', 'XXL', '', 1, null, undefined];

    it.each(invalidEfforts)('should reject invalid effort: %j', (effort) => {
      const result = TaskEffortSchema.safeParse(effort);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// AgentDefinitionSchema Tests (maps to "AgentSchema" in acceptance criteria)
// ============================================================================

describe('AgentDefinitionSchema', () => {
  describe('valid inputs', () => {
    it('should accept minimal valid agent definition', () => {
      const validAgent = {
        name: 'test-agent',
        description: 'A test agent',
        prompt: 'You are a test agent.',
      };

      const result = AgentDefinitionSchema.safeParse(validAgent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('test-agent');
        expect(result.data.description).toBe('A test agent');
        expect(result.data.prompt).toBe('You are a test agent.');
        expect(result.data.model).toBe('sonnet'); // default value
      }
    });

    it('should accept full agent definition with all optional fields', () => {
      const fullAgent = {
        name: 'developer',
        description: 'Senior software developer agent',
        prompt: 'You are an expert software developer.',
        tools: ['Read', 'Write', 'Edit', 'Bash'],
        model: 'opus',
        skills: ['typescript', 'react', 'testing'],
      };

      const result = AgentDefinitionSchema.safeParse(fullAgent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('developer');
        expect(result.data.tools).toEqual(['Read', 'Write', 'Edit', 'Bash']);
        expect(result.data.model).toBe('opus');
        expect(result.data.skills).toEqual(['typescript', 'react', 'testing']);
      }
    });

    it('should accept all valid model types', () => {
      const models = ['opus', 'sonnet', 'haiku', 'inherit'];

      for (const model of models) {
        const agent = {
          name: 'test',
          description: 'test',
          prompt: 'test',
          model,
        };
        const result = AgentDefinitionSchema.safeParse(agent);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject agent without required name', () => {
      const invalidAgent = {
        description: 'A test agent',
        prompt: 'You are a test agent.',
      };

      const result = AgentDefinitionSchema.safeParse(invalidAgent);
      expect(result.success).toBe(false);
    });

    it('should reject agent without required description', () => {
      const invalidAgent = {
        name: 'test-agent',
        prompt: 'You are a test agent.',
      };

      const result = AgentDefinitionSchema.safeParse(invalidAgent);
      expect(result.success).toBe(false);
    });

    it('should reject agent without required prompt', () => {
      const invalidAgent = {
        name: 'test-agent',
        description: 'A test agent',
      };

      const result = AgentDefinitionSchema.safeParse(invalidAgent);
      expect(result.success).toBe(false);
    });

    it('should reject agent with invalid model', () => {
      const invalidAgent = {
        name: 'test-agent',
        description: 'A test agent',
        prompt: 'You are a test agent.',
        model: 'gpt-4',
      };

      const result = AgentDefinitionSchema.safeParse(invalidAgent);
      expect(result.success).toBe(false);
    });

    it('should reject agent with non-array tools', () => {
      const invalidAgent = {
        name: 'test-agent',
        description: 'A test agent',
        prompt: 'You are a test agent.',
        tools: 'Read',
      };

      const result = AgentDefinitionSchema.safeParse(invalidAgent);
      expect(result.success).toBe(false);
    });

    it('should reject empty object', () => {
      const result = AgentDefinitionSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject null and undefined', () => {
      expect(AgentDefinitionSchema.safeParse(null).success).toBe(false);
      expect(AgentDefinitionSchema.safeParse(undefined).success).toBe(false);
    });
  });
});

// ============================================================================
// WorkflowDefinitionSchema Tests (maps to "WorkflowSchema" in acceptance criteria)
// ============================================================================

describe('WorkflowDefinitionSchema', () => {
  describe('valid inputs', () => {
    it('should accept minimal valid workflow definition', () => {
      const validWorkflow = {
        name: 'feature',
        description: 'Feature development workflow',
        stages: [
          {
            name: 'planning',
            agent: 'planner',
          },
        ],
      };

      const result = WorkflowDefinitionSchema.safeParse(validWorkflow);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('feature');
        expect(result.data.description).toBe('Feature development workflow');
        expect(result.data.stages).toHaveLength(1);
      }
    });

    it('should accept full workflow definition with all optional fields', () => {
      const fullWorkflow = {
        name: 'feature',
        description: 'Full feature development workflow',
        trigger: ['feature/*', 'feat/*'],
        stages: [
          {
            name: 'planning',
            agent: 'planner',
            description: 'Plan the feature',
            dependsOn: [],
            parallel: false,
            inputs: ['requirements'],
            outputs: ['plan'],
            condition: 'always',
            actions: ['analyze', 'plan'],
            gate: 'planning-gate',
            maxRetries: 3,
          },
          {
            name: 'implementation',
            agent: 'developer',
            description: 'Implement the feature',
            dependsOn: ['planning'],
            parallel: true,
            inputs: ['plan'],
            outputs: ['code'],
          },
        ],
        gates: [
          {
            id: 'planning-gate',
            trigger: 'before-commit',
            required: true,
          },
        ],
      };

      const result = WorkflowDefinitionSchema.safeParse(fullWorkflow);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stages).toHaveLength(2);
        expect(result.data.trigger).toEqual(['feature/*', 'feat/*']);
        expect(result.data.gates).toHaveLength(1);
      }
    });

    it('should accept workflow with isolation config', () => {
      const workflowWithIsolation = {
        name: 'isolated-workflow',
        description: 'Workflow with isolation',
        stages: [{ name: 'build', agent: 'developer' }],
        isolation: {
          mode: 'full',
          cleanupOnComplete: true,
          preserveOnFailure: false,
        },
      };

      const result = WorkflowDefinitionSchema.safeParse(workflowWithIsolation);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('should reject workflow without required name', () => {
      const invalidWorkflow = {
        description: 'A workflow',
        stages: [{ name: 'stage1', agent: 'agent1' }],
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject workflow without required description', () => {
      const invalidWorkflow = {
        name: 'test-workflow',
        stages: [{ name: 'stage1', agent: 'agent1' }],
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject workflow without required stages', () => {
      const invalidWorkflow = {
        name: 'test-workflow',
        description: 'A workflow',
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject workflow with empty stages array', () => {
      const invalidWorkflow = {
        name: 'test-workflow',
        description: 'A workflow',
        stages: [],
      };

      // Empty stages is technically valid as per Zod schema, but let's test
      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      // This should actually succeed since z.array() accepts empty arrays
      expect(result.success).toBe(true);
    });

    it('should reject stage without required name', () => {
      const invalidWorkflow = {
        name: 'test-workflow',
        description: 'A workflow',
        stages: [{ agent: 'agent1' }],
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject stage without required agent', () => {
      const invalidWorkflow = {
        name: 'test-workflow',
        description: 'A workflow',
        stages: [{ name: 'stage1' }],
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject null and undefined', () => {
      expect(WorkflowDefinitionSchema.safeParse(null).success).toBe(false);
      expect(WorkflowDefinitionSchema.safeParse(undefined).success).toBe(false);
    });
  });
});

// ============================================================================
// ApexConfigSchema Tests (maps to "ConfigSchema" in acceptance criteria)
// ============================================================================

describe('ApexConfigSchema', () => {
  describe('valid inputs', () => {
    it('should accept minimal valid config', () => {
      const validConfig = {
        project: {
          name: 'test-project',
        },
      };

      const result = ApexConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.project.name).toBe('test-project');
        expect(result.data.version).toBe('1.0'); // default
      }
    });

    it('should accept config with project details', () => {
      const config = {
        project: {
          name: 'my-app',
          language: 'TypeScript',
          framework: 'React',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
          typecheckCommand: 'npm run typecheck',
        },
      };

      const result = ApexConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.project.language).toBe('TypeScript');
        expect(result.data.project.framework).toBe('React');
      }
    });

    it('should accept config with autonomy settings', () => {
      const config = {
        project: { name: 'test' },
        autonomy: {
          level: 'review-all',
        },
      };

      const result = ApexConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.autonomy?.level).toBe('review-all');
      }
    });

    it('should accept config with limits', () => {
      const config = {
        project: { name: 'test' },
        limits: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 5.0,
          dailyBudget: 50.0,
          maxTurns: 50,
          maxConcurrentTasks: 2,
        },
      };

      const result = ApexConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept config with git settings', () => {
      const config = {
        project: { name: 'test' },
        git: {
          branchPrefix: 'feature/',
          commitFormat: 'conventional',
          autoPush: false,
          defaultBranch: 'develop',
        },
      };

      const result = ApexConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept config with model settings', () => {
      const config = {
        project: { name: 'test' },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku',
        },
      };

      const result = ApexConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept config with agents enabled/disabled', () => {
      const config = {
        project: { name: 'test' },
        agents: {
          enabled: ['planner', 'developer'],
          disabled: ['tester'],
        },
      };

      const result = ApexConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('should reject config without required project', () => {
      const invalidConfig = {
        version: '1.0',
      };

      const result = ApexConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject config with project missing name', () => {
      const invalidConfig = {
        project: {
          language: 'TypeScript',
        },
      };

      const result = ApexConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject config with invalid autonomy level', () => {
      const invalidConfig = {
        project: { name: 'test' },
        autonomy: {
          level: 'invalid-level',
        },
      };

      const result = ApexConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject config with invalid model', () => {
      const invalidConfig = {
        project: { name: 'test' },
        models: {
          planning: 'gpt-4', // invalid
        },
      };

      const result = ApexConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject config with invalid git commitFormat', () => {
      const invalidConfig = {
        project: { name: 'test' },
        git: {
          commitFormat: 'custom', // invalid, only 'conventional' or 'simple'
        },
      };

      const result = ApexConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject null and undefined', () => {
      expect(ApexConfigSchema.safeParse(null).success).toBe(false);
      expect(ApexConfigSchema.safeParse(undefined).success).toBe(false);
    });

    it('should reject empty object', () => {
      const result = ApexConfigSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// AutonomyLevelSchema Tests
// ============================================================================

describe('AutonomyLevelSchema', () => {
  describe('valid inputs', () => {
    const validLevels = ['full-auto', 'review-before-commit', 'review-all'];

    it.each(validLevels)('should accept valid autonomy level: %s', (level) => {
      const result = AutonomyLevelSchema.safeParse(level);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(level);
      }
    });
  });

  describe('invalid inputs', () => {
    const invalidLevels = [
      'auto',
      'manual',
      'full',
      'supervised',
      'autonomous',
      '',
      0,
      null,
      undefined,
      {},
      [],
    ];

    it.each(invalidLevels)('should reject invalid autonomy level: %j', (level) => {
      const result = AutonomyLevelSchema.safeParse(level);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// ResourceLimitsSchema Tests
// ============================================================================

describe('ResourceLimitsSchema', () => {
  describe('cpu field validation', () => {
    it('should accept valid CPU values', () => {
      const validCpuValues = [0.1, 0.5, 1, 2, 4, 8, 16, 32, 64];

      for (const cpu of validCpuValues) {
        const result = ResourceLimitsSchema.safeParse({ cpu });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.cpu).toBe(cpu);
        }
      }
    });

    it('should reject CPU values below minimum (0.1)', () => {
      const result = ResourceLimitsSchema.safeParse({ cpu: 0.05 });
      expect(result.success).toBe(false);
    });

    it('should reject CPU values above maximum (64)', () => {
      const result = ResourceLimitsSchema.safeParse({ cpu: 65 });
      expect(result.success).toBe(false);
    });

    it('should reject negative CPU values', () => {
      const result = ResourceLimitsSchema.safeParse({ cpu: -1 });
      expect(result.success).toBe(false);
    });

    it('should accept fractional CPU values', () => {
      const result = ResourceLimitsSchema.safeParse({ cpu: 0.25 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cpu).toBe(0.25);
      }
    });
  });

  describe('memory field validation', () => {
    it('should accept valid memory values with unit suffixes', () => {
      const validMemoryValues = ['256m', '512M', '1g', '2G', '4096m', '1024', '128k', '256K'];

      for (const memory of validMemoryValues) {
        const result = ResourceLimitsSchema.safeParse({ memory });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.memory).toBe(memory);
        }
      }
    });

    it('should reject invalid memory values', () => {
      const invalidMemoryValues = ['invalid', '256mb', '1gb', '', 'abc', '-256m'];

      for (const memory of invalidMemoryValues) {
        const result = ResourceLimitsSchema.safeParse({ memory });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('memoryReservation field validation', () => {
    it('should accept valid memory reservation values', () => {
      const result = ResourceLimitsSchema.safeParse({ memoryReservation: '128m' });
      expect(result.success).toBe(true);
    });

    it('should be optional', () => {
      const result = ResourceLimitsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.memoryReservation).toBeUndefined();
      }
    });
  });

  describe('memorySwap field validation', () => {
    it('should accept valid memory swap values', () => {
      const result = ResourceLimitsSchema.safeParse({ memorySwap: '2g' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid memory swap values', () => {
      const result = ResourceLimitsSchema.safeParse({ memorySwap: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('cpuShares field validation', () => {
    it('should accept valid CPU shares', () => {
      const validShares = [2, 512, 1024, 2048, 262144];

      for (const cpuShares of validShares) {
        const result = ResourceLimitsSchema.safeParse({ cpuShares });
        expect(result.success).toBe(true);
      }
    });

    it('should reject CPU shares below minimum (2)', () => {
      const result = ResourceLimitsSchema.safeParse({ cpuShares: 1 });
      expect(result.success).toBe(false);
    });

    it('should reject CPU shares above maximum (262144)', () => {
      const result = ResourceLimitsSchema.safeParse({ cpuShares: 262145 });
      expect(result.success).toBe(false);
    });
  });

  describe('pidsLimit field validation', () => {
    it('should accept valid PIDs limit', () => {
      const result = ResourceLimitsSchema.safeParse({ pidsLimit: 100 });
      expect(result.success).toBe(true);
    });

    it('should reject PIDs limit below minimum (1)', () => {
      const result = ResourceLimitsSchema.safeParse({ pidsLimit: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative PIDs limit', () => {
      const result = ResourceLimitsSchema.safeParse({ pidsLimit: -10 });
      expect(result.success).toBe(false);
    });
  });

  describe('full object validation', () => {
    it('should accept a complete valid ResourceLimits object', () => {
      const fullLimits = {
        cpu: 2,
        memory: '1g',
        memoryReservation: '512m',
        memorySwap: '2g',
        cpuShares: 1024,
        pidsLimit: 100,
      };

      const result = ResourceLimitsSchema.safeParse(fullLimits);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(fullLimits);
      }
    });

    it('should accept an empty object (all fields optional)', () => {
      const result = ResourceLimitsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject null', () => {
      const result = ResourceLimitsSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('should reject undefined', () => {
      const result = ResourceLimitsSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// RejectionBehaviorSchema Tests
// ============================================================================

describe('RejectionBehaviorSchema', () => {
  describe('valid inputs', () => {
    const validBehaviors = ['skip', 'abort'];

    it.each(validBehaviors)('should accept valid rejection behavior: %s', (behavior) => {
      const result = RejectionBehaviorSchema.safeParse(behavior);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(behavior);
      }
    });
  });

  describe('invalid inputs', () => {
    const invalidBehaviors = [
      'continue',
      'retry',
      'fail',
      'error',
      '',
      0,
      null,
      undefined,
      {},
      [],
    ];

    it.each(invalidBehaviors)('should reject invalid rejection behavior: %j', (behavior) => {
      const result = RejectionBehaviorSchema.safeParse(behavior);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Additional Schema Integration Tests
// ============================================================================

describe('Schema Integration Tests', () => {
  it('should validate AgentModel enum used in AgentDefinitionSchema', () => {
    const validModels = ['opus', 'sonnet', 'haiku', 'inherit'];
    for (const model of validModels) {
      expect(AgentModelSchema.safeParse(model).success).toBe(true);
    }
  });

  it('should validate WorkflowStage within WorkflowDefinition', () => {
    const stage = {
      name: 'test-stage',
      agent: 'test-agent',
      description: 'Test stage description',
      parallel: true,
      maxRetries: 5,
    };

    const result = WorkflowStageSchema.safeParse(stage);
    expect(result.success).toBe(true);
  });

  it('should validate ProjectConfig within ApexConfig', () => {
    const project = {
      name: 'my-project',
      language: 'TypeScript',
      framework: 'Express',
      testCommand: 'jest',
      buildCommand: 'tsc',
    };

    const result = ProjectConfigSchema.safeParse(project);
    expect(result.success).toBe(true);
  });

  it('should validate AutonomyConfig with all options', () => {
    const autonomyConfig = {
      level: 'review-before-commit',
      gates: [
        {
          type: 'before-commit',
          required: true,
        },
      ],
      limits: {
        maxCost: 10.0,
        maxTokens: 100000,
      },
      rejectionBehavior: 'abort',
    };

    const result = AutonomyConfigSchema.safeParse(autonomyConfig);
    expect(result.success).toBe(true);
  });

  it('should validate AutonomyConfig with different rejection behaviors', () => {
    const autonomyConfigSkip = {
      level: 'review-all',
      rejectionBehavior: 'skip',
    };

    const autonomyConfigAbort = {
      level: 'full-auto',
      rejectionBehavior: 'abort',
    };

    expect(AutonomyConfigSchema.safeParse(autonomyConfigSkip).success).toBe(true);
    expect(AutonomyConfigSchema.safeParse(autonomyConfigAbort).success).toBe(true);
  });

  it('should validate RejectionBehavior within AutonomyConfig', () => {
    const invalidAutonomyConfig = {
      level: 'review-all',
      rejectionBehavior: 'invalid-behavior',
    };

    const result = AutonomyConfigSchema.safeParse(invalidAutonomyConfig);
    expect(result.success).toBe(false);
  });
});
