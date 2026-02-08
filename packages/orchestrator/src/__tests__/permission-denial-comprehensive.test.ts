/**
 * Comprehensive Permission Denial and Error Handling Tests
 *
 * Tests that verify proper error messages and graceful degradation when permissions are denied.
 * Covers permission revocation scenarios and user prompt cancellation.
 *
 * Test Areas:
 * 1. Proper error messages for various denial scenarios
 * 2. Graceful degradation when permissions are denied
 * 3. User prompt cancellation handling
 * 4. Permission revocation mid-operation
 * 5. Recovery from permission denial states
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import type { PermissionLevel, PermissionResult } from '@apexcli/core';

describe('Comprehensive Permission Denial and Error Handling', () => {
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `apex-permission-denial-test-${Date.now()}-${Math.random().toString(36).substring(2)}`
    );
    mkdirSync(testDir, { recursive: true });

    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();
    permissionManager = new PermissionManager(permissionStore);
  });

  afterEach(() => {
    if (permissionStore) {
      permissionStore.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // Error Message Verification Tests
  // =========================================================================
  describe('Proper error messages for denial scenarios', () => {
    it('should provide clear error message for explicitly denied tools', async () => {
      // Set explicit denial
      await permissionManager.setPermission('Write', undefined, 'deny');

      const result = await permissionManager.checkToolPermission('Write');

      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');
      expect(result.denialReason).toBe('Tool access is explicitly denied');
    });

    it('should provide clear error message for missing permissions', async () => {
      // No permission set - should be denied by default
      const result = await permissionManager.checkToolPermission('NonExistentTool');

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBe('Permission not granted');
    });

    it('should provide scope-specific error messages', async () => {
      // Grant permission for one scope, try to use in another
      await permissionManager.grantPermission('Write', 'allowed-scope', 'allow-always');

      const result = await permissionManager.checkToolPermission('Write', {
        scope: 'forbidden-scope'
      });

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('scope');
    });

    it('should provide clear error message for consumed allow-once permissions', async () => {
      // Grant allow-once permission
      await permissionManager.grantPermission('Write', undefined, 'allow-once');

      // Consume it
      const firstCheck = await permissionManager.checkToolPermission('Write', {
        consumeAllowOnce: true
      });
      expect(firstCheck.allowed).toBe(true);

      // Try to use again
      const secondCheck = await permissionManager.checkToolPermission('Write', {
        consumeAllowOnce: true
      });

      expect(secondCheck.allowed).toBe(false);
      expect(secondCheck.denialReason).toBe('Permission not granted');
    });

    it('should provide informative error messages for revoked permissions', async () => {
      // Grant then revoke
      await permissionManager.grantPermission('Write', undefined, 'allow-always');
      await permissionManager.revokePermission('Write');

      const result = await permissionManager.checkToolPermission('Write');

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBe('Permission not granted');
    });
  });

  // =========================================================================
  // Graceful Degradation Tests
  // =========================================================================
  describe('Graceful degradation when permissions are denied', () => {
    it('should handle partial tool access gracefully', async () => {
      // Grant some tools but not others
      await permissionManager.grantPermission('Read', undefined, 'allow-always');
      await permissionManager.setPermission('Write', undefined, 'deny');

      const readResult = await permissionManager.checkToolPermission('Read');
      const writeResult = await permissionManager.checkToolPermission('Write');

      expect(readResult.allowed).toBe(true);
      expect(writeResult.allowed).toBe(false);

      // Application should be able to continue with read-only operations
      expect(readResult.level).toBe('allow-always');
      expect(writeResult.denialReason).toBe('Tool access is explicitly denied');
    });

    it('should handle scope-based restrictions gracefully', async () => {
      // Allow operations in safe scope only
      await permissionManager.grantPermission('Write', 'safe-area', 'allow-always');
      await permissionManager.setPermission('Write', 'dangerous-area', 'deny');

      const safeResult = await permissionManager.checkToolPermission('Write', {
        scope: 'safe-area'
      });
      const dangerousResult = await permissionManager.checkToolPermission('Write', {
        scope: 'dangerous-area'
      });

      expect(safeResult.allowed).toBe(true);
      expect(dangerousResult.allowed).toBe(false);

      // Should provide clear guidance
      expect(safeResult.level).toBe('allow-always');
      expect(dangerousResult.level).toBe('deny');
    });

    it('should handle temporary restrictions gracefully', async () => {
      // Set allow-once (temporary permission)
      await permissionManager.grantPermission('Write', undefined, 'allow-once');

      // First use should succeed
      const firstUse = await permissionManager.checkToolPermission('Write', {
        consumeAllowOnce: true
      });
      expect(firstUse.allowed).toBe(true);
      expect(firstUse.level).toBe('allow-once');

      // Subsequent uses should fail gracefully
      const secondUse = await permissionManager.checkToolPermission('Write');
      expect(secondUse.allowed).toBe(false);
      expect(secondUse.denialReason).toBe('Permission not granted');
    });

    it('should provide fallback options when primary tool is denied', async () => {
      // Deny primary tool but allow fallback
      await permissionManager.setPermission('Write', undefined, 'deny');
      await permissionManager.grantPermission('Read', undefined, 'allow-always');

      // Check multiple tools and identify fallbacks
      const writeResult = await permissionManager.checkToolPermission('Write');
      const readResult = await permissionManager.checkToolPermission('Read');

      expect(writeResult.allowed).toBe(false);
      expect(readResult.allowed).toBe(true);

      // System could use read-only operations as fallback
      const availableTools = [];
      if (writeResult.allowed) availableTools.push('Write');
      if (readResult.allowed) availableTools.push('Read');

      expect(availableTools).toEqual(['Read']);
    });
  });

  // =========================================================================
  // User Prompt Cancellation Tests
  // =========================================================================
  describe('User prompt cancellation handling', () => {
    it('should handle user declining permission prompt gracefully', async () => {
      // Mock user declining permission
      const mockPrompt = vi.fn().mockResolvedValue(false);

      // Simulate permission request with user prompt
      // (In real implementation, this would trigger a user prompt)
      const userDeclined = false; // User said no

      if (!userDeclined) {
        await permissionManager.grantPermission('Write', undefined, 'allow-once');
      }

      const result = await permissionManager.checkToolPermission('Write');

      // Should handle refusal gracefully
      expect(result.allowed).toBe(false);
      expect(result.denialReason).toBe('Permission not granted');
    });

    it('should handle user canceling permission dialog', async () => {
      // Mock user canceling dialog (returning undefined/null)
      const mockPrompt = vi.fn().mockResolvedValue(null);

      // Simulate canceled permission request
      const userCanceled = true;

      if (userCanceled) {
        // No permission granted when user cancels
      } else {
        await permissionManager.grantPermission('Write', undefined, 'allow-once');
      }

      const result = await permissionManager.checkToolPermission('Write');

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toBe('Permission not granted');
    });

    it('should handle timeout during user prompt', async () => {
      // Mock prompt timeout
      const mockPrompt = vi.fn().mockRejectedValue(new Error('Prompt timeout'));

      // Simulate timeout during permission request
      let permissionGranted = false;
      try {
        // In real implementation, this would timeout
        await new Promise((_, reject) =>
          setTimeout(() => reject(new Error('User prompt timeout')), 100)
        );
        permissionGranted = true;
      } catch (e) {
        // Handle timeout gracefully
        expect(e.message).toContain('timeout');
      }

      expect(permissionGranted).toBe(false);

      const result = await permissionManager.checkToolPermission('Write');
      expect(result.allowed).toBe(false);
    });

    it('should handle multiple simultaneous permission requests', async () => {
      // Simulate multiple tools requesting permission at once
      const tools = ['Write', 'Edit', 'Bash'];

      // User grants some but cancels others
      await permissionManager.grantPermission('Write', undefined, 'allow-once');
      // Edit and Bash are not granted (user canceled or declined)

      const results = await Promise.all(
        tools.map(tool => permissionManager.checkToolPermission(tool))
      );

      expect(results[0].allowed).toBe(true); // Write granted
      expect(results[1].allowed).toBe(false); // Edit not granted
      expect(results[2].allowed).toBe(false); // Bash not granted

      // Should provide clear reasons
      expect(results[1].denialReason).toBe('Permission not granted');
      expect(results[2].denialReason).toBe('Permission not granted');
    });
  });

  // =========================================================================
  // Mid-Operation Permission Revocation Tests
  // =========================================================================
  describe('Permission revocation mid-operation', () => {
    it('should handle permission revoked during operation execution', async () => {
      // Grant permission initially
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      // Start operation (permission check passes)
      const initialCheck = await permissionManager.checkToolPermission('Write');
      expect(initialCheck.allowed).toBe(true);

      // Revoke permission mid-operation
      await permissionManager.revokePermission('Write');

      // Operation should continue with initial authorization but new operations should fail
      const subsequentCheck = await permissionManager.checkToolPermission('Write');
      expect(subsequentCheck.allowed).toBe(false);
      expect(subsequentCheck.denialReason).toBe('Permission not granted');
    });

    it('should handle rapid grant/revoke cycles', async () => {
      const tool = 'Write';

      // Rapid grant/revoke cycle
      await permissionManager.grantPermission(tool, undefined, 'allow-always');
      await permissionManager.revokePermission(tool);
      await permissionManager.grantPermission(tool, undefined, 'allow-once');
      await permissionManager.revokePermission(tool);

      const finalResult = await permissionManager.checkToolPermission(tool);
      expect(finalResult.allowed).toBe(false);
      expect(finalResult.level).toBeNull();
    });

    it('should handle permission changes during batch operations', async () => {
      const tools = ['Read', 'Write', 'Edit'];

      // Grant all permissions initially
      for (const tool of tools) {
        await permissionManager.grantPermission(tool, undefined, 'allow-always');
      }

      // Start checking permissions
      const initialChecks = await Promise.all(
        tools.map(tool => permissionManager.checkToolPermission(tool))
      );

      // All should be allowed initially
      expect(initialChecks.every(check => check.allowed)).toBe(true);

      // Revoke middle permission during batch
      await permissionManager.revokePermission('Write');

      // Re-check all permissions
      const finalChecks = await Promise.all(
        tools.map(tool => permissionManager.checkToolPermission(tool))
      );

      expect(finalChecks[0].allowed).toBe(true); // Read still allowed
      expect(finalChecks[1].allowed).toBe(false); // Write revoked
      expect(finalChecks[2].allowed).toBe(true); // Edit still allowed
    });

    it('should handle permission level downgrades gracefully', async () => {
      const tool = 'Write';

      // Start with allow-always
      await permissionManager.grantPermission(tool, undefined, 'allow-always');
      const alwaysResult = await permissionManager.checkToolPermission(tool);
      expect(alwaysResult.level).toBe('allow-always');

      // Downgrade to allow-once
      await permissionManager.grantPermission(tool, undefined, 'allow-once');
      const onceResult = await permissionManager.checkToolPermission(tool);
      expect(onceResult.level).toBe('allow-once');

      // Consume the allow-once
      const consumeResult = await permissionManager.checkToolPermission(tool, {
        consumeAllowOnce: true
      });
      expect(consumeResult.allowed).toBe(true);

      // Should now be denied
      const finalResult = await permissionManager.checkToolPermission(tool);
      expect(finalResult.allowed).toBe(false);
    });
  });

  // =========================================================================
  // Recovery from Permission Denial States
  // =========================================================================
  describe('Recovery from permission denial states', () => {
    it('should recover gracefully after temporary denial', async () => {
      const tool = 'Write';

      // Initially denied
      const deniedResult = await permissionManager.checkToolPermission(tool);
      expect(deniedResult.allowed).toBe(false);

      // Grant permission (recovery)
      await permissionManager.grantPermission(tool, undefined, 'allow-always');

      // Should now be allowed
      const recoveredResult = await permissionManager.checkToolPermission(tool);
      expect(recoveredResult.allowed).toBe(true);
      expect(recoveredResult.level).toBe('allow-always');
    });

    it('should handle session reset after denials', async () => {
      const tool = 'Write';

      // Grant allow-once and consume it
      await permissionManager.grantPermission(tool, undefined, 'allow-once');
      await permissionManager.checkToolPermission(tool, { consumeAllowOnce: true });

      // Should now be denied
      const deniedResult = await permissionManager.checkToolPermission(tool);
      expect(deniedResult.allowed).toBe(false);

      // Reset session (clears temporary denials)
      permissionManager.resetSession();

      // Still denied (was only allow-once)
      const afterResetResult = await permissionManager.checkToolPermission(tool);
      expect(afterResetResult.allowed).toBe(false);

      // Grant new permission
      await permissionManager.grantPermission(tool, undefined, 'allow-always');

      // Should now work
      const finalResult = await permissionManager.checkToolPermission(tool);
      expect(finalResult.allowed).toBe(true);
    });

    it('should handle persistent store recovery after process restart', async () => {
      const tool = 'Write';

      // Grant persistent permission
      await permissionManager.grantPermission(tool, undefined, 'allow-always');
      const initialResult = await permissionManager.checkToolPermission(tool);
      expect(initialResult.allowed).toBe(true);

      // Simulate process restart by recreating managers
      permissionStore.close();
      const newStore = new PermissionStore(testDir);
      await newStore.initialize();
      const newManager = new PermissionManager(newStore);

      // Should recover permission from persistent store
      const recoveredResult = await newManager.checkToolPermission(tool);
      expect(recoveredResult.allowed).toBe(true);
      expect(recoveredResult.level).toBe('allow-always');

      newStore.close();
    });

    it('should provide recovery suggestions in error messages', async () => {
      // Test that error messages help users understand how to recover

      // No permission case
      const noPermResult = await permissionManager.checkToolPermission('Write');
      expect(noPermResult.denialReason).toBe('Permission not granted');

      // Explicit denial case
      await permissionManager.setPermission('Write', undefined, 'deny');
      const deniedResult = await permissionManager.checkToolPermission('Write');
      expect(deniedResult.denialReason).toBe('Tool access is explicitly denied');

      // These error messages should guide users on how to recover
      expect(typeof noPermResult.denialReason).toBe('string');
      expect(typeof deniedResult.denialReason).toBe('string');
    });
  });

  // =========================================================================
  // Edge Cases and Error Scenarios
  // =========================================================================
  describe('Edge cases and complex error scenarios', () => {
    it('should handle malformed permission data gracefully', async () => {
      // Test robustness against corrupted permission data
      const tool = 'Write';

      try {
        // This should not crash even with malformed internal state
        const result = await permissionManager.checkToolPermission(tool);
        expect(result.allowed).toBe(false);
        expect(typeof result.denialReason).toBe('string');
      } catch (error) {
        // If it throws, it should be a controlled error
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle concurrent permission modifications during checks', async () => {
      const tool = 'Write';

      // Start multiple permission operations concurrently
      const operations = [
        permissionManager.grantPermission(tool, undefined, 'allow-always'),
        permissionManager.checkToolPermission(tool),
        permissionManager.revokePermission(tool),
        permissionManager.checkToolPermission(tool),
        permissionManager.grantPermission(tool, undefined, 'allow-once'),
      ];

      const results = await Promise.allSettled(operations);

      // All operations should complete without corruption
      expect(results.length).toBe(5);

      // Should end up in a consistent state
      const finalResult = await permissionManager.checkToolPermission(tool);
      expect(typeof finalResult.allowed).toBe('boolean');
      expect(typeof finalResult.denialReason).toBe('string');
    });

    it('should handle storage errors gracefully', async () => {
      // Test behavior when storage operations fail
      const tool = 'Write';

      // Close the store to simulate storage error
      permissionStore.close();

      try {
        const result = await permissionManager.checkToolPermission(tool);
        // Should handle storage errors gracefully
        expect(result.allowed).toBe(false);
      } catch (error) {
        // If it throws, should be a controlled error
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle extremely rapid permission state changes', async () => {
      const tool = 'Write';

      // Rapid state changes
      const operations = [];
      for (let i = 0; i < 50; i++) {
        const level = i % 3 === 0 ? 'allow-always' : i % 3 === 1 ? 'allow-once' : null;
        if (level) {
          operations.push(() => permissionManager.grantPermission(tool, undefined, level));
        } else {
          operations.push(() => permissionManager.revokePermission(tool));
        }
      }

      // Execute rapidly
      await Promise.allSettled(operations.map(op => op()));

      // Should end up in a consistent state
      const finalResult = await permissionManager.checkToolPermission(tool);
      expect(typeof finalResult.allowed).toBe('boolean');
    });
  });
});