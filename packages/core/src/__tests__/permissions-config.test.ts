import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  initializeApex,
  loadConfig,
  saveConfig,
  getEffectiveConfig,
} from '../config';
import {
  ApexConfig,
  ApexConfigSchema,
  PermissionsConfig,
  PermissionsConfigSchema,
  PermissionPresetSchema,
  ToolPermissionRuleSchema,
  getToolBehaviorForPreset,
  isToolAllowedForPreset,
  isToolConfirmRequiredForPreset,
  isToolDeniedForPreset,
  getPresetConfig,
  isPermissionPreset,
  PermissionPreset,
  ToolPermissionBehavior,
} from '../types';

describe('permissions configuration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-permissions-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('PermissionsConfigSchema validation', () => {
    it('should validate default permissions config', () => {
      const defaultConfig = { preset: 'review-all' };
      const result = PermissionsConfigSchema.safeParse(defaultConfig);
      expect(result.success).toBe(true);
    });

    it('should validate autonomous preset', () => {
      const config = { preset: 'autonomous', customRules: [] };
      const result = PermissionsConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate read-only preset', () => {
      const config = { preset: 'read-only', customRules: [] };
      const result = PermissionsConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate custom rules', () => {
      const config = {
        preset: 'review-all',
        customRules: [
          { tool: 'Read', behavior: 'allow' },
          { tool: 'Write', behavior: 'confirm', scope: '*.md' }
        ]
      };
      const result = PermissionsConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid preset', () => {
      const config = { preset: 'invalid-preset' };
      const result = PermissionsConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should apply default values correctly', () => {
      const config = {};
      const result = PermissionsConfigSchema.parse(config);
      expect(result.preset).toBe('review-all');
      expect(result.customRules).toEqual([]);
    });

    it('should accept all valid permission presets', () => {
      const validPresets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      for (const preset of validPresets) {
        const config = { preset };
        expect(() => PermissionsConfigSchema.parse(config)).not.toThrow();
        const parsed = PermissionsConfigSchema.parse(config);
        expect(parsed.preset).toBe(preset);
      }
    });

    it('should accept comprehensive custom rules', () => {
      const config = {
        preset: 'review-all' as const,
        customRules: [
          { tool: 'Read', behavior: 'allow' as const },
          { tool: 'Write', behavior: 'confirm' as const, scope: '/src/**', reason: 'Source files need review' },
          { tool: 'Bash', behavior: 'deny' as const },
          { tool: 'Web*', behavior: 'allow' as const, scope: 'https://*.example.com' },
        ],
      };

      const parsed = PermissionsConfigSchema.parse(config);
      expect(parsed.customRules).toHaveLength(4);
      expect(parsed.customRules?.[1]).toEqual({
        tool: 'Write',
        behavior: 'confirm',
        scope: '/src/**',
        reason: 'Source files need review',
      });
    });

    it('should reject invalid custom rule structures', () => {
      // Missing tool name
      expect(() => PermissionsConfigSchema.parse({
        customRules: [{ behavior: 'allow' }]
      })).toThrow();

      // Missing behavior
      expect(() => PermissionsConfigSchema.parse({
        customRules: [{ tool: 'Read' }]
      })).toThrow();

      // Invalid behavior
      expect(() => PermissionsConfigSchema.parse({
        customRules: [{ tool: 'Read', behavior: 'invalid' }]
      })).toThrow();

      // Empty tool name
      expect(() => PermissionsConfigSchema.parse({
        customRules: [{ tool: '', behavior: 'allow' }]
      })).toThrow();
    });
  });

  describe('ToolPermissionRuleSchema validation', () => {
    it('should accept valid tool permission rules', () => {
      const rules = [
        { tool: 'Read', behavior: 'allow' as const },
        { tool: 'Write', behavior: 'confirm' as const },
        { tool: 'Bash', behavior: 'deny' as const },
        { tool: 'Web*', behavior: 'allow' as const, scope: 'https://*.example.com' },
        { tool: 'Edit', behavior: 'confirm' as const, reason: 'Code changes need approval' },
      ];

      for (const rule of rules) {
        expect(() => ToolPermissionRuleSchema.parse(rule)).not.toThrow();
        const parsed = ToolPermissionRuleSchema.parse(rule);
        expect(parsed.tool).toBe(rule.tool);
        expect(parsed.behavior).toBe(rule.behavior);
      }
    });

    it('should reject invalid tool permission rules', () => {
      const invalidRules = [
        { tool: '', behavior: 'allow' }, // Empty tool name
        { tool: 'Read', behavior: 'invalid' }, // Invalid behavior
        { tool: 'Read' }, // Missing behavior
        { behavior: 'allow' }, // Missing tool
      ];

      for (const rule of invalidRules) {
        expect(() => ToolPermissionRuleSchema.parse(rule)).toThrow();
      }
    });
  });

  describe('ApexConfig integration', () => {
    it('should initialize with default permissions preset', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });
      const config = await loadConfig(testDir);

      expect(config.permissions).toBeDefined();
      expect(config.permissions?.preset).toBe('review-all');
    });

    it('should load and save permissions configuration', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });
      let config = await loadConfig(testDir);

      // Modify permissions config
      const newPermissionsConfig: PermissionsConfig = {
        preset: 'autonomous',
        customRules: [
          { tool: 'Bash', behavior: 'confirm' }
        ]
      };

      config.permissions = newPermissionsConfig;
      await saveConfig(testDir, config);

      // Reload and verify
      const reloadedConfig = await loadConfig(testDir);
      expect(reloadedConfig.permissions?.preset).toBe('autonomous');
      expect(reloadedConfig.permissions?.customRules).toHaveLength(1);
      expect(reloadedConfig.permissions?.customRules?.[0]).toEqual({
        tool: 'Bash',
        behavior: 'confirm'
      });
    });

    it('should apply effective config defaults for permissions', () => {
      const minimalConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
      };

      const effectiveConfig = getEffectiveConfig(minimalConfig);
      expect(effectiveConfig.permissions).toBeDefined();
      expect(effectiveConfig.permissions.preset).toBe('review-all');
      expect(effectiveConfig.permissions.customRules).toEqual([]);
    });

    it('should preserve custom permissions in effective config', () => {
      const configWithPermissions: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        permissions: {
          preset: 'read-only',
          customRules: [{ tool: 'WebFetch', behavior: 'allow' }]
        }
      };

      const effectiveConfig = getEffectiveConfig(configWithPermissions);
      expect(effectiveConfig.permissions.preset).toBe('read-only');
      expect(effectiveConfig.permissions.customRules).toHaveLength(1);
      expect(effectiveConfig.permissions.customRules[0].tool).toBe('WebFetch');
    });
  });

  describe('backwards compatibility', () => {
    it('should handle config without permissions section', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });
      const config = await loadConfig(testDir);

      // Remove permissions section to simulate older config
      delete (config as any).permissions;
      await saveConfig(testDir, config);

      // Should load successfully with defaults
      const reloadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(reloadedConfig);
      expect(effectiveConfig.permissions.preset).toBe('review-all');
    });
  });

  describe('Permission preset helper functions', () => {
    describe('getToolBehaviorForPreset', () => {
      it('should return correct behavior for autonomous preset', () => {
        expect(getToolBehaviorForPreset('autonomous', 'Read')).toBe('allow');
        expect(getToolBehaviorForPreset('autonomous', 'Write')).toBe('allow');
        expect(getToolBehaviorForPreset('autonomous', 'Bash')).toBe('allow');
        expect(getToolBehaviorForPreset('autonomous', 'CustomTool')).toBe('allow');
      });

      it('should return correct behavior for review-all preset', () => {
        expect(getToolBehaviorForPreset('review-all', 'Read')).toBe('confirm');
        expect(getToolBehaviorForPreset('review-all', 'Write')).toBe('confirm');
        expect(getToolBehaviorForPreset('review-all', 'Bash')).toBe('confirm');
        expect(getToolBehaviorForPreset('review-all', 'CustomTool')).toBe('confirm');
      });

      it('should return correct behavior for read-only preset', () => {
        expect(getToolBehaviorForPreset('read-only', 'Read')).toBe('allow');
        expect(getToolBehaviorForPreset('read-only', 'Grep')).toBe('allow');
        expect(getToolBehaviorForPreset('read-only', 'Glob')).toBe('allow');
        expect(getToolBehaviorForPreset('read-only', 'WebFetch')).toBe('allow');
        expect(getToolBehaviorForPreset('read-only', 'WebSearch')).toBe('allow');
        expect(getToolBehaviorForPreset('read-only', 'Write')).toBe('deny');
        expect(getToolBehaviorForPreset('read-only', 'Edit')).toBe('deny');
        expect(getToolBehaviorForPreset('read-only', 'Bash')).toBe('deny');
        expect(getToolBehaviorForPreset('read-only', 'CustomTool')).toBe('deny');
      });
    });

    describe('isToolAllowedForPreset', () => {
      it('should identify allowed tools correctly', () => {
        expect(isToolAllowedForPreset('autonomous', 'Write')).toBe(true);
        expect(isToolAllowedForPreset('read-only', 'Read')).toBe(true);
        expect(isToolAllowedForPreset('read-only', 'Write')).toBe(false);
        expect(isToolAllowedForPreset('review-all', 'Read')).toBe(false);
      });
    });

    describe('isToolConfirmRequiredForPreset', () => {
      it('should identify confirmation-required tools correctly', () => {
        expect(isToolConfirmRequiredForPreset('review-all', 'Read')).toBe(true);
        expect(isToolConfirmRequiredForPreset('autonomous', 'Write')).toBe(false);
        expect(isToolConfirmRequiredForPreset('read-only', 'Read')).toBe(false);
      });
    });

    describe('isToolDeniedForPreset', () => {
      it('should identify denied tools correctly', () => {
        expect(isToolDeniedForPreset('read-only', 'Write')).toBe(true);
        expect(isToolDeniedForPreset('read-only', 'Bash')).toBe(true);
        expect(isToolDeniedForPreset('read-only', 'Read')).toBe(false);
        expect(isToolDeniedForPreset('autonomous', 'Write')).toBe(false);
      });
    });

    describe('getPresetConfig', () => {
      it('should return correct preset configurations', () => {
        const autonomousConfig = getPresetConfig('autonomous');
        expect(autonomousConfig.name).toBe('autonomous');
        expect(autonomousConfig.defaultBehavior).toBe('allow');
        expect(autonomousConfig.allowFileCreation).toBe(true);
        expect(autonomousConfig.allowShellExecution).toBe(true);

        const reviewAllConfig = getPresetConfig('review-all');
        expect(reviewAllConfig.name).toBe('review-all');
        expect(reviewAllConfig.defaultBehavior).toBe('confirm');
        expect(reviewAllConfig.allowFileCreation).toBe(true);
        expect(reviewAllConfig.allowShellExecution).toBe(true);

        const readOnlyConfig = getPresetConfig('read-only');
        expect(readOnlyConfig.name).toBe('read-only');
        expect(readOnlyConfig.defaultBehavior).toBe('deny');
        expect(readOnlyConfig.allowFileCreation).toBe(false);
        expect(readOnlyConfig.allowShellExecution).toBe(false);
        expect(readOnlyConfig.rules).toHaveLength(5);
      });
    });

    describe('isPermissionPreset', () => {
      it('should validate permission preset strings', () => {
        expect(isPermissionPreset('autonomous')).toBe(true);
        expect(isPermissionPreset('review-all')).toBe(true);
        expect(isPermissionPreset('read-only')).toBe(true);
        expect(isPermissionPreset('invalid')).toBe(false);
        expect(isPermissionPreset('')).toBe(false);
        expect(isPermissionPreset(null)).toBe(false);
        expect(isPermissionPreset(undefined)).toBe(false);
        expect(isPermissionPreset(123)).toBe(false);
      });
    });
  });

  describe('ApexConfigSchema with permissions', () => {
    it('should parse config without permissions section', () => {
      const config = ApexConfigSchema.parse({
        version: '1.0',
        project: { name: 'test-project' },
      });

      expect(config.permissions).toBeUndefined();
    });

    it('should parse config with permissions section using defaults', () => {
      const config = ApexConfigSchema.parse({
        version: '1.0',
        project: { name: 'test-project' },
        permissions: {},
      });

      expect(config.permissions).toEqual({
        preset: 'review-all',
        customRules: [],
      });
    });

    it('should parse config with custom permissions values', () => {
      const config = ApexConfigSchema.parse({
        version: '1.0',
        project: { name: 'test-project' },
        permissions: {
          preset: 'autonomous',
          customRules: [
            { tool: 'Write', behavior: 'confirm' },
          ],
        },
      });

      expect(config.permissions).toEqual({
        preset: 'autonomous',
        customRules: [
          { tool: 'Write', behavior: 'confirm' },
        ],
      });
    });

    it('should validate permissions preset enum values', () => {
      const validConfig = ApexConfigSchema.parse({
        version: '1.0',
        project: { name: 'test-project' },
        permissions: {
          preset: 'read-only',
        },
      });

      expect(validConfig.permissions!.preset).toBe('read-only');

      // Test invalid value
      expect(() => {
        ApexConfigSchema.parse({
          version: '1.0',
          project: { name: 'test-project' },
          permissions: {
            preset: 'invalid-preset',
          },
        });
      }).toThrow();
    });

    it('should validate all permission preset values', () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      for (const preset of presets) {
        const config = ApexConfigSchema.parse({
          version: '1.0',
          project: { name: 'test-project' },
          permissions: { preset },
        });

        expect(config.permissions!.preset).toBe(preset);
      }
    });

    it('should validate custom rules structure', () => {
      const validConfig = ApexConfigSchema.parse({
        version: '1.0',
        project: { name: 'test-project' },
        permissions: {
          preset: 'review-all',
          customRules: [
            { tool: 'Read', behavior: 'allow' },
            { tool: 'Write', behavior: 'confirm', scope: '/src/**', reason: 'Source control' },
            { tool: 'Bash', behavior: 'deny' },
          ],
        },
      });

      expect(validConfig.permissions!.customRules).toHaveLength(3);

      // Test invalid custom rule structure
      expect(() => {
        ApexConfigSchema.parse({
          version: '1.0',
          project: { name: 'test-project' },
          permissions: {
            preset: 'review-all',
            customRules: [
              { tool: 'Read' }, // Missing behavior
            ],
          },
        });
      }).toThrow();
    });
  });
});