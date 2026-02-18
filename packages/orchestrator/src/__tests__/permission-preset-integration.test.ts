import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PermissionStore } from '../permission-store';
import { PermissionManager } from '../permission-manager';
import { PermissionPresetManager } from '../permission-preset-manager';

describe('Permission System Integration', () => {
  let tempDir: string;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let presetManager: PermissionPresetManager;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-permission-integration-test-'));

    // Initialize permission store
    permissionStore = new PermissionStore(tempDir);
    await permissionStore.initialize();

    // Initialize permission manager and preset manager
    permissionManager = new PermissionManager(permissionStore);
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

  describe('Integration with PermissionManager', () => {
    it('should work together for autonomous preset workflow', async () => {
      // Apply autonomous preset
      await presetManager.applyPreset('autonomous');

      // Check that PermissionManager sees permissions correctly
      expect(await permissionManager.hasPermission('Read')).toBe(false); // No stored permission yet

      // Grant a permission through PermissionManager
      await permissionManager.grantPermission('Read', undefined, 'allow-always');

      // Now PermissionManager should see it
      expect(await permissionManager.hasPermission('Read')).toBe(true);

      // PresetManager should respect the stored permission
      const level = await presetManager.getEffectivePermissionLevel('Read');
      expect(level).toBe('allow-always');

      // For tools without stored permissions, should use preset behavior
      const writeLevel = await presetManager.getEffectivePermissionLevel('Write');
      expect(writeLevel).toBe('allow-always'); // Autonomous allows everything
    });

    it('should work together for read-only preset workflow', async () => {
      // Apply read-only preset
      await presetManager.applyPreset('read-only');

      // Check effective permissions through preset manager
      expect(await presetManager.isToolAllowed('Read')).toBe(true);
      expect(await presetManager.isToolDenied('Write')).toBe(true);

      // PermissionManager should find the preset-applied permissions
      expect(await permissionManager.hasPermission('Read')).toBe(true);
      expect(await permissionManager.hasPermission('Write')).toBe(false);

      // Override a preset rule through PermissionManager
      await permissionManager.grantPermission('Write', '/src/**', 'allow-once');

      // PresetManager should respect the override
      const scopedLevel = await presetManager.getEffectivePermissionLevel('Write', '/src/**');
      expect(scopedLevel).toBe('allow-once');

      // But general Write should still be denied
      const generalLevel = await presetManager.getEffectivePermissionLevel('Write');
      expect(generalLevel).toBe('deny');
    });

    it('should handle session cache correctly with presets', async () => {
      // Apply review-all preset (everything requires confirmation)
      await presetManager.applyPreset('review-all');

      // Grant an allow-once permission
      await permissionManager.grantPermission('Write', undefined, 'allow-once');

      // First check should return allow-once (and consume it)
      const firstCheck = await permissionManager.checkPermission('Write');
      expect(firstCheck).toBe('allow-once');

      // Second check should fall back to preset behavior (confirm = allow-once)
      const secondCheck = await permissionManager.checkPermission('Write');
      expect(secondCheck).toBe('allow-once');

      // PresetManager should see the fallback behavior
      const presetLevel = await presetManager.getEffectivePermissionLevel('Write');
      expect(presetLevel).toBe('allow-once');
    });
  });

  describe('Preset Switching Scenarios', () => {
    it('should handle switching from restrictive to permissive preset', async () => {
      // Start with read-only preset
      await presetManager.applyPreset('read-only');
      expect(await presetManager.isToolDenied('Write')).toBe(true);

      // Switch to autonomous preset
      await presetManager.applyPreset('autonomous');
      expect(await presetManager.isToolAllowed('Write')).toBe(true);

      // PermissionManager should see the new behavior
      const level = await presetManager.getEffectivePermissionLevel('Write');
      expect(level).toBe('allow-always');
    });

    it('should handle switching from permissive to restrictive preset', async () => {
      // Start with autonomous preset
      await presetManager.applyPreset('autonomous');
      expect(await presetManager.isToolAllowed('Write')).toBe(true);

      // Add some manual permissions
      await permissionManager.grantPermission('CustomTool', undefined, 'allow-always');

      // Switch to read-only preset
      await presetManager.applyPreset('read-only');
      expect(await presetManager.isToolDenied('Write')).toBe(true);

      // Manual permission should be cleared
      expect(await permissionManager.hasPermission('CustomTool')).toBe(false);

      // Read-only tools should still be allowed
      expect(await presetManager.isToolAllowed('Read')).toBe(true);
    });
  });

  describe('Complex Workflows', () => {
    it('should support mixed permission sources correctly', async () => {
      // Apply review-all preset (everything needs confirmation)
      await presetManager.applyPreset('review-all');

      // Add specific overrides
      await permissionManager.grantPermission('Read', '/safe/**', 'allow-always');
      await permissionManager.grantPermission('Write', undefined, 'deny');

      // Check effective permissions
      expect(await presetManager.getEffectivePermissionLevel('Read', '/safe/**')).toBe('allow-always');
      expect(await presetManager.getEffectivePermissionLevel('Read')).toBe('allow-once'); // Preset default
      expect(await presetManager.getEffectivePermissionLevel('Write')).toBe('deny'); // Override
      expect(await presetManager.getEffectivePermissionLevel('Bash')).toBe('allow-once'); // Preset default

      // Convenience methods should work correctly
      expect(await presetManager.isToolAllowed('Read', '/safe/**')).toBe(true);
      expect(await presetManager.isConfirmationRequired('Read')).toBe(true);
      expect(await presetManager.isToolDenied('Write')).toBe(true);
    });

    it('should handle permission expiration with presets', async () => {
      // Apply autonomous preset
      await presetManager.applyPreset('autonomous');

      // Add an expiring permission that overrides the preset
      await permissionStore.savePermission({
        tool: 'Write',
        level: 'deny',
        expiry: new Date(Date.now() + 1000), // Expires in 1 second
        createdAt: new Date(),
      });

      // Should use the override while it's valid
      let level = await presetManager.getEffectivePermissionLevel('Write');
      expect(level).toBe('deny');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should fall back to preset behavior
      level = await presetManager.getEffectivePermissionLevel('Write');
      expect(level).toBe('allow-always');
    });
  });
});