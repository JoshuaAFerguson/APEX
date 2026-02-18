import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  PermissionPreset,
  Permission,
  PERMISSION_PRESET_CONFIGS,
  ALL_TOOLS,
} from '@apexcli/core';
import { PermissionStore } from '../permission-store';
import { PermissionPresetManager } from '../permission-preset-manager';

describe('PermissionPresetManager Validation Tests', () => {
  let tempDir: string;
  let permissionStore: PermissionStore;
  let presetManager: PermissionPresetManager;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-preset-validation-test-'));
    permissionStore = new PermissionStore(tempDir);
    await permissionStore.initialize();
    presetManager = new PermissionPresetManager(permissionStore);
  });

  afterEach(() => {
    if (permissionStore) {
      permissionStore.close();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Acceptance Criteria Validation', () => {
    it('should satisfy: PermissionPresetManager class in @apex/orchestrator applies preset configurations', async () => {
      // Verify class exists and can be instantiated
      expect(presetManager).toBeInstanceOf(PermissionPresetManager);

      // Verify it can apply preset configurations
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      for (const preset of presets) {
        await presetManager.applyPreset(preset);
        expect(presetManager.getCurrentPreset()).toBe(preset);

        // Verify the preset configuration is actually applied
        const config = presetManager.getPresetConfig();
        expect(config.name).toBe(preset);
      }
    });

    it('should satisfy: Methods - applyPreset(), getCurrentPreset(), getEffectivePermissionLevel()', async () => {
      // Verify applyPreset() method exists and works
      expect(typeof presetManager.applyPreset).toBe('function');
      await presetManager.applyPreset('autonomous');

      // Verify getCurrentPreset() method exists and works
      expect(typeof presetManager.getCurrentPreset).toBe('function');
      expect(presetManager.getCurrentPreset()).toBe('autonomous');

      // Verify getEffectivePermissionLevel() method exists and works
      expect(typeof presetManager.getEffectivePermissionLevel).toBe('function');
      const level = await presetManager.getEffectivePermissionLevel('Read');
      expect(['allow-always', 'allow-once', 'deny']).toContain(level!);
    });

    it('should satisfy: Integrates with PermissionStore', async () => {
      // Verify integration by applying a preset and checking store
      await presetManager.applyPreset('read-only');

      // Check that permissions are actually stored
      const permissions = await permissionStore.listPermissions();
      expect(permissions.length).toBeGreaterThan(0);

      // Verify that stored permissions match preset expectations
      const readPermission = await permissionStore.getPermission({ tool: 'Read' });
      expect(readPermission).toBeTruthy();
      expect(readPermission?.level).toBe('allow-always');

      // Verify that getEffectivePermissionLevel uses the store
      const effectiveLevel = await presetManager.getEffectivePermissionLevel('Read');
      expect(effectiveLevel).toBe('allow-always');
    });
  });

  describe('Implementation Completeness Validation', () => {
    it('should have all required public methods', () => {
      const methods = [
        'applyPreset',
        'getCurrentPreset',
        'getEffectivePermissionLevel',
        'isToolAllowed',
        'isConfirmationRequired',
        'isToolDenied',
        'getPresetConfig',
        'resetToPreset',
      ];

      for (const method of methods) {
        expect(typeof (presetManager as any)[method]).toBe('function');
      }
    });

    it('should support all defined permission presets', async () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      for (const preset of presets) {
        // Should not throw when applying valid presets
        await expect(presetManager.applyPreset(preset)).resolves.not.toThrow();

        // Should return the preset correctly
        expect(presetManager.getCurrentPreset()).toBe(preset);

        // Should have configuration for the preset
        const config = presetManager.getPresetConfig();
        expect(config.name).toBe(preset);
        expect(PERMISSION_PRESET_CONFIGS[preset]).toEqual(config);
      }
    });

    it('should handle all tool types correctly', async () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      for (const preset of presets) {
        await presetManager.applyPreset(preset);

        for (const tool of ALL_TOOLS) {
          // Should not throw for any tool
          await expect(presetManager.getEffectivePermissionLevel(tool)).resolves.not.toThrow();
          await expect(presetManager.isToolAllowed(tool)).resolves.not.toThrow();
          await expect(presetManager.isConfirmationRequired(tool)).resolves.not.toThrow();
          await expect(presetManager.isToolDenied(tool)).resolves.not.toThrow();

          // Results should be consistent
          const level = await presetManager.getEffectivePermissionLevel(tool);
          const isAllowed = await presetManager.isToolAllowed(tool);
          const needsConfirm = await presetManager.isConfirmationRequired(tool);
          const isDenied = await presetManager.isToolDenied(tool);

          // Exactly one should be true
          const trueCount = [isAllowed, needsConfirm, isDenied].filter(Boolean).length;
          expect(trueCount).toBe(1);

          // Should match the level
          expect(isAllowed).toBe(level === 'allow-always');
          expect(needsConfirm).toBe(level === 'allow-once');
          expect(isDenied).toBe(level === 'deny' || level === null);
        }
      }
    });
  });

  describe('Robustness Validation', () => {
    it('should handle errors gracefully', async () => {
      // Invalid preset should throw
      await expect(presetManager.applyPreset('invalid' as any)).rejects.toThrow();

      // Should still be in valid state after error
      expect(presetManager.getCurrentPreset()).toBe('review-all'); // default

      // Should be able to apply valid preset after error
      await expect(presetManager.applyPreset('autonomous')).resolves.not.toThrow();
    });

    it('should maintain consistency across operations', async () => {
      // Apply preset multiple times should be idempotent
      await presetManager.applyPreset('read-only');
      const firstConfig = presetManager.getPresetConfig();
      const firstLevel = await presetManager.getEffectivePermissionLevel('Read');

      await presetManager.applyPreset('read-only');
      const secondConfig = presetManager.getPresetConfig();
      const secondLevel = await presetManager.getEffectivePermissionLevel('Read');

      expect(firstConfig).toEqual(secondConfig);
      expect(firstLevel).toBe(secondLevel);
    });

    it('should handle scope-based permissions correctly', async () => {
      await presetManager.applyPreset('review-all');

      // Add scoped permission
      await permissionStore.savePermission({
        tool: 'Write',
        scope: '/test/**',
        level: 'allow-always',
        createdAt: new Date(),
      });

      // Should find scoped permission
      const scopedLevel = await presetManager.getEffectivePermissionLevel('Write', '/test/**');
      expect(scopedLevel).toBe('allow-always');

      // Should fall back to preset for non-scoped
      const generalLevel = await presetManager.getEffectivePermissionLevel('Write');
      expect(generalLevel).toBe('allow-once'); // review-all default
    });
  });

  describe('Integration Test Summary', () => {
    it('should demonstrate end-to-end workflow', async () => {
      // Start with default
      expect(presetManager.getCurrentPreset()).toBe('review-all');

      // Apply autonomous preset
      await presetManager.applyPreset('autonomous');
      expect(await presetManager.isToolAllowed('Write')).toBe(true);
      expect(await presetManager.isToolAllowed('Bash')).toBe(true);

      // Switch to read-only
      await presetManager.applyPreset('read-only');
      expect(await presetManager.isToolAllowed('Read')).toBe(true);
      expect(await presetManager.isToolDenied('Write')).toBe(true);

      // Add manual override
      await permissionStore.savePermission({
        tool: 'Write',
        scope: '/allowed/**',
        level: 'allow-once',
        createdAt: new Date(),
      });

      // Verify override works
      expect(await presetManager.getEffectivePermissionLevel('Write', '/allowed/file.txt')).toBe('allow-once');
      expect(await presetManager.getEffectivePermissionLevel('Write')).toBe('deny');

      // Reset should clear override
      await presetManager.resetToPreset();
      expect(await presetManager.getEffectivePermissionLevel('Write', '/allowed/file.txt')).toBe('deny');
    });
  });
});