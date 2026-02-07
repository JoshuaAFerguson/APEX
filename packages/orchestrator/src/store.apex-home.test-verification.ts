/**
 * APEX_HOME Test Verification Script
 *
 * This file provides a comprehensive verification that all APEX_HOME functionality
 * is working correctly and all acceptance criteria are met.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task } from '@apexcli/core';

describe('APEX_HOME Acceptance Criteria Verification', () => {
  let testProjectDir: string;
  let testApexHomeDir: string;
  let originalApexHome: string | undefined;

  const createTestTask = (id: string, description?: string): Task => ({
    id,
    description: description || `Verification task ${id}`,
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testProjectDir,
    branchName: 'apex/verification-test',
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

  beforeAll(async () => {
    // Store original environment
    originalApexHome = process.env.APEX_HOME;

    // Create test directories
    testProjectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-verify-project-'));
    testApexHomeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-verify-home-'));
  });

  afterAll(async () => {
    // Restore environment
    if (originalApexHome !== undefined) {
      process.env.APEX_HOME = originalApexHome;
    } else {
      delete process.env.APEX_HOME;
    }

    // Cleanup directories
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
      await fs.rm(testApexHomeDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    // Clean environment for each test
    delete process.env.APEX_HOME;
  });

  afterEach(() => {
    // Clean environment after each test
    delete process.env.APEX_HOME;
  });

  describe('Acceptance Criteria 1: TaskStore uses APEX_HOME env var to locate apex.db file', () => {
    it('should read and use APEX_HOME environment variable', async () => {
      // Set APEX_HOME to a custom location
      const customApexHome = path.join(testApexHomeDir, 'custom-location');
      process.env.APEX_HOME = customApexHome;

      // Create TaskStore and verify it uses APEX_HOME
      const store = new TaskStore(testProjectDir);
      await store.initialize();

      // Create and store a task
      const task = createTestTask('apex-home-test', 'Test APEX_HOME functionality');
      await store.createTask(task);

      // Verify database was created in APEX_HOME location
      const expectedDbPath = path.join(customApexHome, 'apex.db');
      const dbExists = await fs.access(expectedDbPath).then(() => true).catch(() => false);

      expect(dbExists).toBe(true);

      // Verify task can be retrieved
      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(task.id);
      expect(retrieved?.description).toBe('Test APEX_HOME functionality');

      store.close();
    });

    it('should handle empty APEX_HOME gracefully', async () => {
      // Set APEX_HOME to empty string
      process.env.APEX_HOME = '';

      const store = new TaskStore(testProjectDir);
      await store.initialize();

      const task = createTestTask('empty-apex-home-test');
      await store.createTask(task);

      // Should fall back to default behavior (.apex directory)
      const defaultDbPath = path.join(testProjectDir, '.apex', 'apex.db');
      const dbExists = await fs.access(defaultDbPath).then(() => true).catch(() => false);

      expect(dbExists).toBe(true);

      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();

      store.close();
    });
  });

  describe('Acceptance Criteria 2: Database created in .apex-test/apex.db when APEX_HOME points to test directory', () => {
    it('should create database in .apex-test directory when APEX_HOME is set accordingly', async () => {
      // Set APEX_HOME to a test directory
      const testDir = path.join(testApexHomeDir, '.apex-test');
      process.env.APEX_HOME = testDir;

      const store = new TaskStore(testProjectDir);
      await store.initialize();

      // Create a test task
      const task = createTestTask('test-env-task', 'Task in test environment');
      await store.createTask(task);

      // Verify database is created in .apex-test/apex.db
      const expectedDbPath = path.join(testDir, 'apex.db');
      const dbExists = await fs.access(expectedDbPath).then(() => true).catch(() => false);

      expect(dbExists).toBe(true);

      // Verify task storage works correctly
      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.description).toBe('Task in test environment');

      store.close();

      // Additional verification: check the directory structure
      const apexTestDirExists = await fs.access(testDir).then(() => true).catch(() => false);
      expect(apexTestDirExists).toBe(true);
    });

    it('should auto-create test directory if it does not exist', async () => {
      // Set APEX_HOME to a nested test directory that doesn't exist
      const nestedTestDir = path.join(testApexHomeDir, 'nested', 'test', '.apex-test');
      process.env.APEX_HOME = nestedTestDir;

      // Verify directory doesn't exist initially
      const dirExistsBefore = await fs.access(nestedTestDir).then(() => true).catch(() => false);
      expect(dirExistsBefore).toBe(false);

      const store = new TaskStore(testProjectDir);
      await store.initialize();

      // Verify directory was created
      const dirExistsAfter = await fs.access(nestedTestDir).then(() => true).catch(() => false);
      expect(dirExistsAfter).toBe(true);

      // Verify database creation
      const expectedDbPath = path.join(nestedTestDir, 'apex.db');
      const dbExists = await fs.access(expectedDbPath).then(() => true).catch(() => false);
      expect(dbExists).toBe(true);

      store.close();
    });
  });

  describe('Acceptance Criteria 3: Existing behavior unchanged when APEX_HOME is not set', () => {
    it('should use default .apex directory when APEX_HOME is not set', async () => {
      // Ensure APEX_HOME is not set
      delete process.env.APEX_HOME;

      const store = new TaskStore(testProjectDir);
      await store.initialize();

      // Create a task
      const task = createTestTask('default-behavior-test', 'Testing default behavior');
      await store.createTask(task);

      // Verify database is in the default location (.apex directory)
      const defaultDbPath = path.join(testProjectDir, '.apex', 'apex.db');
      const dbExists = await fs.access(defaultDbPath).then(() => true).catch(() => false);

      expect(dbExists).toBe(true);

      // Verify task storage works correctly
      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.description).toBe('Testing default behavior');

      // Verify no database exists in APEX_HOME locations (since not set)
      const apexHomeDbPath = path.join(testApexHomeDir, 'apex.db');
      const apexHomeDbExists = await fs.access(apexHomeDbPath).then(() => true).catch(() => false);
      expect(apexHomeDbExists).toBe(false);

      store.close();
    });

    it('should auto-create .apex directory in default behavior', async () => {
      // Ensure APEX_HOME is not set
      delete process.env.APEX_HOME;

      // Verify .apex directory doesn't exist initially
      const apexDir = path.join(testProjectDir, '.apex');
      const dirExistsBefore = await fs.access(apexDir).then(() => true).catch(() => false);
      expect(dirExistsBefore).toBe(false);

      const store = new TaskStore(testProjectDir);
      await store.initialize();

      // Verify .apex directory was created
      const dirExistsAfter = await fs.access(apexDir).then(() => true).catch(() => false);
      expect(dirExistsAfter).toBe(true);

      // Verify database works
      const task = createTestTask('auto-create-test');
      await store.createTask(task);

      const retrieved = await store.getTask(task.id);
      expect(retrieved).not.toBeNull();

      store.close();
    });

    it('should maintain complete backward compatibility', async () => {
      // Test that existing behavior is completely unchanged
      delete process.env.APEX_HOME;

      const store1 = new TaskStore(testProjectDir);
      await store1.initialize();

      const task1 = createTestTask('compatibility-test-1', 'First task');
      await store1.createTask(task1);
      store1.close();

      // Create a second store to verify persistence
      const store2 = new TaskStore(testProjectDir);
      await store2.initialize();

      // Verify first task is still accessible
      const retrieved1 = await store2.getTask(task1.id);
      expect(retrieved1).not.toBeNull();
      expect(retrieved1?.description).toBe('First task');

      // Create a second task
      const task2 = createTestTask('compatibility-test-2', 'Second task');
      await store2.createTask(task2);

      // Verify both tasks are accessible
      const retrieved1Again = await store2.getTask(task1.id);
      const retrieved2 = await store2.getTask(task2.id);

      expect(retrieved1Again).not.toBeNull();
      expect(retrieved2).not.toBeNull();
      expect(retrieved1Again?.description).toBe('First task');
      expect(retrieved2?.description).toBe('Second task');

      store2.close();

      // Final verification: database is in the expected default location
      const defaultDbPath = path.join(testProjectDir, '.apex', 'apex.db');
      const dbExists = await fs.access(defaultDbPath).then(() => true).catch(() => false);
      expect(dbExists).toBe(true);
    });
  });

  describe('Complete Environment Isolation Verification', () => {
    it('should provide complete isolation between APEX_HOME and default environments', async () => {
      // Step 1: Create a task in default environment
      delete process.env.APEX_HOME;

      const defaultStore = new TaskStore(testProjectDir);
      await defaultStore.initialize();

      const defaultTask = createTestTask('default-env-task', 'Task in default environment');
      await defaultStore.createTask(defaultTask);
      defaultStore.close();

      // Step 2: Create a task in APEX_HOME environment
      const apexHomeDir = path.join(testApexHomeDir, 'isolated-env');
      process.env.APEX_HOME = apexHomeDir;

      const apexStore = new TaskStore(testProjectDir);
      await apexStore.initialize();

      const apexTask = createTestTask('apex-env-task', 'Task in APEX_HOME environment');
      await apexStore.createTask(apexTask);
      apexStore.close();

      // Step 3: Verify complete isolation
      // Default environment should only see default task
      delete process.env.APEX_HOME;
      const verifyDefaultStore = new TaskStore(testProjectDir);
      await verifyDefaultStore.initialize();

      const defaultTaskRetrieved = await verifyDefaultStore.getTask(defaultTask.id);
      const apexTaskInDefault = await verifyDefaultStore.getTask(apexTask.id);

      expect(defaultTaskRetrieved).not.toBeNull();
      expect(apexTaskInDefault).toBeNull(); // Should not see APEX_HOME task
      verifyDefaultStore.close();

      // APEX_HOME environment should only see APEX_HOME task
      process.env.APEX_HOME = apexHomeDir;
      const verifyApexStore = new TaskStore(testProjectDir);
      await verifyApexStore.initialize();

      const apexTaskRetrieved = await verifyApexStore.getTask(apexTask.id);
      const defaultTaskInApex = await verifyApexStore.getTask(defaultTask.id);

      expect(apexTaskRetrieved).not.toBeNull();
      expect(defaultTaskInApex).toBeNull(); // Should not see default task
      verifyApexStore.close();

      // Step 4: Verify separate database files exist
      const defaultDbPath = path.join(testProjectDir, '.apex', 'apex.db');
      const apexDbPath = path.join(apexHomeDir, 'apex.db');

      const defaultDbExists = await fs.access(defaultDbPath).then(() => true).catch(() => false);
      const apexDbExists = await fs.access(apexDbPath).then(() => true).catch(() => false);

      expect(defaultDbExists).toBe(true);
      expect(apexDbExists).toBe(true);
    });
  });
});