import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task } from '@apexcli/core';

/**
 * Integration test demonstrating the key acceptance criteria:
 * - TaskStore uses APEX_HOME env var to locate apex.db file
 * - Database created in .apex-test/apex.db when APEX_HOME points to test directory
 * - Existing behavior unchanged when APEX_HOME is not set
 */
describe('TaskStore APEX_HOME Integration Test', () => {
  let testProjectDir: string;
  let testApexHomeDir: string;
  let originalApexHome: string | undefined;

  const createTestTask = (id: string): Task => ({
    id,
    description: `Integration test task ${id}`,
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testProjectDir,
    branchName: 'apex/integration-test',
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
    testProjectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-integration-project-'));
    testApexHomeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-integration-home-'));

    // Clean environment
    delete process.env.APEX_HOME;
  });

  afterAll(async () => {
    // Cleanup
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
      await fs.rm(testApexHomeDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Restore environment
    if (originalApexHome !== undefined) {
      process.env.APEX_HOME = originalApexHome;
    } else {
      delete process.env.APEX_HOME;
    }
  });

  it('should demonstrate full APEX_HOME functionality per acceptance criteria', async () => {
    // **Acceptance Criteria 1: Existing behavior unchanged when APEX_HOME is not set**
    delete process.env.APEX_HOME;

    const defaultStore = new TaskStore(testProjectDir);
    await defaultStore.initialize();

    const defaultTask = createTestTask('default-behavior-task');
    await defaultStore.createTask(defaultTask);

    // Verify database is in project/.apex/apex.db (existing behavior)
    const defaultDbPath = path.join(testProjectDir, '.apex', 'apex.db');
    const defaultDbExists = await fs.access(defaultDbPath).then(() => true).catch(() => false);
    expect(defaultDbExists).toBe(true);

    // Verify task is accessible
    const retrievedDefault = await defaultStore.getTask(defaultTask.id);
    expect(retrievedDefault).not.toBeNull();
    expect(retrievedDefault?.id).toBe(defaultTask.id);

    defaultStore.close();

    // **Acceptance Criteria 2: Database created in .apex-test/apex.db when APEX_HOME points to test directory**
    const apexTestDir = path.join(testApexHomeDir, '.apex-test');
    process.env.APEX_HOME = apexTestDir;

    const testStore = new TaskStore(testProjectDir);
    await testStore.initialize();

    const testTask = createTestTask('test-env-task');
    await testStore.createTask(testTask);

    // Verify database is in .apex-test/apex.db
    const testDbPath = path.join(apexTestDir, 'apex.db');
    const testDbExists = await fs.access(testDbPath).then(() => true).catch(() => false);
    expect(testDbExists).toBe(true);

    // Verify task is accessible
    const retrievedTest = await testStore.getTask(testTask.id);
    expect(retrievedTest).not.toBeNull();
    expect(retrievedTest?.id).toBe(testTask.id);

    // Verify isolation: default task should not be visible in test environment
    const defaultTaskInTest = await testStore.getTask(defaultTask.id);
    expect(defaultTaskInTest).toBeNull();

    testStore.close();

    // **Acceptance Criteria 3: TaskStore uses APEX_HOME env var to locate apex.db file**
    // Verify both databases exist in their respective locations
    expect(await fs.access(defaultDbPath).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.access(testDbPath).then(() => true).catch(() => false)).toBe(true);

    // Verify they contain different data
    delete process.env.APEX_HOME;
    const verifyDefaultStore = new TaskStore(testProjectDir);
    await verifyDefaultStore.initialize();

    process.env.APEX_HOME = apexTestDir;
    const verifyTestStore = new TaskStore(testProjectDir);
    await verifyTestStore.initialize();

    // Each store should only see its own task
    expect(await verifyDefaultStore.getTask(defaultTask.id)).not.toBeNull();
    expect(await verifyDefaultStore.getTask(testTask.id)).toBeNull();

    expect(await verifyTestStore.getTask(testTask.id)).not.toBeNull();
    expect(await verifyTestStore.getTask(defaultTask.id)).toBeNull();

    verifyDefaultStore.close();
    verifyTestStore.close();

    // **Summary**: All acceptance criteria verified
    // ✓ TaskStore uses APEX_HOME env var to locate apex.db file
    // ✓ Database created in .apex-test/apex.db when APEX_HOME points to test directory
    // ✓ Existing behavior unchanged when APEX_HOME is not set
  });
});