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

// Tool registry
export {
  // Main registry class
  ToolRegistry,

  // Error classes
  DuplicateToolError,
  ToolNotFoundError,
  ToolValidationError,

  // Event types
  type ToolRegistryEvents,
  type ToolRegistryEventListener,

  // Options
  type ToolRegistryOptions,

  // Convenience functions
  getToolRegistry,
  registerTool,
  unregisterTool,
} from './tool-registry.js';

// Filesystem tools
export {
  ReadTool,
  type ReadToolInput,
  type ReadToolOutput,
  EditTool,
  type EditFileParams,
  type EditFileOutput,
  StringNotFoundError,
  AmbiguousReplacementError,
  IdenticalStringsError,
  FileAccessError,
  registerFilesystemTools,
  registerReadTool,
  createReadTool,
  registerEditTool,
  createEditTool,
} from './filesystem/index.js';

