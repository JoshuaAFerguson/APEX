import { describe, it, expect } from 'vitest';
import {
  ApexConfig,
  UIConfig,
  UIConfigSchema,
  DaemonConfig,
  DaemonConfigSchema,
  ApexConfigSchema,
  AgentDefinition,
  WorkflowDefinition,
  TaskStatus,
  AutonomyLevel,
  AgentModel,
  DisplayMode,
  VerboseDebugData,
  AgentUsage,
} from '../types';

describe.skip('Type Exports for CLI Integration', () => {
  describe('UIConfig type and schema exports', () => {
    it('should export UIConfig type correctly', () => {
      // Test that UIConfig type can be used for type annotations
      const uiConfig: UIConfig = {
        previewMode: true,
        previewConfidence: 0.8,
        autoExecuteHighConfidence: false,
        previewTimeout: 6000,
      };

      expect(uiConfig.previewMode).toBe(true);
      expect(uiConfig.previewConfidence).toBe(0.8);
      expect(uiConfig.autoExecuteHighConfidence).toBe(false);
      expect(uiConfig.previewTimeout).toBe(6000);
    });

    it('should export UIConfig with optional fields', () => {
      const partialUIConfig: UIConfig = {
        previewMode: false,
      };

      expect(partialUIConfig.previewMode).toBe(false);
      expect(partialUIConfig.previewConfidence).toBeUndefined();
      expect(partialUIConfig.autoExecuteHighConfidence).toBeUndefined();
      expect(partialUIConfig.previewTimeout).toBeUndefined();
    });

    it('should export UIConfigSchema for runtime validation', () => {
      const validConfig = {
        previewMode: true,
        previewConfidence: 0.75,
        autoExecuteHighConfidence: true,
        previewTimeout: 7500,
      };

      const result = UIConfigSchema.parse(validConfig);
      expect(result).toEqual(validConfig);

      // Schema should reject invalid data
      expect(() => UIConfigSchema.parse({ previewConfidence: 1.5 })).toThrow();
      expect(() => UIConfigSchema.parse({ previewTimeout: 500 })).toThrow();
    });
  });

  describe('DaemonConfig type and schema exports', () => {
    it('should export DaemonConfig type correctly', () => {
      // Test that DaemonConfig type can be used for type annotations
      const daemonConfig: DaemonConfig = {
        pollInterval: 10000,
        autoStart: true,
        logLevel: 'debug',
      };

      expect(daemonConfig.pollInterval).toBe(10000);
      expect(daemonConfig.autoStart).toBe(true);
      expect(daemonConfig.logLevel).toBe('debug');
    });

    it('should export DaemonConfig with optional fields', () => {
      const partialDaemonConfig: DaemonConfig = {
        autoStart: true,
      };

      expect(partialDaemonConfig.autoStart).toBe(true);
      expect(partialDaemonConfig.pollInterval).toBeUndefined();
      expect(partialDaemonConfig.logLevel).toBeUndefined();
    });

    it('should export DaemonConfigSchema for runtime validation', () => {
      const validConfig = {
        pollInterval: 8000,
        autoStart: false,
        logLevel: 'warn',
      };

      const result = DaemonConfigSchema.parse(validConfig);
      expect(result).toEqual(validConfig);

      // Schema should reject invalid data
      expect(() => DaemonConfigSchema.parse({ logLevel: 'invalid' })).toThrow();
      expect(() => DaemonConfigSchema.parse({ pollInterval: 'not-a-number' })).toThrow();
      expect(() => DaemonConfigSchema.parse({ autoStart: 'not-boolean' })).toThrow();
    });

    it('should apply defaults correctly via schema', () => {
      const emptyConfig = {};
      const result = DaemonConfigSchema.parse(emptyConfig);

      expect(result.pollInterval).toBe(5000);
      expect(result.autoStart).toBe(false);
      expect(result.logLevel).toBe('info');
    });
  });

  describe('ApexConfig integration with UIConfig and DaemonConfig', () => {
    it('should export ApexConfig with proper UIConfig integration', () => {
      const fullConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'export-test',
          language: 'typescript',
          framework: 'react',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: false,
          previewConfidence: 0.85,
          autoExecuteHighConfidence: true,
          previewTimeout: 10000,
        },
        daemon: {
          pollInterval: 15000,
          autoStart: true,
          logLevel: 'warn',
        },
        autonomy: {
          default: 'review-before-merge',
        },
        limits: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 5.0,
        },
      };

      expect(fullConfig.ui?.previewMode).toBe(false);
      expect(fullConfig.ui?.previewConfidence).toBe(0.85);
      expect(fullConfig.ui?.autoExecuteHighConfidence).toBe(true);
      expect(fullConfig.ui?.previewTimeout).toBe(10000);
      expect(fullConfig.daemon?.pollInterval).toBe(15000);
      expect(fullConfig.daemon?.autoStart).toBe(true);
      expect(fullConfig.daemon?.logLevel).toBe('warn');
    });

    it('should allow ApexConfig without ui field', () => {
      const configWithoutUI: ApexConfig = {
        version: '1.0',
        project: {
          name: 'no-ui-export-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      expect(configWithoutUI.ui).toBeUndefined();
    });

    it('should allow ApexConfig with daemon but without ui field', () => {
      const configWithDaemonOnly: ApexConfig = {
        version: '1.0',
        project: {
          name: 'daemon-only-export-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        daemon: {
          pollInterval: 12000,
          autoStart: false,
          logLevel: 'error',
        },
      };

      expect(configWithDaemonOnly.ui).toBeUndefined();
      expect(configWithDaemonOnly.daemon?.pollInterval).toBe(12000);
      expect(configWithDaemonOnly.daemon?.autoStart).toBe(false);
      expect(configWithDaemonOnly.daemon?.logLevel).toBe('error');
    });

    it('should validate ApexConfig with UIConfig via schema', () => {
      const validApexConfig = {
        version: '1.0',
        project: {
          name: 'schema-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.9,
          autoExecuteHighConfidence: false,
          previewTimeout: 8000,
        },
      };

      const result = ApexConfigSchema.parse(validApexConfig);
      expect(result.ui?.previewMode).toBe(true);
      expect(result.ui?.previewConfidence).toBe(0.9);
      expect(result.ui?.autoExecuteHighConfidence).toBe(false);
      expect(result.ui?.previewTimeout).toBe(8000);
    });

    it('should validate ApexConfig with both UIConfig and DaemonConfig via schema', () => {
      const validApexConfigWithBoth = {
        version: '1.0',
        project: {
          name: 'both-configs-schema-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: false,
          previewConfidence: 0.75,
          autoExecuteHighConfidence: true,
          previewTimeout: 6000,
        },
        daemon: {
          pollInterval: 20000,
          autoStart: true,
          logLevel: 'debug',
        },
      };

      const result = ApexConfigSchema.parse(validApexConfigWithBoth);

      // Validate UI config
      expect(result.ui?.previewMode).toBe(false);
      expect(result.ui?.previewConfidence).toBe(0.75);
      expect(result.ui?.autoExecuteHighConfidence).toBe(true);
      expect(result.ui?.previewTimeout).toBe(6000);

      // Validate daemon config
      expect(result.daemon?.pollInterval).toBe(20000);
      expect(result.daemon?.autoStart).toBe(true);
      expect(result.daemon?.logLevel).toBe('debug');
    });
  });

  describe('All exported types for CLI compatibility', () => {
    it('should export all required types for CLI usage', () => {
      // Test that all major types are exported and can be used

      const agentDef: AgentDefinition = {
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'You are a test agent',
        tools: ['Read', 'Write'],
        model: 'sonnet',
      };

      const workflowDef: WorkflowDefinition = {
        name: 'test-workflow',
        description: 'Test workflow',
        stages: [
          {
            name: 'test-stage',
            agent: 'test-agent',
          },
        ],
      };

      const status: TaskStatus = 'in-progress';
      const autonomy: AutonomyLevel = 'review-before-merge';
      const model: AgentModel = 'opus';
      const display: DisplayMode = 'verbose';

      const usage: AgentUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationInputTokens: 100,
        cacheReadInputTokens: 50,
      };

      const debugData: VerboseDebugData = {
        agentTokens: { 'test-agent': usage },
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
          tokensPerSecond: 10.0,
          averageResponseTime: 2000,
          toolEfficiency: {},
        },
      };

      // All types should be properly typed
      expect(agentDef.name).toBe('test-agent');
      expect(workflowDef.name).toBe('test-workflow');
      expect(status).toBe('in-progress');
      expect(autonomy).toBe('review-before-merge');
      expect(model).toBe('opus');
      expect(display).toBe('verbose');
      expect(usage.inputTokens).toBe(1000);
      expect(debugData.agentTokens['test-agent'].inputTokens).toBe(1000);
    });
  });

  describe('Type utility and inference', () => {
    it('should allow type inference for UI config fields', () => {
      // Test that TypeScript can properly infer types
      const inferredConfig = {
        previewMode: true,
        previewConfidence: 0.8,
        autoExecuteHighConfidence: false,
        previewTimeout: 5000,
      };

      // This should be assignable to UIConfig
      const typedConfig: UIConfig = inferredConfig;
      expect(typedConfig.previewMode).toBe(true);
    });

    it('should support partial UI config types', () => {
      // Test Partial<UIConfig> usage
      const partialUpdate: Partial<UIConfig> = {
        previewConfidence: 0.9,
      };

      const baseConfig: UIConfig = {
        previewMode: true,
        previewConfidence: 0.7,
        autoExecuteHighConfidence: false,
        previewTimeout: 5000,
      };

      const mergedConfig: UIConfig = { ...baseConfig, ...partialUpdate };
      expect(mergedConfig.previewConfidence).toBe(0.9);
      expect(mergedConfig.previewMode).toBe(true); // preserved from base
    });

    it('should support required vs optional field semantics', () => {
      // All UIConfig fields are optional with defaults
      const emptyConfig: UIConfig = {};
      expect(typeof emptyConfig).toBe('object');

      // But ApexConfig requires certain fields
      const minimalApexConfig: ApexConfig = {
        project: {
          name: 'required-test',
        },
      };
      expect(minimalApexConfig.project.name).toBe('required-test');
    });
  });

  describe('Runtime type checking compatibility', () => {
    it('should work with runtime type guards for UI config', () => {
      const isUIConfig = (obj: any): obj is UIConfig => {
        try {
          UIConfigSchema.parse(obj);
          return true;
        } catch {
          return false;
        }
      };

      const validUIConfig = {
        previewMode: true,
        previewConfidence: 0.8,
        autoExecuteHighConfidence: false,
        previewTimeout: 6000,
      };

      const invalidUIConfig = {
        previewMode: 'not-boolean',
        previewConfidence: 1.5,
      };

      expect(isUIConfig(validUIConfig)).toBe(true);
      expect(isUIConfig(invalidUIConfig)).toBe(false);
    });

    it('should support safe parsing with error handling', () => {
      const safeParseUIConfig = (data: unknown) => {
        try {
          return { success: true, data: UIConfigSchema.parse(data) };
        } catch (error) {
          return { success: false, error };
        }
      };

      const validData = {
        previewMode: false,
        previewConfidence: 0.95,
        autoExecuteHighConfidence: true,
        previewTimeout: 12000,
      };

      const invalidData = {
        previewConfidence: -0.5,
        previewTimeout: 100,
      };

      const validResult = safeParseUIConfig(validData);
      const invalidResult = safeParseUIConfig(invalidData);

      expect(validResult.success).toBe(true);
      expect(invalidResult.success).toBe(false);

      if (validResult.success) {
        expect(validResult.data.previewMode).toBe(false);
        expect(validResult.data.previewConfidence).toBe(0.95);
      }
    });
  });

  describe('CLI integration scenarios', () => {
    it('should support config building scenarios used in CLI', () => {
      // Simulate how CLI might build config
      const userInput = {
        projectName: 'cli-test',
        language: 'typescript',
        previewMode: false,
        previewConfidence: 0.8,
      };

      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: userInput.projectName,
          language: userInput.language,
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: userInput.previewMode,
          previewConfidence: userInput.previewConfidence,
        },
      };

      expect(config.project.name).toBe('cli-test');
      expect(config.project.language).toBe('typescript');
      expect(config.ui?.previewMode).toBe(false);
      expect(config.ui?.previewConfidence).toBe(0.8);
    });

    it('should support config modification scenarios used in CLI', () => {
      // Simulate CLI modifying existing config
      let config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'modify-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      // CLI adds UI config
      config = {
        ...config,
        ui: {
          previewMode: true,
          previewConfidence: 0.7,
          autoExecuteHighConfidence: false,
          previewTimeout: 5000,
        },
      };

      // CLI updates specific UI field
      config = {
        ...config,
        ui: {
          ...config.ui,
          previewMode: false,
        },
      };

      expect(config.ui.previewMode).toBe(false);
      expect(config.ui.previewConfidence).toBe(0.7);
      expect(config.ui.autoExecuteHighConfidence).toBe(false);
      expect(config.ui.previewTimeout).toBe(5000);
    });
  });
});