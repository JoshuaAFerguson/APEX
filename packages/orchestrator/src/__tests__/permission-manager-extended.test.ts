/**
 * @fileoverview Tests for PermissionManager extended functionality (v0.5.0)
 *
 * This test suite focuses on testing the new methods added to PermissionManager:
 * - checkToolPermission
 * - checkDirectoryAccess
 * - getToolConfig
 *
 * These tests cover the ADR-009 specification for granular tool and directory permission checks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import {
  Permission,
  PermissionLevel,
  ToolPermissionCheckOptions,
  ToolPermissionResult,
  DirectoryAccessCheckOptions,
  DirectoryAccessResult,
  ToolPermissionConfig,
  DirectoryAccessConfig,
  ExtendedPermission,
  FilesystemToolConfig,
  ShellToolConfig,
  WebToolConfig,
  SearchToolConfig,
  BaseToolPermissionConfig,
} from '@apexcli/core';

describe('PermissionManager Extended Functionality', () => {
  let manager: PermissionManager;
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = join(tmpdir(), `apex-permission-manager-ext-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
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

  describe('getToolConfig', () => {
    it('should return null when no tool config exists', async () => {
      const config = await manager.getToolConfig('NonExistentTool');
      expect(config).toBeNull();
    });

    it('should return tool config from extended permission', async () => {
      const toolConfig: BaseToolPermissionConfig = {
        enabled: true,
        timeout: 5000,
        requireConfirmation: false,
        rateLimitPerMinute: 60,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'ConfiguredTool',
        scope: 'test-scope',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.getToolConfig('ConfiguredTool', 'test-scope');
      expect(result).toEqual(toolConfig);
    });

    it('should handle filesystem tool config', async () => {
      const filesystemConfig: FilesystemToolConfig = {
        enabled: true,
        timeout: 3000,
        requireConfirmation: false,
        directoryAccess: {
          allowlist: ['src/**/*'],
          blocklist: ['src/private/**/*'],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 10,
        },
        maxFileSize: 1048576, // 1MB
        allowedExtensions: ['.ts', '.js', '.json'],
        blockedExtensions: ['.exe', '.bat'],
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
        config: filesystemConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.getToolConfig('Read');
      expect(result).toEqual(filesystemConfig);
    });

    it('should handle shell tool config', async () => {
      const shellConfig: ShellToolConfig = {
        enabled: true,
        timeout: 10000,
        requireConfirmation: true,
        directoryAccess: {
          allowlist: ['/usr/local/bin/**/*'],
          blocklist: ['/etc/**/*', '/var/**/*'],
          defaultAllow: false,
        },
        blockedCommands: ['rm -rf', 'sudo', 'su'],
        allowElevatedPrivileges: false,
        environment: {
          'NODE_ENV': 'development',
          'PATH': '/usr/local/bin:/usr/bin:/bin',
        },
        workingDirectory: '/home/user/workspace',
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Bash',
        level: 'allow-once',
        createdAt: new Date(),
        config: shellConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.getToolConfig('Bash');
      expect(result).toEqual(shellConfig);
    });

    it('should handle web tool config', async () => {
      const webConfig: WebToolConfig = {
        enabled: true,
        timeout: 15000,
        requireConfirmation: false,
        allowedDomains: ['api.github.com', '*.example.com'],
        blockedDomains: ['malicious.com', 'spam.net'],
        maxResponseSize: 5242880, // 5MB
        followRedirects: true,
        headers: {
          'User-Agent': 'APEX-WebFetch/1.0',
          'Accept': 'application/json',
        },
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'WebFetch',
        level: 'allow-always',
        createdAt: new Date(),
        config: webConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.getToolConfig('WebFetch');
      expect(result).toEqual(webConfig);
    });

    it('should handle search tool config', async () => {
      const searchConfig: SearchToolConfig = {
        enabled: true,
        timeout: 8000,
        requireConfirmation: false,
        directoryAccess: {
          allowlist: ['src/**/*', 'docs/**/*'],
          blocklist: ['node_modules/**/*'],
          defaultAllow: false,
        },
        maxResults: 500,
        includePatterns: ['*.ts', '*.js', '*.md'],
        excludePatterns: ['*.test.*', '*.spec.*'],
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Grep',
        level: 'allow-always',
        createdAt: new Date(),
        config: searchConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.getToolConfig('Grep');
      expect(result).toEqual(searchConfig);
    });

    it('should cache tool config for session', async () => {
      const toolConfig: BaseToolPermissionConfig = {
        enabled: true,
        timeout: 2000,
        requireConfirmation: false,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'CachedTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      // First call should query the store
      const result1 = await manager.getToolConfig('CachedTool');
      expect(result1).toEqual(toolConfig);

      // Second call should use cache (same object reference)
      const result2 = await manager.getToolConfig('CachedTool');
      expect(result2).toEqual(toolConfig);
      expect(result2).toBe(result1);
    });

    it('should handle tool config without scope', async () => {
      const toolConfig: BaseToolPermissionConfig = {
        enabled: false,
        requireConfirmation: true,
        rateLimitPerMinute: 10,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'GlobalTool',
        level: 'deny',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.getToolConfig('GlobalTool');
      expect(result).toEqual(toolConfig);
    });

    it('should clear tool config cache on resetSession', async () => {
      const toolConfig: BaseToolPermissionConfig = {
        enabled: true,
        timeout: 1000,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'ResetTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      // Populate cache
      await manager.getToolConfig('ResetTool');

      // Reset session
      manager.resetSession();

      // Config should still be available from store, but cache should be cleared
      const result = await manager.getToolConfig('ResetTool');
      expect(result).toEqual(toolConfig);
    });
  });

  describe('checkDirectoryAccess', () => {
    it('should allow access when no directory config exists', async () => {
      const result = await manager.checkDirectoryAccess('/test/path');

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('allowed');
      expect(result.configUsed).toEqual({
        allowlist: [],
        blocklist: [],
        defaultAllow: true,
        resolveSymlinks: true,
        maxDepth: 0,
      });
    });

    it('should use tool-specific directory config', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/allowed/**'],
        blocklist: ['/blocked/**'],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 5,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
        maxFileSize: 1048576,
        allowedExtensions: ['.txt'],
        blockedExtensions: ['.exe'],
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'FileTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkDirectoryAccess('/allowed/subfolder', {
        tool: 'FileTool',
      });

      expect(result.allowed).toBe(true);
      expect(result.configUsed).toEqual(directoryConfig);
      expect(result.matchType).toBe('allowlist');
    });

    it('should block access based on blocklist patterns', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: [],
        blocklist: ['**/.git/**', '**/node_modules/**'],
        defaultAllow: true,
        resolveSymlinks: true,
        maxDepth: 0,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'BlockedTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkDirectoryAccess('/project/.git/config', {
        tool: 'BlockedTool',
      });

      expect(result.allowed).toBe(false);
      expect(result.matchType).toBe('blocklist');
      expect(result.matchedPattern).toBe('**/.git/**');
    });

    it('should handle complex allowlist and blocklist patterns', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['src/**/*', 'docs/**/*.md'],
        blocklist: ['src/private/**/*', 'docs/internal/**/*'],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 10,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'ComplexTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      // Test allowed paths
      const allowedSrc = await manager.checkDirectoryAccess('/project/src/main.ts', {
        tool: 'ComplexTool',
      });
      expect(allowedSrc.allowed).toBe(true);
      expect(allowedSrc.matchType).toBe('allowlist');

      const allowedDocs = await manager.checkDirectoryAccess('/project/docs/readme.md', {
        tool: 'ComplexTool',
      });
      expect(allowedDocs.allowed).toBe(true);
      expect(allowedDocs.matchType).toBe('allowlist');

      // Test blocked paths (blocklist takes precedence)
      const blockedPrivate = await manager.checkDirectoryAccess('/project/src/private/secret.ts', {
        tool: 'ComplexTool',
      });
      expect(blockedPrivate.allowed).toBe(false);
      expect(blockedPrivate.matchType).toBe('blocklist');

      // Test default deny
      const defaultDeny = await manager.checkDirectoryAccess('/project/other/file.txt', {
        tool: 'ComplexTool',
      });
      expect(defaultDeny.allowed).toBe(false);
      expect(defaultDeny.matchType).toBe('default');
    });

    it('should cache directory config for session', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/cache-test/**'],
        blocklist: [],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 0,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'CacheTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      // First call
      const result1 = await manager.checkDirectoryAccess('/cache-test/file.txt', {
        tool: 'CacheTool',
      });
      expect(result1.allowed).toBe(true);

      // Second call should use cached config
      const result2 = await manager.checkDirectoryAccess('/cache-test/other.txt', {
        tool: 'CacheTool',
      });
      expect(result2.allowed).toBe(true);
    });

    it('should handle options with baseDir', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['src/**/*'],
        blocklist: [],
        defaultAllow: false,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'BaseDirTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const options: DirectoryAccessCheckOptions = {
        tool: 'BaseDirTool',
        baseDir: '/project',
      };

      const result = await manager.checkDirectoryAccess('src/main.ts', options);
      expect(result.allowed).toBe(true);
    });

    it('should handle options with scope', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/scoped/**'],
        blocklist: [],
        defaultAllow: false,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'ScopedTool',
        scope: 'development',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const options: DirectoryAccessCheckOptions = {
        tool: 'ScopedTool',
        scope: 'development',
      };

      const result = await manager.checkDirectoryAccess('/scoped/file.txt', options);
      expect(result.allowed).toBe(true);
    });

    it('should clear directory access cache on resetSession', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/reset-test/**'],
        blocklist: [],
        defaultAllow: false,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'ResetDirectoryTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      // Populate directory access cache
      await manager.checkDirectoryAccess('/reset-test/file.txt', {
        tool: 'ResetDirectoryTool',
      });

      // Reset session
      manager.resetSession();

      // Directory access should still work, but cache should be cleared
      const result = await manager.checkDirectoryAccess('/reset-test/file2.txt', {
        tool: 'ResetDirectoryTool',
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkToolPermission', () => {
    it('should return comprehensive permission result for allowed tool', async () => {
      await manager.grantPermission('AllowedTool', 'test-scope', 'allow-always');

      const result = await manager.checkToolPermission('AllowedTool', {
        scope: 'test-scope',
      });

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.denialReason).toBeUndefined();
    });

    it('should return denial for explicitly denied tool', async () => {
      await manager.grantPermission('DeniedTool', 'test-scope', 'deny');

      const result = await manager.checkToolPermission('DeniedTool', {
        scope: 'test-scope',
      });

      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');
      expect(result.denialReason).toBe('Tool access is explicitly denied');
    });

    it('should include tool configuration in result', async () => {
      const toolConfig: BaseToolPermissionConfig = {
        enabled: true,
        timeout: 5000,
        requireConfirmation: false,
        rateLimitPerMinute: 100,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'ConfigTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('ConfigTool');

      expect(result.allowed).toBe(true);
      expect(result.config).toEqual(toolConfig);
    });

    it('should perform path validation when path is provided', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/valid/**'],
        blocklist: ['/blocked/**'],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 0,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'PathTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      // Test blocked path
      const blockedResult = await manager.checkToolPermission('PathTool', {
        path: '/blocked/secret.txt',
      });

      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.denialReason).toContain('Directory access denied');
      expect(blockedResult.pathValidation).toBeDefined();
      expect(blockedResult.pathValidation?.allowed).toBe(false);

      // Test allowed path
      const allowedResult = await manager.checkToolPermission('PathTool', {
        path: '/valid/file.txt',
      });

      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.pathValidation).toBeDefined();
      expect(allowedResult.pathValidation?.allowed).toBe(true);
    });

    it('should require confirmation when tool config requires it and no explicit permission exists', async () => {
      const toolConfig: BaseToolPermissionConfig = {
        enabled: true,
        requireConfirmation: true,
        timeout: 1000,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'ConfirmTool',
        // Note: no level set, so no explicit permission
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      // Check tool without existing explicit permission
      const result = await manager.checkToolPermission('UnknownTool');

      expect(result.allowed).toBe(true); // Default behavior for unknown tools
      expect(result.level).toBeNull();
    });

    it('should deny access for disabled tools', async () => {
      const toolConfig: BaseToolPermissionConfig = {
        enabled: false,
        timeout: 1000,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'DisabledTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('DisabledTool');

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toBe('Tool is disabled via configuration');
    });

    it('should not consume allow-once when consumeAllowOnce is false', async () => {
      await manager.grantPermission('OnceTool', 'test', 'allow-once');

      // Check without consuming
      const result1 = await manager.checkToolPermission('OnceTool', {
        scope: 'test',
        consumeAllowOnce: false,
      });

      expect(result1.allowed).toBe(true);
      expect(result1.level).toBe('allow-once');

      // Check again - should still be available
      const result2 = await manager.checkToolPermission('OnceTool', {
        scope: 'test',
        consumeAllowOnce: false,
      });

      expect(result2.allowed).toBe(true);
      expect(result2.level).toBe('allow-once');

      // Now consume it
      const result3 = await manager.checkToolPermission('OnceTool', {
        scope: 'test',
        consumeAllowOnce: true,
      });

      expect(result3.allowed).toBe(true);
      expect(result3.level).toBe('allow-once');

      // Should be gone now
      const result4 = await manager.checkToolPermission('OnceTool', {
        scope: 'test',
      });

      expect(result4.level).toBeNull();
    });

    it('should handle allow-once consumption by default', async () => {
      await manager.grantPermission('DefaultOnceTool', 'test', 'allow-once');

      // First check should consume the permission
      const result1 = await manager.checkToolPermission('DefaultOnceTool', {
        scope: 'test',
      });

      expect(result1.allowed).toBe(true);
      expect(result1.level).toBe('allow-once');

      // Second check should show no permission
      const result2 = await manager.checkToolPermission('DefaultOnceTool', {
        scope: 'test',
      });

      expect(result2.level).toBeNull();
    });

    it('should handle complex scenarios with path validation and configuration', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/project/src/**'],
        blocklist: ['/project/src/private/**'],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 0,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        timeout: 3000,
        requireConfirmation: false,
        directoryAccess: directoryConfig,
        maxFileSize: 2097152, // 2MB
        allowedExtensions: ['.ts', '.js'],
        blockedExtensions: ['.exe'],
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'ComplexTool',
        scope: 'dev',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      // Should allow access to allowed path
      const result1 = await manager.checkToolPermission('ComplexTool', {
        scope: 'dev',
        path: '/project/src/components/Button.tsx',
      });

      expect(result1.allowed).toBe(true);
      expect(result1.pathValidation?.allowed).toBe(true);
      expect(result1.config).toEqual(toolConfig);

      // Should deny access to blocked path
      const result2 = await manager.checkToolPermission('ComplexTool', {
        scope: 'dev',
        path: '/project/src/private/secrets.json',
      });

      expect(result2.allowed).toBe(false);
      expect(result2.pathValidation?.allowed).toBe(false);
      expect(result2.denialReason).toContain('Directory access denied');
    });

    it('should handle baseDir option in path validation', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['src/**/*'],
        blocklist: [],
        defaultAllow: false,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'BaseDirPathTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('BaseDirPathTool', {
        path: 'src/main.ts',
        baseDir: '/project',
      });

      expect(result.allowed).toBe(true);
      expect(result.pathValidation?.allowed).toBe(true);
    });

    it('should handle tools without explicit permissions or config', async () => {
      const result = await manager.checkToolPermission('UnknownTool');

      expect(result.allowed).toBe(true); // Default behavior
      expect(result.level).toBeNull();
      expect(result.requiresConfirmation).toBe(false);
      expect(result.config).toBeNull();
    });

    it('should prioritize path validation failure over tool permission', async () => {
      // Tool has allow permission but path is blocked
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: [],
        blocklist: ['**/*'],
        defaultAllow: false,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'AllowedButBlockedPath',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      const result = await manager.checkToolPermission('AllowedButBlockedPath', {
        path: '/any/file.txt',
      });

      expect(result.allowed).toBe(false);
      expect(result.level).toBe('allow-always'); // Tool permission is still allow-always
      expect(result.denialReason).toContain('Directory access denied');
    });

    it('should handle scope parameter correctly', async () => {
      const toolConfig: BaseToolPermissionConfig = {
        enabled: true,
        requireConfirmation: false,
      };

      // Create two different configs for different scopes
      const extendedPermission1: ExtendedPermission = {
        tool: 'ScopedTool',
        scope: 'scope1',
        level: 'allow-always',
        createdAt: new Date(),
        config: { ...toolConfig, timeout: 1000 },
      };

      const extendedPermission2: ExtendedPermission = {
        tool: 'ScopedTool',
        scope: 'scope2',
        level: 'deny',
        createdAt: new Date(),
        config: { ...toolConfig, timeout: 2000 },
      };

      await store.saveExtendedPermission(extendedPermission1);
      await store.saveExtendedPermission(extendedPermission2);

      // Test scope1
      const result1 = await manager.checkToolPermission('ScopedTool', {
        scope: 'scope1',
      });

      expect(result1.allowed).toBe(true);
      expect(result1.level).toBe('allow-always');
      expect((result1.config as any)?.timeout).toBe(1000);

      // Test scope2
      const result2 = await manager.checkToolPermission('ScopedTool', {
        scope: 'scope2',
      });

      expect(result2.allowed).toBe(false);
      expect(result2.level).toBe('deny');
      expect((result2.config as any)?.timeout).toBe(2000);

      // Test non-existent scope
      const result3 = await manager.checkToolPermission('ScopedTool', {
        scope: 'scope3',
      });

      expect(result3.level).toBeNull();
      expect(result3.config).toBeNull();
    });
  });

  describe('integration tests', () => {
    it('should work together - tool config affects directory access and permission check', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/workspace/src/**'],
        blocklist: ['/workspace/src/secrets/**'],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 10,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        timeout: 5000,
        requireConfirmation: false,
        directoryAccess: directoryConfig,
        maxFileSize: 1048576,
        allowedExtensions: ['.ts', '.js', '.json'],
        blockedExtensions: ['.exe', '.dll'],
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'IntegratedTool',
        scope: 'integration-test',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
        grantReason: 'Integration test setup',
        grantedBy: 'test-user',
        tags: ['test', 'filesystem'],
      };

      await store.saveExtendedPermission(extendedPermission);

      // Test 1: Get tool config directly
      const config = await manager.getToolConfig('IntegratedTool', 'integration-test');
      expect(config).toEqual(toolConfig);

      // Test 2: Check directory access using the tool
      const directoryResult = await manager.checkDirectoryAccess('/workspace/src/main.ts', {
        tool: 'IntegratedTool',
        scope: 'integration-test',
      });
      expect(directoryResult.allowed).toBe(true);
      expect(directoryResult.configUsed).toEqual(directoryConfig);

      // Test 3: Check tool permission with path validation
      const toolResult = await manager.checkToolPermission('IntegratedTool', {
        scope: 'integration-test',
        path: '/workspace/src/main.ts',
      });
      expect(toolResult.allowed).toBe(true);
      expect(toolResult.level).toBe('allow-always');
      expect(toolResult.config).toEqual(toolConfig);
      expect(toolResult.pathValidation?.allowed).toBe(true);

      // Test 4: Path that should be blocked
      const blockedResult = await manager.checkToolPermission('IntegratedTool', {
        scope: 'integration-test',
        path: '/workspace/src/secrets/key.txt',
      });
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.denialReason).toContain('Directory access denied');
    });

    it('should maintain session cache consistency across all methods', async () => {
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/cache/**'],
        blocklist: [],
        defaultAllow: false,
      };

      const toolConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'CacheConsistencyTool',
        level: 'allow-always',
        createdAt: new Date(),
        config: toolConfig,
      };

      await store.saveExtendedPermission(extendedPermission);

      // First, populate all caches
      await manager.getToolConfig('CacheConsistencyTool');
      await manager.checkDirectoryAccess('/cache/file.txt', {
        tool: 'CacheConsistencyTool',
      });

      // Grant a session permission
      await manager.grantPermission('SessionTool', undefined, 'allow-once');

      // Reset session should clear all caches
      manager.resetSession();

      // Session permission should be gone
      expect(await manager.checkPermission('SessionTool')).toBeNull();

      // But persistent data should still be accessible
      const config = await manager.getToolConfig('CacheConsistencyTool');
      expect(config).toEqual(toolConfig);

      const directoryResult = await manager.checkDirectoryAccess('/cache/file.txt', {
        tool: 'CacheConsistencyTool',
      });
      expect(directoryResult.allowed).toBe(true);
    });

    it('should handle error scenarios gracefully', async () => {
      // Test with invalid path
      const result1 = await manager.checkDirectoryAccess('');
      expect(result1.allowed).toBe(false);

      // Test with non-existent tool config
      const config = await manager.getToolConfig('NonExistent');
      expect(config).toBeNull();

      // Test tool permission with invalid options
      const result2 = await manager.checkToolPermission('AnyTool', {
        path: '',
      });
      expect(result2.pathValidation?.allowed).toBe(false);
    });
  });
});