import { describe, it, expect } from 'vitest';
import {
  PermissionsConfigSchema,
  ToolPermissionRuleSchema,
  getToolBehaviorForPreset,
  PERMISSION_PRESET_CONFIGS,
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  ALL_TOOLS,
} from '../types';

describe('Permissions Edge Cases and Constants', () => {
  describe('Permission Constants', () => {
    it('should have correct read-only tools defined', () => {
      expect(READ_ONLY_TOOLS).toContain('Read');
      expect(READ_ONLY_TOOLS).toContain('Grep');
      expect(READ_ONLY_TOOLS).toContain('Glob');
      expect(READ_ONLY_TOOLS).toContain('WebFetch');
      expect(READ_ONLY_TOOLS).toContain('WebSearch');
      expect(READ_ONLY_TOOLS).toHaveLength(5);
    });

    it('should have correct write tools defined', () => {
      expect(WRITE_TOOLS).toContain('Write');
      expect(WRITE_TOOLS).toContain('Edit');
      expect(WRITE_TOOLS).toContain('MultiEdit');
      expect(WRITE_TOOLS).toContain('NotebookEdit');
      expect(WRITE_TOOLS).toContain('Bash');
      expect(WRITE_TOOLS).toContain('TodoWrite');
      expect(WRITE_TOOLS).toHaveLength(6);
    });

    it('should have all tools as union of read-only and write tools', () => {
      expect(ALL_TOOLS).toHaveLength(READ_ONLY_TOOLS.length + WRITE_TOOLS.length);

      for (const tool of READ_ONLY_TOOLS) {
        expect(ALL_TOOLS).toContain(tool);
      }

      for (const tool of WRITE_TOOLS) {
        expect(ALL_TOOLS).toContain(tool);
      }
    });
  });

  describe('PERMISSION_PRESET_CONFIGS validation', () => {
    it('should have configs for all presets', () => {
      expect(PERMISSION_PRESET_CONFIGS['autonomous']).toBeDefined();
      expect(PERMISSION_PRESET_CONFIGS['review-all']).toBeDefined();
      expect(PERMISSION_PRESET_CONFIGS['read-only']).toBeDefined();
    });

    it('should have consistent read-only rules with READ_ONLY_TOOLS', () => {
      const readOnlyConfig = PERMISSION_PRESET_CONFIGS['read-only'];
      const allowRules = readOnlyConfig.rules.filter(rule => rule.behavior === 'allow');

      expect(allowRules).toHaveLength(READ_ONLY_TOOLS.length);

      for (const tool of READ_ONLY_TOOLS) {
        expect(allowRules.some(rule => rule.tool === tool)).toBe(true);
      }
    });
  });

  describe('Complex custom rule scenarios', () => {
    it('should handle rules with wildcards in tool names', () => {
      const config = {
        preset: 'review-all',
        customRules: [
          { tool: 'Web*', behavior: 'allow' },
          { tool: '*Edit*', behavior: 'deny' },
        ],
      };

      expect(() => PermissionsConfigSchema.parse(config)).not.toThrow();
    });

    it('should handle rules with complex scopes', () => {
      const config = {
        preset: 'autonomous',
        customRules: [
          { tool: 'Write', behavior: 'confirm', scope: '/src/**/*.{js,ts,jsx,tsx}' },
          { tool: 'Bash', behavior: 'deny', scope: 'rm -rf *' },
          { tool: 'Edit', behavior: 'allow', scope: '*.md' },
        ],
      };

      expect(() => PermissionsConfigSchema.parse(config)).not.toThrow();
      const parsed = PermissionsConfigSchema.parse(config);
      expect(parsed.customRules).toHaveLength(3);
    });

    it('should handle rules with detailed reasons', () => {
      const config = {
        preset: 'read-only',
        customRules: [
          {
            tool: 'TodoWrite',
            behavior: 'allow',
            reason: 'Todo management is safe and doesn\'t modify actual code files',
          },
          {
            tool: 'Write',
            behavior: 'confirm',
            scope: '/tmp/**',
            reason: 'Temporary file writes may be needed for debugging but should be confirmed',
          },
        ],
      };

      expect(() => PermissionsConfigSchema.parse(config)).not.toThrow();
      const parsed = PermissionsConfigSchema.parse(config);
      expect(parsed.customRules[0].reason).toContain('Todo management is safe');
    });
  });

  describe('Edge case behavior testing', () => {
    it('should handle tool names with special characters', () => {
      expect(() => getToolBehaviorForPreset('autonomous', 'Tool-With-Dashes')).not.toThrow();
      expect(() => getToolBehaviorForPreset('review-all', 'Tool_With_Underscores')).not.toThrow();
      expect(() => getToolBehaviorForPreset('read-only', 'Tool123')).not.toThrow();
    });

    it('should handle empty custom rules array', () => {
      const config = {
        preset: 'autonomous',
        customRules: [],
      };

      expect(() => PermissionsConfigSchema.parse(config)).not.toThrow();
      const parsed = PermissionsConfigSchema.parse(config);
      expect(parsed.customRules).toEqual([]);
    });

    it('should reject rules with empty strings', () => {
      expect(() => ToolPermissionRuleSchema.parse({
        tool: '',
        behavior: 'allow',
      })).toThrow();

      expect(() => ToolPermissionRuleSchema.parse({
        tool: 'Read',
        behavior: 'allow',
        scope: '',
        reason: '',
      })).not.toThrow(); // Empty strings in optional fields should be allowed
    });
  });

  describe('Preset behavior validation', () => {
    it('should ensure autonomous allows all tools', () => {
      const testTools = ['Read', 'Write', 'Bash', 'Edit', 'CustomTool', 'Web*'];

      for (const tool of testTools) {
        expect(getToolBehaviorForPreset('autonomous', tool)).toBe('allow');
      }
    });

    it('should ensure review-all requires confirmation for all tools', () => {
      const testTools = ['Read', 'Write', 'Bash', 'Edit', 'CustomTool', 'Web*'];

      for (const tool of testTools) {
        expect(getToolBehaviorForPreset('review-all', tool)).toBe('confirm');
      }
    });

    it('should ensure read-only properly distinguishes tool types', () => {
      // Read-only tools should be allowed
      for (const tool of READ_ONLY_TOOLS) {
        expect(getToolBehaviorForPreset('read-only', tool)).toBe('allow');
      }

      // Write tools should be denied
      for (const tool of WRITE_TOOLS) {
        expect(getToolBehaviorForPreset('read-only', tool)).toBe('deny');
      }

      // Unknown tools should be denied (following default behavior)
      expect(getToolBehaviorForPreset('read-only', 'UnknownTool')).toBe('deny');
    });
  });

  describe('Schema validation robustness', () => {
    it('should handle large numbers of custom rules', () => {
      const customRules = [];
      for (let i = 0; i < 100; i++) {
        customRules.push({
          tool: `Tool${i}`,
          behavior: i % 3 === 0 ? 'allow' : i % 3 === 1 ? 'confirm' : 'deny',
          scope: i % 2 === 0 ? `pattern${i}` : undefined,
          reason: i % 4 === 0 ? `Reason for tool ${i}` : undefined,
        });
      }

      const config = {
        preset: 'review-all',
        customRules: customRules.filter(rule => rule.behavior && rule.tool), // Ensure valid rules
      };

      expect(() => PermissionsConfigSchema.parse(config)).not.toThrow();
      const parsed = PermissionsConfigSchema.parse(config);
      expect(parsed.customRules).toHaveLength(100);
    });

    it('should validate mixed case in enum values', () => {
      expect(() => PermissionsConfigSchema.parse({
        preset: 'Autonomous', // Wrong case
      })).toThrow();

      expect(() => PermissionsConfigSchema.parse({
        preset: 'REVIEW-ALL', // Wrong case
      })).toThrow();

      expect(() => PermissionsConfigSchema.parse({
        customRules: [{
          tool: 'Read',
          behavior: 'ALLOW', // Wrong case
        }],
      })).toThrow();
    });
  });
});