/**
 * SQLite test database setup/teardown utility module
 *
 * This module provides utilities to create and manage in-memory SQLite databases
 * for testing purposes. It initializes the complete TaskStore schema and provides
 * cleanup functions for proper test isolation.
 */

import Database = require('better-sqlite3');

/**
 * Context returned by createTestDatabase containing the database and cleanup function
 */
export interface TestDatabaseContext {
  /** The in-memory SQLite database instance */
  db: Database.Database;
  /** Cleanup function to close the database - call in afterEach */
  cleanup: () => void;
}

/**
 * Creates an in-memory SQLite database with the same schema as TaskStore.
 * This is useful for testing database operations without file I/O overhead.
 *
 * @returns TestDatabaseContext with the database instance and cleanup function
 *
 * @example
 * ```typescript
 * import { createTestDatabase, cleanupTestDatabase } from './test-utils/db';
 *
 * describe('My tests', () => {
 *   let testDb: TestDatabaseContext;
 *
 *   beforeEach(async () => {
 *     testDb = await createTestDatabase();
 *   });
 *
 *   afterEach(() => {
 *     cleanupTestDatabase(testDb);
 *   });
 *
 *   it('should work with the database', () => {
 *     const stmt = testDb.db.prepare('SELECT * FROM tasks');
 *     const tasks = stmt.all();
 *     expect(tasks).toEqual([]);
 *   });
 * });
 * ```
 */
export async function createTestDatabase(): Promise<TestDatabaseContext> {
  const db = new Database(':memory:');

  // Set pragmas to match TaskStore behavior
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF');

  // Initialize the TaskStore schema
  initializeSchema(db);

  return {
    db,
    cleanup: () => {
      if (db.open) {
        db.close();
      }
    },
  };
}

/**
 * Cleans up a test database context by closing the database connection.
 * Safe to call multiple times - will only close if the database is still open.
 *
 * @param context - The TestDatabaseContext to clean up
 */
export function cleanupTestDatabase(context: TestDatabaseContext): void {
  if (context && context.db && context.db.open) {
    context.db.close();
  }
}

/**
 * Initializes the complete TaskStore schema in the given database.
 * This mirrors the schema from TaskStore.createTables() and runMigrations().
 *
 * @param db - The SQLite database instance
 */
function initializeSchema(db: Database.Database): void {
  db.exec(`
    -- Core tasks table
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      acceptance_criteria TEXT,
      workflow TEXT NOT NULL,
      autonomy TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      effort TEXT DEFAULT 'medium',
      current_stage TEXT,
      project_path TEXT NOT NULL,
      branch_name TEXT,
      pr_url TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      resume_attempts INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      usage_input_tokens INTEGER DEFAULT 0,
      usage_output_tokens INTEGER DEFAULT 0,
      usage_total_tokens INTEGER DEFAULT 0,
      usage_estimated_cost REAL DEFAULT 0,
      error TEXT,
      parent_task_id TEXT,
      subtask_ids TEXT,
      subtask_strategy TEXT,
      paused_at TEXT,
      resume_after TEXT,
      pause_reason TEXT,
      workspace_config TEXT,
      session_data TEXT,
      last_checkpoint TEXT,
      trashed_at TEXT,
      archived_at TEXT
    );

    -- Task logs
    CREATE TABLE IF NOT EXISTS task_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL,
      stage TEXT,
      agent TEXT,
      message TEXT NOT NULL,
      metadata TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    -- Task artifacts
    CREATE TABLE IF NOT EXISTS task_artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      path TEXT,
      content TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    -- Gates for approval workflows
    CREATE TABLE IF NOT EXISTS gates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      required_at TEXT NOT NULL,
      responded_at TEXT,
      approver TEXT,
      comment TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      UNIQUE(task_id, name)
    );

    -- Commands history
    CREATE TABLE IF NOT EXISTS commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      command TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    -- Task dependencies
    CREATE TABLE IF NOT EXISTS task_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      depends_on_task_id TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id),
      UNIQUE(task_id, depends_on_task_id)
    );

    -- Task checkpoints for resume
    CREATE TABLE IF NOT EXISTS task_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      checkpoint_id TEXT NOT NULL,
      stage TEXT,
      stage_index INTEGER DEFAULT 0,
      conversation_state TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      UNIQUE(task_id, checkpoint_id)
    );

    -- Thought captures (v0.4.0)
    CREATE TABLE IF NOT EXISTS thought_captures (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      tags TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      task_id TEXT,
      created_at TEXT NOT NULL,
      implemented_at TEXT,
      status TEXT NOT NULL DEFAULT 'captured',
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    -- Task interactions
    CREATE TABLE IF NOT EXISTS task_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      command TEXT NOT NULL,
      parameters TEXT,
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      processed_at TEXT,
      result TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    -- Workspace info
    CREATE TABLE IF NOT EXISTS workspace_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      strategy TEXT NOT NULL,
      workspace_path TEXT NOT NULL,
      config TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_accessed TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      UNIQUE(task_id)
    );

    -- Idle tasks for background processing
    CREATE TABLE IF NOT EXISTS idle_tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL,
      estimated_effort TEXT NOT NULL,
      suggested_workflow TEXT NOT NULL,
      rationale TEXT NOT NULL,
      created_at TEXT NOT NULL,
      implemented BOOLEAN DEFAULT 0,
      implemented_task_id TEXT,
      FOREIGN KEY (implemented_task_id) REFERENCES tasks(id)
    );

    -- Task iterations for feedback loop
    CREATE TABLE IF NOT EXISTS task_iterations (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      feedback TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      diff_summary TEXT,
      stage TEXT,
      modified_files TEXT,
      agent TEXT,
      before_state TEXT,
      after_state TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    -- Task templates
    CREATE TABLE IF NOT EXISTS task_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      workflow TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      effort TEXT NOT NULL DEFAULT 'medium',
      acceptance_criteria TEXT,
      tags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Todos
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      content TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')),
      active_form TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    -- Approval states (v0.5.0)
    CREATE TABLE IF NOT EXISTS approval_states (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      gate_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
      approver TEXT,
      requested_at TEXT NOT NULL,
      responded_at TEXT,
      comment TEXT,
      context TEXT,
      stage TEXT,
      agent TEXT,
      approvals_received INTEGER DEFAULT 0,
      approvals_required INTEGER DEFAULT 1,
      timeout_minutes INTEGER,
      expires_at TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    -- File snapshots for tool actions (v0.5.0)
    CREATE TABLE IF NOT EXISTS file_snapshots (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      content TEXT NOT NULL,
      checksum TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      last_modified TEXT NOT NULL,
      snapshot_time TEXT NOT NULL,
      metadata TEXT
    );

    -- Tool actions tracking (v0.5.0)
    CREATE TABLE IF NOT EXISTS tool_actions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      execution_call_id TEXT NOT NULL,
      execution_tool_name TEXT NOT NULL,
      execution_input TEXT NOT NULL,
      execution_agent_name TEXT,
      execution_stage_name TEXT,
      execution_start_time TEXT NOT NULL,
      execution_end_time TEXT,
      execution_duration INTEGER,
      execution_result TEXT,
      execution_error TEXT,
      execution_status TEXT NOT NULL DEFAULT 'completed',
      modified_files TEXT NOT NULL DEFAULT '[]',
      before_snapshots TEXT NOT NULL DEFAULT '[]',
      after_snapshots TEXT NOT NULL DEFAULT '[]',
      can_undo INTEGER NOT NULL DEFAULT 1,
      was_undone INTEGER NOT NULL DEFAULT 0,
      undone_at TEXT,
      undo_error TEXT,
      sequence_number INTEGER NOT NULL,
      action_group TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    -- Snapshots (v0.5.0)
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      action_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      file_snapshots TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      description TEXT,
      can_undo INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      UNIQUE(task_id, action_id)
    );

    -- Permissions (v0.5.0)
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      tool_name TEXT NOT NULL,
      scope TEXT,
      level TEXT NOT NULL CHECK (level IN ('allow-always', 'allow-once', 'deny')),
      expires_at TEXT,
      created_at TEXT NOT NULL,
      config TEXT,
      grant_reason TEXT,
      granted_by TEXT,
      tags TEXT
    );

    -- MCP marketplace cache (v0.5.0)
    CREATE TABLE IF NOT EXISTS mcp_marketplace (
      name TEXT PRIMARY KEY,
      description TEXT,
      version TEXT,
      author TEXT,
      homepage TEXT,
      repository TEXT,
      install_command TEXT,
      server_config TEXT NOT NULL,
      capabilities TEXT,
      verified INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    -- MCP servers registry (v0.5.0)
    CREATE TABLE IF NOT EXISTS mcp_servers (
      name TEXT PRIMARY KEY,
      config TEXT NOT NULL,
      installed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- MCP installations (v0.5.0)
    CREATE TABLE IF NOT EXISTS mcp_installations (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      installed_at TEXT NOT NULL,
      status TEXT NOT NULL,
      version TEXT,
      FOREIGN KEY (server_id) REFERENCES mcp_servers(name)
    );

    -- Fix attempts tracking (v0.5.0)
    CREATE TABLE IF NOT EXISTS fix_attempts (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      error_hash TEXT NOT NULL,
      error_message TEXT NOT NULL,
      error_category TEXT NOT NULL,
      error_file_path TEXT,
      error_line INTEGER,
      error_column INTEGER,
      error_code TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      approach TEXT NOT NULL,
      agent TEXT,
      stage TEXT,
      before_state TEXT,
      after_state TEXT,
      result_success INTEGER NOT NULL DEFAULT 0,
      result_resolved INTEGER NOT NULL DEFAULT 0,
      result_reason TEXT,
      result_new_errors TEXT,
      delay_applied_ms INTEGER,
      metadata TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    -- Audit logs (v0.5.0)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('debug', 'info', 'warn', 'error', 'critical')),
      timestamp TEXT NOT NULL,
      actor TEXT NOT NULL,
      message TEXT NOT NULL,
      stage TEXT,
      agent TEXT,
      metadata TEXT,
      previous_state TEXT,
      new_state TEXT,
      duration_ms INTEGER,
      success INTEGER NOT NULL DEFAULT 1,
      error TEXT,
      correlation_id TEXT,
      session_id TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- Create all indexes
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_id ON task_artifacts(task_id);
    CREATE INDEX IF NOT EXISTS idx_gates_task_id ON gates(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);
    CREATE INDEX IF NOT EXISTS idx_task_checkpoints_task_id ON task_checkpoints(task_id);
    CREATE INDEX IF NOT EXISTS idx_thought_captures_status ON thought_captures(status);
    CREATE INDEX IF NOT EXISTS idx_thought_captures_priority ON thought_captures(priority);
    CREATE INDEX IF NOT EXISTS idx_thought_captures_task_id ON thought_captures(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_interactions_task_id ON task_interactions(task_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_info_task_id ON workspace_info(task_id);
    CREATE INDEX IF NOT EXISTS idx_idle_tasks_status ON idle_tasks(implemented);
    CREATE INDEX IF NOT EXISTS idx_task_iterations_task_id ON task_iterations(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_templates_name ON task_templates(name);
    CREATE INDEX IF NOT EXISTS idx_task_templates_workflow ON task_templates(workflow);
    CREATE INDEX IF NOT EXISTS idx_todos_task_id ON todos(task_id);
    CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
    CREATE INDEX IF NOT EXISTS idx_todos_order ON todos(task_id, order_index);
    CREATE INDEX IF NOT EXISTS idx_approval_states_task_id ON approval_states(task_id);
    CREATE INDEX IF NOT EXISTS idx_approval_states_status ON approval_states(status);
    CREATE INDEX IF NOT EXISTS idx_approval_states_gate_name ON approval_states(gate_name);
    CREATE INDEX IF NOT EXISTS idx_approval_states_requested_at ON approval_states(requested_at);
    CREATE INDEX IF NOT EXISTS idx_file_snapshots_path ON file_snapshots(file_path);
    CREATE INDEX IF NOT EXISTS idx_file_snapshots_checksum ON file_snapshots(checksum);
    CREATE INDEX IF NOT EXISTS idx_file_snapshots_time ON file_snapshots(snapshot_time);
    CREATE INDEX IF NOT EXISTS idx_tool_actions_task_id ON tool_actions(task_id);
    CREATE INDEX IF NOT EXISTS idx_tool_actions_sequence ON tool_actions(task_id, sequence_number);
    CREATE INDEX IF NOT EXISTS idx_tool_actions_tool_name ON tool_actions(execution_tool_name);
    CREATE INDEX IF NOT EXISTS idx_tool_actions_can_undo ON tool_actions(can_undo);
    CREATE INDEX IF NOT EXISTS idx_tool_actions_was_undone ON tool_actions(was_undone);
    CREATE INDEX IF NOT EXISTS idx_tool_actions_created ON tool_actions(created_at);
    CREATE INDEX IF NOT EXISTS idx_snapshots_task_id ON snapshots(task_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_action_id ON snapshots(action_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_tool_name ON snapshots(tool_name);
    CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON snapshots(timestamp);
    CREATE INDEX IF NOT EXISTS idx_permissions_tool_scope ON permissions(tool_name, scope);
    CREATE INDEX IF NOT EXISTS idx_permissions_level ON permissions(level);
    CREATE INDEX IF NOT EXISTS idx_permissions_expires_at ON permissions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_mcp_marketplace_verified ON mcp_marketplace(verified);
    CREATE INDEX IF NOT EXISTS idx_mcp_servers_updated_at ON mcp_servers(updated_at);
    CREATE INDEX IF NOT EXISTS idx_fix_attempts_task_id ON fix_attempts(task_id);
    CREATE INDEX IF NOT EXISTS idx_fix_attempts_error_hash ON fix_attempts(error_hash);
    CREATE INDEX IF NOT EXISTS idx_fix_attempts_started_at ON fix_attempts(started_at);
    CREATE INDEX IF NOT EXISTS idx_fix_attempts_error_category ON fix_attempts(error_category);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON audit_logs(task_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id ON audit_logs(correlation_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);
  `);
}

/**
 * Creates a TaskStore instance that uses a test database context.
 * This provides a more integrated approach for testing TaskStore operations.
 *
 * @param testDb - The test database context
 * @param projectPath - Optional project path (defaults to '/tmp/test')
 * @returns TaskStore instance using the test database
 *
 * @example
 * ```typescript
 * const testDb = await createTestDatabase();
 * const taskStore = createTaskStoreWithTestDb(testDb);
 * // Use taskStore for testing...
 * testDb.cleanup();
 * ```
 */
export function createTaskStoreWithTestDb(testDb: TestDatabaseContext, projectPath = '/tmp/test'): any {
  // Import TaskStore dynamically to avoid circular dependencies
  const { TaskStore } = require('../store');
  const store = new TaskStore(projectPath);

  // Replace the database instance with our test database
  (store as any).db = testDb.db;
  (store as any).dbPath = ':memory:';

  return store;
}

/**
 * Re-export Database type for convenience in tests
 */
export type { Database };