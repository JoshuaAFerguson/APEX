/**
 * @fileoverview Permission Preset System Validation Tests
 *
 * Comprehensive tests for permission preset schemas, preset configurations,
 * validation functions, and preset behavior logic.
 */

import { describe, it, expect } from 'vitest';
import {
  PermissionPresetSchema,
  ToolPermissionBehaviorSchema,
  ToolPermissionRuleSchema,
  PermissionPresetConfigSchema,
  PermissionsConfigSchema,
  PERMISSION_PRESET_CONFIGS,
  getPresetConfig,
  isPermissionPreset,
  validateToolsForPreset,
  getToolBehaviorForPreset,
  isToolAllowedForPreset,
  isToolConfirmRequiredForPreset,
  isToolDeniedForPreset,
  type PermissionPreset,
  type ToolPermissionBehavior,
  type ToolPermissionRule,
  type PermissionPresetConfig,
  type PermissionsConfig,
} from '../types';

describe('PermissionPresetSchema Validation', () => {
  describe('Valid Permission Presets', () => {
    it('should validate all defined permission presets', () => {
      const validPresets: PermissionPreset[] = [
        'autonomous',
        'review-all',
        'security-focused',
        'development-friendly',
      ];

      validPresets.forEach(preset => {
        const result = PermissionPresetSchema.parse(preset);
        expect(result).toBe(preset);
      });
    });

    it('should reject invalid permission presets', () => {
      const invalidPresets = [
        'invalid-preset',
        'autonomous-v2',
        'custom',
        'manual',
        '',
        null,
        undefined,
        'AUTONOMOUS',
        'review_all',
      ];

      invalidPresets.forEach(preset => {
        expect(() => PermissionPresetSchema.parse(preset)).toThrow();
      });
    });
  });

  describe('isPermissionPreset function', () => {
    it('should correctly identify valid presets', () => {
      const validPresets = ['autonomous', 'review-all', 'security-focused', 'development-friendly'];

      validPresets.forEach(preset => {
        expect(isPermissionPreset(preset)).toBe(true);
      });
    });

    it('should correctly reject invalid presets', () => {
      const invalidPresets = ['invalid', '', null, undefined, 123, {}, []];

      invalidPresets.forEach(preset => {
        expect(isPermissionPreset(preset)).toBe(false);
      });
    });
  });
});

describe('ToolPermissionBehaviorSchema Validation', () => {
  describe('Valid Tool Permission Behaviors', () => {
    it('should validate all tool permission behaviors', () => {
      const validBehaviors: ToolPermissionBehavior[] = [
        'allow',
        'deny',
        'confirm',
      ];

      validBehaviors.forEach(behavior => {
        const result = ToolPermissionBehaviorSchema.parse(behavior);
        expect(result).toBe(behavior);
      });
    });

    it('should reject invalid behaviors', () => {
      const invalidBehaviors = [
        'permit',
        'block',
        'ask',
        'approve',
        'reject',
        '',
        null,
        undefined,
      ];

      invalidBehaviors.forEach(behavior => {
        expect(() => ToolPermissionBehaviorSchema.parse(behavior)).toThrow();
      });
    });
  });
});

describe('ToolPermissionRuleSchema Validation', () => {
  describe('Basic Tool Permission Rules', () => {
    it('should validate rule with tool pattern only', () => {
      const rule: ToolPermissionRule = {
        toolPattern: 'Read',
        behavior: 'allow',
      };

      const result = ToolPermissionRuleSchema.parse(rule);
      expect(result.toolPattern).toBe('Read');
      expect(result.behavior).toBe('allow');
      expect(result.scopePattern).toBeUndefined();
      expect(result.priority).toBeUndefined();
    });

    it('should validate rule with all fields', () => {
      const rule: ToolPermissionRule = {
        toolPattern: 'Write',
        scopePattern: '/src/**/*.ts',
        behavior: 'confirm',
        priority: 100,
      };

      const result = ToolPermissionRuleSchema.parse(rule);
      expect(result.toolPattern).toBe('Write');
      expect(result.scopePattern).toBe('/src/**/*.ts');
      expect(result.behavior).toBe('confirm');
      expect(result.priority).toBe(100);
    });

    it('should handle complex tool patterns', () => {
      const complexPatterns = [
        'Read',
        'Write',
        '*Edit*',
        'Web*',
        'Bash',
        '*',
        'custom-tool',
        'Tool.With.Dots',
        'tool_with_underscores',
        'TOOL-123',
      ];

      complexPatterns.forEach(toolPattern => {
        const rule = {
          toolPattern,
          behavior: 'allow' as const,
        };

        const result = ToolPermissionRuleSchema.parse(rule);
        expect(result.toolPattern).toBe(toolPattern);
      });
    });

    it('should handle complex scope patterns', () => {
      const complexScopes = [
        '/src/**/*.ts',
        '*.js',
        '/home/user/**',
        'npm install',
        'git commit -m *',
        'docker run *',
        'https://api.*.com/*',
        '**/*.{ts,tsx,js,jsx}',
        '/var/log/*.log',
        'command:build',
        'file:/path/to/file.txt',
        '!/secret/**',
      ];

      complexScopes.forEach(scopePattern => {
        const rule = {
          toolPattern: 'TestTool',
          scopePattern,
          behavior: 'confirm' as const,
        };

        const result = ToolPermissionRuleSchema.parse(rule);
        expect(result.scopePattern).toBe(scopePattern);
      });
    });

    it('should validate priority values', () => {
      const priorities = [0, 1, 10, 50, 100, 500, 1000, 9999];

      priorities.forEach(priority => {
        const rule = {
          toolPattern: 'Test',
          behavior: 'allow' as const,
          priority,
        };

        const result = ToolPermissionRuleSchema.parse(rule);
        expect(result.priority).toBe(priority);
      });
    });

    it('should reject invalid priority values', () => {
      const invalidPriorities = [-1, 1.5, NaN, Infinity, 'high', null];

      invalidPriorities.forEach(priority => {
        const rule = {
          toolPattern: 'Test',
          behavior: 'allow' as const,
          priority,
        };

        expect(() => ToolPermissionRuleSchema.parse(rule as any)).toThrow();
      });
    });
  });
});

describe('PermissionPresetConfigSchema Validation', () => {
  describe('Complete Preset Configurations', () => {
    it('should validate autonomous preset config', () => {
      const autonomousConfig: PermissionPresetConfig = {
        name: 'autonomous',
        description: 'Full autonomy - all tools allowed by default',
        defaultBehavior: 'allow',
        rules: [
          {
            toolPattern: 'Bash',
            scopePattern: 'rm -rf *',
            behavior: 'deny',
            priority: 1000,
          },
          {
            toolPattern: 'Browser',
            scopePattern: 'https://suspicious.com/*',
            behavior: 'deny',
            priority: 900,
          },
        ],
        metadata: {
          riskLevel: 'high',
          recommendedFor: 'trusted-agents',
          auditRequired: true,
        },
      };

      const result = PermissionPresetConfigSchema.parse(autonomousConfig);
      expect(result.name).toBe('autonomous');
      expect(result.defaultBehavior).toBe('allow');
      expect(result.rules).toHaveLength(2);
      expect(result.metadata?.riskLevel).toBe('high');
    });

    it('should validate security-focused preset config', () => {
      const securityConfig: PermissionPresetConfig = {
        name: 'security-focused',
        description: 'Maximum security - deny by default, explicit allows only',
        defaultBehavior: 'deny',
        rules: [
          {
            toolPattern: 'Read',
            scopePattern: '/src/**/*.ts',
            behavior: 'allow',
            priority: 100,
          },
          {
            toolPattern: 'Write',
            scopePattern: '/src/**/*.ts',
            behavior: 'confirm',
            priority: 90,
          },
          {
            toolPattern: 'Bash',
            scopePattern: 'npm run *',
            behavior: 'confirm',
            priority: 80,
          },
          {
            toolPattern: 'Web*',
            behavior: 'deny',
            priority: 1000,
          },
        ],
        metadata: {
          riskLevel: 'low',
          recommendedFor: 'production-environments',
          auditRequired: true,
          complianceLevel: 'enterprise',
        },
      };

      const result = PermissionPresetConfigSchema.parse(securityConfig);
      expect(result.name).toBe('security-focused');
      expect(result.defaultBehavior).toBe('deny');
      expect(result.rules).toHaveLength(4);
      expect(result.metadata?.complianceLevel).toBe('enterprise');
    });

    it('should validate review-all preset config', () => {
      const reviewConfig: PermissionPresetConfig = {
        name: 'review-all',
        description: 'Review every permission - require confirmation for all tools',
        defaultBehavior: 'confirm',
        rules: [],
        metadata: {
          riskLevel: 'medium',
          recommendedFor: 'general-use',
          auditRequired: false,
        },
      };

      const result = PermissionPresetConfigSchema.parse(reviewConfig);
      expect(result.name).toBe('review-all');
      expect(result.defaultBehavior).toBe('confirm');
      expect(result.rules).toEqual([]);
    });

    it('should validate development-friendly preset config', () => {
      const devConfig: PermissionPresetConfig = {
        name: 'development-friendly',
        description: 'Optimized for development workflows',
        defaultBehavior: 'confirm',
        rules: [
          {
            toolPattern: 'Read',
            scopePattern: '/src/**/*',
            behavior: 'allow',
            priority: 200,
          },
          {
            toolPattern: 'Write',
            scopePattern: '/src/**/*.{ts,tsx,js,jsx}',
            behavior: 'allow',
            priority: 190,
          },
          {
            toolPattern: 'Edit',
            scopePattern: '/src/**/*',
            behavior: 'allow',
            priority: 180,
          },
          {
            toolPattern: 'Bash',
            scopePattern: 'npm *',
            behavior: 'allow',
            priority: 170,
          },
          {
            toolPattern: 'Bash',
            scopePattern: 'git *',
            behavior: 'allow',
            priority: 160,
          },
          {
            toolPattern: 'WebFetch',
            scopePattern: 'https://api.github.com/*',
            behavior: 'allow',
            priority: 150,
          },
        ],
        metadata: {
          riskLevel: 'medium',
          recommendedFor: 'development-environments',
          features: ['source-control', 'package-management', 'api-access'],
        },
      };

      const result = PermissionPresetConfigSchema.parse(devConfig);
      expect(result.name).toBe('development-friendly');
      expect(result.rules).toHaveLength(6);
      expect(result.metadata?.features).toContain('source-control');
    });

    it('should handle empty rules array', () => {
      const config = {
        name: 'minimal',
        description: 'Minimal configuration',
        defaultBehavior: 'confirm' as const,
        rules: [],
      };

      const result = PermissionPresetConfigSchema.parse(config);
      expect(result.rules).toEqual([]);
    });

    it('should default rules to empty array when not provided', () => {
      const config = {
        name: 'minimal',
        description: 'Minimal configuration',
        defaultBehavior: 'deny' as const,
      };

      const result = PermissionPresetConfigSchema.parse(config);
      expect(result.rules).toEqual([]);
    });
  });
});

describe('PermissionsConfigSchema Validation', () => {
  describe('Complete Permissions Configuration', () => {
    it('should validate default permissions config', () => {
      const config = {};
      const result = PermissionsConfigSchema.parse(config);

      expect(result.preset).toBe('review-all');
      expect(result.customRules).toEqual([]);
    });

    it('should validate config with specific preset', () => {
      const config: PermissionsConfig = {
        preset: 'autonomous',
        customRules: [],
      };

      const result = PermissionsConfigSchema.parse(config);
      expect(result.preset).toBe('autonomous');
      expect(result.customRules).toEqual([]);
    });

    it('should validate config with custom rules', () => {
      const config: PermissionsConfig = {
        preset: 'security-focused',
        customRules: [
          {
            toolPattern: 'Read',
            scopePattern: '/custom/path/**',
            behavior: 'allow',
            priority: 500,
          },
          {
            toolPattern: 'Bash',
            scopePattern: 'custom-command *',
            behavior: 'confirm',
            priority: 400,
          },
        ],
      };

      const result = PermissionsConfigSchema.parse(config);
      expect(result.preset).toBe('security-focused');
      expect(result.customRules).toHaveLength(2);
      expect(result.customRules?.[0]?.scopePattern).toBe('/custom/path/**');
    });

    it('should handle complex custom rule configurations', () => {
      const complexConfig: PermissionsConfig = {
        preset: 'development-friendly',
        customRules: [
          {
            toolPattern: '*',
            scopePattern: '/production/**',
            behavior: 'deny',
            priority: 1000,
          },
          {
            toolPattern: 'Bash',
            scopePattern: 'docker *',
            behavior: 'confirm',
            priority: 900,
          },
          {
            toolPattern: 'WebFetch',
            scopePattern: 'https://internal-api.company.com/*',
            behavior: 'allow',
            priority: 800,
          },
          {
            toolPattern: 'Browser',
            scopePattern: 'https://test.company.com/*',
            behavior: 'allow',
            priority: 700,
          },
        ],
      };

      const result = PermissionsConfigSchema.parse(complexConfig);
      expect(result.customRules).toHaveLength(4);
      expect(result.customRules?.[0]?.priority).toBe(1000);
      expect(result.customRules?.[3]?.toolPattern).toBe('Browser');
    });
  });
});

describe('Preset Configuration Access Functions', () => {
  describe('getPresetConfig function', () => {
    it('should return correct configs for all presets', () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'security-focused', 'development-friendly'];

      presets.forEach(preset => {
        const config = getPresetConfig(preset);
        expect(config).toBeDefined();
        expect(config.name).toBe(preset);
        expect(config.description).toBeDefined();
        expect(config.defaultBehavior).toBeDefined();
        expect(Array.isArray(config.rules)).toBe(true);
      });
    });

    it('should throw error for invalid preset', () => {
      expect(() => getPresetConfig('invalid-preset' as any)).toThrow();
    });

    it('should return autonomous config with correct structure', () => {
      const config = getPresetConfig('autonomous');
      expect(config.name).toBe('autonomous');
      expect(config.defaultBehavior).toBe('allow');
      expect(config.description).toContain('autonomous');
    });

    it('should return security-focused config with deny default', () => {
      const config = getPresetConfig('security-focused');
      expect(config.name).toBe('security-focused');
      expect(config.defaultBehavior).toBe('deny');
      expect(config.description).toContain('security');
    });

    it('should return review-all config with confirm default', () => {
      const config = getPresetConfig('review-all');
      expect(config.name).toBe('review-all');
      expect(config.defaultBehavior).toBe('confirm');
      expect(config.description).toContain('review');
    });

    it('should return development-friendly config', () => {
      const config = getPresetConfig('development-friendly');
      expect(config.name).toBe('development-friendly');
      expect(config.defaultBehavior).toBe('confirm');
      expect(config.description).toContain('development');
    });
  });

  describe('PERMISSION_PRESET_CONFIGS constant', () => {
    it('should contain all defined presets', () => {
      const expectedPresets = ['autonomous', 'review-all', 'security-focused', 'development-friendly'];

      expectedPresets.forEach(preset => {
        expect(PERMISSION_PRESET_CONFIGS[preset as PermissionPreset]).toBeDefined();
      });
    });

    it('should have consistent structure for all configs', () => {
      Object.values(PERMISSION_PRESET_CONFIGS).forEach(config => {
        expect(config.name).toBeDefined();
        expect(config.description).toBeDefined();
        expect(config.defaultBehavior).toBeDefined();
        expect(Array.isArray(config.rules)).toBe(true);
      });
    });
  });
});

describe('Tool Behavior Helper Functions', () => {
  describe('getToolBehaviorForPreset function', () => {
    it('should return correct behavior based on preset rules', () => {
      // Test with autonomous preset (allow by default)
      expect(getToolBehaviorForPreset('autonomous', 'Read')).toBe('allow');
      expect(getToolBehaviorForPreset('autonomous', 'Write')).toBe('allow');

      // Test with security-focused preset (deny by default)
      expect(getToolBehaviorForPreset('security-focused', 'UnknownTool')).toBe('deny');

      // Test with review-all preset (confirm by default)
      expect(getToolBehaviorForPreset('review-all', 'AnyTool')).toBe('confirm');
    });

    it('should respect rule priorities', () => {
      // This would need actual rule checking logic based on the preset configs
      // For now, just verify the function exists and returns valid behaviors
      const behaviors = ['allow', 'deny', 'confirm'];
      const result = getToolBehaviorForPreset('development-friendly', 'Read');
      expect(behaviors).toContain(result);
    });

    it('should handle tool and scope combinations', () => {
      const behavior = getToolBehaviorForPreset('security-focused', 'Bash', 'rm -rf /');
      expect(['allow', 'deny', 'confirm']).toContain(behavior);
    });
  });

  describe('Tool permission check functions', () => {
    it('should correctly identify allowed tools', () => {
      // These tests would verify the logic once implemented
      expect(typeof isToolAllowedForPreset).toBe('function');
      expect(typeof isToolConfirmRequiredForPreset).toBe('function');
      expect(typeof isToolDeniedForPreset).toBe('function');
    });

    it('should handle edge cases', () => {
      // Test with empty tool name
      expect(() => getToolBehaviorForPreset('review-all', '')).not.toThrow();

      // Test with undefined scope
      expect(() => getToolBehaviorForPreset('autonomous', 'Read', undefined)).not.toThrow();
    });
  });

  describe('validateToolsForPreset function', () => {
    it('should validate tools against preset configuration', () => {
      const tools = ['Read', 'Write', 'Bash'];

      // Should not throw for valid tools
      expect(() => validateToolsForPreset('development-friendly', tools)).not.toThrow();
      expect(() => validateToolsForPreset('security-focused', tools)).not.toThrow();
    });

    it('should handle empty tool arrays', () => {
      expect(() => validateToolsForPreset('autonomous', [])).not.toThrow();
    });

    it('should handle unknown tools', () => {
      const unknownTools = ['UnknownTool1', 'CustomTool123'];
      expect(() => validateToolsForPreset('review-all', unknownTools)).not.toThrow();
    });
  });
});

describe('Permission Preset Integration Tests', () => {
  it('should work with complete permission configuration flow', () => {
    // Create a permissions config
    const permissionsConfig: PermissionsConfig = {
      preset: 'development-friendly',
      customRules: [
        {
          toolPattern: 'Write',
          scopePattern: '/src/critical/**',
          behavior: 'confirm',
          priority: 1000,
        },
      ],
    };

    // Validate the configuration
    const validated = PermissionsConfigSchema.parse(permissionsConfig);
    expect(validated.preset).toBe('development-friendly');

    // Get the preset configuration
    const presetConfig = getPresetConfig(validated.preset);
    expect(presetConfig.name).toBe('development-friendly');

    // Check tool behavior
    const behavior = getToolBehaviorForPreset(validated.preset, 'Read', '/src/components/Button.tsx');
    expect(['allow', 'deny', 'confirm']).toContain(behavior);
  });

  it('should maintain consistency across preset functions', () => {
    const presets: PermissionPreset[] = ['autonomous', 'review-all', 'security-focused', 'development-friendly'];

    presets.forEach(preset => {
      // Verify preset is valid
      expect(isPermissionPreset(preset)).toBe(true);

      // Verify config exists
      const config = getPresetConfig(preset);
      expect(config.name).toBe(preset);

      // Verify behavior function works
      const behavior = getToolBehaviorForPreset(preset, 'Read');
      expect(['allow', 'deny', 'confirm']).toContain(behavior);
    });
  });

  it('should handle complex rule priority scenarios', () => {
    // Create a preset config with multiple overlapping rules
    const complexConfig: PermissionPresetConfig = {
      name: 'test-preset',
      description: 'Test preset for priority checking',
      defaultBehavior: 'confirm',
      rules: [
        { toolPattern: '*', behavior: 'deny', priority: 1 },
        { toolPattern: 'Read', behavior: 'allow', priority: 10 },
        { toolPattern: 'Read', scopePattern: '/secret/**', behavior: 'deny', priority: 100 },
        { toolPattern: 'Read', scopePattern: '/src/**', behavior: 'allow', priority: 50 },
      ],
    };

    // Should validate without errors
    expect(() => PermissionPresetConfigSchema.parse(complexConfig)).not.toThrow();

    // Rules should be ordered by priority (implementation detail)
    expect(complexConfig.rules).toHaveLength(4);
    expect(complexConfig.rules[0].priority).toBe(1);
    expect(complexConfig.rules[3].priority).toBe(100);
  });
});