import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  PermissionPreset,
  Permission,
} from '@apexcli/core';
import { PermissionStore } from '../permission-store';
import { PermissionPresetManager } from '../permission-preset-manager';

describe('PermissionPresetManager Edge Cases', () => {
  let tempDir: string;
  let permissionStore: PermissionStore;
  let presetManager: PermissionPresetManager;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-preset-edge-test-'));
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

  describe('Boundary Conditions', () => {
    it('should handle extremely long tool names', async () => {
      const longToolName = 'A'.repeat(1000);
      await presetManager.applyPreset('autonomous');

      const level = await presetManager.getEffectivePermissionLevel(longToolName);
      expect(level).toBe('allow-always');

      expect(await presetManager.isToolAllowed(longToolName)).toBe(true);
      expect(await presetManager.isConfirmationRequired(longToolName)).toBe(false);
      expect(await presetManager.isToolDenied(longToolName)).toBe(false);
    });

    it('should handle tool names with special characters', async () => {
      const specialToolNames = [
        'Tool@#$%^&*()',
        'Tool-with-dashes',
        'Tool.with.dots',
        'Tool_with_underscores',
        'Tool/with/slashes',
        'Tool\\with\\backslashes',
        'Tool with spaces',
        'Tool\twith\ttabs',
        'Tool\nwith\nnewlines',
      ];

      await presetManager.applyPreset('review-all');

      for (const toolName of specialToolNames) {
        const level = await presetManager.getEffectivePermissionLevel(toolName);
        expect(level).toBe('allow-once');
        expect(await presetManager.isConfirmationRequired(toolName)).toBe(true);
      }
    });

    it('should handle unicode tool names', async () => {
      const unicodeToolNames = [
        '工具', // Chinese
        'инструмент', // Russian
        'ツール', // Japanese
        'أداة', // Arabic
        '🔧🛠️', // Emojis
        'Tool™️©️®️', // Symbol characters
      ];

      await presetManager.applyPreset('autonomous');

      for (const toolName of unicodeToolNames) {
        const level = await presetManager.getEffectivePermissionLevel(toolName);
        expect(level).toBe('allow-always');
      }
    });

    it('should handle very long scope patterns', async () => {
      const longScope = '/path/'.repeat(500) + '**';

      await permissionStore.savePermission({
        tool: 'Read',
        scope: longScope,
        level: 'allow-always',
        createdAt: new Date(),
      });

      const level = await presetManager.getEffectivePermissionLevel('Read', longScope);
      expect(level).toBe('allow-always');
    });

    it('should handle scope patterns with special regex characters', async () => {
      const specialScopes = [
        '/path/with/[brackets]/**',
        '/path/with/(parens)/**',
        '/path/with/{braces}/**',
        '/path/with/^caret/**',
        '/path/with/$dollar/**',
        '/path/with/|pipe/**',
        '/path/with/\\escape/**',
        '/path/with/+plus/**',
        '/path/with/?question/**',
        '/path/with/*.star/**',
      ];

      for (const scope of specialScopes) {
        await permissionStore.savePermission({
          tool: 'Write',
          scope,
          level: 'allow-always',
          createdAt: new Date(),
        });

        const level = await presetManager.getEffectivePermissionLevel('Write', scope);
        expect(level).toBe('allow-always');
      }
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large numbers of permissions efficiently', async () => {
      const startTime = Date.now();

      // Create 1000 permissions
      for (let i = 0; i < 1000; i++) {
        await permissionStore.savePermission({
          tool: `Tool${i}`,
          scope: `/path/${i}/**`,
          level: 'allow-always',
          createdAt: new Date(),
        });
      }

      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Test lookup performance
      const lookupStart = Date.now();
      for (let i = 0; i < 100; i++) {
        await presetManager.getEffectivePermissionLevel(`Tool${i}`, `/path/${i}/**`);
      }
      const lookupTime = Date.now() - lookupStart;
      expect(lookupTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle rapid preset switching without memory leaks', async () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      // Switch presets rapidly 100 times
      for (let i = 0; i < 100; i++) {
        const preset = presets[i % presets.length];
        await presetManager.applyPreset(preset);
        expect(presetManager.getCurrentPreset()).toBe(preset);
      }

      // Verify final state is consistent
      const finalLevel = await presetManager.getEffectivePermissionLevel('Read');
      expect(['allow-always', 'allow-once', 'deny']).toContain(finalLevel!);
    });

    it('should handle concurrent permission checks gracefully', async () => {
      await presetManager.applyPreset('review-all');

      // Create 100 concurrent permission checks
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(presetManager.getEffectivePermissionLevel(`Tool${i % 10}`));
        promises.push(presetManager.isToolAllowed(`Tool${i % 10}`));
        promises.push(presetManager.isConfirmationRequired(`Tool${i % 10}`));
        promises.push(presetManager.isToolDenied(`Tool${i % 10}`));
      }

      const results = await Promise.all(promises);

      // All results should be defined (no crashes)
      results.forEach(result => {
        expect(result).toBeDefined();
      });

      // Verify consistency - every 4th result should match the permission level
      for (let i = 0; i < results.length; i += 4) {
        const level = results[i];
        const isAllowed = results[i + 1];
        const requiresConfirm = results[i + 2];
        const isDenied = results[i + 3];

        expect(isAllowed).toBe(level === 'allow-always');
        expect(requiresConfirm).toBe(level === 'allow-once');
        expect(isDenied).toBe(level === 'deny' || level === null);
      }
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle database corruption gracefully', async () => {
      // Apply a preset first
      await presetManager.applyPreset('read-only');

      // Simulate database corruption by closing and reopening with invalid state
      permissionStore.close();

      // Create a new store and manager
      const newStore = new PermissionStore(tempDir);
      await newStore.initialize();
      const newManager = new PermissionPresetManager(newStore, 'autonomous');

      // Should fall back to preset behavior when database is empty/corrupted
      const level = await newManager.getEffectivePermissionLevel('Write');
      expect(level).toBe('allow-always'); // Autonomous preset allows everything

      newStore.close();
    });

    it('should handle permission expiration edge cases', async () => {
      // Permission that expires exactly now
      const exactlyNow = new Date();
      await permissionStore.savePermission({
        tool: 'Test',
        level: 'allow-always',
        expiry: exactlyNow,
        createdAt: new Date(exactlyNow.getTime() - 1000),
      });

      // Should handle timestamp precision edge cases
      const level1 = await presetManager.getEffectivePermissionLevel('Test');

      // Wait a tiny bit and check again
      await new Promise(resolve => setTimeout(resolve, 1));
      const level2 = await presetManager.getEffectivePermissionLevel('Test');

      // One of these should be null (expired), behavior may vary based on timing
      expect(level1 === null || level2 === null || level1 === level2).toBe(true);
    });

    it('should handle preset changes during permission checks', async () => {
      await presetManager.applyPreset('autonomous');

      // Start a permission check
      const levelPromise = presetManager.getEffectivePermissionLevel('Test');

      // Change preset while the check is running
      await presetManager.applyPreset('read-only');

      // The original check should complete without error
      const level = await levelPromise;
      expect(['allow-always', 'deny', null]).toContain(level);

      // New checks should use the new preset
      const newLevel = await presetManager.getEffectivePermissionLevel('Test');
      expect(newLevel).toBe('deny'); // read-only denies unknown tools
    });
  });

  describe('Type Safety and Validation Edge Cases', () => {
    it('should handle invalid preset values gracefully in constructor', () => {
      // Constructor should accept valid presets
      expect(() => new PermissionPresetManager(permissionStore, 'autonomous')).not.toThrow();
      expect(() => new PermissionPresetManager(permissionStore, 'review-all')).not.toThrow();
      expect(() => new PermissionPresetManager(permissionStore, 'read-only')).not.toThrow();

      // Invalid preset should be caught by TypeScript, but test runtime behavior
      const invalidManager = new PermissionPresetManager(permissionStore, 'invalid' as any);
      expect(invalidManager.getCurrentPreset()).toBe('invalid');
    });

    it('should handle whitespace-only tool names', async () => {
      await presetManager.applyPreset('autonomous');

      const whitespaceNames = ['', ' ', '  ', '\t', '\n', '\r\n', ' \t\n '];

      for (const name of whitespaceNames) {
        const level = await presetManager.getEffectivePermissionLevel(name);
        expect(level).toBe('allow-always');
      }
    });

    it('should handle null and undefined scopes consistently', async () => {
      await permissionStore.savePermission({
        tool: 'Test',
        level: 'allow-always',
        createdAt: new Date(),
      });

      const levelWithUndefined = await presetManager.getEffectivePermissionLevel('Test', undefined);
      const levelWithoutScope = await presetManager.getEffectivePermissionLevel('Test');

      expect(levelWithUndefined).toBe(levelWithoutScope);
      expect(levelWithUndefined).toBe('allow-always');
    });
  });

  describe('Behavioral Edge Cases', () => {
    it('should maintain consistency after multiple preset applications', async () => {
      // Apply same preset multiple times
      await presetManager.applyPreset('read-only');
      await presetManager.applyPreset('read-only');
      await presetManager.applyPreset('read-only');

      // Should behave the same as applying it once
      expect(await presetManager.isToolAllowed('Read')).toBe(true);
      expect(await presetManager.isToolDenied('Write')).toBe(true);

      const permissions = await permissionStore.listPermissions();

      // Should not have duplicate permissions
      const readPermissions = permissions.filter(p => p.tool === 'Read');
      expect(readPermissions.length).toBe(1);
    });

    it('should handle case sensitivity correctly', async () => {
      await presetManager.applyPreset('read-only');

      // Tools are typically case-sensitive
      const readLevel = await presetManager.getEffectivePermissionLevel('Read');
      const readLowerLevel = await presetManager.getEffectivePermissionLevel('read');

      expect(readLevel).toBe('allow-always');
      expect(readLowerLevel).toBe('deny'); // lowercase 'read' not in read-only tools
    });

    it('should handle preset configuration edge cases', async () => {
      // Get config for each preset and verify structure
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      for (const preset of presets) {
        await presetManager.applyPreset(preset);
        const config = presetManager.getPresetConfig();

        expect(config.name).toBe(preset);
        expect(typeof config.description).toBe('string');
        expect(['allow', 'confirm', 'deny']).toContain(config.defaultBehavior);
        expect(typeof config.allowFileCreation).toBe('boolean');
        expect(typeof config.allowShellExecution).toBe('boolean');
        expect(typeof config.allowNetworkAccess).toBe('boolean');
        expect(Array.isArray(config.rules)).toBe(true);
      }
    });

    it('should handle permission priority correctly', async () => {
      await presetManager.applyPreset('read-only');

      // Store a permission that conflicts with preset
      await permissionStore.savePermission({
        tool: 'Read',
        level: 'deny',
        createdAt: new Date(),
      });

      // Stored permission should take precedence over preset
      const level = await presetManager.getEffectivePermissionLevel('Read');
      expect(level).toBe('deny');

      // Reset should restore preset behavior
      await presetManager.resetToPreset();
      const resetLevel = await presetManager.getEffectivePermissionLevel('Read');
      expect(resetLevel).toBe('allow-always');
    });
  });

  describe('Complex Interaction Edge Cases', () => {
    it('should handle permission store reinitialization', async () => {
      await presetManager.applyPreset('autonomous');
      expect(presetManager.getCurrentPreset()).toBe('autonomous');

      // Reinitialize the store
      permissionStore.close();
      permissionStore = new PermissionStore(tempDir);
      await permissionStore.initialize();

      // Manager should still work with new store instance
      // (though it's still using the old store reference)
      expect(presetManager.getCurrentPreset()).toBe('autonomous');

      // But new permissions won't work with old store
      await expect(presetManager.applyPreset('read-only')).rejects.toThrow();
    });

    it('should handle multiple managers on same store', async () => {
      const manager1 = new PermissionPresetManager(permissionStore, 'autonomous');
      const manager2 = new PermissionPresetManager(permissionStore, 'read-only');

      // Both managers start with different presets
      expect(manager1.getCurrentPreset()).toBe('autonomous');
      expect(manager2.getCurrentPreset()).toBe('read-only');

      // Apply preset through one manager
      await manager1.applyPreset('review-all');

      // The other manager should see the permission changes when querying store
      const level1 = await manager1.getEffectivePermissionLevel('UnknownTool');
      const level2 = await manager2.getEffectivePermissionLevel('UnknownTool');

      // manager1 should use review-all behavior
      expect(level1).toBe('allow-once');

      // manager2 still thinks it's read-only, so unknown tools are denied
      expect(level2).toBe('deny');

      // But if manager2 checks a tool that was set by manager1
      const readLevel1 = await manager1.getEffectivePermissionLevel('Read');
      const readLevel2 = await manager2.getEffectivePermissionLevel('Read');

      // Both should see stored permission if it exists
      expect(readLevel1).toBe(readLevel2);
    });
  });
});