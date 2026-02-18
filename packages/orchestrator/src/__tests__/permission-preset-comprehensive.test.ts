import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionStore } from '../permission-store';
import { PermissionPresetManager } from '../permission-preset-manager';
import {
  PermissionPreset,
  PERMISSION_PRESET_CONFIGS,
  getToolBehaviorForPreset,
  isToolAllowedForPreset,
  isToolConfirmRequiredForPreset,
  isToolDeniedForPreset,
  getPresetConfig,
  isPermissionPreset,
} from '@apexcli/core';

describe('Permission Preset Comprehensive Tests', () => {
  let store: PermissionStore;
  let presetManager: PermissionPresetManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-preset-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    store = new PermissionStore(testDir);
    await store.initialize();

    presetManager = new PermissionPresetManager(store);
  });

  afterEach(() => {
    if (store) {
      store.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Preset Configuration Constants', () => {
    it('should have all required presets defined', () => {
      const expectedPresets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      expectedPresets.forEach(preset => {
        expect(PERMISSION_PRESET_CONFIGS[preset]).toBeDefined();
        expect(PERMISSION_PRESET_CONFIGS[preset].name).toBe(preset);
        expect(PERMISSION_PRESET_CONFIGS[preset].description).toBeTruthy();
      });
    });

    it('should have consistent tool behaviors across presets', () => {
      const tools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'TodoWrite'];

      tools.forEach(tool => {
        // Each preset should have a defined behavior for each tool
        const autonomousBehavior = getToolBehaviorForPreset('autonomous', tool);
        const reviewAllBehavior = getToolBehaviorForPreset('review-all', tool);
        const readOnlyBehavior = getToolBehaviorForPreset('read-only', tool);

        expect(['allow', 'confirm', 'deny']).toContain(autonomousBehavior);
        expect(['allow', 'confirm', 'deny']).toContain(reviewAllBehavior);
        expect(['allow', 'confirm', 'deny']).toContain(readOnlyBehavior);
      });
    });

    describe('Autonomous Preset', () => {
      it('should allow all tools without confirmation', () => {
        const config = PERMISSION_PRESET_CONFIGS.autonomous;
        expect(config.name).toBe('autonomous');
        expect(config.defaultBehavior).toBe('allow');
        expect(config.allowDangerousOperations).toBe(true);
        expect(config.allowNetworkAccess).toBe(true);

        const tools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch'];
        tools.forEach(tool => {
          expect(isToolAllowedForPreset('autonomous', tool)).toBe(true);
          expect(isToolConfirmRequiredForPreset('autonomous', tool)).toBe(false);
          expect(isToolDeniedForPreset('autonomous', tool)).toBe(false);
        });
      });
    });

    describe('Review-All Preset', () => {
      it('should require confirmation for all tools', () => {
        const config = PERMISSION_PRESET_CONFIGS['review-all'];
        expect(config.name).toBe('review-all');
        expect(config.defaultBehavior).toBe('confirm');
        expect(config.allowDangerousOperations).toBe(false);
        expect(config.allowNetworkAccess).toBe(true);

        const tools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch'];
        tools.forEach(tool => {
          expect(isToolAllowedForPreset('review-all', tool)).toBe(false);
          expect(isToolConfirmRequiredForPreset('review-all', tool)).toBe(true);
          expect(isToolDeniedForPreset('review-all', tool)).toBe(false);
        });
      });
    });

    describe('Read-Only Preset', () => {
      it('should allow only read-only tools and deny write operations', () => {
        const config = PERMISSION_PRESET_CONFIGS['read-only'];
        expect(config.name).toBe('read-only');
        expect(config.defaultBehavior).toBe('deny');
        expect(config.allowDangerousOperations).toBe(false);
        expect(config.allowNetworkAccess).toBe(true);

        // Read-only tools should be allowed
        const readOnlyTools = ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'];
        readOnlyTools.forEach(tool => {
          expect(isToolAllowedForPreset('read-only', tool)).toBe(true);
          expect(isToolConfirmRequiredForPreset('read-only', tool)).toBe(false);
          expect(isToolDeniedForPreset('read-only', tool)).toBe(false);
        });

        // Write tools should be denied
        const writeTools = ['Write', 'Edit', 'Bash', 'TodoWrite'];
        writeTools.forEach(tool => {
          expect(isToolAllowedForPreset('read-only', tool)).toBe(false);
          expect(isToolConfirmRequiredForPreset('read-only', tool)).toBe(false);
          expect(isToolDeniedForPreset('read-only', tool)).toBe(true);
        });
      });
    });
  });

  describe('Preset Manager Implementation', () => {
    it('should initialize with default preset', () => {
      expect(presetManager.getCurrentPreset()).toBe('review-all');
    });

    it('should apply presets correctly', async () => {
      // Apply autonomous preset
      await presetManager.applyPreset('autonomous');
      expect(presetManager.getCurrentPreset()).toBe('autonomous');
      expect(await presetManager.isToolAllowed('Write')).toBe(true);

      // Apply read-only preset
      await presetManager.applyPreset('read-only');
      expect(presetManager.getCurrentPreset()).toBe('read-only');
      expect(await presetManager.isToolAllowed('Read')).toBe(true);
      expect(await presetManager.isToolDenied('Write')).toBe(true);

      // Apply review-all preset
      await presetManager.applyPreset('review-all');
      expect(presetManager.getCurrentPreset()).toBe('review-all');
      expect(await presetManager.isToolConfirmRequired('Read')).toBe(true);
    });

    it('should handle preset transitions correctly', async () => {
      // Start with review-all (default)
      expect(await presetManager.isToolConfirmRequired('Read')).toBe(true);
      expect(await presetManager.isToolConfirmRequired('Write')).toBe(true);

      // Change to autonomous
      await presetManager.applyPreset('autonomous');
      expect(await presetManager.isToolAllowed('Read')).toBe(true);
      expect(await presetManager.isToolAllowed('Write')).toBe(true);
      expect(await presetManager.isToolAllowed('Bash')).toBe(true);

      // Change to read-only
      await presetManager.applyPreset('read-only');
      expect(await presetManager.isToolAllowed('Read')).toBe(true);
      expect(await presetManager.isToolDenied('Write')).toBe(true);
      expect(await presetManager.isToolDenied('Bash')).toBe(true);
    });

    it('should get effective permission levels correctly', async () => {
      // Test autonomous preset
      await presetManager.applyPreset('autonomous');
      expect(await presetManager.getEffectivePermissionLevel('Read')).toBe('allow-always');
      expect(await presetManager.getEffectivePermissionLevel('Write')).toBe('allow-always');

      // Test review-all preset
      await presetManager.applyPreset('review-all');
      expect(await presetManager.getEffectivePermissionLevel('Read')).toBeNull(); // requires confirmation
      expect(await presetManager.getEffectivePermissionLevel('Write')).toBeNull();

      // Test read-only preset
      await presetManager.applyPreset('read-only');
      expect(await presetManager.getEffectivePermissionLevel('Read')).toBe('allow-always');
      expect(await presetManager.getEffectivePermissionLevel('Write')).toBe('deny');
    });
  });

  describe('Preset Validation and Utility Functions', () => {
    it('should validate preset names correctly', () => {
      // Valid presets
      expect(isPermissionPreset('autonomous')).toBe(true);
      expect(isPermissionPreset('review-all')).toBe(true);
      expect(isPermissionPreset('read-only')).toBe(true);

      // Invalid presets
      expect(isPermissionPreset('invalid')).toBe(false);
      expect(isPermissionPreset('full-access')).toBe(false);
      expect(isPermissionPreset('')).toBe(false);
      expect(isPermissionPreset(null)).toBe(false);
      expect(isPermissionPreset(undefined)).toBe(false);
    });

    it('should get preset configurations correctly', () => {
      const autonomousConfig = getPresetConfig('autonomous');
      expect(autonomousConfig.name).toBe('autonomous');
      expect(autonomousConfig.allowDangerousOperations).toBe(true);

      const reviewAllConfig = getPresetConfig('review-all');
      expect(reviewAllConfig.name).toBe('review-all');
      expect(reviewAllConfig.defaultBehavior).toBe('confirm');

      const readOnlyConfig = getPresetConfig('read-only');
      expect(readOnlyConfig.name).toBe('read-only');
      expect(readOnlyConfig.defaultBehavior).toBe('deny');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle unknown tools gracefully', async () => {
      await presetManager.applyPreset('autonomous');

      // Unknown tools should fall back to default behavior
      const unknownTool = 'NonExistentTool';
      expect(await presetManager.isToolAllowed(unknownTool)).toBe(true); // autonomous default

      await presetManager.applyPreset('read-only');
      expect(await presetManager.isToolDenied(unknownTool)).toBe(true); // read-only default
    });

    it('should handle tool name case sensitivity', async () => {
      await presetManager.applyPreset('autonomous');

      // Tools should be case-sensitive
      expect(await presetManager.isToolAllowed('read')).toBe(true); // falls back to default
      expect(await presetManager.isToolAllowed('READ')).toBe(true); // falls back to default
      expect(await presetManager.isToolAllowed('Read')).toBe(true); // exact match
    });

    it('should handle concurrent preset changes', async () => {
      // Apply multiple presets concurrently
      const presetManager2 = new PermissionPresetManager(store, 'autonomous');

      await Promise.all([
        presetManager.applyPreset('read-only'),
        presetManager2.applyPreset('autonomous'),
      ]);

      // Both managers should have their respective presets
      expect(presetManager.getCurrentPreset()).toBe('read-only');
      expect(presetManager2.getCurrentPreset()).toBe('autonomous');
    });

    it('should persist preset across manager instances', async () => {
      // Apply preset with first manager
      await presetManager.applyPreset('autonomous');
      expect(presetManager.getCurrentPreset()).toBe('autonomous');

      // Create new manager instance
      const presetManager2 = new PermissionPresetManager(store);
      // Note: Current implementation doesn't persist preset state
      // This would require database storage for preset state
      expect(presetManager2.getCurrentPreset()).toBe('review-all'); // default
    });
  });

  describe('Integration with Permission Store', () => {
    it('should integrate preset behavior with stored permissions', async () => {
      // Apply read-only preset
      await presetManager.applyPreset('read-only');

      // Read tools should be allowed by preset
      expect(await presetManager.isToolAllowed('Read')).toBe(true);

      // Override with explicit permission
      await store.savePermission({
        tool: 'Read',
        level: 'deny',
        createdAt: new Date(),
      });

      // Explicit permission should override preset (if implemented)
      // Note: This depends on the priority logic in the implementation
      const permission = await store.getPermission({ tool: 'Read' });
      expect(permission?.level).toBe('deny');
    });

    it('should handle mixed preset and explicit permissions', async () => {
      await presetManager.applyPreset('review-all');

      // Set explicit allow-always for specific tool
      await store.savePermission({
        tool: 'Read',
        scope: '/tmp/*',
        level: 'allow-always',
        createdAt: new Date(),
      });

      // Should be able to query both preset and explicit permissions
      expect(await presetManager.isToolConfirmRequired('Write')).toBe(true); // from preset

      const explicitPermission = await store.getPermission({ tool: 'Read', scope: '/tmp/test.txt' });
      expect(explicitPermission?.level).toBe('allow-always');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle many tool queries efficiently', async () => {
      await presetManager.applyPreset('autonomous');

      const start = Date.now();
      const tools = Array.from({ length: 1000 }, (_, i) => `Tool${i}`);

      // Query many tools
      const results = await Promise.all(
        tools.map(tool => presetManager.isToolAllowed(tool))
      );

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
      expect(results.every(result => result === true)).toBe(true);
    });

    it('should handle rapid preset changes', async () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      // Apply presets rapidly
      for (let i = 0; i < 100; i++) {
        const preset = presets[i % presets.length];
        await presetManager.applyPreset(preset);
        expect(presetManager.getCurrentPreset()).toBe(preset);
      }
    });
  });
});