/**
 * @fileoverview Browser tools module exports
 *
 * This module exports browser automation tools for page interaction,
 * testing, and visual regression testing within the APEX platform.
 *
 * @module @apex/core/tools/browser
 */

// Browser tool exports
export {
  BrowserTool,
  type BrowserToolInput,
  type BrowserToolOutput,
  type BrowserOperation,
  type BrowserToolOptions,
} from './browser-tool.js';

// Tool registry convenience functions (re-exported from register module)
export {
  registerBrowserTools,
  registerBrowserToolsGlobal,
  registerBrowserTool,
  createBrowserTool,
  browserToolClasses,
  browserTools,
} from './register.js';
