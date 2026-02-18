import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexConfig, UIConfig, ApexConfigSchema, UIConfigSchema } from '../types';
import { loadConfig, saveConfig, getEffectiveConfig, initializeApex } from '../config';

describe('diffPreview Integration Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffpreview-integration-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('End-to-End Configuration Flow', () => {
    it('should handle complete diffPreview configuration lifecycle', async () => {
      // 1. Create a config with diffPreview disabled
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'diffpreview-e2e-test',
          language: 'typescript',
          framework: 'react',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: true,
          diffPreview: false,
          previewConfidence: 0.8,
          autoExecuteHighConfidence: true,
          previewTimeout: 10000,
        },
      };

      // 2. Save the configuration
      await saveConfig(testDir, initialConfig);

      // 3. Load and verify the configuration
      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.ui?.diffPreview).toBe(false);
      expect(loadedConfig.ui?.previewMode).toBe(true);
      expect(loadedConfig.ui?.previewConfidence).toBe(0.8);

      // 4. Get effective config and verify all defaults are applied
      const effectiveConfig = getEffectiveConfig(loadedConfig);
      expect(effectiveConfig.ui.diffPreview).toBe(false);
      expect(effectiveConfig.ui.previewMode).toBe(true);
      expect(effectiveConfig.ui.previewConfidence).toBe(0.8);
      expect(effectiveConfig.ui.autoExecuteHighConfidence).toBe(true);
      expect(effectiveConfig.ui.previewTimeout).toBe(10000);

      // 5. Modify the config to enable diffPreview
      const updatedConfig: ApexConfig = {
        ...loadedConfig,
        ui: {
          ...loadedConfig.ui!,
          diffPreview: true,
        },
      };

      // 6. Save and reload the updated config
      await saveConfig(testDir, updatedConfig);
      const reloadedConfig = await loadConfig(testDir);
      expect(reloadedConfig.ui?.diffPreview).toBe(true);

      // 7. Verify effective config reflects the change
      const finalEffectiveConfig = getEffectiveConfig(reloadedConfig);
      expect(finalEffectiveConfig.ui.diffPreview).toBe(true);
    });

    it('should handle initialization with default diffPreview behavior', async () => {
      // Initialize a new APEX project
      await initializeApex(testDir, {
        projectName: 'init-diffpreview-test',
        language: 'javascript',
      });

      // Load the initialized config
      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      // Check that diffPreview gets the default value
      expect(effectiveConfig.ui.diffPreview).toBe(true);

      // The initialized config might not have an explicit UI section,
      // but the effective config should have all defaults
      expect(effectiveConfig.ui.previewMode).toBe(true);
      expect(effectiveConfig.ui.previewConfidence).toBe(0.7);
      expect(effectiveConfig.ui.autoExecuteHighConfidence).toBe(false);
      expect(effectiveConfig.ui.previewTimeout).toBe(5000);
    });
  });

  describe('Configuration Scenarios', () => {
    it('should handle mixed UI configuration with partial diffPreview settings', async () => {
      const scenarios = [
        {
          name: 'Only diffPreview set',
          config: {
            version: '1.0' as const,
            project: { name: 'test', testCommand: 'npm test', lintCommand: 'npm run lint', buildCommand: 'npm run build' },
            ui: { diffPreview: false },
          },
          expectedDiffPreview: false,
          expectedPreviewMode: true, // should get default
        },
        {
          name: 'diffPreview with preview mode disabled',
          config: {
            version: '1.0' as const,
            project: { name: 'test', testCommand: 'npm test', lintCommand: 'npm run lint', buildCommand: 'npm run build' },
            ui: { previewMode: false, diffPreview: true },
          },
          expectedDiffPreview: true,
          expectedPreviewMode: false,
        },
        {
          name: 'Full UI config with diffPreview',
          config: {
            version: '1.0' as const,
            project: { name: 'test', testCommand: 'npm test', lintCommand: 'npm run lint', buildCommand: 'npm run build' },
            ui: {
              previewMode: true,
              previewConfidence: 0.95,
              autoExecuteHighConfidence: false,
              previewTimeout: 15000,
              diffPreview: false,
            },
          },
          expectedDiffPreview: false,
          expectedPreviewMode: true,
        },
      ];

      for (const scenario of scenarios) {
        const effectiveConfig = getEffectiveConfig(scenario.config);
        expect(effectiveConfig.ui.diffPreview, `${scenario.name} - diffPreview`).toBe(scenario.expectedDiffPreview);
        expect(effectiveConfig.ui.previewMode, `${scenario.name} - previewMode`).toBe(scenario.expectedPreviewMode);
      }
    });

    it('should maintain consistency between schema parsing and config merging', async () => {
      const testConfigs = [
        { diffPreview: true },
        { diffPreview: false },
        { previewMode: true, diffPreview: true },
        { previewMode: false, diffPreview: false },
        {}, // empty UI config
      ];

      for (const uiConfig of testConfigs) {
        // Test schema parsing
        const parsedUI = UIConfigSchema.parse(uiConfig);
        const expectedDiffPreview = uiConfig.diffPreview ?? true; // default is true

        expect(parsedUI.diffPreview).toBe(expectedDiffPreview);

        // Test full config parsing and merging
        const fullConfig = {
          version: '1.0' as const,
          project: { name: 'consistency-test', testCommand: 'npm test', lintCommand: 'npm run lint', buildCommand: 'npm run build' },
          ui: uiConfig,
        };

        const parsedConfig = ApexConfigSchema.parse(fullConfig);
        const effectiveConfig = getEffectiveConfig(parsedConfig);

        expect(effectiveConfig.ui.diffPreview).toBe(expectedDiffPreview);
      }
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should support typical development workflow configurations', async () => {
      const devWorkflowConfigs = [
        {
          name: 'Conservative development setup',
          ui: {
            previewMode: true,
            diffPreview: true,
            previewConfidence: 0.6,
            autoExecuteHighConfidence: false,
          },
        },
        {
          name: 'Aggressive development setup',
          ui: {
            previewMode: true,
            diffPreview: false, // No diff preview for speed
            previewConfidence: 0.9,
            autoExecuteHighConfidence: true,
          },
        },
        {
          name: 'Production-like setup',
          ui: {
            previewMode: false, // No preview in prod-like
            diffPreview: true, // But show diffs when manual review is needed
            previewConfidence: 0.95,
            autoExecuteHighConfidence: false,
          },
        },
      ];

      for (const workflow of devWorkflowConfigs) {
        const config = ApexConfigSchema.parse({
          version: '1.0',
          project: { name: 'workflow-test', testCommand: 'npm test', lintCommand: 'npm run lint', buildCommand: 'npm run build' },
          ui: workflow.ui,
        });

        await saveConfig(testDir, config);
        const loaded = await loadConfig(testDir);
        const effective = getEffectiveConfig(loaded);

        expect(effective.ui.diffPreview, `${workflow.name} - diffPreview preserved`).toBe(workflow.ui.diffPreview);
        expect(effective.ui.previewMode, `${workflow.name} - previewMode preserved`).toBe(workflow.ui.previewMode);
      }
    });

    it('should handle configuration migration scenarios', async () => {
      // Simulate old config without diffPreview
      const oldConfig = {
        version: '1.0',
        project: { name: 'migration-test', testCommand: 'npm test', lintCommand: 'npm run lint', buildCommand: 'npm run build' },
        ui: {
          previewMode: false,
          previewConfidence: 0.8,
          // No diffPreview property - simulating old config
        },
      };

      // Parse with current schema (should add default diffPreview)
      const migratedConfig = ApexConfigSchema.parse(oldConfig);
      expect(migratedConfig.ui?.diffPreview).toBe(true); // default value

      // Save and load to ensure persistence
      await saveConfig(testDir, migratedConfig);
      const loadedMigratedConfig = await loadConfig(testDir);
      expect(loadedMigratedConfig.ui?.diffPreview).toBe(true);

      // Effective config should also have the default
      const effectiveMigratedConfig = getEffectiveConfig(loadedMigratedConfig);
      expect(effectiveMigratedConfig.ui.diffPreview).toBe(true);
    });
  });

  describe('Error Handling and Validation', () => {
    it('should provide meaningful error messages for invalid diffPreview values', () => {
      const invalidUIConfigs = [
        { diffPreview: 'enabled' },
        { diffPreview: 1 },
        { diffPreview: null },
        { diffPreview: [] },
        { diffPreview: {} },
      ];

      invalidUIConfigs.forEach((invalidConfig, index) => {
        expect(() => {
          UIConfigSchema.parse(invalidConfig);
        }, `Invalid config ${index} should throw`).toThrow(/Expected boolean|Invalid/);
      });
    });

    it('should handle edge cases in configuration values', () => {
      // Test that diffPreview works with other edge case values
      const edgeCaseConfig = {
        version: '1.0',
        project: { name: 'edge-case-test', testCommand: 'npm test', lintCommand: 'npm run lint', buildCommand: 'npm run build' },
        ui: {
          diffPreview: false,
          previewConfidence: 0.0, // minimum valid value
          previewTimeout: 1000, // minimum valid value
          previewMode: true,
          autoExecuteHighConfidence: false,
        },
      };

      expect(() => ApexConfigSchema.parse(edgeCaseConfig)).not.toThrow();
      const effective = getEffectiveConfig(edgeCaseConfig);
      expect(effective.ui.diffPreview).toBe(false);
      expect(effective.ui.previewConfidence).toBe(0.0);
      expect(effective.ui.previewTimeout).toBe(1000);
    });
  });
});