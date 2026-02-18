/**
 * @fileoverview Example Usage of Test Cleanup Utilities
 *
 * Demonstrates how to use the test cleanup utilities for proper test isolation
 */

import { createTestHooks, TestAssertions } from './test-cleanup.js';

/**
 * Example test suite demonstrating test cleanup utilities
 */
export function exampleTestSuite() {
  const testHooks = createTestHooks();

  return {
    // Example test 1: Basic task creation and isolation
    async testBasicTaskCreation() {
      await testHooks.beforeEach();

      const store = await testHooks.createTaskStore();

      // Create a test task
      const task = await store.createTask({
        description: 'Example test task',
        workflow: 'development',
        agent: 'developer',
      });

      // Verify task was created
      const tasks = await store.getAllTasks();
      console.log(`Created ${tasks.length} tasks`);

      await testHooks.afterEach();
    },

    // Example test 2: Verify isolation between tests
    async testIsolation() {
      await testHooks.beforeEach();

      const store = await testHooks.createTaskStore();

      // Should start with empty database due to cleanup from previous test
      await TestAssertions.assertEmptyDatabase(store);

      await testHooks.afterEach();
    },

    // Example test 3: Multiple stores in same test
    async testMultipleStores() {
      await testHooks.beforeEach();

      const store1 = await testHooks.createTaskStore('/tmp/project1');
      const store2 = await testHooks.createTaskStore('/tmp/project2');

      await store1.createTask({
        description: 'Task in store 1',
        workflow: 'development',
        agent: 'developer',
      });

      await store2.createTask({
        description: 'Task in store 2',
        workflow: 'development',
        agent: 'developer',
      });

      console.log(`Store 1 tasks: ${(await store1.getAllTasks()).length}`);
      console.log(`Store 2 tasks: ${(await store2.getAllTasks()).length}`);

      await testHooks.afterEach();
    },

    // Example test 4: Store reset without recreation
    async testStoreReset() {
      await testHooks.beforeEach();

      const store = await testHooks.createTaskStore();

      // Add some data
      await store.createTask({
        description: 'Task to be reset',
        workflow: 'development',
        agent: 'developer',
      });

      console.log(`Before reset: ${(await store.getAllTasks()).length} tasks`);

      // Reset store
      await testHooks.resetTaskStore(store);

      console.log(`After reset: ${(await store.getAllTasks()).length} tasks`);

      await testHooks.afterEach();
    },

    // Run all example tests
    async runAll() {
      console.log('Running example test suite...');

      try {
        await this.testBasicTaskCreation();
        console.log('✓ Basic task creation test passed');

        await this.testIsolation();
        console.log('✓ Test isolation verified');

        await this.testMultipleStores();
        console.log('✓ Multiple stores test passed');

        await this.testStoreReset();
        console.log('✓ Store reset test passed');

        console.log('✅ All example tests passed!');
      } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
      }
    }
  };
}

// Run example if this file is executed directly
if (require.main === module) {
  exampleTestSuite().runAll().catch(console.error);
}