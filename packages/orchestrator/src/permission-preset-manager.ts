import {
  PermissionPreset,
  PermissionPresetConfig,
  PermissionLevel,
  ToolPermissionBehavior,
  PERMISSION_PRESET_CONFIGS,
  getToolBehaviorForPreset,
  getPresetConfig,
  isPermissionPreset,
} from '@apexcli/core';
import { PermissionStore } from './permission-store';

/**
 * PermissionPresetManager applies preset configurations to the permission store
 *
 * This class manages permission presets that define default behavior patterns for tool access:
 * - 'autonomous': All tools allowed without confirmation (full autonomy)
 * - 'review-all': All tools require user confirmation before execution
 * - 'read-only': Only read-only tools allowed (Read, Grep, Glob, WebFetch, WebSearch)
 *
 * The manager translates preset configurations into concrete permission store entries
 * and provides methods to query effective permission levels based on preset rules.
 *
 * @example
 * ```typescript
 * // Initialize with a permission store
 * const store = new PermissionStore('/path/to/project');
 * await store.initialize();
 * const presetManager = new PermissionPresetManager(store);
 *
 * // Apply a preset
 * await presetManager.applyPreset('read-only');
 *
 * // Check effective permissions
 * const canRead = await presetManager.isToolAllowed('Read');        // true
 * const canWrite = await presetManager.isToolDenied('Write');       // true
 * const level = await presetManager.getEffectivePermissionLevel('Read'); // 'allow-always'
 * ```
 */
export class PermissionPresetManager {
  private permissionStore: PermissionStore;
  private currentPreset: PermissionPreset;

  /**
   * Create a new PermissionPresetManager instance
   * @param permissionStore The PermissionStore instance to manage permissions in
   * @param initialPreset The initial permission preset to use (defaults to 'review-all')
   */
  constructor(
    permissionStore: PermissionStore,
    initialPreset: PermissionPreset = 'review-all'
  ) {
    this.permissionStore = permissionStore;
    this.currentPreset = initialPreset;
  }

  /**
   * Apply a permission preset to the permission store
   *
   * This method clears existing permissions and applies the rules defined
   * by the specified preset configuration. It translates preset behaviors
   * into appropriate permission levels in the store.
   *
   * @param preset The permission preset to apply
   * @throws Error if the preset is invalid
   */
  async applyPreset(preset: PermissionPreset): Promise<void> {
    // Validate preset
    if (!isPermissionPreset(preset)) {
      throw new Error(`Invalid permission preset: ${preset}`);
    }

    // Get preset configuration
    const config = getPresetConfig(preset);

    // Clear all existing permissions before applying new preset
    await this.permissionStore.clearPermissions();

    // Apply preset-specific rules
    await this.applyPresetRules(config);

    // Update current preset
    this.currentPreset = preset;
  }

  /**
   * Get the currently active permission preset
   * @returns The current permission preset
   */
  getCurrentPreset(): PermissionPreset {
    return this.currentPreset;
  }

  /**
   * Get the effective permission level for a tool based on the current preset
   *
   * This method determines what permission level should be used for a given tool
   * based on the current preset configuration. It considers:
   * 1. Specific rules defined in the preset for the tool
   * 2. The preset's default behavior for tools not explicitly configured
   * 3. Any existing permissions already stored in the permission store
   *
   * @param toolName The name of the tool to check
   * @param scope Optional scope to narrow the permission check
   * @returns The effective permission level, or null if access should be denied
   */
  async getEffectivePermissionLevel(
    toolName: string,
    scope?: string
  ): Promise<PermissionLevel | null> {
    // First check if there's an existing permission in the store
    const existingPermission = await this.permissionStore.getPermission({
      tool: toolName,
      scope,
    });

    if (existingPermission) {
      return existingPermission.level;
    }

    // Fall back to preset-based behavior
    const behavior = getToolBehaviorForPreset(this.currentPreset, toolName);
    return this.behaviorToPermissionLevel(behavior);
  }

  /**
   * Check if a tool is allowed under the current preset without requiring confirmation
   *
   * @param toolName The name of the tool to check
   * @param scope Optional scope to narrow the permission check
   * @returns True if the tool is allowed without confirmation
   */
  async isToolAllowed(toolName: string, scope?: string): Promise<boolean> {
    const level = await this.getEffectivePermissionLevel(toolName, scope);
    return level === 'allow-always';
  }

  /**
   * Check if a tool requires confirmation under the current preset
   *
   * @param toolName The name of the tool to check
   * @param scope Optional scope to narrow the permission check
   * @returns True if the tool requires confirmation
   */
  async isConfirmationRequired(toolName: string, scope?: string): Promise<boolean> {
    const level = await this.getEffectivePermissionLevel(toolName, scope);
    return level === 'allow-once';
  }

  /**
   * Check if a tool is denied under the current preset
   *
   * @param toolName The name of the tool to check
   * @param scope Optional scope to narrow the permission check
   * @returns True if the tool is denied
   */
  async isToolDenied(toolName: string, scope?: string): Promise<boolean> {
    const level = await this.getEffectivePermissionLevel(toolName, scope);
    return level === 'deny' || level === null;
  }

  /**
   * Get the current preset configuration details
   * @returns The full preset configuration object
   */
  getPresetConfig(): PermissionPresetConfig {
    return getPresetConfig(this.currentPreset);
  }

  /**
   * Reset permissions and re-apply the current preset
   *
   * This is useful for ensuring the permission store is in sync with
   * the preset configuration after external changes.
   */
  async resetToPreset(): Promise<void> {
    await this.applyPreset(this.currentPreset);
  }

  /**
   * Apply the rules from a preset configuration to the permission store
   *
   * @param config The preset configuration to apply
   */
  private async applyPresetRules(config: PermissionPresetConfig): Promise<void> {
    const now = new Date();

    // Apply specific rules defined in the preset
    if (config.rules && config.rules.length > 0) {
      for (const rule of config.rules) {
        const permissionLevel = this.behaviorToPermissionLevel(rule.behavior);
        if (permissionLevel) {
          await this.permissionStore.savePermission({
            tool: rule.tool,
            scope: rule.scope,
            level: permissionLevel,
            createdAt: now,
          });
        }
      }
    }

    // Note: We don't store default behavior permissions in the store.
    // Instead, getEffectivePermissionLevel() falls back to preset behavior
    // when no specific permission is found. This keeps the store lean
    // and makes preset switching more efficient.
  }

  /**
   * Convert a tool permission behavior to a permission level
   *
   * @param behavior The tool permission behavior from preset configuration
   * @returns The corresponding permission level, or null for deny
   */
  private behaviorToPermissionLevel(behavior: ToolPermissionBehavior): PermissionLevel | null {
    switch (behavior) {
      case 'allow':
        return 'allow-always';
      case 'confirm':
        return 'allow-once';
      case 'deny':
        return 'deny';
      default:
        return null;
    }
  }
}