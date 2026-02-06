import { PermissionLevel, ToolPermissionCheckOptions, ToolPermissionResult, DirectoryAccessCheckOptions, DirectoryAccessResult, ToolPermissionConfig } from '@apexcli/core';
import { PermissionStore } from './permission-store';
/**
 * PermissionManager provides high-level permission management with session-level caching
 *
 * This class wraps the PermissionStore to provide:
 * - Session-level cache for 'allow-once' decisions that clear after each session
 * - Simplified permission checking and granting methods
 * - Boolean permission status queries
 *
 * The session cache is used to temporarily store 'allow-once' permissions that should
 * only be valid for a single invocation within the current session.
 */
export declare class PermissionManager {
    private store;
    private sessionCache;
    private sessionDirectoryAccess;
    private sessionToolConfigCache;
    private directoryAccessValidator;
    /**
     * Create a new PermissionManager instance
     * @param store The PermissionStore instance to use for persistent storage
     */
    constructor(store: PermissionStore);
    /**
     * Check the permission level for a specific tool and scope combination
     *
     * This method first checks the session cache for 'allow-once' permissions,
     * then falls back to the persistent store. If an 'allow-once' permission
     * is found in the session cache, it is consumed (removed) after being returned.
     *
     * @param tool The tool name to check permissions for
     * @param scope Optional scope to narrow the permission check
     * @returns The permission level for this tool/scope combination, or null if no permission exists
     */
    checkPermission(tool: string, scope?: string): Promise<PermissionLevel | null>;
    /**
     * Grant a permission for a specific tool and scope combination
     *
     * For 'allow-once' permissions, the permission is stored in the session cache.
     * For 'allow-always' and 'deny' permissions, the permission is stored persistently.
     *
     * @param tool The tool name to grant permission for
     * @param scope Optional scope to narrow the permission grant
     * @param level The permission level to grant
     */
    grantPermission(tool: string, scope: string | undefined, level: PermissionLevel): Promise<void>;
    /**
     * Revoke a permission for a specific tool and scope combination
     *
     * This removes the permission from both the session cache and persistent store.
     *
     * @param tool The tool name to revoke permission for
     * @param scope Optional scope to narrow the permission revocation
     * @returns True if a permission was revoked, false if no permission existed
     */
    revokePermission(tool: string, scope?: string): Promise<boolean>;
    /**
     * Check if a permission exists for a specific tool and scope combination
     *
     * This is a convenience method that returns a boolean instead of the permission level.
     * Returns true for any permission level except 'deny' or null.
     *
     * @param tool The tool name to check permissions for
     * @param scope Optional scope to narrow the permission check
     * @returns True if the tool/scope has any allow permission, false if denied or no permission exists
     */
    hasPermission(tool: string, scope?: string): Promise<boolean>;
    /**
     * Retrieve tool-specific configuration from the permission store
     *
     * This method first checks the session tool config cache, then falls back
     * to querying the permission store for extended permissions with tool config.
     *
     * @param tool The tool name to get configuration for
     * @param scope Optional scope to narrow the configuration lookup
     * @returns The tool configuration if available, or null if no config exists
     */
    getToolConfig(tool: string, scope?: string): Promise<ToolPermissionConfig | null>;
    /**
     * Set tool-specific configuration for the current session.
     *
     * @param tool The tool name to set configuration for
     * @param config Tool configuration to apply (null clears the override)
     * @param scope Optional scope to associate with this config
     */
    setToolConfig(tool: string, config: ToolPermissionConfig | null, scope?: string): void;
    /**
     * Validate directory access by combining tool-specific configuration with path validation
     *
     * This method checks both session-level directory access overrides and stored
     * directory access configurations, then uses the DirectoryAccessValidator to
     * validate the path against allowlist/blocklist patterns.
     *
     * @param path The directory path to validate
     * @param options Options for the directory access check
     * @returns Directory access validation result
     */
    checkDirectoryAccess(path: string, options?: DirectoryAccessCheckOptions): Promise<DirectoryAccessResult>;
    /**
     * Comprehensive tool permission check with configuration and optional path validation
     *
     * This method combines permission level checking, tool configuration retrieval,
     * and optional directory access validation into a single comprehensive check.
     *
     * @param tool The tool name to check permissions for
     * @param options Options for the permission check
     * @returns Comprehensive permission check result
     */
    checkToolPermission(tool: string, options?: ToolPermissionCheckOptions): Promise<ToolPermissionResult>;
    /**
     * Check permission level without consuming allow-once permissions
     * This is a helper method for checkToolPermission when consumeAllowOnce is false
     *
     * @param tool The tool name to check permissions for
     * @param scope Optional scope to narrow the permission check
     * @returns The permission level for this tool/scope combination, or null if no permission exists
     */
    private checkPermissionWithoutConsumption;
    /**
     * Reset the session cache, clearing all 'allow-once' permissions
     *
     * This should be called when starting a new session to ensure that
     * 'allow-once' permissions from previous sessions don't carry over.
     */
    resetSession(): void;
    /**
     * Generate a cache key for the session cache based on tool and scope
     * @param tool The tool name
     * @param scope Optional scope
     * @returns A cache key string
     */
    private generateCacheKey;
    /**
     * Generate a cache key for directory access cache
     * @param path The directory path
     * @param tool Optional tool name
     * @returns A cache key string
     */
    private generateDirectoryAccessCacheKey;
    /**
     * Generate a cache key for tool config cache
     * @param tool The tool name
     * @param scope Optional scope
     * @returns A cache key string
     */
    private generateToolConfigCacheKey;
}
//# sourceMappingURL=permission-manager.d.ts.map