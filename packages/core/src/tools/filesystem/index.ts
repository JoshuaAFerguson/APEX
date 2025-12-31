/**
 * @fileoverview Filesystem tools module exports
 *
 * This module exports tools related to filesystem operations.
 *
 * @module @apex/core/tools/filesystem
 */

export {
  ReadTool,
  type ReadToolInput,
  type ReadToolOutput,
} from './read-tool.js';

export {
  EditTool,
  type EditFileParams,
  type EditFileOutput,
  StringNotFoundError,
  AmbiguousReplacementError,
  IdenticalStringsError,
  FileAccessError,
} from './edit-tool.js';

export {
  WriteTool,
  type WriteFileParams,
  type WriteFileOutput,
  PathTraversalError,
  SensitivePathError,
} from './write-tool.js';

export {
  registerFilesystemTools,
  registerReadTool,
  createReadTool,
  registerEditTool,
  createEditTool,
  registerWriteTool,
  createWriteTool,
} from './register.js';