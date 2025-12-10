import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { Task, TaskStatus, TaskUsage, TaskLog, TaskArtifact, Gate, GateStatus } from '@apex/core';

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
        current_stage TEXT,
        project_path TEXT NOT NULL,
        branch_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        usage_input_tokens INTEGER DEFAULT 0,
        usage_output_tokens INTEGER DEFAULT 0,
        usage_total_tokens INTEGER DEFAULT 0,
        usage_estimated_cost REAL DEFAULT 0,
        error TEXT
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

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_id ON task_artifacts(task_id);
      CREATE INDEX IF NOT EXISTS idx_gates_task_id ON gates(task_id);
    `);
  }

  /**
   * Create a new task
   */
  async createTask(task: Task): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, description, acceptance_criteria, workflow, autonomy, status,
        current_stage, project_path, branch_name, created_at, updated_at,
        usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated_cost
      ) VALUES (
        @id, @description, @acceptanceCriteria, @workflow, @autonomy, @status,
        @currentStage, @projectPath, @branchName, @createdAt, @updatedAt,
        @inputTokens, @outputTokens, @totalTokens, @estimatedCost
      )
    `);

    stmt.run({
      id: task.id,
      description: task.description,
      acceptanceCriteria: task.acceptanceCriteria || null,
      workflow: task.workflow,
      autonomy: task.autonomy,
      status: task.status,
      currentStage: task.currentStage || null,
      projectPath: task.projectPath,
      branchName: task.branchName || null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      inputTokens: task.usage.inputTokens,
      outputTokens: task.usage.outputTokens,
      totalTokens: task.usage.totalTokens,
      estimatedCost: task.usage.estimatedCost,
    });
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

    return this.rowToTask(row, logs, artifacts);
  }

  /**
   * Update a task
   */
  async updateTask(
    taskId: string,
    updates: Partial<{
      status: TaskStatus;
      currentStage: string;
      error: string;
      usage: TaskUsage;
      updatedAt: Date;
      completedAt: Date;
    }>
  ): Promise<void> {
    const setClauses: string[] = [];
    const params: Record<string, unknown> = { id: taskId };

    if (updates.status !== undefined) {
      setClauses.push('status = @status');
      params.status = updates.status;
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

    if (setClauses.length === 0) return;

    const sql = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = @id`;
    this.db.prepare(sql).run(params);
  }

  /**
   * List tasks
   */
  async listTasks(options?: { status?: TaskStatus; limit?: number }): Promise<Task[]> {
    let sql = 'SELECT * FROM tasks';
    const params: unknown[] = [];

    if (options?.status) {
      sql += ' WHERE status = ?';
      params.push(options.status);
    }

    sql += ' ORDER BY created_at DESC';

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
      tasks.push(this.rowToTask(row, logs, artifacts));
    }

    return tasks;
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
   * Get task logs
   */
  private async getTaskLogs(taskId: string): Promise<TaskLog[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM task_logs WHERE task_id = ? ORDER BY timestamp ASC'
    );
    const rows = stmt.all(taskId) as TaskLogRow[];

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
   * Convert database row to Task object
   */
  private rowToTask(row: TaskRow, logs: TaskLog[], artifacts: TaskArtifact[]): Task {
    return {
      id: row.id,
      description: row.description,
      acceptanceCriteria: row.acceptance_criteria || undefined,
      workflow: row.workflow,
      autonomy: row.autonomy as Task['autonomy'],
      status: row.status as TaskStatus,
      currentStage: row.current_stage || undefined,
      projectPath: row.project_path,
      branchName: row.branch_name || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
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
  current_stage: string | null;
  project_path: string;
  branch_name: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  usage_input_tokens: number;
  usage_output_tokens: number;
  usage_total_tokens: number;
  usage_estimated_cost: number;
  error: string | null;
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
