import { describe, it, expect } from 'vitest';
import {
  AgentDefinitionSchema,
  WorkflowDefinitionSchema,
  ApexConfigSchema,
  TaskStatusSchema,
  AutonomyLevelSchema,
  AgentModelSchema,
} from './types';

describe('AgentModelSchema', () => {
  it('should accept valid models', () => {
    expect(AgentModelSchema.parse('opus')).toBe('opus');
    expect(AgentModelSchema.parse('sonnet')).toBe('sonnet');
    expect(AgentModelSchema.parse('haiku')).toBe('haiku');
    expect(AgentModelSchema.parse('inherit')).toBe('inherit');
  });

  it('should reject invalid models', () => {
    expect(() => AgentModelSchema.parse('gpt-4')).toThrow();
  });
});

describe('AgentDefinitionSchema', () => {
  it('should parse valid agent definition', () => {
    const agent = AgentDefinitionSchema.parse({
      name: 'test-agent',
      description: 'A test agent',
      prompt: 'You are a test agent',
    });
    expect(agent.name).toBe('test-agent');
    expect(agent.model).toBe('sonnet'); // default
  });

  it('should accept optional fields', () => {
    const agent = AgentDefinitionSchema.parse({
      name: 'test-agent',
      description: 'A test agent',
      prompt: 'You are a test agent',
      tools: ['Read', 'Write'],
      model: 'opus',
      skills: ['debugging'],
    });
    expect(agent.tools).toEqual(['Read', 'Write']);
    expect(agent.model).toBe('opus');
    expect(agent.skills).toEqual(['debugging']);
  });

  it('should reject missing required fields', () => {
    expect(() =>
      AgentDefinitionSchema.parse({
        name: 'test',
        // missing description and prompt
      })
    ).toThrow();
  });
});

describe('AutonomyLevelSchema', () => {
  it('should accept valid autonomy levels', () => {
    expect(AutonomyLevelSchema.parse('full')).toBe('full');
    expect(AutonomyLevelSchema.parse('review-before-commit')).toBe('review-before-commit');
    expect(AutonomyLevelSchema.parse('review-before-merge')).toBe('review-before-merge');
    expect(AutonomyLevelSchema.parse('manual')).toBe('manual');
  });

  it('should reject invalid autonomy levels', () => {
    expect(() => AutonomyLevelSchema.parse('auto')).toThrow();
  });
});

describe('TaskStatusSchema', () => {
  it('should accept valid task statuses', () => {
    const validStatuses = [
      'pending',
      'queued',
      'planning',
      'in-progress',
      'waiting-approval',
      'paused',
      'completed',
      'failed',
      'cancelled',
    ];
    for (const status of validStatuses) {
      expect(TaskStatusSchema.parse(status)).toBe(status);
    }
  });

  it('should reject invalid status', () => {
    expect(() => TaskStatusSchema.parse('running')).toThrow();
  });
});

describe('WorkflowDefinitionSchema', () => {
  it('should parse valid workflow definition', () => {
    const workflow = WorkflowDefinitionSchema.parse({
      name: 'feature',
      description: 'Feature workflow',
      stages: [
        {
          name: 'planning',
          agent: 'planner',
        },
        {
          name: 'implementation',
          agent: 'developer',
          dependsOn: ['planning'],
        },
      ],
    });
    expect(workflow.name).toBe('feature');
    expect(workflow.stages).toHaveLength(2);
  });

  it('should accept optional trigger', () => {
    const workflow = WorkflowDefinitionSchema.parse({
      name: 'feature',
      description: 'Feature workflow',
      trigger: ['manual', 'apex:feature'],
      stages: [{ name: 'planning', agent: 'planner' }],
    });
    expect(workflow.trigger).toEqual(['manual', 'apex:feature']);
  });

  it('should apply stage defaults', () => {
    const workflow = WorkflowDefinitionSchema.parse({
      name: 'test',
      description: 'Test',
      stages: [{ name: 'stage1', agent: 'developer' }],
    });
    expect(workflow.stages[0].parallel).toBe(false);
    expect(workflow.stages[0].maxRetries).toBe(2);
  });
});

describe('ApexConfigSchema', () => {
  it('should parse minimal valid config', () => {
    const config = ApexConfigSchema.parse({
      project: {
        name: 'test-project',
      },
    });
    expect(config.project.name).toBe('test-project');
    expect(config.version).toBe('1.0'); // default
  });

  it('should parse full config', () => {
    const config = ApexConfigSchema.parse({
      version: '1.0',
      project: {
        name: 'test-project',
        language: 'typescript',
        framework: 'nextjs',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        buildCommand: 'npm run build',
      },
      autonomy: {
        default: 'review-before-merge',
        overrides: {
          documentation: 'full',
        },
      },
      agents: {
        enabled: ['planner', 'developer'],
        disabled: ['devops'],
      },
      models: {
        planning: 'opus',
        implementation: 'sonnet',
        review: 'haiku',
      },
      git: {
        branchPrefix: 'feature/',
        commitFormat: 'conventional',
        autoPush: false,
        defaultBranch: 'main',
      },
      limits: {
        maxTokensPerTask: 100000,
        maxCostPerTask: 5.0,
        dailyBudget: 50.0,
        maxTurns: 50,
        maxConcurrentTasks: 2,
      },
      api: {
        url: 'http://localhost:4000',
        port: 4000,
      },
    });
    expect(config.project.language).toBe('typescript');
    expect(config.autonomy?.default).toBe('review-before-merge');
    expect(config.agents?.enabled).toEqual(['planner', 'developer']);
    expect(config.git?.branchPrefix).toBe('feature/');
    expect(config.limits?.maxTokensPerTask).toBe(100000);
  });

  it('should apply defaults for optional fields', () => {
    const config = ApexConfigSchema.parse({
      project: { name: 'test' },
    });
    expect(config.project.testCommand).toBe('npm test');
    expect(config.project.lintCommand).toBe('npm run lint');
    expect(config.project.buildCommand).toBe('npm run build');
  });

  it('should reject missing project name', () => {
    expect(() =>
      ApexConfigSchema.parse({
        project: {},
      })
    ).toThrow();
  });
});
