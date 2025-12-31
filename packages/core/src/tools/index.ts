/**
 * @fileoverview Tools module exports
 *
 * This module exports the foundational abstractions for implementing
 * custom tools within the APEX platform.
 *
 * @module @apex/core/tools
 */

// Base tool abstractions
export {
  // Main abstract class
  BaseTool,

  // Interface
  type ToolInterface,

  // Supporting types
  type ToolExecutionContext,
  type ValidationResult,
  type ToolResult,
  type BaseToolOptions,

  // Type helpers
  type ToolInputType,
  type ToolOutputType,

  // Type guards
  isToolInterface,
  isBaseTool,
} from './base-tool.js';
