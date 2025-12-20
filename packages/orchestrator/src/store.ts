import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { Task, TaskStatus, TaskPriority, TaskUsage, TaskLog, TaskArtifact, Gate, GateStatus, TaskCheckpoint, SubtaskStrategy } from '@apexcli/core';

export class TaskStore {
  private db!: Database.Database;
  private dbPath: string;

  constructor(projectPath: string) {
    const apexDir = path.join(projectPath, '.apex');
    if (!fs.existsSync(apexDir)) {
      fs.mkdirSync(apexDir, { recursive: true });
    }
    this.dbPath = path.join(apexDir, 'apex.db');
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.createTables();
    this.runMigrations();
  }

  /**
   * Run database migrations
   */
  private runMigrations(): void {
    // Get existing columns in tasks table
    const columns = this.db
      .prepare("PRAGMA table_info(tasks)")
      .all() as { name: string }[];
    const columnNames = new Set(columns.map((c) => c.name));

    // Add missing columns
    const migrations: { column: string; definition: string }[] = [
      { column: 'parent_task_id', definition: 'TEXT' },
      { column: 'subtask_ids', definition: 'TEXT' },
      { column: 'subtask_strategy', definition: 'TEXT' },
      { column: 'priority', definition: "TEXT DEFAULT 'normal'" },
      // Rate limit pause support (v0.3.0)
      { column: 'paused_at', definition: 'TEXT' },
      { column: 'resume_after', definition: 'TEXT' },
      { column: 'pause_reason', definition: 'TEXT' },
      // v0.4.0 enhancements
      { column: 'workspace_config', definition: 'TEXT' },
      { column: 'session_data', definition: 'TEXT' },
      { column: 'last_checkpoint', definition: 'TEXT' },
    ];

    for (const { column, definition } of migrations) {
      if (!columnNames.has(column)) {
        try {
          this.db.exec(`ALTER TABLE tasks ADD COLUMN ${column} ${definition}`);
        } catch {
          // Column might already exist or table doesn't exist yet
        }
      }
    }
  }

  /**
   * Create database tables
   */
  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        acceptance_criteria TEXT,
        workflow TEXT NOT NULL,
        autonomy TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT DEFAULT 'normal',
        current_stage TEXT,
        project_path TEXT NOT NULL,
        branch_name TEXT,
        pr_url TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
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
        -- v0.4.0 enhancements
        workspace_config TEXT,
        session_data TEXT,
        last_checkpoint TEXT
      );

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

      CREATE TABLE IF NOT EXISTS commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        command TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      );

      CREATE TABLE IF NOT EXISTS task_dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        depends_on_task_id TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id),
        UNIQUE(task_id, depends_on_task_id)
      );

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

      -- v0.4.0 Tables
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

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_id ON task_artifacts(task_id);
      CREATE INDEX IF NOT EXISTS idx_gates_task_id ON gates(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);
      CREATE INDEX IF NOT EXISTS idx_task_checkpoints_task_id ON task_checkpoints(task_id);
      -- v0.4.0 Indexes
      CREATE INDEX IF NOT EXISTS idx_thought_captures_status ON thought_captures(status);
      CREATE INDEX IF NOT EXISTS idx_thought_captures_priority ON thought_captures(priority);
      CREATE INDEX IF NOT EXISTS idx_thought_captures_task_id ON thought_captures(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_interactions_task_id ON task_interactions(task_id);
      CREATE INDEX IF NOT EXISTS idx_workspace_info_task_id ON workspace_info(task_id);
      CREATE INDEX IF NOT EXISTS idx_idle_tasks_status ON idle_tasks(implemented);
    `);
  }

  /**
   * Create a new task
   */
  async createTask(task: Task): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, description, acceptance_criteria, workflow, autonomy, status, priority,
        current_stage, project_path, branch_name, retry_count, max_retries, created_at, updated_at,
        usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost,
        parent_task_id, subtask_ids, subtask_strategy,
        workspace_config, session_data, last_checkpoint
      ) VALUES (
        @id, @description, @acceptanceCriteria, @workflow, @autonomy, @status, @priority,
        @currentStage, @projectPath, @branchName, @retryCount, @maxRetries, @createdAt, @updatedAt,
        @inputTokens, @outputTokens, @totalTokens, @estimatedCost,
        @parentTaskId, @subtaskIds, @subtaskStrategy,
        @workspaceConfig, @sessionData, @lastCheckpoint
      )
    `);

    stmt.run({
      id: task.id,
      description: task.description,
      acceptanceCriteria: task.acceptanceCriteria || null,
      workflow: task.workflow,
      autonomy: task.autonomy,
      status: task.status,
      priority: task.priority || 'normal',
      currentStage: task.currentStage || null,
      projectPath: task.projectPath,
      branchName: task.branchName || null,
      retryCount: task.retryCount || 0,
      maxRetries: task.maxRetries || 3,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      inputTokens: task.usage.inputTokens,
      outputTokens: task.usage.outputTokens,
      totalTokens: task.usage.totalTokens,
      estimatedCost: task.usage.estimatedCost,
      parentTaskId: task.parentTaskId || null,
      subtaskIds: task.subtaskIds && task.subtaskIds.length > 0 ? JSON.stringify(task.subtaskIds) : null,
      subtaskStrategy: task.subtaskStrategy || null,
      // v0.4.0 fields
      workspaceConfig: task.workspace ? JSON.stringify(task.workspace) : null,
      sessionData: task.sessionData ? JSON.stringify(task.sessionData) : null,
      lastCheckpoint: task.sessionData?.lastCheckpoint?.toISOString() || null,
    });

    // Insert dependencies if any
    if (task.dependsOn && task.dependsOn.length > 0) {
      const depStmt = this.db.prepare(`
        INSERT INTO task_dependencies (task_id, depends_on_task_id)
        VALUES (@taskId, @dependsOnTaskId)
      `);

      for (const depId of task.dependsOn) {
        depStmt.run({ taskId: task.id, dependsOnTaskId: depId });
      }
    }
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = stmt.get(taskId) as TaskRow | undefined;

    if (!row) return null;

    const logs = await this.getTaskLogs(taskId);
    const artifacts = await this.getTaskArtifacts(taskId);
    const dependsOn = await this.getTaskDependencies(taskId);
    const blockedBy = await this.getBlockingTasks(taskId);

    return this.rowToTask(row, logs, artifacts, dependsOn, blockedBy);
  }

  /**
   * Update a task
   */
  async updateTask(
    taskId: string,
    updates: Partial<{
      status: TaskStatus;
      priority: TaskPriority;
      currentStage: string;
      error: string;
      usage: TaskUsage;
      updatedAt: Date;
      completedAt: Date;
      prUrl: string;
      retryCount: number;
      parentTaskId: string;
      subtaskIds: string[];
      subtaskStrategy: SubtaskStrategy;
      dependsOn: string[];
      blockedBy: string[];
      pausedAt: Date | undefined;
      resumeAfter: Date | undefined;
      pauseReason: string | undefined;
    }>
  ): Promise<void> {
    const setClauses: string[] = [];
    const params: Record<string, unknown> = { id: taskId };

    if (updates.status !== undefined) {
      setClauses.push('status = @status');
      params.status = updates.status;
    }

    if (updates.priority !== undefined) {
      setClauses.push('priority = @priority');
      params.priority = updates.priority;
    }

    if (updates.currentStage !== undefined) {
      setClauses.push('current_stage = @currentStage');
      params.currentStage = updates.currentStage;
    }

    if (updates.error !== undefined) {
      setClauses.push('error = @error');
      params.error = updates.error;
    }

    if (updates.usage !== undefined) {
      setClauses.push('usage_input_tokens = @inputTokens');
      setClauses.push('usage_output_tokens = @outputTokens');
      setClauses.push('usage_total_tokens = @totalTokens');
      setClauses.push('usage_estimated_cost = @estimatedCost');
      params.inputTokens = updates.usage.inputTokens;
      params.outputTokens = updates.usage.outputTokens;
      params.totalTokens = updates.usage.totalTokens;
      params.estimatedCost = updates.usage.estimatedCost;
    }

    if (updates.updatedAt !== undefined) {
      setClauses.push('updated_at = @updatedAt');
      params.updatedAt = updates.updatedAt.toISOString();
    }

    if (updates.completedAt !== undefined) {
      setClauses.push('completed_at = @completedAt');
      params.completedAt = updates.completedAt.toISOString();
    }

    if (updates.prUrl !== undefined) {
      setClauses.push('pr_url = @prUrl');
      params.prUrl = updates.prUrl;
    }

    if (updates.retryCount !== undefined) {
      setClauses.push('retry_count = @retryCount');
      params.retryCount = updates.retryCount;
    }

    if (updates.parentTaskId !== undefined) {
      setClauses.push('parent_task_id = @parentTaskId');
      params.parentTaskId = updates.parentTaskId;
    }

    if (updates.subtaskIds !== undefined) {
      setClauses.push('subtask_ids = @subtaskIds');
      params.subtaskIds = updates.subtaskIds.length > 0 ? JSON.stringify(updates.subtaskIds) : null;
    }

    if (updates.subtaskStrategy !== undefined) {
      setClauses.push('subtask_strategy = @subtaskStrategy');
      params.subtaskStrategy = updates.subtaskStrategy;
    }

    // Handle dependency updates (update the task_dependencies table)
    if (updates.dependsOn !== undefined) {
      // Clear existing dependencies
      this.db.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(taskId);

      // Insert new dependencies
      if (updates.dependsOn.length > 0) {
        const depStmt = this.db.prepare(`
          INSERT INTO task_dependencies (task_id, depends_on_task_id)
          VALUES (@taskId, @dependsOnTaskId)
        `);
        for (const depId of updates.dependsOn) {
          depStmt.run({ taskId, dependsOnTaskId: depId });
        }
      }
    }

    // Handle pause-related fields (allow setting to null/undefined to clear them)
    if ('pausedAt' in updates) {
      setClauses.push('paused_at = @pausedAt');
      params.pausedAt = updates.pausedAt ? updates.pausedAt.toISOString() : null;
    }

    if ('resumeAfter' in updates) {
      setClauses.push('resume_after = @resumeAfter');
      params.resumeAfter = updates.resumeAfter ? updates.resumeAfter.toISOString() : null;
    }

    if ('pauseReason' in updates) {
      setClauses.push('pause_reason = @pauseReason');
      params.pauseReason = updates.pauseReason ?? null;
    }

    if (setClauses.length === 0) return;

    const sql = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = @id`;
    this.db.prepare(sql).run(params);
  }

  /**
   * List tasks
   */
  async listTasks(options?: { status?: TaskStatus; limit?: number; orderByPriority?: boolean }): Promise<Task[]> {
    let sql = 'SELECT * FROM tasks';
    const params: unknown[] = [];

    if (options?.status) {
      sql += ' WHERE status = ?';
      params.push(options.status);
    }

    if (options?.orderByPriority) {
      // Order by priority (urgent > high > normal > low), then by creation date
      sql += ` ORDER BY CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END ASC, created_at ASC`;
    } else {
      sql += ' ORDER BY created_at DESC';
    }

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as TaskRow[];

    const tasks: Task[] = [];
    for (const row of rows) {
      const logs = await this.getTaskLogs(row.id);
      const artifacts = await this.getTaskArtifacts(row.id);
      const dependsOn = await this.getTaskDependencies(row.id);
      const blockedBy = await this.getBlockingTasks(row.id);
      tasks.push(this.rowToTask(row, logs, artifacts, dependsOn, blockedBy));
    }

    return tasks;
  }

  /**
   * Get the next pending task from the queue based on priority
   * Respects task dependencies - only returns tasks with no blockers
   */
  async getNextQueuedTask(): Promise<Task | null> {
    const readyTasks = await this.getReadyTasks({
      limit: 1,
      orderByPriority: true,
    });

    return readyTasks[0] || null;
  }

  /**
   * Get the next pending task (legacy - ignores dependencies)
   */
  async getNextQueuedTaskIgnoreDeps(): Promise<Task | null> {
    const tasks = await this.listTasks({
      status: 'pending',
      limit: 1,
      orderByPriority: true,
    });

    return tasks[0] || null;
  }

  /**
   * Queue a task (set to pending with optional priority)
   */
  async queueTask(taskId: string, priority?: TaskPriority): Promise<void> {
    const updates: Partial<{ status: TaskStatus; priority: TaskPriority; updatedAt: Date }> = {
      status: 'pending',
      updatedAt: new Date(),
    };

    if (priority) {
      updates.priority = priority;
    }

    await this.updateTask(taskId, updates);
  }

  /**
   * Add a log entry
   */
  async addLog(taskId: string, log: Omit<TaskLog, 'timestamp'> & { timestamp?: Date }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO task_logs (task_id, timestamp, level, stage, agent, message, metadata)
      VALUES (@taskId, @timestamp, @level, @stage, @agent, @message, @metadata)
    `);

    stmt.run({
      taskId,
      timestamp: (log.timestamp || new Date()).toISOString(),
      level: log.level,
      stage: log.stage || null,
      agent: log.agent || null,
      message: log.message,
      metadata: log.metadata ? JSON.stringify(log.metadata) : null,
    });
  }

  /**
   * Get task logs (internal)
   */
  private async getTaskLogs(taskId: string): Promise<TaskLog[]> {
    return this.getLogs(taskId);
  }

  /**
   * Get task logs (public)
   */
  async getLogs(taskId: string, options?: { level?: string; limit?: number; offset?: number }): Promise<TaskLog[]> {
    let sql = 'SELECT * FROM task_logs WHERE task_id = ?';
    const params: unknown[] = [taskId];

    if (options?.level) {
      sql += ' AND level = ?';
      params.push(options.level);
    }

    sql += ' ORDER BY timestamp DESC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
      if (options?.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as TaskLogRow[];

    return rows.map((row) => ({
      timestamp: new Date(row.timestamp),
      level: row.level as TaskLog['level'],
      stage: row.stage || undefined,
      agent: row.agent || undefined,
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * Add an artifact
   */
  async addArtifact(taskId: string, artifact: Omit<TaskArtifact, 'createdAt'>): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO task_artifacts (task_id, name, type, path, content, created_at)
      VALUES (@taskId, @name, @type, @path, @content, @createdAt)
    `);

    stmt.run({
      taskId,
      name: artifact.name,
      type: artifact.type,
      path: artifact.path || null,
      content: artifact.content || null,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Get task artifacts
   */
  private async getTaskArtifacts(taskId: string): Promise<TaskArtifact[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM task_artifacts WHERE task_id = ? ORDER BY created_at ASC'
    );
    const rows = stmt.all(taskId) as TaskArtifactRow[];

    return rows.map((row) => ({
      name: row.name,
      type: row.type as TaskArtifact['type'],
      path: row.path || undefined,
      content: row.content || undefined,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Log a command execution
   */
  async logCommand(taskId: string, command: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO commands (task_id, timestamp, command)
      VALUES (@taskId, @timestamp, @command)
    `);

    stmt.run({
      taskId,
      timestamp: new Date().toISOString(),
      command,
    });
  }

  /**
   * Create or update a gate
   */
  async setGate(taskId: string, gate: Omit<Gate, 'taskId'>): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO gates (task_id, name, status, required_at, responded_at, approver, comment)
      VALUES (@taskId, @name, @status, @requiredAt, @respondedAt, @approver, @comment)
      ON CONFLICT(task_id, name) DO UPDATE SET
        status = @status,
        responded_at = @respondedAt,
        approver = @approver,
        comment = @comment
    `);

    stmt.run({
      taskId,
      name: gate.name,
      status: gate.status,
      requiredAt: gate.requiredAt.toISOString(),
      respondedAt: gate.respondedAt?.toISOString() || null,
      approver: gate.approver || null,
      comment: gate.comment || null,
    });
  }

  /**
   * Get a gate
   */
  async getGate(taskId: string, gateName: string): Promise<Gate | null> {
    const stmt = this.db.prepare('SELECT * FROM gates WHERE task_id = ? AND name = ?');
    const row = stmt.get(taskId, gateName) as GateRow | undefined;

    if (!row) return null;

    return {
      taskId: row.task_id,
      name: row.name,
      status: row.status as GateStatus,
      requiredAt: new Date(row.required_at),
      respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
      approver: row.approver || undefined,
      comment: row.comment || undefined,
    };
  }

  /**
   * Approve a gate
   */
  async approveGate(taskId: string, gateName: string, approver: string, comment?: string): Promise<void> {
    await this.setGate(taskId, {
      name: gateName,
      status: 'approved',
      requiredAt: new Date(), // Will be ignored due to ON CONFLICT
      respondedAt: new Date(),
      approver,
      comment,
    });
  }

  /**
   * Reject a gate
   */
  async rejectGate(taskId: string, gateName: string, rejector: string, comment?: string): Promise<void> {
    await this.setGate(taskId, {
      name: gateName,
      status: 'rejected',
      requiredAt: new Date(), // Will be ignored due to ON CONFLICT
      respondedAt: new Date(),
      approver: rejector,
      comment,
    });
  }

  /**
   * Get all pending gates for a task
   */
  async getPendingGates(taskId: string): Promise<Gate[]> {
    const stmt = this.db.prepare('SELECT * FROM gates WHERE task_id = ? AND status = ?');
    const rows = stmt.all(taskId, 'pending') as GateRow[];

    return rows.map((row) => ({
      taskId: row.task_id,
      name: row.name,
      status: row.status as GateStatus,
      requiredAt: new Date(row.required_at),
      respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
      approver: row.approver || undefined,
      comment: row.comment || undefined,
    }));
  }

  /**
   * Get all gates for a task
   */
  async getAllGates(taskId: string): Promise<Gate[]> {
    const stmt = this.db.prepare('SELECT * FROM gates WHERE task_id = ? ORDER BY required_at DESC');
    const rows = stmt.all(taskId) as GateRow[];

    return rows.map((row) => ({
      taskId: row.task_id,
      name: row.name,
      status: row.status as GateStatus,
      requiredAt: new Date(row.required_at),
      respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
      approver: row.approver || undefined,
      comment: row.comment || undefined,
    }));
  }

  /**
   * Convert database row to Task object
   */
  private rowToTask(
    row: TaskRow,
    logs: TaskLog[],
    artifacts: TaskArtifact[],
    dependsOn?: string[],
    blockedBy?: string[]
  ): Task {
    return {
      id: row.id,
      description: row.description,
      acceptanceCriteria: row.acceptance_criteria || undefined,
      workflow: row.workflow,
      autonomy: row.autonomy as Task['autonomy'],
      status: row.status as TaskStatus,
      priority: (row.priority || 'normal') as Task['priority'],
      currentStage: row.current_stage || undefined,
      projectPath: row.project_path,
      branchName: row.branch_name || undefined,
      prUrl: row.pr_url || undefined,
      retryCount: row.retry_count || 0,
      maxRetries: row.max_retries || 3,
      dependsOn: dependsOn || [],
      blockedBy: blockedBy || [],
      parentTaskId: row.parent_task_id || undefined,
      subtaskIds: row.subtask_ids ? JSON.parse(row.subtask_ids) : [],
      subtaskStrategy: row.subtask_strategy as SubtaskStrategy || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      pausedAt: row.paused_at ? new Date(row.paused_at) : undefined,
      resumeAfter: row.resume_after ? new Date(row.resume_after) : undefined,
      pauseReason: row.pause_reason || undefined,
      usage: {
        inputTokens: row.usage_input_tokens,
        outputTokens: row.usage_output_tokens,
        totalTokens: row.usage_total_tokens,
        estimatedCost: row.usage_estimated_cost,
      },
      logs,
      artifacts,
      error: row.error || undefined,
    };
  }

  // ============================================================================
  // Task Dependencies
  // ============================================================================

  /**
   * Get task dependencies (task IDs this task depends on)
   */
  async getTaskDependencies(taskId: string): Promise<string[]> {
    const stmt = this.db.prepare(
      'SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?'
    );
    const rows = stmt.all(taskId) as { depends_on_task_id: string }[];
    return rows.map(r => r.depends_on_task_id);
  }

  /**
   * Get blocking tasks (incomplete tasks that this task depends on)
   */
  async getBlockingTasks(taskId: string): Promise<string[]> {
    const stmt = this.db.prepare(`
      SELECT d.depends_on_task_id
      FROM task_dependencies d
      JOIN tasks t ON t.id = d.depends_on_task_id
      WHERE d.task_id = ?
      AND t.status NOT IN ('completed', 'cancelled')
    `);
    const rows = stmt.all(taskId) as { depends_on_task_id: string }[];
    return rows.map(r => r.depends_on_task_id);
  }

  /**
   * Check if a task is ready to run (all dependencies completed)
   */
  async isTaskReady(taskId: string): Promise<boolean> {
    const blockers = await this.getBlockingTasks(taskId);
    return blockers.length === 0;
  }

  /**
   * Add a dependency to a task
   */
  async addDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id)
      VALUES (@taskId, @dependsOnTaskId)
    `);
    stmt.run({ taskId, dependsOnTaskId });
  }

  /**
   * Remove a dependency from a task
   */
  async removeDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM task_dependencies
      WHERE task_id = ? AND depends_on_task_id = ?
    `);
    stmt.run(taskId, dependsOnTaskId);
  }

  /**
   * Get dependent tasks (tasks that depend on this task)
   */
  async getDependentTasks(taskId: string): Promise<string[]> {
    const stmt = this.db.prepare(
      'SELECT task_id FROM task_dependencies WHERE depends_on_task_id = ?'
    );
    const rows = stmt.all(taskId) as { task_id: string }[];
    return rows.map(r => r.task_id);
  }

  /**
   * Get tasks that are ready to run (pending with no blockers)
   */
  async getReadyTasks(options?: { limit?: number; orderByPriority?: boolean }): Promise<Task[]> {
    let sql = `
      SELECT t.*
      FROM tasks t
      WHERE t.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM task_dependencies d
        JOIN tasks dep ON dep.id = d.depends_on_task_id
        WHERE d.task_id = t.id
        AND dep.status NOT IN ('completed', 'cancelled')
      )
    `;

    if (options?.orderByPriority) {
      sql += ` ORDER BY CASE t.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END ASC, t.created_at ASC`;
    } else {
      sql += ' ORDER BY t.created_at ASC';
    }

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as TaskRow[];

    const tasks: Task[] = [];
    for (const row of rows) {
      const logs = await this.getTaskLogs(row.id);
      const artifacts = await this.getTaskArtifacts(row.id);
      const dependsOn = await this.getTaskDependencies(row.id);
      const blockedBy = await this.getBlockingTasks(row.id);
      tasks.push(this.rowToTask(row, logs, artifacts, dependsOn, blockedBy));
    }

    return tasks;
  }

  // ============================================================================
  // Task Checkpoints
  // ============================================================================

  /**
   * Save a checkpoint for a task
   */
  async saveCheckpoint(checkpoint: TaskCheckpoint): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO task_checkpoints (task_id, checkpoint_id, stage, stage_index, conversation_state, metadata, created_at)
      VALUES (@taskId, @checkpointId, @stage, @stageIndex, @conversationState, @metadata, @createdAt)
      ON CONFLICT(task_id, checkpoint_id) DO UPDATE SET
        stage = @stage,
        stage_index = @stageIndex,
        conversation_state = @conversationState,
        metadata = @metadata,
        created_at = @createdAt
    `);
    stmt.run({
      taskId: checkpoint.taskId,
      checkpointId: checkpoint.checkpointId,
      stage: checkpoint.stage || null,
      stageIndex: checkpoint.stageIndex,
      conversationState: checkpoint.conversationState ? JSON.stringify(checkpoint.conversationState) : null,
      metadata: checkpoint.metadata ? JSON.stringify(checkpoint.metadata) : null,
      createdAt: checkpoint.createdAt.toISOString(),
    });
  }

  /**
   * Get the latest checkpoint for a task
   */
  async getLatestCheckpoint(taskId: string): Promise<TaskCheckpoint | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM task_checkpoints
      WHERE task_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(taskId) as CheckpointRow | undefined;

    if (!row) return null;

    return this.rowToCheckpoint(row);
  }

  /**
   * Get a specific checkpoint by ID
   */
  async getCheckpoint(taskId: string, checkpointId: string): Promise<TaskCheckpoint | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM task_checkpoints
      WHERE task_id = ? AND checkpoint_id = ?
    `);
    const row = stmt.get(taskId, checkpointId) as CheckpointRow | undefined;

    if (!row) return null;

    return this.rowToCheckpoint(row);
  }

  /**
   * List all checkpoints for a task
   */
  async listCheckpoints(taskId: string): Promise<TaskCheckpoint[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM task_checkpoints
      WHERE task_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(taskId) as CheckpointRow[];

    return rows.map(row => this.rowToCheckpoint(row));
  }

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(taskId: string, checkpointId: string): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM task_checkpoints
      WHERE task_id = ? AND checkpoint_id = ?
    `);
    stmt.run(taskId, checkpointId);
  }

  /**
   * Delete all checkpoints for a task
   */
  async deleteAllCheckpoints(taskId: string): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM task_checkpoints
      WHERE task_id = ?
    `);
    stmt.run(taskId);
  }

  /**
   * Convert a checkpoint row to a TaskCheckpoint
   */
  private rowToCheckpoint(row: CheckpointRow): TaskCheckpoint {
    return {
      taskId: row.task_id,
      checkpointId: row.checkpoint_id,
      stage: row.stage || undefined,
      stageIndex: row.stage_index || 0,
      conversationState: row.conversation_state ? JSON.parse(row.conversation_state) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

// Database row types
interface TaskRow {
  id: string;
  description: string;
  acceptance_criteria: string | null;
  workflow: string;
  autonomy: string;
  status: string;
  priority: string | null;
  current_stage: string | null;
  project_path: string;
  branch_name: string | null;
  pr_url: string | null;
  retry_count: number | null;
  max_retries: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  usage_input_tokens: number;
  usage_output_tokens: number;
  usage_total_tokens: number;
  usage_estimated_cost: number;
  error: string | null;
  parent_task_id: string | null;
  subtask_ids: string | null;
  subtask_strategy: string | null;
  paused_at: string | null;
  resume_after: string | null;
  pause_reason: string | null;
}

interface TaskLogRow {
  id: number;
  task_id: string;
  timestamp: string;
  level: string;
  stage: string | null;
  agent: string | null;
  message: string;
  metadata: string | null;
}

interface TaskArtifactRow {
  id: number;
  task_id: string;
  name: string;
  type: string;
  path: string | null;
  content: string | null;
  created_at: string;
}

interface GateRow {
  id: number;
  task_id: string;
  name: string;
  status: string;
  required_at: string;
  responded_at: string | null;
  approver: string | null;
  comment: string | null;
}

interface CheckpointRow {
  id: number;
  task_id: string;
  checkpoint_id: string;
  stage: string | null;
  stage_index: number | null;
  conversation_state: string | null;
  metadata: string | null;
  created_at: string;
}
