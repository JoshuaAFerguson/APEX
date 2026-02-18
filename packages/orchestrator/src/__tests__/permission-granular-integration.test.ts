import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionStore } from '../permission-store';
import { PermissionManager } from '../permission-manager';
import { DirectoryAccessValidator } from '@apexcli/core';
import {
  Permission,
  PermissionLevel,
  ExtendedPermission,
  FilesystemToolConfig,
  ShellToolConfig,
  WebToolConfig,
  SearchToolConfig,
  ToolPermissionCheckOptions,
  DirectoryAccessConfig,
} from '@apexcli/core';

/**
 * Integration tests for granular permission system
 *
 * Tests the complete integration of:
 * - DirectoryAccessValidator (path validation with glob patterns)
 * - PermissionStore (persistence and retrieval)
 * - PermissionManager (session management and tool configs)
 *
 * Covers end-to-end permission flows and real-world scenarios.
 */
describe('Granular Permission System - Integration Tests', () => {
  let store: PermissionStore;
  let manager: PermissionManager;
  let validator: DirectoryAccessValidator;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-granular-integration-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    store = new PermissionStore(testDir);
    await store.initialize();

    manager = new PermissionManager(store);
    validator = new DirectoryAccessValidator();
  });

  afterEach(() => {
    if (store) {
      store.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('End-to-end permission flows', () => {
    it('should handle complete permission workflow from grant to consumption', async () => {
      // Grant permissions at different levels
      await manager.grantPermission('Read', '/project/src/**/*.ts', 'allow-always');
      await manager.grantPermission('Write', '/project/src/**/*.ts', 'allow-once');
      await manager.grantPermission('Edit', '/project/config.json', 'deny');

      // Check permissions and verify behavior
      const readLevel = await manager.checkPermission('Read', '/project/src/**/*.ts');
      expect(readLevel).toBe('allow-always');

      const writeLevel = await manager.checkPermission('Write', '/project/src/**/*.ts');
      expect(writeLevel).toBe('allow-once');

      // allow-once should be consumed after first check
      const writeLevel2 = await manager.checkPermission('Write', '/project/src/**/*.ts');
      expect(writeLevel2).toBeNull();

      const editLevel = await manager.checkPermission('Edit', '/project/config.json');
      expect(editLevel).toBe('deny');

      // Verify read permission persists
      const readLevel2 = await manager.checkPermission('Read', '/project/src/**/*.ts');
      expect(readLevel2).toBe('allow-always');
    });

    it('should handle permission escalation and downgrade flows', async () => {
      const toolName = 'TestTool';
      const scope = '/sensitive/data.json';

      // Start with denial
      await manager.grantPermission(toolName, scope, 'deny');
      expect(await manager.checkPermission(toolName, scope)).toBe('deny');

      // Escalate to allow-once
      await manager.grantPermission(toolName, scope, 'allow-once');
      expect(await manager.checkPermission(toolName, scope)).toBe('allow-once');

      // After consumption, should have no permission
      expect(await manager.checkPermission(toolName, scope)).toBeNull();

      // Escalate to allow-always
      await manager.grantPermission(toolName, scope, 'allow-always');
      expect(await manager.checkPermission(toolName, scope)).toBe('allow-always');
      expect(await manager.checkPermission(toolName, scope)).toBe('allow-always'); // Should persist

      // Downgrade back to deny
      await manager.grantPermission(toolName, scope, 'deny');
      expect(await manager.checkPermission(toolName, scope)).toBe('deny');
    });

    it('should handle session reset and persistence across sessions', async () => {
      // Set up permissions
      await manager.grantPermission('PersistentTool', undefined, 'allow-always');
      await manager.grantPermission('SessionTool', undefined, 'allow-once');

      // Check initial state
      expect(await manager.checkPermission('PersistentTool')).toBe('allow-always');
      expect(await manager.checkPermission('SessionTool')).toBe('allow-once');

      // Reset session (simulates new session)
      manager.resetSession();

      // Persistent permission should remain
      expect(await manager.checkPermission('PersistentTool')).toBe('allow-always');

      // Session permission was consumed in previous session
      expect(await manager.checkPermission('SessionTool')).toBeNull();
    });
  });

  describe('Component integration: DirectoryAccessValidator + PermissionStore + PermissionManager', () => {
    it('should integrate directory validation with permission checking', async () => {
      const filesystemConfig: FilesystemToolConfig = {
        enabled: true,
        requireConfirmation: false,
        timeout: 5000,
        rateLimitPerMinute: 10,
        directoryAccess: {
          allowlist: ['/project/**/*'],
          blocklist: ['/project/secrets/**/*', '/project/.git/**/*'],
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

      // Store the extended permission
      await store.saveExtendedPermission(extendedPermission);

      // Test allowed path
      const allowedResult = await manager.checkToolPermission('Read', {
        path: '/project/src/main.ts'
      });

      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.level).toBe('allow-always');
      expect(allowedResult.pathValidation).toBeDefined();
      expect(allowedResult.pathValidation!.allowed).toBe(true);
      expect(allowedResult.pathValidation!.matchType).toBe('allowlist');

      // Test blocked path
      const blockedResult = await manager.checkToolPermission('Read', {
        path: '/project/secrets/key.txt'
      });

      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.pathValidation!.allowed).toBe(false);
      expect(blockedResult.pathValidation!.matchType).toBe('blocklist');
      expect(blockedResult.denialReason).toContain('Directory access denied');

      // Test unmatched path (defaultAllow: false)
      const unmatchedResult = await manager.checkToolPermission('Read', {
        path: '/other/file.txt'
      });

      expect(unmatchedResult.allowed).toBe(false);
      expect(unmatchedResult.pathValidation!.allowed).toBe(false);
      expect(unmatchedResult.pathValidation!.matchType).toBe('default');
    });

    it('should handle complex permission and config interactions', async () => {
      // Set up both regular permission and extended config
      await manager.grantPermission('Edit', '/project/src/**/*.ts', 'allow-once');

      const config: FilesystemToolConfig = {
        enabled: true,
        requireConfirmation: true,
        directoryAccess: {
          allowlist: ['/project/src/**/*'],
          blocklist: ['/project/src/generated/**/*'],
          defaultAllow: false
        }
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Edit',
        level: 'allow-always',
        createdAt: new Date(),
        config
      };

      await store.saveExtendedPermission(extendedPermission);

      // First check - should work with allow-once
      const result1 = await manager.checkToolPermission('Edit', {
        path: '/project/src/main.ts',
        consumeAllowOnce: true
      });

      expect(result1.allowed).toBe(true);
      expect(result1.level).toBe('allow-once');
      expect(result1.requiresConfirmation).toBe(true);
      expect(result1.pathValidation!.allowed).toBe(true);

      // Second check - allow-once consumed, but config still applies
      const result2 = await manager.checkToolPermission('Edit', {
        path: '/project/src/main.ts'
      });

      // Should fall back to extended permission config
      expect(result2.level).toBe('allow-always');
      expect(result2.requiresConfirmation).toBe(true);

      // Test blocked by directory access even with permission
      const blockedResult = await manager.checkToolPermission('Edit', {
        path: '/project/src/generated/auto.ts'
      });

      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.pathValidation!.allowed).toBe(false);
      expect(blockedResult.denialReason).toContain('Directory access denied');
    });

    it('should validate permissions persist across store instances', async () => {
      // Create permissions using manager
      await manager.grantPermission('PersistentRead', '/data/**/*', 'allow-always');

      const config: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: {
          allowlist: ['/data/**/*'],
          defaultAllow: false
        }
      };

      await store.saveExtendedPermission({
        tool: 'PersistentRead',
        level: 'allow-always',
        createdAt: new Date(),
        config
      });

      // Close current store
      store.close();

      // Create new store and manager instances
      const newStore = new PermissionStore(testDir);
      await newStore.initialize();
      const newManager = new PermissionManager(newStore);

      // Verify permissions and configs persisted
      const permission = await newManager.checkPermission('PersistentRead', '/data/**/*');
      expect(permission).toBe('allow-always');

      const result = await newManager.checkToolPermission('PersistentRead', {
        path: '/data/test.json'
      });

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.config).toBeDefined();
      expect(result.pathValidation!.allowed).toBe(true);

      newStore.close();
    });
  });

  describe('Real-world scenarios with tool restrictions', () => {
    it('should handle filesystem tool with comprehensive directory restrictions', async () => {
      // Real-world scenario: Development environment with strict file access
      const devConfig: FilesystemToolConfig = {
        enabled: true,
        requireConfirmation: false,
        timeout: 10000,
        rateLimitPerMinute: 50,
        directoryAccess: {
          allowlist: [
            '/workspace/src/**/*',
            '/workspace/docs/**/*.md',
            '/workspace/tests/**/*',
            '/workspace/package.json',
            '/workspace/tsconfig.json'
          ],
          blocklist: [
            '/workspace/src/secrets/**/*',
            '/workspace/.env*',
            '/workspace/node_modules/**/*',
            '/workspace/.git/**/*'
          ],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 10
        },
        maxFileSize: 5000000, // 5MB
        allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml'],
        blockedExtensions: ['.exe', '.bat', '.sh', '.bin', '.dmg']
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
        config: devConfig
      };

      await store.saveExtendedPermission(extendedPermission);

      // Test cases for different file operations
      const testCases = [
        // Allowed operations
        { path: '/workspace/src/components/Button.tsx', expected: true },
        { path: '/workspace/docs/README.md', expected: true },
        { path: '/workspace/tests/unit/button.test.ts', expected: true },
        { path: '/workspace/package.json', expected: true },
        { path: '/workspace/tsconfig.json', expected: true },

        // Blocked operations
        { path: '/workspace/src/secrets/api-keys.json', expected: false },
        { path: '/workspace/.env.production', expected: false },
        { path: '/workspace/node_modules/react/index.js', expected: false },
        { path: '/workspace/.git/config', expected: false },

        // Outside allowlist
        { path: '/other/file.ts', expected: false },
        { path: '/workspace/build/output.js', expected: false },
      ];

      for (const testCase of testCases) {
        const result = await manager.checkToolPermission('Read', {
          path: testCase.path
        });

        expect(result.allowed).toBe(testCase.expected);
        expect(result.config).toEqual(devConfig);

        if (testCase.expected) {
          expect(result.pathValidation!.allowed).toBe(true);
        } else {
          expect(result.pathValidation!.allowed).toBe(false);
        }
      }
    });

    it('should handle bash tool with command restrictions and working directory limits', async () => {
      // Real-world scenario: CI/CD environment with restricted shell access
      const ciConfig: ShellToolConfig = {
        enabled: true,
        requireConfirmation: false,
        timeout: 300000, // 5 minutes
        rateLimitPerMinute: 20,
        directoryAccess: {
          allowlist: ['/ci/workspace/**/*', '/tmp/ci-*/**/*'],
          blocklist: ['/etc/**/*', '/sys/**/*', '/proc/**/*', '/root/**/*'],
          defaultAllow: false,
          resolveSymlinks: false,
          maxDepth: 5
        },
        blockedCommands: [
          'rm -rf /',
          'sudo',
          'su',
          'chmod 777',
          'dd',
          'mkfs',
          'fdisk',
          'reboot',
          'shutdown',
          'init',
          'kill -9 1'
        ],
        allowElevatedPrivileges: false,
        environment: {
          NODE_ENV: 'production',
          CI: 'true',
          HOME: '/ci/workspace'
        },
        workingDirectory: '/ci/workspace'
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Bash',
        level: 'allow-always',
        createdAt: new Date(),
        config: ciConfig
      };

      await store.saveExtendedPermission(extendedPermission);

      // Test allowed working directory
      const workspaceResult = await manager.checkToolPermission('Bash', {
        path: '/ci/workspace/build'
      });

      expect(workspaceResult.allowed).toBe(true);
      expect(workspaceResult.config).toEqual(ciConfig);
      expect(workspaceResult.pathValidation!.allowed).toBe(true);
      expect(workspaceResult.pathValidation!.matchType).toBe('allowlist');

      // Test blocked system directory
      const systemResult = await manager.checkToolPermission('Bash', {
        path: '/etc/passwd'
      });

      expect(systemResult.allowed).toBe(false);
      expect(systemResult.pathValidation!.allowed).toBe(false);
      expect(systemResult.pathValidation!.matchType).toBe('blocklist');

      // Test allowed temporary directory
      const tempResult = await manager.checkToolPermission('Bash', {
        path: '/tmp/ci-build-123/output'
      });

      expect(tempResult.allowed).toBe(true);
      expect(tempResult.pathValidation!.allowed).toBe(true);
      expect(tempResult.pathValidation!.matchType).toBe('allowlist');

      // Test default deny for unmatched paths
      const unmatchedResult = await manager.checkToolPermission('Bash', {
        path: '/home/user/project'
      });

      expect(unmatchedResult.allowed).toBe(false);
      expect(unmatchedResult.pathValidation!.allowed).toBe(false);
      expect(unmatchedResult.pathValidation!.matchType).toBe('default');
    });

    it('should handle web tool with domain restrictions and security policies', async () => {
      // Real-world scenario: AI agent with controlled web access
      const webConfig: WebToolConfig = {
        enabled: true,
        requireConfirmation: true,
        timeout: 30000, // 30 seconds
        rateLimitPerMinute: 10,
        allowedDomains: [
          'api.github.com',
          '*.stackoverflow.com',
          'npmjs.com',
          'registry.npmjs.org',
          'docs.microsoft.com',
          'developer.mozilla.org'
        ],
        blockedDomains: [
          'malicious-site.com',
          '*.ads.com',
          'tracker.example.com',
          'phishing-site.net'
        ],
        maxResponseSize: 10000000, // 10MB
        followRedirects: true,
        headers: {
          'User-Agent': 'APEX-AI-Agent/1.0',
          'Accept': 'application/json, text/html, text/plain',
          'X-Requested-By': 'APEX'
        }
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'WebFetch',
        level: 'allow-always',
        createdAt: new Date(),
        config: webConfig
      };

      await store.saveExtendedPermission(extendedPermission);

      // Basic tool permission check
      const result = await manager.checkToolPermission('WebFetch');

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.requiresConfirmation).toBe(true);
      expect(result.config).toEqual(webConfig);

      // Verify config properties
      const config = result.config as WebToolConfig;
      expect(config.allowedDomains).toContain('api.github.com');
      expect(config.blockedDomains).toContain('malicious-site.com');
      expect(config.maxResponseSize).toBe(10000000);
      expect(config.followRedirects).toBe(true);
      expect(config.headers!['User-Agent']).toBe('APEX-AI-Agent/1.0');
    });

    it('should handle search tool with pattern and directory restrictions', async () => {
      // Real-world scenario: Code search with security constraints
      const searchConfig: SearchToolConfig = {
        enabled: true,
        requireConfirmation: false,
        timeout: 15000,
        rateLimitPerMinute: 30,
        directoryAccess: {
          allowlist: [
            '/project/src/**/*',
            '/project/tests/**/*',
            '/project/docs/**/*'
          ],
          blocklist: [
            '/project/src/secrets/**/*',
            '/project/.git/**/*',
            '/project/node_modules/**/*',
            '/project/dist/**/*',
            '/project/build/**/*'
          ],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 8
        },
        maxResults: 500,
        includePatterns: [
          '*.ts',
          '*.tsx',
          '*.js',
          '*.jsx',
          '*.json',
          '*.md',
          '*.txt'
        ],
        excludePatterns: [
          '*.test.*',
          '*.spec.*',
          '*.d.ts',
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**'
        ]
      };

      const extendedPermission: ExtendedPermission = {
        tool: 'Grep',
        level: 'allow-always',
        createdAt: new Date(),
        config: searchConfig
      };

      await store.saveExtendedPermission(extendedPermission);

      // Test search in allowed directory
      const srcResult = await manager.checkToolPermission('Grep', {
        path: '/project/src/utils/helpers.ts'
      });

      expect(srcResult.allowed).toBe(true);
      expect(srcResult.level).toBe('allow-always');
      expect(srcResult.config).toEqual(searchConfig);
      expect(srcResult.pathValidation!.allowed).toBe(true);
      expect(srcResult.pathValidation!.matchType).toBe('allowlist');

      // Test search in blocked directory
      const secretsResult = await manager.checkToolPermission('Grep', {
        path: '/project/src/secrets/api-config.ts'
      });

      expect(secretsResult.allowed).toBe(false);
      expect(secretsResult.pathValidation!.allowed).toBe(false);
      expect(secretsResult.pathValidation!.matchType).toBe('blocklist');
      expect(secretsResult.denialReason).toContain('Directory access denied');

      // Test search in documentation
      const docsResult = await manager.checkToolPermission('Grep', {
        path: '/project/docs/api.md'
      });

      expect(docsResult.allowed).toBe(true);
      expect(docsResult.pathValidation!.allowed).toBe(true);
      expect(docsResult.pathValidation!.matchType).toBe('allowlist');

      // Test search outside allowed paths
      const outsideResult = await manager.checkToolPermission('Grep', {
        path: '/other-project/src/main.ts'
      });

      expect(outsideResult.allowed).toBe(false);
      expect(outsideResult.pathValidation!.allowed).toBe(false);
      expect(outsideResult.pathValidation!.matchType).toBe('default');
    });

    it('should handle complex multi-tool workflow with different restriction types', async () => {
      // Real-world scenario: Complete development workflow with granular permissions

      // 1. Set up Read permissions with file type restrictions
      const readConfig: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: {
          allowlist: ['/workspace/**/*'],
          blocklist: ['/workspace/.env*', '/workspace/secrets/**/*'],
          defaultAllow: false
        },
        allowedExtensions: ['.ts', '.tsx', '.js', '.json', '.md']
      };

      await store.saveExtendedPermission({
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
        config: readConfig
      });

      // 2. Set up Write permissions with time-limited access
      await manager.grantPermission('Write', '/workspace/src/**/*', 'allow-once');

      // 3. Set up Bash permissions with command restrictions
      const bashConfig: ShellToolConfig = {
        enabled: true,
        directoryAccess: {
          allowlist: ['/workspace/**/*'],
          defaultAllow: false
        },
        blockedCommands: ['rm -rf', 'sudo', 'dd'],
        workingDirectory: '/workspace'
      };

      await store.saveExtendedPermission({
        tool: 'Bash',
        level: 'allow-always',
        createdAt: new Date(),
        config: bashConfig
      });

      // Test the complete workflow

      // Step 1: Read source file (should succeed)
      const readResult = await manager.checkToolPermission('Read', {
        path: '/workspace/src/main.ts'
      });
      expect(readResult.allowed).toBe(true);
      expect(readResult.level).toBe('allow-always');

      // Step 2: Write to source file (should succeed once)
      const writeResult1 = await manager.checkToolPermission('Write', {
        path: '/workspace/src/main.ts',
        consumeAllowOnce: true
      });
      expect(writeResult1.allowed).toBe(true);
      expect(writeResult1.level).toBe('allow-once');

      // Step 3: Try to write again (should fail - allow-once consumed)
      const writeResult2 = await manager.checkToolPermission('Write', {
        path: '/workspace/src/main.ts'
      });
      expect(writeResult2.level).toBeNull();

      // Step 4: Run safe bash command (should succeed)
      const bashResult = await manager.checkToolPermission('Bash', {
        path: '/workspace'
      });
      expect(bashResult.allowed).toBe(true);
      expect(bashResult.level).toBe('allow-always');

      // Step 5: Try to read blocked file (should fail)
      const blockedReadResult = await manager.checkToolPermission('Read', {
        path: '/workspace/.env.production'
      });
      expect(blockedReadResult.allowed).toBe(false);
      expect(blockedReadResult.pathValidation!.matchType).toBe('blocklist');

      // Step 6: Try to access outside workspace (should fail)
      const outsideResult = await manager.checkToolPermission('Read', {
        path: '/etc/passwd'
      });
      expect(outsideResult.allowed).toBe(false);
      expect(outsideResult.pathValidation!.matchType).toBe('default');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle invalid path validation gracefully', async () => {
      const config: FilesystemToolConfig = {
        enabled: true,
        directoryAccess: {
          allowlist: ['/valid/path/**/*'],
          defaultAllow: false
        }
      };

      await store.saveExtendedPermission({
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
        config
      });

      // Test invalid paths
      const invalidPaths = [
        '', // Empty path
        null as any, // Null path
        '/path/with\0null/byte', // Path with null byte
        'relative/path/../../../etc/passwd', // Path traversal attempt
      ];

      for (const invalidPath of invalidPaths) {
        const result = await manager.checkToolPermission('Read', {
          path: invalidPath
        });
        expect(result.allowed).toBe(false);
      }
    });

    it('should handle malformed permission configurations gracefully', async () => {
      // Test with invalid config data
      try {
        const invalidConfig = {
          enabled: 'yes' as any, // Invalid boolean
          directoryAccess: {
            allowlist: 'not-an-array' as any, // Invalid array
            defaultAllow: 'true' as any // Invalid boolean
          }
        };

        // This should not break the system
        const result = await manager.checkToolPermission('TestTool', {
          path: '/some/path'
        });
        expect(result.allowed).toBe(false);
      } catch (error) {
        // If it throws, it should be a validation error
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle concurrent permission checks correctly', async () => {
      // Set up allow-once permission
      await manager.grantPermission('ConcurrentTest', '/test/path', 'allow-once');

      // Run multiple concurrent permission checks
      const promises = Array.from({ length: 5 }, (_, i) =>
        manager.checkPermission('ConcurrentTest', '/test/path')
      );

      const results = await Promise.all(promises);

      // Only one should get allow-once, others should get null
      const allowOnceCount = results.filter(r => r === 'allow-once').length;
      const nullCount = results.filter(r => r === null).length;

      expect(allowOnceCount).toBe(1);
      expect(nullCount).toBe(4);
    });

    it('should handle permission store corruption gracefully', async () => {
      // Close the current store
      store.close();

      // Simulate corruption by creating new manager with different directory
      const corruptedStore = new PermissionStore('/tmp/nonexistent-path-' + Date.now());

      try {
        await corruptedStore.initialize();
        const corruptedManager = new PermissionManager(corruptedStore);

        // Should handle missing database gracefully
        const result = await corruptedManager.checkPermission('TestTool');
        expect(result).toBeNull();

        corruptedStore.close();
      } catch (error) {
        // Database initialization errors are acceptable
        expect(error).toBeInstanceOf(Error);
      }

      // Reinitialize the original store for other tests
      store = new PermissionStore(testDir);
      await store.initialize();
      manager = new PermissionManager(store);
    });

    it('should handle tool config with extreme values', async () => {
      // Test with very large numbers and edge case values
      const extremeConfig: FilesystemToolConfig = {
        enabled: true,
        timeout: Number.MAX_SAFE_INTEGER,
        rateLimitPerMinute: Number.MAX_SAFE_INTEGER,
        maxFileSize: Number.MAX_SAFE_INTEGER,
        directoryAccess: {
          allowlist: ['/**/*'], // Very broad pattern
          maxDepth: Number.MAX_SAFE_INTEGER
        },
        allowedExtensions: [], // Empty array
        blockedExtensions: Array.from({ length: 1000 }, (_, i) => `.ext${i}`) // Very large array
      };

      await store.saveExtendedPermission({
        tool: 'ExtremeTest',
        level: 'allow-always',
        createdAt: new Date(),
        config: extremeConfig
      });

      const result = await manager.checkToolPermission('ExtremeTest', {
        path: '/any/path/file.txt'
      });

      expect(result.allowed).toBe(true);
      expect(result.config).toEqual(extremeConfig);
    });

    it('should handle expired permissions correctly', async () => {
      // Create permission with past expiry date
      const expiredPermission: ExtendedPermission = {
        tool: 'ExpiredTest',
        level: 'allow-always',
        createdAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        expiry: new Date(Date.now() - 1000 * 60 * 30) // Expired 30 minutes ago
      };

      await store.saveExtendedPermission(expiredPermission);

      // Check permission - should be treated as if it doesn't exist
      const result = await manager.checkPermission('ExpiredTest');
      expect(result).toBeNull();
    });
  });
});