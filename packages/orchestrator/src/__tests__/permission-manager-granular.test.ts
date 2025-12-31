import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import {
  Permission,
  PermissionLevel,
  ExtendedPermission,
  ToolPermissionConfig,
  FilesystemToolConfig,
  ShellToolConfig,
  WebToolConfig,
  SearchToolConfig,
  BaseToolPermissionConfig,
  DirectoryAccessConfig,
  ToolPermissionCheckOptions,
  ToolPermissionResult
} from '@apexcli/core';

describe('PermissionManager - Granular Permission Tests', () => {
  let manager: PermissionManager;
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = join(tmpdir(), `apex-permission-manager-granular-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    store = new PermissionStore(testDir);
    await store.initialize();

    manager = new PermissionManager(store);
  });

  afterEach(() => {
    // Clean up
    if (store) {
      store.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('checkToolPermission with various tool configs', () => {
    it('should handle filesystem tool config with directory access', async () => {
      const filesystemConfig: FilesystemToolConfig = {
        enabled: true,
        requireConfirmation: false,
        timeout: 5000,
        rateLimitPerMinute: 10,
        directoryAccess: {
          allowlist: ['/allowed/**/*'],
          blocklist: ['/blocked/**/*'],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 5
        },
        maxFileSize: 1024000,
        allowedExtensions: ['.ts', '.js', '.json'],
        blockedExtensions: ['.exe', '.bat']
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
        config: filesystemConfig
      };

      await store.saveExtendedPermission(extendedPermission);

      const options: ToolPermissionCheckOptions = {
        path: '/allowed/src/test.ts',
        consumeAllowOnce: true,
        baseDir: '/'
      };

      const result = await manager.checkToolPermission('Read', options);

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.config).toEqual(filesystemConfig);
      expect(result.pathValidation).toBeDefined();
      expect(result.pathValidation!.allowed).toBe(true);
    });

    it('should handle shell tool config with blocked commands', async () => {
      const shellConfig: ShellToolConfig = {
        enabled: true,
        requireConfirmation: true,
        timeout: 30000,
        rateLimitPerMinute: 5,
        directoryAccess: {
          allowlist: ['/safe/**/*'],
          blocklist: ['/system/**/*'],
          defaultAllow: true
        },
        blockedCommands: ['rm -rf', 'sudo', 'dd'],
        allowElevatedPrivileges: false,
        environment: { NODE_ENV: 'test' },
        workingDirectory: '/safe'
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Bash',
        level: 'allow-once',
        createdAt: new Date(),
        config: shellConfig
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('Bash');

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-once');
      expect(result.requiresConfirmation).toBe(true);
      expect(result.config).toEqual(shellConfig);
    });

    it('should handle web tool config with domain restrictions', async () => {
      const webConfig: WebToolConfig = {
        enabled: true,
        requireConfirmation: false,
        timeout: 15000,
        rateLimitPerMinute: 20,
        allowedDomains: ['api.example.com', 'secure.service.com'],
        blockedDomains: ['malicious.site.com'],
        maxResponseSize: 5000000,
        followRedirects: true,
        headers: { 'User-Agent': 'APEX/1.0' }
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'WebFetch',
        level: 'allow-always',
        createdAt: new Date(),
        config: webConfig
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('WebFetch');

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.config).toEqual(webConfig);
    });

    it('should handle search tool config with pattern restrictions', async () => {
      const searchConfig: SearchToolConfig = {
        enabled: true,
        requireConfirmation: false,
        timeout: 10000,
        rateLimitPerMinute: 15,
        directoryAccess: {
          allowlist: ['/project/**/*'],
          blocklist: ['/project/.git/**/*', '/project/node_modules/**/*'],
          defaultAllow: false
        },
        maxResults: 100,
        includePatterns: ['*.ts', '*.js', '*.json'],
        excludePatterns: ['*.test.*', '*.spec.*']
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Grep',
        level: 'allow-always',
        createdAt: new Date(),
        config: searchConfig
      };

      await store.saveExtendedPermission(extendedPermission);

      const options: ToolPermissionCheckOptions = {
        path: '/project/src/main.ts'
      };

      const result = await manager.checkToolPermission('Grep', options);

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.config).toEqual(searchConfig);
      expect(result.pathValidation).toBeDefined();
      expect(result.pathValidation!.allowed).toBe(true);
    });

    it('should handle disabled tool via config', async () => {
      const disabledConfig: BaseToolPermissionConfig = {
        enabled: false,
        requireConfirmation: false,
        timeout: 0,
        rateLimitPerMinute: 0
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Write',
        level: 'allow-always',
        createdAt: new Date(),
        config: disabledConfig
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('Write');

      expect(result.allowed).toBe(false);
      expect(result.level).toBe('allow-always');
      expect(result.denialReason).toBe('Tool is disabled via configuration');
    });

    it('should handle tool with no permission but requiring confirmation', async () => {
      const confirmationConfig: BaseToolPermissionConfig = {
        enabled: true,
        requireConfirmation: true,
        timeout: 5000,
        rateLimitPerMinute: 0
      };

      // Mock to simulate no permission but config exists
      vi.spyOn(store, 'getPermission').mockResolvedValue(null);
      vi.spyOn(store, 'getExtendedPermission').mockResolvedValue({
        tool: 'UnknownTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: confirmationConfig
      });

      const result = await manager.checkToolPermission('UnknownTool');

      expect(result.allowed).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.denialReason).toContain('requires user confirmation');

      // Reset mocks
      vi.restoreAllMocks();
    });
  });

  describe('path validation with different config types', () => {
    it('should validate paths against filesystem tool directory access config', async () => {
      const config: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: {
          allowlist: ['/project/src/**/*'],
          blocklist: ['/project/src/secrets/**/*'],
          defaultAllow: false
        }
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      // Test allowed path
      const allowedResult = await manager.checkToolPermission('Read', {
        path: '/project/src/main.ts'
      });
      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.pathValidation!.allowed).toBe(true);
      expect(allowedResult.pathValidation!.matchType).toBe('allowlist');

      // Test blocked path
      const blockedResult = await manager.checkToolPermission('Read', {
        path: '/project/src/secrets/key.txt'
      });
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.pathValidation!.allowed).toBe(false);
      expect(blockedResult.pathValidation!.matchType).toBe('blocklist');
      expect(blockedResult.denialReason).toContain('Directory access denied');

      // Test unmatched path (should use defaultAllow: false)
      const unmatchedResult = await manager.checkToolPermission('Read', {
        path: '/other/file.txt'
      });
      expect(unmatchedResult.allowed).toBe(false);
      expect(unmatchedResult.pathValidation!.allowed).toBe(false);
      expect(unmatchedResult.pathValidation!.matchType).toBe('default');
    });

    it('should handle shell tool directory access for working directory', async () => {
      const config: ShellToolConfig = {
        enabled: true,
        directoryAccess: {
          allowlist: ['/safe/**/*'],
          blocklist: ['/system/**/*'],
          defaultAllow: true
        },
        workingDirectory: '/safe'
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Bash',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('Bash', {
        path: '/safe/scripts'
      });

      expect(result.allowed).toBe(true);
      expect(result.pathValidation!.allowed).toBe(true);
    });

    it('should use default config when no directory access config is provided', async () => {
      const result = await manager.checkToolPermission('Read', {
        path: '/any/path/file.txt'
      });

      // Should use default allow-all config
      expect(result.pathValidation).toBeDefined();
      expect(result.pathValidation!.allowed).toBe(true);
      expect(result.pathValidation!.reason).toContain('allowed by default');
    });
  });

  describe('session caching behavior for configs', () => {
    it('should cache tool configs in session', async () => {
      const config: BaseToolPermissionConfig = {
        enabled: true,
        requireConfirmation: true,
        timeout: 5000,
        rateLimitPerMinute: 10
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'TestTool',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      // First call should query the store
      const spy = vi.spyOn(store, 'getExtendedPermission');
      const result1 = await manager.checkToolPermission('TestTool');

      expect(spy).toHaveBeenCalledOnce();
      expect(result1.config).toEqual(config);

      // Second call should use cached config
      const result2 = await manager.checkToolPermission('TestTool');

      expect(spy).toHaveBeenCalledOnce(); // Still only called once
      expect(result2.config).toEqual(config);

      vi.restoreAllMocks();
    });

    it('should cache directory access configs per tool and path', async () => {
      const config: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: {
          allowlist: ['/allowed/**/*'],
          blocklist: [],
          defaultAllow: false
        }
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      const spy = vi.spyOn(store, 'getExtendedPermission');

      // First call
      await manager.checkToolPermission('Read', { path: '/allowed/test.txt' });
      expect(spy).toHaveBeenCalledOnce();

      // Second call with same path should use cached directory config
      await manager.checkToolPermission('Read', { path: '/allowed/test.txt' });
      expect(spy).toHaveBeenCalledOnce();

      vi.restoreAllMocks();
    });

    it('should reset session caches when resetSession is called', async () => {
      const config: BaseToolPermissionConfig = {
        enabled: true,
        requireConfirmation: true
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'TestTool',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      // Cache the config
      await manager.checkToolPermission('TestTool');

      // Reset session
      manager.resetSession();

      // Should query store again after reset
      const spy = vi.spyOn(store, 'getExtendedPermission');
      await manager.checkToolPermission('TestTool');

      expect(spy).toHaveBeenCalledOnce();

      vi.restoreAllMocks();
    });
  });

  describe('requireConfirmation scenarios', () => {
    it('should require confirmation when config specifies it', async () => {
      const config: BaseToolPermissionConfig = {
        enabled: true,
        requireConfirmation: true,
        timeout: 5000,
        rateLimitPerMinute: 0
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'TestTool',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('TestTool');

      expect(result.requiresConfirmation).toBe(true);
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
    });

    it('should require confirmation for tools with no permission when config requires it', async () => {
      const config: BaseToolPermissionConfig = {
        enabled: true,
        requireConfirmation: true
      };

      // Save extended permission with config but no actual permission
      const extendedPermission: ExtendedPermission = {
        tool: 'UnknownTool',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);
      await store.clearPermission({ tool: 'UnknownTool' });

      // Mock to simulate no permission but config exists
      vi.spyOn(store, 'getPermission').mockResolvedValue(null);
      vi.spyOn(store, 'getExtendedPermission').mockResolvedValue(extendedPermission);

      const result = await manager.checkToolPermission('UnknownTool');

      expect(result.allowed).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.denialReason).toContain('requires user confirmation');

      vi.restoreAllMocks();
    });

    it('should not require confirmation when config disables it', async () => {
      const config: BaseToolPermissionConfig = {
        enabled: true,
        requireConfirmation: false
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'TestTool',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('TestTool');

      expect(result.requiresConfirmation).toBe(false);
      expect(result.allowed).toBe(true);
    });
  });

  describe('rate limiting config', () => {
    it('should include rate limit config in tool config', async () => {
      const config: BaseToolPermissionConfig = {
        enabled: true,
        requireConfirmation: false,
        rateLimitPerMinute: 60,
        timeout: 5000
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'RateLimitedTool',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('RateLimitedTool');

      expect(result.config).toBeDefined();
      expect((result.config as BaseToolPermissionConfig).rateLimitPerMinute).toBe(60);
      expect(result.allowed).toBe(true);
    });

    it('should handle zero rate limit (unlimited)', async () => {
      const config: BaseToolPermissionConfig = {
        enabled: true,
        rateLimitPerMinute: 0 // Unlimited
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'UnlimitedTool',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('UnlimitedTool');

      expect((result.config as BaseToolPermissionConfig).rateLimitPerMinute).toBe(0);
    });

    it('should handle filesystem tool with specific rate limits', async () => {
      const config: FilesystemToolConfig = {
        enabled: true,
        rateLimitPerMinute: 30,
        maxFileSize: 1024000,
        allowedExtensions: ['.ts', '.js']
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('Read');

      expect((result.config as FilesystemToolConfig).rateLimitPerMinute).toBe(30);
      expect((result.config as FilesystemToolConfig).maxFileSize).toBe(1024000);
    });
  });

  describe('timeout config', () => {
    it('should include timeout config in tool permission result', async () => {
      const config: BaseToolPermissionConfig = {
        enabled: true,
        timeout: 30000, // 30 seconds
        requireConfirmation: false
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'TimeoutTool',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('TimeoutTool');

      expect(result.config).toBeDefined();
      expect((result.config as BaseToolPermissionConfig).timeout).toBe(30000);
      expect(result.allowed).toBe(true);
    });

    it('should handle zero timeout (no limit)', async () => {
      const config: BaseToolPermissionConfig = {
        enabled: true,
        timeout: 0 // No timeout
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'NoTimeoutTool',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('NoTimeoutTool');

      expect((result.config as BaseToolPermissionConfig).timeout).toBe(0);
    });

    it('should handle shell tool with command timeout', async () => {
      const config: ShellToolConfig = {
        enabled: true,
        timeout: 60000, // 1 minute
        blockedCommands: ['rm -rf'],
        allowElevatedPrivileges: false
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Bash',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('Bash');

      expect((result.config as ShellToolConfig).timeout).toBe(60000);
      expect((result.config as ShellToolConfig).blockedCommands).toContain('rm -rf');
    });

    it('should handle web tool with request timeout', async () => {
      const config: WebToolConfig = {
        enabled: true,
        timeout: 15000, // 15 seconds
        maxResponseSize: 5000000,
        followRedirects: true
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'WebFetch',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('WebFetch');

      expect((result.config as WebToolConfig).timeout).toBe(15000);
      expect((result.config as WebToolConfig).maxResponseSize).toBe(5000000);
    });
  });

  describe('consumeAllowOnce parameter behavior', () => {
    it('should consume allow-once permission when consumeAllowOnce is true', async () => {
      await manager.grantPermission('TestTool', undefined, 'allow-once');

      const result = await manager.checkToolPermission('TestTool', {
        consumeAllowOnce: true
      });

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-once');

      // Second call should have null permission
      const result2 = await manager.checkToolPermission('TestTool');
      expect(result2.level).toBeNull();
    });

    it('should not consume allow-once permission when consumeAllowOnce is false', async () => {
      await manager.grantPermission('TestTool', undefined, 'allow-once');

      const result = await manager.checkToolPermission('TestTool', {
        consumeAllowOnce: false
      });

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-once');

      // Second call should still have the permission
      const result2 = await manager.checkToolPermission('TestTool', {
        consumeAllowOnce: false
      });
      expect(result2.level).toBe('allow-once');
    });
  });

  describe('complex integration scenarios', () => {
    it('should handle tool with permission, config, and path validation all affecting result', async () => {
      const config: FilesystemToolConfig = {
        enabled: true,
        requireConfirmation: true,
        timeout: 10000,
        rateLimitPerMinute: 20,
        directoryAccess: {
          allowlist: ['/project/**/*'],
          blocklist: ['/project/secrets/**/*'],
          defaultAllow: false
        },
        maxFileSize: 512000,
        allowedExtensions: ['.ts']
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Edit',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      // Test case 1: Allowed path, tool enabled
      const result1 = await manager.checkToolPermission('Edit', {
        path: '/project/src/main.ts'
      });

      expect(result1.allowed).toBe(true);
      expect(result1.level).toBe('allow-always');
      expect(result1.requiresConfirmation).toBe(true);
      expect(result1.pathValidation!.allowed).toBe(true);

      // Test case 2: Blocked path, tool enabled
      const result2 = await manager.checkToolPermission('Edit', {
        path: '/project/secrets/config.ts'
      });

      expect(result2.allowed).toBe(false);
      expect(result2.pathValidation!.allowed).toBe(false);
      expect(result2.denialReason).toContain('Directory access denied');
    });

    it('should handle tool disabled via config overriding permission and path', async () => {
      const config: FilesystemToolConfig = {
        enabled: false, // Tool disabled
        directoryAccess: {
          allowlist: ['/**/*'], // Allow all paths
          defaultAllow: true
        }
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Read',
        level: 'allow-always', // Has permission
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('Read', {
        path: '/any/allowed/path.ts'
      });

      expect(result.allowed).toBe(false);
      expect(result.level).toBe('allow-always');
      expect(result.denialReason).toBe('Tool is disabled via configuration');
      // Path validation should still occur
      expect(result.pathValidation!.allowed).toBe(true);
    });
  });
});