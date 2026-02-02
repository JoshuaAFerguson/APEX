import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';
import type { Task, TaskStatus, TaskUsage } from '@apexcli/core';
import { TaskStore } from './store.js';

/**
 * Creates a temporary directory for testing
 * @returns The path to the temporary directory
 */
export function createTempDirectory(): string {
  // For simplicity, return a synchronous temp path - will be created in beforeEach
  return '';
}

/**
 * Creates a temporary directory asynchronously
 * @param prefix Optional prefix for the temp directory name
 * @returns Promise resolving to the path of the temporary directory
 */
export async function createTempDirectoryAsync(prefix = 'apex-test-'): Promise<string> {
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
  return testDir;
}

/**
 * Removes a temporary directory and all its contents
 * @param dirPath Path to the directory to remove
 */
export async function removeTempDirectory(dirPath: string): Promise<void> {
  if (dirPath && dirPath !== '/' && dirPath.includes('tmp')) {
    await fs.rm(dirPath, { recursive: true, force: true });
  }
}

/**
 * Helper to remove a temporary directory synchronously (placeholder)
 * @param dirPath Path to the directory to remove
 */
export function removeTempDirectorySync(dirPath: string): void {
  // This will be handled by the async version in afterEach
}

// ============================================================================
// In-Memory SQLite Test Database Utilities
// ============================================================================

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
 * import { createTestDatabase, cleanupTestDatabase } from '../test-utils';
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

  // Create all tables matching TaskStore schema
  createTaskStoreTables(db);

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
 * Creates all TaskStore tables in the given database.
 * This mirrors the schema from TaskStore.createTables() and runMigrations().
 *
 * @param db - The SQLite database instance
 */
function createTaskStoreTables(db: Database.Database): void {
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
 * Helper to create a mock task for testing.
 * All required fields are populated with sensible defaults.
 *
 * @param overrides - Optional partial task to override defaults
 * @returns A complete Task object suitable for testing
 */
export function createMockTask(overrides: Partial<Task> = {}): Task {
  const now = new Date();
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending' as TaskStatus,
    priority: 'normal',
    effort: 'medium',
    projectPath: '/test/project',
    branchName: 'apex/test-branch',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: now,
    updatedAt: now,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      totalCostCents: 0,
      executionTimeMs: 0,
    } as TaskUsage,
    logs: [],
    artifacts: [],
    dependsOn: [],
    blockedBy: [],
    ...overrides,
  };
}

/**
 * Re-export Database type for convenience in tests
 */
export type { Database };

// Re-export MCP test utilities for convenience
export * from './test-utils-mcp.js';

// ============================================================================
// Permission Test Database Utilities
// ============================================================================

import { PermissionStore } from './permission-store';
import { PermissionManager } from './permission-manager';
import type { Permission, ExtendedPermission } from '@apexcli/core';

/**
 * Context returned by createTestPermissionStore containing the store, manager, and cleanup function
 */
export interface TestPermissionStoreContext {
  /** The PermissionStore instance with in-memory database */
  store: PermissionStore;
  /** The PermissionManager instance wrapping the store */
  manager: PermissionManager;
  /** Cleanup function to close the database - call in afterEach */
  cleanup: () => void;
  /** The temporary project path used for the store */
  tempPath: string;
}

/**
 * Creates an in-memory permission store with PermissionManager for testing.
 *
 * @param initialPermissions - Optional array of permissions to pre-populate the store
 * @returns TestPermissionStoreContext with store, manager, and cleanup function
 *
 * @example
 * ```typescript
 * import { createTestPermissionStore } from '../test-utils';
 * import { createMockPermission } from '@apexcli/core/test-utils';
 *
 * describe('Permission tests', () => {
 *   let testPermissions: TestPermissionStoreContext;
 *
 *   beforeEach(async () => {
 *     testPermissions = await createTestPermissionStore([
 *       createMockPermission({ tool: 'Read', level: 'allow-always' }),
 *       createMockPermission({ tool: 'Write', level: 'allow-once' })
 *     ]);
 *   });
 *
 *   afterEach(() => {
 *     testPermissions.cleanup();
 *   });
 *
 *   it('should manage permissions', async () => {
 *     const permission = await testPermissions.manager.checkPermission('Read');
 *     expect(permission).toBe('allow-always');
 *   });
 * });
 * ```
 */
export async function createTestPermissionStore(initialPermissions: Permission[] = []): Promise<TestPermissionStoreContext> {
  // Create temporary directory for the test store
  const tempPath = await createTempDirectoryAsync('apex-test-permission-');

  // Create store with temporary directory
  const store = new PermissionStore(tempPath);
  await store.initialize();

  // Create manager
  const manager = new PermissionManager(store);

  // Populate with initial permissions if provided
  for (const permission of initialPermissions) {
    await store.savePermission(permission);
  }

  return {
    store,
    manager,
    tempPath,
    cleanup: () => {
      if (store) {
        store.close();
      }
      // Clean up temp directory asynchronously
      removeTempDirectory(tempPath).catch(console.error);
    },
  };
}

/**
 * Creates a test permission store with common permission scenarios
 *
 * @param scenario - The permission scenario to create ('read-only', 'full-access', 'review-all', 'mixed')
 * @returns TestPermissionStoreContext pre-populated with scenario permissions
 *
 * @example
 * ```typescript
 * const { manager, cleanup } = await createPermissionScenarioStore('read-only');
 *
 * const readResult = await manager.checkPermission('Read');
 * expect(readResult).toBe('allow-always');
 *
 * const writeResult = await manager.checkPermission('Write');
 * expect(writeResult).toBe('deny');
 *
 * cleanup();
 * ```
 */
export async function createPermissionScenarioStore(
  scenario: 'read-only' | 'full-access' | 'review-all' | 'mixed'
): Promise<TestPermissionStoreContext> {
  const { createCommonPermissionScenarios } = await import('@apexcli/core/test-utils');
  const scenarios = createCommonPermissionScenarios();

  const scenarioMap = {
    'read-only': scenarios.readOnly,
    'full-access': scenarios.fullAccess,
    'review-all': scenarios.reviewAll,
    'mixed': scenarios.mixed,
  };

  const permissions = Object.values(scenarioMap[scenario]);
  return createTestPermissionStore(permissions);
}

/**
 * Helper to populate a permission store with test data for different tools
 *
 * @param store - The PermissionStore to populate
 * @param toolPermissions - Map of tool names to permission levels
 *
 * @example
 * ```typescript
 * const { store, cleanup } = await createTestPermissionStore();
 *
 * await populateTestPermissions(store, {
 *   'Read': 'allow-always',
 *   'Write': 'allow-once',
 *   'Bash': 'deny'
 * });
 *
 * const readPerm = await store.getPermission('Read');
 * expect(readPerm?.level).toBe('allow-always');
 *
 * cleanup();
 * ```
 */
export async function populateTestPermissions(
  store: PermissionStore,
  toolPermissions: Record<string, 'allow-always' | 'allow-once' | 'deny'>
): Promise<void> {
  const { createMockPermission } = await import('@apexcli/core/test-utils');

  for (const [tool, level] of Object.entries(toolPermissions)) {
    const permission = createMockPermission({ tool, level });
    await store.savePermission(permission);
  }
}

/**
 * Creates a mock permission manager for testing without database operations
 *
 * @param permissions - Map of tool names to permission levels for quick setup
 * @returns Mock PermissionManager with predefined permissions
 *
 * @example
 * ```typescript
 * const mockManager = createMockPermissionManager({
 *   'Read': 'allow-always',
 *   'Write': 'allow-once',
 *   'Bash': 'deny'
 * });
 *
 * const readLevel = await mockManager.checkPermission('Read');
 * expect(readLevel).toBe('allow-always');
 * ```
 */
export function createMockPermissionManager(permissions: Record<string, 'allow-always' | 'allow-once' | 'deny'> = {}) {
  return {
    async checkPermission(tool: string, scope?: string): Promise<'allow-always' | 'allow-once' | 'deny' | null> {
      const scopeKey = scope ? `${tool}:${scope}` : tool;
      return permissions[scopeKey] || permissions[tool] || null;
    },

    async grantPermission(tool: string, level: 'allow-always' | 'allow-once' | 'deny', scope?: string): Promise<void> {
      const key = scope ? `${tool}:${scope}` : tool;
      permissions[key] = level;
    },

    async hasPermission(tool: string, scope?: string): Promise<boolean> {
      const level = await this.checkPermission(tool, scope);
      return level !== null && level !== 'deny';
    },

    async isAllowed(tool: string, scope?: string): Promise<boolean> {
      const level = await this.checkPermission(tool, scope);
      return level === 'allow-always' || level === 'allow-once';
    },

    async requiresConfirmation(tool: string, scope?: string): Promise<boolean> {
      const level = await this.checkPermission(tool, scope);
      return level === 'allow-once';
    },

    clearSessionCache(): void {
      // Mock implementation - no-op
    },

    // Access to internal permissions for testing
    _getPermissions(): Record<string, 'allow-always' | 'allow-once' | 'deny'> {
      return { ...permissions };
    }
  };
}

/**
 * Cleans up a test permission store context by closing connections and removing temp files.
 * Safe to call multiple times.
 *
 * @param context - The TestPermissionStoreContext to clean up
 */
export async function cleanupTestPermissionStore(context: TestPermissionStoreContext): Promise<void> {
  if (context && context.store) {
    context.store.close();
  }
  if (context && context.tempPath) {
    await removeTempDirectory(context.tempPath);
  }
}

/**
 * Create a comprehensive permission testing environment with both store and manager
 *
 * @param options - Configuration options for the test environment
 * @returns Complete testing environment with utilities
 *
 * @example
 * ```typescript
 * describe('Permission integration tests', () => {
 *   let testEnv: PermissionTestEnvironment;
 *
 *   beforeEach(async () => {
 *     testEnv = await createPermissionTestEnvironment({
 *       initialPermissions: [
 *         createMockPermission({ tool: 'Read', level: 'allow-always' })
 *       ],
 *       mockConfirmation: true
 *     });
 *   });
 *
 *   afterEach(async () => {
 *     await testEnv.cleanup();
 *   });
 *
 *   it('should handle permission requests', async () => {
 *     await testEnv.assertPermissionLevel('Read', 'allow-always');
 *   });
 * });
 * ```
 */
export interface PermissionTestEnvironment {
  /** Permission store instance */
  store: PermissionStore;
  /** Permission manager instance */
  manager: PermissionManager;
  /** Temporary directory path */
  tempPath: string;
  /** Clean up resources */
  cleanup: () => Promise<void>;
  /** Assert permission level for a tool */
  assertPermissionLevel: (tool: string, expectedLevel: 'allow-always' | 'allow-once' | 'deny' | null, scope?: string) => Promise<void>;
  /** Assert tool is allowed */
  assertToolAllowed: (tool: string, scope?: string) => Promise<void>;
  /** Assert tool is denied */
  assertToolDenied: (tool: string, scope?: string) => Promise<void>;
  /** Assert tool requires confirmation */
  assertToolRequiresConfirmation: (tool: string, scope?: string) => Promise<void>;
  /** Add a permission for testing */
  addPermission: (permission: Permission) => Promise<void>;
  /** Remove a permission */
  removePermission: (tool: string, scope?: string) => Promise<void>;
  /** Get all permissions */
  getAllPermissions: () => Promise<Permission[]>;
}

export async function createPermissionTestEnvironment(options: {
  initialPermissions?: Permission[];
  mockConfirmation?: boolean | Record<string, boolean>;
} = {}): Promise<PermissionTestEnvironment> {
  const { initialPermissions = [], mockConfirmation = false } = options;

  // Create the test permission store
  const testContext = await createTestPermissionStore(initialPermissions);

  // Configure confirmation handler if requested
  if (mockConfirmation) {
    // This would need to be implemented in PermissionManager
    // For now, we'll just document this as a feature that could be added
  }

  return {
    store: testContext.store,
    manager: testContext.manager,
    tempPath: testContext.tempPath,
    cleanup: testContext.cleanup,

    async assertPermissionLevel(tool: string, expectedLevel: 'allow-always' | 'allow-once' | 'deny' | null, scope?: string): Promise<void> {
      const actualLevel = await testContext.manager.checkPermission(tool, scope);
      if (actualLevel !== expectedLevel) {
        throw new Error(`Expected permission level ${expectedLevel} for ${tool}${scope ? `:${scope}` : ''}, got ${actualLevel}`);
      }
    },

    async assertToolAllowed(tool: string, scope?: string): Promise<void> {
      const allowed = await testContext.manager.isAllowed(tool, scope);
      if (!allowed) {
        throw new Error(`Tool ${tool}${scope ? `:${scope}` : ''} should be allowed but is denied`);
      }
    },

    async assertToolDenied(tool: string, scope?: string): Promise<void> {
      const allowed = await testContext.manager.isAllowed(tool, scope);
      if (allowed) {
        const level = await testContext.manager.checkPermission(tool, scope);
        throw new Error(`Tool ${tool}${scope ? `:${scope}` : ''} should be denied but is allowed with level ${level}`);
      }
    },

    async assertToolRequiresConfirmation(tool: string, scope?: string): Promise<void> {
      const requiresConfirm = await testContext.manager.requiresConfirmation(tool, scope);
      if (!requiresConfirm) {
        const level = await testContext.manager.checkPermission(tool, scope);
        throw new Error(`Tool ${tool}${scope ? `:${scope}` : ''} should require confirmation but has level ${level}`);
      }
    },

    async addPermission(permission: Permission): Promise<void> {
      await testContext.store.savePermission(permission);
    },

    async removePermission(tool: string, scope?: string): Promise<void> {
      await testContext.store.deletePermission({ tool, scope });
    },

    async getAllPermissions(): Promise<Permission[]> {
      return testContext.store.listPermissions();
    },
  };
}

/**
 * Helper to assert database state for permissions testing
 *
 * @param store - The permission store to check
 * @param expectedPermissions - Array of expected permission objects
 *
 * @example
 * ```typescript
 * await assertDatabaseState(store, [
 *   { tool: 'Read', level: 'allow-always', scope: undefined },
 *   { tool: 'Write', level: 'allow-once', scope: '/project/**' }
 * ]);
 * ```
 */
export async function assertDatabaseState(
  store: PermissionStore,
  expectedPermissions: Array<{ tool: string; level: 'allow-always' | 'allow-once' | 'deny'; scope?: string }>
): Promise<void> {
  const actualPermissions = await store.listPermissions();

  if (actualPermissions.length !== expectedPermissions.length) {
    throw new Error(`Expected ${expectedPermissions.length} permissions in database, got ${actualPermissions.length}`);
  }

  for (const expected of expectedPermissions) {
    const actual = actualPermissions.find(p =>
      p.tool === expected.tool && p.scope === expected.scope
    );

    if (!actual) {
      throw new Error(`Expected permission for ${expected.tool}${expected.scope ? `:${expected.scope}` : ''} not found in database`);
    }

    if (actual.level !== expected.level) {
      throw new Error(`Permission for ${expected.tool}${expected.scope ? `:${expected.scope}` : ''} has wrong level. Expected: ${expected.level}, got: ${actual.level}`);
    }
  }
}

/**
 * Helper to create permission test scenarios with database verification
 *
 * @param scenario - The test scenario to set up
 * @returns Test environment configured for the scenario
 *
 * @example
 * ```typescript
 * const testEnv = await createPermissionTestScenario('read-only');
 *
 * // Verify read operations are allowed
 * await testEnv.assertToolAllowed('Read');
 * await testEnv.assertToolAllowed('Grep');
 *
 * // Verify write operations are denied
 * await testEnv.assertToolDenied('Write');
 * await testEnv.assertToolDenied('Bash');
 *
 * await testEnv.cleanup();
 * ```
 */
export async function createPermissionTestScenario(
  scenario: 'read-only' | 'full-access' | 'review-all' | 'mixed' | 'empty'
): Promise<PermissionTestEnvironment> {
  if (scenario === 'empty') {
    return createPermissionTestEnvironment();
  }

  const testContext = await createPermissionScenarioStore(scenario);

  return {
    store: testContext.store,
    manager: testContext.manager,
    tempPath: testContext.tempPath,
    cleanup: testContext.cleanup,

    async assertPermissionLevel(tool: string, expectedLevel: 'allow-always' | 'allow-once' | 'deny' | null, scope?: string): Promise<void> {
      const actualLevel = await testContext.manager.checkPermission(tool, scope);
      if (actualLevel !== expectedLevel) {
        throw new Error(`Expected permission level ${expectedLevel} for ${tool}${scope ? `:${scope}` : ''}, got ${actualLevel}`);
      }
    },

    async assertToolAllowed(tool: string, scope?: string): Promise<void> {
      const allowed = await testContext.manager.isAllowed(tool, scope);
      if (!allowed) {
        throw new Error(`Tool ${tool}${scope ? `:${scope}` : ''} should be allowed but is denied`);
      }
    },

    async assertToolDenied(tool: string, scope?: string): Promise<void> {
      const allowed = await testContext.manager.isAllowed(tool, scope);
      if (allowed) {
        const level = await testContext.manager.checkPermission(tool, scope);
        throw new Error(`Tool ${tool}${scope ? `:${scope}` : ''} should be denied but is allowed with level ${level}`);
      }
    },

    async assertToolRequiresConfirmation(tool: string, scope?: string): Promise<void> {
      const requiresConfirm = await testContext.manager.requiresConfirmation(tool, scope);
      if (!requiresConfirm) {
        const level = await testContext.manager.checkPermission(tool, scope);
        throw new Error(`Tool ${tool}${scope ? `:${scope}` : ''} should require confirmation but has level ${level}`);
      }
    },

    async addPermission(permission: Permission): Promise<void> {
      await testContext.store.savePermission(permission);
    },

    async removePermission(tool: string, scope?: string): Promise<void> {
      await testContext.store.deletePermission({ tool, scope });
    },

    async getAllPermissions(): Promise<Permission[]> {
      return testContext.store.listPermissions();
    },
  };
}

// ============================================================================
// Task Fixture Seed Functions
// ============================================================================

/**
 * Context returned by createTestTaskStore containing the store and cleanup function
 */
export interface TestTaskStoreContext {
  /** The TaskStore instance with a temp directory database */
  store: TaskStore;
  /** The underlying SQLite database instance */
  db: Database.Database;
  /** Cleanup function to close DB and remove temp files - call in afterEach */
  cleanup: () => Promise<void>;
  /** The temporary directory used for the store */
  tempPath: string;
}

/**
 * Creates a TaskStore backed by a temporary directory for testing.
 * Provides full TaskStore functionality with real SQLite (file-based in temp dir).
 *
 * @returns TestTaskStoreContext with store, database, and cleanup function
 *
 * @example
 * ```typescript
 * describe('TaskStore tests', () => {
 *   let ctx: TestTaskStoreContext;
 *
 *   beforeEach(async () => {
 *     ctx = await createTestTaskStore();
 *   });
 *
 *   afterEach(async () => {
 *     await ctx.cleanup();
 *   });
 *
 *   it('should seed a completed task', async () => {
 *     const task = await seedCompletedTask(ctx.store);
 *     expect(task.status).toBe('completed');
 *   });
 * });
 * ```
 */
export async function createTestTaskStore(): Promise<TestTaskStoreContext> {
  const tempPath = await createTempDirectoryAsync('apex-test-store-');
  const store = new TaskStore(tempPath);
  await store.initialize();

  return {
    store,
    db: store.getDatabase(),
    tempPath,
    cleanup: async () => {
      try {
        store.close();
      } catch {
        // Already closed
      }
      await removeTempDirectory(tempPath);
    },
  };
}

/**
 * Seeds a pending task into the store.
 *
 * @param store - The TaskStore to seed into
 * @param overrides - Optional partial Task to override defaults
 * @returns The created Task as read back from the store
 */
export async function seedPendingTask(store: TaskStore, overrides: Partial<Task> = {}): Promise<Task> {
  const task = createMockTask({
    description: 'Pending test task',
    status: 'pending',
    ...overrides,
  });

  await store.createTask(task);
  const result = await store.getTask(task.id);
  return result!;
}

/**
 * Seeds a running task into the store.
 * The task transitions from pending -> running with a current stage.
 *
 * @param store - The TaskStore to seed into
 * @param overrides - Optional partial Task to override defaults
 * @returns The created Task as read back from the store
 */
export async function seedRunningTask(store: TaskStore, overrides: Partial<Task> = {}): Promise<Task> {
  const task = createMockTask({
    description: 'Running test task',
    status: 'pending',
    ...overrides,
  });

  await store.createTask(task);
  await store.updateTaskStatus(task.id, 'running', overrides.currentStage || 'development');
  const result = await store.getTask(task.id);
  return result!;
}

/**
 * Seeds a completed task into the store.
 * The task transitions from pending -> running -> completed with realistic usage data.
 *
 * @param store - The TaskStore to seed into
 * @param overrides - Optional partial Task to override defaults
 * @returns The created Task as read back from the store
 */
export async function seedCompletedTask(store: TaskStore, overrides: Partial<Task> = {}): Promise<Task> {
  const task = createMockTask({
    description: 'Completed test task',
    status: 'pending',
    usage: {
      inputTokens: 5000,
      outputTokens: 3000,
      totalTokens: 8000,
      estimatedCost: 0.15,
      totalCostCents: 15,
      executionTimeMs: 45000,
    },
    ...overrides,
  });

  await store.createTask(task);
  await store.updateTaskStatus(task.id, 'running', 'development');
  await store.updateTaskStatus(task.id, 'completed');
  const result = await store.getTask(task.id);
  return result!;
}

/**
 * Seeds a failed task into the store.
 * The task transitions from pending -> running -> failed with an error message.
 *
 * @param store - The TaskStore to seed into
 * @param overrides - Optional partial Task to override defaults
 * @returns The created Task as read back from the store
 */
export async function seedFailedTask(store: TaskStore, overrides: Partial<Task> = {}): Promise<Task> {
  const task = createMockTask({
    description: 'Failed test task',
    status: 'pending',
    ...overrides,
  });

  await store.createTask(task);
  await store.updateTaskStatus(task.id, 'running', 'testing');
  await store.updateTaskStatus(task.id, 'failed', undefined, 'Test execution failed: assertion error');
  const result = await store.getTask(task.id);
  return result!;
}

/**
 * Seeds a paused task into the store.
 * The task transitions from pending -> running -> paused with a pause reason.
 *
 * @param store - The TaskStore to seed into
 * @param overrides - Optional partial Task to override defaults
 * @returns The created Task as read back from the store
 */
export async function seedPausedTask(store: TaskStore, overrides: Partial<Task> = {}): Promise<Task> {
  const task = createMockTask({
    description: 'Paused test task',
    status: 'pending',
    ...overrides,
  });

  await store.createTask(task);
  await store.updateTaskStatus(task.id, 'running', 'development');
  await store.updateTaskStatus(task.id, 'paused', undefined, 'Rate limit exceeded');
  const result = await store.getTask(task.id);
  return result!;
}

/**
 * Seeds a cancelled task into the store.
 * The task transitions from pending -> cancelled.
 *
 * @param store - The TaskStore to seed into
 * @param overrides - Optional partial Task to override defaults
 * @returns The created Task as read back from the store
 */
export async function seedCancelledTask(store: TaskStore, overrides: Partial<Task> = {}): Promise<Task> {
  const task = createMockTask({
    description: 'Cancelled test task',
    status: 'pending',
    ...overrides,
  });

  await store.createTask(task);
  await store.updateTaskStatus(task.id, 'cancelled', undefined, 'Cancelled by user');
  const result = await store.getTask(task.id);
  return result!;
}

/**
 * Pre-defined multi-task scenarios for integration testing.
 */
export type TaskScenario = 'mixed-statuses' | 'dependency-chain' | 'subtask-tree' | 'retry-exhausted';

/**
 * Seeds a multi-task scenario into the store.
 *
 * Scenarios:
 * - **mixed-statuses**: One task per status (pending, running, completed, failed, paused, cancelled)
 * - **dependency-chain**: 3 tasks where B depends on A, C depends on B
 * - **subtask-tree**: Parent task with 3 subtasks in different states
 * - **retry-exhausted**: Task that has reached maxRetries with multiple retry attempts
 *
 * @param store - The TaskStore to seed into
 * @param scenario - The scenario to create
 * @returns Array of created tasks
 *
 * @example
 * ```typescript
 * const tasks = await seedTaskScenario(store, 'mixed-statuses');
 * expect(tasks).toHaveLength(6);
 * expect(tasks.map(t => t.status)).toContain('completed');
 * ```
 */
export async function seedTaskScenario(store: TaskStore, scenario: TaskScenario): Promise<Task[]> {
  switch (scenario) {
    case 'mixed-statuses': {
      const tasks = await Promise.all([
        seedPendingTask(store, { description: 'Scenario: pending task' }),
        seedRunningTask(store, { description: 'Scenario: running task' }),
        seedCompletedTask(store, { description: 'Scenario: completed task' }),
        seedFailedTask(store, { description: 'Scenario: failed task' }),
        seedPausedTask(store, { description: 'Scenario: paused task' }),
        seedCancelledTask(store, { description: 'Scenario: cancelled task' }),
      ]);
      return tasks;
    }

    case 'dependency-chain': {
      const taskA = await seedCompletedTask(store, { description: 'Chain: task A (root)' });
      const taskB = await seedRunningTask(store, {
        description: 'Chain: task B (depends on A)',
        dependsOn: [taskA.id],
      });
      const taskC = await seedPendingTask(store, {
        description: 'Chain: task C (depends on B)',
        dependsOn: [taskB.id],
      });
      return [taskA, taskB, taskC];
    }

    case 'subtask-tree': {
      // Create subtasks first to get their IDs
      const sub1 = await seedCompletedTask(store, { description: 'Subtask 1: completed' });
      const sub2 = await seedRunningTask(store, { description: 'Subtask 2: running' });
      const sub3 = await seedPendingTask(store, { description: 'Subtask 3: pending' });

      // Create parent with subtask references
      const parent = await seedRunningTask(store, {
        description: 'Parent task with subtasks',
        subtaskIds: [sub1.id, sub2.id, sub3.id],
        subtaskStrategy: 'parallel',
      });

      return [parent, sub1, sub2, sub3];
    }

    case 'retry-exhausted': {
      const task = createMockTask({
        description: 'Retry exhausted task',
        status: 'pending',
        retryCount: 3,
        maxRetries: 3,
      });

      await store.createTask(task);
      await store.updateTaskStatus(task.id, 'running', 'testing');
      await store.updateTaskStatus(task.id, 'failed', undefined, 'Max retries exceeded');
      const result = await store.getTask(task.id);
      return [result!];
    }
  }
}