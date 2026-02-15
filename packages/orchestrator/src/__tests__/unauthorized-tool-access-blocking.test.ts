/**
 * Comprehensive Tests for Unauthorized Tool Access Blocking
 *
 * This test suite verifies that tools without permissions are blocked,
 * tools with expired permissions are blocked, tools with wrong scope are blocked,
 * and custom tools respect permissions.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { EventEmitter } from 'eventemitter3';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import {
  Permission,
  PermissionLevel,
  AgentTool,
  ToolPermissionResult,
  ToolPermissionConfig,
  BaseToolPermissionConfig,
  ToolPermissionCheckOptions
} from '@apexcli/core';

describe('Unauthorized Tool Access Blocking', () => {
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let testDir: string;
  let eventEmitter: EventEmitter;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = join(tmpdir(), `apex-tool-access-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();

    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();
  });

  afterEach(() => {
    // Clean up
    if (permissionStore) {
      permissionStore.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('Tools Without Permissions Are Blocked', () => {
    it('should block Read tool without permission', async () => {
      // No permission exists for Read tool
      const result = await permissionManager.checkToolPermission('Read');

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBeDefined();
      expect(result.denialReason).toContain('No permission found');
    });

    it('should block Write tool without permission', async () => {
      const result = await permissionManager.checkToolPermission('Write');

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBeDefined();
      expect(result.denialReason).toContain('No permission found');
    });

    it('should block Bash tool without permission', async () => {
      const result = await permissionManager.checkToolPermission('Bash');

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBeDefined();
      expect(result.denialReason).toContain('No permission found');
    });

    it('should block Browser tool without permission', async () => {
      const result = await permissionManager.checkToolPermission('Browser');

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBeDefined();
      expect(result.denialReason).toContain('No permission found');
    });

    it('should block WebFetch tool without permission', async () => {
      const result = await permissionManager.checkToolPermission('WebFetch');

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBeDefined();
      expect(result.denialReason).toContain('No permission found');
    });

    it('should block multiple tools in sequence without permissions', async () => {
      const tools: AgentTool[] = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'Browser'];

      for (const tool of tools) {
        const result = await permissionManager.checkToolPermission(tool);

        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull();
        expect(result.denialReason).toContain('No permission found');
      }
    });

    it('should provide consistent denial reasons for unpermissioned tools', async () => {
      const result1 = await permissionManager.checkToolPermission('Read');
      const result2 = await permissionManager.checkToolPermission('Write');

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(false);
      expect(result1.denialReason).toBeDefined();
      expect(result2.denialReason).toBeDefined();

      // Both should contain the same type of denial reason
      expect(result1.denialReason).toMatch(/No permission found|permission.*not.*found/i);
      expect(result2.denialReason).toMatch(/No permission found|permission.*not.*found/i);
    });
  });

  describe('Tools With Expired Permissions Are Blocked', () => {
    it('should block tool with expired allow-always permission', async () => {
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 1); // 1 hour ago

      const expiredPermission: Permission = {
        tool: 'Read',
        scope: '/test/path',
        level: 'allow-always',
        expiry: expiredDate,
        createdAt: new Date(expiredDate.getTime() - 3600000), // Created 2 hours ago
      };

      await permissionStore.savePermission(expiredPermission);

      const result = await permissionManager.checkToolPermission('Read', { scope: '/test/path' });

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBeDefined();
      expect(result.denialReason).toMatch(/expired|no.*valid.*permission/i);
    });

    it('should block tool with expired allow-once permission', async () => {
      const expiredDate = new Date();
      expiredDate.setMinutes(expiredDate.getMinutes() - 30); // 30 minutes ago

      const expiredPermission: Permission = {
        tool: 'Write',
        scope: '/test/file.txt',
        level: 'allow-once',
        expiry: expiredDate,
        createdAt: new Date(expiredDate.getTime() - 1800000), // Created 1 hour ago
      };

      await permissionStore.savePermission(expiredPermission);

      const result = await permissionManager.checkToolPermission('Write', { scope: '/test/file.txt' });

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBeDefined();
      expect(result.denialReason).toMatch(/expired|no.*valid.*permission/i);
    });

    it('should block multiple tools with various expired permissions', async () => {
      const now = new Date();
      const expiredPermissions: Permission[] = [
        {
          tool: 'Bash',
          level: 'allow-always',
          expiry: new Date(now.getTime() - 86400000), // 1 day ago
          createdAt: new Date(now.getTime() - 172800000), // 2 days ago
        },
        {
          tool: 'Browser',
          scope: 'https://example.com',
          level: 'allow-once',
          expiry: new Date(now.getTime() - 3600000), // 1 hour ago
          createdAt: new Date(now.getTime() - 7200000), // 2 hours ago
        },
        {
          tool: 'Grep',
          scope: '/src/**',
          level: 'allow-always',
          expiry: new Date(now.getTime() - 60000), // 1 minute ago
          createdAt: new Date(now.getTime() - 3600000), // 1 hour ago
        }
      ];

      for (const permission of expiredPermissions) {
        await permissionStore.savePermission(permission);
      }

      // Test each expired permission
      for (const permission of expiredPermissions) {
        const result = await permissionManager.checkToolPermission(permission.tool, { scope: permission.scope });

        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull();
        expect(result.denialReason).toMatch(/expired|no.*valid.*permission/i);
      }
    });

    it('should allow valid permissions while blocking expired ones for same tool', async () => {
      const now = new Date();

      // Add expired permission
      const expiredPermission: Permission = {
        tool: 'Read',
        scope: '/old/path',
        level: 'allow-always',
        expiry: new Date(now.getTime() - 3600000), // 1 hour ago
        createdAt: new Date(now.getTime() - 7200000), // 2 hours ago
      };

      // Add valid permission for different scope
      const validPermission: Permission = {
        tool: 'Read',
        scope: '/new/path',
        level: 'allow-always',
        expiry: new Date(now.getTime() + 3600000), // 1 hour from now
        createdAt: now,
      };

      await permissionStore.savePermission(expiredPermission);
      await permissionStore.savePermission(validPermission);

      // Expired scope should be blocked
      const expiredResult = await permissionManager.checkToolPermission('Read', { scope: '/old/path' });
      expect(expiredResult.allowed).toBe(false);
      expect(expiredResult.denialReason).toMatch(/expired|no.*valid.*permission/i);

      // Valid scope should be allowed
      const validResult = await permissionManager.checkToolPermission('Read', { scope: '/new/path' });
      expect(validResult.allowed).toBe(true);
      expect(validResult.level).toBe('allow-always');
    });

    it('should handle permissions that expire during execution', async () => {
      const now = new Date();
      const shortExpiry = new Date(now.getTime() + 100); // Expires in 100ms

      const shortPermission: Permission = {
        tool: 'Edit',
        level: 'allow-once',
        expiry: shortExpiry,
        createdAt: now,
      };

      await permissionStore.savePermission(shortPermission);

      // Should initially be allowed
      const initialResult = await permissionManager.checkToolPermission('Edit');
      expect(initialResult.allowed).toBe(true);

      // Wait for permission to expire
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should now be blocked
      const expiredResult = await permissionManager.checkToolPermission('Edit');
      expect(expiredResult.allowed).toBe(false);
      expect(expiredResult.denialReason).toMatch(/expired|no.*valid.*permission/i);
    });
  });

  describe('Tools With Wrong Scope Are Blocked', () => {
    it('should block Read tool with wrong file path scope', async () => {
      // Grant permission for specific path
      const permission: Permission = {
        tool: 'Read',
        scope: '/allowed/path/file.txt',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // Try to access different path
      const result = await permissionManager.checkToolPermission('Read', { scope: '/forbidden/path/file.txt' });

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBeDefined();
      expect(result.denialReason).toMatch(/scope|permission.*not.*found/i);
    });

    it('should block Bash tool with wrong command scope', async () => {
      // Grant permission for specific command pattern
      const permission: Permission = {
        tool: 'Bash',
        scope: 'npm*',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // Try to use different command pattern
      const result = await permissionManager.checkToolPermission('Bash', { scope: 'rm -rf /*' });

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBeDefined();
      expect(result.denialReason).toMatch(/scope|permission.*not.*found/i);
    });

    it('should block Browser tool with wrong domain scope', async () => {
      // Grant permission for specific domain
      const permission: Permission = {
        tool: 'Browser',
        scope: 'https://example.com',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // Try to access different domain
      const result = await permissionManager.checkToolPermission('Browser', { scope: 'https://malicious.com' });

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBeDefined();
      expect(result.denialReason).toMatch(/scope|permission.*not.*found/i);
    });

    it('should block tools with partial scope matches', async () => {
      // Grant permission for specific directory
      const permission: Permission = {
        tool: 'Write',
        scope: '/project/src/',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // Test various scope mismatches
      const wrongScopes = [
        '/project/src/../secrets/', // Path traversal attempt
        '/project/src2/', // Similar but different path
        '/PROJECT/src/', // Case sensitivity
        'project/src/', // Missing leading slash
        '/project/src/subfolder/../../../etc/', // Path traversal
      ];

      for (const scope of wrongScopes) {
        const result = await permissionManager.checkToolPermission('Write', { scope });

        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull();
        expect(result.denialReason).toMatch(/scope|permission.*not.*found/i);
      }
    });

    it('should allow exact scope matches while blocking wrong scopes', async () => {
      const permission: Permission = {
        tool: 'Grep',
        scope: '/exact/match/pattern',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // Exact match should be allowed
      const exactResult = await permissionManager.checkToolPermission('Grep', { scope: '/exact/match/pattern' });
      expect(exactResult.allowed).toBe(true);
      expect(exactResult.level).toBe('allow-always');

      // Wrong scope should be blocked
      const wrongResult = await permissionManager.checkToolPermission('Grep', { scope: '/exact/match/different' });
      expect(wrongResult.allowed).toBe(false);
      expect(wrongResult.denialReason).toMatch(/scope|permission.*not.*found/i);
    });

    it('should handle undefined scope when permission requires scope', async () => {
      const permission: Permission = {
        tool: 'Edit',
        scope: '/required/scope',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // No scope provided should be blocked
      const result = await permissionManager.checkToolPermission('Edit');

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toMatch(/scope|permission.*not.*found/i);
    });

    it('should handle scope when permission does not specify scope', async () => {
      const permission: Permission = {
        tool: 'TodoWrite',
        // No scope specified
        level: 'allow-always',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // Any scope should work since permission has no scope restriction
      const result = await permissionManager.checkToolPermission('TodoWrite', { scope: '/any/scope' });

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
    });
  });

  describe('Custom Tools Respect Permissions', () => {
    it('should block custom tool without permission', async () => {
      const customToolName = 'CustomAnalyzer';

      const result = await permissionManager.checkToolPermission(customToolName);

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBeDefined();
      expect(result.denialReason).toContain('No permission found');
    });

    it('should allow custom tool with valid permission', async () => {
      const customToolName = 'CustomFormatter';

      const permission: Permission = {
        tool: customToolName,
        level: 'allow-always',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      const result = await permissionManager.checkToolPermission(customToolName);

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.denialReason).toBeUndefined();
    });

    it('should block custom tool with expired permission', async () => {
      const customToolName = 'CustomLinter';
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 1);

      const expiredPermission: Permission = {
        tool: customToolName,
        level: 'allow-once',
        expiry: expiredDate,
        createdAt: new Date(expiredDate.getTime() - 3600000),
      };
      await permissionStore.savePermission(expiredPermission);

      const result = await permissionManager.checkToolPermission(customToolName);

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toMatch(/expired|no.*valid.*permission/i);
    });

    it('should block custom tool with wrong scope', async () => {
      const customToolName = 'CustomDeployer';

      const permission: Permission = {
        tool: customToolName,
        scope: 'production',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // Try different scope
      const result = await permissionManager.checkToolPermission(customToolName, { scope: 'development' });

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toMatch(/scope|permission.*not.*found/i);
    });

    it('should respect allow-once consumption for custom tools', async () => {
      const customToolName = 'CustomBackup';

      const permission: Permission = {
        tool: customToolName,
        level: 'allow-once',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // First check should consume the permission
      const firstResult = await permissionManager.checkToolPermission(customToolName, { consumeAllowOnce: true });
      expect(firstResult.allowed).toBe(true);
      expect(firstResult.level).toBe('allow-once');

      // Second check should be blocked as permission was consumed
      const secondResult = await permissionManager.checkToolPermission(customToolName);
      expect(secondResult.allowed).toBe(false);
      expect(secondResult.denialReason).toMatch(/consumed|no.*valid.*permission/i);
    });

    it('should handle custom tools with complex configurations', async () => {
      const customToolName = 'CustomDataProcessor';

      // Setup permission with custom configuration
      const customConfig: BaseToolPermissionConfig = {
        enabled: true,
        timeout: 30000,
        rateLimitPerMinute: 5,
        metadata: {
          maxDataSize: 1000000,
          allowedFormats: ['json', 'csv'],
        },
      };

      const permission: Permission = {
        tool: customToolName,
        scope: 'data-processing',
        level: 'allow-always',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // Set tool configuration
      permissionManager.setToolConfig(customToolName, customConfig);

      const result = await permissionManager.checkToolPermission(customToolName, { scope: 'data-processing' });

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.config).toBeDefined();
      expect(result.config?.enabled).toBe(true);
      expect(result.config?.timeout).toBe(30000);
    });

    it('should block multiple custom tools without permissions', async () => {
      const customTools = [
        'CustomImageProcessor',
        'CustomTextAnalyzer',
        'CustomFileConverter',
        'CustomApiClient',
        'CustomDatabaseMigrator'
      ];

      for (const tool of customTools) {
        const result = await permissionManager.checkToolPermission(tool);

        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull();
        expect(result.denialReason).toContain('No permission found');
      }
    });

    it('should handle custom tool names with special characters', async () => {
      const specialTools = [
        'Custom-Tool-With-Hyphens',
        'Custom_Tool_With_Underscores',
        'CustomTool123',
        'Custom.Tool.With.Dots',
      ];

      // No permissions granted
      for (const tool of specialTools) {
        const result = await permissionManager.checkToolPermission(tool);

        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull();
        expect(result.denialReason).toContain('No permission found');
      }

      // Grant permissions and test
      for (const tool of specialTools) {
        const permission: Permission = {
          tool,
          level: 'allow-always',
          createdAt: new Date(),
        };
        await permissionStore.savePermission(permission);

        const result = await permissionManager.checkToolPermission(tool);
        expect(result.allowed).toBe(true);
        expect(result.level).toBe('allow-always');
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed tool names', async () => {
      const malformedNames = ['', '   ', null as any, undefined as any];

      for (const name of malformedNames) {
        try {
          const result = await permissionManager.checkToolPermission(name);
          // If it doesn't throw, it should deny access
          expect(result.allowed).toBe(false);
        } catch (error) {
          // Throwing an error is also acceptable for malformed input
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle concurrent permission checks', async () => {
      const permission: Permission = {
        tool: 'ConcurrentTool',
        level: 'allow-once',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(permission);

      // Start multiple concurrent checks
      const checkPromises = Array(5).fill(0).map(() =>
        permissionManager.checkToolPermission('ConcurrentTool', { consumeAllowOnce: true })
      );

      const results = await Promise.all(checkPromises);

      // Only one should succeed (consume the allow-once), others should fail
      const successCount = results.filter(r => r.allowed).length;
      expect(successCount).toBe(1);

      const failureCount = results.filter(r => !r.allowed).length;
      expect(failureCount).toBe(4);
    });

    it('should handle database errors gracefully', async () => {
      // Close the store to simulate database error
      permissionStore.close();

      try {
        const result = await permissionManager.checkToolPermission('TestTool');
        // Should handle gracefully and deny access
        expect(result.allowed).toBe(false);
        expect(result.denialReason).toBeDefined();
      } catch (error) {
        // Throwing an error is also acceptable
        expect(error).toBeDefined();
      }
    });

    it('should validate denial reasons are informative', async () => {
      const testCases = [
        { tool: 'NoPermissionTool', scenario: 'no permission' },
        {
          tool: 'ExpiredTool',
          scenario: 'expired permission',
          setup: async () => {
            const expired = new Date();
            expired.setHours(expired.getHours() - 1);
            await permissionStore.savePermission({
              tool: 'ExpiredTool',
              level: 'allow-once',
              expiry: expired,
              createdAt: new Date(expired.getTime() - 3600000),
            });
          }
        },
        {
          tool: 'WrongScopeTool',
          scenario: 'wrong scope',
          setup: async () => {
            await permissionStore.savePermission({
              tool: 'WrongScopeTool',
              scope: 'allowed-scope',
              level: 'allow-always',
              createdAt: new Date(),
            });
          },
          scope: 'forbidden-scope'
        }
      ];

      for (const testCase of testCases) {
        if (testCase.setup) {
          await testCase.setup();
        }

        const result = await permissionManager.checkToolPermission(testCase.tool, {
          scope: testCase.scope
        });

        expect(result.allowed).toBe(false);
        expect(result.denialReason).toBeDefined();
        expect(result.denialReason).toHaveLength.greaterThan(10); // Should be informative
        expect(typeof result.denialReason).toBe('string');
      }
    });
  });

  describe('Integration with Permission Levels', () => {
    it('should properly handle deny permissions', async () => {
      const denyPermission: Permission = {
        tool: 'DeniedTool',
        level: 'deny',
        createdAt: new Date(),
      };
      await permissionStore.savePermission(denyPermission);

      const result = await permissionManager.checkToolPermission('DeniedTool');

      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');
      expect(result.denialReason).toMatch(/denied|blocked/i);
    });

    it('should respect permission hierarchy', async () => {
      // Test that explicit deny overrides other permissions
      const permissions: Permission[] = [
        {
          tool: 'HierarchyTool',
          scope: 'general',
          level: 'allow-always',
          createdAt: new Date(),
        },
        {
          tool: 'HierarchyTool',
          scope: 'specific',
          level: 'deny',
          createdAt: new Date(),
        }
      ];

      for (const permission of permissions) {
        await permissionStore.savePermission(permission);
      }

      // General scope should be allowed
      const generalResult = await permissionManager.checkToolPermission('HierarchyTool', { scope: 'general' });
      expect(generalResult.allowed).toBe(true);
      expect(generalResult.level).toBe('allow-always');

      // Specific scope should be denied
      const specificResult = await permissionManager.checkToolPermission('HierarchyTool', { scope: 'specific' });
      expect(specificResult.allowed).toBe(false);
      expect(specificResult.level).toBe('deny');
    });
  });
});