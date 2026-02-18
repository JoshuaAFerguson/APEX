import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionStore } from '../permission-store';
import {
  ExtendedPermission,
  PermissionQuery,
  ToolPermissionConfig,
  DirectoryAccessConfig,
  FilesystemToolConfig,
  ShellToolConfig,
  WebToolConfig,
  SearchToolConfig,
} from '@apexcli/core';

/**
 * Tests for the extended PermissionStore functionality added in v0.5.0
 * Covers per-tool configuration, directory access, and enhanced permission features
 */
describe('PermissionStore Extended Features', () => {
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-extended-permission-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
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

  describe('ExtendedPermission CRUD Operations', () => {
    it('should save and retrieve extended permission with all fields', async () => {
      const extendedPermission: ExtendedPermission = {
        tool: 'Read',
        scope: '/src/**/*.ts',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          enabled: true,
          timeout: 5000,
          requireConfirmation: false,
          rateLimitPerMinute: 10,
          maxFileSize: 1024 * 1024,
          allowedExtensions: ['.ts', '.tsx', '.js'],
          directoryAccess: {
            allowlist: ['/src/**', '/lib/**'],
            blocklist: ['/src/secrets/**'],
            defaultAllow: false,
            resolveSymlinks: true,
            maxDepth: 10,
          },
        } as FilesystemToolConfig,
        grantReason: 'Developer requested TypeScript file access',
        grantedBy: 'user',
        tags: ['development', 'typescript', 'readonly'],
      };

      await store.saveExtendedPermission(extendedPermission);

      const query: PermissionQuery = { tool: 'Read', scope: '/src/**/*.ts' };
      const retrieved = await store.getExtendedPermission(query);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.tool).toBe('Read');
      expect(retrieved?.scope).toBe('/src/**/*.ts');
      expect(retrieved?.level).toBe('allow-always');
      expect(retrieved?.grantReason).toBe('Developer requested TypeScript file access');
      expect(retrieved?.grantedBy).toBe('user');
      expect(retrieved?.tags).toEqual(['development', 'typescript', 'readonly']);

      // Verify config was preserved
      expect(retrieved?.config).toBeDefined();
      expect((retrieved?.config as any)?.enabled).toBe(true);
      expect((retrieved?.config as any)?.timeout).toBe(5000);
      expect((retrieved?.config as any)?.maxFileSize).toBe(1024 * 1024);
      expect((retrieved?.config as any)?.allowedExtensions).toEqual(['.ts', '.tsx', '.js']);

      // Verify directory access config
      const dirAccess = (retrieved?.config as any)?.directoryAccess;
      expect(dirAccess).toBeDefined();
      expect(dirAccess?.allowlist).toEqual(['/src/**', '/lib/**']);
      expect(dirAccess?.blocklist).toEqual(['/src/secrets/**']);
      expect(dirAccess?.defaultAllow).toBe(false);
    });

    it('should save extended permission with minimal fields', async () => {
      const minimalExtended: ExtendedPermission = {
        tool: 'Write',
        level: 'allow-once',
        createdAt: new Date(),
        tags: [], // Required by schema
      };

      await store.saveExtendedPermission(minimalExtended);

      const retrieved = await store.getExtendedPermission({ tool: 'Write' });

      expect(retrieved).not.toBeNull();
      expect(retrieved?.tool).toBe('Write');
      expect(retrieved?.level).toBe('allow-once');
      expect(retrieved?.config).toBeUndefined();
      expect(retrieved?.grantReason).toBeUndefined();
      expect(retrieved?.grantedBy).toBeUndefined();
      expect(retrieved?.tags).toEqual([]);
    });

    it('should update existing extended permission', async () => {
      const initial: ExtendedPermission = {
        tool: 'Bash',
        level: 'deny',
        createdAt: new Date(),
        grantReason: 'Security restriction',
        tags: ['security'],
      };

      await store.saveExtendedPermission(initial);

      const updated: ExtendedPermission = {
        tool: 'Bash',
        level: 'allow-once',
        createdAt: new Date(),
        grantReason: 'Temporary access granted',
        grantedBy: 'admin',
        tags: ['temporary', 'admin-approved'],
        expiry: new Date(Date.now() + 3600000), // 1 hour
      };

      await store.saveExtendedPermission(updated);

      const retrieved = await store.getExtendedPermission({ tool: 'Bash' });

      expect(retrieved?.level).toBe('allow-once');
      expect(retrieved?.grantReason).toBe('Temporary access granted');
      expect(retrieved?.grantedBy).toBe('admin');
      expect(retrieved?.tags).toEqual(['temporary', 'admin-approved']);
      expect(retrieved?.expiry).toBeDefined();
    });

    it('should handle different tool configuration types', async () => {
      const shellConfig: ShellToolConfig = {
        enabled: true,
        timeout: 30000,
        requireConfirmation: true,
        directoryAccess: {
          allowlist: ['/tmp/**'],
          blocklist: ['/etc/**', '/root/**'],
          defaultAllow: false,
        },
        blockedCommands: ['rm -rf', 'sudo', 'su'],
        allowElevatedPrivileges: false,
        environment: { NODE_ENV: 'test' },
        workingDirectory: '/tmp',
      };

      const webConfig: WebToolConfig = {
        enabled: true,
        timeout: 10000,
        allowedDomains: ['api.github.com', 'docs.anthropic.com'],
        blockedDomains: ['malicious-site.com'],
        maxResponseSize: 5 * 1024 * 1024,
        followRedirects: true,
        headers: { 'User-Agent': 'APEX-Bot/1.0' },
      };

      const searchConfig: SearchToolConfig = {
        enabled: true,
        maxResults: 100,
        includePatterns: ['*.ts', '*.js'],
        excludePatterns: ['node_modules/**', '*.test.*'],
        directoryAccess: {
          allowlist: ['/src/**'],
          defaultAllow: false,
        },
      };

      const permissions: ExtendedPermission[] = [
        {
          tool: 'Bash',
          level: 'allow-once',
          config: shellConfig,
          createdAt: new Date(),
          tags: ['shell'],
        },
        {
          tool: 'WebFetch',
          level: 'allow-always',
          config: webConfig,
          createdAt: new Date(),
          tags: ['web'],
        },
        {
          tool: 'Grep',
          level: 'allow-always',
          config: searchConfig,
          createdAt: new Date(),
          tags: ['search'],
        },
      ];

      // Save all permissions
      for (const permission of permissions) {
        await store.saveExtendedPermission(permission);
      }

      // Verify shell config
      const bashPerm = await store.getExtendedPermission({ tool: 'Bash' });
      const bashConfig = bashPerm?.config as ShellToolConfig;
      expect(bashConfig?.blockedCommands).toEqual(['rm -rf', 'sudo', 'su']);
      expect(bashConfig?.allowElevatedPrivileges).toBe(false);
      expect(bashConfig?.environment?.NODE_ENV).toBe('test');

      // Verify web config
      const webPerm = await store.getExtendedPermission({ tool: 'WebFetch' });
      const retrievedWebConfig = webPerm?.config as WebToolConfig;
      expect(retrievedWebConfig?.allowedDomains).toEqual(['api.github.com', 'docs.anthropic.com']);
      expect(retrievedWebConfig?.maxResponseSize).toBe(5 * 1024 * 1024);

      // Verify search config
      const searchPerm = await store.getExtendedPermission({ tool: 'Grep' });
      const retrievedSearchConfig = searchPerm?.config as SearchToolConfig;
      expect(retrievedSearchConfig?.maxResults).toBe(100);
      expect(retrievedSearchConfig?.includePatterns).toEqual(['*.ts', '*.js']);
    });
  });

  describe('listExtendedPermissions filtering', () => {
    beforeEach(async () => {
      const permissions: ExtendedPermission[] = [
        {
          tool: 'Read',
          level: 'allow-always',
          createdAt: new Date('2023-01-01'),
          grantedBy: 'user',
          tags: ['development', 'safe'],
          config: { enabled: true, timeout: 5000 } as ToolPermissionConfig,
        },
        {
          tool: 'Write',
          level: 'allow-once',
          createdAt: new Date('2023-01-02'),
          grantedBy: 'admin',
          tags: ['temporary'],
          expiry: new Date(Date.now() + 3600000),
        },
        {
          tool: 'Bash',
          level: 'deny',
          createdAt: new Date('2023-01-03'),
          grantedBy: 'system',
          tags: ['security', 'blocked'],
        },
        {
          tool: 'WebFetch',
          level: 'allow-always',
          createdAt: new Date('2023-01-04'),
          grantedBy: 'user',
          tags: ['development', 'network'],
          config: { enabled: true, allowedDomains: ['github.com'] } as ToolPermissionConfig,
        },
      ];

      for (const permission of permissions) {
        await store.saveExtendedPermission(permission);
      }
    });

    it('should filter by grantedBy', async () => {
      const userPermissions = await store.listExtendedPermissions({ grantedBy: 'user' });

      expect(userPermissions).toHaveLength(2);
      expect(userPermissions.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Read', 'WebFetch'])
      );
    });

    it('should filter by tags', async () => {
      const devPermissions = await store.listExtendedPermissions({
        tags: ['development']
      });

      expect(devPermissions).toHaveLength(2);
      expect(devPermissions.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Read', 'WebFetch'])
      );

      const securityPermissions = await store.listExtendedPermissions({
        tags: ['security']
      });

      expect(securityPermissions).toHaveLength(1);
      expect(securityPermissions[0].tool).toBe('Bash');
    });

    it('should filter by hasConfig', async () => {
      const withConfig = await store.listExtendedPermissions({ hasConfig: true });
      expect(withConfig).toHaveLength(2);
      expect(withConfig.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Read', 'WebFetch'])
      );

      const withoutConfig = await store.listExtendedPermissions({ hasConfig: false });
      expect(withoutConfig).toHaveLength(2);
      expect(withoutConfig.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Write', 'Bash'])
      );
    });

    it('should combine multiple filters', async () => {
      const filtered = await store.listExtendedPermissions({
        grantedBy: 'user',
        tags: ['development'],
        hasConfig: true,
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Read', 'WebFetch'])
      );
    });

    it('should handle tag filtering with multiple tags', async () => {
      const multiTagPermissions = await store.listExtendedPermissions({
        tags: ['development', 'security']
      });

      // Should match permissions that have ANY of the provided tags
      expect(multiTagPermissions).toHaveLength(3);
      expect(multiTagPermissions.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Read', 'WebFetch', 'Bash'])
      );
    });
  });

  describe('Directory Access Configuration', () => {
    it('should get directory access from existing permission', async () => {
      const permission: ExtendedPermission = {
        tool: 'Edit',
        scope: '/src/**',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          enabled: true,
          directoryAccess: {
            allowlist: ['/src/**', '/lib/**'],
            blocklist: ['/src/secrets/**'],
            defaultAllow: false,
            resolveSymlinks: true,
            maxDepth: 5,
          },
        } as FilesystemToolConfig,
        tags: [],
      };

      await store.saveExtendedPermission(permission);

      const dirAccess = await store.getDirectoryAccess({
        tool: 'Edit',
        scope: '/src/**'
      });

      expect(dirAccess).not.toBeNull();
      expect(dirAccess?.allowlist).toEqual(['/src/**', '/lib/**']);
      expect(dirAccess?.blocklist).toEqual(['/src/secrets/**']);
      expect(dirAccess?.defaultAllow).toBe(false);
      expect(dirAccess?.maxDepth).toBe(5);
    });

    it('should return null for permission without directory access', async () => {
      const permission: ExtendedPermission = {
        tool: 'WebSearch',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          enabled: true,
          allowedDomains: ['example.com'],
        } as WebToolConfig,
        tags: [],
      };

      await store.saveExtendedPermission(permission);

      const dirAccess = await store.getDirectoryAccess({ tool: 'WebSearch' });
      expect(dirAccess).toBeNull();
    });

    it('should return null for non-existent permission', async () => {
      const dirAccess = await store.getDirectoryAccess({
        tool: 'NonExistent'
      });

      expect(dirAccess).toBeNull();
    });

    it('should update directory access for existing permission', async () => {
      // Create permission without directory access
      const permission: ExtendedPermission = {
        tool: 'Write',
        level: 'allow-once',
        createdAt: new Date(),
        config: {
          enabled: true,
          maxFileSize: 1024,
        } as FilesystemToolConfig,
        tags: [],
      };

      await store.saveExtendedPermission(permission);

      // Update with directory access
      const newDirAccess: DirectoryAccessConfig = {
        allowlist: ['/tmp/**'],
        blocklist: ['/tmp/restricted/**'],
        defaultAllow: false,
        resolveSymlinks: false,
        maxDepth: 3,
      };

      const updated = await store.updateDirectoryAccess(
        { tool: 'Write' },
        newDirAccess
      );

      expect(updated).toBe(true);

      // Verify the update
      const retrievedAccess = await store.getDirectoryAccess({ tool: 'Write' });
      expect(retrievedAccess).toEqual(newDirAccess);

      // Verify other config properties were preserved
      const retrieved = await store.getExtendedPermission({ tool: 'Write' });
      const config = retrieved?.config as FilesystemToolConfig;
      expect(config?.maxFileSize).toBe(1024);
      expect(config?.enabled).toBe(true);
    });

    it('should return false when updating directory access for non-existent permission', async () => {
      const dirAccess: DirectoryAccessConfig = {
        allowlist: ['/test/**'],
        defaultAllow: false,
      };

      const updated = await store.updateDirectoryAccess(
        { tool: 'NonExistent' },
        dirAccess
      );

      expect(updated).toBe(false);
    });

    it('should handle updating permission that has no config', async () => {
      // Create permission without config
      const permission: ExtendedPermission = {
        tool: 'Glob',
        level: 'allow-always',
        createdAt: new Date(),
        tags: [],
      };

      await store.saveExtendedPermission(permission);

      // Update with directory access
      const dirAccess: DirectoryAccessConfig = {
        allowlist: ['/src/**'],
        defaultAllow: false,
      };

      const updated = await store.updateDirectoryAccess(
        { tool: 'Glob' },
        dirAccess
      );

      expect(updated).toBe(true);

      // Verify config was created
      const retrieved = await store.getExtendedPermission({ tool: 'Glob' });
      expect(retrieved?.config).toBeDefined();
      expect((retrieved?.config as any)?.directoryAccess).toEqual(dirAccess);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with basic Permission interface', async () => {
      // Save an extended permission
      const extended: ExtendedPermission = {
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
        config: { enabled: true } as ToolPermissionConfig,
        grantReason: 'Test permission',
        tags: ['test'],
      };

      await store.saveExtendedPermission(extended);

      // Retrieve using basic Permission interface
      const basicPermission = await store.getPermission({ tool: 'Read' });

      expect(basicPermission).not.toBeNull();
      expect(basicPermission?.tool).toBe('Read');
      expect(basicPermission?.level).toBe('allow-always');
      expect(basicPermission?.createdAt).toBeDefined();

      // Extended fields should not be present in basic interface
      expect((basicPermission as any)?.config).toBeUndefined();
      expect((basicPermission as any)?.grantReason).toBeUndefined();
      expect((basicPermission as any)?.tags).toBeUndefined();
    });

    it('should maintain compatibility with basic savePermission', async () => {
      // Save using basic Permission interface
      const basicPermission = {
        tool: 'Write',
        scope: '/test.txt',
        level: 'allow-once' as const,
        createdAt: new Date(),
        expiry: new Date(Date.now() + 3600000),
      };

      await store.savePermission(basicPermission);

      // Retrieve using extended interface
      const extended = await store.getExtendedPermission({
        tool: 'Write',
        scope: '/test.txt'
      });

      expect(extended).not.toBeNull();
      expect(extended?.tool).toBe('Write');
      expect(extended?.scope).toBe('/test.txt');
      expect(extended?.level).toBe('allow-once');
      expect(extended?.tags).toEqual([]); // Default empty array
      expect(extended?.config).toBeUndefined();
      expect(extended?.grantReason).toBeUndefined();
    });

    it('should maintain compatibility with basic listPermissions', async () => {
      // Save mixed permissions
      await store.savePermission({
        tool: 'BasicTool',
        level: 'allow-always',
        createdAt: new Date(),
      });

      await store.saveExtendedPermission({
        tool: 'ExtendedTool',
        level: 'allow-once',
        createdAt: new Date(),
        grantReason: 'Test',
        tags: ['test'],
      });

      // List using basic interface
      const basicList = await store.listPermissions();
      expect(basicList).toHaveLength(2);

      // Should contain only basic Permission fields
      basicList.forEach(permission => {
        expect(permission).toHaveProperty('tool');
        expect(permission).toHaveProperty('level');
        expect(permission).toHaveProperty('createdAt');
        expect((permission as any).grantReason).toBeUndefined();
        expect((permission as any).tags).toBeUndefined();
      });

      // List using extended interface
      const extendedList = await store.listExtendedPermissions();
      expect(extendedList).toHaveLength(2);

      // Should contain extended fields where present
      const extendedTool = extendedList.find(p => p.tool === 'ExtendedTool');
      expect(extendedTool?.grantReason).toBe('Test');
      expect(extendedTool?.tags).toEqual(['test']);

      const basicTool = extendedList.find(p => p.tool === 'BasicTool');
      expect(basicTool?.grantReason).toBeUndefined();
      expect(basicTool?.tags).toEqual([]);
    });
  });

  describe('Database Migration', () => {
    it('should have created new columns during migration', async () => {
      // This test verifies that the new columns exist by attempting operations that use them
      const extendedPermission: ExtendedPermission = {
        tool: 'MigrationTest',
        level: 'allow-always',
        createdAt: new Date(),
        config: { enabled: true } as ToolPermissionConfig,
        grantReason: 'Migration test',
        grantedBy: 'test-runner',
        tags: ['migration', 'test'],
      };

      // This should not throw if migration worked correctly
      await expect(store.saveExtendedPermission(extendedPermission)).resolves.not.toThrow();

      const retrieved = await store.getExtendedPermission({ tool: 'MigrationTest' });
      expect(retrieved?.config).toBeDefined();
      expect(retrieved?.grantReason).toBe('Migration test');
      expect(retrieved?.grantedBy).toBe('test-runner');
      expect(retrieved?.tags).toEqual(['migration', 'test']);
    });

    it('should handle multiple store initialization correctly', async () => {
      // Save some data
      await store.saveExtendedPermission({
        tool: 'MultiInitTest',
        level: 'allow-always',
        createdAt: new Date(),
        tags: ['test'],
      });

      // Close and create new store
      store.close();
      const newStore = new PermissionStore(testDir);
      await newStore.initialize();

      // Should still work with extended functionality
      const retrieved = await newStore.getExtendedPermission({ tool: 'MultiInitTest' });
      expect(retrieved?.tool).toBe('MultiInitTest');
      expect(retrieved?.tags).toEqual(['test']);

      newStore.close();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid JSON in config gracefully', async () => {
      // We can't directly test invalid JSON since the API validates,
      // but we can test with edge case configs
      const edgeCaseConfig = {
        enabled: true,
        metadata: {
          complexObject: {
            nested: { deeply: true },
            array: [1, 2, 3, { item: 'test' }],
          },
        },
      } as ToolPermissionConfig;

      const permission: ExtendedPermission = {
        tool: 'EdgeCaseTest',
        level: 'allow-always',
        createdAt: new Date(),
        config: edgeCaseConfig,
        tags: [],
      };

      await store.saveExtendedPermission(permission);

      const retrieved = await store.getExtendedPermission({ tool: 'EdgeCaseTest' });
      expect(retrieved?.config?.metadata).toEqual(edgeCaseConfig.metadata);
    });

    it('should handle very large permission datasets', async () => {
      const largeDataset: ExtendedPermission[] = [];

      for (let i = 0; i < 1000; i++) {
        largeDataset.push({
          tool: `LargeTool${i}`,
          scope: `/large/path/${i}/**`,
          level: i % 3 === 0 ? 'allow-always' : i % 3 === 1 ? 'allow-once' : 'deny',
          createdAt: new Date(Date.now() + i),
          grantReason: `Reason ${i}`,
          grantedBy: i % 2 === 0 ? 'user' : 'admin',
          tags: [`tag${i % 10}`, `category${i % 5}`],
          config: {
            enabled: i % 4 !== 0,
            timeout: i * 100,
          } as ToolPermissionConfig,
        });
      }

      // Save all permissions
      for (const permission of largeDataset) {
        await store.saveExtendedPermission(permission);
      }

      // Verify count and filtering still works
      const all = await store.listExtendedPermissions({ includeExpired: true });
      expect(all).toHaveLength(1000);

      const userPermissions = await store.listExtendedPermissions({ grantedBy: 'user' });
      expect(userPermissions.length).toBe(500);

      const tag0Permissions = await store.listExtendedPermissions({ tags: ['tag0'] });
      expect(tag0Permissions.length).toBe(100);
    });

    it('should handle concurrent extended permission operations', async () => {
      const concurrentOps = [];

      // Create 50 concurrent save operations
      for (let i = 0; i < 50; i++) {
        const permission: ExtendedPermission = {
          tool: `ConcurrentExtended${i}`,
          level: 'allow-always',
          createdAt: new Date(),
          grantReason: `Concurrent operation ${i}`,
          tags: [`concurrent${i}`],
        };

        concurrentOps.push(store.saveExtendedPermission(permission));
      }

      // Wait for all to complete
      await Promise.all(concurrentOps);

      // Verify all were saved
      const all = await store.listExtendedPermissions();
      expect(all.length).toBeGreaterThanOrEqual(50);

      // Verify data integrity with concurrent reads
      const readOps = [];
      for (let i = 0; i < 50; i++) {
        readOps.push(store.getExtendedPermission({ tool: `ConcurrentExtended${i}` }));
      }

      const results = await Promise.all(readOps);
      expect(results.filter(r => r !== null)).toHaveLength(50);
    });
  });
});