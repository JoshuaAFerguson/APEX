/**
 * Example integration test showing how to use the test database utilities
 * with actual TaskStore operations.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDatabase,
  cleanupTestDatabase,
  createTaskStoreWithTestDb,
  TestDatabaseContext,
} from './db';

describe('Test Database Utilities - Integration Example', () => {
  let testDb: TestDatabaseContext;
  let taskStore: any; // Using any to avoid circular imports in tests

  beforeEach(async () => {
    testDb = await createTestDatabase();
    taskStore = createTaskStoreWithTestDb(testDb, '/tmp/integration-test');
  });

  afterEach(() => {
    cleanupTestDatabase(testDb);
  });

  it('should demonstrate complete task lifecycle using test utilities', async () => {
    // This test shows how the utilities enable testing of actual TaskStore operations

    // 1. Create a task using direct database operations
    const taskId = 'integration_test_task';
    const now = new Date().toISOString();

    testDb.db.prepare(`
      INSERT INTO tasks (
        id, description, workflow, autonomy, status, priority, effort,
        project_path, created_at, updated_at,
        usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      'Integration test task',
      'feature',
      'full',
      'pending',
      'normal',
      'medium',
      '/tmp/integration-test',
      now,
      now,
      50,
      100,
      150,
      0.75
    );

    // 2. Add a log entry
    testDb.db.prepare(`
      INSERT INTO task_logs (task_id, timestamp, level, stage, agent, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(taskId, now, 'info', 'planning', 'planner', 'Task planning started');

    // 3. Add an artifact
    testDb.db.prepare(`
      INSERT INTO task_artifacts (task_id, name, type, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(taskId, 'plan.md', 'markdown', '# Task Plan\\nThis is the task plan', now);

    // 4. Verify the data through TaskStore database access
    const db = taskStore.getDatabase();

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    expect(task).toBeDefined();
    expect(task.description).toBe('Integration test task');
    expect(task.status).toBe('pending');
    expect(task.usage_total_tokens).toBe(150);

    const logs = db.prepare('SELECT COUNT(*) as count FROM task_logs WHERE task_id = ?').get(taskId) as { count: number };
    expect(logs.count).toBe(1);

    const artifacts = db.prepare('SELECT COUNT(*) as count FROM task_artifacts WHERE task_id = ?').get(taskId) as { count: number };
    expect(artifacts.count).toBe(1);

    // 5. Update task status
    db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?')
      .run('running', now, taskId);

    const updatedTask = db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string };
    expect(updatedTask.status).toBe('running');
  });

  it('should support complex queries across multiple tables', async () => {
    // Insert test data across multiple tables
    const taskId = 'complex_test_task';
    const now = new Date().toISOString();

    // Insert task
    testDb.db.prepare(`
      INSERT INTO tasks (
        id, description, workflow, autonomy, status, priority, effort,
        project_path, created_at, updated_at,
        usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      'Complex query test',
      'feature',
      'full',
      'completed',
      'high',
      'large',
      '/tmp/integration-test',
      now,
      now,
      200,
      300,
      500,
      2.5
    );

    // Insert multiple logs
    const logs = [
      { stage: 'planning', agent: 'planner', message: 'Planning phase completed' },
      { stage: 'implementation', agent: 'developer', message: 'Implementation started' },
      { stage: 'implementation', agent: 'developer', message: 'Implementation completed' },
      { stage: 'testing', agent: 'tester', message: 'Tests passed' }
    ];

    for (const log of logs) {
      testDb.db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, stage, agent, message)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(taskId, now, 'info', log.stage, log.agent, log.message);
    }

    // Execute complex join query
    const db = taskStore.getDatabase();
    const result = db.prepare(`
      SELECT
        t.id,
        t.description,
        t.status,
        t.priority,
        COUNT(tl.id) as log_count,
        GROUP_CONCAT(DISTINCT tl.stage) as stages,
        GROUP_CONCAT(DISTINCT tl.agent) as agents,
        t.usage_total_tokens,
        t.usage_estimated_cost
      FROM tasks t
      LEFT JOIN task_logs tl ON t.id = tl.task_id
      WHERE t.id = ?
      GROUP BY t.id
    `).get(taskId) as any;

    expect(result).toBeDefined();
    expect(result.id).toBe(taskId);
    expect(result.status).toBe('completed');
    expect(result.priority).toBe('high');
    expect(result.log_count).toBe(4);
    expect(result.usage_total_tokens).toBe(500);
    expect(result.usage_estimated_cost).toBe(2.5);

    // Verify all stages are included
    const stages = result.stages.split(',');
    expect(stages).toContain('planning');
    expect(stages).toContain('implementation');
    expect(stages).toContain('testing');

    // Verify all agents are included
    const agents = result.agents.split(',');
    expect(agents).toContain('planner');
    expect(agents).toContain('developer');
    expect(agents).toContain('tester');
  });

  it('should handle multiple task operations in isolation', async () => {
    // This test verifies that each test gets a clean database state
    const db = taskStore.getDatabase();

    // Check that database starts empty
    const initialCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
    expect(initialCount.count).toBe(0);

    // Insert some test data
    const taskIds = ['task_1', 'task_2', 'task_3'];
    const now = new Date().toISOString();

    for (const taskId of taskIds) {
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, priority, effort,
          project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        taskId,
        `Test task ${taskId}`,
        'feature',
        'full',
        'pending',
        'normal',
        'medium',
        '/tmp/integration-test',
        now,
        now,
        10,
        20,
        30,
        0.15
      );
    }

    // Verify all tasks were inserted
    const finalCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
    expect(finalCount.count).toBe(3);

    // Verify we can query and aggregate data
    const totalTokens = db.prepare(`
      SELECT SUM(usage_total_tokens) as total_tokens, AVG(usage_estimated_cost) as avg_cost
      FROM tasks
    `).get() as { total_tokens: number; avg_cost: number };

    expect(totalTokens.total_tokens).toBe(90); // 30 * 3
    expect(totalTokens.avg_cost).toBeCloseTo(0.15, 2);
  });
});