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
  // Note: ToolResult is exported from types.ts, not here, to avoid conflicts
  type ToolResult as TypedToolResult,  // Generic version for internal use
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
  GlobTool,
  type GlobToolInput,
  type GlobToolOutput,
  type GlobFileResult,
  registerFilesystemTools,
  registerReadTool,
  createReadTool,
  registerEditTool,
  createEditTool,
  registerGlobTool,
  createGlobTool,
} from './filesystem/index.js';

// Shell tools
export {
  BashTool,
  type BashToolInput,
  type BashToolOutput,
  type BashToolSyncOutput,
  type BashToolBackgroundOutput,
  BackgroundTaskManager,
  type BackgroundTaskId,
  type BackgroundTaskStatus,
  type BackgroundTaskInfo,
  type BackgroundTaskOutput,
  type BackgroundTaskManagerConfig,
  type BackgroundTaskRegisterOptions,
  type BackgroundTaskKillResult,
  type BackgroundTaskManagerEvents,
  BACKGROUND_TASK_DEFAULTS,
  registerShellTools,
  registerBashTool,
  createBashTool,
} from './shell/index.js';

// Search tools
export {
  GrepTool,
  type GrepToolInput,
  type GrepToolOutput,
  type GrepMatch,
  type GrepFileCount,
  registerSearchTools,
} from './search/index.js';

// Web tools
export {
  WebSearchTool,
  type WebSearchToolInput,
  type WebSearchToolOutput,
  type WebSearchResult,
  type WebSearchToolConfig,
  registerWebTools,
  registerWebToolsGlobal,
  registerWebSearchTool,
  createWebSearchTool,
  webToolClasses,
  webTools,
} from './web/index.js';

// Browser tools
export {
  BrowserTool,
  type BrowserToolInput,
  type BrowserToolOutput,
  type BrowserOperation,
  type BrowserToolOptions,
  registerBrowserTools,
  registerBrowserToolsGlobal,
  registerBrowserTool,
  createBrowserTool,
  browserToolClasses,
  browserTools,
} from './browser/index.js';
