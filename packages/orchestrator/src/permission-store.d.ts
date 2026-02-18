import { Permission, PermissionLevel, PermissionQuery, ExtendedPermission, DirectoryAccessConfig } from '@apexcli/core';
/**
 * PermissionStore manages persistent storage of tool permissions in SQLite
 *
 * Handles CRUD operations for user permissions that control agent tool access.
 * Permissions can be scoped to specific tools and contexts with optional expiration.
 */
export declare class PermissionStore {
    private db;
    private dbPath;
    private projectPath;
    constructor(projectPath: string);
    /**
     * Initialize the database connection and ensure permissions table exists
     */
    initialize(): Promise<void>;
    /**
     * Create the permissions table if it doesn't exist
     */
    private createPermissionsTable;
    /**
     * Run any database migrations for the permissions table
     */
    private runMigrations;
    /**
     * Save a permission to the database
     * If a permission already exists for the same tool/scope combination, it will be updated
     */
    savePermission(permission: Permission): Promise<void>;
    /**
     * Save an extended permission to the database
     * If a permission already exists for the same tool/scope combination, it will be updated
     */
    saveExtendedPermission(permission: ExtendedPermission): Promise<void>;
    /**
     * Get a permission for a specific tool/scope combination
     * Returns null if no permission exists or if the permission has expired
     */
    getPermission(query: PermissionQuery): Promise<Permission | null>;
    /**
     * Get an extended permission for a specific tool/scope combination
     * Returns null if no permission exists or if the permission has expired
     */
    getExtendedPermission(query: PermissionQuery): Promise<ExtendedPermission | null>;
    /**
     * List all permissions with optional filtering
     */
    listPermissions(options?: {
        tool?: string;
        level?: PermissionLevel;
        includeExpired?: boolean;
    }): Promise<Permission[]>;
    /**
     * List all extended permissions with optional filtering
     */
    listExtendedPermissions(options?: {
        tool?: string;
        level?: PermissionLevel;
        grantedBy?: string;
        tags?: string[];
        includeExpired?: boolean;
        hasConfig?: boolean;
    }): Promise<ExtendedPermission[]>;
    /**
     * Clear all permissions
     */
    clearPermissions(): Promise<void>;
    /**
     * Clear all expired permissions
     * Returns the number of permissions that were cleared
     */
    clearExpired(): Promise<number>;
    /**
     * Clear a specific expired permission by ID (internal helper)
     */
    private clearExpiredPermission;
    /**
     * Clear permissions for a specific tool
     */
    clearPermissionsForTool(toolName: string): Promise<number>;
    /**
     * Clear permissions for a specific tool/scope combination
     */
    clearPermission(query: PermissionQuery): Promise<boolean>;
    /**
     * Generate a unique ID for a permission based on tool and scope
     */
    private generatePermissionId;
    /**
     * Convert a database row to a Permission object
     */
    private rowToPermission;
    /**
     * Convert a database row to an ExtendedPermission object
     */
    private rowToExtendedPermission;
    /**
     * Get directory access configuration for a tool permission
     */
    getDirectoryAccess(query: PermissionQuery): Promise<DirectoryAccessConfig | null>;
    /**
     * Update directory access configuration for an existing permission
     */
    updateDirectoryAccess(query: PermissionQuery, directoryAccess: DirectoryAccessConfig): Promise<boolean>;
    /**
     * Close the database connection
     */
    close(): void;
}
//# sourceMappingURL=permission-store.d.ts.map