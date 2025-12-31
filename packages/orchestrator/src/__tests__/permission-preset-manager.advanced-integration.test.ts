import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  PermissionPreset,
  Permission,
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  ALL_TOOLS,
} from '@apexcli/core';
import { PermissionStore } from '../permission-store';
import { PermissionManager } from '../permission-manager';
import { PermissionPresetManager } from '../permission-preset-manager';

describe('PermissionPresetManager Advanced Integration Tests', () => {
  let tempDir: string;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let presetManager: PermissionPresetManager;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-preset-advanced-test-'));
    permissionStore = new PermissionStore(tempDir);
    await permissionStore.initialize();
    permissionManager = new PermissionManager(permissionStore);
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

  describe('Realistic Workflow Scenarios', () => {
    it('should support development team permission workflow', async () => {
      // Scenario: Start with restrictive preset for new team member
      await presetManager.applyPreset('review-all');

      // Verify new team member needs confirmation for everything
      expect(await presetManager.isConfirmationRequired('Read')).toBe(true);
      expect(await presetManager.isConfirmationRequired('Write')).toBe(true);
      expect(await presetManager.isConfirmationRequired('Bash')).toBe(true);

      // Gradually grant specific permissions as team member proves reliable
      await permissionManager.grantPermission('Read', undefined, 'allow-always');
      await permissionManager.grantPermission('Grep', undefined, 'allow-always');
      await permissionManager.grantPermission('Glob', undefined, 'allow-always');

      // Verify mixed state: some tools allowed, others still need confirmation
      expect(await presetManager.isToolAllowed('Read')).toBe(true);
      expect(await presetManager.isToolAllowed('Grep')).toBe(true);
      expect(await presetManager.isConfirmationRequired('Write')).toBe(true);
      expect(await presetManager.isConfirmationRequired('Bash')).toBe(true);

      // Eventually upgrade to read-only preset for trusted but cautious access
      await presetManager.applyPreset('read-only');

      // Verify all read-only tools are now allowed
      for (const tool of READ_ONLY_TOOLS) {
        expect(await presetManager.isToolAllowed(tool)).toBe(true);
      }

      // Write tools should still be denied
      for (const tool of WRITE_TOOLS) {
        expect(await presetManager.isToolDenied(tool)).toBe(true);
      }

      // Finally upgrade to autonomous for senior team member
      await presetManager.applyPreset('autonomous');

      // Verify everything is allowed
      for (const tool of ALL_TOOLS) {
        expect(await presetManager.isToolAllowed(tool)).toBe(true);
      }
    });

    it('should support production deployment permission management', async () => {
      // Production environment starts with read-only
      await presetManager.applyPreset('read-only');

      // Allow emergency write access to specific critical paths
      await permissionManager.grantPermission('Write', '/app/config/**', 'allow-once');
      await permissionManager.grantPermission('Edit', '/app/config/**', 'allow-once');

      // Allow monitoring tools to run specific safe commands
      await permissionManager.grantPermission('Bash', 'ps aux', 'allow-always');
      await permissionManager.grantPermission('Bash', 'df -h', 'allow-always');
      await permissionManager.grantPermission('Bash', 'free -m', 'allow-always');

      // Verify production restrictions
      expect(await presetManager.isToolAllowed('Read')).toBe(true);
      expect(await presetManager.isToolDenied('Write')).toBe(true);
      expect(await presetManager.getEffectivePermissionLevel('Write', '/app/config/**')).toBe('allow-once');
      expect(await presetManager.getEffectivePermissionLevel('Bash', 'ps aux')).toBe('allow-always');

      // During maintenance window, temporarily upgrade to autonomous
      await presetManager.applyPreset('autonomous');

      // Perform maintenance operations
      expect(await presetManager.isToolAllowed('Write')).toBe(true);
      expect(await presetManager.isToolAllowed('Bash')).toBe(true);

      // After maintenance, return to read-only
      await presetManager.applyPreset('read-only');
      expect(await presetManager.isToolDenied('Write')).toBe(true);
    });

    it('should support security audit scenario', async () => {
      // Start with autonomous preset (before security review)
      await presetManager.applyPreset('autonomous');

      // Simulate some granted permissions during development
      await permissionManager.grantPermission('Bash', 'rm -rf /*', 'allow-always');
      await permissionManager.grantPermission('Write', '/etc/**', 'allow-always');

      // Security audit: switch to read-only and verify dangerous permissions are cleared
      await presetManager.applyPreset('read-only');

      // Verify dangerous permissions are no longer effective
      expect(await presetManager.getEffectivePermissionLevel('Bash', 'rm -rf /*')).toBe('deny');
      expect(await presetManager.getEffectivePermissionLevel('Write', '/etc/**')).toBe('deny');

      // But safe tools still work
      expect(await presetManager.isToolAllowed('Read')).toBe(true);
      expect(await presetManager.isToolAllowed('Grep')).toBe(true);

      // Add back only necessary permissions after security review
      await permissionManager.grantPermission('Write', '/app/logs/**', 'allow-once');

      expect(await presetManager.getEffectivePermissionLevel('Write', '/app/logs/**')).toBe('allow-once');
      expect(await presetManager.getEffectivePermissionLevel('Write', '/etc/**')).toBe('deny');
    });
  });

  describe('Complex Permission Inheritance Scenarios', () => {
    it('should handle complex scope hierarchies', async () => {
      await presetManager.applyPreset('read-only');

      // Create hierarchical permissions
      await permissionManager.grantPermission('Write', '/project/**', 'allow-once');
      await permissionManager.grantPermission('Write', '/project/src/**', 'allow-always');
      await permissionManager.grantPermission('Write', '/project/src/sensitive/**', 'deny');

      // Test scope specificity
      expect(await presetManager.getEffectivePermissionLevel('Write')).toBe('deny'); // Default for write tools
      expect(await presetManager.getEffectivePermissionLevel('Write', '/project/docs/file.txt')).toBe('allow-once');
      expect(await presetManager.getEffectivePermissionLevel('Write', '/project/src/file.js')).toBe('allow-always');
      expect(await presetManager.getEffectivePermissionLevel('Write', '/project/src/sensitive/secret.txt')).toBe('deny');
    });

    it('should handle temporal permission patterns', async () => {
      await presetManager.applyPreset('review-all');

      const now = new Date();
      const future = new Date(now.getTime() + 60000); // 1 minute from now
      const past = new Date(now.getTime() - 60000); // 1 minute ago

      // Add expiring permissions
      await permissionStore.savePermission({
        tool: 'Write',
        scope: '/tmp/**',
        level: 'allow-always',
        expiry: future,
        createdAt: now,
      });

      await permissionStore.savePermission({
        tool: 'Bash',
        scope: 'deploy.sh',
        level: 'allow-always',
        expiry: past, // Already expired
        createdAt: new Date(past.getTime() - 1000),
      });

      // Test temporal behavior
      expect(await presetManager.getEffectivePermissionLevel('Write', '/tmp/test.txt')).toBe('allow-always');
      expect(await presetManager.getEffectivePermissionLevel('Bash', 'deploy.sh')).toBe('allow-once'); // Falls back to preset
      expect(await presetManager.getEffectivePermissionLevel('Write')).toBe('allow-once'); // Default preset behavior
    });
  });

  describe('Multi-User Simulation', () => {
    it('should simulate multiple users with different permission managers', async () => {
      // User 1: Junior developer (read-only)
      const user1Manager = new PermissionPresetManager(permissionStore, 'read-only');
      await user1Manager.applyPreset('read-only');

      // User 2: Senior developer (review-all)
      const user2Manager = new PermissionPresetManager(permissionStore, 'review-all');

      // User 3: Admin (autonomous)
      const user3Manager = new PermissionPresetManager(permissionStore, 'autonomous');

      // Each user sees their own preset behavior initially
      expect(user1Manager.getCurrentPreset()).toBe('read-only');
      expect(user2Manager.getCurrentPreset()).toBe('review-all');
      expect(user3Manager.getCurrentPreset()).toBe('autonomous');

      // Admin grants specific permission
      await permissionManager.grantPermission('Write', '/shared/**', 'allow-once');

      // All users should see the shared permission
      expect(await user1Manager.getEffectivePermissionLevel('Write', '/shared/file.txt')).toBe('allow-once');
      expect(await user2Manager.getEffectivePermissionLevel('Write', '/shared/file.txt')).toBe('allow-once');
      expect(await user3Manager.getEffectivePermissionLevel('Write', '/shared/file.txt')).toBe('allow-once');

      // But their default behaviors differ
      expect(await user1Manager.getEffectivePermissionLevel('Write')).toBe('deny');
      expect(await user2Manager.getEffectivePermissionLevel('Write')).toBe('allow-once');
      expect(await user3Manager.getEffectivePermissionLevel('Write')).toBe('allow-always');
    });

    it('should handle permission conflicts between managers', async () => {
      const manager1 = new PermissionPresetManager(permissionStore, 'autonomous');
      const manager2 = new PermissionPresetManager(permissionStore, 'read-only');

      // Manager1 applies autonomous (clears store and sets autonomous rules)
      await manager1.applyPreset('autonomous');

      // Manager2 still thinks it's read-only but sees the cleared store
      expect(manager2.getCurrentPreset()).toBe('read-only');

      // Manager2's queries will use its preset behavior since store was cleared by manager1
      expect(await manager2.getEffectivePermissionLevel('Write')).toBe('deny'); // read-only denies write

      // Manager1 sees autonomous behavior
      expect(await manager1.getEffectivePermissionLevel('Write')).toBe('allow-always');

      // Now manager2 reapplies its preset
      await manager2.applyPreset('read-only');

      // Both managers should now see read-only behavior from the store
      expect(await manager1.getEffectivePermissionLevel('Read')).toBe('allow-always'); // Read is allowed in read-only
      expect(await manager2.getEffectivePermissionLevel('Read')).toBe('allow-always');
      expect(await manager1.getEffectivePermissionLevel('Write')).toBe('deny'); // Write denied even for manager1
      expect(await manager2.getEffectivePermissionLevel('Write')).toBe('deny');
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from store corruption during operations', async () => {
      await presetManager.applyPreset('review-all');

      // Verify initial state
      expect(await presetManager.isConfirmationRequired('Read')).toBe(true);

      // Simulate store corruption by closing it mid-operation
      permissionStore.close();

      // Subsequent operations should fail gracefully
      await expect(presetManager.applyPreset('autonomous')).rejects.toThrow();
      await expect(presetManager.getEffectivePermissionLevel('Read')).rejects.toThrow();

      // But local state operations should still work
      expect(presetManager.getCurrentPreset()).toBe('review-all');
      expect(presetManager.getPresetConfig().name).toBe('review-all');

      // Recovery: reinitialize store
      permissionStore = new PermissionStore(tempDir);
      await permissionStore.initialize();
      presetManager = new PermissionPresetManager(permissionStore);

      // Should be able to apply presets again
      await presetManager.applyPreset('autonomous');
      expect(presetManager.getCurrentPreset()).toBe('autonomous');
    });

    it('should handle partial preset application failures', async () => {
      await presetManager.applyPreset('read-only');

      // Manually add a permission that might conflict with the preset during reset
      await permissionStore.savePermission({
        tool: 'Read',
        level: 'deny',
        createdAt: new Date(),
      });

      // Reset should clear this and reapply preset
      await presetManager.resetToPreset();

      // Verify the conflicting permission was cleared and preset reapplied
      const level = await presetManager.getEffectivePermissionLevel('Read');
      expect(level).toBe('allow-always'); // Should be allow-always from read-only preset
    });
  });

  describe('Complex Business Logic Scenarios', () => {
    it('should support staged deployment permission escalation', async () => {
      // Stage 1: Development (autonomous)
      await presetManager.applyPreset('autonomous');
      expect(await presetManager.isToolAllowed('Write')).toBe(true);
      expect(await presetManager.isToolAllowed('Bash')).toBe(true);

      // Stage 2: Testing (review-all - need confirmation)
      await presetManager.applyPreset('review-all');
      expect(await presetManager.isConfirmationRequired('Write')).toBe(true);
      expect(await presetManager.isConfirmationRequired('Bash')).toBe(true);

      // Stage 3: Staging (read-only with specific write exceptions)
      await presetManager.applyPreset('read-only');
      await permissionManager.grantPermission('Write', '/app/config/staging.json', 'allow-once');

      expect(await presetManager.isToolAllowed('Read')).toBe(true);
      expect(await presetManager.isToolDenied('Write')).toBe(true);
      expect(await presetManager.getEffectivePermissionLevel('Write', '/app/config/staging.json')).toBe('allow-once');

      // Stage 4: Production (read-only, no exceptions)
      await presetManager.applyPreset('read-only');

      expect(await presetManager.isToolAllowed('Read')).toBe(true);
      expect(await presetManager.isToolDenied('Write')).toBe(true);
      expect(await presetManager.isToolDenied('Bash')).toBe(true);
    });

    it('should support feature flag based permissions', async () => {
      // Base permissions: read-only
      await presetManager.applyPreset('read-only');

      // Feature flags for additional permissions
      const features = {
        allowConfigEdit: true,
        allowScriptExecution: false,
        allowFileCreation: true,
      };

      // Apply feature-based permissions
      if (features.allowConfigEdit) {
        await permissionManager.grantPermission('Edit', '/app/config/**', 'allow-always');
      }

      if (features.allowScriptExecution) {
        await permissionManager.grantPermission('Bash', undefined, 'allow-once');
      }

      if (features.allowFileCreation) {
        await permissionManager.grantPermission('Write', '/app/data/**', 'allow-always');
      }

      // Verify feature-based permissions
      expect(await presetManager.isToolAllowed('Read')).toBe(true); // Base read-only
      expect(await presetManager.getEffectivePermissionLevel('Edit', '/app/config/app.json')).toBe('allow-always');
      expect(await presetManager.getEffectivePermissionLevel('Bash')).toBe('deny'); // Feature disabled
      expect(await presetManager.getEffectivePermissionLevel('Write', '/app/data/output.txt')).toBe('allow-always');

      // Change feature flags
      features.allowScriptExecution = true;
      features.allowConfigEdit = false;

      // Update permissions based on new flags
      await presetManager.resetToPreset(); // Clear all
      if (features.allowScriptExecution) {
        await permissionManager.grantPermission('Bash', undefined, 'allow-once');
      }
      if (features.allowFileCreation) {
        await permissionManager.grantPermission('Write', '/app/data/**', 'allow-always');
      }

      // Verify updated permissions
      expect(await presetManager.getEffectivePermissionLevel('Edit', '/app/config/app.json')).toBe('deny');
      expect(await presetManager.getEffectivePermissionLevel('Bash')).toBe('deny'); // Still falls back to preset
      expect(await presetManager.getEffectivePermissionLevel('Write', '/app/data/output.txt')).toBe('allow-always');
    });
  });
});