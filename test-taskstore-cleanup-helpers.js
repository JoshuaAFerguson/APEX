#!/usr/bin/env node

/**
 * Focused test script to verify TaskStore cleanup helpers are working correctly
 * Tests: clearAllTasks(), resetDatabase(), and createTestInstance()
 */

import { TaskStore } from './packages/orchestrator/dist/store.js';
import { createId } from '@paralleldrive/cuid2';

console.log('Testing TaskStore cleanup helpers...\n');

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, testFn) {
    try {
      console.log(`Running: ${name}`);
      testFn();
      console.log(`✅ PASSED: ${name}\n`);
      passed++;
    } catch (error) {
      console.log(`❌ FAILED: ${name}`);
      console.log(`   Error: ${error.message}\n`);
      failed++;
    }
  }

  async function asyncTest(name, testFn) {
    try {
      console.log(`Running: ${name}`);
      await testFn();
      console.log(`✅ PASSED: ${name}\n`);
      passed++;
    } catch (error) {
      console.log(`❌ FAILED: ${name}`);
      console.log(`   Error: ${error.message}\n`);
      failed++;
    }
  }

  // Helper to create test task
  function createTestTask() {
    return {
      id: createId(),
      description: 'Test task',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      projectPath: '/test/path',
      metadata: {}
    };
  }

  // Test createTestInstance static method
  await asyncTest('createTestInstance() creates working in-memory store', async () => {
    const testStore = TaskStore.createTestInstance();
    await testStore.initialize();

    const task = createTestTask();
    await testStore.createTask(task);

    const retrievedTask = await testStore.getTask(task.id);
    if (!retrievedTask || retrievedTask.id !== task.id) {
      throw new Error('Test instance does not work correctly');
    }

    testStore.close();
  });

  // Test createTestInstance with custom project path
  await asyncTest('createTestInstance() with custom project path', async () => {
    const customPath = '/custom/test/path';
    const testStore = TaskStore.createTestInstance(customPath);
    await testStore.initialize();

    const task = createTestTask();
    task.projectPath = customPath;
    await testStore.createTask(task);

    const retrievedTask = await testStore.getTask(task.id);
    if (!retrievedTask || retrievedTask.projectPath !== customPath) {
      throw new Error('Custom project path not set correctly');
    }

    testStore.close();
  });

  // Test clearAllTasks method
  await asyncTest('clearAllTasks() removes all data correctly', async () => {
    const testStore = TaskStore.createTestInstance();
    await testStore.initialize();

    // Create test data
    const task = createTestTask();
    await testStore.createTask(task);

    await testStore.addLog(task.id, {
      level: 'info',
      stage: 'test',
      agent: 'test-agent',
      message: 'Test log entry',
      timestamp: new Date(),
    });

    await testStore.addArtifact(task.id, {
      name: 'test-artifact',
      type: 'file',
      path: '/test/path',
      content: 'test content',
      metadata: {},
    });

    // Verify data exists
    const tasksBeforeCleanup = await testStore.listTasks();
    const logsBeforeCleanup = await testStore.getLogs(task.id);
    const artifactsBeforeCleanup = await testStore.getArtifacts(task.id);

    if (tasksBeforeCleanup.length !== 1 || logsBeforeCleanup.length !== 1 || artifactsBeforeCleanup.length !== 1) {
      throw new Error('Test data not created properly');
    }

    // Clear all tasks
    testStore.clearAllTasks();

    // Verify all data is cleared
    const tasksAfterCleanup = await testStore.listTasks();
    const logsAfterCleanup = await testStore.getLogs(task.id);
    const artifactsAfterCleanup = await testStore.getArtifacts(task.id);

    if (tasksAfterCleanup.length !== 0 || logsAfterCleanup.length !== 0 || artifactsAfterCleanup.length !== 0) {
      throw new Error('clearAllTasks did not remove all data');
    }

    testStore.close();
  });

  // Test resetDatabase method
  await asyncTest('resetDatabase() completely resets the database', async () => {
    const testStore = TaskStore.createTestInstance();
    await testStore.initialize();

    // Create test data
    const task = createTestTask();
    await testStore.createTask(task);

    // Verify data exists
    const tasksBeforeReset = await testStore.listTasks();
    if (tasksBeforeReset.length !== 1) {
      throw new Error('Test data not created properly');
    }

    // Reset the database
    testStore.resetDatabase();

    // Verify all data is cleared
    const tasksAfterReset = await testStore.listTasks();
    if (tasksAfterReset.length !== 0) {
      throw new Error('resetDatabase did not clear all data');
    }

    // Verify we can still create new data after reset
    const newTask = createTestTask();
    await testStore.createTask(newTask);

    const retrievedTask = await testStore.getTask(newTask.id);
    if (!retrievedTask || retrievedTask.id !== newTask.id) {
      throw new Error('Cannot create tasks after database reset');
    }

    testStore.close();
  });

  // Test error handling - clearAllTasks on empty database
  await asyncTest('clearAllTasks() handles empty database gracefully', async () => {
    const testStore = TaskStore.createTestInstance();
    await testStore.initialize();

    // Clear empty database - should not throw
    testStore.clearAllTasks();

    testStore.close();
  });

  // Test error handling - resetDatabase on empty database
  await asyncTest('resetDatabase() handles empty database gracefully', async () => {
    const testStore = TaskStore.createTestInstance();
    await testStore.initialize();

    // Reset empty database - should not throw
    testStore.resetDatabase();

    testStore.close();
  });

  // Test isolation between test instances
  await asyncTest('Test instances are properly isolated', async () => {
    const testStore1 = TaskStore.createTestInstance();
    const testStore2 = TaskStore.createTestInstance();

    await testStore1.initialize();
    await testStore2.initialize();

    // Add different tasks to each store
    const task1 = createTestTask();
    task1.id = 'task1';
    await testStore1.createTask(task1);

    const task2 = createTestTask();
    task2.id = 'task2';
    await testStore2.createTask(task2);

    // Verify isolation
    const retrievedFromStore1 = await testStore1.getTask('task2');
    const retrievedFromStore2 = await testStore2.getTask('task1');

    if (retrievedFromStore1 !== null || retrievedFromStore2 !== null) {
      throw new Error('Test instances are not properly isolated');
    }

    testStore1.close();
    testStore2.close();
  });

  // Summary
  console.log(`\n📊 Test Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);

  if (failed > 0) {
    console.log(`\n❌ Some tests failed! TaskStore cleanup helpers need fixes.`);
    process.exit(1);
  } else {
    console.log(`\n🎉 All tests passed! TaskStore cleanup helpers are working correctly.`);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('\n💥 Test runner crashed:', error.message);
  process.exit(1);
});