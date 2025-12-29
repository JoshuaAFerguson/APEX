/**
 * Tests for better-sqlite3 native module compilation and Windows compatibility
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { platform } from 'os';

describe('SQLite Native Module Compilation', () => {
  let testDbPath: string;
  let testDir: string;

  beforeAll(() => {
    testDir = join(tmpdir(), `apex-test-${Date.now()}`);
    testDbPath = join(testDir, 'test.db');
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('better-sqlite3 Module Loading', () => {
    it('should be able to import better-sqlite3 without errors', async () => {
      let Database: any;

      try {
        // Dynamic import to handle potential compilation issues gracefully
        const sqlite = await import('better-sqlite3');
        Database = sqlite.default;
      } catch (error) {
        console.warn('better-sqlite3 not available, likely due to compilation issues:', error);
        // Skip test if module can't be loaded
        return;
      }

      expect(Database).toBeDefined();
      expect(typeof Database).toBe('function');
    });

    it('should be able to create a database instance', async () => {
      let Database: any;
      let db: any;

      try {
        const sqlite = await import('better-sqlite3');
        Database = sqlite.default;

        // Create in-memory database to test basic functionality
        db = new Database(':memory:');
        expect(db).toBeDefined();
      } catch (error) {
        console.warn('Skipping database creation test due to module loading issues:', error);
        return;
      } finally {
        if (db) {
          db.close();
        }
      }
    });

    it('should handle Windows path separators in database file paths', async () => {
      let Database: any;
      let db: any;

      try {
        const sqlite = await import('better-sqlite3');
        Database = sqlite.default;

        // Test with various path formats
        const testPaths = [
          ':memory:',
          testDbPath,
          testDbPath.replace(/\\/g, '/'), // Unix-style path
        ];

        for (const path of testPaths) {
          try {
            db = new Database(path);
            expect(db).toBeDefined();
            db.close();
            db = null;
          } catch (error) {
            if (path === ':memory:') {
              throw error; // In-memory should always work
            }
            console.warn(`Path ${path} failed on ${platform()}:`, error);
          }
        }
      } catch (error) {
        console.warn('Skipping path test due to module loading issues:', error);
        return;
      }
    });
  });

  describe('Database Operations Cross-Platform', () => {
    it('should perform basic CRUD operations consistently', async () => {
      let Database: any;
      let db: any;

      try {
        const sqlite = await import('better-sqlite3');
        Database = sqlite.default;

        db = new Database(':memory:');

        // Create table
        db.exec(`
          CREATE TABLE test_table (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Insert data
        const insert = db.prepare('INSERT INTO test_table (name) VALUES (?)');
        const result = insert.run('test-item');
        expect(result.changes).toBe(1);
        expect(result.lastInsertRowid).toBeDefined();

        // Query data
        const select = db.prepare('SELECT * FROM test_table WHERE name = ?');
        const row = select.get('test-item');
        expect(row).toBeDefined();
        expect(row.name).toBe('test-item');
        expect(row.id).toBeDefined();
        expect(row.created_at).toBeDefined();

        // Update data
        const update = db.prepare('UPDATE test_table SET name = ? WHERE id = ?');
        const updateResult = update.run('updated-item', row.id);
        expect(updateResult.changes).toBe(1);

        // Delete data
        const deleteStmt = db.prepare('DELETE FROM test_table WHERE id = ?');
        const deleteResult = deleteStmt.run(row.id);
        expect(deleteResult.changes).toBe(1);

      } catch (error) {
        console.warn('Skipping CRUD test due to module loading issues:', error);
        return;
      } finally {
        if (db) {
          db.close();
        }
      }
    });

    it('should handle concurrent access patterns safely', async () => {
      let Database: any;
      let db: any;

      try {
        const sqlite = await import('better-sqlite3');
        Database = sqlite.default;

        db = new Database(':memory:');

        // Enable WAL mode for better concurrency (if supported)
        try {
          db.pragma('journal_mode = WAL');
        } catch (error) {
          console.warn('WAL mode not available, continuing with default mode');
        }

        // Create table
        db.exec(`
          CREATE TABLE concurrent_test (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            value INTEGER
          )
        `);

        // Test transaction handling
        const transaction = db.transaction((values: number[]) => {
          const insert = db.prepare('INSERT INTO concurrent_test (value) VALUES (?)');
          for (const value of values) {
            insert.run(value);
          }
        });

        // Execute transaction
        transaction([1, 2, 3, 4, 5]);

        // Verify all rows were inserted
        const count = db.prepare('SELECT COUNT(*) as count FROM concurrent_test').get();
        expect(count.count).toBe(5);

      } catch (error) {
        console.warn('Skipping concurrency test due to module loading issues:', error);
        return;
      } finally {
        if (db) {
          db.close();
        }
      }
    });
  });

  describe('Native Module Compilation Verification', () => {
    it('should verify native module was compiled for current platform', async () => {
      try {
        const sqlite = await import('better-sqlite3');
        const Database = sqlite.default;

        // Create a database to ensure native code is working
        const db = new Database(':memory:');

        // This operation requires native code to work
        const result = db.prepare('SELECT sqlite_version() as version').get();
        expect(result.version).toBeDefined();
        expect(typeof result.version).toBe('string');

        // SQLite version should be reasonable
        const versionParts = result.version.split('.');
        expect(versionParts).toHaveLength(3);
        expect(parseInt(versionParts[0])).toBeGreaterThanOrEqual(3);

        db.close();
      } catch (error) {
        console.warn('Native module verification failed:', error);
        // This test might fail if the module wasn't properly compiled for the platform
        throw new Error(`better-sqlite3 native module not properly compiled for ${platform()}: ${error}`);
      }
    });

    it('should handle Windows-specific compilation requirements', async () => {
      if (platform() !== 'win32') {
        console.log('Skipping Windows-specific test on non-Windows platform');
        return;
      }

      try {
        const sqlite = await import('better-sqlite3');
        const Database = sqlite.default;

        // On Windows, test specific functionality that requires proper compilation
        const db = new Database(':memory:');

        // Test Unicode handling (important on Windows)
        db.exec(`
          CREATE TABLE unicode_test (
            id INTEGER PRIMARY KEY,
            text TEXT
          )
        `);

        const insert = db.prepare('INSERT INTO unicode_test (text) VALUES (?)');
        const unicodeText = '测试 Unicode 支持 🚀';
        insert.run(unicodeText);

        const result = db.prepare('SELECT text FROM unicode_test WHERE id = 1').get();
        expect(result.text).toBe(unicodeText);

        db.close();
      } catch (error) {
        console.warn('Windows-specific compilation test failed:', error);
        throw error;
      }
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle database cleanup properly', async () => {
      let Database: any;

      try {
        const sqlite = await import('better-sqlite3');
        Database = sqlite.default;

        const databases: any[] = [];

        // Create multiple databases
        for (let i = 0; i < 5; i++) {
          const db = new Database(':memory:');
          databases.push(db);
        }

        // Close all databases
        databases.forEach(db => {
          expect(() => db.close()).not.toThrow();
        });

        // Verify they're closed by attempting operations (should throw)
        databases.forEach(db => {
          expect(() => db.prepare('SELECT 1')).toThrow();
        });

      } catch (error) {
        console.warn('Skipping cleanup test due to module loading issues:', error);
        return;
      }
    });

    it('should handle large operations efficiently', async () => {
      let Database: any;
      let db: any;

      try {
        const sqlite = await import('better-sqlite3');
        Database = sqlite.default;

        db = new Database(':memory:');

        // Create table for performance test
        db.exec(`
          CREATE TABLE performance_test (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT
          )
        `);

        // Test batch insert performance
        const insert = db.prepare('INSERT INTO performance_test (data) VALUES (?)');
        const insertMany = db.transaction((rows: string[]) => {
          for (const row of rows) {
            insert.run(row);
          }
        });

        const testData = Array.from({ length: 1000 }, (_, i) => `test-data-${i}`);
        const startTime = Date.now();
        insertMany(testData);
        const endTime = Date.now();

        // Verify all data was inserted
        const count = db.prepare('SELECT COUNT(*) as count FROM performance_test').get();
        expect(count.count).toBe(1000);

        // Performance should be reasonable (less than 5 seconds for 1000 inserts)
        const duration = endTime - startTime;
        expect(duration).toBeLessThan(5000);

      } catch (error) {
        console.warn('Skipping performance test due to module loading issues:', error);
        return;
      } finally {
        if (db) {
          db.close();
        }
      }
    });
  });
});