import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { ApexConfigSchema, UIConfigSchema } from '../types';
import { loadConfig, saveConfig, getEffectiveConfig, initializeApex } from '../config';

describe('Configuration Validation for diffPreview', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-config-validation-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Schema Validation', () => {
    it('should validate diffPreview as boolean in ApexConfigSchema', () => {
      const validConfigs = [
        {
          version: '1.0',
          project: { name: 'test' },
          ui: { diffPreview: true },
        },
        {
          version: '1.0',
          project: { name: 'test' },
          ui: { diffPreview: false },
        },
        {
          version: '1.0',
          project: { name: 'test' },
          ui: {}, // should get default
        },
        {
          version: '1.0',
          project: { name: 'test' },
          // ui section missing, should get default in effective config
        },
      ];

      validConfigs.forEach((config, index) => {
        expect(() => ApexConfigSchema.parse(config), `Valid config ${index} should pass`).not.toThrow();
      });
    });

    it('should reject invalid diffPreview values', () => {
      const invalidConfigs = [
        {
          version: '1.0',
          project: { name: 'test' },
          ui: { diffPreview: 'true' },
        },
        {
          version: '1.0',
          project: { name: 'test' },
          ui: { diffPreview: 1 },
        },
        {
          version: '1.0',
          project: { name: 'test' },
          ui: { diffPreview: 0 },
        },
        {
          version: '1.0',
          project: { name: 'test' },
          ui: { diffPreview: null },
        },
        {
          version: '1.0',
          project: { name: 'test' },
          ui: { diffPreview: undefined },
        },
      ];

      invalidConfigs.forEach((config, index) => {
        expect(() => ApexConfigSchema.parse(config), `Invalid config ${index} should fail`).toThrow();
      });
    });

    it('should validate diffPreview in UIConfigSchema directly', () => {
      // Valid cases
      expect(() => UIConfigSchema.parse({ diffPreview: true })).not.toThrow();
      expect(() => UIConfigSchema.parse({ diffPreview: false })).not.toThrow();
      expect(() => UIConfigSchema.parse({})).not.toThrow(); // should get default

      // Invalid cases
      expect(() => UIConfigSchema.parse({ diffPreview: 'yes' })).toThrow();
      expect(() => UIConfigSchema.parse({ diffPreview: 1 })).toThrow();
      expect(() => UIConfigSchema.parse({ diffPreview: [] })).toThrow();
      expect(() => UIConfigSchema.parse({ diffPreview: {} })).toThrow();
    });
  });

  describe('YAML Configuration Parsing', () => {
    it('should parse diffPreview from YAML config correctly', async () => {
      const yamlContent = `
version: '1.0'
project:
  name: 'yaml-test'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'
ui:
  previewMode: true
  diffPreview: false
  previewConfidence: 0.8
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlContent);

      const config = await loadConfig(testDir);
      expect(config.ui?.diffPreview).toBe(false);
      expect(config.ui?.previewMode).toBe(true);
      expect(config.ui?.previewConfidence).toBe(0.8);
    });

    it('should handle YAML config without diffPreview and apply default', async () => {
      const yamlContent = `
version: '1.0'
project:
  name: 'yaml-test'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'
ui:
  previewMode: false
  previewConfidence: 0.9
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlContent);

      const config = await loadConfig(testDir);
      expect(config.ui?.diffPreview).toBe(true); // default value
      expect(config.ui?.previewMode).toBe(false);
      expect(config.ui?.previewConfidence).toBe(0.9);
    });

    it('should handle YAML config with different boolean representations', async () => {
      const yamlConfigurations = [
        { yamlValue: 'true', expectedValue: true },
        { yamlValue: 'false', expectedValue: false },
        { yamlValue: 'yes', expectedValue: true },
        { yamlValue: 'no', expectedValue: false },
        { yamlValue: 'on', expectedValue: true },
        { yamlValue: 'off', expectedValue: false },
      ];

      for (const { yamlValue, expectedValue } of yamlConfigurations) {
        const yamlContent = `
version: '1.0'
project:
  name: 'yaml-boolean-test'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'
ui:
  diffPreview: ${yamlValue}
`;

        const configPath = path.join(testDir, '.apex', 'config.yaml');
        await fs.writeFile(configPath, yamlContent);

        const config = await loadConfig(testDir);
        expect(config.ui?.diffPreview).toBe(expectedValue);
      }
    });
  });

  describe('Configuration Merging and Effective Config', () => {
    it('should properly merge diffPreview in complex configuration scenarios', () => {
      const testCases = [
        {
          name: 'Missing UI section',
          config: {
            version: '1.0',
            project: { name: 'test' },
          },
          expectedDiffPreview: true,
        },
        {
          name: 'Empty UI section',
          config: {
            version: '1.0',
            project: { name: 'test' },
            ui: {},
          },
          expectedDiffPreview: true,
        },
        {
          name: 'UI with other options but no diffPreview',
          config: {
            version: '1.0',
            project: { name: 'test' },
            ui: {
              previewMode: false,
              previewConfidence: 0.5,
            },
          },
          expectedDiffPreview: true,
        },
        {
          name: 'UI with explicit diffPreview true',
          config: {
            version: '1.0',
            project: { name: 'test' },
            ui: {
              diffPreview: true,
            },
          },
          expectedDiffPreview: true,
        },
        {
          name: 'UI with explicit diffPreview false',
          config: {
            version: '1.0',
            project: { name: 'test' },
            ui: {
              diffPreview: false,
            },
          },
          expectedDiffPreview: false,
        },
      ];

      testCases.forEach(({ name, config, expectedDiffPreview }) => {
        const effective = getEffectiveConfig(config as any);
        expect(effective.ui.diffPreview, `Test case: ${name}`).toBe(expectedDiffPreview);
      });
    });
  });

  describe('Initialization with diffPreview', () => {
    it('should initialize project with diffPreview default in UI config', async () => {
      await initializeApex(testDir, {
        projectName: 'diffpreview-init-test',
        language: 'typescript',
      });

      const config = await loadConfig(testDir);
      const effective = getEffectiveConfig(config);

      // The initialized config might not have UI section explicitly
      // but effective config should have diffPreview default
      expect(effective.ui.diffPreview).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle config files with syntax errors gracefully', async () => {
      const invalidYaml = `
version: '1.0'
project:
  name: 'syntax-error-test'
ui:
  diffPreview: true
  previewMode: [invalid yaml structure
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, invalidYaml);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle config with unknown properties in UI section', () => {
      const configWithUnknownProps = {
        version: '1.0',
        project: { name: 'test' },
        ui: {
          diffPreview: true,
          previewMode: false,
          unknownProperty: 'should be ignored',
        },
      };

      // Zod should strip unknown properties or handle them according to schema config
      expect(() => ApexConfigSchema.parse(configWithUnknownProps)).not.toThrow();
      const parsed = ApexConfigSchema.parse(configWithUnknownProps);
      expect(parsed.ui?.diffPreview).toBe(true);
      expect(parsed.ui?.previewMode).toBe(false);
    });

    it('should handle deeply nested configuration structures', () => {
      const complexConfig = {
        version: '1.0',
        project: { name: 'complex-test' },
        ui: {
          diffPreview: false,
          previewMode: true,
          previewConfidence: 0.75,
          autoExecuteHighConfidence: false,
          previewTimeout: 6000,
        },
        autonomy: {
          level: 'review-before-commit',
        },
        limits: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 5.0,
        },
      };

      const effective = getEffectiveConfig(complexConfig as any);
      expect(effective.ui.diffPreview).toBe(false);
      expect(effective.ui.previewMode).toBe(true);
      expect(effective.ui.previewConfidence).toBe(0.75);
    });
  });

  describe('Type Safety and IntelliSense Support', () => {
    it('should provide proper TypeScript types for diffPreview', () => {
      // This test ensures the types are properly exported and usable
      const config = ApexConfigSchema.parse({
        version: '1.0',
        project: { name: 'type-test' },
        ui: {
          diffPreview: true,
        },
      });

      // TypeScript should infer these types correctly
      const diffPreview: boolean | undefined = config.ui?.diffPreview;
      expect(typeof diffPreview).toBe('boolean');
      expect(diffPreview).toBe(true);

      const effective = getEffectiveConfig(config);
      const effectiveDiffPreview: boolean = effective.ui.diffPreview;
      expect(typeof effectiveDiffPreview).toBe('boolean');
      expect(effectiveDiffPreview).toBe(true);
    });
  });
});