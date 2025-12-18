import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'os';
import { loadConfig, saveConfig, getEffectiveConfig, initializeApex } from '../config';
import { ApexConfig } from '../types';

describe('Config Preview Settings Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(path.tmpdir(), 'apex-config-preview-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Config Loading and Saving with Preview Settings', () => {
    it('should save and load config with all preview settings', async () => {
      const configWithPreview: ApexConfig = {
        version: '1.0',
        project: {
          name: 'preview-test',
          language: 'typescript',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: false,
          previewConfidence: 0.85,
          autoExecuteHighConfidence: true,
          previewTimeout: 12000,
        },
      };

      await saveConfig(testDir, configWithPreview);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.ui?.previewMode).toBe(false);
      expect(loadedConfig.ui?.previewConfidence).toBe(0.85);
      expect(loadedConfig.ui?.autoExecuteHighConfidence).toBe(true);
      expect(loadedConfig.ui?.previewTimeout).toBe(12000);
    });

    it('should save and load config with partial preview settings', async () => {
      const configWithPartialPreview: ApexConfig = {
        version: '1.0',
        project: {
          name: 'partial-preview-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.9,
          // autoExecuteHighConfidence and previewTimeout should use defaults
        },
      };

      await saveConfig(testDir, configWithPartialPreview);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.ui?.previewMode).toBe(true);
      expect(loadedConfig.ui?.previewConfidence).toBe(0.9);
      // The following should be undefined in raw loaded config (defaults applied by getEffectiveConfig)
      expect(loadedConfig.ui?.autoExecuteHighConfidence).toBeUndefined();
      expect(loadedConfig.ui?.previewTimeout).toBeUndefined();
    });

    it('should save and load config without UI section', async () => {
      const configWithoutUI: ApexConfig = {
        version: '1.0',
        project: {
          name: 'no-ui-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      await saveConfig(testDir, configWithoutUI);
      const loadedConfig = await loadConfig(testDir);

      // UI section should be undefined in raw loaded config
      expect(loadedConfig.ui).toBeUndefined();
    });
  });

  describe('Effective Config with Preview Settings', () => {
    it('should apply correct defaults for missing UI config', async () => {
      const configWithoutUI: ApexConfig = {
        version: '1.0',
        project: {
          name: 'defaults-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      await saveConfig(testDir, configWithoutUI);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      // Should have all UI defaults
      expect(effectiveConfig.ui.previewMode).toBe(true);
      expect(effectiveConfig.ui.previewConfidence).toBe(0.7);
      expect(effectiveConfig.ui.autoExecuteHighConfidence).toBe(false);
      expect(effectiveConfig.ui.previewTimeout).toBe(5000);
    });

    it('should preserve explicit UI values and fill in defaults', async () => {
      const configWithPartialUI: ApexConfig = {
        version: '1.0',
        project: {
          name: 'partial-ui-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: false,
          previewTimeout: 15000,
          // previewConfidence and autoExecuteHighConfidence should get defaults
        },
      };

      await saveConfig(testDir, configWithPartialUI);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      // Should preserve explicit values
      expect(effectiveConfig.ui.previewMode).toBe(false);
      expect(effectiveConfig.ui.previewTimeout).toBe(15000);
      // Should apply defaults for missing values
      expect(effectiveConfig.ui.previewConfidence).toBe(0.7);
      expect(effectiveConfig.ui.autoExecuteHighConfidence).toBe(false);
    });

    it('should handle round-trip config operations preserving preview settings', async () => {
      const originalConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'round-trip-test',
          language: 'javascript',
          framework: 'react',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.75,
          autoExecuteHighConfidence: true,
          previewTimeout: 8000,
        },
        autonomy: {
          default: 'review-before-merge',
        },
        limits: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 3.0,
        },
      };

      // Save original config
      await saveConfig(testDir, originalConfig);

      // Load and get effective config
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      // Save effective config back
      await saveConfig(testDir, effectiveConfig);

      // Load again and verify
      const finalConfig = await loadConfig(testDir);
      const finalEffectiveConfig = getEffectiveConfig(finalConfig);

      // All UI settings should be preserved through the round trip
      expect(finalEffectiveConfig.ui.previewMode).toBe(true);
      expect(finalEffectiveConfig.ui.previewConfidence).toBe(0.75);
      expect(finalEffectiveConfig.ui.autoExecuteHighConfidence).toBe(true);
      expect(finalEffectiveConfig.ui.previewTimeout).toBe(8000);

      // Other settings should also be preserved
      expect(finalEffectiveConfig.project.name).toBe('round-trip-test');
      expect(finalEffectiveConfig.autonomy.default).toBe('review-before-merge');
      expect(finalEffectiveConfig.limits.maxTokensPerTask).toBe(100000);
    });
  });

  describe('Initialization with Preview Settings', () => {
    it('should create default config with proper UI defaults during initialization', async () => {
      await initializeApex(testDir, {
        projectName: 'init-test',
        language: 'typescript',
        framework: 'nextjs',
      });

      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      // Should have proper defaults after initialization
      expect(effectiveConfig.ui.previewMode).toBe(true);
      expect(effectiveConfig.ui.previewConfidence).toBe(0.7);
      expect(effectiveConfig.ui.autoExecuteHighConfidence).toBe(false);
      expect(effectiveConfig.ui.previewTimeout).toBe(5000);

      // Project info should be set correctly
      expect(config.project.name).toBe('init-test');
      expect(config.project.language).toBe('typescript');
      expect(config.project.framework).toBe('nextjs');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed UI config gracefully', async () => {
      // Manually create a config file with invalid UI settings
      const invalidConfigYaml = `
version: '1.0'
project:
  name: 'invalid-ui-test'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'
ui:
  previewMode: 'not-a-boolean'
  previewConfidence: 1.5
  autoExecuteHighConfidence: 'true'
  previewTimeout: 500
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        invalidConfigYaml
      );

      // Loading should fail due to validation
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle empty config file', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        ''
      );

      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle config with only UI section', async () => {
      const uiOnlyConfigYaml = `
ui:
  previewMode: false
  previewConfidence: 0.8
  autoExecuteHighConfidence: true
  previewTimeout: 10000
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        uiOnlyConfigYaml
      );

      // Should fail because project.name is required
      await expect(loadConfig(testDir)).rejects.toThrow();
    });
  });

  describe('Config Migration Scenarios', () => {
    it('should handle legacy config without UI section', async () => {
      const legacyConfigYaml = `
version: '1.0'
project:
  name: 'legacy-test'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'
autonomy:
  default: 'full'
limits:
  maxTokensPerTask: 50000
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        legacyConfigYaml
      );

      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      // Legacy config should get proper UI defaults
      expect(effectiveConfig.ui.previewMode).toBe(true);
      expect(effectiveConfig.ui.previewConfidence).toBe(0.7);
      expect(effectiveConfig.ui.autoExecuteHighConfidence).toBe(false);
      expect(effectiveConfig.ui.previewTimeout).toBe(5000);

      // Original settings should be preserved
      expect(effectiveConfig.autonomy.default).toBe('full');
      expect(effectiveConfig.limits.maxTokensPerTask).toBe(50000);
    });

    it('should upgrade config by adding missing UI fields', async () => {
      // Start with minimal config
      const minimalConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'upgrade-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      await saveConfig(testDir, minimalConfig);

      // Load, get effective, and save back (simulating an upgrade)
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);
      await saveConfig(testDir, effectiveConfig);

      // Load the upgraded config
      const upgradedConfig = await loadConfig(testDir);

      // Should now have explicit UI section with all defaults
      expect(upgradedConfig.ui?.previewMode).toBe(true);
      expect(upgradedConfig.ui?.previewConfidence).toBe(0.7);
      expect(upgradedConfig.ui?.autoExecuteHighConfidence).toBe(false);
      expect(upgradedConfig.ui?.previewTimeout).toBe(5000);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle rapid config updates with UI changes', async () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'concurrent-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      // Save base config
      await saveConfig(testDir, baseConfig);

      // Simulate multiple rapid updates to UI config
      const updates = [
        { ui: { previewMode: true, previewConfidence: 0.6 } },
        { ui: { previewMode: false, previewTimeout: 8000 } },
        { ui: { autoExecuteHighConfidence: true, previewConfidence: 0.9 } },
      ];

      for (const update of updates) {
        const config = await loadConfig(testDir);
        const updatedConfig = { ...config, ...update };
        await saveConfig(testDir, updatedConfig);
      }

      // Final config should have the last update
      const finalConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(finalConfig);

      expect(effectiveConfig.ui.autoExecuteHighConfidence).toBe(true);
      expect(effectiveConfig.ui.previewConfidence).toBe(0.9);
      // Other fields should have defaults
      expect(effectiveConfig.ui.previewMode).toBe(true); // default
      expect(effectiveConfig.ui.previewTimeout).toBe(5000); // default
    });
  });
});