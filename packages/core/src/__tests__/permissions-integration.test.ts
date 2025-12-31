import { describe, it, expect } from 'vitest';
import {
  PermissionsConfigSchema,
  PermissionPresetSchema,
  getToolBehaviorForPreset,
  isToolAllowedForPreset,
  getPresetConfig,
  isPermissionPreset,
} from '../types';

describe('Permissions Integration Test', () => {
  it('should have all permission exports available', () => {
    // Test schema exports
    expect(PermissionsConfigSchema).toBeDefined();
    expect(PermissionPresetSchema).toBeDefined();

    // Test helper function exports
    expect(typeof getToolBehaviorForPreset).toBe('function');
    expect(typeof isToolAllowedForPreset).toBe('function');
    expect(typeof getPresetConfig).toBe('function');
    expect(typeof isPermissionPreset).toBe('function');
  });

  it('should validate basic schema functionality', () => {
    // Test preset validation
    const validPresets = ['autonomous', 'review-all', 'read-only'];
    for (const preset of validPresets) {
      expect(() => PermissionPresetSchema.parse(preset)).not.toThrow();
    }

    // Test invalid preset
    expect(() => PermissionPresetSchema.parse('invalid')).toThrow();
  });

  it('should demonstrate basic permission helper functionality', () => {
    // Test getToolBehaviorForPreset
    expect(getToolBehaviorForPreset('autonomous', 'Read')).toBe('allow');
    expect(getToolBehaviorForPreset('review-all', 'Write')).toBe('confirm');
    expect(getToolBehaviorForPreset('read-only', 'Bash')).toBe('deny');

    // Test isToolAllowedForPreset
    expect(isToolAllowedForPreset('autonomous', 'Write')).toBe(true);
    expect(isToolAllowedForPreset('read-only', 'Write')).toBe(false);

    // Test getPresetConfig
    const autonomousConfig = getPresetConfig('autonomous');
    expect(autonomousConfig.name).toBe('autonomous');
    expect(autonomousConfig.allowFileCreation).toBe(true);

    // Test isPermissionPreset type guard
    expect(isPermissionPreset('autonomous')).toBe(true);
    expect(isPermissionPreset('invalid')).toBe(false);
  });

  it('should handle comprehensive permissions config validation', () => {
    const validConfig = {
      preset: 'review-all',
      customRules: [
        { tool: 'Read', behavior: 'allow' },
        { tool: 'Write', behavior: 'confirm', scope: '/src/**' },
      ],
    };

    expect(() => PermissionsConfigSchema.parse(validConfig)).not.toThrow();

    const parsed = PermissionsConfigSchema.parse(validConfig);
    expect(parsed.preset).toBe('review-all');
    expect(parsed.customRules).toHaveLength(2);
  });

  it('should validate all preset configurations are complete', () => {
    const presets = ['autonomous', 'review-all', 'read-only'] as const;

    for (const preset of presets) {
      const config = getPresetConfig(preset);
      expect(config.name).toBe(preset);
      expect(config.description).toBeDefined();
      expect(config.defaultBehavior).toBeDefined();
      expect(typeof config.allowFileCreation).toBe('boolean');
      expect(typeof config.allowShellExecution).toBe('boolean');
      expect(typeof config.allowNetworkAccess).toBe('boolean');
      expect(Array.isArray(config.rules)).toBe(true);
    }
  });
});