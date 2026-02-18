import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionStore } from '../permission-store';
import { Permission, PermissionLevel, PermissionQuery } from '@apexcli/core';

/**
 * Integration tests for PermissionStore to verify real-world scenarios
 * and interactions with the actual SQLite database
 */
describe('PermissionStore Integration Tests', () => {
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-permission-integration-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });
    store = new PermissionStore(testDir);
    await store.initialize();
  });

  afterEach(() => {
    if (store) {
      store.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Real-world permission workflows', () => {
    it('should handle complete file management workflow', async () => {
      // Scenario: User wants to edit a project's TypeScript files
      const permissions: Permission[] = [
        {
          tool: 'Read',
          scope: '/src/**/*.ts',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'Write',
          scope: '/src/**/*.ts',
          level: 'allow-once',
          expiry: new Date(Date.now() + 3600000), // 1 hour
          createdAt: new Date(),
        },
        {
          tool: 'Edit',
          scope: '/src/components/*.tsx',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'Write',
          scope: '/dist/**/*',
          level: 'deny',
          createdAt: new Date(),
        },
      ];

      // Save all permissions
      for (const permission of permissions) {
        await store.savePermission(permission);
      }

      // Verify specific file operations
      const readPermission = await store.getPermission({ tool: 'Read', scope: '/src/**/*.ts' });
      expect(readPermission?.level).toBe('allow-always');

      const writePermission = await store.getPermission({ tool: 'Write', scope: '/src/**/*.ts' });
      expect(writePermission?.level).toBe('allow-once');
      expect(writePermission?.expiry).toBeDefined();

      const editPermission = await store.getPermission({ tool: 'Edit', scope: '/src/components/*.tsx' });
      expect(editPermission?.level).toBe('allow-always');

      const distWritePermission = await store.getPermission({ tool: 'Write', scope: '/dist/**/*' });
      expect(distWritePermission?.level).toBe('deny');

      // List permissions by tool
      const writePermissions = await store.listPermissions({ tool: 'Write' });
      expect(writePermissions).toHaveLength(2);
      expect(writePermissions.map(p => p.level)).toContain('allow-once');
      expect(writePermissions.map(p => p.level)).toContain('deny');
    });

    it('should handle shell command permission scenarios', async () => {
      // Scenario: Development workflow with various shell commands
      const shellPermissions: Permission[] = [
        {
          tool: 'Bash',
          scope: 'npm install',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'Bash',
          scope: 'npm run build',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'Bash',
          scope: 'git commit',
          level: 'allow-once',
          expiry: new Date(Date.now() + 300000), // 5 minutes
          createdAt: new Date(),
        },
        {
          tool: 'Bash',
          scope: 'rm -rf',
          level: 'deny',
          createdAt: new Date(),
        },
        {
          tool: 'Bash',
          scope: 'sudo',
          level: 'deny',
          createdAt: new Date(),
        },
      ];

      // Save all shell permissions
      for (const permission of shellPermissions) {
        await store.savePermission(permission);
      }

      // Test safe operations
      const npmInstall = await store.getPermission({ tool: 'Bash', scope: 'npm install' });
      expect(npmInstall?.level).toBe('allow-always');

      const npmBuild = await store.getPermission({ tool: 'Bash', scope: 'npm run build' });
      expect(npmBuild?.level).toBe('allow-always');

      // Test temporary permission
      const gitCommit = await store.getPermission({ tool: 'Bash', scope: 'git commit' });
      expect(gitCommit?.level).toBe('allow-once');
      expect(gitCommit?.expiry).toBeDefined();

      // Test denied operations
      const rmCommand = await store.getPermission({ tool: 'Bash', scope: 'rm -rf' });
      expect(rmCommand?.level).toBe('deny');

      const sudoCommand = await store.getPermission({ tool: 'Bash', scope: 'sudo' });
      expect(sudoCommand?.level).toBe('deny');

      // List denied permissions
      const deniedPermissions = await store.listPermissions({ level: 'deny' });
      expect(deniedPermissions).toHaveLength(2);
      expect(deniedPermissions.map(p => p.scope)).toContain('rm -rf');
      expect(deniedPermissions.map(p => p.scope)).toContain('sudo');
    });

    it('should handle web access permission scenarios', async () => {
      // Scenario: Controlled web access for AI agents
      const webPermissions: Permission[] = [
        {
          tool: 'WebSearch',
          scope: 'programming questions',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'WebFetch',
          scope: 'https://api.github.com/*',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'WebFetch',
          scope: 'https://api.openai.com/*',
          level: 'allow-once',
          expiry: new Date(Date.now() + 1800000), // 30 minutes
          createdAt: new Date(),
        },
        {
          tool: 'WebFetch',
          scope: 'http://*',
          level: 'deny',
          createdAt: new Date(),
        },
      ];

      // Save web permissions
      for (const permission of webPermissions) {
        await store.savePermission(permission);
      }

      // Test allowed operations
      const webSearch = await store.getPermission({ tool: 'WebSearch', scope: 'programming questions' });
      expect(webSearch?.level).toBe('allow-always');

      const githubApi = await store.getPermission({ tool: 'WebFetch', scope: 'https://api.github.com/*' });
      expect(githubApi?.level).toBe('allow-always');

      // Test temporary permission
      const openaiApi = await store.getPermission({ tool: 'WebFetch', scope: 'https://api.openai.com/*' });
      expect(openaiApi?.level).toBe('allow-once');
      expect(openaiApi?.expiry).toBeDefined();

      // Test denied HTTP access
      const httpAccess = await store.getPermission({ tool: 'WebFetch', scope: 'http://*' });
      expect(httpAccess?.level).toBe('deny');

      // List all WebFetch permissions
      const webFetchPermissions = await store.listPermissions({ tool: 'WebFetch' });
      expect(webFetchPermissions).toHaveLength(3);
    });
  });

  describe('Permission lifecycle management', () => {
    it('should handle permission escalation and downgrade scenarios', async () => {
      const toolName = 'Edit';
      const scope = '/sensitive/config.json';

      // Start with deny
      await store.savePermission({
        tool: toolName,
        scope,
        level: 'deny',
        createdAt: new Date(),
      });

      let permission = await store.getPermission({ tool: toolName, scope });
      expect(permission?.level).toBe('deny');

      // Escalate to allow-once
      await store.savePermission({
        tool: toolName,
        scope,
        level: 'allow-once',
        expiry: new Date(Date.now() + 600000), // 10 minutes
        createdAt: new Date(),
      });

      permission = await store.getPermission({ tool: toolName, scope });
      expect(permission?.level).toBe('allow-once');
      expect(permission?.expiry).toBeDefined();

      // Escalate to allow-always
      await store.savePermission({
        tool: toolName,
        scope,
        level: 'allow-always',
        createdAt: new Date(),
      });

      permission = await store.getPermission({ tool: toolName, scope });
      expect(permission?.level).toBe('allow-always');
      expect(permission?.expiry).toBeUndefined(); // No expiry for always

      // Downgrade back to deny
      await store.savePermission({
        tool: toolName,
        scope,
        level: 'deny',
        createdAt: new Date(),
      });

      permission = await store.getPermission({ tool: toolName, scope });
      expect(permission?.level).toBe('deny');
    });

    it('should handle bulk permission management', async () => {
      // Create a large number of permissions for different tools
      const toolNames = ['Read', 'Write', 'Edit', 'Bash', 'WebFetch', 'WebSearch', 'Grep', 'Glob'];
      const levels: PermissionLevel[] = ['allow-always', 'allow-once', 'deny'];
      const scopes = [undefined, '/**/*', '/src/**', '/specific/file.txt'];

      const permissions: Permission[] = [];

      for (const tool of toolNames) {
        for (const level of levels) {
          for (const scope of scopes) {
            permissions.push({
              tool: `${tool}_${level}_${scope || 'global'}`,
              scope,
              level,
              createdAt: new Date(Date.now() + permissions.length),
              expiry: level === 'allow-once' ? new Date(Date.now() + 3600000) : undefined,
            });
          }
        }
      }

      // Save all permissions (should be 8 * 3 * 4 = 96 permissions)
      const savePromises = permissions.map(p => store.savePermission(p));
      await Promise.all(savePromises);

      // Verify count
      const allPermissions = await store.listPermissions({ includeExpired: true });
      expect(allPermissions.length).toBe(permissions.length);

      // Test filtering by level
      const allowAlwaysPermissions = await store.listPermissions({ level: 'allow-always' });
      expect(allowAlwaysPermissions).toHaveLength(32); // 8 tools * 4 scopes

      const allowOncePermissions = await store.listPermissions({ level: 'allow-once' });
      expect(allowOncePermissions).toHaveLength(32);

      const denyPermissions = await store.listPermissions({ level: 'deny' });
      expect(denyPermissions).toHaveLength(32);

      // Test bulk clearing by tool pattern
      let clearedCount = 0;
      for (const tool of toolNames) {
        const toolPermissions = await store.listPermissions({ tool: `${tool}_allow-always_global` });
        if (toolPermissions.length > 0) {
          const cleared = await store.clearPermissionsForTool(`${tool}_allow-always_global`);
          clearedCount += cleared;
        }
      }

      expect(clearedCount).toBe(8); // One for each tool

      // Verify remaining count
      const remainingPermissions = await store.listPermissions({ includeExpired: true });
      expect(remainingPermissions.length).toBe(permissions.length - clearedCount);
    });
  });

  describe('Database persistence and recovery', () => {
    it('should persist permissions across store instances', async () => {
      // Save some permissions
      const testPermissions: Permission[] = [
        {
          tool: 'PersistenceTest1',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'PersistenceTest2',
          scope: '/test/path',
          level: 'allow-once',
          expiry: new Date(Date.now() + 3600000),
          createdAt: new Date(),
        },
      ];

      for (const permission of testPermissions) {
        await store.savePermission(permission);
      }

      // Close the store
      store.close();

      // Create a new store instance pointing to the same directory
      const newStore = new PermissionStore(testDir);
      await newStore.initialize();

      // Verify permissions persisted
      const permission1 = await newStore.getPermission({ tool: 'PersistenceTest1' });
      expect(permission1?.level).toBe('allow-always');

      const permission2 = await newStore.getPermission({ tool: 'PersistenceTest2', scope: '/test/path' });
      expect(permission2?.level).toBe('allow-once');
      expect(permission2?.expiry).toBeDefined();

      // List should show both permissions
      const allPermissions = await newStore.listPermissions({ includeExpired: true });
      expect(allPermissions).toHaveLength(2);

      newStore.close();
    });

    it('should handle database initialization edge cases', async () => {
      // Close existing store
      store.close();

      // Test multiple initialization calls
      const testStore = new PermissionStore(testDir);
      await testStore.initialize();

      // Second initialization should not cause issues
      await testStore.initialize();

      // Should still work normally
      await testStore.savePermission({
        tool: 'InitTest',
        level: 'allow-always',
        createdAt: new Date(),
      });

      const retrieved = await testStore.getPermission({ tool: 'InitTest' });
      expect(retrieved?.tool).toBe('InitTest');

      testStore.close();
    });
  });

  describe('Concurrent access patterns', () => {
    it('should handle rapid concurrent permission operations', async () => {
      const concurrentOperations = 100;
      const promises: Promise<void>[] = [];

      // Create many concurrent save operations
      for (let i = 0; i < concurrentOperations; i++) {
        const permission: Permission = {
          tool: `ConcurrentTool${i}`,
          scope: i % 2 === 0 ? `/path/${i}` : undefined,
          level: i % 3 === 0 ? 'allow-always' : i % 3 === 1 ? 'allow-once' : 'deny',
          createdAt: new Date(Date.now() + i),
        };

        promises.push(store.savePermission(permission));
      }

      // Wait for all operations to complete
      await Promise.all(promises);

      // Verify all permissions were saved
      const allPermissions = await store.listPermissions({ includeExpired: true });
      expect(allPermissions.length).toBeGreaterThanOrEqual(concurrentOperations);

      // Create concurrent read operations
      const readPromises: Promise<Permission | null>[] = [];
      for (let i = 0; i < concurrentOperations; i++) {
        const query: PermissionQuery = {
          tool: `ConcurrentTool${i}`,
          scope: i % 2 === 0 ? `/path/${i}` : undefined,
        };
        readPromises.push(store.getPermission(query));
      }

      const results = await Promise.all(readPromises);

      // All reads should succeed
      expect(results.filter(r => r !== null)).toHaveLength(concurrentOperations);

      // Verify data integrity
      results.forEach((result, index) => {
        if (result) {
          expect(result.tool).toBe(`ConcurrentTool${index}`);
        }
      });
    });
  });

  describe('Performance validation', () => {
    it('should handle large-scale permission operations efficiently', async () => {
      const largeScale = 10000;
      const startTime = Date.now();

      // Create many permissions rapidly
      const permissions: Permission[] = [];
      for (let i = 0; i < largeScale; i++) {
        permissions.push({
          tool: `ScaleTool${i}`,
          scope: `/scale/path/${i % 100}/**/*`, // Some overlap for realistic scenario
          level: i % 3 === 0 ? 'allow-always' : i % 3 === 1 ? 'allow-once' : 'deny',
          createdAt: new Date(Date.now() + i),
          expiry: i % 5 === 0 ? new Date(Date.now() + i + 86400000) : undefined,
        });
      }

      // Batch save operations
      const batchSize = 100;
      for (let i = 0; i < largeScale; i += batchSize) {
        const batch = permissions.slice(i, i + batchSize);
        const batchPromises = batch.map(p => store.savePermission(p));
        await Promise.all(batchPromises);
      }

      const saveTime = Date.now() - startTime;

      // Performance check - should complete in reasonable time
      expect(saveTime).toBeLessThan(30000); // 30 seconds max

      // Verify count
      const allPermissions = await store.listPermissions({ includeExpired: true });
      expect(allPermissions.length).toBe(largeScale);

      // Test query performance
      const queryStartTime = Date.now();

      // Random queries
      const queryPromises: Promise<Permission | null>[] = [];
      for (let i = 0; i < 1000; i++) {
        const randomIndex = Math.floor(Math.random() * largeScale);
        queryPromises.push(store.getPermission({
          tool: `ScaleTool${randomIndex}`,
          scope: `/scale/path/${randomIndex % 100}/**/*`,
        }));
      }

      const queryResults = await Promise.all(queryPromises);
      const queryTime = Date.now() - queryStartTime;

      expect(queryTime).toBeLessThan(5000); // 5 seconds max for 1000 queries
      expect(queryResults.filter(r => r !== null).length).toBeGreaterThan(990); // Most should succeed
    });
  });
});