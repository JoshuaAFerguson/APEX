/**
 * @fileoverview SQL Injection Prevention Tests
 *
 * Critical Priority Gap: SQL Injection Prevention
 * Risk Level: High - Database compromise
 *
 * Tests cover:
 * - Permission scope SQL injection attempts
 * - Tool name injection testing
 * - Special character handling in permission data
 * - Database query parameter validation
 * - Prepared statement usage verification
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionStore } from '../permission-store';
import { Permission, PermissionLevel } from '@apexcli/core';

describe('SQL Injection Prevention', () => {
  let permissionStore: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-sql-injection-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();
  });

  afterEach(() => {
    if (permissionStore) {
      permissionStore.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Tool Name Injection Prevention', () => {
    it('should safely handle malicious tool names with SQL injection attempts', async () => {
      const maliciousToolNames = [
        "Write'; DROP TABLE permissions; --",
        "Read\"; DELETE FROM permissions; --",
        "Shell' OR 1=1; --",
        "Tool'; INSERT INTO permissions (tool, level) VALUES ('Admin', 'allow-always'); --",
        "Test\' UNION SELECT * FROM sqlite_master; --",
        "Command'; UPDATE permissions SET level='allow-always' WHERE tool='Shell'; --",
      ];

      for (const maliciousToolName of maliciousToolNames) {
        const permission: Permission = {
          tool: maliciousToolName,
          level: 'allow-once' as PermissionLevel,
          createdAt: new Date(),
        };

        // Should safely save without executing SQL injection
        await expect(permissionStore.savePermission(permission)).resolves.not.toThrow();

        // Verify the malicious tool name was stored as-is (escaped)
        const retrievedPermissions = await permissionStore.listPermissions({ tool: maliciousToolName });
        expect(retrievedPermissions).toHaveLength(1);
        expect(retrievedPermissions[0].tool).toBe(maliciousToolName);
      }

      // Verify database integrity - should still have the expected number of permissions
      const allPermissions = await permissionStore.listPermissions();
      expect(allPermissions).toHaveLength(maliciousToolNames.length);
    });

    it('should prevent SQL injection through tool name queries', async () => {
      // Save legitimate permissions
      const legitimatePermission: Permission = {
        tool: 'Write',
        level: 'allow-always' as PermissionLevel,
        createdAt: new Date(),
      };

      await permissionStore.savePermission(legitimatePermission);

      // Attempt SQL injection through search queries
      const injectionAttempts = [
        "Write' OR '1'='1",
        "Write'; DROP TABLE permissions; SELECT * FROM permissions WHERE tool='",
        "' UNION SELECT sql FROM sqlite_master WHERE type='table' --",
        "Write' AND (SELECT COUNT(*) FROM permissions) > 0 --",
      ];

      for (const maliciousQuery of injectionAttempts) {
        const results = await permissionStore.listPermissions({ tool: maliciousQuery });

        // Should return empty results or only exact matches, never execute injection
        expect(results.length).toBeLessThanOrEqual(1);
        if (results.length === 1) {
          expect(results[0].tool).toBe(maliciousQuery); // Exact match only
        }
      }
    });
  });

  describe('Permission Scope Injection Prevention', () => {
    it('should safely handle malicious scope values', async () => {
      const maliciousScopes = [
        "'/tmp'; DELETE FROM permissions; --",
        "/path' OR 1=1; --",
        "/directory\"; DROP TABLE permissions; --",
        "'; INSERT INTO permissions (tool, level, scope) VALUES ('Admin', 'allow-always', '/root'); --",
        "/safe' UNION SELECT password FROM users; --",
        "/path'; UPDATE permissions SET level='allow-always'; --",
      ];

      for (const maliciousScope of maliciousScopes) {
        const permission: Permission = {
          tool: 'Read',
          level: 'allow-once' as PermissionLevel,
          scope: maliciousScope,
          createdAt: new Date(),
        };

        // Should safely save the permission with the malicious scope
        await expect(permissionStore.savePermission(permission)).resolves.not.toThrow();

        // Verify the scope was stored safely
        const results = await permissionStore.listPermissions({ tool: 'Read', scope: maliciousScope });
        expect(results).toHaveLength(1);
        expect(results[0].scope).toBe(maliciousScope);
      }
    });

    it('should prevent scope-based query injection', async () => {
      // Create permissions with different scopes
      const scopes = ['/tmp', '/home', '/var'];
      for (const scope of scopes) {
        const permission: Permission = {
          tool: 'Access',
          level: 'allow-once' as PermissionLevel,
          scope: scope,
          createdAt: new Date(),
        };
        await permissionStore.savePermission(permission);
      }

      // Attempt to inject through scope queries
      const scopeInjections = [
        "/tmp' OR scope='/home' --",
        "'; SELECT * FROM permissions; --",
        "/tmp' UNION SELECT * FROM permissions WHERE scope='/var'; --",
      ];

      for (const maliciousScope of scopeInjections) {
        const results = await permissionStore.listPermissions({ scope: maliciousScope });

        // Should not return multiple records due to injection
        expect(results.length).toBeLessThanOrEqual(1);
        if (results.length === 1) {
          expect(results[0].scope).toBe(maliciousScope);
        }
      }
    });
  });

  describe('User ID Injection Prevention', () => {
    it('should safely handle malicious user IDs', async () => {
      const maliciousUserIds = [
        "user'; DROP TABLE permissions; --",
        "admin' OR 1=1; --",
        "user\"; DELETE FROM permissions; --",
        "'; INSERT INTO permissions (tool, level) VALUES ('Root', 'allow-always'); --",
      ];

      for (const maliciousUserId of maliciousUserIds) {
        const permission: Permission = {
          tool: 'UserTest',
          level: 'allow-once' as PermissionLevel,
          createdAt: new Date(),
        };

        // Save with malicious user ID
        await expect(
          permissionStore.savePermission(permission, { userId: maliciousUserId })
        ).resolves.not.toThrow();

        // Verify it was saved safely
        const results = await permissionStore.listPermissions({ userId: maliciousUserId });
        expect(results).toHaveLength(1);
      }
    });
  });

  describe('Special Character Handling', () => {
    it('should properly escape and handle special characters', async () => {
      const specialCharacterData = [
        { tool: "Tool'With'Quotes", scope: "/path'with'quotes" },
        { tool: 'Tool"With"DoubleQuotes', scope: '/path"with"doublequotes' },
        { tool: 'Tool\\With\\Backslashes', scope: '/path\\with\\backslashes' },
        { tool: 'Tool\nWith\nNewlines', scope: '/path\nwith\nnewlines' },
        { tool: 'Tool\tWith\tTabs', scope: '/path\twith\ttabs' },
        { tool: 'Tool\r\nWith\r\nCRLF', scope: '/path\r\nwith\r\ncrlf' },
        { tool: 'Tool\0With\0NullBytes', scope: '/path\0with\0nullbytes' },
      ];

      for (const data of specialCharacterData) {
        const permission: Permission = {
          tool: data.tool,
          level: 'allow-once' as PermissionLevel,
          scope: data.scope,
          createdAt: new Date(),
        };

        // Should handle special characters safely
        await expect(permissionStore.savePermission(permission)).resolves.not.toThrow();

        // Verify data integrity
        const results = await permissionStore.listPermissions({ tool: data.tool });
        expect(results).toHaveLength(1);
        expect(results[0].tool).toBe(data.tool);
        expect(results[0].scope).toBe(data.scope);
      }
    });

    it('should handle Unicode and international characters safely', async () => {
      const unicodeData = [
        { tool: 'ツール名前', scope: '/パス/ディレクトリ' }, // Japanese
        { tool: 'инструмент', scope: '/путь/директория' }, // Russian
        { tool: '工具名称', scope: '/路径/目录' }, // Chinese
        { tool: 'أداة_اسم', scope: '/مسار/دليل' }, // Arabic
        { tool: '🔧Tool🛠️', scope: '/📁path📂' }, // Emojis
        { tool: 'Tool™®©', scope: '/path™®©' }, // Special symbols
      ];

      for (const data of unicodeData) {
        const permission: Permission = {
          tool: data.tool,
          level: 'allow-once' as PermissionLevel,
          scope: data.scope,
          createdAt: new Date(),
        };

        await expect(permissionStore.savePermission(permission)).resolves.not.toThrow();

        const results = await permissionStore.listPermissions({ tool: data.tool });
        expect(results).toHaveLength(1);
        expect(results[0].tool).toBe(data.tool);
        expect(results[0].scope).toBe(data.scope);
      }
    });
  });

  describe('Database Query Parameter Validation', () => {
    it('should validate query parameters to prevent injection', async () => {
      // Create test data
      await permissionStore.savePermission({
        tool: 'TestTool',
        level: 'allow-once' as PermissionLevel,
        createdAt: new Date(),
      });

      // Test parameter injection attempts
      const maliciousParameters = [
        { limit: "1; DROP TABLE permissions; --" as any },
        { offset: "0; DELETE FROM permissions; --" as any },
        { limit: -1 }, // Invalid limit
        { offset: -1 }, // Invalid offset
        { limit: Number.MAX_SAFE_INTEGER }, // Extremely large limit
        { offset: Number.MAX_SAFE_INTEGER }, // Extremely large offset
      ];

      for (const params of maliciousParameters) {
        await expect(
          permissionStore.listPermissions(params)
        ).resolves.not.toThrow();

        // Should return safe results
        const results = await permissionStore.listPermissions(params);
        expect(Array.isArray(results)).toBe(true);
      }
    });

    it('should properly sanitize filter parameters', async () => {
      // Create test permissions
      const testPermissions = [
        { tool: 'Tool1', level: 'allow-once' as PermissionLevel },
        { tool: 'Tool2', level: 'allow-always' as PermissionLevel },
        { tool: 'Tool3', level: 'deny' as PermissionLevel },
      ];

      for (const perm of testPermissions) {
        await permissionStore.savePermission({
          ...perm,
          createdAt: new Date(),
        });
      }

      // Test filter injection
      const maliciousFilters = [
        { tool: "Tool1' OR tool='Tool2" },
        { level: "allow-once' OR '1'='1" as any },
        { tool: "'; SELECT * FROM sqlite_master; --" },
      ];

      for (const filter of maliciousFilters) {
        const results = await permissionStore.listPermissions(filter);

        // Should either return no results or exact matches only
        expect(results.length).toBeLessThanOrEqual(1);
        if (results.length === 1) {
          // Should match the filter exactly
          if (filter.tool) {
            expect(results[0].tool).toBe(filter.tool);
          }
          if (filter.level) {
            expect(results[0].level).toBe(filter.level);
          }
        }
      }
    });
  });

  describe('Prepared Statement Usage Verification', () => {
    it('should use prepared statements for all database operations', async () => {
      // This test verifies that our database operations are using prepared statements
      // by attempting various injection patterns that would succeed with string concatenation

      const injectionTestCases = [
        {
          permission: {
            tool: "'; DROP TABLE IF EXISTS test_injection; CREATE TABLE test_injection (id INTEGER); --",
            level: 'allow-once' as PermissionLevel,
            createdAt: new Date(),
          },
        },
        {
          permission: {
            tool: 'NormalTool',
            level: 'allow-once' as PermissionLevel,
            scope: "'; ALTER TABLE permissions ADD COLUMN injected TEXT; --",
            createdAt: new Date(),
          },
        },
      ];

      for (const testCase of injectionTestCases) {
        // Save the permission with injection attempt
        await expect(
          permissionStore.savePermission(testCase.permission)
        ).resolves.not.toThrow();

        // If prepared statements are used, the injection should be stored as literal text
        const results = await permissionStore.listPermissions({ tool: testCase.permission.tool });
        expect(results).toHaveLength(1);
        expect(results[0].tool).toBe(testCase.permission.tool);
      }

      // Verify database structure hasn't been modified by injection
      const allPermissions = await permissionStore.listPermissions();
      expect(Array.isArray(allPermissions)).toBe(true);

      // The table should still have its original structure
      for (const permission of allPermissions) {
        expect(permission).toHaveProperty('tool');
        expect(permission).toHaveProperty('level');
        expect(permission).toHaveProperty('createdAt');
      }
    });

    it('should prevent batch query execution through injection', async () => {
      const batchInjectionAttempts = [
        "Tool1'; INSERT INTO permissions (tool, level) VALUES ('Injected', 'allow-always'); --",
        "Tool2\"; DELETE FROM permissions WHERE tool='Tool1'; INSERT INTO permissions (tool) VALUES ('BadTool'); --",
      ];

      let permissionCountBefore = (await permissionStore.listPermissions()).length;

      for (const injectionTool of batchInjectionAttempts) {
        const permission: Permission = {
          tool: injectionTool,
          level: 'allow-once' as PermissionLevel,
          createdAt: new Date(),
        };

        await permissionStore.savePermission(permission);
      }

      // Should have exactly the number of permissions we added (no batch execution)
      const permissionCountAfter = (await permissionStore.listPermissions()).length;
      expect(permissionCountAfter).toBe(permissionCountBefore + batchInjectionAttempts.length);

      // Verify no unauthorized permissions were created
      const injectedPermissions = await permissionStore.listPermissions({ tool: 'Injected' });
      expect(injectedPermissions).toHaveLength(0);

      const badToolPermissions = await permissionStore.listPermissions({ tool: 'BadTool' });
      expect(badToolPermissions).toHaveLength(0);
    });
  });

  describe('Database Schema Protection', () => {
    it('should prevent schema manipulation through permission data', async () => {
      const schemaAttackPermissions = [
        {
          tool: "Tool'; ALTER TABLE permissions DROP COLUMN level; --",
          level: 'allow-once' as PermissionLevel,
        },
        {
          tool: "Tool2'; CREATE TABLE malicious (data TEXT); --",
          level: 'allow-once' as PermissionLevel,
        },
        {
          tool: "Tool3'; DROP INDEX IF EXISTS idx_tool; --",
          level: 'allow-once' as PermissionLevel,
        },
      ];

      for (const attackPermission of schemaAttackPermissions) {
        const permission: Permission = {
          ...attackPermission,
          createdAt: new Date(),
        };

        await permissionStore.savePermission(permission);
      }

      // Verify schema integrity by checking we can still access all expected columns
      const permissions = await permissionStore.listPermissions();
      for (const permission of permissions) {
        expect(permission).toHaveProperty('tool');
        expect(permission).toHaveProperty('level');
        expect(permission).toHaveProperty('createdAt');
        expect(typeof permission.tool).toBe('string');
        expect(typeof permission.level).toBe('string');
        expect(permission.createdAt).toBeInstanceOf(Date);
      }
    });

    it('should maintain transaction integrity under injection attempts', async () => {
      const transactionTestPermissions = [
        {
          tool: "TransactionTool1'; ROLLBACK; INSERT INTO permissions (tool, level) VALUES ('Malicious', 'allow-always'); BEGIN; --",
          level: 'allow-once' as PermissionLevel,
        },
        {
          tool: 'TransactionTool2',
          level: 'allow-once' as PermissionLevel,
        },
      ];

      // Save permissions in what should be a transaction-like operation
      for (const permData of transactionTestPermissions) {
        const permission: Permission = {
          ...permData,
          createdAt: new Date(),
        };
        await permissionStore.savePermission(permission);
      }

      // Verify both permissions exist (transaction wasn't compromised)
      const results1 = await permissionStore.listPermissions({ tool: transactionTestPermissions[0].tool });
      const results2 = await permissionStore.listPermissions({ tool: transactionTestPermissions[1].tool });

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);

      // Verify no malicious permission was created
      const maliciousResults = await permissionStore.listPermissions({ tool: 'Malicious' });
      expect(maliciousResults).toHaveLength(0);
    });
  });
});