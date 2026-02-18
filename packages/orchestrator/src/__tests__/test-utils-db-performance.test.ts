/**
 * Performance and stress tests for SQLite test database utilities
 * These tests ensure the database utilities perform well under various load conditions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, cleanupTestDatabase, type TestDatabaseContext } from '../test-utils/db';

describe('Test Utils DB Performance Tests', () => {
  let testDb: TestDatabaseContext;

  afterEach(() => {
    if (testDb) {
      cleanupTestDatabase(testDb);
    }
  });

  describe('Database Creation Performance', () => {
    it('should create databases quickly in sequence', async () => {
      const startTime = Date.now();
      const databases: TestDatabaseContext[] = [];

      try {
        // Create 10 databases in sequence
        for (let i = 0; i < 10; i++) {
          const db = await createTestDatabase();
          databases.push(db);
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        // Should take less than 5 seconds to create 10 databases
        expect(totalTime).toBeLessThan(5000);

        // Verify all databases are functional
        databases.forEach(db => {
          expect(db.db.open).toBe(true);
          const result = db.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
          expect(result.count).toBe(0);
        });
      } finally {
        // Clean up all databases
        databases.forEach(db => cleanupTestDatabase(db));
      }
    });

    it('should handle concurrent database creation', async () => {
      const startTime = Date.now();

      // Create 5 databases concurrently
      const createPromises = Array.from({ length: 5 }, () => createTestDatabase());
      const databases = await Promise.all(createPromises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      try {
        // Should be faster than sequential creation
        expect(totalTime).toBeLessThan(3000);

        // Verify all databases are functional and isolated
        expect(databases).toHaveLength(5);

        // Insert different data in each database
        databases.forEach((db, index) => {
          const now = new Date().toISOString();
          db.db.prepare(`
            INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(`task_${index}`, `Task ${index}`, 'feature', 'full', 'pending', `/test/${index}`, now, now);
        });

        // Verify data isolation
        databases.forEach((db, index) => {
          const tasks = db.db.prepare('SELECT * FROM tasks').all();
          expect(tasks).toHaveLength(1);
          expect((tasks[0] as any).id).toBe(`task_${index}`);
        });

      } finally {
        databases.forEach(db => cleanupTestDatabase(db));
      }
    });
  });

  describe('Large Data Operations', () => {
    beforeEach(async () => {
      testDb = await createTestDatabase();
    });

    it('should handle bulk insertions efficiently', async () => {
      const startTime = Date.now();
      const recordCount = 1000;

      // Prepare bulk insert statement
      const stmt = testDb.db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();

      // Insert 1000 records
      testDb.db.transaction(() => {
        for (let i = 0; i < recordCount; i++) {
          stmt.run(
            `bulk_task_${i}`,
            `Bulk task ${i}`,
            'feature',
            'full',
            i % 2 === 0 ? 'pending' : 'running',
            '/test/bulk',
            now,
            now
          );
        }
      })();

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should insert 1000 records in under 1 second
      expect(totalTime).toBeLessThan(1000);

      // Verify all records were inserted
      const count = testDb.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      expect(count.count).toBe(recordCount);

      // Test query performance
      const queryStartTime = Date.now();
      const pendingTasks = testDb.db.prepare('SELECT * FROM tasks WHERE status = ?').all('pending');
      const queryEndTime = Date.now();
      const queryTime = queryEndTime - queryStartTime;

      // Query should be fast
      expect(queryTime).toBeLessThan(100);
      expect(pendingTasks).toHaveLength(500); // Half should be pending
    });

    it('should handle complex queries with joins efficiently', async () => {
      const now = new Date().toISOString();

      // Insert test data
      const taskStmt = testDb.db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const logStmt = testDb.db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, stage, message)
        VALUES (?, ?, ?, ?, ?)
      `);

      // Insert 100 tasks with 5 logs each (500 total logs)
      testDb.db.transaction(() => {
        for (let i = 0; i < 100; i++) {
          const taskId = `perf_task_${i}`;
          taskStmt.run(taskId, `Performance task ${i}`, 'feature', 'full', 'running', '/test/perf', now, now);

          // Add 5 logs per task
          for (let j = 0; j < 5; j++) {
            logStmt.run(taskId, now, 'info', 'development', `Log message ${j} for task ${i}`);
          }
        }
      })();

      const startTime = Date.now();

      // Complex join query
      const result = testDb.db.prepare(`
        SELECT
          t.id,
          t.description,
          t.status,
          COUNT(l.id) as log_count,
          MIN(l.timestamp) as first_log,
          MAX(l.timestamp) as last_log
        FROM tasks t
        LEFT JOIN task_logs l ON t.id = l.task_id
        WHERE t.status = 'running'
        GROUP BY t.id
        HAVING COUNT(l.id) > 3
        ORDER BY t.id
      `).all();

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      // Complex query should complete quickly
      expect(queryTime).toBeLessThan(100);
      expect(result).toHaveLength(100); // All tasks should match criteria

      // Verify query results
      result.forEach((row: any, index) => {
        expect(row.id).toBe(`perf_task_${index}`);
        expect(row.log_count).toBe(5);
      });
    });

    it('should handle multiple concurrent transactions', async () => {
      const concurrentOps = 10;
      const recordsPerOp = 50;

      const operations = Array.from({ length: concurrentOps }, async (_, opIndex) => {
        return new Promise<void>((resolve) => {
          // Simulate some async delay to create real concurrency
          setTimeout(() => {
            const stmt = testDb.db.prepare(`
              INSERT INTO task_logs (task_id, timestamp, level, stage, message)
              VALUES (?, ?, ?, ?, ?)
            `);

            testDb.db.transaction(() => {
              for (let i = 0; i < recordsPerOp; i++) {
                stmt.run(
                  `concurrent_task_${opIndex}`,
                  new Date().toISOString(),
                  'info',
                  `stage_${opIndex}`,
                  `Concurrent message ${i} from operation ${opIndex}`
                );
              }
            })();
            resolve();
          }, Math.random() * 10); // Random delay 0-10ms
        });
      });

      const startTime = Date.now();
      await Promise.all(operations);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete all concurrent operations in reasonable time
      expect(totalTime).toBeLessThan(2000);

      // Verify all records were inserted
      const count = testDb.db.prepare('SELECT COUNT(*) as count FROM task_logs').get() as { count: number };
      expect(count.count).toBe(concurrentOps * recordsPerOp);

      // Verify data integrity - each operation should have its records
      for (let opIndex = 0; opIndex < concurrentOps; opIndex++) {
        const opRecords = testDb.db.prepare('SELECT * FROM task_logs WHERE task_id = ?')
          .all(`concurrent_task_${opIndex}`);
        expect(opRecords).toHaveLength(recordsPerOp);
      }
    });
  });

  describe('Memory Usage and Cleanup', () => {
    it('should properly release memory after cleanup', async () => {
      const databases: TestDatabaseContext[] = [];

      // Create multiple databases
      for (let i = 0; i < 20; i++) {
        const db = await createTestDatabase();

        // Add some data
        const now = new Date().toISOString();
        db.db.prepare(`
          INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(`memory_task_${i}`, `Memory task ${i}`, 'feature', 'full', 'pending', '/test/memory', now, now);

        databases.push(db);
      }

      // Verify all databases are open
      databases.forEach(db => {
        expect(db.db.open).toBe(true);
      });

      // Clean up all databases
      databases.forEach(db => {
        cleanupTestDatabase(db);
        expect(db.db.open).toBe(false);
      });

      // Attempt to use cleaned up databases should fail
      databases.forEach(db => {
        expect(() => {
          db.db.prepare('SELECT 1').get();
        }).toThrow();
      });
    });

    it('should handle rapid create/cleanup cycles', async () => {
      const cycles = 50;
      const startTime = Date.now();

      for (let i = 0; i < cycles; i++) {
        const db = await createTestDatabase();

        // Perform some operations
        const now = new Date().toISOString();
        db.db.prepare(`
          INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(`cycle_task_${i}`, `Cycle task ${i}`, 'feature', 'full', 'pending', '/test/cycle', now, now);

        const count = db.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
        expect(count.count).toBe(1);

        // Cleanup immediately
        cleanupTestDatabase(db);
        expect(db.db.open).toBe(false);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 50 create/cleanup cycles should complete in reasonable time
      expect(totalTime).toBeLessThan(5000);
    });
  });

  describe('Schema Validation Performance', () => {
    it('should validate all table schemas quickly', async () => {
      testDb = await createTestDatabase();

      const startTime = Date.now();

      // Get all table schemas
      const tables = testDb.db.prepare(`
        SELECT name, sql FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as Array<{ name: string; sql: string }>;

      // Verify each table has the expected structure
      const tableChecks = [
        // Core tables
        { name: 'tasks', requiredColumns: ['id', 'description', 'workflow', 'status'] },
        { name: 'task_logs', requiredColumns: ['task_id', 'timestamp', 'level', 'message'] },
        { name: 'task_artifacts', requiredColumns: ['task_id', 'name', 'type', 'created_at'] },

        // v0.5.0 tables
        { name: 'approval_states', requiredColumns: ['id', 'task_id', 'gate_name', 'status'] },
        { name: 'tool_actions', requiredColumns: ['id', 'task_id', 'execution_tool_name', 'execution_input'] },
        { name: 'permissions', requiredColumns: ['id', 'tool_name', 'level', 'created_at'] },
        { name: 'audit_logs', requiredColumns: ['id', 'event_type', 'severity', 'timestamp'] },
      ];

      tableChecks.forEach(({ name, requiredColumns }) => {
        const table = tables.find(t => t.name === name);
        expect(table, `Table ${name} should exist`).toBeDefined();

        // Verify required columns exist in schema
        requiredColumns.forEach(column => {
          expect(table!.sql.toLowerCase()).toContain(column.toLowerCase());
        });
      });

      const endTime = Date.now();
      const validationTime = endTime - startTime;

      // Schema validation should be very fast
      expect(validationTime).toBeLessThan(50);
    });

    it('should verify foreign key constraints work efficiently', async () => {
      testDb = await createTestDatabase();

      const now = new Date().toISOString();

      // Create a parent task
      testDb.db.prepare(`
        INSERT INTO tasks (id, description, workflow, autonomy, status, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('parent_task', 'Parent task', 'feature', 'full', 'pending', '/test/fk', now, now);

      const startTime = Date.now();

      // Add many related records
      const logStmt = testDb.db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, message)
        VALUES (?, ?, ?, ?)
      `);

      const artifactStmt = testDb.db.prepare(`
        INSERT INTO task_artifacts (task_id, name, type, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      testDb.db.transaction(() => {
        for (let i = 0; i < 100; i++) {
          logStmt.run('parent_task', now, 'info', `Log message ${i}`);
          artifactStmt.run('parent_task', `artifact_${i}`, 'code', `content ${i}`, now);
        }
      })();

      const endTime = Date.now();
      const insertTime = endTime - startTime;

      // FK constraint checks should not significantly slow down inserts
      expect(insertTime).toBeLessThan(200);

      // Verify all records were inserted
      const logCount = testDb.db.prepare('SELECT COUNT(*) as count FROM task_logs WHERE task_id = ?')
        .get('parent_task') as { count: number };
      const artifactCount = testDb.db.prepare('SELECT COUNT(*) as count FROM task_artifacts WHERE task_id = ?')
        .get('parent_task') as { count: number };

      expect(logCount.count).toBe(100);
      expect(artifactCount.count).toBe(100);

      // Verify FK constraint still works by trying to insert invalid references
      expect(() => {
        testDb.db.prepare(`
          INSERT INTO task_logs (task_id, timestamp, level, message)
          VALUES (?, ?, ?, ?)
        `).run('nonexistent_task', now, 'info', 'This should fail');
      }).toThrow();
    });
  });
});