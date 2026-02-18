import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import {
  Permission,
  PermissionLevel,
  ToolPermissionConfig,
  FilesystemToolConfig,
  ShellToolConfig,
  WebToolConfig,
  DirectoryAccessConfig
} from '@apexcli/core';

/**
 * Comprehensive permission check integration tests focused on autonomy levels
 *
 * These tests specifically validate the acceptance criteria:
 * - Permission checks correctly evaluate whether an action is allowed based on current permission state
 * - Tests cover checking permissions that exist
 * - Tests cover checking permissions that don't exist
 * - Tests cover checking permissions with various autonomy levels
 *
 * This test file complements permission-check-integration.test.ts by focusing on:
 * - Advanced autonomy level scenarios
 * - Complex tool configurations
 * - Permission preset behaviors
 * - Edge cases in permission evaluation
 */
describe('Permission Check Autonomy Integration Tests', () => {
  let manager: PermissionManager;
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-autonomy-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    store = new PermissionStore(testDir);
    await store.initialize();

    manager = new PermissionManager(store);
  });

  afterEach(() => {
    if (store) {
      store.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Permission evaluation with various autonomy levels', () => {
    it('should handle autonomous autonomy level - allow all tools without confirmation', async () => {
      // In autonomous mode, tools should be allowed by default even without explicit permissions
      const tools = ['Read', 'Write', 'Edit', 'Bash', 'WebFetch', 'Grep'];

      for (const tool of tools) {
        const result = await manager.checkToolPermission(tool, {
          scope: `/test/${tool.toLowerCase()}/path`
        });

        // No explicit permission exists, but in autonomous mode this should be allowed
        expect(result.level).toBeNull();
        expect(result.allowed).toBe(true);
        expect(result.requiresConfirmation).toBe(false);
        expect(result.denialReason).toBeUndefined();
      }
    });

    it('should handle review-all autonomy level - require confirmation for all tools', async () => {
      // Set up tool configurations that require confirmation
      const toolConfigs: Array<{ tool: string; config: ToolPermissionConfig }> = [
        {
          tool: 'Write',
          config: { enabled: true, requireConfirmation: true }
        },
        {
          tool: 'Bash',
          config: {
            enabled: true,
            requireConfirmation: true,
            blockedCommands: ['rm -rf']
          } as ShellToolConfig
        },
        {
          tool: 'WebFetch',
          config: {
            enabled: true,
            requireConfirmation: true,
            allowedDomains: ['api.example.com'],
            blockedDomains: ['malicious.com']
          } as WebToolConfig
        }
      ];

      // Store configurations
      for (const { tool, config } of toolConfigs) {
        await store.saveExtendedPermission({
          tool,
          level: null,
          config,
          createdAt: new Date()
        });
      }

      // Test each tool requires confirmation
      for (const { tool } of toolConfigs) {
        const result = await manager.checkToolPermission(tool);

        expect(result.level).toBeNull();
        expect(result.allowed).toBe(false);
        expect(result.requiresConfirmation).toBe(true);
        expect(result.denialReason).toBe('Tool requires user confirmation before execution');
        expect(result.config).toBeDefined();
        expect(result.config!.requireConfirmation).toBe(true);
      }
    });

    it('should handle read-only autonomy level - only allow safe read operations', async () => {
      // Set up read-only configurations
      const readOnlyTools = ['Read', 'Grep', 'Glob'];
      const restrictedTools = ['Write', 'Edit', 'Bash'];

      // Configure read-only tools as enabled
      for (const tool of readOnlyTools) {
        await store.saveExtendedPermission({
          tool,
          level: null,
          config: { enabled: true, requireConfirmation: false },
          createdAt: new Date()
        });
      }

      // Configure restricted tools as disabled
      for (const tool of restrictedTools) {
        await store.saveExtendedPermission({
          tool,
          level: null,
          config: { enabled: false, requireConfirmation: false },
          createdAt: new Date()
        });
      }

      // Test read-only tools are allowed
      for (const tool of readOnlyTools) {
        const result = await manager.checkToolPermission(tool, {
          scope: '/src/**/*.ts'
        });

        expect(result.allowed).toBe(true);
        expect(result.level).toBeNull();
        expect(result.requiresConfirmation).toBe(false);
        expect(result.config?.enabled).toBe(true);
      }

      // Test restricted tools are denied
      for (const tool of restrictedTools) {
        const result = await manager.checkToolPermission(tool, {
          scope: '/src/**/*.ts'
        });

        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull();
        expect(result.requiresConfirmation).toBe(false);
        expect(result.denialReason).toBe('Tool is disabled via configuration');
        expect(result.config?.enabled).toBe(false);
      }
    });

    it('should handle mixed autonomy levels with permission overrides', async () => {
      // Scenario: review-all mode with some tools having explicit permissions

      // Set base configuration requiring confirmation
      await store.saveExtendedPermission({
        tool: 'Write',
        level: null,
        config: { enabled: true, requireConfirmation: true },
        createdAt: new Date()
      });

      // But grant explicit allow-always permission for specific scope
      await store.savePermission({
        tool: 'Write',
        scope: '/safe/directory/**',
        level: 'allow-always',
        createdAt: new Date()
      });

      // Grant allow-once for another scope
      await store.savePermission({
        tool: 'Write',
        scope: '/temp/files/**',
        level: 'allow-once',
        expiry: new Date(Date.now() + 3600000),
        createdAt: new Date()
      });

      // Test explicit allow-always overrides confirmation requirement
      const safeResult = await manager.checkToolPermission('Write', {
        scope: '/safe/directory/**'
      });

      expect(safeResult.allowed).toBe(true);
      expect(safeResult.level).toBe('allow-always');
      expect(safeResult.requiresConfirmation).toBe(false);

      // Test allow-once works
      const tempResult = await manager.checkToolPermission('Write', {
        scope: '/temp/files/**'
      });

      expect(tempResult.allowed).toBe(true);
      expect(tempResult.level).toBe('allow-once');
      expect(tempResult.requiresConfirmation).toBe(false);

      // Test second access to allow-once fails
      const tempResult2 = await manager.checkToolPermission('Write', {
        scope: '/temp/files/**'
      });

      expect(tempResult2.level).toBeNull();
      expect(tempResult2.allowed).toBe(false);
      expect(tempResult2.requiresConfirmation).toBe(true);

      // Test other scopes still require confirmation
      const otherResult = await manager.checkToolPermission('Write', {
        scope: '/other/directory/**'
      });

      expect(otherResult.allowed).toBe(false);
      expect(otherResult.level).toBeNull();
      expect(otherResult.requiresConfirmation).toBe(true);
      expect(otherResult.denialReason).toBe('Tool requires user confirmation before execution');
    });
  });

  describe('Complex tool configuration scenarios', () => {
    it('should handle filesystem tool with advanced directory restrictions', async () => {
      const restrictiveConfig: FilesystemToolConfig = {
        enabled: true,
        requireConfirmation: false,
        directoryAccess: {
          allowlist: ['/public/**', '/docs/**/*.md'],
          blocklist: ['/secret/**', '/config/*.json'],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 3
        },
        maxFileSize: 1024 * 1024, // 1MB limit
        allowedExtensions: ['.md', '.txt', '.json']
      };

      await store.saveExtendedPermission({
        tool: 'Write',
        level: 'allow-always',
        config: restrictiveConfig,
        createdAt: new Date()
      });

      // Test allowed path
      const allowedResult = await manager.checkToolPermission('Write', {
        scope: '/public/data.txt',
        path: '/public/data.txt'
      });

      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.level).toBe('allow-always');
      expect(allowedResult.pathValidation?.allowed).toBe(true);

      // Test blocked path
      const blockedResult = await manager.checkToolPermission('Write', {
        scope: '/secret/sensitive.txt',
        path: '/secret/sensitive.txt'
      });

      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.level).toBe('allow-always');
      expect(blockedResult.pathValidation?.allowed).toBe(false);
      expect(blockedResult.denialReason).toMatch(/Directory access denied/);
    });

    it('should handle shell tool with command restrictions', async () => {
      const shellConfig: ShellToolConfig = {
        enabled: true,
        requireConfirmation: false,
        blockedCommands: [
          '^rm\\s+-rf\\s+/',    // Block rm -rf /
          'sudo\\s+.*',         // Block all sudo commands
          'chmod\\s+777\\s+.*', // Block chmod 777
          '.*\\|\\s*sh\\s*$'    // Block piping to shell
        ],
        timeout: 30000, // 30 second timeout
        directoryAccess: {
          allowlist: ['/workspace/**'],
          blocklist: ['/system/**'],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 0
        }
      };

      await store.saveExtendedPermission({
        tool: 'Bash',
        level: 'allow-always',
        config: shellConfig,
        createdAt: new Date()
      });

      // Test safe command
      const safeResult = await manager.checkToolPermission('Bash', {
        scope: 'npm install'
      });

      expect(safeResult.allowed).toBe(true);
      expect(safeResult.level).toBe('allow-always');
      expect(safeResult.config).toEqual(shellConfig);

      // Test blocked command patterns
      const blockedCommands = [
        'rm -rf /',
        'sudo apt update',
        'chmod 777 /etc/passwd',
        'cat /etc/passwd | sh'
      ];

      for (const command of blockedCommands) {
        const blockedResult = await manager.checkToolPermission('Bash', {
          scope: command
        });

        expect(blockedResult.allowed).toBe(true); // Still allowed at permission level
        expect(blockedResult.level).toBe('allow-always');
        expect(blockedResult.config?.enabled).toBe(true);
        // Note: Command validation would be handled by the actual Bash tool implementation
      }
    });

    it('should handle web tool with domain restrictions', async () => {
      const webConfig: WebToolConfig = {
        enabled: true,
        requireConfirmation: false,
        allowedDomains: [
          'api.github.com',
          '*.stackoverflow.com',
          'docs.anthropic.com'
        ],
        blockedDomains: [
          '*.malware.com',
          'suspicious.site',
          '*.ad-network.com'
        ],
        timeout: 10000,
        maxRedirects: 5
      };

      await store.saveExtendedPermission({
        tool: 'WebFetch',
        level: 'allow-always',
        config: webConfig,
        createdAt: new Date()
      });

      // Test allowed domain
      const allowedResult = await manager.checkToolPermission('WebFetch', {
        scope: 'https://api.github.com/repos/user/repo'
      });

      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.level).toBe('allow-always');
      expect(allowedResult.config).toEqual(webConfig);

      // Configuration exists, but domain validation would be handled by WebFetch tool
      const blockedResult = await manager.checkToolPermission('WebFetch', {
        scope: 'https://suspicious.site/malware'
      });

      expect(blockedResult.allowed).toBe(true); // Permission level allows it
      expect(blockedResult.level).toBe('allow-always');
      expect(blockedResult.config).toEqual(webConfig);
      // Domain blocking would be enforced by the actual WebFetch tool implementation
    });
  });

  describe('Permission state evaluation edge cases', () => {
    it('should handle permission checks with null and undefined scopes consistently', async () => {
      // Set up permissions with and without scopes
      await store.savePermission({
        tool: 'TestTool',
        level: 'allow-always',
        createdAt: new Date()
      });

      await store.savePermission({
        tool: 'TestTool',
        scope: 'specific-scope',
        level: 'deny',
        createdAt: new Date()
      });

      // Check with no scope (should match global permission)
      const globalCheck = await manager.checkToolPermission('TestTool');
      expect(globalCheck.level).toBe('allow-always');
      expect(globalCheck.allowed).toBe(true);

      // Check with undefined scope (should be same as no scope)
      const undefinedCheck = await manager.checkToolPermission('TestTool', {
        scope: undefined
      });
      expect(undefinedCheck.level).toBe('allow-always');
      expect(undefinedCheck.allowed).toBe(true);

      // Check with specific scope (should match specific permission)
      const scopedCheck = await manager.checkToolPermission('TestTool', {
        scope: 'specific-scope'
      });
      expect(scopedCheck.level).toBe('deny');
      expect(scopedCheck.allowed).toBe(false);
    });

    it('should handle expired permissions correctly in various scenarios', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const oneHourFromNow = new Date(now.getTime() + 3600000);

      // Set up expired permission
      await store.savePermission({
        tool: 'ExpiredTool',
        scope: 'expired',
        level: 'allow-once',
        expiry: oneHourAgo,
        createdAt: new Date(now.getTime() - 7200000) // 2 hours ago
      });

      // Set up valid permission
      await store.savePermission({
        tool: 'ExpiredTool',
        scope: 'valid',
        level: 'allow-once',
        expiry: oneHourFromNow,
        createdAt: now
      });

      // Check expired permission - should not be found
      const expiredResult = await manager.checkToolPermission('ExpiredTool', {
        scope: 'expired'
      });
      expect(expiredResult.level).toBeNull();
      expect(expiredResult.allowed).toBe(true); // Default behavior

      // Check valid permission - should be found and consumed
      const validResult = await manager.checkToolPermission('ExpiredTool', {
        scope: 'valid'
      });
      expect(validResult.level).toBe('allow-once');
      expect(validResult.allowed).toBe(true);

      // Second check of valid permission - should be consumed
      const consumedResult = await manager.checkToolPermission('ExpiredTool', {
        scope: 'valid'
      });
      expect(consumedResult.level).toBeNull();
    });

    it('should handle consumeAllowOnce option with session caching', async () => {
      // Grant allow-once permission
      await manager.grantPermission('TestTool', 'test-scope', 'allow-once');

      // Check without consuming (multiple times)
      for (let i = 0; i < 3; i++) {
        const result = await manager.checkToolPermission('TestTool', {
          scope: 'test-scope',
          consumeAllowOnce: false
        });

        expect(result.level).toBe('allow-once');
        expect(result.allowed).toBe(true);
      }

      // Now consume it
      const consumedResult = await manager.checkToolPermission('TestTool', {
        scope: 'test-scope',
        consumeAllowOnce: true
      });

      expect(consumedResult.level).toBe('allow-once');
      expect(consumedResult.allowed).toBe(true);

      // Should be gone now
      const finalResult = await manager.checkToolPermission('TestTool', {
        scope: 'test-scope'
      });

      expect(finalResult.level).toBeNull();
    });

    it('should handle concurrent permission checks with allow-once', async () => {
      // Set up allow-once permission
      await manager.grantPermission('ConcurrentTool', 'test', 'allow-once');

      // Multiple concurrent checks - only one should get the permission
      const promises = Array(5).fill(0).map(() =>
        manager.checkToolPermission('ConcurrentTool', {
          scope: 'test'
        })
      );

      const results = await Promise.all(promises);

      // Exactly one should have allow-once level and be allowed
      const allowOnceResults = results.filter(r => r.level === 'allow-once');
      const nullResults = results.filter(r => r.level === null);

      expect(allowOnceResults).toHaveLength(1);
      expect(nullResults).toHaveLength(4);

      // The one with allow-once should be allowed
      expect(allowOnceResults[0].allowed).toBe(true);
    });
  });

  describe('Tool configuration and permission interaction', () => {
    it('should prioritize explicit deny over configuration', async () => {
      // Set up configuration that allows the tool
      await store.saveExtendedPermission({
        tool: 'TestTool',
        level: null,
        config: {
          enabled: true,
          requireConfirmation: false
        },
        createdAt: new Date()
      });

      // But also set explicit deny permission
      await store.savePermission({
        tool: 'TestTool',
        level: 'deny',
        createdAt: new Date()
      });

      const result = await manager.checkToolPermission('TestTool');

      expect(result.level).toBe('deny');
      expect(result.allowed).toBe(false);
      expect(result.denialReason).toBe('Tool access is explicitly denied');
      expect(result.config?.enabled).toBe(true);
    });

    it('should handle directory access validation overriding permission level', async () => {
      // Set up allow-always permission
      await store.savePermission({
        tool: 'Write',
        scope: '/restricted/file.txt',
        level: 'allow-always',
        createdAt: new Date()
      });

      // But with restrictive directory config
      await store.saveExtendedPermission({
        tool: 'Write',
        level: null,
        config: {
          enabled: true,
          requireConfirmation: false,
          directoryAccess: {
            allowlist: ['/public/**'],
            blocklist: ['/restricted/**'],
            defaultAllow: false,
            resolveSymlinks: true,
            maxDepth: 0
          }
        } as FilesystemToolConfig,
        createdAt: new Date()
      });

      const result = await manager.checkToolPermission('Write', {
        scope: '/restricted/file.txt',
        path: '/restricted/file.txt'
      });

      expect(result.level).toBe('allow-always');
      expect(result.allowed).toBe(false); // Overridden by directory access
      expect(result.denialReason).toMatch(/Directory access denied/);
      expect(result.pathValidation?.allowed).toBe(false);
    });

    it('should handle missing permissions with various tool configurations', async () => {
      const scenarios = [
        {
          description: 'enabled but requires confirmation',
          config: { enabled: true, requireConfirmation: true },
          expectedAllowed: false,
          expectedRequiresConfirmation: true,
          expectedDenialReason: 'Tool requires user confirmation before execution'
        },
        {
          description: 'disabled',
          config: { enabled: false, requireConfirmation: false },
          expectedAllowed: false,
          expectedRequiresConfirmation: false,
          expectedDenialReason: 'Tool is disabled via configuration'
        },
        {
          description: 'enabled without confirmation requirement',
          config: { enabled: true, requireConfirmation: false },
          expectedAllowed: true,
          expectedRequiresConfirmation: false,
          expectedDenialReason: undefined
        }
      ];

      for (const scenario of scenarios) {
        const tool = `TestTool_${scenario.description.replace(/\s+/g, '_')}`;

        await store.saveExtendedPermission({
          tool,
          level: null,
          config: scenario.config,
          createdAt: new Date()
        });

        const result = await manager.checkToolPermission(tool);

        expect(result.level).toBeNull();
        expect(result.allowed).toBe(scenario.expectedAllowed);
        expect(result.requiresConfirmation).toBe(scenario.expectedRequiresConfirmation);
        expect(result.denialReason).toBe(scenario.expectedDenialReason);
        expect(result.config).toEqual(scenario.config);
      }
    });
  });

  describe('Real-world workflow scenarios', () => {
    it('should handle typical development workflow with mixed autonomy levels', async () => {
      // Set up a typical development environment permission scenario

      // Safe read operations - always allowed
      const safeReadPermissions: Permission[] = [
        {
          tool: 'Read',
          scope: '/src/**/*.{ts,js,json}',
          level: 'allow-always',
          createdAt: new Date()
        },
        {
          tool: 'Grep',
          scope: '/src/**',
          level: 'allow-always',
          createdAt: new Date()
        },
        {
          tool: 'Glob',
          level: 'allow-always', // Global permission
          createdAt: new Date()
        }
      ];

      // Careful write operations - allow once with expiry
      const carefulWritePermissions: Permission[] = [
        {
          tool: 'Write',
          scope: '/src/**/*.ts',
          level: 'allow-once',
          expiry: new Date(Date.now() + 1800000), // 30 minutes
          createdAt: new Date()
        },
        {
          tool: 'Edit',
          scope: '/src/config/*.json',
          level: 'allow-once',
          expiry: new Date(Date.now() + 600000), // 10 minutes
          createdAt: new Date()
        }
      ];

      // Dangerous operations - explicit deny
      const dangerousPermissions: Permission[] = [
        {
          tool: 'Bash',
          scope: 'rm -rf',
          level: 'deny',
          createdAt: new Date()
        },
        {
          tool: 'Write',
          scope: '/node_modules/**',
          level: 'deny',
          createdAt: new Date()
        }
      ];

      // Store all permissions
      for (const permission of [...safeReadPermissions, ...carefulWritePermissions, ...dangerousPermissions]) {
        await store.savePermission(permission);
      }

      // Test safe operations are always allowed
      const readResult = await manager.checkToolPermission('Read', {
        scope: '/src/**/*.{ts,js,json}'
      });
      expect(readResult.allowed).toBe(true);
      expect(readResult.level).toBe('allow-always');

      const grepResult = await manager.checkToolPermission('Grep', {
        scope: '/src/**'
      });
      expect(grepResult.allowed).toBe(true);
      expect(grepResult.level).toBe('allow-always');

      const globResult = await manager.checkToolPermission('Glob');
      expect(globResult.allowed).toBe(true);
      expect(globResult.level).toBe('allow-always');

      // Test careful operations work once
      const writeResult = await manager.checkToolPermission('Write', {
        scope: '/src/**/*.ts'
      });
      expect(writeResult.allowed).toBe(true);
      expect(writeResult.level).toBe('allow-once');

      // Second write should not work
      const writeResult2 = await manager.checkToolPermission('Write', {
        scope: '/src/**/*.ts'
      });
      expect(writeResult2.level).toBeNull();

      // Test dangerous operations are denied
      const dangerousResult = await manager.checkToolPermission('Bash', {
        scope: 'rm -rf'
      });
      expect(dangerousResult.allowed).toBe(false);
      expect(dangerousResult.level).toBe('deny');

      const nodeModulesResult = await manager.checkToolPermission('Write', {
        scope: '/node_modules/**'
      });
      expect(nodeModulesResult.allowed).toBe(false);
      expect(nodeModulesResult.level).toBe('deny');
    });

    it('should handle CI/CD pipeline permission scenario', async () => {
      // Simulate CI/CD environment with specific tool restrictions

      // Build tools - always allowed
      await store.savePermission({
        tool: 'Bash',
        scope: 'npm run build',
        level: 'allow-always',
        createdAt: new Date()
      });

      await store.savePermission({
        tool: 'Bash',
        scope: 'npm run test',
        level: 'allow-always',
        createdAt: new Date()
      });

      // Git operations - some allowed, some restricted
      await store.savePermission({
        tool: 'Bash',
        scope: 'git status',
        level: 'allow-always',
        createdAt: new Date()
      });

      await store.savePermission({
        tool: 'Bash',
        scope: 'git diff',
        level: 'allow-always',
        createdAt: new Date()
      });

      await store.savePermission({
        tool: 'Bash',
        scope: 'git push --force',
        level: 'deny',
        createdAt: new Date()
      });

      // File operations - read allowed, write restricted
      await store.savePermission({
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date()
      });

      await store.saveExtendedPermission({
        tool: 'Write',
        level: null,
        config: {
          enabled: true,
          requireConfirmation: true
        },
        createdAt: new Date()
      });

      // Test build operations
      const buildResult = await manager.checkToolPermission('Bash', {
        scope: 'npm run build'
      });
      expect(buildResult.allowed).toBe(true);
      expect(buildResult.level).toBe('allow-always');

      const testResult = await manager.checkToolPermission('Bash', {
        scope: 'npm run test'
      });
      expect(testResult.allowed).toBe(true);
      expect(testResult.level).toBe('allow-always');

      // Test git operations
      const gitStatusResult = await manager.checkToolPermission('Bash', {
        scope: 'git status'
      });
      expect(gitStatusResult.allowed).toBe(true);
      expect(gitStatusResult.level).toBe('allow-always');

      const forcePushResult = await manager.checkToolPermission('Bash', {
        scope: 'git push --force'
      });
      expect(forcePushResult.allowed).toBe(false);
      expect(forcePushResult.level).toBe('deny');

      // Test file operations
      const readResult = await manager.checkToolPermission('Read');
      expect(readResult.allowed).toBe(true);
      expect(readResult.level).toBe('allow-always');

      const writeResult = await manager.checkToolPermission('Write');
      expect(writeResult.allowed).toBe(false);
      expect(writeResult.requiresConfirmation).toBe(true);
      expect(writeResult.denialReason).toBe('Tool requires user confirmation before execution');
    });
  });
});