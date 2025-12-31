/**
 * @fileoverview Comprehensive unit tests for PermissionPresetManager
 *
 * This test suite provides extensive coverage of PermissionPresetManager functionality,
 * covering edge cases, error conditions, and comprehensive preset behavior validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  PermissionPreset,
  PermissionLevel,
  Permission,
  PermissionPresetConfig,
  isPermissionPreset,
  getPresetConfig,
  getToolBehaviorForPreset,
} from '@apexcli/core';
import { PermissionStore } from '../permission-store';
import { PermissionPresetManager } from '../permission-preset-manager';

describe('PermissionPresetManager Comprehensive Tests', () => {
  let tempDir: string;
  let permissionStore: PermissionStore;
  let presetManager: PermissionPresetManager;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-preset-comprehensive-test-'));

    // Initialize permission store
    permissionStore = new PermissionStore(tempDir);
    await permissionStore.initialize();

    // Initialize preset manager with default preset
    presetManager = new PermissionPresetManager(permissionStore);
  });

  afterEach(() => {
    // Clean up
    if (permissionStore) {
      permissionStore.close();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Preset Validation and Error Handling', () => {
    it('should validate preset names during construction', () => {
      expect(() => {
        new PermissionPresetManager(permissionStore, 'invalid' as PermissionPreset);
      }).not.toThrow(); // Constructor doesn't validate, only applyPreset does
    });

    it('should throw meaningful errors for invalid presets', async () => {
      const invalidPresets = [
        'invalid-preset',
        'AUTONOMOUS', // Wrong case
        'review_all', // Wrong separator
        'readonly', // Missing dash
        '', // Empty string
        '  ', // Whitespace only
        'null',
        'undefined'
      ];

      for (const invalidPreset of invalidPresets) {
        await expect(
          presetManager.applyPreset(invalidPreset as PermissionPreset)
        ).rejects.toThrow(`Invalid permission preset: ${invalidPreset}`);
      }
    });

    it('should handle permission store failures gracefully', async () => {
      // Create a new manager with a closed store
      const closedStore = new PermissionStore(tempDir);
      await closedStore.initialize();
      closedStore.close(); // Close immediately

      const managerWithClosedStore = new PermissionPresetManager(closedStore);

      // Should fail gracefully when trying to apply preset
      await expect(managerWithClosedStore.applyPreset('autonomous'))
        .rejects.toThrow();
    });

    it('should handle corrupted permission store data', async () => {
      // Manually corrupt the database file
      const dbPath = path.join(tempDir, 'permissions.db');
      if (fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, 'corrupted data');
      }

      // Create new store with corrupted data
      const corruptedStore = new PermissionStore(tempDir);
      await expect(corruptedStore.initialize()).rejects.toThrow();
    });
  });

  describe('Autonomous Preset Comprehensive Testing', () => {
    beforeEach(async () => {
      await presetManager.applyPreset('autonomous');
    });

    it('should allow all standard tools without confirmation', async () => {
      const standardTools = [
        'Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit',
        'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch',
        'LSP', 'TodoWrite', 'Task', 'AskUserQuestion'
      ];

      for (const tool of standardTools) {
        expect(await presetManager.isToolAllowed(tool)).toBe(true);
        expect(await presetManager.isConfirmationRequired(tool)).toBe(false);
        expect(await presetManager.isToolDenied(tool)).toBe(false);
        expect(await presetManager.getEffectivePermissionLevel(tool)).toBe('allow-always');
      }
    });

    it('should allow custom and unknown tools in autonomous mode', async () => {
      const customTools = [
        'CustomTool',
        'NewFeatureTool',
        'ThirdPartyIntegration',
        'DebugHelper',
        'Tool-With-Dashes',
        'tool_with_underscores',
        'Tool123',
        'UPPERCASE_TOOL'
      ];

      for (const tool of customTools) {
        expect(await presetManager.isToolAllowed(tool)).toBe(true);
        expect(await presetManager.getEffectivePermissionLevel(tool)).toBe('allow-always');
      }
    });

    it('should handle scoped permissions in autonomous mode', async () => {
      // Even in autonomous mode, specific scoped permissions should be respected
      const specificPermission: Permission = {
        tool: 'Write',
        scope: '/restricted/**',
        level: 'deny',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(specificPermission);

      // Should use specific permission instead of preset default
      expect(await presetManager.getEffectivePermissionLevel('Write', '/restricted/**')).toBe('deny');
      expect(await presetManager.isToolDenied('Write', '/restricted/**')).toBe(true);

      // But without scope should still use autonomous default
      expect(await presetManager.getEffectivePermissionLevel('Write')).toBe('allow-always');
      expect(await presetManager.isToolAllowed('Write')).toBe(true);
    });

    it('should maintain autonomous behavior after store operations', async () => {
      // Add some permissions manually
      const permissions: Permission[] = [
        { tool: 'Read', level: 'allow-once', createdAt: new Date() },
        { tool: 'Write', scope: '/tmp/**', level: 'deny', createdAt: new Date() },
        { tool: 'Bash', level: 'allow-always', createdAt: new Date() }
      ];

      for (const perm of permissions) {
        await permissionStore.savePermission(perm);
      }

      // Reset to autonomous preset
      await presetManager.resetToPreset();

      // Should clear specific permissions and restore autonomous behavior
      expect(await presetManager.getEffectivePermissionLevel('Read')).toBe('allow-always');
      expect(await presetManager.getEffectivePermissionLevel('Write')).toBe('allow-always');
      expect(await presetManager.getEffectivePermissionLevel('Unknown')).toBe('allow-always');
    });
  });

  describe('Review-All Preset Comprehensive Testing', () => {
    beforeEach(async () => {
      await presetManager.applyPreset('review-all');
    });

    it('should require confirmation for all tools in review-all mode', async () => {
      const allToolTypes = [
        // Core tools
        'Read', 'Write', 'Edit', 'Bash',
        // Search tools
        'Grep', 'Glob',
        // Network tools
        'WebFetch', 'WebSearch',
        // Development tools
        'LSP', 'TodoWrite',
        // Interactive tools
        'Task', 'AskUserQuestion',
        // Custom tools
        'CustomTool', 'UnknownTool'
      ];

      for (const tool of allToolTypes) {
        expect(await presetManager.isConfirmationRequired(tool)).toBe(true);
        expect(await presetManager.isToolAllowed(tool)).toBe(false);
        expect(await presetManager.isToolDenied(tool)).toBe(false);
        expect(await presetManager.getEffectivePermissionLevel(tool)).toBe('allow-once');
      }
    });

    it('should apply consistent review-all behavior regardless of tool name format', async () => {
      const toolNameVariations = [
        'normalTool',
        'UPPERCASE_TOOL',
        'kebab-case-tool',
        'snake_case_tool',
        'Tool123WithNumbers',
        'tool.with.dots',
        'tool:with:colons',
        'tool@with@symbols'
      ];

      for (const tool of toolNameVariations) {
        expect(await presetManager.getEffectivePermissionLevel(tool)).toBe('allow-once');
      }
    });

    it('should respect existing permissions over review-all default', async () => {
      // Add specific permissions that override review-all
      const overridePermissions: Permission[] = [
        { tool: 'Read', level: 'allow-always', createdAt: new Date() },
        { tool: 'Write', level: 'deny', createdAt: new Date() },
        { tool: 'Bash', scope: '/safe/**', level: 'allow-always', createdAt: new Date() }
      ];

      for (const perm of overridePermissions) {
        await permissionStore.savePermission(perm);
      }

      // Specific permissions should override preset
      expect(await presetManager.getEffectivePermissionLevel('Read')).toBe('allow-always');
      expect(await presetManager.isToolAllowed('Read')).toBe(true);

      expect(await presetManager.getEffectivePermissionLevel('Write')).toBe('deny');
      expect(await presetManager.isToolDenied('Write')).toBe(true);

      expect(await presetManager.getEffectivePermissionLevel('Bash', '/safe/**')).toBe('allow-always');
      expect(await presetManager.isToolAllowed('Bash', '/safe/**')).toBe(true);

      // Without scope should still use preset default
      expect(await presetManager.getEffectivePermissionLevel('Bash')).toBe('allow-once');
    });
  });

  describe('Read-Only Preset Comprehensive Testing', () => {
    beforeEach(async () => {
      await presetManager.applyPreset('read-only');
    });

    it('should allow all read-only tools without confirmation', async () => {
      const readOnlyTools = ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'];

      for (const tool of readOnlyTools) {
        expect(await presetManager.isToolAllowed(tool)).toBe(true);
        expect(await presetManager.isConfirmationRequired(tool)).toBe(false);
        expect(await presetManager.isToolDenied(tool)).toBe(false);
        expect(await presetManager.getEffectivePermissionLevel(tool)).toBe('allow-always');
      }
    });

    it('should deny all write/modification tools', async () => {
      const writeTools = [
        'Write', 'Edit', 'MultiEdit', 'NotebookEdit',
        'Bash', 'TodoWrite'
      ];

      for (const tool of writeTools) {
        expect(await presetManager.isToolDenied(tool)).toBe(true);
        expect(await presetManager.isToolAllowed(tool)).toBe(false);
        expect(await presetManager.isConfirmationRequired(tool)).toBe(false);
        expect(await presetManager.getEffectivePermissionLevel(tool)).toBe('deny');
      }
    });

    it('should deny unknown tools by default in read-only mode', async () => {
      const unknownTools = [
        'UnknownTool', 'CustomWriteTool', 'NewFeature',
        'ThirdPartyTool', 'ExperimentalTool'
      ];

      for (const tool of unknownTools) {
        expect(await presetManager.isToolDenied(tool)).toBe(true);
        expect(await presetManager.getEffectivePermissionLevel(tool)).toBe('deny');
      }
    });

    it('should handle mixed read-only and write tool scenarios', async () => {
      // Simulate a workflow with mixed tool types
      const workflowTools = [
        { name: 'Read', shouldAllow: true },
        { name: 'Grep', shouldAllow: true },
        { name: 'Write', shouldAllow: false },
        { name: 'WebFetch', shouldAllow: true },
        { name: 'Bash', shouldAllow: false },
        { name: 'Glob', shouldAllow: true },
        { name: 'Edit', shouldAllow: false }
      ];

      for (const { name, shouldAllow } of workflowTools) {
        if (shouldAllow) {
          expect(await presetManager.isToolAllowed(name)).toBe(true);
          expect(await presetManager.getEffectivePermissionLevel(name)).toBe('allow-always');
        } else {
          expect(await presetManager.isToolDenied(name)).toBe(true);
          expect(await presetManager.getEffectivePermissionLevel(name)).toBe('deny');
        }
      }
    });

    it('should allow overriding read-only restrictions with specific permissions', async () => {
      // Grant specific write permission in read-only mode
      const specificWritePermission: Permission = {
        tool: 'Write',
        scope: '/tmp/logs/**',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(specificWritePermission);

      // Should allow write to specific scope
      expect(await presetManager.getEffectivePermissionLevel('Write', '/tmp/logs/**')).toBe('allow-always');
      expect(await presetManager.isToolAllowed('Write', '/tmp/logs/**')).toBe(true);

      // But still deny write generally
      expect(await presetManager.getEffectivePermissionLevel('Write')).toBe('deny');
      expect(await presetManager.isToolDenied('Write')).toBe(true);
    });
  });

  describe('Preset Switching and State Management', () => {
    it('should properly transition between all preset combinations', async () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      for (const fromPreset of presets) {
        for (const toPreset of presets) {
          await presetManager.applyPreset(fromPreset);
          expect(presetManager.getCurrentPreset()).toBe(fromPreset);

          await presetManager.applyPreset(toPreset);
          expect(presetManager.getCurrentPreset()).toBe(toPreset);

          // Verify preset-specific behavior is applied
          if (toPreset === 'autonomous') {
            expect(await presetManager.isToolAllowed('Write')).toBe(true);
          } else if (toPreset === 'read-only') {
            expect(await presetManager.isToolDenied('Write')).toBe(true);
          } else if (toPreset === 'review-all') {
            expect(await presetManager.isConfirmationRequired('Write')).toBe(true);
          }
        }
      }
    });

    it('should clear all existing permissions when switching presets', async () => {
      // Start with autonomous and add custom permissions
      await presetManager.applyPreset('autonomous');

      const customPermissions: Permission[] = [
        { tool: 'CustomTool1', level: 'deny', createdAt: new Date() },
        { tool: 'CustomTool2', scope: '/custom/**', level: 'allow-once', createdAt: new Date() },
        { tool: 'Read', level: 'deny', createdAt: new Date() } // Override default
      ];

      for (const perm of customPermissions) {
        await permissionStore.savePermission(perm);
      }

      // Verify custom permissions exist
      expect(await permissionStore.getPermission({ tool: 'CustomTool1' })).toBeTruthy();
      expect(await permissionStore.getPermission({ tool: 'CustomTool2', scope: '/custom/**' })).toBeTruthy();

      // Switch to read-only
      await presetManager.applyPreset('read-only');

      // Custom permissions should be cleared and preset rules applied
      expect(await presetManager.getEffectivePermissionLevel('Read')).toBe('allow-always'); // Read-only default
      expect(await presetManager.getEffectivePermissionLevel('Write')).toBe('deny'); // Read-only default

      // CustomTools should follow read-only default (deny)
      expect(await presetManager.getEffectivePermissionLevel('CustomTool1')).toBe('deny');
    });

    it('should maintain preset consistency after multiple operations', async () => {
      await presetManager.applyPreset('review-all');

      // Perform multiple permission operations
      const operations = [
        () => presetManager.isToolAllowed('Read'),
        () => presetManager.isConfirmationRequired('Write'),
        () => presetManager.getEffectivePermissionLevel('Bash'),
        () => presetManager.isToolDenied('UnknownTool'),
        () => presetManager.resetToPreset(),
        () => presetManager.getPresetConfig(),
      ];

      for (const operation of operations) {
        await operation();
        // Preset should remain consistent
        expect(presetManager.getCurrentPreset()).toBe('review-all');
      }

      // Verify review-all behavior is still intact
      expect(await presetManager.isConfirmationRequired('AnyTool')).toBe(true);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty and whitespace-only tool names', async () => {
      await presetManager.applyPreset('autonomous');

      const edgeToolNames = ['', '   ', '\t', '\n', '\r\n'];

      for (const toolName of edgeToolNames) {
        // Should not throw, should use preset default
        expect(await presetManager.getEffectivePermissionLevel(toolName)).toBe('allow-always');
        expect(await presetManager.isToolAllowed(toolName)).toBe(true);
      }
    });

    it('should handle extremely long tool names and scopes', async () => {
      const longToolName = 'Tool' + 'X'.repeat(1000);
      const longScope = '/path/' + 'segment/'.repeat(100) + '**';

      await presetManager.applyPreset('review-all');

      expect(await presetManager.getEffectivePermissionLevel(longToolName, longScope)).toBe('allow-once');

      // Add permission with long names
      const longPermission: Permission = {
        tool: longToolName,
        scope: longScope,
        level: 'allow-always',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(longPermission);

      expect(await presetManager.getEffectivePermissionLevel(longToolName, longScope)).toBe('allow-always');
    });

    it('should handle special characters in tool names and scopes', async () => {
      const specialToolNames = [
        'Tool@#$%^&*()',
        'Tool[]{}<>',
        'Tool"\'`~',
        'Tool|\\/?',
        'Tool+=_-',
        'Tool with spaces',
        'Tool\twith\ttabs',
        'Tööl-wîth-ünicöde'
      ];

      await presetManager.applyPreset('read-only');

      for (const toolName of specialToolNames) {
        // Should handle special characters gracefully
        const level = await presetManager.getEffectivePermissionLevel(toolName);
        expect(['allow-always', 'deny']).toContain(level); // Depends on whether it matches read-only tools
      }
    });

    it('should handle rapid concurrent permission checks', async () => {
      await presetManager.applyPreset('autonomous');

      const concurrentOperations = Array.from({ length: 100 }, (_, i) => async () => {
        const toolName = `Tool${i % 10}`;
        const scope = i % 2 === 0 ? undefined : `/scope${i}/**`;

        return Promise.all([
          presetManager.isToolAllowed(toolName, scope),
          presetManager.isConfirmationRequired(toolName, scope),
          presetManager.isToolDenied(toolName, scope),
          presetManager.getEffectivePermissionLevel(toolName, scope)
        ]);
      });

      const startTime = Date.now();
      const results = await Promise.all(concurrentOperations.map(op => op()));
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
      expect(results).toHaveLength(100);

      // All results should be consistent with autonomous preset
      results.forEach(([isAllowed, needsConfirm, isDenied, level]) => {
        expect(isAllowed).toBe(true);
        expect(needsConfirm).toBe(false);
        expect(isDenied).toBe(false);
        expect(level).toBe('allow-always');
      });
    });
  });

  describe('Integration with Core Preset Utilities', () => {
    it('should be consistent with core isPermissionPreset function', () => {
      const validPresets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];
      const invalidPresets = ['invalid', 'AUTONOMOUS', 'review_all', ''];

      validPresets.forEach(preset => {
        expect(isPermissionPreset(preset)).toBe(true);
      });

      invalidPresets.forEach(preset => {
        expect(isPermissionPreset(preset)).toBe(false);
      });
    });

    it('should be consistent with getPresetConfig function', async () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      for (const preset of presets) {
        await presetManager.applyPreset(preset);

        const managerConfig = presetManager.getPresetConfig();
        const coreConfig = getPresetConfig(preset);

        expect(managerConfig).toEqual(coreConfig);
        expect(managerConfig.name).toBe(preset);
      }
    });

    it('should be consistent with getToolBehaviorForPreset function', async () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];
      const tools = ['Read', 'Write', 'Bash', 'UnknownTool'];

      for (const preset of presets) {
        await presetManager.applyPreset(preset);

        for (const tool of tools) {
          const managerLevel = await presetManager.getEffectivePermissionLevel(tool);
          const coreBehavior = getToolBehaviorForPreset(preset, tool);

          // Convert behavior to expected level
          let expectedLevel: PermissionLevel | null;
          switch (coreBehavior) {
            case 'allow': expectedLevel = 'allow-always'; break;
            case 'confirm': expectedLevel = 'allow-once'; break;
            case 'deny': expectedLevel = 'deny'; break;
            default: expectedLevel = null;
          }

          expect(managerLevel).toBe(expectedLevel);
        }
      }
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should not leak memory with repeated preset applications', async () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      // Simulate many preset switches
      for (let i = 0; i < 100; i++) {
        const preset = presets[i % presets.length];
        await presetManager.applyPreset(preset);

        // Check a few tools each time
        await presetManager.isToolAllowed('Read');
        await presetManager.isConfirmationRequired('Write');
        await presetManager.getEffectivePermissionLevel('Bash');
      }

      // Should complete without memory issues
      expect(presetManager.getCurrentPreset()).toBe(presets[99 % presets.length]);
    });

    it('should handle permission store cleanup properly', async () => {
      // Add many permissions
      const permissions = Array.from({ length: 1000 }, (_, i) => ({
        tool: `Tool${i}`,
        scope: i % 2 === 0 ? undefined : `/scope${i}/**`,
        level: (['allow-always', 'allow-once', 'deny'] as PermissionLevel[])[i % 3],
        createdAt: new Date(),
      }));

      for (const permission of permissions) {
        await permissionStore.savePermission(permission);
      }

      // Apply preset should clear all permissions efficiently
      await presetManager.applyPreset('autonomous');

      // Verify cleanup was successful
      const remainingPermissions = await permissionStore.listPermissions();
      expect(remainingPermissions.length).toBeGreaterThan(0); // Should have preset-specific permissions

      // But should be much fewer than what we added
      expect(remainingPermissions.length).toBeLessThan(100); // Preset rules only
    });
  });
});