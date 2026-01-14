/**
 * @fileoverview Integration tests for permission test utilities
 *
 * This test suite validates that all the permission test utilities work correctly
 * and can be used together to create comprehensive test scenarios.
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
  createTestPermissionStore,
} from '../test-utils';
import type { Permission, PermissionLevel } from '../types';

describe('Permission Test Utilities - Integration Tests', () => {
  describe('End-to-End Permission Testing Workflow', () => {
    it('should support a complete permission testing workflow', async () => {
      // 1. Create common permission scenarios
      const scenarios = createCommonPermissionScenarios();
      expect(scenarios.readOnly.Read.level).toBe('allow-always');
      expect(scenarios.fullAccess.Bash.level).toBe('allow-always');
      expect(scenarios.reviewAll.Write.level).toBe('allow-once');

      // 2. Create a permission testing suite with read-only permissions
      const suite = createPermissionTestingSuite(Object.values(scenarios.readOnly));

      // 3. Test basic permissions
      expect(suite.isAllowed('Read')).toBe(true);
      expect(suite.isAllowed('Write')).toBe(false);
      expect(suite.requiresConfirmation('Bash')).toBe(false); // denied tools don't require confirmation

      // 4. Add new permission dynamically
      const writePermission = createMockPermission({
        tool: 'Write',
        level: 'allow-once',
        scope: '/project/**'
      });
      suite.addPermission(writePermission);

      // 5. Verify the new permission
      expect(suite.isAllowed('Write', '/project/**')).toBe(true);
      expect(suite.requiresConfirmation('Write', '/project/**')).toBe(true);

      // 6. Use assertions
      await expect(suite.assertToolIsAllowed('Read', 'allow-always')).resolves.not.toThrow();
      await expect(suite.assertToolRequiresConfirmation('Write', '/project/**')).resolves.not.toThrow();
      await expect(suite.assertToolIsDenied('Bash')).resolves.not.toThrow();

      // 7. Test batch permission checking
      const batchChecker = createBatchPermissionChecker(suite.getAllPermissions());
      const results = batchChecker.checkBatch([
        { tool: 'Read', expected: 'allow-always' },
        { tool: 'Write', scope: '/project/**', expected: 'allow-once' },
        { tool: 'Bash', expected: 'deny' }
      ]);

      expect(results.every(r => r.passed)).toBe(true);
    });

    it('should create and test agent permission contexts', () => {
      // Create agent-specific permissions
      const permissions = [
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', level: 'allow-once', scope: '/agent-workspace/**' })
      ];

      const agentContext = mockAgentPermissions('developer', permissions);

      // Test agent context functionality
      expect(agentContext.agent).toBe('developer');
      expect(agentContext.hasPermission('Read')).toBe(true);
      expect(agentContext.hasPermission('Bash')).toBe(false);

      const readCheck = agentContext.checkPermission('Read');
      expect(readCheck.allowed).toBe(true);
      expect(readCheck.level).toBe('allow-always');

      const bashCheck = agentContext.checkPermission('Bash');
      expect(bashCheck.allowed).toBe(false);
      expect(bashCheck.level).toBeNull();
    });

    it('should create and test tool permission contexts', () => {
      const toolContext = mockToolPermissions('Write', [
        { level: 'allow-always', scope: '/project/src/**' },
        { level: 'allow-once', scope: '/project/tests/**' },
        { level: 'deny', scope: '/system/**' }
      ]);

      // Test scoped permissions
      expect(toolContext.isAllowed('/project/src/file.ts')).toBe(true);
      expect(toolContext.requiresConfirmation('/project/tests/test.ts')).toBe(true);
      expect(toolContext.isAllowed('/system/important.conf')).toBe(false);

      // Test access checks
      const srcAccess = toolContext.checkAccess('/project/src/main.ts');
      expect(srcAccess.allowed).toBe(true);
      expect(srcAccess.level).toBe('allow-always');

      const systemAccess = toolContext.checkAccess('/system/passwd');
      expect(systemAccess.allowed).toBe(false);
      expect(systemAccess.level).toBe('deny');
    });

    it('should test user confirmation workflows', async () => {
      // Create mock confirmation handler
      const mockConfirm = mockPermissionConfirmation({
        'Allow Write access': true,
        'Allow dangerous command': false,
        'Allow Bash execution for npm install': true
      });

      // Test specific confirmations
      expect(await mockConfirm('Allow Write access to file.ts?')).toBe(true);
      expect(await mockConfirm('This is a dangerous command')).toBe(false);
      expect(await mockConfirm('Allow Bash execution for npm install?')).toBe(true);
      expect(await mockConfirm('Unknown permission request')).toBe(false);

      // Test with synchronous version
      const syncConfirm = createMockUserConfirmation({
        'Write': true,
        'Bash:rm -rf': false,
        'Read': true
      });

      expect(syncConfirm('Write', '/project/file.ts')).toBe(true);
      expect(syncConfirm('Bash', 'rm -rf /')).toBe(false);
      expect(syncConfirm('Read')).toBe(true);
      expect(syncConfirm('Edit')).toBe(true); // defaults to true
    });

    it('should test permission event handling', async () => {
      const mockEmitter = {
        listeners: new Map<string, Array<(data: any) => void>>(),
        on(event: string, listener: (data: any) => void) {
          if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
          }
          this.listeners.get(event)!.push(listener);
        },
        off(event: string, listener: (data: any) => void) {
          const eventListeners = this.listeners.get(event);
          if (eventListeners) {
            const index = eventListeners.indexOf(listener);
            if (index >= 0) {
              eventListeners.splice(index, 1);
            }
          }
        },
        emit(event: string, data: any) {
          const eventListeners = this.listeners.get(event);
          if (eventListeners) {
            eventListeners.forEach(listener => listener(data));
          }
        }
      };

      // Test permission request event
      const requestEventPromise = waitForPermissionEvent(mockEmitter, 'permission:requested', 1000);

      setTimeout(() => {
        const requestEvent = createMockPermissionRequestEventData({
          tool: 'Write',
          scope: '/project/new-file.ts',
          reason: 'Creating test file'
        });
        mockEmitter.emit('permission:requested', requestEvent);
      }, 10);

      const requestData = await requestEventPromise;
      expect(requestData.tool).toBe('Write');
      expect(requestData.scope).toBe('/project/new-file.ts');
      expect(requestData.reason).toBe('Creating test file');
      expect(requestData.requestId).toMatch(/^req_/);

      // Test permission granted event
      const grantedEventPromise = waitForPermissionEvent(mockEmitter, 'permission:granted', 1000);

      setTimeout(() => {
        const grantedEvent = createMockPermissionGrantedEventData({
          tool: 'Write',
          level: 'allow-once',
          grantedBy: 'test-user',
          grantedAt: new Date()
        });
        mockEmitter.emit('permission:granted', grantedEvent);
      }, 10);

      const grantedData = await grantedEventPromise;
      expect(grantedData.tool).toBe('Write');
      expect(grantedData.level).toBe('allow-once');
      expect(grantedData.grantedBy).toBe('test-user');
    });

    it('should test comprehensive assertion helpers', () => {
      // Test permission result assertions
      const allowedResult = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-always',
        requiresConfirmation: false
      });

      const confirmResult = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-once',
        requiresConfirmation: true
      });

      const deniedResult = createMockToolPermissionResult({
        allowed: false,
        denialReason: 'Tool is blocked by security policy'
      });

      // Test all assertion helpers
      expect(() => assertToolIsAllowed(allowedResult, 'allow-always')).not.toThrow();
      expect(() => assertToolRequiresConfirmation(confirmResult)).not.toThrow();
      expect(() => assertToolIsDenied(deniedResult, 'Tool is blocked by security policy')).not.toThrow();

      // Test permission state assertions
      expect(() => assertPermissionState('allow-always', 'allow-always')).not.toThrow();
      expect(() => assertPermissionState('deny', 'deny')).not.toThrow();
      expect(() => assertPermissionState(null, null)).not.toThrow();

      // Test permission object assertions
      const permission = createMockPermission({ tool: 'Read', level: 'allow-always' });
      expect(() => assertPermissionEquals(permission, { tool: 'Read', level: 'allow-always' })).not.toThrow();

      // Test result object assertions
      expect(() => assertPermissionResultEquals(allowedResult, {
        allowed: true,
        level: 'allow-always',
        requiresConfirmation: false
      })).not.toThrow();
    });

    it('should test mock configuration creation', () => {
      // Test tool permission config
      const toolConfig = createMockToolPermissionConfig({
        requireConfirmation: true,
        timeout: 30000,
        rateLimitPerMinute: 10
      });

      expect(toolConfig.enabled).toBe(true);
      expect(toolConfig.requireConfirmation).toBe(true);
      expect(toolConfig.timeout).toBe(30000);
      expect(toolConfig.rateLimitPerMinute).toBe(10);

      // Test filesystem specific config
      const fsConfig = createMockFilesystemToolConfig({
        maxFileSize: 1024 * 1024,
        allowedExtensions: ['.ts', '.js', '.json'],
        blockedExtensions: ['.exe', '.bat'],
        requireConfirmation: true
      });

      expect(fsConfig.maxFileSize).toBe(1024 * 1024);
      expect(fsConfig.allowedExtensions).toEqual(['.ts', '.js', '.json']);
      expect(fsConfig.blockedExtensions).toEqual(['.exe', '.bat']);
      expect(fsConfig.requireConfirmation).toBe(true); // inherited from base config

      // Test extended permission
      const extendedPerm = createMockExtendedPermission({
        tool: 'Bash',
        level: 'allow-once',
        grantReason: 'User approved for development tasks',
        grantedBy: 'admin@example.com',
        tags: ['development', 'temporary'],
        config: toolConfig
      });

      expect(extendedPerm.tool).toBe('Bash');
      expect(extendedPerm.grantReason).toBe('User approved for development tasks');
      expect(extendedPerm.grantedBy).toBe('admin@example.com');
      expect(extendedPerm.tags).toEqual(['development', 'temporary']);
      expect(extendedPerm.config).toBe(toolConfig);
    });

    it('should test database store utilities', async () => {
      // Create test permission store
      const { store, cleanup } = await createTestPermissionStore([
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', level: 'allow-once', scope: '/project/**' })
      ]);

      try {
        // Test basic store operations
        const readPerm = await store.getPermission('Read');
        expect(readPerm?.level).toBe('allow-always');

        const writePerm = await store.getPermission('Write', '/project/**');
        expect(writePerm?.level).toBe('allow-once');

        const allPerms = await store.listPermissions();
        expect(allPerms).toHaveLength(2);

        // Test adding new permission
        const bashPerm = createMockPermission({ tool: 'Bash', level: 'deny' });
        await store.savePermission(bashPerm);

        const bashFromStore = await store.getPermission('Bash');
        expect(bashFromStore?.level).toBe('deny');

        // Test deleting permission
        await store.deletePermission({ tool: 'Bash' });
        const deletedBash = await store.getPermission('Bash');
        expect(deletedBash).toBeNull();
      } finally {
        await cleanup();
      }
    });

    it('should handle edge cases and error conditions', async () => {
      // Test empty permission suite
      const emptySuite = createPermissionTestingSuite();
      expect(emptySuite.getAllPermissions()).toEqual([]);
      expect(emptySuite.isAllowed('Read')).toBe(false);

      // Test permission removal
      emptySuite.addPermission(createMockPermission({ tool: 'Read', level: 'allow-always' }));
      expect(emptySuite.isAllowed('Read')).toBe(true);

      emptySuite.removePermission('Read');
      expect(emptySuite.isAllowed('Read')).toBe(false);

      // Test batch checker with empty permissions
      const emptyBatcher = createBatchPermissionChecker([]);
      const emptyResults = emptyBatcher.checkBatch([
        { tool: 'Read', expected: null }
      ]);
      expect(emptyResults[0].passed).toBe(true); // null matches no permission

      // Test event timeout
      const timeoutEmitter = { on() {}, off() {} };
      await expect(
        waitForPermissionEvent(timeoutEmitter, 'never-emitted', 10)
      ).rejects.toThrow('Permission event \'never-emitted\' not received within 10ms');

      // Test assertion failures
      const deniedResult = createMockToolPermissionResult({ allowed: false });
      expect(() => assertToolIsAllowed(deniedResult)).toThrow('Tool should be allowed but was denied');

      const allowedResult = createMockToolPermissionResult({ allowed: true });
      expect(() => assertToolIsDenied(allowedResult)).toThrow('Tool should be denied but was allowed');

      // Test permission mismatch
      const wrongLevelResult = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-once',
        requiresConfirmation: false
      });
      expect(() => assertToolRequiresConfirmation(wrongLevelResult)).toThrow('Tool should require confirmation');
    });
  });

  describe('Documentation and Usage Examples', () => {
    it('should provide clear examples for common testing patterns', async () => {
      // Example 1: Testing a read-only environment
      const readOnlyScenarios = createCommonPermissionScenarios();
      const readOnlyChecker = createBatchPermissionChecker(Object.values(readOnlyScenarios.readOnly));

      readOnlyChecker.assertBatch([
        { tool: 'Read', expected: 'allow-always' },
        { tool: 'Grep', expected: 'allow-always' },
        { tool: 'Glob', expected: 'allow-always' },
        { tool: 'Write', expected: 'deny' },
        { tool: 'Bash', expected: 'deny' }
      ]);

      // Example 2: Testing agent-specific permissions
      const agentPerms = mockAgentPermissions('tester', [
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', level: 'allow-once' })
      ]);

      expect(agentPerms.hasPermission('Read')).toBe(true);
      expect(agentPerms.checkPermission('Write').level).toBe('allow-once');

      // Example 3: Testing user confirmation flows
      const confirmHandler = mockPermissionConfirmation({
        'dangerous': false,
        'safe': true
      });

      expect(await confirmHandler('This is a dangerous operation')).toBe(false);
      expect(await confirmHandler('This is a safe operation')).toBe(true);

      // Example 4: Testing permission events
      const eventEmitter = {
        listeners: [] as Array<(data: any) => void>,
        on(event: string, listener: (data: any) => void) { this.listeners.push(listener); },
        off(event: string, listener: (data: any) => void) {
          const idx = this.listeners.indexOf(listener);
          if (idx >= 0) this.listeners.splice(idx, 1);
        },
        emit(data: any) { this.listeners.forEach(l => l(data)); }
      };

      const eventPromise = waitForPermissionEvent(eventEmitter, 'test', 1000);

      setTimeout(() => {
        const eventData = createMockPermissionRequestEventData({
          tool: 'Test',
          scope: '/test',
          reason: 'Testing'
        });
        eventEmitter.emit(eventData);
      }, 10);

      const receivedEvent = await eventPromise;
      expect(receivedEvent.tool).toBe('Test');
    });
  });
});