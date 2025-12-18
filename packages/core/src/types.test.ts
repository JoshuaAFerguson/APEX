import { describe, it, expect } from 'vitest';
import {
  AgentDefinitionSchema,
  WorkflowDefinitionSchema,
  ApexConfigSchema,
  TaskStatusSchema,
  AutonomyLevelSchema,
  AgentModelSchema,
  DisplayMode,
  VerboseDebugData,
  AgentUsage,
  UIConfigSchema,
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

describe('UIConfigSchema', () => {
  it('should accept valid UI config with all fields', () => {
    const config = UIConfigSchema.parse({
      previewMode: true,
      previewConfidence: 0.8,
      autoExecuteHighConfidence: true,
      previewTimeout: 10000,
    });
    expect(config.previewMode).toBe(true);
    expect(config.previewConfidence).toBe(0.8);
    expect(config.autoExecuteHighConfidence).toBe(true);
    expect(config.previewTimeout).toBe(10000);
  });

  it('should apply defaults for optional fields', () => {
    const config = UIConfigSchema.parse({});
    expect(config.previewMode).toBe(true);
    expect(config.previewConfidence).toBe(0.7);
    expect(config.autoExecuteHighConfidence).toBe(false);
    expect(config.previewTimeout).toBe(5000);
  });

  it('should accept partial config with defaults', () => {
    const config = UIConfigSchema.parse({
      previewMode: false,
      previewConfidence: 0.9,
    });
    expect(config.previewMode).toBe(false);
    expect(config.previewConfidence).toBe(0.9);
    expect(config.autoExecuteHighConfidence).toBe(false); // default
    expect(config.previewTimeout).toBe(5000); // default
  });

  it('should validate previewConfidence range', () => {
    // Valid range (0-1)
    expect(() => UIConfigSchema.parse({ previewConfidence: 0.0 })).not.toThrow();
    expect(() => UIConfigSchema.parse({ previewConfidence: 1.0 })).not.toThrow();
    expect(() => UIConfigSchema.parse({ previewConfidence: 0.5 })).not.toThrow();

    // Invalid range
    expect(() => UIConfigSchema.parse({ previewConfidence: -0.1 })).toThrow();
    expect(() => UIConfigSchema.parse({ previewConfidence: 1.1 })).toThrow();
  });

  it('should validate previewTimeout minimum value', () => {
    // Valid timeout (>= 1000ms)
    expect(() => UIConfigSchema.parse({ previewTimeout: 1000 })).not.toThrow();
    expect(() => UIConfigSchema.parse({ previewTimeout: 5000 })).not.toThrow();

    // Invalid timeout (< 1000ms)
    expect(() => UIConfigSchema.parse({ previewTimeout: 999 })).toThrow();
    expect(() => UIConfigSchema.parse({ previewTimeout: 500 })).toThrow();
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
      ui: {
        previewMode: false,
        previewConfidence: 0.8,
        autoExecuteHighConfidence: true,
        previewTimeout: 7500,
      },
    });
    expect(config.project.language).toBe('typescript');
    expect(config.autonomy?.default).toBe('review-before-merge');
    expect(config.agents?.enabled).toEqual(['planner', 'developer']);
    expect(config.git?.branchPrefix).toBe('feature/');
    expect(config.limits?.maxTokensPerTask).toBe(100000);
    expect(config.ui?.previewMode).toBe(false);
    expect(config.ui?.previewConfidence).toBe(0.8);
    expect(config.ui?.autoExecuteHighConfidence).toBe(true);
    expect(config.ui?.previewTimeout).toBe(7500);
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

describe('DisplayMode', () => {
  it('should accept valid display modes', () => {
    const validModes: DisplayMode[] = ['normal', 'compact', 'verbose'];

    for (const mode of validModes) {
      expect(mode).toMatch(/^(normal|compact|verbose)$/);
    }
  });

  it('should be a literal type with correct values', () => {
    // Test type assignment - these should compile without errors
    const normal: DisplayMode = 'normal';
    const compact: DisplayMode = 'compact';
    const verbose: DisplayMode = 'verbose';

    expect(normal).toBe('normal');
    expect(compact).toBe('compact');
    expect(verbose).toBe('verbose');
  });

  it('should be used correctly in type definitions', () => {
    // Create a mock AppState-like object to test DisplayMode integration
    interface MockAppState {
      displayMode: DisplayMode;
      otherProperty: string;
    }

    const mockState: MockAppState = {
      displayMode: 'normal',
      otherProperty: 'test',
    };

    expect(mockState.displayMode).toBe('normal');

    // Test all valid assignments
    mockState.displayMode = 'compact';
    expect(mockState.displayMode).toBe('compact');

    mockState.displayMode = 'verbose';
    expect(mockState.displayMode).toBe('verbose');

    mockState.displayMode = 'normal';
    expect(mockState.displayMode).toBe('normal');
  });

  it('should provide proper type checking', () => {
    // This test ensures the type is working as expected
    const testMode = (mode: DisplayMode): string => {
      switch (mode) {
        case 'normal':
          return 'Standard display with all components shown';
        case 'compact':
          return 'Minimized display for experienced users';
        case 'verbose':
          return 'Detailed debug information for troubleshooting';
        default:
          // TypeScript should ensure this is never reached
          const exhaustiveCheck: never = mode;
          return exhaustiveCheck;
      }
    };

    expect(testMode('normal')).toBe('Standard display with all components shown');
    expect(testMode('compact')).toBe('Minimized display for experienced users');
    expect(testMode('verbose')).toBe('Detailed debug information for troubleshooting');
  });

  it('should be exportable and importable', () => {
    // This test verifies the type is properly exported from the module
    // If DisplayMode wasn't exported, the import would fail at compile time
    expect(typeof DisplayMode).toBeUndefined(); // Types don't exist at runtime
  });
});

describe('VerboseDebugData', () => {
  const createValidAgentUsage = (): AgentUsage => ({
    inputTokens: 1000,
    outputTokens: 500,
    cacheCreationInputTokens: 100,
    cacheReadInputTokens: 50,
  });

  const createValidVerboseDebugData = (): VerboseDebugData => ({
    agentTokens: {
      planner: createValidAgentUsage(),
      developer: {
        inputTokens: 2000,
        outputTokens: 800,
        cacheCreationInputTokens: 200,
        cacheReadInputTokens: 100,
      },
    },
    timing: {
      stageStartTime: new Date('2023-01-01T10:00:00Z'),
      stageEndTime: new Date('2023-01-01T10:05:00Z'),
      stageDuration: 300000, // 5 minutes in milliseconds
      agentResponseTimes: {
        planner: 2000,
        developer: 3500,
      },
      toolUsageTimes: {
        Read: 500,
        Write: 750,
        Bash: 1200,
      },
    },
    agentDebug: {
      conversationLength: {
        planner: 5,
        developer: 8,
      },
      toolCallCounts: {
        planner: {
          Read: 3,
          Grep: 2,
        },
        developer: {
          Write: 4,
          Edit: 6,
          Bash: 2,
        },
      },
      errorCounts: {
        planner: 0,
        developer: 1,
      },
      retryAttempts: {
        planner: 0,
        developer: 1,
      },
    },
    metrics: {
      tokensPerSecond: 10.5,
      averageResponseTime: 2750,
      toolEfficiency: {
        Read: 1.0,
        Write: 0.95,
        Edit: 0.98,
        Bash: 0.87,
        Grep: 1.0,
      },
      memoryUsage: 256000000, // 256MB in bytes
      cpuUtilization: 25.5,
    },
  });

  it('should be exportable and importable', () => {
    // This test verifies the type is properly exported from the module
    // If VerboseDebugData wasn't exported, the import would fail at compile time
    expect(typeof VerboseDebugData).toBeUndefined(); // Types don't exist at runtime
  });

  describe('structure validation', () => {
    it('should accept valid VerboseDebugData with all fields', () => {
      const validData = createValidVerboseDebugData();

      // Test that the object can be typed correctly
      expect(validData).toBeDefined();
      expect(typeof validData.agentTokens).toBe('object');
      expect(typeof validData.timing).toBe('object');
      expect(typeof validData.agentDebug).toBe('object');
      expect(typeof validData.metrics).toBe('object');
    });

    it('should accept minimal VerboseDebugData with required fields only', () => {
      const minimalData: VerboseDebugData = {
        agentTokens: {
          'test-agent': {
            inputTokens: 100,
            outputTokens: 50,
          },
        },
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {},
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 5.0,
          averageResponseTime: 1000,
          toolEfficiency: {},
        },
      };

      expect(minimalData).toBeDefined();
      expect(minimalData.agentTokens['test-agent'].inputTokens).toBe(100);
      expect(minimalData.timing.stageStartTime).toBeInstanceOf(Date);
    });
  });

  describe('agentTokens field', () => {
    it('should accept multiple agents with different token usage', () => {
      const data = createValidVerboseDebugData();

      expect(data.agentTokens).toBeDefined();
      expect(Object.keys(data.agentTokens)).toContain('planner');
      expect(Object.keys(data.agentTokens)).toContain('developer');

      // Test AgentUsage structure
      const plannerUsage = data.agentTokens.planner;
      expect(plannerUsage.inputTokens).toBe(1000);
      expect(plannerUsage.outputTokens).toBe(500);
      expect(plannerUsage.cacheCreationInputTokens).toBe(100);
      expect(plannerUsage.cacheReadInputTokens).toBe(50);
    });

    it('should accept AgentUsage with optional cache fields', () => {
      const agentUsage: AgentUsage = {
        inputTokens: 500,
        outputTokens: 200,
      };

      const data: VerboseDebugData = {
        agentTokens: { 'test-agent': agentUsage },
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {},
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 5.0,
          averageResponseTime: 1000,
          toolEfficiency: {},
        },
      };

      expect(data.agentTokens['test-agent'].inputTokens).toBe(500);
      expect(data.agentTokens['test-agent'].outputTokens).toBe(200);
      expect(data.agentTokens['test-agent'].cacheCreationInputTokens).toBeUndefined();
      expect(data.agentTokens['test-agent'].cacheReadInputTokens).toBeUndefined();
    });
  });

  describe('timing field', () => {
    it('should have required timing fields', () => {
      const data = createValidVerboseDebugData();
      const timing = data.timing;

      expect(timing.stageStartTime).toBeInstanceOf(Date);
      expect(timing.stageEndTime).toBeInstanceOf(Date);
      expect(timing.stageDuration).toBe(300000);
      expect(typeof timing.agentResponseTimes).toBe('object');
      expect(typeof timing.toolUsageTimes).toBe('object');
    });

    it('should accept timing without optional fields', () => {
      const timing = {
        stageStartTime: new Date(),
        agentResponseTimes: { planner: 1000 },
        toolUsageTimes: { Read: 500 },
      };

      expect(timing.stageStartTime).toBeInstanceOf(Date);
      expect(timing.stageEndTime).toBeUndefined();
      expect(timing.stageDuration).toBeUndefined();
      expect(timing.agentResponseTimes.planner).toBe(1000);
      expect(timing.toolUsageTimes.Read).toBe(500);
    });

    it('should handle response times for multiple agents and tools', () => {
      const data = createValidVerboseDebugData();
      const timing = data.timing;

      // Agent response times
      expect(timing.agentResponseTimes.planner).toBe(2000);
      expect(timing.agentResponseTimes.developer).toBe(3500);

      // Tool usage times
      expect(timing.toolUsageTimes.Read).toBe(500);
      expect(timing.toolUsageTimes.Write).toBe(750);
      expect(timing.toolUsageTimes.Bash).toBe(1200);
    });
  });

  describe('agentDebug field', () => {
    it('should track conversation and tool usage per agent', () => {
      const data = createValidVerboseDebugData();
      const debug = data.agentDebug;

      // Conversation length tracking
      expect(debug.conversationLength.planner).toBe(5);
      expect(debug.conversationLength.developer).toBe(8);

      // Tool call counts per agent
      expect(debug.toolCallCounts.planner.Read).toBe(3);
      expect(debug.toolCallCounts.planner.Grep).toBe(2);
      expect(debug.toolCallCounts.developer.Write).toBe(4);
      expect(debug.toolCallCounts.developer.Edit).toBe(6);
      expect(debug.toolCallCounts.developer.Bash).toBe(2);
    });

    it('should track error and retry counts', () => {
      const data = createValidVerboseDebugData();
      const debug = data.agentDebug;

      // Error counts
      expect(debug.errorCounts.planner).toBe(0);
      expect(debug.errorCounts.developer).toBe(1);

      // Retry attempts
      expect(debug.retryAttempts.planner).toBe(0);
      expect(debug.retryAttempts.developer).toBe(1);
    });

    it('should handle nested tool call count structure', () => {
      const debug = {
        conversationLength: { agent1: 3, agent2: 5 },
        toolCallCounts: {
          agent1: { Read: 2, Write: 1 },
          agent2: { Edit: 3, Bash: 2, Grep: 1 },
        },
        errorCounts: { agent1: 0, agent2: 1 },
        retryAttempts: { agent1: 0, agent2: 2 },
      };

      expect(debug.toolCallCounts.agent1.Read).toBe(2);
      expect(debug.toolCallCounts.agent2.Edit).toBe(3);
      expect(debug.toolCallCounts.agent2.Bash).toBe(2);
    });
  });

  describe('metrics field', () => {
    it('should have required performance metrics', () => {
      const data = createValidVerboseDebugData();
      const metrics = data.metrics;

      expect(metrics.tokensPerSecond).toBe(10.5);
      expect(metrics.averageResponseTime).toBe(2750);
      expect(typeof metrics.toolEfficiency).toBe('object');
    });

    it('should handle optional system metrics', () => {
      const data = createValidVerboseDebugData();
      const metrics = data.metrics;

      expect(metrics.memoryUsage).toBe(256000000);
      expect(metrics.cpuUtilization).toBe(25.5);
    });

    it('should track tool efficiency rates', () => {
      const data = createValidVerboseDebugData();
      const toolEfficiency = data.metrics.toolEfficiency;

      expect(toolEfficiency.Read).toBe(1.0);
      expect(toolEfficiency.Write).toBe(0.95);
      expect(toolEfficiency.Edit).toBe(0.98);
      expect(toolEfficiency.Bash).toBe(0.87);
      expect(toolEfficiency.Grep).toBe(1.0);
    });

    it('should accept metrics without optional system fields', () => {
      const metrics = {
        tokensPerSecond: 8.5,
        averageResponseTime: 2000,
        toolEfficiency: {
          Read: 0.98,
          Write: 0.92,
        },
      };

      expect(metrics.tokensPerSecond).toBe(8.5);
      expect(metrics.averageResponseTime).toBe(2000);
      expect(metrics.memoryUsage).toBeUndefined();
      expect(metrics.cpuUtilization).toBeUndefined();
      expect(metrics.toolEfficiency.Read).toBe(0.98);
      expect(metrics.toolEfficiency.Write).toBe(0.92);
    });
  });

  describe('integration scenarios', () => {
    it('should support empty agent data for new stages', () => {
      const emptyData: VerboseDebugData = {
        agentTokens: {},
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {},
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 0,
          averageResponseTime: 0,
          toolEfficiency: {},
        },
      };

      expect(emptyData).toBeDefined();
      expect(Object.keys(emptyData.agentTokens)).toHaveLength(0);
      expect(Object.keys(emptyData.timing.agentResponseTimes)).toHaveLength(0);
      expect(Object.keys(emptyData.agentDebug.conversationLength)).toHaveLength(0);
    });

    it('should support single agent workflow data', () => {
      const singleAgentData: VerboseDebugData = {
        agentTokens: {
          'solo-agent': {
            inputTokens: 1500,
            outputTokens: 600,
            cacheCreationInputTokens: 150,
            cacheReadInputTokens: 75,
          },
        },
        timing: {
          stageStartTime: new Date('2023-01-01T14:00:00Z'),
          stageEndTime: new Date('2023-01-01T14:03:30Z'),
          stageDuration: 210000, // 3.5 minutes
          agentResponseTimes: {
            'solo-agent': 2100,
          },
          toolUsageTimes: {
            Read: 300,
            Write: 500,
            Edit: 800,
          },
        },
        agentDebug: {
          conversationLength: {
            'solo-agent': 12,
          },
          toolCallCounts: {
            'solo-agent': {
              Read: 5,
              Write: 3,
              Edit: 4,
            },
          },
          errorCounts: {
            'solo-agent': 0,
          },
          retryAttempts: {
            'solo-agent': 0,
          },
        },
        metrics: {
          tokensPerSecond: 12.0,
          averageResponseTime: 2100,
          toolEfficiency: {
            Read: 1.0,
            Write: 1.0,
            Edit: 0.95,
          },
          memoryUsage: 128000000,
          cpuUtilization: 15.2,
        },
      };

      expect(singleAgentData.agentTokens['solo-agent'].inputTokens).toBe(1500);
      expect(singleAgentData.timing.stageDuration).toBe(210000);
      expect(singleAgentData.agentDebug.conversationLength['solo-agent']).toBe(12);
      expect(singleAgentData.metrics.tokensPerSecond).toBe(12.0);
    });

    it('should support complex multi-agent workflow data', () => {
      const complexData = createValidVerboseDebugData();

      // Add additional agents to test scalability
      complexData.agentTokens.architect = {
        inputTokens: 800,
        outputTokens: 400,
        cacheCreationInputTokens: 80,
        cacheReadInputTokens: 40,
      };

      complexData.agentTokens.tester = {
        inputTokens: 600,
        outputTokens: 300,
      };

      complexData.timing.agentResponseTimes.architect = 1800;
      complexData.timing.agentResponseTimes.tester = 2200;

      complexData.agentDebug.conversationLength.architect = 6;
      complexData.agentDebug.conversationLength.tester = 4;

      complexData.agentDebug.toolCallCounts.architect = {
        Read: 4,
        Grep: 3,
        Write: 2,
      };

      complexData.agentDebug.toolCallCounts.tester = {
        Bash: 5,
        Read: 2,
      };

      complexData.agentDebug.errorCounts.architect = 0;
      complexData.agentDebug.errorCounts.tester = 0;

      complexData.agentDebug.retryAttempts.architect = 0;
      complexData.agentDebug.retryAttempts.tester = 1;

      expect(Object.keys(complexData.agentTokens)).toHaveLength(4);
      expect(complexData.agentTokens.architect.inputTokens).toBe(800);
      expect(complexData.agentTokens.tester.outputTokens).toBe(300);
      expect(complexData.timing.agentResponseTimes.architect).toBe(1800);
      expect(complexData.agentDebug.toolCallCounts.architect.Grep).toBe(3);
      expect(complexData.agentDebug.toolCallCounts.tester.Bash).toBe(5);
    });
  });

  describe('type safety and constraints', () => {
    it('should enforce number types for token counts', () => {
      const usage: AgentUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationInputTokens: 100,
        cacheReadInputTokens: 50,
      };

      expect(typeof usage.inputTokens).toBe('number');
      expect(typeof usage.outputTokens).toBe('number');
      expect(typeof usage.cacheCreationInputTokens).toBe('number');
      expect(typeof usage.cacheReadInputTokens).toBe('number');
    });

    it('should enforce Date type for timing fields', () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 300000);

      const timing = {
        stageStartTime: startTime,
        stageEndTime: endTime,
        stageDuration: 300000,
        agentResponseTimes: {},
        toolUsageTimes: {},
      };

      expect(timing.stageStartTime).toBeInstanceOf(Date);
      expect(timing.stageEndTime).toBeInstanceOf(Date);
      expect(typeof timing.stageDuration).toBe('number');
    });

    it('should enforce Record<string, number> for efficiency rates', () => {
      const efficiency: Record<string, number> = {
        Read: 1.0,
        Write: 0.95,
        Edit: 0.98,
      };

      Object.entries(efficiency).forEach(([tool, rate]) => {
        expect(typeof tool).toBe('string');
        expect(typeof rate).toBe('number');
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
      });
    });

    it('should enforce nested Record structure for tool call counts', () => {
      const toolCounts: Record<string, Record<string, number>> = {
        planner: { Read: 3, Grep: 2 },
        developer: { Write: 4, Edit: 6 },
      };

      Object.entries(toolCounts).forEach(([agent, tools]) => {
        expect(typeof agent).toBe('string');
        expect(typeof tools).toBe('object');

        Object.entries(tools).forEach(([tool, count]) => {
          expect(typeof tool).toBe('string');
          expect(typeof count).toBe('number');
          expect(count).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });
});
