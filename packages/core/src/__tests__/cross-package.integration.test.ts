import { describe, it, expect } from 'vitest';
import { UIConfigSchema, ApexConfigSchema, ApexConfig } from '../types';
import { getEffectiveConfig } from '../config';

describe('Cross-Package Integration Tests for UI Config', () => {
  describe('CLI Package Integration Scenarios', () => {
    it('should support CLI config initialization workflow', () => {
      // Simulate CLI gathering user input
      const userPreferences = {
        enablePreview: true,
        confidenceThreshold: 0.8,
        autoExecute: false,
        timeout: 8000,
      };

      // CLI creates config object
      const cliGeneratedConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'cli-generated-project',
          language: 'typescript',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: userPreferences.enablePreview,
          previewConfidence: userPreferences.confidenceThreshold,
          autoExecuteHighConfidence: userPreferences.autoExecute,
          previewTimeout: userPreferences.timeout,
        },
      };

      // Validate config before saving
      const validatedConfig = ApexConfigSchema.parse(cliGeneratedConfig);
      expect(validatedConfig.ui?.previewMode).toBe(true);
      expect(validatedConfig.ui?.previewConfidence).toBe(0.8);
      expect(validatedConfig.ui?.autoExecuteHighConfidence).toBe(false);
      expect(validatedConfig.ui?.previewTimeout).toBe(8000);
    });

    it('should support CLI config update commands', () => {
      // Simulate existing config
      const existingConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'existing-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.7,
        },
      };

      // CLI command: apex config set ui.autoExecuteHighConfidence true
      const updatedConfig: ApexConfig = {
        ...existingConfig,
        ui: {
          ...existingConfig.ui,
          autoExecuteHighConfidence: true,
        },
      };

      const effectiveConfig = getEffectiveConfig(updatedConfig);
      expect(effectiveConfig.ui.previewMode).toBe(true);
      expect(effectiveConfig.ui.previewConfidence).toBe(0.7);
      expect(effectiveConfig.ui.autoExecuteHighConfidence).toBe(true);
      expect(effectiveConfig.ui.previewTimeout).toBe(5000); // default
    });

    it('should support CLI config validation before execution', () => {
      // CLI validates user input before creating config
      const validateUIInput = (input: Record<string, unknown>) => {
        try {
          return { success: true, config: UIConfigSchema.parse(input) };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      };

      // Valid input
      const validInput = {
        previewMode: true,
        previewConfidence: 0.85,
        autoExecuteHighConfidence: true,
        previewTimeout: 12000,
      };

      const validResult = validateUIInput(validInput);
      expect(validResult.success).toBe(true);
      if (validResult.success) {
        expect(validResult.config.previewMode).toBe(true);
        expect(validResult.config.previewConfidence).toBe(0.85);
      }

      // Invalid input
      const invalidInput = {
        previewMode: 'yes', // should be boolean
        previewConfidence: 1.5, // should be <= 1
        previewTimeout: 500, // should be >= 1000
      };

      const invalidResult = validateUIInput(invalidInput);
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toContain('Expected boolean');
    });
  });

  describe('Orchestrator Package Integration Scenarios', () => {
    it('should provide config format expected by orchestrator', () => {
      // Orchestrator receives effective config
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'orchestrator-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.9,
        },
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);

      // Orchestrator expects all UI fields to be defined
      expect(effectiveConfig.ui.previewMode).toBeDefined();
      expect(effectiveConfig.ui.previewConfidence).toBeDefined();
      expect(effectiveConfig.ui.autoExecuteHighConfidence).toBeDefined();
      expect(effectiveConfig.ui.previewTimeout).toBeDefined();

      // All fields should be proper types
      expect(typeof effectiveConfig.ui.previewMode).toBe('boolean');
      expect(typeof effectiveConfig.ui.previewConfidence).toBe('number');
      expect(typeof effectiveConfig.ui.autoExecuteHighConfidence).toBe('boolean');
      expect(typeof effectiveConfig.ui.previewTimeout).toBe('number');
    });

    it('should support orchestrator decision-making logic', () => {
      // Simulate orchestrator using UI config for execution decisions
      const makeExecutionDecision = (confidence: number, uiConfig: { previewMode: boolean; previewConfidence: number; autoExecuteHighConfidence: boolean }) => {
        if (!uiConfig.previewMode) {
          return 'execute'; // Preview disabled, always execute
        }

        if (confidence >= uiConfig.previewConfidence && uiConfig.autoExecuteHighConfidence) {
          return 'auto-execute'; // High confidence auto-execute
        }

        if (confidence >= uiConfig.previewConfidence) {
          return 'preview-recommend'; // Show preview with recommendation
        }

        return 'preview-require-approval'; // Show preview, require approval
      };

      const config = getEffectiveConfig({
        version: '1.0',
        project: {
          name: 'decision-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.8,
          autoExecuteHighConfidence: true,
        },
      });

      // Test different confidence levels
      expect(makeExecutionDecision(0.9, config.ui)).toBe('auto-execute');
      expect(makeExecutionDecision(0.8, config.ui)).toBe('auto-execute');
      expect(makeExecutionDecision(0.7, config.ui)).toBe('preview-require-approval');

      // Test with auto-execute disabled
      const noAutoConfig = getEffectiveConfig({
        version: '1.0',
        project: {
          name: 'no-auto-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.8,
          autoExecuteHighConfidence: false,
        },
      });

      expect(makeExecutionDecision(0.9, noAutoConfig.ui)).toBe('preview-recommend');
    });
  });

  describe('API Package Integration Scenarios', () => {
    it('should support API config serialization', () => {
      const config = getEffectiveConfig({
        version: '1.0',
        project: {
          name: 'api-test',
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
      });

      // API should be able to serialize config to JSON
      const serialized = JSON.stringify(config.ui);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.previewMode).toBe(false);
      expect(deserialized.previewConfidence).toBe(0.85);
      expect(deserialized.autoExecuteHighConfidence).toBe(true);
      expect(deserialized.previewTimeout).toBe(10000);
    });

    it('should support API WebSocket message format', () => {
      // Simulate API sending UI config updates via WebSocket
      const createUIConfigMessage = (config: ApexConfig) => {
        const effective = getEffectiveConfig(config);
        return {
          type: 'ui-config-update',
          timestamp: new Date().toISOString(),
          data: {
            previewMode: effective.ui.previewMode,
            previewConfidence: effective.ui.previewConfidence,
            autoExecuteHighConfidence: effective.ui.autoExecuteHighConfidence,
            previewTimeout: effective.ui.previewTimeout,
          },
        };
      };

      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'websocket-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.75,
        },
      };

      const message = createUIConfigMessage(config);

      expect(message.type).toBe('ui-config-update');
      expect(message.data.previewMode).toBe(true);
      expect(message.data.previewConfidence).toBe(0.75);
      expect(message.data.autoExecuteHighConfidence).toBe(false); // default
      expect(message.data.previewTimeout).toBe(5000); // default
    });
  });

  describe('Type Compatibility Across Packages', () => {
    it('should maintain type compatibility for package imports', () => {
      // Test that types can be imported and used consistently across packages
      type CLIConfigHandler = (config: ApexConfig) => boolean;
      type OrchestratorConfigProcessor = (config: Required<ApexConfig>) => void;
      type APIConfigSerializer = (config: ApexConfig) => string;

      const cliHandler: CLIConfigHandler = (config) => {
        return config.ui?.previewMode ?? true;
      };

      const orchestratorProcessor: OrchestratorConfigProcessor = (config) => {
        // Orchestrator can rely on all fields being present
        expect(config.ui.previewMode).toBeDefined();
        expect(config.ui.previewConfidence).toBeDefined();
        expect(config.ui.autoExecuteHighConfidence).toBeDefined();
        expect(config.ui.previewTimeout).toBeDefined();
      };

      const apiSerializer: APIConfigSerializer = (config) => {
        return JSON.stringify(config.ui);
      };

      const testConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'type-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: true,
        },
      };

      // All handlers should work with the same config
      expect(cliHandler(testConfig)).toBe(true);
      orchestratorProcessor(getEffectiveConfig(testConfig));
      expect(apiSerializer(testConfig)).toContain('previewMode');
    });

    it('should support backward compatibility scenarios', () => {
      // Test handling of configs without UI section (pre-v0.3.0)
      const legacyConfig: Omit<ApexConfig, 'ui'> = {
        version: '1.0',
        project: {
          name: 'legacy-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          default: 'full',
        },
      };

      // Should be able to upgrade legacy config
      const upgradedConfig: ApexConfig = {
        ...legacyConfig,
        ui: {
          previewMode: true, // Default for new installations
        },
      };

      const effective = getEffectiveConfig(upgradedConfig);
      expect(effective.ui.previewMode).toBe(true);
      expect(effective.ui.previewConfidence).toBe(0.7);
      expect(effective.ui.autoExecuteHighConfidence).toBe(false);
      expect(effective.ui.previewTimeout).toBe(5000);
    });

    it('should handle config migration scenarios', () => {
      // Test migration from older config versions
      interface LegacyConfig {
        version: string;
        project: { name: string };
        // No UI section in legacy
      }

      const migrateConfig = (legacy: LegacyConfig): ApexConfig => {
        return {
          version: legacy.version,
          project: {
            ...legacy.project,
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          ui: {
            previewMode: true,
            previewConfidence: 0.7,
            autoExecuteHighConfidence: false,
            previewTimeout: 5000,
          },
        };
      };

      const legacy: LegacyConfig = {
        version: '0.2.0',
        project: { name: 'migrated-project' },
      };

      const migrated = migrateConfig(legacy);
      const validated = ApexConfigSchema.parse(migrated);

      expect(validated.ui?.previewMode).toBe(true);
      expect(validated.ui?.previewConfidence).toBe(0.7);
      expect(validated.ui?.autoExecuteHighConfidence).toBe(false);
      expect(validated.ui?.previewTimeout).toBe(5000);
    });
  });
});