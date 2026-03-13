"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionStore = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const core_1 = require("@apexcli/core");
/**
 * PermissionStore manages persistent storage of tool permissions in SQLite
 *
 * Handles CRUD operations for user permissions that control agent tool access.
 * Permissions can be scoped to specific tools and contexts with optional expiration.
 */
class PermissionStore {
    db;
    dbPath;
    projectPath;
    constructor(projectPath) {
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
    async initialize() {
        this.db = new better_sqlite3_1.default(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.createPermissionsTable();
        this.runMigrations();
    }
    /**
     * Create the permissions table if it doesn't exist
     */
    createPermissionsTable() {
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
    runMigrations() {
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
            .all();
        const columnNames = new Set(columns.map((c) => c.name));
        // Add any missing columns for future migrations
        const migrations = [
            // v0.5.0 Extended Permission Migration
            { column: 'config', definition: 'TEXT' },
            { column: 'grant_reason', definition: 'TEXT' },
            { column: 'granted_by', definition: 'TEXT' },
            { column: 'tags', definition: 'TEXT' },
        ];
        for (const { column, definition } of migrations) {
            if (!columnNames.has(column)) {
                try {
                    this.db.exec(`ALTER TABLE permissions ADD COLUMN ${column} ${definition}`);
                }
                catch {
                    // Column might already exist or table doesn't exist yet
                }
            }
        }
    }
    /**
     * Save a permission to the database
     * If a permission already exists for the same tool/scope combination, it will be updated
     */
    async savePermission(permission) {
        // Delegate to extended version with optional fields as undefined
        await this.saveExtendedPermission({
            ...permission,
            tags: [],
        });
    }
    /**
     * Save an extended permission to the database
     * If a permission already exists for the same tool/scope combination, it will be updated
     */
    async saveExtendedPermission(permission) {
        const id = this.generatePermissionId(permission.tool, permission.scope);
        const stmt = this.db.prepare(`
      INSERT INTO permissions (
        id, tool_name, scope, level, expires_at, created_at,
        config, grant_reason, granted_by, tags
      )
      VALUES (
        @id, @toolName, @scope, @level, @expiresAt, @createdAt,
        @config, @grantReason, @grantedBy, @tags
      )
      ON CONFLICT(id) DO UPDATE SET
        level = @level,
        expires_at = @expiresAt,
        created_at = @createdAt,
        config = @config,
        grant_reason = @grantReason,
        granted_by = @grantedBy,
        tags = @tags
    `);
        const createdAtDate = permission.createdAt ? new Date(permission.createdAt) : new Date();
        stmt.run({
            id,
            toolName: permission.tool,
            scope: permission.scope || null,
            level: permission.level || 'allow-once',
            expiresAt: permission.expiry ? permission.expiry.toISOString() : null,
            createdAt: createdAtDate.toISOString(),
            config: permission.config ? JSON.stringify(permission.config) : null,
            grantReason: permission.grantReason || null,
            grantedBy: permission.grantedBy || null,
            tags: permission.tags && permission.tags.length > 0
                ? JSON.stringify(permission.tags)
                : null,
        });
    }
    /**
     * Get a permission for a specific tool/scope combination
     * Returns null if no permission exists or if the permission has expired
     */
    async getPermission(query) {
        const extended = await this.getExtendedPermission(query);
        if (!extended)
            return null;
        // Return only base Permission fields for backward compatibility
        return {
            tool: extended.tool,
            scope: extended.scope,
            level: extended.level,
            expiry: extended.expiry,
            createdAt: extended.createdAt,
        };
    }
    /**
     * Get an extended permission for a specific tool/scope combination
     * Returns null if no permission exists or if the permission has expired
     */
    async getExtendedPermission(query) {
        const stmt = this.db.prepare(`
      SELECT * FROM permissions
      WHERE tool_name = ? AND scope IS ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
        const row = stmt.get(query.tool, query.scope || null);
        if (!row)
            return null;
        // Check if permission has expired
        if (row.expires_at) {
            const expiryDate = new Date(row.expires_at);
            if (new Date() > expiryDate) {
                // Permission has expired, remove it and return null
                await this.clearExpiredPermission(row.id);
                return null;
            }
        }
        return this.rowToExtendedPermission(row);
    }
    /**
     * List all permissions with optional filtering
     */
    async listPermissions(options) {
        const extended = await this.listExtendedPermissions(options);
        // Convert extended permissions to base Permission type
        return extended.map(perm => ({
            tool: perm.tool,
            scope: perm.scope,
            level: perm.level,
            expiry: perm.expiry,
            createdAt: perm.createdAt,
        }));
    }
    /**
     * List all extended permissions with optional filtering
     */
    async listExtendedPermissions(options) {
        let sql = 'SELECT * FROM permissions';
        const params = [];
        const whereClauses = [];
        if (options?.tool) {
            whereClauses.push('tool_name = ?');
            params.push(options.tool);
        }
        if (options?.level) {
            whereClauses.push('level = ?');
            params.push(options.level);
        }
        if (options?.grantedBy) {
            whereClauses.push('granted_by = ?');
            params.push(options.grantedBy);
        }
        if (options?.hasConfig === true) {
            whereClauses.push('config IS NOT NULL');
        }
        else if (options?.hasConfig === false) {
            whereClauses.push('config IS NULL');
        }
        // Tag filtering using JSON
        if (options?.tags && options.tags.length > 0) {
            // Match any of the provided tags
            const tagConditions = options.tags.map(() => `json_each.value = ?`).join(' OR ');
            whereClauses.push(`EXISTS (
        SELECT 1 FROM json_each(tags) WHERE ${tagConditions}
      )`);
            params.push(...options.tags);
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
        const rows = stmt.all(...params);
        return rows.map(row => this.rowToExtendedPermission(row));
    }
    /**
     * Clear all permissions
     */
    async clearPermissions() {
        const stmt = this.db.prepare('DELETE FROM permissions');
        stmt.run();
    }
    /**
     * Clear all expired permissions
     * Returns the number of permissions that were cleared
     */
    async clearExpired() {
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
    async clearExpiredPermission(id) {
        const stmt = this.db.prepare('DELETE FROM permissions WHERE id = ?');
        stmt.run(id);
    }
    /**
     * Clear permissions for a specific tool
     */
    async clearPermissionsForTool(toolName) {
        const stmt = this.db.prepare('DELETE FROM permissions WHERE tool_name = ?');
        const result = stmt.run(toolName);
        return result.changes;
    }
    /**
     * Clear permissions for a specific tool/scope combination
     */
    async clearPermission(query) {
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
    generatePermissionId(tool, scope) {
        const scopePart = scope ? `-${scope}` : '';
        const hash = Buffer.from(`${tool}${scopePart}`).toString('base64url');
        return `perm-${hash}`;
    }
    /**
     * Convert a database row to a Permission object
     */
    rowToPermission(row) {
        return {
            tool: row.tool_name,
            scope: row.scope || undefined,
            level: row.level,
            expiry: row.expires_at ? new Date(row.expires_at) : undefined,
            createdAt: new Date(row.created_at),
        };
    }
    /**
     * Convert a database row to an ExtendedPermission object
     */
    rowToExtendedPermission(row) {
        const base = {
            tool: row.tool_name,
            scope: row.scope || undefined,
            level: row.level,
            expiry: row.expires_at ? new Date(row.expires_at) : undefined,
            createdAt: new Date(row.created_at),
            tags: [],
        };
        // Parse extended fields
        if (row.config) {
            try {
                const parsed = JSON.parse(row.config);
                const result = core_1.ToolPermissionConfigSchema.safeParse(parsed);
                if (result.success) {
                    base.config = result.data;
                }
            }
            catch {
                // Invalid JSON, ignore config
            }
        }
        if (row.grant_reason) {
            base.grantReason = row.grant_reason;
        }
        if (row.granted_by) {
            base.grantedBy = row.granted_by;
        }
        if (row.tags) {
            try {
                const parsed = JSON.parse(row.tags);
                if (Array.isArray(parsed)) {
                    base.tags = parsed.filter((tag) => typeof tag === 'string');
                }
            }
            catch {
                base.tags = [];
            }
        }
        return base;
    }
    /**
     * Get directory access configuration for a tool permission
     */
    async getDirectoryAccess(query) {
        const permission = await this.getExtendedPermission(query);
        if (!permission?.config)
            return null;
        // Extract directoryAccess from the appropriate config type
        if ('directoryAccess' in permission.config) {
            return permission.config.directoryAccess || null;
        }
        return null;
    }
    /**
     * Update directory access configuration for an existing permission
     */
    async updateDirectoryAccess(query, directoryAccess) {
        const permission = await this.getExtendedPermission(query);
        if (!permission)
            return false;
        // Create or update the config with new directory access
        const config = permission.config || {};
        const updatedConfig = { ...config, directoryAccess };
        await this.saveExtendedPermission({
            ...permission,
            config: updatedConfig,
        });
        return true;
    }
    /**
     * Close the database connection
     */
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}
exports.PermissionStore = PermissionStore;
//# sourceMappingURL=permission-store.js.map