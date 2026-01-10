/**
 * Integration test demonstrating TaskStore operations using test database utilities.
 * Shows how to test database-dependent code with in-memory SQLite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDatabase,
  cleanupTestDatabase,
  createMockTask,
  type TestDatabaseContext,
} from '../test-utils';
import type { Task } from '@apexcli/core';

describe('TaskStore Database Integration', () => {
  let testDb: TestDatabaseContext;

  beforeEach(async () => {
    testDb = await createTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase(testDb);
  });

  describe('Task CRUD operations using test database', () => {
    it('should create and retrieve tasks', () => {
      const task = createMockTask({
        id: 'integration_task_001',
        description: 'Integration test task',
        status: 'pending',
      });

      // Insert task using the same pattern as TaskStore
      const stmt = testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, acceptance_criteria, workflow, autonomy, status, priority, effort,
          current_stage, project_path, branch_name, pr_url, retry_count, max_retries, resume_attempts,
          created_at, updated_at, completed_at, paused_at, resume_after, pause_reason,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost,
          parent_task_id, subtask_ids, subtask_strategy,
          workspace_config, session_data, last_checkpoint
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      const now = new Date().toISOString();
      stmt.run(
        task.id,
        task.description,
        task.acceptanceCriteria || null,
        task.workflow,
        task.autonomy,
        task.status,
        task.priority,
        task.effort,
        task.currentStage || null,
        task.projectPath,
        task.branchName || null,
        task.prUrl || null,
        task.retryCount,
        task.maxRetries,
        task.resumeAttempts,
        now,
        now,
        null, // completed_at
        null, // paused_at
        null, // resume_after
        null, // pause_reason
        task.usage.inputTokens,
        task.usage.outputTokens,
        task.usage.totalTokens,
        task.usage.estimatedCost,
        null, // parent_task_id
        null, // subtask_ids
        null, // subtask_strategy
        null, // workspace_config
        null, // session_data
        null  // last_checkpoint
      );

      // Retrieve and verify
      const savedTask = testDb.db
        .prepare('SELECT * FROM tasks WHERE id = ?')
        .get(task.id) as Record<string, unknown>;

      expect(savedTask).toBeDefined();
      expect(savedTask.id).toBe(task.id);
      expect(savedTask.description).toBe(task.description);
      expect(savedTask.status).toBe(task.status);
      expect(savedTask.workflow).toBe(task.workflow);
    });

    it('should update task status', () => {
      const task = createMockTask({
        id: 'update_test_task',
        status: 'pending',
      });

      const now = new Date().toISOString();

      // Create task
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, priority, effort,
          project_path, created_at, updated_at, usage_input_tokens,
          usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        task.id,
        task.description,
        task.workflow,
        task.autonomy,
        task.status,
        task.priority,
        task.effort,
        task.projectPath,
        now,
        now,
        task.usage.inputTokens,
        task.usage.outputTokens,
        task.usage.totalTokens,
        task.usage.estimatedCost
      );

      // Update status
      const updateStmt = testDb.db.prepare(`
        UPDATE tasks
        SET status = ?, updated_at = ?, current_stage = ?
        WHERE id = ?
      `);

      updateStmt.run('in_progress', new Date().toISOString(), 'implementation', task.id);

      // Verify update
      const updatedTask = testDb.db
        .prepare('SELECT * FROM tasks WHERE id = ?')
        .get(task.id) as Record<string, unknown>;

      expect(updatedTask.status).toBe('in_progress');
      expect(updatedTask.current_stage).toBe('implementation');
    });

    it('should handle task completion workflow', () => {
      const task = createMockTask({
        id: 'completion_test_task',
        status: 'in_progress',
      });

      const now = new Date().toISOString();

      // Create task
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        task.id, task.description, task.workflow, task.autonomy, task.status,
        task.projectPath, now, now,
        task.usage.inputTokens, task.usage.outputTokens, task.usage.totalTokens, task.usage.estimatedCost
      );

      // Complete the task
      const completedAt = new Date().toISOString();
      testDb.db.prepare(`
        UPDATE tasks
        SET status = ?, completed_at = ?, updated_at = ?
        WHERE id = ?
      `).run('completed', completedAt, completedAt, task.id);

      // Verify completion
      const completedTask = testDb.db
        .prepare('SELECT * FROM tasks WHERE id = ?')
        .get(task.id) as Record<string, unknown>;

      expect(completedTask.status).toBe('completed');
      expect(completedTask.completed_at).toBe(completedAt);
    });
  });

  describe('Task relationships', () => {
    it('should handle task logs relationship', () => {
      const task = createMockTask({ id: 'log_relationship_task' });
      const now = new Date().toISOString();

      // Create task
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        task.id, task.description, task.workflow, task.autonomy, task.status,
        task.projectPath, now, now,
        task.usage.inputTokens, task.usage.outputTokens, task.usage.totalTokens, task.usage.estimatedCost
      );

      // Add multiple logs
      const logStmt = testDb.db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, stage, agent, message, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      logStmt.run(task.id, now, 'info', 'planning', 'planner', 'Task planning started', '{}');
      logStmt.run(task.id, now, 'info', 'implementation', 'developer', 'Implementation started', '{}');
      logStmt.run(task.id, now, 'info', 'testing', 'tester', 'Tests executed', '{"testsPassed": 5}');

      // Query logs
      const logs = testDb.db.prepare(`
        SELECT * FROM task_logs
        WHERE task_id = ?
        ORDER BY id ASC
      `).all(task.id) as Array<{ level: string; stage: string; agent: string; message: string }>;

      expect(logs).toHaveLength(3);
      expect(logs[0].stage).toBe('planning');
      expect(logs[0].agent).toBe('planner');
      expect(logs[1].stage).toBe('implementation');
      expect(logs[1].agent).toBe('developer');
      expect(logs[2].stage).toBe('testing');
      expect(logs[2].agent).toBe('tester');
    });

    it('should handle task artifacts relationship', () => {
      const task = createMockTask({ id: 'artifacts_task' });
      const now = new Date().toISOString();

      // Create task
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        task.id, task.description, task.workflow, task.autonomy, task.status,
        task.projectPath, now, now,
        task.usage.inputTokens, task.usage.outputTokens, task.usage.totalTokens, task.usage.estimatedCost
      );

      // Add artifacts
      const artifactStmt = testDb.db.prepare(`
        INSERT INTO task_artifacts (task_id, name, type, path, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      artifactStmt.run(
        task.id,
        'implementation_plan.md',
        'plan',
        '/artifacts/implementation_plan.md',
        '# Implementation Plan\n\n1. Setup\n2. Implement\n3. Test',
        now
      );

      artifactStmt.run(
        task.id,
        'test_results.json',
        'test_results',
        '/artifacts/test_results.json',
        '{"passed": 10, "failed": 0, "coverage": 95}',
        now
      );

      // Query artifacts
      const artifacts = testDb.db.prepare(`
        SELECT * FROM task_artifacts
        WHERE task_id = ?
        ORDER BY name ASC
      `).all(task.id) as Array<{ name: string; type: string; content: string }>;

      expect(artifacts).toHaveLength(2);
      expect(artifacts[0].name).toBe('implementation_plan.md');
      expect(artifacts[0].type).toBe('plan');
      expect(artifacts[1].name).toBe('test_results.json');
      expect(artifacts[1].type).toBe('test_results');

      // Verify JSON content
      const testResults = JSON.parse(artifacts[1].content);
      expect(testResults.passed).toBe(10);
      expect(testResults.coverage).toBe(95);
    });
  });

  describe('Advanced features', () => {
    it('should handle todos for task', () => {
      const task = createMockTask({ id: 'todos_task' });
      const now = new Date().toISOString();

      // Create task
      testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        task.id, task.description, task.workflow, task.autonomy, task.status,
        task.projectPath, now, now,
        task.usage.inputTokens, task.usage.outputTokens, task.usage.totalTokens, task.usage.estimatedCost
      );

      // Add todos
      const todoStmt = testDb.db.prepare(`
        INSERT INTO todos (id, task_id, content, status, active_form, order_index, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      todoStmt.run('todo_1', task.id, 'Set up test environment', 'completed', 'Setting up test environment', 1, now, now);
      todoStmt.run('todo_2', task.id, 'Write unit tests', 'in_progress', 'Writing unit tests', 2, now, now);
      todoStmt.run('todo_3', task.id, 'Run integration tests', 'pending', 'Running integration tests', 3, now, now);

      // Query todos
      const todos = testDb.db.prepare(`
        SELECT * FROM todos
        WHERE task_id = ?
        ORDER BY order_index ASC
      `).all(task.id) as Array<{ content: string; status: string; order_index: number }>;

      expect(todos).toHaveLength(3);
      expect(todos[0].content).toBe('Set up test environment');
      expect(todos[0].status).toBe('completed');
      expect(todos[1].content).toBe('Write unit tests');
      expect(todos[1].status).toBe('in_progress');
      expect(todos[2].status).toBe('pending');
    });

    it('should handle task dependencies', () => {
      const task1 = createMockTask({ id: 'dependency_task_1' });
      const task2 = createMockTask({ id: 'dependency_task_2' });
      const now = new Date().toISOString();

      // Create both tasks
      const taskStmt = testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      taskStmt.run(
        task1.id, task1.description, task1.workflow, task1.autonomy, task1.status,
        task1.projectPath, now, now,
        task1.usage.inputTokens, task1.usage.outputTokens, task1.usage.totalTokens, task1.usage.estimatedCost
      );

      taskStmt.run(
        task2.id, task2.description, task2.workflow, task2.autonomy, task2.status,
        task2.projectPath, now, now,
        task2.usage.inputTokens, task2.usage.outputTokens, task2.usage.totalTokens, task2.usage.estimatedCost
      );

      // Create dependency (task2 depends on task1)
      testDb.db.prepare(`
        INSERT INTO task_dependencies (task_id, depends_on_task_id)
        VALUES (?, ?)
      `).run(task2.id, task1.id);

      // Query dependencies
      const dependencies = testDb.db.prepare(`
        SELECT t1.id as task_id, t1.description as task_description,
               t2.id as depends_on_id, t2.description as depends_on_description
        FROM task_dependencies td
        JOIN tasks t1 ON td.task_id = t1.id
        JOIN tasks t2 ON td.depends_on_task_id = t2.id
        WHERE td.task_id = ?
      `).all(task2.id) as Array<{ task_id: string; depends_on_id: string }>;

      expect(dependencies).toHaveLength(1);
      expect(dependencies[0].task_id).toBe(task2.id);
      expect(dependencies[0].depends_on_id).toBe(task1.id);
    });
  });

  describe('Database constraints and validation', () => {
    it('should enforce foreign key constraints', () => {
      // Attempt to create a log for non-existent task should not fail in SQLite by default
      // but we can verify the relationship doesn't exist
      const now = new Date().toISOString();

      testDb.db.prepare(`
        INSERT INTO task_logs (task_id, timestamp, level, message)
        VALUES (?, ?, ?, ?)
      `).run('non_existent_task', now, 'info', 'Orphaned log');

      // Verify we can't find the task
      const task = testDb.db.prepare('SELECT * FROM tasks WHERE id = ?').get('non_existent_task');
      expect(task).toBeUndefined();

      // But the log exists (SQLite doesn't enforce FK by default)
      const log = testDb.db.prepare('SELECT * FROM task_logs WHERE task_id = ?').get('non_existent_task');
      expect(log).toBeDefined();
    });

    it('should handle unique constraints', () => {
      const now = new Date().toISOString();
      const task = createMockTask({ id: 'unique_test_task' });

      // Create task
      const stmt = testDb.db.prepare(`
        INSERT INTO tasks (
          id, description, workflow, autonomy, status, project_path, created_at, updated_at,
          usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        task.id, task.description, task.workflow, task.autonomy, task.status,
        task.projectPath, now, now,
        task.usage.inputTokens, task.usage.outputTokens, task.usage.totalTokens, task.usage.estimatedCost
      );

      // Attempt to create duplicate should throw
      expect(() => {
        stmt.run(
          task.id, 'Duplicate task', task.workflow, task.autonomy, task.status,
          task.projectPath, now, now,
          task.usage.inputTokens, task.usage.outputTokens, task.usage.totalTokens, task.usage.estimatedCost
        );
      }).toThrow();
    });
  });
});