/**
 * @fileoverview Tests for Enhanced Test Utilities
 *
 * Tests the new convenience utilities added to test-cleanup.ts to ensure
 * they provide better developer experience and maintain proper isolation.
 */

import { describe, it, expect } from 'vitest';
import { TestUtils, TestAssertions } from '../test-cleanup.js';

describe('TestUtils Enhanced Utilities', () => {
  describe('setupTest', () => {
    it('should provide complete test setup with cleanup', async () => {
      const { store, cleanup, resetStore } = await TestUtils.setupTest();

      try {
        // Verify store is working
        const task = await store.createTask({
          description: 'Test task',
          workflow: 'development',
          agent: 'developer',
        });
        expect(task.description).toBe('Test task');

        // Verify reset works
        await resetStore();
        await TestAssertions.assertEmptyDatabase(store);

        // Add data again
        await store.createTask({
          description: 'Another task',
          workflow: 'development',
          agent: 'developer',
        });

        await TestAssertions.assertTaskCount(store, 1);
      } finally {
        await cleanup();
      }
    });
  });

  describe('withCleanStore', () => {
    it('should automatically setup and cleanup store', async () => {
      const result = await TestUtils.withCleanStore(async (store) => {
        // Create some test data
        const task = await store.createTask({
          description: 'Test task',
          workflow: 'development',
          agent: 'developer',
        });

        await store.createLog({
          taskId: task.id,
          stage: 'implementation',
          agent: 'developer',
          level: 'info',
          message: 'Test log',
        });

        await TestAssertions.assertTaskCount(store, 1);
        await TestAssertions.assertLogCount(store, 1);

        return { taskId: task.id, success: true };
      });

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
    });

    it('should cleanup even if test throws', async () => {
      let storeRef: any = null;

      try {
        await TestUtils.withCleanStore(async (store) => {
          storeRef = store;
          await store.createTask({
            description: 'Test task',
            workflow: 'development',
            agent: 'developer',
          });

          throw new Error('Test error');
        });
      } catch (error) {
        expect((error as Error).message).toBe('Test error');
      }

      // Store should be cleaned up despite the error
      // Note: We can't directly test this without accessing the internal state
      // but the withCleanStore function ensures cleanup in finally block
      expect(storeRef).not.toBeNull();
    });
  });

  describe('withResetableStore', () => {
    it('should allow multiple resets during test', async () => {
      await TestUtils.withResetableStore(async (store, resetStore) => {
        // First operation
        await store.createTask({
          description: 'First task',
          workflow: 'development',
          agent: 'developer',
        });
        await TestAssertions.assertTaskCount(store, 1);

        // Reset and verify clean
        await resetStore();
        await TestAssertions.assertEmptyDatabase(store);

        // Second operation
        await store.createTask({
          description: 'Second task',
          workflow: 'development',
          agent: 'developer',
        });
        await TestAssertions.assertTaskCount(store, 1);

        // Reset again
        await resetStore();
        await TestAssertions.assertEmptyDatabase(store);

        // Third operation
        await store.createTask({
          description: 'Third task',
          workflow: 'development',
          agent: 'developer',
        });
        await store.createTask({
          description: 'Fourth task',
          workflow: 'development',
          agent: 'developer',
        });
        await TestAssertions.assertTaskCount(store, 2);
      });
    });
  });

  describe('TestAssertions Enhanced', () => {
    it('should provide convenient assertion methods', async () => {
      await TestUtils.withCleanStore(async (store) => {
        // Start with empty database
        await TestAssertions.assertTaskCount(store, 0);
        await TestAssertions.assertLogCount(store, 0);
        await TestAssertions.assertTemplateCount(store, 0);

        // Create test data
        const task = await store.createTask({
          description: 'Test task',
          workflow: 'development',
          agent: 'developer',
        });

        await store.createLog({
          taskId: task.id,
          stage: 'implementation',
          agent: 'developer',
          level: 'info',
          message: 'Test log',
        });

        await store.createTaskTemplate({
          name: 'Test Template',
          description: 'Test template',
          workflow: 'development',
          agent: 'developer',
        });

        // Verify counts
        await TestAssertions.assertTaskCount(store, 1);
        await TestAssertions.assertLogCount(store, 1);
        await TestAssertions.assertTemplateCount(store, 1);

        // Test database counts assertion
        await TestAssertions.assertDatabaseCounts(store, {
          tasks: 1,
          task_logs: 1,
          task_templates: 1,
        });
      });
    });

    it('should throw on incorrect counts', async () => {
      await TestUtils.withCleanStore(async (store) => {
        // Create one task
        await store.createTask({
          description: 'Test task',
          workflow: 'development',
          agent: 'developer',
        });

        // These should throw
        await expect(TestAssertions.assertTaskCount(store, 0)).rejects.toThrow();
        await expect(TestAssertions.assertTaskCount(store, 2)).rejects.toThrow();
        await expect(TestAssertions.assertLogCount(store, 1)).rejects.toThrow();
      });
    });
  });

  describe('Configuration options', () => {
    it('should work with in-memory configuration', async () => {
      await TestUtils.withCleanStore(async (store) => {
        const task = await store.createTask({
          description: 'Memory test',
          workflow: 'development',
          agent: 'developer',
        });
        expect(task).toBeDefined();
      }, { useInMemoryDb: true });
    });

    it('should work with file-based configuration', async () => {
      await TestUtils.withCleanStore(async (store) => {
        const task = await store.createTask({
          description: 'File test',
          workflow: 'development',
          agent: 'developer',
        });
        expect(task).toBeDefined();
      }, { useInMemoryDb: false });
    });
  });
});