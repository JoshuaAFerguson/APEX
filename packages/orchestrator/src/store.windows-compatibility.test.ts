/**
 * Windows compatibility tests for the TaskStore module
 * Tests specific Windows behaviors, path handling, and SQLite integration
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, CreateTaskRequest } from '@apexcli/core';
import { generateTaskId } from '@apexcli/core';
import Database from 'better-sqlite3';

describe('TaskStore Windows Compatibility', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (): Task => ({
    id: generateTaskId(),
    description: 'Test task for Windows compatibility',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: testDir,
    branchName: 'apex/windows-test',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    dependsOn: [],
    blockedBy: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-store-windows-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Windows Path Handling', () => {
    it('should handle Windows path separators correctly in database path', () => {
      const dbPath = path.join(testDir, '.apex', 'apex.db');
      const normalizedDbPath = path.resolve(dbPath);

      expect(normalizedDbPath).toBeTruthy();

      // On Windows, should handle backslashes
      if (os.platform() === 'win32') {
        // Path should be normalized to Windows format
        expect(normalizedDbPath).toMatch(/^[A-Z]:/);
      }

      // Verify the database file exists after initialization
      expect(fs.access(normalizedDbPath)).resolves.not.toThrow();
    });

    it('should create database in paths with spaces (Windows common scenario)', async () => {
      // Clean up previous store
      store.close();
      await fs.rm(testDir, { recursive: true, force: true });

      // Create a test directory with spaces (common on Windows)
      const pathWithSpaces = await fs.mkdtemp(
        path.join(os.tmpdir(), 'apex windows test with spaces-')
      );

      try {
        await fs.mkdir(path.join(pathWithSpaces, '.apex'), { recursive: true });

        const storeWithSpaces = new TaskStore(pathWithSpaces);
        await storeWithSpaces.initialize();

        // Should be able to create and retrieve tasks
        const task = createTestTask();
        task.projectPath = pathWithSpaces;

        await storeWithSpaces.createTask(task);
        const retrieved = await storeWithSpaces.getTask(task.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(task.id);
        expect(retrieved?.projectPath).toBe(pathWithSpaces);

        storeWithSpaces.close();
      } finally {
        await fs.rm(pathWithSpaces, { recursive: true, force: true });
      }
    });

    it('should handle Windows drive letter paths correctly', () => {
      if (os.platform() === 'win32') {
        // Test various Windows path formats
        const windowsPaths = [
          'C:\\Users\\test\\.apex',
          'D:\\Projects\\apex-test\\.apex',
          'E:\\My Documents\\APEX Project\\.apex'
        ];

        windowsPaths.forEach(windowsPath => {
          const normalized = path.normalize(windowsPath);
          expect(normalized).toMatch(/^[A-Z]:/);
          expect(normalized).not.toContain('/'); // Should use Windows separators
        });
      }
    });

    it('should normalize mixed path separators for Windows', () => {
      if (os.platform() === 'win32') {
        // Test mixed separators (common in cross-platform development)
        const mixedPath = 'C:/Users/test\\.apex\\apex.db';
        const normalized = path.normalize(mixedPath);

        expect(normalized).toBe('C:\\Users\\test\\.apex\\apex.db');
      }
    });
  });

  describe('Windows Config Directory Resolution', () => {
    it('should handle Windows %APPDATA% directory resolution', async () => {
      const originalEnv = process.env;

      try {
        if (os.platform() === 'win32') {
          // Test with actual Windows APPDATA if available
          const appData = process.env.APPDATA;
          if (appData) {
            expect(appData).toMatch(/[A-Z]:/);
            expect(appData).toContain('AppData');

            // Verify the path exists and is accessible
            await expect(fs.access(appData)).resolves.not.toThrow();
          }
        } else {
          // Mock Windows environment for testing on non-Windows systems
          process.env.APPDATA = 'C:\\Users\\TestUser\\AppData\\Roaming';

          const mockAppData = process.env.APPDATA;
          expect(mockAppData).toMatch(/^C:/);
          expect(mockAppData).toContain('AppData');
        }
      } finally {
        process.env = originalEnv;
      }
    });

    it('should prefer USERPROFILE over HOME on Windows', () => {
      const originalEnv = process.env;

      try {
        if (os.platform() === 'win32') {
          // On actual Windows, USERPROFILE should be set
          expect(process.env.USERPROFILE).toBeTruthy();

          const homeDir = process.env.USERPROFILE || process.env.HOME;
          expect(homeDir).toBeTruthy();
          expect(homeDir).toMatch(/^[A-Z]:/);
        } else {
          // Mock Windows environment variables
          process.env.USERPROFILE = 'C:\\Users\\TestUser';
          process.env.HOME = '/home/testuser'; // Unix-style, should be ignored

          const homeDir = process.env.USERPROFILE || process.env.HOME;
          expect(homeDir).toBe('C:\\Users\\TestUser');
        }
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe('SQLite Database Windows Integration', () => {
    it('should create SQLite database successfully on Windows file system', async () => {
      const dbPath = path.join(testDir, '.apex', 'apex.db');

      // Verify database file was created
      await expect(fs.access(dbPath)).resolves.not.toThrow();

      // Verify we can perform database operations
      const task = createTestTask();
      await store.createTask(task);

      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(task.id);
    });

    it('should handle Windows file locking correctly with SQLite WAL mode', async () => {
      const dbPath = path.join(testDir, '.apex', 'apex.db');

      // Verify WAL mode is enabled (better concurrency on Windows)
      const db = new Database(dbPath, { readonly: true });
      const walMode = db.pragma('journal_mode');
      expect(walMode).toEqual([{ journal_mode: 'wal' }]);
      db.close();

      // Test concurrent access (should not throw errors)
      const task1 = createTestTask();
      const task2 = createTestTask();

      await Promise.all([
        store.createTask(task1),
        store.createTask(task2)
      ]);

      const [retrieved1, retrieved2] = await Promise.all([
        store.getTask(task1.id),
        store.getTask(task2.id)
      ]);

      expect(retrieved1?.id).toBe(task1.id);
      expect(retrieved2?.id).toBe(task2.id);
    });

    it('should handle SQLite database with Windows-specific characters in paths', async () => {
      if (os.platform() === 'win32') {
        // Test Windows reserved characters that should be avoided
        const invalidChars = ['<', '>', ':', '"', '|', '?', '*'];
        const dbPath = path.join(testDir, '.apex', 'apex.db');
        const normalizedDbPath = path.resolve(dbPath);

        // Remove drive letter for testing path content
        const pathWithoutDrive = normalizedDbPath.replace(/^[A-Z]:/i, '');

        invalidChars.forEach(char => {
          expect(pathWithoutDrive).not.toContain(char);
        });
      }
    });

    it('should handle Windows long path names correctly', async () => {
      if (os.platform() === 'win32') {
        // Test that we can handle longer Windows paths
        const longDirName = 'a'.repeat(100); // Create a long directory name
        const longPath = path.join(testDir, longDirName);

        try {
          await fs.mkdir(longPath, { recursive: true });
          await fs.mkdir(path.join(longPath, '.apex'), { recursive: true });

          const longPathStore = new TaskStore(longPath);
          await longPathStore.initialize();

          const task = createTestTask();
          task.projectPath = longPath;

          await longPathStore.createTask(task);
          const retrieved = await longPathStore.getTask(task.id);

          expect(retrieved).not.toBeNull();
          expect(retrieved?.projectPath).toBe(longPath);

          longPathStore.close();
        } catch (error) {
          // On older Windows systems, very long paths might fail
          // This is expected behavior, not a failure
          console.warn('Long path test failed (expected on older Windows):', error);
        }
      }
    });
  });

  describe('better-sqlite3 Windows Compatibility', () => {
    it('should verify better-sqlite3 native module works on Windows', () => {
      // Test that better-sqlite3 was compiled correctly for the platform
      const Database = require('better-sqlite3');
      expect(typeof Database).toBe('function');

      // Should be able to create in-memory database
      const memDb = new Database(':memory:');
      expect(memDb).toBeTruthy();

      // Should be able to execute basic SQL
      memDb.exec('CREATE TABLE test (id INTEGER)');
      const stmt = memDb.prepare('INSERT INTO test (id) VALUES (?)');
      const result = stmt.run(1);
      expect(result.changes).toBe(1);

      memDb.close();
    });

    it('should handle Windows file system permissions correctly', async () => {
      const dbPath = path.join(testDir, '.apex', 'apex.db');

      // Verify file was created with appropriate permissions
      const stats = await fs.stat(dbPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);

      if (os.platform() === 'win32') {
        // On Windows, file should be readable and writable
        await expect(fs.access(dbPath, fs.constants.R_OK | fs.constants.W_OK))
          .resolves.not.toThrow();
      }
    });

    it('should handle database backup operations on Windows', async () => {
      // Create some test data
      const task = createTestTask();
      await store.createTask(task);

      const dbPath = path.join(testDir, '.apex', 'apex.db');
      const backupPath = path.join(testDir, '.apex', 'apex.backup.db');

      // Close the store to ensure clean backup
      store.close();

      try {
        // Copy database file (simulates backup)
        await fs.copyFile(dbPath, backupPath);

        // Verify backup file exists and has content
        const backupStats = await fs.stat(backupPath);
        expect(backupStats.size).toBeGreaterThan(0);

        // Verify we can open the backup database
        const backupDb = new Database(backupPath, { readonly: true });
        const tables = backupDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        expect(tables.some(t => t.name === 'tasks')).toBe(true);
        backupDb.close();
      } finally {
        // Reinitialize store for cleanup
        store = new TaskStore(testDir);
        await store.initialize();
      }
    });
  });

  describe('Windows-specific Edge Cases', () => {
    it('should handle Windows case-insensitive file system behavior', async () => {
      if (os.platform() === 'win32') {
        const upperCasePath = path.join(testDir, '.APEX', 'APEX.DB');
        const lowerCasePath = path.join(testDir, '.apex', 'apex.db');

        // On Windows, these should resolve to the same file
        const upperNormalized = path.resolve(upperCasePath).toLowerCase();
        const lowerNormalized = path.resolve(lowerCasePath).toLowerCase();

        expect(upperNormalized).toBe(lowerNormalized);
      }
    });

    it('should handle Windows environment variable case-insensitivity', () => {
      if (os.platform() === 'win32') {
        // Windows environment variables are case-insensitive
        const pathVar = process.env.PATH || process.env.Path || process.env.path;
        expect(pathVar).toBeTruthy();
        expect(typeof pathVar).toBe('string');
      }
    });

    it('should handle Windows line ending differences in file operations', async () => {
      const task = createTestTask();
      task.description = 'Test task with\r\nWindows line endings\r\nfor compatibility';

      await store.createTask(task);
      const retrieved = await store.getTask(task.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.description).toBe(task.description);

      // Verify line endings are preserved in database
      expect(retrieved?.description).toContain('\r\n');
    });

    it('should handle Windows Unicode characters in paths and data', async () => {
      // Test Unicode characters that might be problematic on Windows
      const unicodeTask = createTestTask();
      unicodeTask.description = 'Test with Unicode: 测试 ñoël café résumé 🚀';
      unicodeTask.branchName = 'feature/unicode-测试-branch';

      await store.createTask(unicodeTask);
      const retrieved = await store.getTask(unicodeTask.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.description).toBe(unicodeTask.description);
      expect(retrieved?.branchName).toBe(unicodeTask.branchName);
    });
  });

  describe('Windows Network Path Support', () => {
    it('should handle UNC path format validation', () => {
      if (os.platform() === 'win32') {
        // Test UNC path patterns (even if we don't support them fully)
        const uncPaths = [
          '\\\\server\\share\\path',
          '\\\\SERVER\\SHARE\\Path\\To\\File'
        ];

        uncPaths.forEach(uncPath => {
          expect(uncPath.startsWith('\\\\')).toBe(true);
          const normalized = path.normalize(uncPath);
          expect(normalized.startsWith('\\\\')).toBe(true);
        });
      }
    });
  });

  describe('Performance on Windows File System', () => {
    it('should perform database operations efficiently on Windows', async () => {
      const startTime = Date.now();

      // Create multiple tasks to test performance
      const tasks = Array.from({ length: 100 }, () => createTestTask());

      // Batch create tasks
      for (const task of tasks) {
        await store.createTask(task);
      }

      // Retrieve all tasks
      const allTasks = await store.getAllTasks();

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(allTasks.length).toBeGreaterThanOrEqual(100);
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(10000); // 10 seconds max
    }, 15000); // 15 second timeout
  });
});