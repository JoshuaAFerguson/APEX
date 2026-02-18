/**
 * @fileoverview Tests for database cleanup helpers for SQLite TaskStore
 *
 * This test suite verifies that database cleanup utilities properly reset
 * SQLite database state between tests, including:
 * - TaskStore table cleanup
 * - Foreign key constraint handling
 * - Transaction rollback patterns
 * - Database connection management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createMockCleanup, createResourceCleanup } from '../test-setup-utils.js';

// Mock the TaskStore since we're testing the cleanup patterns
interface MockTaskStore {
  db: MockDatabase;
  close(): Promise<void>;
  reset(): Promise<void>;
  clearAllTasks(): Promise<void>;
  clearAllTodos(): Promise<void>;
  beginTransaction(): MockTransaction;
}

interface MockDatabase {
  exec(sql: string): void;
  prepare(sql: string): MockStatement;
  close(): void;
  inTransaction: boolean;
}

interface MockStatement {
  run(...params: any[]): { changes: number; lastInsertRowid: number };
  get(...params: any[]): any;
  all(...params: any[]): any[];
  finalize(): void;
}

interface MockTransaction {
  commit(): void;
  rollback(): void;
  savepoint(name: string): void;
  release(name: string): void;
}

describe('Database Cleanup Helpers', () => {
  let mockTaskStore: MockTaskStore;
  let tempDbPath: string;

  createMockCleanup();
  const { addCleanup } = createResourceCleanup();

  beforeEach(() => {
    // Create a temporary database path for testing
    tempDbPath = path.join(process.cwd(), `.test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

    // Create mock TaskStore with database cleanup capabilities
    mockTaskStore = createMockTaskStore(tempDbPath);

    // Register cleanup for test database
    addCleanup(async () => {
      await mockTaskStore.close();
      try {
        await fs.unlink(tempDbPath);
      } catch (error) {
        // Ignore errors if file doesn't exist
      }
    });
  });

  describe('Database Reset Utilities', () => {
    it('should provide reset() method for complete database cleanup', async () => {
      // Add some test data
      mockTaskStore.db.exec(`
        INSERT INTO tasks (id, name, status) VALUES
        ('task1', 'Test Task 1', 'pending'),
        ('task2', 'Test Task 2', 'running')
      `);

      // Verify data exists
      const tasksBeforeReset = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
      expect(tasksBeforeReset.count).toBeGreaterThan(0);

      // Reset database
      await mockTaskStore.reset();

      // Verify all data is cleared
      const tasksAfterReset = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
      expect(tasksAfterReset.count).toBe(0);
    });

    it('should clear all tasks without affecting schema', async () => {
      // Add test tasks
      mockTaskStore.db.exec(`
        INSERT INTO tasks (id, name, status) VALUES
        ('task1', 'Test Task 1', 'pending'),
        ('task2', 'Test Task 2', 'running')
      `);

      await mockTaskStore.clearAllTasks();

      // Tasks should be cleared
      const taskCount = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
      expect(taskCount.count).toBe(0);

      // Schema should still exist
      const tables = mockTaskStore.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'
      `).all();
      expect(tables).toHaveLength(1);
    });

    it('should clear all todos independently', async () => {
      // Add test data to both tables
      mockTaskStore.db.exec(`
        INSERT INTO tasks (id, name, status) VALUES ('task1', 'Test Task', 'pending')
      `);
      mockTaskStore.db.exec(`
        INSERT INTO todos (id, task_id, content) VALUES ('todo1', 'task1', 'Test Todo')
      `);

      await mockTaskStore.clearAllTodos();

      // Todos should be cleared
      const todoCount = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM todos').get();
      expect(todoCount.count).toBe(0);

      // Tasks should remain
      const taskCount = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
      expect(taskCount.count).toBe(1);
    });
  });

  describe('Transaction Management for Testing', () => {
    it('should support transaction rollback for test isolation', () => {
      const transaction = mockTaskStore.beginTransaction();

      try {
        // Add data within transaction
        mockTaskStore.db.exec(`
          INSERT INTO tasks (id, name, status) VALUES ('task1', 'Test Task', 'pending')
        `);

        // Data should exist within transaction
        const taskCount = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
        expect(taskCount.count).toBe(1);

        // Rollback transaction
        transaction.rollback();

        // Data should be gone after rollback
        const taskCountAfterRollback = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
        expect(taskCountAfterRollback.count).toBe(0);

      } catch (error) {
        transaction.rollback();
        throw error;
      }
    });

    it('should support savepoints for nested transactions', () => {
      const transaction = mockTaskStore.beginTransaction();

      try {
        // Add initial data
        mockTaskStore.db.exec(`
          INSERT INTO tasks (id, name, status) VALUES ('task1', 'Test Task 1', 'pending')
        `);

        // Create savepoint
        transaction.savepoint('test_savepoint');

        // Add more data
        mockTaskStore.db.exec(`
          INSERT INTO tasks (id, name, status) VALUES ('task2', 'Test Task 2', 'pending')
        `);

        // Should have both tasks
        let taskCount = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
        expect(taskCount.count).toBe(2);

        // Rollback to savepoint
        transaction.rollback();

        // Should only have first task
        taskCount = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
        expect(taskCount.count).toBe(1);

        transaction.commit();

      } catch (error) {
        transaction.rollback();
        throw error;
      }
    });
  });

  describe('Connection Management', () => {
    it('should properly close database connections', async () => {
      expect(mockTaskStore.db).toBeDefined();

      await mockTaskStore.close();

      // After closing, database should not be usable
      expect(() => {
        mockTaskStore.db.exec('SELECT 1');
      }).toThrow();
    });

    it('should handle multiple close calls gracefully', async () => {
      await mockTaskStore.close();

      // Second close should not throw
      await expect(mockTaskStore.close()).resolves.not.toThrow();
    });

    it('should detect transaction state correctly', () => {
      expect(mockTaskStore.db.inTransaction).toBe(false);

      const transaction = mockTaskStore.beginTransaction();
      expect(mockTaskStore.db.inTransaction).toBe(true);

      transaction.rollback();
      expect(mockTaskStore.db.inTransaction).toBe(false);
    });
  });

  describe('Foreign Key Constraint Handling', () => {
    it('should handle foreign key constraints during cleanup', async () => {
      // Add task and related todo
      mockTaskStore.db.exec(`
        INSERT INTO tasks (id, name, status) VALUES ('task1', 'Test Task', 'pending')
      `);
      mockTaskStore.db.exec(`
        INSERT INTO todos (id, task_id, content) VALUES ('todo1', 'task1', 'Test Todo')
      `);

      // Reset should handle foreign key constraints properly
      await expect(mockTaskStore.reset()).resolves.not.toThrow();

      // All data should be cleared
      const taskCount = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
      const todoCount = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM todos').get();
      expect(taskCount.count).toBe(0);
      expect(todoCount.count).toBe(0);
    });

    it('should clear child records before parent records', async () => {
      // Add parent and child records
      mockTaskStore.db.exec(`
        INSERT INTO tasks (id, name, status) VALUES ('task1', 'Test Task', 'pending')
      `);
      mockTaskStore.db.exec(`
        INSERT INTO todos (id, task_id, content) VALUES ('todo1', 'task1', 'Test Todo')
      `);

      // Track the order of deletions
      const deletionOrder: string[] = [];
      const originalExec = mockTaskStore.db.exec;
      mockTaskStore.db.exec = vi.fn((sql: string) => {
        if (sql.includes('DELETE FROM todos')) {
          deletionOrder.push('todos');
        } else if (sql.includes('DELETE FROM tasks')) {
          deletionOrder.push('tasks');
        }
        return originalExec.call(mockTaskStore.db, sql);
      });

      await mockTaskStore.reset();

      // Should delete child records (todos) before parent records (tasks)
      expect(deletionOrder).toEqual(['todos', 'tasks']);
    });
  });

  describe('Database Cleanup Utility Functions', () => {
    it('should provide createDatabaseCleanup utility', async () => {
      const cleanupFn = createDatabaseCleanup(mockTaskStore);

      // Add test data
      mockTaskStore.db.exec(`
        INSERT INTO tasks (id, name, status) VALUES ('task1', 'Test Task', 'pending')
      `);

      // Execute cleanup
      await cleanupFn();

      // Data should be cleared
      const taskCount = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
      expect(taskCount.count).toBe(0);
    });

    it('should provide createTransactionalTest utility', async () => {
      const testFn = createTransactionalTest(mockTaskStore, async () => {
        // Add data within test
        mockTaskStore.db.exec(`
          INSERT INTO tasks (id, name, status) VALUES ('task1', 'Test Task', 'pending')
        `);

        // Verify data exists
        const taskCount = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
        expect(taskCount.count).toBe(1);

        // This data should be automatically rolled back
      });

      await testFn();

      // Data should be rolled back after test
      const taskCount = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
      expect(taskCount.count).toBe(0);
    });

    it('should provide createIsolatedDbTest for complete test isolation', async () => {
      const testResult = await createIsolatedDbTest(async (isolatedStore) => {
        // Each test gets a fresh database
        isolatedStore.db.exec(`
          INSERT INTO tasks (id, name, status) VALUES ('task1', 'Isolated Task', 'pending')
        `);

        const taskCount = isolatedStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
        expect(taskCount.count).toBe(1);

        return 'test-result';
      });

      expect(testResult).toBe('test-result');

      // Original store should be unaffected
      const taskCount = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
      expect(taskCount.count).toBe(0);
    });
  });

  describe('Performance Considerations', () => {
    it('should provide fast cleanup for large datasets', async () => {
      const startTime = Date.now();

      // Add a large number of records
      const insertStmt = mockTaskStore.db.prepare(`
        INSERT INTO tasks (id, name, status) VALUES (?, ?, ?)
      `);

      for (let i = 0; i < 1000; i++) {
        insertStmt.run(`task${i}`, `Test Task ${i}`, 'pending');
      }
      insertStmt.finalize();

      // Reset should be fast even with large datasets
      const resetStartTime = Date.now();
      await mockTaskStore.reset();
      const resetEndTime = Date.now();

      const resetDuration = resetEndTime - resetStartTime;
      expect(resetDuration).toBeLessThan(1000); // Should take less than 1 second

      // Verify all data is cleared
      const taskCount = mockTaskStore.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
      expect(taskCount.count).toBe(0);
    });

    it('should minimize database I/O during cleanup', async () => {
      let ioOperations = 0;

      // Mock the database exec to count operations
      const originalExec = mockTaskStore.db.exec;
      mockTaskStore.db.exec = vi.fn((sql: string) => {
        ioOperations++;
        return originalExec.call(mockTaskStore.db, sql);
      });

      // Add some test data
      for (let i = 0; i < 10; i++) {
        mockTaskStore.db.exec(`
          INSERT INTO tasks (id, name, status) VALUES ('task${i}', 'Test Task ${i}', 'pending')
        `);
      }

      // Reset I/O counter
      ioOperations = 0;

      await mockTaskStore.reset();

      // Should use minimal I/O operations (bulk delete, not row-by-row)
      expect(ioOperations).toBeLessThan(5); // Should be much less than number of records
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during cleanup gracefully', async () => {
      // Simulate database error
      const originalExec = mockTaskStore.db.exec;
      mockTaskStore.db.exec = vi.fn(() => {
        throw new Error('Database error');
      });

      // Cleanup should handle errors gracefully
      await expect(mockTaskStore.reset()).resolves.not.toThrow();

      // Restore original method
      mockTaskStore.db.exec = originalExec;
    });

    it('should handle locked database scenarios', async () => {
      // Simulate database lock
      const transaction = mockTaskStore.beginTransaction();

      // Try to reset while in transaction - should handle gracefully
      await expect(mockTaskStore.reset()).resolves.not.toThrow();

      transaction.rollback();
    });

    it('should handle missing tables during cleanup', async () => {
      // Drop a table to simulate missing schema
      mockTaskStore.db.exec('DROP TABLE IF EXISTS todos');

      // Cleanup should not fail even if some tables don't exist
      await expect(mockTaskStore.clearAllTodos()).resolves.not.toThrow();
    });
  });
});

// ============================================================================
// Utility Functions for Database Cleanup
// ============================================================================

/**
 * Creates a cleanup function that resets a TaskStore database
 */
function createDatabaseCleanup(taskStore: MockTaskStore): () => Promise<void> {
  return async () => {
    await taskStore.reset();
  };
}

/**
 * Creates a test function that runs within a transaction and rolls back automatically
 */
function createTransactionalTest(
  taskStore: MockTaskStore,
  testFn: () => Promise<void>
): () => Promise<void> {
  return async () => {
    const transaction = taskStore.beginTransaction();
    try {
      await testFn();
    } finally {
      transaction.rollback();
    }
  };
}

/**
 * Creates an isolated database test with its own TaskStore instance
 */
async function createIsolatedDbTest<T>(
  testFn: (isolatedStore: MockTaskStore) => Promise<T>
): Promise<T> {
  const tempPath = path.join(process.cwd(), `.isolated-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const isolatedStore = createMockTaskStore(tempPath);

  try {
    return await testFn(isolatedStore);
  } finally {
    await isolatedStore.close();
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Creates a mock TaskStore for testing database cleanup patterns
 */
function createMockTaskStore(dbPath: string): MockTaskStore {
  let isClosed = false;
  let inTransaction = false;

  const mockDb: MockDatabase = {
    exec: vi.fn((sql: string) => {
      if (isClosed) throw new Error('Database is closed');

      // Simulate schema creation and data operations
      if (sql.includes('CREATE TABLE')) {
        // Table creation - do nothing for mock
        return;
      }
      if (sql.includes('DELETE FROM')) {
        // Delete operations - track for testing
        return;
      }
      if (sql.includes('INSERT INTO')) {
        // Insert operations - track for testing
        return;
      }
    }),

    prepare: vi.fn((sql: string) => {
      if (isClosed) throw new Error('Database is closed');

      const mockStmt: MockStatement = {
        run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
        get: vi.fn(() => {
          if (sql.includes('COUNT(*)')) {
            return { count: 0 }; // Default to empty for cleanup tests
          }
          return {};
        }),
        all: vi.fn(() => {
          if (sql.includes('sqlite_master')) {
            return [{ name: 'tasks' }, { name: 'todos' }]; // Mock table list
          }
          return [];
        }),
        finalize: vi.fn()
      };
      return mockStmt;
    }),

    close: vi.fn(() => {
      isClosed = true;
    }),

    get inTransaction() {
      return inTransaction;
    }
  };

  const mockStore: MockTaskStore = {
    db: mockDb,

    close: vi.fn(async () => {
      mockDb.close();
    }),

    reset: vi.fn(async () => {
      if (isClosed) return;

      // Simulate clearing all tables in correct order
      mockDb.exec('DELETE FROM todos');
      mockDb.exec('DELETE FROM tasks');
    }),

    clearAllTasks: vi.fn(async () => {
      if (isClosed) return;
      mockDb.exec('DELETE FROM tasks');
    }),

    clearAllTodos: vi.fn(async () => {
      if (isClosed) return;
      mockDb.exec('DELETE FROM todos');
    }),

    beginTransaction: vi.fn(() => {
      inTransaction = true;

      const mockTransaction: MockTransaction = {
        commit: vi.fn(() => {
          inTransaction = false;
        }),
        rollback: vi.fn(() => {
          inTransaction = false;
        }),
        savepoint: vi.fn((name: string) => {
          // Mock savepoint creation
        }),
        release: vi.fn((name: string) => {
          // Mock savepoint release
        })
      };

      return mockTransaction;
    })
  };

  // Initialize mock database schema
  mockDb.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL
    )
  `);

  mockDb.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      content TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  return mockStore;
}