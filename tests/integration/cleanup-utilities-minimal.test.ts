/**
 * Minimal Integration Tests for Cleanup Utilities
 *
 * This test demonstrates the three main acceptance criteria:
 * 1. Multiple tests running in isolation without state leakage
 * 2. Proper cleanup of SQLite database between tests
 * 3. beforeEach/afterEach patterns working correctly with utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestHooks, TestAssertions } from '../../packages/orchestrator/src/test-cleanup';

describe('Cleanup Utilities Integration - Minimal Tests', () => {
  describe('AC1: Test Isolation Without State Leakage', () => {
    const testHooks = createTestHooks();

    beforeEach(async () => {
      await testHooks.beforeEach();
    });

    afterEach(async () => {
      await testHooks.afterEach();
    });

    it('test 1 - creates task data that should not leak to next test', async () => {
      const store = await testHooks.createTaskStore();

      const task = await store.createTask({
        description: 'Test 1 task - should not leak',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'full'
      });

      // Verify task exists
      const tasks = await store.getAllTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].description).toBe('Test 1 task - should not leak');
    });

    it('test 2 - should start with clean state and not see previous test data', async () => {
      const store = await testHooks.createTaskStore();

      // Should start clean - no data from previous test
      await TestAssertions.assertEmptyDatabase(store);

      const task = await store.createTask({
        description: 'Test 2 task - fresh start',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'full'
      });

      // Verify only new task exists
      const tasks = await store.getAllTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].description).toBe('Test 2 task - fresh start');
    });

    it('test 3 - again should start with clean state', async () => {
      const store = await testHooks.createTaskStore();

      // Should again start clean - no data from any previous test
      await TestAssertions.assertEmptyDatabase(store);

      const task = await store.createTask({
        description: 'Test 3 task - completely isolated',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'full'
      });

      // Verify isolation
      const tasks = await store.getAllTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].description).toBe('Test 3 task - completely isolated');
    });
  });

  describe('AC2: SQLite Database Cleanup Between Tests', () => {
    const testHooks = createTestHooks();

    beforeEach(async () => {
      await testHooks.beforeEach();
    });

    afterEach(async () => {
      await testHooks.afterEach();
    });

    it('test 1 - creates complex database state', async () => {
      const store = await testHooks.createTaskStore();

      // Create task
      const task = await store.createTask({
        description: 'Database cleanup test task',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'full'
      });

      // Create template
      await store.createTaskTemplate({
        name: 'Test Template',
        description: 'Template for testing',
        workflow: 'development',
        agent: 'developer'
      });

      // Create log
      await store.createLog({
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        level: 'info',
        message: 'Database cleanup test log'
      });

      // Verify all data exists
      const tasks = await store.getAllTasks();
      const templates = await store.getAllTaskTemplates();
      const logs = await store.getTaskLogs(task.id);

      expect(tasks).toHaveLength(1);
      expect(templates).toHaveLength(1);
      expect(logs).toHaveLength(1);

      // Get database stats for verification
      const stats = await TestAssertions.getDatabaseStats(store);
      expect(stats.tasks).toBe(1);
      expect(stats.task_templates).toBe(1);
      expect(stats.task_logs).toBe(1);
    });

    it('test 2 - should have clean database despite previous test', async () => {
      const store = await testHooks.createTaskStore();

      // Database should be completely clean
      await TestAssertions.assertEmptyDatabase(store);

      const stats = await TestAssertions.getDatabaseStats(store);
      expect(stats.tasks).toBe(0);
      expect(stats.task_templates).toBe(0);
      expect(stats.task_logs).toBe(0);

      // Create different data to prove independence
      await store.createTask({
        description: 'Second test task - independent',
        workflow: 'testing',
        agent: 'tester',
        autonomy: 'supervised'
      });

      const tasks = await store.getAllTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].description).toBe('Second test task - independent');
      expect(tasks[0].workflow).toBe('testing');
    });
  });

  describe('AC3: beforeEach/afterEach Patterns Working Correctly', () => {
    const testHooks = createTestHooks();
    let setupCounter = 0;
    let cleanupCounter = 0;

    beforeEach(async () => {
      setupCounter++;
      await testHooks.beforeEach();
    });

    afterEach(async () => {
      cleanupCounter++;
      await testHooks.afterEach();
    });

    it('test 1 - verifies setup and cleanup execution order', async () => {
      // Setup should have run
      expect(setupCounter).toBe(1);

      const store = await testHooks.createTaskStore();

      await store.createTask({
        description: 'BeforeEach/AfterEach test 1',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'full'
      });

      // Verify data exists
      const tasks = await store.getAllTasks();
      expect(tasks).toHaveLength(1);

      // Cleanup counter should still be 0 (afterEach hasn't run yet)
      expect(cleanupCounter).toBe(0);
    });

    it('test 2 - verifies cleanup happened and fresh setup', async () => {
      // Previous afterEach should have run, new beforeEach should have run
      expect(setupCounter).toBe(2);
      expect(cleanupCounter).toBe(1);

      const store = await testHooks.createTaskStore();

      // Should be clean from previous test
      await TestAssertions.assertEmptyDatabase(store);

      await store.createTask({
        description: 'BeforeEach/AfterEach test 2',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'full'
      });

      // Verify only new data
      const tasks = await store.getAllTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].description).toBe('BeforeEach/AfterEach test 2');
    });

    it('test 3 - manually tests reset functionality within test', async () => {
      const store = await testHooks.createTaskStore();

      // Add data
      await store.createTask({
        description: 'Manual reset test',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'full'
      });

      // Verify data exists
      expect((await store.getAllTasks())).toHaveLength(1);

      // Manually reset store
      await testHooks.resetTaskStore(store);

      // Verify cleanup
      await TestAssertions.assertEmptyDatabase(store);

      // Add new data to prove store is functional
      await store.createTask({
        description: 'Post-reset task',
        workflow: 'development',
        agent: 'developer',
        autonomy: 'full'
      });

      const tasks = await store.getAllTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].description).toBe('Post-reset task');
    });
  });
});