import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import Database from 'better-sqlite3';
import { PermissionStore } from '../permission-store';
import { Permission, ExtendedPermission } from '@apexcli/core';

/**
 * Tests for database migration and schema validation
 * Ensures that the PermissionStore properly handles database schema changes
 */
describe('PermissionStore Database Migration', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `apex-migration-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Fresh Database Creation', () => {
    it('should create database with all required columns', async () => {
      const store = new PermissionStore(testDir);
      await store.initialize();

      // Get database connection to inspect schema
      const dbPath = join(testDir, '.apex', 'apex.db');
      const db = new Database(dbPath);

      try {
        // Check table exists
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='permissions'").all();
        expect(tables).toHaveLength(1);

        // Check all required columns exist
        const columns = db.prepare("PRAGMA table_info(permissions)").all() as Array<{ name: string; type: string; notnull: number; pk: number }>;
        const columnNames = new Set(columns.map(c => c.name));

        // Original columns
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('tool_name');
        expect(columnNames).toContain('scope');
        expect(columnNames).toContain('level');
        expect(columnNames).toContain('expires_at');
        expect(columnNames).toContain('created_at');

        // Extended columns (v0.5.0)
        expect(columnNames).toContain('config');
        expect(columnNames).toContain('grant_reason');
        expect(columnNames).toContain('granted_by');
        expect(columnNames).toContain('tags');

        // Check indexes exist
        const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='permissions'").all();
        const indexNames = new Set(indexes.map((idx: any) => idx.name));

        expect(indexNames).toContain('idx_permissions_tool_scope');
        expect(indexNames).toContain('idx_permissions_level');
        expect(indexNames).toContain('idx_permissions_expires_at');
      } finally {
        db.close();
        store.close();
      }
    });

    it('should handle database with existing basic schema', async () => {
      // Create database with original schema manually
      const dbPath = join(testDir, '.apex', 'apex.db');
      mkdirSync(join(testDir, '.apex'), { recursive: true });

      const db = new Database(dbPath);
      try {
        // Create original table without extended columns
        db.exec(`
          CREATE TABLE permissions (
            id TEXT PRIMARY KEY,
            tool_name TEXT NOT NULL,
            scope TEXT,
            level TEXT NOT NULL CHECK (level IN ('allow-always', 'allow-once', 'deny')),
            expires_at TEXT,
            created_at TEXT NOT NULL
          );

          CREATE INDEX idx_permissions_tool_scope ON permissions(tool_name, scope);
          CREATE INDEX idx_permissions_level ON permissions(level);
          CREATE INDEX idx_permissions_expires_at ON permissions(expires_at);
        `);

        // Insert some legacy data
        const stmt = db.prepare(`
          INSERT INTO permissions (id, tool_name, scope, level, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run('perm-1', 'Read', null, 'allow-always', null, new Date().toISOString());
        stmt.run('perm-2', 'Write', '/tmp', 'allow-once', null, new Date().toISOString());
      } finally {
        db.close();
      }

      // Initialize PermissionStore - should trigger migration
      const store = new PermissionStore(testDir);
      await store.initialize();

      try {
        // Verify legacy data still exists and is accessible
        const readPerm = await store.getPermission({ tool: 'Read' });
        expect(readPerm).not.toBeNull();
        expect(readPerm?.tool).toBe('Read');
        expect(readPerm?.level).toBe('allow-always');

        const writePerm = await store.getPermission({ tool: 'Write', scope: '/tmp' });
        expect(writePerm).not.toBeNull();
        expect(writePerm?.tool).toBe('Write');
        expect(writePerm?.scope).toBe('/tmp');

        // Verify extended functionality works on migrated database
        const extendedPerm: ExtendedPermission = {
          tool: 'Bash',
          level: 'allow-once',
          createdAt: new Date(),
          grantReason: 'Migration test',
          grantedBy: 'test-runner',
          tags: ['migration', 'test'],
        };

        await store.saveExtendedPermission(extendedPerm);

        const retrieved = await store.getExtendedPermission({ tool: 'Bash' });
        expect(retrieved?.grantReason).toBe('Migration test');
        expect(retrieved?.grantedBy).toBe('test-runner');
        expect(retrieved?.tags).toEqual(['migration', 'test']);

        // Verify legacy permissions show up in extended listings with defaults
        const allExtended = await store.listExtendedPermissions();
        expect(allExtended).toHaveLength(3);

        const legacyRead = allExtended.find(p => p.tool === 'Read');
        expect(legacyRead?.grantReason).toBeUndefined();
        expect(legacyRead?.grantedBy).toBeUndefined();
        expect(legacyRead?.tags).toEqual([]);
        expect(legacyRead?.config).toBeUndefined();
      } finally {
        store.close();
      }
    });

    it('should handle multiple migration runs safely', async () => {
      // First initialization
      const store1 = new PermissionStore(testDir);
      await store1.initialize();

      await store1.saveExtendedPermission({
        tool: 'MultiMigrationTest',
        level: 'allow-always',
        createdAt: new Date(),
        grantReason: 'First init',
        tags: ['test'],
      });

      store1.close();

      // Second initialization - should not break anything
      const store2 = new PermissionStore(testDir);
      await store2.initialize();

      const retrieved = await store2.getExtendedPermission({ tool: 'MultiMigrationTest' });
      expect(retrieved?.grantReason).toBe('First init');

      // Third initialization - still should work
      await store2.initialize(); // Call again on same instance

      const retrieved2 = await store2.getExtendedPermission({ tool: 'MultiMigrationTest' });
      expect(retrieved2?.grantReason).toBe('First init');

      store2.close();
    });
  });

  describe('Schema Validation', () => {
    it('should enforce database constraints properly', async () => {
      const store = new PermissionStore(testDir);
      await store.initialize();

      try {
        // Test that basic validations still work
        const invalidPermission: any = {
          tool: '', // Invalid empty tool name
          level: 'allow-always',
          createdAt: new Date(),
          tags: [],
        };

        // This should be caught by schema validation before hitting the database
        await expect(store.saveExtendedPermission(invalidPermission)).rejects.toThrow();

        // Test valid permission works
        const validPermission: ExtendedPermission = {
          tool: 'ValidTool',
          level: 'allow-always',
          createdAt: new Date(),
          tags: [],
        };

        await expect(store.saveExtendedPermission(validPermission)).resolves.not.toThrow();
      } finally {
        store.close();
      }
    });

    it('should handle JSON serialization edge cases', async () => {
      const store = new PermissionStore(testDir);
      await store.initialize();

      try {
        // Test with complex nested configuration
        const complexConfig = {
          enabled: true,
          timeout: 5000,
          metadata: {
            description: 'Complex config test',
            features: ['read', 'write'],
            settings: {
              advanced: true,
              limits: {
                maxSize: 1024 * 1024,
                concurrency: 5,
              },
            },
          },
        };

        const permission: ExtendedPermission = {
          tool: 'ComplexConfigTest',
          level: 'allow-always',
          createdAt: new Date(),
          config: complexConfig as any,
          tags: ['complex', 'json', 'test'],
        };

        await store.saveExtendedPermission(permission);

        const retrieved = await store.getExtendedPermission({ tool: 'ComplexConfigTest' });
        expect(retrieved?.config?.metadata).toEqual(complexConfig.metadata);
        expect(retrieved?.tags).toEqual(['complex', 'json', 'test']);

        // Test with special characters in strings
        const specialCharsPermission: ExtendedPermission = {
          tool: 'SpecialCharsTest',
          level: 'allow-always',
          createdAt: new Date(),
          grantReason: 'Testing with special chars: \n\t\r\\"\\\'',
          grantedBy: 'user@domain.com',
          tags: ['special-chars', 'unicode-test', 'symbols!@#$%'],
        };

        await store.saveExtendedPermission(specialCharsPermission);

        const retrievedSpecial = await store.getExtendedPermission({ tool: 'SpecialCharsTest' });
        expect(retrievedSpecial?.grantReason).toBe('Testing with special chars: \n\t\r\\"\\\'');
        expect(retrievedSpecial?.grantedBy).toBe('user@domain.com');
        expect(retrievedSpecial?.tags).toEqual(['special-chars', 'unicode-test', 'symbols!@#$%']);
      } finally {
        store.close();
      }
    });
  });

  describe('Performance with Extended Schema', () => {
    it('should maintain good performance with large datasets', async () => {
      const store = new PermissionStore(testDir);
      await store.initialize();

      try {
        const startTime = Date.now();
        const batchSize = 1000;

        // Create large dataset
        const permissions: ExtendedPermission[] = [];
        for (let i = 0; i < batchSize; i++) {
          permissions.push({
            tool: `PerformanceTest${i}`,
            scope: i % 2 === 0 ? `/path/${i}/**` : undefined,
            level: i % 3 === 0 ? 'allow-always' : i % 3 === 1 ? 'allow-once' : 'deny',
            createdAt: new Date(Date.now() + i),
            config: {
              enabled: i % 4 !== 0,
              timeout: i * 10,
            } as any,
            grantReason: `Performance test permission ${i}`,
            grantedBy: i % 2 === 0 ? 'user' : 'admin',
            tags: [`batch${Math.floor(i / 100)}`, `item${i % 10}`],
          });
        }

        // Save all permissions
        for (const permission of permissions) {
          await store.saveExtendedPermission(permission);
        }

        const saveTime = Date.now() - startTime;
        expect(saveTime).toBeLessThan(30000); // Should complete within 30 seconds

        // Test query performance
        const queryStart = Date.now();

        const allPermissions = await store.listExtendedPermissions();
        expect(allPermissions).toHaveLength(batchSize);

        const filteredByGrantedBy = await store.listExtendedPermissions({ grantedBy: 'user' });
        expect(filteredByGrantedBy.length).toBe(500);

        const filteredByTags = await store.listExtendedPermissions({ tags: ['batch5'] });
        expect(filteredByTags.length).toBe(100);

        const filteredByConfig = await store.listExtendedPermissions({ hasConfig: true });
        expect(filteredByConfig.length).toBe(750); // 3/4 of permissions have config

        const queryTime = Date.now() - queryStart;
        expect(queryTime).toBeLessThan(5000); // Should complete within 5 seconds
      } finally {
        store.close();
      }
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity across operations', async () => {
      const store = new PermissionStore(testDir);
      await store.initialize();

      try {
        // Create permission with all extended fields
        const originalPermission: ExtendedPermission = {
          tool: 'IntegrityTest',
          scope: '/test/**',
          level: 'allow-once',
          expiry: new Date(Date.now() + 3600000),
          createdAt: new Date(),
          config: {
            enabled: true,
            timeout: 5000,
          } as any,
          grantReason: 'Original permission',
          grantedBy: 'user',
          tags: ['integrity', 'test'],
        };

        await store.saveExtendedPermission(originalPermission);

        // Verify all data is present
        const retrieved = await store.getExtendedPermission({ tool: 'IntegrityTest', scope: '/test/**' });
        expect(retrieved?.level).toBe('allow-once');
        expect(retrieved?.grantReason).toBe('Original permission');
        expect(retrieved?.config).toBeDefined();

        // Update permission - should preserve referential integrity
        const updatedPermission: ExtendedPermission = {
          ...originalPermission,
          level: 'allow-always',
          grantReason: 'Updated permission',
          grantedBy: 'admin',
          tags: ['updated', 'admin-approved'],
        };

        await store.saveExtendedPermission(updatedPermission);

        // Verify update worked and no duplicate entries
        const allPermissions = await store.listExtendedPermissions({ tool: 'IntegrityTest' });
        expect(allPermissions).toHaveLength(1);

        const updated = await store.getExtendedPermission({ tool: 'IntegrityTest', scope: '/test/**' });
        expect(updated?.level).toBe('allow-always');
        expect(updated?.grantReason).toBe('Updated permission');
        expect(updated?.grantedBy).toBe('admin');
        expect(updated?.tags).toEqual(['updated', 'admin-approved']);

        // Clear specific permission
        const cleared = await store.clearPermission({ tool: 'IntegrityTest', scope: '/test/**' });
        expect(cleared).toBe(true);

        // Verify it's gone
        const afterClear = await store.getExtendedPermission({ tool: 'IntegrityTest', scope: '/test/**' });
        expect(afterClear).toBeNull();

        const allAfterClear = await store.listExtendedPermissions();
        expect(allAfterClear.find(p => p.tool === 'IntegrityTest')).toBeUndefined();
      } finally {
        store.close();
      }
    });
  });
});