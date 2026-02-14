/**
 * @fileoverview Tests for permission factory functions
 *
 * Comprehensive test suite for permission-related fixture factories.
 */

import { describe, it, expect } from 'vitest';
import type { PermissionLevel, ToolPermission, ToolPermissionResult } from '../../../types.js';
import {
  createToolPermission,
  createToolPermissionResult,
  createAlwaysAllowPermission,
  createAllowOncePermission,
  createDenyPermission,
  createFileSystemPermissions,
  createNetworkPermissions,
  createSystemPermissions,
  createSearchPermissions,
  createScopeBasedPermissions,
  createPermissionResults,
  createSecurityLevelPermissions,
  createStageBasedPermissions,
  PermissionPresets,
  createUniformPermissions,
  createPermissionVariants,
  validateToolPermission,
  createTimeBasedPermissions,
} from '../permission-factory.js';

describe('permission-factory', () => {
  describe('createToolPermission', () => {
    it('should create a basic tool permission with defaults', () => {
      const permission = createToolPermission();

      expect(permission.tool).toBe('Read');
      expect(permission.level).toBe('allow-always');
      expect(permission.scope).toBeUndefined();
      expect(permission.expiry).toBeUndefined();
      expect(permission.createdAt).toBeInstanceOf(Date);
    });

    it('should apply overrides correctly', () => {
      const permission = createToolPermission({
        tool: 'Write',
        level: 'allow-once',
        scope: '/src/',
      });

      expect(permission.tool).toBe('Write');
      expect(permission.level).toBe('allow-once');
      expect(permission.scope).toBe('/src/');
    });
  });

  describe('createToolPermissionResult', () => {
    it('should create a basic permission result', () => {
      const result = createToolPermissionResult();

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.requiresConfirmation).toBe(false);
    });

    it('should apply overrides correctly', () => {
      const result = createToolPermissionResult({
        allowed: false,
        level: null,
        denialReason: 'Access denied',
      });

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBe('Access denied');
    });
  });

  describe('Permission level specific factories', () => {
    describe('createAlwaysAllowPermission', () => {
      it('should create always-allow permission', () => {
        const permission = createAlwaysAllowPermission();
        expect(permission.level).toBe('allow-always');
      });
    });

    describe('createAllowOncePermission', () => {
      it('should create allow-once permission with expiry', () => {
        const permission = createAllowOncePermission();
        expect(permission.level).toBe('allow-once');
        expect(permission.expiry).toBeInstanceOf(Date);
        expect(permission.expiry!.getTime()).toBeGreaterThan(Date.now());
      });
    });

    describe('createDenyPermission', () => {
      it('should create deny permission', () => {
        const permission = createDenyPermission();
        expect(permission.level).toBe('deny');
      });
    });
  });

  describe('Tool-specific permission factories', () => {
    describe('createFileSystemPermissions', () => {
      it('should create file system permission sets', () => {
        const perms = createFileSystemPermissions();

        expect(perms.readOnly.Read.level).toBe('allow-always');
        expect(perms.readOnly.Write.level).toBe('deny');
        expect(perms.readOnly.Edit.level).toBe('deny');

        expect(perms.fullAccess.Read.level).toBe('allow-always');
        expect(perms.fullAccess.Write.level).toBe('allow-always');
        expect(perms.fullAccess.Edit.level).toBe('allow-always');

        expect(perms.cautious.Read.level).toBe('allow-always');
        expect(perms.cautious.Write.level).toBe('allow-once');
        expect(perms.cautious.Edit.level).toBe('allow-once');
        expect(perms.cautious.MultiEdit.level).toBe('deny');
      });
    });

    describe('createNetworkPermissions', () => {
      it('should create network permission sets', () => {
        const perms = createNetworkPermissions();

        expect(perms.offline.WebFetch.level).toBe('deny');
        expect(perms.offline.WebSearch.level).toBe('deny');

        expect(perms.limited.WebFetch.level).toBe('allow-once');
        expect(perms.limited.WebSearch.level).toBe('deny');

        expect(perms.full.WebFetch.level).toBe('allow-always');
        expect(perms.full.WebSearch.level).toBe('allow-always');
      });
    });

    describe('createSystemPermissions', () => {
      it('should create system permission sets', () => {
        const perms = createSystemPermissions();

        expect(perms.restricted.Bash.level).toBe('deny');
        expect(perms.limited.Bash.level).toBe('allow-once');
        expect(perms.full.Bash.level).toBe('allow-always');
      });
    });

    describe('createSearchPermissions', () => {
      it('should create search permission sets', () => {
        const perms = createSearchPermissions();

        expect(perms.noSearch.Grep.level).toBe('deny');
        expect(perms.noSearch.Glob.level).toBe('deny');

        expect(perms.basic.Grep.level).toBe('allow-always');
        expect(perms.basic.Glob.level).toBe('allow-always');
      });
    });
  });

  describe('Scope-based permission factories', () => {
    it('should create scope-based permission sets', () => {
      const perms = createScopeBasedPermissions();

      expect(perms.restrictSensitive).toBeInstanceOf(Array);
      expect(perms.restrictSensitive.some(p => p.scope === '/.env')).toBe(true);
      expect(perms.restrictSensitive.some(p => p.scope === '/secrets/')).toBe(true);

      expect(perms.allowDevelopment.some(p => p.scope === '/src/')).toBe(true);
      expect(perms.allowDevelopment.some(p => p.scope === '/tests/')).toBe(true);

      expect(perms.restrictProduction.some(p => p.scope === '/prod/')).toBe(true);
      expect(perms.restrictProduction.some(p => p.scope === '/production/')).toBe(true);
    });
  });

  describe('Permission result factories', () => {
    it('should create various permission result scenarios', () => {
      const results = createPermissionResults();

      expect(results.allowed.allowed).toBe(true);
      expect(results.allowed.level).toBe('allow-always');

      expect(results.allowedWithConfirmation.allowed).toBe(true);
      expect(results.allowedWithConfirmation.requiresConfirmation).toBe(true);

      expect(results.denied.allowed).toBe(false);
      expect(results.denied.level).toBeNull();
      expect(results.denied.denialReason).toBeDefined();

      expect(results.deniedScope.denialReason).toContain('scope');
      expect(results.deniedTool.denialReason).toContain('tool');
    });
  });

  describe('Security level permissions', () => {
    it('should create different security level configurations', () => {
      const configs = createSecurityLevelPermissions();

      expect(configs.minimal.permissions.some(p => p.tool === 'Read' && p.level === 'allow-always')).toBe(true);
      expect(configs.minimal.permissions.some(p => p.tool === 'Write' && p.level === 'deny')).toBe(true);

      expect(configs.development.permissions.some(p => p.tool === 'Write' && p.level === 'allow-always')).toBe(true);
      expect(configs.development.permissions.some(p => p.tool === 'Bash' && p.level === 'allow-once')).toBe(true);

      expect(configs.production.permissions.some(p => p.tool === 'Write' && p.level === 'allow-once')).toBe(true);
      expect(configs.production.permissions.some(p => p.tool === 'Edit' && p.level === 'deny')).toBe(true);

      expect(configs.unrestricted.permissions.every(p => p.level === 'allow-always')).toBe(true);
    });
  });

  describe('Stage-based permissions', () => {
    it('should create different stage-based configurations', () => {
      const configs = createStageBasedPermissions();

      // Planning stage - research only
      expect(configs.planning.permissions.some(p => p.tool === 'Read' && p.level === 'allow-always')).toBe(true);
      expect(configs.planning.permissions.some(p => p.tool === 'Write' && p.level === 'deny')).toBe(true);

      // Implementation stage - full dev tools
      expect(configs.implementation.permissions.some(p => p.tool === 'Write' && p.level === 'allow-always')).toBe(true);
      expect(configs.implementation.permissions.some(p => p.tool === 'Edit' && p.level === 'allow-always')).toBe(true);

      // Testing stage - test execution
      expect(configs.testing.permissions.some(p => p.tool === 'Bash' && p.level === 'allow-always')).toBe(true);
      expect(configs.testing.permissions.some(p => p.tool === 'MultiEdit' && p.level === 'deny')).toBe(true);

      // Deployment stage - minimal permissions
      expect(configs.deployment.permissions.some(p => p.tool === 'Write' && p.level === 'deny')).toBe(true);
      expect(configs.deployment.permissions.some(p => p.tool === 'Bash' && p.level === 'allow-once')).toBe(true);
    });
  });

  describe('PermissionPresets', () => {
    describe('level presets', () => {
      it('should provide all permission levels', () => {
        const alwaysAllow = PermissionPresets.levels.alwaysAllow();
        const allowOnce = PermissionPresets.levels.allowOnce();
        const deny = PermissionPresets.levels.deny();

        expect(alwaysAllow.level).toBe('allow-always');
        expect(allowOnce.level).toBe('allow-once');
        expect(deny.level).toBe('deny');
      });
    });

    describe('tool presets', () => {
      it('should provide tool-specific permission configurations', () => {
        const fileSystem = PermissionPresets.tools.fileSystem();
        const network = PermissionPresets.tools.network();
        const system = PermissionPresets.tools.system();
        const search = PermissionPresets.tools.search();

        expect(fileSystem.readOnly).toBeDefined();
        expect(network.offline).toBeDefined();
        expect(system.restricted).toBeDefined();
        expect(search.noSearch).toBeDefined();
      });
    });

    describe('testing presets', () => {
      it('should provide configurations for testing scenarios', () => {
        const noPerms = PermissionPresets.testing.noPermissions();
        const readOnly = PermissionPresets.testing.readOnlyTest();
        const temporary = PermissionPresets.testing.temporaryAccess();

        expect(noPerms.permissions.every(p => p.level === 'deny')).toBe(true);
        expect(readOnly.permissions.some(p => p.tool === 'Read' && p.level === 'allow-always')).toBe(true);
        expect(readOnly.permissions.some(p => p.tool === 'Write' && p.level === 'deny')).toBe(true);
        expect(temporary.permissions.some(p => p.level === 'allow-once')).toBe(true);
      });
    });
  });

  describe('Utility functions', () => {
    describe('createUniformPermissions', () => {
      it('should create permissions for all tools with specified level', () => {
        const permissions = createUniformPermissions('allow-once');

        expect(permissions.length).toBeGreaterThan(10); // Should have many tools
        expect(permissions.every(p => p.level === 'allow-once')).toBe(true);
        expect(permissions.some(p => p.tool === 'Read')).toBe(true);
        expect(permissions.some(p => p.tool === 'Write')).toBe(true);
        expect(permissions.some(p => p.tool === 'Bash')).toBe(true);
      });
    });

    describe('createPermissionVariants', () => {
      it('should create permission variants for A/B testing', () => {
        const variants = createPermissionVariants();

        expect(variants.restrictive.every(p => p.level === 'deny')).toBe(true);
        expect(variants.moderate.every(p => p.level === 'allow-once')).toBe(true);
        expect(variants.permissive.every(p => p.level === 'allow-always')).toBe(true);
      });
    });

    describe('validateToolPermission', () => {
      it('should validate valid permissions', () => {
        const permission = createToolPermission();
        expect(validateToolPermission(permission)).toBe(true);
      });

      it('should reject invalid permissions', () => {
        const invalidPermission = {
          tool: '',
          level: 'invalid-level',
        } as any as ToolPermission;
        expect(validateToolPermission(invalidPermission)).toBe(false);
      });
    });

    describe('createTimeBasedPermissions', () => {
      it('should create time-based permission scenarios', () => {
        const timePerms = createTimeBasedPermissions();

        expect(timePerms.expired.expiry!.getTime()).toBeLessThan(Date.now());
        expect(timePerms.expiringSoon.expiry!.getTime()).toBeGreaterThan(Date.now());
        expect(timePerms.longTerm.expiry!.getTime()).toBeGreaterThan(Date.now() + 60 * 60 * 1000);
        expect(timePerms.permanent.expiry).toBeUndefined();
      });
    });
  });

  describe('Type compliance', () => {
    it('should create permissions that match ToolPermission type', () => {
      const permission = createToolPermission();

      expect(typeof permission.tool).toBe('string');
      expect(typeof permission.level).toBe('string');
      expect(['allow-always', 'allow-once', 'deny']).toContain(permission.level);
      expect(permission.createdAt).toBeInstanceOf(Date);
    });

    it('should create results that match ToolPermissionResult type', () => {
      const result = createToolPermissionResult();

      expect(typeof result.allowed).toBe('boolean');
      expect(typeof result.requiresConfirmation).toBe('boolean');

      if (result.level !== null) {
        expect(['allow-always', 'allow-once', 'deny']).toContain(result.level);
      }
    });
  });

  describe('Factory consistency', () => {
    it('should create consistent permissions across calls', () => {
      const perm1 = createToolPermission();
      const perm2 = createToolPermission();

      expect(perm1.tool).toBe(perm2.tool);
      expect(perm1.level).toBe(perm2.level);
    });

    it('should maintain different IDs when appropriate', () => {
      const perm1 = createToolPermission({ tool: 'Write' });
      const perm2 = createToolPermission({ tool: 'Edit' });

      expect(perm1.tool).toBe('Write');
      expect(perm2.tool).toBe('Edit');
      expect(perm1.createdAt).toBeInstanceOf(Date);
      expect(perm2.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty overrides', () => {
      const permission = createToolPermission({});
      expect(permission).toBeDefined();
      expect(permission.tool).toBe('Read');
    });

    it('should handle undefined overrides', () => {
      const permission = createToolPermission(undefined);
      expect(permission).toBeDefined();
      expect(permission.tool).toBe('Read');
    });

    it('should handle complex scope patterns', () => {
      const permission = createToolPermission({
        scope: '/deeply/nested/path/**/*.ts',
      });
      expect(permission.scope).toBe('/deeply/nested/path/**/*.ts');
    });
  });

  describe('Permission interaction scenarios', () => {
    it('should create realistic permission conflicts', () => {
      const globalDeny = createDenyPermission({ tool: 'Write' });
      const scopeAllow = createAlwaysAllowPermission({
        tool: 'Write',
        scope: '/safe/'
      });

      expect(globalDeny.tool).toBe(scopeAllow.tool);
      expect(globalDeny.level).toBe('deny');
      expect(scopeAllow.level).toBe('allow-always');
      expect(scopeAllow.scope).toBe('/safe/');
    });

    it('should create escalation scenarios', () => {
      const basic = createAllowOncePermission({ tool: 'Bash' });
      const elevated = createAlwaysAllowPermission({ tool: 'Bash' });

      expect(basic.tool).toBe(elevated.tool);
      expect(basic.level).toBe('allow-once');
      expect(elevated.level).toBe('allow-always');
      expect(basic.expiry).toBeDefined();
      expect(elevated.expiry).toBeUndefined();
    });
  });
});