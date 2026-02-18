/**
 * Category 3: Permission Denial Flow Scenarios Tests
 *
 * Verifies end-to-end permission denial behavior through PermissionManager
 * according to ADR-052.
 *
 * Test Groups:
 * 1. Explicit deny level
 * 2. No permission set (null level)
 * 3. Allow-once consumption and expiry
 * 4. Permission revocation
 * 5. Directory access denial
 * 6. Tool disabled via config
 * 7. Session reset behavior
 *
 * @see ADR-052-permission-denial-error-handling-tests.md
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PermissionManager } from '../permission-manager.js';
import { PermissionStore } from '../permission-store.js';
import type {
  Permission,
  PermissionLevel,
  ToolPermissionCheckOptions,
  ToolPermissionConfig,
  DirectoryAccessConfig
} from '@apexcli/core';

describe('Category 3: Permission Denial Flow Scenarios', () => {
  let tempDir: string;
  let store: PermissionStore;
  let manager: PermissionManager;

  beforeEach(async () => {
    // Create temp directory for SQLite database
    tempDir = await mkdtemp(join(tmpdir(), 'permission-test-'));
    const dbPath = join(tempDir, 'permissions.db');

    // Initialize PermissionStore and PermissionManager
    store = new PermissionStore(dbPath);
    await store.initialize();
    manager = new PermissionManager(store);
  });

  afterEach(async () => {
    await store.close();
    await rm(tempDir, { recursive: true });
  });

  describe('Group 1: Explicit deny level', () => {
    test('checkPermission() returns deny after grantPermission(tool, scope, deny)', async () => {
      const tool = 'Bash';
      const scope = '/dangerous/**';

      await manager.grantPermission(tool, scope, 'deny');
      const level = await manager.checkPermission(tool, scope);

      expect(level).toBe('deny');
    });

    test('hasPermission() returns false for denied tools', async () => {
      const tool = 'Write';
      const scope = '/system/**';

      await manager.grantPermission(tool, scope, 'deny');
      const hasPermission = await manager.hasPermission(tool, scope);

      expect(hasPermission).toBe(false);
    });

    test('checkToolPermission() returns denial result for denied tools', async () => {
      const tool = 'Bash';

      await manager.grantPermission(tool, undefined, 'deny');
      const result = await manager.checkToolPermission(tool);

      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');
      expect(result.denialReason).toBe('Tool access is explicitly denied');
      expect(result.requiresConfirmation).toBe(false);
    });

    test('deny permission overrides any tool configuration', async () => {
      const tool = 'Write';
      const config: ToolPermissionConfig = {
        enabled: true,
        timeout: 0,
        requireConfirmation: false,
        rateLimitPerMinute: 0
      };

      await manager.grantPermission(tool, undefined, 'deny');
      manager.setToolConfig(tool, config);

      const result = await manager.checkToolPermission(tool);

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toBe('Tool access is explicitly denied');
    });
  });

  describe('Group 2: No permission set (null level)', () => {
    test('checkPermission() returns null for unknown tools', async () => {
      const level = await manager.checkPermission('UnknownTool');
      expect(level).toBeNull();
    });

    test('checkToolPermission() with requireConfirmation config returns denial with confirmation flag', async () => {
      const tool = 'Bash';
      const config: ToolPermissionConfig = {
        enabled: true,
        timeout: 0,
        requireConfirmation: true,
        rateLimitPerMinute: 0
      };

      manager.setToolConfig(tool, config);
      const result = await manager.checkToolPermission(tool);

      expect(result.allowed).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.denialReason).toBe('Tool requires user confirmation before execution');
      expect(result.level).toBeNull();
    });

    test('default behavior (no config, no permission) allows access', async () => {
      const tool = 'Read';
      const result = await manager.checkToolPermission(tool);

      expect(result.allowed).toBe(true);
      expect(result.level).toBeNull();
      expect(result.requiresConfirmation).toBe(false);
      expect(result.denialReason).toBeUndefined();
    });

    test('hasPermission() returns false for unknown tools', async () => {
      const hasPermission = await manager.hasPermission('UnknownTool');
      expect(hasPermission).toBe(false);
    });
  });

  describe('Group 3: Allow-once consumption and expiry', () => {
    test('first checkPermission() returns allow-once and consumes it', async () => {
      const tool = 'Write';
      const scope = '/tmp/**';

      await manager.grantPermission(tool, scope, 'allow-once');

      // First check should return allow-once and consume it
      const firstCheck = await manager.checkPermission(tool, scope);
      expect(firstCheck).toBe('allow-once');

      // Second check should return null (consumed)
      const secondCheck = await manager.checkPermission(tool, scope);
      expect(secondCheck).toBeNull();
    });

    test('second checkPermission() for same tool/scope returns null (consumed)', async () => {
      const tool = 'Bash';

      await manager.grantPermission(tool, undefined, 'allow-once');

      // Consume the permission
      await manager.checkPermission(tool);

      // Should be null now
      const level = await manager.checkPermission(tool);
      expect(level).toBeNull();
    });

    test('hasPermission() returns false after consumption', async () => {
      const tool = 'Read';

      await manager.grantPermission(tool, undefined, 'allow-once');

      // Should have permission initially
      expect(await manager.hasPermission(tool)).toBe(true);

      // Consume it
      await manager.checkPermission(tool);

      // Should not have permission after consumption
      expect(await manager.hasPermission(tool)).toBe(false);
    });

    test('allow-once permissions are session-specific and not persisted after consumption', async () => {
      const tool = 'Grep';
      const scope = '/logs/**';

      await manager.grantPermission(tool, scope, 'allow-once');

      // Consume the permission
      await manager.checkPermission(tool, scope);

      // Reset session
      manager.resetSession();

      // Should not have the permission anymore
      const level = await manager.checkPermission(tool, scope);
      expect(level).toBeNull();
    });
  });

  describe('Group 4: Permission revocation', () => {
    test('revokePermission() removes from session cache', async () => {
      const tool = 'Write';

      await manager.grantPermission(tool, undefined, 'allow-once');

      // Should have permission
      expect(await manager.hasPermission(tool)).toBe(true);

      // Revoke permission
      const revoked = await manager.revokePermission(tool);
      expect(revoked).toBe(true);

      // Should not have permission after revocation
      expect(await manager.hasPermission(tool)).toBe(false);
    });

    test('revokePermission() removes from persistent store', async () => {
      const tool = 'Bash';
      const scope = '/scripts/**';

      await manager.grantPermission(tool, scope, 'allow-always');

      // Should have permission
      expect(await manager.hasPermission(tool, scope)).toBe(true);

      // Revoke permission
      const revoked = await manager.revokePermission(tool, scope);
      expect(revoked).toBe(true);

      // Should not have permission after revocation
      expect(await manager.hasPermission(tool, scope)).toBe(false);
    });

    test('revokePermission() returns true when permission existed, false when not', async () => {
      const tool = 'Read';

      // Revoke non-existent permission
      const firstRevoke = await manager.revokePermission(tool);
      expect(firstRevoke).toBe(false);

      // Grant permission
      await manager.grantPermission(tool, undefined, 'allow-always');

      // Revoke existing permission
      const secondRevoke = await manager.revokePermission(tool);
      expect(secondRevoke).toBe(true);

      // Try to revoke again
      const thirdRevoke = await manager.revokePermission(tool);
      expect(thirdRevoke).toBe(false);
    });

    test('after revocation, checkPermission() returns null', async () => {
      const tool = 'WebFetch';

      await manager.grantPermission(tool, undefined, 'allow-always');
      await manager.revokePermission(tool);

      const level = await manager.checkPermission(tool);
      expect(level).toBeNull();
    });

    test('after revocation, hasPermission() returns false', async () => {
      const tool = 'WebSearch';

      await manager.grantPermission(tool, undefined, 'allow-always');
      await manager.revokePermission(tool);

      const hasPermission = await manager.hasPermission(tool);
      expect(hasPermission).toBe(false);
    });
  });

  describe('Group 5: Directory access denial', () => {
    test('checkDirectoryAccess() with blocklist pattern denies matching paths', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: [],
        blocklist: ['/system/**', '/etc/**'],
        defaultAllow: true,
        resolveSymlinks: false,
        maxDepth: 0
      };

      // Set up directory access for a tool
      const tool = 'Read';
      const toolConfig: ToolPermissionConfig = {
        enabled: true,
        timeout: 0,
        requireConfirmation: false,
        rateLimitPerMinute: 0,
        directoryAccess: directoryConfig
      };

      manager.setToolConfig(tool, toolConfig);

      const result = await manager.checkDirectoryAccess('/system/password', { tool });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked');
      expect(result.matchedPattern).toBe('/system/**');
    });

    test('checkDirectoryAccess() with empty allowlist and defaultAllow: false denies all paths', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: [],
        blocklist: [],
        defaultAllow: false,
        resolveSymlinks: false,
        maxDepth: 0
      };

      const tool = 'Write';
      const toolConfig: ToolPermissionConfig = {
        enabled: true,
        timeout: 0,
        requireConfirmation: false,
        rateLimitPerMinute: 0,
        directoryAccess: directoryConfig
      };

      manager.setToolConfig(tool, toolConfig);

      const result = await manager.checkDirectoryAccess('/home/user/documents', { tool });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('denied');
    });

    test('checkToolPermission() with path validation failure overrides tool-level allow', async () => {
      const tool = 'Read';

      // Grant tool permission
      await manager.grantPermission(tool, undefined, 'allow-always');

      // Set restrictive directory access
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/safe/**'],
        blocklist: [],
        defaultAllow: false,
        resolveSymlinks: false,
        maxDepth: 0
      };

      const toolConfig: ToolPermissionConfig = {
        enabled: true,
        timeout: 0,
        requireConfirmation: false,
        rateLimitPerMinute: 0,
        directoryAccess: directoryConfig
      };

      manager.setToolConfig(tool, toolConfig);

      // Check permission with blocked path
      const result = await manager.checkToolPermission(tool, { path: '/dangerous/file.txt' });

      expect(result.allowed).toBe(false);
      expect(result.level).toBe('allow-always'); // Tool permission is still allow-always
      expect(result.denialReason).toContain('Directory access denied');
    });

    test('denial reason includes path-specific message', async () => {
      const tool = 'Write';
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: [],
        blocklist: ['/restricted/**'],
        defaultAllow: true,
        resolveSymlinks: false,
        maxDepth: 0
      };

      const toolConfig: ToolPermissionConfig = {
        enabled: true,
        timeout: 0,
        requireConfirmation: false,
        rateLimitPerMinute: 0,
        directoryAccess: directoryConfig
      };

      manager.setToolConfig(tool, toolConfig);

      const result = await manager.checkToolPermission(tool, { path: '/restricted/secrets.txt' });

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toMatch(/Directory access denied:/);
    });
  });

  describe('Group 6: Tool disabled via config', () => {
    test('checkToolPermission() returns denial for disabled tools', async () => {
      const tool = 'Bash';
      const config: ToolPermissionConfig = {
        enabled: false,
        timeout: 0,
        requireConfirmation: false,
        rateLimitPerMinute: 0
      };

      manager.setToolConfig(tool, config);

      const result = await manager.checkToolPermission(tool);

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toBe('Tool is disabled via configuration');
    });

    test('disabled config overrides allow-always permission', async () => {
      const tool = 'WebFetch';

      // Grant permission
      await manager.grantPermission(tool, undefined, 'allow-always');

      // Disable tool via config
      const config: ToolPermissionConfig = {
        enabled: false,
        timeout: 0,
        requireConfirmation: false,
        rateLimitPerMinute: 0
      };

      manager.setToolConfig(tool, config);

      const result = await manager.checkToolPermission(tool);

      expect(result.allowed).toBe(false);
      expect(result.level).toBe('allow-always'); // Permission level is still there
      expect(result.denialReason).toBe('Tool is disabled via configuration');
    });
  });

  describe('Group 7: Session reset behavior', () => {
    test('resetSession() clears session cache', async () => {
      const tool = 'Read';

      await manager.grantPermission(tool, undefined, 'allow-once');

      // Should have permission
      expect(await manager.hasPermission(tool)).toBe(true);

      // Reset session
      manager.resetSession();

      // Should not have permission after reset
      expect(await manager.hasPermission(tool)).toBe(false);
    });

    test('resetSession() clears directory access cache', async () => {
      const tool = 'Write';
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/allowed/**'],
        blocklist: [],
        defaultAllow: false,
        resolveSymlinks: false,
        maxDepth: 0
      };

      // Set directory access config for session
      manager.setToolConfig(tool, {
        enabled: true,
        timeout: 0,
        requireConfirmation: false,
        rateLimitPerMinute: 0,
        directoryAccess: directoryConfig
      });

      // Should have restrictive access
      const beforeReset = await manager.checkDirectoryAccess('/random/path', { tool });
      expect(beforeReset.allowed).toBe(false);

      // Reset session
      manager.resetSession();

      // Should have default permissive access after reset
      const afterReset = await manager.checkDirectoryAccess('/random/path', { tool });
      expect(afterReset.allowed).toBe(true); // Default allow-all when no config
    });

    test('resetSession() clears tool config cache', async () => {
      const tool = 'Bash';
      const config: ToolPermissionConfig = {
        enabled: false,
        timeout: 0,
        requireConfirmation: true,
        rateLimitPerMinute: 0
      };

      manager.setToolConfig(tool, config);

      // Should be disabled
      const beforeReset = await manager.checkToolPermission(tool);
      expect(beforeReset.allowed).toBe(false);

      // Reset session
      manager.resetSession();

      // Should have default behavior after reset
      const afterReset = await manager.checkToolPermission(tool);
      expect(afterReset.allowed).toBe(true); // Default allow when no config/permission
    });

    test('after reset, previously cached allow-once permissions are gone', async () => {
      const tool1 = 'Read';
      const tool2 = 'Write';

      await manager.grantPermission(tool1, undefined, 'allow-once');
      await manager.grantPermission(tool2, undefined, 'allow-once');

      // Both should have permissions
      expect(await manager.hasPermission(tool1)).toBe(true);
      expect(await manager.hasPermission(tool2)).toBe(true);

      // Reset session
      manager.resetSession();

      // Both should be gone
      expect(await manager.hasPermission(tool1)).toBe(false);
      expect(await manager.hasPermission(tool2)).toBe(false);
    });

    test('persistent store permissions survive reset', async () => {
      const tool = 'WebSearch';

      await manager.grantPermission(tool, undefined, 'allow-always');

      // Should have permission
      expect(await manager.hasPermission(tool)).toBe(true);

      // Reset session
      manager.resetSession();

      // Should still have permission (persistent)
      expect(await manager.hasPermission(tool)).toBe(true);
    });
  });

  describe('Edge cases and error conditions', () => {
    test('checkToolPermission with empty tool name handles gracefully', async () => {
      const result = await manager.checkToolPermission('');

      expect(result.allowed).toBe(true); // Default allow
      expect(result.level).toBeNull();
    });

    test('multiple concurrent checkPermission calls on allow-once', async () => {
      const tool = 'ConcurrentTool';

      await manager.grantPermission(tool, undefined, 'allow-once');

      // Make multiple concurrent calls
      const promises = Array(3).fill(0).map(() => manager.checkPermission(tool));
      const results = await Promise.all(promises);

      // Only one should get allow-once, others should get null
      const allowOnceResults = results.filter(r => r === 'allow-once');
      const nullResults = results.filter(r => r === null);

      expect(allowOnceResults).toHaveLength(1);
      expect(nullResults).toHaveLength(2);
    });

    test('revoking allow-once permission that has already been consumed', async () => {
      const tool = 'ConsumedTool';

      await manager.grantPermission(tool, undefined, 'allow-once');

      // Consume the permission
      await manager.checkPermission(tool);

      // Try to revoke (should return false since it's already consumed)
      const revoked = await manager.revokePermission(tool);
      expect(revoked).toBe(false);
    });
  });
});