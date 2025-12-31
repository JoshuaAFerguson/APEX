import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  PermissionPreset,
  PermissionLevel,
  Permission,
} from '@apexcli/core';
import { PermissionStore } from '../permission-store';
import { PermissionPresetManager } from '../permission-preset-manager';

describe('PermissionPresetManager', () => {
  let tempDir: string;
  let permissionStore: PermissionStore;
  let presetManager: PermissionPresetManager;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-preset-manager-test-'));

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

  describe('Constructor and Initialization', () => {
    it('should initialize with default review-all preset', () => {
      expect(presetManager.getCurrentPreset()).toBe('review-all');
    });

    it('should initialize with specified preset', () => {
      const manager = new PermissionPresetManager(permissionStore, 'autonomous');
      expect(manager.getCurrentPreset()).toBe('autonomous');
    });
  });

  describe('applyPreset', () => {
    it('should apply autonomous preset successfully', async () => {
      await presetManager.applyPreset('autonomous');
      expect(presetManager.getCurrentPreset()).toBe('autonomous');
    });

    it('should apply review-all preset successfully', async () => {
      await presetManager.applyPreset('review-all');
      expect(presetManager.getCurrentPreset()).toBe('review-all');
    });

    it('should apply read-only preset successfully', async () => {
      await presetManager.applyPreset('read-only');
      expect(presetManager.getCurrentPreset()).toBe('read-only');
    });

    it('should throw error for invalid preset', async () => {
      await expect(
        presetManager.applyPreset('invalid-preset' as PermissionPreset)
      ).rejects.toThrow('Invalid permission preset: invalid-preset');
    });

    it('should clear existing permissions before applying new preset', async () => {
      // Add some existing permissions
      const permission: Permission = {
        tool: 'Read',
        level: 'deny',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // Verify permission exists
      let stored = await permissionStore.getPermission({ tool: 'Read' });
      expect(stored).toBeTruthy();
      expect(stored?.level).toBe('deny');

      // Apply read-only preset (which allows Read)
      await presetManager.applyPreset('read-only');

      // Verify the deny permission was cleared and preset rules applied
      stored = await permissionStore.getPermission({ tool: 'Read' });
      expect(stored).toBeTruthy();
      expect(stored?.level).toBe('allow-always');
    });

    it('should apply preset-specific rules to permission store', async () => {
      // Apply read-only preset
      await presetManager.applyPreset('read-only');

      // Verify read-only tools have allow-always permissions
      const readPermission = await permissionStore.getPermission({ tool: 'Read' });
      expect(readPermission).toBeTruthy();
      expect(readPermission?.level).toBe('allow-always');

      const grepPermission = await permissionStore.getPermission({ tool: 'Grep' });
      expect(grepPermission).toBeTruthy();
      expect(grepPermission?.level).toBe('allow-always');

      // Verify write tools are not explicitly stored (will use default deny)
      const writePermission = await permissionStore.getPermission({ tool: 'Write' });
      expect(writePermission).toBeNull();
    });
  });

  describe('getCurrentPreset', () => {
    it('should return current preset', async () => {
      expect(presetManager.getCurrentPreset()).toBe('review-all');

      await presetManager.applyPreset('autonomous');
      expect(presetManager.getCurrentPreset()).toBe('autonomous');

      await presetManager.applyPreset('read-only');
      expect(presetManager.getCurrentPreset()).toBe('read-only');
    });
  });

  describe('getEffectivePermissionLevel', () => {
    it('should return stored permission if exists', async () => {
      // Store a specific permission
      const permission: Permission = {
        tool: 'Read',
        level: 'deny',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // Should return stored permission regardless of preset
      await presetManager.applyPreset('autonomous');
      const level = await presetManager.getEffectivePermissionLevel('Read');
      expect(level).toBe('deny');
    });

    it('should fall back to preset behavior when no stored permission exists', async () => {
      await presetManager.applyPreset('autonomous');

      // No stored permission for Write, should use preset default (allow)
      const level = await presetManager.getEffectivePermissionLevel('Write');
      expect(level).toBe('allow-always');
    });

    it('should handle scope-specific permissions', async () => {
      const permission: Permission = {
        tool: 'Write',
        scope: '/src/**',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // Should find scoped permission
      const scopedLevel = await presetManager.getEffectivePermissionLevel('Write', '/src/**');
      expect(scopedLevel).toBe('allow-always');

      // Should not find permission without scope
      await presetManager.applyPreset('read-only');
      const unscopedLevel = await presetManager.getEffectivePermissionLevel('Write');
      expect(unscopedLevel).toBe('deny');
    });

    describe('with autonomous preset', () => {
      beforeEach(async () => {
        await presetManager.applyPreset('autonomous');
      });

      it('should return allow-always for all tools', async () => {
        const tools = ['Read', 'Write', 'Bash', 'Grep', 'UnknownTool'];
        for (const tool of tools) {
          const level = await presetManager.getEffectivePermissionLevel(tool);
          expect(level).toBe('allow-always');
        }
      });
    });

    describe('with review-all preset', () => {
      beforeEach(async () => {
        await presetManager.applyPreset('review-all');
      });

      it('should return allow-once for all tools (requiring confirmation)', async () => {
        const tools = ['Read', 'Write', 'Bash', 'Grep', 'UnknownTool'];
        for (const tool of tools) {
          const level = await presetManager.getEffectivePermissionLevel(tool);
          expect(level).toBe('allow-once');
        }
      });
    });

    describe('with read-only preset', () => {
      beforeEach(async () => {
        await presetManager.applyPreset('read-only');
      });

      it('should return allow-always for read-only tools', async () => {
        const readOnlyTools = ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'];
        for (const tool of readOnlyTools) {
          const level = await presetManager.getEffectivePermissionLevel(tool);
          expect(level).toBe('allow-always');
        }
      });

      it('should return deny for write tools', async () => {
        const writeTools = ['Write', 'Edit', 'Bash', 'TodoWrite'];
        for (const tool of writeTools) {
          const level = await presetManager.getEffectivePermissionLevel(tool);
          expect(level).toBe('deny');
        }
      });

      it('should return deny for unknown tools', async () => {
        const level = await presetManager.getEffectivePermissionLevel('UnknownTool');
        expect(level).toBe('deny');
      });
    });
  });

  describe('Convenience Methods', () => {
    describe('isToolAllowed', () => {
      it('should return true for allowed tools in autonomous preset', async () => {
        await presetManager.applyPreset('autonomous');
        expect(await presetManager.isToolAllowed('Read')).toBe(true);
        expect(await presetManager.isToolAllowed('Write')).toBe(true);
      });

      it('should return false for tools requiring confirmation', async () => {
        await presetManager.applyPreset('review-all');
        expect(await presetManager.isToolAllowed('Read')).toBe(false);
        expect(await presetManager.isToolAllowed('Write')).toBe(false);
      });

      it('should return false for denied tools', async () => {
        await presetManager.applyPreset('read-only');
        expect(await presetManager.isToolAllowed('Write')).toBe(false);
        expect(await presetManager.isToolAllowed('Bash')).toBe(false);
      });
    });

    describe('isConfirmationRequired', () => {
      it('should return true for tools in review-all preset', async () => {
        await presetManager.applyPreset('review-all');
        expect(await presetManager.isConfirmationRequired('Read')).toBe(true);
        expect(await presetManager.isConfirmationRequired('Write')).toBe(true);
      });

      it('should return false for allowed tools in autonomous preset', async () => {
        await presetManager.applyPreset('autonomous');
        expect(await presetManager.isConfirmationRequired('Read')).toBe(false);
        expect(await presetManager.isConfirmationRequired('Write')).toBe(false);
      });

      it('should return false for denied tools', async () => {
        await presetManager.applyPreset('read-only');
        expect(await presetManager.isConfirmationRequired('Write')).toBe(false);
        expect(await presetManager.isConfirmationRequired('Bash')).toBe(false);
      });
    });

    describe('isToolDenied', () => {
      it('should return true for write tools in read-only preset', async () => {
        await presetManager.applyPreset('read-only');
        expect(await presetManager.isToolDenied('Write')).toBe(true);
        expect(await presetManager.isToolDenied('Bash')).toBe(true);
      });

      it('should return false for allowed tools', async () => {
        await presetManager.applyPreset('autonomous');
        expect(await presetManager.isToolDenied('Read')).toBe(false);
        expect(await presetManager.isToolDenied('Write')).toBe(false);
      });

      it('should return false for tools requiring confirmation', async () => {
        await presetManager.applyPreset('review-all');
        expect(await presetManager.isToolDenied('Read')).toBe(false);
        expect(await presetManager.isToolDenied('Write')).toBe(false);
      });

      it('should handle stored deny permissions', async () => {
        await presetManager.applyPreset('autonomous');

        // Add a specific deny permission
        const permission: Permission = {
          tool: 'Read',
          level: 'deny',
          createdAt: new Date(),
        };
        await permissionStore.savePermission(permission);

        expect(await presetManager.isToolDenied('Read')).toBe(true);
      });
    });
  });

  describe('getPresetConfig', () => {
    it('should return correct config for current preset', async () => {
      await presetManager.applyPreset('autonomous');
      const config = presetManager.getPresetConfig();
      expect(config.name).toBe('autonomous');
      expect(config.defaultBehavior).toBe('allow');

      await presetManager.applyPreset('review-all');
      const reviewConfig = presetManager.getPresetConfig();
      expect(reviewConfig.name).toBe('review-all');
      expect(reviewConfig.defaultBehavior).toBe('confirm');

      await presetManager.applyPreset('read-only');
      const readOnlyConfig = presetManager.getPresetConfig();
      expect(readOnlyConfig.name).toBe('read-only');
      expect(readOnlyConfig.defaultBehavior).toBe('deny');
    });
  });

  describe('resetToPreset', () => {
    it('should clear permissions and re-apply current preset', async () => {
      await presetManager.applyPreset('read-only');

      // Add a conflicting permission manually
      const permission: Permission = {
        tool: 'Read',
        level: 'deny',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // Verify the conflicting permission exists
      let level = await presetManager.getEffectivePermissionLevel('Read');
      expect(level).toBe('deny');

      // Reset to preset
      await presetManager.resetToPreset();

      // Verify preset rules are re-applied
      level = await presetManager.getEffectivePermissionLevel('Read');
      expect(level).toBe('allow-always');
    });

    it('should maintain current preset after reset', async () => {
      await presetManager.applyPreset('autonomous');
      expect(presetManager.getCurrentPreset()).toBe('autonomous');

      await presetManager.resetToPreset();
      expect(presetManager.getCurrentPreset()).toBe('autonomous');
    });
  });

  describe('Integration with PermissionStore', () => {
    it('should work with permission store lifecycle', async () => {
      // Apply preset
      await presetManager.applyPreset('read-only');

      // Verify permissions are stored
      const permissions = await permissionStore.listPermissions();
      expect(permissions.length).toBeGreaterThan(0);

      // All stored permissions should be for read-only tools with allow-always level
      permissions.forEach(permission => {
        expect(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch']).toContain(permission.tool);
        expect(permission.level).toBe('allow-always');
      });
    });

    it('should handle permission expiration through store', async () => {
      // Add an expiring permission
      const expiredPermission: Permission = {
        tool: 'Write',
        level: 'allow-always',
        expiry: new Date(Date.now() - 1000), // Expired 1 second ago
        createdAt: new Date(Date.now() - 2000),
      };
      await permissionStore.savePermission(expiredPermission);

      // Should not find expired permission and fall back to preset behavior
      await presetManager.applyPreset('read-only');
      const level = await presetManager.getEffectivePermissionLevel('Write');
      expect(level).toBe('deny'); // Read-only preset denies write tools
    });
  });

  describe('Error Handling', () => {
    it('should handle permission store errors gracefully', async () => {
      // Close the database to simulate error
      permissionStore.close();

      // Operations should still work for preset logic
      expect(presetManager.getCurrentPreset()).toBe('review-all');
      expect(presetManager.getPresetConfig().name).toBe('review-all');

      // Operations requiring store access should reject
      await expect(presetManager.applyPreset('autonomous')).rejects.toThrow();
      await expect(presetManager.getEffectivePermissionLevel('Read')).rejects.toThrow();
    });

    it('should handle invalid tool names gracefully', async () => {
      await presetManager.applyPreset('autonomous');

      // Should not throw for invalid/empty tool names
      expect(await presetManager.getEffectivePermissionLevel('')).toBe('allow-always');
      expect(await presetManager.getEffectivePermissionLevel('   ')).toBe('allow-always');
      expect(await presetManager.getEffectivePermissionLevel('Invalid-Tool-123')).toBe('allow-always');
    });
  });

  describe('Behavior Consistency', () => {
    it('should be consistent with core preset utility functions', async () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];
      const tools = ['Read', 'Write', 'Bash', 'Grep', 'UnknownTool'];

      for (const preset of presets) {
        await presetManager.applyPreset(preset);

        for (const tool of tools) {
          const level = await presetManager.getEffectivePermissionLevel(tool);
          const isAllowed = await presetManager.isToolAllowed(tool);
          const requiresConfirm = await presetManager.isConfirmationRequired(tool);
          const isDenied = await presetManager.isToolDenied(tool);

          // Verify consistency
          expect(isAllowed).toBe(level === 'allow-always');
          expect(requiresConfirm).toBe(level === 'allow-once');
          expect(isDenied).toBe(level === 'deny' || level === null);

          // Exactly one should be true
          const trueCount = [isAllowed, requiresConfirm, isDenied].filter(Boolean).length;
          expect(trueCount).toBe(1);
        }
      }
    });
  });
});