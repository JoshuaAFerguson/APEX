import { describe, it, expect } from 'vitest';
import {
  ApexConfigSchema,
  PermissionsConfigSchema,
  PermissionPresetSchema,
  ToolPermissionRuleSchema,
  ToolPermissionBehaviorSchema,
  DirectoryAccessConfigSchema,
  FilesystemToolConfigSchema,
  ShellToolConfigSchema,
  WebToolConfigSchema,
  SearchToolConfigSchema,
  BaseToolPermissionConfigSchema,
  ToolPermissionConfigSchema,
  ExtendedPermissionSchema,
  PermissionSchema,
  PermissionLevelSchema,
  ToolPermissionSchema,
  getToolBehaviorForPreset,
  isToolAllowedForPreset,
  isToolConfirmRequiredForPreset,
  isToolDeniedForPreset,
  getPresetConfig,
  isPermissionPreset,
  PERMISSION_PRESET_CONFIGS,
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  ALL_TOOLS,
  PermissionPreset,
  ToolPermissionBehavior,
  ApexConfig,
} from '../types';
import { getEffectiveConfig } from '../config';

describe('permissions configuration coverage tests', () => {
  describe('schema coverage validation', () => {
    it('should export all required permission schemas', () => {
      expect(PermissionsConfigSchema).toBeDefined();
      expect(PermissionPresetSchema).toBeDefined();
      expect(ToolPermissionRuleSchema).toBeDefined();
      expect(ToolPermissionBehaviorSchema).toBeDefined();
      expect(DirectoryAccessConfigSchema).toBeDefined();
      expect(FilesystemToolConfigSchema).toBeDefined();
      expect(ShellToolConfigSchema).toBeDefined();
      expect(WebToolConfigSchema).toBeDefined();
      expect(SearchToolConfigSchema).toBeDefined();
      expect(BaseToolPermissionConfigSchema).toBeDefined();
      expect(ToolPermissionConfigSchema).toBeDefined();
      expect(ExtendedPermissionSchema).toBeDefined();
      expect(PermissionSchema).toBeDefined();
      expect(PermissionLevelSchema).toBeDefined();
      expect(ToolPermissionSchema).toBeDefined();
    });

    it('should export all helper functions', () => {
      expect(typeof getToolBehaviorForPreset).toBe('function');
      expect(typeof isToolAllowedForPreset).toBe('function');
      expect(typeof isToolConfirmRequiredForPreset).toBe('function');
      expect(typeof isToolDeniedForPreset).toBe('function');
      expect(typeof getPresetConfig).toBe('function');
      expect(typeof isPermissionPreset).toBe('function');
    });

    it('should export all constant values', () => {
      expect(PERMISSION_PRESET_CONFIGS).toBeDefined();
      expect(READ_ONLY_TOOLS).toBeDefined();
      expect(WRITE_TOOLS).toBeDefined();
      expect(ALL_TOOLS).toBeDefined();
    });
  });

  describe('enum and constant validation', () => {
    it('should validate all permission preset enum values', () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      for (const preset of presets) {
        expect(() => PermissionPresetSchema.parse(preset)).not.toThrow();
      }

      // Invalid presets should throw
      expect(() => PermissionPresetSchema.parse('invalid')).toThrow();
      expect(() => PermissionPresetSchema.parse('')).toThrow();
      expect(() => PermissionPresetSchema.parse(null)).toThrow();
    });

    it('should validate all tool permission behavior values', () => {
      const behaviors: ToolPermissionBehavior[] = ['allow', 'confirm', 'deny'];

      for (const behavior of behaviors) {
        expect(() => ToolPermissionBehaviorSchema.parse(behavior)).not.toThrow();
      }

      // Invalid behaviors should throw
      expect(() => ToolPermissionBehaviorSchema.parse('invalid')).toThrow();
      expect(() => ToolPermissionBehaviorSchema.parse('permit')).toThrow();
      expect(() => ToolPermissionBehaviorSchema.parse('block')).toThrow();
    });

    it('should have consistent tool categorization', () => {
      // Verify no overlap between read-only and write tools
      const readOnlySet = new Set(READ_ONLY_TOOLS);
      const writeSet = new Set(WRITE_TOOLS);

      for (const tool of READ_ONLY_TOOLS) {
        expect(writeSet.has(tool)).toBe(false);
      }

      for (const tool of WRITE_TOOLS) {
        expect(readOnlySet.has(tool)).toBe(false);
      }

      // Verify ALL_TOOLS contains both categories exactly
      const allToolsSet = new Set(ALL_TOOLS);
      expect(allToolsSet.size).toBe(READ_ONLY_TOOLS.length + WRITE_TOOLS.length);

      for (const tool of READ_ONLY_TOOLS) {
        expect(allToolsSet.has(tool)).toBe(true);
      }

      for (const tool of WRITE_TOOLS) {
        expect(allToolsSet.has(tool)).toBe(true);
      }
    });
  });

  describe('preset configuration consistency', () => {
    it('should have consistent preset configurations', () => {
      const allPresets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      for (const preset of allPresets) {
        const config = getPresetConfig(preset);

        expect(config.name).toBe(preset);
        expect(typeof config.description).toBe('string');
        expect(config.description.length).toBeGreaterThan(0);
        expect(['allow', 'confirm', 'deny']).toContain(config.defaultBehavior);
        expect(typeof config.allowFileCreation).toBe('boolean');
        expect(typeof config.allowShellExecution).toBe('boolean');
        expect(typeof config.allowNetworkAccess).toBe('boolean');
        expect(Array.isArray(config.rules)).toBe(true);
      }
    });

    it('should have consistent behavior across all tools for each preset', () => {
      const testTools = [...ALL_TOOLS, 'CustomTool', 'AnotherTool'];

      // Test autonomous preset - should allow all tools
      for (const tool of testTools) {
        expect(getToolBehaviorForPreset('autonomous', tool)).toBe('allow');
        expect(isToolAllowedForPreset('autonomous', tool)).toBe(true);
        expect(isToolConfirmRequiredForPreset('autonomous', tool)).toBe(false);
        expect(isToolDeniedForPreset('autonomous', tool)).toBe(false);
      }

      // Test review-all preset - should require confirmation for all tools
      for (const tool of testTools) {
        expect(getToolBehaviorForPreset('review-all', tool)).toBe('confirm');
        expect(isToolAllowedForPreset('review-all', tool)).toBe(false);
        expect(isToolConfirmRequiredForPreset('review-all', tool)).toBe(true);
        expect(isToolDeniedForPreset('review-all', tool)).toBe(false);
      }

      // Test read-only preset - should allow read-only tools, deny others
      for (const tool of READ_ONLY_TOOLS) {
        expect(getToolBehaviorForPreset('read-only', tool)).toBe('allow');
        expect(isToolAllowedForPreset('read-only', tool)).toBe(true);
        expect(isToolConfirmRequiredForPreset('read-only', tool)).toBe(false);
        expect(isToolDeniedForPreset('read-only', tool)).toBe(false);
      }

      for (const tool of WRITE_TOOLS) {
        expect(getToolBehaviorForPreset('read-only', tool)).toBe('deny');
        expect(isToolAllowedForPreset('read-only', tool)).toBe(false);
        expect(isToolConfirmRequiredForPreset('read-only', tool)).toBe(false);
        expect(isToolDeniedForPreset('read-only', tool)).toBe(true);
      }

      // Test custom tools with read-only preset (should default to deny)
      for (const tool of ['CustomTool', 'AnotherTool']) {
        expect(getToolBehaviorForPreset('read-only', tool)).toBe('deny');
        expect(isToolAllowedForPreset('read-only', tool)).toBe(false);
        expect(isToolDeniedForPreset('read-only', tool)).toBe(true);
      }
    });
  });

  describe('configuration schema integration', () => {
    it('should integrate permissions with ApexConfig correctly', () => {
      const fullConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        autonomy: { default: 'review-before-merge' },
        agents: { enabled: ['planner', 'developer'] },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku',
        },
        git: {
          branchPrefix: 'apex/',
          commitFormat: 'conventional',
        },
        limits: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 5.0,
        },
        permissions: {
          preset: 'autonomous',
          customRules: [
            { tool: 'Bash', behavior: 'confirm' },
            { tool: 'Write', behavior: 'deny', scope: '/etc/**' },
          ],
        },
      };

      const parsedConfig = ApexConfigSchema.parse(fullConfig);
      expect(parsedConfig.permissions?.preset).toBe('autonomous');
      expect(parsedConfig.permissions?.customRules).toHaveLength(2);

      const effectiveConfig = getEffectiveConfig(parsedConfig);
      expect(effectiveConfig.permissions.preset).toBe('autonomous');
      expect(effectiveConfig.permissions.customRules).toEqual([
        { tool: 'Bash', behavior: 'confirm' },
        { tool: 'Write', behavior: 'deny', scope: '/etc/**' },
      ]);
    });

    it('should apply correct defaults in effective config', () => {
      const minimalConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'minimal' },
      };

      const effectiveConfig = getEffectiveConfig(minimalConfig);

      expect(effectiveConfig.permissions.preset).toBe('review-all');
      expect(effectiveConfig.permissions.customRules).toEqual([]);

      // Other defaults should still be applied
      expect(effectiveConfig.autonomy.default).toBe('review-before-merge');
      expect(effectiveConfig.git.branchPrefix).toBe('apex/');
    });

    it('should preserve custom permissions in effective config', () => {
      const configWithCustomPermissions: ApexConfig = {
        version: '1.0',
        project: { name: 'custom-permissions' },
        permissions: {
          preset: 'read-only',
          customRules: [
            { tool: 'WebFetch', behavior: 'allow', scope: 'https://api.example.com/**' },
            { tool: 'TodoWrite', behavior: 'allow', reason: 'Allow task tracking' },
          ],
        },
      };

      const effectiveConfig = getEffectiveConfig(configWithCustomPermissions);

      expect(effectiveConfig.permissions.preset).toBe('read-only');
      expect(effectiveConfig.permissions.customRules).toHaveLength(2);
      expect(effectiveConfig.permissions.customRules[0]).toEqual({
        tool: 'WebFetch',
        behavior: 'allow',
        scope: 'https://api.example.com/**',
      });
      expect(effectiveConfig.permissions.customRules[1]).toEqual({
        tool: 'TodoWrite',
        behavior: 'allow',
        reason: 'Allow task tracking',
      });
    });
  });

  describe('type guard functions', () => {
    it('should validate isPermissionPreset with various inputs', () => {
      // Valid presets
      expect(isPermissionPreset('autonomous')).toBe(true);
      expect(isPermissionPreset('review-all')).toBe(true);
      expect(isPermissionPreset('read-only')).toBe(true);

      // Invalid strings
      expect(isPermissionPreset('invalid')).toBe(false);
      expect(isPermissionPreset('')).toBe(false);
      expect(isPermissionPreset('AUTONOMOUS')).toBe(false); // Case sensitive
      expect(isPermissionPreset('review_all')).toBe(false); // Wrong format

      // Non-string types
      expect(isPermissionPreset(null)).toBe(false);
      expect(isPermissionPreset(undefined)).toBe(false);
      expect(isPermissionPreset(123)).toBe(false);
      expect(isPermissionPreset(true)).toBe(false);
      expect(isPermissionPreset({})).toBe(false);
      expect(isPermissionPreset([])).toBe(false);
      expect(isPermissionPreset(Symbol('autonomous'))).toBe(false);
    });
  });

  describe('tool validation comprehensive coverage', () => {
    it('should handle all defined tools correctly', () => {
      const allDefinedTools = [
        'Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit',
        'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'TodoWrite'
      ];

      for (const tool of allDefinedTools) {
        // Should be in either READ_ONLY_TOOLS or WRITE_TOOLS
        const inReadOnly = READ_ONLY_TOOLS.includes(tool as any);
        const inWrite = WRITE_TOOLS.includes(tool as any);

        expect(inReadOnly || inWrite).toBe(true);
        expect(inReadOnly && inWrite).toBe(false); // Should not be in both

        // Should be in ALL_TOOLS
        expect(ALL_TOOLS.includes(tool as any)).toBe(true);

        // Should have consistent behavior across presets
        for (const preset of ['autonomous', 'review-all', 'read-only'] as const) {
          const behavior = getToolBehaviorForPreset(preset, tool);
          expect(['allow', 'confirm', 'deny']).toContain(behavior);
        }
      }
    });

    it('should handle tool name variations and edge cases', () => {
      const edgeCases = [
        '', // Empty string
        ' ', // Whitespace
        'NonExistentTool', // Non-existent tool
        'read', // Lowercase version of Read
        'WRITE', // Uppercase version of Write
        'Web*', // Wildcard pattern
        'Tool-With-Dashes',
        'Tool_With_Underscores',
        'Tool.With.Dots',
        'ToolWithNumbers123',
        '123ToolStartingWithNumbers',
      ];

      for (const toolName of edgeCases) {
        for (const preset of ['autonomous', 'review-all', 'read-only'] as const) {
          const behavior = getToolBehaviorForPreset(preset, toolName);
          const allowedValues: ToolPermissionBehavior[] = ['allow', 'confirm', 'deny'];

          expect(allowedValues).toContain(behavior);

          // Verify helper functions are consistent
          const isAllowed = isToolAllowedForPreset(preset, toolName);
          const needsConfirm = isToolConfirmRequiredForPreset(preset, toolName);
          const isDenied = isToolDeniedForPreset(preset, toolName);

          // Exactly one should be true
          const trueCount = [isAllowed, needsConfirm, isDenied].filter(Boolean).length;
          expect(trueCount).toBe(1);

          // Should match behavior
          if (behavior === 'allow') {
            expect(isAllowed).toBe(true);
            expect(needsConfirm).toBe(false);
            expect(isDenied).toBe(false);
          } else if (behavior === 'confirm') {
            expect(isAllowed).toBe(false);
            expect(needsConfirm).toBe(true);
            expect(isDenied).toBe(false);
          } else if (behavior === 'deny') {
            expect(isAllowed).toBe(false);
            expect(needsConfirm).toBe(false);
            expect(isDenied).toBe(true);
          }
        }
      }
    });
  });

  describe('configuration validation completeness', () => {
    it('should validate complete directory access configurations', () => {
      const complexDirectoryConfig = {
        allowlist: [
          '/home/user/projects/**',
          '/opt/app/src/**',
          '/tmp/workspace/**',
        ],
        blocklist: [
          '/home/user/projects/.git/**',
          '/home/user/projects/node_modules/**',
          '/opt/app/src/secrets/**',
          '/tmp/workspace/cache/**',
        ],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 20,
      };

      const result = DirectoryAccessConfigSchema.parse(complexDirectoryConfig);
      expect(result.allowlist).toHaveLength(3);
      expect(result.blocklist).toHaveLength(4);
      expect(result.defaultAllow).toBe(false);
      expect(result.maxDepth).toBe(20);
    });

    it('should validate complete extended permission configurations', () => {
      const complexExtendedPermission = {
        tool: 'Write',
        scope: '/project/src/**/*.{js,ts}',
        level: 'allow-always',
        expiry: new Date('2024-12-31T23:59:59Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        config: {
          enabled: true,
          timeout: 30000,
          requireConfirmation: true,
          rateLimitPerMinute: 5,
          directoryAccess: {
            allowlist: ['/project/src/**'],
            blocklist: ['/project/src/vendor/**'],
            defaultAllow: false,
            maxDepth: 10,
          },
          maxFileSize: 1024 * 1024, // 1MB
          allowedExtensions: ['.js', '.ts', '.jsx', '.tsx'],
          blockedExtensions: ['.exe', '.dll'],
          metadata: {
            projectType: 'nodejs',
            securityLevel: 'high',
            auditRequired: true,
          },
        },
        grantReason: 'Development team needs write access to source files',
        grantedBy: 'security-admin',
        tags: ['development', 'source-code', 'audited'],
      };

      const result = ExtendedPermissionSchema.parse(complexExtendedPermission);
      expect(result.tool).toBe('Write');
      expect(result.config?.enabled).toBe(true);
      expect((result.config as any)?.maxFileSize).toBe(1024 * 1024);
      expect(result.tags).toContain('development');
    });
  });
});