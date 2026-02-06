"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionManager = void 0;
const core_1 = require("@apexcli/core");
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
class PermissionManager {
    store;
    sessionCache = new Map();
    sessionDirectoryAccess = new Map();
    sessionToolConfigCache = new Map();
    directoryAccessValidator = new core_1.DirectoryAccessValidator();
    /**
     * Create a new PermissionManager instance
     * @param store The PermissionStore instance to use for persistent storage
     */
    constructor(store) {
        this.store = store;
    }
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
    async checkPermission(tool, scope) {
        const cacheKey = this.generateCacheKey(tool, scope);
        // First check session cache for 'allow-once' permissions
        if (this.sessionCache.has(cacheKey)) {
            const cachedLevel = this.sessionCache.get(cacheKey);
            // If it's an 'allow-once' permission, consume it from the cache
            if (cachedLevel === 'allow-once') {
                this.sessionCache.delete(cacheKey);
            }
            return cachedLevel;
        }
        // Fall back to persistent store
        const permission = await this.store.getPermission({ tool, scope });
        if (!permission) {
            return null;
        }
        // If we found an 'allow-once' permission in the store, cache it for the session
        // and remove it from the persistent store
        if (permission.level === 'allow-once') {
            this.sessionCache.set(cacheKey, permission.level);
            await this.store.clearPermission({ tool, scope });
        }
        return permission.level;
    }
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
    async grantPermission(tool, scope, level) {
        if (level === 'allow-once') {
            // Store 'allow-once' permissions only in the session cache
            const cacheKey = this.generateCacheKey(tool, scope);
            this.sessionCache.set(cacheKey, level);
        }
        else {
            // Store persistent permissions in the database
            const permission = {
                tool,
                scope,
                level,
                createdAt: new Date(),
            };
            await this.store.savePermission(permission);
            // Also remove any session cache entry for this tool/scope
            const cacheKey = this.generateCacheKey(tool, scope);
            this.sessionCache.delete(cacheKey);
        }
    }
    /**
     * Revoke a permission for a specific tool and scope combination
     *
     * This removes the permission from both the session cache and persistent store.
     *
     * @param tool The tool name to revoke permission for
     * @param scope Optional scope to narrow the permission revocation
     * @returns True if a permission was revoked, false if no permission existed
     */
    async revokePermission(tool, scope) {
        const cacheKey = this.generateCacheKey(tool, scope);
        const hadSessionPermission = this.sessionCache.has(cacheKey);
        // Remove from session cache
        this.sessionCache.delete(cacheKey);
        // Remove from persistent store
        const hadPersistentPermission = await this.store.clearPermission({ tool, scope });
        return hadSessionPermission || hadPersistentPermission;
    }
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
    async hasPermission(tool, scope) {
        const level = await this.checkPermission(tool, scope);
        return level === 'allow-always' || level === 'allow-once';
    }
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
    async getToolConfig(tool, scope) {
        const cacheKey = this.generateToolConfigCacheKey(tool, scope);
        // Check session cache first
        if (this.sessionToolConfigCache.has(cacheKey)) {
            return this.sessionToolConfigCache.get(cacheKey);
        }
        // Fall back to persistent store
        const extendedPermission = await this.store.getExtendedPermission({ tool, scope });
        const config = extendedPermission?.config ?? null;
        // Cache the result for this session
        this.sessionToolConfigCache.set(cacheKey, config);
        return config;
    }
    /**
     * Set tool-specific configuration for the current session.
     *
     * @param tool The tool name to set configuration for
     * @param config Tool configuration to apply (null clears the override)
     * @param scope Optional scope to associate with this config
     */
    setToolConfig(tool, config, scope) {
        const cacheKey = this.generateToolConfigCacheKey(tool, scope);
        this.sessionToolConfigCache.set(cacheKey, config);
    }
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
    async checkDirectoryAccess(path, options = {}) {
        const { tool, scope, baseDir } = options;
        const cacheKey = this.generateDirectoryAccessCacheKey(path, tool);
        // Check session directory access cache first
        let directoryConfig = this.sessionDirectoryAccess.get(cacheKey);
        // If not in session cache, try to get tool-specific directory config
        if (!directoryConfig && tool) {
            const toolConfig = await this.getToolConfig(tool, scope);
            if (toolConfig && 'directoryAccess' in toolConfig) {
                directoryConfig = toolConfig.directoryAccess;
                // Cache it for this session
                if (directoryConfig) {
                    this.sessionDirectoryAccess.set(cacheKey, directoryConfig);
                }
            }
        }
        // If no directory config found, provide a default allow-all config
        if (!directoryConfig) {
            directoryConfig = {
                allowlist: [],
                blocklist: [],
                defaultAllow: true,
                resolveSymlinks: true,
                maxDepth: 0,
            };
        }
        // Use DirectoryAccessValidator to validate the path
        const validationResult = this.directoryAccessValidator.isPathAllowed(path, directoryConfig, {
            baseDir,
            resolveSymlinks: directoryConfig.resolveSymlinks,
        });
        return {
            allowed: validationResult.allowed,
            reason: validationResult.reason,
            matchedPattern: validationResult.matchedPattern,
            matchType: validationResult.matchType,
            configUsed: directoryConfig,
        };
    }
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
    async checkToolPermission(tool, options = {}) {
        const { scope, path, consumeAllowOnce = true, baseDir } = options;
        // Check the basic permission level
        const level = consumeAllowOnce
            ? await this.checkPermission(tool, scope)
            : await this.checkPermissionWithoutConsumption(tool, scope);
        // Get tool configuration
        const config = await this.getToolConfig(tool, scope);
        // Perform path validation if requested
        let pathValidation;
        if (path) {
            const directoryResult = await this.checkDirectoryAccess(path, {
                tool,
                scope,
                baseDir,
            });
            pathValidation = {
                allowed: directoryResult.allowed,
                reason: directoryResult.reason,
                matchedPattern: directoryResult.matchedPattern,
                matchType: directoryResult.matchType,
            };
        }
        // Determine if the tool is allowed
        let allowed = false;
        let denialReason;
        let requiresConfirmation = false;
        if (level === 'deny') {
            allowed = false;
            denialReason = 'Tool access is explicitly denied';
        }
        else if (level === 'allow-always') {
            allowed = true;
        }
        else if (level === 'allow-once') {
            allowed = true;
        }
        else {
            // No explicit permission - check if confirmation is required based on config
            if (config?.requireConfirmation) {
                allowed = false;
                requiresConfirmation = true;
                denialReason = 'Tool requires user confirmation before execution';
            }
            else {
                // Default to allowed if no explicit deny and no confirmation requirement
                allowed = true;
            }
        }
        // If path validation was performed and failed, override the tool permission
        if (pathValidation && !pathValidation.allowed) {
            allowed = false;
            denialReason = `Directory access denied: ${pathValidation.reason}`;
        }
        // Check if tool is disabled via config
        if (config && 'enabled' in config && config.enabled === false) {
            allowed = false;
            denialReason = 'Tool is disabled via configuration';
        }
        return {
            allowed,
            level,
            requiresConfirmation,
            denialReason,
            config: config ?? undefined,
            pathValidation,
        };
    }
    /**
     * Check permission level without consuming allow-once permissions
     * This is a helper method for checkToolPermission when consumeAllowOnce is false
     *
     * @param tool The tool name to check permissions for
     * @param scope Optional scope to narrow the permission check
     * @returns The permission level for this tool/scope combination, or null if no permission exists
     */
    async checkPermissionWithoutConsumption(tool, scope) {
        const cacheKey = this.generateCacheKey(tool, scope);
        // Check session cache for 'allow-once' permissions but don't consume them
        if (this.sessionCache.has(cacheKey)) {
            return this.sessionCache.get(cacheKey);
        }
        // Check persistent store without removing allow-once permissions
        const permission = await this.store.getPermission({ tool, scope });
        return permission?.level ?? null;
    }
    /**
     * Reset the session cache, clearing all 'allow-once' permissions
     *
     * This should be called when starting a new session to ensure that
     * 'allow-once' permissions from previous sessions don't carry over.
     */
    resetSession() {
        this.sessionCache.clear();
        this.sessionDirectoryAccess.clear();
        this.sessionToolConfigCache.clear();
    }
    /**
     * Generate a cache key for the session cache based on tool and scope
     * @param tool The tool name
     * @param scope Optional scope
     * @returns A cache key string
     */
    generateCacheKey(tool, scope) {
        return scope ? `${tool}:${scope}` : tool;
    }
    /**
     * Generate a cache key for directory access cache
     * @param path The directory path
     * @param tool Optional tool name
     * @returns A cache key string
     */
    generateDirectoryAccessCacheKey(path, tool) {
        return tool ? `${tool}:${path}` : path;
    }
    /**
     * Generate a cache key for tool config cache
     * @param tool The tool name
     * @param scope Optional scope
     * @returns A cache key string
     */
    generateToolConfigCacheKey(tool, scope) {
        return scope ? `${tool}:${scope}` : tool;
    }
}
exports.PermissionManager = PermissionManager;
//# sourceMappingURL=permission-manager.js.map