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

// Tool registry convenience functions (re-exported from register module)
export {
  registerWebTools,
  registerWebToolsGlobal,
  registerWebSearchTool,
  createWebSearchTool,
  webToolClasses,
  webTools,
} from './register.js';
