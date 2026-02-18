/**
 * @fileoverview Permission Escalation Prevention Tests
 *
 * Critical Priority Gap: Permission Escalation Testing
 * Risk Level: High - Unauthorized access to sensitive operations
 *
 * Tests cover:
 * - Vertical privilege escalation (user → admin permissions)
 * - Horizontal privilege escalation (cross-user access)
 * - Permission persistence manipulation
 * - Session hijacking scenarios
 * - Tool permission bypass attempts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import { Permission, PermissionLevel } from '@apexcli/core';

describe('Permission Escalation Prevention', () => {
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let testDir: string;
  let userId: string;
  let adminUserId: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-escalation-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();

    permissionManager = new PermissionManager(permissionStore);

    userId = 'user-' + Math.random().toString(36).substring(2);
    adminUserId = 'admin-' + Math.random().toString(36).substring(2);
  });

  afterEach(() => {
    if (permissionStore) {
      permissionStore.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Vertical Privilege Escalation Prevention', () => {
    it('should prevent users from escalating to admin permissions', async () => {
      // Grant user-level permission
      const userPermission: Permission = {
        tool: 'Read',
        level: 'allow-once' as PermissionLevel,
        scope: '/user/documents',
        createdAt: new Date(),
      };

      await permissionStore.savePermission(userPermission, { userId });

      // Attempt to check admin-level permission without proper authorization
      const adminCheckResult = await permissionManager.checkToolPermission('Write', {
        scope: '/admin/config',
        userId: userId, // Regular user trying to access admin scope
      });

      expect(adminCheckResult.allowed).toBe(false);
      expect(adminCheckResult.level).toBe(null);
      expect(adminCheckResult.reason).toContain('permission denied');
    });

    it('should prevent permission level escalation through manipulation', async () => {
      // Save a 'deny' permission
      const denyPermission: Permission = {
        tool: 'Shell',
        level: 'deny' as PermissionLevel,
        scope: '/bin/sudo',
        createdAt: new Date(),
      };

      await permissionStore.savePermission(denyPermission, { userId });

      // Attempt to escalate by requesting higher permission level
      const escalationAttempts = [
        { level: 'allow-once' as PermissionLevel },
        { level: 'allow-always' as PermissionLevel },
      ];

      for (const attempt of escalationAttempts) {
        const result = await permissionManager.checkToolPermission('Shell', {
          scope: '/bin/sudo',
          userId: userId,
          requestedLevel: attempt.level,
        });

        expect(result.allowed).toBe(false);
        expect(result.level).toBe('deny');
      }
    });

    it('should prevent bypassing permission checks through tool aliasing', async () => {
      // Set up restricted permission for 'Shell'
      const restrictedPermission: Permission = {
        tool: 'Shell',
        level: 'deny' as PermissionLevel,
        createdAt: new Date(),
      };

      await permissionStore.savePermission(restrictedPermission, { userId });

      // Attempt to bypass using similar tool names
      const bypassAttempts = [
        'shell',      // lowercase
        'SHELL',      // uppercase
        'Shell ',     // trailing space
        ' Shell',     // leading space
        'Bash',       // similar tool
        'Command',    // alias attempt
        'Execute',    // synonym
      ];

      for (const toolName of bypassAttempts) {
        const result = await permissionManager.checkToolPermission(toolName, {
          userId: userId,
        });

        // Should either be denied or not found (both prevent escalation)
        expect(result.allowed).toBe(false);
      }
    });
  });

  describe('Horizontal Privilege Escalation Prevention', () => {
    it('should prevent cross-user permission access', async () => {
      const otherUserId = 'other-user-' + Math.random().toString(36).substring(2);

      // Grant permission to other user
      const otherUserPermission: Permission = {
        tool: 'Write',
        level: 'allow-always' as PermissionLevel,
        scope: '/other/private',
        createdAt: new Date(),
      };

      await permissionStore.savePermission(otherUserPermission, { userId: otherUserId });

      // Current user should not be able to access other user's permissions
      const crossAccessResult = await permissionManager.checkToolPermission('Write', {
        scope: '/other/private',
        userId: userId, // Different user ID
      });

      expect(crossAccessResult.allowed).toBe(false);
      expect(crossAccessResult.reason).toContain('permission denied');
    });

    it('should prevent permission inheritance across user sessions', async () => {
      // Create session for admin user with elevated permissions
      const adminPermission: Permission = {
        tool: 'Admin',
        level: 'allow-always' as PermissionLevel,
        createdAt: new Date(),
      };

      await permissionStore.savePermission(adminPermission, { userId: adminUserId });

      // Regular user should not inherit admin permissions
      const inheritanceResult = await permissionManager.checkToolPermission('Admin', {
        userId: userId,
      });

      expect(inheritanceResult.allowed).toBe(false);
    });

    it('should isolate permissions between different scopes for same tool', async () => {
      // Grant permission for specific scope
      const scopedPermission: Permission = {
        tool: 'Read',
        level: 'allow-always' as PermissionLevel,
        scope: '/user/public',
        createdAt: new Date(),
      };

      await permissionStore.savePermission(scopedPermission, { userId });

      // Should not allow access to different scope
      const differentScopeResult = await permissionManager.checkToolPermission('Read', {
        scope: '/user/private',
        userId: userId,
      });

      expect(differentScopeResult.allowed).toBe(false);

      // Should allow access to granted scope
      const sameScopeResult = await permissionManager.checkToolPermission('Read', {
        scope: '/user/public',
        userId: userId,
      });

      expect(sameScopeResult.allowed).toBe(true);
    });
  });

  describe('Permission Persistence Manipulation Prevention', () => {
    it('should prevent direct database manipulation from bypassing permissions', async () => {
      // This test simulates an attacker trying to directly manipulate the database
      const maliciousPermission = {
        tool: 'Root',
        level: 'allow-always' as PermissionLevel,
        scope: '/*',
        createdAt: new Date(),
        // Attempt to inject malicious metadata
        metadata: {
          injected: true,
          adminOverride: true,
        },
      };

      // Even if someone manages to save malicious data
      await permissionStore.savePermission(maliciousPermission, { userId });

      // The permission manager should validate and reject suspicious permissions
      const result = await permissionManager.checkToolPermission('Root', {
        scope: '/*',
        userId: userId,
      });

      // Should be rejected due to security validation
      expect(result.allowed).toBe(false);
    });

    it('should validate permission integrity during checks', async () => {
      // Create a normal permission
      const normalPermission: Permission = {
        tool: 'Write',
        level: 'allow-once' as PermissionLevel,
        scope: '/tmp',
        createdAt: new Date(),
      };

      await permissionStore.savePermission(normalPermission, { userId });

      // Simulate permission check with integrity validation
      const result = await permissionManager.checkToolPermission('Write', {
        scope: '/tmp',
        userId: userId,
        validateIntegrity: true,
      });

      expect(result.allowed).toBe(true);

      // If integrity check fails, should deny access
      const corruptedResult = await permissionManager.checkToolPermission('Write', {
        scope: '/tmp',
        userId: userId + '-corrupted', // Mismatched user ID
        validateIntegrity: true,
      });

      expect(corruptedResult.allowed).toBe(false);
    });

    it('should prevent permission expiry manipulation', async () => {
      const expiredTime = new Date(Date.now() - 3600000); // 1 hour ago

      const expiredPermission: Permission = {
        tool: 'Temp',
        level: 'allow-always' as PermissionLevel,
        expiry: expiredTime,
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
      };

      await permissionStore.savePermission(expiredPermission, { userId });

      // Should reject expired permissions regardless of level
      const result = await permissionManager.checkToolPermission('Temp', {
        userId: userId,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('expired');
    });
  });

  describe('Session Hijacking Prevention', () => {
    it('should prevent session token manipulation', async () => {
      // Simulate session-based permission
      const sessionPermission: Permission = {
        tool: 'Session',
        level: 'allow-once' as PermissionLevel,
        createdAt: new Date(),
      };

      const sessionId = 'session-' + Math.random().toString(36);
      await permissionStore.savePermission(sessionPermission, {
        userId,
        sessionId,
      });

      // Attempt to use permission with different session ID
      const hijackResult = await permissionManager.checkToolPermission('Session', {
        userId: userId,
        sessionId: 'hijacked-session-' + Math.random().toString(36),
      });

      expect(hijackResult.allowed).toBe(false);
      expect(hijackResult.reason).toContain('session mismatch');
    });

    it('should validate session consistency across permission operations', async () => {
      const validSessionId = 'valid-session-' + Math.random().toString(36);

      // Grant permission with specific session
      const sessionBoundPermission: Permission = {
        tool: 'SessionBound',
        level: 'allow-once' as PermissionLevel,
        createdAt: new Date(),
      };

      await permissionStore.savePermission(sessionBoundPermission, {
        userId,
        sessionId: validSessionId,
      });

      // Valid session should work
      const validResult = await permissionManager.checkToolPermission('SessionBound', {
        userId: userId,
        sessionId: validSessionId,
      });

      expect(validResult.allowed).toBe(true);

      // Invalid session should be rejected
      const invalidResult = await permissionManager.checkToolPermission('SessionBound', {
        userId: userId,
        sessionId: 'different-session',
      });

      expect(invalidResult.allowed).toBe(false);
    });
  });

  describe('Tool Permission Bypass Prevention', () => {
    it('should prevent wildcard permission exploitation', async () => {
      // Grant a specific scoped permission (not wildcard)
      const scopedPermission: Permission = {
        tool: 'Read',
        level: 'allow-always' as PermissionLevel,
        scope: '/safe/directory',
        createdAt: new Date(),
      };

      await permissionStore.savePermission(scopedPermission, { userId });

      // Attempt to exploit with wildcard patterns
      const wildcardAttempts = [
        '/safe/../etc',
        '/safe/directory/../../../root',
        '/safe/directory/*',
        '/safe/directory/**',
        '*',
        '**/*',
      ];

      for (const wildcardScope of wildcardAttempts) {
        const result = await permissionManager.checkToolPermission('Read', {
          scope: wildcardScope,
          userId: userId,
        });

        expect(result.allowed).toBe(false);
      }
    });

    it('should prevent permission aggregation attacks', async () => {
      // Grant multiple limited permissions
      const limitedPermissions: Permission[] = [
        {
          tool: 'Read',
          level: 'allow-once' as PermissionLevel,
          scope: '/data/file1',
          createdAt: new Date(),
        },
        {
          tool: 'Read',
          level: 'allow-once' as PermissionLevel,
          scope: '/data/file2',
          createdAt: new Date(),
        },
      ];

      for (const permission of limitedPermissions) {
        await permissionStore.savePermission(permission, { userId });
      }

      // Attempt to aggregate permissions into broader access
      const aggregationResult = await permissionManager.checkToolPermission('Read', {
        scope: '/data/*', // Broader scope
        userId: userId,
      });

      expect(aggregationResult.allowed).toBe(false);
    });

    it('should enforce permission consumption rules', async () => {
      // Grant allow-once permission
      const oncePermission: Permission = {
        tool: 'OneTime',
        level: 'allow-once' as PermissionLevel,
        createdAt: new Date(),
      };

      await permissionStore.savePermission(oncePermission, { userId });

      // First use should succeed
      const firstUse = await permissionManager.checkToolPermission('OneTime', {
        userId: userId,
        consume: true,
      });

      expect(firstUse.allowed).toBe(true);
      expect(firstUse.consumed).toBe(true);

      // Second use should fail (permission consumed)
      const secondUse = await permissionManager.checkToolPermission('OneTime', {
        userId: userId,
        consume: true,
      });

      expect(secondUse.allowed).toBe(false);
      expect(secondUse.reason).toContain('consumed');
    });
  });

  describe('Admin Permission Safeguards', () => {
    it('should require additional verification for admin-level permissions', async () => {
      const adminPermission: Permission = {
        tool: 'SystemAdmin',
        level: 'allow-always' as PermissionLevel,
        createdAt: new Date(),
      };

      await permissionStore.savePermission(adminPermission, { userId: adminUserId });

      // Admin permissions should require additional verification
      const result = await permissionManager.checkToolPermission('SystemAdmin', {
        userId: adminUserId,
        requireAdminVerification: true,
      });

      // Should require additional verification step
      expect(result.requiresConfirmation).toBe(true);
    });

    it('should log and audit privilege escalation attempts', async () => {
      const auditLog: Array<{ event: string; userId: string; tool: string }> = [];

      // Mock audit logging
      const originalAuditLog = permissionManager.auditLog;
      permissionManager.auditLog = (event: string, details: any) => {
        auditLog.push({ event, userId: details.userId, tool: details.tool });
      };

      // Attempt escalation
      await permissionManager.checkToolPermission('SuperUser', {
        userId: userId, // Regular user
      });

      // Should have logged the attempt
      expect(auditLog).toContainEqual({
        event: 'privilege_escalation_attempt',
        userId: userId,
        tool: 'SuperUser',
      });

      // Restore original audit log
      permissionManager.auditLog = originalAuditLog;
    });
  });
});