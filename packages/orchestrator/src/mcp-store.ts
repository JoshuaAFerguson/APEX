import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import {
  MCPInstallation,
  MCPInstallationSchema,
  MCPInstallationStatus
} from '@apexcli/core';

/**
 * MCPServerStore manages persistent storage of MCP server installations in SQLite
 *
 * Handles CRUD operations for MCP server installations that track the lifecycle
 * and status of installed MCP servers within an APEX project.
 */
export class MCPServerStore {
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
   * Initialize the database connection and ensure mcp_installations table exists
   */
  async initialize(): Promise<void> {
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.createInstallationsTable();
    this.runMigrations();
  }

  /**
   * Create the mcp_installations table if it doesn't exist
   */
  private createInstallationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mcp_installations (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        installed_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'installing', 'installed', 'failed', 'uninstalling', 'uninstalled')),
        config_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_mcp_installations_server_id ON mcp_installations(server_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_installations_status ON mcp_installations(status);
      CREATE INDEX IF NOT EXISTS idx_mcp_installations_installed_at ON mcp_installations(installed_at);
    `);
  }

  /**
   * Run any database migrations for the mcp_installations table
   */
  private runMigrations(): void {
    // Check if mcp_installations table exists
    const tableExists = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mcp_installations'")
      .get();

    if (!tableExists) {
      // Create table if it doesn't exist (handled by createInstallationsTable)
      return;
    }

    // Get existing columns in mcp_installations table
    const columns = this.db
      .prepare("PRAGMA table_info(mcp_installations)")
      .all() as { name: string }[];
    const columnNames = new Set(columns.map((c) => c.name));

    // Add any missing columns for future migrations
    const migrations: { column: string; definition: string }[] = [
      // Future migration example:
      // { column: 'version', definition: 'TEXT' },
    ];

    for (const { column, definition } of migrations) {
      if (!columnNames.has(column)) {
        try {
          this.db.exec(`ALTER TABLE mcp_installations ADD COLUMN ${column} ${definition}`);
        } catch {
          // Column might already exist or table doesn't exist yet
        }
      }
    }
  }

  /**
   * Save an MCP installation to the database
   * If an installation already exists with the same ID, it will be updated
   */
  async save(installation: MCPInstallation): Promise<void> {
    // Validate the installation object
    const validated = MCPInstallationSchema.parse(installation);

    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO mcp_installations (
        id, server_id, installed_at, status, config_path, created_at, updated_at
      )
      VALUES (
        @id, @serverId, @installedAt, @status, @configPath, @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        server_id = @serverId,
        installed_at = @installedAt,
        status = @status,
        config_path = @configPath,
        updated_at = @updatedAt
    `);

    stmt.run({
      id: validated.id,
      serverId: validated.serverId,
      installedAt: validated.installedAt.toISOString(),
      status: validated.status,
      configPath: validated.configPath,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Get an MCP installation by ID
   * Returns null if no installation exists with the given ID
   */
  async get(id: string): Promise<MCPInstallation | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM mcp_installations
      WHERE id = ?
      LIMIT 1
    `);

    const row = stmt.get(id) as MCPInstallationRow | undefined;

    if (!row) return null;

    return this.rowToInstallation(row);
  }

  /**
   * Get all MCP installations with optional filtering
   */
  async getAll(options?: {
    serverId?: string;
    status?: MCPInstallationStatus;
  }): Promise<MCPInstallation[]> {
    let sql = 'SELECT * FROM mcp_installations';
    const params: unknown[] = [];
    const whereClauses: string[] = [];

    if (options?.serverId) {
      whereClauses.push('server_id = ?');
      params.push(options.serverId);
    }

    if (options?.status) {
      whereClauses.push('status = ?');
      params.push(options.status);
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ' ORDER BY installed_at DESC';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as MCPInstallationRow[];

    return rows.map(row => this.rowToInstallation(row));
  }

  /**
   * Delete an MCP installation by ID
   * Returns true if an installation was deleted, false if it didn't exist
   */
  async delete(id: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      DELETE FROM mcp_installations
      WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Delete all MCP installations for a specific server ID
   * Returns the number of installations deleted
   */
  async deleteByServerId(serverId: string): Promise<number> {
    const stmt = this.db.prepare(`
      DELETE FROM mcp_installations
      WHERE server_id = ?
    `);

    const result = stmt.run(serverId);
    return result.changes;
  }

  /**
   * Update the status of an MCP installation
   * Returns true if the installation was updated, false if it didn't exist
   */
  async updateStatus(id: string, status: MCPInstallationStatus): Promise<boolean> {
    const stmt = this.db.prepare(`
      UPDATE mcp_installations
      SET status = ?, updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(status, new Date().toISOString(), id);
    return result.changes > 0;
  }

  /**
   * Check if an installation exists with the given ID
   */
  async exists(id: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      SELECT 1 FROM mcp_installations WHERE id = ? LIMIT 1
    `);

    return !!stmt.get(id);
  }

  /**
   * Get installations by status
   * Convenience method for common filtering by status
   */
  async getByStatus(status: MCPInstallationStatus): Promise<MCPInstallation[]> {
    return this.getAll({ status });
  }

  /**
   * Get installations for a specific server ID
   * Convenience method for common filtering by server ID
   */
  async getByServerId(serverId: string): Promise<MCPInstallation[]> {
    return this.getAll({ serverId });
  }

  /**
   * Convert a database row to an MCPInstallation object
   */
  private rowToInstallation(row: MCPInstallationRow): MCPInstallation {
    return {
      id: row.id,
      serverId: row.server_id,
      installedAt: new Date(row.installed_at),
      status: row.status as MCPInstallationStatus,
      configPath: row.config_path,
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

/**
 * Database row type for MCP installations
 */
interface MCPInstallationRow {
  id: string;
  server_id: string;
  installed_at: string;
  status: string;
  config_path: string;
  created_at: string;
  updated_at: string;
}