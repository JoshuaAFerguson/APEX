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
  assertPermissionResultEquals,
  assertPermissionState,
  assertToolIsAllowed,
  assertToolIsDenied,
  assertToolRequiresConfirmation,
  createPermissionTestingSuite,
  createBatchPermissionChecker,
  waitForPermissionEvent,
  mockPermissionConfirmation,
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

  describe('new assertion utilities', () => {
    describe('assertPermissionResultEquals', () => {
      it('should pass for matching permission results', () => {
        const result = createMockToolPermissionResult({
          allowed: true,
          level: 'allow-always',
          requiresConfirmation: false,
        });

        expect(() => {
          assertPermissionResultEquals(result, {
            allowed: true,
            level: 'allow-always',
            requiresConfirmation: false,
          });
        }).not.toThrow();
      });

      it('should throw for mismatched permission results', () => {
        const result = createMockToolPermissionResult({
          allowed: true,
          level: 'allow-always',
        });

        expect(() => {
          assertPermissionResultEquals(result, {
            allowed: false,
            level: 'deny',
          });
        }).toThrow('Permission result assertion failed');
      });
    });

    describe('assertPermissionState', () => {
      it('should pass for matching states', () => {
        expect(() => {
          assertPermissionState('allow-always', 'allow-always');
        }).not.toThrow();

        expect(() => {
          assertPermissionState(null, null);
        }).not.toThrow();
      });

      it('should throw for mismatched states', () => {
        expect(() => {
          assertPermissionState('allow-always', 'deny');
        }).toThrow('Permission state assertion failed');
      });
    });

    describe('assertToolIsAllowed', () => {
      it('should pass for allowed tools', () => {
        const result = createMockToolPermissionResult({
          allowed: true,
          level: 'allow-always',
        });

        expect(() => {
          assertToolIsAllowed(result, 'allow-always');
        }).not.toThrow();
      });

      it('should throw for denied tools', () => {
        const result = createMockToolPermissionResult({
          allowed: false,
          denialReason: 'Tool blocked',
        });

        expect(() => {
          assertToolIsAllowed(result);
        }).toThrow('Tool should be allowed but was denied');
      });

      it('should throw for wrong permission level', () => {
        const result = createMockToolPermissionResult({
          allowed: true,
          level: 'allow-once',
        });

        expect(() => {
          assertToolIsAllowed(result, 'allow-always');
        }).toThrow('Tool allowed but with wrong level');
      });
    });

    describe('assertToolIsDenied', () => {
      it('should pass for denied tools', () => {
        const result = createMockToolPermissionResult({
          allowed: false,
          denialReason: 'Tool blocked',
        });

        expect(() => {
          assertToolIsDenied(result, 'Tool blocked');
        }).not.toThrow();
      });

      it('should throw for allowed tools', () => {
        const result = createMockToolPermissionResult({
          allowed: true,
          level: 'allow-always',
        });

        expect(() => {
          assertToolIsDenied(result);
        }).toThrow('Tool should be denied but was allowed');
      });
    });

    describe('assertToolRequiresConfirmation', () => {
      it('should pass for tools requiring confirmation', () => {
        const result = createMockToolPermissionResult({
          allowed: true,
          level: 'allow-once',
          requiresConfirmation: true,
        });

        expect(() => {
          assertToolRequiresConfirmation(result);
        }).not.toThrow();
      });

      it('should throw for denied tools', () => {
        const result = createMockToolPermissionResult({
          allowed: false,
        });

        expect(() => {
          assertToolRequiresConfirmation(result);
        }).toThrow('Tool is denied, cannot require confirmation');
      });

      it('should throw for tools not requiring confirmation', () => {
        const result = createMockToolPermissionResult({
          allowed: true,
          level: 'allow-always',
          requiresConfirmation: false,
        });

        expect(() => {
          assertToolRequiresConfirmation(result);
        }).toThrow('Tool should require confirmation but doesn\'t');
      });
    });
  });

  describe('createPermissionTestingSuite', () => {
    it('should create suite with initial permissions', () => {
      const permissions = [
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', level: 'allow-once', scope: '/project/**' }),
      ];

      const suite = createPermissionTestingSuite(permissions);

      expect(suite.isAllowed('Read')).toBe(true);
      expect(suite.requiresConfirmation('Write', '/project/**')).toBe(true);
    });

    it('should support adding and removing permissions', () => {
      const suite = createPermissionTestingSuite();

      suite.addPermission(createMockPermission({ tool: 'Read', level: 'allow-always' }));
      expect(suite.isAllowed('Read')).toBe(true);

      suite.removePermission('Read');
      expect(suite.isAllowed('Read')).toBe(false);
    });

    it('should support assertions', async () => {
      const suite = createPermissionTestingSuite([
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', level: 'deny' }),
      ]);

      await expect(suite.assertToolIsAllowed('Read', 'allow-always')).resolves.not.toThrow();
      await expect(suite.assertToolIsDenied('Write')).resolves.not.toThrow();
    });

    it('should throw for invalid assertions', async () => {
      const suite = createPermissionTestingSuite([
        createMockPermission({ tool: 'Read', level: 'deny' }),
      ]);

      await expect(suite.assertToolIsAllowed('Read')).rejects.toThrow('Tool Read is denied');
      await expect(suite.assertToolIsDenied('Nonexistent')).resolves.not.toThrow(); // No permission = denied
    });
  });

  describe('createBatchPermissionChecker', () => {
    it('should check multiple permissions at once', () => {
      const permissions = [
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', level: 'allow-once' }),
        createMockPermission({ tool: 'Bash', level: 'deny' }),
      ];

      const checker = createBatchPermissionChecker(permissions);

      const results = checker.checkBatch([
        { tool: 'Read', expected: 'allow-always' },
        { tool: 'Write', expected: 'allow-once' },
        { tool: 'Bash', expected: 'deny' },
      ]);

      expect(results.every(r => r.passed)).toBe(true);
    });

    it('should fail batch assertion for mismatched permissions', () => {
      const permissions = [
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
      ];

      const checker = createBatchPermissionChecker(permissions);

      expect(() => {
        checker.assertBatch([
          { tool: 'Read', expected: 'deny' }, // This should fail
        ]);
      }).toThrow('Batch permission assertion failed');
    });

    it('should provide permission summary', () => {
      const permissions = [
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', level: 'allow-once', scope: '/project/**' }),
      ];

      const checker = createBatchPermissionChecker(permissions);
      const summary = checker.getSummary();

      expect(summary).toHaveLength(2);
      expect(summary[0]).toEqual({ tool: 'Read', scope: undefined, level: 'allow-always' });
      expect(summary[1]).toEqual({ tool: 'Write', scope: '/project/**', level: 'allow-once' });
    });
  });

  describe('mockPermissionConfirmation', () => {
    it('should return configured responses', async () => {
      const mockConfirm = mockPermissionConfirmation({
        'Allow Write access?': true,
        'Allow dangerous command?': false,
      });

      expect(await mockConfirm('Allow Write access?')).toBe(true);
      expect(await mockConfirm('Allow dangerous command?')).toBe(false);
    });

    it('should support partial matching', async () => {
      const mockConfirm = mockPermissionConfirmation({
        'Write access': true,
        'dangerous': false,
      });

      expect(await mockConfirm('Allow Write access to file.ts?')).toBe(true);
      expect(await mockConfirm('This is a dangerous command')).toBe(false);
    });

    it('should default to false for unknown prompts', async () => {
      const mockConfirm = mockPermissionConfirmation({});

      expect(await mockConfirm('Unknown permission request')).toBe(false);
    });
  });

  describe('waitForPermissionEvent', () => {
    it('should resolve when event is received', async () => {
      const mockEmitter = {
        listeners: [] as Array<(data: any) => void>,
        on(event: string, listener: (data: any) => void) {
          this.listeners.push(listener);
        },
        off(event: string, listener: (data: any) => void) {
          const index = this.listeners.indexOf(listener);
          if (index >= 0) {
            this.listeners.splice(index, 1);
          }
        },
        emit(data: any) {
          this.listeners.forEach(listener => listener(data));
        },
      };

      const eventPromise = waitForPermissionEvent(mockEmitter, 'permission:requested', 1000);

      // Simulate event emission after a short delay
      setTimeout(() => {
        mockEmitter.emit({ tool: 'Write', scope: '/file.ts' });
      }, 10);

      const eventData = await eventPromise;
      expect(eventData.tool).toBe('Write');
      expect(eventData.scope).toBe('/file.ts');
    });

    it('should reject on timeout', async () => {
      const mockEmitter = {
        on() {},
        off() {},
      };

      await expect(
        waitForPermissionEvent(mockEmitter, 'permission:requested', 10)
      ).rejects.toThrow('Permission event \'permission:requested\' not received within 10ms');
    }, 100);
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