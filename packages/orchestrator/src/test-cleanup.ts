/**
 * @fileoverview Test Cleanup Utilities
 *
 * Provides utilities for cleaning up and resetting state between tests to ensure
 * proper test isolation. Includes database cleanup for SQLite TaskStore and
 * in-memory state reset functions with beforeEach/afterEach hook support.
 */

import Database = require('better-sqlite3');
import * as fs from 'fs';
import * as path from 'path';
import { TaskStore } from './store.js';

/**
 * Configuration options for test cleanup utilities
 */
export interface CleanupConfig {
  /** Whether to use in-memory database for tests */
  useInMemoryDb?: boolean;
  /** Custom database path for tests */
  testDbPath?: string;
  /** Whether to preserve test database files after cleanup */
  preserveDbFiles?: boolean;
  /** Whether to reset environment variables */
  resetEnvVars?: boolean;
}

/**
 * Default cleanup configuration
 */
const DEFAULT_CONFIG: CleanupConfig = {
  useInMemoryDb: true,
  preserveDbFiles: false,
  resetEnvVars: true,
};

/**
 * Test cleanup utilities for TaskStore and related database operations
 */
export class TestCleanup {
  private static instance: TestCleanup | null = null;
  private originalEnvVars: Record<string, string | undefined> = {};
  private testDbPaths: Set<string> = new Set();
  private config: CleanupConfig;

  constructor(config: Partial<CleanupConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get singleton instance of TestCleanup
   */
  static getInstance(config?: Partial<CleanupConfig>): TestCleanup {
    if (!TestCleanup.instance) {
      TestCleanup.instance = new TestCleanup(config);
    }
    return TestCleanup.instance;
  }

  /**
   * Create a clean TaskStore instance for testing
   */
  async createTestTaskStore(projectPath?: string): Promise<TaskStore> {
    const testPath = projectPath || '/tmp/test-project';

    if (this.config.useInMemoryDb) {
      // For in-memory testing, we'll use a temporary directory but force memory DB
      // by setting an environment variable that the existing initialize logic handles
      const store = new TaskStore(testPath);
      await store.initialize();
      return store;
    } else {
      // Use file-based database with cleanup tracking
      const testDbPath = this.config.testDbPath || path.join(testPath, '.apex', 'test.db');
      this.testDbPaths.add(testDbPath);

      // Ensure directory exists
      const dbDir = path.dirname(testDbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const store = new TaskStore(testPath);
      await store.initialize();
      return store;
    }
  }

  /**
   * Clean up TaskStore database state
   */
  async cleanupTaskStore(store: TaskStore): Promise<void> {
    const db = store.getDatabase();

    if (!db) {
      return;
    }

    // Get all table names
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];

    // Drop all data from tables (preserve schema)
    const transaction = db.transaction(() => {
      // Disable foreign key constraints temporarily
      db.pragma('foreign_keys = OFF');

      for (const table of tables) {
        try {
          db.prepare(`DELETE FROM ${table.name}`).run();
        } catch (error) {
          console.warn(`Warning: Could not clean table ${table.name}:`, error);
        }
      }

      // Re-enable foreign key constraints
      db.pragma('foreign_keys = ON');
    });

    transaction();
  }

  /**
   * Reset all in-memory caches and state
   */
  resetInMemoryState(): void {
    // Clear any module-level caches or singletons
    if (TestCleanup.instance && TestCleanup.instance !== this) {
      TestCleanup.instance = null;
    }
  }

  /**
   * Save current environment variables for restoration
   */
  saveEnvironmentState(): void {
    const envVarsToTrack = [
      'APEX_HOME',
      'NODE_ENV',
      'APEX_DB_PATH',
      'APEX_LOG_LEVEL',
    ];

    for (const varName of envVarsToTrack) {
      this.originalEnvVars[varName] = process.env[varName];
    }
  }

  /**
   * Restore original environment variables
   */
  restoreEnvironmentState(): void {
    if (!this.config.resetEnvVars) {
      return;
    }

    for (const [varName, originalValue] of Object.entries(this.originalEnvVars)) {
      if (originalValue === undefined) {
        delete process.env[varName];
      } else {
        process.env[varName] = originalValue;
      }
    }
  }

  /**
   * Clean up test database files
   */
  cleanupDatabaseFiles(): void {
    if (this.config.preserveDbFiles) {
      return;
    }

    for (const dbPath of this.testDbPaths) {
      try {
        if (fs.existsSync(dbPath)) {
          fs.unlinkSync(dbPath);
        }

        // Also clean up WAL and SHM files
        const walPath = `${dbPath}-wal`;
        const shmPath = `${dbPath}-shm`;

        if (fs.existsSync(walPath)) {
          fs.unlinkSync(walPath);
        }

        if (fs.existsSync(shmPath)) {
          fs.unlinkSync(shmPath);
        }
      } catch (error) {
        console.warn(`Warning: Could not remove test database file ${dbPath}:`, error);
      }
    }

    this.testDbPaths.clear();
  }

  /**
   * Complete cleanup - reset all state and clean up files
   */
  async cleanup(): Promise<void> {
    this.resetInMemoryState();
    this.restoreEnvironmentState();
    this.cleanupDatabaseFiles();
  }
}

/**
 * Test hook utilities for common test setup/teardown patterns
 */
export class TestHooks {
  private cleanup: TestCleanup;
  private testStores: TaskStore[] = [];

  constructor(config: Partial<CleanupConfig> = {}) {
    this.cleanup = TestCleanup.getInstance(config);
  }

  /**
   * Setup hook for beforeEach - prepares clean test state
   */
  async beforeEach(): Promise<void> {
    // Save current environment state
    this.cleanup.saveEnvironmentState();

    // Reset any in-memory state
    this.cleanup.resetInMemoryState();
  }

  /**
   * Cleanup hook for afterEach - cleans up test state
   */
  async afterEach(): Promise<void> {
    // Close and cleanup all test stores
    for (const store of this.testStores) {
      try {
        await this.cleanup.cleanupTaskStore(store);
        store.close();
      } catch (error) {
        console.warn('Warning: Error cleaning up test store:', error);
      }
    }
    this.testStores = [];

    // Restore environment and cleanup files
    await this.cleanup.cleanup();
  }

  /**
   * Create a clean TaskStore for the current test
   */
  async createTaskStore(projectPath?: string): Promise<TaskStore> {
    const store = await this.cleanup.createTestTaskStore(projectPath);
    this.testStores.push(store);
    return store;
  }

  /**
   * Reset a TaskStore to clean state (without recreating)
   */
  async resetTaskStore(store: TaskStore): Promise<void> {
    await this.cleanup.cleanupTaskStore(store);
  }
}

/**
 * Create beforeEach and afterEach hooks for test suites
 */
export function createTestHooks(config: Partial<CleanupConfig> = {}) {
  const hooks = new TestHooks(config);

  return {
    /**
     * Call this in beforeEach to setup clean test state
     */
    beforeEach: async () => {
      await hooks.beforeEach();
    },

    /**
     * Call this in afterEach to cleanup test state
     */
    afterEach: async () => {
      await hooks.afterEach();
    },

    /**
     * Create a clean TaskStore for testing
     */
    createTaskStore: async (projectPath?: string) => {
      return await hooks.createTaskStore(projectPath);
    },

    /**
     * Reset a TaskStore to clean state
     */
    resetTaskStore: async (store: TaskStore) => {
      await hooks.resetTaskStore(store);
    },
  };
}

/**
 * Utility functions for database state verification
 */
export class TestAssertions {
  /**
   * Assert that TaskStore database is empty
   */
  static async assertEmptyDatabase(store: TaskStore): Promise<void> {
    const db = store.getDatabase();

    // Check main tables are empty
    const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
    if (taskCount.count !== 0) {
      throw new Error(`Expected empty tasks table, found ${taskCount.count} tasks`);
    }

    const templateCount = db.prepare('SELECT COUNT(*) as count FROM task_templates').get() as { count: number };
    if (templateCount.count !== 0) {
      throw new Error(`Expected empty task_templates table, found ${templateCount.count} templates`);
    }

    const logCount = db.prepare('SELECT COUNT(*) as count FROM task_logs').get() as { count: number };
    if (logCount.count !== 0) {
      throw new Error(`Expected empty task_logs table, found ${logCount.count} logs`);
    }
  }

  /**
   * Assert that specific tables are empty
   */
  static async assertTablesEmpty(store: TaskStore, tableNames: string[]): Promise<void> {
    const db = store.getDatabase();

    for (const tableName of tableNames) {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
      if (count.count !== 0) {
        throw new Error(`Expected empty ${tableName} table, found ${count.count} records`);
      }
    }
  }

  /**
   * Get database table record counts for debugging
   */
  static async getDatabaseStats(store: TaskStore): Promise<Record<string, number>> {
    const db = store.getDatabase();
    const stats: Record<string, number> = {};

    // Get all table names
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];

    for (const table of tables) {
      try {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
        stats[table.name] = count.count;
      } catch (error) {
        stats[table.name] = -1; // Error getting count
      }
    }

    return stats;
  }
}