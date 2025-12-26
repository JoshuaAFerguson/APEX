import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskEffort,
  TaskUsage,
  TaskLog,
  TaskArtifact,
  Gate,
  GateStatus,
  TaskCheckpoint,
  SubtaskStrategy,
  CreateTaskRequest,
  AutonomyLevel,
  TaskSessionData,
  WorkspaceConfig,
  IdleTask,
  IdleTaskType,
  generateTaskId,
  generateIdleTaskId,
} from '@apexcli/core';

export class TaskStore {
  private db!: Database.Database;
  private dbPath: string;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
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
      { column: 'resume_attempts', definition: 'INTEGER DEFAULT 0' },
      // Rate limit pause support (v0.3.0)
      { column: 'paused_at', definition: 'TEXT' },
      { column: 'resume_after', definition: 'TEXT' },
      { column: 'pause_reason', definition: 'TEXT' },
      // v0.4.0 enhancements
      { column: 'workspace_config', definition: 'TEXT' },
      { column: 'session_data', definition: 'TEXT' },
      { column: 'last_checkpoint', definition: 'TEXT' },
      { column: 'effort', definition: "TEXT DEFAULT 'medium'" },
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
  async createTask(task: Task): Promise<Task>;
  async createTask(task: CreateTaskRequest): Promise<Task>;
  async createTask(task: Task | CreateTaskRequest): Promise<Task> {
    const normalizedTask = 'id' in task ? task : this.buildTaskFromRequest(task);
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, description, acceptance_criteria, workflow, autonomy, status, priority, effort,
        current_stage, project_path, branch_name, pr_url, retry_count, max_retries, resume_attempts,
        created_at, updated_at, completed_at, paused_at, resume_after, pause_reason,
        usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost,
        parent_task_id, subtask_ids, subtask_strategy,
        workspace_config, session_data, last_checkpoint
      ) VALUES (
        @id, @description, @acceptanceCriteria, @workflow, @autonomy, @status, @priority, @effort,
        @currentStage, @projectPath, @branchName, @prUrl, @retryCount, @maxRetries, @resumeAttempts,
        @createdAt, @updatedAt, @completedAt, @pausedAt, @resumeAfter, @pauseReason,
        @inputTokens, @outputTokens, @totalTokens, @estimatedCost,
        @parentTaskId, @subtaskIds, @subtaskStrategy,
        @workspaceConfig, @sessionData, @lastCheckpoint
      )
    `);

    stmt.run({
      id: normalizedTask.id,
      description: normalizedTask.description,
      acceptanceCriteria: normalizedTask.acceptanceCriteria || null,
      workflow: normalizedTask.workflow,
      autonomy: normalizedTask.autonomy,
      status: normalizedTask.status,
      priority: normalizedTask.priority || 'normal',
      effort: normalizedTask.effort || 'medium',
      currentStage: normalizedTask.currentStage || null,
      projectPath: normalizedTask.projectPath,
      branchName: normalizedTask.branchName || null,
      prUrl: normalizedTask.prUrl || null,
      retryCount: normalizedTask.retryCount || 0,
      maxRetries: normalizedTask.maxRetries || 3,
      resumeAttempts: normalizedTask.resumeAttempts || 0,
      createdAt: normalizedTask.createdAt.toISOString(),
      updatedAt: normalizedTask.updatedAt.toISOString(),
      completedAt: normalizedTask.completedAt ? normalizedTask.completedAt.toISOString() : null,
      pausedAt: normalizedTask.pausedAt ? normalizedTask.pausedAt.toISOString() : null,
      resumeAfter: normalizedTask.resumeAfter ? normalizedTask.resumeAfter.toISOString() : null,
      pauseReason: normalizedTask.pauseReason ?? null,
      inputTokens: normalizedTask.usage.inputTokens,
      outputTokens: normalizedTask.usage.outputTokens,
      totalTokens: normalizedTask.usage.totalTokens,
      estimatedCost: normalizedTask.usage.estimatedCost,
      parentTaskId: normalizedTask.parentTaskId || null,
      subtaskIds: normalizedTask.subtaskIds && normalizedTask.subtaskIds.length > 0
        ? JSON.stringify(normalizedTask.subtaskIds)
        : null,
      subtaskStrategy: normalizedTask.subtaskStrategy || null,
      // v0.4.0 fields
      workspaceConfig: normalizedTask.workspace ? JSON.stringify(normalizedTask.workspace) : null,
      sessionData: normalizedTask.sessionData ? JSON.stringify(normalizedTask.sessionData) : null,
      lastCheckpoint: normalizedTask.sessionData?.lastCheckpoint?.toISOString() || null,
    });

    // Insert dependencies if any
    if (normalizedTask.dependsOn && normalizedTask.dependsOn.length > 0) {
      const depStmt = this.db.prepare(`
        INSERT INTO task_dependencies (task_id, depends_on_task_id)
        VALUES (@taskId, @dependsOnTaskId)
      `);

      for (const depId of normalizedTask.dependsOn) {
        depStmt.run({ taskId: normalizedTask.id, dependsOnTaskId: depId });
      }
    }

    return normalizedTask;
  }

  private buildTaskFromRequest(request: CreateTaskRequest): Task {
    const now = new Date();
    const autonomy = (request.autonomy || 'review-before-merge') as AutonomyLevel;
    const priority = request.priority || 'normal';
    const effort = request.effort || 'medium';

    return {
      id: generateTaskId(),
      description: request.description,
      acceptanceCriteria: request.acceptanceCriteria,
      workflow: request.workflow || 'feature',
      autonomy,
      status: 'pending',
      priority,
      effort,
      projectPath: request.projectPath || this.projectPath,
      retryCount: 0,
      maxRetries: 3,
      resumeAttempts: 0,
      dependsOn: [],
      blockedBy: [],
      createdAt: now,
      updatedAt: now,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
      logs: [],
      artifacts: [],
    };
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
      effort: TaskEffort;
      currentStage: string;
      error: string;
      usage: TaskUsage;
      updatedAt: Date;
      completedAt: Date;
      prUrl: string;
      retryCount: number;
      resumeAttempts: number;
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

    if (updates.effort !== undefined) {
      setClauses.push('effort = @effort');
      params.effort = updates.effort;
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

    if (updates.resumeAttempts !== undefined) {
      setClauses.push('resume_attempts = @resumeAttempts');
      params.resumeAttempts = updates.resumeAttempts;
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
      // Order by priority (urgent > high > normal > low), then by effort (lower effort preferred), then by creation date
      sql += ` ORDER BY CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END ASC, CASE effort
        WHEN 'xs' THEN 1
        WHEN 'small' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'large' THEN 4
        WHEN 'xl' THEN 5
        ELSE 3
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

  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    return this.listTasks({ status });
  }

  async getAllTasks(): Promise<Task[]> {
    return this.listTasks();
  }

  /**
   * Get tasks that are stuck in 'in-progress' status but haven't been updated recently.
   * These are potential orphaned tasks from crashed daemon instances.
   *
   * @param stalenessThresholdMs - Tasks not updated within this period are considered stale (default: 1 hour)
   * @returns Array of stale in-progress tasks
   */
  async getOrphanedTasks(stalenessThresholdMs: number = 3600000): Promise<Task[]> {
    const cutoffTime = new Date(Date.now() - stalenessThresholdMs).toISOString();

    const sql = `
      SELECT t.*
      FROM tasks t
      WHERE t.status = 'in-progress'
      AND t.updated_at < ?
      ORDER BY t.updated_at ASC
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(cutoffTime) as TaskRow[];

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

  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    stage?: string,
    message?: string
  ): Promise<void> {
    const updates: Partial<{
      status: TaskStatus;
      currentStage: string;
      error: string;
      updatedAt: Date;
      completedAt: Date;
      pausedAt: Date | undefined;
      pauseReason: string | undefined;
    }> = {
      status,
      updatedAt: new Date(),
    };

    if (stage) {
      updates.currentStage = stage;
    }

    if (status === 'completed') {
      updates.completedAt = new Date();
    }

    if (status === 'paused') {
      updates.pausedAt = new Date();
      updates.pauseReason = message;
    }

    if (status === 'failed' || status === 'cancelled') {
      updates.error = message;
    }

    await this.updateTask(taskId, updates);
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
    const workspace = row.workspace_config
      ? (JSON.parse(row.workspace_config) as WorkspaceConfig)
      : undefined;

    let sessionData = row.session_data
      ? (JSON.parse(row.session_data) as TaskSessionData)
      : undefined;

    if (sessionData?.lastCheckpoint) {
      sessionData.lastCheckpoint = new Date(sessionData.lastCheckpoint);
    } else if (row.last_checkpoint) {
      sessionData = {
        ...(sessionData || {}),
        lastCheckpoint: new Date(row.last_checkpoint),
      };
    }

    return {
      id: row.id,
      description: row.description,
      acceptanceCriteria: row.acceptance_criteria || undefined,
      workflow: row.workflow,
      autonomy: row.autonomy as Task['autonomy'],
      status: row.status as TaskStatus,
      priority: (row.priority || 'normal') as Task['priority'],
      effort: (row.effort || 'medium') as Task['effort'],
      currentStage: row.current_stage || undefined,
      projectPath: row.project_path,
      branchName: row.branch_name || undefined,
      prUrl: row.pr_url || undefined,
      retryCount: row.retry_count || 0,
      maxRetries: row.max_retries || 3,
      resumeAttempts: row.resume_attempts || 0,
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
      workspace,
      sessionData,
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
      END ASC, CASE t.effort
        WHEN 'xs' THEN 1
        WHEN 'small' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'large' THEN 4
        WHEN 'xl' THEN 5
        ELSE 3
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

  /**
   * Get paused tasks that are ready for resumption
   * Returns tasks with status='paused' and resumable pause reasons,
   * excluding tasks with future resumeAfter dates
   */
  async getPausedTasksForResume(): Promise<Task[]> {
    const now = new Date().toISOString();

    const sql = `
      SELECT t.*
      FROM tasks t
      WHERE t.status = 'paused'
      AND t.pause_reason IN ('usage_limit', 'budget', 'capacity', 'container_failure')
      AND (t.resume_after IS NULL OR t.resume_after <= ?)
      ORDER BY CASE t.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END ASC, CASE t.effort
        WHEN 'xs' THEN 1
        WHEN 'small' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'large' THEN 4
        WHEN 'xl' THEN 5
        ELSE 3
      END ASC, t.created_at ASC
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(now) as TaskRow[];

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
   * Find paused parent tasks (tasks with subtasks) ordered by priority.
   * This is used for priority-based auto-resume when capacity is restored.
   *
   * A parent task is defined as a task where:
   * - status = 'paused'
   * - pause_reason IN ('usage_limit', 'budget', 'capacity')
   * - resume_after is null or in the past
   * - subtask_ids is a non-empty JSON array
   *
   * @returns Array of parent tasks sorted by priority (urgent > high > normal > low),
   *          then by creation time (oldest first)
   */
  async findHighestPriorityParentTask(): Promise<Task[]> {
    const now = new Date().toISOString();

    const sql = `
      SELECT t.*
      FROM tasks t
      WHERE t.status = 'paused'
      AND t.pause_reason IN ('usage_limit', 'budget', 'capacity', 'container_failure')
      AND (t.resume_after IS NULL OR t.resume_after <= ?)
      AND t.subtask_ids IS NOT NULL
      AND t.subtask_ids != '[]'
      AND t.subtask_ids != 'null'
      ORDER BY CASE t.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END ASC, CASE t.effort
        WHEN 'xs' THEN 1
        WHEN 'small' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'large' THEN 4
        WHEN 'xl' THEN 5
        ELSE 3
      END ASC, t.created_at ASC
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(now) as TaskRow[];

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

  // ============================================================================
  // Idle Task Operations (v0.4.0)
  // ============================================================================

  /**
   * Create a new idle task
   */
  async createIdleTask(idleTask: Omit<IdleTask, 'createdAt'> & { createdAt?: Date }): Promise<IdleTask> {
    const now = new Date();
    const task = {
      ...idleTask,
      createdAt: idleTask.createdAt || now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO idle_tasks (
        id, type, title, description, priority, estimated_effort,
        suggested_workflow, rationale, created_at, implemented, implemented_task_id
      ) VALUES (
        @id, @type, @title, @description, @priority, @estimatedEffort,
        @suggestedWorkflow, @rationale, @createdAt, @implemented, @implementedTaskId
      )
    `);

    stmt.run({
      id: task.id,
      type: task.type,
      title: task.title,
      description: task.description,
      priority: task.priority,
      estimatedEffort: task.estimatedEffort,
      suggestedWorkflow: task.suggestedWorkflow,
      rationale: task.rationale,
      createdAt: task.createdAt.toISOString(),
      implemented: task.implemented ? 1 : 0,
      implementedTaskId: task.implementedTaskId || null,
    });

    return task;
  }

  /**
   * Get an idle task by ID
   */
  async getIdleTask(id: string): Promise<IdleTask | null> {
    const stmt = this.db.prepare('SELECT * FROM idle_tasks WHERE id = ?');
    const row = stmt.get(id) as IdleTaskRow | undefined;

    if (!row) return null;

    return this.rowToIdleTask(row);
  }

  /**
   * List idle tasks with optional filtering
   */
  async listIdleTasks(options?: {
    implemented?: boolean;
    type?: IdleTaskType;
    priority?: TaskPriority;
    limit?: number;
  }): Promise<IdleTask[]> {
    let sql = 'SELECT * FROM idle_tasks WHERE 1=1';
    const params: unknown[] = [];

    if (options?.implemented !== undefined) {
      sql += ' AND implemented = ?';
      params.push(options.implemented ? 1 : 0);
    }

    if (options?.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }

    if (options?.priority) {
      sql += ' AND priority = ?';
      params.push(options.priority);
    }

    // Order by priority, then by creation date
    sql += ` ORDER BY CASE priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
      ELSE 5
    END ASC, created_at DESC`;

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as IdleTaskRow[];

    return rows.map(row => this.rowToIdleTask(row));
  }

  /**
   * Update an idle task
   */
  async updateIdleTask(
    id: string,
    updates: Partial<Omit<IdleTask, 'id' | 'createdAt'>>
  ): Promise<void> {
    const setClauses: string[] = [];
    const params: Record<string, unknown> = { id };

    if (updates.type !== undefined) {
      setClauses.push('type = @type');
      params.type = updates.type;
    }

    if (updates.title !== undefined) {
      setClauses.push('title = @title');
      params.title = updates.title;
    }

    if (updates.description !== undefined) {
      setClauses.push('description = @description');
      params.description = updates.description;
    }

    if (updates.priority !== undefined) {
      setClauses.push('priority = @priority');
      params.priority = updates.priority;
    }

    if (updates.estimatedEffort !== undefined) {
      setClauses.push('estimated_effort = @estimatedEffort');
      params.estimatedEffort = updates.estimatedEffort;
    }

    if (updates.suggestedWorkflow !== undefined) {
      setClauses.push('suggested_workflow = @suggestedWorkflow');
      params.suggestedWorkflow = updates.suggestedWorkflow;
    }

    if (updates.rationale !== undefined) {
      setClauses.push('rationale = @rationale');
      params.rationale = updates.rationale;
    }

    if (updates.implemented !== undefined) {
      setClauses.push('implemented = @implemented');
      params.implemented = updates.implemented ? 1 : 0;
    }

    if ('implementedTaskId' in updates) {
      setClauses.push('implemented_task_id = @implementedTaskId');
      params.implementedTaskId = updates.implementedTaskId || null;
    }

    if (setClauses.length === 0) return;

    const sql = `UPDATE idle_tasks SET ${setClauses.join(', ')} WHERE id = @id`;
    this.db.prepare(sql).run(params);
  }

  /**
   * Delete an idle task
   */
  async deleteIdleTask(id: string): Promise<void> {
    // Check if the idle task exists
    const idleTask = await this.getIdleTask(id);
    if (!idleTask) {
      throw new Error(`Idle task with ID ${id} not found`);
    }

    const stmt = this.db.prepare('DELETE FROM idle_tasks WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Promote an idle task to a regular task
   */
  async promoteIdleTask(idleTaskId: string, taskRequest: Omit<CreateTaskRequest, 'description'>): Promise<Task> {
    // Get the idle task
    const idleTask = await this.getIdleTask(idleTaskId);
    if (!idleTask) {
      throw new Error(`Idle task with ID ${idleTaskId} not found`);
    }

    if (idleTask.implemented) {
      throw new Error(`Idle task ${idleTaskId} has already been implemented`);
    }

    // Create a regular task from the idle task
    const task = await this.createTask({
      ...taskRequest,
      description: idleTask.description,
      acceptanceCriteria: `Implement: ${idleTask.title}\n\nRationale: ${idleTask.rationale}`,
      workflow: idleTask.suggestedWorkflow,
      priority: idleTask.priority,
      effort: idleTask.estimatedEffort,
    });

    // Mark the idle task as implemented
    await this.updateIdleTask(idleTaskId, {
      implemented: true,
      implementedTaskId: task.id,
    });

    return task;
  }

  /**
   * Convert database row to IdleTask object
   */
  private rowToIdleTask(row: IdleTaskRow): IdleTask {
    return {
      id: row.id,
      type: row.type as IdleTaskType,
      title: row.title,
      description: row.description,
      priority: row.priority as TaskPriority,
      estimatedEffort: row.estimated_effort as TaskEffort,
      suggestedWorkflow: row.suggested_workflow,
      rationale: row.rationale,
      createdAt: new Date(row.created_at),
      implemented: Boolean(row.implemented),
      implementedTaskId: row.implemented_task_id || undefined,
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
  effort: string | null;
  current_stage: string | null;
  project_path: string;
  branch_name: string | null;
  pr_url: string | null;
  retry_count: number | null;
  max_retries: number | null;
  resume_attempts: number | null;
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
  workspace_config: string | null;
  session_data: string | null;
  last_checkpoint: string | null;
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

interface IdleTaskRow {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  estimated_effort: string;
  suggested_workflow: string;
  rationale: string;
  created_at: string;
  implemented: number;
  implemented_task_id: string | null;
}
