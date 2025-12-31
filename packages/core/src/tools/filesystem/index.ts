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
  MultiEditTool,
  type MultiEditFileParams,
  type MultiEditFileOutput,
  type MultiEditOperation,
  type EditOperationResult,
  BatchEditError,
  EditConflictError,
} from './multi-edit-tool.js';

export {
  WriteTool,
  type WriteFileParams,
  type WriteFileOutput,
  PathTraversalError,
  SensitivePathError,
} from './write-tool.js';

export {
  GlobTool,
  type GlobToolInput,
  type GlobToolOutput,
  type GlobFileResult,
} from './glob-tool.js';

export {
  registerFilesystemTools,
  registerReadTool,
  createReadTool,
  registerEditTool,
  createEditTool,
  registerMultiEditTool,
  createMultiEditTool,
  registerWriteTool,
  createWriteTool,
  registerGlobTool,
  createGlobTool,
} from './register.js';