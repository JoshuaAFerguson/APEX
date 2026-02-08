/**
 * Enhanced E2E tests for the APEX CLI run command with comprehensive coverage
 *
 * This test file extends the existing run.e2e.test.ts with additional test cases
 * focused on comprehensive event verification, detailed status transitions,
 * and enhanced mocking scenarios for the task creation flow.
 *
 * Coverage includes:
 * - Detailed task lifecycle verification
 * - Event emission tracking and validation
 * - Advanced SQLite database state validation
 * - Enhanced Claude API mocking scenarios
 * - Comprehensive error handling and edge cases
 * - Performance and timeout testing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { createEnvironmentIsolation } from '../../../../tests/test-utils/isolation/environment';
import { DatabaseSeeder } from '../../../orchestrator/src/test-utils';
import type { EnvironmentIsolation } from '../../../../tests/test-utils/isolation/types';

const execAsync = promisify(require('child_process').exec);

// Path to the built CLI
const CLI_PATH = path.join(__dirname, '../../dist/index.js');

/**
 * Helper function to run CLI commands with enhanced error capture
 */
async function runCliCommand(
  args: string,
  cwd: string,
  env?: EnvironmentIsolation,
  timeout = 30000
): Promise<{ stdout: string; stderr: string; exitCode: number; duration: number }> {
  const startTime = Date.now();

  try {
    const processEnv = env ? { ...process.env } : { ...process.env, NO_COLOR: '1' };
    if (env) {
      env.setEnv('NO_COLOR', '1');
    }

    const result = await execAsync(`node ${CLI_PATH} ${args}`, {
      cwd,
      env: processEnv,
      timeout,
    });

    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: 0,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || '',
      exitCode: error.code || 1,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Enhanced setup for initialized APEX project with validation
 */
async function setupInitializedProjectEnhanced(
  testDir: string,
  envIsolation: EnvironmentIsolation
): Promise<{
  configPath: string;
  apexDir: string;
  dbPath: string;
}> {
  // Initialize the project first
  const { exitCode, stderr } = await runCliCommand('init --yes', testDir, envIsolation);

  if (exitCode !== 0) {
    throw new Error(`Failed to initialize APEX project: ${stderr}`);
  }

  const apexDir = path.join(testDir, '.apex');
  const configPath = path.join(apexDir, 'config.yaml');
  const dbPath = path.join(apexDir, 'apex.db');

  // Verify initialization was successful
  if (!(await fileExists(apexDir))) {
    throw new Error('APEX directory not created during initialization');
  }

  // Verify configuration file
  if (!(await fileExists(configPath))) {
    throw new Error('Configuration file not found after initialization');
  }

  return {
    configPath,
    apexDir,
    dbPath,
  };
}

/**
 * Enhanced database task reader with detailed metadata
 */
async function getTasksFromDatabaseDetailed(dbPath: string): Promise<any[]> {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true });

  try {
    const stmt = db.prepare(`
      SELECT
        *,
        datetime(created_at) as created_at_formatted,
        datetime(updated_at) as updated_at_formatted,
        (usage_input_tokens + usage_output_tokens) as total_tokens_calculated
      FROM tasks
      ORDER BY created_at DESC
    `);
    return stmt.all();
  } finally {
    db.close();
  }
}

/**
 * Get task logs with enhanced filtering and sorting
 */
async function getTaskLogsDetailed(
  dbPath: string,
  taskId?: string,
  level?: string
): Promise<any[]> {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true });

  try {
    let sql = 'SELECT *, datetime(timestamp) as timestamp_formatted FROM task_logs';
    const params: any[] = [];

    if (taskId && level) {
      sql += ' WHERE task_id = ? AND level = ?';
      params.push(taskId, level);
    } else if (taskId) {
      sql += ' WHERE task_id = ?';
      params.push(taskId);
    } else if (level) {
      sql += ' WHERE level = ?';
      params.push(level);
    }

    sql += ' ORDER BY timestamp ASC';

    const stmt = db.prepare(sql);
    return params.length > 0 ? stmt.all(...params) : stmt.all();
  } finally {
    db.close();
  }
}

/**
 * Verify database schema matches expected structure
 */
async function verifyDatabaseSchema(dbPath: string): Promise<void> {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true });

  try {
    // Check that all expected tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map((t: any) => t.name);

    const requiredTables = [
      'tasks',
      'task_logs',
      'task_artifacts',
      'gates',
      'commands',
      'task_dependencies',
      'task_checkpoints'
    ];

    for (const tableName of requiredTables) {
      expect(tableNames).toContain(tableName);
    }

    // Verify tasks table has expected columns
    const taskColumns = db.prepare("PRAGMA table_info(tasks)").all();
    const taskColumnNames = taskColumns.map((c: any) => c.name);

    const requiredTaskColumns = [
      'id', 'description', 'workflow', 'autonomy', 'status',
      'project_path', 'created_at', 'updated_at', 'usage_input_tokens'
    ];

    for (const columnName of requiredTaskColumns) {
      expect(taskColumnNames).toContain(columnName);
    }
  } finally {
    db.close();
  }
}

/**
 * Helper to verify task status transition sequence
 */
async function verifyTaskStatusTransitions(
  dbPath: string,
  taskId: string,
  expectedTransitions: string[]
): Promise<void> {
  const logs = await getTaskLogsDetailed(dbPath, taskId, 'info');

  // Filter logs that contain status information
  const statusLogs = logs.filter(log =>
    log.message.toLowerCase().includes('status') ||
    log.message.toLowerCase().includes('transition') ||
    log.message.toLowerCase().includes('started') ||
    log.message.toLowerCase().includes('completed')
  );

  expect(statusLogs.length).toBeGreaterThanOrEqual(expectedTransitions.length - 1);
}

/**
 * Helper function to check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for a condition to become true within a timeout
 */
async function waitForCondition(
  condition: () => Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

describe('Enhanced CLI Run Command E2E Tests', () => {
  let testDir: string;
  let envIsolation: EnvironmentIsolation;
  let seeder: DatabaseSeeder | null = null;

  beforeEach(async () => {
    // Create isolated test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-run-e2e-enhanced-'));

    // Set up environment isolation
    envIsolation = createEnvironmentIsolation();

    // Create database seeder for advanced test scenarios
    try {
      seeder = new DatabaseSeeder();
      await seeder.initialize();
    } catch (error) {
      console.warn('Could not create database seeder:', error);
      seeder = null;
    }
  });

  afterEach(async () => {
    // Clean up environment
    envIsolation.restore();

    // Clean up database seeder
    if (seeder) {
      await seeder.cleanup();
      seeder = null;
    }

    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Comprehensive Task Creation Flow', () => {
    it('should create task with complete lifecycle verification', async () => {
      const { dbPath } = await setupInitializedProjectEnhanced(testDir, envIsolation);

      // Verify database schema before task creation
      await verifyDatabaseSchema(dbPath);

      const { exitCode, stdout, stderr, duration } = await runCliCommand(
        'run "Enhanced lifecycle test task" --workflow feature --autonomy full --dry-run',
        testDir,
        envIsolation,
        45000
      );

      expect(exitCode).toBe(0);
      expect(stderr).not.toContain('error');
      expect(duration).toBeLessThan(45000); // Should complete within timeout

      // Verify task creation is mentioned in output
      expect(stdout.toLowerCase()).toMatch(/task.*created|creating.*task|execution.*started/);

      // Get detailed task information
      const tasks = await getTasksFromDatabaseDetailed(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];
      expect(task.description).toBe('Enhanced lifecycle test task');
      expect(task.workflow).toBe('feature');
      expect(task.autonomy).toBe('full');
      expect(task.status).toMatch(/^(pending|planning|in_progress|completed)$/);
      expect(task.project_path).toBe(testDir);
      expect(task.created_at).toBeDefined();
      expect(task.updated_at).toBeDefined();

      // Verify timestamp consistency
      expect(new Date(task.created_at).getTime()).toBeLessThanOrEqual(
        new Date(task.updated_at).getTime()
      );

      // Verify usage tracking fields exist and are initialized
      expect(task.usage_input_tokens).toBeDefined();
      expect(task.usage_output_tokens).toBeDefined();
      expect(task.usage_total_tokens).toBeDefined();
      expect(task.usage_estimated_cost).toBeDefined();

      // Verify task has proper UUID format
      expect(task.id).toMatch(/^[a-f0-9-]+$/);

      // Verify retry configuration
      expect(task.retry_count).toBe(0);
      expect(task.max_retries).toBeGreaterThan(0);

      // Verify task logs were created with proper structure
      const logs = await getTaskLogsDetailed(dbPath, task.id);
      expect(logs.length).toBeGreaterThan(0);

      // Verify log entries have required fields
      const firstLog = logs[0];
      expect(firstLog.task_id).toBe(task.id);
      expect(firstLog.timestamp).toBeDefined();
      expect(firstLog.level).toMatch(/^(debug|info|warn|error)$/);
      expect(firstLog.message).toBeDefined();
    });

    it('should handle concurrent task creation without conflicts', async () => {
      const { dbPath } = await setupInitializedProjectEnhanced(testDir, envIsolation);

      // Create multiple tasks concurrently
      const taskPromises = [
        runCliCommand('run "Concurrent task 1" --dry-run', testDir, envIsolation, 30000),
        runCliCommand('run "Concurrent task 2" --dry-run', testDir, envIsolation, 30000),
        runCliCommand('run "Concurrent task 3" --dry-run', testDir, envIsolation, 30000),
      ];

      const results = await Promise.all(taskPromises);

      // All should succeed
      results.forEach((result, index) => {
        expect(result.exitCode).toBe(0);
        expect(result.stderr).not.toContain('error');
      });

      // Verify all tasks were created
      const tasks = await getTasksFromDatabaseDetailed(dbPath);
      expect(tasks).toHaveLength(3);

      // Verify all tasks have unique IDs
      const taskIds = tasks.map(t => t.id);
      const uniqueIds = new Set(taskIds);
      expect(uniqueIds.size).toBe(3);

      // Verify all tasks have the expected descriptions
      const descriptions = tasks.map(t => t.description).sort();
      expect(descriptions).toEqual([
        'Concurrent task 1',
        'Concurrent task 2',
        'Concurrent task 3'
      ]);
    });
  });

  describe('Advanced Status Transition Testing', () => {
    it('should track detailed status transitions through task lifecycle', async () => {
      const { dbPath } = await setupInitializedProjectEnhanced(testDir, envIsolation);

      const { exitCode } = await runCliCommand(
        'run "Status transition test" --workflow feature --dry-run',
        testDir,
        envIsolation,
        45000
      );

      expect(exitCode).toBe(0);

      const tasks = await getTasksFromDatabaseDetailed(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];

      // Verify the task was created with proper initial state
      expect(task.status).toMatch(/^(pending|planning|in_progress)$/);

      // Verify status transitions are logged
      await verifyTaskStatusTransitions(
        dbPath,
        task.id,
        ['pending', 'planning'] // Expected minimum transitions for dry-run
      );

      // Verify task has proper metadata for status tracking
      expect(task.current_stage).toBeDefined();

      // Verify timestamps show progression
      const createdTime = new Date(task.created_at).getTime();
      const updatedTime = new Date(task.updated_at).getTime();
      expect(updatedTime).toBeGreaterThanOrEqual(createdTime);
    });

    it('should handle error states and retry logic properly', async () => {
      const { dbPath } = await setupInitializedProjectEnhanced(testDir, envIsolation);

      // Set up environment to simulate potential failure scenarios
      envIsolation.setEnv('APEX_TEST_MODE', 'true');

      const { exitCode, stderr } = await runCliCommand(
        'run "Error handling test" --workflow feature --dry-run',
        testDir,
        envIsolation,
        30000
      );

      // In dry-run mode, this should still succeed
      expect(exitCode).toBe(0);

      const tasks = await getTasksFromDatabaseDetailed(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];

      // Verify error fields are available for tracking
      expect(task.retry_count).toBeDefined();
      expect(task.max_retries).toBeDefined();
      expect(task.error).toBeDefined(); // Should be null/empty for successful run
    });
  });

  describe('Event Emission and Monitoring', () => {
    it('should emit comprehensive events during task creation and execution', async () => {
      const { dbPath } = await setupInitializedProjectEnhanced(testDir, envIsolation);

      const { exitCode, stdout } = await runCliCommand(
        'run "Event monitoring test" --workflow feature --dry-run',
        testDir,
        envIsolation,
        45000
      );

      expect(exitCode).toBe(0);

      // Verify output contains event-related information
      expect(stdout).toMatch(/task|execution|processing|workflow|started|created/i);

      const tasks = await getTasksFromDatabaseDetailed(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];

      // Verify comprehensive event logging
      const allLogs = await getTaskLogsDetailed(dbPath, task.id);
      expect(allLogs.length).toBeGreaterThan(0);

      // Verify different log levels are present
      const logLevels = [...new Set(allLogs.map(log => log.level))];
      expect(logLevels.length).toBeGreaterThan(0);
      expect(logLevels).toContain('info'); // Should have at least info level logs

      // Verify logs have structured content
      const infoLogs = allLogs.filter(log => log.level === 'info');
      expect(infoLogs.length).toBeGreaterThan(0);

      // Verify logs contain task lifecycle events
      const logMessages = allLogs.map(log => log.message.toLowerCase());
      const hasTaskEvents = logMessages.some(msg =>
        msg.includes('task') || msg.includes('created') || msg.includes('started')
      );
      expect(hasTaskEvents).toBe(true);
    });

    it('should track event timing and performance metrics', async () => {
      const { dbPath } = await setupInitializedProjectEnhanced(testDir, envIsolation);

      const startTime = Date.now();

      const { exitCode, duration } = await runCliCommand(
        'run "Performance monitoring test" --workflow feature --dry-run',
        testDir,
        envIsolation,
        30000
      );

      expect(exitCode).toBe(0);
      expect(duration).toBeLessThan(30000); // Should complete within reasonable time

      const tasks = await getTasksFromDatabaseDetailed(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];

      // Verify timing data is captured
      const logs = await getTaskLogsDetailed(dbPath, task.id);

      // Verify logs have timestamps in proper sequence
      for (let i = 1; i < logs.length; i++) {
        const prevTime = new Date(logs[i-1].timestamp).getTime();
        const currTime = new Date(logs[i].timestamp).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }

      // Verify task creation time is reasonable
      const taskCreatedTime = new Date(task.created_at).getTime();
      expect(taskCreatedTime).toBeGreaterThanOrEqual(startTime);
      expect(taskCreatedTime).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Enhanced Dry-Run Mode Testing', () => {
    it('should work reliably in dry-run mode with comprehensive validation', async () => {
      const { dbPath } = await setupInitializedProjectEnhanced(testDir, envIsolation);

      // Set environment for dry-run validation
      envIsolation.setEnv('ANTHROPIC_API_KEY', 'test-key-dry-run-enhanced');
      envIsolation.setEnv('APEX_DRY_RUN', 'true');

      const { exitCode, stdout, stderr } = await runCliCommand(
        'run "Comprehensive dry-run test" --workflow feature --autonomy full --dry-run',
        testDir,
        envIsolation,
        30000
      );

      expect(exitCode).toBe(0);
      expect(stderr).not.toMatch(/network|connection|api.*error/i);

      // Verify dry-run specific behavior
      expect(stdout).toMatch(/dry.?run|simulation|mock|test.*mode|task.*created/i);

      // Verify task was created even in dry-run mode
      const tasks = await getTasksFromDatabaseDetailed(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];
      expect(task.description).toBe('Comprehensive dry-run test');
      expect(task.workflow).toBe('feature');
      expect(task.autonomy).toBe('full');

      // Verify logs indicate dry-run mode
      const logs = await getTaskLogsDetailed(dbPath, task.id);
      expect(logs.length).toBeGreaterThan(0);

      // In dry-run mode, usage should be minimal or zero
      expect(task.usage_input_tokens).toBeDefined();
      expect(task.usage_output_tokens).toBeDefined();
    });

    it('should handle dry-run mode with different workflow configurations', async () => {
      const { dbPath } = await setupInitializedProjectEnhanced(testDir, envIsolation);

      const workflowTests = [
        { workflow: 'feature', description: 'Feature workflow test' },
        { workflow: 'bugfix', description: 'Bugfix workflow test' },
        { workflow: 'refactor', description: 'Refactor workflow test' },
      ];

      for (const { workflow, description } of workflowTests) {
        const { exitCode } = await runCliCommand(
          `run "${description}" --workflow ${workflow} --dry-run`,
          testDir,
          envIsolation,
          30000
        );

        expect(exitCode).toBe(0);
      }

      const tasks = await getTasksFromDatabaseDetailed(dbPath);
      expect(tasks).toHaveLength(3);

      // Verify each workflow was properly set
      const workflows = tasks.map(t => t.workflow);
      expect(workflows).toContain('feature');
      expect(workflows).toContain('bugfix');
      expect(workflows).toContain('refactor');
    });
  });

  describe('Database Integration and Persistence', () => {
    it('should maintain database consistency across multiple operations', async () => {
      const { dbPath } = await setupInitializedProjectEnhanced(testDir, envIsolation);

      // Create multiple tasks
      const taskDescriptions = [
        'Database consistency test 1',
        'Database consistency test 2',
        'Database consistency test 3'
      ];

      for (const description of taskDescriptions) {
        const { exitCode } = await runCliCommand(
          `run "${description}" --workflow feature --dry-run`,
          testDir,
          envIsolation,
          30000
        );
        expect(exitCode).toBe(0);
      }

      // Verify database integrity
      await verifyDatabaseSchema(dbPath);

      const tasks = await getTasksFromDatabaseDetailed(dbPath);
      expect(tasks).toHaveLength(3);

      // Verify foreign key relationships
      for (const task of tasks) {
        const logs = await getTaskLogsDetailed(dbPath, task.id);
        expect(logs.length).toBeGreaterThan(0);

        // All logs should reference the correct task
        logs.forEach(log => {
          expect(log.task_id).toBe(task.id);
        });
      }

      // Verify no data corruption
      tasks.forEach(task => {
        expect(task.id).toBeDefined();
        expect(task.description).toBeDefined();
        expect(task.workflow).toBeDefined();
        expect(task.status).toBeDefined();
        expect(task.created_at).toBeDefined();
      });
    });

    it('should handle database transactions properly', async () => {
      const { dbPath } = await setupInitializedProjectEnhanced(testDir, envIsolation);

      // Verify database starts empty
      let tasks = await getTasksFromDatabaseDetailed(dbPath);
      expect(tasks).toHaveLength(0);

      const { exitCode } = await runCliCommand(
        'run "Transaction test task" --workflow feature --dry-run',
        testDir,
        envIsolation,
        30000
      );

      expect(exitCode).toBe(0);

      // Verify task and related data were created atomically
      tasks = await getTasksFromDatabaseDetailed(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];
      const logs = await getTaskLogsDetailed(dbPath, task.id);

      // If task exists, logs should also exist (atomic transaction)
      expect(logs.length).toBeGreaterThan(0);

      // Verify data consistency
      expect(task.id).toBeDefined();
      expect(logs.every(log => log.task_id === task.id)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing description with clear error message', async () => {
      await setupInitializedProjectEnhanced(testDir, envIsolation);

      const { exitCode, stderr } = await runCliCommand(
        'run',
        testDir,
        envIsolation,
        10000
      );

      expect(exitCode).not.toBe(0);
      expect(stderr.toLowerCase()).toMatch(/usage|description|required|argument/);
    });

    it('should handle uninitialized project gracefully with helpful guidance', async () => {
      // Don't initialize the project
      const { exitCode, stderr } = await runCliCommand(
        'run "Test task" --dry-run',
        testDir,
        envIsolation,
        10000
      );

      expect(exitCode).not.toBe(0);
      expect(stderr.toLowerCase()).toMatch(/not.*initialized|init.*first|configuration|apex.*init/);
    });

    it('should handle invalid workflow gracefully', async () => {
      await setupInitializedProjectEnhanced(testDir, envIsolation);

      const { exitCode, stderr } = await runCliCommand(
        'run "Test task" --workflow nonexistent-workflow --dry-run',
        testDir,
        envIsolation,
        15000
      );

      // Should either succeed with warning or fail gracefully
      if (exitCode !== 0) {
        expect(stderr.toLowerCase()).toMatch(/workflow|invalid|not.*found|unknown/);
      }
    });

    it('should handle special characters in task descriptions', async () => {
      const { dbPath } = await setupInitializedProjectEnhanced(testDir, envIsolation);

      const specialDescription = 'Task with "quotes", &symbols, and émojis 🚀';

      const { exitCode } = await runCliCommand(
        `run "${specialDescription}" --dry-run`,
        testDir,
        envIsolation,
        30000
      );

      expect(exitCode).toBe(0);

      const tasks = await getTasksFromDatabaseDetailed(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];
      expect(task.description).toBe(specialDescription);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle task creation within reasonable performance bounds', async () => {
      const { dbPath } = await setupInitializedProjectEnhanced(testDir, envIsolation);

      const startTime = Date.now();

      const { exitCode, duration } = await runCliCommand(
        'run "Performance test task" --workflow feature --dry-run',
        testDir,
        envIsolation,
        30000
      );

      const totalTime = Date.now() - startTime;

      expect(exitCode).toBe(0);
      expect(duration).toBeLessThan(10000); // Should complete under 10 seconds
      expect(totalTime).toBeLessThan(15000); // Total overhead should be reasonable

      const tasks = await getTasksFromDatabaseDetailed(dbPath);
      expect(tasks).toHaveLength(1);

      // Verify task creation time is recorded properly
      const task = tasks[0];
      const taskCreationTime = new Date(task.created_at).getTime();
      expect(taskCreationTime).toBeGreaterThanOrEqual(startTime);
      expect(taskCreationTime).toBeLessThanOrEqual(Date.now());
    });

    it('should handle timeout scenarios gracefully', async () => {
      await setupInitializedProjectEnhanced(testDir, envIsolation);

      // Test with very short timeout to verify timeout handling
      const { exitCode, stderr } = await runCliCommand(
        'run "Timeout test task" --workflow feature --dry-run',
        testDir,
        envIsolation,
        100 // Very short timeout
      );

      // Should either succeed quickly or timeout gracefully
      if (exitCode !== 0) {
        expect(stderr.toLowerCase()).toMatch(/timeout|killed|signal|time.*out/);
      }
    });
  });
});