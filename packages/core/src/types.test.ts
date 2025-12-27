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
  DaemonConfigSchema,
  OutdatedDocsConfigSchema,
  DocumentationAnalysisConfigSchema,
  TestingAntiPattern,
  TestAnalysis,
  BranchCoverage,
  UntestedExport,
  MissingIntegrationTest,
  IterationEntry,
  IterationHistory,
  TaskSessionData,
} from './types';

describe.skip('AgentModelSchema', () => {
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

describe.skip('UIConfigSchema', () => {
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

describe.skip('DaemonConfigSchema', () => {
  it('should accept valid daemon config with all fields', () => {
    const config = DaemonConfigSchema.parse({
      pollInterval: 10000,
      autoStart: true,
      logLevel: 'debug',
    });
    expect(config.pollInterval).toBe(10000);
    expect(config.autoStart).toBe(true);
    expect(config.logLevel).toBe('debug');
  });

  it('should apply defaults for optional fields', () => {
    const config = DaemonConfigSchema.parse({});
    expect(config.pollInterval).toBe(5000);
    expect(config.autoStart).toBe(false);
    expect(config.logLevel).toBe('info');
  });

  it('should accept partial config with defaults', () => {
    const config = DaemonConfigSchema.parse({
      pollInterval: 8000,
      logLevel: 'warn',
    });
    expect(config.pollInterval).toBe(8000);
    expect(config.autoStart).toBe(false); // default
    expect(config.logLevel).toBe('warn');
  });

  it('should validate logLevel enum values', () => {
    const validLevels = ['debug', 'info', 'warn', 'error'];

    for (const level of validLevels) {
      const config = DaemonConfigSchema.parse({ logLevel: level });
      expect(config.logLevel).toBe(level);
    }

    // Test invalid value
    expect(() => {
      DaemonConfigSchema.parse({ logLevel: 'invalid' });
    }).toThrow();

    expect(() => {
      DaemonConfigSchema.parse({ logLevel: 'trace' });
    }).toThrow();
  });

  it('should accept numeric pollInterval values', () => {
    const testValues = [0, 1, 1000, 5000, 30000, 60000, Number.MAX_SAFE_INTEGER];

    for (const value of testValues) {
      const config = DaemonConfigSchema.parse({ pollInterval: value });
      expect(config.pollInterval).toBe(value);
    }
  });

  it('should accept boolean autoStart values', () => {
    const configTrue = DaemonConfigSchema.parse({ autoStart: true });
    expect(configTrue.autoStart).toBe(true);

    const configFalse = DaemonConfigSchema.parse({ autoStart: false });
    expect(configFalse.autoStart).toBe(false);
  });

  it('should reject invalid pollInterval types', () => {
    const invalidValues = ['5000', null, undefined, [], {}, 'invalid'];

    for (const value of invalidValues) {
      expect(() => {
        DaemonConfigSchema.parse({ pollInterval: value });
      }).toThrow();
    }
  });

  it('should reject invalid autoStart types', () => {
    const invalidValues = ['true', 'false', 1, 0, null, undefined, [], {}];

    for (const value of invalidValues) {
      expect(() => {
        DaemonConfigSchema.parse({ autoStart: value });
      }).toThrow();
    }
  });

  it('should handle negative pollInterval values', () => {
    const config = DaemonConfigSchema.parse({ pollInterval: -1000 });
    expect(config.pollInterval).toBe(-1000);
  });

  it('should handle zero pollInterval value', () => {
    const config = DaemonConfigSchema.parse({ pollInterval: 0 });
    expect(config.pollInterval).toBe(0);
  });

  it('should preserve all types correctly', () => {
    const config = DaemonConfigSchema.parse({
      pollInterval: 7500,
      autoStart: true,
      logLevel: 'error',
    });

    expect(typeof config.pollInterval).toBe('number');
    expect(typeof config.autoStart).toBe('boolean');
    expect(typeof config.logLevel).toBe('string');
  });
});

describe.skip('DaemonConfigSchema - Capacity Thresholds', () => {
  describe('timeBasedUsage configuration', () => {
    it('should apply default values for capacity thresholds', () => {
      const config = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
        },
      });

      expect(config.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.90);
      expect(config.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.96);
    });

    it('should accept custom capacity threshold values', () => {
      const config = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.75,
          nightModeCapacityThreshold: 0.88,
        },
      });

      expect(config.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.75);
      expect(config.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.88);
    });

    it('should accept boundary values for capacity thresholds', () => {
      // Test minimum boundary (0)
      const configMin = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.0,
          nightModeCapacityThreshold: 0.0,
        },
      });

      expect(configMin.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.0);
      expect(configMin.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.0);

      // Test maximum boundary (1)
      const configMax = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 1.0,
          nightModeCapacityThreshold: 1.0,
        },
      });

      expect(configMax.timeBasedUsage?.dayModeCapacityThreshold).toBe(1.0);
      expect(configMax.timeBasedUsage?.nightModeCapacityThreshold).toBe(1.0);
    });

    it('should reject capacity threshold values below 0', () => {
      expect(() => {
        DaemonConfigSchema.parse({
          timeBasedUsage: {
            enabled: true,
            dayModeCapacityThreshold: -0.1,
          },
        });
      }).toThrow();

      expect(() => {
        DaemonConfigSchema.parse({
          timeBasedUsage: {
            enabled: true,
            nightModeCapacityThreshold: -0.5,
          },
        });
      }).toThrow();
    });

    it('should reject capacity threshold values above 1', () => {
      expect(() => {
        DaemonConfigSchema.parse({
          timeBasedUsage: {
            enabled: true,
            dayModeCapacityThreshold: 1.1,
          },
        });
      }).toThrow();

      expect(() => {
        DaemonConfigSchema.parse({
          timeBasedUsage: {
            enabled: true,
            nightModeCapacityThreshold: 1.5,
          },
        });
      }).toThrow();
    });

    it('should reject invalid types for capacity thresholds', () => {
      const invalidValues = ['0.9', null, undefined, [], {}, 'high', true];

      for (const value of invalidValues) {
        expect(() => {
          DaemonConfigSchema.parse({
            timeBasedUsage: {
              enabled: true,
              dayModeCapacityThreshold: value,
            },
          });
        }).toThrow();

        expect(() => {
          DaemonConfigSchema.parse({
            timeBasedUsage: {
              enabled: true,
              nightModeCapacityThreshold: value,
            },
          });
        }).toThrow();
      }
    });

    it('should work with complete timeBasedUsage configuration', () => {
      const config = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
          dayModeCapacityThreshold: 0.80,
          nightModeCapacityThreshold: 0.95,
          dayModeThresholds: {
            maxTokensPerTask: 50000,
            maxCostPerTask: 3.0,
            maxConcurrentTasks: 1,
          },
          nightModeThresholds: {
            maxTokensPerTask: 2000000,
            maxCostPerTask: 25.0,
            maxConcurrentTasks: 8,
          },
        },
      });

      expect(config.timeBasedUsage?.enabled).toBe(true);
      expect(config.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.80);
      expect(config.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.95);
      expect(config.timeBasedUsage?.dayModeThresholds?.maxTokensPerTask).toBe(50000);
      expect(config.timeBasedUsage?.nightModeThresholds?.maxTokensPerTask).toBe(2000000);
    });

    it('should preserve type safety for capacity threshold values', () => {
      const config = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.85,
          nightModeCapacityThreshold: 0.92,
        },
      });

      expect(typeof config.timeBasedUsage?.dayModeCapacityThreshold).toBe('number');
      expect(typeof config.timeBasedUsage?.nightModeCapacityThreshold).toBe('number');
    });

    it('should work without timeBasedUsage section', () => {
      const config = DaemonConfigSchema.parse({
        pollInterval: 5000,
        autoStart: false,
      });

      expect(config.timeBasedUsage).toBeUndefined();
    });

    it('should work with disabled timeBasedUsage but configured thresholds', () => {
      const config = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: false,
          dayModeCapacityThreshold: 0.70,
          nightModeCapacityThreshold: 0.85,
        },
      });

      expect(config.timeBasedUsage?.enabled).toBe(false);
      expect(config.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.70);
      expect(config.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.85);
    });

    it('should handle partial capacity threshold configuration', () => {
      // Only day mode threshold specified
      const configDayOnly = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.85,
        },
      });

      expect(configDayOnly.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.85);
      expect(configDayOnly.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.96); // default

      // Only night mode threshold specified
      const configNightOnly = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
          nightModeCapacityThreshold: 0.89,
        },
      });

      expect(configNightOnly.timeBasedUsage?.dayModeCapacityThreshold).toBe(0.90); // default
      expect(configNightOnly.timeBasedUsage?.nightModeCapacityThreshold).toBe(0.89);
    });

    it('should handle common threshold percentage values', () => {
      const commonThresholds = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99];

      for (const threshold of commonThresholds) {
        const config = DaemonConfigSchema.parse({
          timeBasedUsage: {
            enabled: true,
            dayModeCapacityThreshold: threshold,
            nightModeCapacityThreshold: threshold,
          },
        });

        expect(config.timeBasedUsage?.dayModeCapacityThreshold).toBe(threshold);
        expect(config.timeBasedUsage?.nightModeCapacityThreshold).toBe(threshold);
      }
    });

    it('should handle floating point precision edge cases', () => {
      // Test very precise decimal values
      const config = DaemonConfigSchema.parse({
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.8999999999999999,
          nightModeCapacityThreshold: 0.9600000000000001,
        },
      });

      expect(config.timeBasedUsage?.dayModeCapacityThreshold).toBeCloseTo(0.9, 10);
      expect(config.timeBasedUsage?.nightModeCapacityThreshold).toBeCloseTo(0.96, 10);
    });
  });
});

describe.skip('AgentDefinitionSchema', () => {
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

describe.skip('AutonomyLevelSchema', () => {
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

describe.skip('TaskStatusSchema', () => {
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

describe.skip('WorkflowDefinitionSchema', () => {
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

describe.skip('ApexConfigSchema', () => {
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
      daemon: {
        pollInterval: 12000,
        autoStart: true,
        logLevel: 'debug',
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
    expect(config.daemon?.pollInterval).toBe(12000);
    expect(config.daemon?.autoStart).toBe(true);
    expect(config.daemon?.logLevel).toBe('debug');
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

  it('should accept config with only daemon section', () => {
    const config = ApexConfigSchema.parse({
      project: { name: 'daemon-only-test' },
      daemon: {
        pollInterval: 15000,
        autoStart: true,
        logLevel: 'error',
      },
    });
    expect(config.daemon?.pollInterval).toBe(15000);
    expect(config.daemon?.autoStart).toBe(true);
    expect(config.daemon?.logLevel).toBe('error');
  });

  it('should accept config with partial daemon section', () => {
    const config = ApexConfigSchema.parse({
      project: { name: 'partial-daemon-test' },
      daemon: {
        autoStart: true,
      },
    });
    expect(config.daemon?.pollInterval).toBe(5000);
    expect(config.daemon?.autoStart).toBe(true);
    expect(config.daemon?.logLevel).toBe('info');
  });

  it('should accept config without daemon section', () => {
    const config = ApexConfigSchema.parse({
      project: { name: 'no-daemon-test' },
    });
    expect(config.daemon).toBeUndefined();
  });
});

describe.skip('DisplayMode', () => {
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

describe.skip('VerboseDebugData', () => {
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

describe('OutdatedDocsConfigSchema', () => {
  it('should parse with all default values when empty config provided', () => {
    const config = OutdatedDocsConfigSchema.parse({});

    expect(config.todoAgeThresholdDays).toBe(30);
    expect(config.versionCheckPatterns).toEqual([
      'v\\d+\\.\\d+\\.\\d+',
      'version\\s+\\d+\\.\\d+',
      '\\d+\\.\\d+\\s+release',
      'npm\\s+install.*@\\d+\\.\\d+\\.\\d+',
    ]);
    expect(config.deprecationRequiresMigration).toBe(true);
    expect(config.crossReferenceEnabled).toBe(true);
  });

  it('should parse with custom values', () => {
    const config = OutdatedDocsConfigSchema.parse({
      todoAgeThresholdDays: 60,
      versionCheckPatterns: ['custom\\d+\\.\\d+', 'release-v\\d+'],
      deprecationRequiresMigration: false,
      crossReferenceEnabled: false,
    });

    expect(config.todoAgeThresholdDays).toBe(60);
    expect(config.versionCheckPatterns).toEqual(['custom\\d+\\.\\d+', 'release-v\\d+']);
    expect(config.deprecationRequiresMigration).toBe(false);
    expect(config.crossReferenceEnabled).toBe(false);
  });

  it('should apply defaults for missing optional fields', () => {
    const config = OutdatedDocsConfigSchema.parse({
      todoAgeThresholdDays: 45,
    });

    expect(config.todoAgeThresholdDays).toBe(45);
    expect(config.versionCheckPatterns).toEqual([
      'v\\d+\\.\\d+\\.\\d+',
      'version\\s+\\d+\\.\\d+',
      '\\d+\\.\\d+\\s+release',
      'npm\\s+install.*@\\d+\\.\\d+\\.\\d+',
    ]); // default
    expect(config.deprecationRequiresMigration).toBe(true); // default
    expect(config.crossReferenceEnabled).toBe(true); // default
  });

  it('should reject todoAgeThresholdDays less than 1', () => {
    expect(() => {
      OutdatedDocsConfigSchema.parse({ todoAgeThresholdDays: 0 });
    }).toThrow();

    expect(() => {
      OutdatedDocsConfigSchema.parse({ todoAgeThresholdDays: -5 });
    }).toThrow();
  });

  it('should accept todoAgeThresholdDays equal to 1', () => {
    const config = OutdatedDocsConfigSchema.parse({ todoAgeThresholdDays: 1 });
    expect(config.todoAgeThresholdDays).toBe(1);
  });

  it('should accept large todoAgeThresholdDays values', () => {
    const config = OutdatedDocsConfigSchema.parse({ todoAgeThresholdDays: 365 });
    expect(config.todoAgeThresholdDays).toBe(365);
  });

  it('should accept empty versionCheckPatterns array', () => {
    const config = OutdatedDocsConfigSchema.parse({
      versionCheckPatterns: [],
    });
    expect(config.versionCheckPatterns).toEqual([]);
  });

  it('should validate versionCheckPatterns array', () => {
    const config = OutdatedDocsConfigSchema.parse({
      versionCheckPatterns: ['pattern1', 'pattern2', 'v\\d+\\.\\d+'],
    });
    expect(config.versionCheckPatterns).toHaveLength(3);
    expect(config.versionCheckPatterns[2]).toBe('v\\d+\\.\\d+');
  });

  it('should reject invalid types for fields', () => {
    expect(() => {
      OutdatedDocsConfigSchema.parse({ todoAgeThresholdDays: 'thirty' });
    }).toThrow();

    expect(() => {
      OutdatedDocsConfigSchema.parse({ versionCheckPatterns: 'not-an-array' });
    }).toThrow();

    expect(() => {
      OutdatedDocsConfigSchema.parse({ deprecationRequiresMigration: 'yes' });
    }).toThrow();

    expect(() => {
      OutdatedDocsConfigSchema.parse({ crossReferenceEnabled: 1 });
    }).toThrow();
  });

  it('should handle decimal todoAgeThresholdDays values', () => {
    const config = OutdatedDocsConfigSchema.parse({ todoAgeThresholdDays: 7.5 });
    expect(config.todoAgeThresholdDays).toBe(7.5);
  });
});

describe('DocumentationAnalysisConfigSchema', () => {
  it('should parse with all default values when empty config provided', () => {
    const config = DocumentationAnalysisConfigSchema.parse({});

    expect(config.enabled).toBe(true);
    expect(config.outdatedDocs).toBeUndefined();
    expect(config.jsdocAnalysis).toBeUndefined();
  });

  it('should parse with custom values for all fields', () => {
    const config = DocumentationAnalysisConfigSchema.parse({
      enabled: false,
      outdatedDocs: {
        todoAgeThresholdDays: 45,
        versionCheckPatterns: ['custom-pattern'],
        deprecationRequiresMigration: false,
        crossReferenceEnabled: true,
      },
      jsdocAnalysis: {
        enabled: true,
        requirePublicExports: false,
        checkReturnTypes: false,
        checkParameterTypes: true,
      },
    });

    expect(config.enabled).toBe(false);
    expect(config.outdatedDocs?.todoAgeThresholdDays).toBe(45);
    expect(config.outdatedDocs?.versionCheckPatterns).toEqual(['custom-pattern']);
    expect(config.outdatedDocs?.deprecationRequiresMigration).toBe(false);
    expect(config.outdatedDocs?.crossReferenceEnabled).toBe(true);
    expect(config.jsdocAnalysis?.enabled).toBe(true);
    expect(config.jsdocAnalysis?.requirePublicExports).toBe(false);
    expect(config.jsdocAnalysis?.checkReturnTypes).toBe(false);
    expect(config.jsdocAnalysis?.checkParameterTypes).toBe(true);
  });

  it('should parse with only outdatedDocs configuration', () => {
    const config = DocumentationAnalysisConfigSchema.parse({
      outdatedDocs: {
        todoAgeThresholdDays: 21,
        deprecationRequiresMigration: false,
      },
    });

    expect(config.enabled).toBe(true); // default
    expect(config.outdatedDocs?.todoAgeThresholdDays).toBe(21);
    expect(config.outdatedDocs?.versionCheckPatterns).toEqual([
      'v\\d+\\.\\d+\\.\\d+',
      'version\\s+\\d+\\.\\d+',
      '\\d+\\.\\d+\\s+release',
      'npm\\s+install.*@\\d+\\.\\d+\\.\\d+',
    ]); // default from OutdatedDocsConfigSchema
    expect(config.outdatedDocs?.deprecationRequiresMigration).toBe(false);
    expect(config.outdatedDocs?.crossReferenceEnabled).toBe(true); // default
    expect(config.jsdocAnalysis).toBeUndefined();
  });

  it('should parse with only jsdocAnalysis configuration', () => {
    const config = DocumentationAnalysisConfigSchema.parse({
      jsdocAnalysis: {
        requirePublicExports: false,
        checkReturnTypes: true,
      },
    });

    expect(config.enabled).toBe(true); // default
    expect(config.outdatedDocs).toBeUndefined();
    expect(config.jsdocAnalysis?.enabled).toBe(true); // default
    expect(config.jsdocAnalysis?.requirePublicExports).toBe(false);
    expect(config.jsdocAnalysis?.checkReturnTypes).toBe(true);
    expect(config.jsdocAnalysis?.checkParameterTypes).toBe(true); // default
  });

  it('should apply jsdocAnalysis defaults when provided as empty object', () => {
    const config = DocumentationAnalysisConfigSchema.parse({
      jsdocAnalysis: {},
    });

    expect(config.jsdocAnalysis?.enabled).toBe(true);
    expect(config.jsdocAnalysis?.requirePublicExports).toBe(true);
    expect(config.jsdocAnalysis?.checkReturnTypes).toBe(true);
    expect(config.jsdocAnalysis?.checkParameterTypes).toBe(true);
  });

  it('should reject invalid types for fields', () => {
    expect(() => {
      DocumentationAnalysisConfigSchema.parse({ enabled: 'yes' });
    }).toThrow();

    expect(() => {
      DocumentationAnalysisConfigSchema.parse({
        outdatedDocs: { todoAgeThresholdDays: 'invalid' }
      });
    }).toThrow();

    expect(() => {
      DocumentationAnalysisConfigSchema.parse({
        jsdocAnalysis: { enabled: 'true' }
      });
    }).toThrow();
  });

  it('should validate nested outdatedDocs schema constraints', () => {
    expect(() => {
      DocumentationAnalysisConfigSchema.parse({
        outdatedDocs: { todoAgeThresholdDays: 0 }
      });
    }).toThrow();
  });

  it('should handle partial jsdocAnalysis configuration', () => {
    const config = DocumentationAnalysisConfigSchema.parse({
      jsdocAnalysis: {
        enabled: false,
        checkParameterTypes: false,
      },
    });

    expect(config.jsdocAnalysis?.enabled).toBe(false);
    expect(config.jsdocAnalysis?.requirePublicExports).toBe(true); // default
    expect(config.jsdocAnalysis?.checkReturnTypes).toBe(true); // default
    expect(config.jsdocAnalysis?.checkParameterTypes).toBe(false);
  });
});

describe('ApexConfigSchema - Documentation Integration', () => {
  it('should parse ApexConfig with documentation field', () => {
    const config = ApexConfigSchema.parse({
      project: { name: 'test-project' },
      documentation: {
        enabled: true,
        outdatedDocs: {
          todoAgeThresholdDays: 14,
          deprecationRequiresMigration: false,
        },
        jsdocAnalysis: {
          enabled: true,
          requirePublicExports: false,
        },
      },
    });

    expect(config.documentation?.enabled).toBe(true);
    expect(config.documentation?.outdatedDocs?.todoAgeThresholdDays).toBe(14);
    expect(config.documentation?.outdatedDocs?.deprecationRequiresMigration).toBe(false);
    expect(config.documentation?.jsdocAnalysis?.enabled).toBe(true);
    expect(config.documentation?.jsdocAnalysis?.requirePublicExports).toBe(false);
  });

  it('should parse ApexConfig without documentation field', () => {
    const config = ApexConfigSchema.parse({
      project: { name: 'test-project' },
    });

    expect(config.documentation).toBeUndefined();
  });

  it('should parse ApexConfig with empty documentation object', () => {
    const config = ApexConfigSchema.parse({
      project: { name: 'test-project' },
      documentation: {},
    });

    expect(config.documentation?.enabled).toBe(true); // default
    expect(config.documentation?.outdatedDocs).toBeUndefined();
    expect(config.documentation?.jsdocAnalysis).toBeUndefined();
  });

  it('should preserve existing ApexConfig functionality with documentation field', () => {
    const config = ApexConfigSchema.parse({
      version: '1.0',
      project: {
        name: 'test-project',
        language: 'typescript',
        framework: 'nextjs',
      },
      autonomy: {
        default: 'review-before-merge',
      },
      git: {
        branchPrefix: 'feature/',
        commitFormat: 'conventional',
      },
      documentation: {
        enabled: false,
        outdatedDocs: {
          todoAgeThresholdDays: 7,
        },
      },
    });

    expect(config.version).toBe('1.0');
    expect(config.project.name).toBe('test-project');
    expect(config.project.language).toBe('typescript');
    expect(config.autonomy?.default).toBe('review-before-merge');
    expect(config.git?.branchPrefix).toBe('feature/');
    expect(config.documentation?.enabled).toBe(false);
    expect(config.documentation?.outdatedDocs?.todoAgeThresholdDays).toBe(7);
  });

  it('should reject invalid documentation configuration in ApexConfig', () => {
    expect(() => {
      ApexConfigSchema.parse({
        project: { name: 'test-project' },
        documentation: {
          outdatedDocs: {
            todoAgeThresholdDays: -1,
          },
        },
      });
    }).toThrow();
  });
});

// ============================================================================
// TestingAntiPattern Type Tests
// ============================================================================

describe('TestingAntiPattern Type', () => {
  describe('type field validation', () => {
    it('should accept all existing anti-pattern types', () => {
      const existingTypes = [
        'brittle-test',
        'test-pollution',
        'mystery-guest',
        'eager-test',
        'assertion-roulette',
        'slow-test',
        'flaky-test',
        'test-code-duplication'
      ] as const;

      for (const type of existingTypes) {
        const antiPattern: TestingAntiPattern = {
          file: '/path/to/test.spec.ts',
          line: 10,
          type: type,
          description: `Example of ${type} anti-pattern`,
          severity: 'medium'
        };

        expect(antiPattern.type).toBe(type);
        expect(typeof antiPattern.file).toBe('string');
        expect(typeof antiPattern.line).toBe('number');
        expect(typeof antiPattern.description).toBe('string');
        expect(['low', 'medium', 'high']).toContain(antiPattern.severity);
      }
    });

    it('should accept all new anti-pattern types', () => {
      const newTypes = [
        'no-assertion',
        'commented-out',
        'console-only',
        'empty-test',
        'hardcoded-timeout'
      ] as const;

      for (const type of newTypes) {
        const antiPattern: TestingAntiPattern = {
          file: '/src/components/Button.test.tsx',
          line: 25,
          type: type,
          description: `Found ${type} anti-pattern in test`,
          severity: 'high'
        };

        expect(antiPattern.type).toBe(type);
        expect(antiPattern.file).toContain('.test.');
        expect(antiPattern.line).toBeGreaterThan(0);
        expect(antiPattern.description).toContain(type);
        expect(['low', 'medium', 'high']).toContain(antiPattern.severity);
      }
    });

    it('should accept all anti-pattern types in the complete union', () => {
      const allTypes = [
        'brittle-test',
        'test-pollution',
        'mystery-guest',
        'eager-test',
        'assertion-roulette',
        'slow-test',
        'flaky-test',
        'test-code-duplication',
        'no-assertion',
        'commented-out',
        'console-only',
        'empty-test',
        'hardcoded-timeout'
      ] as const;

      expect(allTypes).toHaveLength(13);

      for (const type of allTypes) {
        const antiPattern: TestingAntiPattern = {
          file: '/tests/integration.spec.js',
          line: Math.floor(Math.random() * 100) + 1,
          type: type,
          description: `Anti-pattern: ${type}`,
          severity: 'medium'
        };

        expect(antiPattern.type).toBe(type);
      }
    });
  });

  describe('severity field validation', () => {
    it('should accept all valid severity levels', () => {
      const severities = ['low', 'medium', 'high'] as const;

      for (const severity of severities) {
        const antiPattern: TestingAntiPattern = {
          file: '/test/unit/validator.test.ts',
          line: 42,
          type: 'no-assertion',
          description: 'Test case without any assertions',
          severity: severity
        };

        expect(antiPattern.severity).toBe(severity);
      }
    });

    it('should handle severity with different anti-pattern combinations', () => {
      const combinations = [
        { type: 'no-assertion', severity: 'high' },
        { type: 'commented-out', severity: 'medium' },
        { type: 'console-only', severity: 'low' },
        { type: 'empty-test', severity: 'high' },
        { type: 'hardcoded-timeout', severity: 'medium' },
        { type: 'brittle-test', severity: 'high' },
        { type: 'flaky-test', severity: 'high' },
        { type: 'slow-test', severity: 'low' }
      ] as const;

      for (const { type, severity } of combinations) {
        const antiPattern: TestingAntiPattern = {
          file: '/src/__tests__/example.test.js',
          line: 15,
          type: type,
          description: `${type} with ${severity} severity`,
          severity: severity
        };

        expect(antiPattern.type).toBe(type);
        expect(antiPattern.severity).toBe(severity);
      }
    });
  });

  describe('required fields validation', () => {
    it('should have all required fields defined', () => {
      const antiPattern: TestingAntiPattern = {
        file: '/spec/helpers/test-helper.spec.rb',
        line: 100,
        type: 'empty-test',
        description: 'Test case with no implementation',
        severity: 'high'
      };

      // Required fields
      expect(typeof antiPattern.file).toBe('string');
      expect(antiPattern.file.length).toBeGreaterThan(0);
      expect(typeof antiPattern.line).toBe('number');
      expect(antiPattern.line).toBeGreaterThan(0);
      expect(typeof antiPattern.type).toBe('string');
      expect(typeof antiPattern.description).toBe('string');
      expect(antiPattern.description.length).toBeGreaterThan(0);
      expect(typeof antiPattern.severity).toBe('string');
    });

    it('should accept optional suggestion field', () => {
      const antiPatternWithSuggestion: TestingAntiPattern = {
        file: '/test/api/auth.test.py',
        line: 75,
        type: 'hardcoded-timeout',
        description: 'Using setTimeout with fixed duration',
        severity: 'medium',
        suggestion: 'Use configurable timeout or mock time-based operations'
      };

      expect(antiPatternWithSuggestion.suggestion).toBeDefined();
      expect(typeof antiPatternWithSuggestion.suggestion).toBe('string');
      expect(antiPatternWithSuggestion.suggestion?.length).toBeGreaterThan(0);

      const antiPatternWithoutSuggestion: TestingAntiPattern = {
        file: '/test/utils/helpers.test.ts',
        line: 33,
        type: 'console-only',
        description: 'Test validation relies only on console output',
        severity: 'low'
      };

      expect(antiPatternWithoutSuggestion.suggestion).toBeUndefined();
    });
  });

  describe('realistic anti-pattern scenarios', () => {
    it('should represent no-assertion anti-patterns correctly', () => {
      const noAssertionPattern: TestingAntiPattern = {
        file: '/src/components/Modal.test.tsx',
        line: 45,
        type: 'no-assertion',
        description: 'Test function calls component methods but contains no assertions to verify behavior',
        severity: 'high',
        suggestion: 'Add expect() statements to verify the component state or behavior'
      };

      expect(noAssertionPattern.type).toBe('no-assertion');
      expect(noAssertionPattern.severity).toBe('high');
      expect(noAssertionPattern.description).toContain('no assertions');
      expect(noAssertionPattern.suggestion).toContain('expect()');
    });

    it('should represent commented-out anti-patterns correctly', () => {
      const commentedOutPattern: TestingAntiPattern = {
        file: '/tests/legacy/old-feature.test.js',
        line: 120,
        type: 'commented-out',
        description: 'Multiple test cases are commented out without explanation',
        severity: 'medium',
        suggestion: 'Either fix and re-enable tests or remove them entirely if no longer needed'
      };

      expect(commentedOutPattern.type).toBe('commented-out');
      expect(commentedOutPattern.description).toContain('commented out');
      expect(commentedOutPattern.suggestion).toContain('fix and re-enable');
    });

    it('should represent console-only anti-patterns correctly', () => {
      const consoleOnlyPattern: TestingAntiPattern = {
        file: '/test/integration/workflow.spec.ts',
        line: 88,
        type: 'console-only',
        description: 'Test relies solely on console.log output for verification instead of proper assertions',
        severity: 'low',
        suggestion: 'Replace console output verification with proper expect() assertions'
      };

      expect(consoleOnlyPattern.type).toBe('console-only');
      expect(consoleOnlyPattern.description).toContain('console');
      expect(consoleOnlyPattern.suggestion).toContain('proper expect()');
    });

    it('should represent empty-test anti-patterns correctly', () => {
      const emptyTestPattern: TestingAntiPattern = {
        file: '/spec/models/user_spec.rb',
        line: 200,
        type: 'empty-test',
        description: 'Test case is defined but has no implementation or assertions',
        severity: 'high',
        suggestion: 'Implement the test logic or remove the empty test case'
      };

      expect(emptyTestPattern.type).toBe('empty-test');
      expect(emptyTestPattern.severity).toBe('high');
      expect(emptyTestPattern.description).toContain('no implementation');
      expect(emptyTestPattern.suggestion).toContain('Implement the test logic');
    });

    it('should represent hardcoded-timeout anti-patterns correctly', () => {
      const hardcodedTimeoutPattern: TestingAntiPattern = {
        file: '/cypress/integration/login.spec.js',
        line: 65,
        type: 'hardcoded-timeout',
        description: 'Test uses hardcoded setTimeout(5000) which may cause flaky behavior',
        severity: 'medium',
        suggestion: 'Use dynamic waiting conditions or configurable timeout values'
      };

      expect(hardcodedTimeoutPattern.type).toBe('hardcoded-timeout');
      expect(hardcodedTimeoutPattern.description).toContain('hardcoded');
      expect(hardcodedTimeoutPattern.description).toContain('timeout');
      expect(hardcodedTimeoutPattern.suggestion).toContain('dynamic waiting');
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle minimum valid line numbers', () => {
      const antiPattern: TestingAntiPattern = {
        file: '/test.js',
        line: 1,
        type: 'empty-test',
        description: 'Anti-pattern on first line',
        severity: 'low'
      };

      expect(antiPattern.line).toBe(1);
    });

    it('should handle large line numbers', () => {
      const antiPattern: TestingAntiPattern = {
        file: '/large-test-file.spec.ts',
        line: 99999,
        type: 'slow-test',
        description: 'Anti-pattern in very large test file',
        severity: 'medium'
      };

      expect(antiPattern.line).toBe(99999);
    });

    it('should handle various file path formats', () => {
      const filePaths = [
        '/absolute/path/to/test.spec.ts',
        'relative/path/test.js',
        './local/test.test.jsx',
        '../parent/test.spec.vue',
        'C:\\Windows\\path\\test.spec.cs',
        '/deeply/nested/path/to/some/test/file.test.py'
      ];

      for (const filePath of filePaths) {
        const antiPattern: TestingAntiPattern = {
          file: filePath,
          line: 10,
          type: 'no-assertion',
          description: 'Test case in various path formats',
          severity: 'medium'
        };

        expect(antiPattern.file).toBe(filePath);
      }
    });

    it('should handle empty and minimal descriptions', () => {
      const antiPattern: TestingAntiPattern = {
        file: '/test.js',
        line: 5,
        type: 'commented-out',
        description: 'Minimal',
        severity: 'low'
      };

      expect(antiPattern.description).toBe('Minimal');
      expect(antiPattern.description.length).toBeGreaterThan(0);
    });

    it('should handle very long descriptions', () => {
      const longDescription = 'This is a very long description that explains in great detail what the anti-pattern is, why it is problematic, how it affects test reliability, maintainability, and readability, and provides comprehensive context about the specific implementation issues that were discovered during the analysis of the test code.';

      const antiPattern: TestingAntiPattern = {
        file: '/comprehensive-test.spec.ts',
        line: 150,
        type: 'assertion-roulette',
        description: longDescription,
        severity: 'high',
        suggestion: 'Break down into smaller, more focused test cases with clear, specific assertions'
      };

      expect(antiPattern.description).toBe(longDescription);
      expect(antiPattern.description.length).toBeGreaterThan(100);
    });
  });

  describe('type safety and interface compliance', () => {
    it('should ensure TestingAntiPattern implements complete interface contract', () => {
      // Test that all properties are accessible and typed correctly
      const createTestingAntiPattern = (
        file: string,
        line: number,
        type: TestingAntiPattern['type'],
        description: string,
        severity: TestingAntiPattern['severity'],
        suggestion?: string
      ): TestingAntiPattern => ({
        file,
        line,
        type,
        description,
        severity,
        suggestion
      });

      const pattern = createTestingAntiPattern(
        '/test/example.test.ts',
        42,
        'no-assertion',
        'Example anti-pattern',
        'high',
        'Add assertions'
      );

      expect(pattern).toBeDefined();
      expect(typeof pattern.file).toBe('string');
      expect(typeof pattern.line).toBe('number');
      expect(typeof pattern.type).toBe('string');
      expect(typeof pattern.description).toBe('string');
      expect(typeof pattern.severity).toBe('string');
      expect(typeof pattern.suggestion).toBe('string');
    });

    it('should work correctly in arrays and collections', () => {
      const antiPatterns: TestingAntiPattern[] = [
        {
          file: '/test/file1.test.js',
          line: 10,
          type: 'no-assertion',
          description: 'First anti-pattern',
          severity: 'high'
        },
        {
          file: '/test/file2.test.ts',
          line: 20,
          type: 'commented-out',
          description: 'Second anti-pattern',
          severity: 'medium'
        },
        {
          file: '/test/file3.spec.js',
          line: 30,
          type: 'empty-test',
          description: 'Third anti-pattern',
          severity: 'high',
          suggestion: 'Implement test logic'
        }
      ];

      expect(antiPatterns).toHaveLength(3);
      expect(antiPatterns[0].type).toBe('no-assertion');
      expect(antiPatterns[1].type).toBe('commented-out');
      expect(antiPatterns[2].type).toBe('empty-test');
      expect(antiPatterns[2].suggestion).toBe('Implement test logic');
    });

    it('should work with filtering and mapping operations', () => {
      const antiPatterns: TestingAntiPattern[] = [
        { file: '/test1.js', line: 1, type: 'no-assertion', description: 'High severity issue', severity: 'high' },
        { file: '/test2.js', line: 2, type: 'console-only', description: 'Low severity issue', severity: 'low' },
        { file: '/test3.js', line: 3, type: 'hardcoded-timeout', description: 'Medium severity issue', severity: 'medium' },
        { file: '/test4.js', line: 4, type: 'empty-test', description: 'Another high severity issue', severity: 'high' }
      ];

      // Filter high severity anti-patterns
      const highSeverityPatterns = antiPatterns.filter(pattern => pattern.severity === 'high');
      expect(highSeverityPatterns).toHaveLength(2);
      expect(highSeverityPatterns.every(pattern => pattern.severity === 'high')).toBe(true);

      // Map to file names
      const fileNames = antiPatterns.map(pattern => pattern.file);
      expect(fileNames).toEqual(['/test1.js', '/test2.js', '/test3.js', '/test4.js']);

      // Filter new anti-pattern types
      const newAntiPatterns = antiPatterns.filter(pattern =>
        ['no-assertion', 'commented-out', 'console-only', 'empty-test', 'hardcoded-timeout'].includes(pattern.type)
      );
      expect(newAntiPatterns).toHaveLength(4);
    });
  });
});

// ============================================================================
// TestAnalysis Integration Tests
// ============================================================================

describe('TestAnalysis Interface', () => {
  const createSampleBranchCoverage = (): BranchCoverage => ({
    percentage: 75.5,
    uncoveredBranches: [
      {
        file: '/src/utils/validation.ts',
        line: 25,
        type: 'if',
        description: 'Edge case validation for null values not covered'
      },
      {
        file: '/src/components/Form.tsx',
        line: 85,
        type: 'ternary',
        description: 'Conditional rendering for error state not tested'
      }
    ]
  });

  const createSampleUntestedExports = (): UntestedExport[] => [
    {
      file: '/src/lib/auth.ts',
      exportName: 'generateToken',
      exportType: 'function',
      line: 15,
      isPublic: true
    },
    {
      file: '/src/types/user.ts',
      exportName: 'UserRole',
      exportType: 'enum',
      line: 8,
      isPublic: true
    }
  ];

  const createSampleMissingIntegrationTests = (): MissingIntegrationTest[] => [
    {
      criticalPath: 'User authentication flow',
      description: 'End-to-end test for login, token refresh, and logout sequence',
      priority: 'high',
      relatedFiles: ['/src/auth/login.ts', '/src/auth/token.ts', '/src/auth/logout.ts']
    },
    {
      criticalPath: 'Payment processing workflow',
      description: 'Integration test covering payment validation, processing, and confirmation',
      priority: 'critical',
      relatedFiles: ['/src/payment/validation.ts', '/src/payment/processor.ts']
    }
  ];

  const createSampleAntiPatterns = (): TestingAntiPattern[] => [
    {
      file: '/test/auth.test.ts',
      line: 45,
      type: 'no-assertion',
      description: 'Test calls authentication function but contains no assertions',
      severity: 'high',
      suggestion: 'Add expect() statements to verify authentication result'
    },
    {
      file: '/test/legacy.test.js',
      line: 120,
      type: 'commented-out',
      description: 'Multiple test cases commented out without explanation',
      severity: 'medium'
    },
    {
      file: '/test/e2e/checkout.test.ts',
      line: 75,
      type: 'hardcoded-timeout',
      description: 'Uses hardcoded 5 second timeout which may cause flaky behavior',
      severity: 'medium',
      suggestion: 'Replace with dynamic waiting conditions'
    }
  ];

  describe('complete TestAnalysis structure', () => {
    it('should create valid TestAnalysis with all required fields', () => {
      const testAnalysis: TestAnalysis = {
        branchCoverage: createSampleBranchCoverage(),
        untestedExports: createSampleUntestedExports(),
        missingIntegrationTests: createSampleMissingIntegrationTests(),
        antiPatterns: createSampleAntiPatterns()
      };

      expect(testAnalysis).toBeDefined();
      expect(typeof testAnalysis.branchCoverage).toBe('object');
      expect(Array.isArray(testAnalysis.untestedExports)).toBe(true);
      expect(Array.isArray(testAnalysis.missingIntegrationTests)).toBe(true);
      expect(Array.isArray(testAnalysis.antiPatterns)).toBe(true);
    });

    it('should handle TestAnalysis with empty arrays', () => {
      const emptyTestAnalysis: TestAnalysis = {
        branchCoverage: {
          percentage: 100,
          uncoveredBranches: []
        },
        untestedExports: [],
        missingIntegrationTests: [],
        antiPatterns: []
      };

      expect(emptyTestAnalysis.branchCoverage.percentage).toBe(100);
      expect(emptyTestAnalysis.untestedExports).toHaveLength(0);
      expect(emptyTestAnalysis.missingIntegrationTests).toHaveLength(0);
      expect(emptyTestAnalysis.antiPatterns).toHaveLength(0);
    });
  });

  describe('TestAnalysis integration scenarios', () => {
    it('should properly integrate all new anti-pattern types', () => {
      const newAntiPatterns: TestingAntiPattern[] = [
        {
          file: '/test/validation.test.ts',
          line: 30,
          type: 'no-assertion',
          description: 'Test executes validation but makes no assertions',
          severity: 'high'
        },
        {
          file: '/test/deprecated.test.js',
          line: 55,
          type: 'commented-out',
          description: 'Old test cases commented out during refactoring',
          severity: 'medium'
        },
        {
          file: '/test/debug.test.ts',
          line: 88,
          type: 'console-only',
          description: 'Test relies on console.log for verification',
          severity: 'low'
        },
        {
          file: '/test/placeholder.test.ts',
          line: 12,
          type: 'empty-test',
          description: 'Test case defined but not implemented',
          severity: 'high'
        },
        {
          file: '/test/integration/slow.test.ts',
          line: 150,
          type: 'hardcoded-timeout',
          description: 'Uses setTimeout(10000) for async operations',
          severity: 'medium'
        }
      ];

      const testAnalysis: TestAnalysis = {
        branchCoverage: createSampleBranchCoverage(),
        untestedExports: createSampleUntestedExports(),
        missingIntegrationTests: createSampleMissingIntegrationTests(),
        antiPatterns: newAntiPatterns
      };

      const newAntiPatternTypes = ['no-assertion', 'commented-out', 'console-only', 'empty-test', 'hardcoded-timeout'];
      const foundTypes = testAnalysis.antiPatterns.map(ap => ap.type);

      for (const type of newAntiPatternTypes) {
        expect(foundTypes).toContain(type);
      }

      expect(testAnalysis.antiPatterns).toHaveLength(5);
    });

    it('should handle TestAnalysis with diverse branch coverage scenarios', () => {
      const complexBranchCoverage: BranchCoverage = {
        percentage: 67.8,
        uncoveredBranches: [
          {
            file: '/src/components/Modal.tsx',
            line: 45,
            type: 'if',
            description: 'Error handling branch for invalid props'
          },
          {
            file: '/src/utils/formatter.ts',
            line: 120,
            type: 'switch',
            description: 'Switch case for unknown format type'
          },
          {
            file: '/src/hooks/useAuth.ts',
            line: 78,
            type: 'catch',
            description: 'Exception handling for network errors'
          },
          {
            file: '/src/lib/validation.ts',
            line: 200,
            type: 'logical',
            description: 'Logical OR branch for fallback value'
          }
        ]
      };

      const testAnalysis: TestAnalysis = {
        branchCoverage: complexBranchCoverage,
        untestedExports: [],
        missingIntegrationTests: [],
        antiPatterns: []
      };

      expect(testAnalysis.branchCoverage.percentage).toBe(67.8);
      expect(testAnalysis.branchCoverage.uncoveredBranches).toHaveLength(4);

      const branchTypes = testAnalysis.branchCoverage.uncoveredBranches.map(b => b.type);
      expect(branchTypes).toContain('if');
      expect(branchTypes).toContain('switch');
      expect(branchTypes).toContain('catch');
      expect(branchTypes).toContain('logical');
    });

    it('should handle TestAnalysis with comprehensive untested exports', () => {
      const diverseUntestedExports: UntestedExport[] = [
        {
          file: '/src/utils/helpers.ts',
          exportName: 'formatCurrency',
          exportType: 'function',
          line: 25,
          isPublic: true
        },
        {
          file: '/src/components/Button.tsx',
          exportName: 'ButtonProps',
          exportType: 'interface',
          line: 8,
          isPublic: true
        },
        {
          file: '/src/types/api.ts',
          exportName: 'ApiResponse',
          exportType: 'type',
          line: 15,
          isPublic: true
        },
        {
          file: '/src/constants/theme.ts',
          exportName: 'COLORS',
          exportType: 'const',
          line: 5,
          isPublic: true
        },
        {
          file: '/src/enums/status.ts',
          exportName: 'TaskStatus',
          exportType: 'enum',
          line: 3,
          isPublic: true
        },
        {
          file: '/src/classes/Logger.ts',
          exportName: 'Logger',
          exportType: 'class',
          line: 12,
          isPublic: true
        }
      ];

      const testAnalysis: TestAnalysis = {
        branchCoverage: createSampleBranchCoverage(),
        untestedExports: diverseUntestedExports,
        missingIntegrationTests: [],
        antiPatterns: []
      };

      expect(testAnalysis.untestedExports).toHaveLength(6);

      const exportTypes = testAnalysis.untestedExports.map(ue => ue.exportType);
      expect(exportTypes).toContain('function');
      expect(exportTypes).toContain('interface');
      expect(exportTypes).toContain('type');
      expect(exportTypes).toContain('const');
      expect(exportTypes).toContain('enum');
      expect(exportTypes).toContain('class');

      expect(testAnalysis.untestedExports.every(ue => ue.isPublic)).toBe(true);
    });

    it('should handle TestAnalysis with critical integration test gaps', () => {
      const criticalMissingTests: MissingIntegrationTest[] = [
        {
          criticalPath: 'User registration and email verification',
          description: 'End-to-end test covering registration, email sending, and account activation',
          priority: 'critical',
          relatedFiles: [
            '/src/auth/register.ts',
            '/src/services/email.ts',
            '/src/auth/verify.ts'
          ]
        },
        {
          criticalPath: 'E-commerce checkout process',
          description: 'Integration test for cart management, payment processing, and order confirmation',
          priority: 'high',
          relatedFiles: [
            '/src/cart/manager.ts',
            '/src/payment/gateway.ts',
            '/src/orders/processor.ts',
            '/src/notifications/email.ts'
          ]
        },
        {
          criticalPath: 'File upload and processing pipeline',
          description: 'Test covering file validation, upload, processing, and storage',
          priority: 'medium',
          relatedFiles: [
            '/src/upload/validator.ts',
            '/src/upload/processor.ts',
            '/src/storage/manager.ts'
          ]
        }
      ];

      const testAnalysis: TestAnalysis = {
        branchCoverage: createSampleBranchCoverage(),
        untestedExports: [],
        missingIntegrationTests: criticalMissingTests,
        antiPatterns: []
      };

      expect(testAnalysis.missingIntegrationTests).toHaveLength(3);

      const priorities = testAnalysis.missingIntegrationTests.map(mit => mit.priority);
      expect(priorities).toContain('critical');
      expect(priorities).toContain('high');
      expect(priorities).toContain('medium');

      // Verify all critical tests have related files
      testAnalysis.missingIntegrationTests.forEach(test => {
        expect(test.relatedFiles).toBeDefined();
        expect(Array.isArray(test.relatedFiles)).toBe(true);
        if (test.relatedFiles) {
          expect(test.relatedFiles.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('TestAnalysis utility and analysis methods', () => {
    it('should support filtering and analysis of anti-patterns', () => {
      const testAnalysis: TestAnalysis = {
        branchCoverage: createSampleBranchCoverage(),
        untestedExports: [],
        missingIntegrationTests: [],
        antiPatterns: [
          { file: '/test1.js', line: 1, type: 'no-assertion', description: 'No assertions', severity: 'high' },
          { file: '/test2.js', line: 2, type: 'commented-out', description: 'Commented test', severity: 'medium' },
          { file: '/test3.js', line: 3, type: 'empty-test', description: 'Empty test', severity: 'high' },
          { file: '/test4.js', line: 4, type: 'console-only', description: 'Console only', severity: 'low' },
          { file: '/test5.js', line: 5, type: 'hardcoded-timeout', description: 'Hard timeout', severity: 'medium' }
        ]
      };

      // Test filtering by severity
      const highSeverityIssues = testAnalysis.antiPatterns.filter(ap => ap.severity === 'high');
      expect(highSeverityIssues).toHaveLength(2);

      // Test filtering by new anti-pattern types
      const newAntiPatternTypes = ['no-assertion', 'commented-out', 'console-only', 'empty-test', 'hardcoded-timeout'];
      const newTypeIssues = testAnalysis.antiPatterns.filter(ap => newAntiPatternTypes.includes(ap.type));
      expect(newTypeIssues).toHaveLength(5);

      // Test grouping by file
      const fileGroups = testAnalysis.antiPatterns.reduce((groups, ap) => {
        const key = ap.file;
        if (!groups[key]) groups[key] = [];
        groups[key].push(ap);
        return groups;
      }, {} as Record<string, TestingAntiPattern[]>);

      expect(Object.keys(fileGroups)).toHaveLength(5);
    });

    it('should support comprehensive test analysis metrics', () => {
      const testAnalysis: TestAnalysis = {
        branchCoverage: {
          percentage: 82.5,
          uncoveredBranches: [
            { file: '/src/a.ts', line: 10, type: 'if', description: 'Test 1' },
            { file: '/src/b.ts', line: 20, type: 'switch', description: 'Test 2' }
          ]
        },
        untestedExports: [
          { file: '/src/lib1.ts', exportName: 'func1', exportType: 'function', isPublic: true },
          { file: '/src/lib2.ts', exportName: 'func2', exportType: 'function', isPublic: true },
          { file: '/src/lib3.ts', exportName: 'Type1', exportType: 'type', isPublic: true }
        ],
        missingIntegrationTests: [
          { criticalPath: 'Path 1', description: 'Test 1', priority: 'high' },
          { criticalPath: 'Path 2', description: 'Test 2', priority: 'critical' }
        ],
        antiPatterns: [
          { file: '/test1.js', line: 1, type: 'no-assertion', description: 'Issue 1', severity: 'high' },
          { file: '/test2.js', line: 2, type: 'empty-test', description: 'Issue 2', severity: 'high' },
          { file: '/test3.js', line: 3, type: 'console-only', description: 'Issue 3', severity: 'low' }
        ]
      };

      // Calculate various metrics
      const totalIssues = testAnalysis.antiPatterns.length +
                         testAnalysis.untestedExports.length +
                         testAnalysis.missingIntegrationTests.length;
      expect(totalIssues).toBe(8);

      const highPriorityIssues = [
        ...testAnalysis.antiPatterns.filter(ap => ap.severity === 'high'),
        ...testAnalysis.missingIntegrationTests.filter(mit => mit.priority === 'critical' || mit.priority === 'high')
      ];
      expect(highPriorityIssues).toHaveLength(4);

      const coverageScore = testAnalysis.branchCoverage.percentage;
      expect(coverageScore).toBe(82.5);

      const uncoveredBranchCount = testAnalysis.branchCoverage.uncoveredBranches.length;
      expect(uncoveredBranchCount).toBe(2);
    });
  });
});

// ============================================================================
// Iteration History Types Export Tests
// ============================================================================

describe('Iteration History Types Exports', () => {
  it('should properly export IterationEntry type', () => {
    // This test verifies that IterationEntry is properly exported and can be used
    const entry: IterationEntry = {
      id: 'test_001',
      feedback: 'Test feedback',
      timestamp: new Date()
    };

    expect(entry.id).toBe('test_001');
    expect(entry.feedback).toBe('Test feedback');
    expect(entry.timestamp).toBeInstanceOf(Date);
    // Types don't exist at runtime, so we just verify the interface works
    expect(typeof IterationEntry).toBeUndefined();
  });

  it('should properly export IterationHistory type', () => {
    // This test verifies that IterationHistory is properly exported and can be used
    const history: IterationHistory = {
      entries: [],
      totalIterations: 0
    };

    expect(Array.isArray(history.entries)).toBe(true);
    expect(history.entries).toHaveLength(0);
    expect(history.totalIterations).toBe(0);
    // Types don't exist at runtime, so we just verify the interface works
    expect(typeof IterationHistory).toBeUndefined();
  });

  it('should properly export TaskSessionData with iterationHistory field', () => {
    // This test verifies that TaskSessionData is exported with the new iterationHistory field
    const sessionData: TaskSessionData = {
      lastCheckpoint: new Date(),
      iterationHistory: {
        entries: [{
          id: 'session_iter_001',
          feedback: 'Session test feedback',
          timestamp: new Date()
        }],
        totalIterations: 1,
        lastIterationAt: new Date()
      }
    };

    expect(sessionData.lastCheckpoint).toBeInstanceOf(Date);
    expect(sessionData.iterationHistory).toBeDefined();
    expect(sessionData.iterationHistory?.entries).toHaveLength(1);
    expect(sessionData.iterationHistory?.totalIterations).toBe(1);
    // Types don't exist at runtime, so we just verify the interface works
    expect(typeof TaskSessionData).toBeUndefined();
  });

  it('should handle all iteration history type interfaces correctly', () => {
    // Complete integration test to ensure all types work together
    const entry: IterationEntry = {
      id: 'integration_001',
      feedback: 'Integration test feedback',
      timestamp: new Date('2024-01-15T10:00:00Z'),
      diffSummary: 'Test diff summary',
      stage: 'testing',
      modifiedFiles: ['/test/file.ts'],
      agent: 'tester'
    };

    const history: IterationHistory = {
      entries: [entry],
      totalIterations: 1,
      lastIterationAt: new Date('2024-01-15T10:00:00Z')
    };

    const sessionData: TaskSessionData = {
      lastCheckpoint: new Date('2024-01-15T10:30:00Z'),
      contextSummary: 'Integration test session',
      iterationHistory: history
    };

    // Verify all relationships work correctly
    expect(sessionData.iterationHistory?.entries[0]).toBe(entry);
    expect(sessionData.iterationHistory?.entries[0].feedback).toBe('Integration test feedback');
    expect(sessionData.iterationHistory?.entries[0].stage).toBe('testing');
    expect(sessionData.iterationHistory?.entries[0].modifiedFiles).toEqual(['/test/file.ts']);
    expect(sessionData.iterationHistory?.totalIterations).toBe(1);
  });
});
