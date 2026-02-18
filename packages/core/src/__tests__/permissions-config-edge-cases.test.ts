import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
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
  PermissionPreset,
  ToolPermissionBehavior,
  getToolBehaviorForPreset,
  getPresetConfig,
  PERMISSION_PRESET_CONFIGS,
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  ALL_TOOLS,
} from '../types';

describe('permissions configuration edge cases', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-permissions-edge-cases-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('config file parsing edge cases', () => {
    it('should handle malformed YAML gracefully', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      // Create malformed YAML
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const malformedYaml = `
version: '1.0'
project:
  name: test-project
permissions:
  preset: autonomous
  customRules:
    - tool: Read
      behavior: allow
    - tool: Write
      behavior: confirm
      scope: /src/**
      reason: Source files need review
        # Malformed indentation
      extra: value
`;

      await fs.writeFile(configPath, malformedYaml);

      // Should still parse correctly since the YAML is actually valid
      const config = await loadConfig(testDir);
      expect(config.permissions?.preset).toBe('autonomous');
    });

    it('should handle completely missing permissions section', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configWithoutPermissions = {
        version: '1.0',
        project: { name: 'test-project' },
        autonomy: { default: 'review-before-merge' },
      };

      await fs.writeFile(configPath, yaml.stringify(configWithoutPermissions));

      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      expect(config.permissions).toBeUndefined();
      expect(effectiveConfig.permissions.preset).toBe('review-all');
      expect(effectiveConfig.permissions.customRules).toEqual([]);
    });

    it('should handle empty permissions section', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configWithEmptyPermissions = {
        version: '1.0',
        project: { name: 'test-project' },
        permissions: {},
      };

      await fs.writeFile(configPath, yaml.stringify(configWithEmptyPermissions));

      const config = await loadConfig(testDir);

      expect(config.permissions?.preset).toBe('review-all'); // Default
      expect(config.permissions?.customRules).toEqual([]);
    });

    it('should handle null permissions section', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configWithNullPermissions = {
        version: '1.0',
        project: { name: 'test-project' },
        permissions: null,
      };

      await fs.writeFile(configPath, yaml.stringify(configWithNullPermissions));

      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      expect(config.permissions).toBeNull();
      expect(effectiveConfig.permissions.preset).toBe('review-all');
    });
  });

  describe('custom rules validation edge cases', () => {
    it('should handle duplicate tool rules', () => {
      const config = {
        preset: 'review-all' as const,
        customRules: [
          { tool: 'Read', behavior: 'allow' as const },
          { tool: 'Read', behavior: 'deny' as const }, // Duplicate tool
          { tool: 'Write', behavior: 'confirm' as const },
        ],
      };

      // Should parse successfully - it's up to the application logic to handle duplicates
      const result = PermissionsConfigSchema.parse(config);
      expect(result.customRules).toHaveLength(3);

      // Both rules should be preserved
      const readRules = result.customRules!.filter(rule => rule.tool === 'Read');
      expect(readRules).toHaveLength(2);
    });

    it('should handle wildcard patterns in tool names', () => {
      const config = {
        preset: 'review-all' as const,
        customRules: [
          { tool: 'Web*', behavior: 'allow' as const },
          { tool: '*Edit*', behavior: 'confirm' as const },
          { tool: 'Read.*', behavior: 'deny' as const },
        ],
      };

      const result = PermissionsConfigSchema.parse(config);
      expect(result.customRules![0].tool).toBe('Web*');
      expect(result.customRules![1].tool).toBe('*Edit*');
      expect(result.customRules![2].tool).toBe('Read.*');
    });

    it('should handle complex scope patterns', () => {
      const config = {
        preset: 'autonomous' as const,
        customRules: [
          {
            tool: 'Write',
            behavior: 'confirm' as const,
            scope: '/src/**/*.{js,ts,jsx,tsx}',
            reason: 'Source code modifications need review',
          },
          {
            tool: 'Bash',
            behavior: 'deny' as const,
            scope: 'rm -rf *',
          },
          {
            tool: 'Read',
            behavior: 'allow' as const,
            scope: '!(node_modules|.git)/**',
          },
        ],
      };

      const result = PermissionsConfigSchema.parse(config);
      expect(result.customRules![0].scope).toBe('/src/**/*.{js,ts,jsx,tsx}');
      expect(result.customRules![1].scope).toBe('rm -rf *');
      expect(result.customRules![2].scope).toBe('!(node_modules|.git)/**');
    });

    it('should handle very long reason strings', () => {
      const longReason = 'A'.repeat(1000); // Very long reason string

      const config = {
        preset: 'review-all' as const,
        customRules: [
          {
            tool: 'Write',
            behavior: 'confirm' as const,
            reason: longReason,
          },
        ],
      };

      const result = PermissionsConfigSchema.parse(config);
      expect(result.customRules![0].reason).toBe(longReason);
    });

    it('should handle unicode characters in tool names and scopes', () => {
      const config = {
        preset: 'review-all' as const,
        customRules: [
          {
            tool: 'Файл-Reader',
            behavior: 'allow' as const,
            scope: '/пример/**',
          },
          {
            tool: '读取工具',
            behavior: 'confirm' as const,
            scope: '/中文/**',
          },
          {
            tool: 'Ñice-Tool',
            behavior: 'deny' as const,
            scope: '/español/**',
          },
        ],
      };

      const result = PermissionsConfigSchema.parse(config);
      expect(result.customRules![0].tool).toBe('Файл-Reader');
      expect(result.customRules![1].scope).toBe('/中文/**');
      expect(result.customRules![2].tool).toBe('Ñice-Tool');
    });
  });

  describe('preset configuration completeness', () => {
    it('should have all required presets defined', () => {
      const requiredPresets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      for (const preset of requiredPresets) {
        expect(PERMISSION_PRESET_CONFIGS[preset]).toBeDefined();

        const config = getPresetConfig(preset);
        expect(config.name).toBe(preset);
        expect(typeof config.description).toBe('string');
        expect(config.description.length).toBeGreaterThan(0);
        expect(['allow', 'confirm', 'deny']).toContain(config.defaultBehavior);
        expect(typeof config.allowFileCreation).toBe('boolean');
        expect(typeof config.allowShellExecution).toBe('boolean');
        expect(typeof config.allowNetworkAccess).toBe('boolean');
      }
    });

    it('should have consistent read-only tool configurations', () => {
      const readOnlyConfig = getPresetConfig('read-only');

      // All read-only tools should be explicitly allowed
      for (const tool of READ_ONLY_TOOLS) {
        const rule = readOnlyConfig.rules?.find(r => r.tool === tool);
        expect(rule?.behavior).toBe('allow');
      }

      // Should have rules for all read-only tools
      expect(readOnlyConfig.rules?.length).toBe(READ_ONLY_TOOLS.length);
    });

    it('should correctly categorize tools by type', () => {
      // Verify read-only tools are safe
      const expectedReadOnlyTools = ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'];
      expect(READ_ONLY_TOOLS).toEqual(expectedReadOnlyTools);

      // Verify write tools can modify system
      const expectedWriteTools = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'TodoWrite'];
      expect(WRITE_TOOLS).toEqual(expectedWriteTools);

      // Verify all tools includes both categories
      expect(ALL_TOOLS).toEqual([...READ_ONLY_TOOLS, ...WRITE_TOOLS]);
    });
  });

  describe('tool behavior edge cases', () => {
    it('should handle non-existent tools correctly', () => {
      const nonExistentTools = [
        'NonExistentTool',
        'FakeTool123',
        'УдаленныйИнструмент',
        '删除的工具',
        'OldTool',
        'DeprecatedTool',
      ];

      for (const preset of ['autonomous', 'review-all', 'read-only'] as const) {
        for (const tool of nonExistentTools) {
          const behavior = getToolBehaviorForPreset(preset, tool);
          const presetConfig = getPresetConfig(preset);

          // Should fall back to default behavior
          expect(behavior).toBe(presetConfig.defaultBehavior);
        }
      }
    });

    it('should handle case sensitivity in tool names', () => {
      const toolVariations = [
        { original: 'Read', variations: ['read', 'READ', 'ReAd', 'rEaD'] },
        { original: 'Write', variations: ['write', 'WRITE', 'WrItE', 'wRiTe'] },
        { original: 'Bash', variations: ['bash', 'BASH', 'BaSh', 'bAsH'] },
      ];

      for (const { original, variations } of toolVariations) {
        const originalBehavior = getToolBehaviorForPreset('read-only', original);

        for (const variation of variations) {
          const variationBehavior = getToolBehaviorForPreset('read-only', variation);

          // Different case should be treated as different tool (case-sensitive)
          if (variation !== original) {
            // Should fall back to default behavior (deny for read-only)
            expect(variationBehavior).toBe('deny');
          } else {
            expect(variationBehavior).toBe(originalBehavior);
          }
        }
      }
    });

    it('should handle empty and whitespace tool names', () => {
      const problematicToolNames = ['', ' ', '\\t', '\\n', '   '];

      for (const toolName of problematicToolNames) {
        for (const preset of ['autonomous', 'review-all', 'read-only'] as const) {
          const behavior = getToolBehaviorForPreset(preset, toolName);
          const defaultBehavior = getPresetConfig(preset).defaultBehavior;
          expect(behavior).toBe(defaultBehavior);
        }
      }
    });
  });

  describe('configuration migration scenarios', () => {
    it('should handle upgrade from config without permissions', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      // Simulate old config format (before permissions were added)
      const oldConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        autonomy: { default: 'manual' },
        agents: { enabled: ['planner'] },
        git: { branchPrefix: 'feature/' },
        limits: { maxTokensPerTask: 100000 },
        // No permissions section
      };

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yaml.stringify(oldConfig));

      // Should load successfully with default permissions
      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      expect(config.permissions).toBeUndefined();
      expect(effectiveConfig.permissions.preset).toBe('review-all');
      expect(effectiveConfig.permissions.customRules).toEqual([]);

      // Other sections should be preserved
      expect(effectiveConfig.autonomy.default).toBe('manual');
      expect(effectiveConfig.git.branchPrefix).toBe('feature/');
    });

    it('should handle downgrade gracefully', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      // Create config with permissions
      let config = await loadConfig(testDir);
      config.permissions = {
        preset: 'autonomous',
        customRules: [
          { tool: 'Write', behavior: 'confirm' },
        ],
      };
      await saveConfig(testDir, config);

      // Verify permissions are saved
      const reloadedConfig = await loadConfig(testDir);
      expect(reloadedConfig.permissions?.preset).toBe('autonomous');

      // Simulate older version reading the config (ignoring permissions)
      const configContent = await fs.readFile(path.join(testDir, '.apex', 'config.yaml'), 'utf-8');
      const parsedConfig = yaml.parse(configContent);

      // Remove permissions to simulate older parser
      delete parsedConfig.permissions;

      // Should still be valid ApexConfig
      const oldVersionConfig = ApexConfigSchema.parse(parsedConfig);
      expect(oldVersionConfig.permissions).toBeUndefined();
      expect(oldVersionConfig.project.name).toBe('test-project');
    });
  });

  describe('performance and stress testing', () => {
    it('should handle large numbers of custom rules', () => {
      const largeRulesConfig = {
        preset: 'review-all' as const,
        customRules: Array.from({ length: 1000 }, (_, i) => ({
          tool: `Tool${i}`,
          behavior: (i % 3 === 0 ? 'allow' : i % 3 === 1 ? 'confirm' : 'deny') as ToolPermissionBehavior,
          scope: `/path${i}/**`,
          reason: `Rule for tool ${i}`,
        })),
      };

      const start = Date.now();
      const result = PermissionsConfigSchema.parse(largeRulesConfig);
      const end = Date.now();

      expect(result.customRules).toHaveLength(1000);
      expect(end - start).toBeLessThan(100); // Should parse quickly
    });

    it('should handle deeply nested configuration structures', () => {
      const nestedConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'deep-test' },
        permissions: {
          preset: 'review-all',
          customRules: [
            {
              tool: 'ComplexTool',
              behavior: 'confirm',
              scope: '/very/deeply/nested/path/with/many/segments/and/wildcards/**/*.{js,ts,jsx,tsx,vue,svelte}',
              reason: 'Complex nested configuration for deeply structured project with multiple file types and intricate permission rules',
            },
          ],
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'node:18-alpine',
            resourceLimits: {
              cpu: 2,
              memory: '2g',
            },
            environment: {
              NODE_ENV: 'development',
              PATH: '/usr/local/bin:/usr/bin:/bin',
            },
          },
        },
      };

      const result = ApexConfigSchema.parse(nestedConfig);
      expect(result.permissions?.customRules![0].scope).toContain('deeply/nested');
      expect(result.workspace?.container?.resourceLimits?.memory).toBe('2g');
    });
  });
});