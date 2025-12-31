import {
  Permission,
  PermissionLevel,
  PermissionQuery,
} from '@apexcli/core';
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
export class PermissionManager {
  private store: PermissionStore;
  private sessionCache: Map<string, PermissionLevel> = new Map();

  /**
   * Create a new PermissionManager instance
   * @param store The PermissionStore instance to use for persistent storage
   */
  constructor(store: PermissionStore) {
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
  async checkPermission(tool: string, scope?: string): Promise<PermissionLevel | null> {
    const cacheKey = this.generateCacheKey(tool, scope);

    // First check session cache for 'allow-once' permissions
    if (this.sessionCache.has(cacheKey)) {
      const cachedLevel = this.sessionCache.get(cacheKey)!;

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
  async grantPermission(tool: string, scope: string | undefined, level: PermissionLevel): Promise<void> {
    if (level === 'allow-once') {
      // Store 'allow-once' permissions only in the session cache
      const cacheKey = this.generateCacheKey(tool, scope);
      this.sessionCache.set(cacheKey, level);
    } else {
      // Store persistent permissions in the database
      const permission: Permission = {
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
  async revokePermission(tool: string, scope?: string): Promise<boolean> {
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
  async hasPermission(tool: string, scope?: string): Promise<boolean> {
    const level = await this.checkPermission(tool, scope);
    return level === 'allow-always' || level === 'allow-once';
  }

  /**
   * Reset the session cache, clearing all 'allow-once' permissions
   *
   * This should be called when starting a new session to ensure that
   * 'allow-once' permissions from previous sessions don't carry over.
   */
  resetSession(): void {
    this.sessionCache.clear();
  }

  /**
   * Generate a cache key for the session cache based on tool and scope
   * @param tool The tool name
   * @param scope Optional scope
   * @returns A cache key string
   */
  private generateCacheKey(tool: string, scope?: string): string {
    return scope ? `${tool}:${scope}` : tool;
  }
}