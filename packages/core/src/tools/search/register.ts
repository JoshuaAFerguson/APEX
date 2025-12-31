/**
 * @fileoverview Search tools registration utilities
 *
 * This module provides utilities for registering search tools with the ToolRegistry.
 * It follows the same patterns as other tool categories.
 *
 * @module @apex/core/tools/search/register
 */

import { ToolRegistry } from '../tool-registry.js';
import { GrepTool } from './grep-tool.js';

/**
 * Registers all search tools with the tool registry.
 *
 * @param registry - The tool registry instance to register tools with
 */
export function registerSearchTools(registry: ToolRegistry): void {
  registry.register(new GrepTool());
}

/**
 * Array of all search tool constructors for easy access
 */
export const searchToolClasses = [GrepTool] as const;

/**
 * Array of search tool instances
 */
export const searchTools = searchToolClasses.map(ToolClass => new ToolClass());