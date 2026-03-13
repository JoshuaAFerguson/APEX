import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rmdir } from 'fs/promises';
import { PermissionStore } from '../packages/orchestrator/src/permission-store.js';
import { PermissionManager } from '../packages/orchestrator/src/permission-manager.js';
import type {
  Permission,
  ExtendedPermission,
  PermissionLevel,
  PermissionQuery,
  DirectoryAccessConfig,
  FilesystemToolConfig,
  ShellToolConfig,
  WebToolConfig,
  BrowserToolConfig,
} from '../packages/core/src/types.js';

/**
 * Enhanced stress tests for v0.5.0 Permission System
 * Tests high load scenarios, concurrent access, performance under stress,
 * and complex permission interactions
 */

describe('v0.5.0 Permission System Stress Tests', () => {
  let tempDir: string;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-stress-test-'));
    permissionStore = new PermissionStore(tempDir);
    await permissionStore.initialize();
    permissionManager = new PermissionManager(permissionStore);
  });

  afterEach(async () => {
    permissionStore.close();
    await rmdir(tempDir, { recursive: true });
  });

  describe('High Volume Permission Operations', () => {
    it('should handle thousands of permission grants efficiently', async () => {
      const startTime = performance.now();
      const batchSize = 1000;

      // Create large batch of permissions
      const permissions: ExtendedPermission[] = Array(batchSize).fill(null).map((_, i) => ({
        tool: `tool-${i}`,
        scope: i % 10 === 0 ? `scope-${Math.floor(i / 10)}` : undefined,
        level: (['allow-always', 'allow-once', 'deny'] as PermissionLevel[])[i % 3],
        createdAt: new Date(Date.now() + i * 1000),
        expiry: i % 5 === 0 ? new Date(Date.now() + 3600000) : undefined,
        config: i % 7 === 0 ? {
          enabled: true,
          timeout: 5000 + (i % 1000),
          requireConfirmation: i % 3 === 0,
          rateLimitPerMinute: 10 + (i % 90),
          metadata: {
            batchIndex: i,
            category: `category-${i % 20}`,
            priority: i % 5,
          },
        } : undefined,
        grantReason: i % 4 === 0 ? `Automated grant for tool-${i}` : undefined,
        grantedBy: ['user', 'admin', 'system'][i % 3],
        tags: i % 6 === 0 ? [`tag-${i % 10}`, `batch-${Math.floor(i / 100)}`] : [],
      }));

      // Save all permissions
      for (const permission of permissions) {
        await permissionStore.saveExtendedPermission(permission);
      }

      const saveTime = performance.now();
      console.log(`Saved ${batchSize} permissions in ${saveTime - startTime}ms`);

      // Test bulk retrieval performance
      const retrievalStart = performance.now();
      const retrievedPermissions = await permissionStore.listExtendedPermissions({});
      const retrievalTime = performance.now();

      console.log(`Retrieved ${retrievedPermissions.length} permissions in ${retrievalTime - retrievalStart}ms`);

      expect(retrievedPermissions).toHaveLength(batchSize);
      expect(saveTime - startTime).toBeLessThan(10000); // Under 10 seconds
      expect(retrievalTime - retrievalStart).toBeLessThan(2000); // Under 2 seconds
    }, 30000);

    it('should handle rapid permission queries without performance degradation', async () => {
      // Set up base permissions
      const basePermissions = Array(500).fill(null).map((_, i) => ({
        tool: `QueryTool${i % 50}`,
        scope: i % 10 === 0 ? `query-scope-${i}` : undefined,
        level: 'allow-always' as PermissionLevel,
        createdAt: new Date(),
        config: {
          enabled: true,
          timeout: 1000 + (i % 5000),
        },
        tags: [`performance-test`, `batch-${Math.floor(i / 100)}`],
      }));

      for (const permission of basePermissions) {
        await permissionStore.saveExtendedPermission(permission);
      }

      // Perform rapid queries
      const queryCount = 1000;
      const queries: PermissionQuery[] = Array(queryCount).fill(null).map((_, i) => ({
        tool: `QueryTool${i % 50}`,
        scope: i % 20 === 0 ? `query-scope-${i * 2}` : undefined,
      }));

      const queryStart = performance.now();

      // Execute queries concurrently
      const results = await Promise.all(
        queries.map(query => permissionStore.getExtendedPermission(query))
      );

      const queryTime = performance.now();

      console.log(`Executed ${queryCount} queries in ${queryTime - queryStart}ms`);

      // Verify results
      const foundResults = results.filter(result => result !== null);
      expect(foundResults.length).toBeGreaterThan(queryCount * 0.8); // At least 80% should find results
      expect(queryTime - queryStart).toBeLessThan(5000); // Under 5 seconds
    }, 15000);

    it('should handle complex permission filtering efficiently', async () => {
      // Create permissions with various attributes for complex filtering
      const complexPermissions: ExtendedPermission[] = Array(2000).fill(null).map((_, i) => ({
        tool: ['Read', 'Write', 'Edit', 'Bash', 'WebFetch', 'Grep'][i % 6],
        scope: i % 5 === 0 ? `project-${Math.floor(i / 100)}` : undefined,
        level: (['allow-always', 'allow-once', 'deny'] as PermissionLevel[])[i % 3],
        createdAt: new Date(Date.now() - (i * 60000)), // Spread over time
        expiry: i % 7 === 0 ? new Date(Date.now() + (i * 3600000)) : undefined,
        config: {
          enabled: i % 3 !== 0,
          timeout: 1000 + (i % 10000),
          requireConfirmation: i % 4 === 0,
          rateLimitPerMinute: 1 + (i % 100),
          metadata: {
            department: ['engineering', 'qa', 'devops', 'security'][i % 4],
            environment: ['dev', 'staging', 'prod'][i % 3],
            team: `team-${i % 10}`,
            priority: i % 5,
            automated: i % 8 === 0,
          },
        },
        grantReason: i % 6 === 0 ? `Complex scenario ${i}` : undefined,
        grantedBy: ['user', 'admin', 'system', 'automated'][i % 4],
        tags: [
          `env-${['dev', 'staging', 'prod'][i % 3]}`,
          `dept-${['engineering', 'qa', 'devops', 'security'][i % 4]}`,
          `priority-${i % 5}`,
          ...(i % 10 === 0 ? [`special-${i}`] : []),
        ],
      }));

      // Save complex permissions
      for (const permission of complexPermissions) {
        await permissionStore.saveExtendedPermission(permission);
      }

      // Test various complex filters
      const filterTests = [
        { tags: ['env-dev'], expectedMin: 600 },
        { grantedBy: 'admin', expectedMin: 400 },
        { level: 'allow-always', expectedMin: 600 },
        { hasConfig: true, expectedMin: 1900 },
        { tags: ['dept-engineering'], grantedBy: 'user', expectedMin: 100 },
        { level: 'allow-always', hasConfig: true, tags: ['priority-4'], expectedMin: 50 },
      ];

      for (const filter of filterTests) {
        const filterStart = performance.now();
        const results = await permissionStore.listExtendedPermissions(filter);
        const filterTime = performance.now();

        console.log(`Filter ${JSON.stringify(filter)} returned ${results.length} results in ${filterTime - filterStart}ms`);

        expect(results.length).toBeGreaterThanOrEqual(filter.expectedMin);
        expect(filterTime - filterStart).toBeLessThan(1000); // Under 1 second per filter
      }
    }, 20000);
  });

  describe('Concurrent Access Stress Tests', () => {
    it('should handle concurrent read/write operations safely', async () => {
      const concurrentOperations = 100;
      const basePermissions = Array(50).fill(null).map((_, i) => ({
        tool: `ConcurrentTool${i}`,
        level: 'allow-always' as PermissionLevel,
        createdAt: new Date(),
        config: { enabled: true, timeout: 5000 },
        tags: ['concurrent-test'],
      }));

      // Initial setup
      for (const permission of basePermissions) {
        await permissionStore.saveExtendedPermission(permission);
      }

      // Create concurrent operations (reads, writes, updates, deletes)
      const operations = Array(concurrentOperations).fill(null).map((_, i) => {
        const operationType = ['read', 'write', 'update', 'delete'][i % 4];
        const toolIndex = i % 50;

        switch (operationType) {
          case 'read':
            return () => permissionStore.getExtendedPermission({ tool: `ConcurrentTool${toolIndex}` });

          case 'write':
            return () => permissionStore.saveExtendedPermission({
              tool: `NewConcurrentTool${i}`,
              level: 'allow-once' as PermissionLevel,
              createdAt: new Date(),
              tags: [`write-${i}`],
            });

          case 'update':
            return () => permissionStore.saveExtendedPermission({
              tool: `ConcurrentTool${toolIndex}`,
              level: 'deny' as PermissionLevel,
              createdAt: new Date(),
              config: { enabled: false, timeout: 1000 },
              tags: [`updated-${i}`],
            });

          case 'delete':
            return () => permissionStore.revokePermission({ tool: `ConcurrentTool${toolIndex}` });

          default:
            return () => Promise.resolve(null);
        }
      });

      // Execute all operations concurrently
      const concurrentStart = performance.now();
      const results = await Promise.allSettled(operations.map(op => op()));
      const concurrentTime = performance.now();

      console.log(`Completed ${concurrentOperations} concurrent operations in ${concurrentTime - concurrentStart}ms`);

      // Analyze results
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      console.log(`Successful: ${successful}, Failed: ${failed}`);

      // Should have high success rate
      expect(successful / concurrentOperations).toBeGreaterThan(0.95);
      expect(concurrentTime - concurrentStart).toBeLessThan(10000); // Under 10 seconds
    }, 15000);

    it('should maintain data consistency under concurrent access', async () => {
      const toolName = 'ConsistencyTestTool';
      const updateCount = 100;

      // Initial permission
      await permissionStore.saveExtendedPermission({
        tool: toolName,
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          enabled: true,
          timeout: 5000,
          metadata: { counter: 0 },
        },
        tags: ['consistency-test'],
      });

      // Concurrent updates to the same permission
      const concurrentUpdates = Array(updateCount).fill(null).map((_, i) =>
        permissionStore.saveExtendedPermission({
          tool: toolName,
          level: 'allow-always',
          createdAt: new Date(),
          config: {
            enabled: true,
            timeout: 5000 + i,
            metadata: { counter: i + 1, updateId: `update-${i}` },
          },
          tags: ['consistency-test', `update-${i}`],
        })
      );

      await Promise.all(concurrentUpdates);

      // Verify final state
      const finalPermission = await permissionStore.getExtendedPermission({ tool: toolName });
      expect(finalPermission).toBeDefined();
      expect(finalPermission!.tool).toBe(toolName);
      expect(finalPermission!.config?.metadata?.counter).toBeGreaterThan(0);
      expect(finalPermission!.tags).toContain('consistency-test');
    });

    it('should handle concurrent permission checks efficiently', async () => {
      // Set up permissions for permission checks
      const tools = Array(20).fill(null).map((_, i) => `CheckTool${i}`);
      const scopes = Array(10).fill(null).map((_, i) => `scope-${i}`);

      for (const tool of tools) {
        for (const scope of scopes) {
          await permissionStore.saveExtendedPermission({
            tool,
            scope,
            level: 'allow-always',
            createdAt: new Date(),
            config: { enabled: true },
            tags: ['check-test'],
          });
        }
      }

      // Perform concurrent permission checks
      const checkCount = 1000;
      const permissionChecks = Array(checkCount).fill(null).map((_, i) => {
        const tool = tools[i % tools.length];
        const scope = scopes[i % scopes.length];
        return permissionManager.checkPermission(tool, { scope });
      });

      const checkStart = performance.now();
      const checkResults = await Promise.all(permissionChecks);
      const checkTime = performance.now();

      console.log(`Performed ${checkCount} permission checks in ${checkTime - checkStart}ms`);

      // All checks should succeed
      const allowedCount = checkResults.filter(result => result.allowed).length;
      expect(allowedCount).toBe(checkCount);
      expect(checkTime - checkStart).toBeLessThan(3000); // Under 3 seconds
    });
  });

  describe('Memory and Resource Stress Tests', () => {
    it('should handle large permission configurations without memory leaks', async () => {
      const largeConfigSize = 1000;

      // Create permissions with very large configurations
      const largeConfig: FilesystemToolConfig = {
        enabled: true,
        timeout: 10000,
        requireConfirmation: false,
        rateLimitPerMinute: 100,
        directoryAccess: {
          allowlist: Array(largeConfigSize).fill(null).map((_, i) => `/project/src/module-${i}/**`),
          blocklist: Array(largeConfigSize / 2).fill(null).map((_, i) => `/project/src/module-${i}/secrets/**`),
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 20,
        },
        maxFileSize: 10485760,
        allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.yaml', '.yml'],
        blockedExtensions: ['.exe', '.bin', '.so', '.dll', '.dylib'],
        symlinkResolution: {
          follow: true,
          maxDepth: 5,
          detectCycles: true,
        },
        metadata: {
          description: 'Large filesystem configuration for stress testing'.repeat(100),
          patterns: Array(largeConfigSize).fill(null).map((_, i) => ({
            pattern: `pattern-${i}`,
            description: `Pattern ${i} for testing large configs`,
            priority: i % 10,
            enabled: i % 3 === 0,
          })),
          rules: Array(500).fill(null).map((_, i) => ({
            id: `rule-${i}`,
            condition: `condition-${i}`,
            action: ['allow', 'deny', 'prompt'][i % 3],
            reason: `Rule ${i} for comprehensive testing`,
          })),
        },
      };

      // Create multiple permissions with large configs
      const largePermissions = Array(50).fill(null).map((_, i) => ({
        tool: `LargeTool${i}`,
        level: 'allow-always' as PermissionLevel,
        createdAt: new Date(),
        config: largeConfig,
        grantReason: `Large configuration test for tool ${i}`,
        grantedBy: 'stress-test',
        tags: Array(20).fill(null).map((_, j) => `large-tag-${i}-${j}`),
      }));

      const startMemory = process.memoryUsage();

      // Save all large permissions
      for (const permission of largePermissions) {
        await permissionStore.saveExtendedPermission(permission);
      }

      // Test retrieval
      for (let i = 0; i < 50; i++) {
        const retrieved = await permissionStore.getExtendedPermission({ tool: `LargeTool${i}` });
        expect(retrieved).toBeDefined();
        expect(retrieved!.config).toBeDefined();
        const config = retrieved!.config as FilesystemToolConfig;
        expect(config.directoryAccess?.allowlist).toHaveLength(largeConfigSize);
      }

      const endMemory = process.memoryUsage();
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;

      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);

      // Memory increase should be reasonable (under 500MB for this test)
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
    }, 30000);

    it('should handle permission expiration cleanup efficiently', async () => {
      const expiredCount = 5000;
      const activeCount = 1000;

      // Create many expired permissions
      const expiredPermissions = Array(expiredCount).fill(null).map((_, i) => ({
        tool: `ExpiredTool${i}`,
        level: 'allow-once' as PermissionLevel,
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
        expiry: new Date(Date.now() - 3600000), // 1 hour ago (expired)
        tags: ['expired-test'],
      }));

      // Create some active permissions
      const activePermissions = Array(activeCount).fill(null).map((_, i) => ({
        tool: `ActiveTool${i}`,
        level: 'allow-always' as PermissionLevel,
        createdAt: new Date(),
        expiry: new Date(Date.now() + 3600000), // 1 hour from now
        tags: ['active-test'],
      }));

      // Save all permissions
      for (const permission of [...expiredPermissions, ...activePermissions]) {
        await permissionStore.saveExtendedPermission(permission);
      }

      // Test cleanup performance
      const cleanupStart = performance.now();
      const clearedCount = await permissionStore.clearExpired();
      const cleanupTime = performance.now();

      console.log(`Cleared ${clearedCount} expired permissions in ${cleanupTime - cleanupStart}ms`);

      expect(clearedCount).toBe(expiredCount);
      expect(cleanupTime - cleanupStart).toBeLessThan(5000); // Under 5 seconds

      // Verify active permissions remain
      const remainingPermissions = await permissionStore.listExtendedPermissions({});
      expect(remainingPermissions).toHaveLength(activeCount);
    }, 20000);

    it('should handle complex directory access patterns efficiently', async () => {
      const complexPatterns = [
        // Deeply nested patterns
        '/project/src/**/*.{ts,tsx,js,jsx}',
        '/project/tests/**/fixtures/**/*.{json,yaml,yml}',
        '/project/docs/**/images/**/*.{png,jpg,gif,svg}',
        // Exclusion patterns
        '!/project/src/**/*.(test|spec).{ts,tsx,js,jsx}',
        '!/project/**/node_modules/**',
        '!/project/**/.git/**',
        // Complex glob patterns
        '/project/{src,lib,types}/**/*.ts',
        '/project/packages/*/src/**/*.{ts,tsx}',
        '/project/apps/{web,mobile}/src/**/*.{ts,tsx}',
        // Conditional patterns
        '/project/src/**/*.ts?(x)',
        '/project/tests/**/__tests__/**/*.{test,spec}.{ts,tsx}',
        '/project/config/**/*.{json,js,ts}',
      ];

      const complexDirectoryAccess: DirectoryAccessConfig = {
        allowlist: complexPatterns,
        blocklist: [
          '/project/src/**/*.d.ts',
          '/project/**/secrets/**',
          '/project/**/.env*',
          '/project/**/coverage/**',
          '/project/**/dist/**',
          '/project/**/build/**',
        ],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 15,
      };

      // Create many permissions with complex directory access
      const complexPermissions = Array(200).fill(null).map((_, i) => ({
        tool: `ComplexTool${i}`,
        level: 'allow-always' as PermissionLevel,
        createdAt: new Date(),
        config: {
          enabled: true,
          timeout: 5000,
          directoryAccess: {
            ...complexDirectoryAccess,
            allowlist: [
              ...complexDirectoryAccess.allowlist!,
              `/project/tool-${i}/src/**/*.ts`,
              `/project/modules/tool-${i}/**/*.{ts,tsx}`,
            ],
          },
          metadata: {
            toolIndex: i,
            complexity: 'high',
            patterns: complexPatterns.length + 2,
          },
        } as FilesystemToolConfig,
        tags: ['complex-patterns', `tool-${i}`],
      }));

      const complexStart = performance.now();

      // Save complex permissions
      for (const permission of complexPermissions) {
        await permissionStore.saveExtendedPermission(permission);
      }

      // Test directory access retrieval
      for (let i = 0; i < 200; i += 10) {
        const directoryAccess = await permissionStore.getDirectoryAccess({ tool: `ComplexTool${i}` });
        expect(directoryAccess).toBeDefined();
        expect(directoryAccess!.allowlist!.length).toBeGreaterThan(complexPatterns.length);
      }

      const complexTime = performance.now();

      console.log(`Handled ${complexPermissions.length} complex permissions in ${complexTime - complexStart}ms`);

      expect(complexTime - complexStart).toBeLessThan(15000); // Under 15 seconds
    });
  });

  describe('Edge Case Stress Tests', () => {
    it('should handle rapid permission level changes', async () => {
      const toolName = 'RapidChangeTool';
      const changeCount = 500;

      const levels: PermissionLevel[] = ['allow-always', 'allow-once', 'deny'];

      // Rapid level changes
      for (let i = 0; i < changeCount; i++) {
        await permissionStore.saveExtendedPermission({
          tool: toolName,
          level: levels[i % levels.length],
          createdAt: new Date(),
          config: {
            enabled: i % 2 === 0,
            timeout: 1000 + i,
            metadata: { changeIndex: i },
          },
          tags: [`change-${i}`],
        });
      }

      // Verify final state
      const finalPermission = await permissionStore.getExtendedPermission({ tool: toolName });
      expect(finalPermission).toBeDefined();
      expect(finalPermission!.config?.metadata?.changeIndex).toBe(changeCount - 1);
    });

    it('should handle permissions with very long tag lists', async () => {
      const longTagPermission: ExtendedPermission = {
        tool: 'LongTagTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: { enabled: true },
        tags: Array(1000).fill(null).map((_, i) => `very-long-tag-name-${i}-with-lots-of-detail`),
      };

      await permissionStore.saveExtendedPermission(longTagPermission);

      const retrieved = await permissionStore.getExtendedPermission({ tool: 'LongTagTool' });
      expect(retrieved?.tags).toHaveLength(1000);

      // Test filtering by tags
      const tagFilterResults = await permissionStore.listExtendedPermissions({
        tags: ['very-long-tag-name-500-with-lots-of-detail'],
      });
      expect(tagFilterResults).toHaveLength(1);
    });

    it('should handle database corruption recovery scenarios', async () => {
      // Create some permissions
      await permissionStore.saveExtendedPermission({
        tool: 'RecoveryTool1',
        level: 'allow-always',
        createdAt: new Date(),
        config: { enabled: true },
        tags: ['recovery-test'],
      });

      // Close and reopen store to test recovery
      permissionStore.close();

      const newPermissionStore = new PermissionStore(tempDir);
      await newPermissionStore.initialize();

      // Should be able to read existing permissions
      const recovered = await newPermissionStore.getExtendedPermission({ tool: 'RecoveryTool1' });
      expect(recovered).toBeDefined();
      expect(recovered!.tags).toContain('recovery-test');

      newPermissionStore.close();
    });
  });
});