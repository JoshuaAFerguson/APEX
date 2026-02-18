/**
 * @fileoverview Shell tools module exports
 *
 * This module exports shell-related tools for command execution
 * within the APEX platform.
 *
 * @module @apex/core/tools/shell
 */

// Bash tool exports
export {
  BashTool,
  type BashToolInput,
  type BashToolOutput,
  type BashToolSyncOutput,
  type BashToolBackgroundOutput,
} from './bash-tool.js';

// Background task management exports
export {
  BackgroundTaskManager,
} from './background-task-manager.js';

export {
  type BackgroundTaskId,
  type BackgroundTaskStatus,
  type BackgroundTaskInfo,
  type BackgroundTaskOutput,
  type BackgroundTaskManagerConfig,
  type BackgroundTaskRegisterOptions,
  type BackgroundTaskKillResult,
  type BackgroundTaskManagerEvents,
  BACKGROUND_TASK_DEFAULTS,
} from './background-task-types.js';

// Security module exports
export {
  CommandSandbox,
  type SandboxConfig,
  createStrictSandbox,
  createPermissiveSandbox,
  createDisabledSandbox,
} from './command-sandbox.js';

export {
  checkCommandBlocklist,
  getAllBlocklistPatterns,
  getBlocklistCategories,
  getBlocklistCategory,
  COMMAND_BLOCKLIST,
  type CommandValidationResult,
  type BlocklistCategory,
} from './blocklist.js';

export {
  detectPathTraversal,
  validateWorkingDirectory,
  extractPathsFromCommand,
  checkPathEscapesBase,
  normalizePath,
  pathsEqual,
  getRelativePathIfWithin,
  type PathTraversalResult,
} from './path-validator.js';

// Tool registry convenience functions
import type { ToolRegistry } from '../tool-registry.js';
import { BashTool } from './bash-tool.js';
import type { SandboxConfig } from './command-sandbox.js';

/**
 * Registers all shell tools with the provided registry.
 *
 * @param registry - The tool registry to register tools with
 * @param sandboxConfig - Optional sandbox configuration for the BashTool
 */
export function registerShellTools(
  registry: ToolRegistry,
  sandboxConfig?: Partial<SandboxConfig>
): void {
  registerBashTool(registry, sandboxConfig);
}

/**
 * Registers the Bash tool with the provided registry.
 *
 * @param registry - The tool registry to register the tool with
 * @param sandboxConfig - Optional sandbox configuration for the BashTool
 */
export function registerBashTool(
  registry: ToolRegistry,
  sandboxConfig?: Partial<SandboxConfig>
): void {
  registry.register(new BashTool(sandboxConfig));
}

/**
 * Creates a new instance of the Bash tool.
 *
 * @param sandboxConfig - Optional sandbox configuration
 * @returns A new BashTool instance
 */
export function createBashTool(sandboxConfig?: Partial<SandboxConfig>): BashTool {
  return new BashTool(sandboxConfig);
}