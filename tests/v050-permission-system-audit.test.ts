import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rmdir } from 'fs/promises';
import { PermissionStore } from '../packages/orchestrator/src/permission-store.js';
import type {
  Permission,
  ExtendedPermission,
  PermissionLevel,
  PermissionQuery,
  DirectoryAccessConfig,
  ToolPermissionConfig,
  FilesystemToolConfig,
  ShellToolConfig,
  WebToolConfig,
  BrowserToolConfig,
} from '../packages/core/src/types.js';

/**
 * Comprehensive test suite for v0.5.0 Permission System features
 * Validates implementation against acceptance criteria:
 * - Permission levels (allow-always, allow-once, deny)
 * - Per-tool permissions
 * - Per-directory permissions
 * - Extended permission configurations
 */

describe('v0.5.0 Permission System Audit', () => {
  let tempDir: string;
  let permissionStore: PermissionStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-test-'));
    permissionStore = new PermissionStore(tempDir);
    await permissionStore.initialize();
  });

  afterEach(async () => {
    permissionStore.close();
    await rmdir(tempDir, { recursive: true });
  });

  describe('Permission Levels', () => {
    it('should support all permission levels', async () => {
      const levels: PermissionLevel[] = ['allow-always', 'allow-once', 'deny'];

      for (const level of levels) {
        const permission: Permission = {
          tool: `test-tool-${level}`,
          level,
          createdAt: new Date(),
        };

        await permissionStore.savePermission(permission);
        const retrieved = await permissionStore.getPermission({ tool: permission.tool });

        expect(retrieved).toBeDefined();
        expect(retrieved!.level).toBe(level);
      }
    });

    it('should handle permission expiration correctly', async () => {
      const expiredPermission: Permission = {
        tool: 'expired-tool',
        level: 'allow-always',
        expiry: new Date(Date.now() - 1000), // Expired 1 second ago
        createdAt: new Date(Date.now() - 2000),
      };

      const activePermission: Permission = {
        tool: 'active-tool',
        level: 'allow-always',
        expiry: new Date(Date.now() + 60000), // Expires in 1 minute
        createdAt: new Date(),
      };

      await permissionStore.savePermission(expiredPermission);
      await permissionStore.savePermission(activePermission);

      // Expired permission should return null
      const retrievedExpired = await permissionStore.getPermission({ tool: 'expired-tool' });
      expect(retrievedExpired).toBeNull();

      // Active permission should return normally
      const retrievedActive = await permissionStore.getPermission({ tool: 'active-tool' });
      expect(retrievedActive).toBeDefined();
      expect(retrievedActive!.level).toBe('allow-always');
    });

    it('should handle scope-specific permissions', async () => {
      const globalPermission: Permission = {
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
      };

      const scopedPermission: Permission = {
        tool: 'Read',
        scope: '/project/src/**',
        level: 'deny',
        createdAt: new Date(),
      };

      await permissionStore.savePermission(globalPermission);
      await permissionStore.savePermission(scopedPermission);

      // Global permission
      const globalResult = await permissionStore.getPermission({ tool: 'Read' });
      expect(globalResult?.level).toBe('allow-always');

      // Scoped permission
      const scopedResult = await permissionStore.getPermission({ tool: 'Read', scope: '/project/src/**' });
      expect(scopedResult?.level).toBe('deny');
    });
  });

  describe('Per-Tool Permissions', () => {
    it('should support filesystem tool configurations', async () => {
      const directoryAccess: DirectoryAccessConfig = {
        allowlist: ['/project/src/**', '/project/tests/**'],
        blocklist: ['/project/src/secrets/**'],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 10,
      };

      const config: FilesystemToolConfig = {
        enabled: true,
        timeout: 5000,
        requireConfirmation: false,
        rateLimitPerMinute: 100,
        directoryAccess,
        maxFileSize: 1048576, // 1MB
        allowedExtensions: ['.ts', '.js', '.json'],
        blockedExtensions: ['.exe', '.bin'],
      };

      const permission: ExtendedPermission = {
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
        config,
        grantReason: 'Development workspace access',
        grantedBy: 'user',
        tags: ['development', 'filesystem'],
      };

      await permissionStore.saveExtendedPermission(permission);

      const retrieved = await permissionStore.getExtendedPermission({ tool: 'Read' });
      expect(retrieved).toBeDefined();
      expect(retrieved!.config).toBeDefined();

      const retrievedConfig = retrieved!.config as FilesystemToolConfig;
      expect(retrievedConfig.directoryAccess?.allowlist).toEqual(['/project/src/**', '/project/tests/**']);
      expect(retrievedConfig.directoryAccess?.blocklist).toEqual(['/project/src/secrets/**']);
      expect(retrievedConfig.maxFileSize).toBe(1048576);
      expect(retrievedConfig.allowedExtensions).toEqual(['.ts', '.js', '.json']);
    });

    it('should support shell tool configurations', async () => {
      const config: ShellToolConfig = {
        enabled: true,
        timeout: 30000,
        requireConfirmation: true,
        directoryAccess: {
          allowlist: ['/project/**'],
          defaultAllow: false,
        },
        blockedCommands: ['rm -rf .*', 'sudo .*', 'wget .*'],
        allowElevatedPrivileges: false,
        environment: {
          NODE_ENV: 'development',
          PATH: '/usr/local/bin:/usr/bin:/bin',
        },
        workingDirectory: '/project',
      };

      const permission: ExtendedPermission = {
        tool: 'Bash',
        level: 'allow-always',
        createdAt: new Date(),
        config,
        tags: ['shell', 'development'],
      };

      await permissionStore.saveExtendedPermission(permission);

      const retrieved = await permissionStore.getExtendedPermission({ tool: 'Bash' });
      const retrievedConfig = retrieved!.config as ShellToolConfig;

      expect(retrievedConfig.blockedCommands).toContain('rm -rf .*');
      expect(retrievedConfig.allowElevatedPrivileges).toBe(false);
      expect(retrievedConfig.environment?.NODE_ENV).toBe('development');
      expect(retrievedConfig.workingDirectory).toBe('/project');
    });

    it('should support web tool configurations', async () => {
      const config: WebToolConfig = {
        enabled: true,
        timeout: 10000,
        allowedDomains: ['github.com', '*.stackoverflow.com'],
        blockedDomains: ['malicious-site.com'],
        maxResponseSize: 5242880, // 5MB
        followRedirects: true,
        headers: {
          'User-Agent': 'APEX-CLI/1.0',
          'Accept': 'application/json, text/plain, */*',
        },
      };

      const permission: ExtendedPermission = {
        tool: 'WebFetch',
        level: 'allow-always',
        createdAt: new Date(),
        config,
        tags: ['web', 'api'],
      };

      await permissionStore.saveExtendedPermission(permission);

      const retrieved = await permissionStore.getExtendedPermission({ tool: 'WebFetch' });
      const retrievedConfig = retrieved!.config as WebToolConfig;

      expect(retrievedConfig.allowedDomains).toContain('github.com');
      expect(retrievedConfig.blockedDomains).toContain('malicious-site.com');
      expect(retrievedConfig.maxResponseSize).toBe(5242880);
      expect(retrievedConfig.headers?.['User-Agent']).toBe('APEX-CLI/1.0');
    });

    it('should support browser tool configurations', async () => {
      const config: BrowserToolConfig = {
        enabled: true,
        timeout: 30000,
        allowedDomains: ['*.github.com', 'localhost:*'],
        blockedDomains: ['ads.com', 'tracker.net'],
        allowJavaScriptExecution: false,
        allowFormSubmission: true,
        pageLoadTimeout: 15000,
        allowDownloads: false,
        allowScreenshots: true,
        blockPopups: true,
        engine: 'chromium',
        backend: 'playwright',
        headless: true,
        userAgent: 'APEX-Browser-Tool/1.0',
        viewport: {
          width: 1280,
          height: 720,
        },
      };

      const permission: ExtendedPermission = {
        tool: 'Browser',
        level: 'allow-always',
        createdAt: new Date(),
        config,
        tags: ['browser', 'automation'],
      };

      await permissionStore.saveExtendedPermission(permission);

      const retrieved = await permissionStore.getExtendedPermission({ tool: 'Browser' });
      const retrievedConfig = retrieved!.config as BrowserToolConfig;

      expect(retrievedConfig.allowJavaScriptExecution).toBe(false);
      expect(retrievedConfig.allowFormSubmission).toBe(true);
      expect(retrievedConfig.engine).toBe('chromium');
      expect(retrievedConfig.backend).toBe('playwright');
      expect(retrievedConfig.viewport?.width).toBe(1280);
    });
  });

  describe('Per-Directory Permissions', () => {
    it('should handle directory access configuration', async () => {
      const directoryAccess: DirectoryAccessConfig = {
        allowlist: ['/home/user/projects/**', '/tmp/workspace/**'],
        blocklist: ['/home/user/projects/secret/**', '/tmp/workspace/.env'],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 5,
      };

      const config: FilesystemToolConfig = {
        directoryAccess,
        enabled: true,
      };

      const permission: ExtendedPermission = {
        tool: 'Write',
        level: 'allow-always',
        createdAt: new Date(),
        config,
      };

      await permissionStore.saveExtendedPermission(permission);

      // Test directory access retrieval
      const retrievedAccess = await permissionStore.getDirectoryAccess({ tool: 'Write' });
      expect(retrievedAccess).toBeDefined();
      expect(retrievedAccess!.allowlist).toContain('/home/user/projects/**');
      expect(retrievedAccess!.blocklist).toContain('/home/user/projects/secret/**');
      expect(retrievedAccess!.defaultAllow).toBe(false);
      expect(retrievedAccess!.maxDepth).toBe(5);
    });

    it('should support updating directory access configuration', async () => {
      // Initial permission with basic config
      const initialPermission: ExtendedPermission = {
        tool: 'Edit',
        level: 'allow-always',
        createdAt: new Date(),
        config: { enabled: true },
        tags: [],
      };

      await permissionStore.saveExtendedPermission(initialPermission);

      // Update with directory access
      const newDirectoryAccess: DirectoryAccessConfig = {
        allowlist: ['/new/project/**'],
        blocklist: ['/new/project/node_modules/**'],
        defaultAllow: false,
      };

      const updateResult = await permissionStore.updateDirectoryAccess(
        { tool: 'Edit' },
        newDirectoryAccess
      );

      expect(updateResult).toBe(true);

      // Verify the update
      const updatedAccess = await permissionStore.getDirectoryAccess({ tool: 'Edit' });
      expect(updatedAccess?.allowlist).toContain('/new/project/**');
      expect(updatedAccess?.blocklist).toContain('/new/project/node_modules/**');
    });

    it('should handle complex directory permission scenarios', async () => {
      // Tool permission for read access to source code
      const readSourcePermission: ExtendedPermission = {
        tool: 'Read',
        scope: 'source-code',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          directoryAccess: {
            allowlist: ['src/**', 'lib/**', 'types/**'],
            blocklist: ['src/private/**'],
            defaultAllow: false,
          },
          allowedExtensions: ['.ts', '.js', '.jsx', '.tsx'],
        } as FilesystemToolConfig,
        grantReason: 'Source code reading for development',
        tags: ['source', 'readonly'],
      };

      // Tool permission for write access to output directories
      const writeOutputPermission: ExtendedPermission = {
        tool: 'Write',
        scope: 'build-output',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          directoryAccess: {
            allowlist: ['dist/**', 'build/**', 'out/**'],
            defaultAllow: false,
          },
          maxFileSize: 10485760, // 10MB
        } as FilesystemToolConfig,
        grantReason: 'Build output generation',
        tags: ['build', 'output'],
      };

      await permissionStore.saveExtendedPermission(readSourcePermission);
      await permissionStore.saveExtendedPermission(writeOutputPermission);

      // Verify both permissions exist with correct directory access
      const readPermission = await permissionStore.getExtendedPermission({
        tool: 'Read',
        scope: 'source-code'
      });
      const readAccess = readPermission?.config as FilesystemToolConfig;
      expect(readAccess?.directoryAccess?.allowlist).toContain('src/**');
      expect(readAccess?.allowedExtensions).toContain('.ts');

      const writePermission = await permissionStore.getExtendedPermission({
        tool: 'Write',
        scope: 'build-output'
      });
      const writeAccess = writePermission?.config as FilesystemToolConfig;
      expect(writeAccess?.directoryAccess?.allowlist).toContain('dist/**');
      expect(writeAccess?.maxFileSize).toBe(10485760);
    });
  });

  describe('Extended Permission Features', () => {
    it('should support permission tagging and filtering', async () => {
      const permissions: ExtendedPermission[] = [
        {
          tool: 'Read',
          level: 'allow-always',
          createdAt: new Date(),
          tags: ['development', 'filesystem'],
          grantedBy: 'user',
        },
        {
          tool: 'Bash',
          level: 'allow-always',
          createdAt: new Date(),
          tags: ['development', 'shell'],
          grantedBy: 'admin',
        },
        {
          tool: 'WebFetch',
          level: 'allow-always',
          createdAt: new Date(),
          tags: ['api', 'network'],
          grantedBy: 'user',
        },
      ];

      for (const permission of permissions) {
        await permissionStore.saveExtendedPermission(permission);
      }

      // Filter by tag
      const devPermissions = await permissionStore.listExtendedPermissions({
        tags: ['development'],
      });
      expect(devPermissions).toHaveLength(2);
      expect(devPermissions.map(p => p.tool)).toContain('Read');
      expect(devPermissions.map(p => p.tool)).toContain('Bash');

      // Filter by granted by
      const userPermissions = await permissionStore.listExtendedPermissions({
        grantedBy: 'user',
      });
      expect(userPermissions).toHaveLength(2);
      expect(userPermissions.map(p => p.tool)).toContain('Read');
      expect(userPermissions.map(p => p.tool)).toContain('WebFetch');

      // Filter by multiple tags
      const filesystemPermissions = await permissionStore.listExtendedPermissions({
        tags: ['filesystem'],
      });
      expect(filesystemPermissions).toHaveLength(1);
      expect(filesystemPermissions[0].tool).toBe('Read');
    });

    it('should support permission grant reasons and metadata', async () => {
      const permission: ExtendedPermission = {
        tool: 'Browser',
        level: 'allow-always',
        createdAt: new Date(),
        grantReason: 'Required for automated testing of web applications',
        grantedBy: 'test-lead',
        tags: ['testing', 'automation', 'browser'],
        config: {
          enabled: true,
          requireConfirmation: false,
          metadata: {
            requestedBy: 'qa-team',
            approvedBy: 'tech-lead',
            approvalDate: '2024-01-15',
            reviewDate: '2024-07-15',
          },
        },
      };

      await permissionStore.saveExtendedPermission(permission);

      const retrieved = await permissionStore.getExtendedPermission({ tool: 'Browser' });
      expect(retrieved?.grantReason).toBe('Required for automated testing of web applications');
      expect(retrieved?.grantedBy).toBe('test-lead');
      expect(retrieved?.tags).toContain('testing');
      expect(retrieved?.config?.metadata?.requestedBy).toBe('qa-team');
    });

    it('should handle permission configuration updates', async () => {
      // Start with basic permission
      const initialPermission: ExtendedPermission = {
        tool: 'Grep',
        level: 'allow-once',
        createdAt: new Date(),
        tags: ['search'],
      };

      await permissionStore.saveExtendedPermission(initialPermission);

      // Update to extended permission with config
      const updatedPermission: ExtendedPermission = {
        tool: 'Grep',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          enabled: true,
          timeout: 5000,
          rateLimitPerMinute: 50,
          metadata: {
            usage: 'code-search',
            lastUpdated: new Date().toISOString(),
          },
        },
        grantReason: 'Upgraded for code analysis tasks',
        grantedBy: 'developer',
        tags: ['search', 'analysis'],
      };

      await permissionStore.saveExtendedPermission(updatedPermission);

      const retrieved = await permissionStore.getExtendedPermission({ tool: 'Grep' });
      expect(retrieved?.level).toBe('allow-always');
      expect(retrieved?.config?.timeout).toBe(5000);
      expect(retrieved?.grantReason).toBe('Upgraded for code analysis tasks');
      expect(retrieved?.tags).toContain('analysis');
    });
  });

  describe('Permission Store Management', () => {
    it('should clear expired permissions correctly', async () => {
      const expiredPermission: ExtendedPermission = {
        tool: 'temp-tool-1',
        level: 'allow-once',
        expiry: new Date(Date.now() - 1000),
        createdAt: new Date(Date.now() - 2000),
        tags: [],
      };

      const activePermission: ExtendedPermission = {
        tool: 'temp-tool-2',
        level: 'allow-always',
        expiry: new Date(Date.now() + 60000),
        createdAt: new Date(),
        tags: [],
      };

      await permissionStore.saveExtendedPermission(expiredPermission);
      await permissionStore.saveExtendedPermission(activePermission);

      const clearedCount = await permissionStore.clearExpired();
      expect(clearedCount).toBe(1);

      // Verify expired permission is gone
      const retrievedExpired = await permissionStore.getExtendedPermission({ tool: 'temp-tool-1' });
      expect(retrievedExpired).toBeNull();

      // Verify active permission remains
      const retrievedActive = await permissionStore.getExtendedPermission({ tool: 'temp-tool-2' });
      expect(retrievedActive).toBeDefined();
    });

    it('should list permissions with complex filtering', async () => {
      const permissions: ExtendedPermission[] = [
        {
          tool: 'Read',
          level: 'allow-always',
          createdAt: new Date(),
          config: { enabled: true },
          grantedBy: 'user',
          tags: ['file', 'read'],
        },
        {
          tool: 'Write',
          level: 'allow-once',
          createdAt: new Date(),
          grantedBy: 'admin',
          tags: ['file', 'write'],
        },
        {
          tool: 'Bash',
          level: 'deny',
          createdAt: new Date(),
          config: { enabled: false },
          grantedBy: 'security',
          tags: ['shell', 'dangerous'],
        },
      ];

      for (const permission of permissions) {
        await permissionStore.saveExtendedPermission(permission);
      }

      // Test filtering by level and config
      const allowedWithConfig = await permissionStore.listExtendedPermissions({
        level: 'allow-always',
        hasConfig: true,
      });
      expect(allowedWithConfig).toHaveLength(1);
      expect(allowedWithConfig[0].tool).toBe('Read');

      // Test filtering by multiple criteria
      const filePermissions = await permissionStore.listExtendedPermissions({
        tags: ['file'],
        grantedBy: 'user',
      });
      expect(filePermissions).toHaveLength(1);
      expect(filePermissions[0].tool).toBe('Read');
    });
  });

  describe('Real Implementation Verification', () => {
    it('should verify database schema and migrations', async () => {
      // Test that the database is properly initialized
      const query: PermissionQuery = { tool: 'test-migration' };
      const permission: ExtendedPermission = {
        tool: 'test-migration',
        level: 'allow-always',
        createdAt: new Date(),
        config: { enabled: true },
        grantReason: 'Migration test',
        grantedBy: 'system',
        tags: ['test'],
      };

      // This should not throw
      await permissionStore.saveExtendedPermission(permission);
      const retrieved = await permissionStore.getExtendedPermission(query);

      expect(retrieved).toBeDefined();
      expect(retrieved?.config).toBeDefined();
      expect(retrieved?.grantReason).toBe('Migration test');
      expect(retrieved?.grantedBy).toBe('system');
      expect(retrieved?.tags).toContain('test');
    });

    it('should verify all permission configuration schemas are valid', async () => {
      // Test all tool config types to ensure schemas work
      const configs: Record<string, ToolPermissionConfig> = {
        filesystem: {
          directoryAccess: {
            allowlist: ['src/**'],
            defaultAllow: false,
          },
          maxFileSize: 1000000,
          allowedExtensions: ['.js'],
        } as FilesystemToolConfig,

        shell: {
          directoryAccess: {
            allowlist: ['/home/user/**'],
          },
          blockedCommands: ['rm -rf'],
          allowElevatedPrivileges: false,
        } as ShellToolConfig,

        web: {
          allowedDomains: ['github.com'],
          maxResponseSize: 5000000,
          followRedirects: true,
        } as WebToolConfig,

        browser: {
          allowedDomains: ['*.example.com'],
          allowJavaScriptExecution: false,
          headless: true,
        } as BrowserToolConfig,
      };

      for (const [type, config] of Object.entries(configs)) {
        const permission: ExtendedPermission = {
          tool: `test-${type}`,
          level: 'allow-always',
          createdAt: new Date(),
          config,
          tags: [type],
        };

        // Should save and retrieve without issues
        await permissionStore.saveExtendedPermission(permission);
        const retrieved = await permissionStore.getExtendedPermission({ tool: `test-${type}` });

        expect(retrieved?.config).toBeDefined();
        expect(retrieved?.tags).toContain(type);
      }
    });

    it('should verify permission store handles edge cases correctly', async () => {
      // Test permission with null/undefined optional fields
      const minimalPermission: ExtendedPermission = {
        tool: 'minimal',
        level: 'allow-once',
        createdAt: new Date(),
        tags: [],
      };

      await permissionStore.saveExtendedPermission(minimalPermission);
      const retrieved = await permissionStore.getExtendedPermission({ tool: 'minimal' });

      expect(retrieved?.tool).toBe('minimal');
      expect(retrieved?.config).toBeUndefined();
      expect(retrieved?.grantReason).toBeUndefined();
      expect(retrieved?.grantedBy).toBeUndefined();
      expect(retrieved?.tags).toEqual([]);

      // Test permission overwrite
      const updatedPermission: ExtendedPermission = {
        tool: 'minimal',
        level: 'deny',
        createdAt: new Date(),
        grantReason: 'Security policy',
        tags: ['blocked'],
      };

      await permissionStore.saveExtendedPermission(updatedPermission);
      const updated = await permissionStore.getExtendedPermission({ tool: 'minimal' });

      expect(updated?.level).toBe('deny');
      expect(updated?.grantReason).toBe('Security policy');
      expect(updated?.tags).toEqual(['blocked']);
    });
  });
});