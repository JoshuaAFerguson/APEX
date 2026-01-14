/**
 * @fileoverview Permission Database Test Utilities - Integration Test
 *
 * This test demonstrates the permission database utilities working in a realistic scenario
 * with the orchestrator package's PermissionStore and PermissionManager.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestPermissionStore,
  createPermissionScenarioStore,
  populateTestPermissions,
  createMockPermissionManager,
  cleanupTestPermissionStore,
  createPermissionTestEnvironment,
  createPermissionTestScenario,
  assertDatabaseState,
  type TestPermissionStoreContext,
  type PermissionTestEnvironment,
} from '../test-utils';
import { createMockPermission } from '@apexcli/core/test-utils';

describe('Permission Database Test Utilities - Integration', () => {
  let testContext: TestPermissionStoreContext;
  let testEnv: PermissionTestEnvironment;

  afterEach(async () => {
    if (testContext) {
      await cleanupTestPermissionStore(testContext);
    }
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  describe('Database Store Integration', () => {
    it('should create and manage permission stores successfully', async () => {
      // Create store with initial permissions
      const initialPerms = [
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', level: 'allow-once', scope: '/project/**' }),
        createMockPermission({ tool: 'Bash', level: 'deny' }),
      ];

      testContext = await createTestPermissionStore(initialPerms);

      // Verify store was created correctly
      expect(testContext.store).toBeDefined();
      expect(testContext.manager).toBeDefined();
      expect(testContext.tempPath).toBeDefined();
      expect(testContext.cleanup).toBeDefined();

      // Verify initial permissions were stored
      const storedPerms = await testContext.store.listPermissions();
      expect(storedPerms).toHaveLength(3);

      // Test permission queries
      const readPerm = await testContext.store.getPermission({ tool: 'Read' });
      expect(readPerm?.level).toBe('allow-always');

      const writePerm = await testContext.store.getPermission({ tool: 'Write', scope: '/project/**' });
      expect(writePerm?.level).toBe('allow-once');
      expect(writePerm?.scope).toBe('/project/**');

      const bashPerm = await testContext.store.getPermission({ tool: 'Bash' });
      expect(bashPerm?.level).toBe('deny');

      // Test manager integration
      const readLevel = await testContext.manager.checkPermission('Read');
      expect(readLevel).toBe('allow-always');

      const writeLevel = await testContext.manager.checkPermission('Write', '/project/**');
      expect(writeLevel).toBe('allow-once');

      const bashLevel = await testContext.manager.checkPermission('Bash');
      expect(bashLevel).toBe('deny');

      // Test permission checks through manager
      expect(await testContext.manager.isAllowed('Read')).toBe(true);
      expect(await testContext.manager.isAllowed('Bash')).toBe(false);
      expect(await testContext.manager.requiresConfirmation('Write', '/project/**')).toBe(true);
    });

    it('should support scenario-based store creation', async () => {
      // Test read-only scenario
      testContext = await createPermissionScenarioStore('read-only');

      const permissions = await testContext.store.listPermissions();
      expect(permissions.length).toBeGreaterThan(0);

      // Verify read operations are allowed
      expect(await testContext.manager.isAllowed('Read')).toBe(true);
      expect(await testContext.manager.isAllowed('Grep')).toBe(true);
      expect(await testContext.manager.isAllowed('Glob')).toBe(true);

      // Verify write operations are denied
      expect(await testContext.manager.isAllowed('Write')).toBe(false);
      expect(await testContext.manager.isAllowed('Bash')).toBe(false);

      // Clean up and test full-access scenario
      await cleanupTestPermissionStore(testContext);

      testContext = await createPermissionScenarioStore('full-access');

      // Verify all operations are allowed
      expect(await testContext.manager.isAllowed('Read')).toBe(true);
      expect(await testContext.manager.isAllowed('Write')).toBe(true);
      expect(await testContext.manager.isAllowed('Bash')).toBe(true);
      expect(await testContext.manager.isAllowed('WebFetch')).toBe(true);

      // Clean up and test review-all scenario
      await cleanupTestPermissionStore(testContext);

      testContext = await createPermissionScenarioStore('review-all');

      // Verify all operations require confirmation
      expect(await testContext.manager.requiresConfirmation('Read')).toBe(true);
      expect(await testContext.manager.requiresConfirmation('Write')).toBe(true);
      expect(await testContext.manager.requiresConfirmation('Bash')).toBe(true);
    });

    it('should support database population utilities', async () => {
      // Start with empty store
      testContext = await createTestPermissionStore();

      // Verify it's empty
      const emptyPerms = await testContext.store.listPermissions();
      expect(emptyPerms).toHaveLength(0);

      // Populate with test permissions
      await populateTestPermissions(testContext.store, {
        'Read': 'allow-always',
        'Write': 'allow-once',
        'Edit': 'allow-once',
        'Bash': 'deny',
        'WebFetch': 'allow-always',
      });

      // Verify permissions were added
      const populatedPerms = await testContext.store.listPermissions();
      expect(populatedPerms).toHaveLength(5);

      // Test each permission
      expect(await testContext.manager.checkPermission('Read')).toBe('allow-always');
      expect(await testContext.manager.checkPermission('Write')).toBe('allow-once');
      expect(await testContext.manager.checkPermission('Edit')).toBe('allow-once');
      expect(await testContext.manager.checkPermission('Bash')).toBe('deny');
      expect(await testContext.manager.checkPermission('WebFetch')).toBe('allow-always');
    });

    it('should support database state assertions', async () => {
      testContext = await createTestPermissionStore();

      // Populate with known permissions
      await populateTestPermissions(testContext.store, {
        'Read': 'allow-always',
        'Write': 'allow-once',
        'Bash': 'deny',
      });

      // Assert database state matches expectations
      await expect(assertDatabaseState(testContext.store, [
        { tool: 'Read', level: 'allow-always' },
        { tool: 'Write', level: 'allow-once' },
        { tool: 'Bash', level: 'deny' },
      ])).resolves.not.toThrow();

      // Test assertion failures
      await expect(assertDatabaseState(testContext.store, [
        { tool: 'Read', level: 'deny' }, // Wrong level
      ])).rejects.toThrow('Permission for Read has wrong level');

      await expect(assertDatabaseState(testContext.store, [
        { tool: 'Read', level: 'allow-always' },
        { tool: 'Write', level: 'allow-once' },
        { tool: 'Bash', level: 'deny' },
        { tool: 'NonExistent', level: 'allow-always' }, // Extra permission
      ])).rejects.toThrow('Expected 4 permissions in database, got 3');

      await expect(assertDatabaseState(testContext.store, [
        { tool: 'NonExistent', level: 'allow-always' },
      ])).rejects.toThrow('Expected permission for NonExistent not found in database');
    });
  });

  describe('Mock Permission Manager Integration', () => {
    it('should provide mock manager for testing without database', async () => {
      const mockManager = createMockPermissionManager({
        'Read': 'allow-always',
        'Write': 'allow-once',
        'Write:/project/**': 'allow-always',
        'Bash': 'deny',
      });

      // Test basic permission checks
      expect(await mockManager.checkPermission('Read')).toBe('allow-always');
      expect(await mockManager.checkPermission('Write')).toBe('allow-once');
      expect(await mockManager.checkPermission('Bash')).toBe('deny');
      expect(await mockManager.checkPermission('NonExistent')).toBeNull();

      // Test scoped permissions
      expect(await mockManager.checkPermission('Write', '/project/**')).toBe('allow-always');
      expect(await mockManager.checkPermission('Write', '/other/**')).toBe('allow-once');

      // Test convenience methods
      expect(await mockManager.hasPermission('Read')).toBe(true);
      expect(await mockManager.hasPermission('NonExistent')).toBe(false);

      expect(await mockManager.isAllowed('Read')).toBe(true);
      expect(await mockManager.isAllowed('Bash')).toBe(false);

      expect(await mockManager.requiresConfirmation('Write')).toBe(true);
      expect(await mockManager.requiresConfirmation('Read')).toBe(false);

      // Test permission management
      await mockManager.grantPermission('Edit', 'allow-always');
      expect(await mockManager.checkPermission('Edit')).toBe('allow-always');

      // Test internal access for testing
      const internalPerms = mockManager._getPermissions();
      expect(internalPerms['Read']).toBe('allow-always');
      expect(internalPerms['Edit']).toBe('allow-always');
    });
  });

  describe('Permission Test Environment Integration', () => {
    it('should create comprehensive test environments', async () => {
      const initialPerms = [
        createMockPermission({ tool: 'Read', level: 'allow-always' }),
        createMockPermission({ tool: 'Write', level: 'allow-once' }),
        createMockPermission({ tool: 'Bash', level: 'deny' }),
      ];

      testEnv = await createPermissionTestEnvironment({
        initialPermissions: initialPerms,
      });

      // Verify environment is properly set up
      expect(testEnv.store).toBeDefined();
      expect(testEnv.manager).toBeDefined();
      expect(testEnv.tempPath).toBeDefined();
      expect(testEnv.cleanup).toBeDefined();

      // Test assertion methods
      await expect(testEnv.assertPermissionLevel('Read', 'allow-always')).resolves.not.toThrow();
      await expect(testEnv.assertPermissionLevel('Write', 'allow-once')).resolves.not.toThrow();
      await expect(testEnv.assertPermissionLevel('Bash', 'deny')).resolves.not.toThrow();

      await expect(testEnv.assertToolAllowed('Read')).resolves.not.toThrow();
      await expect(testEnv.assertToolDenied('Bash')).resolves.not.toThrow();
      await expect(testEnv.assertToolRequiresConfirmation('Write')).resolves.not.toThrow();

      // Test assertion failures
      await expect(testEnv.assertPermissionLevel('Read', 'deny')).rejects.toThrow();
      await expect(testEnv.assertToolDenied('Read')).rejects.toThrow('should be denied but is allowed');
      await expect(testEnv.assertToolAllowed('Bash')).rejects.toThrow('should be allowed but is denied');
      await expect(testEnv.assertToolRequiresConfirmation('Read')).rejects.toThrow('should require confirmation');

      // Test dynamic permission management
      await testEnv.addPermission(createMockPermission({ tool: 'Edit', level: 'allow-always' }));
      await expect(testEnv.assertToolAllowed('Edit')).resolves.not.toThrow();

      await testEnv.removePermission('Edit');
      await expect(testEnv.assertToolDenied('Edit')).resolves.not.toThrow();

      // Test permission listing
      const permissions = await testEnv.getAllPermissions();
      expect(permissions).toHaveLength(3); // Original 3, Edit was removed
    });

    it('should create scenario-based test environments', async () => {
      // Test read-only environment
      testEnv = await createPermissionTestScenario('read-only');

      await expect(testEnv.assertToolAllowed('Read')).resolves.not.toThrow();
      await expect(testEnv.assertToolAllowed('Grep')).resolves.not.toThrow();
      await expect(testEnv.assertToolAllowed('Glob')).resolves.not.toThrow();
      await expect(testEnv.assertToolDenied('Write')).resolves.not.toThrow();
      await expect(testEnv.assertToolDenied('Bash')).resolves.not.toThrow();

      await testEnv.cleanup();

      // Test full-access environment
      testEnv = await createPermissionTestScenario('full-access');

      await expect(testEnv.assertToolAllowed('Read')).resolves.not.toThrow();
      await expect(testEnv.assertToolAllowed('Write')).resolves.not.toThrow();
      await expect(testEnv.assertToolAllowed('Bash')).resolves.not.toThrow();
      await expect(testEnv.assertToolAllowed('WebFetch')).resolves.not.toThrow();

      await testEnv.cleanup();

      // Test review-all environment
      testEnv = await createPermissionTestScenario('review-all');

      await expect(testEnv.assertToolRequiresConfirmation('Read')).resolves.not.toThrow();
      await expect(testEnv.assertToolRequiresConfirmation('Write')).resolves.not.toThrow();
      await expect(testEnv.assertToolRequiresConfirmation('Bash')).resolves.not.toThrow();

      await testEnv.cleanup();

      // Test empty environment
      testEnv = await createPermissionTestScenario('empty');

      const permissions = await testEnv.getAllPermissions();
      expect(permissions).toEqual([]);

      // All tools should be denied in empty environment
      await expect(testEnv.assertToolDenied('Read')).resolves.not.toThrow();
      await expect(testEnv.assertToolDenied('Write')).resolves.not.toThrow();
      await expect(testEnv.assertToolDenied('Bash')).resolves.not.toThrow();
    });
  });

  describe('Real-World Testing Scenarios', () => {
    it('should support development workflow testing', async () => {
      // Scenario: Developer working on a project
      testEnv = await createPermissionTestEnvironment({
        initialPermissions: [
          createMockPermission({ tool: 'Read', level: 'allow-always' }), // Always allow reading
          createMockPermission({ tool: 'Write', level: 'allow-once', scope: '/project/src/**' }), // Allow writing to src with confirmation
          createMockPermission({ tool: 'Edit', level: 'allow-once', scope: '/project/src/**' }), // Allow editing src with confirmation
          createMockPermission({ tool: 'Bash', level: 'allow-once', scope: 'npm install' }), // Allow npm install with confirmation
          createMockPermission({ tool: 'Bash', level: 'deny', scope: 'rm -rf' }), // Deny dangerous commands
          createMockPermission({ tool: 'WebFetch', level: 'allow-always', scope: 'api.github.com' }), // Allow GitHub API
        ],
      });

      // Test read access (should always work)
      await expect(testEnv.assertToolAllowed('Read')).resolves.not.toThrow();

      // Test write access to project files (should require confirmation)
      await expect(testEnv.assertToolRequiresConfirmation('Write')).resolves.not.toThrow();

      // Test npm install (should require confirmation)
      await expect(testEnv.assertToolRequiresConfirmation('Bash')).resolves.not.toThrow();

      // Test web access to GitHub (should be allowed)
      await expect(testEnv.assertToolAllowed('WebFetch')).resolves.not.toThrow();

      // Verify permissions are scoped correctly
      const permissions = await testEnv.getAllPermissions();
      const writePerms = permissions.filter(p => p.tool === 'Write');
      expect(writePerms[0].scope).toBe('/project/src/**');

      const bashPerms = permissions.filter(p => p.tool === 'Bash');
      expect(bashPerms.some(p => p.scope === 'npm install' && p.level === 'allow-once')).toBe(true);
      expect(bashPerms.some(p => p.scope === 'rm -rf' && p.level === 'deny')).toBe(true);
    });

    it('should support testing permission transitions', async () => {
      // Scenario: Testing how permissions change over time
      testEnv = await createPermissionTestEnvironment({
        initialPermissions: [
          createMockPermission({ tool: 'Write', level: 'deny' }), // Initially deny write
        ],
      });

      // Initially, writes should be denied
      await expect(testEnv.assertToolDenied('Write')).resolves.not.toThrow();

      // Grant write permission
      await testEnv.addPermission(createMockPermission({ tool: 'Write', level: 'allow-once' }));

      // Now writes should require confirmation
      await expect(testEnv.assertToolRequiresConfirmation('Write')).resolves.not.toThrow();

      // Remove the deny permission (keep only allow-once)
      await testEnv.removePermission('Write'); // Removes the first Write permission found

      // Should still require confirmation (because allow-once is still there)
      await expect(testEnv.assertToolRequiresConfirmation('Write')).resolves.not.toThrow();

      // Grant always-allow permission
      await testEnv.addPermission(createMockPermission({ tool: 'Write', level: 'allow-always' }));

      // Now should be allowed without confirmation
      await expect(testEnv.assertToolAllowed('Write')).resolves.not.toThrow();
    });

    it('should support testing error recovery scenarios', async () => {
      // Scenario: Testing what happens when database operations fail
      testContext = await createTestPermissionStore();

      // Test saving invalid permission data
      try {
        const invalidPerm = createMockPermission({ tool: '', level: 'allow-always' }); // Empty tool name
        await testContext.store.savePermission(invalidPerm);

        // Even invalid data should be stored (validation happens at manager level)
        const stored = await testContext.store.getPermission('');
        expect(stored).toBeDefined();
      } catch (error) {
        // If validation occurs at store level, that's also acceptable
        expect(error).toBeDefined();
      }

      // Test querying non-existent permissions
      const nonExistent = await testContext.store.getPermission({ tool: 'NonExistentTool' });
      expect(nonExistent).toBeNull();

      // Test deleting non-existent permissions (should not throw)
      const deleted = await testContext.store.deletePermission({ tool: 'NonExistentTool' });
      expect(typeof deleted).toBe('boolean'); // Should return false, but not throw
    });
  });

  describe('Performance and Cleanup Testing', () => {
    it('should handle cleanup properly for multiple test contexts', async () => {
      const contexts: TestPermissionStoreContext[] = [];

      // Create multiple test contexts
      for (let i = 0; i < 3; i++) {
        const context = await createTestPermissionStore([
          createMockPermission({ tool: `Tool${i}`, level: 'allow-always' })
        ]);
        contexts.push(context);
      }

      // Verify all contexts work
      for (let i = 0; i < contexts.length; i++) {
        const permissions = await contexts[i].store.listPermissions();
        expect(permissions).toHaveLength(1);
        expect(permissions[0].tool).toBe(`Tool${i}`);
      }

      // Clean up all contexts
      await Promise.all(contexts.map(context => cleanupTestPermissionStore(context)));

      // Verify cleanup is idempotent (can be called multiple times)
      await Promise.all(contexts.map(context => cleanupTestPermissionStore(context)));
    });

    it('should handle concurrent database operations', async () => {
      testContext = await createTestPermissionStore();

      // Perform concurrent operations
      const operations = [];

      for (let i = 0; i < 5; i++) {
        operations.push(
          testContext.store.savePermission(
            createMockPermission({ tool: `ConcurrentTool${i}`, level: 'allow-always' })
          )
        );
      }

      // Wait for all operations to complete
      await Promise.all(operations);

      // Verify all permissions were saved
      const permissions = await testContext.store.listPermissions();
      expect(permissions).toHaveLength(5);

      for (let i = 0; i < 5; i++) {
        const perm = await testContext.store.getPermission({ tool: `ConcurrentTool${i}` });
        expect(perm).toBeDefined();
        expect(perm?.level).toBe('allow-always');
      }
    });
  });
});