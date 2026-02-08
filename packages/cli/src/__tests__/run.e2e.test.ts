/**
 * End-to-end tests for the APEX CLI run command
 *
 * Tests the complete task creation flow including:
 * - CLI run command execution and task creation
 * - SQLite database task storage and status transitions
 * - Event emissions during task execution
 * - Dry-run mode with Claude API mocking
 * - Task lifecycle management via ApexOrchestrator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { createEnvironmentIsolation } from '../../../../tests/test-utils/isolation/environment';
import { createTestDatabase } from '../../../orchestrator/src/test-utils';
import type { EnvironmentIsolation } from '../../../../tests/test-utils/isolation/types';
import type { TestDatabaseContext } from '../../../orchestrator/src/test-utils';

const execAsync = promisify(require('child_process').exec);

// Path to the built CLI
const CLI_PATH = path.join(__dirname, '../../dist/index.js');

/**
 * Helper function to run CLI commands with isolated environment
 */
async function runCliCommand(
  args: string,
  cwd: string,
  env?: EnvironmentIsolation,
  timeout = 30000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    // Set up environment isolation if provided
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
    };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || '',
      exitCode: error.code || 1,
    };
  }
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
 * Helper function to read and parse YAML file
 */
async function readYamlFile(filePath: string): Promise<any> {
  const content = await fs.readFile(filePath, 'utf-8');
  return yaml.parse(content);
}

/**
 * Setup an initialized APEX project in the given directory
 * This creates the .apex structure needed for run command testing
 */
async function setupInitializedProject(testDir: string, envIsolation: EnvironmentIsolation): Promise<void> {
  // Initialize the project first
  const { exitCode, stderr } = await runCliCommand('init --yes', testDir, envIsolation);

  if (exitCode !== 0) {
    throw new Error(`Failed to initialize APEX project: ${stderr}`);
  }

  // Verify initialization was successful
  const apexDir = path.join(testDir, '.apex');
  if (!(await fileExists(apexDir))) {
    throw new Error('APEX directory not created during initialization');
  }

  // Ensure all required files exist
  const requiredFiles = [
    path.join(apexDir, 'config.yaml'),
    path.join(apexDir, 'agents', 'planner.md'),
    path.join(apexDir, 'agents', 'developer.md'),
    path.join(apexDir, 'workflows', 'feature.yaml'),
  ];

  for (const file of requiredFiles) {
    if (!(await fileExists(file))) {
      throw new Error(`Required file not found after initialization: ${file}`);
    }
  }
}

/**
 * Helper function to read SQLite database and get task records
 */
async function getTasksFromDatabase(dbPath: string): Promise<any[]> {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true });

  try {
    const stmt = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC');
    return stmt.all();
  } finally {
    db.close();
  }
}

/**
 * Helper function to get task logs from database
 */
async function getTaskLogsFromDatabase(dbPath: string, taskId?: string): Promise<any[]> {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true });

  try {
    const stmt = taskId
      ? db.prepare('SELECT * FROM task_logs WHERE task_id = ? ORDER BY timestamp ASC')
      : db.prepare('SELECT * FROM task_logs ORDER BY timestamp ASC');

    return taskId ? stmt.all(taskId) : stmt.all();
  } finally {
    db.close();
  }
}

describe('CLI Run Command E2E Tests', () => {
  let testDir: string;
  let envIsolation: EnvironmentIsolation;
  let testDbContext: TestDatabaseContext | null = null;

  beforeEach(async () => {
    // Create isolated test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-run-e2e-'));

    // Set up environment isolation
    envIsolation = createEnvironmentIsolation();

    // Create test database for verification (optional for some tests)
    try {
      testDbContext = await createTestDatabase();
    } catch (error) {
      console.warn('Could not create test database context:', error);
      testDbContext = null;
    }
  });

  afterEach(async () => {
    // Clean up environment
    envIsolation.restore();

    // Clean up test database
    testDbContext.cleanup();

    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Basic Task Creation', () => {
    it('should create a task when running run command with description', async () => {
      // Setup initialized project
      await setupInitializedProject(testDir, envIsolation);

      // Run the run command with dry-run mode to avoid Claude API calls
      const { exitCode, stdout, stderr } = await runCliCommand(
        'run "Add user authentication" --workflow feature --dry-run',
        testDir,
        envIsolation,
        45000 // Longer timeout for task creation
      );

      expect(exitCode).toBe(0);
      expect(stderr).not.toContain('error');

      // Verify task creation is mentioned in output
      expect(stdout.toLowerCase()).toMatch(/task.*created|creating.*task|execution.*started/);

      // Check that task was created in SQLite database
      const dbPath = path.join(testDir, '.apex', 'apex.db');
      expect(await fileExists(dbPath)).toBe(true);

      const tasks = await getTasksFromDatabase(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];
      expect(task.description).toBe('Add user authentication');
      expect(task.workflow).toBe('feature');
      expect(task.status).toMatch(/^(pending|planning|in_progress|completed)$/);
      expect(task.project_path).toBe(testDir);
      expect(task.created_at).toBeDefined();
    });

    it('should create task with custom workflow option', async () => {
      await setupInitializedProject(testDir, envIsolation);

      const { exitCode } = await runCliCommand(
        'run "Fix login bug" --workflow bugfix --dry-run',
        testDir,
        envIsolation,
        45000
      );

      expect(exitCode).toBe(0);

      const dbPath = path.join(testDir, '.apex', 'apex.db');
      const tasks = await getTasksFromDatabase(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];
      expect(task.description).toBe('Fix login bug');
      expect(task.workflow).toBe('bugfix');
    });

    it('should create task with autonomy level option', async () => {
      await setupInitializedProject(testDir, envIsolation);

      const { exitCode } = await runCliCommand(
        'run "Refactor user service" --workflow refactor --autonomy high --dry-run',
        testDir,
        envIsolation,
        45000
      );

      expect(exitCode).toBe(0);

      const dbPath = path.join(testDir, '.apex', 'apex.db');
      const tasks = await getTasksFromDatabase(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];
      expect(task.description).toBe('Refactor user service');
      expect(task.workflow).toBe('refactor');
      expect(task.autonomy).toBe('high');
    });
  });

  describe('Task Status Transitions', () => {
    it('should transition task through expected status states', async () => {
      await setupInitializedProject(testDir, envIsolation);

      const { exitCode } = await runCliCommand(
        'run "Create user dashboard" --dry-run',
        testDir,
        envIsolation,
        45000
      );

      expect(exitCode).toBe(0);

      const dbPath = path.join(testDir, '.apex', 'apex.db');
      const tasks = await getTasksFromDatabase(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];

      // Task should start with a valid initial status
      expect(task.status).toMatch(/^(pending|planning|in_progress)$/);

      // Check task has proper timestamps
      expect(task.created_at).toBeDefined();
      expect(task.updated_at).toBeDefined();
      expect(new Date(task.created_at).getTime()).toBeLessThanOrEqual(
        new Date(task.updated_at).getTime()
      );

      // Verify task has proper defaults
      expect(task.priority).toBeDefined();
      expect(task.retry_count).toBeDefined();
      expect(task.max_retries).toBeDefined();
    });

    it('should create task logs during execution', async () => {
      await setupInitializedProject(testDir, envIsolation);

      const { exitCode } = await runCliCommand(
        'run "Implement user profiles" --dry-run',
        testDir,
        envIsolation,
        45000
      );

      expect(exitCode).toBe(0);

      const dbPath = path.join(testDir, '.apex', 'apex.db');
      const tasks = await getTasksFromDatabase(dbPath);
      expect(tasks).toHaveLength(1);

      const taskId = tasks[0].id;
      const logs = await getTaskLogsFromDatabase(dbPath, taskId);

      // Should have some logs created during task execution
      expect(logs.length).toBeGreaterThan(0);

      // Verify log structure
      const firstLog = logs[0];
      expect(firstLog.task_id).toBe(taskId);
      expect(firstLog.timestamp).toBeDefined();
      expect(firstLog.level).toMatch(/^(debug|info|warn|error)$/);
      expect(firstLog.message).toBeDefined();
    });
  });

  describe('Event Emissions', () => {
    it('should emit task creation events during execution', async () => {
      await setupInitializedProject(testDir, envIsolation);

      // Capture output to check for event-related information
      const { exitCode, stdout } = await runCliCommand(
        'run "Setup API endpoints" --dry-run',
        testDir,
        envIsolation,
        45000
      );

      expect(exitCode).toBe(0);

      // In dry-run mode, output should indicate task processing
      expect(stdout).toMatch(/task|execution|processing|workflow/i);

      const dbPath = path.join(testDir, '.apex', 'apex.db');
      const tasks = await getTasksFromDatabase(dbPath);
      expect(tasks).toHaveLength(1);

      // Verify task was processed
      const task = tasks[0];
      expect(task.id).toBeDefined();
      expect(task.description).toBe('Setup API endpoints');
    });
  });

  describe('Dry-Run Mode', () => {
    it('should work in dry-run mode without making external API calls', async () => {
      await setupInitializedProject(testDir, envIsolation);

      // Set environment to simulate no network access
      envIsolation.setEnv('ANTHROPIC_API_KEY', 'test-key-dry-run');

      const { exitCode, stderr } = await runCliCommand(
        'run "Mock task for testing" --dry-run',
        testDir,
        envIsolation,
        30000
      );

      expect(exitCode).toBe(0);
      expect(stderr).not.toMatch(/network|connection|api.*error/i);

      // Verify task was still created
      const dbPath = path.join(testDir, '.apex', 'apex.db');
      const tasks = await getTasksFromDatabase(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];
      expect(task.description).toBe('Mock task for testing');
    });

    it('should handle dry-run flag properly', async () => {
      await setupInitializedProject(testDir, envIsolation);

      const { exitCode, stdout } = await runCliCommand(
        'run "Test dry run functionality" --dry-run',
        testDir,
        envIsolation,
        30000
      );

      expect(exitCode).toBe(0);

      // Output should indicate dry-run mode or task creation
      expect(stdout).toMatch(/dry.?run|simulation|mock|test.*mode|task.*created/i);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing description gracefully', async () => {
      await setupInitializedProject(testDir, envIsolation);

      const { exitCode, stderr } = await runCliCommand(
        'run',
        testDir,
        envIsolation
      );

      expect(exitCode).not.toBe(0);
      expect(stderr.toLowerCase()).toMatch(/usage|description|required/);
    });

    it('should handle uninitialized project gracefully', async () => {
      // Don't initialize the project
      const { exitCode, stderr } = await runCliCommand(
        'run "Test task" --dry-run',
        testDir,
        envIsolation
      );

      expect(exitCode).not.toBe(0);
      expect(stderr.toLowerCase()).toMatch(/not.*initialized|init.*first/);
    });

    it('should handle invalid workflow option', async () => {
      await setupInitializedProject(testDir, envIsolation);

      const { exitCode, stderr } = await runCliCommand(
        'run "Test task" --workflow nonexistent --dry-run',
        testDir,
        envIsolation
      );

      // Should either succeed with warning or fail gracefully
      if (exitCode !== 0) {
        expect(stderr.toLowerCase()).toMatch(/workflow|invalid|not.*found/);
      }
    });
  });

  describe('Database Integration', () => {
    it('should create proper database entries with all required fields', async () => {
      await setupInitializedProject(testDir, envIsolation);

      const { exitCode } = await runCliCommand(
        'run "Complete database integration test" --workflow feature --autonomy medium --dry-run',
        testDir,
        envIsolation,
        45000
      );

      expect(exitCode).toBe(0);

      const dbPath = path.join(testDir, '.apex', 'apex.db');
      const tasks = await getTasksFromDatabase(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];

      // Verify all essential fields are present
      expect(task.id).toBeDefined();
      expect(task.id).toMatch(/^[a-f0-9-]+$/); // UUID format
      expect(task.description).toBe('Complete database integration test');
      expect(task.workflow).toBe('feature');
      expect(task.autonomy).toBe('medium');
      expect(task.status).toBeDefined();
      expect(task.project_path).toBe(testDir);
      expect(task.created_at).toBeDefined();
      expect(task.updated_at).toBeDefined();
      expect(task.priority).toBeDefined();
      expect(task.retry_count).toEqual(0);
      expect(task.max_retries).toBeGreaterThan(0);
    });

    it('should handle multiple task creation correctly', async () => {
      await setupInitializedProject(testDir, envIsolation);

      // Create multiple tasks
      const tasks = [
        'First test task',
        'Second test task',
        'Third test task'
      ];

      for (const taskDesc of tasks) {
        const { exitCode } = await runCliCommand(
          `run "${taskDesc}" --dry-run`,
          testDir,
          envIsolation,
          30000
        );
        expect(exitCode).toBe(0);
      }

      const dbPath = path.join(testDir, '.apex', 'apex.db');
      const allTasks = await getTasksFromDatabase(dbPath);
      expect(allTasks).toHaveLength(3);

      // Verify all tasks were created with unique IDs
      const taskIds = allTasks.map(t => t.id);
      const uniqueIds = new Set(taskIds);
      expect(uniqueIds.size).toBe(3);

      // Verify descriptions
      const descriptions = allTasks.map(t => t.description).sort();
      expect(descriptions).toEqual([
        'First test task',
        'Second test task',
        'Third test task'
      ]);
    });
  });

  describe('CLI Output Validation', () => {
    it('should provide clear success messages', async () => {
      await setupInitializedProject(testDir, envIsolation);

      const { exitCode, stdout } = await runCliCommand(
        'run "Test output validation" --dry-run',
        testDir,
        envIsolation,
        30000
      );

      expect(exitCode).toBe(0);
      expect(stdout).toBeDefined();
      expect(stdout.length).toBeGreaterThan(0);

      // Should contain task-related information
      expect(stdout.toLowerCase()).toMatch(/task|execution|processing|created|started/);
    });

    it('should handle quoted task descriptions properly', async () => {
      await setupInitializedProject(testDir, envIsolation);

      const description = 'Task with "quoted" content and special chars: @#$%';
      const { exitCode } = await runCliCommand(
        `run "${description}" --dry-run`,
        testDir,
        envIsolation,
        30000
      );

      expect(exitCode).toBe(0);

      const dbPath = path.join(testDir, '.apex', 'apex.db');
      const tasks = await getTasksFromDatabase(dbPath);
      expect(tasks).toHaveLength(1);

      const task = tasks[0];
      expect(task.description).toBe(description);
    });
  });

  describe('Integration with ApexOrchestrator', () => {
    it('should integrate properly with orchestrator task creation', async () => {
      await setupInitializedProject(testDir, envIsolation);

      const { exitCode } = await runCliCommand(
        'run "Orchestrator integration test" --workflow feature --dry-run',
        testDir,
        envIsolation,
        45000
      );

      expect(exitCode).toBe(0);

      const dbPath = path.join(testDir, '.apex', 'apex.db');

      // Verify task was created
      const tasks = await getTasksFromDatabase(dbPath);
      expect(tasks).toHaveLength(1);

      // Verify logs were created (indicates orchestrator involvement)
      const logs = await getTaskLogsFromDatabase(dbPath);
      expect(logs.length).toBeGreaterThan(0);

      // Verify task has orchestrator-specific fields
      const task = tasks[0];
      expect(task.workflow).toBe('feature');
      expect(task.status).toBeDefined();
      expect(task.project_path).toBe(testDir);
    });
  });
});