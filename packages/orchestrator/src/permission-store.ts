import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import {
  Permission,
  PermissionLevel,
  PermissionQuery,
} from '@apexcli/core';

/**
 * PermissionStore manages persistent storage of tool permissions in SQLite
 *
 * Handles CRUD operations for user permissions that control agent tool access.
 * Permissions can be scoped to specific tools and contexts with optional expiration.
 */
export class PermissionStore {
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
   * Initialize the database connection and ensure permissions table exists
   */
  async initialize(): Promise<void> {
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.createPermissionsTable();
    this.runMigrations();
  }

  /**
   * Create the permissions table if it doesn't exist
   */
  private createPermissionsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        tool_name TEXT NOT NULL,
        scope TEXT,
        level TEXT NOT NULL CHECK (level IN ('allow-always', 'allow-once', 'deny')),
        expires_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_permissions_tool_scope ON permissions(tool_name, scope);
      CREATE INDEX IF NOT EXISTS idx_permissions_level ON permissions(level);
      CREATE INDEX IF NOT EXISTS idx_permissions_expires_at ON permissions(expires_at);
    `);
  }

  /**
   * Run any database migrations for the permissions table
   */
  private runMigrations(): void {
    // Check if permissions table exists
    const tableExists = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='permissions'")
      .get();

    if (!tableExists) {
      // Create table if it doesn't exist (handled by createPermissionsTable)
      return;
    }

    // Get existing columns in permissions table
    const columns = this.db
      .prepare("PRAGMA table_info(permissions)")
      .all() as { name: string }[];
    const columnNames = new Set(columns.map((c) => c.name));

    // Add any missing columns for future migrations
    const migrations: { column: string; definition: string }[] = [
      // Future migrations can be added here
    ];

    for (const { column, definition } of migrations) {
      if (!columnNames.has(column)) {
        try {
          this.db.exec(`ALTER TABLE permissions ADD COLUMN ${column} ${definition}`);
        } catch {
          // Column might already exist or table doesn't exist yet
        }
      }
    }
  }

  /**
   * Save a permission to the database
   * If a permission already exists for the same tool/scope combination, it will be updated
   */
  async savePermission(permission: Permission): Promise<void> {
    const id = this.generatePermissionId(permission.tool, permission.scope);

    const stmt = this.db.prepare(`
      INSERT INTO permissions (id, tool_name, scope, level, expires_at, created_at)
      VALUES (@id, @toolName, @scope, @level, @expiresAt, @createdAt)
      ON CONFLICT(id) DO UPDATE SET
        level = @level,
        expires_at = @expiresAt,
        created_at = @createdAt
    `);

    stmt.run({
      id,
      toolName: permission.tool,
      scope: permission.scope || null,
      level: permission.level,
      expiresAt: permission.expiry ? permission.expiry.toISOString() : null,
      createdAt: permission.createdAt.toISOString(),
    });
  }

  /**
   * Get a permission for a specific tool/scope combination
   * Returns null if no permission exists or if the permission has expired
   */
  async getPermission(query: PermissionQuery): Promise<Permission | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM permissions
      WHERE tool_name = ? AND scope IS ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const row = stmt.get(query.tool, query.scope || null) as PermissionRow | undefined;

    if (!row) return null;

    // Check if permission has expired
    if (row.expires_at) {
      const expiryDate = new Date(row.expires_at);
      if (new Date() > expiryDate) {
        // Permission has expired, remove it and return null
        await this.clearExpiredPermission(row.id);
        return null;
      }
    }

    return this.rowToPermission(row);
  }

  /**
   * List all permissions with optional filtering
   */
  async listPermissions(options?: {
    tool?: string;
    level?: PermissionLevel;
    includeExpired?: boolean;
  }): Promise<Permission[]> {
    let sql = 'SELECT * FROM permissions';
    const params: unknown[] = [];
    const whereClauses: string[] = [];

    if (options?.tool) {
      whereClauses.push('tool_name = ?');
      params.push(options.tool);
    }

    if (options?.level) {
      whereClauses.push('level = ?');
      params.push(options.level);
    }

    // By default, exclude expired permissions unless explicitly requested
    if (!options?.includeExpired) {
      whereClauses.push('(expires_at IS NULL OR expires_at > ?)');
      params.push(new Date().toISOString());
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as PermissionRow[];

    return rows.map(row => this.rowToPermission(row));
  }

  /**
   * Clear all permissions
   */
  async clearPermissions(): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM permissions');
    stmt.run();
  }

  /**
   * Clear all expired permissions
   * Returns the number of permissions that were cleared
   */
  async clearExpired(): Promise<number> {
    const stmt = this.db.prepare(`
      DELETE FROM permissions
      WHERE expires_at IS NOT NULL AND expires_at <= ?
    `);

    const result = stmt.run(new Date().toISOString());
    return result.changes;
  }

  /**
   * Clear a specific expired permission by ID (internal helper)
   */
  private async clearExpiredPermission(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM permissions WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Clear permissions for a specific tool
   */
  async clearPermissionsForTool(toolName: string): Promise<number> {
    const stmt = this.db.prepare('DELETE FROM permissions WHERE tool_name = ?');
    const result = stmt.run(toolName);
    return result.changes;
  }

  /**
   * Clear permissions for a specific tool/scope combination
   */
  async clearPermission(query: PermissionQuery): Promise<boolean> {
    const stmt = this.db.prepare(`
      DELETE FROM permissions
      WHERE tool_name = ? AND scope IS ?
    `);

    const result = stmt.run(query.tool, query.scope || null);
    return result.changes > 0;
  }

  /**
   * Generate a unique ID for a permission based on tool and scope
   */
  private generatePermissionId(tool: string, scope?: string): string {
    const scopePart = scope ? `-${scope}` : '';
    const hash = Buffer.from(`${tool}${scopePart}`).toString('base64url');
    return `perm-${hash}`;
  }

  /**
   * Convert a database row to a Permission object
   */
  private rowToPermission(row: PermissionRow): Permission {
    return {
      tool: row.tool_name,
      scope: row.scope || undefined,
      level: row.level as PermissionLevel,
      expiry: row.expires_at ? new Date(row.expires_at) : undefined,
      createdAt: new Date(row.created_at),
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

// Database row type
interface PermissionRow {
  id: string;
  tool_name: string;
  scope: string | null;
  level: string;
  expires_at: string | null;
  created_at: string;
}