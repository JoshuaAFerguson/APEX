import { describe, it, expect } from 'vitest';
import {
  PermissionPresetSchema,
  PermissionPresetConfigSchema,
  ToolPermissionBehaviorSchema,
  ToolPermissionRuleSchema,
  PERMISSION_PRESET_CONFIGS,
  getToolBehaviorForPreset,
  isToolAllowedForPreset,
  isToolConfirmRequiredForPreset,
  isToolDeniedForPreset,
  getPresetConfig,
  isPermissionPreset,
  PermissionPreset,
  PermissionPresetConfig,
  ToolPermissionBehavior,
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  ALL_TOOLS,
} from './types';

describe('PermissionPreset Types', () => {
  describe('PermissionPresetSchema', () => {
    it('should accept valid permission presets', () => {
      expect(PermissionPresetSchema.parse('autonomous')).toBe('autonomous');
      expect(PermissionPresetSchema.parse('review-all')).toBe('review-all');
      expect(PermissionPresetSchema.parse('read-only')).toBe('read-only');
    });

    it('should reject invalid permission presets', () => {
      expect(() => PermissionPresetSchema.parse('invalid')).toThrow();
      expect(() => PermissionPresetSchema.parse('')).toThrow();
      expect(() => PermissionPresetSchema.parse(null)).toThrow();
      expect(() => PermissionPresetSchema.parse(undefined)).toThrow();
    });
  });

  describe('PERMISSION_PRESET_CONFIGS', () => {
    it('should contain all required presets', () => {
      expect(PERMISSION_PRESET_CONFIGS).toHaveProperty('autonomous');
      expect(PERMISSION_PRESET_CONFIGS).toHaveProperty('review-all');
      expect(PERMISSION_PRESET_CONFIGS).toHaveProperty('read-only');
    });

    it('should have valid autonomous preset configuration', () => {
      const config = PERMISSION_PRESET_CONFIGS.autonomous;
      expect(config.name).toBe('autonomous');
      expect(config.description).toContain('All tools allowed without confirmation');
      expect(config.defaultBehavior).toBe('allow');
      expect(config.allowFileCreation).toBe(true);
      expect(config.allowShellExecution).toBe(true);
      expect(config.allowNetworkAccess).toBe(true);
    });

    it('should have valid review-all preset configuration', () => {
      const config = PERMISSION_PRESET_CONFIGS['review-all'];
      expect(config.name).toBe('review-all');
      expect(config.description).toContain('require user confirmation');
      expect(config.defaultBehavior).toBe('confirm');
      expect(config.allowFileCreation).toBe(true);
      expect(config.allowShellExecution).toBe(true);
      expect(config.allowNetworkAccess).toBe(true);
    });

    it('should have valid read-only preset configuration', () => {
      const config = PERMISSION_PRESET_CONFIGS['read-only'];
      expect(config.name).toBe('read-only');
      expect(config.description).toContain('Only read-only tools allowed');
      expect(config.defaultBehavior).toBe('deny');
      expect(config.allowFileCreation).toBe(false);
      expect(config.allowShellExecution).toBe(false);
      expect(config.allowNetworkAccess).toBe(true);

      // Should have rules for read-only tools
      expect(config.rules).toBeDefined();
      expect(config.rules!.length).toBeGreaterThan(0);

      // Check that all read-only tools are allowed
      const allowedTools = config.rules!
        .filter(rule => rule.behavior === 'allow')
        .map(rule => rule.tool);

      READ_ONLY_TOOLS.forEach(tool => {
        expect(allowedTools).toContain(tool);
      });
    });
  });

  describe('Tool Constants', () => {
    it('should have correct read-only tools', () => {
      expect(READ_ONLY_TOOLS).toEqual([
        'Read',
        'Grep',
        'Glob',
        'WebFetch',
        'WebSearch',
      ]);
    });

    it('should have correct write tools', () => {
      expect(WRITE_TOOLS).toEqual([
        'Write',
        'Edit',
        'MultiEdit',
        'NotebookEdit',
        'Bash',
        'TodoWrite',
      ]);
    });

    it('should have all tools combined correctly', () => {
      expect(ALL_TOOLS).toEqual([...READ_ONLY_TOOLS, ...WRITE_TOOLS]);
    });
  });

  describe('Helper Functions', () => {
    describe('getToolBehaviorForPreset', () => {
      it('should return correct behavior for autonomous preset', () => {
        expect(getToolBehaviorForPreset('autonomous', 'Read')).toBe('allow');
        expect(getToolBehaviorForPreset('autonomous', 'Write')).toBe('allow');
        expect(getToolBehaviorForPreset('autonomous', 'Bash')).toBe('allow');
      });

      it('should return correct behavior for review-all preset', () => {
        expect(getToolBehaviorForPreset('review-all', 'Read')).toBe('confirm');
        expect(getToolBehaviorForPreset('review-all', 'Write')).toBe('confirm');
        expect(getToolBehaviorForPreset('review-all', 'Bash')).toBe('confirm');
      });

      it('should return correct behavior for read-only preset', () => {
        expect(getToolBehaviorForPreset('read-only', 'Read')).toBe('allow');
        expect(getToolBehaviorForPreset('read-only', 'Grep')).toBe('allow');
        expect(getToolBehaviorForPreset('read-only', 'Write')).toBe('deny');
        expect(getToolBehaviorForPreset('read-only', 'Bash')).toBe('deny');
      });
    });

    describe('isToolAllowedForPreset', () => {
      it('should correctly identify allowed tools', () => {
        expect(isToolAllowedForPreset('autonomous', 'Read')).toBe(true);
        expect(isToolAllowedForPreset('autonomous', 'Write')).toBe(true);
        expect(isToolAllowedForPreset('read-only', 'Read')).toBe(true);
        expect(isToolAllowedForPreset('read-only', 'Write')).toBe(false);
      });
    });

    describe('isToolConfirmRequiredForPreset', () => {
      it('should correctly identify tools requiring confirmation', () => {
        expect(isToolConfirmRequiredForPreset('review-all', 'Read')).toBe(true);
        expect(isToolConfirmRequiredForPreset('review-all', 'Write')).toBe(true);
        expect(isToolConfirmRequiredForPreset('autonomous', 'Read')).toBe(false);
      });
    });

    describe('isToolDeniedForPreset', () => {
      it('should correctly identify denied tools', () => {
        expect(isToolDeniedForPreset('read-only', 'Write')).toBe(true);
        expect(isToolDeniedForPreset('read-only', 'Bash')).toBe(true);
        expect(isToolDeniedForPreset('read-only', 'Read')).toBe(false);
        expect(isToolDeniedForPreset('autonomous', 'Write')).toBe(false);
      });
    });

    describe('getPresetConfig', () => {
      it('should return correct config for each preset', () => {
        expect(getPresetConfig('autonomous')).toBe(PERMISSION_PRESET_CONFIGS.autonomous);
        expect(getPresetConfig('review-all')).toBe(PERMISSION_PRESET_CONFIGS['review-all']);
        expect(getPresetConfig('read-only')).toBe(PERMISSION_PRESET_CONFIGS['read-only']);
      });
    });

    describe('isPermissionPreset', () => {
      it('should correctly validate permission presets', () => {
        expect(isPermissionPreset('autonomous')).toBe(true);
        expect(isPermissionPreset('review-all')).toBe(true);
        expect(isPermissionPreset('read-only')).toBe(true);
        expect(isPermissionPreset('invalid')).toBe(false);
        expect(isPermissionPreset('')).toBe(false);
        expect(isPermissionPreset(null)).toBe(false);
        expect(isPermissionPreset(undefined)).toBe(false);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work with all presets and all tools', () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      presets.forEach(preset => {
        ALL_TOOLS.forEach(tool => {
          // These should not throw
          expect(() => getToolBehaviorForPreset(preset, tool)).not.toThrow();
          expect(() => isToolAllowedForPreset(preset, tool)).not.toThrow();
          expect(() => isToolConfirmRequiredForPreset(preset, tool)).not.toThrow();
          expect(() => isToolDeniedForPreset(preset, tool)).not.toThrow();
        });
      });
    });

    it('should have mutually exclusive behavior results', () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      presets.forEach(preset => {
        ALL_TOOLS.forEach(tool => {
          const isAllowed = isToolAllowedForPreset(preset, tool);
          const requiresConfirm = isToolConfirmRequiredForPreset(preset, tool);
          const isDenied = isToolDeniedForPreset(preset, tool);

          // Exactly one should be true
          const trueCount = [isAllowed, requiresConfirm, isDenied].filter(Boolean).length;
          expect(trueCount).toBe(1);
        });
      });
    });

    it('should have consistent behavior with config defaults', () => {
      // Test that helper functions match the config behavior
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      presets.forEach(preset => {
        const config = getPresetConfig(preset);

        ALL_TOOLS.forEach(tool => {
          const behavior = getToolBehaviorForPreset(preset, tool);
          const isAllowed = isToolAllowedForPreset(preset, tool);
          const requiresConfirm = isToolConfirmRequiredForPreset(preset, tool);
          const isDenied = isToolDeniedForPreset(preset, tool);

          // Verify consistency
          expect(isAllowed).toBe(behavior === 'allow');
          expect(requiresConfirm).toBe(behavior === 'confirm');
          expect(isDenied).toBe(behavior === 'deny');
        });
      });
    });
  });
});

describe('PermissionPresetConfigSchema', () => {
  it('should validate preset configurations', () => {
    Object.values(PERMISSION_PRESET_CONFIGS).forEach(config => {
      expect(() => PermissionPresetConfigSchema.parse(config)).not.toThrow();
    });
  });

  it('should require valid preset names', () => {
    const invalidConfig = {
      name: 'invalid-preset',
      description: 'Test',
      defaultBehavior: 'allow',
      allowFileCreation: false,
      allowShellExecution: false,
      allowNetworkAccess: true,
    };

    expect(() => PermissionPresetConfigSchema.parse(invalidConfig)).toThrow();
  });

  it('should validate tool permission rules', () => {
    const configWithRules = {
      name: 'autonomous',
      description: 'Test config with rules',
      defaultBehavior: 'deny',
      rules: [
        { tool: 'Read', behavior: 'allow' },
        { tool: 'Write', behavior: 'confirm', scope: '/src/**' },
      ],
      allowFileCreation: false,
      allowShellExecution: false,
      allowNetworkAccess: true,
    };

    expect(() => PermissionPresetConfigSchema.parse(configWithRules)).not.toThrow();
  });
});

describe('Schema Validations', () => {
  describe('ToolPermissionBehaviorSchema', () => {
    it('should accept valid permission behaviors', () => {
      expect(ToolPermissionBehaviorSchema.parse('allow')).toBe('allow');
      expect(ToolPermissionBehaviorSchema.parse('confirm')).toBe('confirm');
      expect(ToolPermissionBehaviorSchema.parse('deny')).toBe('deny');
    });

    it('should reject invalid permission behaviors', () => {
      expect(() => ToolPermissionBehaviorSchema.parse('invalid')).toThrow();
      expect(() => ToolPermissionBehaviorSchema.parse('')).toThrow();
      expect(() => ToolPermissionBehaviorSchema.parse(null)).toThrow();
      expect(() => ToolPermissionBehaviorSchema.parse(undefined)).toThrow();
    });
  });

  describe('ToolPermissionRuleSchema', () => {
    it('should accept valid tool permission rules', () => {
      const validRule = {
        tool: 'Read',
        behavior: 'allow' as ToolPermissionBehavior,
      };
      expect(() => ToolPermissionRuleSchema.parse(validRule)).not.toThrow();
    });

    it('should accept rules with optional scope and reason', () => {
      const ruleWithExtras = {
        tool: 'Write',
        behavior: 'confirm' as ToolPermissionBehavior,
        scope: '/src/**',
        reason: 'Security restriction',
      };
      expect(() => ToolPermissionRuleSchema.parse(ruleWithExtras)).not.toThrow();
    });

    it('should reject invalid tool permission rules', () => {
      expect(() => ToolPermissionRuleSchema.parse({})).toThrow();
      expect(() => ToolPermissionRuleSchema.parse({ tool: '' })).toThrow();
      expect(() => ToolPermissionRuleSchema.parse({
        tool: 'Read',
        behavior: 'invalid'
      })).toThrow();
    });
  });
});

describe('Edge Cases and Error Handling', () => {
  describe('getToolBehaviorForPreset with wildcards/patterns', () => {
    it('should handle unknown tools gracefully', () => {
      expect(() => getToolBehaviorForPreset('autonomous', 'UnknownTool')).not.toThrow();
      expect(getToolBehaviorForPreset('autonomous', 'UnknownTool')).toBe('allow');
      expect(getToolBehaviorForPreset('review-all', 'UnknownTool')).toBe('confirm');
      expect(getToolBehaviorForPreset('read-only', 'UnknownTool')).toBe('deny');
    });

    it('should handle empty tool names', () => {
      expect(() => getToolBehaviorForPreset('autonomous', '')).not.toThrow();
      expect(getToolBehaviorForPreset('autonomous', '')).toBe('allow');
    });

    it('should handle special characters in tool names', () => {
      expect(() => getToolBehaviorForPreset('autonomous', 'Tool-With-Dashes')).not.toThrow();
      expect(() => getToolBehaviorForPreset('autonomous', 'Tool_With_Underscores')).not.toThrow();
      expect(() => getToolBehaviorForPreset('autonomous', 'Tool123')).not.toThrow();
    });
  });

  describe('Type guards', () => {
    it('should handle various data types for isPermissionPreset', () => {
      expect(isPermissionPreset('autonomous')).toBe(true);
      expect(isPermissionPreset(123)).toBe(false);
      expect(isPermissionPreset(true)).toBe(false);
      expect(isPermissionPreset([])).toBe(false);
      expect(isPermissionPreset({})).toBe(false);
      expect(isPermissionPreset(Symbol('test'))).toBe(false);
    });
  });
});

describe('Tool Constants Completeness', () => {
  it('should have no duplicate tools between read-only and write tools', () => {
    const readOnlySet = new Set(READ_ONLY_TOOLS);
    const writeSet = new Set(WRITE_TOOLS);

    READ_ONLY_TOOLS.forEach(tool => {
      expect(writeSet.has(tool)).toBe(false);
    });

    WRITE_TOOLS.forEach(tool => {
      expect(readOnlySet.has(tool)).toBe(false);
    });
  });

  it('should have ALL_TOOLS as union of read-only and write tools without duplicates', () => {
    const allToolsSet = new Set(ALL_TOOLS);
    expect(allToolsSet.size).toBe(READ_ONLY_TOOLS.length + WRITE_TOOLS.length);

    READ_ONLY_TOOLS.forEach(tool => {
      expect(allToolsSet.has(tool)).toBe(true);
    });

    WRITE_TOOLS.forEach(tool => {
      expect(allToolsSet.has(tool)).toBe(true);
    });
  });
});

describe('Permission Preset Configurations Deep Validation', () => {
  it('should have consistent rules and default behavior for read-only preset', () => {
    const config = PERMISSION_PRESET_CONFIGS['read-only'];

    // All read-only tools should have explicit allow rules
    READ_ONLY_TOOLS.forEach(tool => {
      const rule = config.rules?.find(r => r.tool === tool);
      expect(rule).toBeDefined();
      expect(rule?.behavior).toBe('allow');
    });

    // Write tools should use default behavior (deny)
    WRITE_TOOLS.forEach(tool => {
      const rule = config.rules?.find(r => r.tool === tool);
      expect(rule).toBeUndefined(); // Should use default behavior
    });
  });

  it('should have empty or minimal rules for autonomous preset', () => {
    const config = PERMISSION_PRESET_CONFIGS.autonomous;
    expect(config.rules).toEqual([]);
    expect(config.defaultBehavior).toBe('allow');
  });

  it('should have empty or minimal rules for review-all preset', () => {
    const config = PERMISSION_PRESET_CONFIGS['review-all'];
    expect(config.rules).toEqual([]);
    expect(config.defaultBehavior).toBe('confirm');
  });
});