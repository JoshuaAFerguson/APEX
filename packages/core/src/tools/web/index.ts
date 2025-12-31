/**
 * @fileoverview Web tools module exports
 *
 * This module exports web-related tools for web search and fetching
 * operations within the APEX platform.
 *
 * @module @apex/core/tools/web
 */

// Web search tool exports
export {
  WebSearchTool,
  type WebSearchToolInput,
  type WebSearchToolOutput,
  type WebSearchResult,
  type WebSearchToolConfig,
} from './web-search-tool.js';

// Tool registry convenience functions
import type { ToolRegistry } from '../tool-registry.js';
import { WebSearchTool, type WebSearchToolConfig } from './web-search-tool.js';

/**
 * Registers all web tools with the provided registry.
 *
 * @param registry - The tool registry to register tools with
 * @param config - Optional configuration for web tools
 */
export function registerWebTools(
  registry: ToolRegistry,
  config?: WebSearchToolConfig
): void {
  registerWebSearchTool(registry, config);
}

/**
 * Registers the WebSearch tool with the provided registry.
 *
 * @param registry - The tool registry to register the tool with
 * @param config - Optional configuration for the WebSearchTool
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
 */
export function createWebSearchTool(config?: WebSearchToolConfig): WebSearchTool {
  return new WebSearchTool(config);
}
