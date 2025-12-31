/**
 * @fileoverview Registration utilities for web tools
 *
 * This module provides convenience functions for registering web tools
 * with the global tool registry and parameterized registries.
 *
 * @module @apex/core/tools/web/register
 */

import { getToolRegistry } from '../tool-registry.js';
import type { ToolRegistry } from '../tool-registry.js';
import { WebSearchTool, type WebSearchToolConfig } from './web-search-tool.js';


/**
 * Registers all web tools with the provided registry.
 * This is the main function that matches the original API.
 *
 * @param registry - The tool registry to register tools with
 * @param config - Optional configuration for web tools
 * @throws {DuplicateToolError} If any tool is already registered
 *
 * @example
 * ```typescript
 * import { ToolRegistry } from '@apex/core/tools';
 * import { registerWebTools } from '@apex/core/tools/web/register';
 *
 * const registry = new ToolRegistry();
 * registerWebTools(registry);
 * ```
 */
export function registerWebTools(
  registry: ToolRegistry,
  config?: WebSearchToolConfig
): void {
  registerWebSearchTool(registry, config);
}

/**
 * Registers all web tools with the global registry.
 * This is a convenience function that uses the global registry.
 *
 * @param config - Optional configuration for web tools
 * @throws {DuplicateToolError} If any tool is already registered
 *
 * @example
 * ```typescript
 * import { registerWebToolsGlobal } from '@apex/core/tools/web/register';
 *
 * // Register all web tools with default configuration
 * registerWebToolsGlobal();
 * ```
 */
export function registerWebToolsGlobal(config?: WebSearchToolConfig): void {
  const registry = getToolRegistry();
  registerWebTools(registry, config);
}

/**
 * Registers the WebSearch tool with the provided registry.
 *
 * @param registry - The tool registry to register the tool with
 * @param config - Optional configuration for the WebSearchTool
 * @throws {DuplicateToolError} If the WebSearch tool is already registered
 *
 * @example
 * ```typescript
 * import { ToolRegistry } from '@apex/core/tools';
 * import { registerWebSearchTool } from '@apex/core/tools/web/register';
 *
 * const registry = new ToolRegistry();
 * registerWebSearchTool(registry);
 * ```
 */
export function registerWebSearchTool(
  registry: ToolRegistry,
  config?: WebSearchToolConfig
): void {
  registry.register(new WebSearchTool(config));
}

/**
 * Creates a new instance of the WebSearch tool.
 *
 * @param config - Optional configuration
 * @returns A new WebSearchTool instance
 *
 * @example
 * ```typescript
 * import { createWebSearchTool } from '@apex/core/tools/web/register';
 *
 * const webSearchTool = createWebSearchTool();
 * // Use the tool instance directly or register it manually
 * ```
 */
export function createWebSearchTool(config?: WebSearchToolConfig): WebSearchTool {
  return new WebSearchTool(config);
}

/**
 * Array of all web tool constructors for easy access
 */
export const webToolClasses = [WebSearchTool] as const;

/**
 * Array of web tool instances with default configuration
 */
export const webTools = webToolClasses.map(ToolClass => new ToolClass());