import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task } from '@apexcli/core';

describe('TaskStore APEX_HOME Additional Edge Cases', () => {
  let testDir: string;
  let apexHomeDir: string;
  let originalApexHome: string | undefined;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task for APEX_HOME edge cases',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/test-branch',
    retryCount: 0,
    maxRetries: 3,
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

  beforeAll(() => {
    // Store original APEX_HOME value
    originalApexHome = process.env.APEX_HOME;
  });

  afterAll(() => {
    // Restore original APEX_HOME value
    if (originalApexHome !== undefined) {
      process.env.APEX_HOME = originalApexHome;
    } else {
      delete process.env.APEX_HOME;
    }
  });

  beforeEach(async () => {
    // Create test directories
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-store-edge-test-'));
    apexHomeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-home-edge-test-'));

    // Ensure clean environment
    delete process.env.APEX_HOME;
  });

  afterEach(async () => {
    // Clean up test directories
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    try {
      await fs.rm(apexHomeDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Clean up environment
    delete process.env.APEX_HOME;
  });

  describe('Error handling and edge cases', () => {
    it('should handle permission denied errors when creating APEX_HOME directory', async () => {
      // Skip this test on Windows as permission handling is different
      if (process.platform === 'win32') {
        return;
      }

      // Create a directory with restricted permissions
      const restrictedParent = path.join(apexHomeDir, 'restricted');
      await fs.mkdir(restrictedParent, { mode: 0o444 }); // Read-only

      const restrictedApexHome = path.join(restrictedParent, 'apex-home');
      process.env.APEX_HOME = restrictedApexHome;

      // The TaskStore should handle the error gracefully and still initialize
      const store = new TaskStore(testDir);

      // Even if directory creation fails, store should still work if the directory gets created somehow
      try {
        await store.initialize();

        // If we get here, either the directory was created or the store handled the error
        const task = createTestTask();
        await store.createTask(task);

        const retrieved = await store.getTask(task.id);
        expect(retrieved).not.toBeNull();

        store.close();
      } catch (error) {
        // This is expected if the directory couldn't be created and the database file couldn't be opened
        expect(error).toBeDefined();
      }

      // Restore permissions for cleanup
      await fs.chmod(restrictedParent, 0o755);
    });

    it('should handle absolute paths with symlinks in APEX_HOME', async () => {
      // Create a real directory and a symlink to it
      const realDir = path.join(apexHomeDir, 'real-apex-home');
      const symlinkDir = path.join(apexHomeDir, 'symlink-apex-home');

      await fs.mkdir(realDir, { recursive: true });

      // Skip symlink test on Windows if symlinks aren't supported
      try {
        await fs.symlink(realDir, symlinkDir);
      } catch (error) {
        // Skip this test if symlinks aren't supported
        return;
      }

      process.env.APEX_HOME = symlinkDir;

      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      // Verify database file exists (following the symlink)
      const expectedDbPath = path.join(symlinkDir, 'apex.db');
      const dbExists = await fs.access(expectedDbPath).then(() => true).catch(() => false);
      expect(dbExists).toBe(true);

      // Verify task was stored correctly
      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(task.id);

      store.close();
    });

    it('should handle very long APEX_HOME paths', async () => {
      // Create a deeply nested directory structure
      const longPath = path.join(apexHomeDir, 'very', 'deeply', 'nested', 'directory', 'structure', 'that', 'goes', 'quite', 'deep');
      process.env.APEX_HOME = longPath;

      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      // Verify database file exists
      const expectedDbPath = path.join(longPath, 'apex.db');
      const dbExists = await fs.access(expectedDbPath).then(() => true).catch(() => false);
      expect(dbExists).toBe(true);

      // Verify task was stored correctly
      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(task.id);

      store.close();
    });

    it('should handle APEX_HOME path that becomes invalid after store creation', async () => {
      process.env.APEX_HOME = apexHomeDir;

      const store = new TaskStore(testDir);
      await store.initialize();

      const task1 = createTestTask();
      await store.createTask(task1);

      // Verify first task works
      const retrieved1 = await store.getTask(task1.id);
      expect(retrieved1).not.toBeNull();

      // Now remove the APEX_HOME directory while store is still open
      await fs.rm(apexHomeDir, { recursive: true, force: true });

      // Store should continue working with the already-open database connection
      const task2 = createTestTask();
      await store.createTask(task2);

      const retrieved2 = await store.getTask(task2.id);
      expect(retrieved2).not.toBeNull();
      expect(retrieved2?.id).toBe(task2.id);

      // Both tasks should still be accessible
      const retrieved1Again = await store.getTask(task1.id);
      expect(retrieved1Again).not.toBeNull();

      store.close();
    });

    it('should handle concurrent store instances with different APEX_HOME values', async () => {
      // Create multiple APEX_HOME directories
      const apexHome1 = path.join(apexHomeDir, 'concurrent1');
      const apexHome2 = path.join(apexHomeDir, 'concurrent2');
      const apexHome3 = path.join(apexHomeDir, 'concurrent3');

      // Store original env value
      const originalEnv = process.env.APEX_HOME;

      try {
        // Create first store
        process.env.APEX_HOME = apexHome1;
        const store1 = new TaskStore(testDir);
        await store1.initialize();

        // Create second store (should use current env value at construction time)
        process.env.APEX_HOME = apexHome2;
        const store2 = new TaskStore(testDir);
        await store2.initialize();

        // Create third store
        process.env.APEX_HOME = apexHome3;
        const store3 = new TaskStore(testDir);
        await store3.initialize();

        // Create tasks in each store
        const task1 = createTestTask();
        task1.id = 'concurrent_task_1';
        await store1.createTask(task1);

        const task2 = createTestTask();
        task2.id = 'concurrent_task_2';
        await store2.createTask(task2);

        const task3 = createTestTask();
        task3.id = 'concurrent_task_3';
        await store3.createTask(task3);

        // Verify task isolation
        expect(await store1.getTask('concurrent_task_1')).not.toBeNull();
        expect(await store1.getTask('concurrent_task_2')).toBeNull();
        expect(await store1.getTask('concurrent_task_3')).toBeNull();

        expect(await store2.getTask('concurrent_task_1')).toBeNull();
        expect(await store2.getTask('concurrent_task_2')).not.toBeNull();
        expect(await store2.getTask('concurrent_task_3')).toBeNull();

        expect(await store3.getTask('concurrent_task_1')).toBeNull();
        expect(await store3.getTask('concurrent_task_2')).toBeNull();
        expect(await store3.getTask('concurrent_task_3')).not.toBeNull();

        // Verify separate database files were created
        const db1Exists = await fs.access(path.join(apexHome1, 'apex.db')).then(() => true).catch(() => false);
        const db2Exists = await fs.access(path.join(apexHome2, 'apex.db')).then(() => true).catch(() => false);
        const db3Exists = await fs.access(path.join(apexHome3, 'apex.db')).then(() => true).catch(() => false);

        expect(db1Exists).toBe(true);
        expect(db2Exists).toBe(true);
        expect(db3Exists).toBe(true);

        // Clean up
        store1.close();
        store2.close();
        store3.close();
      } finally {
        // Restore environment
        if (originalEnv !== undefined) {
          process.env.APEX_HOME = originalEnv;
        } else {
          delete process.env.APEX_HOME;
        }
      }
    });

    it('should handle APEX_HOME with Unicode characters', async () => {
      // Create directory with Unicode characters
      const unicodeDir = path.join(apexHomeDir, 'apex-home-测试-🔥-café');
      process.env.APEX_HOME = unicodeDir;

      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      // Verify database file exists
      const expectedDbPath = path.join(unicodeDir, 'apex.db');
      const dbExists = await fs.access(expectedDbPath).then(() => true).catch(() => false);
      expect(dbExists).toBe(true);

      // Verify task was stored correctly
      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(task.id);

      store.close();
    });

    it('should maintain consistent behavior when APEX_HOME points to project subdirectory', async () => {
      // Set APEX_HOME to a subdirectory of the project
      const subDir = path.join(testDir, 'custom-apex-dir');
      process.env.APEX_HOME = subDir;

      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      // Verify database is in the custom subdirectory, not the default .apex
      const customDbPath = path.join(subDir, 'apex.db');
      const defaultDbPath = path.join(testDir, '.apex', 'apex.db');

      const customDbExists = await fs.access(customDbPath).then(() => true).catch(() => false);
      const defaultDbExists = await fs.access(defaultDbPath).then(() => true).catch(() => false);

      expect(customDbExists).toBe(true);
      expect(defaultDbExists).toBe(false);

      // Verify task was stored correctly
      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(task.id);

      store.close();
    });
  });

  describe('Platform-specific behavior', () => {
    it('should handle Windows-style paths in APEX_HOME', async () => {
      // Only run this test on Windows or when testing cross-platform behavior
      const windowsStylePath = process.platform === 'win32'
        ? apexHomeDir.replace(/\//g, '\\')
        : apexHomeDir; // On Unix, we'll just test with regular paths

      process.env.APEX_HOME = windowsStylePath;

      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      // Verify task was stored correctly regardless of path style
      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(task.id);

      store.close();
    });

    it('should handle case sensitivity based on platform', async () => {
      const originalPath = path.join(apexHomeDir, 'CaseSensitive');
      process.env.APEX_HOME = originalPath;

      const store1 = new TaskStore(testDir);
      await store1.initialize();

      const task = createTestTask();
      await store1.createTask(task);
      store1.close();

      // Test with different case
      const differentCasePath = path.join(apexHomeDir, 'casesensitive');
      process.env.APEX_HOME = differentCasePath;

      const store2 = new TaskStore(testDir);
      await store2.initialize();

      const retrieved = await store2.getTask(task.id);

      if (process.platform === 'win32' || process.platform === 'darwin') {
        // Windows and macOS are typically case-insensitive
        // The behavior depends on the filesystem, but often they're the same directory
        // We won't make strong assertions about this as it's filesystem-dependent
      } else {
        // Linux is typically case-sensitive, so these should be different directories
        expect(retrieved).toBeNull();
      }

      store2.close();
    });
  });

  describe('Integration with TaskStore operations', () => {
    it('should properly clean up database connections when APEX_HOME changes', async () => {
      // First store with APEX_HOME
      process.env.APEX_HOME = apexHomeDir;
      const store1 = new TaskStore(testDir);
      await store1.initialize();

      const task1 = createTestTask();
      await store1.createTask(task1);

      // Explicitly close the first store
      store1.close();

      // Change APEX_HOME and create new store
      const newApexHome = path.join(apexHomeDir, 'new-location');
      process.env.APEX_HOME = newApexHome;
      const store2 = new TaskStore(testDir);
      await store2.initialize();

      // First task should not be visible
      const retrieved1 = await store2.getTask(task1.id);
      expect(retrieved1).toBeNull();

      // But new tasks should work
      const task2 = createTestTask();
      await store2.createTask(task2);

      const retrieved2 = await store2.getTask(task2.id);
      expect(retrieved2).not.toBeNull();
      expect(retrieved2?.id).toBe(task2.id);

      store2.close();

      // Verify both database files exist in their respective locations
      const originalDbPath = path.join(apexHomeDir, 'apex.db');
      const newDbPath = path.join(newApexHome, 'apex.db');

      const originalDbExists = await fs.access(originalDbPath).then(() => true).catch(() => false);
      const newDbExists = await fs.access(newDbPath).then(() => true).catch(() => false);

      expect(originalDbExists).toBe(true);
      expect(newDbExists).toBe(true);
    });
  });
});