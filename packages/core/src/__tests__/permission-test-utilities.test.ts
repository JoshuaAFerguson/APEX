/**
 * Tests for the permission test utilities to validate they work correctly
 */

import { describe, it, expect } from 'vitest';
import {
  createMockPermission,
  createMockExtendedPermission,
  createMockPermissionQuery,
  createMockToolPermissionConfig,
  createMockFilesystemToolConfig,
  createMockToolPermissionResult,
  createMockPermissionRequestEventData,
  createMockPermissionGrantedEventData,
  createMockPermissionDeniedEventData,
  createCommonPermissionScenarios,
  mockAgentPermissions,
  mockToolPermissions,
  createMockUserConfirmation,
  assertPermissionEquals,
} from '../test-utils';
import type { Permission, PermissionLevel } from '../types';

describe('Permission Test Utilities', () => {
  describe('createMockPermission', () => {
    it('should create a basic permission with defaults', () => {
      const permission = createMockPermission();

      expect(permission.tool).toBe('Read');
      expect(permission.level).toBe('allow-always');
      expect(permission.scope).toBeUndefined();
      expect(permission.expiry).toBeUndefined();
      expect(permission.createdAt).toBeInstanceOf(Date);
    });

    it('should allow overriding defaults', () => {
      const permission = createMockPermission({
        tool: 'Write',
        level: 'allow-once',
        scope: '/project/**',
      });

      expect(permission.tool).toBe('Write');
      expect(permission.level).toBe('allow-once');
      expect(permission.scope).toBe('/project/**');
    });
  });

  describe('createMockExtendedPermission', () => {
    it('should create extended permission with base fields', () => {
      const extendedPermission = createMockExtendedPermission({
        tool: 'Bash',
        grantReason: 'User approved shell access',
        grantedBy: 'admin@example.com',
      });

      expect(extendedPermission.tool).toBe('Bash');
      expect(extendedPermission.grantReason).toBe('User approved shell access');
      expect(extendedPermission.grantedBy).toBe('admin@example.com');
      expect(extendedPermission.tags).toBeUndefined();
      expect(extendedPermission.config).toBeUndefined();
    });
  });

  describe('createMockToolPermissionConfig', () => {
    it('should create tool config with defaults', () => {
      const config = createMockToolPermissionConfig();

      expect(config.enabled).toBe(true);
      expect(config.timeout).toBe(0);
      expect(config.requireConfirmation).toBe(false);
      expect(config.rateLimitPerMinute).toBe(0);
    });

    it('should allow overriding config values', () => {
      const config = createMockToolPermissionConfig({
        requireConfirmation: true,
        timeout: 30000,
      });

      expect(config.requireConfirmation).toBe(true);
      expect(config.timeout).toBe(30000);
    });
  });

  describe('createMockFilesystemToolConfig', () => {
    it('should create filesystem config with base config', () => {
      const fsConfig = createMockFilesystemToolConfig({
        maxFileSize: 1024 * 1024,
        allowedExtensions: ['.ts', '.js'],
      });

      expect(fsConfig.maxFileSize).toBe(1024 * 1024);
      expect(fsConfig.allowedExtensions).toEqual(['.ts', '.js']);
      expect(fsConfig.blockedExtensions).toEqual([]);
      expect(fsConfig.enabled).toBe(true); // from base config
    });
  });

  describe('createCommonPermissionScenarios', () => {
    it('should create read-only scenario', () => {
      const scenarios = createCommonPermissionScenarios();

      expect(scenarios.readOnly.Read.level).toBe('allow-always');
      expect(scenarios.readOnly.Write.level).toBe('deny');
      expect(scenarios.readOnly.Bash.level).toBe('deny');
    });

    it('should create full-access scenario', () => {
      const scenarios = createCommonPermissionScenarios();

      expect(scenarios.fullAccess.Read.level).toBe('allow-always');
      expect(scenarios.fullAccess.Write.level).toBe('allow-always');
      expect(scenarios.fullAccess.Bash.level).toBe('allow-always');
    });

    it('should create review-all scenario', () => {
      const scenarios = createCommonPermissionScenarios();

      expect(scenarios.reviewAll.Read.level).toBe('allow-once');
      expect(scenarios.reviewAll.Write.level).toBe('allow-once');
      expect(scenarios.reviewAll.Bash.level).toBe('allow-once');
    });
  });

  describe('mockAgentPermissions', () => {
    it('should create agent permissions with scoped names', () => {
      const permissions = [
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', level: 'allow-once', scope: '/project/**' }),
      ];

      const agentPerms = mockAgentPermissions('developer', permissions);

      expect(agentPerms).toHaveLength(2);
      expect(agentPerms[0].scope).toBe('developer');
      expect(agentPerms[1].scope).toBe('developer:/project/**');
    });
  });

  describe('mockToolPermissions', () => {
    it('should create tool permission with defaults', () => {
      const permission = mockToolPermissions('Write');

      expect(permission.tool).toBe('Write');
      expect(permission.level).toBe('allow-always');
      expect(permission.scope).toBeUndefined();
    });

    it('should create tool permission with options', () => {
      const permission = mockToolPermissions('Bash', {
        level: 'allow-once',
        scope: '/project/**',
      });

      expect(permission.tool).toBe('Bash');
      expect(permission.level).toBe('allow-once');
      expect(permission.scope).toBe('/project/**');
    });
  });

  describe('createMockUserConfirmation', () => {
    it('should return configured responses', () => {
      const mockConfirm = createMockUserConfirmation({
        'Write': true,
        'Bash': false,
        'Read:sensitive.txt': false,
      });

      expect(mockConfirm('Write')).toBe(true);
      expect(mockConfirm('Bash')).toBe(false);
      expect(mockConfirm('Read', 'sensitive.txt')).toBe(false);
      expect(mockConfirm('Read', 'normal.txt')).toBe(true); // default to true
    });
  });

  describe('assertPermissionEquals', () => {
    it('should pass for matching permissions', () => {
      const permission = createMockPermission({
        tool: 'Read',
        level: 'allow-always',
      });

      expect(() => {
        assertPermissionEquals(permission, {
          tool: 'Read',
          level: 'allow-always',
        });
      }).not.toThrow();
    });

    it('should throw for mismatched permissions', () => {
      const permission = createMockPermission({
        tool: 'Read',
        level: 'allow-always',
      });

      expect(() => {
        assertPermissionEquals(permission, {
          tool: 'Write',
          level: 'deny',
        });
      }).toThrow('Permission assertion failed');
    });
  });

  describe('event data mocks', () => {
    it('should create permission request event data', () => {
      const requestEvent = createMockPermissionRequestEventData({
        tool: 'Write',
        scope: '/project/file.ts',
        reason: 'Agent needs to create file',
      });

      expect(requestEvent.tool).toBe('Write');
      expect(requestEvent.scope).toBe('/project/file.ts');
      expect(requestEvent.reason).toBe('Agent needs to create file');
      expect(requestEvent.agent).toBe('test-agent');
      expect(requestEvent.requestId).toMatch(/^req_/);
    });

    it('should create permission granted event data', () => {
      const grantedEvent = createMockPermissionGrantedEventData({
        tool: 'Read',
        level: 'allow-once',
        grantedBy: 'user@example.com',
      });

      expect(grantedEvent.tool).toBe('Read');
      expect(grantedEvent.level).toBe('allow-once');
      expect(grantedEvent.grantedBy).toBe('user@example.com');
      expect(grantedEvent.grantedAt).toBeInstanceOf(Date);
    });

    it('should create permission denied event data', () => {
      const deniedEvent = createMockPermissionDeniedEventData({
        tool: 'Bash',
        denialReason: 'Dangerous command detected',
      });

      expect(deniedEvent.tool).toBe('Bash');
      expect(deniedEvent.denialReason).toBe('Dangerous command detected');
      expect(deniedEvent.deniedBy).toBe('test-system');
      expect(deniedEvent.deniedAt).toBeInstanceOf(Date);
    });
  });

  describe('permission result mocks', () => {
    it('should create tool permission result with defaults', () => {
      const result = createMockToolPermissionResult();

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.denialReason).toBeUndefined();
    });

    it('should create denied tool permission result', () => {
      const result = createMockToolPermissionResult({
        allowed: false,
        denialReason: 'Tool requires confirmation',
        requiresConfirmation: true,
      });

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toBe('Tool requires confirmation');
      expect(result.requiresConfirmation).toBe(true);
    });
  });
});