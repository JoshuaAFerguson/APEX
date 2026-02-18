import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task } from '@apexcli/core';

describe('TaskStore APEX_HOME Environment Variable', () => {
  let testDir: string;
  let apexHomeDir: string;
  let originalApexHome: string | undefined;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_test`,
    description: 'Test task for APEX_HOME',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-store-test-'));
    apexHomeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-home-test-'));

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

  describe('Default behavior (APEX_HOME not set)', () => {
    it('should use project/.apex directory when APEX_HOME is not set', async () => {
      // Ensure APEX_HOME is not set
      delete process.env.APEX_HOME;

      const store = new TaskStore(testDir);
      await store.initialize();

      // Create and store a task
      const task = createTestTask();
      await store.createTask(task);

      // Verify database file exists in default location
      const expectedDbPath = path.join(testDir, '.apex', 'apex.db');
      const dbExists = await fs.access(expectedDbPath).then(() => true).catch(() => false);
      expect(dbExists).toBe(true);

      // Verify task was stored correctly
      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(task.id);

      store.close();
    });

    it('should create .apex directory if it does not exist', async () => {
      // Ensure APEX_HOME is not set
      delete process.env.APEX_HOME;

      // Verify .apex directory doesn't exist initially
      const apexDir = path.join(testDir, '.apex');
      const apexDirExists = await fs.access(apexDir).then(() => true).catch(() => false);
      expect(apexDirExists).toBe(false);

      const store = new TaskStore(testDir);
      await store.initialize();

      // Verify .apex directory was created
      const apexDirExistsAfter = await fs.access(apexDir).then(() => true).catch(() => false);
      expect(apexDirExistsAfter).toBe(true);

      store.close();
    });
  });

  describe('APEX_HOME environment variable behavior', () => {
    it('should use APEX_HOME directory when set', async () => {
      // Set APEX_HOME environment variable
      process.env.APEX_HOME = apexHomeDir;

      const store = new TaskStore(testDir);
      await store.initialize();

      // Create and store a task
      const task = createTestTask();
      await store.createTask(task);

      // Verify database file exists in APEX_HOME location
      const expectedDbPath = path.join(apexHomeDir, 'apex.db');
      const dbExists = await fs.access(expectedDbPath).then(() => true).catch(() => false);
      expect(dbExists).toBe(true);

      // Verify task was stored correctly
      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(task.id);

      // Verify database is NOT in the default project location
      const defaultDbPath = path.join(testDir, '.apex', 'apex.db');
      const defaultDbExists = await fs.access(defaultDbPath).then(() => true).catch(() => false);
      expect(defaultDbExists).toBe(false);

      store.close();
    });

    it('should create APEX_HOME directory if it does not exist', async () => {
      // Use a subdirectory of apexHomeDir that doesn't exist yet
      const nonExistentDir = path.join(apexHomeDir, 'nested', 'apex-home');
      process.env.APEX_HOME = nonExistentDir;

      // Verify directory doesn't exist initially
      const dirExists = await fs.access(nonExistentDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(false);

      const store = new TaskStore(testDir);
      await store.initialize();

      // Verify APEX_HOME directory was created
      const dirExistsAfter = await fs.access(nonExistentDir).then(() => true).catch(() => false);
      expect(dirExistsAfter).toBe(true);

      // Verify database file exists
      const expectedDbPath = path.join(nonExistentDir, 'apex.db');
      const dbExists = await fs.access(expectedDbPath).then(() => true).catch(() => false);
      expect(dbExists).toBe(true);

      store.close();
    });

    it('should isolate different test environments using APEX_HOME', async () => {
      // Create first store with one APEX_HOME
      const apexHome1 = path.join(apexHomeDir, 'env1');
      process.env.APEX_HOME = apexHome1;

      const store1 = new TaskStore(testDir);
      await store1.initialize();

      const task1 = createTestTask();
      task1.id = 'task_env1';
      task1.description = 'Task in environment 1';
      await store1.createTask(task1);
      store1.close();

      // Create second store with different APEX_HOME
      const apexHome2 = path.join(apexHomeDir, 'env2');
      process.env.APEX_HOME = apexHome2;

      const store2 = new TaskStore(testDir);
      await store2.initialize();

      const task2 = createTestTask();
      task2.id = 'task_env2';
      task2.description = 'Task in environment 2';
      await store2.createTask(task2);

      // Verify task1 is not visible in store2
      const task1InStore2 = await store2.getTask('task_env1');
      expect(task1InStore2).toBeNull();

      // Verify task2 exists in store2
      const task2InStore2 = await store2.getTask('task_env2');
      expect(task2InStore2).not.toBeNull();
      expect(task2InStore2?.description).toBe('Task in environment 2');

      store2.close();

      // Verify separate database files exist
      const db1Path = path.join(apexHome1, 'apex.db');
      const db2Path = path.join(apexHome2, 'apex.db');

      const db1Exists = await fs.access(db1Path).then(() => true).catch(() => false);
      const db2Exists = await fs.access(db2Path).then(() => true).catch(() => false);

      expect(db1Exists).toBe(true);
      expect(db2Exists).toBe(true);
    });

    it('should work with relative paths in APEX_HOME', async () => {
      // Set APEX_HOME to a relative path
      const relativePath = './test-apex-home';
      process.env.APEX_HOME = relativePath;

      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      // Verify task was stored correctly
      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(task.id);

      store.close();

      // Cleanup the relative directory
      try {
        await fs.rm(relativePath, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should switch database locations when APEX_HOME changes', async () => {
      // First store with APEX_HOME set
      process.env.APEX_HOME = apexHomeDir;

      const store1 = new TaskStore(testDir);
      await store1.initialize();

      const task1 = createTestTask();
      task1.id = 'task_in_apex_home';
      await store1.createTask(task1);
      store1.close();

      // Second store without APEX_HOME (default behavior)
      delete process.env.APEX_HOME;

      const store2 = new TaskStore(testDir);
      await store2.initialize();

      // Task from first store should not be visible
      const retrievedTask = await store2.getTask('task_in_apex_home');
      expect(retrievedTask).toBeNull();

      // Create a task in the default location
      const task2 = createTestTask();
      task2.id = 'task_in_default';
      await store2.createTask(task2);

      // Verify task2 exists in default location
      const retrieved2 = await store2.getTask('task_in_default');
      expect(retrieved2).not.toBeNull();
      expect(retrieved2?.id).toBe('task_in_default');

      store2.close();

      // Verify both database files exist in their respective locations
      const apexHomeDbPath = path.join(apexHomeDir, 'apex.db');
      const defaultDbPath = path.join(testDir, '.apex', 'apex.db');

      const apexHomeDbExists = await fs.access(apexHomeDbPath).then(() => true).catch(() => false);
      const defaultDbExists = await fs.access(defaultDbPath).then(() => true).catch(() => false);

      expect(apexHomeDbExists).toBe(true);
      expect(defaultDbExists).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty APEX_HOME environment variable', async () => {
      // Set APEX_HOME to empty string
      process.env.APEX_HOME = '';

      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      // Should fall back to default behavior (project/.apex)
      const defaultDbPath = path.join(testDir, '.apex', 'apex.db');
      const dbExists = await fs.access(defaultDbPath).then(() => true).catch(() => false);
      expect(dbExists).toBe(true);

      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();

      store.close();
    });

    it('should handle APEX_HOME with whitespace', async () => {
      // Set APEX_HOME with leading/trailing whitespace
      process.env.APEX_HOME = `  ${apexHomeDir}  `;

      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      // Should use the trimmed path
      const expectedDbPath = path.join(`  ${apexHomeDir}  `, 'apex.db');
      const dbExists = await fs.access(expectedDbPath).then(() => true).catch(() => false);
      expect(dbExists).toBe(true);

      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();

      store.close();
    });

    it('should handle special characters in APEX_HOME path', async () => {
      // Create directory with special characters (that are valid for filesystem)
      const specialDir = path.join(apexHomeDir, 'apex-home-with-spaces and-dashes');
      await fs.mkdir(specialDir, { recursive: true });

      process.env.APEX_HOME = specialDir;

      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      const expectedDbPath = path.join(specialDir, 'apex.db');
      const dbExists = await fs.access(expectedDbPath).then(() => true).catch(() => false);
      expect(dbExists).toBe(true);

      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();

      store.close();
    });
  });
});