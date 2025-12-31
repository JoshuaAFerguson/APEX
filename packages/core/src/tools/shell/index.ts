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
} from './bash-tool.js';

// Tool registry convenience functions
import type { ToolRegistry } from '../tool-registry.js';
import { BashTool } from './bash-tool.js';

/**
 * Registers all shell tools with the provided registry.
 *
 * @param registry - The tool registry to register tools with
 */
export function registerShellTools(registry: ToolRegistry): void {
  registerBashTool(registry);
}

/**
 * Registers the Bash tool with the provided registry.
 *
 * @param registry - The tool registry to register the tool with
 */
export function registerBashTool(registry: ToolRegistry): void {
  registry.register(new BashTool());
}

/**
 * Creates a new instance of the Bash tool.
 *
 * @returns A new BashTool instance
 */
export function createBashTool(): BashTool {
  return new BashTool();
}