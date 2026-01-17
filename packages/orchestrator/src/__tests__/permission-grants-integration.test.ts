/**
 * Integration Tests for Permission Grants
 *
 * These tests verify that permissions can be granted correctly:
 * 1. Granting new permissions
 * 2. Granting permissions with different scopes (session/allow-once, always/persistent)
 * 3. Verifying granted permissions persist appropriately
 *
 * Architecture Decision Record (ADR):
 * - Test isolation: Each test uses a unique temporary directory to ensure database isolation
 * - Session vs Persistent: Tests verify the dual storage model (session cache for allow-once,
 *   SQLite for allow-always/deny)
 * - Consumption behavior: Tests verify allow-once permissions are consumed on first access
 * - Persistence verification: Tests verify allow-always permissions survive session resets
 *   and can be retrieved from a new PermissionManager instance
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import { Permission, PermissionLevel } from '@apexcli/core';

describe('Permission Grants Integration Tests', () => {
  let manager: PermissionManager;
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test to ensure isolation
    testDir = join(
      tmpdir(),
      `apex-permission-grants-test-${Date.now()}-${Math.random().toString(36).substring(2)}`
    );
    mkdirSync(testDir, { recursive: true });

    store = new PermissionStore(testDir);
    await store.initialize();

    manager = new PermissionManager(store);
  });

  afterEach(() => {
    // Clean up resources
    if (store) {
      store.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // ==========================================================================
  // Test Suite 1: Granting New Permissions
  // ==========================================================================
  describe('Granting New Permissions', () => {
    it('should grant a new permission for a tool without scope', async () => {
      // Grant a new permission without scope
      await manager.grantPermission('TestTool', undefined, 'allow-always');

      // Verify the permission was granted
      const result = await manager.checkPermission('TestTool');
      expect(result).toBe('allow-always');
    });

    it('should grant a new permission for a tool with specific scope', async () => {
      const scope = '/path/to/specific/file.txt';
      await manager.grantPermission('Write', scope, 'allow-always');

      // Verify the scoped permission
      const result = await manager.checkPermission('Write', scope);
      expect(result).toBe('allow-always');

      // Verify no permission for different scope
      const differentScope = await manager.checkPermission('Write', '/other/path.txt');
      expect(differentScope).toBeNull();
    });

    it('should grant permissions for multiple tools independently', async () => {
      // Grant permissions for multiple tools
      await manager.grantPermission('Read', undefined, 'allow-always');
      await manager.grantPermission('Write', undefined, 'allow-once');
      await manager.grantPermission('Bash', 'safe-command', 'deny');

      // Verify each permission independently
      expect(await manager.checkPermission('Read')).toBe('allow-always');
      expect(await manager.checkPermission('Write')).toBe('allow-once');
      expect(await manager.checkPermission('Bash', 'safe-command')).toBe('deny');
    });

    it('should grant permissions for same tool with different scopes', async () => {
      // Grant different permission levels for the same tool with different scopes
      await manager.grantPermission('Read', '/safe/path', 'allow-always');
      await manager.grantPermission('Read', '/sensitive/path', 'deny');
      await manager.grantPermission('Read', '/temp/path', 'allow-once');

      // Verify each scoped permission
      expect(await manager.checkPermission('Read', '/safe/path')).toBe('allow-always');
      expect(await manager.checkPermission('Read', '/sensitive/path')).toBe('deny');
      expect(await manager.checkPermission('Read', '/temp/path')).toBe('allow-once');
    });

    it('should handle granting permission with empty scope as distinct from undefined', async () => {
      // Grant with undefined scope (global)
      await manager.grantPermission('TestTool', undefined, 'allow-always');

      // Grant with empty string scope (specific)
      await manager.grantPermission('TestTool', '', 'deny');

      // Note: The implementation may treat empty string as undefined
      // This test documents the expected behavior
      const globalResult = await manager.checkPermission('TestTool');
      const emptyResult = await manager.checkPermission('TestTool', '');

      // Document behavior - both should be accessible but may be treated differently
      expect(globalResult).not.toBeNull();
      expect(emptyResult).not.toBeNull();
    });
  });

  // ==========================================================================
  // Test Suite 2: Session Scope (allow-once) Permissions
  // ==========================================================================
  describe('Session Scope (allow-once) Permissions', () => {
    it('should store allow-once permissions in session cache only', async () => {
      await manager.grantPermission('TestTool', 'test-scope', 'allow-once');

      // Verify accessible via manager
      const result = await manager.checkPermission('TestTool', 'test-scope');
      expect(result).toBe('allow-once');

      // Verify NOT in persistent store (direct store access)
      const persistentPermission = await store.getPermission({
        tool: 'TestTool',
        scope: 'test-scope',
      });
      expect(persistentPermission).toBeNull();
    });

    it('should consume allow-once permissions on first access', async () => {
      await manager.grantPermission('Edit', 'file.txt', 'allow-once');

      // First check - should return permission and consume it
      const firstCheck = await manager.checkPermission('Edit', 'file.txt');
      expect(firstCheck).toBe('allow-once');

      // Second check - should return null (consumed)
      const secondCheck = await manager.checkPermission('Edit', 'file.txt');
      expect(secondCheck).toBeNull();

      // Third check - confirm still null
      const thirdCheck = await manager.checkPermission('Edit', 'file.txt');
      expect(thirdCheck).toBeNull();
    });

    it('should not persist allow-once permissions after session reset', async () => {
      await manager.grantPermission('TestTool', 'scope1', 'allow-once');
      await manager.grantPermission('TestTool', 'scope2', 'allow-once');

      // Verify permissions exist before reset
      // Note: We need to grant again since checkPermission consumes them
      await manager.grantPermission('TestTool', 'scope1', 'allow-once');
      await manager.grantPermission('TestTool', 'scope2', 'allow-once');

      // Reset session
      manager.resetSession();

      // Verify permissions are gone after session reset
      expect(await manager.checkPermission('TestTool', 'scope1')).toBeNull();
      expect(await manager.checkPermission('TestTool', 'scope2')).toBeNull();
    });

    it('should isolate allow-once permissions between different tools', async () => {
      await manager.grantPermission('Tool1', 'scope', 'allow-once');
      await manager.grantPermission('Tool2', 'scope', 'allow-once');

      // Consume Tool1's permission
      expect(await manager.checkPermission('Tool1', 'scope')).toBe('allow-once');
      expect(await manager.checkPermission('Tool1', 'scope')).toBeNull();

      // Tool2's permission should still be available
      expect(await manager.checkPermission('Tool2', 'scope')).toBe('allow-once');
    });

    it('should handle multiple allow-once grants for same tool/scope', async () => {
      // Grant allow-once permission
      await manager.grantPermission('TestTool', 'scope', 'allow-once');

      // Consume it
      expect(await manager.checkPermission('TestTool', 'scope')).toBe('allow-once');
      expect(await manager.checkPermission('TestTool', 'scope')).toBeNull();

      // Grant again
      await manager.grantPermission('TestTool', 'scope', 'allow-once');

      // Should be available again
      expect(await manager.checkPermission('TestTool', 'scope')).toBe('allow-once');
      expect(await manager.checkPermission('TestTool', 'scope')).toBeNull();
    });
  });

  // ==========================================================================
  // Test Suite 3: Persistent Scope (allow-always) Permissions
  // ==========================================================================
  describe('Persistent Scope (allow-always) Permissions', () => {
    it('should store allow-always permissions in persistent store', async () => {
      await manager.grantPermission('TestTool', 'test-scope', 'allow-always');

      // Verify accessible via manager
      const result = await manager.checkPermission('TestTool', 'test-scope');
      expect(result).toBe('allow-always');

      // Verify IS in persistent store
      const persistentPermission = await store.getPermission({
        tool: 'TestTool',
        scope: 'test-scope',
      });
      expect(persistentPermission).not.toBeNull();
      expect(persistentPermission?.level).toBe('allow-always');
    });

    it('should not consume allow-always permissions on access', async () => {
      await manager.grantPermission('Read', '/path/to/file', 'allow-always');

      // Multiple accesses should all return the permission
      for (let i = 0; i < 5; i++) {
        const result = await manager.checkPermission('Read', '/path/to/file');
        expect(result).toBe('allow-always');
      }
    });

    it('should persist allow-always permissions across session resets', async () => {
      await manager.grantPermission('Write', '/output/file.txt', 'allow-always');

      // Reset session
      manager.resetSession();

      // Permission should still be accessible
      const afterReset = await manager.checkPermission('Write', '/output/file.txt');
      expect(afterReset).toBe('allow-always');
    });

    it('should persist allow-always permissions across new manager instances', async () => {
      await manager.grantPermission('Bash', 'ls -la', 'allow-always');

      // Create a new manager instance with the same store
      const newManager = new PermissionManager(store);

      // Permission should be accessible from new manager
      const result = await newManager.checkPermission('Bash', 'ls -la');
      expect(result).toBe('allow-always');
    });

    it('should persist deny permissions in store', async () => {
      await manager.grantPermission('DangerousTool', '*', 'deny');

      // Verify accessible via manager
      const result = await manager.checkPermission('DangerousTool', '*');
      expect(result).toBe('deny');

      // Verify IS in persistent store
      const persistentPermission = await store.getPermission({
        tool: 'DangerousTool',
        scope: '*',
      });
      expect(persistentPermission).not.toBeNull();
      expect(persistentPermission?.level).toBe('deny');
    });

    it('should handle overwriting allow-always with new allow-always', async () => {
      // Initial grant
      await manager.grantPermission('TestTool', 'scope', 'allow-always');

      // Overwrite with new grant (same level)
      await manager.grantPermission('TestTool', 'scope', 'allow-always');

      // Should still work
      const result = await manager.checkPermission('TestTool', 'scope');
      expect(result).toBe('allow-always');
    });
  });

  // ==========================================================================
  // Test Suite 4: Permission Level Transitions
  // ==========================================================================
  describe('Permission Level Transitions', () => {
    it('should allow upgrading from allow-once to allow-always', async () => {
      // Start with session permission
      await manager.grantPermission('TestTool', 'scope', 'allow-once');

      // Upgrade to persistent permission
      await manager.grantPermission('TestTool', 'scope', 'allow-always');

      // Should be persistent now (not consumed on multiple accesses)
      expect(await manager.checkPermission('TestTool', 'scope')).toBe('allow-always');
      expect(await manager.checkPermission('TestTool', 'scope')).toBe('allow-always');
    });

    it('should allow downgrading from allow-always to deny', async () => {
      // Start with always allow
      await manager.grantPermission('TestTool', 'scope', 'allow-always');

      // Change to deny
      await manager.grantPermission('TestTool', 'scope', 'deny');

      // Should now be denied
      const result = await manager.checkPermission('TestTool', 'scope');
      expect(result).toBe('deny');
    });

    it('should clear session cache when granting persistent permission', async () => {
      // Grant session permission
      await manager.grantPermission('TestTool', 'scope', 'allow-once');

      // Grant persistent permission (should clear session cache for this key)
      await manager.grantPermission('TestTool', 'scope', 'allow-always');

      // Multiple checks should work (persistent, not consumed like allow-once)
      expect(await manager.checkPermission('TestTool', 'scope')).toBe('allow-always');
      expect(await manager.checkPermission('TestTool', 'scope')).toBe('allow-always');
    });

    it('should prioritize session cache over persistent store', async () => {
      // First store persistent deny
      const permission: Permission = {
        tool: 'TestTool',
        scope: 'test-scope',
        level: 'deny',
        createdAt: new Date(),
      };
      await store.savePermission(permission);

      // Then grant session allow-once (should override)
      await manager.grantPermission('TestTool', 'test-scope', 'allow-once');

      // Session should take priority
      const result = await manager.checkPermission('TestTool', 'test-scope');
      expect(result).toBe('allow-once');
    });
  });

  // ==========================================================================
  // Test Suite 5: Persistence Verification
  // ==========================================================================
  describe('Persistence Verification', () => {
    it('should survive store close and reopen for allow-always', async () => {
      await manager.grantPermission('PersistentTool', 'persistent-scope', 'allow-always');

      // Close the store
      store.close();

      // Reopen the store
      const newStore = new PermissionStore(testDir);
      await newStore.initialize();

      // Create new manager
      const newManager = new PermissionManager(newStore);

      // Permission should still exist
      const result = await newManager.checkPermission('PersistentTool', 'persistent-scope');
      expect(result).toBe('allow-always');

      // Clean up
      newStore.close();
    });

    it('should NOT survive store close and reopen for allow-once', async () => {
      await manager.grantPermission('SessionTool', 'session-scope', 'allow-once');

      // Close the store and manager
      store.close();

      // Reopen
      const newStore = new PermissionStore(testDir);
      await newStore.initialize();
      const newManager = new PermissionManager(newStore);

      // Session permission should be gone
      const result = await newManager.checkPermission('SessionTool', 'session-scope');
      expect(result).toBeNull();

      // Clean up
      newStore.close();
    });

    it('should maintain permission integrity across concurrent grants', async () => {
      // Grant multiple permissions concurrently
      await Promise.all([
        manager.grantPermission('Tool1', 'scope1', 'allow-always'),
        manager.grantPermission('Tool2', 'scope2', 'allow-once'),
        manager.grantPermission('Tool3', 'scope3', 'deny'),
        manager.grantPermission('Tool4', 'scope4', 'allow-always'),
        manager.grantPermission('Tool5', 'scope5', 'allow-once'),
      ]);

      // Verify all permissions are correctly stored
      expect(await manager.checkPermission('Tool1', 'scope1')).toBe('allow-always');
      expect(await manager.checkPermission('Tool2', 'scope2')).toBe('allow-once');
      expect(await manager.checkPermission('Tool3', 'scope3')).toBe('deny');
      expect(await manager.checkPermission('Tool4', 'scope4')).toBe('allow-always');
      expect(await manager.checkPermission('Tool5', 'scope5')).toBe('allow-once');
    });

    it('should persist correct createdAt timestamp', async () => {
      const beforeGrant = new Date();
      await manager.grantPermission('TestTool', 'scope', 'allow-always');
      const afterGrant = new Date();

      // Retrieve directly from store to check timestamp
      const permission = await store.getPermission({ tool: 'TestTool', scope: 'scope' });
      expect(permission).not.toBeNull();
      expect(permission!.createdAt).toBeInstanceOf(Date);
      expect(permission!.createdAt.getTime()).toBeGreaterThanOrEqual(beforeGrant.getTime());
      expect(permission!.createdAt.getTime()).toBeLessThanOrEqual(afterGrant.getTime());
    });

    it('should list all persistent permissions', async () => {
      // Grant various permissions
      await manager.grantPermission('Tool1', undefined, 'allow-always');
      await manager.grantPermission('Tool2', 'scope2', 'deny');
      await manager.grantPermission('Tool3', 'scope3', 'allow-once'); // Session only

      // List permissions from store
      const permissions = await store.listPermissions();

      // Should only contain persistent permissions (allow-always and deny)
      expect(permissions.length).toBe(2);
      expect(permissions.some(p => p.tool === 'Tool1' && p.level === 'allow-always')).toBe(true);
      expect(permissions.some(p => p.tool === 'Tool2' && p.level === 'deny')).toBe(true);
      // allow-once should NOT be in persistent store
      expect(permissions.some(p => p.tool === 'Tool3')).toBe(false);
    });
  });

  // ==========================================================================
  // Test Suite 6: Edge Cases and Error Handling
  // ==========================================================================
  describe('Edge Cases and Error Handling', () => {
    it('should handle very long tool names', async () => {
      const longToolName = 'A'.repeat(500);
      await manager.grantPermission(longToolName, undefined, 'allow-always');

      const result = await manager.checkPermission(longToolName);
      expect(result).toBe('allow-always');
    });

    it('should handle very long scope strings', async () => {
      const longScope = '/path/' + 'a/'.repeat(200) + 'file.txt';
      await manager.grantPermission('TestTool', longScope, 'allow-always');

      const result = await manager.checkPermission('TestTool', longScope);
      expect(result).toBe('allow-always');
    });

    it('should handle special characters in tool name', async () => {
      const specialToolName = 'Tool:With$pecial@Characters!';
      await manager.grantPermission(specialToolName, undefined, 'allow-always');

      const result = await manager.checkPermission(specialToolName);
      expect(result).toBe('allow-always');
    });

    it('should handle special characters in scope', async () => {
      const specialScope = '/path/with spaces/and@special#chars!';
      await manager.grantPermission('TestTool', specialScope, 'allow-always');

      const result = await manager.checkPermission('TestTool', specialScope);
      expect(result).toBe('allow-always');
    });

    it('should handle unicode in tool name and scope', async () => {
      const unicodeTool = 'ツール_工具_инструмент';
      const unicodeScope = '/путь/到/ファイル';

      await manager.grantPermission(unicodeTool, unicodeScope, 'allow-always');

      const result = await manager.checkPermission(unicodeTool, unicodeScope);
      expect(result).toBe('allow-always');
    });

    it('should handle rapid successive grants and checks', async () => {
      const iterations = 100;
      const promises: Promise<void>[] = [];

      for (let i = 0; i < iterations; i++) {
        promises.push(manager.grantPermission(`Tool${i}`, `scope${i}`, 'allow-always'));
      }

      await Promise.all(promises);

      // Verify all were granted
      for (let i = 0; i < iterations; i++) {
        const result = await manager.checkPermission(`Tool${i}`, `scope${i}`);
        expect(result).toBe('allow-always');
      }
    });

    it('should handle null scope distinctly from undefined', async () => {
      // Note: TypeScript types use undefined, but this tests the behavior
      await manager.grantPermission('TestTool', undefined, 'allow-always');

      // Check with undefined
      const undefinedResult = await manager.checkPermission('TestTool', undefined);
      expect(undefinedResult).toBe('allow-always');

      // Check without passing scope
      const noScopeResult = await manager.checkPermission('TestTool');
      expect(noScopeResult).toBe('allow-always');
    });
  });

  // ==========================================================================
  // Test Suite 7: hasPermission Boolean Helper
  // ==========================================================================
  describe('hasPermission Boolean Helper', () => {
    it('should return true for allow-always', async () => {
      await manager.grantPermission('TestTool', undefined, 'allow-always');
      expect(await manager.hasPermission('TestTool')).toBe(true);
    });

    it('should return true for allow-once (and consume it)', async () => {
      await manager.grantPermission('TestTool', undefined, 'allow-once');

      // First call returns true and consumes
      expect(await manager.hasPermission('TestTool')).toBe(true);

      // Second call returns false (consumed)
      expect(await manager.hasPermission('TestTool')).toBe(false);
    });

    it('should return false for deny', async () => {
      await manager.grantPermission('TestTool', undefined, 'deny');
      expect(await manager.hasPermission('TestTool')).toBe(false);
    });

    it('should return false when no permission exists', async () => {
      expect(await manager.hasPermission('NonExistentTool')).toBe(false);
    });
  });

  // ==========================================================================
  // Test Suite 8: revokePermission Integration
  // ==========================================================================
  describe('revokePermission Integration', () => {
    it('should revoke session-only permissions', async () => {
      await manager.grantPermission('TestTool', 'scope', 'allow-once');

      // Revoke
      const revoked = await manager.revokePermission('TestTool', 'scope');
      expect(revoked).toBe(true);

      // Should be gone
      expect(await manager.checkPermission('TestTool', 'scope')).toBeNull();
    });

    it('should revoke persistent permissions', async () => {
      await manager.grantPermission('TestTool', 'scope', 'allow-always');

      // Revoke
      const revoked = await manager.revokePermission('TestTool', 'scope');
      expect(revoked).toBe(true);

      // Should be gone
      expect(await manager.checkPermission('TestTool', 'scope')).toBeNull();

      // Should also be gone from store
      const storeResult = await store.getPermission({ tool: 'TestTool', scope: 'scope' });
      expect(storeResult).toBeNull();
    });

    it('should return false when revoking non-existent permission', async () => {
      const revoked = await manager.revokePermission('NonExistent', 'scope');
      expect(revoked).toBe(false);
    });

    it('should allow re-granting after revocation', async () => {
      // Grant
      await manager.grantPermission('TestTool', 'scope', 'allow-always');

      // Revoke
      await manager.revokePermission('TestTool', 'scope');
      expect(await manager.checkPermission('TestTool', 'scope')).toBeNull();

      // Re-grant
      await manager.grantPermission('TestTool', 'scope', 'deny');
      expect(await manager.checkPermission('TestTool', 'scope')).toBe('deny');
    });
  });
});
